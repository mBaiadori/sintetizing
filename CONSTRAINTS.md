# CONSTRAINTS.md — Contrato de Qualidade e Segurança Inegociável
**Projeto:** Protocolo Fractal de Síntese e Consenso Dinâmico 
**Versão do Contrato:** 1.0 (Regras Estritas para Humanos e Agentes de IA)

---

## 1. O Piso Absoluto (The Floor)

As regras abaixo são inegociáveis. Qualquer Pull Request ou código gerado por agente de IA que viole este piso deve ser **sumariamente rejeitado**.

1. **Tipagem Estrita Total no Compilador:**
   * O arquivo `tsconfig.json` deve conter `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true` e `"exactOptionalPropertyTypes": true`.
   * **Proibição Absoluta do tipo `any`:** Utilizar `unknown` para dados não validados nas bordas, seguido de narrowing estrito via Zod.
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
| **`packages/core/crypto`** | **100%** | **100%** | Bloqueio imediato de build |
| **`packages/core/consensus`** | **100%** | **100%** | Bloqueio imediato de build |
| **`packages/storage/validator`** | **95%** | **90%** | Bloqueio imediato de build |
| **`packages/storage/dag`** | **90%** | **85%** | Bloqueio imediato de build |
| **`apps/web/components`** | **80%** | **75%** | Alerta no pipeline de CI |

---

## 3. Orçamento de Segurança e Hardening

1. **Proteção contra DoS e Exaustão de Recursos:**
   * **Teto Máximo de Payload:** Todo evento recebido via rede P2P ou relay que exceda **100 Kilobytes** deve ser descartado antes do parsing JSON completo.
   * **Limites de String:** Textos de propostas são validados por limites rígidos (Problema: máx 5.000 chars; Solução: máx 10.000 chars; Chat: máx 2.000 chars).

2. **Mitigação contra Ataques de Replay e Fraude Temporal:**
   * **Idempotência Criptográfica:** Um commit com o mesmo hash nunca pode ser processado mais de uma vez.
   * **Median Time Past (MTP):** O timestamp de qualquer novo evento deve ser estritamente superior à mediana dos últimos 11 blocos da comunidade. Timestamps no passado são rejeitados imediatamente (`ERR_TIMESTAMP_BEFORE_MTP`).

3. **Prevenção contra XSS (Cross-Site Scripting):**
   * Nenhum conteúdo gerado por usuário (propostas, emendas, mensagens) pode ser renderizado via `dangerouslySetInnerHTML` ou similar sem passar previamente por sanitização via biblioteca auditada (ex.: DOMPurify).
   * Tags permitidas no editor: exclusivamente formatação rica segura (`<p>`, `<b>`, `<i>`, `<ul>`, `<li>`, `<blockquote>`, `<h1>`-`<h3>`, `<del>`, `<ins>`). Qualquer tag `<script>`, `<iframe>`, `<object>` ou atributos de evento (`onload`, `onerror`) são expurgados.

4. **Custódia Zero e Isolamento de Chaves:**
   * Chaves privadas nunca são enviadas para servidores, nunca são persistidas em `localStorage` inseguro e nunca trafegam em mensagens de rede.
   * Em clientes web/mobile, a assinatura é delegada ao Secure Enclave do dispositivo via WebAuthn/Passkeys.

---

## 4. Orçamento de Performance (SLOs Locais)

O protocolo deve operar de forma imperceptível em smartphones e hardware modesto:

| Operação | Tempo Máximo de Resposta | Ambiente de Medição |
| :--- | :--- | :--- |
| **Cálculo de Timelock $T(v)$** | $\le 1 \text{ ms}$ | CPU do navegador / mobile |
| **Cálculo de Clivagem Celular** | $\le 2 \text{ ms}$ | CPU do navegador / mobile |
| **Validação Completa de Commit** | $\le 10 \text{ ms}$ | CPU do navegador / mobile |
| **Consulta de Propostas Ativas** | $\le 20 \text{ ms}$ | SQLite WASM local |
| **Renderização de Diff Visual** | $\le 50 \text{ ms}$ | Interface Tiptap / DOM |

---

## 5. Regras de Manutenibilidade do Código

1. **Sem Dependências Circulares:** A direção das dependências deve ser unidirecional e linear:
   $$\text{Core} \longrightarrow \text{Storage} \longrightarrow \text{Network} \longrightarrow \text{UI}$$
   O Core nunca importa Storage ou Network.
2. **Funções Puras no Núcleo:** Nenhuma função dentro de `packages/core` pode realizar chamadas assíncronas de I/O, ler o relógio do sistema diretamente (`Date.now()` deve ser recebido como parâmetro) ou acessar variáveis globais mutáveis.
