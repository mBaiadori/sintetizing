# Plano de Arquitetura e Implementação Modular — PFS-CD

**Protocolo Fractal de Síntese e Consenso Dinâmico (Versão 2.2)**

Este documento detalha a decomposição arquitetural do protocolo em blocos modulares e desacoplados, permitindo o desenvolvimento, teste e evolução independente de cada camada e componente do sistema.

---

## 1. Visão Geral da Arquitetura

O objetivo desta decomposição é separar as regras matemáticas e criptográficas determinísticas da infraestrutura de rede, persistência e interface de usuário. Isso garante que:

1. As regras de consenso e transição possam ser testadas com 100% de previsibilidade (*pure functions*, sem I/O).
2. O armazenamento e a topologia de grafo funcionem como um log local imutável (*event sourcing*).
3. A camada de rede P2P seja intercambiável ou mockável para testes de integração.
4. A interface gráfica consuma uma API de alto nível fornecida pelo validador local, sem exigir que o cidadão domine conceitos técnicos.

---

## 2. Diagrama de Dependências entre Blocos

```mermaid
flowchart TD
    subgraph CoreFoundation [Fundação Pura]
        B1["Bloco 1: Criptografia, Tipos & Schemas"]
        B2["Bloco 2: Motor Matemático (Timelock, Clivagem, Consenso)"]
    end

    subgraph DataAndSecurity [Integridade e Estado Local]
        B3["Bloco 3: Merkle DAG & Storage (Append-only + Projeções)"]
        B5["Bloco 5: Pipeline de Verificação Client-Side"]
    end

    subgraph NetworkLayer [Comunicação Descentralizada]
        B4["Bloco 4: Rede P2P Gossip, Relays & Chat Efêmero"]
    end

    subgraph ApplicationLayer [Usuário Final & Ergonomia]
        B6["Bloco 6: UI, Chat Descartável, Diffs & Assistente IA"]
    end

    B1 --> B2
    B1 --> B3
    B1 --> B5
    B2 --> B5
    B4 --> B5
    B5 --> B3
    B3 --> B6
    B6 --> B5
    B6 -.-> B4
```

---

## 3. Especificação dos 6 Grandes Blocos

### Bloco 1: Criptografia, Tipos e Esquemas (`Core & Schemas`)

* **Responsabilidade:** Biblioteca base com primitivas criptográficas, estruturas de dados tipadas e esquemas canônicos.
* **Componentes Principais:**
  * **Schemas Canônicos:** JSON Schemas estritos para validação de `CommunityGenesis`, `ProposalObject` e `StateEventCommit`.
  * **Criptografia Assimétrica e Passkeys:** Geração de chaves, assinatura e verificação utilizando chaves `Ed25519` nativas ou derivadas via WebAuthn/Passkeys (biometria segura).
  * **Hashing e Canonicalização:** Hashing `SHA-256` sobre representações determinísticas (JSON canônico RFC 8785).
  * **VRF (Verifiable Random Function):** Mecanismo de sorteio com comprovação criptográfica para convocação aleatória de membros.
  * **Identidade Soberana (`Persona`):** Identificador derivado da chave pública, esquemas de *peer-vouching* e proteção Anti-Sybil.
* **Sem dependências externas de rede ou I/O:** Biblioteca pura e determinística.

---

### Bloco 2: Motor Matemático e Topologia Celular (`Consensus Engine`)

