import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  calculateDocId,
  DocType,
  DocUniverse,
  getDocumentUniverse,
  INVITE_PROOF_SIZE,
  parseInviteProof,
  readDraftIdBlock,
  readUtf8Block,
  Tag,
  unpackAndVerifyDocument,
  WIRE_CONSTANTS,
} from "@sintetizing/wire";
import {
  type Event,
  finalizeEvent,
  getPublicKey,
  verifyEvent,
} from "nostr-tools";

/**
 * Evento regular (imutável) reservado para pacotes TLV assinados de governança (.cmnt, .memb, .stze, .snap).
 */
export const SINTETIZE_NOSTR_KIND = 4545;

/**
 * Evento regular reservado para mensagens leves de debate (.chat) em assuntos.
 */
export const SINTETIZE_CHAT_NOSTR_KIND = 4546;

/**
 * Evento endereçável/substituível (NIP-33) reservado para rascunhos vivos (.chat) por autor/assunto.
 */
export const SINTETIZE_DRAFT_NOSTR_KIND = 30545;

const INVITE_PREFIX = "stze-inv:";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export interface DecodedNostrPacket {
  readonly eventId: string;
  readonly createdAt: number;
  readonly nostrPubkey: string;
  readonly communityId: string;
  readonly universe: DocUniverse;
  readonly docIdHex: string;
  readonly rawBytes: Uint8Array;
}

export interface EncodedNostrPacket {
  readonly event: Event;
  readonly docIdHex: string;
  readonly universe: DocUniverse;
}

export interface InvitePayload {
  readonly communityId: string;
  readonly proofBytes: Uint8Array;
  readonly relays: readonly string[];
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x4000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]!);
    }
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const mod = padded.length % 4;
  const normalized = mod === 0 ? padded : padded + "=".repeat(4 - mod);
  return base64ToBytes(normalized);
}

/**
 * Deriva deterministicamente uma chave secp256k1 por comunidade para o envelope Nostr,
 * evitando correlação pública entre comunidades enquanto mantém a identidade Ed25519 soberana.
 */
export function deriveNostrSecretKey(
  ed25519PrivateKey: Uint8Array,
  communityId: string
): Uint8Array {
  if (ed25519PrivateKey.length !== 32) {
    throw new Error("ed25519PrivateKey deve ter 32 bytes.");
  }
  const domain = textEncoder.encode(`sintetize:nostr:v1:${communityId}:`);
  const material = new Uint8Array(domain.length + ed25519PrivateKey.length);
  material.set(domain, 0);
  material.set(ed25519PrivateKey, domain.length);
  return sha256(material);
}

/**
 * Empacota um documento binário TLV assinado dentro de um evento Nostr NIP-01.
 */
export async function encodePacketToNostrEvent(
  rawPacket: Uint8Array,
  communityId: string,
  ed25519PrivateKey: Uint8Array
): Promise<EncodedNostrPacket> {
  if (rawPacket.length > WIRE_CONSTANTS.MAX_PACKET_SIZE) {
    throw new Error(`Pacote excede o limite de ${WIRE_CONSTANTS.MAX_PACKET_SIZE} bytes.`);
  }
  const doc = await unpackAndVerifyDocument(rawPacket);
  const docIdHex = bytesToHex(calculateDocId(rawPacket));
  const universe = getDocumentUniverse(doc);

  const nostrSecret = deriveNostrSecretKey(ed25519PrivateKey, communityId);
  const scopeBlock = doc.blocks.find((b) => b.tag === Tag.SCOPE);
  const scope = scopeBlock ? readUtf8Block(scopeBlock) : null;

  let kind = SINTETIZE_NOSTR_KIND;
  let tags: string[][];

  if (doc.docType === DocType.CHAT_DRAFT) {
    const draftIdBlock = doc.blocks.find((b) => b.tag === Tag.DRAFT_ID);
    if (!scope || !draftIdBlock) {
      throw new Error("Pacote CHAT_DRAFT requer SCOPE e DRAFT_ID.");
    }
    const draftId = readDraftIdBlock(draftIdBlock);
    const authorPubHex = bytesToHex(doc.authorPub);
    kind = SINTETIZE_DRAFT_NOSTR_KIND;
    tags = [
      ["d", `${scope}:${authorPubHex}:${draftId}`],
      ["t", communityId],
      ["u", "chat"],
      ["s", scope],
      ["h", docIdHex],
    ];
  } else if (doc.docType === DocType.CHAT_MESSAGE) {
    if (!scope) {
      throw new Error("Pacote CHAT_MESSAGE requer SCOPE.");
    }
    kind = SINTETIZE_CHAT_NOSTR_KIND;
    tags = [
      ["t", communityId],
      ["u", "chat"],
      ["s", scope],
      ["h", docIdHex],
    ];
  } else {
    tags = [
      ["t", communityId],
      ["u", universe],
      ["h", docIdHex],
    ];
  }

  const event = finalizeEvent(
    {
      kind,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: bytesToBase64(rawPacket),
    },
    nostrSecret
  );

  return { event, docIdHex, universe };
}

