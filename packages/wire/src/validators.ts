import { INVITE_PROOF_SIZE } from "./invite.js";
import {
  ActiveMemberSnapshotRow,
  BinaryDocument,
  ConfigKind,
  ConfigKindValue,
  CosignatureEntry,
  DeliberationMode,
  DeliberationModeValue,
  DocType,
  DocUniverse,
  DraftStatus,
  DraftStatusValue,
  InvitePolicy,
  InvitePolicyValue,
  StructuredLinkField,
  StructuredSubtitleField,
  StructuredTableField,
  StructuredTextField,
  StructuredValueField,
  Tag,
  TLVBlock,
} from "./types.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

const ACTIVE_MEMBER_ROW_SIZE = 40; // 32B pubKey + 8B lastActivityMs
const COSIGNATURE_ROW_SIZE = 96; // 32B pubKey + 64B signature
const MAX_FIELD_ID_BYTES = 32;
const MAX_FIELD_LABEL_BYTES = 120;
const MAX_SUBTITLE_LABEL_BYTES = 160;
const MAX_FIELD_TEXT_BYTES = 4000;
const MAX_VALUE_UNIT_BYTES = 16;
const MIN_LINK_URL_BYTES = 8;
const MAX_LINK_URL_BYTES = 1024;
const MAX_TABLE_COLS = 12;
const MAX_TABLE_ROWS = 200;
const MAX_TABLE_CELL_BYTES = 500;
const MAX_TABLE_BLOCK_BYTES = 16384;

const DOC_TYPE_NAMES: Readonly<Record<number, string>> = {
  [DocType.CONFIG]: "CONFIG",
  [DocType.PROPOSAL]: "PROPOSAL",
  [DocType.PICK]: "PICK",
  [DocType.COMMUNITY_PICK]: "COMMUNITY_PICK",
  [DocType.EXECUTION]: "EXECUTION",
  [DocType.MEMB_JOIN]: "MEMB_JOIN",
  [DocType.MEMB_LEAVE]: "MEMB_LEAVE",
  [DocType.SNAPSHOT]: "SNAPSHOT",
  [DocType.CHAT_MESSAGE]: "CHAT_MESSAGE",
  [DocType.CHAT_DRAFT]: "CHAT_DRAFT",
};

function validateUtf8Range(value: Uint8Array, label: string, min: number, max: number): void {
  if (value.length < min || value.length > max) {
    throw new Error(
      `Tag ${label} inválida: tamanho de ${value.length} bytes fora do intervalo [${min}..${max}].`
    );
  }
  try {
    textDecoder.decode(value);
  } catch {
    throw new Error(`Tag ${label} deve conter texto UTF-8 válido.`);
  }
}

function assertExactBytes(value: Uint8Array, expected: number, label: string): void {
  if (value.length !== expected) {
    throw new Error(`Tag ${label} inválida: esperado ${expected} bytes, recebido ${value.length}.`);
  }
}

/**
 * Valida os limites estritos de um bloco individual de acordo com sua TAG.
 * Tags desconhecidas são toleradas para compatibilidade futura (forward compatibility).
 */