* **Responsabilidade:** Lógica determinística e regras da teoria dos jogos que governam a deliberação coletiva.
* **Componentes Principais:**
  * **Princípio da Autoria Despersonalizada (Propostas Sem Dono):** Toda proposta pertence ao domínio comum da célula; não há mantenedores com poder de veto.
  * **Equação de Timelock Dinâmico:** Implementação da função de decaimento temporal:
    $$
    T(v) = \begin{cases} \infty, & v < Q_{\text{min}} \\ T_{\text{max}} \cdot \left(\frac{K - v}{K - Q_{\text{min}}}\right)^\alpha, & Q_{\text{min}} \le v < K - 1 \\ T_{\text{grace}}, & v = K - 1 \\ 0, & v = K \end{cases}
    $$
  * **Critério de Fechamento Irrefutável:** Determinação exata de encerramento de votação ($t^*$).
  * **Topologia Celular ($N_1$):**
    * Tamanho base $K = 10$.
    * Amortecimento e buffer $\beta = 3$ (capacidade máxima $K + \beta = 13$).
    * Gatilho de clivagem atômica ($\text{Trigger}_{\text{split}}$) redistribuindo excedentes com convocação VRF.
  * **Contestação Construtiva via Diffs/Branches:** Criação de emendas incrementais a partir de propostas existentes sem retrabalho de redação integral.
  * **Fusão de Síntese:** Mecânica de migração de votos para novas versões consolidadas negociadas na célula.
  * **Ascensão Fractal e Rotação Sequencial:** Rotação compulsória de assentos para nós de nível superior ($N_2, N_3$).

---

### Bloco 3: Grafo de Eventos e Persistência Local (`Merkle DAG & Storage`)

* **Responsabilidade:** Armazenamento seguro orientado a eventos (*event sourcing*) e cálculo de projeções de estado.
* **Componentes Principais:**
  * **Append-Only Merkle DAG Store:** Armazena commits imutáveis indexados por seu `commit_hash`, mantendo links para `parent_hashes`.
  * **Separação Ruído vs. Sinal:** Armazena apenas o resultado final cristalizado (propostas e votos). Conversas efêmeras jamais entram no DAG.
  * **Projeção de Estado Atual (Read Models):** Banco de dados relacional ou chave-valor local (SQLite/IndexedDB/RocksDB) que materializa:
    * Estado de cada comunidade e seus parâmetros $\Omega_C$.
    * Propostas ativas, ramos alternativos (*branches*), votos agregados e prazos correntes.
    * Histórico de membros ativos por célula/nó.
  * **Snapshots e Arquivamento:** Garbage collection de propostas inativas ($\Delta t_{\text{idle}}$) e congelamento de comunidades inativas (> 180 dias) para leitura fria.

---

### Bloco 4: Camada de Rede P2P, Relays e Comunicação Efêmera (`Networking & Gossip`)

* **Responsabilidade:** Descoberta de pares, transporte de mensagens e propagação de eventos sem intermediários centrais.
* **Componentes Principais:**
  * **Arquitetura de Duas Camadas:**
    * **Light Clients (Mobile/Browser):** Sincronizam deltas sob demanda sem drenar bateria nem manter conexões 24/7.
    * **Relays Descentralizados:** Servidores comunitários neutros mantendo a difusão GossipSub viva.
  * **GossipSub (libp2p):** Protocolo de difusão epidêmica de commits de estado organizado em tópicos.
  * **Canal Deliberativo Efêmero:** Transporte P2P volátil para o chat da célula de 10 participantes, com expiração automática de mensagens após o encerramento do nó.
  * **Protocolo de Sincronização (DAG Sync):** Reconciliação rápida de ramos do Merkle DAG quando nós se reconectam.
  * **Cálculo de MTP (Median Time Past):** Proteção contra fraudes no relógio local.

---

### Bloco 5: Pipeline de Verificação Client-Side (`Client Verification Daemon`)

* **Responsabilidade:** Atuar como firewall determinístico do nó, validando rigorosamente todo evento recebido antes da persistência ou redistribuição.
* **Fases do Pipeline de Validação:**
  1. **Validação Estrutural:** Conformidade com o JSON Schema do evento.
  2. **Validação Criptográfica:** Verificação da assinatura digital `Ed25519` contra a `Persona` emissora.
  3. **Validação de Convocação:** Verificação da semente VRF garantindo que a Persona tem assento ativo na célula.
  4. **Validação Temporal:** Checagem da janela de oportunidade contra o tempo de rede (MTP).
  5. **Validação de Transição de Estado:** Garantia de que a ação respeita o estado anterior da proposta no Merkle DAG (quórum legal, branches válidos).
