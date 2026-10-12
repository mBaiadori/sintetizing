export * from "./cellular.js";
export * from "./migration.js";
export * from "./timelock.js";

import {
  CellCapacityParams,
  CellCapacityResult,
  IConsensusEngine,
  TimelockCalculation,
  TimelockParams,
  VoteMigrationParams,
  VoteMigrationResult,
} from "../types/index.js";
import { evaluateCellCapacity } from "./cellular.js";
import { calculateVoteMigration } from "./migration.js";
import { calculateTimelock } from "./timelock.js";

/**
 * Implementação de referência do IConsensusEngine
 */
export class DefaultConsensusEngine implements IConsensusEngine {
  public calculateTimelock(params: TimelockParams): TimelockCalculation {
    return calculateTimelock(params);
  }

  public evaluateCellCapacity(params: CellCapacityParams): CellCapacityResult {
    return evaluateCellCapacity(params);
  }

  public calculateVoteMigration(params: VoteMigrationParams): VoteMigrationResult {
    return calculateVoteMigration(params);
  }
}
