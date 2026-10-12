export * from "./errors.js";
export interface KeyPair {
    publicKeyHex: string;
    privateKeyHex: string;
}
export interface ICryptoEngine {
    generateKeyPair(): Promise<KeyPair>;
    derivePersonaId(publicKeyHex: string): string;
    signCanonicalPayload(privateKeyHex: string, payload: unknown): Promise<string>;
    verifySignature(publicKeyHex: string, payload: unknown, signatureHex: string): Promise<boolean>;
    computeCanonicalHash(payload: unknown): string;
    generateVrfProof(privateKeyHex: string, seed: string): Promise<{
        proof: string;
        output: string;
    }>;
    verifyVrfProof(publicKeyHex: string, seed: string, proof: string): Promise<boolean>;
}
export interface TimelockCalculation {
    remainingSeconds: number;
    targetClosureTimestamp: number;
    isClosed: boolean;
    quorumMet: boolean;
}
export interface TimelockParams {
    votes: number;
    kSize: number;
    qMin: number;
    tMaxSeconds: number;
    tGraceSeconds: number;
    alpha: number;
    t0FirstQuorumTimestamp: number | null;
    currentNetworkTime: number;
}
export interface CellCapacityParams {
    currentActiveCount: number;
    currentBufferCount: number;
    kLimit: number;
    betaLimit: number;
}
export interface CellCapacityResult {
    canAcceptDirectly: boolean;
    needsBuffer: boolean;
    triggerSplit: boolean;
}
export interface VoteMigrationParams {
    fromProposalVotes: number;
    toProposalVotes: number;
    fromProposalId: string;
    toProposalId: string;
}
export interface VoteMigrationResult {
    fromNewVotes: number;
    toNewVotes: number;
}
export interface IConsensusEngine {
    calculateTimelock(params: TimelockParams): TimelockCalculation;
    evaluateCellCapacity(params: CellCapacityParams): CellCapacityResult;
    calculateVoteMigration(params: VoteMigrationParams): VoteMigrationResult;
}
//# sourceMappingURL=index.d.ts.map