export function validateBlock(block: TLVBlock): void {
  const { tag, value } = block;

  switch (tag) {
    case Tag.SCOPE:
      validateUtf8Range(value, "SCOPE (1)", 3, 128);
      break;

    case Tag.PARENT_HASH:
      assertExactBytes(value, 32, "PARENT_HASH (2)");
      break;

    case Tag.TIMESTAMP:
      assertExactBytes(value, 8, "TIMESTAMP (3)");
      break;

    case Tag.TITLE:
      validateUtf8Range(value, "TITLE (10)", 5, 160);
      break;

    case Tag.BODY:
      validateUtf8Range(value, "BODY (11)", 1, 4000);
      break;

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

    case Tag.DEADLINE:
      assertExactBytes(value, 4, "DEADLINE (13)");
      break;

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

    case Tag.AUTHOR_NAME:
      validateUtf8Range(value, "AUTHOR_NAME (15)", 1, 64);
      break;

    case Tag.QUORUM_PCT: {
      assertExactBytes(value, 1, "QUORUM_PCT (16)");
      const pct = value[0]!;
      if (pct < 1 || pct > 100) {
        throw new Error(
          `Tag QUORUM_PCT (16) inválida: percentual ${pct} fora do intervalo [1..100].`
        );
      }
      break;
    }

    case Tag.CONFIG_KIND: {
      assertExactBytes(value, 1, "CONFIG_KIND (17)");
      const kind = value[0]!;
      if (
        kind !== ConfigKind.COMMUNITY &&
        kind !== ConfigKind.SUBJECT &&
        kind !== ConfigKind.CATEGORY
      ) {
        throw new Error(
          `Tag CONFIG_KIND (17) inválida: tipo ${kind} desconhecido. Esperado 1 (COMMUNITY), 2 (SUBJECT) ou 3 (CATEGORY).`
        );
      }
      break;
    }

    case Tag.INACTIVITY_DAYS: {
      assertExactBytes(value, 2, "INACTIVITY_DAYS (18)");
      const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
      const days = view.getUint16(0, false);
      if (days < 1 || days > 3650) {
        throw new Error(
          `Tag INACTIVITY_DAYS (18) inválida: valor ${days} fora do intervalo [1..3650].`
        );
      }
      break;
    }

    case Tag.INVITE_POLICY: {
      assertExactBytes(value, 1, "INVITE_POLICY (19)");
      const policy = value[0]!;
      if (policy !== InvitePolicy.ANY_ACTIVE_MEMBER && policy !== InvitePolicy.FOUNDER_ONLY) {
        throw new Error(
          `Tag INVITE_POLICY (19) inválida: política ${policy} desconhecida.`
        );
      }
      break;
    }

    case Tag.PICK_TARGET:
      if (value.length !== 4 && value.length !== 32) {
        throw new Error(
          `Tag PICK_TARGET (20) inválida: esperado 4 bytes (índice) ou 32 bytes (hash), recebido ${value.length}.`
        );
      }
      break;

    case Tag.PARENT_COMMUNITY_HASH:
      assertExactBytes(value, 32, "PARENT_COMMUNITY_HASH (21)");
      break;

    case Tag.INVITE_PROOF:
      assertExactBytes(value, INVITE_PROOF_SIZE, "INVITE_PROOF (22)");
      break;

    case Tag.CATEGORY_HASH:
      assertExactBytes(value, 32, "CATEGORY_HASH (23)");
      break;

    case Tag.DELIBERATION_MODE:
      readDeliberationModeBlock(block);
      break;

    case Tag.FIELD_SUBTITLE:
      readFieldSubtitleBlock(block);
      break;

    case Tag.FIELD_TEXT:
      readFieldTextBlock(block);
      break;

    case Tag.FIELD_VALUE:
      readFieldValueBlock(block);
      break;

    case Tag.FIELD_LINK:
      readFieldLinkBlock(block);
      break;

    case Tag.FIELD_TABLE:
      readFieldTableBlock(block);
      break;

    case Tag.CUTOFF_HASH:
      assertExactBytes(value, 32, "CUTOFF_HASH (30)");
      break;

    case Tag.ACTIVE_CMNT_HASH:
      assertExactBytes(value, 32, "ACTIVE_CMNT_HASH (31)");
      break;

    case Tag.ACTIVE_MEMBERS_TABLE:
      if (value.length === 0 || value.length % ACTIVE_MEMBER_ROW_SIZE !== 0) {
        throw new Error(
          `Tag ACTIVE_MEMBERS_TABLE (32) inválida: esperado múltiplo positivo de ${ACTIVE_MEMBER_ROW_SIZE} bytes, recebido ${value.length}.`
        );
      }
      break;

    case Tag.COSIGNATURES:
      if (value.length === 0 || value.length % COSIGNATURE_ROW_SIZE !== 0) {
        throw new Error(
          `Tag COSIGNATURES (33) inválida: esperado múltiplo positivo de ${COSIGNATURE_ROW_SIZE} bytes, recebido ${value.length}.`
        );
      }
      break;

    case Tag.DRAFT_ID:
      validateUtf8Range(value, "DRAFT_ID (34)", 1, 64);
      break;

    case Tag.DRAFT_STATUS:
      readDraftStatusBlock(block);
      break;

    default:
      break;
  }
}

function assertPositiveSeq(docType: number, seq: number): void {
  if (seq < 1 || !Number.isInteger(seq)) {
    throw new Error(`Documento de tipo ${docType} deve ter seq >= 1. Recebido: ${seq}.`);
  }
}

