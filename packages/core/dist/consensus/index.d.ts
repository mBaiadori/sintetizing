export * from "./cellular.js";
export * from "./migration.js";
export * from "./timelock.js";
import { CellCapacityParams, CellCapacityResult, IConsensusEngine, TimelockCalculation, TimelockParams, VoteMigrationParams, VoteMigrationResult } from "../types/index.js";
/**
 * Implementação de referência do IConsensusEngine
 */
export declare class DefaultConsensusEngine implements IConsensusEngine {
    calculateTimelock(params: TimelockParams): TimelockCalculation;
    evaluateCellCapacity(params: CellCapacityParams): CellCapacityResult;
    calculateVoteMigration(params: VoteMigrationParams): VoteMigrationResult;
}
//# sourceMappingURL=index.d.ts.map