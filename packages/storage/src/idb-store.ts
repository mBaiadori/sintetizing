import * as ed25519 from "@noble/ed25519";
import { bytesToHex } from "@noble/hashes/utils";
import {
  calculateDocId,
  compactChatPackets,
  decodeChatFile,
  DocUniverse,
  encodeChatFile,
  getDocumentUniverse,
  readUtf8Block,
  Tag,
  unpackAndVerifyDocument,
} from "@sintetizing/wire";
import {
  CommunityRecord,
  HiddenDocRecord,
  LocalIdentity,
  LocalStoreOptions,
  ProposalDraftRecord,
  SavePacketResult,
  StoredChatFileRecord,
  StoredPacketRecord,
} from "./types.js";

const DB_VERSION = 3;
const STORE_IDENTITY = "identity";
const STORE_COMMUNITIES = "communities";
const STORE_PACKETS = "packets";
const STORE_DRAFTS = "drafts";
const STORE_HIDDEN_DOCS = "hidden_docs";
const STORE_CHAT_FILES = "chat_files";

function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha em operação IndexedDB."));
  });
}

function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("Transação IndexedDB falhou."));
    tx.onabort = () =>
      reject(tx.error ?? new Error("Transação IndexedDB abortada."));
  });
}

function normalizeIdentity(record: LocalIdentity): LocalIdentity {
  return {
    ...record,
    publicKey: new Uint8Array(record.publicKey),
    privateKey: new Uint8Array(record.privateKey),
  };
}

function normalizePacketRecord(record: StoredPacketRecord): StoredPacketRecord {
  return {
    ...record,
    rawBytes: new Uint8Array(record.rawBytes),
  };
}

function normalizeChatFileRecord(record: StoredChatFileRecord): StoredChatFileRecord {
  return {
    ...record,
    rawChatBytes: new Uint8Array(record.rawChatBytes),
  };
}

/**
 * Repositório Local-First enxuto em IndexedDB para identidade local,
 * lista de relays por comunidade e armazenamento verificado de pacotes TLV.
 */
export class SintetizeLocalStore {
  private readonly dbName: string;
  private readonly idbFactory: IDBFactory | undefined;
  private db: IDBDatabase | null = null;
  private openingPromise: Promise<IDBDatabase> | null = null;

  constructor(options?: LocalStoreOptions) {
    this.dbName = options?.dbName ?? "sintetize-nostr-v3";
    this.idbFactory = options?.indexedDB ?? globalThis.indexedDB;
  }

  public async open(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }
    if (this.openingPromise) {
      return this.openingPromise;
    }
    const factory = this.idbFactory;
    if (!factory) {
      throw new Error("IndexedDB não disponível neste ambiente.");
    }

