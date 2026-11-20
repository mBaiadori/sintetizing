import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { calculateDocId, packDocument, unpackAndVerifyDocument } from "../envelope.js";
import {
  BinaryDocument,
  DocType,
  Tag,
} from "../types.js";
import {
  createParentHashBlock,
  createPickTargetBlock,
  readLawArticleBlock,
  readPickTargetBlock,
  readUtf8Block,
} from "../validators.js";
import { calculateMerkleRoot } from "./merkle.js";

export interface StoredProposal {
  readonly docId: Uint8Array;
  readonly docIdHex: string;
  readonly doc: BinaryDocument;
  readonly rawBytes: Uint8Array;
}

export interface ActivePick {
  readonly seq: number;
  readonly targetKey: string;
  readonly authorPub: Uint8Array;
  readonly rawBytes: Uint8Array;
}

export interface FootprintEntry {
  readonly seq: number;
  readonly targetKey: string;
  readonly docId: Uint8Array;
  readonly rawBytes: Uint8Array;
}

export interface ConsolidatedProposal {
  readonly docId: Uint8Array;
  readonly docIdHex: string;
  readonly title: string;
  readonly scope: string;
  readonly articles: ReadonlyMap<number, string>;
  readonly parentHashes: readonly Uint8Array[];
}

/**
 * Motor de Memória e Estado de um Assunto (SubjectStateEngine).
 * Executa em celulares ou nós servidores/VPS sem banco de dados pesado.
 */
export class SubjectStateEngine {
  private readonly proposals = new Map<string, StoredProposal>();
  private readonly activePicks = new Map<string, ActivePick>();
  private readonly footprints = new Map<string, FootprintEntry[]>();
  private readonly tally = new Map<string, number>();

  /**
   * Ingere qualquer pacote binário validado (.stz).
   * Desempacota, checa assinatura Ed25519, previne ataques de replay
   * e atualiza o placar e footprint atomicamente.
   */
  public async ingestBinaryPacket(rawBytes: Uint8Array): Promise<{
    docType: number;
    docId: Uint8Array;
    action: "PROPOSAL_STORED" | "PICK_APPLIED" | "COMMUNITY_PICK_APPLIED";
  }> {
    const doc = await unpackAndVerifyDocument(rawBytes);
    const docId = calculateDocId(rawBytes);
    const docIdHex = bytesToHex(docId);
    const authorHex = bytesToHex(doc.authorPub);

    if (doc.docType === DocType.PROPOSAL) {
      if (!this.proposals.has(docIdHex)) {
        this.proposals.set(docIdHex, {
          docId,
          docIdHex,
          doc,
          rawBytes: new Uint8Array(rawBytes),
        });
      }
      return { docType: doc.docType, docId, action: "PROPOSAL_STORED" };
    }

    if (doc.docType === DocType.PICK || doc.docType === DocType.COMMUNITY_PICK) {
      const targetBlock = doc.blocks.find((b) => b.tag === Tag.PICK_TARGET);
      if (!targetBlock) {
        throw new Error("Pacote de PICK sem bloco PICK_TARGET.");
      }

      const targetInfo = readPickTargetBlock(targetBlock);
      const targetKey =
        targetInfo.targetSeq !== undefined
          ? String(targetInfo.targetSeq)
          : bytesToHex(targetInfo.targetHash!);

      const currentPick = this.activePicks.get(authorHex);

      // 1. Verificação Anti-Replay (Proteção contra voto antigo)
      if (currentPick !== undefined && doc.seq <= currentPick.seq) {
        throw new Error(
          `Ataque de replay detectado: pacote seq ${doc.seq} é menor ou igual ao seq ativo atual ${currentPick.seq}.`
        );
      }

      const isRemovalOfSupport =
        targetKey === "0" ||
        targetKey === "0000000000000000000000000000000000000000000000000000000000000000";

      // 2. Atualização Atômica do Placar de Apoios (Tally)
      // Se havia um apoio ativo anterior, remove do placar
      if (currentPick !== undefined) {
        const prevCount = this.tally.get(currentPick.targetKey);
        if (prevCount !== undefined) {
          const newCount = prevCount - 1;
          if (newCount <= 0) {
            this.tally.delete(currentPick.targetKey);
          } else {
            this.tally.set(currentPick.targetKey, newCount);
          }
        }
      }

      // Se não for uma remoção deliberada de apoio (0), adiciona o apoio à nova proposta
      if (!isRemovalOfSupport) {
        const currentCount = this.tally.get(targetKey) ?? 0;
        this.tally.set(targetKey, currentCount + 1);
      }

      // 3. Substituição no Placar Ativo
      this.activePicks.set(authorHex, {
        seq: doc.seq,
        targetKey,
        authorPub: doc.authorPub,
        rawBytes: new Uint8Array(rawBytes),
      });

      // 4. Registro no Footprint encadeado (Auditoria de histórico)
      let authorFootprint = this.footprints.get(authorHex);
      if (!authorFootprint) {
        authorFootprint = [];
        this.footprints.set(authorHex, authorFootprint);
      }
      authorFootprint.push({
        seq: doc.seq,
        targetKey,
        docId,
        rawBytes: new Uint8Array(rawBytes),
      });

      const action =
        doc.docType === DocType.PICK ? "PICK_APPLIED" : "COMMUNITY_PICK_APPLIED";
      return { docType: doc.docType, docId, action };
    }

    throw new Error(`Tipo de documento não processado pelo motor de estado: ${doc.docType}`);
  }

