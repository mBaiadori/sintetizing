import { TimelockCalculation, TimelockParams } from "../types/index.js";
export interface TimelockInput {
    v: number;
    K: number;
    Q_min: number;
    T_max: number;
    T_grace: number;
    alpha: number;
}
/**
 * Valida a integridade dos parâmetros do timelock dinâmico.
 */
export declare function validateTimelockParams(params: {
    K: number;
    Q_min: number;
    T_max: number;
    T_grace: number;
    alpha: number;
}): void;
/**
 * Calcula o tempo restante de deliberação em segundos com base no número de votos favoráveis v.
 *
 * Regras matemáticas:
 * - Se v < Q_min: Infinity (o relógio nem sequer começa a contar).
 * - Se v >= K: 0 (consenso unânime fecha a proposta de forma imediata).
 * - Se v === K - 1: T_grace (garante a janela mínima de segurança para o último membro).
 * - Caso contrário: T_max * ((K - v) / (K - Q_min))^alpha, nunca inferior a T_grace.
 */
export declare function calculateTimelockRemaining(input: TimelockInput): number;
/**
 * Avalia o estado completo do timelock em relação ao tempo da rede.
 * Função pura determinística: não lê relógio global, recebe currentNetworkTime explicitamente.
 */
export declare function calculateTimelock(params: TimelockParams): TimelockCalculation;
//# sourceMappingURL=timelock.d.ts.map