import { bytesToHex } from "@noble/hashes/utils";
import {
  BinaryDocument,
  calculateDocId,
  ConfigKind,
  DocType,
  InvitePolicy,
  InvitePolicyValue,
  readActiveMembersTableBlock,
  readConfigKindBlock,
  readCosignaturesBlock,
  readDeadlineBlock,
  readInactivityDaysBlock,
  readInvitePolicyBlock,
  readPickTargetBlock,
  readQuorumPctBlock,
  readTimestampBlock,
  readUtf8Block,
  Tag,
  unpackAndVerifyDocument,
  verifyInviteProof,
} from "@sintetizing/wire";
import { buildInspectedDocument } from "./inspector.js";
import {
  CategorySummaryView,
  CommunityConfigVersion,
  CommunityProjection,
  ConfigVersionStatus,
  InspectedDocument,
  MemberStatus,
  MemberView,
  PickHistoryEntry,
  ProposalSummaryView,
  SnapshotSummaryView,
  SubjectSummaryView,
} from "./types.js";

const DAY_MS = 86_400_000;

interface VerifiedEnvelope {
  readonly docIdHex: string;
  readonly doc: BinaryDocument;
  readonly inspected: InspectedDocument;
  readonly scope: string;
  readonly timestampMs: number;
  readonly authorPubHex: string;
}

interface ParsedCmntDraft {
  readonly docIdHex: string;
  readonly parentHashHex: string | null;
  readonly authorPubHex: string;
  readonly scope: string;
  readonly title: string;
  readonly body: string;
  readonly quorumPct: number;
  readonly inactivityDays: number;
  readonly invitePolicy: InvitePolicyValue;
  readonly parentCommunityHashHex: string | null;
  readonly timestampMs: number;
  readonly seq: number;
}

interface MutableMemberState {
  pubHex: string;
  displayName: string | null;
  displayNameTs: number;
  isFounder: boolean;
  invitedByPubHex: string | null;
  joinedAtMs: number;
  lastActivityMs: number;
  joinSeq: number;
  joinDocIdHex: string;
  leftAtMs: number | null;
  leftSeq: number | null;
  pickCount: number;
}

interface PickEventRecord {
  readonly docIdHex: string;
  readonly scope: string;
  readonly authorPubHex: string;
  readonly seq: number;
  readonly timestampMs: number;
  readonly targetHex: string;
}

/**
 * Calcula quantos apoios são necessários para atingir o quórum percentual arredondado para cima.
 */
export function computeQuorumRequired(activeCount: number, quorumPct: number): number {
  if (activeCount <= 0 || quorumPct <= 0) {
    return 0;
  }
  return Math.ceil((activeCount * quorumPct) / 100);
}

function compareChronological(
  a: { timestampMs: number; seq?: number; docIdHex: string },
  b: { timestampMs: number; seq?: number; docIdHex: string }
): number {
  if (a.timestampMs !== b.timestampMs) {
    return a.timestampMs - b.timestampMs;
  }
  if ((a.seq ?? 0) !== (b.seq ?? 0)) {
    return (a.seq ?? 0) - (b.seq ?? 0);
  }
  return a.docIdHex.localeCompare(b.docIdHex);
}

function isNewerSeqOrTime(
  candidate: { seq: number; timestampMs: number; docIdHex: string },
  current: { seq: number; timestampMs: number; docIdHex: string }
): boolean {
  if (candidate.seq !== current.seq) {
    return candidate.seq > current.seq;
  }
  if (candidate.timestampMs !== current.timestampMs) {
    return candidate.timestampMs > current.timestampMs;
  }
  return candidate.docIdHex > current.docIdHex;
}

