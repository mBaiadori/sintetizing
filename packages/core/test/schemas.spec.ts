import { describe, expect, it } from "vitest";
import {
  CommunitySchema,
  PersonaSchema,
  ProposalSchema,
  StateEventCommitSchema,
} from "../src/schemas/index.js";

describe("Schemas Module: Validações de Domínio", () => {
  it("validates Persona schema successfully", () => {
    const validPersona = {
      persona_id: "0x" + "a".repeat(40),
      public_key: "b".repeat(64),
      reputation_score: 100,
      created_at: 1700000000,
    };

    const parsed = PersonaSchema.parse(validPersona);
    expect(parsed.persona_id).toBe(validPersona.persona_id);

    // Rejeita persona_id fora do padrão
    expect(() =>
      PersonaSchema.parse({ ...validPersona, persona_id: "invalid_id" })
    ).toThrow();
  });

  it("validates Community schema with default parameters", () => {
    const validCommunity = {
      community_id: "urn:pfs:comm:alpha",
      name: "Comunidade Centro Urbano",
      scope: "TERRITORIAL" as const,
      genesis_timestamp: 1700000000,
      founder_persona_id: "0x" + "c".repeat(40),
      parameters: {
        node_size_k: 10,
        buffer_size_beta: 3,
        default_quorum_min: 5,
        default_time_max_seconds: 864000,
        default_grace_period_seconds: 172800,
        decay_exponent_alpha: 1.5,
      },
    };

    const parsed = CommunitySchema.parse(validCommunity);
    expect(parsed.name).toBe("Comunidade Centro Urbano");
    expect(parsed.status).toBe("ACTIVE");
    expect(parsed.parameters.idle_timeout_seconds).toBe(604800);
  });

  it("validates Proposal schema and template data", () => {
    const validProposal = {
      proposal_id: "urn:pfs:prop:1234567812345678",
      community_id: "urn:pfs:comm:alpha",
      cell_node_id: "urn:pfs:cell:alpha",
      proposal_type: "ACTION_DEADLINE" as const,
      template_data: {
        problem: "Falta de iluminação na praça central gerando insegurança noturna.",
        solution: "Instalar 12 luminárias solares LED de 100W nos postes já existentes.",
        resources: {
          budget_cents: 1200000,
          currency: "BRL",
          labor_execution: "Comitê de Infraestrutura Local",
        },
        success_metrics: ["Instalação completa em 15 dias"],
      },
    };

    const parsed = ProposalSchema.parse(validProposal);
    expect(parsed.current_status).toBe("DRAFT");
    expect(parsed.current_votes).toBe(0);
    expect(parsed.template_data.problem).toContain("iluminação");
  });

  it("validates StateEventCommit schema", () => {
    const validCommit = {
      commit_hash: "d".repeat(64),
      parent_hashes: ["e".repeat(64)],
      timestamp: 1700000050,
      community_id: "urn:pfs:comm:alpha",
      cell_node_id: "urn:pfs:cell:alpha",
      action_type: "PROPOSAL_VOTE" as const,
      payload: { vote: "YES", proposalId: "urn:pfs:prop:1" },
      sender_persona_id: "0x" + "f".repeat(40),
      signature: "0".repeat(128),
    };

    const parsed = StateEventCommitSchema.parse(validCommit);
    expect(parsed.commit_hash).toBe("d".repeat(64));
    expect(parsed.action_type).toBe("PROPOSAL_VOTE");
  });
});
