/**
 * Taxonomia Canônica de Erros do Protocolo PFS-CD
 * Conforme especificado em docs/CONTRACTS_AND_APIS.md
 */
export type ErrorCategory = "VALIDATION" | "CRYPTO" | "CONSENSUS" | "NETWORK" | "STORAGE";
export type ErrorCode = "ERR_SCHEMA_VIOLATION" | "ERR_PAYLOAD_TOO_LARGE" | "ERR_STRING_OUT_OF_BOUNDS" | "ERR_INVALID_SIGNATURE" | "ERR_MALFORMED_PUBLIC_KEY" | "ERR_INVALID_VRF_PROOF" | "ERR_PERSONA_NOT_VOUCHED" | "ERR_CELL_SEATS_FULL" | "ERR_MEMBER_NOT_IN_CELL" | "ERR_TIMELOCK_EXPIRED" | "ERR_QUORUM_NOT_MET" | "ERR_ILLEGAL_STATE_TRANSITION" | "ERR_PROPOSAL_ALREADY_CLOSED" | "ERR_MIGRATION_SAME_TARGET" | "ERR_INVALID_CONSENSUS_PARAMS" | "ERR_TIMESTAMP_BEFORE_MTP" | "ERR_RELAY_UNREACHABLE" | "ERR_DAG_PARENT_NOT_FOUND" | "ERR_FORK_QUARANTINED";
export interface ProtocolError {
    category: ErrorCategory;
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    timestamp: number;
}
export declare class ProtocolException extends Error {
    readonly protocolError: ProtocolError;
    constructor(category: ErrorCategory, code: ErrorCode, message: string, details?: Record<string, unknown>, timestamp?: number);
}
export declare function createProtocolError(category: ErrorCategory, code: ErrorCode, message: string, timestamp: number, details?: Record<string, unknown>): ProtocolError;
//# sourceMappingURL=errors.d.ts.map