function parseCmntDraft(env: VerifiedEnvelope): ParsedCmntDraft | null {
  if (env.doc.docType !== DocType.CONFIG || env.scope.includes("/")) {
    return null;
  }
  const kindBlock = env.doc.blocks.find((b) => b.tag === Tag.CONFIG_KIND);
  const kind = kindBlock ? readConfigKindBlock(kindBlock) : ConfigKind.COMMUNITY;
  if (kind !== ConfigKind.COMMUNITY) {
    return null;
  }

  const titleBlock = env.doc.blocks.find((b) => b.tag === Tag.TITLE);
  const bodyBlock = env.doc.blocks.find((b) => b.tag === Tag.BODY);
  const quorumBlock = env.doc.blocks.find((b) => b.tag === Tag.QUORUM_PCT);
  const inactivityBlock = env.doc.blocks.find((b) => b.tag === Tag.INACTIVITY_DAYS);
  const invitePolicyBlock = env.doc.blocks.find((b) => b.tag === Tag.INVITE_POLICY);
  const parentBlock = env.doc.blocks.find((b) => b.tag === Tag.PARENT_HASH);
  const parentCommBlock = env.doc.blocks.find((b) => b.tag === Tag.PARENT_COMMUNITY_HASH);

  return {
    docIdHex: env.docIdHex,
    parentHashHex: parentBlock ? bytesToHex(parentBlock.value) : null,
    authorPubHex: env.authorPubHex,
    scope: env.scope,
    title: titleBlock ? readUtf8Block(titleBlock) : "Comunidade",
    body: bodyBlock ? readUtf8Block(bodyBlock) : "",
    quorumPct: quorumBlock ? readQuorumPctBlock(quorumBlock) : 51,
    inactivityDays: inactivityBlock ? readInactivityDaysBlock(inactivityBlock) : 30,
    invitePolicy: invitePolicyBlock ? readInvitePolicyBlock(invitePolicyBlock) : InvitePolicy.ANY_ACTIVE_MEMBER,
    parentCommunityHashHex: parentCommBlock ? bytesToHex(parentCommBlock.value) : null,
    timestampMs: env.timestampMs,
    seq: env.doc.seq,
  };
}

function isMemberInactive(member: MutableMemberState, inactivityDays: number, nowMs: number): boolean {
  if (member.lastActivityMs <= 0) {
    return false;
  }
  return nowMs - member.lastActivityMs > inactivityDays * DAY_MS;
}

function latestPickByAuthor(picks: readonly PickEventRecord[]): Map<string, PickEventRecord> {
  const latest = new Map<string, PickEventRecord>();
  for (const pick of picks) {
    const prev = latest.get(pick.authorPubHex);
    if (!prev || isNewerSeqOrTime(pick, prev)) {
      latest.set(pick.authorPubHex, pick);
    }
  }
  return latest;
}