function assertHasTag(blocks: readonly TLVBlock[], tag: number, msg: string): void {
  if (!blocks.some((b) => b.tag === tag)) {
    throw new Error(msg);
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

  switch (docType) {
    case DocType.CONFIG:
      assertPositiveSeq(docType, seq);
      assertHasTag(blocks, Tag.SCOPE, "Documento CONFIG (0) requer a tag SCOPE (1).");
      assertHasTag(blocks, Tag.TITLE, "Documento CONFIG (0) requer a tag TITLE (10).");
      break;

    case DocType.PROPOSAL:
      if (seq !== 1) {
        throw new Error(`Documento PROPOSTA (1) deve ter seq = 1. Recebido: ${seq}.`);
      }
      assertHasTag(blocks, Tag.SCOPE, "Documento PROPOSTA (1) requer a tag SCOPE (1).");
      assertHasTag(blocks, Tag.TITLE, "Documento PROPOSTA (1) requer a tag TITLE (10).");
      break;

    case DocType.PICK: {
      assertPositiveSeq(docType, seq);
      const targets = blocks.filter((b) => b.tag === Tag.PICK_TARGET);
      if (targets.length !== 1) {
        throw new Error(
          `Documento PICK (2) deve conter exatamente 1 tag PICK_TARGET (20). Encontrados: ${targets.length}.`
        );
      }
      break;
    }

    case DocType.COMMUNITY_PICK:
      assertPositiveSeq(docType, seq);
      assertHasTag(blocks, Tag.SCOPE, "Documento COMMUNITY_PICK (3) requer a tag SCOPE (1).");
      assertHasTag(blocks, Tag.PICK_TARGET, "Documento COMMUNITY_PICK (3) requer a tag PICK_TARGET (20).");
      break;

    case DocType.EXECUTION:
      assertPositiveSeq(docType, seq);
      assertHasTag(blocks, Tag.SCOPE, "Documento EXECUTION (4) requer a tag SCOPE (1).");
      break;

    case DocType.MEMB_JOIN:
      assertPositiveSeq(docType, seq);
      assertHasTag(blocks, Tag.SCOPE, "Documento MEMB_JOIN (5) requer a tag SCOPE (1).");
      assertHasTag(blocks, Tag.INVITE_PROOF, "Documento MEMB_JOIN (5) requer a tag INVITE_PROOF (22).");
      break;

    case DocType.MEMB_LEAVE:
      assertPositiveSeq(docType, seq);
      assertHasTag(blocks, Tag.SCOPE, "Documento MEMB_LEAVE (6) requer a tag SCOPE (1).");
      break;

    case DocType.SNAPSHOT:
      assertPositiveSeq(docType, seq);
      assertHasTag(blocks, Tag.SCOPE, "Documento SNAPSHOT (7) requer a tag SCOPE (1).");
      assertHasTag(blocks, Tag.CUTOFF_HASH, "Documento SNAPSHOT (7) requer a tag CUTOFF_HASH (30).");
      assertHasTag(blocks, Tag.ACTIVE_CMNT_HASH, "Documento SNAPSHOT (7) requer a tag ACTIVE_CMNT_HASH (31).");
      assertHasTag(blocks, Tag.ACTIVE_MEMBERS_TABLE, "Documento SNAPSHOT (7) requer a tag ACTIVE_MEMBERS_TABLE (32).");
      break;

    case DocType.CHAT_MESSAGE:
      assertPositiveSeq(docType, seq);
      assertHasTag(blocks, Tag.SCOPE, "Documento CHAT_MESSAGE (8) requer a tag SCOPE (1).");
      assertHasTag(blocks, Tag.BODY, "Documento CHAT_MESSAGE (8) requer a tag BODY (11).");
      assertHasTag(blocks, Tag.TIMESTAMP, "Documento CHAT_MESSAGE (8) requer a tag TIMESTAMP (3).");
      break;

    case DocType.CHAT_DRAFT: {
      assertPositiveSeq(docType, seq);
      assertHasTag(blocks, Tag.SCOPE, "Documento CHAT_DRAFT (9) requer a tag SCOPE (1).");
      assertHasTag(blocks, Tag.DRAFT_ID, "Documento CHAT_DRAFT (9) requer a tag DRAFT_ID (34).");
      assertHasTag(blocks, Tag.DRAFT_STATUS, "Documento CHAT_DRAFT (9) requer a tag DRAFT_STATUS (35).");
      assertHasTag(blocks, Tag.TIMESTAMP, "Documento CHAT_DRAFT (9) requer a tag TIMESTAMP (3).");
      const statusBlock = blocks.find((b) => b.tag === Tag.DRAFT_STATUS);
      if (statusBlock && readDraftStatusBlock(statusBlock) === DraftStatus.ACTIVE) {
        assertHasTag(blocks, Tag.TITLE, "Documento CHAT_DRAFT (9) ativo requer a tag TITLE (10).");
      }
      break;
    }

    default:
      throw new Error(`Tipo de documento desconhecido: ${docType}. Esperado 0..9.`);
  }
}

/**
 * Classifica um documento verificado em um dos universos lógicos (.cmnt, .memb, .stze, .snap, .chat).
 */
export function getDocumentUniverse(doc: BinaryDocument): DocUniverse {
  switch (doc.docType) {
    case DocType.CONFIG: {
      const kindBlock = doc.blocks.find((b) => b.tag === Tag.CONFIG_KIND);
      const kind = kindBlock ? readConfigKindBlock(kindBlock) : ConfigKind.COMMUNITY;
      if (kind === ConfigKind.SUBJECT || kind === ConfigKind.CATEGORY) {
        return "stze";
      }
      return "cmnt";
    }
    case DocType.MEMB_JOIN:
    case DocType.MEMB_LEAVE:
    case DocType.PICK:
    case DocType.COMMUNITY_PICK:
      return "memb";
    case DocType.SNAPSHOT:
      return "snap";
    case DocType.CHAT_MESSAGE:
    case DocType.CHAT_DRAFT:
      return "chat";
    case DocType.PROPOSAL:
    case DocType.EXECUTION:
    default:
      return "stze";
  }
}

/**
 * Retorna o nome legível de um docType numérico.
 */
export function getDocTypeName(docType: number): string {
  return DOC_TYPE_NAMES[docType] ?? `UNKNOWN(${docType})`;
}

// -------------------------------------------------------------
// Helpers utilitários para criar blocos padronizados
// -------------------------------------------------------------

export function createScopeBlock(scope: string): TLVBlock {
  return { tag: Tag.SCOPE, value: textEncoder.encode(scope) };
}

export function createParentHashBlock(hash: Uint8Array): TLVBlock {
  if (hash.length !== 32) {
    throw new Error(`Parent hash deve ter exatamente 32 bytes. Recebido: ${hash.length}.`);
  }
  return { tag: Tag.PARENT_HASH, value: new Uint8Array(hash) };
}

export function createTimestampBlock(timestampMs: number): TLVBlock {
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0) {
    throw new Error(`Timestamp inválido: ${timestampMs}.`);
  }
  const value = new Uint8Array(8);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  view.setBigUint64(0, BigInt(timestampMs), false);
  return { tag: Tag.TIMESTAMP, value };
}

export function createTitleBlock(title: string): TLVBlock {
  return { tag: Tag.TITLE, value: textEncoder.encode(title) };
}

