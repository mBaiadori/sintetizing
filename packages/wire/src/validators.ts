import { DocType, Tag, TLVBlock } from "./types.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/**
 * Valida os limites estritos de um bloco individual de acordo com sua TAG.
 * Tags desconhecidas são aceitas para preservar compatibilidade futura (forward compatibility).
 */
export function validateBlock(block: TLVBlock): void {
  const { tag, value } = block;

  switch (tag) {
    case Tag.SCOPE: {
      if (value.length < 3 || value.length > 128) {
        throw new Error(
          `Tag SCOPE (1) inválida: tamanho de ${value.length} bytes fora do intervalo [3..128].`
        );
      }
      try {
        textDecoder.decode(value);
      } catch {
        throw new Error("Tag SCOPE (1) deve conter texto UTF-8 válido.");
      }
      break;
    }

    case Tag.PARENT_HASH: {
      if (value.length !== 32) {
        throw new Error(
          `Tag PARENT_HASH (2) inválida: esperado 32 bytes, recebido ${value.length}.`
        );
      }
      break;
    }

    case Tag.TITLE: {
      if (value.length < 5 || value.length > 160) {
        throw new Error(
          `Tag TITLE (10) inválida: tamanho de ${value.length} bytes fora do intervalo [5..160].`
        );
      }
      try {
        textDecoder.decode(value);
      } catch {
        throw new Error("Tag TITLE (10) deve conter texto UTF-8 válido.");
      }
      break;
    }

    case Tag.BODY: {
      if (value.length < 1 || value.length > 4000) {
        throw new Error(
          `Tag BODY (11) inválida: tamanho de ${value.length} bytes fora do intervalo [1..4000].`
        );
      }
      try {
        textDecoder.decode(value);
      } catch {
        throw new Error("Tag BODY (11) deve conter texto UTF-8 válido.");
      }
      break;
    }

    case Tag.CURRENCY: {
      if (value.length < 5) {
        throw new Error(
          `Tag CURRENCY (12) inválida: esperado no mínimo 5 bytes (4B valor + rótulo), recebido ${value.length}.`
        );
      }
      try {
        textDecoder.decode(value.subarray(4));
      } catch {
        throw new Error("Tag CURRENCY (12) deve conter rótulo UTF-8 válido.");
      }
      break;
    }

    case Tag.DEADLINE: {
      if (value.length !== 4) {
        throw new Error(
          `Tag DEADLINE (13) inválida: esperado 4 bytes Uint32BE, recebido ${value.length}.`
        );
      }
      break;
    }

    case Tag.LAW_ARTICLE: {
      if (value.length < 3 || value.length > 2002) {
        throw new Error(
          `Tag LAW_ARTICLE (14) inválida: tamanho de ${value.length} bytes fora do intervalo [3..2002].`
        );
      }
      try {
        textDecoder.decode(value.subarray(2));
      } catch {
        throw new Error("Tag LAW_ARTICLE (14) deve conter texto de artigo UTF-8 válido.");
      }
      break;
    }

    case Tag.PICK_TARGET: {
      if (value.length !== 4 && value.length !== 32) {
        throw new Error(
          `Tag PICK_TARGET (20) inválida: esperado 4 bytes (índice) ou 32 bytes (hash), recebido ${value.length}.`
        );
      }
      break;
    }

    default:
      // Tags desconhecidas são toleradas para compatibilidade futura
      break;
  }
}

/**
 * Valida a coerência estrutural dos blocos em relação ao docType e seq.
 */
export function validateDocumentStructure(
  docType: number,
  seq: number,
  blocks: readonly TLVBlock[]
): void {
  for (const block of blocks) {
    validateBlock(block);
  }

  if (docType === DocType.PROPOSAL) {
    if (seq !== 1) {
      throw new Error(`Documento do tipo PROPOSTA (1) deve ter seq = 1. Recebido: ${seq}.`);
    }
    const hasScope = blocks.some((b) => b.tag === Tag.SCOPE);
    if (!hasScope) {
      throw new Error("Documento do tipo PROPOSTA (1) deve conter obrigatoriamente a tag SCOPE (1).");
    }
    const hasTitle = blocks.some((b) => b.tag === Tag.TITLE);
    if (!hasTitle) {
      throw new Error("Documento do tipo PROPOSTA (1) deve conter obrigatoriamente a tag TITLE (10).");
    }
  } else if (docType === DocType.PICK) {
    if (seq < 1 || !Number.isInteger(seq)) {
      throw new Error(`Documento do tipo PICK (2) deve ter seq >= 1. Recebido: ${seq}.`);
    }
    const pickTargets = blocks.filter((b) => b.tag === Tag.PICK_TARGET);
    if (pickTargets.length !== 1) {
      throw new Error(
        `Documento do tipo PICK (2) deve conter exatamente 1 tag PICK_TARGET (20). Encontrados: ${pickTargets.length}.`
      );
    }
  } else if (docType === DocType.COMMUNITY_PICK || docType === DocType.EXECUTION) {
    if (seq < 1 || !Number.isInteger(seq)) {
      throw new Error(`Documento de tipo ${docType} deve ter seq >= 1. Recebido: ${seq}.`);
    }
  } else {
    throw new Error(`Tipo de documento desconhecido: ${docType}. Esperado 1, 2, 3 ou 4.`);
  }
}

