export * from "./canonical.js";
export * from "./keys.js";
export * from "./vrf.js";
import { ICryptoEngine, KeyPair } from "../types/index.js";
/**
 * Implementação de referência do ICryptoEngine
 */
export declare class DefaultCryptoEngine implements ICryptoEngine {
    generateKeyPair(): Promise<KeyPair>;
    derivePersonaId(publicKeyHex: string): string;
    signCanonicalPayload(privateKeyHex: string, payload: unknown): Promise<string>;
    verifySignature(publicKeyHex: string, payload: unknown, signatureHex: string): Promise<boolean>;
    computeCanonicalHash(payload: unknown): string;
    generateVrfProof(privateKeyHex: string, seed: string): Promise<{
        proof: string;
        output: string;
    }>;
    verifyVrfProof(publicKeyHex: string, seed: string, proof: string): Promise<boolean>;
}
//# sourceMappingURL=index.d.ts.map