import { bytesToHex } from "@noble/hashes/utils";
import {
  BinaryDocument,
  calculateDocId,
  ConfigKind,
  DeliberationMode,
  getDocTypeName,
  getDocumentUniverse,
  InvitePolicy,
  parseInviteProof,
  readActiveMembersTableBlock,
  readConfigKindBlock,
  readCosignaturesBlock,
  readCurrencyBlock,
  readDeadlineBlock,
  readDeliberationModeBlock,
  readFieldLinkBlock,
  readFieldSubtitleBlock,
  readFieldTableBlock,
  readFieldTextBlock,
  readFieldValueBlock,
  readInactivityDaysBlock,
  readInvitePolicyBlock,
  readLawArticleBlock,
  readPickTargetBlock,
  readQuorumPctBlock,
  readTimestampBlock,
  readUtf8Block,
  Tag,
  TLVBlock,
  unpackAndVerifyDocument,
} from "@sintetizing/wire";
import { DecodedBlockView, InspectedDocument } from "./types.js";

const TAG_NAMES: Readonly<Record<number, string>> = {
  [Tag.SCOPE]: "SCOPE",
  [Tag.PARENT_HASH]: "PARENT_HASH",
  [Tag.TIMESTAMP]: "TIMESTAMP",
  [Tag.TITLE]: "TITLE",
  [Tag.BODY]: "BODY",
  [Tag.CURRENCY]: "CURRENCY",
  [Tag.DEADLINE]: "DEADLINE",
  [Tag.LAW_ARTICLE]: "LAW_ARTICLE",
  [Tag.AUTHOR_NAME]: "AUTHOR_NAME",
  [Tag.QUORUM_PCT]: "QUORUM_PCT",
  [Tag.CONFIG_KIND]: "CONFIG_KIND",
  [Tag.INACTIVITY_DAYS]: "INACTIVITY_DAYS",
  [Tag.INVITE_POLICY]: "INVITE_POLICY",
  [Tag.PICK_TARGET]: "PICK_TARGET",
  [Tag.PARENT_COMMUNITY_HASH]: "PARENT_COMMUNITY_HASH",
  [Tag.INVITE_PROOF]: "INVITE_PROOF",
  [Tag.CATEGORY_HASH]: "CATEGORY_HASH",
  [Tag.DELIBERATION_MODE]: "DELIBERATION_MODE",
  [Tag.FIELD_SUBTITLE]: "FIELD_SUBTITLE",
  [Tag.FIELD_TEXT]: "FIELD_TEXT",
  [Tag.FIELD_VALUE]: "FIELD_VALUE",
  [Tag.FIELD_LINK]: "FIELD_LINK",
  [Tag.FIELD_TABLE]: "FIELD_TABLE",
  [Tag.CUTOFF_HASH]: "CUTOFF_HASH",
  [Tag.ACTIVE_CMNT_HASH]: "ACTIVE_CMNT_HASH",
  [Tag.ACTIVE_MEMBERS_TABLE]: "ACTIVE_MEMBERS_TABLE",
  [Tag.COSIGNATURES]: "COSIGNATURES",
};

function shortHex(hex: string): string {
  return hex.length > 16 ? `${hex.slice(0, 12)}...${hex.slice(-4)}` : hex;
}

