import { InvitePolicyValue } from "@sintetizing/wire";
import { CommunityProjection, SubjectWorkshopView } from "./types.js";
export declare const INVITE_BOOTSTRAP_MAX_MEMBERS = 5;
/**
 * Calcula a janela de rotação (cooldown) para padrinhos de convite.
 * Durante o bootstrap (N <= 5) ou quando a política é FOUNDER_ONLY, retorna 0.
 */
export declare function computeInviteRotationWindow(activeMemberCount: number, invitePolicy: InvitePolicyValue): number;
/**
 * Calcula quantos apoios são necessários para atingir o quórum percentual arredondado para cima.
 */
export declare function computeQuorumRequired(activeCount: number, quorumPct: number): number;
/**
 * Projeta de forma pura e determinística o estado completo de uma comunidade
 * a partir de todos os pacotes TLV binários verificados (.cmnt, .memb, .stze, .snap).
 */
export declare function projectCommunityState(packets: readonly Uint8Array[], communityId: string, nowMs: number): Promise<CommunityProjection>;
/**
 * Projeta de forma pura e determinística a Oficina de um Assunto (.chat):
 * histórico cronológico de mensagens + rascunhos ativos (1 revisão mais recente por autor/draftId)
 * com sinalização automática caso algum rascunho já tenha sido convertido em Proposta Oficial (.stze).
 */
export declare function projectSubjectWorkshop(params: {
    readonly subjectScope: string;
    readonly rawChatPackets: readonly Uint8Array[];
    readonly projection: CommunityProjection | null;
}): Promise<SubjectWorkshopView>;
//# sourceMappingURL=community-engine.d.ts.map