function buildContentViews(
  sortedVerified: readonly VerifiedEnvelope[],
  subjectPicksRaw: readonly PickEventRecord[],
  activeMembersSet: ReadonlySet<string>
): {
  readonly categories: CategorySummaryView[];
  readonly subjects: SubjectSummaryView[];
  readonly proposals: ProposalSummaryView[];
  readonly snapshots: SnapshotSummaryView[];
} {
  const proposalsByScope = new Map<string, ProposalSummaryView[]>();
  const picksByScope = new Map<string, PickEventRecord[]>();
  for (const pick of subjectPicksRaw) {
    const arr = picksByScope.get(pick.scope) ?? [];
    arr.push(pick);
    picksByScope.set(pick.scope, arr);
  }

  const proposals: ProposalSummaryView[] = [];
  for (const env of sortedVerified) {
    if (env.doc.docType !== DocType.PROPOSAL) {
      continue;
    }
    const scopePicks = latestPickByAuthor(picksByScope.get(env.scope) ?? []);
    const supporterPubs: string[] = [];
    for (const [authorHex, pick] of scopePicks.entries()) {
      if (activeMembersSet.has(authorHex) && pick.targetHex === env.docIdHex) {
        supporterPubs.push(authorHex);
      }
    }
    const titleBlock = env.doc.blocks.find((b) => b.tag === Tag.TITLE);
    const bodyBlock = env.doc.blocks.find((b) => b.tag === Tag.BODY);
    const authorNameBlock = env.doc.blocks.find((b) => b.tag === Tag.AUTHOR_NAME);
    const parentBlock = env.doc.blocks.find((b) => b.tag === Tag.PARENT_HASH);

    const item: ProposalSummaryView = {
      docIdHex: env.docIdHex,
      scope: env.scope,
      title: titleBlock ? readUtf8Block(titleBlock) : "Proposta",
      body: bodyBlock ? readUtf8Block(bodyBlock) : "",
      authorPubHex: env.authorPubHex,
      authorName: authorNameBlock ? readUtf8Block(authorNameBlock) : null,
      parentHashHex: parentBlock ? bytesToHex(parentBlock.value) : null,
      timestampMs: env.timestampMs,
      pickCount: supporterPubs.length,
      supporterPubs,
    };
    proposals.push(item);
    const list = proposalsByScope.get(env.scope) ?? [];
    list.push(item);
    proposalsByScope.set(env.scope, list);
  }

  const subjects: SubjectSummaryView[] = [];
  const subjectCountByCategory = new Map<string, number>();
  for (const env of sortedVerified) {
    if (env.doc.docType !== DocType.CONFIG) {
      continue;
    }
    const kindBlock = env.doc.blocks.find((b) => b.tag === Tag.CONFIG_KIND);
    if (!kindBlock || readConfigKindBlock(kindBlock) !== ConfigKind.SUBJECT) {
      continue;
    }
    const titleBlock = env.doc.blocks.find((b) => b.tag === Tag.TITLE);
    const bodyBlock = env.doc.blocks.find((b) => b.tag === Tag.BODY);
    const quorumBlock = env.doc.blocks.find((b) => b.tag === Tag.QUORUM_PCT);
    const deadlineBlock = env.doc.blocks.find((b) => b.tag === Tag.DEADLINE);
    const categoryBlock = env.doc.blocks.find((b) => b.tag === Tag.CATEGORY_HASH);
    const categoryHashHex = categoryBlock ? bytesToHex(categoryBlock.value) : null;

    if (categoryHashHex) {
      subjectCountByCategory.set(
        categoryHashHex,
        (subjectCountByCategory.get(categoryHashHex) ?? 0) + 1
      );
    }

    subjects.push({
      scope: env.scope,
      docIdHex: env.docIdHex,
      categoryHashHex,
      title: titleBlock ? readUtf8Block(titleBlock) : "Assunto",
      body: bodyBlock ? readUtf8Block(bodyBlock) : "",
      quorumPct: quorumBlock ? readQuorumPctBlock(quorumBlock) : 51,
      deadlineUnixSeconds: deadlineBlock ? readDeadlineBlock(deadlineBlock) : null,
      authorPubHex: env.authorPubHex,
      timestampMs: env.timestampMs,
      proposalCount: proposalsByScope.get(env.scope)?.length ?? 0,
    });
  }

  const categories: CategorySummaryView[] = [];
  for (const env of sortedVerified) {
    if (env.doc.docType !== DocType.CONFIG) {
      continue;
    }
    const kindBlock = env.doc.blocks.find((b) => b.tag === Tag.CONFIG_KIND);
    if (!kindBlock || readConfigKindBlock(kindBlock) !== ConfigKind.CATEGORY) {
      continue;
    }
    const titleBlock = env.doc.blocks.find((b) => b.tag === Tag.TITLE);
    const bodyBlock = env.doc.blocks.find((b) => b.tag === Tag.BODY);
    categories.push({
      docIdHex: env.docIdHex,
      scope: env.scope,
      title: titleBlock ? readUtf8Block(titleBlock) : "Categoria",
      body: bodyBlock ? readUtf8Block(bodyBlock) : "",
      authorPubHex: env.authorPubHex,
      timestampMs: env.timestampMs,
      subjectCount: subjectCountByCategory.get(env.docIdHex) ?? 0,
    });
  }

  const snapshots: SnapshotSummaryView[] = [];
  for (const env of sortedVerified) {
    if (env.doc.docType !== DocType.SNAPSHOT) {
      continue;
    }
    const cutoffBlock = env.doc.blocks.find((b) => b.tag === Tag.CUTOFF_HASH);
    const activeCmntBlock = env.doc.blocks.find((b) => b.tag === Tag.ACTIVE_CMNT_HASH);
    const tableBlock = env.doc.blocks.find((b) => b.tag === Tag.ACTIVE_MEMBERS_TABLE);
    const cosigBlock = env.doc.blocks.find((b) => b.tag === Tag.COSIGNATURES);
    snapshots.push({
      docIdHex: env.docIdHex,
      authorPubHex: env.authorPubHex,
      timestampMs: env.timestampMs,
      cutoffHashHex: cutoffBlock ? bytesToHex(cutoffBlock.value) : "",
      activeCmntHashHex: activeCmntBlock ? bytesToHex(activeCmntBlock.value) : "",
      memberCount: tableBlock ? readActiveMembersTableBlock(tableBlock).length : 0,
      cosignatureCount: cosigBlock ? readCosignaturesBlock(cosigBlock).length : 0,
    });
  }

  return {
    categories,
    subjects: subjects.reverse(),
    proposals: proposals.reverse(),
    snapshots: snapshots.reverse(),
  };
}