function decodeBlockForDisplay(block: TLVBlock): DecodedBlockView {
  const tagName = TAG_NAMES[block.tag] ?? `TAG_${block.tag}`;
  let displayValue: string;

  switch (block.tag) {
    case Tag.SCOPE:
    case Tag.TITLE:
    case Tag.BODY:
    case Tag.AUTHOR_NAME:
      displayValue = readUtf8Block(block);
      break;

    case Tag.PARENT_HASH:
    case Tag.PARENT_COMMUNITY_HASH:
    case Tag.CATEGORY_HASH:
    case Tag.CUTOFF_HASH:
    case Tag.ACTIVE_CMNT_HASH:
      displayValue = shortHex(bytesToHex(block.value));
      break;

    case Tag.TIMESTAMP: {
      const ms = readTimestampBlock(block);
      displayValue = `${new Date(ms).toISOString()} (${ms})`;
      break;
    }

    case Tag.CURRENCY: {
      const { cents, label } = readCurrencyBlock(block);
      displayValue = `${(cents / 100).toFixed(2)} ${label}`;
      break;
    }

    case Tag.DEADLINE: {
      const unixSec = readDeadlineBlock(block);
      displayValue = new Date(unixSec * 1000).toISOString();
      break;
    }

    case Tag.LAW_ARTICLE: {
      const { articleNum, text } = readLawArticleBlock(block);
      displayValue = `Art. ${articleNum}: ${text}`;
      break;
    }

    case Tag.QUORUM_PCT:
      displayValue = `${readQuorumPctBlock(block)}%`;
      break;

    case Tag.CONFIG_KIND: {
      const kind = readConfigKindBlock(block);
      displayValue =
        kind === ConfigKind.COMMUNITY
          ? "COMMUNITY (1)"
          : kind === ConfigKind.SUBJECT
            ? "SUBJECT (2)"
            : "CATEGORY (3)";
      break;
    }

    case Tag.INACTIVITY_DAYS:
      displayValue = `${readInactivityDaysBlock(block)} dias`;
      break;

    case Tag.INVITE_POLICY: {
      const policy = readInvitePolicyBlock(block);
      displayValue =
        policy === InvitePolicy.FOUNDER_ONLY ? "FOUNDER_ONLY (2)" : "ANY_ACTIVE_MEMBER (1)";
      break;
    }

    case Tag.PICK_TARGET: {
      const target = readPickTargetBlock(block);
      displayValue = target.targetHash
        ? shortHex(bytesToHex(target.targetHash))
        : `seq #${target.targetSeq ?? 0}`;
      break;
    }

    case Tag.INVITE_PROOF: {
      const parsed = parseInviteProof(block.value);
      displayValue = `convidante=${shortHex(bytesToHex(parsed.inviterPub))}, expira=${new Date(parsed.expiresAtMs).toISOString()}, nonce=${parsed.nonce}`;
      break;
    }

    case Tag.ACTIVE_MEMBERS_TABLE: {
      const rows = readActiveMembersTableBlock(block);
      displayValue = `${rows.length} membro(s) consolidado(s)`;
      break;
    }

    case Tag.COSIGNATURES: {
      const entries = readCosignaturesBlock(block);
      displayValue = `${entries.length} co-assinatura(s)`;
      break;
    }

    case Tag.DELIBERATION_MODE: {
      const mode = readDeliberationModeBlock(block);
      displayValue = mode === DeliberationMode.OPEN ? "OPEN (2)" : "QUORUM (1)";
      break;
    }

    case Tag.FIELD_SUBTITLE: {
      const f = readFieldSubtitleBlock(block);
      displayValue = `[${f.fieldId}] ${f.label}`;
      break;
    }

    case Tag.FIELD_TEXT: {
      const f = readFieldTextBlock(block);
      displayValue = `[${f.fieldId}] ${f.label ? `${f.label}: ` : ""}${f.text}`;
      break;
    }

    case Tag.FIELD_VALUE: {
      const f = readFieldValueBlock(block);
      displayValue = `[${f.fieldId}] ${f.label}: ${(f.amountCents / 100).toFixed(2)} ${f.unit}`;
      break;
    }

    case Tag.FIELD_LINK: {
      const f = readFieldLinkBlock(block);
      displayValue = `[${f.fieldId}] ${f.label ? `${f.label} → ` : ""}${f.url}`;
      break;
    }

    case Tag.FIELD_TABLE: {
      const f = readFieldTableBlock(block);
      displayValue = `[${f.fieldId}] ${f.label || "Tabela"} (${f.columns.length} col × ${f.rows.length} lin)`;
      break;
    }

    default:
      displayValue = `0x${bytesToHex(block.value)}`;
      break;
  }

  return {
    tag: block.tag,
    tagName,
    byteLength: block.value.length,
    displayValue,
  };
}

/**
 * Converte um BinaryDocument já verificado em uma visão legível para o Explorador de Documentos.
 */
export function buildInspectedDocument(
  docIdHex: string,
  byteLength: number,
  doc: BinaryDocument
): InspectedDocument {
  const scopeBlock = doc.blocks.find((b) => b.tag === Tag.SCOPE);
  const tsBlock = doc.blocks.find((b) => b.tag === Tag.TIMESTAMP);
  const parentBlock = doc.blocks.find((b) => b.tag === Tag.PARENT_HASH);

  return {
    docIdHex,
    universe: getDocumentUniverse(doc),
    docType: doc.docType,
    docTypeLabel: getDocTypeName(doc.docType),
    authorPubHex: bytesToHex(doc.authorPub),
    seq: doc.seq,
    byteLength,
    scope: scopeBlock ? readUtf8Block(scopeBlock) : null,
    timestampMs: tsBlock ? readTimestampBlock(tsBlock) : null,
    parentHashHex: parentBlock ? bytesToHex(parentBlock.value) : null,
    blocks: doc.blocks.map(decodeBlockForDisplay),
  };
}

/**
 * Verifica um pacote binário bruto e decodifica seus blocos TLV para inspeção humana.
 */
export async function inspectBinaryPacket(rawBytes: Uint8Array): Promise<InspectedDocument> {
  const doc = await unpackAndVerifyDocument(rawBytes);
  const docIdHex = bytesToHex(calculateDocId(rawBytes));
  return buildInspectedDocument(docIdHex, rawBytes.length, doc);
}
