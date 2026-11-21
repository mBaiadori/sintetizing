import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  CommunityProjection,
  projectCommunityState,
  projectSubjectWorkshop,
  ProposalFieldView,
  SharedDraftView,
  SubjectWorkshopView,
} from "@sintetizing/domain";
import {
  decodeInviteCode,
  DEFAULT_PUBLIC_NOSTR_RELAYS,
  encodeInviteCode,
  getDefaultLocalRelayUrl,
  normalizeRelayList,
  NostrTransport,
} from "@sintetizing/network";
import {
  CommunityRecord,
  DraftFieldInput,
  HiddenDocRecord,
  LocalIdentity,
  ProposalDraftRecord,
  SintetizeLocalStore,
  StoredChatFileRecord,
  StoredPacketRecord,
} from "@sintetizing/storage";
import {
  calculateDocId,
  ConfigKind,
  createActiveCmntHashBlock,
  createActiveMembersTableBlock,
  createAuthorNameBlock,
  createBodyBlock,
  createCategoryHashBlock,
  createConfigKindBlock,
  createCutoffHashBlock,
  createDeadlineBlock,
  createDeliberationModeBlock,
  createDraftIdBlock,
  createDraftStatusBlock,
  createFieldLinkBlock,
  createFieldSubtitleBlock,
  createFieldTableBlock,
  createFieldTextBlock,
  createFieldValueBlock,
  createInactivityDaysBlock,
  createInviteEndorsementBlock,
  createInvitePolicyBlock,
  createInviteProofBlock,
  createLawArticleBlock,
  createParentHashBlock,
  createPickTargetBlock,
  createQuorumPctBlock,
  createScopeBlock,
  createSignedInvite,
  createTimestampBlock,
  createTitleBlock,
  decodeChatFile,
  DeliberationMode,
  DocType,
  DraftStatus,
  endorseSignedInvite,
  InvitePolicy,
  InvitePolicyValue,
  packDocument,
  TLVBlock,
  unpackAndVerifyDocument,
  verifyInviteProof,
} from "@sintetizing/wire";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GENERAL_CATEGORY_ID } from "../utils/format.js";
import { buildRouteHref } from "../utils/router.js";
import { generateSeedDataset, SeedScale } from "../utils/seed-generator.js";

export interface CreateCommunityInput {
  readonly title: string;
  readonly body: string;
  readonly quorumPct: number;
  readonly inactivityDays: number;
  readonly invitePolicy: InvitePolicyValue;
  readonly relays: readonly string[];
}

export interface ProposeConfigVersionInput {
  readonly title: string;
  readonly body: string;
  readonly quorumPct: number;
  readonly inactivityDays: number;
  readonly invitePolicy: InvitePolicyValue;
}

export interface CreateCategoryInput {
  readonly title: string;
  readonly body: string;
}

export interface CreateSubjectInput {
  readonly title: string;
  readonly body: string;
  readonly deliberationMode: "QUORUM" | "OPEN";
  readonly deadlineUnixSeconds?: number | undefined;
  readonly categoryHashHex?: string | undefined;
}

export interface CreateProposalInput {
  readonly subjectScope: string;
  readonly title: string;
  readonly body: string;
  readonly parentHashHex?: string | undefined;
  readonly deadlineUnixSeconds?: number | undefined;
  readonly fields?: readonly ProposalFieldView[] | undefined;
}

export interface SaveDraftInput {
  readonly draftId: string;
  readonly subjectScope: string;
  readonly parentHashHex: string | null;
  readonly title: string;
  readonly body: string;
  readonly deadlineUnixSeconds: number | null;
  readonly fields: readonly DraftFieldInput[];
}

export interface SendChatMessageInput {
  readonly subjectScope: string;
  readonly body: string;
  readonly referencedDraftId?: string | undefined;
  readonly referencedProposalDocIdHex?: string | undefined;
}

export interface PublishSharedDraftInput {
  readonly subjectScope: string;
  readonly draftId: string;
  readonly title: string;
  readonly body: string;
  readonly parentHashHex?: string | null | undefined;
  readonly deadlineUnixSeconds?: number | null | undefined;
  readonly fields: readonly ProposalFieldView[];
}

function buildStructuredFieldBlocks(
  fields: readonly ProposalFieldView[] | undefined
): TLVBlock[] {
  const structuredBlocks: TLVBlock[] = [];
  for (const field of fields ?? []) {
    switch (field.kind) {
      case "SUBTITLE":
        structuredBlocks.push(
          createFieldSubtitleBlock({ fieldId: field.fieldId, label: field.label })
        );
        break;
      case "TEXT":
        structuredBlocks.push(
          createFieldTextBlock({
            fieldId: field.fieldId,
            label: field.label,
            text: field.text,
          })
        );
        break;
      case "VALUE":
        structuredBlocks.push(
          createFieldValueBlock({
            fieldId: field.fieldId,
            label: field.label,
            amountCents: field.amountCents,
            unit: field.unit,
          })
        );
        break;
      case "LINK":
        structuredBlocks.push(
          createFieldLinkBlock({
            fieldId: field.fieldId,
            label: field.label,
            url: field.url,
          })
        );
        break;
      case "TABLE":
        structuredBlocks.push(
          createFieldTableBlock({
            fieldId: field.fieldId,
            label: field.label,
            columns: field.columns,
            rows: field.rows,
          })
        );
        break;
      case "ARTICLE":
        structuredBlocks.push(createLawArticleBlock(field.articleNum, field.text));
        break;
    }
  }
  return structuredBlocks;
}

function buildSummaryBody(
  body: string,
  fields: readonly ProposalFieldView[] | undefined
): string {
  const trimmed = body.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  const firstTextField = (fields ?? []).find((f) => f.kind === "TEXT");
  return firstTextField && firstTextField.kind === "TEXT"
    ? firstTextField.text.slice(0, 280).trim()
    : "";
}

