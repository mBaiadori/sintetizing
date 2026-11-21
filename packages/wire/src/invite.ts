import * as ed25519 from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha256";

/**
 * Tamanho fixo do bloco binário INVITE_PROOF (tag 22):
 * [0..32] inviterPub | [32..40] issuedAtMs | [40..48] expiresAtMs | [48..52] nonce | [52..116] signature
 */
export const INVITE_PROOF_SIZE = 116;

/**
 * Tamanho fixo do bloco binário INVITE_ENDORSEMENT (tag 36):
 * [0..32] endorserPub | [32..96] signature
 */
export const INVITE_ENDORSEMENT_SIZE = 96;

const INVITE_HEADER_SIZE = 52;
const textEncoder = new TextEncoder();

export interface ParsedInviteProof {
  readonly inviterPub: Uint8Array;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly nonce: number;
  readonly signature: Uint8Array;
}

export interface CreateSignedInviteInput {
  readonly communityId: string;
  readonly inviterPub: Uint8Array;
  readonly inviterPrivateKey: Uint8Array;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly nonce: number;
}

export interface ParsedInviteEndorsement {
  readonly endorserPub: Uint8Array;
  readonly signature: Uint8Array;
}

export interface EndorseSignedInviteInput {
  readonly communityId: string;
  readonly proofBytes: Uint8Array;
  readonly endorserPub: Uint8Array;
  readonly endorserPrivateKey: Uint8Array;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function buildInviteDigest(communityId: string, unsignedPrefix: Uint8Array): Uint8Array {
  const prefixBytes = textEncoder.encode(`STZ_INVITE_V1:${communityId}:`);
  const payload = new Uint8Array(prefixBytes.length + unsignedPrefix.length);
  payload.set(prefixBytes, 0);
  payload.set(unsignedPrefix, prefixBytes.length);
  return sha256(payload);
}

function buildEndorsementDigest(communityId: string, proofBytes: Uint8Array): Uint8Array {
  const prefixBytes = textEncoder.encode(`STZ_INVITE_ENDORSE_V1:${communityId}:`);
  const payload = new Uint8Array(prefixBytes.length + proofBytes.length);
  payload.set(prefixBytes, 0);
  payload.set(proofBytes, prefixBytes.length);
  return sha256(payload);
}

function assertValidTimestampMs(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} inválido: esperado inteiro positivo em milissegundos.`);
  }
}

/**
 * Cria e assina uma credencial binária de convite (116 bytes) para entrada em comunidade (.memb).
 */
export async function createSignedInvite(input: CreateSignedInviteInput): Promise<Uint8Array> {
  if (input.communityId.length < 3 || input.communityId.length > 128) {
    throw new Error(`communityId inválido no convite: tamanho ${input.communityId.length} fora de [3..128].`);
  }
  if (input.inviterPub.length !== 32) {
    throw new Error(`inviterPub deve ter 32 bytes. Recebido: ${input.inviterPub.length}.`);
  }
  if (input.inviterPrivateKey.length !== 32) {
    throw new Error(`inviterPrivateKey deve ter 32 bytes. Recebido: ${input.inviterPrivateKey.length}.`);
  }
  assertValidTimestampMs(input.issuedAtMs, "issuedAtMs");
  assertValidTimestampMs(input.expiresAtMs, "expiresAtMs");
  if (input.expiresAtMs < input.issuedAtMs) {
    throw new Error("expiresAtMs não pode ser anterior a issuedAtMs.");
  }
  if (!Number.isInteger(input.nonce) || input.nonce < 0 || input.nonce > 0xffffffff) {
    throw new Error(`nonce inválido no convite: ${input.nonce}.`);
  }

  const out = new Uint8Array(INVITE_PROOF_SIZE);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

  out.set(input.inviterPub, 0);
  view.setBigUint64(32, BigInt(input.issuedAtMs), false);
  view.setBigUint64(40, BigInt(input.expiresAtMs), false);
  view.setUint32(48, input.nonce, false);

  const digest = buildInviteDigest(input.communityId, out.subarray(0, INVITE_HEADER_SIZE));
  const signature = await ed25519.signAsync(digest, input.inviterPrivateKey);
  out.set(signature, INVITE_HEADER_SIZE);

  return out;
}

/**
 * Decodifica os campos estruturais de uma credencial binária de convite de 116 bytes.
 */
export function parseInviteProof(bytes: Uint8Array): ParsedInviteProof {
  if (bytes.length !== INVITE_PROOF_SIZE) {
    throw new Error(
      `INVITE_PROOF inválido: esperado exatamente ${INVITE_PROOF_SIZE} bytes, recebido ${bytes.length}.`
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    inviterPub: bytes.slice(0, 32),
    issuedAtMs: Number(view.getBigUint64(32, false)),
    expiresAtMs: Number(view.getBigUint64(40, false)),
    nonce: view.getUint32(48, false),
    signature: bytes.slice(52, 116),
  };
}

/**
 * Verifica a assinatura Ed25519 de uma credencial de convite para o communityId informado.
 */
export async function verifyInviteProof(
  communityId: string,
  bytes: Uint8Array
): Promise<ParsedInviteProof | null> {
  if (bytes.length !== INVITE_PROOF_SIZE) {
    return null;
  }
  const parsed = parseInviteProof(bytes);
  const digest = buildInviteDigest(communityId, bytes.subarray(0, INVITE_HEADER_SIZE));
  const valid = await ed25519.verifyAsync(parsed.signature, digest, parsed.inviterPub);
  return valid ? parsed : null;
}

/**
 * Co-assina (endossa) uma credencial binária INVITE_PROOF existente (116B),
 * produzindo uma credencial INVITE_ENDORSEMENT de 96 bytes vinculada ao communityId e ao convite.
 */
export async function endorseSignedInvite(
  input: EndorseSignedInviteInput
): Promise<Uint8Array> {
  if (input.communityId.length < 3 || input.communityId.length > 128) {
    throw new Error(
      `communityId inválido no endosso: tamanho ${input.communityId.length} fora de [3..128].`
    );
  }
  if (input.endorserPub.length !== 32) {
    throw new Error(`endorserPub deve ter 32 bytes. Recebido: ${input.endorserPub.length}.`);
  }
  if (input.endorserPrivateKey.length !== 32) {
    throw new Error(
      `endorserPrivateKey deve ter 32 bytes. Recebido: ${input.endorserPrivateKey.length}.`
    );
  }

  const parsedProof = await verifyInviteProof(input.communityId, input.proofBytes);
  if (!parsedProof) {
    throw new Error("INVITE_PROOF inválido ou incompatível com a comunidade informada.");
  }
  if (bytesEqual(parsedProof.inviterPub, input.endorserPub)) {
    throw new Error("O endossante do convite deve ser um membro distinto do padrinho.");
  }

  const digest = buildEndorsementDigest(input.communityId, input.proofBytes);
  const signature = await ed25519.signAsync(digest, input.endorserPrivateKey);

  const out = new Uint8Array(INVITE_ENDORSEMENT_SIZE);
  out.set(input.endorserPub, 0);
  out.set(signature, 32);
  return out;
}

/**
 * Decodifica os campos estruturais de uma co-assinatura de convite de 96 bytes.
 */
export function parseInviteEndorsement(bytes: Uint8Array): ParsedInviteEndorsement {
  if (bytes.length !== INVITE_ENDORSEMENT_SIZE) {
    throw new Error(
      `INVITE_ENDORSEMENT inválido: esperado exatamente ${INVITE_ENDORSEMENT_SIZE} bytes, recebido ${bytes.length}.`
    );
  }
  return {
    endorserPub: bytes.slice(0, 32),
    signature: bytes.slice(32, 96),
  };
}

/**
 * Verifica a assinatura Ed25519 de uma co-assinatura (endosso) vinculada a um INVITE_PROOF e communityId.
 */
export async function verifyInviteEndorsement(
  communityId: string,
  proofBytes: Uint8Array,
  endorsementBytes: Uint8Array
): Promise<ParsedInviteEndorsement | null> {
  if (
    proofBytes.length !== INVITE_PROOF_SIZE ||
    endorsementBytes.length !== INVITE_ENDORSEMENT_SIZE
  ) {
    return null;
  }
  const parsedProof = parseInviteProof(proofBytes);
  const parsedEndorsement = parseInviteEndorsement(endorsementBytes);
  if (bytesEqual(parsedProof.inviterPub, parsedEndorsement.endorserPub)) {
    return null;
  }
  const digest = buildEndorsementDigest(communityId, proofBytes);
  const valid = await ed25519.verifyAsync(
    parsedEndorsement.signature,
    digest,
    parsedEndorsement.endorserPub
  );
  return valid ? parsedEndorsement : null;
}
