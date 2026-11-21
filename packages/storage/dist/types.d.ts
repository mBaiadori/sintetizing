import type { DocUniverse } from "@sintetizing/wire";
export interface LocalIdentity {
    readonly id: "self";
    readonly displayName: string;
    readonly publicKey: Uint8Array;
    readonly privateKey: Uint8Array;
    readonly publicKeyHex: string;
    readonly createdAtMs: number;
}
export interface CommunityRecord {
    readonly communityId: string;
    readonly title: string;
    readonly relays: readonly string[];
    readonly createdAtMs: number;
}
export interface StoredPacketRecord {
    readonly docIdHex: string;
    readonly communityId: string;
    readonly universe: DocUniverse;
    readonly docType: number;
    readonly authorPubHex: string;
    readonly seq: number;
    readonly rawBytes: Uint8Array;
    readonly storedAtMs: number;
}
export interface SavePacketResult {
    readonly docIdHex: string;
    readonly universe: DocUniverse;
    readonly isNew: boolean;
}
export interface LocalStoreOptions {
    readonly dbName?: string;
    readonly indexedDB?: IDBFactory;
}
//# sourceMappingURL=types.d.ts.map