export function buildProposalShareUrl(params: {
  readonly communityId: string;
  readonly categoryId: string | null;
  readonly subjectScope: string;
  readonly proposalId: string;
}): string {
  if (typeof window === "undefined") {
    return "";
  }
  const path = buildRouteHref({
    kind: "workspace",
    communityId: params.communityId,
    categoryId: params.categoryId ?? GENERAL_CATEGORY_ID,
    subjectScope: params.subjectScope,
    proposalId: params.proposalId,
    newSubject: false,
  });
  return `${window.location.origin}${path}`;
}

export function getInitialDefaultRelays(): string[] {
  const local =
    typeof window !== "undefined" ? getDefaultLocalRelayUrl(window.location.hostname) : null;
  if (local) {
    return [local];
  }
  return [...DEFAULT_PUBLIC_NOSTR_RELAYS];
}

function slugifyCommunityId(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  const rand = crypto.getRandomValues(new Uint8Array(3));
  const suffix = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${base || "comunidade"}-${suffix}`;
}

function slugifyCategory(communityId: string, title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const rand = crypto.getRandomValues(new Uint8Array(2));
  const suffix = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${communityId}/cat-${base || "geral"}-${suffix}`;
}

function slugifySubject(communityId: string, title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const rand = crypto.getRandomValues(new Uint8Array(2));
  const suffix = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${communityId}/${base || "assunto"}-${suffix}`;
}

export function useExplorer() {
  const storeRef = useRef<SintetizeLocalStore | null>(null);
  const transportRef = useRef<NostrTransport | null>(null);

  if (!storeRef.current) {
    storeRef.current = new SintetizeLocalStore();
  }
  if (!transportRef.current) {
    transportRef.current = new NostrTransport();
  }

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [communities, setCommunities] = useState<CommunityRecord[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [projection, setProjection] = useState<CommunityProjection | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "live">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [resyncNonce, setResyncNonce] = useState(0);
  const [seedProgress, setSeedProgress] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ProposalDraftRecord[]>([]);
  const [hiddenDocs, setHiddenDocs] = useState<HiddenDocRecord[]>([]);
  const [chatFiles, setChatFiles] = useState<StoredChatFileRecord[]>([]);
  const [workshopsByScope, setWorkshopsByScope] = useState<
    Readonly<Record<string, SubjectWorkshopView>>
  >({});

  const projectionRef = useRef<CommunityProjection | null>(null);
  projectionRef.current = projection;

  const hiddenDocIds = useMemo(
    () => new Set(hiddenDocs.map((h) => h.docIdHex)),
    [hiddenDocs]
  );

  const selectedCommunity =
    communities.find((c) => c.communityId === selectedCommunityId) ?? null;

  const refreshLocalPrefs = useCallback(async (communityId: string) => {
    const store = storeRef.current!;
    const [loadedDrafts, loadedHidden] = await Promise.all([
      store.listDraftsByCommunity(communityId),
      store.listHiddenByCommunity(communityId),
    ]);
    setDrafts(loadedDrafts);
    setHiddenDocs(loadedHidden);
  }, []);

  const refreshWorkshops = useCallback(
    async (communityId: string, activeProjection: CommunityProjection | null) => {
      const store = storeRef.current!;
      const files = await store.listChatFilesByCommunity(communityId);
      setChatFiles(files);
      const nextMap: Record<string, SubjectWorkshopView> = {};
      for (const file of files) {
        const packets = decodeChatFile(file.rawChatBytes);
        nextMap[file.subjectScope] = await projectSubjectWorkshop({
          subjectScope: file.subjectScope,
          rawChatPackets: packets,
          projection: activeProjection,
        });
      }
      setWorkshopsByScope(nextMap);
    },
    []
  );

  const refreshProjection = useCallback(async (communityId: string): Promise<CommunityProjection> => {
    const store = storeRef.current!;
    const records = await store.listPacketsByCommunity(communityId);
    const next = await projectCommunityState(
      records.map((r) => r.rawBytes),
      communityId,
      Date.now()
    );
    setProjection(next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    const store = storeRef.current!;
    const transport = transportRef.current!;

    void (async () => {
      try {
        const [loadedId, loadedComms] = await Promise.all([
          store.getIdentity(),
          store.listCommunities(),
        ]);
        if (!active) {
          return;
        }
        setIdentity(loadedId);
        setCommunities(loadedComms);
        if (loadedComms.length > 0) {
          setSelectedCommunityId((prev) => prev ?? loadedComms[0]!.communityId);
        }
      } catch (err: unknown) {
        if (active) {
          setErrorMessage(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      transport.destroy();
      if (transportRef.current === transport) {
        transportRef.current = null;
      }
      store.close();
    };
  }, []);

  // Sincronização ativa via Nostr quando uma comunidade está selecionada
  useEffect(() => {
    if (!selectedCommunity || !identity) {
      setProjection(null);
      setDrafts([]);
      setHiddenDocs([]);
      setChatFiles([]);
      setWorkshopsByScope({});
      setSyncState("idle");
      return;
    }

    let cancelled = false;
    const store = storeRef.current!;
    const transport = transportRef.current!;
    let sub: { close: (reason?: string) => void } | null = null;
    let backfillTimer: ReturnType<typeof setTimeout> | null = null;

    setGeneratedInviteCode(null);
    setSyncState("syncing");
    void refreshLocalPrefs(selectedCommunity.communityId);

    void (async () => {
      try {
        const stored = await store.listPacketsByCommunity(selectedCommunity.communityId);
        if (cancelled) {
          return;
        }
        const initialProj = await projectCommunityState(
          stored.map((r) => r.rawBytes),
          selectedCommunity.communityId,
          Date.now()
        );
        if (!cancelled) {
          setProjection(initialProj);
          await refreshWorkshops(selectedCommunity.communityId, initialProj);
        }

        const relays = normalizeRelayList(selectedCommunity.relays);
        if (relays.length === 0) {
          if (!cancelled) {
            setSyncState("idle");
          }
          return;
        }

        const knownIds = new Set(stored.map((r) => r.docIdHex));
        const storedChatFiles = await store.listChatFilesByCommunity(selectedCommunity.communityId);
        const storedChatPackets: Uint8Array[] = [];
        for (const cf of storedChatFiles) {
          for (const pkt of decodeChatFile(cf.rawChatBytes)) {
            storedChatPackets.push(pkt);
            knownIds.add(bytesToHex(calculateDocId(pkt)));
          }
        }
        const remoteDocIds = new Set<string>();
        sub = transport.subscribeCommunity({
          relays,
          communityId: selectedCommunity.communityId,
          onPacket: async (decoded) => {
            if (cancelled) {
              return;
            }
            remoteDocIds.add(decoded.docIdHex);
            if (decoded.universe === "chat") {
              if (knownIds.has(decoded.docIdHex)) {
                return;
              }
              knownIds.add(decoded.docIdHex);
              await store.ingestChatPacket(
                selectedCommunity.communityId,
                decoded.rawBytes
              );
              if (!cancelled) {
                await refreshWorkshops(
                  selectedCommunity.communityId,
                  projectionRef.current
                );
              }
              return;
            }
            if (knownIds.has(decoded.docIdHex)) {
              return;
            }
            knownIds.add(decoded.docIdHex);
            const res = await store.savePacket(
              selectedCommunity.communityId,
              decoded.rawBytes
            );
            if (res.isNew && !cancelled) {
              const nextProj = await refreshProjection(selectedCommunity.communityId);
              if (!cancelled) {
                await refreshWorkshops(selectedCommunity.communityId, nextProj);
              }
            }
          },
          onEose: () => {
            if (cancelled) {
              return;
            }
            setSyncState("live");
            backfillTimer = setTimeout(() => {
              if (cancelled) {
                return;
              }
              for (const rec of stored) {
                if (!remoteDocIds.has(rec.docIdHex)) {
                  void transport
                    .publishPacket(
                      relays,
                      selectedCommunity.communityId,
                      rec.rawBytes,
                      identity.privateKey
                    )
                    .catch(() => {});
                }
              }
              for (const chatPkt of storedChatPackets) {
                const pktId = bytesToHex(calculateDocId(chatPkt));
                if (!remoteDocIds.has(pktId)) {
                  void transport
                    .publishPacket(
                      relays,
                      selectedCommunity.communityId,
                      chatPkt,
                      identity.privateKey
                    )
                    .catch(() => {});
                }
              }
            }, 120);
          },
          onError: (err) => {
            if (!cancelled) {
              setErrorMessage(err.message);
            }
          },
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : String(err));
          setSyncState("idle");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (backfillTimer) {
        clearTimeout(backfillTimer);
      }
      sub?.close("effect cleanup");
    };
  }, [selectedCommunity, identity, resyncNonce, refreshProjection, refreshLocalPrefs, refreshWorkshops]);

  const publishAndStore = useCallback(
    async (communityId: string, relays: readonly string[], rawBytes: Uint8Array) => {
      if (!identity) {
        throw new Error("Identidade local não inicializada.");
      }
      const store = storeRef.current!;
      const transport = transportRef.current!;

      const saved = await store.savePacket(communityId, rawBytes);
      const nextProj = await refreshProjection(communityId);
      await refreshWorkshops(communityId, nextProj);

      const cleanRelays = normalizeRelayList(relays);
      if (cleanRelays.length === 0) {
        return { ...saved, acceptedCount: 0, totalRelays: 0 };
      }

      const pubRes = await transport.publishPacket(
        cleanRelays,
        communityId,
        rawBytes,
        identity.privateKey
      );
      return {
        ...saved,
        acceptedCount: pubRes.acceptedCount,
        totalRelays: cleanRelays.length,
      };
    },
    [identity, refreshProjection, refreshWorkshops]
  );

  const publishAndIngestChat = useCallback(
    async (communityId: string, relays: readonly string[], rawBytes: Uint8Array) => {
      if (!identity) {
        throw new Error("Identidade local não inicializada.");
      }
      const store = storeRef.current!;
      const transport = transportRef.current!;

      const ingested = await store.ingestChatPacket(communityId, rawBytes);
      await refreshWorkshops(communityId, projectionRef.current);

      const cleanRelays = normalizeRelayList(relays);
      if (cleanRelays.length > 0) {
        await transport.publishPacket(
          cleanRelays,
          communityId,
          rawBytes,
          identity.privateKey
        );
      }
      return ingested;
    },
    [identity, refreshWorkshops]
  );

  const getNextChatSeq = useCallback(
    async (subjectScope: string, authorPubHex: string): Promise<number> => {
      const workshop = workshopsByScope[subjectScope];
      let maxSeq = 0;
      if (workshop) {
        for (const msg of workshop.messages) {
          if (msg.authorPubHex === authorPubHex && msg.seq > maxSeq) {
            maxSeq = msg.seq;
          }
        }
        for (const draft of workshop.activeDrafts) {
          if (draft.authorPubHex === authorPubHex && draft.seq > maxSeq) {
            maxSeq = draft.seq;
          }
        }
      }
      const rawPackets = await storeRef.current!.getChatPacketsBySubject(subjectScope);
      if (rawPackets.length > 0) {
        const view = await projectSubjectWorkshop({
          subjectScope,
          rawChatPackets: rawPackets,
          projection: null,
        });
        for (const msg of view.messages) {
          if (msg.authorPubHex === authorPubHex && msg.seq > maxSeq) {
            maxSeq = msg.seq;
          }
        }
        for (const draft of view.activeDrafts) {
          if (draft.authorPubHex === authorPubHex && draft.seq > maxSeq) {
            maxSeq = draft.seq;
          }
        }
        // Inclui possíveis tombstones DELETED armazenados no .chat
        for (const pkt of rawPackets) {
          try {
            const doc = await unpackAndVerifyDocument(pkt);
            if (bytesToHex(doc.authorPub) === authorPubHex && doc.seq > maxSeq) {
              maxSeq = doc.seq;
            }
          } catch {
            // ignora pacote inválido
          }
        }
      }
      return maxSeq + 1;
    },
    [workshopsByScope]
  );

  const runActionWithResult = useCallback(async <T>(fn: () => Promise<{ result: T; message?: string }>): Promise<T | null> => {
    setBusy(true);
    setErrorMessage(null);
    try {
      const { result, message } = await fn();
      if (message) {
        setStatusMessage(message);
      }
      return result;
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const runAction = useCallback(
    async (fn: () => Promise<string | void>) => {
      await runActionWithResult(async () => {
        const message = await fn();
        return message ? { result: true, message } : { result: true };
      });
    },
    [runActionWithResult]
  );

  const createIdentity = useCallback(
    (displayName: string) =>
      runAction(async () => {
        const created = await storeRef.current!.createIdentity(displayName);
        setIdentity(created);
      }),
    [runAction]
  );

  const createCommunity = useCallback(
    (input: CreateCommunityInput) =>
      runAction(async () => {
        if (!identity) {
          throw new Error("Crie sua identidade primeiro.");
        }
        const communityId = slugifyCommunityId(input.title);
        const relays = normalizeRelayList(input.relays);
        const nowMs = Date.now();

        const rawBytes = await packDocument(
          {
            docType: DocType.CONFIG,
            authorPub: identity.publicKey,
            seq: 1,
            blocks: [
              createScopeBlock(communityId),
              createConfigKindBlock(ConfigKind.COMMUNITY),
              createTitleBlock(input.title.trim()),
              createBodyBlock(input.body.trim() || "Estatuto inicial da comunidade"),
              createQuorumPctBlock(input.quorumPct),
              createInactivityDaysBlock(input.inactivityDays),
              createInvitePolicyBlock(input.invitePolicy),
              createAuthorNameBlock(identity.displayName),
              createTimestampBlock(nowMs),
            ],
          },
          identity.privateKey
        );

        const record: CommunityRecord = {
          communityId,
          title: input.title.trim(),
          relays,
          createdAtMs: nowMs,
        };
        await storeRef.current!.saveCommunity(record);
        setCommunities(await storeRef.current!.listCommunities());
        setSelectedCommunityId(communityId);

        await publishAndStore(communityId, relays, rawBytes);
      }),
    [identity, publishAndStore, runAction]
  );

  const proposeConfigVersion = useCallback(
    (input: ProposeConfigVersionInput) =>
      runAction(async () => {
        if (!identity || !selectedCommunity || !projection?.activeConfig) {
          throw new Error("Selecione uma comunidade com .cmnt vigente.");
        }
        const store = storeRef.current!;
        const seq = await store.getNextSeq(selectedCommunity.communityId, identity.publicKeyHex);
        const rawBytes = await packDocument(
          {
            docType: DocType.CONFIG,
            authorPub: identity.publicKey,
            seq,
            blocks: [
              createScopeBlock(selectedCommunity.communityId),
              createConfigKindBlock(ConfigKind.COMMUNITY),
              createParentHashBlock(hexToBytes(projection.activeConfig.docIdHex)),
              createTitleBlock(input.title.trim()),
              createBodyBlock(input.body.trim() || "Proposta de atualização de regras"),
              createQuorumPctBlock(input.quorumPct),
              createInactivityDaysBlock(input.inactivityDays),
              createInvitePolicyBlock(input.invitePolicy),
              createAuthorNameBlock(identity.displayName),
              createTimestampBlock(Date.now()),
            ],
          },
          identity.privateKey
        );

        await publishAndStore(
          selectedCommunity.communityId,
          selectedCommunity.relays,
          rawBytes
        );
      }),
    [identity, projection, publishAndStore, runAction, selectedCommunity]
  );

  const supportConfigVersion = useCallback(
    (targetDocIdHex: string) =>
      runAction(async () => {
        if (!identity || !selectedCommunity) {
          throw new Error("Comunidade não selecionada.");
        }
        const seq = await storeRef.current!.getNextSeq(
          selectedCommunity.communityId,
          identity.publicKeyHex
        );
        const rawBytes = await packDocument(
          {
            docType: DocType.COMMUNITY_PICK,
            authorPub: identity.publicKey,
            seq,
            blocks: [
              createScopeBlock(selectedCommunity.communityId),
              createPickTargetBlock(hexToBytes(targetDocIdHex)),
              createAuthorNameBlock(identity.displayName),
              createTimestampBlock(Date.now()),
            ],
          },
          identity.privateKey
        );

        await publishAndStore(
          selectedCommunity.communityId,
          selectedCommunity.relays,
          rawBytes
        );
      }),
    [identity, publishAndStore, runAction, selectedCommunity]
  );

  const generateInvite = useCallback(
    (expiresInHours = 72) =>
      runAction(async () => {
        if (!identity || !selectedCommunity) {
          throw new Error("Selecione uma comunidade primeiro.");
        }
        if (
          projection?.inviteRules.cooldownInviterPubs.includes(identity.publicKeyHex)
        ) {
          throw new Error(
            "Você está em espera na rotação de convites. Aguarde outro membro apadrinhar antes de gerar um novo convite."
          );
        }
        const nowMs = Date.now();
        const nonceBytes = crypto.getRandomValues(new Uint8Array(4));
        const nonceView = new DataView(nonceBytes.buffer);
        const proofBytes = await createSignedInvite({
          communityId: selectedCommunity.communityId,
          inviterPub: identity.publicKey,
          inviterPrivateKey: identity.privateKey,
          issuedAtMs: nowMs,
          expiresAtMs: nowMs + expiresInHours * 3_600_000,
          nonce: nonceView.getUint32(0, false),
        });
        const code = encodeInviteCode({
          communityId: selectedCommunity.communityId,
          proofBytes,
          relays: selectedCommunity.relays,
        });
        setGeneratedInviteCode(code);
      }),
    [identity, projection, runAction, selectedCommunity]
  );

  const endorseInvite = useCallback(
    (rawInviteCode: string) =>
      runAction(async () => {
        if (!identity || !selectedCommunity) {
          throw new Error("Selecione uma comunidade primeiro.");
        }
        const myMember = projection?.members.find(
          (m) => m.pubHex === identity.publicKeyHex
        );
        if (!myMember || myMember.status !== "ACTIVE") {
          throw new Error("Apenas membros ativos da comunidade podem endossar convites.");
        }
        const decoded = decodeInviteCode(rawInviteCode);
        if (decoded.communityId !== selectedCommunity.communityId) {
          throw new Error(
            `Este convite pertence à comunidade "${decoded.communityId}", não à comunidade selecionada.`
          );
        }
        const verifiedProof = await verifyInviteProof(
          decoded.communityId,
          decoded.proofBytes
        );
        if (!verifiedProof) {
          throw new Error("Convite inválido ou assinatura do padrinho corrompida.");
        }
        if (verifiedProof.expiresAtMs < Date.now()) {
          throw new Error("Este convite já expirou.");
        }
        if (bytesToHex(verifiedProof.inviterPub) === identity.publicKeyHex) {
          throw new Error(
            "O endosso deve ser assinado por outro membro ativo distinto do padrinho."
          );
        }

        const endorsementBytes = await endorseSignedInvite({
          communityId: decoded.communityId,
          proofBytes: decoded.proofBytes,
          endorserPub: identity.publicKey,
          endorserPrivateKey: identity.privateKey,
        });

        const endorsedCode = encodeInviteCode({
          communityId: decoded.communityId,
          proofBytes: decoded.proofBytes,
          relays:
            decoded.relays.length > 0 ? decoded.relays : selectedCommunity.relays,
          endorsementBytes,
        });
        setGeneratedInviteCode(endorsedCode);
        return "Convite co-assinado (endossado) com sucesso! Envie o novo código ao convidado.";
      }),
    [identity, projection, runAction, selectedCommunity]
  );

  const joinWithInvite = useCallback(
    (rawInviteCode: string) =>
      runAction(async () => {
        if (!identity) {
          throw new Error("Crie sua identidade primeiro.");
        }
        const decoded = decodeInviteCode(rawInviteCode);
        const relays =
          decoded.relays.length > 0 ? decoded.relays : getInitialDefaultRelays();
        const nowMs = Date.now();

        const store = storeRef.current!;
        const seq = await store.getNextSeq(decoded.communityId, identity.publicKeyHex);
        const rawBytes = await packDocument(
          {
            docType: DocType.MEMB_JOIN,
            authorPub: identity.publicKey,
            seq,
            blocks: [
              createScopeBlock(decoded.communityId),
              createInviteProofBlock(decoded.proofBytes),
              ...(decoded.endorsementBytes
                ? [createInviteEndorsementBlock(decoded.endorsementBytes)]
                : []),
              createAuthorNameBlock(identity.displayName),
              createTimestampBlock(nowMs),
            ],
          },
          identity.privateKey
        );

        await store.saveCommunity({
          communityId: decoded.communityId,
          title: decoded.communityId,
          relays,
          createdAtMs: nowMs,
        });
        setCommunities(await store.listCommunities());
        setSelectedCommunityId(decoded.communityId);

        await publishAndStore(decoded.communityId, relays, rawBytes);
      }),
    [identity, publishAndStore, runAction]
  );

  const leaveCommunity = useCallback(
    () =>
      runAction(async () => {
        if (!identity || !selectedCommunity) {
          throw new Error("Nenhuma comunidade selecionada.");
        }
        const seq = await storeRef.current!.getNextSeq(
          selectedCommunity.communityId,
          identity.publicKeyHex
        );
        const rawBytes = await packDocument(
          {
            docType: DocType.MEMB_LEAVE,
            authorPub: identity.publicKey,
            seq,
            blocks: [
              createScopeBlock(selectedCommunity.communityId),
              createAuthorNameBlock(identity.displayName),
              createTimestampBlock(Date.now()),
            ],
          },
          identity.privateKey
        );

        await publishAndStore(
          selectedCommunity.communityId,
          selectedCommunity.relays,
          rawBytes
        );
      }),
    [identity, publishAndStore, runAction, selectedCommunity]
  );

  const createCategory = useCallback(
    (input: CreateCategoryInput) =>
      runActionWithResult(async () => {
        if (!identity || !selectedCommunity) {
          throw new Error("Selecione uma comunidade.");
        }
        const categoryScope = slugifyCategory(selectedCommunity.communityId, input.title);
        const seq = await storeRef.current!.getNextSeq(
          selectedCommunity.communityId,
          identity.publicKeyHex
        );
        const rawBytes = await packDocument(
          {
            docType: DocType.CONFIG,
            authorPub: identity.publicKey,
            seq,
            blocks: [
              createScopeBlock(categoryScope),
              createConfigKindBlock(ConfigKind.CATEGORY),
              createTitleBlock(input.title.trim()),
              createBodyBlock(input.body.trim() || "Categoria de assuntos"),
              createAuthorNameBlock(identity.displayName),
              createTimestampBlock(Date.now()),
            ],
          },
          identity.privateKey
        );

        const res = await publishAndStore(
          selectedCommunity.communityId,
          selectedCommunity.relays,
          rawBytes
        );
        return {
          result: res.docIdHex,
        };
      }),
    [identity, publishAndStore, runActionWithResult, selectedCommunity]
  );

  const createSubject = useCallback(
    (input: CreateSubjectInput) =>
      runActionWithResult(async () => {
        if (!identity || !selectedCommunity) {
          throw new Error("Selecione uma comunidade.");
        }
        const subjectScope = slugifySubject(selectedCommunity.communityId, input.title);
        const seq = await storeRef.current!.getNextSeq(
          selectedCommunity.communityId,
          identity.publicKeyHex
        );
        const modeValue =
          input.deliberationMode === "OPEN" ? DeliberationMode.OPEN : DeliberationMode.QUORUM;
        const blocks: TLVBlock[] = [
          createScopeBlock(subjectScope),
          createConfigKindBlock(ConfigKind.SUBJECT),
          ...(input.categoryHashHex
            ? [createCategoryHashBlock(hexToBytes(input.categoryHashHex))]
            : []),
          createTitleBlock(input.title.trim()),
          createBodyBlock(input.body.trim() || "Abertura de assunto"),
          createDeliberationModeBlock(modeValue),
          ...(input.deadlineUnixSeconds !== undefined
            ? [createDeadlineBlock(input.deadlineUnixSeconds)]
            : []),
          createAuthorNameBlock(identity.displayName),
          createTimestampBlock(Date.now()),
        ];
        const rawBytes = await packDocument(
          {
            docType: DocType.CONFIG,
            authorPub: identity.publicKey,
            seq,
            blocks,
          },
          identity.privateKey
        );

        await publishAndStore(
          selectedCommunity.communityId,
          selectedCommunity.relays,
          rawBytes
        );
        return {
          result: subjectScope,
        };
      }),
    [identity, publishAndStore, runActionWithResult, selectedCommunity]
  );

  const packAndPublishProposal = useCallback(
    async (input: CreateProposalInput): Promise<string> => {
      if (!identity || !selectedCommunity) {
        throw new Error("Selecione uma comunidade.");
      }
      const structuredBlocks = buildStructuredFieldBlocks(input.fields);
      const fallbackSummary = buildSummaryBody(input.body, input.fields);

      const blocks: TLVBlock[] = [
        createScopeBlock(input.subjectScope),
        ...(input.parentHashHex
          ? [createParentHashBlock(hexToBytes(input.parentHashHex))]
          : []),
        createTitleBlock(input.title.trim()),
        ...(fallbackSummary.length > 0 ? [createBodyBlock(fallbackSummary)] : []),
        ...structuredBlocks,
        ...(input.deadlineUnixSeconds !== undefined
          ? [createDeadlineBlock(input.deadlineUnixSeconds)]
          : []),
        createAuthorNameBlock(identity.displayName),
        createTimestampBlock(Date.now()),
      ];
      const rawBytes = await packDocument(
        {
          docType: DocType.PROPOSAL,
          authorPub: identity.publicKey,
          seq: 1,
          blocks,
        },
        identity.privateKey
      );

      const res = await publishAndStore(
        selectedCommunity.communityId,
        selectedCommunity.relays,
        rawBytes
      );
      return res.docIdHex;
    },
    [identity, publishAndStore, selectedCommunity]
  );

  const createProposal = useCallback(
    (input: CreateProposalInput) =>
      runActionWithResult(async () => ({
        result: await packAndPublishProposal(input),
      })),
    [packAndPublishProposal, runActionWithResult]
  );

  const packAndSendChatMessage = useCallback(
    async (input: SendChatMessageInput): Promise<string> => {
      if (!identity || !selectedCommunity) {
        throw new Error("Selecione uma comunidade.");
      }
      const trimmedBody = input.body.trim();
      if (!trimmedBody) {
        throw new Error("Digite uma mensagem antes de enviar.");
      }
      const seq = await getNextChatSeq(input.subjectScope, identity.publicKeyHex);
      const blocks: TLVBlock[] = [
        createScopeBlock(input.subjectScope),
        createBodyBlock(trimmedBody),
        ...(input.referencedDraftId
          ? [createDraftIdBlock(input.referencedDraftId)]
          : []),
        ...(input.referencedProposalDocIdHex
          ? [createPickTargetBlock(hexToBytes(input.referencedProposalDocIdHex))]
          : []),
        createAuthorNameBlock(identity.displayName),
        createTimestampBlock(Date.now()),
      ];
      const rawBytes = await packDocument(
        {
          docType: DocType.CHAT_MESSAGE,
          authorPub: identity.publicKey,
          seq,
          blocks,
        },
        identity.privateKey
      );
      const res = await publishAndIngestChat(
        selectedCommunity.communityId,
        selectedCommunity.relays,
        rawBytes
      );
      return res.docIdHex;
    },
    [getNextChatSeq, identity, publishAndIngestChat, selectedCommunity]
  );

  const sendChatMessage = useCallback(
    (input: SendChatMessageInput) =>
      runActionWithResult(async () => ({
        result: await packAndSendChatMessage(input),
      })),
    [packAndSendChatMessage, runActionWithResult]
  );

  const publishSharedDraft = useCallback(
    (input: PublishSharedDraftInput) =>
      runActionWithResult(async () => {
        if (!identity || !selectedCommunity) {
          throw new Error("Selecione uma comunidade.");
        }
        const seq = await getNextChatSeq(input.subjectScope, identity.publicKeyHex);
        const structuredBlocks = buildStructuredFieldBlocks(input.fields);
        const summaryBody = buildSummaryBody(input.body, input.fields);
        const blocks: TLVBlock[] = [
          createScopeBlock(input.subjectScope),
          createDraftIdBlock(input.draftId),
          createDraftStatusBlock(DraftStatus.ACTIVE),
          ...(input.parentHashHex
            ? [createParentHashBlock(hexToBytes(input.parentHashHex))]
            : []),
          createTitleBlock(input.title.trim()),
          ...(summaryBody.length > 0 ? [createBodyBlock(summaryBody)] : []),
          ...structuredBlocks,
          ...(input.deadlineUnixSeconds !== undefined && input.deadlineUnixSeconds !== null
            ? [createDeadlineBlock(input.deadlineUnixSeconds)]
            : []),
          createAuthorNameBlock(identity.displayName),
          createTimestampBlock(Date.now()),
        ];
        const rawBytes = await packDocument(
          {
            docType: DocType.CHAT_DRAFT,
            authorPub: identity.publicKey,
            seq,
            blocks,
          },
          identity.privateKey
        );
        const res = await publishAndIngestChat(
          selectedCommunity.communityId,
          selectedCommunity.relays,
          rawBytes
        );
        return {
          result: res.docIdHex,
          message: "Rascunho atualizado na Oficina (.chat).",
        };
      }),
    [getNextChatSeq, identity, publishAndIngestChat, runActionWithResult, selectedCommunity]
  );

  const packAndDeleteSharedDraft = useCallback(
    async (subjectScope: string, draftId: string): Promise<void> => {
      if (!identity || !selectedCommunity) {
        throw new Error("Selecione uma comunidade.");
      }
      const seq = await getNextChatSeq(subjectScope, identity.publicKeyHex);
      const rawBytes = await packDocument(
        {
          docType: DocType.CHAT_DRAFT,
          authorPub: identity.publicKey,
          seq,
          blocks: [
            createScopeBlock(subjectScope),
            createDraftIdBlock(draftId),
            createDraftStatusBlock(DraftStatus.DELETED),
            createAuthorNameBlock(identity.displayName),
            createTimestampBlock(Date.now()),
          ],
        },
        identity.privateKey
      );
      await publishAndIngestChat(
        selectedCommunity.communityId,
        selectedCommunity.relays,
        rawBytes
      );
    },
    [getNextChatSeq, identity, publishAndIngestChat, selectedCommunity]
  );

  const deleteSharedDraft = useCallback(
    (subjectScope: string, draftId: string) =>
      runAction(async () => {
        await packAndDeleteSharedDraft(subjectScope, draftId);
        return "Rascunho eliminado da Oficina.";
      }),
    [packAndDeleteSharedDraft, runAction]
  );

  const promoteSharedDraftToProposal = useCallback(
    (params: { readonly draft: SharedDraftView }) =>
      runActionWithResult(async () => {
        if (!identity || !selectedCommunity) {
          throw new Error("Selecione uma comunidade.");
        }
        const { draft } = params;
        const createdProposalDocIdHex = await packAndPublishProposal({
          subjectScope: draft.scope,
          title: draft.title,
          body: draft.body,
          ...(draft.parentHashHex ? { parentHashHex: draft.parentHashHex } : {}),
          ...(draft.deadlineUnixSeconds !== null
            ? { deadlineUnixSeconds: draft.deadlineUnixSeconds }
            : {}),
          fields: draft.fields,
        });

        if (draft.authorPubHex === identity.publicKeyHex) {
          await packAndDeleteSharedDraft(draft.scope, draft.draftId);
        }

        await packAndSendChatMessage({
          subjectScope: draft.scope,
          body: `Converteu o rascunho “${draft.title}” na Proposta Oficial.`,
          referencedDraftId: draft.draftId,
          referencedProposalDocIdHex: createdProposalDocIdHex,
        });

        return {
          result: createdProposalDocIdHex,
          message:
            draft.authorPubHex === identity.publicKeyHex
              ? "Proposta publicada em .stze e rascunho removido da Oficina."
              : "Proposta publicada em .stze; rascunho original marcado como já convertido.",
        };
      }),
    [
      identity,
      packAndDeleteSharedDraft,
      packAndPublishProposal,
      packAndSendChatMessage,
      runActionWithResult,
      selectedCommunity,
    ]
  );

  const saveDraft = useCallback(
    async (input: SaveDraftInput) => {
      if (!selectedCommunity) {
        return;
      }
      await storeRef.current!.saveDraft({
        ...input,
        communityId: selectedCommunity.communityId,
        updatedAtMs: Date.now(),
      });
      await refreshLocalPrefs(selectedCommunity.communityId);
    },
    [refreshLocalPrefs, selectedCommunity]
  );

  const deleteDraft = useCallback(
    async (draftId: string) => {
      if (!selectedCommunity) {
        return;
      }
      await storeRef.current!.deleteDraft(draftId);
      await refreshLocalPrefs(selectedCommunity.communityId);
    },
    [refreshLocalPrefs, selectedCommunity]
  );

  const hideDocument = useCallback(
    async (docIdHex: string, kind: "SUBJECT" | "PROPOSAL") => {
      if (!selectedCommunity) {
        return;
      }
      await storeRef.current!.hideDocument({
        docIdHex,
        communityId: selectedCommunity.communityId,
        kind,
        hiddenAtMs: Date.now(),
      });
      await refreshLocalPrefs(selectedCommunity.communityId);
    },
    [refreshLocalPrefs, selectedCommunity]
  );

  const unhideDocument = useCallback(
    async (docIdHex: string) => {
      if (!selectedCommunity) {
        return;
      }
      await storeRef.current!.unhideDocument(docIdHex);
      await refreshLocalPrefs(selectedCommunity.communityId);
    },
    [refreshLocalPrefs, selectedCommunity]
  );

  const pickProposal = useCallback(
    (subjectScope: string, proposalDocIdHex: string) =>
      runAction(async () => {
        if (!identity || !selectedCommunity) {
          throw new Error("Selecione uma comunidade.");
        }
        const seq = await storeRef.current!.getNextSeq(
          selectedCommunity.communityId,
          identity.publicKeyHex
        );
        const rawBytes = await packDocument(
          {
            docType: DocType.PICK,
            authorPub: identity.publicKey,
            seq,
            blocks: [
              createScopeBlock(subjectScope),
              createPickTargetBlock(hexToBytes(proposalDocIdHex)),
              createAuthorNameBlock(identity.displayName),
              createTimestampBlock(Date.now()),
            ],
          },
          identity.privateKey
        );

        await publishAndStore(
          selectedCommunity.communityId,
          selectedCommunity.relays,
          rawBytes
        );
      }),
    [identity, publishAndStore, runAction, selectedCommunity]
  );

  const updateRelays = useCallback(
    (rawRelays: readonly string[]) =>
      runAction(async () => {
        if (!selectedCommunity) {
          return;
        }
        const clean = normalizeRelayList(rawRelays);
        await storeRef.current!.updateCommunityRelays(selectedCommunity.communityId, clean);
        setCommunities(await storeRef.current!.listCommunities());
      }),
    [runAction, selectedCommunity]
  );

  const createSnapshot = useCallback(
    () =>
      runAction(async () => {
        if (!identity || !selectedCommunity || !projection?.activeConfig) {
          throw new Error("Selecione uma comunidade com .cmnt vigente para gerar snapshot.");
        }
        const activeMembers = projection.members.filter((m) => m.status === "ACTIVE");
        if (activeMembers.length === 0) {
          throw new Error("É necessário ao menos 1 membro ativo para gerar um .snap.");
        }
        const cutoffHex = projection.documents[0]?.docIdHex ?? projection.activeConfig.docIdHex;
        const seq = await storeRef.current!.getNextSeq(
          selectedCommunity.communityId,
          identity.publicKeyHex
        );
        const rawBytes = await packDocument(
          {
            docType: DocType.SNAPSHOT,
            authorPub: identity.publicKey,
            seq,
            blocks: [
              createScopeBlock(selectedCommunity.communityId),
              createCutoffHashBlock(hexToBytes(cutoffHex)),
              createActiveCmntHashBlock(hexToBytes(projection.activeConfig.docIdHex)),
              createActiveMembersTableBlock(
                activeMembers.map((m) => ({
                  pubKey: hexToBytes(m.pubHex),
                  lastActivityMs: m.lastActivityMs,
                }))
              ),
              createTimestampBlock(Date.now()),
            ],
          },
          identity.privateKey
        );

        await publishAndStore(
          selectedCommunity.communityId,
          selectedCommunity.relays,
          rawBytes
        );
      }),
    [identity, projection, publishAndStore, runAction, selectedCommunity]
  );

  const resync = useCallback(() => {
    setResyncNonce((n) => n + 1);
  }, []);

  const listAllStoredPackets = useCallback(async (): Promise<StoredPacketRecord[]> => {
    const store = storeRef.current!;
    return store.listAllPackets();
  }, []);

  const listAllChatFiles = useCallback(async (): Promise<StoredChatFileRecord[]> => {
    const store = storeRef.current!;
    return store.listAllChatFiles();
  }, []);

  const seedLargeDataset = useCallback(
    (scale: SeedScale = "large", preferredName?: string) =>
      runAction(async () => {
        const store = storeRef.current!;
        const activeIdentity =
          identity ??
          (await store.createIdentity(preferredName?.trim() || "Moderador Teste"));

        if (!identity) {
          setIdentity(activeIdentity);
        }

        try {
          setSeedProgress("Preparando chaves e pacotes criptográficos...");
          const { bundles, stats } = await generateSeedDataset({
            identity: activeIdentity,
            scale,
            onProgress: (msg) => setSeedProgress(msg),
          });

          for (let i = 0; i < bundles.length; i += 1) {
            const bundle = bundles[i]!;
            setSeedProgress(
              `Gravando no IndexedDB (${i + 1}/${bundles.length}): ${bundle.record.title}...`
            );
            await store.saveCommunity(bundle.record);
            await store.savePacketsBatch(bundle.record.communityId, bundle.packets);
            if (bundle.chatPackets.length > 0) {
              await store.ingestChatPacketsBatch(
                bundle.record.communityId,
                bundle.chatPackets
              );
            }
          }

          const updatedCommunities = await store.listCommunities();
          setCommunities(updatedCommunities);
          const firstSeededId = bundles[0]?.record.communityId ?? null;
          if (firstSeededId) {
            setSelectedCommunityId(firstSeededId);
            const nextProj = await refreshProjection(firstSeededId);
            await refreshWorkshops(firstSeededId, nextProj);
          }

          return `Seed (${scale}) concluído: ${stats.communities} comunidades, ${stats.members} membros, ${stats.categories} categorias, ${stats.subjects} assuntos, ${stats.proposals} propostas, ${stats.picks} apoios e ${stats.chatPackets} pacotes .chat.`;
        } finally {
          setSeedProgress(null);
        }
      }),
    [identity, refreshProjection, refreshWorkshops, runAction]
  );

  const resetAllData = useCallback(
    () =>
      runAction(async () => {
        const store = storeRef.current!;
        await store.clearAll();
        setIdentity(null);
        setCommunities([]);
        setSelectedCommunityId(null);
        setProjection(null);
        setDrafts([]);
        setHiddenDocs([]);
        setChatFiles([]);
        setWorkshopsByScope({});
        setGeneratedInviteCode(null);
        setSyncState("idle");
        return "Todos os dados locais (identidade, comunidades e pacotes) foram zerados.";
      }),
    [runAction]
  );

  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifyStatus = useCallback((msg: string) => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    setStatusMessage(msg);
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage(null);
      statusTimerRef.current = null;
    }, 3000);
  }, []);

  return {
    loading,
    busy,
    seedProgress,
    identity,
    communities,
    selectedCommunity,
    selectedCommunityId,
    setSelectedCommunityId,
    projection,
    drafts,
    hiddenDocs,
    hiddenDocIds,
    chatFiles,
    workshopsByScope,
    syncState,
    statusMessage,
    errorMessage,
    generatedInviteCode,
    createIdentity,
    createCommunity,
    proposeConfigVersion,
    supportConfigVersion,
    generateInvite,
    endorseInvite,
    joinWithInvite,
    leaveCommunity,
    createCategory,
    createSubject,
    createProposal,
    sendChatMessage,
    publishSharedDraft,
    deleteSharedDraft,
    promoteSharedDraftToProposal,
    saveDraft,
    deleteDraft,
    hideDocument,
    unhideDocument,
    pickProposal,
    createSnapshot,
    updateRelays,
    resync,
    listAllStoredPackets,
    listAllChatFiles,
    seedLargeDataset,
    resetAllData,
    notifyStatus,
  };
}
