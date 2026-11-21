export interface LocalNostrRelayOptions {
    readonly port?: number;
    readonly host?: string;
    readonly dataDir?: string;
    readonly onLog?: (message: string) => void;
}
/**
 * Mini-Relay Nostr NIP-01 local para desenvolvimento offline sem rate-limit.
 * Suporta EVENT, REQ, CLOSE, EOSE e endpoint /health dual-stack (IPv4 + IPv6).
 */
export declare class LocalNostrRelay {
    private readonly port;
    private readonly host;
    private readonly eventsFile;
    private readonly onLog;
    private readonly events;
    private readonly seenPacketHashes;
    private readonly subscriptions;
    private server;
    private wss;
    private boundPort;
    constructor(options?: LocalNostrRelayOptions);
    start(): Promise<number>;
    stop(): Promise<void>;
    private log;
    private insertVerifiedEvent;
    private loadFromDisk;
    private persistEvent;
    private handleHttp;
    private handleWsMessage;
}
//# sourceMappingURL=local-relay.d.ts.map