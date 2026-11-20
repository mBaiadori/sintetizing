# Resumo Executivo — Sintetize (`system-design`)

O **Sintetize** é uma infraestrutura **Local-First** de governança direta e tomada de decisão coletiva (para condomínios, bairros, cooperativas e coletivos). Cada pessoa real tem **1 voz** autenticada no próprio dispositivo, sem líderes intermediários, sem servidores donos dos dados e sem botões de rejeição passiva — quem discorda apresenta ou evolui uma alternativa concreta e a comunidade converge seus apoios até o consenso.

---

## 1. Principais Features (por Módulo)

| Módulo | O que entrega na prática |
| :--- | :--- |
| **Community**<br>([01_COMMUNITY.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/system-design/01_COMMUNITY.md)) | • Espaços privados ou públicos com categorias e parâmetros próprios.<br>• Assuntos (`Subject`) com janela de conversa (`Chat time`) e prazo final (`Deadline`).<br>• **Quórum dinâmico** com expurgo automático de membros inativos e proteção anti-sniping.<br>• **Federações (`Society`)** para projetos entre várias comunidades mantendo autonomia local.<br>• **Tesouraria sem custódia** (vaquinha/escrow liberada apenas após comprovação da entrega). |
| **Proposal**<br>([02_PROPOSAL.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/system-design/02_PROPOSAL.md)) | • Árvore aberta: qualquer membro pode propor ou ramificar (*fork*) a partir de qualquer versão.<br>• Campos dinâmicos e repetíveis (texto, múltiplos valores em centavos, prazos, artigos, anexos).<br>• **Diff universal $N \times N$**: comparação lado a lado entre quaisquer duas propostas (adições em verde, cortes em vermelho).<br>• **Congelamento pós-quórum**: corpo da proposta fica imutável; apenas a seção de **Execução** fica aberta para fotos, notas fiscais e confirmação dos membros. |
| **Person**<br>([03_PERSON.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/system-design/03_PERSON.md)) | • **Cofre biométrico local** (WebAuthn/Passkeys destrancando chave Ed25519 no aparelho).<br>• **Apoio único e móvel (`Pick`)**: 1 apoio ativo por assunto, transferível livremente (`A → B → A`).<br>• **Rastro auditável (`Footprint`)**: histórico completo e verificável das mudanças de apoio.<br>• **Anti-Sybil + Recuperação Social M-de-N**: entrada validada por pares e recuperação da identidade por 3–5 guardiões em caso de perda/roubo do celular. |
| **AI**<br>([04_AI.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/system-design/04_AI.md)) | • Assistente neutro plugável (Ollama local ou API REST).<br>• Lê a conversa do chat efêmero (descartado após o prazo) e propostas concorrentes.<br>• Extrai convergências/divergências e gera um **rascunho tipado (Zod)**.<br>• **Zero voto e zero veto**: rascunhos só entram na rede se um humano assinar. |
| **P2P & Rede**<br>([05_P2P.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/system-design/05_P2P.md)) | • Topologia **Local-First**: celulares guardam o histórico completo da comunidade; **Blind Relays** (1 comando Docker) apenas retransmitem pacotes assinados 24/7.<br>• Sincronização offline-first por diferenças (`SyncHello` / `SyncDelta`).<br>• Sobrevivência a desastre duplo (VPS + celular perdidos são restaurados pelos vizinhos).<br>• Alertas leves para prazos, sínteses e provas de entrega. |
| **Interface**<br>([06_INTERFACE.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/system-design/06_INTERFACE.md)) | • **PWA instalável direto no navegador** (sem App Store / Google Play), funcional offline.<br>• Criptografia invisível (linguagem humana em vez de jargão técnico).<br>• Acessibilidade **WCAG 2.1 AA** (alvos de toque $\ge 44 \times 44\text{ px}$).<br>• Placar e termômetro de quórum em tempo real (`Metrics & Classifica`). |

---

## 2. Resumo da Implementação Técnica

### Fluxo de Camadas
$$\text{Wire (`.stze` + Estado Puro)} \longrightarrow \text{Domain (Regras & Diff)} \longrightarrow \text{Storage (Local-First)} \longrightarrow \text{Network (Blind Relay / P2P)} \longrightarrow \text{UI (PWA)}$$

### Núcleo Binário & Estado (`@sintetizing/wire` — Implementado)
- **Formato de Pacote `.stze`:** Cabeçalho fixo de **102 bytes** (`version` 1B + `docType` 1B + `authorPub` 32B + `seq` 4B + `signature` Ed25519 64B) seguido por fita sequencial **TLV** (`[TAG 2B][LENGTH 2B][VALUE]`). Um `PICK` completo ocupa apenas **106–110 bytes**; o `docId` é o `SHA-256` do pacote calculado na hora (zero hashes redundantes).
- **Motor de Assunto (`SubjectStateEngine`):**
  - Valida assinatura Ed25519 e limites TLV na porta de entrada;
  - Bloqueia replay de votos antigos exigindo `seq > seq_atual`;
  - Atualiza placar atomicamente (`-1` na opção anterior, `+1` na nova ou `0` para retirada) e grava o `Footprint`;
  - Resolve herança e emendas modulares por `PARENT_HASH`;
  - Gera rollup comunitário (`COMMUNITY_PICK`) com **Raiz Merkle (32B)** para escalar para Sociedades e Federações.
- **Sincronização & Recuperação (`NodePeer` + `SocialRecovery`):**
  - `SyncHello` envia IDs de propostas conhecidas e o maior `seq` por autor; `SyncDelta` devolve apenas os pacotes faltantes, tolerando quedas no meio da transmissão;
  - `verifyRecoveryQuorum` valida assinaturas M-de-N dos guardiões para sucessão de chave sem perda do histórico.

### Status Atual vs. Próximas Etapas

| Camada | Status | Resumo |
| :--- | :--- | :--- |
| **`packages/wire`** | ✅ **Implementado** | Codec `.stze` TLV, assinaturas Ed25519, `SubjectStateEngine`, Árvore/Prova Merkle, `NodePeer` (`SyncHello`/`SyncDelta`), `SocialRecovery`, scripts de simulação/carga e 39 testes automatizados. |
| **`packages/domain`** | 🔜 **Planejado** | Máquina de estados do `Subject`, quórum efetivo com inatividade, anti-sniping, congelamento e Diff visual $N \times N$ sobre fitas TLV. |
| **`packages/storage`** | 🔜 **Planejado** | Persistência local de pacotes `.stze` no navegador (IndexedDB / SQLite OPFS) e reidratação do `SubjectStateEngine`. |
| **`packages/network`** | 🔜 **Planejado** | Servidor Blind Relay WebSocket em Docker (store por tópico + canal volátil para chat efêmero) e `RelayPool` cliente com failover. |
| **`packages/ai`** | 🔜 **Planejado** | Driver `ISynthesisProvider` (Ollama local / API) com validação estrita por Zod gerando rascunhos editáveis. |
| **`apps/web`** | 🔜 **Planejado** | PWA React + Vite offline-first com Passkeys/WebAuthn e painel da comunidade. |
