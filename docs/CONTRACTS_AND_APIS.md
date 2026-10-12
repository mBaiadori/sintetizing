# Contratos de Interfaces, Limites e APIs
**PFS-CD (Protocolo Fractal de Síntese e Consenso Dinâmico)**
**Classificação:** Especificação Técnica de Fronteiras de Módulos (*Contract-First Architecture*)

---

## 1. Princípios Arquiteturais das Interfaces

Seguindo as diretrizes de **`api-and-interface-design`**, nenhum módulo do sistema deve acessar diretamente bancos de dados internos, estruturas brutas de rede ou implementações privadas de outros módulos. 

### Regras Centrais:
1. **Contract-First:** As interfaces TypeScript definidas neste documento constituem o contrato oficial. A implementação é um detalhe que se adapta ao contrato, e não o oposto.
2. **Validação nas Bordas (*Validate at Boundaries*):** O código interno assume tipos válidos e sanitizados. A validação estrutural via Zod e a sanitização XSS ocorrem estritamente nas fronteiras (recebimento de input da UI ou recebimento de pacotes da rede Gossip P2P).
3. **Taxonomia Unificada de Erros:** Não há mistura de exceções soltas, retornos nulos aleatórios ou formatos ad-hoc. Toda falha retorna a mesma estrutura canônica `ProtocolError`.

---

## 2. Taxonomia Canônica de Erros (`ProtocolError`)

Toda operação do protocolo que falhar deve retornar ou lançar um objeto estruturado em conformidade com o tipo abaixo:

```typescript
export type ErrorCategory = 
  | "VALIDATION"
  | "CRYPTO"
  | "CONSENSUS"
  | "NETWORK"
  | "STORAGE";

export type ErrorCode = 
  // Validação Estrutural e Limites
  | "ERR_SCHEMA_VIOLATION"
  | "ERR_PAYLOAD_TOO_LARGE"
  | "ERR_STRING_OUT_OF_BOUNDS"
  
  // Criptografia e Identidade
  | "ERR_INVALID_SIGNATURE"
  | "ERR_MALFORMED_PUBLIC_KEY"
  | "ERR_INVALID_VRF_PROOF"
  | "ERR_PERSONA_NOT_VOUCHED"
  
  // Consenso e Regras de Negócio
  | "ERR_CELL_SEATS_FULL"
  | "ERR_MEMBER_NOT_IN_CELL"
  | "ERR_TIMELOCK_EXPIRED"
  | "ERR_QUORUM_NOT_MET"
  | "ERR_ILLEGAL_STATE_TRANSITION"
  | "ERR_PROPOSAL_ALREADY_CLOSED"
  | "ERR_MIGRATION_SAME_TARGET"
  
  // Rede e Sincronização
  | "ERR_TIMESTAMP_BEFORE_MTP"
  | "ERR_RELAY_UNREACHABLE"
  | "ERR_DAG_PARENT_NOT_FOUND"
  | "ERR_FORK_QUARANTINED";

export interface ProtocolError {
  category: ErrorCategory;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}
```

---

## 3. Contratos de Fronteira entre Módulos

### 3.1. Módulo Core Criptográfico (`ICryptoEngine`)
Responsável pelas operações criptográficas puras e determinísticas.

```typescript
export interface KeyPair {
  publicKeyHex: string;  // 64 caracteres hex
  privateKeyHex: string; // 64 caracteres hex
}

export interface ICryptoEngine {
  // Geração e manipulação de chaves
  generateKeyPair(): Promise<KeyPair>;
  derivePersonaId(publicKeyHex: string): string;

  // Assinaturas determinísticas
  signCanonicalPayload(privateKeyHex: string, payload: unknown): Promise<string>;
  verifySignature(publicKeyHex: string, payload: unknown, signatureHex: string): Promise<boolean>;

  // Hashing determinístico RFC 8785 + SHA-256
  computeCanonicalHash(payload: unknown): string;

  // Verifiable Random Function (VRF)
  generateVrfProof(privateKeyHex: string, seed: string): Promise<{ proof: string; output: string }>;
  verifyVrfProof(publicKeyHex: string, seed: string, proof: string): Promise<boolean>;
}
```

---

### 3.2. Módulo de Consenso e Topologia (`IConsensusEngine`)
Responsável pela matemática de decaimento temporal, clivagem celular e regras de transição.

```typescript
export interface TimelockCalculation {
  remainingSeconds: number;
  targetClosureTimestamp: number;
  isClosed: boolean;
  quorumMet: boolean;
}

export interface IConsensusEngine {
  // Cálculo de Timelock Dinâmico T(v)
  calculateTimelock(params: {
    votes: number;
    kSize: number;
    qMin: number;
    tMaxSeconds: number;
    tGraceSeconds: number;
    alpha: number;
    t0FirstQuorumTimestamp: number | null;
    currentNetworkTime: number;
  }): TimelockCalculation;

  // Avaliação de Lotação e Clivagem da Célula
  evaluateCellCapacity(params: {
    currentActiveCount: number;
    currentBufferCount: number;
    kLimit: number;
    betaLimit: number;
  }): {
    canAcceptDirectly: boolean;
    needsBuffer: boolean;
    triggerSplit: boolean;
  };

  // Cálculo de Migração de Votos
  calculateVoteMigration(params: {
    fromProposalVotes: number;
    toProposalVotes: number;
  }): {
    fromNewVotes: number;
    toNewVotes: number;
  };
}
```

