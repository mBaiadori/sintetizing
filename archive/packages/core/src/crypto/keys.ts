import * as ed25519 from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { ProtocolException } from "../types/errors.js";
import { KeyPair } from "../types/index.js";
import { canonicalStringify } from "./canonical.js";

const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;
const HEX_128_REGEX = /^[0-9a-fA-F]{128}$/;

/**
 * Valida se uma string é uma representação hexadecimal válida de 64 caracteres (32 bytes).
 */
export function isValidHex64(hex: string): boolean {
  return HEX_64_REGEX.test(hex);
}

/**
 * Valida se uma string é uma representação hexadecimal válida de 128 caracteres (64 bytes).
 */
export function isValidHex128(hex: string): boolean {
  return HEX_128_REGEX.test(hex);
}

/**
 * Gera um par de chaves Ed25519 criptograficamente seguro.
 * Retorna chave pública e privada em formato hexadecimal de 64 caracteres.
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const privateBytes = ed25519.utils.randomPrivateKey();
  const publicBytes = await ed25519.getPublicKeyAsync(privateBytes);

  return {
    privateKeyHex: bytesToHex(privateBytes),
    publicKeyHex: bytesToHex(publicBytes),
  };
}

/**
 * Deriva deterministicamente o identificador único da Persona (`persona_id`)
 * a partir de sua chave pública Ed25519.
 * Retorna os primeiros 20 bytes (40 caracteres hex) do hash SHA-256 precedidos de '0x'.
 * Exemplo: 0x4f9a882c7d91e4a3b7c2018274659f8c12a0e3d1
 */
export function derivePersonaId(publicKeyHex: string): string {
  if (!isValidHex64(publicKeyHex)) {
    throw new ProtocolException(
      "CRYPTO",
      "ERR_MALFORMED_PUBLIC_KEY",
      "A chave pública fornecida deve ser uma string hexadecimal de 64 caracteres.",
      { publicKeyHex }
    );
  }

  const pubBytes = hexToBytes(publicKeyHex);
  const hash = sha256(pubBytes);
  const hashHex = bytesToHex(hash);
  const address20 = hashHex.slice(0, 40).toLowerCase();
  return `0x${address20}`;
}

/**
 * Assina um payload qualquer após serialização canônica (RFC 8785) usando Ed25519.
 * Retorna a assinatura em formato hexadecimal de 128 caracteres.
 */
export async function signCanonicalPayload(
  privateKeyHex: string,
  payload: unknown
): Promise<string> {
  if (!isValidHex64(privateKeyHex)) {
    throw new ProtocolException(
      "CRYPTO",
      "ERR_INVALID_SIGNATURE",
      "A chave privada fornecida é inválida (deve conter 64 caracteres hexadecimais).",
      { privateKeyHex }
    );
  }

  const canonicalJson = canonicalStringify(payload);
  const messageBytes = new TextEncoder().encode(canonicalJson);
  const privateBytes = hexToBytes(privateKeyHex);
  const signatureBytes = await ed25519.signAsync(messageBytes, privateBytes);

  return bytesToHex(signatureBytes);
}

/**
 * Verifica a autenticidade da assinatura Ed25519 de um payload canônico.
 * Retorna true se for válida, false se a assinatura não corresponder à chave pública ou payload.
 */
export async function verifySignature(
  publicKeyHex: string,
  payload: unknown,
  signatureHex: string
): Promise<boolean> {
  if (!isValidHex64(publicKeyHex) || !isValidHex128(signatureHex)) {
    return false;
  }

  try {
    const canonicalJson = canonicalStringify(payload);
    const messageBytes = new TextEncoder().encode(canonicalJson);
    const publicBytes = hexToBytes(publicKeyHex);
    const signatureBytes = hexToBytes(signatureHex);

    return await ed25519.verifyAsync(signatureBytes, messageBytes, publicBytes);
  } catch {
    return false;
  }
}
