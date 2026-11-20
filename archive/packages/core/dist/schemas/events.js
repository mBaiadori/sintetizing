import { z } from "zod";
import { PersonaIdSchema } from "./persona.js";
export const ActionTypeSchema = z.enum([
    "PERSONA_JOIN",
    "PROPOSAL_CREATED",
    "PROPOSAL_VOTE",
    "PROPOSAL_MIGRATE",
    "CELL_SPLIT",
    "PROPOSAL_CLOSED",
]);
export const StateEventCommitSchema = z.object({
    commit_hash: z.string().length(64),
    parent_hashes: z.array(z.string().length(64)),
    timestamp: z.number().int().positive(),
    community_id: z.string().min(3).max(128),
    cell_node_id: z.string().min(3).max(128),
    action_type: ActionTypeSchema,
    payload: z.record(z.unknown()),
    sender_persona_id: PersonaIdSchema,
    signature: z.string().regex(/^[0-9a-fA-F]{128}$/, "Assinatura deve ser hex de 128 caracteres"),
});
//# sourceMappingURL=events.js.map