---

### 3.3. Módulo de Armazenamento e DAG (`IMerkleDagStorage`)
Responsável pelo log imutável de eventos e pelas projeções relacionais locais.

```typescript
export interface IMerkleDagStorage {
  // Gravação no log imutável
  appendCommit(commit: StateEventCommit): Promise<void>;

  // Consultas no grafo de commits
  getCommitByHash(hash: string): Promise<StateEventCommit | null>;
  getHeadCommitHashes(communityId: string): Promise<string[]>;
  findLowestCommonAncestor(hashA: string, hashB: string): Promise<string | null>;
  getCommitsSince(commonAncestorHash: string): Promise<StateEventCommit[]>;

  // Projeções materializadas (Leitura rápida)
  getProposalProjection(proposalId: string): Promise<ProposalObject | null>;
  listActiveProposals(communityId: string): Promise<ProposalObject[]>;
  getCellState(cellId: string): Promise<Cell | null>;
  
  // Median Time Past (MTP) para verificação temporal
  getMedianTimePast(communityId: string, lookbackCount?: number): Promise<number>;
}
```

---

### 3.4. Módulo Validador do Cliente (`IEventValidator`)
O firewall determinístico que protege o nó contra corrupção e manipulação.

```typescript
export type ValidationOutcome = 
  | { valid: true }
  | { valid: false; error: ProtocolError };

export interface IEventValidator {
  // Pipeline completo de validação
  validateIncomingEvent(event: StateEventCommit): Promise<ValidationOutcome>;

  // Validações isoladas
  validateSchema(event: unknown): ValidationOutcome;
  validateSignature(event: StateEventCommit): Promise<ValidationOutcome>;
  validateVrfElection(event: StateEventCommit): Promise<ValidationOutcome>;
  validateTemporalMtp(event: StateEventCommit): Promise<ValidationOutcome>;
  validateConsensusRules(event: StateEventCommit): Promise<ValidationOutcome>;
}
```

---

### 3.5. Módulo de Rede e Relays (`INetworkService`)
Transporte P2P descentralizado e canais efêmeros.

```typescript
export interface INetworkService {
  // Inscrição em tópicos canônicos de fofoca da comunidade
  subscribeCommunityEvents(
    communityId: string, 
    onEvent: (event: StateEventCommit) => void
  ): Promise<{ unsubscribe: () => void }>;

  // Difusão de novo commit assinado
  broadcastCommit(communityId: string, event: StateEventCommit): Promise<void>;

  // Canal Efêmero da Célula N1 (Chat Volátil Descartável)
  joinCellEphemeralChat(
    cellId: string,
    onMessage: (msg: EphemeralChatMessage) => void
  ): Promise<{
    sendMessage: (content: string, type: "TEXT" | "AUDIO_SNIPPET") => Promise<void>;
    leaveChat: () => void;
  }>;

  // Sincronização sob demanda (Light Client)
  syncCommunityHistory(
    communityId: string,
    localKnownHeads: string[]
  ): Promise<StateEventCommit[]>;
}
```

---

### 3.6. Módulo Co-Piloto de IA para Síntese (`ISynthesisCoPilot`)
Assistente neutro que extrai consensos do bate-papo efêmero sem ferir a soberania dos usuários.

```typescript
export interface SynthesisInput {
  cellId: string;
  chatTranscript: { sender: string; text: string }[];
  activeProposalsSummaries: string[];
}

export interface SynthesisOutput {
  suggestedProblem: string;
  suggestedSolution: string;
  consensusPointsFound: string[];
  divergencePointsRemaining: string[];
}

export interface ISynthesisCoPilot {
  isAiEngineReady(): boolean;
  initEngine(progressCallback?: (status: string) => void): Promise<void>;
  generateConsensusProposal(input: SynthesisInput): Promise<SynthesisOutput>;
}
```

---

## 4. Diretrizes de Sanitização e Segurança nas Bordas

```
[ Input do Usuário / Rede P2P ]
               │
               ▼
   [ Sanitização Estrutural (Zod) ] ── Falha ──► Retorna ERR_SCHEMA_VIOLATION
               │
               ▼
   [ Sanitização XSS (DOMPurify)  ] ── Remove scripts, iframes e atributos maliciosos
               │
               ▼
   [ Pipeline Criptográfico Core  ] ── Execução segura com tipos confiáveis
```

1. **Anti-XSS em Documentos de Proposta:** Todo texto livre ou Markdown inserido no editor colaborativo deve passar obrigatoriamente por sanitização estrita antes de ser renderizado na interface. Tags perigosas (`<script>`, `<iframe>`, `onload`, `javascript:`) são sumariamente eliminadas.
2. **Imutabilidade em Tempo de Execução:** Objetos transmitidos internamente entre módulos devem ser encapsulados com `Object.freeze()` ou bibliotecas imutáveis para prevenir poluição acidental de estado compartilhado.
3. **Idempotência Estrita no Storage:** O método `appendCommit` verifica se o `commit_hash` já existe. Se existir, a operação é tratada com sucesso sem duplicar nenhum registro nem alterar ponteiros.
