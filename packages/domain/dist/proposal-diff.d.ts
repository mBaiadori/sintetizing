import { ConsolidatedProposal } from "@sintetizing/wire";
import { ProposalDiffResult, WordDiffSegment } from "./types.js";
/**
 * Calcula Diff por palavras (LCS) entre dois textos, coalescendo segmentos contíguos do mesmo tipo.
 */
export declare function diffWords(left: string, right: string): readonly WordDiffSegment[];
/**
 * Comparador Universal N x N: compara quaisquer duas propostas da árvore campo a campo.
 */
export declare function diffProposals(left: ConsolidatedProposal, right: ConsolidatedProposal): ProposalDiffResult;
//# sourceMappingURL=proposal-diff.d.ts.map