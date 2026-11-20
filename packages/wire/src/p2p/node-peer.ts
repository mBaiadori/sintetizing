import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { calculateDocId, packDocument, unpackAndVerifyDocument } from "../envelope.js";
import { SubjectStateEngine } from "../state/subject-engine.js";
import { DocType } from "../types.js";
import {
  createLawArticleBlock,
  createParentHashBlock,
  createScopeBlock,
  createTitleBlock,
} from "../validators.js";
import {
  SocialRecoveryPacket,
  verifyRecoveryQuorum,
} from "./social-recovery.js";

export type NodeType = "MOBILE_CITIZEN" | "VPS_RELAY_AI";

export interface SyncHello {
  readonly knownProposals: readonly string[];
  readonly knownSeqs: Readonly<Record<string, number>>;
}

export interface StoredPacketEntry {
  readonly docIdHex: string;
  readonly docType: number;
  readonly authorHex: string;
  readonly seq: number;
  readonly rawBytes: Uint8Array;
}

export interface SyncResult {
  readonly sent: number;
  readonly received: number;
  readonly bytesTransferred: number;
  readonly interrupted: boolean;
}

/**
 * Representa um Nó na rede P2P (Celular de Cidadão ou VPS / Nó Neutro de IA).
 * Gerencia persistência local de pacotes binários, sincronização bidirecional (Hello/Delta)
 * e tolerância a quedas parciais de rede.
 */
export class NodePeer {
  public readonly engine = new SubjectStateEngine();
  private readonly packetStore = new Map<string, StoredPacketEntry>();
  private readonly recoveredIdentities = new Map<string, string>(); // oldHex -> newHex

  constructor(
    public readonly nodeId: string,
    public readonly nodeType: NodeType = "MOBILE_CITIZEN"
  ) {}

  /**
   * Ingere e armazena um pacote binário (.stze) validado no nó.
   */
  public async ingestPacket(rawBytes: Uint8Array): Promise<boolean> {
    const docId = calculateDocId(rawBytes);
    const docIdHex = bytesToHex(docId);

    // Idempotência: se já temos exatamente este pacote, ignora sem reprocessar
    if (this.packetStore.has(docIdHex)) {
      return false;
    }

    const doc = await unpackAndVerifyDocument(rawBytes);
    let effectiveAuthorPub = doc.authorPub;
    const originalAuthorHex = bytesToHex(doc.authorPub);

    // Se este autor teve sua identidade recuperada por uma nova chave, reconhece a sucessão
    const mappedNewHex = this.recoveredIdentities.get(originalAuthorHex);
    if (mappedNewHex) {
      effectiveAuthorPub = hexToBytes(mappedNewHex);
    }

    // Ingere no motor de estado
    await this.engine.ingestBinaryPacket(rawBytes);

    this.packetStore.set(docIdHex, {
      docIdHex,
      docType: doc.docType,
      authorHex: bytesToHex(effectiveAuthorPub),
      seq: doc.seq,
      rawBytes: new Uint8Array(rawBytes),
    });

    return true;
  }

  /**
   * Gera o resumo compacto do que este nó possui (SyncHello).
   * Contém apenas os IDs de propostas e o maior seq de cada morador.
   */
  public generateSyncHello(): SyncHello {
    const knownProposals: string[] = [];
    const knownSeqs: Record<string, number> = {};

    for (const entry of this.packetStore.values()) {
      if (entry.docType === DocType.PROPOSAL) {
        knownProposals.push(entry.docIdHex);
      } else {
        const cur = knownSeqs[entry.authorHex] ?? 0;
        if (entry.seq > cur) {
          knownSeqs[entry.authorHex] = entry.seq;
        }
      }
    }

    return { knownProposals, knownSeqs };
  }

  /**
   * Calcula o delta de pacotes que faltam no interlocutor baseado no SyncHello dele.
   */
  public computeSyncDelta(remoteHello: SyncHello): Uint8Array[] {
    const delta: Uint8Array[] = [];
    const remoteProposalsSet = new Set(remoteHello.knownProposals);

    for (const entry of this.packetStore.values()) {
      if (entry.docType === DocType.PROPOSAL) {
        if (!remoteProposalsSet.has(entry.docIdHex)) {
          delta.push(entry.rawBytes);
        }
      } else {
        const remoteSeq = remoteHello.knownSeqs[entry.authorHex] ?? 0;
        // Envia se o interlocutor não tiver ou tiver versão anterior
        if (entry.seq > remoteSeq) {
          delta.push(entry.rawBytes);
        }
      }
    }

    return delta;
  }

