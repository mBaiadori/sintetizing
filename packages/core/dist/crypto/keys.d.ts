import { KeyPair } from "../types/index.js";
/**
 * Valida se uma string é uma representação hexadecimal válida de 64 caracteres (32 bytes).
 */
export declare function isValidHex64(hex: string): boolean;
/**
 * Valida se uma string é uma representação hexadecimal válida de 128 caracteres (64 bytes).
 */
export declare function isValidHex128(hex: string): boolean;
/**
 * Gera um par de chaves Ed25519 criptograficamente seguro.
 * Retorna chave pública e privada em formato hexadecimal de 64 caracteres.
 */
export declare function generateKeyPair(): Promise<KeyPair>;
/**
 * Deriva deterministicamente o identificador único da Persona (`persona_id`)
 * a partir de sua chave pública Ed25519.
 * Retorna os primeiros 20 bytes (40 caracteres hex) do hash SHA-256 precedidos de '0x'.
 * Exemplo: 0x4f9a882c7d91e4a3b7c2018274659f8c12a0e3d1
 */
export declare function derivePersonaId(publicKeyHex: string): string;
/**
 * Assina um payload qualquer após serialização canônica (RFC 8785) usando Ed25519.
 * Retorna a assinatura em formato hexadecimal de 128 caracteres.
 */
export declare function signCanonicalPayload(privateKeyHex: string, payload: unknown): Promise<string>;
/**
 * Verifica a autenticidade da assinatura Ed25519 de um payload canônico.
 * Retorna true se for válida, false se a assinatura não corresponder à chave pública ou payload.
 */
export declare function verifySignature(publicKeyHex: string, payload: unknown, signatureHex: string): Promise<boolean>;
//# sourceMappingURL=keys.d.ts.map