/**
 * Tipos e constantes do envelope binário único (102B + fita TLV)
 * nos quatro universos lógicos do Sintetize: .cmnt, .memb, .stze e .snap.
 */

export const WIRE_CONSTANTS = {
  VERSION: 1,
  HEADER_SIZE: 102,
  AUTHOR_PUB_SIZE: 32,
  SEQ_SIZE: 4,
  SIGNATURE_SIZE: 64,
  TAG_SIZE: 1,
  LENGTH_SIZE: 2,
  MAX_TLV_TAG: 255,
  MAX_TLV_LENGTH: 65535,
  MAX_PACKET_SIZE: 102400,
} as const;

export type DocUniverse = "cmnt" | "memb" | "stze" | "snap";

export const DocType = {
  CONFIG: 0,
  PROPOSAL: 1,
  PICK: 2,
  COMMUNITY_PICK: 3,
  EXECUTION: 4,
  MEMB_JOIN: 5,
  MEMB_LEAVE: 6,
  SNAPSHOT: 7,
} as const;

export type DocTypeValue = (typeof DocType)[keyof typeof DocType];

export const ConfigKind = {
  COMMUNITY: 1,
  SUBJECT: 2,
  CATEGORY: 3,
} as const;

export type ConfigKindValue = (typeof ConfigKind)[keyof typeof ConfigKind];

export const InvitePolicy = {
  ANY_ACTIVE_MEMBER: 1,
  FOUNDER_ONLY: 2,
} as const;

export type InvitePolicyValue = (typeof InvitePolicy)[keyof typeof InvitePolicy];

export const DeliberationMode = {
  QUORUM: 1,
  OPEN: 2,
} as const;

export type DeliberationModeValue = (typeof DeliberationMode)[keyof typeof DeliberationMode];

export const Tag = {
  SCOPE: 1,
  PARENT_HASH: 2,
  TIMESTAMP: 3,
  TITLE: 10,
  BODY: 11,
  CURRENCY: 12,
  DEADLINE: 13,
  LAW_ARTICLE: 14,
  AUTHOR_NAME: 15,
  QUORUM_PCT: 16,
  CONFIG_KIND: 17,
  INACTIVITY_DAYS: 18,
  INVITE_POLICY: 19,
  PICK_TARGET: 20,
  PARENT_COMMUNITY_HASH: 21,
  INVITE_PROOF: 22,
  CATEGORY_HASH: 23,
  DELIBERATION_MODE: 24,
  FIELD_SUBTITLE: 25,
  FIELD_TEXT: 26,
  FIELD_VALUE: 27,
  FIELD_LINK: 28,
  FIELD_TABLE: 29,
  CUTOFF_HASH: 30,
  ACTIVE_CMNT_HASH: 31,
  ACTIVE_MEMBERS_TABLE: 32,
  COSIGNATURES: 33,
} as const;

export type TagValue = (typeof Tag)[keyof typeof Tag] | number;

export interface StructuredSubtitleField {
  readonly fieldId: string;
  readonly label: string;
}

export interface StructuredTextField {
  readonly fieldId: string;
  readonly label: string;
  readonly text: string;
}

export interface StructuredValueField {
  readonly fieldId: string;
  readonly label: string;
  readonly amountCents: number;
  readonly unit: string;
}

export interface StructuredLinkField {
  readonly fieldId: string;
  readonly label: string;
  readonly url: string;
}

export interface StructuredTableField {
  readonly fieldId: string;
  readonly label: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

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

export interface ActiveMemberSnapshotRow {
  readonly pubKey: Uint8Array;
  readonly lastActivityMs: number;
}

export interface CosignatureEntry {
  readonly pubKey: Uint8Array;
  readonly signature: Uint8Array;
}
