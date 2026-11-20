/**
 * Tipos e constantes do protocolo binário posicional e fita TLV do Sintetize (.stze).
 */

export const WIRE_CONSTANTS = {
  VERSION: 1,
  HEADER_SIZE: 102,
  AUTHOR_PUB_SIZE: 32,
  SEQ_SIZE: 4,
  SIGNATURE_SIZE: 64,
  TAG_SIZE: 2,
  LENGTH_SIZE: 2,
  MAX_TLV_LENGTH: 65535,
} as const;

export const DocType = {
  PROPOSAL: 1,
  PICK: 2,
  COMMUNITY_PICK: 3,
  EXECUTION: 4,
} as const;

export type DocTypeValue = (typeof DocType)[keyof typeof DocType];

export const Tag = {
  SCOPE: 1,
  PARENT_HASH: 2,
  TITLE: 10,
  BODY: 11,
  CURRENCY: 12,
  DEADLINE: 13,
  LAW_ARTICLE: 14,
  PICK_TARGET: 20,
} as const;

export type TagValue = (typeof Tag)[keyof typeof Tag] | number;

export interface TLVBlock {
  readonly tag: number;
  readonly value: Uint8Array;
}

export interface BinaryDocument {
  readonly version: number;
  readonly docType: number;
  readonly authorPub: Uint8Array;
  readonly seq: number;
  readonly signature: Uint8Array;
  readonly blocks: readonly TLVBlock[];
}

export interface UnsignedBinaryDocument {
  readonly version?: number;
  readonly docType: number;
  readonly authorPub: Uint8Array;
  readonly seq: number;
  readonly blocks: readonly TLVBlock[];
}

