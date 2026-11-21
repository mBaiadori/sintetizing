# CONSTRAINTS.md — Contrato de Qualidade e Segurança Inegociável
**Projeto:** Sintetize — Infraestrutura Local-First de Síntese e Consenso Dinâmico  
**Versão do Contrato:** 1.2 (Modo Protótipo / Exploração Ativa)

---

## 1. O Piso Absoluto (The Floor)

As regras abaixo são inegociáveis. Qualquer Pull Request ou código gerado por agente de IA que viole este piso deve ser **sumariamente rejeitado**.

1. **Tipagem Estrita Total no Compilador:**
   * O arquivo `tsconfig.base.json` deve conter `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true` e `"exactOptionalPropertyTypes": true`.
   * **Proibição Absoluta do tipo `any`:** Utilizar `unknown` para dados não validados nas bordas, seguido de narrowing estrito via decodificação binária/runtime validada.
   * **Zero Supressões Silenciosas:** É estritamente proibido o uso de `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` ou comentários de desativação do linter (`eslint-disable`). Se há erro de tipo, o tipo está errado e deve ser consertado.

2. **Integridade da Suíte de Testes (Fase Protótipo / Exploração Ativa):**
   * Por decisão explícita do projeto durante a exploração do protocolo TLV + Nostr (`07_COMMUNITY_PROTOCOL_AND_SYNC.md` / `08_TLV_DOCUMENT_TYPES.md`) e do Explorador de Documentos:
     * Mantém-se **1 suíte enxuta de teste de fumaça** em `packages/wire/test/wire.smoke.spec.ts` cobrindo empacotamento, desempacotamento e verificação Ed25519 nos universos `.cmnt`, `.memb`, `.stze` e `.snap`.
     * Ficam dispensadas metas de cobertura pesada e suítes de testes em `domain`, `storage`, `network` e `apps/web` até a estabilização do protocolo e da interface (quando os gates de cobertura retornarão).
   * Dentro da suíte existente, continua proibido desativar (`it.skip`, `describe.skip`) ou enfraquecer asserções para ocultar falhas.

---

## 2. Verificação Obrigatória na Fase Atual

| Camada / Comando | Requisito Atual | Ação em Caso de Violação |
| :--- | :--- | :--- |
| **`pnpm typecheck`** (`wire`, `domain`, `storage`, `network`, `web`) | 0 erros com TS estrito + `exactOptionalPropertyTypes` | Bloqueio imediato |
| **`pnpm build`** (`packages/*` + `apps/web`) | Build completo sem erros de empacotamento | Bloqueio imediato |
| **`pnpm test`** (`packages/wire/test/wire.smoke.spec.ts`) | 100% dos testes de fumaça binária passando | Bloqueio imediato |
| **`domain` / `storage` / `network` / `apps/web`** | Sem gates de cobertura durante exploração | Retornam na estabilização |

---

## 3. Orçamento de Segurança e Hardening

1. **Proteção contra DoS e Exaustão de Recursos:**
   * **Teto Máximo de Payload:** Todo pacote binário ou evento recebido via Nostr/relay que exceda **100 Kilobytes** (`102400` bytes) deve ser descartado antes do parsing completo ou verificação criptográfica.
   * **Limites de String/TLV:** Campos da fita TLV seguem limites rígidos (`SCOPE`: 3–128 bytes; `TITLE`: 5–160 bytes; `BODY`: 1–4.000 bytes; `LAW_ARTICLE`: 3–2.002 bytes; `INACTIVITY_DAYS`: 1–3.650 dias).

2. **Mitigação contra Ataques de Replay e Fraude:**
   * **Idempotência Criptográfica:** Um pacote com o mesmo `docId` (SHA-256 dos bytes) nunca pode ser reprocessado nem duplicado no estado.
   * **Anti-Replay Monotônico:** Pacotes `PICK`, `COMMUNITY_PICK` e `MEMB_LEAVE` exigem `seq` monotônico crescente por autor; apenas a última posição válida por autor prevalece.

3. **Prevenção contra XSS (Cross-Site Scripting):**
   * Nenhum conteúdo gerado por usuário (propostas, documentos, mensagens) pode ser renderizado via `dangerouslySetInnerHTML` ou similar.

4. **Custódia Zero e Isolamento de Chaves:**
   * Chaves privadas Ed25519 nunca são enviadas para relays Nostr ou servidores e nunca trafegam em mensagens de rede.
   * Chaves secp256k1 usadas apenas no envelope Nostr são derivadas localmente por comunidade para preservar privacidade entre comunidades.

---

## 4. Orçamento de Performance (SLOs Locais)

O protocolo deve operar de forma imperceptível em smartphones e hardware modesto:

| Operação | Tempo Máximo de Resposta | Ambiente de Medição |
| :--- | :--- | :--- |
| **Verificação de Pacote TLV** | $\le 5 \text{ ms}$ | CPU do navegador / mobile |
| **Ingestão e Cálculo de Estado / Quórum** | $\le 10 \text{ ms}$ | CPU do navegador / mobile |
| **Consulta Local de Pacotes** | $\le 20 \text{ ms}$ | Storage local (IndexedDB) |

---

## 5. Regras de Manutenibilidade do Código

1. **Sem Dependências Circulares:** A direção das dependências deve ser unidirecional e linear:
   $$\text{Wire} \longrightarrow \text{Domain} \longrightarrow \text{Storage} \longrightarrow \text{Network} \longrightarrow \text{UI}$$
   O módulo `Wire` nunca importa `Domain`, `Storage`, `Network` ou `UI`.
2. **Funções Puras no Núcleo:** As funções de codificação, validação estrutural, inspeção TLV e cálculo de comunidade dentro de `packages/wire` e `packages/domain` não podem realizar chamadas de rede, acessar I/O de disco ou ler o relógio do sistema diretamente (`nowMs` deve ser recebido como parâmetro).
