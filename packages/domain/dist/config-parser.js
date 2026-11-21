import { bytesToHex } from "@noble/hashes/utils";
import { ConfigKind, readConfigKindBlock, readDeadlineBlock, readQuorumPctBlock, readUtf8Block, Tag, } from "@sintetizing/wire";
/**
 * Extrai de forma pura os parâmetros de governança de um pacote DocType.CONFIG (.stze).
 */
export function parseStoredConfig(stored) {
    let scope = "";
    let title = "";
    const bodyParts = [];
    let deadlineUnixSeconds = null;
    let quorumTargetPct = 60;
    let kind = ConfigKind.SUBJECT;
    let authorName = null;
    for (const block of stored.doc.blocks) {
        switch (block.tag) {
            case Tag.SCOPE:
                scope = readUtf8Block(block);
                break;
            case Tag.TITLE:
                title = readUtf8Block(block);
                break;
            case Tag.BODY:
                bodyParts.push(readUtf8Block(block));
                break;
            case Tag.DEADLINE:
                deadlineUnixSeconds = readDeadlineBlock(block);
                break;
            case Tag.QUORUM_PCT:
                quorumTargetPct = readQuorumPctBlock(block);
                break;
            case Tag.CONFIG_KIND:
                kind = readConfigKindBlock(block);
                break;
            case Tag.AUTHOR_NAME:
                authorName = readUtf8Block(block);
                break;
            default:
                break;
        }
    }
    return {
        docIdHex: stored.docIdHex,
        seq: stored.doc.seq,
        authorPubHex: bytesToHex(stored.doc.authorPub),
        scope,
        title,
        body: bodyParts.join("\n\n"),
        deadlineUnixSeconds,
        quorumTargetPct,
        kind,
        authorName,
    };
}
//# sourceMappingURL=config-parser.js.map