import { z } from "zod";
export declare const ProposalTypeSchema: z.ZodEnum<["ACTION_DEADLINE", "CANONICAL_RULE", "FACT_EVIDENCE", "INCUBATOR"]>;
export declare const ProposalStatusSchema: z.ZodEnum<["DRAFT", "VOTING_ACTIVE", "EXECUTABLE", "CANONICAL", "ARCHIVED"]>;
export declare const ResourcesSchema: z.ZodObject<{
    budget_cents: z.ZodNumber;
    currency: z.ZodString;
    labor_execution: z.ZodString;
}, "strip", z.ZodTypeAny, {
    budget_cents: number;
    currency: string;
    labor_execution: string;
}, {
    budget_cents: number;
    currency: string;
    labor_execution: string;
}>;
export declare const ProposalTemplateDataSchema: z.ZodObject<{
    problem: z.ZodString;
    solution: z.ZodString;
    resources: z.ZodOptional<z.ZodObject<{
        budget_cents: z.ZodNumber;
        currency: z.ZodString;
        labor_execution: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        budget_cents: number;
        currency: string;
        labor_execution: string;
    }, {
        budget_cents: number;
        currency: string;
        labor_execution: string;
    }>>;
    success_metrics: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    problem: string;
    solution: string;
    success_metrics: string[];
    resources?: {
        budget_cents: number;
        currency: string;
        labor_execution: string;
    } | undefined;
}, {
    problem: string;
    solution: string;
    resources?: {
        budget_cents: number;
        currency: string;
        labor_execution: string;
    } | undefined;
    success_metrics?: string[] | undefined;
}>;
export declare const ProposalSchema: z.ZodObject<{
    proposal_id: z.ZodString;
    community_id: z.ZodString;
    cell_node_id: z.ZodString;
    proposal_type: z.ZodEnum<["ACTION_DEADLINE", "CANONICAL_RULE", "FACT_EVIDENCE", "INCUBATOR"]>;
    template_data: z.ZodObject<{
        problem: z.ZodString;
        solution: z.ZodString;
        resources: z.ZodOptional<z.ZodObject<{
            budget_cents: z.ZodNumber;
            currency: z.ZodString;
            labor_execution: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            budget_cents: number;
            currency: string;
            labor_execution: string;
        }, {
            budget_cents: number;
            currency: string;
            labor_execution: string;
        }>>;
        success_metrics: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        problem: string;
        solution: string;
        success_metrics: string[];
        resources?: {
            budget_cents: number;
            currency: string;
            labor_execution: string;
        } | undefined;
    }, {
        problem: string;
        solution: string;
        resources?: {
            budget_cents: number;
            currency: string;
            labor_execution: string;
        } | undefined;
        success_metrics?: string[] | undefined;
    }>;
    current_status: z.ZodDefault<z.ZodEnum<["DRAFT", "VOTING_ACTIVE", "EXECUTABLE", "CANONICAL", "ARCHIVED"]>>;
    current_votes: z.ZodDefault<z.ZodNumber>;
    ancestor_hash: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    t0_first_quorum_timestamp: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    target_closure_timestamp: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    community_id: string;
    cell_node_id: string;
    proposal_id: string;
    proposal_type: "ACTION_DEADLINE" | "CANONICAL_RULE" | "FACT_EVIDENCE" | "INCUBATOR";
    template_data: {
        problem: string;
        solution: string;
        success_metrics: string[];
        resources?: {
            budget_cents: number;
            currency: string;
            labor_execution: string;
        } | undefined;
    };
    current_status: "DRAFT" | "VOTING_ACTIVE" | "EXECUTABLE" | "CANONICAL" | "ARCHIVED";
    current_votes: number;
    ancestor_hash: string | null;
    t0_first_quorum_timestamp: number | null;
    target_closure_timestamp: number | null;
}, {
    community_id: string;
    cell_node_id: string;
    proposal_id: string;
    proposal_type: "ACTION_DEADLINE" | "CANONICAL_RULE" | "FACT_EVIDENCE" | "INCUBATOR";
    template_data: {
        problem: string;
        solution: string;
        resources?: {
            budget_cents: number;
            currency: string;
            labor_execution: string;
        } | undefined;
        success_metrics?: string[] | undefined;
    };
    current_status?: "DRAFT" | "VOTING_ACTIVE" | "EXECUTABLE" | "CANONICAL" | "ARCHIVED" | undefined;
    current_votes?: number | undefined;
    ancestor_hash?: string | null | undefined;
    t0_first_quorum_timestamp?: number | null | undefined;
    target_closure_timestamp?: number | null | undefined;
}>;
export type ProposalType = z.infer<typeof ProposalTypeSchema>;
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;
export type Resources = z.infer<typeof ResourcesSchema>;
export type ProposalTemplateData = z.infer<typeof ProposalTemplateDataSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
//# sourceMappingURL=proposal.d.ts.map