function buildPickHistory(
  subjectPicksRaw: readonly PickEventRecord[],
  communityPicksRaw: readonly PickEventRecord[],
  proposals: readonly ProposalSummaryView[],
  configVersions: readonly CommunityConfigVersion[]
): PickHistoryEntry[] {
  const proposalTitles = new Map<string, string>();
  for (const prop of proposals) {
    proposalTitles.set(prop.docIdHex, prop.title);
  }
  const configTitles = new Map<string, string>();
  for (const cfg of configVersions) {
    configTitles.set(cfg.docIdHex, `${cfg.title} (v${cfg.versionIndex})`);
  }

  const entries: PickHistoryEntry[] = [
    ...subjectPicksRaw.map((p) => ({
      docIdHex: p.docIdHex,
      kind: "PROPOSAL" as const,
      scope: p.scope,
      authorPubHex: p.authorPubHex,
      targetHashHex: p.targetHex,
      targetTitle: proposalTitles.get(p.targetHex) ?? null,
      seq: p.seq,
      timestampMs: p.timestampMs,
    })),
    ...communityPicksRaw.map((p) => ({
      docIdHex: p.docIdHex,
      kind: "COMMUNITY" as const,
      scope: p.scope,
      authorPubHex: p.authorPubHex,
      targetHashHex: p.targetHex,
      targetTitle: configTitles.get(p.targetHex) ?? null,
      seq: p.seq,
      timestampMs: p.timestampMs,
    })),
  ];

  return entries.sort(
    (a, b) =>
      b.timestampMs - a.timestampMs ||
      b.seq - a.seq ||
      b.docIdHex.localeCompare(a.docIdHex)
  );
}

/**
 * Projeta de forma pura e determinística o estado completo de uma comunidade
 * a partir de todos os pacotes TLV binários verificados (.cmnt, .memb, .stze, .snap).
 */
