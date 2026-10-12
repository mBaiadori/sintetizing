import { z } from "zod";

export const PersonaIdSchema = z
  .string()
  .regex(/^0x[a-f0-9]{40}$/, "O persona_id deve ser um hexadecimal de 40 caracteres com prefixo 0x");

export const PublicKeySchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "A chave pública deve ser uma string hexadecimal de 64 caracteres");

export const PersonaSchema = z.object({
  persona_id: PersonaIdSchema,
  public_key: PublicKeySchema,
  reputation_score: z.number().int().nonnegative().default(100),
  created_at: z.number().int().positive(),
});

export type Persona = z.infer<typeof PersonaSchema>;
