import { z } from "zod";
export declare const PersonaIdSchema: z.ZodString;
export declare const PublicKeySchema: z.ZodString;
export declare const PersonaSchema: z.ZodObject<{
    persona_id: z.ZodString;
    public_key: z.ZodString;
    reputation_score: z.ZodDefault<z.ZodNumber>;
    created_at: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    persona_id: string;
    public_key: string;
    reputation_score: number;
    created_at: number;
}, {
    persona_id: string;
    public_key: string;
    created_at: number;
    reputation_score?: number | undefined;
}>;
export type Persona = z.infer<typeof PersonaSchema>;
//# sourceMappingURL=persona.d.ts.map