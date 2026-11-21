import { WIRE_CONSTANTS } from "@sintetizing/wire";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import { matchFilters, validateEvent, verifyEvent } from "nostr-tools";
import { WebSocket, WebSocketServer } from "ws";
function sendJson(ws, tuple) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(tuple));
    }
}
function isSignedNostrEvent(candidate) {
    if (!validateEvent(candidate)) {
        return false;
    }
    return ("id" in candidate &&
        typeof candidate.id === "string" &&
        "sig" in candidate &&
        typeof candidate.sig === "string");
}
function findTagValue(event, name) {
    for (const t of event.tags) {
        if (t[0] === name && typeof t[1] === "string") {
            return t[1];
        }
    }
    return null;
}
function getTag(event, name) {
    return findTagValue(event, name) ?? "-";
}
/**
 * Mini-Relay Nostr NIP-01 local para desenvolvimento offline sem rate-limit.
 * Suporta EVENT, REQ, CLOSE, EOSE e endpoint /health dual-stack (IPv4 + IPv6).
 */
export class LocalNostrRelay {
    port;
    host;
    eventsFile;
    onLog;
    events = new Map();
    seenPacketHashes = new Set();
    subscriptions = new Map();
    server = null;
    wss = null;
    boundPort = 0;
    constructor(options) {
        this.port = options?.port ?? 8080;
        this.host = options?.host;
        this.onLog = options?.onLog;
        if (options?.dataDir) {
            if (!existsSync(options.dataDir)) {
                mkdirSync(options.dataDir, { recursive: true });
            }
            this.eventsFile = join(options.dataDir, "nostr-events.jsonl");
            this.loadFromDisk();
        }
        else {
            this.eventsFile = null;
        }
    }
    async start() {
        if (this.server) {
            return this.boundPort;
        }
        const server = http.createServer((req, res) => {
            this.handleHttp(req, res);
        });
        const wss = new WebSocketServer({
            server,
            maxPayload: WIRE_CONSTANTS.MAX_PACKET_SIZE * 2,
        });
        wss.on("connection", (ws, req) => {
            this.subscriptions.set(ws, new Map());
            this.log(`connection ${req.socket.remoteAddress ?? "unknown"} (ativos=${wss.clients.size})`);
            ws.on("message", (data) => {
                this.handleWsMessage(ws, typeof data === "string" ? data : data.toString("utf8"));
            });
            ws.on("close", () => {
                this.subscriptions.delete(ws);
                this.log(`close (ativos=${wss.clients.size})`);
            });
        });
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            const onListen = () => {
                server.off("error", reject);
                resolve();
            };
            if (this.host) {
                server.listen(this.port, this.host, onListen);
            }
            else {
                server.listen(this.port, onListen);
            }
        });
        const address = server.address();
        this.boundPort = typeof address === "object" && address ? address.port : this.port;
        this.server = server;
        this.wss = wss;
        return this.boundPort;
    }
    async stop() {
        if (this.wss) {
            for (const client of this.wss.clients) {
                client.terminate();
            }
            await new Promise((resolve) => {
                this.wss?.close(() => resolve());
            });
            this.wss = null;
        }
        if (this.server) {
            await new Promise((resolve) => {
                this.server?.close(() => resolve());
            });
            this.server = null;
        }
        this.subscriptions.clear();
    }
    log(msg) {
        this.onLog?.(`[nostr-relay] ${msg}`);
    }
    insertVerifiedEvent(candidate) {
        const packetHash = getTag(candidate, "h");
        if (packetHash !== "-" && this.seenPacketHashes.has(packetHash)) {
            return false;
        }
        if (candidate.kind >= 30000 && candidate.kind < 40000) {
            const dTag = findTagValue(candidate, "d");
            if (dTag !== null) {
                for (const [existingId, existing] of this.events.entries()) {
                    if (existing.pubkey === candidate.pubkey &&
                        existing.kind === candidate.kind &&
                        findTagValue(existing, "d") === dTag) {
                        if (existing.created_at > candidate.created_at) {
                            return false;
                        }
                        this.events.delete(existingId);
                        const oldHash = findTagValue(existing, "h");
                        if (oldHash !== null) {
                            this.seenPacketHashes.delete(oldHash);
                        }
                    }
                }
            }
        }
        if (this.events.has(candidate.id)) {
            return false;
        }
        this.events.set(candidate.id, candidate);
        if (packetHash !== "-") {
            this.seenPacketHashes.add(packetHash);
        }
        return true;
    }
    loadFromDisk() {
        if (!this.eventsFile || !existsSync(this.eventsFile)) {
            return;
        }
        const raw = readFileSync(this.eventsFile, "utf8");
        for (const line of raw.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }
            try {
                const parsed = JSON.parse(trimmed);
                if (isSignedNostrEvent(parsed) && verifyEvent(parsed)) {
                    this.insertVerifiedEvent(parsed);
                }
            }
            catch {
                // ignora linha inválida em disco
            }
        }
    }
    persistEvent(event) {
        if (!this.eventsFile) {
            return;
        }
        appendFileSync(this.eventsFile, `${JSON.stringify(event)}\n`, "utf8");
    }
    handleHttp(req, res) {
        if (req.url === "/health") {
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({
                status: "ok",
                protocol: "nostr-nip01",
                events: this.events.size,
                activeConnections: this.wss?.clients.size ?? 0,
            }));
            return;
        }
        res.writeHead(404);
        res.end();
    }
    handleWsMessage(ws, rawText) {
        let parsed;
        try {
            parsed = JSON.parse(rawText);
        }
        catch {
            sendJson(ws, ["NOTICE", "invalid JSON"]);
            return;
        }
        if (!Array.isArray(parsed) || typeof parsed[0] !== "string") {
            sendJson(ws, ["NOTICE", "invalid NIP-01 frame"]);
            return;
        }
        const verb = parsed[0];
        if (verb === "EVENT") {
            const candidate = parsed[1];
            if (!isSignedNostrEvent(candidate) || !verifyEvent(candidate)) {
                const id = typeof candidate === "object" && candidate !== null && "id" in candidate
                    ? String(candidate.id)
                    : "";
                sendJson(ws, ["OK", id, false, "invalid signature or schema"]);
                return;
            }
            const packetHash = getTag(candidate, "h");
            const isNew = this.insertVerifiedEvent(candidate);
            if (isNew) {
                this.persistEvent(candidate);
                this.log(`EVENT kind=${candidate.kind} t=${getTag(candidate, "t")} u=${getTag(candidate, "u")} h=${packetHash.slice(0, 12)}`);
                for (const subMap of this.subscriptions.values()) {
                    for (const sub of subMap.values()) {
                        if (matchFilters(sub.filters, candidate)) {
                            sendJson(sub.ws, ["EVENT", sub.subId, candidate]);
                        }
                    }
                }
            }
            sendJson(ws, ["OK", candidate.id, true, isNew ? "" : "duplicate or superseded"]);
            return;
        }
        if (verb === "REQ" && typeof parsed[1] === "string") {
            const subId = parsed[1];
            const filters = parsed.slice(2).filter((f) => typeof f === "object" && f !== null);
            const subMap = this.subscriptions.get(ws);
            if (!subMap) {
                return;
            }
            subMap.set(subId, { ws, subId, filters });
            const ordered = Array.from(this.events.values()).sort((a, b) => a.created_at - b.created_at);
            let delivered = 0;
            for (const evt of ordered) {
                if (matchFilters(filters, evt)) {
                    sendJson(ws, ["EVENT", subId, evt]);
                    delivered += 1;
                }
            }
            sendJson(ws, ["EOSE", subId]);
            this.log(`REQ sub=${subId} filters=${filters.length} replay=${delivered}`);
            return;
        }
        if (verb === "CLOSE" && typeof parsed[1] === "string") {
            this.subscriptions.get(ws)?.delete(parsed[1]);
        }
    }
}
//# sourceMappingURL=local-relay.js.map