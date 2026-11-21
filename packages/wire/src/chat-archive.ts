import { bytesToHex } from "@noble/hashes/utils";
import { calculateDocId, unpackAndVerifyDocument } from "./envelope.js";
import { DocType, DraftStatus, Tag, WIRE_CONSTANTS } from "./types.js";
import {
  getDocumentUniverse,
  readDraftIdBlock,
  readDraftStatusBlock,
  readTimestampBlock,
} from "./validators.js";

const CHAT_ARCHIVE_MAGIC = new Uint8Array([0x53, 0x54, 0x5a, 0x45, 0x43, 0x48, 0x41, 0x54]); // "STZECHAT"
const CHAT_ARCHIVE_VERSION = 1;
const CHAT_ARCHIVE_HEADER_SIZE = 8 + 1 + 4; // magic (8B) + version (1B) + count (4B)

export interface CompactChatResult {
  readonly packets: readonly Uint8Array[];
  readonly messageCount: number;
  readonly activeDraftCount: number;
}

interface IndexedChatEntry {
  readonly rawBytes: Uint8Array;
  readonly docIdHex: string;
  readonly authorPubHex: string;
  readonly docType: number;
  readonly seq: number;
  readonly timestampMs: number;
  readonly draftId: string | null;
  readonly draftStatus: number | null;
}

function compareChatEntries(a: IndexedChatEntry, b: IndexedChatEntry): number {
  if (a.timestampMs !== b.timestampMs) {
    return a.timestampMs - b.timestampMs;
  }
  if (a.seq !== b.seq) {
    return a.seq - b.seq;
  }
  return a.docIdHex.localeCompare(b.docIdHex);
}

function isNewerDraftEntry(candidate: IndexedChatEntry, current: IndexedChatEntry): boolean {
  if (candidate.seq !== current.seq) {
    return candidate.seq > current.seq;
  }
  if (candidate.timestampMs !== current.timestampMs) {
    return candidate.timestampMs > current.timestampMs;
  }
  return candidate.docIdHex > current.docIdHex;
}

/**
 * Serializa uma lista de pacotes TLV do universo .chat em um único arquivo binário compacto.
 * Formato: [STZECHAT (8B)][version=1 (1B)][count Uint32BE (4B)] + [len Uint32BE | rawPacket]...
 */
export function encodeChatFile(packets: readonly Uint8Array[]): Uint8Array {
  let totalLength = CHAT_ARCHIVE_HEADER_SIZE;
  for (const pkt of packets) {
    if (pkt.length > WIRE_CONSTANTS.MAX_PACKET_SIZE) {
      throw new Error(
        `Pacote .chat excede o limite de ${WIRE_CONSTANTS.MAX_PACKET_SIZE} bytes.`
      );
    }
    totalLength += 4 + pkt.length;
  }

  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  out.set(CHAT_ARCHIVE_MAGIC, 0);
  out[8] = CHAT_ARCHIVE_VERSION;
  view.setUint32(9, packets.length, false);

  let offset = CHAT_ARCHIVE_HEADER_SIZE;
  for (const pkt of packets) {
    view.setUint32(offset, pkt.length, false);
    offset += 4;
    out.set(pkt, offset);
    offset += pkt.length;
  }

  return out;
}

/**
 * Decodifica um arquivo binário .chat em seus pacotes TLV individuais.
 */
