import { describe, expect, it } from "vitest";
import {
  calculateTimelock,
  calculateTimelockRemaining,
  calculateVoteMigration,
  CellState,
  DefaultConsensusEngine,
  evaluateCellCapacity,
  evaluateCellGrowth,
  validateTimelockParams,
} from "../src/consensus/index.js";
import { ProtocolException } from "../src/types/errors.js";

describe("Consensus Module: Timelock Dinâmico T(v)", () => {
  const defaultParams = {
    K: 10,
    Q_min: 5,
    T_max: 864_000,   // 10 dias
    T_grace: 172_800, // 2 dias
    alpha: 1.5,
  };

  it("throws ProtocolException on invalid timelock configuration parameters", () => {
    // K <= 0 ou não inteiro
    expect(() => validateTimelockParams({ ...defaultParams, K: 0 })).toThrow(ProtocolException);
    expect(() => validateTimelockParams({ ...defaultParams, K: 2.5 })).toThrow(ProtocolException);

    // Q_min <= 0 ou Q_min > K
    expect(() => validateTimelockParams({ ...defaultParams, Q_min: 0 })).toThrow(ProtocolException);
    expect(() => validateTimelockParams({ ...defaultParams, Q_min: 11 })).toThrow(ProtocolException);

    // Tempos negativos ou T_grace > T_max
    expect(() => validateTimelockParams({ ...defaultParams, T_max: -10 })).toThrow(ProtocolException);
    expect(() => validateTimelockParams({ ...defaultParams, T_grace: -5 })).toThrow(ProtocolException);
    expect(() => validateTimelockParams({ ...defaultParams, T_grace: 900_000 })).toThrow(ProtocolException);

    // Alpha <= 0
    expect(() => validateTimelockParams({ ...defaultParams, alpha: 0 })).toThrow(ProtocolException);
    expect(() => validateTimelockParams({ ...defaultParams, alpha: -1 })).toThrow(ProtocolException);
  });

  it("returns Infinity when votes are below minimum quorum (v < Q_min)", () => {
    expect(calculateTimelockRemaining({ ...defaultParams, v: 0 })).toBe(Infinity);
    expect(calculateTimelockRemaining({ ...defaultParams, v: 4 })).toBe(Infinity);
  });

  it("returns 0 (immediate closure) on unanimity (v >= K)", () => {
    expect(calculateTimelockRemaining({ ...defaultParams, v: 10 })).toBe(0);
    expect(calculateTimelockRemaining({ ...defaultParams, v: 11 })).toBe(0);
  });

  it("returns T_grace when v === K - 1 (v = 9)", () => {
    expect(calculateTimelockRemaining({ ...defaultParams, v: 9 })).toBe(defaultParams.T_grace);
  });

  it("returns T_max when v === Q_min (v = 5)", () => {
    expect(calculateTimelockRemaining({ ...defaultParams, v: 5 })).toBe(defaultParams.T_max);
  });

  it("decays monotonically strictly between Q_min and K-1", () => {
    const t5 = calculateTimelockRemaining({ ...defaultParams, v: 5 });
    const t6 = calculateTimelockRemaining({ ...defaultParams, v: 6 });
    const t7 = calculateTimelockRemaining({ ...defaultParams, v: 7 });
    const t8 = calculateTimelockRemaining({ ...defaultParams, v: 8 });
    const t9 = calculateTimelockRemaining({ ...defaultParams, v: 9 });

    expect(t5).toBeGreaterThan(t6);
    expect(t6).toBeGreaterThan(t7);
    expect(t7).toBeGreaterThan(t8);
    expect(t8).toBeGreaterThanOrEqual(t9);
  });

  it("evaluates complete calculateTimelock state correctly", () => {
    const t0 = 1_000_000;

    // 1. Sem quórum ou t0 nulo
    const noQuorum = calculateTimelock({
      votes: 3,
      kSize: 10,
      qMin: 5,
      tMaxSeconds: 864_000,
      tGraceSeconds: 172_800,
      alpha: 1.5,
      t0FirstQuorumTimestamp: null,
      currentNetworkTime: 1_000_100,
    });
    expect(noQuorum.quorumMet).toBe(false);
    expect(noQuorum.isClosed).toBe(false);
    expect(noQuorum.remainingSeconds).toBe(Infinity);

    // 2. Unanimidade imediata (v=10)
    const unanimous = calculateTimelock({
      votes: 10,
      kSize: 10,
      qMin: 5,
      tMaxSeconds: 864_000,
      tGraceSeconds: 172_800,
      alpha: 1.5,
      t0FirstQuorumTimestamp: t0,
      currentNetworkTime: t0 + 10,
    });
    expect(unanimous.quorumMet).toBe(true);
    expect(unanimous.isClosed).toBe(true);
    expect(unanimous.remainingSeconds).toBe(0);

    // 3. Em deliberação ativa (v=9, grace period de 172.800)
    const ongoing = calculateTimelock({
      votes: 9,
      kSize: 10,
      qMin: 5,
      tMaxSeconds: 864_000,
      tGraceSeconds: 172_800,
      alpha: 1.5,
      t0FirstQuorumTimestamp: t0,
      currentNetworkTime: t0 + 100_000, // Menor que t0 + 172.800
    });
    expect(ongoing.quorumMet).toBe(true);
    expect(ongoing.isClosed).toBe(false);
    expect(ongoing.remainingSeconds).toBe(172_800);
    expect(ongoing.targetClosureTimestamp).toBe(t0 + 172_800);

    // 4. Timelock expirado pelo tempo de rede
    const expired = calculateTimelock({
      votes: 9,
      kSize: 10,
      qMin: 5,
      tMaxSeconds: 864_000,
      tGraceSeconds: 172_800,
      alpha: 1.5,
      t0FirstQuorumTimestamp: t0,
      currentNetworkTime: t0 + 200_000, // Maior que t0 + 172.800
    });
    expect(expired.quorumMet).toBe(true);
    expect(expired.isClosed).toBe(true);
  });
});

