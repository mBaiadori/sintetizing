# PFS-CD — Protocolo Fractal de Síntese e Consenso Dinâmico
**Versão 2.2 — Sistema de Governança Distribuída, Assíncrona e Resistente à Oligarquização**

---

## 📖 Visão Geral

O **PFS-CD** é uma infraestrutura de coordenação social desenhada para substituir o atrito retórico e a polarização das redes tradicionais pela destilação de texto convergente assistida por inteligência artificial neutra, com participação direta de todos os membros.

O protocolo opera sobre três pilares de inovação institucional:
1. **Participação Universal com Síntese por IA:** Todos os membros participam diretamente do debate sem intermediários. A Inteligência Artificial neutra atua como secretária: analisa as contribuições de todos, identifica pontos de convergência e redige versões unificadas (as sínteses) para avaliação da comunidade.
2. **Escala Multinível Soberana (Comunidades, Sociedades e Federação):** A governança se articula organicamente a partir da base local (**Comunidades**), agrupando-se regionalmente (**Sociedades**) e conectando-se em larga escala (**Federação**), preservando a autonomia direta em qualquer escala.
3. **Contestação Construtiva Estrita com Comparativo Visual:** O protocolo não possui rejeição passiva. Para contestar uma ideia, o dissidente propõe uma alteração pontual no texto (com alterações em verde e exclusões em vermelho) e convence os membros a migrarem seu apoio.

---

## 🗺️ Mapa de Documentação e Especificação Técnica

O projeto é guiado por uma abordagem **Contract-First** e **Spec-Driven**, com especificação completa de requisitos, tipos e interfaces antes da codificação:

### 1. Documentos Fundamentais
* **[whitepapper.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/whitepapper.md):** Especificação teórica integral, formulação matemática do consenso dinâmico, mecânica celular e JSON schemas canônicos.
* **[implement.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/implement.md):** Arquitetura técnica modular em 6 blocos desacoplados e **Matriz de Composição Open Source** (ferramentas maduras prontas para reuso).
* **[CONSTRAINTS.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/CONSTRAINTS.md):** Contrato inegociável de qualidade e segurança (100% de cobertura no Core, proibição de `any`/`@ts-ignore`, limites anti-DoS e proteção XSS).

### 2. Normas de Engenharia, Contratos e Design (em `docs/` e `.agents/`)
* **[docs/DOMAIN_MODEL.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/DOMAIN_MODEL.md):** Dicionário canônico de dados, tipos estritos, limites de caracteres (min/max), regex de URNs e máquinas de estados formais da proposta e da célula.
* **[docs/CONTRACTS_AND_APIS.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/CONTRACTS_AND_APIS.md):** Interfaces TypeScript públicas entre os módulos (`ICryptoEngine`, `IConsensusEngine`, `IMerkleDagStorage`, etc.) e taxonomia unificada de erros (`ProtocolError`).
* **[docs/UI_DESIGN_SYSTEM.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/UI_DESIGN_SYSTEM.md):** Sistema de design, tokens CSS canônicos, classes semânticas de UX (`.gov-*`), anatomia de componentes e normas WCAG 2.1 AA.
* **[.agents/rules/reusability.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/.agents/rules/reusability.md):** Regra ativa do workspace impondo o princípio *Search Before Write*, a regra *One-Version*, o uso estrito de design tokens e a proibição de duplicações de código.

### 3. Especificações Detalhadas por Fase de Implementação
* **[docs/01_fase1_fundacao_pura.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/01_fase1_fundacao_pura.md):** Fase 1 — Núcleo determinístico sem efeitos colaterais (cálculo de $T(v)$, clivagem $\beta$-split, esquemas Zod e chaves Ed25519).
* **[docs/02_fase2_integridade_local.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/02_fase2_integridade_local.md):** Fase 2 — Merkle DAG de eventos imutáveis, projeções relacionais em SQLite WASM e pipeline determinístico de validação em 5 passos.
* **[docs/03_fase3_aplicacao_experiencia.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/03_fase3_aplicacao_experiencia.md):** Fase 3 — Câmara deliberativa efêmera (chat volátil descartável), editor Tiptap com diffs visuais humanizados, co-piloto de IA neutro (WebLLM via WebGPU) e simulador multi-persona local.
* **[docs/04_fase4_descentralizacao_p2p.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/04_fase4_descentralizacao_p2p.md):** Fase 4 — Rede descentralizada libp2p GossipSub, arquitetura em duas camadas (Light Clients + Relays neutros sem custódia) e reconciliação offline-first.

