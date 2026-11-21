import { DocUniverse } from "@sintetizing/wire";
import { CommunityRecord, HiddenDocRecord, LocalIdentity, LocalStoreOptions, ProposalDraftRecord, SavePacketResult, StoredPacketRecord } from "./types.js";
/**
 * Repositório Local-First enxuto em IndexedDB para identidade local,
 * lista de relays por comunidade e armazenamento verificado de pacotes TLV.
 */
export declare class SintetizeLocalStore {
    private readonly dbName;
    private readonly idbFactory;
    private db;
    private openingPromise;
    constructor(options?: LocalStoreOptions);
    open(): Promise<IDBDatabase>;
    close(): void;
    getIdentity(): Promise<LocalIdentity | null>;
    createIdentity(displayName: string, nowMs?: number): Promise<LocalIdentity>;
    updateDisplayName(displayName: string): Promise<LocalIdentity>;
    saveCommunity(record: CommunityRecord): Promise<void>;
    listCommunities(): Promise<CommunityRecord[]>;
    updateCommunityRelays(communityId: string, relays: readonly string[]): Promise<CommunityRecord | null>;
    savePacket(communityId: string, rawBytes: Uint8Array, nowMs?: number): Promise<SavePacketResult>;
    savePacketsBatch(communityId: string, rawPackets: readonly Uint8Array[], nowMs?: number): Promise<{
        savedCount: number;
        skippedCount: number;
    }>;
    clearAll(): Promise<void>;
    saveDraft(draft: ProposalDraftRecord): Promise<void>;
    listDraftsByCommunity(communityId: string): Promise<ProposalDraftRecord[]>;
    deleteDraft(draftId: string): Promise<void>;
    hideDocument(record: HiddenDocRecord): Promise<void>;
    unhideDocument(docIdHex: string): Promise<void>;
    listHiddenByCommunity(communityId: string): Promise<HiddenDocRecord[]>;
    listAllPackets(): Promise<StoredPacketRecord[]>;
    listPacketsByCommunity(communityId: string, universe?: DocUniverse): Promise<StoredPacketRecord[]>;
    getNextSeq(communityId: string, authorPubHex: string): Promise<number>;
}
//# sourceMappingURL=idb-store.d.ts.map