export function createBodyBlock(body: string): TLVBlock {
  return { tag: Tag.BODY, value: textEncoder.encode(body) };
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

export function createDeadlineBlock(deadlineUnixSeconds: number): TLVBlock {
  if (
    deadlineUnixSeconds < 0 ||
    !Number.isInteger(deadlineUnixSeconds) ||
    deadlineUnixSeconds > 0xffffffff
  ) {
    throw new Error(`Deadline inválido: ${deadlineUnixSeconds}.`);
  }
  const value = new Uint8Array(4);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  view.setUint32(0, deadlineUnixSeconds, false);
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

export function createAuthorNameBlock(name: string): TLVBlock {
  return { tag: Tag.AUTHOR_NAME, value: textEncoder.encode(name) };
}

export function createQuorumPctBlock(pct: number): TLVBlock {
  if (pct < 1 || pct > 100 || !Number.isInteger(pct)) {
    throw new Error(`Percentual de quórum inválido: ${pct}. Esperado inteiro entre 1 e 100.`);
  }
  return { tag: Tag.QUORUM_PCT, value: new Uint8Array([pct]) };
}

export function createConfigKindBlock(kind: ConfigKindValue): TLVBlock {
  if (
    kind !== ConfigKind.COMMUNITY &&
    kind !== ConfigKind.SUBJECT &&
    kind !== ConfigKind.CATEGORY
  ) {
    throw new Error(
      `Tipo de configuração inválido: ${String(kind)}. Esperado 1 (COMMUNITY), 2 (SUBJECT) ou 3 (CATEGORY).`
    );
  }
  return { tag: Tag.CONFIG_KIND, value: new Uint8Array([kind]) };
}

export function createCategoryHashBlock(hash: Uint8Array): TLVBlock {
  if (hash.length !== 32) {
    throw new Error(`CATEGORY_HASH deve ter 32 bytes. Recebido: ${hash.length}.`);
  }
  return { tag: Tag.CATEGORY_HASH, value: new Uint8Array(hash) };
}

export function createInactivityDaysBlock(days: number): TLVBlock {
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new Error(`INACTIVITY_DAYS inválido: ${days}. Esperado inteiro em [1..3650].`);
  }
  const value = new Uint8Array(2);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  view.setUint16(0, days, false);
  return { tag: Tag.INACTIVITY_DAYS, value };
}

export function createInvitePolicyBlock(policy: InvitePolicyValue): TLVBlock {
  if (policy !== InvitePolicy.ANY_ACTIVE_MEMBER && policy !== InvitePolicy.FOUNDER_ONLY) {
    throw new Error(`INVITE_POLICY inválida: ${String(policy)}.`);
  }
  return { tag: Tag.INVITE_POLICY, value: new Uint8Array([policy]) };
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

export function createParentCommunityHashBlock(hash: Uint8Array): TLVBlock {
  if (hash.length !== 32) {
    throw new Error(`PARENT_COMMUNITY_HASH deve ter 32 bytes. Recebido: ${hash.length}.`);
  }
  return { tag: Tag.PARENT_COMMUNITY_HASH, value: new Uint8Array(hash) };
}

export function createInviteProofBlock(proofBytes: Uint8Array): TLVBlock {
  if (proofBytes.length !== INVITE_PROOF_SIZE) {
    throw new Error(
      `INVITE_PROOF deve ter ${INVITE_PROOF_SIZE} bytes. Recebido: ${proofBytes.length}.`
    );
  }
  return { tag: Tag.INVITE_PROOF, value: new Uint8Array(proofBytes) };
}

export function createCutoffHashBlock(hash: Uint8Array): TLVBlock {
  if (hash.length !== 32) {
    throw new Error(`CUTOFF_HASH deve ter 32 bytes. Recebido: ${hash.length}.`);
  }
  return { tag: Tag.CUTOFF_HASH, value: new Uint8Array(hash) };
}

export function createActiveCmntHashBlock(hash: Uint8Array): TLVBlock {
  if (hash.length !== 32) {
    throw new Error(`ACTIVE_CMNT_HASH deve ter 32 bytes. Recebido: ${hash.length}.`);
  }
  return { tag: Tag.ACTIVE_CMNT_HASH, value: new Uint8Array(hash) };
}

export function createActiveMembersTableBlock(
  rows: readonly ActiveMemberSnapshotRow[]
): TLVBlock {
  if (rows.length === 0) {
    throw new Error("ACTIVE_MEMBERS_TABLE exige ao menos 1 membro ativo.");
  }
  const value = new Uint8Array(rows.length * ACTIVE_MEMBER_ROW_SIZE);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.pubKey.length !== 32) {
      throw new Error(`pubKey da linha ${i} deve ter 32 bytes.`);
    }
    if (!Number.isSafeInteger(row.lastActivityMs) || row.lastActivityMs < 0) {
      throw new Error(`lastActivityMs inválido na linha ${i}.`);
    }
    const offset = i * ACTIVE_MEMBER_ROW_SIZE;
    value.set(row.pubKey, offset);
    view.setBigUint64(offset + 32, BigInt(row.lastActivityMs), false);
  }
  return { tag: Tag.ACTIVE_MEMBERS_TABLE, value };
}

