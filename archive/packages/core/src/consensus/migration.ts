import { ProtocolException } from "../types/errors.js";
import { VoteMigrationParams, VoteMigrationResult } from "../types/index.js";

/**
 * Calcula a migração atômica de votos entre duas propostas no contexto de contestação construtiva.
 * O voto é deduzido da proposta de origem e somado à proposta de destino.
 */
export function calculateVoteMigration(params: VoteMigrationParams): VoteMigrationResult {
  const { fromProposalVotes, toProposalVotes, fromProposalId, toProposalId } = params;

  if (fromProposalId === toProposalId) {
    throw new ProtocolException(
      "CONSENSUS",
      "ERR_MIGRATION_SAME_TARGET",
      "Não é permitido migrar voto para a mesma proposta.",
      { fromProposalId, toProposalId }
    );
  }

  if (fromProposalVotes < 0 || toProposalVotes < 0) {
    throw new ProtocolException(
      "VALIDATION",
      "ERR_SCHEMA_VIOLATION",
      "A contagem de votos das propostas não pode ser negativa.",
      { fromProposalVotes, toProposalVotes }
    );
  }

  if (fromProposalVotes === 0) {
    throw new ProtocolException(
      "CONSENSUS",
      "ERR_ILLEGAL_STATE_TRANSITION",
      "A proposta de origem não possui votos suficientes para migração.",
      { fromProposalVotes }
    );
  }

  return {
    fromNewVotes: fromProposalVotes - 1,
    toNewVotes: toProposalVotes + 1,
  };
}
