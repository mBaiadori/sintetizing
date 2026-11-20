import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

/**
 * Serializa deterministicamente qualquer valor JavaScript seguindo os princípios
 * da RFC 8785 (JSON Canonicalization Scheme - JCS).
 * Chaves de objetos são ordenadas lexicograficamente de forma recursiva.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalStringify(item));
    return `[${items.join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs: string[] = [];

  for (const key of sortedKeys) {
    const val = obj[key];
    if (val !== undefined && typeof val !== "function" && typeof val !== "symbol") {
      pairs.push(`${JSON.stringify(key)}:${canonicalStringify(val)}`);
    }
  }

  return `{${pairs.join(",")}}`;
}

/**
 * Computa o hash SHA-256 determinístico de um payload após serialização canônica.
 * Retorna uma string hexadecimal de 64 caracteres em minúsculas.
 */
export function computeCanonicalHash(payload: unknown): string {
  const canonicalJson = canonicalStringify(payload);
  const encoded = new TextEncoder().encode(canonicalJson);
  const hashBytes = sha256(encoded);
  return bytesToHex(hashBytes);
}
