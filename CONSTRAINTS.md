# CONSTRAINTS.md — Contrato de Qualidade e Segurança Inegociável
**Projeto:** Sintetize — Infraestrutura Local-First de Síntese e Consenso Dinâmico  
**Versão do Contrato:** 1.1 (Regras Estritas para Humanos e Agentes de IA)

---

## 1. O Piso Absoluto (The Floor)

As regras abaixo são inegociáveis. Qualquer Pull Request ou código gerado por agente de IA que viole este piso deve ser **sumariamente rejeitado**.

1. **Tipagem Estrita Total no Compilador:**
   * O arquivo `tsconfig.base.json` deve conter `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true` e `"exactOptionalPropertyTypes": true`.
   * **Proibição Absoluta do tipo `any`:** Utilizar `unknown` para dados não validados nas bordas, seguido de narrowing estrito via Zod ou decodificação binária validada.
   * **Zero Supressões Silenciosas:** É estritamente proibido o uso de `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` ou comentários de desativação do linter (`eslint-disable`). Se há erro de tipo, o tipo está errado e deve ser consertado.

2. **Integridade da Suíte de Testes:**
   * É proibido desativar, pular (`it.skip`, `describe.skip`) ou deletar testes existentes para obter status verde.
   * Proibido remover ou enfraquecer asserções (`expect(...)`) para ocultar regressões.
   * Proibido criar stubs de teste vazios sem asserções reais.

---

## 2. Metas Numéricas de Cobertura de Testes

Os limites de cobertura de testes automatizados são verificados mecanicamente pelo Vitest:

| Módulo do Sistema | Cobertura Mínima de Linhas | Cobertura Mínima de Ramos (Branch) | Ação em Caso de Violação |
| :--- | :--- | :--- | :--- |
| **`packages/wire/src`** (envelope, TLV, validadores, Merkle, estado) | **100%** | **95%** | Bloqueio imediato de build |
| **`packages/domain`** (quórum, prazos, diff $N \times N$) | **100%** | **100%** | Bloqueio imediato de build |
| **`packages/storage`** (persistência local e projeções) | **90%** | **85%** | Bloqueio imediato de build |
| **`packages/network`** (Blind Relay, `RelayPool`, delta sync) | **90%** | **85%** | Bloqueio imediato de build |
| **`apps/web/components`** | **80%** | **75%** | Alerta no pipeline de CI |

---

## 3. Orçamento de Segurança e Hardening

1. **Proteção contra DoS e Exaustão de Recursos:**
   * **Teto Máximo de Payload:** Todo pacote `.stze` ou evento recebido via rede P2P/relay que exceda **100 Kilobytes** deve ser descartado antes do parsing completo ou verificação criptográfica.
   * **Limites de String/TLV:** Campos da fita TLV seguem limites rígidos (`SCOPE`: 3–128 bytes; `TITLE`: 5–160 bytes; `BODY`: 1–4.000 bytes; `LAW_ARTICLE`: 3–2.002 bytes).

2. **Mitigação contra Ataques de Replay e Fraude:**
   * **Idempotência Criptográfica:** Um pacote `.stze` com o mesmo `docId` (SHA-256 dos bytes) nunca pode ser reprocessado nem duplicado no estado.
   * **Anti-Replay Monotônico:** Pacotes `PICK` e `COMMUNITY_PICK` exigem `seq > seq_atual` do autor; pacotes com `seq` menor ou igual são rejeitados imediatamente.

3. **Prevenção contra XSS (Cross-Site Scripting):**
   * Nenhum conteúdo gerado por usuário (propostas, emendas, mensagens) pode ser renderizado via `dangerouslySetInnerHTML` ou similar sem passar previamente por sanitização via biblioteca auditada (ex.: DOMPurify).
   * Tags permitidas em formatação rica: exclusivamente `<p>`, `<b>`, `<i>`, `<ul>`, `<li>`, `<blockquote>`, `<h1>`-`<h3>`, `<del>`, `<ins>`. Qualquer tag `<script>`, `<iframe>`, `<object>` ou atributos de evento (`onload`, `onerror`) são expurgados.

4. **Custódia Zero e Isolamento de Chaves:**
   * Chaves privadas Ed25519 nunca são enviadas para servidores/relays, nunca são persistidas em `localStorage` inseguro e nunca trafegam em mensagens de rede.
   * Em clientes web/mobile, a assinatura é protegida localmente no dispositivo via WebAuthn/Passkeys (ou WebCrypto não-extraível como fallback).

---

## 4. Orçamento de Performance (SLOs Locais)

O protocolo deve operar de forma imperceptível em smartphones e hardware modesto:

| Operação | Tempo Máximo de Resposta | Ambiente de Medição |
| :--- | :--- | :--- |
| **Verificação de Pacote `.stze`** | $\le 5 \text{ ms}$ | CPU do navegador / mobile |
| **Ingestão e Cálculo de Placar/Quórum** | $\le 10 \text{ ms}$ | CPU do navegador / mobile |
| **Consulta de Propostas Ativas** | $\le 20 \text{ ms}$ | Storage local (IndexedDB / OPFS) |
| **Renderização de Diff Visual $N \times N$** | $\le 50 \text{ ms}$ | Interface PWA / DOM |

---

## 5. Regras de Manutenibilidade do Código

1. **Sem Dependências Circulares:** A direção das dependências deve ser unidirecional e linear:
   $$\text{Wire} \longrightarrow \text{Domain} \longrightarrow \text{Storage} \longrightarrow \text{Network} \longrightarrow \text{UI}$$
   O módulo `Wire` nunca importa `Storage`, `Network` ou `UI`.
2. **Funções Puras no Núcleo:** As funções de codificação, validação estrutural, cálculo de estado e Diff dentro de `packages/wire` e `packages/domain` não podem realizar chamadas de rede, acessar I/O de disco ou ler o relógio do sistema diretamente (`timestamp` deve ser recebido como parâmetro).
