import { DocUniverse } from "@sintetizing/wire";
export interface SubscriptionCloser {
    readonly close: (reason?: string) => void;
}
import { DecodedNostrPacket } from "./nostr-codec.js";
export declare const DEFAULT_PUBLIC_NOSTR_RELAYS: readonly ["wss://relay.damus.io", "wss://nos.lol"];
export interface PublishResult {
    readonly eventId: string;
    readonly docIdHex: string;
    readonly universe: DocUniverse;
    readonly acceptedCount: number;
    readonly failedRelays: readonly {
        readonly url: string;
        readonly reason: string;
    }[];
}
export interface SubscribeCommunityOptions {
    readonly relays: readonly string[];
    readonly communityId: string;
    readonly universes?: readonly DocUniverse[];
    readonly since?: number;
    readonly knownDocIds?: ReadonlySet<string>;
    readonly onPacket: (packet: DecodedNostrPacket) => void | Promise<void>;
    readonly onEose?: () => void;
    readonly onClose?: (reasons: {
        url: string;
        reason: string;
    }[]) => void;
    readonly onError?: (err: Error) => void;
}
/**
 * Sugere o relay NIP-01 local quando rodando em localhost/127.0.0.1/::1.
 */
export declare function getDefaultLocalRelayUrl(hostname: string): string | null;
/**
 * Normaliza, valida esquema ws:// ou wss:// e remove duplicatas da lista de relays.
 */
export declare function normalizeRelayList(relays: readonly string[]): string[];
/**
 * Adaptador de rede descentralizada sobre Nostr (nostr-tools SimplePool) — 100% browser-safe.
 */
export declare class NostrTransport {
    private readonly pool;
    private readonly activeSubs;
    publishPacket(relays: readonly string[], communityId: string, rawPacket: Uint8Array, ed25519PrivateKey: Uint8Array): Promise<PublishResult>;
    subscribeCommunity(options: SubscribeCommunityOptions): SubscriptionCloser;
    destroy(): void;
}
//# sourceMappingURL=nostr-transport.d.ts.map