export function createCosignaturesBlock(entries: readonly CosignatureEntry[]): TLVBlock {
  if (entries.length === 0) {
    throw new Error("COSIGNATURES exige ao menos 1 assinatura.");
  }
  const value = new Uint8Array(entries.length * COSIGNATURE_ROW_SIZE);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    if (entry.pubKey.length !== 32 || entry.signature.length !== 64) {
      throw new Error(`Co-assinatura ${i} inválida: esperado 32B pubKey + 64B signature.`);
    }
    const offset = i * COSIGNATURE_ROW_SIZE;
    value.set(entry.pubKey, offset);
    value.set(entry.signature, offset + 32);
  }
  return { tag: Tag.COSIGNATURES, value };
}

function decodeStrictUtf8(bytes: Uint8Array, label: string): string {
  try {
    return textDecoder.decode(bytes);
  } catch {
    throw new Error(`Tag ${label} deve conter texto UTF-8 válido.`);
  }
}

function encodeFieldHeader(
  fieldId: string,
  label: string,
  minLabelBytes: number,
  maxLabelBytes: number,
  tagLabel: string
): Uint8Array {
  const idBytes = textEncoder.encode(fieldId.trim());
  if (idBytes.length < 1 || idBytes.length > MAX_FIELD_ID_BYTES) {
    throw new Error(
      `Tag ${tagLabel} inválida: fieldId deve ter entre 1 e ${MAX_FIELD_ID_BYTES} bytes.`
    );
  }
  const labelBytes = textEncoder.encode(label.trim());
  if (labelBytes.length < minLabelBytes || labelBytes.length > maxLabelBytes) {
    throw new Error(
      `Tag ${tagLabel} inválida: rótulo deve ter entre ${minLabelBytes} e ${maxLabelBytes} bytes.`
    );
  }
  const header = new Uint8Array(2 + idBytes.length + labelBytes.length);
  header[0] = idBytes.length;
  header.set(idBytes, 1);
  header[1 + idBytes.length] = labelBytes.length;
  header.set(labelBytes, 2 + idBytes.length);
  return header;
}

function decodeFieldHeader(
  value: Uint8Array,
  tagLabel: string,
  minLabelBytes: number,
  maxLabelBytes: number
): { fieldId: string; label: string; payloadOffset: number } {
  if (value.length < 3) {
    throw new Error(`Tag ${tagLabel} corrompida: cabeçalho de campo truncado.`);
  }
  const idLen = value[0]!;
  if (idLen < 1 || idLen > MAX_FIELD_ID_BYTES || 2 + idLen > value.length) {
    throw new Error(`Tag ${tagLabel} inválida: tamanho de fieldId (${idLen}) fora do intervalo.`);
  }
  const fieldId = decodeStrictUtf8(value.subarray(1, 1 + idLen), tagLabel);
  const labelLenOffset = 1 + idLen;
  const labelLen = value[labelLenOffset]!;
  if (
    labelLen < minLabelBytes ||
    labelLen > maxLabelBytes ||
    labelLenOffset + 1 + labelLen > value.length
  ) {
    throw new Error(
      `Tag ${tagLabel} inválida: tamanho de rótulo (${labelLen}) fora de [${minLabelBytes}..${maxLabelBytes}].`
    );
  }
  const labelStart = labelLenOffset + 1;
  const label = decodeStrictUtf8(value.subarray(labelStart, labelStart + labelLen), tagLabel);
  return {
    fieldId,
    label,
    payloadOffset: labelStart + labelLen,
  };
}

function assertValidLinkUrl(url: string): void {
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    throw new Error("URL do bloco FIELD_LINK deve iniciar com http:// ou https://.");
  }
  if (/[\s\x00-\x1f\x7f]/.test(url)) {
    throw new Error("URL do bloco FIELD_LINK não pode conter espaços ou caracteres de controle.");
  }
}

export function createDeliberationModeBlock(mode: DeliberationModeValue): TLVBlock {
  if (mode !== DeliberationMode.QUORUM && mode !== DeliberationMode.OPEN) {
    throw new Error(`DELIBERATION_MODE inválido: ${String(mode)}.`);
  }
  return { tag: Tag.DELIBERATION_MODE, value: new Uint8Array([mode]) };
}

export function createFieldSubtitleBlock(field: StructuredSubtitleField): TLVBlock {
  const value = encodeFieldHeader(
    field.fieldId,
    field.label,
    1,
    MAX_SUBTITLE_LABEL_BYTES,
    "FIELD_SUBTITLE (25)"
  );
  return { tag: Tag.FIELD_SUBTITLE, value };
}

export function createFieldTextBlock(field: StructuredTextField): TLVBlock {
  const header = encodeFieldHeader(
    field.fieldId,
    field.label,
    0,
    MAX_FIELD_LABEL_BYTES,
    "FIELD_TEXT (26)"
  );
  const textBytes = textEncoder.encode(field.text);
  if (textBytes.length < 1 || textBytes.length > MAX_FIELD_TEXT_BYTES) {
    throw new Error(
      `FIELD_TEXT (26) inválido: texto com ${textBytes.length} bytes fora de [1..${MAX_FIELD_TEXT_BYTES}].`
    );
  }
  const value = new Uint8Array(header.length + textBytes.length);
  value.set(header, 0);
  value.set(textBytes, header.length);
  return { tag: Tag.FIELD_TEXT, value };
}

