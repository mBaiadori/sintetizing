import { hexToBytes } from "@noble/hashes/utils";
import { CommunityProjection, projectCommunityState } from "@sintetizing/domain";
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
  LocalIdentity,
  SintetizeLocalStore,
} from "@sintetizing/storage";
import {
  ConfigKind,
  createActiveCmntHashBlock,
  createActiveMembersTableBlock,
  createAuthorNameBlock,
  createBodyBlock,
  createCategoryHashBlock,
  createConfigKindBlock,
  createCutoffHashBlock,
  createInactivityDaysBlock,
  createInvitePolicyBlock,
  createInviteProofBlock,
  createParentHashBlock,
  createPickTargetBlock,
  createQuorumPctBlock,
  createScopeBlock,
  createSignedInvite,
  createTimestampBlock,
  createTitleBlock,
  DocType,
  InvitePolicy,
  InvitePolicyValue,
  packDocument,
} from "@sintetizing/wire";
import { useCallback, useEffect, useRef, useState } from "react";
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
  readonly quorumPct: number;
  readonly categoryHashHex?: string;
}

export interface CreateProposalInput {
  readonly subjectScope: string;
  readonly title: string;
  readonly body: string;
  readonly parentHashHex?: string;
}

export interface InitialRouteSelection {
  readonly communityId: string | null;
  readonly categoryId: string | null;
  readonly subjectScope: string | null;
  readonly proposalId: string | null;
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
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("c", params.communityId);
  if (params.categoryId) {
    url.searchParams.set("cat", params.categoryId);
  }
  url.searchParams.set("s", params.subjectScope);
  url.searchParams.set("p", params.proposalId);
  return url.toString();
}

function readInitialRouteSelection(): InitialRouteSelection {
  if (typeof window === "undefined") {
    return { communityId: null, categoryId: null, subjectScope: null, proposalId: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    communityId: params.get("c"),
    categoryId: params.get("cat"),
    subjectScope: params.get("s"),
    proposalId: params.get("p"),
  };
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
  const [initialSelection] = useState<InitialRouteSelection>(() => readInitialRouteSelection());

  const selectedCommunity =
    communities.find((c) => c.communityId === selectedCommunityId) ?? null;

  const refreshProjection = useCallback(async (communityId: string) => {
    const store = storeRef.current!;
    const records = await store.listPacketsByCommunity(communityId);
    const next = await projectCommunityState(
      records.map((r) => r.rawBytes),
      communityId,
      Date.now()
    );
    setProjection(next);
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
          const matched = initialSelection.communityId
            ? loadedComms.find((c) => c.communityId === initialSelection.communityId)
            : undefined;
          setSelectedCommunityId((prev) => prev ?? matched?.communityId ?? loadedComms[0]!.communityId);
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
      store.close();
    };
  }, []);

  // Sincronização ativa via Nostr quando uma comunidade está selecionada
  useEffect(() => {
    if (!selectedCommunity || !identity) {
      setProjection(null);
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
        }

        const relays = normalizeRelayList(selectedCommunity.relays);
        if (relays.length === 0) {
          if (!cancelled) {
            setSyncState("idle");
          }
          return;
        }

        const knownIds = new Set(stored.map((r) => r.docIdHex));
        const remoteDocIds = new Set<string>();
        sub = transport.subscribeCommunity({
          relays,
          communityId: selectedCommunity.communityId,
          onPacket: async (decoded) => {
            if (cancelled) {
              return;
            }
            remoteDocIds.add(decoded.docIdHex);
            if (knownIds.has(decoded.docIdHex)) {
              return;
            }
            knownIds.add(decoded.docIdHex);
            const res = await store.savePacket(
              selectedCommunity.communityId,
              decoded.rawBytes
            );
            if (res.isNew && !cancelled) {
              await refreshProjection(selectedCommunity.communityId);
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
  }, [selectedCommunity, identity, resyncNonce, refreshProjection]);

  const publishAndStore = useCallback(
    async (communityId: string, relays: readonly string[], rawBytes: Uint8Array) => {
      if (!identity) {
        throw new Error("Identidade local não inicializada.");
      }
      const store = storeRef.current!;
      const transport = transportRef.current!;

      const saved = await store.savePacket(communityId, rawBytes);
      await refreshProjection(communityId);

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
    [identity, refreshProjection]
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
    [identity, runAction, selectedCommunity]
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
        const blocks = [
          createScopeBlock(subjectScope),
          createConfigKindBlock(ConfigKind.SUBJECT),
          ...(input.categoryHashHex
            ? [createCategoryHashBlock(hexToBytes(input.categoryHashHex))]
            : []),
          createTitleBlock(input.title.trim()),
          createBodyBlock(input.body.trim() || "Abertura de assunto"),
          createQuorumPctBlock(input.quorumPct),
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

  const createProposal = useCallback(
    (input: CreateProposalInput) =>
      runActionWithResult(async () => {
        if (!identity || !selectedCommunity) {
          throw new Error("Selecione uma comunidade.");
        }
        const blocks = [
          createScopeBlock(input.subjectScope),
          ...(input.parentHashHex
            ? [createParentHashBlock(hexToBytes(input.parentHashHex))]
            : []),
          createTitleBlock(input.title.trim()),
          createBodyBlock(input.body.trim()),
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
        return {
          result: res.docIdHex,
        };
      }),
    [identity, publishAndStore, runActionWithResult, selectedCommunity]
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
          }

          const updatedCommunities = await store.listCommunities();
          setCommunities(updatedCommunities);
          const firstSeededId = bundles[0]?.record.communityId ?? null;
          if (firstSeededId) {
            setSelectedCommunityId(firstSeededId);
            await refreshProjection(firstSeededId);
          }

          return `Seed (${scale}) concluído: ${stats.communities} comunidades, ${stats.members} membros, ${stats.categories} categorias, ${stats.subjects} assuntos, ${stats.proposals} propostas e ${stats.picks} apoios.`;
        } finally {
          setSeedProgress(null);
        }
      }),
    [identity, refreshProjection, runAction]
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
        setGeneratedInviteCode(null);
        setSyncState("idle");
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", window.location.pathname);
        }
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
    initialSelection,
    projection,
    syncState,
    statusMessage,
    errorMessage,
    generatedInviteCode,
    createIdentity,
    createCommunity,
    proposeConfigVersion,
    supportConfigVersion,
    generateInvite,
    joinWithInvite,
    leaveCommunity,
    createCategory,
    createSubject,
    createProposal,
    pickProposal,
    createSnapshot,
    updateRelays,
    resync,
    seedLargeDataset,
    resetAllData,
    notifyStatus,
  };
}
