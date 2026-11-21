import * as ed25519 from "@noble/ed25519";
import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  calculateDocId,
  ConfigKind,
  createActiveCmntHashBlock,
  createActiveMembersTableBlock,
  createAuthorNameBlock,
  createBodyBlock,
  createCategoryHashBlock,
  createConfigKindBlock,
  createCosignaturesBlock,
  createCutoffHashBlock,
  createInactivityDaysBlock,
  createInvitePolicyBlock,
  createInviteProofBlock,
  createParentHashBlock,
  createPickTargetBlock,
  createQuorumPctBlock,
  createScopeBlock,
  createSignedInvite,
  createTimestampBlock,
  createTitleBlock,
  DocType,
  getDocumentUniverse,
  InvitePolicy,
  packDocument,
  readActiveMembersTableBlock,
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
          createQuorumPctBlock(51),
          createTimestampBlock(nowMs + 4000),
        ],
      },
      founder.priv
    );
    const subjDoc = await unpackAndVerifyDocument(subjBytes);
    expect(getDocumentUniverse(subjDoc)).toBe("stze");
    expect(subjDoc.blocks.find((b) => b.tag === Tag.CATEGORY_HASH)?.value).toEqual(categoryId);

    const propBytes = await packDocument(
      {
        docType: DocType.PROPOSAL,
        authorPub: alice.pub,
        seq: 1,
        blocks: [
          createScopeBlock(subjectScope),
          createTitleBlock("Instalar 12 postes solares"),
          createBodyBlock("Custo menor na manutenção mensal."),
          createTimestampBlock(nowMs + 5000),
        ],
      },
      alice.priv
    );
    expect(getDocumentUniverse(await unpackAndVerifyDocument(propBytes))).toBe("stze");

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
  });
});