describe("Consensus Module: Crescimento Celular e Clivagem Fractal (Beta-Split)", () => {
  it("admits up to K=10 members directly into active_members", () => {
    let cell: CellState = {
      cell_id: "urn:pfs:cell:alpha",
      active_members: [],
      buffer_members: [],
    };

    for (let i = 1; i <= 10; i++) {
      const res = evaluateCellGrowth(cell, `0xmember_${i}`, 10, 3);
      expect(res.splitResult.split_occurred).toBe(false);
      cell = res.nextState;
      expect(cell.active_members).toHaveLength(i);
      expect(cell.buffer_members).toHaveLength(0);
    }
  });

  it("places members 11 and 12 into buffer_members", () => {
    let cell: CellState = {
      cell_id: "urn:pfs:cell:alpha",
      active_members: Array.from({ length: 10 }, (_, i) => `0xmember_${i + 1}`),
      buffer_members: [],
    };

    const res11 = evaluateCellGrowth(cell, "0xmember_11", 10, 3);
    expect(res11.splitResult.split_occurred).toBe(false);
    expect(res11.nextState.buffer_members).toEqual(["0xmember_11"]);

    const res12 = evaluateCellGrowth(res11.nextState, "0xmember_12", 10, 3);
    expect(res12.splitResult.split_occurred).toBe(false);
    expect(res12.nextState.buffer_members).toEqual(["0xmember_11", "0xmember_12"]);
  });

  it("triggers atomic cleavage (split_occurred: true) when member 13 arrives", () => {
    const cell: CellState = {
      cell_id: "urn:pfs:cell:alpha",
      active_members: Array.from({ length: 10 }, (_, i) => `0xmember_${i + 1}`),
      buffer_members: ["0xmember_11", "0xmember_12"],
    };

    const res = evaluateCellGrowth(cell, "0xmember_13", 10, 3);

    expect(res.splitResult.split_occurred).toBe(true);
    // Célula original reseta seu buffer
    expect(res.nextState.active_members).toHaveLength(10);
    expect(res.nextState.buffer_members).toHaveLength(0);

    // Célula filha gerada com os 3 excedentes e 7 vagas pendentes via VRF
    expect(res.splitResult.child_cell_seed).toBeDefined();
    expect(res.splitResult.child_cell_seed?.seed_members).toEqual([
      "0xmember_11",
      "0xmember_12",
      "0xmember_13",
    ]);
    expect(res.splitResult.child_cell_seed?.needed_vrf_count).toBe(7);
  });

  it("rejects invalid or duplicate members with ProtocolException", () => {
    const cell: CellState = {
      cell_id: "urn:pfs:cell:alpha",
      active_members: ["0xmember_1"],
      buffer_members: ["0xmember_2"],
    };

    // Membro vazio
    expect(() => evaluateCellGrowth(cell, "", 10, 3)).toThrow(ProtocolException);

    // Membro já presente nos ativos
    expect(() => evaluateCellGrowth(cell, "0xmember_1", 10, 3)).toThrow(ProtocolException);

    // Membro já presente no buffer
    expect(() => evaluateCellGrowth(cell, "0xmember_2", 10, 3)).toThrow(ProtocolException);
  });

  it("evaluates cell capacity correctly via evaluateCellCapacity", () => {
    // 1. Abaixo de K: aceitação direta
    const cap1 = evaluateCellCapacity({
      currentActiveCount: 7,
      currentBufferCount: 0,
      kLimit: 10,
      betaLimit: 3,
    });
    expect(cap1).toEqual({ canAcceptDirectly: true, needsBuffer: false, triggerSplit: false });

    // 2. K cheio, buffer com vaga
    const cap2 = evaluateCellCapacity({
      currentActiveCount: 10,
      currentBufferCount: 1,
      kLimit: 10,
      betaLimit: 3,
    });
    expect(cap2).toEqual({ canAcceptDirectly: false, needsBuffer: true, triggerSplit: false });

    // 3. K cheio, próximo membro estoura o buffer (split)
    const cap3 = evaluateCellCapacity({
      currentActiveCount: 10,
      currentBufferCount: 2,
      kLimit: 10,
      betaLimit: 3,
    });
    expect(cap3).toEqual({ canAcceptDirectly: false, needsBuffer: false, triggerSplit: true });
  });
});

