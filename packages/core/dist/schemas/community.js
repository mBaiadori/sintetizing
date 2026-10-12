import { z } from "zod";
import { PersonaIdSchema } from "./persona.js";
export const CommunityScopeSchema = z.enum([
    "TERRITORIAL",
    "THEMATIC",
    "COOPERATIVE",
    "INSTITUTIONAL",
]);
export const CommunityStatusSchema = z.enum([
    "ACTIVE",
    "DISSOLVING",
    "READ-ONLY_ARCHIVED",
]);
export const CommunityParametersSchema = z.object({
    node_size_k: z.number().int().min(5).max(20).default(10),
    buffer_size_beta: z.number().int().min(1).max(5).default(3),
    default_quorum_min: z.number().int().min(3).max(20).default(5),
    default_time_max_seconds: z.number().int().min(86400).max(2592000).default(864000), // 1 a 30 dias (padrão 10)
    default_grace_period_seconds: z.number().int().min(43200).default(172800), // mín 12h (padrão 2 dias)
    decay_exponent_alpha: z.number().min(1.0).max(3.0).default(1.5),
    idle_timeout_seconds: z.number().int().positive().default(604800), // 7 dias
    inactivity_archive_seconds: z.number().int().positive().default(15552000), // 180 dias
});
export const CommunitySchema = z.object({
    community_id: z.string().min(3).max(128),
    name: z.string().min(3).max(128),
    scope: CommunityScopeSchema,
    genesis_timestamp: z.number().int().positive(),
    founder_persona_id: PersonaIdSchema,
    parameters: CommunityParametersSchema,
    status: CommunityStatusSchema.default("ACTIVE"),
});
//# sourceMappingURL=community.js.map