export function createFieldValueBlock(field: StructuredValueField): TLVBlock {
  if (!Number.isSafeInteger(field.amountCents)) {
    throw new Error(`FIELD_VALUE (27) inválido: amountCents deve ser inteiro seguro.`);
  }
  const header = encodeFieldHeader(
    field.fieldId,
    field.label,
    1,
    MAX_FIELD_LABEL_BYTES,
    "FIELD_VALUE (27)"
  );
  const unitBytes = textEncoder.encode(field.unit.trim());
  if (unitBytes.length < 1 || unitBytes.length > MAX_VALUE_UNIT_BYTES) {
    throw new Error(
      `FIELD_VALUE (27) inválido: unidade com ${unitBytes.length} bytes fora de [1..${MAX_VALUE_UNIT_BYTES}].`
    );
  }
  const value = new Uint8Array(header.length + 9 + unitBytes.length);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  value.set(header, 0);
  view.setBigInt64(header.length, BigInt(field.amountCents), false);
  value[header.length + 8] = unitBytes.length;
  value.set(unitBytes, header.length + 9);
  return { tag: Tag.FIELD_VALUE, value };
}

export function createFieldLinkBlock(field: StructuredLinkField): TLVBlock {
  const header = encodeFieldHeader(
    field.fieldId,
    field.label,
    0,
    MAX_FIELD_LABEL_BYTES,
    "FIELD_LINK (28)"
  );
  const cleanUrl = field.url.trim();
  assertValidLinkUrl(cleanUrl);
  const urlBytes = textEncoder.encode(cleanUrl);
  if (urlBytes.length < MIN_LINK_URL_BYTES || urlBytes.length > MAX_LINK_URL_BYTES) {
    throw new Error(
      `FIELD_LINK (28) inválido: URL com ${urlBytes.length} bytes fora de [${MIN_LINK_URL_BYTES}..${MAX_LINK_URL_BYTES}].`
    );
  }
  const value = new Uint8Array(header.length + urlBytes.length);
  value.set(header, 0);
  value.set(urlBytes, header.length);
  return { tag: Tag.FIELD_LINK, value };
}

export function createFieldTableBlock(field: StructuredTableField): TLVBlock {
  const header = encodeFieldHeader(
    field.fieldId,
    field.label,
    0,
    MAX_FIELD_LABEL_BYTES,
    "FIELD_TABLE (29)"
  );
  const colCount = field.columns.length;
  const rowCount = field.rows.length;
  if (colCount < 1 || colCount > MAX_TABLE_COLS) {
    throw new Error(`FIELD_TABLE (29) inválida: colunas (${colCount}) fora de [1..${MAX_TABLE_COLS}].`);
  }
  if (rowCount < 1 || rowCount > MAX_TABLE_ROWS) {
    throw new Error(`FIELD_TABLE (29) inválida: linhas (${rowCount}) fora de [1..${MAX_TABLE_ROWS}].`);
  }

  const encodedCells: Uint8Array[] = [];
  let cellsByteLength = 0;

  const pushCell = (raw: string) => {
    const bytes = textEncoder.encode(raw);
    if (bytes.length > MAX_TABLE_CELL_BYTES) {
      throw new Error(
        `FIELD_TABLE (29) inválida: célula excede ${MAX_TABLE_CELL_BYTES} bytes.`
      );
    }
    encodedCells.push(bytes);
    cellsByteLength += 2 + bytes.length;
  };

  for (const col of field.columns) {
    pushCell(col);
  }
  for (const row of field.rows) {
    if (row.length !== colCount) {
      throw new Error(
        `FIELD_TABLE (29) inválida: linha com ${row.length} colunas, esperado ${colCount}.`
      );
    }
    for (const cell of row) {
      pushCell(cell);
    }
  }

  const totalLength = header.length + 3 + cellsByteLength;
  if (totalLength > MAX_TABLE_BLOCK_BYTES) {
    throw new Error(
      `FIELD_TABLE (29) inválida: tamanho total (${totalLength}B) excede ${MAX_TABLE_BLOCK_BYTES} bytes.`
    );
  }

  const value = new Uint8Array(totalLength);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  value.set(header, 0);
  let offset = header.length;
  value[offset++] = colCount;
  view.setUint16(offset, rowCount, false);
  offset += 2;

  for (const cellBytes of encodedCells) {
    view.setUint16(offset, cellBytes.length, false);
    offset += 2;
    value.set(cellBytes, offset);
    offset += cellBytes.length;
  }

  return { tag: Tag.FIELD_TABLE, value };
}

// -------------------------------------------------------------
// Helpers utilitários para ler blocos padronizados
// -------------------------------------------------------------

export function readUtf8Block(block: TLVBlock): string {
  return textDecoder.decode(block.value);
}

