import * as ed25519 from "@noble/ed25519";
import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  calculateDocId,
  compactChatPackets,
  ConfigKind,
  createActiveCmntHashBlock,
  createActiveMembersTableBlock,
  createAuthorNameBlock,
  createBodyBlock,
  createCategoryHashBlock,
  createConfigKindBlock,
  createCosignaturesBlock,
  createCutoffHashBlock,
  createDeadlineBlock,
  createDeliberationModeBlock,
  createDraftIdBlock,
  createDraftStatusBlock,
  createFieldLinkBlock,
  createFieldSubtitleBlock,
  createFieldTableBlock,
  createFieldTextBlock,
  createFieldValueBlock,
  createInactivityDaysBlock,
  createInvitePolicyBlock,
  createInviteProofBlock,
  createLawArticleBlock,
  createParentHashBlock,
  createPickTargetBlock,
  createQuorumPctBlock,
  createScopeBlock,
  createSignedInvite,
  createTimestampBlock,
  createTitleBlock,
  decodeChatFile,
  DeliberationMode,
  DocType,
  DraftStatus,
  encodeChatFile,
  getDocumentUniverse,
  InvitePolicy,
  packDocument,
  readActiveMembersTableBlock,
  readDeadlineBlock,
  readDeliberationModeBlock,
  readDraftIdBlock,
  readDraftStatusBlock,
  readFieldLinkBlock,
  readFieldSubtitleBlock,
  readFieldTableBlock,
  readFieldTextBlock,
  readFieldValueBlock,
  readInactivityDaysBlock,
  readInvitePolicyBlock,
  readTimestampBlock,
  Tag,
  unpackAndVerifyDocument,
  verifyInviteProof,
} from "../src/index.js";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

async function makeKeyPair(): Promise<{ priv: Uint8Array; pub: Uint8Array }> {
  const priv = ed25519.utils.randomPrivateKey();
  const pub = await ed25519.getPublicKeyAsync(priv);
  return { priv, pub };
}