* **Quarentena de Maliciosos:** Eventos que violam regras são descartados sem propagação, isolando nós maliciosos em forks sem consenso.

---

### Bloco 6: Interface do Usuário, Ergonomia e Assistente de Síntese (`UI & Client App`)

* **Responsabilidade:** Proporcionar uma experiência humana fluida, sem jargões criptográficos, reduzindo drasticamente o esforço cognitivo do cidadão.
* **Componentes Principais:**
  * **Autenticação Biométrica Invisível (Passkeys):** Assinatura de transações via FaceID/TouchID sem necessidade de anotar sementes de 12 palavras.
  * **Câmara Deliberativa Efêmera (Chat da Célula $N_1$):**
    * Sala de conversa informal, com suporte a mensagens rápidas e áudios curtos.
    * Totalmente descartável (auto-destrutível após a consolidação da célula).
  * **Visualizador de Diffs Humanizado:**
    * Renderização de emendas e ramificações como sugestões colaborativas visuais (estilo Word/Google Docs), permitindo comparar propostas alternativas instantaneamente.
  * **Co-Piloto de IA Neutro para Síntese:**
    * Assistente local sob demanda capaz de analisar o chat efêmero e propor um rascunho de síntese unificada para aprovação dos membros da célula.
  * **Monitor de Consenso em Tempo Real:** Cronômetro dinâmico exibindo $T(v)$ e o impacto visual de cada novo voto ou migração.

---

## 4. Matriz de Composição Open Source (Ferramentas Existentes)

O PFS-CD não exige pesquisa e desenvolvimento de baixo nível do zero. A arquitetura se baseia na **composição de tecnologias open source maduras**, auditadas e amplamente adotadas pela indústria:

| Bloco Arquitetural                            | O Que Precisamos Resolver                                                                                                               | Ferramentas Open Source Selecionadas                                                                                                                                                                                                        | Justificativa Técnica                                                                                                                                                                                                                                                               |
| :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bloco 1: Cripto & Identidade**        | • Chaves Ed25519• Passkeys / Biometria• Validação de Schemas                                                                       | •**`@noble/ed25519`** & **`@noble/hashes`**• **`@simplewebauthn`**• **`Zod`** / **`Ajv`**                                                                                                        | • As libs`@noble` são padrão ouro (auditadas, zero dependências).• `@simplewebauthn` conecta ao Secure Enclave (TouchID/FaceID).• `Zod`/`Ajv` validam schemas JSON em microssegundos.                                                                                  |
| **Bloco 2: Diffs, Branches & Consenso** | • Comparação de texto (Diffs)• Versionamento sem conflito• Máquina de Estados da Proposta                                         | •**`Yjs`** ou **`Automerge`** (CRDTs)• **`diff-match-patch`** (Google)• **`XState`**                                                                                                                     | • CRDTs (`Yjs`/`Automerge`) resolvem branches, merges e histórico sem conflito.• `diff-match-patch` calcula diffs semânticos legíveis para leigos.• `XState` formaliza a máquina de estados das propostas.                                                            |
| **Bloco 3: Merkle DAG & Storage**       | • Armazenamento Append-Only• Merkle DAG de commits• Banco de dados local                                                             | •**`isomorphic-git`** ou **`IPLD / Multiformats`**• **`SQLite WASM`** (com OPFS) ou **`Dexie.js`**                                                                                                        | •`isomorphic-git` implementa Git 100% em TypeScript (browser e Node).• SQLite WASM roda localmente no navegador via Origin Private File System.                                                                                                                                  |
| **Bloco 4: Rede P2P, Relays & Chat**    | • Difusão Gossip entre nós• Relays sem custódia• Chat efêmero da célula                                                         | •**`libp2p`** (GossipSub / WebRTC)• **Protocolo `Nostr`** (`nostr-tools`)• **`Waku`**                                                                                                                          | •`libp2p` é a base do IPFS e Ethereum.• Relays do Nostr são ultra-leves e eficientes para transporte WebSocket.• `Waku` viabiliza chat efêmero P2P mobile sem consumo de bateria.                                                                                          |
| **Bloco 5: Validador do Cliente**       | • Pipeline de checagem determinística                                                                                                 | • TypeScript puro + Middleware funcional (estilo**`tRPC`** / **`Koa`**)                                                                                                                                                          | • Cadeia de validações puras (*pipes*): assinatura, quórum, MTP e invariantes.                                                                                                                                                                                                 |
| **Bloco 6: UI, Editor & Assistente IA** | • Componentes base acessíveis• Gestão de estado reativo• Notificações e ícones• Editor com sugestões• IA local para síntese | •**`shadcn/ui`** + **`Radix UI`**• **`Zustand`**• **`Sonner`** + **`Lucide Icons`**• **`Tiptap`** / **`ProseMirror`** + **`Yjs`**• **`WebLLM`** (WebGPU local) | •`shadcn/ui` e `Radix` economizam 80% do código de UI com WCAG nativo.• `Zustand` gerencia a mesa dos 10 e votos com reatividade leve (<1KB).• `Tiptap` oferece emendas visuais colaborativas com `Yjs`.• `WebLLM` roda IA localmente na GPU sem custo de servidor. |

