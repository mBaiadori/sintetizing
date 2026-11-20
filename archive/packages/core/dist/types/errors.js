/**
 * Taxonomia Canônica de Erros do Protocolo PFS-CD
 * Conforme especificado em docs/CONTRACTS_AND_APIS.md
 */
export class ProtocolException extends Error {
    protocolError;
    constructor(category, code, message, details, timestamp = Date.now()) {
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
export function createProtocolError(category, code, message, timestamp, details) {
    return {
        category,
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        timestamp,
    };
}
//# sourceMappingURL=errors.js.map