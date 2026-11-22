import type { ProposalFieldView, ProposalTemplateSummaryView, TemplateCategorySummaryView } from "./types.js";
export declare const BUILTIN_TEMPLATE_CATEGORY_IDS: {
    readonly PROCUREMENT: "0000000000000000000000000000000000000000000000000000000074636131";
    readonly RULES: "0000000000000000000000000000000000000000000000000000000074636132";
    readonly ACTIONS: "0000000000000000000000000000000000000000000000000000000074636133";
};
export declare const BUILTIN_TEMPLATE_IDS: {
    readonly PURCHASE_WORK: "0000000000000000000000000000000000000000000000000000000074706c31";
    readonly REIMBURSEMENT: "0000000000000000000000000000000000000000000000000000000074706c32";
    readonly RULE_CHANGE: "0000000000000000000000000000000000000000000000000000000074706c33";
    readonly EVENT_ACTION: "0000000000000000000000000000000000000000000000000000000074706c34";
};
export declare const BUILTIN_TEMPLATE_CATEGORIES: readonly TemplateCategorySummaryView[];
export declare const BUILTIN_PROPOSAL_TEMPLATES: readonly ProposalTemplateSummaryView[];
export declare function getTemplatePickScope(communityId: string, categoryId: string): string;
export declare function parseTemplateCategoryFromScope(communityId: string, scope: string): string | null;
/**
 * Clona os campos de um template preservando os `fieldId`s originais para
 * maximizar a precisão do Diff Universal (N x N) entre propostas que usam o mesmo modelo.
 */
export declare function instantiateTemplateFields(fields: readonly ProposalFieldView[], clearExamples?: boolean): ProposalFieldView[];
/**
 * Converte os campos concretos de uma proposta existente em exemplos didáticos
 * válidos pelas regras do protocolo TLV para criação de um novo template.
 */
export declare function convertProposalFieldsToTemplateExamples(fields: readonly ProposalFieldView[]): ProposalFieldView[];
//# sourceMappingURL=proposal-templates.d.ts.map