export function readTimestampBlock(block: TLVBlock): number {
  assertExactBytes(block.value, 8, "TIMESTAMP (3)");
  const view = new DataView(block.value.buffer, block.value.byteOffset, block.value.byteLength);
  return Number(view.getBigUint64(0, false));
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

export function readDeadlineBlock(block: TLVBlock): number {
  assertExactBytes(block.value, 4, "DEADLINE (13)");
  const view = new DataView(block.value.buffer, block.value.byteOffset, block.value.byteLength);
  return view.getUint32(0, false);
}

export function readQuorumPctBlock(block: TLVBlock): number {
  assertExactBytes(block.value, 1, "QUORUM_PCT (16)");
  const pct = block.value[0]!;
  if (pct < 1 || pct > 100) {
    throw new Error(`Bloco QUORUM_PCT corrompido: valor ${pct} fora do intervalo [1..100].`);
  }
  return pct;
}

export function readConfigKindBlock(block: TLVBlock): ConfigKindValue {
  assertExactBytes(block.value, 1, "CONFIG_KIND (17)");
  const kind = block.value[0]!;
  if (
    kind !== ConfigKind.COMMUNITY &&
    kind !== ConfigKind.SUBJECT &&
    kind !== ConfigKind.CATEGORY
  ) {
    throw new Error(`Bloco CONFIG_KIND corrompido: tipo ${kind} inválido.`);
  }
  return kind;
}

export function readInactivityDaysBlock(block: TLVBlock): number {
  assertExactBytes(block.value, 2, "INACTIVITY_DAYS (18)");
  const view = new DataView(block.value.buffer, block.value.byteOffset, block.value.byteLength);
  const days = view.getUint16(0, false);
  if (days < 1 || days > 3650) {
    throw new Error(`Bloco INACTIVITY_DAYS corrompido: valor ${days} fora do intervalo [1..3650].`);
  }
  return days;
}

export function readInvitePolicyBlock(block: TLVBlock): InvitePolicyValue {
  assertExactBytes(block.value, 1, "INVITE_POLICY (19)");
  const policy = block.value[0]!;
  if (policy !== InvitePolicy.ANY_ACTIVE_MEMBER && policy !== InvitePolicy.FOUNDER_ONLY) {
    throw new Error(`Bloco INVITE_POLICY corrompido: política ${policy} inválida.`);
  }
  return policy;
}

export function readActiveMembersTableBlock(block: TLVBlock): ActiveMemberSnapshotRow[] {
  if (block.value.length === 0 || block.value.length % ACTIVE_MEMBER_ROW_SIZE !== 0) {
    throw new Error("Bloco ACTIVE_MEMBERS_TABLE corrompido.");
  }
  const view = new DataView(block.value.buffer, block.value.byteOffset, block.value.byteLength);
  const count = block.value.length / ACTIVE_MEMBER_ROW_SIZE;
  const rows: ActiveMemberSnapshotRow[] = [];
  for (let i = 0; i < count; i++) {
    const offset = i * ACTIVE_MEMBER_ROW_SIZE;
    rows.push({
      pubKey: block.value.slice(offset, offset + 32),
      lastActivityMs: Number(view.getBigUint64(offset + 32, false)),
    });
  }
  return rows;
}

export function readCosignaturesBlock(block: TLVBlock): CosignatureEntry[] {
  if (block.value.length === 0 || block.value.length % COSIGNATURE_ROW_SIZE !== 0) {
    throw new Error("Bloco COSIGNATURES corrompido.");
  }
  const count = block.value.length / COSIGNATURE_ROW_SIZE;
  const entries: CosignatureEntry[] = [];
  for (let i = 0; i < count; i++) {
    const offset = i * COSIGNATURE_ROW_SIZE;
    entries.push({
      pubKey: block.value.slice(offset, offset + 32),
      signature: block.value.slice(offset + 32, offset + 96),
    });
  }
  return entries;
}

export function readDeliberationModeBlock(block: TLVBlock): DeliberationModeValue {
  assertExactBytes(block.value, 1, "DELIBERATION_MODE (24)");
  const mode = block.value[0]!;
  if (mode !== DeliberationMode.QUORUM && mode !== DeliberationMode.OPEN) {
    throw new Error(`Bloco DELIBERATION_MODE corrompido: modo ${mode} inválido.`);
  }
  return mode;
}

export function readFieldSubtitleBlock(block: TLVBlock): StructuredSubtitleField {
  const { fieldId, label, payloadOffset } = decodeFieldHeader(
    block.value,
    "FIELD_SUBTITLE (25)",
    1,
    MAX_SUBTITLE_LABEL_BYTES
  );
  if (payloadOffset !== block.value.length) {
    throw new Error("Bloco FIELD_SUBTITLE (25) contém bytes extras inesperados.");
  }
  return { fieldId, label };
}

export function readFieldTextBlock(block: TLVBlock): StructuredTextField {
  const { fieldId, label, payloadOffset } = decodeFieldHeader(
    block.value,
    "FIELD_TEXT (26)",
    0,
    MAX_FIELD_LABEL_BYTES
  );
  const textBytes = block.value.subarray(payloadOffset);
  if (textBytes.length < 1 || textBytes.length > MAX_FIELD_TEXT_BYTES) {
    throw new Error(
      `Bloco FIELD_TEXT (26) inválido: texto com ${textBytes.length} bytes fora de [1..${MAX_FIELD_TEXT_BYTES}].`
    );
  }
  const text = decodeStrictUtf8(textBytes, "FIELD_TEXT (26)");
  return { fieldId, label, text };
}

export function readFieldValueBlock(block: TLVBlock): StructuredValueField {
  const { fieldId, label, payloadOffset } = decodeFieldHeader(
    block.value,
    "FIELD_VALUE (27)",
    1,
    MAX_FIELD_LABEL_BYTES
  );
  if (block.value.length < payloadOffset + 9) {
    throw new Error("Bloco FIELD_VALUE (27) truncado.");
  }
  const view = new DataView(block.value.buffer, block.value.byteOffset, block.value.byteLength);
  const amountCents = Number(view.getBigInt64(payloadOffset, false));
  if (!Number.isSafeInteger(amountCents)) {
    throw new Error("Bloco FIELD_VALUE (27) inválido: valor fora da faixa segura.");
  }
  const unitLen = block.value[payloadOffset + 8]!;
  if (
    unitLen < 1 ||
    unitLen > MAX_VALUE_UNIT_BYTES ||
    payloadOffset + 9 + unitLen !== block.value.length
  ) {
    throw new Error("Bloco FIELD_VALUE (27) corrompido: unidade com tamanho inválido.");
  }
  const unit = decodeStrictUtf8(block.value.subarray(payloadOffset + 9), "FIELD_VALUE (27)");
  return { fieldId, label, amountCents, unit };
}

export function readFieldLinkBlock(block: TLVBlock): StructuredLinkField {
  const { fieldId, label, payloadOffset } = decodeFieldHeader(
    block.value,
    "FIELD_LINK (28)",
    0,
    MAX_FIELD_LABEL_BYTES
  );
  const urlBytes = block.value.subarray(payloadOffset);
  if (urlBytes.length < MIN_LINK_URL_BYTES || urlBytes.length > MAX_LINK_URL_BYTES) {
    throw new Error(
      `Bloco FIELD_LINK (28) inválido: URL com ${urlBytes.length} bytes fora de [${MIN_LINK_URL_BYTES}..${MAX_LINK_URL_BYTES}].`
    );
  }
  const url = decodeStrictUtf8(urlBytes, "FIELD_LINK (28)");
  assertValidLinkUrl(url);
  return { fieldId, label, url };
}

export function readFieldTableBlock(block: TLVBlock): StructuredTableField {
  if (block.value.length > MAX_TABLE_BLOCK_BYTES) {
    throw new Error(
      `Bloco FIELD_TABLE (29) excede o limite de ${MAX_TABLE_BLOCK_BYTES} bytes.`
    );
  }
  const { fieldId, label, payloadOffset } = decodeFieldHeader(
    block.value,
    "FIELD_TABLE (29)",
    0,
    MAX_FIELD_LABEL_BYTES
  );
  if (block.value.length < payloadOffset + 3) {
    throw new Error("Bloco FIELD_TABLE (29) truncado.");
  }
  const view = new DataView(block.value.buffer, block.value.byteOffset, block.value.byteLength);
  const colCount = block.value[payloadOffset]!;
  const rowCount = view.getUint16(payloadOffset + 1, false);
  if (colCount < 1 || colCount > MAX_TABLE_COLS) {
    throw new Error(`Bloco FIELD_TABLE (29) inválido: colunas (${colCount}).`);
  }
  if (rowCount < 1 || rowCount > MAX_TABLE_ROWS) {
    throw new Error(`Bloco FIELD_TABLE (29) inválido: linhas (${rowCount}).`);
  }

  let offset = payloadOffset + 3;
  const readCell = (): string => {
    if (offset + 2 > block.value.length) {
      throw new Error("Bloco FIELD_TABLE (29) corrompido: cabeçalho de célula truncado.");
    }
    const len = view.getUint16(offset, false);
    offset += 2;
    if (len > MAX_TABLE_CELL_BYTES || offset + len > block.value.length) {
      throw new Error("Bloco FIELD_TABLE (29) corrompido: célula fora dos limites.");
    }
    const text = decodeStrictUtf8(block.value.subarray(offset, offset + len), "FIELD_TABLE (29)");
    offset += len;
    return text;
  };

  const columns: string[] = [];
  for (let c = 0; c < colCount; c += 1) {
    columns.push(readCell());
  }

  const rows: string[][] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const row: string[] = [];
    for (let c = 0; c < colCount; c += 1) {
      row.push(readCell());
    }
    rows.push(row);
  }

  if (offset !== block.value.length) {
    throw new Error("Bloco FIELD_TABLE (29) contém bytes extras inesperados.");
  }

  return { fieldId, label, columns, rows };
}

export function createDraftIdBlock(draftId: string): TLVBlock {
  const bytes = textEncoder.encode(draftId.trim());
  validateUtf8Range(bytes, "DRAFT_ID (34)", 1, 64);
  return { tag: Tag.DRAFT_ID, value: bytes };
}

export function readDraftIdBlock(block: TLVBlock): string {
  validateUtf8Range(block.value, "DRAFT_ID (34)", 1, 64);
  return textDecoder.decode(block.value);
}

export function createDraftStatusBlock(status: DraftStatusValue): TLVBlock {
  if (status !== DraftStatus.ACTIVE && status !== DraftStatus.DELETED) {
    throw new Error(`DRAFT_STATUS inválido: ${String(status)}.`);
  }
  return { tag: Tag.DRAFT_STATUS, value: new Uint8Array([status]) };
}

export function readDraftStatusBlock(block: TLVBlock): DraftStatusValue {
  assertExactBytes(block.value, 1, "DRAFT_STATUS (35)");
  const status = block.value[0]!;
  if (status !== DraftStatus.ACTIVE && status !== DraftStatus.DELETED) {
    throw new Error(`Bloco DRAFT_STATUS corrompido: valor ${status} inválido.`);
  }
  return status;
}
