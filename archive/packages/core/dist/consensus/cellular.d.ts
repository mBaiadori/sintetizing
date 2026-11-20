import { CellCapacityParams, CellCapacityResult } from "../types/index.js";
export interface CellState {
    cell_id: string;
    active_members: string[];
    buffer_members: string[];
}
export interface SplitResult {
    split_occurred: boolean;
    original_cell?: CellState;
    child_cell_seed?: {
        seed_members: string[];
        needed_vrf_count: number;
    };
}
/**
 * Avalia o crescimento celular e processa a admissão de um novo membro.
 * Implementa o gatilho de clivagem atômica fractal quando a lotação atinge K + β (10 + 3 = 13).
 */
export declare function evaluateCellGrowth(current: CellState, newMember: string, K?: number, beta?: number): {
    nextState: CellState;
    splitResult: SplitResult;
};
/**
 * Avalia estaticamente a capacidade da célula a partir dos contadores.
 */
export declare function evaluateCellCapacity(params: CellCapacityParams): CellCapacityResult;
//# sourceMappingURL=cellular.d.ts.map