export function decodeChatFile(fileBytes: Uint8Array): Uint8Array[] {
  if (fileBytes.length === 0) {
    return [];
  }
  if (fileBytes.length < CHAT_ARCHIVE_HEADER_SIZE) {
    throw new Error("Arquivo .chat truncado: cabeçalho incompleto.");
  }
  for (let i = 0; i < CHAT_ARCHIVE_MAGIC.length; i += 1) {
    if (fileBytes[i] !== CHAT_ARCHIVE_MAGIC[i]) {
      throw new Error("Arquivo .chat inválido: assinatura mágica STZECHAT ausente.");
    }
  }
  const version = fileBytes[8]!;
  if (version !== CHAT_ARCHIVE_VERSION) {
    throw new Error(`Versão de arquivo .chat não suportada: ${version}.`);
  }

  const view = new DataView(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength);
  const count = view.getUint32(9, false);
  const packets: Uint8Array[] = [];
  let offset = CHAT_ARCHIVE_HEADER_SIZE;

  for (let i = 0; i < count; i += 1) {
    if (offset + 4 > fileBytes.length) {
      throw new Error("Arquivo .chat corrompido: tamanho de pacote truncado.");
    }
    const pktLen = view.getUint32(offset, false);
    offset += 4;
    if (pktLen > WIRE_CONSTANTS.MAX_PACKET_SIZE || offset + pktLen > fileBytes.length) {
      throw new Error("Arquivo .chat corrompido: pacote fora dos limites.");
    }
    packets.push(fileBytes.slice(offset, offset + pktLen));
    offset += pktLen;
  }

  if (offset !== fileBytes.length) {
    throw new Error("Arquivo .chat corrompido: bytes extras após o último pacote.");
  }

  return packets;
}

/**
 * Compacta pacotes .chat mantendo mensagens únicas ordenadas cronologicamente
 * e apenas a última revisão (maior seq/timestamp) de cada rascunho (authorPub + draftId).
 */
export async function compactChatPackets(
  rawPackets: readonly Uint8Array[]
): Promise<CompactChatResult> {
  const messagesByDocId = new Map<string, IndexedChatEntry>();
  const latestDraftByKey = new Map<string, IndexedChatEntry>();

  for (const rawBytes of rawPackets) {
    let doc;
    try {
      doc = await unpackAndVerifyDocument(rawBytes);
    } catch {
      continue;
    }
    if (getDocumentUniverse(doc) !== "chat") {
      continue;
    }

    const docIdHex = bytesToHex(calculateDocId(rawBytes));
    const authorPubHex = bytesToHex(doc.authorPub);
    const tsBlock = doc.blocks.find((b) => b.tag === Tag.TIMESTAMP);
    const timestampMs = tsBlock ? readTimestampBlock(tsBlock) : 0;

    if (doc.docType === DocType.CHAT_MESSAGE) {
      if (!messagesByDocId.has(docIdHex)) {
        messagesByDocId.set(docIdHex, {
          rawBytes: new Uint8Array(rawBytes),
          docIdHex,
          authorPubHex,
          docType: doc.docType,
          seq: doc.seq,
          timestampMs,
          draftId: null,
          draftStatus: null,
        });
      }
      continue;
    }

    if (doc.docType === DocType.CHAT_DRAFT) {
      const draftIdBlock = doc.blocks.find((b) => b.tag === Tag.DRAFT_ID);
      const statusBlock = doc.blocks.find((b) => b.tag === Tag.DRAFT_STATUS);
      if (!draftIdBlock || !statusBlock) {
        continue;
      }
      const draftId = readDraftIdBlock(draftIdBlock);
      const draftStatus = readDraftStatusBlock(statusBlock);
      const entry: IndexedChatEntry = {
        rawBytes: new Uint8Array(rawBytes),
        docIdHex,
        authorPubHex,
        docType: doc.docType,
        seq: doc.seq,
        timestampMs,
        draftId,
        draftStatus,
      };
      const draftKey = `${authorPubHex}:${draftId}`;
      const existing = latestDraftByKey.get(draftKey);
      if (!existing || isNewerDraftEntry(entry, existing)) {
        latestDraftByKey.set(draftKey, entry);
      }
    }
  }

  const sortedMessages = Array.from(messagesByDocId.values()).sort(compareChatEntries);
  const sortedDrafts = Array.from(latestDraftByKey.values()).sort(compareChatEntries);

  let activeDraftCount = 0;
  for (const d of sortedDrafts) {
    if (d.draftStatus === DraftStatus.ACTIVE) {
      activeDraftCount += 1;
    }
  }

  const packets = [...sortedMessages, ...sortedDrafts].map((e) => e.rawBytes);
  return {
    packets,
    messageCount: sortedMessages.length,
    activeDraftCount,
  };
}