    this.openingPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(this.dbName, DB_VERSION);
      const timeoutId = globalThis.setTimeout(() => {
        this.openingPromise = null;
        reject(
          new Error(
            "Tempo esgotado ao abrir o IndexedDB. Feche outras abas ou limpe os dados do site."
          )
        );
      }, 4000);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_IDENTITY)) {
          db.createObjectStore(STORE_IDENTITY, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_COMMUNITIES)) {
          db.createObjectStore(STORE_COMMUNITIES, { keyPath: "communityId" });
        }
        if (!db.objectStoreNames.contains(STORE_PACKETS)) {
          const packetStore = db.createObjectStore(STORE_PACKETS, {
            keyPath: "docIdHex",
          });
          packetStore.createIndex("by_community", "communityId", { unique: false });
          packetStore.createIndex("by_universe", "universe", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
          const draftStore = db.createObjectStore(STORE_DRAFTS, {
            keyPath: "draftId",
          });
          draftStore.createIndex("by_community", "communityId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_HIDDEN_DOCS)) {
          const hiddenStore = db.createObjectStore(STORE_HIDDEN_DOCS, {
            keyPath: "docIdHex",
          });
          hiddenStore.createIndex("by_community", "communityId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_CHAT_FILES)) {
          const chatStore = db.createObjectStore(STORE_CHAT_FILES, {
            keyPath: "subjectScope",
          });
          chatStore.createIndex("by_community", "communityId", { unique: false });
        }
      };

      request.onsuccess = () => {
        globalThis.clearTimeout(timeoutId);
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          if (this.db === db) {
            this.db = null;
          }
        };
        this.db = db;
        this.openingPromise = null;
        resolve(db);
      };

      request.onblocked = () => {
        globalThis.clearTimeout(timeoutId);
        this.openingPromise = null;
        reject(
          new Error(
            "Atualização do banco local IndexedDB bloqueada por outra aba aberta. Feche outras abas do Sintetize e recarregue."
          )
        );
      };

      request.onerror = () => {
        globalThis.clearTimeout(timeoutId);
        this.openingPromise = null;
        reject(request.error ?? new Error("Não foi possível abrir o banco local."));
      };
    });

    return this.openingPromise;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  public async getIdentity(): Promise<LocalIdentity | null> {
    const db = await this.open();
    const tx = db.transaction(STORE_IDENTITY, "readonly");
    const found = (await awaitRequest(
      tx.objectStore(STORE_IDENTITY).get("self")
    )) as LocalIdentity | undefined;
    await awaitTransaction(tx);
    return found ? normalizeIdentity(found) : null;
  }

  public async createIdentity(displayName: string, nowMs = Date.now()): Promise<LocalIdentity> {
    const existing = await this.getIdentity();
    if (existing) {
      return existing;
    }
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = await ed25519.getPublicKeyAsync(privateKey);
    const identity: LocalIdentity = {
      id: "self",
      displayName: displayName.trim() || "Membro",
      publicKey,
      privateKey,
      publicKeyHex: bytesToHex(publicKey),
      createdAtMs: nowMs,
    };

    const db = await this.open();
    const tx = db.transaction(STORE_IDENTITY, "readwrite");
    await awaitRequest(tx.objectStore(STORE_IDENTITY).put(identity));
    await awaitTransaction(tx);
    return normalizeIdentity(identity);
  }

  public async updateDisplayName(displayName: string): Promise<LocalIdentity> {
    const current = await this.getIdentity();
    if (!current) {
      return this.createIdentity(displayName);
    }
    const updated: LocalIdentity = {
      ...current,
      displayName: displayName.trim() || current.displayName,
    };
    const db = await this.open();
    const tx = db.transaction(STORE_IDENTITY, "readwrite");
    await awaitRequest(tx.objectStore(STORE_IDENTITY).put(updated));
    await awaitTransaction(tx);
    return normalizeIdentity(updated);
  }

  public async saveCommunity(record: CommunityRecord): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_COMMUNITIES, "readwrite");
    await awaitRequest(tx.objectStore(STORE_COMMUNITIES).put({
      ...record,
      relays: [...record.relays],
    }));
    await awaitTransaction(tx);
  }

  public async listCommunities(): Promise<CommunityRecord[]> {
    const db = await this.open();
    const tx = db.transaction(STORE_COMMUNITIES, "readonly");
    const items = (await awaitRequest(
      tx.objectStore(STORE_COMMUNITIES).getAll()
    )) as CommunityRecord[];
    await awaitTransaction(tx);
    return items.sort((a, b) => a.createdAtMs - b.createdAtMs);
  }

  public async updateCommunityRelays(
    communityId: string,
    relays: readonly string[]
  ): Promise<CommunityRecord | null> {
    const db = await this.open();
    const tx = db.transaction(STORE_COMMUNITIES, "readwrite");
    const store = tx.objectStore(STORE_COMMUNITIES);
    const current = (await awaitRequest(store.get(communityId))) as
      | CommunityRecord
      | undefined;
    if (!current) {
      await awaitTransaction(tx);
      return null;
    }
    const updated: CommunityRecord = {
      ...current,
      relays: [...relays],
    };
    await awaitRequest(store.put(updated));
    await awaitTransaction(tx);
    return updated;
  }

  public async savePacket(
    communityId: string,
    rawBytes: Uint8Array,
    nowMs = Date.now()
  ): Promise<SavePacketResult> {
    const doc = await unpackAndVerifyDocument(rawBytes);
    const docIdHex = bytesToHex(calculateDocId(rawBytes));
    const universe = getDocumentUniverse(doc);

    const db = await this.open();
    const tx = db.transaction(STORE_PACKETS, "readwrite");
    const store = tx.objectStore(STORE_PACKETS);
    const existing = (await awaitRequest(store.get(docIdHex))) as
      | StoredPacketRecord
      | undefined;
    if (existing) {
      await awaitTransaction(tx);
      return { docIdHex, universe, isNew: false };
    }

    const record: StoredPacketRecord = {
      docIdHex,
      communityId,
      universe,
      docType: doc.docType,
      authorPubHex: bytesToHex(doc.authorPub),
      seq: doc.seq,
      rawBytes: new Uint8Array(rawBytes),
      storedAtMs: nowMs,
    };
    await awaitRequest(store.put(record));
    await awaitTransaction(tx);
    return { docIdHex, universe, isNew: true };
  }

  public async savePacketsBatch(
    communityId: string,
    rawPackets: readonly Uint8Array[],
    nowMs = Date.now()
  ): Promise<{ savedCount: number; skippedCount: number }> {
    if (rawPackets.length === 0) {
      return { savedCount: 0, skippedCount: 0 };
    }

    const prepared: StoredPacketRecord[] = [];
    const seenInBatch = new Set<string>();

    for (let i = 0; i < rawPackets.length; i += 1) {
      const rawBytes = rawPackets[i]!;
      const doc = await unpackAndVerifyDocument(rawBytes);
      const docIdHex = bytesToHex(calculateDocId(rawBytes));
      if (seenInBatch.has(docIdHex)) {
        continue;
      }
      seenInBatch.add(docIdHex);
      prepared.push({
        docIdHex,
        communityId,
        universe: getDocumentUniverse(doc),
        docType: doc.docType,
        authorPubHex: bytesToHex(doc.authorPub),
        seq: doc.seq,
        rawBytes: new Uint8Array(rawBytes),
        storedAtMs: nowMs + i,
      });
    }

    const db = await this.open();
    const tx = db.transaction(STORE_PACKETS, "readwrite");
    const store = tx.objectStore(STORE_PACKETS);

    let savedCount = 0;
    let skippedCount = rawPackets.length - prepared.length;

    for (const record of prepared) {
      const existing = (await awaitRequest(store.get(record.docIdHex))) as
        | StoredPacketRecord
        | undefined;
      if (existing) {
        skippedCount += 1;
        continue;
      }
      await awaitRequest(store.put(record));
      savedCount += 1;
    }

    await awaitTransaction(tx);
    return { savedCount, skippedCount };
  }

  public async clearAll(): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(
      [
        STORE_IDENTITY,
        STORE_COMMUNITIES,
        STORE_PACKETS,
        STORE_DRAFTS,
        STORE_HIDDEN_DOCS,
        STORE_CHAT_FILES,
      ],
      "readwrite"
    );
    await Promise.all([
      awaitRequest(tx.objectStore(STORE_IDENTITY).clear()),
      awaitRequest(tx.objectStore(STORE_COMMUNITIES).clear()),
      awaitRequest(tx.objectStore(STORE_PACKETS).clear()),
      awaitRequest(tx.objectStore(STORE_DRAFTS).clear()),
      awaitRequest(tx.objectStore(STORE_HIDDEN_DOCS).clear()),
      awaitRequest(tx.objectStore(STORE_CHAT_FILES).clear()),
    ]);
    await awaitTransaction(tx);
  }

  public async saveDraft(draft: ProposalDraftRecord): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_DRAFTS, "readwrite");
    await awaitRequest(
      tx.objectStore(STORE_DRAFTS).put({
        ...draft,
        fields: draft.fields.map((f) =>
          f.kind === "TABLE"
            ? {
                ...f,
                columns: [...f.columns],
                rows: f.rows.map((r) => [...r]),
              }
            : { ...f }
        ),
      })
    );
    await awaitTransaction(tx);
  }

  public async listDraftsByCommunity(communityId: string): Promise<ProposalDraftRecord[]> {
    const db = await this.open();
    const tx = db.transaction(STORE_DRAFTS, "readonly");
    const idx = tx.objectStore(STORE_DRAFTS).index("by_community");
    const rows = (await awaitRequest(idx.getAll(communityId))) as ProposalDraftRecord[];
    await awaitTransaction(tx);
    return rows.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }

  public async deleteDraft(draftId: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_DRAFTS, "readwrite");
    await awaitRequest(tx.objectStore(STORE_DRAFTS).delete(draftId));
    await awaitTransaction(tx);
  }

  public async hideDocument(record: HiddenDocRecord): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_HIDDEN_DOCS, "readwrite");
    await awaitRequest(tx.objectStore(STORE_HIDDEN_DOCS).put({ ...record }));
    await awaitTransaction(tx);
  }

  public async unhideDocument(docIdHex: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_HIDDEN_DOCS, "readwrite");
    await awaitRequest(tx.objectStore(STORE_HIDDEN_DOCS).delete(docIdHex));
    await awaitTransaction(tx);
  }

  public async listHiddenByCommunity(communityId: string): Promise<HiddenDocRecord[]> {
    const db = await this.open();
    const tx = db.transaction(STORE_HIDDEN_DOCS, "readonly");
    const idx = tx.objectStore(STORE_HIDDEN_DOCS).index("by_community");
    const rows = (await awaitRequest(idx.getAll(communityId))) as HiddenDocRecord[];
    await awaitTransaction(tx);
    return rows.sort((a, b) => b.hiddenAtMs - a.hiddenAtMs);
  }

  public async listAllPackets(): Promise<StoredPacketRecord[]> {
    const db = await this.open();
    const tx = db.transaction(STORE_PACKETS, "readonly");
    const rows = (await awaitRequest(
      tx.objectStore(STORE_PACKETS).getAll()
    )) as StoredPacketRecord[];
    await awaitTransaction(tx);

    return rows
      .map(normalizePacketRecord)
      .sort((a, b) => b.storedAtMs - a.storedAtMs || b.seq - a.seq);
  }

  public async listPacketsByCommunity(
    communityId: string,
    universe?: DocUniverse
  ): Promise<StoredPacketRecord[]> {
    const db = await this.open();
    const tx = db.transaction(STORE_PACKETS, "readonly");
    const idx = tx.objectStore(STORE_PACKETS).index("by_community");
    const rows = (await awaitRequest(idx.getAll(communityId))) as StoredPacketRecord[];
    await awaitTransaction(tx);

    return rows
      .filter((r) => universe === undefined || r.universe === universe)
      .map(normalizePacketRecord)
      .sort((a, b) => a.storedAtMs - b.storedAtMs || a.seq - b.seq);
  }

  public async getNextSeq(communityId: string, authorPubHex: string): Promise<number> {
    const packets = await this.listPacketsByCommunity(communityId);
    let maxSeq = 0;
    for (const p of packets) {
      if (p.authorPubHex === authorPubHex && p.seq > maxSeq) {
        maxSeq = p.seq;
      }
    }
    return maxSeq + 1;
  }

  private async upsertCompactedChatFile(
    communityId: string,
    subjectScope: string,
    incomingPackets: readonly Uint8Array[],
    nowMs: number
  ): Promise<StoredChatFileRecord> {
    const existing = await this.getChatFile(subjectScope);
    const existingPackets = existing ? decodeChatFile(existing.rawChatBytes) : [];
    const compacted = await compactChatPackets([...existingPackets, ...incomingPackets]);
    const record: StoredChatFileRecord = {
      subjectScope,
      communityId,
      rawChatBytes: encodeChatFile(compacted.packets),
      messageCount: compacted.messageCount,
      activeDraftCount: compacted.activeDraftCount,
      updatedAtMs: nowMs,
    };

    const db = await this.open();
    const tx = db.transaction(STORE_CHAT_FILES, "readwrite");
    await awaitRequest(tx.objectStore(STORE_CHAT_FILES).put(record));
    await awaitTransaction(tx);
    return normalizeChatFileRecord(record);
  }

  public async ingestChatPacket(
    communityId: string,
    rawPacket: Uint8Array,
    nowMs = Date.now()
  ): Promise<{
    readonly subjectScope: string;
    readonly docIdHex: string;
    readonly messageCount: number;
    readonly activeDraftCount: number;
  }> {
    const doc = await unpackAndVerifyDocument(rawPacket);
    if (getDocumentUniverse(doc) !== "chat") {
      throw new Error("Pacote não pertence ao universo .chat.");
    }
    const scopeBlock = doc.blocks.find((b) => b.tag === Tag.SCOPE);
    if (!scopeBlock) {
      throw new Error("Pacote .chat inválido: tag SCOPE (1) ausente.");
    }
    const subjectScope = readUtf8Block(scopeBlock);
    const docIdHex = bytesToHex(calculateDocId(rawPacket));
    const saved = await this.upsertCompactedChatFile(
      communityId,
      subjectScope,
      [rawPacket],
      nowMs
    );

    return {
      subjectScope,
      docIdHex,
      messageCount: saved.messageCount,
      activeDraftCount: saved.activeDraftCount,
    };
  }

  public async ingestChatPacketsBatch(
    communityId: string,
    rawPackets: readonly Uint8Array[],
    nowMs = Date.now()
  ): Promise<void> {
    if (rawPackets.length === 0) {
      return;
    }
    const byScope = new Map<string, Uint8Array[]>();
    for (const rawPacket of rawPackets) {
      const doc = await unpackAndVerifyDocument(rawPacket);
      if (getDocumentUniverse(doc) !== "chat") {
        continue;
      }
      const scopeBlock = doc.blocks.find((b) => b.tag === Tag.SCOPE);
      if (!scopeBlock) {
        continue;
      }
      const scope = readUtf8Block(scopeBlock);
      const list = byScope.get(scope);
      if (list) {
        list.push(rawPacket);
      } else {
        byScope.set(scope, [rawPacket]);
      }
    }

    for (const [scope, scopePackets] of byScope.entries()) {
      await this.upsertCompactedChatFile(communityId, scope, scopePackets, nowMs);
    }
  }

  public async getChatFile(subjectScope: string): Promise<StoredChatFileRecord | null> {
    const db = await this.open();
    const tx = db.transaction(STORE_CHAT_FILES, "readonly");
    const row = (await awaitRequest(
      tx.objectStore(STORE_CHAT_FILES).get(subjectScope)
    )) as StoredChatFileRecord | undefined;
    await awaitTransaction(tx);
    return row ? normalizeChatFileRecord(row) : null;
  }

  public async getChatPacketsBySubject(subjectScope: string): Promise<Uint8Array[]> {
    const file = await this.getChatFile(subjectScope);
    if (!file) {
      return [];
    }
    return decodeChatFile(file.rawChatBytes);
  }

  public async listChatFilesByCommunity(
    communityId: string
  ): Promise<StoredChatFileRecord[]> {
    const db = await this.open();
    const tx = db.transaction(STORE_CHAT_FILES, "readonly");
    const idx = tx.objectStore(STORE_CHAT_FILES).index("by_community");
    const rows = (await awaitRequest(idx.getAll(communityId))) as StoredChatFileRecord[];
    await awaitTransaction(tx);
    return rows
      .map(normalizeChatFileRecord)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }

  public async listAllChatFiles(): Promise<StoredChatFileRecord[]> {
    const db = await this.open();
    const tx = db.transaction(STORE_CHAT_FILES, "readonly");
    const rows = (await awaitRequest(
      tx.objectStore(STORE_CHAT_FILES).getAll()
    )) as StoredChatFileRecord[];
    await awaitTransaction(tx);
    return rows
      .map(normalizeChatFileRecord)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }
}
