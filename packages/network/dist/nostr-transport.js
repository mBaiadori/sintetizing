import { SimplePool } from "nostr-tools";
import { decodeAndVerifyNostrEvent, encodePacketToNostrEvent, SINTETIZE_NOSTR_KIND, } from "./nostr-codec.js";
export const DEFAULT_PUBLIC_NOSTR_RELAYS = [
    "wss://relay.damus.io",
    "wss://nos.lol",
];
/**
 * Sugere o relay NIP-01 local quando rodando em localhost/127.0.0.1/::1.
 */
export function getDefaultLocalRelayUrl(hostname) {
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return `ws://${hostname}:8080`;
    }
    if (hostname === "::1" || hostname === "[::1]") {
        return "ws://[::1]:8080";
    }
    return null;
}
/**
 * Normaliza, valida esquema ws:// ou wss:// e remove duplicatas da lista de relays.
 */
export function normalizeRelayList(relays) {
    const seen = new Set();
    const clean = [];
    for (const item of relays) {
        const trimmed = item.trim().replace(/\/+$/, "");
        if (!trimmed) {
            continue;
        }
        if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
            continue;
        }
        if (!seen.has(trimmed)) {
            seen.add(trimmed);
            clean.push(trimmed);
        }
    }
    return clean;
}
/**
 * Adaptador de rede descentralizada sobre Nostr (nostr-tools SimplePool) — 100% browser-safe.
 */
export class NostrTransport {
    pool = new SimplePool({ enablePing: true, enableReconnect: true });
    activeSubs = new Set();
    async publishPacket(relays, communityId, rawPacket, ed25519PrivateKey) {
        const cleanRelays = normalizeRelayList(relays);
        if (cleanRelays.length === 0) {
            throw new Error("Configure ao menos 1 relay Nostr (ws:// ou wss://) para publicar.");
        }
        const { event, docIdHex, universe } = await encodePacketToNostrEvent(rawPacket, communityId, ed25519PrivateKey);
        const results = await Promise.allSettled(this.pool.publish(cleanRelays, event));
        let acceptedCount = 0;
        const failedRelays = [];
        for (let i = 0; i < results.length; i++) {
            const outcome = results[i];
            const url = cleanRelays[i];
            if (outcome.status === "fulfilled") {
                acceptedCount += 1;
            }
            else {
                const msg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
                failedRelays.push({ url, reason: msg });
            }
        }
        return {
            eventId: event.id,
            docIdHex,
            universe,
            acceptedCount,
            failedRelays,
        };
    }
    subscribeCommunity(options) {
        const cleanRelays = normalizeRelayList(options.relays);
        if (cleanRelays.length === 0) {
            return { close: () => { } };
        }
        const filter = {
            kinds: [SINTETIZE_NOSTR_KIND],
            "#t": [options.communityId],
        };
        if (options.universes && options.universes.length > 0) {
            filter["#u"] = [...options.universes];
        }
        if (options.since !== undefined) {
            filter.since = options.since;
        }
        const deliveredDocIds = new Set(options.knownDocIds);
        let closed = false;
        const params = {
            alreadyHaveEvent: (eventId) => deliveredDocIds.has(eventId),
            onevent: (event) => {
                void (async () => {
                    if (closed) {
                        return;
                    }
                    const decoded = await decodeAndVerifyNostrEvent(event);
                    if (!decoded || decoded.communityId !== options.communityId) {
                        return;
                    }
                    if (deliveredDocIds.has(decoded.docIdHex)) {
                        return;
                    }
                    deliveredDocIds.add(decoded.docIdHex);
                    await options.onPacket(decoded);
                })().catch((err) => {
                    const normalized = err instanceof Error ? err : new Error(String(err));
                    options.onError?.(normalized);
                });
            },
        };
        if (options.onEose) {
            params.oneose = options.onEose;
        }
        if (options.onClose) {
            params.onclose = options.onClose;
        }
        const sub = this.pool.subscribeMany(cleanRelays, filter, params);
        this.activeSubs.add(sub);
        return {
            close: (reason) => {
                closed = true;
                this.activeSubs.delete(sub);
                sub.close(reason);
            },
        };
    }
    destroy() {
        for (const sub of this.activeSubs) {
            sub.close("transport destroyed");
        }
        this.activeSubs.clear();
        this.pool.destroy();
    }
}
//# sourceMappingURL=nostr-transport.js.map