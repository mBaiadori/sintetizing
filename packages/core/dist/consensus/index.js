export * from "./cellular.js";
export * from "./migration.js";
export * from "./timelock.js";
import { evaluateCellCapacity } from "./cellular.js";
import { calculateVoteMigration } from "./migration.js";
import { calculateTimelock } from "./timelock.js";
/**
 * Implementação de referência do IConsensusEngine
 */
export class DefaultConsensusEngine {
    calculateTimelock(params) {
        return calculateTimelock(params);
    }
    evaluateCellCapacity(params) {
        return evaluateCellCapacity(params);
    }
    calculateVoteMigration(params) {
        return calculateVoteMigration(params);
    }
}
//# sourceMappingURL=index.js.map