describe("Wire binary TLV smoke suite (.cmnt / .memb / .stze / .snap)", () => {
  it("empacota, verifica Ed25519 e classifica .cmnt, .memb, .stze e .snap", async () => {
    const founder = await makeKeyPair();
    const alice = await makeKeyPair();
    const communityId = "bairro-centro-a1b2";
    const nowMs = 1_760_000_000_000;

    // 1. .cmnt v1 + v2
    const cmntV1Bytes = await packDocument(
      {
        docType: DocType.CONFIG,
        authorPub: founder.pub,
        seq: 1,
        blocks: [
          createScopeBlock(communityId),
          createConfigKindBlock(ConfigKind.COMMUNITY),
          createTitleBlock("Bairro Centro"),
          createBodyBlock("Estatuto inicial da comunidade"),
          createQuorumPctBlock(51),
          createInactivityDaysBlock(30),
          createInvitePolicyBlock(InvitePolicy.ANY_ACTIVE_MEMBER),
          createTimestampBlock(nowMs),
        ],
      },
      founder.priv
    );
    const cmntV1Doc = await unpackAndVerifyDocument(cmntV1Bytes);
    expect(getDocumentUniverse(cmntV1Doc)).toBe("cmnt");
    expect(readInactivityDaysBlock(cmntV1Doc.blocks.find((b) => b.tag === Tag.INACTIVITY_DAYS)!)).toBe(30);
    expect(readInvitePolicyBlock(cmntV1Doc.blocks.find((b) => b.tag === Tag.INVITE_POLICY)!)).toBe(
      InvitePolicy.ANY_ACTIVE_MEMBER
    );
    expect(readTimestampBlock(cmntV1Doc.blocks.find((b) => b.tag === Tag.TIMESTAMP)!)).toBe(nowMs);

    const cmntV1Id = calculateDocId(cmntV1Bytes);
    const cmntV2Bytes = await packDocument(
      {
        docType: DocType.CONFIG,
        authorPub: founder.pub,
        seq: 2,
        blocks: [
          createScopeBlock(communityId),
          createConfigKindBlock(ConfigKind.COMMUNITY),
          createParentHashBlock(cmntV1Id),
          createTitleBlock("Bairro Centro"),
          createQuorumPctBlock(60),
          createInactivityDaysBlock(45),
          createTimestampBlock(nowMs + 1000),
        ],
      },
      founder.priv
    );
    const cmntV2Doc = await unpackAndVerifyDocument(cmntV2Bytes);
    expect(getDocumentUniverse(cmntV2Doc)).toBe("cmnt");
    const cmntV2Id = calculateDocId(cmntV2Bytes);

    // 2. .memb (MEMB_JOIN com INVITE_PROOF + COMMUNITY_PICK + PICK + MEMB_LEAVE)
    const inviteProof = await createSignedInvite({
      communityId,
      inviterPub: founder.pub,
      inviterPrivateKey: founder.priv,
      issuedAtMs: nowMs,
      expiresAtMs: nowMs + 86_400_000,
      nonce: 42,
    });
    const verifiedInvite = await verifyInviteProof(communityId, inviteProof);
    expect(verifiedInvite?.nonce).toBe(42);
    expect(await verifyInviteProof("outra-comunidade", inviteProof)).toBeNull();

    const joinBytes = await packDocument(
      {
        docType: DocType.MEMB_JOIN,
        authorPub: alice.pub,
        seq: 1,
        blocks: [
          createScopeBlock(communityId),
          createInviteProofBlock(inviteProof),
          createAuthorNameBlock("Alice"),
          createTimestampBlock(nowMs + 2000),
        ],
      },
      alice.priv
    );
    expect(getDocumentUniverse(await unpackAndVerifyDocument(joinBytes))).toBe("memb");

    const commPickBytes = await packDocument(
      {
        docType: DocType.COMMUNITY_PICK,
        authorPub: alice.pub,
        seq: 2,
        blocks: [
          createScopeBlock(communityId),
          createPickTargetBlock(cmntV2Id),
          createTimestampBlock(nowMs + 3000),
        ],
      },
      alice.priv
    );
    expect(getDocumentUniverse(await unpackAndVerifyDocument(commPickBytes))).toBe("memb");

    // 3. .stze (CATEGORY CONFIG + SUBJECT CONFIG + PROPOSAL) + PICK
    const categoryScope = `${communityId}/cat-infra`;
    const categoryBytes = await packDocument(
      {
        docType: DocType.CONFIG,
        authorPub: founder.pub,
        seq: 1,
        blocks: [
          createScopeBlock(categoryScope),
          createConfigKindBlock(ConfigKind.CATEGORY),
          createTitleBlock("Infraestrutura"),
          createBodyBlock("Obras e iluminação do bairro"),
          createTimestampBlock(nowMs + 3500),
        ],
      },
      founder.priv
    );
    expect(getDocumentUniverse(await unpackAndVerifyDocument(categoryBytes))).toBe("stze");
    const categoryId = calculateDocId(categoryBytes);

    const subjectScope = `${communityId}/iluminacao`;
    const deadlineSec = Math.floor(nowMs / 1000) + 86_400 * 7;
    const subjBytes = await packDocument(
      {
        docType: DocType.CONFIG,
        authorPub: founder.pub,
        seq: 1,
        blocks: [
          createScopeBlock(subjectScope),
          createConfigKindBlock(ConfigKind.SUBJECT),
          createCategoryHashBlock(categoryId),
          createTitleBlock("Iluminação da Praça"),
          createBodyBlock("Definir lâmpadas LED"),
          createDeliberationModeBlock(DeliberationMode.QUORUM),
          createDeadlineBlock(deadlineSec),
          createTimestampBlock(nowMs + 4000),
        ],
      },
      founder.priv
    );
    const subjDoc = await unpackAndVerifyDocument(subjBytes);
    expect(getDocumentUniverse(subjDoc)).toBe("stze");
    expect(subjDoc.blocks.find((b) => b.tag === Tag.CATEGORY_HASH)?.value).toEqual(categoryId);
    expect(readDeliberationModeBlock(subjDoc.blocks.find((b) => b.tag === Tag.DELIBERATION_MODE)!)).toBe(
      DeliberationMode.QUORUM
    );
    expect(readDeadlineBlock(subjDoc.blocks.find((b) => b.tag === Tag.DEADLINE)!)).toBe(deadlineSec);

    const propBytes = await packDocument(
      {
        docType: DocType.PROPOSAL,
        authorPub: alice.pub,
        seq: 1,
        blocks: [
          createScopeBlock(subjectScope),
          createTitleBlock("Instalar 12 postes solares"),
          createBodyBlock("Custo menor na manutenção mensal."),
          createFieldSubtitleBlock({ fieldId: "sub-1", label: "Escopo Técnico" }),
          createFieldTextBlock({
            fieldId: "txt-1",
            label: "Justificativa",
            text: "Substituir postes antigos por LED solar autônomo.",
          }),
          createFieldValueBlock({
            fieldId: "val-1",
            label: "Orçamento de Materiais",
            amountCents: 1250000,
            unit: "BRL",
          }),
          createFieldLinkBlock({
            fieldId: "lnk-1",
            label: "Cotação Oficial",
            url: "https://exemplo.org/cotacao.pdf",
          }),
          createFieldTableBlock({
            fieldId: "tbl-1",
            label: "Cronograma",
            columns: ["Etapa", "Prazo"],
            rows: [
              ["Compra", "Semana 1"],
              ["Instalação", "Semana 2"],
            ],
          }),
          createLawArticleBlock(1, "Garantia mínima de 24 meses pelo fornecedor."),
          createDeadlineBlock(deadlineSec),
          createTimestampBlock(nowMs + 5000),
        ],
      },
      alice.priv
    );
    const propDoc = await unpackAndVerifyDocument(propBytes);
    expect(getDocumentUniverse(propDoc)).toBe("stze");
    expect(readFieldSubtitleBlock(propDoc.blocks.find((b) => b.tag === Tag.FIELD_SUBTITLE)!)).toEqual({
      fieldId: "sub-1",
      label: "Escopo Técnico",
    });
    expect(readFieldTextBlock(propDoc.blocks.find((b) => b.tag === Tag.FIELD_TEXT)!)).toEqual({
      fieldId: "txt-1",
      label: "Justificativa",
      text: "Substituir postes antigos por LED solar autônomo.",
    });
    expect(readFieldValueBlock(propDoc.blocks.find((b) => b.tag === Tag.FIELD_VALUE)!)).toEqual({
      fieldId: "val-1",
      label: "Orçamento de Materiais",
      amountCents: 1250000,
      unit: "BRL",
    });
    expect(readFieldLinkBlock(propDoc.blocks.find((b) => b.tag === Tag.FIELD_LINK)!)).toEqual({
      fieldId: "lnk-1",
      label: "Cotação Oficial",
      url: "https://exemplo.org/cotacao.pdf",
    });
    expect(readFieldTableBlock(propDoc.blocks.find((b) => b.tag === Tag.FIELD_TABLE)!)).toEqual({
      fieldId: "tbl-1",
      label: "Cronograma",
      columns: ["Etapa", "Prazo"],
      rows: [
        ["Compra", "Semana 1"],
        ["Instalação", "Semana 2"],
      ],
    });

    const pickBytes = await packDocument(
      {
        docType: DocType.PICK,
        authorPub: alice.pub,
        seq: 3,
        blocks: [
          createScopeBlock(subjectScope),
          createPickTargetBlock(calculateDocId(propBytes)),
          createTimestampBlock(nowMs + 6000),
        ],
      },
      alice.priv
    );
    expect(getDocumentUniverse(await unpackAndVerifyDocument(pickBytes))).toBe("memb");

    const leaveBytes = await packDocument(
      {
        docType: DocType.MEMB_LEAVE,
        authorPub: alice.pub,
        seq: 4,
        blocks: [
          createScopeBlock(communityId),
          createParentHashBlock(calculateDocId(pickBytes)),
          createTimestampBlock(nowMs + 7000),
        ],
      },
      alice.priv
    );
    expect(getDocumentUniverse(await unpackAndVerifyDocument(leaveBytes))).toBe("memb");

    // 4. .snap (SNAPSHOT)
    const snapBytes = await packDocument(
      {
        docType: DocType.SNAPSHOT,
        authorPub: founder.pub,
        seq: 3,
        blocks: [
          createScopeBlock(communityId),
          createCutoffHashBlock(calculateDocId(leaveBytes)),
          createActiveCmntHashBlock(cmntV2Id),
          createActiveMembersTableBlock([{ pubKey: founder.pub, lastActivityMs: nowMs + 4000 }]),
          createCosignaturesBlock([{ pubKey: founder.pub, signature: new Uint8Array(64).fill(7) }]),
          createTimestampBlock(nowMs + 8000),
        ],
      },
      founder.priv
    );
    const snapDoc = await unpackAndVerifyDocument(snapBytes);
    expect(getDocumentUniverse(snapDoc)).toBe("snap");
    const rows = readActiveMembersTableBlock(
      snapDoc.blocks.find((b) => b.tag === Tag.ACTIVE_MEMBERS_TABLE)!
    );
    expect(rows[0]?.lastActivityMs).toBe(nowMs + 4000);
  });

  it("rejeita assinatura adulterada e convite adulterado", async () => {
    const founder = await makeKeyPair();
    const cmntBytes = await packDocument(
      {
        docType: DocType.CONFIG,
        authorPub: founder.pub,
        seq: 1,
        blocks: [createScopeBlock("comunidade-x"), createTitleBlock("Comunidade X")],
      },
      founder.priv
    );
    const corrupted = new Uint8Array(cmntBytes);
    corrupted[corrupted.length - 1] = corrupted[corrupted.length - 1]! ^ 0xff;
    await expect(unpackAndVerifyDocument(corrupted)).rejects.toThrow();

    const proof = await createSignedInvite({
      communityId: "comunidade-x",
      inviterPub: founder.pub,
      inviterPrivateKey: founder.priv,
      issuedAtMs: 1_760_000_000_000,
      expiresAtMs: 1_760_086_400_000,
      nonce: 1,
    });
    const badProof = new Uint8Array(proof);
    badProof[10] = badProof[10]! ^ 0x01;
    expect(await verifyInviteProof("comunidade-x", badProof)).toBeNull();

    expect(() =>
      createFieldLinkBlock({
        fieldId: "lnk-bad",
        label: "Inválido",
        url: "javascript:alert(1)",
      })
    ).toThrow();
  });

  it("empacota .chat (CHAT_MESSAGE e CHAT_DRAFT), compacta edições e preserva tombstone DELETED", async () => {
    const alice = await makeKeyPair();
    const bob = await makeKeyPair();
    const subjectScope = "bairro-centro/portao-a1b2";
    const draftId = "draft-portao-1";
    const nowMs = 1_760_000_100_000;

    const msgBytes = await packDocument(
      {
        docType: DocType.CHAT_MESSAGE,
        authorPub: bob.pub,
        seq: 1,
        blocks: [
          createScopeBlock(subjectScope),
          createBodyBlock("Precisamos incluir bateria no motor do portão."),
          createAuthorNameBlock("Bob"),
          createTimestampBlock(nowMs),
        ],
      },
      bob.priv
    );
    const msgDoc = await unpackAndVerifyDocument(msgBytes);
    expect(getDocumentUniverse(msgDoc)).toBe("chat");

    const draftV1 = await packDocument(
      {
        docType: DocType.CHAT_DRAFT,
        authorPub: alice.pub,
        seq: 1,
        blocks: [
          createScopeBlock(subjectScope),
          createDraftIdBlock(draftId),
          createDraftStatusBlock(DraftStatus.ACTIVE),
          createTitleBlock("Motor do portão v1"),
          createFieldTextBlock({
            fieldId: "txt-1",
            label: "Resumo",
            text: "Versão inicial sem bateria.",
          }),
          createAuthorNameBlock("Alice"),
          createTimestampBlock(nowMs + 1000),
        ],
      },
      alice.priv
    );

    const draftV2 = await packDocument(
      {
        docType: DocType.CHAT_DRAFT,
        authorPub: alice.pub,
        seq: 2,
        blocks: [
          createScopeBlock(subjectScope),
          createDraftIdBlock(draftId),
          createDraftStatusBlock(DraftStatus.ACTIVE),
          createTitleBlock("Motor do portão com bateria"),
          createFieldValueBlock({
            fieldId: "val-1",
            label: "Orçamento",
            amountCents: 145000,
            unit: "BRL",
          }),
          createAuthorNameBlock("Alice"),
          createTimestampBlock(nowMs + 2000),
        ],
      },
      alice.priv
    );
    const draftV2Doc = await unpackAndVerifyDocument(draftV2);
    expect(getDocumentUniverse(draftV2Doc)).toBe("chat");
    expect(readDraftIdBlock(draftV2Doc.blocks.find((b) => b.tag === Tag.DRAFT_ID)!)).toBe(draftId);
    expect(readDraftStatusBlock(draftV2Doc.blocks.find((b) => b.tag === Tag.DRAFT_STATUS)!)).toBe(
      DraftStatus.ACTIVE
    );

    const compactedActive = await compactChatPackets([msgBytes, draftV1, draftV2]);
    expect(compactedActive.messageCount).toBe(1);
    expect(compactedActive.activeDraftCount).toBe(1);
    expect(compactedActive.packets).toHaveLength(2);

    const archiveBytes = encodeChatFile(compactedActive.packets);
    const decodedPackets = decodeChatFile(archiveBytes);
    expect(decodedPackets).toHaveLength(2);

    const draftDeletedV3 = await packDocument(
      {
        docType: DocType.CHAT_DRAFT,
        authorPub: alice.pub,
        seq: 3,
        blocks: [
          createScopeBlock(subjectScope),
          createDraftIdBlock(draftId),
          createDraftStatusBlock(DraftStatus.DELETED),
          createTimestampBlock(nowMs + 3000),
        ],
      },
      alice.priv
    );
    const compactedDeleted = await compactChatPackets([
      ...decodedPackets,
      draftV1,
      draftDeletedV3,
    ]);
    expect(compactedDeleted.messageCount).toBe(1);
    expect(compactedDeleted.activeDraftCount).toBe(0);
    expect(compactedDeleted.packets).toHaveLength(2);
    const deletedArchive = decodeChatFile(encodeChatFile(compactedDeleted.packets));
    expect(deletedArchive).toHaveLength(2);
  });
});
