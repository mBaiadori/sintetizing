import { TLVBlock, WIRE_CONSTANTS } from "./types.js";

/**
 * Codifica uma lista de blocos TLV em uma fita de bytes brutos (Uint8Array).
 * Cada bloco é estruturado como:
 * [ TAG: Uint16BE (2B) ][ LENGTH: Uint16BE (2B) ][ VALUE: Uint8Array (LENGTH bytes) ]
 */
export function encodeTLVBlocks(blocks: readonly TLVBlock[]): Uint8Array {
  let totalLength = 0;

  for (const block of blocks) {
    if (block.tag < 0 || block.tag > WIRE_CONSTANTS.MAX_TLV_LENGTH || !Number.isInteger(block.tag)) {
      throw new Error(`Tag inválida: ${block.tag}. Deve estar entre 0 e 65535.`);
    }
    if (block.value.length > WIRE_CONSTANTS.MAX_TLV_LENGTH) {
      throw new Error(
        `Tamanho do bloco (${block.value.length}) excede o limite máximo de ${WIRE_CONSTANTS.MAX_TLV_LENGTH} bytes.`
      );
    }
    totalLength += WIRE_CONSTANTS.TAG_SIZE + WIRE_CONSTANTS.LENGTH_SIZE + block.value.length;
  }

  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);

  let offset = 0;
  for (const block of blocks) {
    view.setUint16(offset, block.tag, false);
    offset += WIRE_CONSTANTS.TAG_SIZE;

    view.setUint16(offset, block.value.length, false);
    offset += WIRE_CONSTANTS.LENGTH_SIZE;

    output.set(block.value, offset);
    offset += block.value.length;
  }

  return output;
}

/**
 * Decodifica uma fita de bytes TLV em uma lista de blocos.
 * Valida a integridade dos cabeçalhos e limites de cada bloco.
 */
export function decodeTLVBlocks(bytes: Uint8Array): TLVBlock[] {
  const blocks: TLVBlock[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  while (offset < bytes.length) {
    const remaining = bytes.length - offset;
    const headerNeeded = WIRE_CONSTANTS.TAG_SIZE + WIRE_CONSTANTS.LENGTH_SIZE;

    if (remaining < headerNeeded) {
      throw new Error(
        `Buffer TLV corrompido ou truncado: restam ${remaining} bytes, esperado pelo menos ${headerNeeded} bytes para cabeçalho TLV.`
      );
    }

    const tag = view.getUint16(offset, false);
    offset += WIRE_CONSTANTS.TAG_SIZE;

    const length = view.getUint16(offset, false);
    offset += WIRE_CONSTANTS.LENGTH_SIZE;

    if (offset + length > bytes.length) {
      throw new Error(
        `Buffer TLV corrompido: bloco com tag ${tag} declara ${length} bytes, mas restam apenas ${bytes.length - offset} bytes.`
      );
    }

    const value = bytes.slice(offset, offset + length);
    offset += length;

    blocks.push({ tag, value });
  }

  return blocks;
}

