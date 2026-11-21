import { LocalNostrRelay } from "./local-relay.js";
const port = Number(process.env["PORT"] ?? 8080);
const host = process.env["HOST"]?.trim() || undefined;
const dataDir = process.env["DATA_DIR"] ?? "./nostr-relay-data";
const relay = new LocalNostrRelay({
    port,
    ...(host ? { host } : {}),
    dataDir,
    onLog: (msg) => console.log(msg),
});
relay
    .start()
    .then((boundPort) => {
    const label = host ?? "localhost (IPv4+IPv6)";
    console.log(`[sintetize-nostr-relay] ativo em ws://${label}:${boundPort} (health: http://localhost:${boundPort}/health, dados: ${dataDir})`);
})
    .catch((err) => {
    console.error("[sintetize-nostr-relay] erro ao iniciar:", err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map