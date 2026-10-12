import { ProtocolException } from "../types/errors.js";
import { TimelockCalculation, TimelockParams } from "../types/index.js";

export interface TimelockInput {
  v: number;               // Votos favoráveis acumulados
  K: number;               // Tamanho total da célula deliberativa (ex: 10)
  Q_min: number;           // Quórum mínimo para disparar relógio (ex: 5)
  T_max: number;           // Tempo teto em segundos (ex: 864.000 = 10 dias)
  T_grace: number;         // Janela mínima de carência em segundos (ex: 172.800 = 2 dias)
  alpha: number;           // Expoente de contração temporal (ex: 1.5)
}

/**
 * Valida a integridade dos parâmetros do timelock dinâmico.
 */
export function validateTimelockParams(params: {
  K: number;
  Q_min: number;
  T_max: number;
  T_grace: number;
  alpha: number;
}): void {
  const { K, Q_min, T_max, T_grace, alpha } = params;

  if (K <= 0 || !Number.isInteger(K)) {
    throw new ProtocolException(
      "CONSENSUS",
      "ERR_INVALID_CONSENSUS_PARAMS",
      "O tamanho da célula K deve ser um número inteiro positivo.",
      { K }
    );
  }

  if (Q_min <= 0 || !Number.isInteger(Q_min) || Q_min > K) {
    throw new ProtocolException(
      "CONSENSUS",
      "ERR_INVALID_CONSENSUS_PARAMS",
      "O quórum mínimo Q_min deve ser um inteiro entre 1 e K.",
      { Q_min, K }
    );
  }

  if (T_max < 0 || T_grace < 0 || T_grace > T_max) {
    throw new ProtocolException(
      "CONSENSUS",
      "ERR_INVALID_CONSENSUS_PARAMS",
      "Os tempos T_max e T_grace devem ser não-negativos e T_grace deve ser menor ou igual a T_max.",
      { T_max, T_grace }
    );
  }

  if (alpha <= 0) {
    throw new ProtocolException(
      "CONSENSUS",
      "ERR_INVALID_CONSENSUS_PARAMS",
      "O expoente de decaimento alpha deve ser estritamente positivo.",
      { alpha }
    );
  }
}

/**
 * Calcula o tempo restante de deliberação em segundos com base no número de votos favoráveis v.
 *
 * Regras matemáticas:
 * - Se v < Q_min: Infinity (o relógio nem sequer começa a contar).
 * - Se v >= K: 0 (consenso unânime fecha a proposta de forma imediata).
 * - Se v === K - 1: T_grace (garante a janela mínima de segurança para o último membro).
 * - Caso contrário: T_max * ((K - v) / (K - Q_min))^alpha, nunca inferior a T_grace.
 */
export function calculateTimelockRemaining(input: TimelockInput): number {
  validateTimelockParams({
    K: input.K,
    Q_min: input.Q_min,
    T_max: input.T_max,
    T_grace: input.T_grace,
    alpha: input.alpha,
  });

  const { v, K, Q_min, T_max, T_grace, alpha } = input;

  if (v < Q_min) {
    return Infinity;
  }

  if (v >= K) {
    return 0;
  }

  if (v === K - 1) {
    return T_grace;
  }

  const contractionRatio = (K - v) / (K - Q_min);
  const remaining = T_max * Math.pow(contractionRatio, alpha);

  return Math.max(remaining, T_grace);
}

/**
 * Avalia o estado completo do timelock em relação ao tempo da rede.
 * Função pura determinística: não lê relógio global, recebe currentNetworkTime explicitamente.
 */
export function calculateTimelock(params: TimelockParams): TimelockCalculation {
  const {
    votes,
    kSize,
    qMin,
    tMaxSeconds,
    tGraceSeconds,
    alpha,
    t0FirstQuorumTimestamp,
    currentNetworkTime,
  } = params;

  const remainingSeconds = calculateTimelockRemaining({
    v: votes,
    K: kSize,
    Q_min: qMin,
    T_max: tMaxSeconds,
    T_grace: tGraceSeconds,
    alpha,
  });

  // Se não atingiu quórum ou não temos t0 registrado
  if (remainingSeconds === Infinity || t0FirstQuorumTimestamp === null) {
    return {
      remainingSeconds: Infinity,
      targetClosureTimestamp: Infinity,
      isClosed: false,
      quorumMet: false,
    };
  }

  // Se houve unanimidade imediata
  if (remainingSeconds === 0) {
    return {
      remainingSeconds: 0,
      targetClosureTimestamp: t0FirstQuorumTimestamp,
      isClosed: true,
      quorumMet: true,
    };
  }

  const targetClosureTimestamp = t0FirstQuorumTimestamp + remainingSeconds;
  const isClosed = currentNetworkTime >= targetClosureTimestamp;

  return {
    remainingSeconds,
    targetClosureTimestamp,
    isClosed,
    quorumMet: true,
  };
}
