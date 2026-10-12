import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { ProtocolException } from "../types/errors.js";
import { isValidHex128, isValidHex64, signCanonicalPayload, verifySignature } from "./keys.js";
/**
 * Gera uma prova VRF determinística e sua saída correspondente a partir de uma semente e chave privada Ed25519.
 * Utiliza o modelo determinístico baseado em assinatura Ed25519 + SHA-256.
 */
export async function generateVrfProof(privateKeyHex, seed) {
    if (!isValidHex64(privateKeyHex)) {
        throw new ProtocolException("CRYPTO", "ERR_INVALID_SIGNATURE", "Chave privada inválida para geração de VRF.", { privateKeyHex });
    }
    if (typeof seed !== "string" || seed.length === 0) {
        throw new ProtocolException("CRYPTO", "ERR_INVALID_VRF_PROOF", "A semente fornecida para o VRF não pode ser vazia.", { seed });
    }
    const payload = { vrfSeed: seed };
    const proof = await signCanonicalPayload(privateKeyHex, payload);
    const proofBytes = hexToBytes(proof);
    const outputBytes = sha256(proofBytes);
    const output = bytesToHex(outputBytes);
    return { proof, output };
}
/**
 * Verifica a validade de uma prova VRF em relação a uma chave pública e semente.
 * Retorna true se a prova for legítima, false caso contrário.
 */
export async function verifyVrfProof(publicKeyHex, seed, proof) {
    if (!isValidHex64(publicKeyHex) || !isValidHex128(proof) || typeof seed !== "string" || seed.length === 0) {
        return false;
    }
    const payload = { vrfSeed: seed };
    return verifySignature(publicKeyHex, payload, proof);
}
//# sourceMappingURL=vrf.js.map