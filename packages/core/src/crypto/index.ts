export * from "./canonical.js";
export * from "./keys.js";
export * from "./vrf.js";

import { ICryptoEngine, KeyPair } from "../types/index.js";
import { computeCanonicalHash } from "./canonical.js";
import { derivePersonaId, generateKeyPair, signCanonicalPayload, verifySignature } from "./keys.js";
import { generateVrfProof, verifyVrfProof } from "./vrf.js";

/**
 * Implementação de referência do ICryptoEngine
 */
export class DefaultCryptoEngine implements ICryptoEngine {
  public async generateKeyPair(): Promise<KeyPair> {
    return generateKeyPair();
  }

  public derivePersonaId(publicKeyHex: string): string {
    return derivePersonaId(publicKeyHex);
  }

  public async signCanonicalPayload(privateKeyHex: string, payload: unknown): Promise<string> {
    return signCanonicalPayload(privateKeyHex, payload);
  }

  public async verifySignature(publicKeyHex: string, payload: unknown, signatureHex: string): Promise<boolean> {
    return verifySignature(publicKeyHex, payload, signatureHex);
  }

  public computeCanonicalHash(payload: unknown): string {
    return computeCanonicalHash(payload);
  }

  public async generateVrfProof(privateKeyHex: string, seed: string): Promise<{ proof: string; output: string }> {
    return generateVrfProof(privateKeyHex, seed);
  }

  public async verifyVrfProof(publicKeyHex: string, seed: string, proof: string): Promise<boolean> {
    return verifyVrfProof(publicKeyHex, seed, proof);
  }
}
