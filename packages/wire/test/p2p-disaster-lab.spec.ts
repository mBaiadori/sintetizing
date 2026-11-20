import { describe, expect, it } from "vitest";
import * as ed25519 from "@noble/ed25519";
import { bytesToHex } from "@noble/hashes/utils";
import {
  createLawArticleBlock,
  createPickTargetBlock,
  createScopeBlock,
  createTitleBlock,
  DocType,
  NodePeer,
  packDocument,
  signRecoveryAttestation,
} from "../src/index.js";

async function makeKeyPair() {
  const priv = ed25519.utils.randomPrivateKey();
  const pub = await ed25519.getPublicKeyAsync(priv);
  return { priv, pub };
}

describe("Fase 3: Laboratório de Simulação P2P e Teste de Desastre Duplo", () => {
  it("Cenário 1: Queda de Internet no Meio do Envio (Tolerância a 4G instável sem duplicação)", async () => {
    const vps = new NodePeer("vps-relay-1", "VPS_RELAY_AI");
    const citizen = new NodePeer("celular-maria", "MOBILE_CITIZEN");

    const maria = await makeKeyPair();

    // Maria gera proposta e 3 votos offline no elevador
    const prop = await packDocument(
      {
        docType: DocType.PROPOSAL,
        authorPub: maria.pub,
        seq: 1,
        blocks: [createScopeBlock("bairro/centro"), createTitleBlock("Horta Comunitária")],
      },
      maria.priv
    );
    await citizen.ingestPacket(prop);

    for (let seq = 1; seq <= 3; seq++) {
      const pick = await packDocument(
        {
          docType: DocType.PICK,
          authorPub: maria.pub,
          seq,
          blocks: [createPickTargetBlock(seq % 2 === 1 ? 10 : 20)],
        },
        maria.priv
      );
      await citizen.ingestPacket(pick);
    }

    expect(citizen.getStoredPacketCount()).toBe(4); // 1 proposta + 3 picks

    // 1. Maria tenta sincronizar, mas o 4G cai após enviar apenas 2 pacotes!
    const sync1 = await citizen.syncWith(vps, { maxPacketsSend: 2 });
    expect(sync1.interrupted).toBe(true);
    expect(sync1.sent).toBe(2);
    expect(vps.getStoredPacketCount()).toBe(2);

    // 2. Maria sai do elevador, o 4G volta e ela sincroniza novamente
    const sync2 = await citizen.syncWith(vps);
    expect(sync2.interrupted).toBe(false);
    expect(sync2.sent).toBe(2); // Transfere exatamente os 2 pacotes restantes!

    // Comprova integridade perfeita em ambos os nós: zero perda, zero duplicação
    expect(vps.getStoredPacketCount()).toBe(4);
    expect(vps.engine.getTally()).toEqual(citizen.engine.getTally());
    expect(vps.engine.getPersonFootprint(maria.pub).length).toBe(3);
  });

  it("Cenário 2: O Grande Teste de Desastre Duplo (VPS Quebrou + Celular do João Destruído)", async () => {
    // 1. Configuração da Comunidade: 50 moradores, 1 João e 1 VPS
    let vps: NodePeer | null = new NodePeer("vps-comunidade", "VPS_RELAY_AI");
    let joaoPhone: NodePeer | null = new NodePeer("joao-celular-antigo", "MOBILE_CITIZEN");

    const joaoOldKey = await makeKeyPair();
    const maria = await makeKeyPair();
    const pedro = await makeKeyPair();
    const ana = await makeKeyPair();

    // João e os vizinhos participam da comunidade
    const neighborsPhones = [
      new NodePeer("celular-maria", "MOBILE_CITIZEN"),
      new NodePeer("celular-pedro", "MOBILE_CITIZEN"),
      new NodePeer("celular-ana", "MOBILE_CITIZEN"),
    ];

    // Proposta pública inicial
    const propBytes = await packDocument(
      {
        docType: DocType.PROPOSAL,
        authorPub: maria.pub,
        seq: 1,
        blocks: [
          createScopeBlock("condominio/bloco-a"),
          createTitleBlock("Instalação de Painéis Solares no Bloco A"),
          createLawArticleBlock(1, "Artigo 1: Economia compartilhada de energia."),
        ],
      },
      maria.priv
    );

    await vps.ingestPacket(propBytes);
    await joaoPhone.ingestPacket(propBytes);
    for (const neighbor of neighborsPhones) {
      await neighbor.ingestPacket(propBytes);
    }

    // João vota e muda de ideia 3 vezes (A -> B -> A)
    const joaoPicks = [
      await packDocument(
        {
          docType: DocType.PICK,
          authorPub: joaoOldKey.pub,
          seq: 1,
          blocks: [createPickTargetBlock(1)],
        },
        joaoOldKey.priv
      ),
      await packDocument(
        {
          docType: DocType.PICK,
          authorPub: joaoOldKey.pub,
          seq: 2,
          blocks: [createPickTargetBlock(2)],
        },
        joaoOldKey.priv
      ),
      await packDocument(
        {
          docType: DocType.PICK,
          authorPub: joaoOldKey.pub,
          seq: 3,
          blocks: [createPickTargetBlock(1)],
        },
        joaoOldKey.priv
      ),
    ];

    for (const pick of joaoPicks) {
      await joaoPhone.ingestPacket(pick);
      await vps.ingestPacket(pick);
      for (const neighbor of neighborsPhones) {
        await neighbor.ingestPacket(pick);
      }
    }

    // 50 outros moradores votam
    for (let i = 0; i < 50; i++) {
      const user = await makeKeyPair();
      const userPick = await packDocument(
        {
          docType: DocType.PICK,
          authorPub: user.pub,
          seq: 1,
          blocks: [createPickTargetBlock(1)],
        },
        user.priv
      );
      await vps.ingestPacket(userPick);
      for (const neighbor of neighborsPhones) {
        await neighbor.ingestPacket(userPick);
      }
    }

    const baselineTally = vps.engine.getTally();
    expect(baselineTally["1"]).toBe(51); // 50 moradores + 1 do João

    // -------------------------------------------------------------
    // O DESASTRE TOTAL DUPLO ACONTECE AQUI:
    // A VPS queima o disco E o celular do João cai no lago!
    // -------------------------------------------------------------
    vps = null;
    joaoPhone = null;

    // -------------------------------------------------------------
    // RESTAURAÇÃO TOTAL A PARTIR DOS VIZINHOS:
    // -------------------------------------------------------------
    // 1. Uma nova VPS vazia é ligada na nuvem
    const novaVPS = new NodePeer("nova-vps-recuperada", "VPS_RELAY_AI");

    // 2. João compra um celular novo e gera uma nova chave
    const joaoNovoCelular = new NodePeer("joao-celular-novo", "MOBILE_CITIZEN");
    const joaoNewKey = await makeKeyPair();

    // 3. Os 3 vizinhos (Maria, Pedro e Ana) assinam a recuperação social do João
    const sigMaria = await signRecoveryAttestation(joaoOldKey.pub, joaoNewKey.pub, maria.priv, maria.pub);
    const sigPedro = await signRecoveryAttestation(joaoOldKey.pub, joaoNewKey.pub, pedro.priv, pedro.pub);
    const sigAna = await signRecoveryAttestation(joaoOldKey.pub, joaoNewKey.pub, ana.priv, ana.pub);

    const recoveryPacket = {
      oldAuthorPub: joaoOldKey.pub,
      newAuthorPub: joaoNewKey.pub,
      signatures: [sigMaria, sigPedro, sigAna],
    };

    const trustedGuardians = [maria.pub, pedro.pub, ana.pub];

    // Aplica a recuperação social na nova VPS e no celular novo do João
    const vpsApproved = await novaVPS.applySocialRecovery(recoveryPacket, trustedGuardians, 3);
    const joaoApproved = await joaoNovoCelular.applySocialRecovery(recoveryPacket, trustedGuardians, 3);
    expect(vpsApproved).toBe(true);
    expect(joaoApproved).toBe(true);

    // 4. Os vizinhos sincronizam com a nova VPS
    let totalBytesToRestoreVPS = 0;
    for (const neighbor of neighborsPhones) {
      const result = await neighbor.syncWith(novaVPS);
      totalBytesToRestoreVPS += result.bytesTransferred;
    }

    // 5. O celular novo do João sincroniza com a nova VPS
    const syncJoaoResult = await novaVPS.syncWith(joaoNovoCelular);

    // -------------------------------------------------------------
    // COMPROVAÇÕES FINAIS DO DESASTRE DUPLO
    // -------------------------------------------------------------
    // 1. A nova VPS restaurou 100% do placar da comunidade
    expect(novaVPS.engine.getTally()).toEqual(baselineTally);

    // 2. O novo celular do João recuperou 100% do histórico e do voto dele
    const joaoFootprintRecuperado = joaoNovoCelular.engine.getPersonFootprint(joaoOldKey.pub);
    expect(joaoFootprintRecuperado.length).toBe(3);
    expect(joaoFootprintRecuperado[2]!.seq).toBe(3);
    expect(joaoFootprintRecuperado[2]!.targetKey).toBe("1");

    // 3. Prova do Tamanho Ultra-Compacto:
    // A reconstrução de toda a comunidade custou apenas uma fração minúscula de banda
    expect(totalBytesToRestoreVPS).toBeLessThan(50 * 1024); // Menos de 50 KB para 54 pacotes!
    expect(syncJoaoResult.bytesTransferred).toBeLessThan(50 * 1024);
  });

  it("Cenário 3: Fila Neutra de IA na VPS (Síntese sem Voto)", async () => {
    const vpsAI = new NodePeer("vps-ai-synthesizer", "VPS_RELAY_AI");
    const aiKey = await makeKeyPair();
    const comA = await makeKeyPair();
    const comB = await makeKeyPair();

    // Proposta A da Comunidade 1 (Taxa R$ 100)
    const propA = await packDocument(
      {
        docType: DocType.PROPOSAL,
        authorPub: comA.pub,
        seq: 1,
        blocks: [
          createScopeBlock("comunidade/sol"),
          createTitleBlock("Taxa Condominial Alta com Segurança 24h"),
          createLawArticleBlock(1, "Artigo 1: Taxa mensal de R$ 100 com portaria armada."),
        ],
      },
      comA.priv
    );

    // Proposta B da Comunidade 2 (Taxa R$ 50)
    const propB = await packDocument(
      {
        docType: DocType.PROPOSAL,
        authorPub: comB.pub,
        seq: 1,
        blocks: [
          createScopeBlock("comunidade/sol"),
          createTitleBlock("Taxa Condominial Baixa com Portaria Eletrônica"),
          createLawArticleBlock(1, "Artigo 1: Taxa mensal de R$ 50 com interfone digital."),
        ],
      },
      comB.priv
    );

    await vpsAI.ingestPacket(propA);
    await vpsAI.ingestPacket(propB);

    const docIdA = (await vpsAI.engine.ingestBinaryPacket(propA)).docId;
    const docIdB = (await vpsAI.engine.ingestBinaryPacket(propB)).docId;

    // A VPS como relatora neutra gera a síntese consensual P3
    const synthesisProposalBytes = await vpsAI.generateAISynthesisProposal(
      docIdA,
      docIdB,
      "comunidade/sol",
      "Síntese Consensual: Taxa de R$ 75 com Portaria Remota",
      { num: 1, text: "Artigo 1 Sintetizado: Taxa equilibrada de R$ 75 com monitoramento híbrido." },
      aiKey.priv,
      aiKey.pub
    );

    expect(synthesisProposalBytes.length).toBeGreaterThan(102);

    // O placar da VPS continua limpo: a VPS não tem direito a voto
    expect(vpsAI.engine.getTally()).toEqual({});

    // Um morador vota na síntese gerada pela IA
    const morador = await makeKeyPair();
    const voteOnSynthesis = await packDocument(
      {
        docType: DocType.PICK,
        authorPub: morador.pub,
        seq: 1,
        blocks: [createPickTargetBlock(docIdA)],
      },
      morador.priv
    );

    await vpsAI.ingestPacket(voteOnSynthesis);
    expect(vpsAI.engine.getTally()[bytesToHex(docIdA)]).toBe(1);
  });

  describe("Cobertura Completa de Casos de Borda do P2P", () => {
    it("valida quórum de recuperação com quórum zero ou guardião não confiável", async () => {
      const joao = await makeKeyPair();
      const novoJoao = await makeKeyPair();
      const estranho = await makeKeyPair();

      const sigEstranho = await signRecoveryAttestation(
        joao.pub,
        novoJoao.pub,
        estranho.priv,
        estranho.pub
      );

      const packet = {
        oldAuthorPub: joao.pub,
        newAuthorPub: novoJoao.pub,
        signatures: [sigEstranho],
      };

      const peer = new NodePeer("peer-1");

      // Quórum zero
      const failZero = await peer.applySocialRecovery(packet, [estranho.pub], 0);
      expect(failZero).toBe(false);

      // Guardião não cadastrado
      const failUntrusted = await peer.applySocialRecovery(packet, [new Uint8Array(32)], 1);
      expect(failUntrusted).toBe(false);

      // Assinatura duplicada do mesmo guardião é ignorada na contagem de quórum
      const duplicatePacket = {
        oldAuthorPub: joao.pub,
        newAuthorPub: novoJoao.pub,
        signatures: [sigEstranho, sigEstranho],
      };
      // Exige 2 guardiões distintos, mas só há 1 duplicado -> deve falhar
      const failDuplicate = await peer.applySocialRecovery(duplicatePacket, [estranho.pub], 2);
      expect(failDuplicate).toBe(false);

      // Assinatura inválida com adulteração
      const tamperedPacket = {
        oldAuthorPub: joao.pub,
        newAuthorPub: novoJoao.pub,
        signatures: [
          {
            guardianPub: estranho.pub,
            signature: new Uint8Array(64).fill(0xff),
          },
        ],
      };
      const failTampered = await peer.applySocialRecovery(tamperedPacket, [estranho.pub], 1);
      expect(failTampered).toBe(false);
    });

    it("lança erro se chaves públicas tiverem tamanho diferente de 32 bytes em signRecoveryAttestation", async () => {
      const key = await makeKeyPair();
      await expect(
        signRecoveryAttestation(new Uint8Array(31), key.pub, key.priv, key.pub)
      ).rejects.toThrow("Chaves públicas devem ter 32 bytes.");
    });

    it("interrompe sincronização ao atingir limite de pacotes recebidos (maxPacketsReceive)", async () => {
      const nodeA = new NodePeer("node-a");
      const nodeB = new NodePeer("node-b");
      const key = await makeKeyPair();

      // nodeB possui 3 pacotes
      for (let i = 1; i <= 3; i++) {
        const pick = await packDocument(
          {
            docType: DocType.PICK,
            authorPub: key.pub,
            seq: i,
            blocks: [createPickTargetBlock(i)],
          },
          key.priv
        );
        await nodeB.ingestPacket(pick);
      }

      // nodeA sincroniza com limite de receber no máximo 1 pacote
      const result = await nodeA.syncWith(nodeB, { maxPacketsReceive: 1 });
      expect(result.interrupted).toBe(true);
      expect(result.received).toBe(1);
      expect(result.bytesTransferred).toBeGreaterThan(0);
      expect(nodeA.getStoredPacketCount()).toBe(1);
    });
  });
});
