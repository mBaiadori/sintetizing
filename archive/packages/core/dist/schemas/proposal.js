import { z } from "zod";
export const ProposalTypeSchema = z.enum([
    "ACTION_DEADLINE",
    "CANONICAL_RULE",
    "FACT_EVIDENCE",
    "INCUBATOR",
]);
export const ProposalStatusSchema = z.enum([
    "DRAFT",
    "VOTING_ACTIVE",
    "EXECUTABLE",
    "CANONICAL",
    "ARCHIVED",
]);
export const ResourcesSchema = z.object({
    budget_cents: z.number().int().nonnegative().max(100_000_000_000), // R$ 1 bilhão
    currency: z.string().length(3), // ISO 4217 (BRL, USD)
    labor_execution: z.string().min(5).max(500),
});
export const ProposalTemplateDataSchema = z.object({
    problem: z.string().min(10).max(5000),
    solution: z.string().min(10).max(10000),
    resources: ResourcesSchema.optional(),
    success_metrics: z.array(z.string().min(5).max(300)).max(10).default([]),
});
export const ProposalSchema = z.object({
    proposal_id: z.string().min(5).max(128),
    community_id: z.string().min(3).max(128),
    cell_node_id: z.string().min(3).max(128),
    proposal_type: ProposalTypeSchema,
    template_data: ProposalTemplateDataSchema,
    current_status: ProposalStatusSchema.default("DRAFT"),
    current_votes: z.number().int().nonnegative().default(0),
    ancestor_hash: z.string().length(64).nullable().default(null),
    t0_first_quorum_timestamp: z.number().int().positive().nullable().default(null),
    target_closure_timestamp: z.number().int().positive().nullable().default(null),
});
//# sourceMappingURL=proposal.js.map