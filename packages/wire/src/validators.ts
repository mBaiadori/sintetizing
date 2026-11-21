import { INVITE_PROOF_SIZE } from "./invite.js";
import {
  ActiveMemberSnapshotRow,
  BinaryDocument,
  ConfigKind,
  ConfigKindValue,
  CosignatureEntry,
  DocType,
  DocUniverse,
  InvitePolicy,
  InvitePolicyValue,
  Tag,
  TLVBlock,
} from "./types.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

const ACTIVE_MEMBER_ROW_SIZE = 40; // 32B pubKey + 8B lastActivityMs
const COSIGNATURE_ROW_SIZE = 96; // 32B pubKey + 64B signature

const DOC_TYPE_NAMES: Readonly<Record<number, string>> = {
  [DocType.CONFIG]: "CONFIG",
  [DocType.PROPOSAL]: "PROPOSAL",
  [DocType.PICK]: "PICK",
  [DocType.COMMUNITY_PICK]: "COMMUNITY_PICK",
  [DocType.EXECUTION]: "EXECUTION",
  [DocType.MEMB_JOIN]: "MEMB_JOIN",
  [DocType.MEMB_LEAVE]: "MEMB_LEAVE",
  [DocType.SNAPSHOT]: "SNAPSHOT",
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

    default:
      throw new Error(`Tipo de documento desconhecido: ${docType}. Esperado 0..7.`);
  }
}

/**
 * Classifica um documento verificado em um dos 4 universos lógicos (.cmnt, .memb, .stze, .snap).
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
