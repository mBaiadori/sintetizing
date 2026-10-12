import { z } from "zod";
export declare const ActionTypeSchema: z.ZodEnum<["PERSONA_JOIN", "PROPOSAL_CREATED", "PROPOSAL_VOTE", "PROPOSAL_MIGRATE", "CELL_SPLIT", "PROPOSAL_CLOSED"]>;
export declare const StateEventCommitSchema: z.ZodObject<{
    commit_hash: z.ZodString;
    parent_hashes: z.ZodArray<z.ZodString, "many">;
    timestamp: z.ZodNumber;
    community_id: z.ZodString;
    cell_node_id: z.ZodString;
    action_type: z.ZodEnum<["PERSONA_JOIN", "PROPOSAL_CREATED", "PROPOSAL_VOTE", "PROPOSAL_MIGRATE", "CELL_SPLIT", "PROPOSAL_CLOSED"]>;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    sender_persona_id: z.ZodString;
    signature: z.ZodString;
}, "strip", z.ZodTypeAny, {
    community_id: string;
    commit_hash: string;
    parent_hashes: string[];
    timestamp: number;
    cell_node_id: string;
    action_type: "PERSONA_JOIN" | "PROPOSAL_CREATED" | "PROPOSAL_VOTE" | "PROPOSAL_MIGRATE" | "CELL_SPLIT" | "PROPOSAL_CLOSED";
    payload: Record<string, unknown>;
    sender_persona_id: string;
    signature: string;
}, {
    community_id: string;
    commit_hash: string;
    parent_hashes: string[];
    timestamp: number;
    cell_node_id: string;
    action_type: "PERSONA_JOIN" | "PROPOSAL_CREATED" | "PROPOSAL_VOTE" | "PROPOSAL_MIGRATE" | "CELL_SPLIT" | "PROPOSAL_CLOSED";
    payload: Record<string, unknown>;
    sender_persona_id: string;
    signature: string;
}>;
export type ActionType = z.infer<typeof ActionTypeSchema>;
export type StateEventCommit = z.infer<typeof StateEventCommitSchema>;
//# sourceMappingURL=events.d.ts.map