// -------------------------------------------------------------
// Helpers utilitários para criar blocos padronizados
// -------------------------------------------------------------

export function createScopeBlock(scope: string): TLVBlock {
  const bytes = textEncoder.encode(scope);
  return { tag: Tag.SCOPE, value: bytes };
}

export function createParentHashBlock(hash: Uint8Array): TLVBlock {
  if (hash.length !== 32) {
    throw new Error(`Parent hash deve ter exatamente 32 bytes. Recebido: ${hash.length}.`);
  }
  return { tag: Tag.PARENT_HASH, value: new Uint8Array(hash) };
}

export function createTitleBlock(title: string): TLVBlock {
  const bytes = textEncoder.encode(title);
  return { tag: Tag.TITLE, value: bytes };
}

export function createBodyBlock(body: string): TLVBlock {
  const bytes = textEncoder.encode(body);
  return { tag: Tag.BODY, value: bytes };
}

export function createCurrencyBlock(cents: number, label: string): TLVBlock {
  if (cents < 0 || !Number.isInteger(cents) || cents > 0xffffffff) {
    throw new Error(`Valor em centavos inválido: ${cents}.`);
  }
  const labelBytes = textEncoder.encode(label);
  const value = new Uint8Array(4 + labelBytes.length);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  view.setUint32(0, cents, false);
  value.set(labelBytes, 4);
  return { tag: Tag.CURRENCY, value };
}

export function createDeadlineBlock(deadlineTimestampOrSeconds: number): TLVBlock {
  if (
    deadlineTimestampOrSeconds < 0 ||
    !Number.isInteger(deadlineTimestampOrSeconds) ||
    deadlineTimestampOrSeconds > 0xffffffff
  ) {
    throw new Error(`Deadline inválido: ${deadlineTimestampOrSeconds}.`);
  }
  const value = new Uint8Array(4);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  view.setUint32(0, deadlineTimestampOrSeconds, false);
  return { tag: Tag.DEADLINE, value };
}

export function createLawArticleBlock(articleNum: number, text: string): TLVBlock {
  if (articleNum < 1 || articleNum > 0xffff || !Number.isInteger(articleNum)) {
    throw new Error(`Número de artigo inválido: ${articleNum}.`);
  }
  const textBytes = textEncoder.encode(text);
  const value = new Uint8Array(2 + textBytes.length);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  view.setUint16(0, articleNum, false);
  value.set(textBytes, 2);
  return { tag: Tag.LAW_ARTICLE, value };
}

export function createPickTargetBlock(target: number | Uint8Array): TLVBlock {
  if (typeof target === "number") {
    if (target < 0 || !Number.isInteger(target) || target > 0xffffffff) {
      throw new Error(`Target numérico inválido: ${target}.`);
    }
    const value = new Uint8Array(4);
    const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
    view.setUint32(0, target, false);
    return { tag: Tag.PICK_TARGET, value };
  }

  if (target.length !== 32) {
    throw new Error(`Target em hash deve ter 32 bytes. Recebido: ${target.length}.`);
  }
  return { tag: Tag.PICK_TARGET, value: new Uint8Array(target) };
}

// -------------------------------------------------------------
// Helpers utilitários para ler blocos padronizados
// -------------------------------------------------------------

export function readUtf8Block(block: TLVBlock): string {
  return textDecoder.decode(block.value);
}

export function readCurrencyBlock(block: TLVBlock): { cents: number; label: string } {
  if (block.value.length < 5) {
    throw new Error("Bloco de moeda corrompido: tamanho menor que 5 bytes.");
  }
  const view = new DataView(block.value.buffer, block.value.byteOffset, block.value.byteLength);
  const cents = view.getUint32(0, false);
  const label = textDecoder.decode(block.value.subarray(4));
  return { cents, label };
}

export function readLawArticleBlock(block: TLVBlock): { articleNum: number; text: string } {
  if (block.value.length < 3) {
    throw new Error("Bloco de artigo corrompido: tamanho menor que 3 bytes.");
  }
  const view = new DataView(block.value.buffer, block.value.byteOffset, block.value.byteLength);
  const articleNum = view.getUint16(0, false);
  const text = textDecoder.decode(block.value.subarray(2));
  return { articleNum, text };
}

export function readPickTargetBlock(block: TLVBlock): { targetSeq?: number; targetHash?: Uint8Array } {
  if (block.value.length === 4) {
    const view = new DataView(block.value.buffer, block.value.byteOffset, block.value.byteLength);
    return { targetSeq: view.getUint32(0, false) };
  }
  if (block.value.length === 32) {
    return { targetHash: block.value.slice() };
  }
  throw new Error("Bloco PICK_TARGET corrompido: tamanho diferente de 4 e 32 bytes.");
}

