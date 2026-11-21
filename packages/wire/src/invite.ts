import * as ed25519 from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha256";

/**
 * Tamanho fixo do bloco binário INVITE_PROOF (tag 22):
 * [0..32] inviterPub | [32..40] issuedAtMs | [40..48] expiresAtMs | [48..52] nonce | [52..116] signature
 */
export const INVITE_PROOF_SIZE = 116;

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

function buildInviteDigest(communityId: string, unsignedPrefix: Uint8Array): Uint8Array {
  const prefixBytes = textEncoder.encode(`STZ_INVITE_V1:${communityId}:`);
  const payload = new Uint8Array(prefixBytes.length + unsignedPrefix.length);
  payload.set(prefixBytes, 0);
  payload.set(unsignedPrefix, prefixBytes.length);
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