  /**
   * Realiza a sincronização bidirecional entre este nó e outro nó.
   * Suporta interrupções intencionais para testar tolerância a quedas de rede (4G caindo).
   */
  public async syncWith(
    remote: NodePeer,
    options?: { maxPacketsSend?: number; maxPacketsReceive?: number }
  ): Promise<SyncResult> {
    const localHello = this.generateSyncHello();
    const remoteHello = remote.generateSyncHello();

    const toSend = this.computeSyncDelta(remoteHello);
    const toReceive = remote.computeSyncDelta(localHello);

    let sent = 0;
    let received = 0;
    let bytesTransferred = 0;
    let interrupted = false;

    // 1. Envia para o remoto
    const limitSend = options?.maxPacketsSend ?? Infinity;
    for (const packet of toSend) {
      if (sent >= limitSend) {
        interrupted = true;
        break;
      }
      const ingested = await remote.ingestPacket(packet);
      if (ingested) {
        bytesTransferred += packet.length;
      }
      sent++;
    }

    // 2. Recebe do remoto
    const limitReceive = options?.maxPacketsReceive ?? Infinity;
    for (const packet of toReceive) {
      if (received >= limitReceive) {
        interrupted = true;
        break;
      }
      const ingested = await this.ingestPacket(packet);
      if (ingested) {
        bytesTransferred += packet.length;
      }
      received++;
    }

    return {
      sent,
      received,
      bytesTransferred,
      interrupted,
    };
  }

  /**
   * Aplica a recuperação social de um vizinho após validação de quórum com guardiões.
   * Registra a nova chave como sucessora legítima da chave antiga.
   */
  public async applySocialRecovery(
    packet: SocialRecoveryPacket,
    trustedGuardians: readonly Uint8Array[],
    requiredQuorum: number
  ): Promise<boolean> {
    const isValid = await verifyRecoveryQuorum(packet, trustedGuardians, requiredQuorum);
    if (!isValid) {
      return false;
    }

    const oldHex = bytesToHex(packet.oldAuthorPub);
    const newHex = bytesToHex(packet.newAuthorPub);
    this.recoveredIdentities.set(oldHex, newHex);

    return true;
  }

  /**
   * Gera uma Proposta de Síntese da IA (executada por uma VPS neutra).
   * Aponta para duas propostas divergentes (PARENT_HASH) e propõe uma nova redação consolidada
   * sem que a VPS vote em nada.
   */
  public async generateAISynthesisProposal(
    parentDocId1: Uint8Array,
    parentDocId2: Uint8Array,
    scope: string,
    title: string,
    synthesisArticle: { num: number; text: string },
    aiPrivKey: Uint8Array,
    aiPubKey: Uint8Array
  ): Promise<Uint8Array> {
    const proposal = await packDocument(
      {
        docType: DocType.PROPOSAL,
        authorPub: aiPubKey,
        seq: 1,
        blocks: [
          createScopeBlock(scope),
          createTitleBlock(title),
          createParentHashBlock(parentDocId1),
          createParentHashBlock(parentDocId2),
          createLawArticleBlock(synthesisArticle.num, synthesisArticle.text),
        ],
      },
      aiPrivKey
    );

    await this.ingestPacket(proposal);
    return proposal;
  }

  /**
   * Retorna a quantidade total de pacotes armazenados no nó.
   */
  public getStoredPacketCount(): number {
    return this.packetStore.size;
  }

  /**
   * Retorna todos os pacotes binários armazenados no nó ordenados deterministamente por docId.
   */
  public getAllStoredPackets(): Uint8Array[] {
    return Array.from(this.packetStore.values())
      .sort((a, b) => a.docIdHex.localeCompare(b.docIdHex))
      .map((e) => e.rawBytes);
  }
}
