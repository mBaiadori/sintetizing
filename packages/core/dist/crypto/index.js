export * from "./canonical.js";
export * from "./keys.js";
export * from "./vrf.js";
import { computeCanonicalHash } from "./canonical.js";
import { derivePersonaId, generateKeyPair, signCanonicalPayload, verifySignature } from "./keys.js";
import { generateVrfProof, verifyVrfProof } from "./vrf.js";
/**
 * Implementação de referência do ICryptoEngine
 */
export class DefaultCryptoEngine {
    async generateKeyPair() {
        return generateKeyPair();
    }
    derivePersonaId(publicKeyHex) {
        return derivePersonaId(publicKeyHex);
    }
    async signCanonicalPayload(privateKeyHex, payload) {
        return signCanonicalPayload(privateKeyHex, payload);
    }
    async verifySignature(publicKeyHex, payload, signatureHex) {
        return verifySignature(publicKeyHex, payload, signatureHex);
    }
    computeCanonicalHash(payload) {
        return computeCanonicalHash(payload);
    }
    async generateVrfProof(privateKeyHex, seed) {
        return generateVrfProof(privateKeyHex, seed);
    }
    async verifyVrfProof(publicKeyHex, seed, proof) {
        return verifyVrfProof(publicKeyHex, seed, proof);
    }
}
//# sourceMappingURL=index.js.map