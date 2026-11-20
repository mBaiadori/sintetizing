import { sha256 } from "@noble/hashes/sha256";

/**
 * Utilitário leve e determinístico de Merkle Tree (32 bytes por nó).
 * Permite que comunidades resumam centenas de votos em um único hash de 32 bytes
 * e que moradores gerem provas criptográficas de inclusão.
 */

function hashLeaf(data: Uint8Array): Uint8Array {
  // Se já tem 32 bytes, calcula o hash da folha com prefixo de domínio para evitar colisão folha/nó
  const prefixed = new Uint8Array(1 + data.length);
  prefixed[0] = 0x00; // Prefixo de folha (RFC 6962 standard)
  prefixed.set(data, 1);
  return sha256(prefixed);
}

function hashNode(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new Uint8Array(1 + 32 + 32);
  combined[0] = 0x01; // Prefixo de nó interno
  combined.set(left, 1);
  combined.set(right, 33);
  return sha256(combined);
}

/**
 * Calcula a Raiz Merkle (32 bytes) para uma lista ordenada de itens (Uint8Array).
 */
export function calculateMerkleRoot(items: readonly Uint8Array[]): Uint8Array {
  if (items.length === 0) {
    return new Uint8Array(32); // Raiz vazia de 32 bytes zerados
  }

  let layer: Uint8Array[] = items.map(hashLeaf);

  while (layer.length > 1) {
    const nextLayer: Uint8Array[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = i + 1 < layer.length ? layer[i + 1]! : layer[i]!; // duplica se ímpar
      nextLayer.push(hashNode(left, right));
    }
    layer = nextLayer;
  }

  return layer[0]!;
}

/**
 * Gera uma Prova Merkle de inclusão para o item no índice especificado.
 */
export function generateMerkleProof(
  items: readonly Uint8Array[],
  index: number
): Uint8Array[] {
  if (index < 0 || index >= items.length || !Number.isInteger(index)) {
    throw new Error(`Índice inválido para prova Merkle: ${index}. Total de itens: ${items.length}.`);
  }

  const proof: Uint8Array[] = [];
  let layer: Uint8Array[] = items.map(hashLeaf);
  let currentIndex = index;

  while (layer.length > 1) {
    const isRightChild = currentIndex % 2 === 1;
    const siblingIndex = isRightChild ? currentIndex - 1 : currentIndex + 1;

    if (siblingIndex < layer.length) {
      proof.push(layer[siblingIndex]!);
    } else {
      // Quando é ímpar e o irmão é ele mesmo duplicado
      proof.push(layer[currentIndex]!);
    }

    const nextLayer: Uint8Array[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = i + 1 < layer.length ? layer[i + 1]! : layer[i]!;
      nextLayer.push(hashNode(left, right));
    }

    layer = nextLayer;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return proof;
}

/**
 * Verifica se uma folha pertence à raiz Merkle utilizando sua prova de inclusão.
 */
export function verifyMerkleProof(
  item: Uint8Array,
  proof: readonly Uint8Array[],
  index: number,
  expectedRoot: Uint8Array
): boolean {
  if (expectedRoot.length !== 32) {
    return false;
  }

  let currentHash = hashLeaf(item);
  let currentIndex = index;

  for (const sibling of proof) {
    if (sibling.length !== 32) {
      return false;
    }
    const isRightChild = currentIndex % 2 === 1;
    if (isRightChild) {
      currentHash = hashNode(sibling, currentHash);
    } else {
      currentHash = hashNode(currentHash, sibling);
    }
    currentIndex = Math.floor(currentIndex / 2);
  }

  for (let i = 0; i < 32; i++) {
    if (currentHash[i] !== expectedRoot[i]) {
      return false;
    }
  }

  return true;
}
