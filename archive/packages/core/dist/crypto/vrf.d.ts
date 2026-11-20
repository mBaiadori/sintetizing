export interface VrfResult {
    proof: string;
    output: string;
}
/**
 * Gera uma prova VRF determinística e sua saída correspondente a partir de uma semente e chave privada Ed25519.
 * Utiliza o modelo determinístico baseado em assinatura Ed25519 + SHA-256.
 */
export declare function generateVrfProof(privateKeyHex: string, seed: string): Promise<VrfResult>;
/**
 * Verifica a validade de uma prova VRF em relação a uma chave pública e semente.
 * Retorna true se a prova for legítima, false caso contrário.
 */
export declare function verifyVrfProof(publicKeyHex: string, seed: string, proof: string): Promise<boolean>;
//# sourceMappingURL=vrf.d.ts.map