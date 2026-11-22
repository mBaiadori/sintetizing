import { bytesToHex } from "@noble/hashes/utils";
import { calculateDocId, ConfigKind, DeliberationMode, DocType, DraftStatus, getDocumentUniverse, InvitePolicy, readActiveMembersTableBlock, readConfigKindBlock, readCosignaturesBlock, readCurrencyBlock, readDeadlineBlock, readDeliberationModeBlock, readDraftIdBlock, readDraftStatusBlock, readFieldLinkBlock, readFieldSubtitleBlock, readFieldTableBlock, readFieldTextBlock, readFieldValueBlock, readInactivityDaysBlock, readInvitePolicyBlock, readLawArticleBlock, readPickTargetBlock, readTimestampBlock, readUtf8Block, Tag, unpackAndVerifyDocument, verifyInviteEndorsement, verifyInviteProof, } from "@sintetizing/wire";
import { buildInspectedDocument } from "./inspector.js";
const DAY_MS = 86_400_000;
export const INVITE_BOOTSTRAP_MAX_MEMBERS = 5;
/**
 * Calcula a janela de rotação (cooldown) para padrinhos de convite.
 * Durante o bootstrap (N <= 5) ou quando a política é FOUNDER_ONLY, retorna 0.
 */
export function computeInviteRotationWindow(activeMemberCount, invitePolicy) {
    if (invitePolicy === InvitePolicy.FOUNDER_ONLY ||
        activeMemberCount <= INVITE_BOOTSTRAP_MAX_MEMBERS) {
        return 0;
    }
    return Math.max(1, Math.min(3, Math.floor((activeMemberCount - 1) / 3)));
}
function getActiveMembersAtJoin(membersMap, activityByPub, leavesByPub, inactivityDays, targetMs) {
    const active = new Set();
    const cutoffMs = inactivityDays * DAY_MS;
    for (const member of membersMap.values()) {
        if (member.joinedAtMs > targetMs) {
            continue;
        }
        const leaves = leavesByPub.get(member.pubHex);
        if (leaves?.some((ts) => ts >= member.joinedAtMs && ts <= targetMs)) {
            continue;
        }
        let lastTs = member.joinedAtMs;
        const acts = activityByPub.get(member.pubHex);
        if (acts) {
            for (const ts of acts) {
                if (ts >= member.joinedAtMs && ts <= targetMs && ts > lastTs) {
                    lastTs = ts;
                }
            }
        }
        if (lastTs <= 0 || targetMs - lastTs <= cutoffMs) {
            active.add(member.pubHex);
        }
    }
    return active;
}
function computeCooldownInviters(acceptedJoins, activeMembersSet, windowSize) {
    if (windowSize <= 0) {
        return [];
    }
    const cooldown = [];
    let counted = 0;
    for (let i = acceptedJoins.length - 1; i >= 0 && counted < windowSize; i -= 1) {
        const entry = acceptedJoins[i];
        if (!activeMembersSet.has(entry.memberPubHex)) {
            continue;
        }
        counted += 1;
        if (!cooldown.includes(entry.inviterHex)) {
            cooldown.push(entry.inviterHex);
        }
    }
    return cooldown;
}
/**
 * Calcula quantos apoios são necessários para atingir o quórum percentual arredondado para cima.
 */