function getTagValue(event: Event, key: string): string | null {
  for (const tag of event.tags) {
    if (tag[0] === key && typeof tag[1] === "string") {
      return tag[1];
    }
  }
  return null;
}

/**
 * Decodifica e valida um evento Nostr (NIP-01 + teto 100 KB + SHA-256 + Ed25519 + TLV).
 */
export async function decodeAndVerifyNostrEvent(
  event: Event
): Promise<DecodedNostrPacket | null> {
  if (
    event.kind !== SINTETIZE_NOSTR_KIND &&
    event.kind !== SINTETIZE_CHAT_NOSTR_KIND &&
    event.kind !== SINTETIZE_DRAFT_NOSTR_KIND
  ) {
    return null;
  }
  if (!verifyEvent(event)) {
    return null;
  }
  if (event.content.length > WIRE_CONSTANTS.MAX_PACKET_SIZE * 1.5) {
    return null;
  }

  const communityId = getTagValue(event, "t");
  if (!communityId) {
    return null;
  }

  let rawBytes: Uint8Array;
  try {
    rawBytes = base64ToBytes(event.content);
  } catch {
    return null;
  }

  if (rawBytes.length > WIRE_CONSTANTS.MAX_PACKET_SIZE) {
    return null;
  }

  const docIdHex = bytesToHex(calculateDocId(rawBytes));
  const declaredHash = getTagValue(event, "h");
  if (declaredHash && declaredHash !== docIdHex) {
    return null;
  }

  try {
    const doc = await unpackAndVerifyDocument(rawBytes);
    const universe = getDocumentUniverse(doc);
    return {
      eventId: event.id,
      createdAt: event.created_at,
      nostrPubkey: event.pubkey,
      communityId,
      universe,
      docIdHex,
      rawBytes,
    };
  } catch {
    return null;
  }
}

export function deriveNostrPubkeyHex(
  ed25519PrivateKey: Uint8Array,
  communityId: string
): string {
  return getPublicKey(deriveNostrSecretKey(ed25519PrivateKey, communityId));
}

/**
 * Codifica um convite assinado (communityId + 116B INVITE_PROOF + relays) para compartilhamento fácil.
 */
export function encodeInviteCode(input: InvitePayload): string {
  if (input.proofBytes.length !== INVITE_PROOF_SIZE) {
    throw new Error(`proofBytes deve ter exatamente ${INVITE_PROOF_SIZE} bytes.`);
  }
  const payloadJson = JSON.stringify({
    c: input.communityId,
    p: bytesToHex(input.proofBytes),
    r: input.relays,
  });
  return `${INVITE_PREFIX}${bytesToBase64Url(textEncoder.encode(payloadJson))}`;
}

/**
 * Decodifica uma string stze-inv:... validando estrutura e tamanho da prova binária.
 */
export function decodeInviteCode(rawCode: string): InvitePayload {
  const trimmed = rawCode.trim();
  if (!trimmed.startsWith(INVITE_PREFIX)) {
    throw new Error("Código de convite inválido: esperado prefixo 'stze-inv:'.");
  }
  const encoded = trimmed.slice(INVITE_PREFIX.length);
  const jsonBytes = base64UrlToBytes(encoded);
  const parsedUnknown: unknown = JSON.parse(textDecoder.decode(jsonBytes));
  if (typeof parsedUnknown !== "object" || parsedUnknown === null) {
    throw new Error("Convite corrompido: objeto inválido.");
  }

  const record = parsedUnknown as Record<string, unknown>;
  const communityId = record["c"];
  const proofHex = record["p"];
  const relaysRaw = record["r"];

  if (typeof communityId !== "string" || communityId.length < 3 || communityId.length > 128) {
    throw new Error("Convite inválido: communityId ausente ou fora do padrão.");
  }
  if (typeof proofHex !== "string" || proofHex.length !== INVITE_PROOF_SIZE * 2) {
    throw new Error("Convite inválido: prova binária ausente ou com tamanho incorreto.");
  }

  const proofBytes = hexToBytes(proofHex);
  parseInviteProof(proofBytes);

  const relays: string[] = [];
  if (Array.isArray(relaysRaw)) {
    for (const item of relaysRaw) {
      if (typeof item === "string" && (item.startsWith("ws://") || item.startsWith("wss://"))) {
        relays.push(item);
      }
    }
  }

  return { communityId, proofBytes, relays };
}
