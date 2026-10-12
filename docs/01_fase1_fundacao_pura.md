# Especificação Técnica — Fase 1: Fundação Pura

**PFS-CD (Protocolo Fractal de Síntese e Consenso Dinâmico)**
**Módulos Contemplados:** Bloco 1 (Criptografia, Tipos & Schemas) + Bloco 2 (Motor Matemático & Regras)

---

## 1. Objetivo da Fase 1

Construir o **núcleo determinístico puro** do protocolo, composto exclusivamente por funções sem efeitos colaterais (*pure functions*), estruturas de dados tipadas e suíte de testes unitários com 100% de cobertura. Esta fase não possui conexão de rede, banco de dados ou interface gráfica.

---

## 2. Dependências Open Source

```bash
npm install @noble/ed25519 @noble/hashes @simplewebauthn/browser @simplewebauthn/server zod
npm install -D typescript vitest @types/node
```

* **`@noble/ed25519` / `@noble/hashes`**: Geração de chaves, assinaturas determinísticas e hashing SHA-256 (auditado, zero dependências).
* **`@simplewebauthn`**: Criação de credenciais biométricas (Passkeys) e derivação de pares de chaves Ed25519.
* **`zod`**: Schemas de validação em tempo de execução com tipagem estática inferida em TypeScript.
* **`vitest`**: Executor ultrarrápido de testes unitários.

---

## 3. Estrutura de Diretórios Recomendada

```
packages/core/
├── src/
│   ├── crypto/
│   │   ├── keys.ts           # Geração e assinatura Ed25519
│   │   ├── passkeys.ts       # Integração com WebAuthn
│   │   ├── canonical.ts      # Serialização canônica (RFC 8785) e SHA-256
│   │   └── vrf.ts            # Sorteio verificável determinístico
│   ├── schemas/
│   │   ├── persona.ts        # Tipos e validação de Persona
│   │   ├── community.ts      # Genesis e vetor paramétrico Ω_C
│   │   ├── proposal.ts       # ProposalObject polimórfico
│   │   └── events.ts         # StateEventCommit e deltas
│   ├── consensus/
│   │   ├── timelock.ts       # Função T(v) e encerramento t*
│   │   ├── cellular.ts       # Lotação K=10, buffer β=3 e clivagem
│   │   └── migration.ts      # Contestação construtiva e migração de votos
│   └── index.ts
└── test/
    ├── timelock.spec.ts
    ├── cellular.spec.ts
    ├── crypto.spec.ts
    └── migration.spec.ts
```

---

## 4. Contratos de Dados e Schemas (TypeScript + Zod)

### 4.1. Parâmetros da Comunidade ($\Omega_C$)

```typescript
import { z } from "zod";

export const CommunityParametersSchema = z.object({
  node_size_k: z.number().int().default(10),
  buffer_size_beta: z.number().int().default(3),
  default_quorum_min: z.number().int().default(5),
  default_time_max_seconds: z.number().int().default(864000),      // 10 dias
  default_grace_period_seconds: z.number().int().default(172800),  // 2 dias
  decay_exponent_alpha: z.number().default(1.5),
  idle_timeout_seconds: z.number().int().default(604800),          // 7 dias
  inactivity_archive_seconds: z.number().int().default(15552000),   // 180 dias
});

export type CommunityParameters = z.infer<typeof CommunityParametersSchema>;
```

### 4.2. O Objeto Proposta (Proposal)

```typescript
export const ProposalTypeEnum = z.enum([
  "ACTION_DEADLINE",
  "CANONICAL_RULE",
  "FACT_EVIDENCE",
  "INCUBATOR"
]);

export const ProposalTemplateSchema = z.object({
  problem: z.string().min(5),
  solution: z.string().min(5),
  resources: z.object({
    budget_estimate: z.number().nonnegative().optional(),
    funding_source: z.string().optional(),
    labor_execution: z.string().optional(),
  }).optional(),
  success_metrics: z.array(z.string()).optional(),
});

export const ProposalObjectSchema = z.object({
  proposal_id: z.string(),
  community_id: z.string(),
  proposal_type: ProposalTypeEnum,
  ancestor_hash: z.string().nullable(),
  created_at: z.number().int(),
  author_persona_id: z.string(),
  template_data: ProposalTemplateSchema,
  state: z.object({
    current_status: z.enum(["VOTING_ACTIVE", "EXECUTABLE", "CANONICAL", "ARCHIVED"]),
    current_votes: z.number().int().nonnegative(),
    quorum_min: z.number().int(),
    t0_first_quorum_timestamp: z.number().int().nullable(),
    target_closure_timestamp: z.number().int().nullable(),
  })
});
```