export function computeQuorumRequired(activeCount, quorumPct) {
    if (activeCount <= 0 || quorumPct <= 0) {
        return 0;
    }
    return Math.ceil((activeCount * quorumPct) / 100);
}
function compareChronological(a, b) {
    if (a.timestampMs !== b.timestampMs) {
        return a.timestampMs - b.timestampMs;
    }
    if ((a.seq ?? 0) !== (b.seq ?? 0)) {
        return (a.seq ?? 0) - (b.seq ?? 0);
    }
    return a.docIdHex.localeCompare(b.docIdHex);
}
function isNewerSeqOrTime(candidate, current) {
    if (candidate.seq !== current.seq) {
        return candidate.seq > current.seq;
    }
    if (candidate.timestampMs !== current.timestampMs) {
        return candidate.timestampMs > current.timestampMs;
    }
    return candidate.docIdHex > current.docIdHex;
}
function readQuorumPctUnsafe(blockValue) {
    return blockValue.length === 1 ? blockValue[0] : 51;
}
function parseCmntDraft(env) {
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
    const parsedQuorum = quorumBlock ? readQuorumPctUnsafe(quorumBlock.value) : 51;
    return {
        docIdHex: env.docIdHex,
        parentHashHex: parentBlock ? bytesToHex(parentBlock.value) : null,
        authorPubHex: env.authorPubHex,
        scope: env.scope,
        title: titleBlock ? readUtf8Block(titleBlock) : "Comunidade",
        body: bodyBlock ? readUtf8Block(bodyBlock) : "",
        quorumPct: parsedQuorum >= 1 && parsedQuorum <= 100 ? parsedQuorum : 51,
        inactivityDays: inactivityBlock ? readInactivityDaysBlock(inactivityBlock) : 30,
        invitePolicy: invitePolicyBlock ? readInvitePolicyBlock(invitePolicyBlock) : InvitePolicy.ANY_ACTIVE_MEMBER,
        parentCommunityHashHex: parentCommBlock ? bytesToHex(parentCommBlock.value) : null,
        timestampMs: env.timestampMs,
        seq: env.doc.seq,
    };
}
function isMemberInactive(member, inactivityDays, nowMs) {
    if (member.lastActivityMs <= 0) {
        return false;
    }
    return nowMs - member.lastActivityMs > inactivityDays * DAY_MS;
}
function getLastActivityAt(member, targetMs) {
    if (member.joinedAtMs > targetMs) {
        return null;
    }
    if (member.leftAtMs !== null && member.leftAtMs <= targetMs) {
        return null;
    }
    const list = member.activityTimestamps;
    let lo = 0;
    let hi = list.length - 1;
    let best = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (list[mid] <= targetMs) {
            best = list[mid];
            lo = mid + 1;
        }
        else {
            hi = mid - 1;
        }
    }
    return best >= 0 ? best : member.joinedAtMs;
}
function getActiveMembersSetAt(membersMap, inactivityDays, targetMs) {
    const active = new Set();
    for (const member of membersMap.values()) {
        const lastTs = getLastActivityAt(member, targetMs);
        if (lastTs === null) {
            continue;
        }
        if (lastTs <= 0 || targetMs - lastTs <= inactivityDays * DAY_MS) {
            active.add(member.pubHex);
        }
    }
    return active;
}
function getConfigActiveAt(timeline, targetMs) {
    for (let i = timeline.length - 1; i >= 0; i -= 1) {
        const entry = timeline[i];
        if (entry.activatedAtMs <= targetMs) {
            return entry.draft;
        }
    }
    const first = timeline[0];
    if (first) {
        return first.draft;
    }
    return { quorumPct: 51, inactivityDays: 30 };
}
function latestPickByAuthor(picks) {
    const latest = new Map();
    for (const pick of picks) {
        const prev = latest.get(pick.authorPubHex);
        if (!prev || isNewerSeqOrTime(pick, prev)) {
            latest.set(pick.authorPubHex, pick);
        }
    }
    return latest;
}
function extractProposalFields(doc, rawBody) {
    const fields = [];
    let idx = 0;
    for (const block of doc.blocks) {
        switch (block.tag) {
            case Tag.FIELD_SUBTITLE:
                fields.push({ kind: "SUBTITLE", ...readFieldSubtitleBlock(block) });
                break;
            case Tag.FIELD_TEXT:
                fields.push({ kind: "TEXT", ...readFieldTextBlock(block) });
                break;
            case Tag.FIELD_VALUE:
                fields.push({ kind: "VALUE", ...readFieldValueBlock(block) });
                break;
            case Tag.CURRENCY: {
                const c = readCurrencyBlock(block);
                fields.push({
                    kind: "VALUE",
                    fieldId: `currency-${idx}`,
                    label: c.label,
                    amountCents: c.cents,
                    unit: "BRL",
                });
                break;
            }
            case Tag.FIELD_LINK:
                fields.push({ kind: "LINK", ...readFieldLinkBlock(block) });
                break;
            case Tag.FIELD_TABLE:
                fields.push({ kind: "TABLE", ...readFieldTableBlock(block) });
                break;
            case Tag.LAW_ARTICLE: {
                const a = readLawArticleBlock(block);
                fields.push({
                    kind: "ARTICLE",
                    fieldId: `article-${a.articleNum}-${idx}`,
                    label: `Art. ${a.articleNum}`,
                    articleNum: a.articleNum,
                    text: a.text,
                });
                break;
            }
            default:
                break;
        }
        idx += 1;
    }
    if (fields.length === 0 && rawBody.length > 0) {
        fields.push({
            kind: "TEXT",
            fieldId: "body",
            label: "Descrição",
            text: rawBody,
        });
    }
    return fields;
}
function buildContentViews(sortedVerified, subjectPicksRaw, membersMap, timeline, nowMs) {
    const picksByScope = new Map();
    for (const pick of subjectPicksRaw) {
        const arr = picksByScope.get(pick.scope) ?? [];
        arr.push(pick);
        picksByScope.set(pick.scope, arr);
    }
    const latestPicksCache = new Map();
    const getLatestPicksAt = (scope, evalMs) => {
        const cacheKey = `${scope}@${evalMs}`;
        const cached = latestPicksCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const filtered = (picksByScope.get(scope) ?? []).filter((p) => p.timestampMs <= evalMs);
        const map = latestPickByAuthor(filtered);
        latestPicksCache.set(cacheKey, map);
        return map;
    };
    // 1. Assuntos primeiro (para que propostas herdem o modo e prazo padrão do assunto)
    const rawSubjects = [];
    const subjectByScope = new Map();
    const subjectCountByCategory = new Map();
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
        const modeBlock = env.doc.blocks.find((b) => b.tag === Tag.DELIBERATION_MODE);
        const deadlineBlock = env.doc.blocks.find((b) => b.tag === Tag.DEADLINE);
        const categoryBlock = env.doc.blocks.find((b) => b.tag === Tag.CATEGORY_HASH);
        const categoryHashHex = categoryBlock ? bytesToHex(categoryBlock.value) : null;
        if (categoryHashHex) {
            subjectCountByCategory.set(categoryHashHex, (subjectCountByCategory.get(categoryHashHex) ?? 0) + 1);
        }
        const deliberationMode = modeBlock && readDeliberationModeBlock(modeBlock) === DeliberationMode.OPEN
            ? "OPEN"
            : "QUORUM";
        const deadlineUnixSeconds = deadlineBlock ? readDeadlineBlock(deadlineBlock) : null;
        const deadlineMs = deadlineUnixSeconds !== null ? deadlineUnixSeconds * 1000 : null;
        const isExpired = deadlineMs !== null && nowMs > deadlineMs;
        const evalMs = isExpired ? deadlineMs : nowMs;
        const cmntAtEval = getConfigActiveAt(timeline, evalMs);
        const activeSetAtEval = timeline.length > 0
            ? getActiveMembersSetAt(membersMap, cmntAtEval.inactivityDays, evalMs)
            : new Set();
        const quorumPct = deliberationMode === "OPEN" ? null : cmntAtEval.quorumPct;
        const requiredVotes = quorumPct === null ? 0 : computeQuorumRequired(activeSetAtEval.size, quorumPct);
        const subjectView = {
            scope: env.scope,
            docIdHex: env.docIdHex,
            categoryHashHex,
            title: titleBlock ? readUtf8Block(titleBlock) : "Assunto",
            body: bodyBlock ? readUtf8Block(bodyBlock) : "",
            deliberationMode,
            quorumPct,
            requiredVotes,
            deadlineUnixSeconds,
            isExpired,
            authorPubHex: env.authorPubHex,
            timestampMs: env.timestampMs,
            proposalCount: 0,
        };
        rawSubjects.push(subjectView);
        subjectByScope.set(env.scope, subjectView);
    }
    const proposalsRaw = [];
    const proposalsByScope = new Map();
    for (const env of sortedVerified) {
        if (env.doc.docType !== DocType.PROPOSAL) {
            continue;
        }
        const titleBlock = env.doc.blocks.find((b) => b.tag === Tag.TITLE);
        const bodyBlock = env.doc.blocks.find((b) => b.tag === Tag.BODY);
        const authorNameBlock = env.doc.blocks.find((b) => b.tag === Tag.AUTHOR_NAME);
        const parentBlock = env.doc.blocks.find((b) => b.tag === Tag.PARENT_HASH);
        const deadlineBlock = env.doc.blocks.find((b) => b.tag === Tag.DEADLINE);
        const rawBody = bodyBlock ? readUtf8Block(bodyBlock) : "";
        const fields = extractProposalFields(env.doc, rawBody);
        const firstText = fields.find((f) => f.kind === "TEXT");
        const summaryBody = rawBody || (firstText && firstText.kind === "TEXT" ? firstText.text : "");
        const subject = subjectByScope.get(env.scope) ?? null;
        const deliberationMode = subject?.deliberationMode ?? "QUORUM";
        const propDeadlineSec = deadlineBlock ? readDeadlineBlock(deadlineBlock) : null;
        const deadlineUnixSeconds = propDeadlineSec ?? subject?.deadlineUnixSeconds ?? null;
        const deadlineMs = deadlineUnixSeconds !== null ? deadlineUnixSeconds * 1000 : null;
        const isVotingOpen = deadlineMs === null || nowMs <= deadlineMs;
        const evalMs = isVotingOpen ? nowMs : deadlineMs;
        const cmntAtEval = getConfigActiveAt(timeline, evalMs);
        const activeSetAtEval = timeline.length > 0
            ? getActiveMembersSetAt(membersMap, cmntAtEval.inactivityDays, evalMs)
            : new Set();
        const quorumPct = deliberationMode === "OPEN" ? null : cmntAtEval.quorumPct;
        const requiredVotes = quorumPct === null ? 0 : computeQuorumRequired(activeSetAtEval.size, quorumPct);
        const scopePicks = getLatestPicksAt(env.scope, evalMs);
        const supporterPubs = [];
        for (const [authorHex, pick] of scopePicks.entries()) {
            if (activeSetAtEval.has(authorHex) && pick.targetHex === env.docIdHex) {
                supporterPubs.push(authorHex);
            }
        }
        const item = {
            docIdHex: env.docIdHex,
            scope: env.scope,
            title: titleBlock ? readUtf8Block(titleBlock) : "Proposta",
            body: summaryBody,
            fields,
            authorPubHex: env.authorPubHex,
            authorName: authorNameBlock ? readUtf8Block(authorNameBlock) : null,
            parentHashHex: parentBlock ? bytesToHex(parentBlock.value) : null,
            timestampMs: env.timestampMs,
            deadlineUnixSeconds,
            deliberationMode,
            quorumPct,
            requiredVotes,
            status: "OPEN",
            isVotingOpen,
            supersededByDocIdHex: null,
            pickCount: supporterPubs.length,
            supporterPubs,
        };
        proposalsRaw.push(item);
        const list = proposalsByScope.get(env.scope) ?? [];
        list.push(item);
        proposalsByScope.set(env.scope, list);
    }
    // 3. Fecha status (CONSENSUS / APPROVED / EXPIRED) e detecta substituições sem apoios
    for (const scopeProps of proposalsByScope.values()) {
        const expiredCandidates = scopeProps.filter((p) => !p.isVotingOpen);
        let winningExpiredId = null;
        if (expiredCandidates.length > 0) {
            const qualified = expiredCandidates.filter((p) => p.deliberationMode === "OPEN"
                ? p.pickCount > 0
                : p.requiredVotes > 0 && p.pickCount >= p.requiredVotes);
            if (qualified.length > 0) {
                qualified.sort((a, b) => b.pickCount - a.pickCount ||
                    a.timestampMs - b.timestampMs ||
                    a.docIdHex.localeCompare(b.docIdHex));
                winningExpiredId = qualified[0].docIdHex;
            }
        }
        for (const prop of scopeProps) {
            if (prop.isVotingOpen) {
                prop.status =
                    prop.deliberationMode === "QUORUM" &&
                        prop.requiredVotes > 0 &&
                        prop.pickCount >= prop.requiredVotes
                        ? "CONSENSUS"
                        : "OPEN";
            }
            else {
                prop.status = prop.docIdHex === winningExpiredId ? "APPROVED" : "EXPIRED";
            }
            if (prop.pickCount === 0) {
                const newerAuthorForks = scopeProps
                    .filter((other) => other.parentHashHex === prop.docIdHex &&
                    other.authorPubHex === prop.authorPubHex)
                    .sort((a, b) => b.timestampMs - a.timestampMs || b.docIdHex.localeCompare(a.docIdHex));
                if (newerAuthorForks.length > 0) {
                    prop.supersededByDocIdHex = newerAuthorForks[0].docIdHex;
                }
            }
        }
    }
    const subjects = rawSubjects.map((s) => ({
        ...s,
        proposalCount: proposalsByScope.get(s.scope)?.length ?? 0,
    }));
    const categories = [];
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
    const snapshots = [];
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
        proposals: proposalsRaw.reverse(),
        snapshots: snapshots.reverse(),
    };
}
function buildPickHistory(subjectPicksRaw, communityPicksRaw, proposals, configVersions) {
    const proposalTitles = new Map();
    for (const prop of proposals) {
        proposalTitles.set(prop.docIdHex, prop.title);
    }
    const configTitles = new Map();
    for (const cfg of configVersions) {
        configTitles.set(cfg.docIdHex, `${cfg.title} (v${cfg.versionIndex})`);
    }
    const entries = [
        ...subjectPicksRaw.map((p) => ({
            docIdHex: p.docIdHex,
            kind: "PROPOSAL",
            scope: p.scope,
            authorPubHex: p.authorPubHex,
            targetHashHex: p.targetHex,
            targetTitle: proposalTitles.get(p.targetHex) ?? null,
            seq: p.seq,
            timestampMs: p.timestampMs,
        })),
        ...communityPicksRaw.map((p) => ({
            docIdHex: p.docIdHex,
            kind: "COMMUNITY",
            scope: p.scope,
            authorPubHex: p.authorPubHex,
            targetHashHex: p.targetHex,
            targetTitle: configTitles.get(p.targetHex) ?? null,
            seq: p.seq,
            timestampMs: p.timestampMs,
        })),
    ];
    return entries.sort((a, b) => b.timestampMs - a.timestampMs ||
        b.seq - a.seq ||
        b.docIdHex.localeCompare(a.docIdHex));
}
/**
 * Projeta de forma pura e determinística o estado completo de uma comunidade
 * a partir de todos os pacotes TLV binários verificados (.cmnt, .memb, .stze, .snap).
 */
