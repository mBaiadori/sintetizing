import * as ed25519 from "@noble/ed25519";
import { bytesToHex } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";

export interface GuardianSignature {
  readonly guardianPub: Uint8Array;
  readonly signature: Uint8Array;
}

export interface SocialRecoveryPacket {
  readonly oldAuthorPub: Uint8Array;
  readonly newAuthorPub: Uint8Array;
  readonly signatures: readonly GuardianSignature[];
}

const textEncoder = new TextEncoder();

/**
 * Monta o payload canônico de atestado que os guardiões do círculo de confiança assinam.
 */
export function buildRecoveryMessage(oldAuthorPub: Uint8Array, newAuthorPub: Uint8Array): Uint8Array {
  const messageStr = `STZ_SOCIAL_RECOVERY:OLD=${bytesToHex(oldAuthorPub)}:NEW=${bytesToHex(newAuthorPub)}`;
  return sha256(textEncoder.encode(messageStr));
}

/**
 * Cria a assinatura de atestado de um guardião aprovando a recuperação de conta do vizinho.
 */
export async function signRecoveryAttestation(
  oldAuthorPub: Uint8Array,
  newAuthorPub: Uint8Array,
  guardianPrivKey: Uint8Array,
  guardianPubKey: Uint8Array
): Promise<GuardianSignature> {
  if (oldAuthorPub.length !== 32 || newAuthorPub.length !== 32) {
    throw new Error("Chaves públicas devem ter 32 bytes.");
  }
  const message = buildRecoveryMessage(oldAuthorPub, newAuthorPub);
  const signature = await ed25519.signAsync(message, guardianPrivKey);
  return {
    guardianPub: new Uint8Array(guardianPubKey),
    signature: new Uint8Array(signature),
  };
}

/**
 * Valida se um pacote de recuperação social atingiu o quórum M-de-N com guardiões autorizados.
 */
export async function verifyRecoveryQuorum(
  packet: SocialRecoveryPacket,
  trustedGuardians: readonly Uint8Array[],
  requiredQuorum: number
): Promise<boolean> {
  if (requiredQuorum <= 0) {
    return false;
  }

  const trustedHexSet = new Set(trustedGuardians.map(bytesToHex));
  const message = buildRecoveryMessage(packet.oldAuthorPub, packet.newAuthorPub);
  const validatedSigners = new Set<string>();

  for (const { guardianPub, signature } of packet.signatures) {
    const pubHex = bytesToHex(guardianPub);
    // Deve ser um guardião confiável cadastrado
    if (!trustedHexSet.has(pubHex)) {
      continue;
    }
    // Evita duplicatas do mesmo guardião
    if (validatedSigners.has(pubHex)) {
      continue;
    }

    const isValid = await ed25519.verifyAsync(signature, message, guardianPub);
    if (isValid) {
      validatedSigners.add(pubHex);
    }
  }

  return validatedSigners.size >= requiredQuorum;
}