---

## 5. Implementação dos Motores Matemáticos

### 5.1. Equação do Timelock Dinâmico $T(v)$

Implementa a contração temporal proporcional ao consenso alcançado:

```typescript
export interface TimelockInput {
  v: number;               // Votos atuais na proposta
  K: number;               // Tamanho do nó (padrão 10)
  Q_min: number;           // Quórum mínimo (padrão 5)
  T_max: number;           // Tempo teto em segundos (ex: 864.000)
  T_grace: number;         // Janela de carência em segundos (ex: 172.800)
  alpha: number;           // Expoente de decaimento (ex: 1.5)
}

export function calculateTimelockRemaining(input: TimelockInput): number {
  const { v, K, Q_min, T_max, T_grace, alpha } = input;

  if (v < Q_min) {
    return Infinity;
  }
  if (v >= K) {
    return 0; // Unanimidade: fechamento imediato
  }
  if (v === K - 1) {
    return T_grace; // Janela mínima de segurança
  }

  // T_max * ((K - v) / (K - Q_min))^alpha
  const contractionRatio = (K - v) / (K - Q_min);
  const remaining = T_max * Math.pow(contractionRatio, alpha);

  return Math.max(remaining, T_grace);
}
```

### 5.2. Mecânica Celular e Gatilho de Clivagem ($\beta$-Split)

```typescript
export interface CellState {
  cell_id: string;
  active_members: string[]; // Personas ativas (teto K=10)
  buffer_members: string[]; // Fila de amortecimento (teto β=3)
}

export interface SplitResult {
  split_occurred: boolean;
  original_cell?: CellState;
  child_cell_seed?: {
    seed_members: string[];  // Os 3 excedentes
    needed_vrf_count: number; // 7 novos membros da fila geral
  };
}

export function evaluateCellGrowth(
  current: CellState,
  newMember: string,
  K: number = 10,
  beta: number = 3
): { nextState: CellState; splitResult: SplitResult } {
  const total = current.active_members.length + current.buffer_members.length;

  if (current.active_members.length < K) {
    return {
      nextState: {
        ...current,
        active_members: [...current.active_members, newMember]
      },
      splitResult: { split_occurred: false }
    };
  }

  // Célula base cheia (10). Entra no buffer
  const updatedBuffer = [...current.buffer_members, newMember];

  if (updatedBuffer.length < beta) {
    return {
      nextState: { ...current, buffer_members: updatedBuffer },
      splitResult: { split_occurred: false }
    };
  }

  // Atingiu K + beta = 13: GATILHO DE CLIVAGEM ATÔMICA
  const originalCell: CellState = {
    cell_id: current.cell_id,
    active_members: [...current.active_members],
    buffer_members: []
  };

  const childSeed = {
    seed_members: [...updatedBuffer], // 3 membros
    needed_vrf_count: K - updatedBuffer.length // 7 vagas
  };

  return {
    nextState: originalCell,
    splitResult: {
      split_occurred: true,
      original_cell: originalCell,
      child_cell_seed: childSeed
    }
  };
}
```

---

## 6. Plano de Testes Automatizados (Critérios de Aceite)

1. **Teste de Timelock:**
   * Garantir que $v < 5$ retorna `Infinity`.
   * Garantir que $v = 5$ retorna $T_{\text{max}}$.
   * Garantir que $v = 9$ retorna $T_{\text{grace}}$.
   * Garantir que $v = 10$ retorna $0$.
   * Garantir decaimento monotônico decrescente estrito para todo $v \in [5, 9]$.
2. **Teste de Clivagem:**
   * Inserir 10 membros e verificar que todos entram em `active_members`.
   * Inserir 11º e 12º membros e verificar que entram em `buffer_members`.
   * Inserir 13º membro e verificar que `split_occurred` é verdadeiro, isolando os 3 excedentes para o novo nó filho.
3. **Teste Criptográfico:**
   * Gerar par de chaves `Ed25519`, assinar um payload e verificar assinatura.
   * Modificar 1 caractere do payload canônico e garantir rejeição na verificação.
