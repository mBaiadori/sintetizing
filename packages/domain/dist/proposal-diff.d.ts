import type { ProposalFieldView, ProposalSummaryView } from "./types.js";
export type FieldDiffStatus = "IDENTICAL" | "MODIFIED" | "ADDED" | "REMOVED";
export interface ProposalFieldDiffEntry {
    readonly key: string;
    readonly status: FieldDiffStatus;
    readonly baseField: ProposalFieldView | null;
    readonly targetField: ProposalFieldView | null;
}
export interface ProposalDiffSummary {
    readonly identical: number;
    readonly modified: number;
    readonly added: number;
    readonly removed: number;
}
export interface ProposalDiffResult {
    readonly baseDocIdHex: string;
    readonly targetDocIdHex: string;
    readonly titleChanged: boolean;
    readonly baseTitle: string;
    readonly targetTitle: string;
    readonly deadlineChanged: boolean;
    readonly baseDeadlineUnixSeconds: number | null;
    readonly targetDeadlineUnixSeconds: number | null;
    readonly fields: readonly ProposalFieldDiffEntry[];
    readonly summary: ProposalDiffSummary;
}
/**
 * Compara duas propostas (N x N) pareando blocos primeiro por fieldId (exato para Forks)
 * e depois por (kind + rótulo normalizado) para propostas independentes.
 */
export declare function diffProposals(base: ProposalSummaryView, target: ProposalSummaryView): ProposalDiffResult;
//# sourceMappingURL=proposal-diff.d.ts.map