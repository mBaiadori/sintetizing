import { ConsolidatedProposal, SubjectStateEngine } from "@sintetizing/wire";
import { SubjectProjection } from "./types.js";
export interface ProjectSubjectOptions {
    readonly nowUnixSeconds: number;
    readonly scope: string;
    readonly defaultQuorumPct?: number;
    readonly minParticipants?: number;
    readonly currentUserPubHex?: string;
}
export interface ProposalLineageGraph {
    readonly parentsMap: ReadonlyMap<string, readonly string[]>;
    readonly childrenMap: ReadonlyMap<string, readonly string[]>;
    readonly depthMap: ReadonlyMap<string, number>;
    readonly roots: readonly string[];
}
/**
 * Calcula quantos apoios são necessários para atingir a meta percentual de quórum.
 */
export declare function computeQuorumRequired(effectiveParticipantCount: number, quorumTargetPct: number): number;
/**
 * Constrói a linhagem DAG (pai -> filhos e profundidade) das propostas de um assunto.
 * Protegido contra ciclos por meio de conjunto de nós em visitação.
 */
export declare function buildProposalLineage(proposals: readonly ConsolidatedProposal[]): ProposalLineageGraph;
/**
 * Projeta de forma pura o estado completo de um Subject para a UI:
 * placar ranqueado, quórum, status de ciclo de vida e posição do usuário atual.
 */
export declare function projectSubjectState(engine: SubjectStateEngine, options: ProjectSubjectOptions): SubjectProjection;
/**
 * Indica se o assunto ainda aceita novas propostas, forks ou transferências de apoio.
 */
export declare function canMutateSubject(projection: SubjectProjection): boolean;
//# sourceMappingURL=subject-projection.d.ts.map