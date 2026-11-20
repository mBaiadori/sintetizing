import { z } from "zod";
export declare const CommunityScopeSchema: z.ZodEnum<["TERRITORIAL", "THEMATIC", "COOPERATIVE", "INSTITUTIONAL"]>;
export declare const CommunityStatusSchema: z.ZodEnum<["ACTIVE", "DISSOLVING", "READ-ONLY_ARCHIVED"]>;
export declare const CommunityParametersSchema: z.ZodObject<{
    node_size_k: z.ZodDefault<z.ZodNumber>;
    buffer_size_beta: z.ZodDefault<z.ZodNumber>;
    default_quorum_min: z.ZodDefault<z.ZodNumber>;
    default_time_max_seconds: z.ZodDefault<z.ZodNumber>;
    default_grace_period_seconds: z.ZodDefault<z.ZodNumber>;
    decay_exponent_alpha: z.ZodDefault<z.ZodNumber>;
    idle_timeout_seconds: z.ZodDefault<z.ZodNumber>;
    inactivity_archive_seconds: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    node_size_k: number;
    buffer_size_beta: number;
    default_quorum_min: number;
    default_time_max_seconds: number;
    default_grace_period_seconds: number;
    decay_exponent_alpha: number;
    idle_timeout_seconds: number;
    inactivity_archive_seconds: number;
}, {
    node_size_k?: number | undefined;
    buffer_size_beta?: number | undefined;
    default_quorum_min?: number | undefined;
    default_time_max_seconds?: number | undefined;
    default_grace_period_seconds?: number | undefined;
    decay_exponent_alpha?: number | undefined;
    idle_timeout_seconds?: number | undefined;
    inactivity_archive_seconds?: number | undefined;
}>;
export declare const CommunitySchema: z.ZodObject<{
    community_id: z.ZodString;
    name: z.ZodString;
    scope: z.ZodEnum<["TERRITORIAL", "THEMATIC", "COOPERATIVE", "INSTITUTIONAL"]>;
    genesis_timestamp: z.ZodNumber;
    founder_persona_id: z.ZodString;
    parameters: z.ZodObject<{
        node_size_k: z.ZodDefault<z.ZodNumber>;
        buffer_size_beta: z.ZodDefault<z.ZodNumber>;
        default_quorum_min: z.ZodDefault<z.ZodNumber>;
        default_time_max_seconds: z.ZodDefault<z.ZodNumber>;
        default_grace_period_seconds: z.ZodDefault<z.ZodNumber>;
        decay_exponent_alpha: z.ZodDefault<z.ZodNumber>;
        idle_timeout_seconds: z.ZodDefault<z.ZodNumber>;
        inactivity_archive_seconds: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        node_size_k: number;
        buffer_size_beta: number;
        default_quorum_min: number;
        default_time_max_seconds: number;
        default_grace_period_seconds: number;
        decay_exponent_alpha: number;
        idle_timeout_seconds: number;
        inactivity_archive_seconds: number;
    }, {
        node_size_k?: number | undefined;
        buffer_size_beta?: number | undefined;
        default_quorum_min?: number | undefined;
        default_time_max_seconds?: number | undefined;
        default_grace_period_seconds?: number | undefined;
        decay_exponent_alpha?: number | undefined;
        idle_timeout_seconds?: number | undefined;
        inactivity_archive_seconds?: number | undefined;
    }>;
    status: z.ZodDefault<z.ZodEnum<["ACTIVE", "DISSOLVING", "READ-ONLY_ARCHIVED"]>>;
}, "strip", z.ZodTypeAny, {
    status: "ACTIVE" | "DISSOLVING" | "READ-ONLY_ARCHIVED";
    community_id: string;
    name: string;
    scope: "TERRITORIAL" | "THEMATIC" | "COOPERATIVE" | "INSTITUTIONAL";
    genesis_timestamp: number;
    founder_persona_id: string;
    parameters: {
        node_size_k: number;
        buffer_size_beta: number;
        default_quorum_min: number;
        default_time_max_seconds: number;
        default_grace_period_seconds: number;
        decay_exponent_alpha: number;
        idle_timeout_seconds: number;
        inactivity_archive_seconds: number;
    };
}, {
    community_id: string;
    name: string;
    scope: "TERRITORIAL" | "THEMATIC" | "COOPERATIVE" | "INSTITUTIONAL";
    genesis_timestamp: number;
    founder_persona_id: string;
    parameters: {
        node_size_k?: number | undefined;
        buffer_size_beta?: number | undefined;
        default_quorum_min?: number | undefined;
        default_time_max_seconds?: number | undefined;
        default_grace_period_seconds?: number | undefined;
        decay_exponent_alpha?: number | undefined;
        idle_timeout_seconds?: number | undefined;
        inactivity_archive_seconds?: number | undefined;
    };
    status?: "ACTIVE" | "DISSOLVING" | "READ-ONLY_ARCHIVED" | undefined;
}>;
export type CommunityScope = z.infer<typeof CommunityScopeSchema>;
export type CommunityStatus = z.infer<typeof CommunityStatusSchema>;
export type CommunityParameters = z.infer<typeof CommunityParametersSchema>;
export type Community = z.infer<typeof CommunitySchema>;
//# sourceMappingURL=community.d.ts.map