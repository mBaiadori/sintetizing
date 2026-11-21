import { CommunityProjection } from "./types.js";
/**
 * Calcula quantos apoios são necessários para atingir o quórum percentual arredondado para cima.
 */
export declare function computeQuorumRequired(activeCount: number, quorumPct: number): number;
/**
 * Projeta de forma pura e determinística o estado completo de uma comunidade
 * a partir de todos os pacotes TLV binários verificados (.cmnt, .memb, .stze, .snap).
 */
export declare function projectCommunityState(packets: readonly Uint8Array[], communityId: string, nowMs: number): Promise<CommunityProjection>;
//# sourceMappingURL=community-engine.d.ts.map