import { describe, expect, it } from "vitest";
import * as ed25519 from "@noble/ed25519";
import {
  calculateDocId,
  createBodyBlock,
  createCurrencyBlock,
  createDeadlineBlock,
  createLawArticleBlock,
  createParentHashBlock,
  createPickTargetBlock,
  createScopeBlock,
  createTitleBlock,
  decodeTLVBlocks,
  DocType,
  encodeTLVBlocks,
  packDocument,
  readCurrencyBlock,
  readLawArticleBlock,
  readPickTargetBlock,
  readUtf8Block,
  Tag,
  unpackAndVerifyDocument,
  validateBlock,
  validateDocumentStructure,
  WIRE_CONSTANTS,
} from "../src/index.js";

async function makeTestKeyPair() {
  const priv = ed25519.utils.randomPrivateKey();
  const pub = await ed25519.getPublicKeyAsync(priv);
  return { priv, pub };
}

describe("Fase 1: Motor Binário Posicional & Fita TLV (.stze)", () => {
  it("Teste 1: Empacota um PICK e comprova tamanho ultra-compacto (106 a 110 bytes)", async () => {
    const { priv, pub } = await makeTestKeyPair();

    const pickDoc = {
      docType: DocType.PICK,
      authorPub: pub,
      seq: 1,
      blocks: [createPickTargetBlock(42)],
    };

    const packed = await packDocument(pickDoc, priv);

    // Cabeçalho de 102 bytes + Tag (2B) + Len (2B) + Target (4B) = exatamente 110 bytes
    expect(packed.length).toBe(110);
    expect(packed.length).toBeGreaterThanOrEqual(106);
    expect(packed.length).toBeLessThanOrEqual(110);

    const unpacked = await unpackAndVerifyDocument(packed);
    expect(unpacked.version).toBe(1);
    expect(unpacked.docType).toBe(DocType.PICK);
    expect(unpacked.seq).toBe(1);
    expect(unpacked.authorPub).toEqual(pub);
    expect(unpacked.blocks.length).toBe(1);

    const target = readPickTargetBlock(unpacked.blocks[0]!);
    expect(target.targetSeq).toBe(42);

    const docId = calculateDocId(packed);
    expect(docId.length).toBe(32);
  });

  it("Teste 1.1: Pick com Target em hash de 32 bytes", async () => {
    const { priv, pub } = await makeTestKeyPair();
    const targetHash = new Uint8Array(32).fill(7);

    const pickDoc = {
      docType: DocType.PICK,
      authorPub: pub,
      seq: 3,
      blocks: [createPickTargetBlock(targetHash)],
    };

    const packed = await packDocument(pickDoc, priv);
    // 102B header + 4B TLV header + 32B hash = 138 bytes
    expect(packed.length).toBe(138);

    const unpacked = await unpackAndVerifyDocument(packed);
    const target = readPickTargetBlock(unpacked.blocks[0]!);
    expect(target.targetHash).toEqual(targetHash);
  });

  it("Teste 2: Empacota Proposta com texto de 2.000+ chars e dois campos de Valor (Tag 12) na ordem exata", async () => {
    const { priv, pub } = await makeTestKeyPair();

    // Texto com mais de 2.000 caracteres com acentos
    const longText = "Texto de proposta pública com justificativa detalhada. ".repeat(40);
    expect(longText.length).toBeGreaterThan(2000);

    const proposalDoc = {
      docType: DocType.PROPOSAL,
      authorPub: pub,
      seq: 1,
      blocks: [
        createScopeBlock("f1/s2/c9/a4"),
        createTitleBlock("Reforma Completa da Quadra Poliesportiva"),
        createBodyBlock(longText),
        createCurrencyBlock(120000, "Material"), // R$ 1.200,00
        createCurrencyBlock(50000, "Mão de Obra"), // R$ 500,00
      ],
    };

    const packed = await packDocument(proposalDoc, priv);
    const unpacked = await unpackAndVerifyDocument(packed);

    expect(unpacked.blocks.length).toBe(5);

    // Bloco 0: Scope
    expect(unpacked.blocks[0]!.tag).toBe(Tag.SCOPE);
    expect(readUtf8Block(unpacked.blocks[0]!)).toBe("f1/s2/c9/a4");

    // Bloco 1: Title
    expect(unpacked.blocks[1]!.tag).toBe(Tag.TITLE);
    expect(readUtf8Block(unpacked.blocks[1]!)).toBe("Reforma Completa da Quadra Poliesportiva");

    // Bloco 2: Body longo
    expect(unpacked.blocks[2]!.tag).toBe(Tag.BODY);
    expect(readUtf8Block(unpacked.blocks[2]!)).toBe(longText);

    // Bloco 3: Valor Material (Tag 12 #0)
    expect(unpacked.blocks[3]!.tag).toBe(Tag.CURRENCY);
    const valMaterial = readCurrencyBlock(unpacked.blocks[3]!);
    expect(valMaterial.cents).toBe(120000);
    expect(valMaterial.label).toBe("Material");

    // Bloco 4: Valor Mão de Obra (Tag 12 #1)
    expect(unpacked.blocks[4]!.tag).toBe(Tag.CURRENCY);
    const valMaoDeObra = readCurrencyBlock(unpacked.blocks[4]!);
    expect(valMaoDeObra.cents).toBe(50000);
    expect(valMaoDeObra.label).toBe("Mão de Obra");
  });

  it("Teste 3: Altera 1 único byte no meio do pacote e comprova rejeição na porta de entrada", async () => {
    const { priv, pub } = await makeTestKeyPair();

    const packed = await packDocument(
      {
        docType: DocType.PICK,
        authorPub: pub,
        seq: 1,
        blocks: [createPickTargetBlock(1)],
      },
      priv
    );

    // Altera 1 byte no corpo TLV (byte 105)
    const tamperedBody = new Uint8Array(packed);
    tamperedBody[105] = (tamperedBody[105]! ^ 0xff);

    await expect(unpackAndVerifyDocument(tamperedBody)).rejects.toThrow(
      "Rejeitado na porta de entrada: assinatura Ed25519 inválida ou conteúdo adulterado."
    );

    // Altera 1 byte no cabeçalho (ex: seq no byte 37)
    const tamperedHeader = new Uint8Array(packed);
    tamperedHeader[37] = (tamperedHeader[37]! ^ 0x01);

    await expect(unpackAndVerifyDocument(tamperedHeader)).rejects.toThrow(
      "Rejeitado na porta de entrada: assinatura Ed25519 inválida ou conteúdo adulterado."
    );
  });

  it("Teste 4: Simula leitura de Tag 999 desconhecida pulada pelo LENGTH com segurança", async () => {
    const { priv, pub } = await makeTestKeyPair();

    // Cria documento contendo uma Tag 999 futura (de 100 bytes)
    const futureData = new Uint8Array(100).fill(42);
    const docWithFutureTag = {
      docType: DocType.PROPOSAL,
      authorPub: pub,
      seq: 1,
      blocks: [
        createScopeBlock("f1/s2/c9/a4"),
        createTitleBlock("Proposta com Tag Futura"),
        { tag: 999, value: futureData },
      ],
    };

    const packed = await packDocument(docWithFutureTag, priv);
    const unpacked = await unpackAndVerifyDocument(packed);

    expect(unpacked.blocks.length).toBe(3);
    expect(unpacked.blocks[2]!.tag).toBe(999);
    expect(unpacked.blocks[2]!.value).toEqual(futureData);
  });

  describe("Cobertura Completa de Limites e Validadores TLV", () => {
    it("valida codificação e decodificação com tags e valores extremos", () => {
      const blocks = [
        { tag: 0, value: new Uint8Array(0) },
        { tag: 65535, value: new Uint8Array(10) },
      ];
      const encoded = encodeTLVBlocks(blocks);
      const decoded = decodeTLVBlocks(encoded);
      expect(decoded.length).toBe(2);
      expect(decoded[0]!.tag).toBe(0);
      expect(decoded[0]!.value.length).toBe(0);
      expect(decoded[1]!.tag).toBe(65535);
      expect(decoded[1]!.value.length).toBe(10);
    });

    it("lança erro ao codificar tag ou length inválido", () => {
      expect(() => encodeTLVBlocks([{ tag: -1, value: new Uint8Array(0) }])).toThrow(
        "Tag inválida: -1"
      );
      expect(() => encodeTLVBlocks([{ tag: 65536, value: new Uint8Array(0) }])).toThrow(
        "Tag inválida: 65536"
      );
      expect(() => encodeTLVBlocks([{ tag: 1.5, value: new Uint8Array(0) }])).toThrow(
        "Tag inválida: 1.5"
      );
      expect(() =>
        encodeTLVBlocks([{ tag: 1, value: new Uint8Array(65536) }])
      ).toThrow("excede o limite máximo de 65535 bytes");
    });

    it("lança erro ao decodificar buffer TLV truncado ou corrompido", () => {
      // Buffer com menos de 4 bytes
      expect(() => decodeTLVBlocks(new Uint8Array([0, 1, 0]))).toThrow(
        "Buffer TLV corrompido ou truncado: restam 3 bytes"
      );

      // Declara 10 bytes mas só fornece 2 bytes de valor
      const truncated = new Uint8Array([0, 1, 0, 10, 1, 2]);
      expect(() => decodeTLVBlocks(truncated)).toThrow(
        "bloco com tag 1 declara 10 bytes, mas restam apenas 2 bytes"
      );
    });

    it("testa limites do bloco Tag SCOPE (1)", () => {
      // Menos de 3 bytes
      expect(() => validateBlock({ tag: Tag.SCOPE, value: new Uint8Array([65, 66]) })).toThrow(
        "fora do intervalo [3..128]"
      );
      // Mais de 128 bytes
      expect(() => validateBlock({ tag: Tag.SCOPE, value: new Uint8Array(129) })).toThrow(
        "fora do intervalo [3..128]"
      );
      // UTF-8 inválido
      expect(() =>
        validateBlock({ tag: Tag.SCOPE, value: new Uint8Array([0xff, 0xff, 0xff]) })
      ).toThrow("deve conter texto UTF-8 válido");
    });

    it("testa limites do bloco Tag PARENT_HASH (2)", () => {
      expect(() => createParentHashBlock(new Uint8Array(31))).toThrow(
        "Parent hash deve ter exatamente 32 bytes"
      );
      expect(() => validateBlock({ tag: Tag.PARENT_HASH, value: new Uint8Array(31) })).toThrow(
        "Tag PARENT_HASH (2) inválida: esperado 32 bytes"
      );

      const validHash = new Uint8Array(32).fill(1);
      const block = createParentHashBlock(validHash);
      expect(() => validateBlock(block)).not.toThrow();
    });

    it("testa limites do bloco Tag TITLE (10)", () => {
      expect(() => validateBlock({ tag: Tag.TITLE, value: new Uint8Array(4) })).toThrow(
        "fora do intervalo [5..160]"
      );
      expect(() => validateBlock({ tag: Tag.TITLE, value: new Uint8Array(161) })).toThrow(
        "fora do intervalo [5..160]"
      );
      expect(() =>
        validateBlock({
          tag: Tag.TITLE,
          value: new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff]),
        })
      ).toThrow("deve conter texto UTF-8 válido");
    });

    it("testa limites do bloco Tag BODY (11)", () => {
      expect(() => validateBlock({ tag: Tag.BODY, value: new Uint8Array(0) })).toThrow(
        "fora do intervalo [1..4000]"
      );
      expect(() => validateBlock({ tag: Tag.BODY, value: new Uint8Array(4001) })).toThrow(
        "fora do intervalo [1..4000]"
      );
      expect(() =>
        validateBlock({ tag: Tag.BODY, value: new Uint8Array([0xff]) })
      ).toThrow("deve conter texto UTF-8 válido");
    });

    it("testa limites do bloco Tag CURRENCY (12)", () => {
      expect(() => validateBlock({ tag: Tag.CURRENCY, value: new Uint8Array(4) })).toThrow(
        "esperado no mínimo 5 bytes"
      );
      expect(() =>
        validateBlock({
          tag: Tag.CURRENCY,
          value: new Uint8Array([0, 0, 0, 10, 0xff]),
        })
      ).toThrow("deve conter rótulo UTF-8 válido");

      expect(() => createCurrencyBlock(-1, "Label")).toThrow("Valor em centavos inválido");
      expect(() => createCurrencyBlock(1.5, "Label")).toThrow("Valor em centavos inválido");
      expect(() => createCurrencyBlock(0x100000000, "Label")).toThrow("Valor em centavos inválido");

      expect(() => readCurrencyBlock({ tag: Tag.CURRENCY, value: new Uint8Array(4) })).toThrow(
        "tamanho menor que 5 bytes"
      );
    });

    it("testa limites do bloco Tag DEADLINE (13)", () => {
      expect(() => validateBlock({ tag: Tag.DEADLINE, value: new Uint8Array(3) })).toThrow(
        "esperado 4 bytes Uint32BE"
      );
      expect(() => createDeadlineBlock(-5)).toThrow("Deadline inválido");
      expect(() => createDeadlineBlock(3.14)).toThrow("Deadline inválido");
      expect(() => createDeadlineBlock(0x100000000)).toThrow("Deadline inválido");

      const deadlineBlock = createDeadlineBlock(1750000000);
      expect(() => validateBlock(deadlineBlock)).not.toThrow();
    });

    it("testa limites do bloco Tag LAW_ARTICLE (14)", () => {
      expect(() => validateBlock({ tag: Tag.LAW_ARTICLE, value: new Uint8Array(2) })).toThrow(
        "fora do intervalo [3..2002]"
      );
      expect(() => validateBlock({ tag: Tag.LAW_ARTICLE, value: new Uint8Array(2003) })).toThrow(
        "fora do intervalo [3..2002]"
      );
      expect(() =>
        validateBlock({
          tag: Tag.LAW_ARTICLE,
          value: new Uint8Array([0, 1, 0xff]),
        })
      ).toThrow("deve conter texto de artigo UTF-8 válido");

      expect(() => createLawArticleBlock(0, "Artigo")).toThrow("Número de artigo inválido");
      expect(() => createLawArticleBlock(65536, "Artigo")).toThrow("Número de artigo inválido");
      expect(() => createLawArticleBlock(1.5, "Artigo")).toThrow("Número de artigo inválido");

      expect(() =>
        readLawArticleBlock({ tag: Tag.LAW_ARTICLE, value: new Uint8Array(2) })
      ).toThrow("tamanho menor que 3 bytes");

      const articleBlock = createLawArticleBlock(12, "Fica proibido o desperdício.");
      expect(() => validateBlock(articleBlock)).not.toThrow();
      const read = readLawArticleBlock(articleBlock);
      expect(read.articleNum).toBe(12);
      expect(read.text).toBe("Fica proibido o desperdício.");
    });

    it("testa limites do bloco Tag PICK_TARGET (20)", () => {
      expect(() => validateBlock({ tag: Tag.PICK_TARGET, value: new Uint8Array(5) })).toThrow(
        "esperado 4 bytes (índice) ou 32 bytes (hash)"
      );

      expect(() => createPickTargetBlock(-1)).toThrow("Target numérico inválido");
      expect(() => createPickTargetBlock(1.5)).toThrow("Target numérico inválido");
      expect(() => createPickTargetBlock(0x100000000)).toThrow("Target numérico inválido");
      expect(() => createPickTargetBlock(new Uint8Array(10))).toThrow(
        "Target em hash deve ter 32 bytes"
      );

      expect(() =>
        readPickTargetBlock({ tag: Tag.PICK_TARGET, value: new Uint8Array(10) })
      ).toThrow("tamanho diferente de 4 e 32 bytes");
    });

    it("valida regras estruturais de documentos", () => {
      // PROPOSTA: seq deve ser 1
      expect(() =>
        validateDocumentStructure(DocType.PROPOSAL, 2, [
          createScopeBlock("escopo"),
          createTitleBlock("Título Válido"),
        ])
      ).toThrow("deve ter seq = 1");

      // PROPOSTA: deve conter SCOPE
      expect(() =>
        validateDocumentStructure(DocType.PROPOSAL, 1, [createTitleBlock("Título Válido")])
      ).toThrow("deve conter obrigatoriamente a tag SCOPE");

      // PROPOSTA: deve conter TITLE
      expect(() =>
        validateDocumentStructure(DocType.PROPOSAL, 1, [createScopeBlock("escopo")])
      ).toThrow("deve conter obrigatoriamente a tag TITLE");

      // PICK: seq deve ser >= 1
      expect(() =>
        validateDocumentStructure(DocType.PICK, 0, [createPickTargetBlock(1)])
      ).toThrow("deve ter seq >= 1");

      // PICK: deve ter exatamente 1 target
      expect(() => validateDocumentStructure(DocType.PICK, 1, [])).toThrow(
        "deve conter exatamente 1 tag PICK_TARGET"
      );
      expect(() =>
        validateDocumentStructure(DocType.PICK, 1, [
          createPickTargetBlock(1),
          createPickTargetBlock(2),
        ])
      ).toThrow("deve conter exatamente 1 tag PICK_TARGET");

      // COMMUNITY_PICK e EXECUTION: seq >= 1
      expect(() => validateDocumentStructure(DocType.COMMUNITY_PICK, 0, [])).toThrow(
        "deve ter seq >= 1"
      );
      expect(() => validateDocumentStructure(DocType.EXECUTION, 0, [])).toThrow(
        "deve ter seq >= 1"
      );

      expect(() => validateDocumentStructure(DocType.COMMUNITY_PICK, 1, [])).not.toThrow();
      expect(() => validateDocumentStructure(DocType.EXECUTION, 1, [])).not.toThrow();

      // DocType desconhecido
      expect(() => validateDocumentStructure(99, 1, [])).toThrow("Tipo de documento desconhecido: 99");
    });

    it("lança erro ao empacotar com parâmetros de envelope inválidos", async () => {
      const { priv, pub } = await makeTestKeyPair();

      // Versão incompatível
      await expect(
        packDocument(
          {
            version: 2,
            docType: DocType.PICK,
            authorPub: pub,
            seq: 1,
            blocks: [createPickTargetBlock(1)],
          },
          priv
        )
      ).rejects.toThrow("Versão do protocolo não suportada: 2");

      // authorPub com tamanho errado
      await expect(
        packDocument(
          {
            docType: DocType.PICK,
            authorPub: new Uint8Array(31),
            seq: 1,
            blocks: [createPickTargetBlock(1)],
          },
          priv
        )
      ).rejects.toThrow("authorPub inválido: esperado 32 bytes");

      // privateKey com tamanho errado
      await expect(
        packDocument(
          {
            docType: DocType.PICK,
            authorPub: pub,
            seq: 1,
            blocks: [createPickTargetBlock(1)],
          },
          new Uint8Array(16)
        )
      ).rejects.toThrow("privateKey deve ter 32 bytes");
    });

    it("lança erro ao desempacotar pacotes com cabeçalho truncado ou versão errada", async () => {
      // Pacote com menos de 102 bytes
      await expect(unpackAndVerifyDocument(new Uint8Array(101))).rejects.toThrow(
        "Pacote binário truncado: esperado no mínimo 102 bytes"
      );

      // Versão inválida no byte 0
      const invalidVersion = new Uint8Array(102);
      invalidVersion[0] = 99;
      await expect(unpackAndVerifyDocument(invalidVersion)).rejects.toThrow(
        "Versão desconhecida do protocolo: 99"
      );
    });
  });
});