### Diferencial Exclusivo do Projeto (Regras Proprietárias)

Todo o ecossistema acima entra como infraestrutura pronta. O núcleo proprietário do PFS-CD concentra-se exclusivamente em:

1. **A Função de Timelock Dinâmico $T(v)$** modulando a contração do cronômetro.
2. **A Mecânica de Célula de 10 participantes ($K=10$) com $\beta$-Split e VRF**.
3. **A Contestação Construtiva Estrita** (ausência de voto negativo passivo, apenas migração de votos para emendas).

---

## 5. Fases de Implementação Recomendadas

```mermaid
gantt
    title Roteiro de Implementação Modular 
    dateFormat  YYYY-MM-DD
    section Fase 1: Fundação Pura
    Bloco 1 (Schemas & Criptografia)       :done, 2026-10-10, 7d
    Bloco 2 (Motor Matemático & Regras)   :done, 2026-10-14, 10d
    section Fase 2: Integridade Local
    Bloco 3 (Merkle DAG & Projeções)       :active, 2026-10-21, 10d
    Bloco 5 (Pipeline de Validação)        :active, 2026-10-26, 8d
    section Fase 3: Experiência & Chat
    Bloco 6 (UI Web, Chat Efêmero & IA)    :2026-11-03, 14d
    section Fase 4: Descentralização
    Bloco 4 (Rede P2P, Relays & Gossip)    :2026-11-17, 14d
```

### Detalhamento e Documentos Específicos por Fase

Cada etapa possui agora um documento técnico próprio de especificação com dependências, código de exemplo, interfaces TypeScript e critérios de aceite:

1. **[Fase 1 — Fundação Pura](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/01_fase1_fundacao_pura.md):**
   * Schemas canônicos com Zod, assinaturas `Ed25519` via `@noble`, Passkeys (`@simplewebauthn`), cálculo determinístico do timelock $T(v)$ e regras de divisão celular $K=10, \beta=3$.
2. **[Fase 2 — Integridade Local e Event Sourcing](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/02_fase2_integridade_local.md):**
   * Append-only Merkle DAG, projeções relacionais em SQLite WASM, pipeline determinístico de validação em 5 passos e isolamento de forks em quarentena.
3. **[Fase 3 — Aplicação do Cidadão, Chat Efêmero e Simulador](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/03_fase3_aplicacao_experiencia.md):**
   * Interface sem jargões criptográficos, editor Tiptap + Yjs para diffs amigáveis de contrapropostas, sala de chat descartável da célula, co-piloto de IA neutro rodando no navegador (WebLLM) e simulador multi-persona.
4. **[Fase 4 — Rede P2P, Relays e Descentralização](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/04_fase4_descentralizacao_p2p.md):**
   * Arquitetura em duas camadas (Light Clients em smartphones + Relays neutros sem custódia 24/7), difusão GossipSub via `libp2p`, transporte efêmero e reconciliação offline-first.
