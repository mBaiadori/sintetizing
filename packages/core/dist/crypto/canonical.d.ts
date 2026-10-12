/**
 * Serializa deterministicamente qualquer valor JavaScript seguindo os princípios
 * da RFC 8785 (JSON Canonicalization Scheme - JCS).
 * Chaves de objetos são ordenadas lexicograficamente de forma recursiva.
 */
export declare function canonicalStringify(value: unknown): string;
/**
 * Computa o hash SHA-256 determinístico de um payload após serialização canônica.
 * Retorna uma string hexadecimal de 64 caracteres em minúsculas.
 */
export declare function computeCanonicalHash(payload: unknown): string;
//# sourceMappingURL=canonical.d.ts.map