describe("Consensus Module: Contestação Construtiva e Migração de Votos", () => {
  it("migrates votes atomically between different proposals", () => {
    const res = calculateVoteMigration({
      fromProposalId: "urn:pfs:prop:1",
      toProposalId: "urn:pfs:prop:2",
      fromProposalVotes: 5,
      toProposalVotes: 3,
    });

    expect(res.fromNewVotes).toBe(4);
    expect(res.toNewVotes).toBe(4);
  });

  it("rejects migration to the same proposal", () => {
    expect(() =>
      calculateVoteMigration({
        fromProposalId: "urn:pfs:prop:1",
        toProposalId: "urn:pfs:prop:1",
        fromProposalVotes: 5,
        toProposalVotes: 5,
      })
    ).toThrow(ProtocolException);
  });

  it("rejects migration when source proposal has 0 votes", () => {
    expect(() =>
      calculateVoteMigration({
        fromProposalId: "urn:pfs:prop:1",
        toProposalId: "urn:pfs:prop:2",
        fromProposalVotes: 0,
        toProposalVotes: 3,
      })
    ).toThrow(ProtocolException);
  });

  it("rejects migration with negative vote numbers", () => {
    expect(() =>
      calculateVoteMigration({
        fromProposalId: "urn:pfs:prop:1",
        toProposalId: "urn:pfs:prop:2",
        fromProposalVotes: -1,
        toProposalVotes: 3,
      })
    ).toThrow(ProtocolException);
  });
});

describe("DefaultConsensusEngine Facade", () => {
  it("delegates consensus methods through the facade class", () => {
    const engine = new DefaultConsensusEngine();

    const timelock = engine.calculateTimelock({
      votes: 10,
      kSize: 10,
      qMin: 5,
      tMaxSeconds: 864_000,
      tGraceSeconds: 172_800,
      alpha: 1.5,
      t0FirstQuorumTimestamp: 1_000_000,
      currentNetworkTime: 1_000_100,
    });
    expect(timelock.isClosed).toBe(true);

    const capacity = engine.evaluateCellCapacity({
      currentActiveCount: 5,
      currentBufferCount: 0,
      kLimit: 10,
      betaLimit: 3,
    });
    expect(capacity.canAcceptDirectly).toBe(true);

    const migration = engine.calculateVoteMigration({
      fromProposalId: "prop1",
      toProposalId: "prop2",
      fromProposalVotes: 4,
      toProposalVotes: 2,
    });
    expect(migration.fromNewVotes).toBe(3);
    expect(migration.toNewVotes).toBe(3);
  });
});