### 4. Telas do Aplicativo e Experiência do Cidadão (em `docs/views/`)
* **[docs/views/README.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/README.md):** Mapa completo de navegação e telas em linguagem simples:
  * **[00. Cadastro e Entrada Simples](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/00_cadastro_e_entrada.md)** (`/cadastro`)
  * **[01. Painel da Comunidade](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/01_painel_da_comunidade.md)** (`/c/:idComunidade`)
  * **[02. Sala dos 10 (Conversa e Voto)](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/02_sala_dos_10_conversa_e_voto.md)** (`/c/:idComunidade/celula/:idCelula`)
  * **[03. Leitura e Comparação da Proposta](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/03_leitura_e_mudancas_proposta.md)** (`/c/:idComunidade/proposta/:idProposta`)
  * **[04. Criação e Edição de Proposta](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/04_criar_ou_editar_proposta.md)** (`/c/:idComunidade/proposta/nova`)
  * **[05. Meu Perfil e Segurança](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/05_perfil_e_seguranca.md)** (`/perfil`)

### 5. Catálogo de Componentes Visuais (em `docs/components/`)
* **[docs/components/README.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/components/README.md):** Especificação em texto puro dos blocos de interface:
  * **[00. Componentes Genéricos e Design System](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/components/00_componentes_genericos.md):** Botões, inputs, cards, modais, abas, badges, tooltips, skeletons e escala tipográfica.
  * **[01. Governança e Célula](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/components/01_governanca_e_celula.md):** Mesa dos 10 assentos, assento individual e alerta de clivagem.
  * **[02. Consenso e Relógio Vivo](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/components/02_consenso_e_relogio.md):** Barra do timelock $T(v)$, placar de quórum e botão biométrico de voto.
  * **[03. Propostas e Comparações (Diffs)](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/components/03_propostas_e_diffs.md):** Card de proposta, leitor de documento, comparador de mudanças e editor.
  * **[04. Bate-Papo Efêmero e IA](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/components/04_batepapo_e_ia.md):** Painel descartável, gravador de áudio e síntese neutra da IA.
  * **[05. Identidade e Navegação](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/components/05_identidade_e_navegacao.md):** Cabeçalho da comunidade, card de sorteio e gaveta de perfil.

---

## 🛡️ Pilha Tecnológica Open Source Composta

| Camada | Tecnologia Selecionada | Papel no PFS-CD |
| :--- | :--- | :--- |
| **Criptografia & Identidade** | `@noble/ed25519` + `@simplewebauthn` | Assinaturas sem dependências e Passkeys com biometria nativa |
| **Componentes Base & Estado** | `shadcn/ui` + `Radix` + `Zustand` | Base acessível (WCAG AA), botões, modais e estado reativo leve (<1KB) |
| **Edição & Diffs de Texto** | `Tiptap` + `Yjs` (CRDT) | Sugestões colaborativas de emendas e branches sem conflito |
| **Persistência Local** | `@sqlite.org/sqlite-wasm` | Projeções de estado no navegador via Origin Private File System |
| **Rede P2P & Relays** | `libp2p` (GossipSub) + `nostr-tools` | Difusão de commits assinados e relays leves descentralizados |
| **Inteligência Artificial** | `@mlc-ai/web-llm` | Síntese de deliberações rodando localmente na GPU via WebGPU (R$ 0,00) |

---

## 🚀 Status da Implementação

### ✅ Fase 1: Fundação Pura (`@sintetizing/core`) — CONCLUÍDA
* **Monorepo:** Configurado com `pnpm workspaces` e TypeScript estrito total (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `exactOptionalPropertyTypes: true`).
* **Criptografia Determinística (`src/crypto/`):**
  * Serialização canônica RFC 8785 e Hashing SHA-256 (`canonical.ts`).
  * Geração de chaves Ed25519, derivação determinística de `persona_id` e assinaturas digitais (`keys.ts`).
  * Sorteio verificável determinístico por VRF (`vrf.ts`).
* **Consenso e Regras Matemáticas (`src/consensus/`):**
  * Timelock dinâmico $T(v)$ com decaimento exponencial e contração temporal estrita (`timelock.ts`).
  * Topologia celular ($K=10$), fila de amortecimento ($\beta=3$) e gatilho atômico de clivagem fractal (`cellular.ts`).
  * Contestação construtiva e migração atômica de votos entre propostas (`migration.ts`).
* **Schemas Canônicos de Validação (`src/schemas/`):**
  * Persona, Comunidade ($\Omega_C$), Proposta polimórfica e Commits do Merkle DAG via Zod.
* **Cobertura de Testes Automatizados:**
  * **100% Statements | 100% Branches | 100% Functions | 100% Lines** (39 testes unitários via Vitest).

#### Comandos Úteis:
```bash
# Executar todos os testes unitários
pnpm test

# Executar suíte de cobertura com verificação dos thresholds estritos
pnpm test:coverage

# Checagem estrita de tipos
pnpm typecheck
```