export async function projectCommunityState(packets, communityId, nowMs) {
    const seenIds = new Set();
    const verified = [];
    let rejectedPacketCount = 0;
    for (const rawBytes of packets) {
        const docIdHex = bytesToHex(calculateDocId(rawBytes));
        if (seenIds.has(docIdHex)) {
            continue;
        }
        seenIds.add(docIdHex);
        try {
            const doc = await unpackAndVerifyDocument(rawBytes);
            if (getDocumentUniverse(doc) === "chat") {
                continue;
            }
            const inspected = buildInspectedDocument(docIdHex, rawBytes.length, doc);
            if (!inspected.scope ||
                (inspected.scope !== communityId && !inspected.scope.startsWith(`${communityId}/`))) {
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
        }
        catch {
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
        .filter((d) => d !== null)
        .sort(compareChronological);
    const sortedVerified = [...verified].sort(compareChronological);
    const genesis = cmntDrafts.find((d) => d.parentHashHex === null);
    if (!genesis) {
        const contentWithoutGenesis = buildContentViews(sortedVerified, [], new Map(), [], nowMs);
        return {
            communityId,
            activeConfig: null,
            configVersions: [],
            members: [],
            activeMemberCount: 0,
            inviteRules: {
                bootstrapMaxMembers: INVITE_BOOTSTRAP_MAX_MEMBERS,
                requiresEndorsement: false,
                rotationWindowSize: 0,
                cooldownInviterPubs: [],
            },
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
    const membersMap = new Map();
    membersMap.set(genesis.authorPubHex, {
        pubHex: genesis.authorPubHex,
        displayName: null,
        displayNameTs: -1,
        isFounder: true,
        invitedByPubHex: null,
        endorsedByPubHex: null,
        joinedAtMs: genesis.timestampMs,
        lastActivityMs: genesis.timestampMs,
        activityTimestamps: [genesis.timestampMs],
        joinSeq: genesis.seq,
        joinDocIdHex: genesis.docIdHex,
        leftAtMs: null,
        leftSeq: null,
        pickCount: 0,
    });
    // Pré-indexa atividades e saídas para avaliar com precisão quem está ativo durante a validação de MEMB_JOIN
    const activityByPub = new Map();
    const leavesByPub = new Map();
    for (const env of sortedVerified) {
        if (env.doc.docType === DocType.MEMB_LEAVE && env.scope === communityId) {
            const leaves = leavesByPub.get(env.authorPubHex) ?? [];
            leaves.push(env.timestampMs);
            leavesByPub.set(env.authorPubHex, leaves);
        }
        else if (env.doc.docType !== DocType.MEMB_JOIN && env.timestampMs > 0) {
            const acts = activityByPub.get(env.authorPubHex) ?? [];
            acts.push(env.timestampMs);
            activityByPub.set(env.authorPubHex, acts);
        }
    }
    // Processa entradas MEMB_JOIN por convite assinado em ordem cronológica
    const joinPackets = verified
        .filter((v) => v.doc.docType === DocType.MEMB_JOIN && v.scope === communityId)
        .sort(compareChronological);
    const acceptedJoins = [];
    const usedInviteKeys = new Set();
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
        if (inviterHex === joinEnv.authorPubHex) {
            continue;
        }
        const inviteKey = `${inviterHex}:${proof.nonce}`;
        if (usedInviteKeys.has(inviteKey)) {
            continue;
        }
        const inviter = membersMap.get(inviterHex);
        if (!inviter) {
            continue;
        }
        if (genesis.invitePolicy === InvitePolicy.FOUNDER_ONLY && inviterHex !== genesis.authorPubHex) {
            continue;
        }
        const activeAtJoin = getActiveMembersAtJoin(membersMap, activityByPub, leavesByPub, genesis.inactivityDays, joinTs);
        if (!activeAtJoin.has(inviterHex)) {
            continue;
        }
        const requiresEndorsement = genesis.invitePolicy !== InvitePolicy.FOUNDER_ONLY &&
            activeAtJoin.size > INVITE_BOOTSTRAP_MAX_MEMBERS;
        if (requiresEndorsement) {
            const windowSize = computeInviteRotationWindow(activeAtJoin.size, genesis.invitePolicy);
            const cooldownInviters = computeCooldownInviters(acceptedJoins, activeAtJoin, windowSize);
            if (cooldownInviters.includes(inviterHex)) {
                continue;
            }
        }
        let endorsedByPubHex = null;
        const endorsementBlock = joinEnv.doc.blocks.find((b) => b.tag === Tag.INVITE_ENDORSEMENT);
        if (endorsementBlock) {
            const verifiedEndorsement = await verifyInviteEndorsement(communityId, inviteBlock.value, endorsementBlock.value);
            if (verifiedEndorsement) {
                const endorserHex = bytesToHex(verifiedEndorsement.endorserPub);
                if (endorserHex !== inviterHex &&
                    endorserHex !== joinEnv.authorPubHex &&
                    activeAtJoin.has(endorserHex)) {
                    endorsedByPubHex = endorserHex;
                }
            }
        }
        if (requiresEndorsement && !endorsedByPubHex) {
            continue;
        }
        const existing = membersMap.get(joinEnv.authorPubHex);
        const hasLeftBeforeJoin = existing !== undefined &&
            (leavesByPub
                .get(joinEnv.authorPubHex)
                ?.some((ts) => ts >= existing.joinedAtMs && ts <= joinTs) ??
                false);
        if (!existing) {
            membersMap.set(joinEnv.authorPubHex, {
                pubHex: joinEnv.authorPubHex,
                displayName: null,
                displayNameTs: -1,
                isFounder: false,
                invitedByPubHex: inviterHex,
                endorsedByPubHex,
                joinedAtMs: joinTs,
                lastActivityMs: joinTs,
                activityTimestamps: [joinTs],
                joinSeq: joinEnv.doc.seq,
                joinDocIdHex: joinEnv.docIdHex,
                leftAtMs: null,
                leftSeq: null,
                pickCount: 0,
            });
            usedInviteKeys.add(inviteKey);
            acceptedJoins.push({ inviterHex, memberPubHex: joinEnv.authorPubHex });
        }
        else if (hasLeftBeforeJoin) {
            existing.leftAtMs = null;
            existing.leftSeq = null;
            existing.invitedByPubHex = inviterHex;
            existing.endorsedByPubHex = endorsedByPubHex;
            existing.joinedAtMs = joinTs;
            existing.lastActivityMs = Math.max(existing.lastActivityMs, joinTs);
            existing.activityTimestamps.push(joinTs);
            existing.joinSeq = joinEnv.doc.seq;
            existing.joinDocIdHex = joinEnv.docIdHex;
            usedInviteKeys.add(inviteKey);
            const prevJoinIdx = acceptedJoins.findIndex((j) => j.memberPubHex === joinEnv.authorPubHex);
            if (prevJoinIdx >= 0) {
                acceptedJoins.splice(prevJoinIdx, 1);
            }
            acceptedJoins.push({ inviterHex, memberPubHex: joinEnv.authorPubHex });
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
        }
        else if (member.leftAtMs === null || env.timestampMs <= member.leftAtMs) {
            if (env.timestampMs > member.lastActivityMs) {
                member.lastActivityMs = env.timestampMs;
            }
            if (env.timestampMs > 0) {
                member.activityTimestamps.push(env.timestampMs);
            }
            if (env.doc.docType === DocType.PICK || env.doc.docType === DocType.COMMUNITY_PICK) {
                member.pickCount += 1;
            }
        }
    }
    for (const member of membersMap.values()) {
        member.activityTimestamps.sort((a, b) => a - b);
    }
    // Coleta últimos COMMUNITY_PICK e PICK
    const communityPicksRaw = [];
    const subjectPicksRaw = [];
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
        const rec = {
            docIdHex: env.docIdHex,
            scope: env.scope,
            authorPubHex: env.authorPubHex,
            seq: env.doc.seq,
            timestampMs: env.timestampMs,
            targetHex: bytesToHex(target.targetHash),
        };
        if (env.doc.docType === DocType.COMMUNITY_PICK && env.scope === communityId) {
            communityPicksRaw.push(rec);
        }
        else if (env.doc.docType === DocType.PICK) {
            subjectPicksRaw.push(rec);
        }
    }
    const sortedCommunityPicks = [...communityPicksRaw].sort(compareChronological);
    const latestCommunityPickMap = latestPickByAuthor(sortedCommunityPicks);
    // Resolução iterativa da cadeia .cmnt (v1 -> v2 -> v3...) com linha do tempo histórica (activatedAtMs)
    let currentActive = genesis;
    let currentActivatedAtMs = genesis.timestampMs;
    const timeline = [{ draft: genesis, activatedAtMs: genesis.timestampMs }];
    const activatedAtMap = new Map([[genesis.docIdHex, genesis.timestampMs]]);
    const versionIndexMap = new Map([[genesis.docIdHex, 1]]);
    const statusMap = new Map([[genesis.docIdHex, "ACTIVE"]]);
    const childrenMap = new Map();
    for (const draft of cmntDrafts) {
        if (draft.parentHashHex) {
            const list = childrenMap.get(draft.parentHashHex) ?? [];
            list.push(draft);
            childrenMap.set(draft.parentHashHex, list);
        }
    }
    let nextVersionNum = 2;
    const visitedConfigs = new Set([genesis.docIdHex]);
    while (true) {
        const children = (childrenMap.get(currentActive.docIdHex) ?? []).filter((c) => !visitedConfigs.has(c.docIdHex));
        if (children.length === 0) {
            break;
        }
        let winner = null;
        let winnerActivatedAtMs = 0;
        // Replay cronológico para determinar em qual timestamp exato a nova .cmnt atingiu quórum
        const runningPicks = new Map();
        for (const pick of sortedCommunityPicks) {
            const prev = runningPicks.get(pick.authorPubHex);
            if (!prev || isNewerSeqOrTime(pick, prev)) {
                runningPicks.set(pick.authorPubHex, pick);
            }
            if (pick.timestampMs < currentActivatedAtMs) {
                continue;
            }
            const activeAtPick = getActiveMembersSetAt(membersMap, currentActive.inactivityDays, pick.timestampMs);
            const requiredAtPick = computeQuorumRequired(activeAtPick.size, currentActive.quorumPct);
            if (activeAtPick.size === 0 || requiredAtPick <= 0) {
                continue;
            }
            let bestChild = null;
            let bestCount = -1;
            for (const child of children) {
                if (child.timestampMs > pick.timestampMs) {
                    continue;
                }
                let count = 0;
                for (const authorHex of activeAtPick) {
                    if (runningPicks.get(authorHex)?.targetHex === child.docIdHex) {
                        count += 1;
                    }
                }
                if (count >= requiredAtPick) {
                    if (bestChild === null ||
                        count > bestCount ||
                        (count === bestCount && compareChronological(child, bestChild) < 0)) {
                        bestChild = child;
                        bestCount = count;
                    }
                }
            }
            if (bestChild) {
                winner = bestChild;
                winnerActivatedAtMs = pick.timestampMs;
                break;
            }
        }
        // Fallback no instante nowMs caso inatividade recente de membros tenha reduzido o denominador
        if (!winner) {
            const activeAtNow = getActiveMembersSetAt(membersMap, currentActive.inactivityDays, nowMs);
            const requiredAtNow = computeQuorumRequired(activeAtNow.size, currentActive.quorumPct);
            if (activeAtNow.size > 0 && requiredAtNow > 0) {
                let bestCount = -1;
                for (const child of children) {
                    let count = 0;
                    for (const authorHex of activeAtNow) {
                        if (latestCommunityPickMap.get(authorHex)?.targetHex === child.docIdHex) {
                            count += 1;
                        }
                    }
                    if (count >= requiredAtNow) {
                        if (winner === null ||
                            count > bestCount ||
                            (count === bestCount && compareChronological(child, winner) < 0)) {
                            winner = child;
                            bestCount = count;
                            winnerActivatedAtMs = Math.max(currentActivatedAtMs, child.timestampMs, nowMs);
                        }
                    }
                }
            }
        }
        if (!winner) {
            break;
        }
        statusMap.set(currentActive.docIdHex, "SUPERSEDED");
        statusMap.set(winner.docIdHex, "ACTIVE");
        versionIndexMap.set(winner.docIdHex, nextVersionNum++);
        activatedAtMap.set(winner.docIdHex, winnerActivatedAtMs);
        visitedConfigs.add(winner.docIdHex);
        timeline.push({ draft: winner, activatedAtMs: winnerActivatedAtMs });
        currentActive = winner;
        currentActivatedAtMs = winnerActivatedAtMs;
    }
    // Constrói lista final de membros usando o inactivityDays da versão ativa final
    const activeMembersFinalSet = new Set();
    const members = Array.from(membersMap.values())
        .map((m) => {
        let status;
        if (m.leftAtMs !== null) {
            status = "LEFT";
        }
        else if (isMemberInactive(m, currentActive.inactivityDays, nowMs)) {
            status = "INACTIVE";
        }
        else {
            status = "ACTIVE";
            activeMembersFinalSet.add(m.pubHex);
        }
        return {
            pubHex: m.pubHex,
            displayName: m.displayName,
            isFounder: m.isFounder,
            invitedByPubHex: m.invitedByPubHex,
            endorsedByPubHex: m.endorsedByPubHex,
            joinedAtMs: m.joinedAtMs,
            lastActivityMs: m.lastActivityMs,
            status,
            pickCount: m.pickCount,
            joinDocIdHex: m.joinDocIdHex,
        };
    })
        .sort((a, b) => a.joinedAtMs - b.joinedAtMs || a.pubHex.localeCompare(b.pubHex));
    const rotationWindowSize = computeInviteRotationWindow(activeMembersFinalSet.size, currentActive.invitePolicy);
    const inviteRules = {
        bootstrapMaxMembers: INVITE_BOOTSTRAP_MAX_MEMBERS,
        requiresEndorsement: currentActive.invitePolicy !== InvitePolicy.FOUNDER_ONLY &&
            activeMembersFinalSet.size > INVITE_BOOTSTRAP_MAX_MEMBERS,
        rotationWindowSize,
        cooldownInviterPubs: computeCooldownInviters(acceptedJoins, activeMembersFinalSet, rotationWindowSize),
    };
    const requiredForNext = computeQuorumRequired(activeMembersFinalSet.size, currentActive.quorumPct);
    // Consolida versões .cmnt para exibição
    const configVersions = cmntDrafts.map((draft, idx) => {
        const supporterPubs = [];
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
            activatedAtMs: activatedAtMap.get(draft.docIdHex) ?? null,
            supportCount: supporterPubs.length,
            supporterPubs,
            requiredSupports: requiredForNext,
            status,
        };
    });
    const activeConfig = configVersions.find((v) => v.docIdHex === currentActive.docIdHex) ?? null;
    const content = buildContentViews(sortedVerified, subjectPicksRaw, membersMap, timeline, nowMs);
    const pickHistory = buildPickHistory(subjectPicksRaw, communityPicksRaw, content.proposals, configVersions);
    return {
        communityId,
        activeConfig,
        configVersions,
        members,
        activeMemberCount: activeMembersFinalSet.size,
        inviteRules,
        categories: content.categories,
        subjects: content.subjects,
        proposals: content.proposals,
        snapshots: content.snapshots,
        pickHistory,
        documents,
        rejectedPacketCount,
    };
}
/**
 * Projeta de forma pura e determinística a Oficina de um Assunto (.chat):
 * histórico cronológico de mensagens + rascunhos ativos (1 revisão mais recente por autor/draftId)
 * com sinalização automática caso algum rascunho já tenha sido convertido em Proposta Oficial (.stze).
 */
export async function projectSubjectWorkshop(params) {
    const { subjectScope, rawChatPackets, projection } = params;
    const memberStatusMap = new Map();
    const memberNameMap = new Map();
    if (projection) {
        for (const member of projection.members) {
            memberStatusMap.set(member.pubHex, member.status);
            if (member.displayName) {
                memberNameMap.set(member.pubHex, member.displayName);
            }
        }
    }
    const proposalTitleMap = new Map();
    if (projection) {
        for (const prop of projection.proposals) {
            proposalTitleMap.set(prop.docIdHex, prop.title);
        }
    }
    const messagesByDocId = new Map();
    const latestDraftByKey = new Map();
    for (const rawBytes of rawChatPackets) {
        let doc;
        try {
            doc = await unpackAndVerifyDocument(rawBytes);
        }
        catch {
            continue;
        }
        if (getDocumentUniverse(doc) !== "chat") {
            continue;
        }
        const scopeBlock = doc.blocks.find((b) => b.tag === Tag.SCOPE);
        const scope = scopeBlock ? readUtf8Block(scopeBlock) : null;
        if (scope !== subjectScope) {
            continue;
        }
        const authorPubHex = bytesToHex(doc.authorPub);
        if (memberStatusMap.size > 0) {
            const status = memberStatusMap.get(authorPubHex);
            if (!status || status === "LEFT") {
                continue;
            }
        }
        const docIdHex = bytesToHex(calculateDocId(rawBytes));
        const tsBlock = doc.blocks.find((b) => b.tag === Tag.TIMESTAMP);
        const timestampMs = tsBlock ? readTimestampBlock(tsBlock) : 0;
        const authorNameBlock = doc.blocks.find((b) => b.tag === Tag.AUTHOR_NAME);
        const resolvedAuthorName = (authorNameBlock ? readUtf8Block(authorNameBlock) : null) ??
            memberNameMap.get(authorPubHex) ??
            null;
        if (doc.docType === DocType.CHAT_MESSAGE) {
            if (messagesByDocId.has(docIdHex)) {
                continue;
            }
            const bodyBlock = doc.blocks.find((b) => b.tag === Tag.BODY);
            if (!bodyBlock) {
                continue;
            }
            const draftIdBlock = doc.blocks.find((b) => b.tag === Tag.DRAFT_ID);
            const targetBlock = doc.blocks.find((b) => b.tag === Tag.PICK_TARGET);
            const targetHash = targetBlock ? readPickTargetBlock(targetBlock).targetHash : undefined;
            messagesByDocId.set(docIdHex, {
                docIdHex,
                scope,
                authorPubHex,
                authorName: resolvedAuthorName,
                body: readUtf8Block(bodyBlock),
                timestampMs,
                seq: doc.seq,
                referencedDraftId: draftIdBlock ? readDraftIdBlock(draftIdBlock) : null,
                referencedProposalDocIdHex: targetHash ? bytesToHex(targetHash) : null,
            });
            continue;
        }
        if (doc.docType === DocType.CHAT_DRAFT) {
            const draftIdBlock = doc.blocks.find((b) => b.tag === Tag.DRAFT_ID);
            const statusBlock = doc.blocks.find((b) => b.tag === Tag.DRAFT_STATUS);
            if (!draftIdBlock || !statusBlock) {
                continue;
            }
            const draftId = readDraftIdBlock(draftIdBlock);
            const status = readDraftStatusBlock(statusBlock);
            const titleBlock = doc.blocks.find((b) => b.tag === Tag.TITLE);
            const bodyBlock = doc.blocks.find((b) => b.tag === Tag.BODY);
            const parentBlock = doc.blocks.find((b) => b.tag === Tag.PARENT_HASH);
            const deadlineBlock = doc.blocks.find((b) => b.tag === Tag.DEADLINE);
            const rawBody = bodyBlock ? readUtf8Block(bodyBlock) : "";
            const fields = extractProposalFields(doc, rawBody);
            const firstText = fields.find((f) => f.kind === "TEXT");
            const summaryBody = rawBody || (firstText && firstText.kind === "TEXT" ? firstText.text : "");
            const candidate = {
                docIdHex,
                draftId,
                scope,
                authorPubHex,
                authorName: resolvedAuthorName,
                status,
                title: titleBlock ? readUtf8Block(titleBlock) : "",
                body: summaryBody,
                fields,
                parentHashHex: parentBlock ? bytesToHex(parentBlock.value) : null,
                deadlineUnixSeconds: deadlineBlock ? readDeadlineBlock(deadlineBlock) : null,
                timestampMs,
                seq: doc.seq,
            };
            const key = `${authorPubHex}:${draftId}`;
            const existing = latestDraftByKey.get(key);
            if (!existing || isNewerSeqOrTime(candidate, existing)) {
                latestDraftByKey.set(key, candidate);
            }
        }
    }
    const messages = Array.from(messagesByDocId.values()).sort(compareChronological);
    const conversionByDraftId = new Map();
    for (const msg of messages) {
        if (msg.referencedDraftId && msg.referencedProposalDocIdHex) {
            conversionByDraftId.set(msg.referencedDraftId, msg);
        }
    }
    const activeDrafts = [];
    for (const draft of latestDraftByKey.values()) {
        if (draft.status !== DraftStatus.ACTIVE) {
            continue;
        }
        const conversion = conversionByDraftId.get(draft.draftId) ?? null;
        const convertedProposalId = conversion?.referencedProposalDocIdHex ?? null;
        activeDrafts.push({
            docIdHex: draft.docIdHex,
            draftId: draft.draftId,
            scope: draft.scope,
            authorPubHex: draft.authorPubHex,
            authorName: draft.authorName,
            title: draft.title,
            body: draft.body,
            fields: draft.fields,
            parentHashHex: draft.parentHashHex,
            deadlineUnixSeconds: draft.deadlineUnixSeconds,
            timestampMs: draft.timestampMs,
            seq: draft.seq,
            convertedToProposalDocIdHex: convertedProposalId,
            convertedToProposalTitle: convertedProposalId
                ? (proposalTitleMap.get(convertedProposalId) ?? null)
                : null,
            convertedByPubHex: conversion?.authorPubHex ?? null,
            convertedByName: conversion?.authorName ?? null,
        });
    }
    activeDrafts.sort((a, b) => b.timestampMs - a.timestampMs ||
        b.seq - a.seq ||
        a.docIdHex.localeCompare(b.docIdHex));
    return {
        subjectScope,
        messages,
        activeDrafts,
    };
}
//# sourceMappingURL=community-engine.js.map