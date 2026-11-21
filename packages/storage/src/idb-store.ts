import * as ed25519 from "@noble/ed25519";
import { bytesToHex } from "@noble/hashes/utils";
import {
  calculateDocId,
  DocUniverse,
  getDocumentUniverse,
  unpackAndVerifyDocument,
} from "@sintetizing/wire";
import {
  CommunityRecord,
  LocalIdentity,
  LocalStoreOptions,
  SavePacketResult,
  StoredPacketRecord,
} from "./types.js";

const DB_VERSION = 1;
const STORE_IDENTITY = "identity";
const STORE_COMMUNITIES = "communities";
const STORE_PACKETS = "packets";

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
    this.dbName = options?.dbName ?? "sintetize-nostr-v2";
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
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.openingPromise = null;
        resolve(this.db);
      };

      request.onerror = () => {
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
      [STORE_IDENTITY, STORE_COMMUNITIES, STORE_PACKETS],
      "readwrite"
    );
    await Promise.all([
      awaitRequest(tx.objectStore(STORE_IDENTITY).clear()),
      awaitRequest(tx.objectStore(STORE_COMMUNITIES).clear()),
      awaitRequest(tx.objectStore(STORE_PACKETS).clear()),
    ]);
    await awaitTransaction(tx);
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
}