export async function projectCommunityState(
  packets: readonly Uint8Array[],
  communityId: string,
  nowMs: number
): Promise<CommunityProjection> {
  const seenIds = new Set<string>();
  const verified: VerifiedEnvelope[] = [];
  let rejectedPacketCount = 0;

  for (const rawBytes of packets) {
    const docIdHex = bytesToHex(calculateDocId(rawBytes));
    if (seenIds.has(docIdHex)) {
      continue;
    }
    seenIds.add(docIdHex);

    try {
      const doc = await unpackAndVerifyDocument(rawBytes);
      const inspected = buildInspectedDocument(docIdHex, rawBytes.length, doc);
      if (
        !inspected.scope ||
        (inspected.scope !== communityId && !inspected.scope.startsWith(`${communityId}/`))
      ) {
        continue;
      }
      verified.push({
        docIdHex,
        doc,
        inspected,
        scope: inspected.scope,
        timestampMs: inspected.timestampMs ?? 0,
        authorPubHex: inspected.authorPubHex,
      });
    } catch {
      rejectedPacketCount++;
    }
  }

  const documents = verified
    .map((v) => v.inspected)
    .sort((a, b) => {
      const tsA = a.timestampMs ?? 0;
      const tsB = b.timestampMs ?? 0;
      if (tsB !== tsA) {
        return tsB - tsA;
      }
      return b.docIdHex.localeCompare(a.docIdHex);
    });

  const cmntDrafts = verified
    .map(parseCmntDraft)
    .filter((d): d is ParsedCmntDraft => d !== null)
    .sort(compareChronological);

  const sortedVerified = [...verified].sort(compareChronological);
  const genesis = cmntDrafts.find((d) => d.parentHashHex === null);
  if (!genesis) {
    const contentWithoutGenesis = buildContentViews(sortedVerified, [], new Set());
    return {
      communityId,
      activeConfig: null,
      configVersions: [],
      members: [],
      activeMemberCount: 0,
      categories: contentWithoutGenesis.categories,
      subjects: contentWithoutGenesis.subjects,
      proposals: contentWithoutGenesis.proposals,
      snapshots: contentWithoutGenesis.snapshots,
      pickHistory: [],
      documents,
      rejectedPacketCount,
    };
  }

  // Registro inicial com o fundador
  const membersMap = new Map<string, MutableMemberState>();
  membersMap.set(genesis.authorPubHex, {
    pubHex: genesis.authorPubHex,
    displayName: null,
    displayNameTs: -1,
    isFounder: true,
    invitedByPubHex: null,
    joinedAtMs: genesis.timestampMs,
    lastActivityMs: genesis.timestampMs,
    joinSeq: genesis.seq,
    joinDocIdHex: genesis.docIdHex,
    leftAtMs: null,
    leftSeq: null,
    pickCount: 0,
  });

  // Processa entradas MEMB_JOIN por convite assinado em ordem cronológica
  const joinPackets = verified
    .filter((v) => v.doc.docType === DocType.MEMB_JOIN && v.scope === communityId)
    .sort(compareChronological);

  const acceptedJoinPaks: VerifiedEnvelope[] = [];
  for (const joinEnv of joinPackets) {
    const inviteBlock = joinEnv.doc.blocks.find((b) => b.tag === Tag.INVITE_PROOF);
    if (!inviteBlock) {
      continue;
    }
    const proof = await verifyInviteProof(communityId, inviteBlock.value);
    if (!proof) {
      continue;
    }
    const joinTs = joinEnv.timestampMs > 0 ? joinEnv.timestampMs : proof.issuedAtMs;
    if (proof.expiresAtMs < joinTs) {
      continue;
    }
    const inviterHex = bytesToHex(proof.inviterPub);
    const inviter = membersMap.get(inviterHex);
    if (!inviter || (inviter.leftAtMs !== null && inviter.leftAtMs < proof.issuedAtMs)) {
      continue;
    }
    if (genesis.invitePolicy === InvitePolicy.FOUNDER_ONLY && inviterHex !== genesis.authorPubHex) {
      continue;
    }

    acceptedJoinPaks.push(joinEnv);
    const existing = membersMap.get(joinEnv.authorPubHex);
    if (!existing) {
      membersMap.set(joinEnv.authorPubHex, {
        pubHex: joinEnv.authorPubHex,
        displayName: null,
        displayNameTs: -1,
        isFounder: false,
        invitedByPubHex: inviterHex,
        joinedAtMs: joinTs,
        lastActivityMs: joinTs,
        joinSeq: joinEnv.doc.seq,
        joinDocIdHex: joinEnv.docIdHex,
        leftAtMs: null,
        leftSeq: null,
        pickCount: 0,
      });
    } else if (existing.leftAtMs !== null && joinTs >= existing.leftAtMs) {
      existing.leftAtMs = null;
      existing.leftSeq = null;
      existing.invitedByPubHex = inviterHex;
      existing.joinedAtMs = joinTs;
      existing.lastActivityMs = Math.max(existing.lastActivityMs, joinTs);
      existing.joinSeq = joinEnv.doc.seq;
      existing.joinDocIdHex = joinEnv.docIdHex;
    }
  }

  // Consolida nomes, atividade recente, picks e saídas voluntárias
  for (const env of sortedVerified) {
    const member = membersMap.get(env.authorPubHex);
    if (!member) {
      continue;
    }

    const nameBlock = env.doc.blocks.find((b) => b.tag === Tag.AUTHOR_NAME);
    if (nameBlock && env.timestampMs >= member.displayNameTs) {
      member.displayName = readUtf8Block(nameBlock);
      member.displayNameTs = env.timestampMs;
    }

    if (env.doc.docType === DocType.MEMB_LEAVE && env.scope === communityId) {
      if (env.timestampMs >= member.joinedAtMs) {
        member.leftAtMs = env.timestampMs;
        member.leftSeq = env.doc.seq;
      }
    } else if (member.leftAtMs === null || env.timestampMs <= member.leftAtMs) {
      if (env.timestampMs > member.lastActivityMs) {
        member.lastActivityMs = env.timestampMs;
      }
      if (env.doc.docType === DocType.PICK || env.doc.docType === DocType.COMMUNITY_PICK) {
        member.pickCount += 1;
      }
    }
  }

  // Coleta últimos COMMUNITY_PICK de membros não saídos
  const communityPicksRaw: PickEventRecord[] = [];
  const subjectPicksRaw: PickEventRecord[] = [];
  for (const env of verified) {
    if (!membersMap.has(env.authorPubHex)) {
      continue;
    }
    const targetBlock = env.doc.blocks.find((b) => b.tag === Tag.PICK_TARGET);
    if (!targetBlock) {
      continue;
    }
    const target = readPickTargetBlock(targetBlock);
    if (!target.targetHash) {
      continue;
    }
    const rec: PickEventRecord = {
      docIdHex: env.docIdHex,
      scope: env.scope,
      authorPubHex: env.authorPubHex,
      seq: env.doc.seq,
      timestampMs: env.timestampMs,
      targetHex: bytesToHex(target.targetHash),
    };
    if (env.doc.docType === DocType.COMMUNITY_PICK && env.scope === communityId) {
      communityPicksRaw.push(rec);
    } else if (env.doc.docType === DocType.PICK) {
      subjectPicksRaw.push(rec);
    }
  }

  const latestCommunityPickMap = latestPickByAuthor(communityPicksRaw);

  // Resolução iterativa da cadeia .cmnt (v1 -> v2 -> v3...)
  let currentActive: ParsedCmntDraft = genesis;
  const versionIndexMap = new Map<string, number>([[genesis.docIdHex, 1]]);
  const statusMap = new Map<string, ConfigVersionStatus>([[genesis.docIdHex, "ACTIVE"]]);
  const childrenMap = new Map<string, ParsedCmntDraft[]>();
  for (const draft of cmntDrafts) {
    if (draft.parentHashHex) {
      const list = childrenMap.get(draft.parentHashHex) ?? [];
      list.push(draft);
      childrenMap.set(draft.parentHashHex, list);
    }
  }

  let nextVersionNum = 2;
  const visitedConfigs = new Set<string>([genesis.docIdHex]);

  while (true) {
    const activeMembersAtStep = Array.from(membersMap.values()).filter(
      (m) => m.leftAtMs === null && !isMemberInactive(m, currentActive.inactivityDays, nowMs)
    );
    const activeSet = new Set(activeMembersAtStep.map((m) => m.pubHex));
    const required = computeQuorumRequired(activeMembersAtStep.length, currentActive.quorumPct);

    const children = (childrenMap.get(currentActive.docIdHex) ?? []).filter(
      (c) => !visitedConfigs.has(c.docIdHex)
    );
    if (children.length === 0 || activeMembersAtStep.length === 0 || required <= 0) {
      break;
    }

    let winner: ParsedCmntDraft | null = null;
    let winnerCount = -1;

    for (const child of children) {
      let count = 0;
      for (const authorHex of activeSet) {
        if (latestCommunityPickMap.get(authorHex)?.targetHex === child.docIdHex) {
          count += 1;
        }
      }
      if (count >= required) {
        if (
          winner === null ||
          count > winnerCount ||
          (count === winnerCount && compareChronological(child, winner) < 0)
        ) {
          winner = child;
          winnerCount = count;
        }
      }
    }

    if (!winner) {
      break;
    }

    statusMap.set(currentActive.docIdHex, "SUPERSEDED");
    statusMap.set(winner.docIdHex, "ACTIVE");
    versionIndexMap.set(winner.docIdHex, nextVersionNum++);
    visitedConfigs.add(winner.docIdHex);
    currentActive = winner;
  }

  // Constrói lista final de membros usando o inactivityDays da versão ativa final
  const activeMembersFinalSet = new Set<string>();
  const members: MemberView[] = Array.from(membersMap.values())
    .map((m) => {
      let status: MemberStatus;
      if (m.leftAtMs !== null) {
        status = "LEFT";
      } else if (isMemberInactive(m, currentActive.inactivityDays, nowMs)) {
        status = "INACTIVE";
      } else {
        status = "ACTIVE";
        activeMembersFinalSet.add(m.pubHex);
      }
      return {
        pubHex: m.pubHex,
        displayName: m.displayName,
        isFounder: m.isFounder,
        invitedByPubHex: m.invitedByPubHex,
        joinedAtMs: m.joinedAtMs,
        lastActivityMs: m.lastActivityMs,
        status,
        pickCount: m.pickCount,
        joinDocIdHex: m.joinDocIdHex,
      };
    })
    .sort((a, b) => a.joinedAtMs - b.joinedAtMs || a.pubHex.localeCompare(b.pubHex));

  const requiredForNext = computeQuorumRequired(
    activeMembersFinalSet.size,
    currentActive.quorumPct
  );

  // Consolida versões .cmnt para exibição
  const configVersions: CommunityConfigVersion[] = cmntDrafts.map((draft, idx) => {
    const supporterPubs: string[] = [];
    for (const authorHex of activeMembersFinalSet) {
      if (latestCommunityPickMap.get(authorHex)?.targetHex === draft.docIdHex) {
        supporterPubs.push(authorHex);
      }
    }
    const status = statusMap.get(draft.docIdHex) ?? "PENDING";
    return {
      docIdHex: draft.docIdHex,
      versionIndex: versionIndexMap.get(draft.docIdHex) ?? idx + 1,
      parentHashHex: draft.parentHashHex,
      authorPubHex: draft.authorPubHex,
      scope: draft.scope,
      title: draft.title,
      body: draft.body,
      quorumPct: draft.quorumPct,
      inactivityDays: draft.inactivityDays,
      invitePolicy: draft.invitePolicy,
      parentCommunityHashHex: draft.parentCommunityHashHex,
      timestampMs: draft.timestampMs,
      supportCount: supporterPubs.length,
      supporterPubs,
      requiredSupports: requiredForNext,
      status,
    };
  });

  const activeConfig =
    configVersions.find((v) => v.docIdHex === currentActive.docIdHex) ?? null;

  const content = buildContentViews(
    sortedVerified,
    subjectPicksRaw,
    activeMembersFinalSet
  );
  const pickHistory = buildPickHistory(
    subjectPicksRaw,
    communityPicksRaw,
    content.proposals,
    configVersions
  );

  return {
    communityId,
    activeConfig,
    configVersions,
    members,
    activeMemberCount: activeMembersFinalSet.size,
    categories: content.categories,
    subjects: content.subjects,
    proposals: content.proposals,
    snapshots: content.snapshots,
    pickHistory,
    documents,
    rejectedPacketCount,
  };
}
