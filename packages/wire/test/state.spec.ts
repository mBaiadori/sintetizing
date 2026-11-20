import { describe, expect, it } from "vitest";
import * as ed25519 from "@noble/ed25519";
import { bytesToHex } from "@noble/hashes/utils";
import {
  calculateDocId,
  calculateMerkleRoot,
  createLawArticleBlock,
  createParentHashBlock,
  createPickTargetBlock,
  createScopeBlock,
  createTitleBlock,
  DocType,
  generateMerkleProof,
  packDocument,
  SubjectStateEngine,
  verifyMerkleProof,
} from "../src/index.js";

async function makeKeyPair() {
  const priv = ed25519.utils.randomPrivateKey();
  const pub = await ed25519.getPublicKeyAsync(priv);
  return { priv, pub };
}

describe("Fase 2: Motor de Estado, Pulo de Picks (A -> B -> A) e Escada de Federação", () => {
  it("Teste 1: Vai e Volta de Voto (A -> B -> A), placar atômico e fita de Footprint", async () => {
    const engine = new SubjectStateEngine();
    const joao = await makeKeyPair();

    // 1. João vota em A (alvo 1) com seq = 1
    const pickA1 = await packDocument(
      {
        docType: DocType.PICK,
        authorPub: joao.pub,
        seq: 1,
        blocks: [createPickTargetBlock(1)],
      },
      joao.priv,
    );
    await engine.ingestBinaryPacket(pickA1);

    expect(engine.getTally()).toEqual({ "1": 1 });

    // 2. João pula para B (alvo 2) com seq = 2
    const pickB2 = await packDocument(
      {
        docType: DocType.PICK,
        authorPub: joao.pub,
        seq: 2,
        blocks: [createPickTargetBlock(2)],
      },
      joao.priv,
    );
    await engine.ingestBinaryPacket(pickB2);

    // O voto anterior perde -1 e o novo ganha +1
    expect(engine.getTally()).toEqual({ "2": 1 });

    // 3. João se arrepende e volta para A (alvo 1) com seq = 3
    const pickA3 = await packDocument(
      {
        docType: DocType.PICK,
        authorPub: joao.pub,
        seq: 3,
        blocks: [createPickTargetBlock(1)],
      },
      joao.priv,
    );
    await engine.ingestBinaryPacket(pickA3);

    // Placar final: A ganha 1, B fica com 0
    expect(engine.getTally()).toEqual({ "1": 1 });

    // Footprint do João mantém o histórico sequencial completo (seq 1, 2, 3)
    const footprint = engine.getPersonFootprint(joao.pub);
    expect(footprint.length).toBe(3);
    expect(footprint[0]!.seq).toBe(1);
    expect(footprint[0]!.targetKey).toBe("1");
    expect(footprint[1]!.seq).toBe(2);
    expect(footprint[1]!.targetKey).toBe("2");
    expect(footprint[2]!.seq).toBe(3);
    expect(footprint[2]!.targetKey).toBe("1");

    // Registro ativo do João está no seq 3
    const active = engine.getActivePick(joao.pub);
    expect(active?.seq).toBe(3);
    expect(active?.targetKey).toBe("1");
  });

  it("Teste 2: Ataque de Replay - Bloqueia tentativas de reenviar votos antigos", async () => {
    const engine = new SubjectStateEngine();
    const joao = await makeKeyPair();

    const pick1 = await packDocument(
      {
        docType: DocType.PICK,
        authorPub: joao.pub,
        seq: 1,
        blocks: [createPickTargetBlock(10)],
      },
      joao.priv,
    );
    const pick2 = await packDocument(
      {
        docType: DocType.PICK,
        authorPub: joao.pub,
        seq: 2,
        blocks: [createPickTargetBlock(20)],
      },
      joao.priv,
    );

    await engine.ingestBinaryPacket(pick1);
    await engine.ingestBinaryPacket(pick2);

    expect(engine.getTally()).toEqual({ "20": 1 });

    // Tenta reenviar o pick1 (seq: 1)
    await expect(engine.ingestBinaryPacket(pick1)).rejects.toThrow(
      "Ataque de replay detectado: pacote seq 1 é menor ou igual ao seq ativo atual 2.",
    );

    // Tenta reenviar o pick2 novamente (seq: 2)
    await expect(engine.ingestBinaryPacket(pick2)).rejects.toThrow(
      "Ataque de replay detectado: pacote seq 2 é menor ou igual ao seq ativo atual 2.",
    );

    // Placar e footprint permanecem inalterados
    expect(engine.getTally()).toEqual({ "20": 1 });
    expect(engine.getPersonFootprint(joao.pub).length).toBe(2);
  });

  it("Teste 3: Emenda de Lei e Síntese Modular de Artigos (PARENT_HASH)", async () => {
    const engine = new SubjectStateEngine();
    const { priv, pub } = await makeKeyPair();

    // 1. Proposta Mãe: Lei com 5 Artigos
    const motherDoc = await packDocument(
      {
        docType: DocType.PROPOSAL,
        authorPub: pub,
        seq: 1,
        blocks: [
          createScopeBlock("f1/s2/c9/a1"),
          createTitleBlock("Código de Obras da Comunidade"),
          createLawArticleBlock(1, "Artigo 1: Respeitar horário de silêncio."),
          createLawArticleBlock(2, "Artigo 2: Destinação seletiva de lixo."),
          createLawArticleBlock(
            3,
            "Artigo 3: Taxa de condomínio fixa em R$ 100.",
          ),
          createLawArticleBlock(
            4,
            "Artigo 4: Manutenção de jardins quinzenal.",
          ),
          createLawArticleBlock(
            5,
            "Artigo 5: Uso do salão de festas por sorteio.",
          ),
        ],
      },
      priv,
    );

    const motherIngest = await engine.ingestBinaryPacket(motherDoc);
    const motherId = motherIngest.docId;

    // 2. Proposta Emenda: Comunidade B altera apenas o Artigo 3
    const amendmentDoc = await packDocument(
      {
        docType: DocType.PROPOSAL,
        authorPub: pub,
        seq: 1,
        blocks: [
          createScopeBlock("f1/s2/c9/a1"),
          createTitleBlock("Emenda: Redução da Taxa"),
          createParentHashBlock(motherId),
          createLawArticleBlock(
            3,
            "Artigo 3 Emendado: Taxa de condomínio reduzida para R$ 75.",
          ),
        ],
      },
      priv,
    );

    const amendIngest = await engine.ingestBinaryPacket(amendmentDoc);
    const amendId = amendIngest.docId;

    // 3. Proposta de Síntese da IA: Mantém emenda e adiciona Artigo 6
    const synthesisDoc = await packDocument(
      {
        docType: DocType.PROPOSAL,
        authorPub: pub,
        seq: 1,
        blocks: [
          createScopeBlock("f1/s2/c9/a1"),
          createTitleBlock("Síntese Consensual Final"),
          createParentHashBlock(amendId),
          createLawArticleBlock(
            6,
            "Artigo 6: Transparência em tempo real via P2P.",
          ),
        ],
      },
      priv,
    );

    const synthIngest = await engine.ingestBinaryPacket(synthesisDoc);
    const synthId = synthIngest.docId;

    // Resolução da Lei Consolidada
    const consolidated = engine.resolveConsolidatedProposal(synthId);

    expect(consolidated.title).toBe("Síntese Consensual Final");
    expect(consolidated.articles.size).toBe(6);
    expect(consolidated.articles.get(1)).toBe(
      "Artigo 1: Respeitar horário de silêncio.",
    );
    expect(consolidated.articles.get(2)).toBe(
      "Artigo 2: Destinação seletiva de lixo.",
    );
    // Artigo 3 foi substituído com perfeição
    expect(consolidated.articles.get(3)).toBe(
      "Artigo 3 Emendado: Taxa de condomínio reduzida para R$ 75.",
    );
    expect(consolidated.articles.get(4)).toBe(
      "Artigo 4: Manutenção de jardins quinzenal.",
    );
    expect(consolidated.articles.get(5)).toBe(
      "Artigo 5: Uso do salão de festas por sorteio.",
    );
    // Artigo 6 foi herdado da síntese
    expect(consolidated.articles.get(6)).toBe(
      "Artigo 6: Transparência em tempo real via P2P.",
    );
  });

  it("Teste 4: Escada Completa de Federação (Comunidade -> Sociedade) com Raiz Merkle", async () => {
    // 3 motores locais de comunidade
    const com1Engine = new SubjectStateEngine();
    const com2Engine = new SubjectStateEngine();
    const com3Engine = new SubjectStateEngine();

    const com1Key = await makeKeyPair();
    const com2Key = await makeKeyPair();
    const com3Key = await makeKeyPair();

    // Comunidade 1: 5 moradores votam na Proposta 101
    for (let i = 0; i < 5; i++) {
      const user = await makeKeyPair();
      const pick = await packDocument(
        {
          docType: DocType.PICK,
          authorPub: user.pub,
          seq: 1,
          blocks: [createPickTargetBlock(101)],
        },
        user.priv,
      );
      await com1Engine.ingestBinaryPacket(pick);
    }

    // Comunidade 2: 3 moradores votam na Proposta 202
    for (let i = 0; i < 3; i++) {
      const user = await makeKeyPair();
      const pick = await packDocument(
        {
          docType: DocType.PICK,
          authorPub: user.pub,
          seq: 1,
          blocks: [createPickTargetBlock(202)],
        },
        user.priv,
      );
      await com2Engine.ingestBinaryPacket(pick);
    }

    // Comunidade 3: 4 moradores votam na Proposta 101
    for (let i = 0; i < 4; i++) {
      const user = await makeKeyPair();
      const pick = await packDocument(
        {
          docType: DocType.PICK,
          authorPub: user.pub,
          seq: 1,
          blocks: [createPickTargetBlock(101)],
        },
        user.priv,
      );
      await com3Engine.ingestBinaryPacket(pick);
    }

    // Cada comunidade gera seu Rollup para subir à Sociedade
    const rollup1 = await com1Engine.exportCommunityRollupPick(
      com1Key.priv,
      com1Key.pub,
      1,
    );
    const rollup2 = await com2Engine.exportCommunityRollupPick(
      com2Key.priv,
      com2Key.pub,
      1,
    );
    const rollup3 = await com3Engine.exportCommunityRollupPick(
      com3Key.priv,
      com3Key.pub,
      1,
    );

    // Motor da Sociedade recebe os 3 rollups
    const societyEngine = new SubjectStateEngine();
    await societyEngine.ingestBinaryPacket(rollup1);
    await societyEngine.ingestBinaryPacket(rollup2);
    await societyEngine.ingestBinaryPacket(rollup3);

    // Placar da Sociedade: Opção 101 tem 2 votos (Comunidades 1 e 3), Opção 202 tem 1 voto (Comunidade 2)
    expect(societyEngine.getTally()).toEqual({
      "101": 2,
      "202": 1,
    });

    // Agora, na Comunidade 2, os 3 moradores mudam de voto para a Proposta 101 (seq: 2)
    // Para simplificar, novos votos com seq 2
    for (let i = 0; i < 10; i++) {
      const newUser = await makeKeyPair();
      const pick = await packDocument(
        {
          docType: DocType.PICK,
          authorPub: newUser.pub,
          seq: 1,
          blocks: [createPickTargetBlock(101)],
        },
        newUser.priv,
      );
      await com2Engine.ingestBinaryPacket(pick);
    }

    // Comunidade 2 exporta novo rollup com seq: 2
    const rollup2Rev2 = await com2Engine.exportCommunityRollupPick(
      com2Key.priv,
      com2Key.pub,
      2,
    );
    await societyEngine.ingestBinaryPacket(rollup2Rev2);

    // Placar da Sociedade atualiza instantaneamente para consenso unânime em 101!
    expect(societyEngine.getTally()).toEqual({
      "101": 3,
    });
  });

  describe("Cobertura e Integridade da Merkle Tree", () => {
    it("calcula raiz e valida provas Merkle para listas pares e ímpares", () => {
      const items = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
      ];

      const root = calculateMerkleRoot(items);
      expect(root.length).toBe(32);

      // Prova para cada folha
      for (let i = 0; i < items.length; i++) {
        const proof = generateMerkleProof(items, i);
        const isValid = verifyMerkleProof(items[i]!, proof, i, root);
        expect(isValid).toBe(true);

        // Se passar dado adulterado, prova falha
        const tampered = new Uint8Array([99, 99]);
        expect(verifyMerkleProof(tampered, proof, i, root)).toBe(false);

        // Se raiz estiver incorreta, prova falha
        const fakeRoot = new Uint8Array(32).fill(0xff);
        expect(verifyMerkleProof(items[i]!, proof, i, fakeRoot)).toBe(false);
      }
    });

    it("lida com lista vazia, único item e entradas inválidas", () => {
      // Vazio
      const emptyRoot = calculateMerkleRoot([]);
      expect(emptyRoot).toEqual(new Uint8Array(32));

      // 1 item
      const single = [new Uint8Array([42])];
      const singleRoot = calculateMerkleRoot(single);
      const singleProof = generateMerkleProof(single, 0);
      expect(singleProof.length).toBe(0);
      expect(verifyMerkleProof(single[0]!, singleProof, 0, singleRoot)).toBe(
        true,
      );

      // Índice fora do limite
      expect(() => generateMerkleProof(single, -1)).toThrow(
        "Índice inválido para prova Merkle",
      );
      expect(() => generateMerkleProof(single, 2)).toThrow(
        "Índice inválido para prova Merkle",
      );
      expect(() => generateMerkleProof(single, 1.5)).toThrow(
        "Índice inválido para prova Merkle",
      );

      // Verificação com parâmetros de tamanho incorreto
      expect(
        verifyMerkleProof(single[0]!, singleProof, 0, new Uint8Array(31)),
      ).toBe(false);
      expect(
        verifyMerkleProof(single[0]!, [new Uint8Array(31)], 0, singleRoot),
      ).toBe(false);
    });
  });

  describe("Cobertura de Erros e Casos de Borda do SubjectStateEngine", () => {
    it("lida com propostas repetidas de forma idempotente", async () => {
      const engine = new SubjectStateEngine();
      const { priv, pub } = await makeKeyPair();

      const doc = await packDocument(
        {
          docType: DocType.PROPOSAL,
          authorPub: pub,
          seq: 1,
          blocks: [
            createScopeBlock("escopo"),
            createTitleBlock("Título Proposta"),
          ],
        },
        priv,
      );

      const first = await engine.ingestBinaryPacket(doc);
      const second = await engine.ingestBinaryPacket(doc);

      expect(first.action).toBe("PROPOSAL_STORED");
      expect(second.action).toBe("PROPOSAL_STORED");
      expect(engine.getProposal(first.docId)).toBeDefined();
    });

    it("lança erro se proposta não for encontrada ao resolver emendas", () => {
      const engine = new SubjectStateEngine();
      expect(() =>
        engine.resolveConsolidatedProposal(new Uint8Array(32)),
      ).toThrow("Proposta não encontrada no motor de estado");
    });

    it("lança erro ao exportar rollup de comunidade vazia", async () => {
      const engine = new SubjectStateEngine();
      const { priv, pub } = await makeKeyPair();

      await expect(
        engine.exportCommunityRollupPick(priv, pub, 1),
      ).rejects.toThrow(
        "Não há votos ativos na comunidade para gerar o rollup.",
      );
    });

    it("lança erro ao tentar ingerir documento de tipo desconhecido", async () => {
      const engine = new SubjectStateEngine();
      const { priv, pub } = await makeKeyPair();

      const execDoc = await packDocument(
        {
          docType: DocType.EXECUTION,
          authorPub: pub,
          seq: 1,
          blocks: [],
        },
        priv,
      );

      await expect(engine.ingestBinaryPacket(execDoc)).rejects.toThrow(
        "Tipo de documento não processado pelo motor de estado: 4",
      );
    });

    it("retorna pegada vazia para autor sem histórico", () => {
      const engine = new SubjectStateEngine();
      expect(engine.getPersonFootprint(new Uint8Array(32))).toEqual([]);
      expect(engine.getActivePick(new Uint8Array(32))).toBeUndefined();
    });

    it("suporta exportCommunityRollupPick com alvo em formato hash SHA-256", async () => {
      const engine = new SubjectStateEngine();
      const comKey = await makeKeyPair();
      const user = await makeKeyPair();
      const hashTarget = new Uint8Array(32).fill(0xaa);

      const pick = await packDocument(
        {
          docType: DocType.PICK,
          authorPub: user.pub,
          seq: 1,
          blocks: [createPickTargetBlock(hashTarget)],
        },
        user.priv,
      );

      await engine.ingestBinaryPacket(pick);

      const rollup = await engine.exportCommunityRollupPick(
        comKey.priv,
        comKey.pub,
        1,
      );
      expect(rollup.length).toBeGreaterThan(102);

      const targetKey = bytesToHex(hashTarget);
      expect(engine.getTally()[targetKey]).toBe(1);
    });

    it("mantém contagem positiva no placar quando uma proposta tem múltiplos votos e um morador muda", async () => {
      const engine = new SubjectStateEngine();
      const user1 = await makeKeyPair();
      const user2 = await makeKeyPair();

      // Ambos votam no alvo 1
      await engine.ingestBinaryPacket(
        await packDocument(
          {
            docType: DocType.PICK,
            authorPub: user1.pub,
            seq: 1,
            blocks: [createPickTargetBlock(1)],
          },
          user1.priv,
        ),
      );

      await engine.ingestBinaryPacket(
        await packDocument(
          {
            docType: DocType.PICK,
            authorPub: user2.pub,
            seq: 1,
            blocks: [createPickTargetBlock(1)],
          },
          user2.priv,
        ),
      );

      expect(engine.getTally()).toEqual({ "1": 2 });

      // user1 muda para o alvo 2 (seq: 2). Alvo 1 ainda fica com 1 voto.
      await engine.ingestBinaryPacket(
        await packDocument(
          {
            docType: DocType.PICK,
            authorPub: user1.pub,
            seq: 2,
            blocks: [createPickTargetBlock(2)],
          },
          user1.priv,
        ),
      );

      expect(engine.getTally()).toEqual({ "1": 1, "2": 1 });
    });

    it("lança erro ao ingerir COMMUNITY_PICK sem bloco PICK_TARGET", async () => {
      const engine = new SubjectStateEngine();
      const { priv, pub } = await makeKeyPair();

      const invalidRollup = await packDocument(
        {
          docType: DocType.COMMUNITY_PICK,
          authorPub: pub,
          seq: 1,
          blocks: [createParentHashBlock(new Uint8Array(32))],
        },
        priv,
      );

      await expect(engine.ingestBinaryPacket(invalidRollup)).rejects.toThrow(
        "Pacote de PICK sem bloco PICK_TARGET.",
      );
    });
  });
});
