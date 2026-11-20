import { ProtocolException } from "../types/errors.js";
/**
 * Avalia o crescimento celular e processa a admissão de um novo membro.
 * Implementa o gatilho de clivagem atômica fractal quando a lotação atinge K + β (10 + 3 = 13).
 */
export function evaluateCellGrowth(current, newMember, K = 10, beta = 3) {
    if (!newMember || typeof newMember !== "string") {
        throw new ProtocolException("VALIDATION", "ERR_SCHEMA_VIOLATION", "Identificador do membro inválido para entrada na célula.", { newMember });
    }
    // Previne duplicação de membros na mesma célula
    if (current.active_members.includes(newMember) ||
        current.buffer_members.includes(newMember)) {
        throw new ProtocolException("CONSENSUS", "ERR_SCHEMA_VIOLATION", "O membro já faz parte dos assentos ou do buffer desta célula.", { newMember, cell_id: current.cell_id });
    }
    // 1. Se ainda há vaga nos assentos ativos
    if (current.active_members.length < K) {
        return {
            nextState: {
                cell_id: current.cell_id,
                active_members: [...current.active_members, newMember],
                buffer_members: [...current.buffer_members],
            },
            splitResult: { split_occurred: false },
        };
    }
    // 2. Assentos principais lotados (10). Adiciona à fila de espera (buffer)
    const updatedBuffer = [...current.buffer_members, newMember];
    if (updatedBuffer.length < beta) {
        return {
            nextState: {
                cell_id: current.cell_id,
                active_members: [...current.active_members],
                buffer_members: updatedBuffer,
            },
            splitResult: { split_occurred: false },
        };
    }
    // 3. Atingiu K + beta (10 + 3 = 13): GATILHO DE CLIVAGEM ATÔMICA
    const originalCell = {
        cell_id: current.cell_id,
        active_members: [...current.active_members],
        buffer_members: [],
    };
    const childSeed = {
        seed_members: [...updatedBuffer],
        needed_vrf_count: Math.max(0, K - updatedBuffer.length),
    };
    return {
        nextState: originalCell,
        splitResult: {
            split_occurred: true,
            original_cell: originalCell,
            child_cell_seed: childSeed,
        },
    };
}
/**
 * Avalia estaticamente a capacidade da célula a partir dos contadores.
 */
export function evaluateCellCapacity(params) {
    const { currentActiveCount, currentBufferCount, kLimit, betaLimit } = params;
    if (currentActiveCount < kLimit) {
        return {
            canAcceptDirectly: true,
            needsBuffer: false,
            triggerSplit: false,
        };
    }
    const willFillBuffer = currentBufferCount + 1 >= betaLimit;
    return {
        canAcceptDirectly: false,
        needsBuffer: !willFillBuffer,
        triggerSplit: willFillBuffer,
    };
}
//# sourceMappingURL=cellular.js.map