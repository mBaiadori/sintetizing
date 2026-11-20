/**
 * Taxonomia Canônica de Erros do Protocolo PFS-CD
 * Conforme especificado em docs/CONTRACTS_AND_APIS.md
 */

export type ErrorCategory =
  | "VALIDATION"
  | "CRYPTO"
  | "CONSENSUS"
  | "NETWORK"
  | "STORAGE";

export type ErrorCode =
  // Validação Estrutural e Limites
  | "ERR_SCHEMA_VIOLATION"
  | "ERR_PAYLOAD_TOO_LARGE"
  | "ERR_STRING_OUT_OF_BOUNDS"
  
  // Criptografia e Identidade
  | "ERR_INVALID_SIGNATURE"
  | "ERR_MALFORMED_PUBLIC_KEY"
  | "ERR_INVALID_VRF_PROOF"
  | "ERR_PERSONA_NOT_VOUCHED"
  
  // Consenso e Regras de Negócio
  | "ERR_CELL_SEATS_FULL"
  | "ERR_MEMBER_NOT_IN_CELL"
  | "ERR_TIMELOCK_EXPIRED"
  | "ERR_QUORUM_NOT_MET"
  | "ERR_ILLEGAL_STATE_TRANSITION"
  | "ERR_PROPOSAL_ALREADY_CLOSED"
  | "ERR_MIGRATION_SAME_TARGET"
  | "ERR_INVALID_CONSENSUS_PARAMS"
  
  // Rede e Sincronização
  | "ERR_TIMESTAMP_BEFORE_MTP"
  | "ERR_RELAY_UNREACHABLE"
  | "ERR_DAG_PARENT_NOT_FOUND"
  | "ERR_FORK_QUARANTINED";

export interface ProtocolError {
  category: ErrorCategory;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export class ProtocolException extends Error {
  public readonly protocolError: ProtocolError;

  constructor(
    category: ErrorCategory,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    timestamp: number = Date.now()
  ) {
    super(`[${category}:${code}] ${message}`);
    this.name = "ProtocolException";
    this.protocolError = {
      category,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp,
    };
    Object.setPrototypeOf(this, ProtocolException.prototype);
  }
}

export function createProtocolError(
  category: ErrorCategory,
  code: ErrorCode,
  message: string,
  timestamp: number,
  details?: Record<string, unknown>
): ProtocolError {
  return {
    category,
    code,
    message,
    ...(details !== undefined ? { details } : {}),
    timestamp,
  };
}