  /**
   * Retorna o placar consolidado de votos ativos para cada opção.
   */
  public getTally(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.tally.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Retorna o voto ativo de um determinado autor.
   */
  public getActivePick(authorPub: Uint8Array): ActivePick | undefined {
    return this.activePicks.get(bytesToHex(authorPub));
  }

  /**
   * Retorna a fita sequencial completa de mudanças de opinião (Footprint) de um autor.
   */
  public getPersonFootprint(authorPub: Uint8Array): readonly FootprintEntry[] {
    return this.footprints.get(bytesToHex(authorPub)) ?? [];
  }

  /**
   * Retorna todos os votos ativos na comunidade.
   */
  public getActivePicks(): readonly ActivePick[] {
    return Array.from(this.activePicks.values());
  }

  /**
   * Calcula deterministamente a Raiz Merkle de todos os votos ativos.
   */
  public calculateActivePicksMerkleRoot(): Uint8Array {
    if (this.activePicks.size === 0) {
      return new Uint8Array(32);
    }
    const pickPackets = Array.from(this.activePicks.values())
      .map((p) => p.rawBytes)
      .sort((a, b) => bytesToHex(a).localeCompare(bytesToHex(b)));
    return calculateMerkleRoot(pickPackets);
  }

  /**
   * Retorna uma proposta armazenada pelo seu hash.
   */
  public getProposal(docId: Uint8Array): StoredProposal | undefined {
    return this.proposals.get(bytesToHex(docId));
  }

  /**
   * Consolida a redação de uma proposta e suas emendas de artigos de lei herdando os artigos
   * da proposta-mãe (PARENT_HASH) e substituindo os artigos emendados.
   */
  public resolveConsolidatedProposal(proposalDocId: Uint8Array): ConsolidatedProposal {
    const idHex = bytesToHex(proposalDocId);
    const stored = this.proposals.get(idHex);
    if (!stored) {
      throw new Error(`Proposta não encontrada no motor de estado: ${idHex}`);
    }

    const { doc } = stored;
    const parentHashes: Uint8Array[] = [];
    const articlesMap = new Map<number, string>();

    let title = "";
    let scope = "";

    // 1. Se tem proposta-mãe, carrega os artigos da mãe primeiro
    for (const block of doc.blocks) {
      if (block.tag === Tag.PARENT_HASH) {
        parentHashes.push(block.value);
        const parentIdHex = bytesToHex(block.value);
        const parentStored = this.proposals.get(parentIdHex);
        if (parentStored) {
          const parentConsolidated = this.resolveConsolidatedProposal(block.value);
          for (const [num, text] of parentConsolidated.articles.entries()) {
            articlesMap.set(num, text);
          }
        }
      } else if (block.tag === Tag.TITLE) {
        title = readUtf8Block(block);
      } else if (block.tag === Tag.SCOPE) {
        scope = readUtf8Block(block);
      }
    }

    // 2. Os artigos trazidos na proposta atual substituem ou adicionam sobre os herdados
    for (const block of doc.blocks) {
      if (block.tag === Tag.LAW_ARTICLE) {
        const { articleNum, text } = readLawArticleBlock(block);
        articlesMap.set(articleNum, text);
      }
    }

    return {
      docId: proposalDocId,
      docIdHex: idHex,
      title,
      scope,
      articles: articlesMap,
      parentHashes,
    };
  }

  /**
   * Gera o pacote de Rollup de Comunidade (docType = 3) contendo a opção vencedora local
   * e a Raiz Merkle de 32 bytes de todos os votos ativos dos moradores.
   */
  public async exportCommunityRollupPick(
    communityPrivKey: Uint8Array,
    communityPubKey: Uint8Array,
    seq: number
  ): Promise<Uint8Array> {
    if (this.activePicks.size === 0) {
      throw new Error("Não há votos ativos na comunidade para gerar o rollup.");
    }

    // Descobre o alvo com mais votos no placar
    let leadingTarget = "";
    let maxVotes = -1;
    for (const [targetKey, votes] of this.tally.entries()) {
      if (votes > maxVotes) {
        maxVotes = votes;
        leadingTarget = targetKey;
      }
    }

    // Coleta todos os pacotes brutos dos picks ativos para construir a árvore Merkle
    const pickPackets = Array.from(this.activePicks.values()).map((p) => p.rawBytes);
    const merkleRoot = calculateMerkleRoot(pickPackets);

    // Constrói o bloco de target (numérico ou hash)
    const isNumeric = /^\d+$/.test(leadingTarget);
    const targetBlock = isNumeric
      ? createPickTargetBlock(Number(leadingTarget))
      : createPickTargetBlock(hexToBytes(leadingTarget));

    // Bloco da raiz Merkle anexado como PARENT_HASH comprovando a base de votos
    const merkleBlock = createParentHashBlock(merkleRoot);

    return await packDocument(
      {
        docType: DocType.COMMUNITY_PICK,
        authorPub: communityPubKey,
        seq,
        blocks: [targetBlock, merkleBlock],
      },
      communityPrivKey
    );
  }
}
