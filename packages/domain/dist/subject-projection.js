import { bytesToHex } from "@noble/hashes/utils";
import { parseStoredConfig } from "./config-parser.js";
const ZERO_HASH_TARGET = "0000000000000000000000000000000000000000000000000000000000000000";
/**
 * Calcula quantos apoios são necessários para atingir a meta percentual de quórum.
 */
export function computeQuorumRequired(effectiveParticipantCount, quorumTargetPct) {
    if (effectiveParticipantCount <= 0 || quorumTargetPct <= 0) {
        return 0;
    }
    return Math.ceil((effectiveParticipantCount * quorumTargetPct) / 100);
}
/**
 * Constrói a linhagem DAG (pai -> filhos e profundidade) das propostas de um assunto.
 * Protegido contra ciclos por meio de conjunto de nós em visitação.
 */
export function buildProposalLineage(proposals) {
    const knownIds = new Set(proposals.map((p) => p.docIdHex));
    const parentsMap = new Map();
    const childrenMap = new Map();
    for (const proposal of proposals) {
        childrenMap.set(proposal.docIdHex, []);
        parentsMap.set(proposal.docIdHex, proposal.parentHashes.map((hash) => bytesToHex(hash)));
    }
    for (const proposal of proposals) {
        const parentIds = parentsMap.get(proposal.docIdHex);
        for (const parentId of parentIds) {
            if (knownIds.has(parentId)) {
                childrenMap.get(parentId).push(proposal.docIdHex);
            }
        }
    }
    const depthMap = new Map();
    const visiting = new Set();
    const computeDepth = (docIdHex) => {
        const cached = depthMap.get(docIdHex);
        if (cached !== undefined) {
            return cached;
        }
        if (visiting.has(docIdHex)) {
            return -1;
        }
        visiting.add(docIdHex);
        const parentIds = parentsMap.get(docIdHex);
        let maxParentDepth = -1;
        for (const parentId of parentIds) {
            if (knownIds.has(parentId)) {
                const parentDepth = computeDepth(parentId);
                if (parentDepth > maxParentDepth) {
                    maxParentDepth = parentDepth;
                }
            }
        }
        visiting.delete(docIdHex);
        const depth = maxParentDepth + 1;
        depthMap.set(docIdHex, depth);
        return depth;
    };
    for (const proposal of proposals) {
        computeDepth(proposal.docIdHex);
    }
    const roots = proposals
        .filter((p) => parentsMap.get(p.docIdHex).every((pid) => !knownIds.has(pid)))
        .map((p) => p.docIdHex);
    return {
        parentsMap,
        childrenMap,
        depthMap,
        roots,
    };
}
/**
 * Projeta de forma pura o estado completo de um Subject para a UI:
 * placar ranqueado, quórum, status de ciclo de vida e posição do usuário atual.
 */
export function projectSubjectState(engine, options) {
    const defaultQuorumPct = options.defaultQuorumPct ?? 60;
    const minParticipants = options.minParticipants ?? 2;
    const latestConfig = engine.getLatestConfig();
    const config = latestConfig ? parseStoredConfig(latestConfig) : null;
    const quorumTargetPct = config ? config.quorumTargetPct : defaultQuorumPct;
    const deadlineUnixSeconds = config ? config.deadlineUnixSeconds : null;
    const activePicks = engine.getActivePicks();
    let participantCount = 0;
    for (const pick of activePicks) {
        if (pick.targetKey !== "0" && pick.targetKey !== ZERO_HASH_TARGET) {
            participantCount++;
        }
    }
    const effectiveDenominator = Math.max(participantCount, minParticipants);
    const quorumRequiredVotes = computeQuorumRequired(effectiveDenominator, quorumTargetPct);
    const storedProposals = engine.getAllProposals();
    const consolidatedList = storedProposals.map((s) => engine.resolveConsolidatedProposal(s.docId));
    const authorMap = new Map();
    for (const stored of storedProposals) {
        authorMap.set(stored.docIdHex, bytesToHex(stored.doc.authorPub));
    }
    const lineage = buildProposalLineage(consolidatedList);
    const tally = engine.getTally();
    const preliminary = consolidatedList.map((proposal) => {
        const pickCount = tally[proposal.docIdHex] ?? 0;
        const totalBudgetCents = proposal.currencies.reduce((sum, item) => sum + item.cents, 0);
        const supportPercentage = effectiveDenominator > 0
            ? Math.min(100, Math.round((pickCount / effectiveDenominator) * 100))
            : 0;
        return {
            proposal,
            pickCount,
            supportPercentage,
            totalBudgetCents,
            authorPubHex: authorMap.get(proposal.docIdHex),
            parentDocIds: lineage.parentsMap.get(proposal.docIdHex),
            childDocIds: lineage.childrenMap.get(proposal.docIdHex),
            depth: lineage.depthMap.get(proposal.docIdHex),
        };
    });
    preliminary.sort((a, b) => b.pickCount - a.pickCount ||
        a.proposal.docIdHex.localeCompare(b.proposal.docIdHex));
    const highestPickCount = preliminary[0]?.pickCount ?? 0;
    const leadingProposalIdHex = highestPickCount > 0 ? preliminary[0].proposal.docIdHex : null;
    const highestQuorumPercentage = preliminary[0]?.supportPercentage ?? 0;
    const proposalsRanked = preliminary.map((item) => ({
        ...item,
        isLeading: highestPickCount > 0 && item.pickCount === highestPickCount,
    }));
    let status = "OPEN";
    if (highestPickCount > 0 &&
        quorumRequiredVotes > 0 &&
        participantCount >= minParticipants &&
        highestPickCount >= quorumRequiredVotes) {
        status = "CONGELADO_APROVADO";
    }
    else if (deadlineUnixSeconds !== null &&
        options.nowUnixSeconds >= deadlineUnixSeconds) {
        status = "EXPIRADO";
    }
    const remainingSeconds = deadlineUnixSeconds === null
        ? null
        : Math.max(0, deadlineUnixSeconds - options.nowUnixSeconds);
    let myActivePickTarget = null;
    if (options.currentUserPubHex !== undefined) {
        const myPick = activePicks.find((p) => bytesToHex(p.authorPub) === options.currentUserPubHex);
        if (myPick && myPick.targetKey !== "0" && myPick.targetKey !== ZERO_HASH_TARGET) {
            myActivePickTarget = myPick.targetKey;
        }
    }
    return {
        scope: options.scope,
        config,
        status,
        participantCount,
        effectiveDenominator,
        quorumTargetPct,
        quorumRequiredVotes,
        highestPickCount,
        highestQuorumPercentage,
        leadingProposalIdHex,
        deadlineUnixSeconds,
        remainingSeconds,
        myActivePickTarget,
        proposalsRanked,
    };
}
/**
 * Indica se o assunto ainda aceita novas propostas, forks ou transferências de apoio.
 */
export function canMutateSubject(projection) {
    return projection.status === "OPEN";
}
//# sourceMappingURL=subject-projection.js.map