# Sistema de Design, Tokens e Regras de Interface (UI/UX)
**PFS-CD (Protocolo Fractal de Síntese e Consenso Dinâmico)**
**Classificação:** Especificação Normativa de Interface, Tokens Visuais e Acessibilidade

---

## 1. Filosofia de Design e Psicologia Cognitiva

Em um protocolo de consenso e síntese, a interface não é apenas estética: **ela é a arquiteta dos incentivos comportamentais**. As redes sociais da Web 2.0 induzem a discórdia porque utilizam layouts de feeds infinitos, botões de reação agressiva e métricas de vaidade. 

O PFS-CD adota uma filosofia diametralmente oposta:

1. **Anti-Feed (Foco no Objeto Vivo):** Não há rolagem infinita nem timeline caótica. A visão central é sempre o documento deliberativo em evolução e a mesa de trabalho da célula de 10 pessoas.
2. **Transparência Cívica e Calma Visual:** O design combina o rigor institucional de documentos de estado com a sofisticação fluida de ferramentas modernas como Linear, Notion e Apple. Tipografia espaçada, ausência de poluição visual e contraste acolhedor.
3. **Invisibilidade Criptográfica Total:** O cidadão **nunca** deve ver strings hexadecimais confusas (como hashes de 64 caracteres ou chaves públicas). A criptografia opera silenciosamente sob o capô via biometria nativa (Passkeys).
4. **Psicologia das Cores de Consenso:**
   * A discordância **não é punida nem tratada como guerra**. O surgimento de contrapropostas e emendas é sinalizado com tons calorosos de âmbar/ouro (*"revisão construtiva / enriquecimento do debate"*), e nunca com alertas agressivos de perigo.
   * O fechamento do consenso é sinalizado com esmeralda e ciano sutis (*"convergência alcançada"*).

---

## 2. Design Tokens Canônicos (CSS Variables)

Os tokens abaixo são declarados em CSS puro, permitindo uso direto tanto em Vanilla CSS quanto em frameworks modernos.

```css
:root {
  /* ==========================================================================
     1. PALETA DE CORES — MODO CLARO (Default Light)
     ========================================================================== */
  
  /* Superfícies & Fundos Neutros */
  --bg-canvas: #f8fafc;            /* Fundo geral da aplicação */
  --bg-surface: #ffffff;           /* Superfície de painéis principais */
  --bg-card: #f1f5f9;              /* Cards e contêineres secundários */
  --bg-overlay: rgba(15, 23, 42, 0.4); /* Fundo de modais */
  --bg-glass: rgba(255, 255, 255, 0.85); /* Efeito vidro com backdrop-filter */

  /* Bordas & Separadores */
  --border-subtle: #e2e8f0;
  --border-default: #cbd5e1;
  --border-strong: #94a3b8;
  --border-focus: #3b82f6;

  /* Tipografia & Contrastes */
  --text-primary: #0f172a;         /* Títulos e texto principal (WCAG AAA) */
  --text-secondary: #475569;       /* Descrições e parágrafos */
  --text-muted: #64748b;           /* Legendas e metadados secundários */
  --text-inverse: #ffffff;         /* Texto sobre fundos escuros */

  /* ==========================================================================
     2. CORES SEMÂNTICAS DE GOVERNANÇA E ESTADO
     ========================================================================== */
  
  /* Consenso Dinâmico (Adesão & Contração de Timelock) */
  --gov-consensus: #059669;        /* Esmeralda ativo */
  --gov-consensus-subtle: #d1fae5; /* Fundo suave de consenso */
  --gov-consensus-glow: rgba(5, 150, 105, 0.25);

  /* Revisão & Contestação Construtiva (Emendas / Diffs) */
  --gov-revision: #d97706;         /* Âmbar ativo */
  --gov-revision-subtle: #fef3c7;  /* Fundo suave de emenda */

  /* Clivagem Celular & Buffer (Transbordo Beta-Split) */
  --gov-split: #6366f1;            /* Índigo de transição */
  --gov-split-subtle: #e0e7ff;     /* Fundo suave de buffer */

  /* Alertas & Violações Formais */
  --gov-alert: #e11d48;            /* Carmim de atenção */
  --gov-alert-subtle: #ffe4e6;

  /* Diffs de Texto Colaborativo */
  --diff-add-bg: rgba(16, 185, 129, 0.15);
  --diff-add-text: #065f46;
  --diff-del-bg: rgba(244, 63, 94, 0.15);
  --diff-del-text: #9f1239;

  /* ==========================================================================
     3. TIPOGRAFIA & ESCALAS MODULARES
     ========================================================================== */
  
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-reading: "Newsreader", "Charter", Georgia, serif; /* Leitura longa de propostas */
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, Monaco, monospace; /* Números e prazos */

  --text-xs: 0.75rem;    /* 12px - Metadados de assentos e timestamps */
  --text-sm: 0.875rem;   /* 14px - Interface secundária e inputs */
  --text-base: 1.000rem; /* 16px - Corpo de texto e bate-papo */
  --text-lg: 1.125rem;   /* 18px - Subtítulos e destaques */
  --text-xl: 1.250rem;   /* 20px - Títulos de blocos */
  --text-2xl: 1.500rem;  /* 24px - Títulos de propostas */
  --text-3xl: 2.000rem;  /* 32px - Títulos principais da comunidade */

  --line-tight: 1.25;
  --line-normal: 1.50;
  --line-relaxed: 1.75;

  /* ==========================================================================
     4. ESPAÇAMENTO & GRID (Base 4px / 8px)
     ========================================================================== */
  
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.50rem;  /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1.00rem;  /* 16px */
  --space-6: 1.50rem;  /* 24px */
  --space-8: 2.00rem;  /* 32px */
  --space-12: 3.00rem; /* 48px */
  --space-16: 4.00rem; /* 64px */

  /* ==========================================================================
     5. BORDAS, SOMBRAS & ELEVAÇÃO
     ========================================================================== */
  
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.10), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
  --shadow-glow: 0 0 20px var(--gov-consensus-glow);

  /* ==========================================================================
     6. MOTION & TRANSIÇÕES
     ========================================================================== */
  
  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-quick: 150ms;
  --duration-normal: 250ms;
  --duration-relaxed: 400ms;
}

/* ==========================================================================
   TEMA ESCURO (Dark Mode Nativo)
   ========================================================================== */
.dark, [data-theme="dark"] {
  --bg-canvas: #090d16;
  --bg-surface: #111827;
  --bg-card: #1f2937;
  --bg-overlay: rgba(0, 0, 0, 0.7);
  --bg-glass: rgba(17, 24, 39, 0.85);

  --border-subtle: #1f2937;
  --border-default: #374151;
  --border-strong: #4b5563;

  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-muted: #94a3b8;

  --gov-consensus: #10b981;
  --gov-consensus-subtle: rgba(16, 185, 129, 0.15);
  
  --gov-revision: #fbbf24;
  --gov-revision-subtle: rgba(251, 191, 36, 0.15);

  --gov-split: #818cf8;
  --gov-split-subtle: rgba(129, 140, 248, 0.15);

  --diff-add-bg: rgba(16, 185, 129, 0.20);
  --diff-add-text: #6ee7b7;
  --diff-del-bg: rgba(244, 63, 94, 0.20);
  --diff-del-text: #fda4af;
}
```

---

## 3. Anatomia dos Componentes Exclusivos de Governança

### 3.1. A Barra de Assentos da Célula (`CellSeatsBar`)
Representação visual e viva dos 10 assentos ativos e do buffer de amortecimento da célula $N_1$:

```
┌────────────────────────────────────────────────────────────────────────┐
│ MESA DA CÉLULA N1 (#42)                   Quórum: 7/10 (Ativo)         │
│                                                                        │
│   ( 1 )  ( 2 )  ( 3 )  ( 4 )  ( 5 )  ( 6 )  ( 7 )  ( 8 )  ( 9 ) ( 10 ) │
│   [🟢]   [🟢]   [🟢]   [🟢]   [🟢]   [🟢]   [🟢]   [🟡]   [⚪]  [⚪]  │
│                                                                        │
│   Buffer de Transbordo (β): [◌ 11] [◌ 12] [◌ 13]                       │
└────────────────────────────────────────────────────────────────────────┘
```

* **Estrutura dos Assentos:**
  * Círculos com 40px de diâmetro (touch target mínimo 44px com padding).
  * Cores de Estado do Assento:
    * `🟢` **Esmeralda:** Votando na proposta líder principal.
    * `🟡` **Âmbar:** Votando em uma contraproposta / emenda alternativa.
    * `⚪` **Cinza:** Assento presente na célula, mas ainda em deliberação (sem voto depositado).
    * `◌` **Pontilhado:** Vagas temporárias do buffer de amortecimento. Ao preencher o 13º assento, uma animação fluida dispara o alerta visual de clivagem celular.

---

### 3.2. O Visualizador do Timelock Vivo (`DynamicTimelockBar`)
Componente elástico de contagem regressiva baseado na função $T(v)$:

```
┌────────────────────────────────────────────────────────────────────────┐
│ ⏳ Janela de Contestação Ativa                Tempo Restante: 2d 14h   │
│ ┌────────────────────────────────────────────────────────────┬───────┐ │
│ │█████████████████████████████████████████████               │ 7 / 10│ │
│ └────────────────────────────────────────────────────────────┴───────┘ │
│ ✨ Mais 2 votos reduzem o prazo para 24 horas (Margem de Carência)     │
└────────────────────────────────────────────────────────────────────────┘
```

* **Comportamento Dinâmico de Movimento:**
  * **Quando novos votos entram:** A barra avança com transição elástica suave (`--ease-spring`) e o cronômetro contrai.
  * **Quando ocorre migração para contraproposta:** A barra recua suavemente em tom âmbar, acompanhada da legenda suave: *"Margem de debate reaberta (+2 dias adicionados)"*.
  * **Unanimidade (10/10):** A barra se completa em 100% com brilho dourado e transita o status da proposta para `CONCLUÍDA`.

---

### 3.3. O Editor de Emendas e Diffs Visuais (`ProposalRevisionEditor`)
Alimentado por Tiptap com extensão de colaboração e controle de alterações:

* **Modo Leitura / Proposta Original:** Visual limpo com tipografia de leitura serifada (`--font-reading`), espaçamento relaxado e ausência de ruídos.
* **Modo "Sugerir Alteração":**
  * Ao clicar no botão, o parágrafo selecionado torna-se editável.
  * Texto excluído pelo participante recebe estilo `--diff-del-bg` com linha tachada.
  * Texto inserido recebe estilo `--diff-add-bg` com sublinhado suave.
  * Card flutuante lateral resume a emenda em linguagem simples:
    > *"Você alterou o orçamento de R$ 7.200 para R$ 3.000 e definiu prazo para 30 dias. Deseja submeter esta emenda para a célula?"*

---

### 3.4. A Câmara Deliberativa Efêmera (`EphemeralChatPanel`)
Painel retrátil ou aba lateral onde as 10 pessoas conversam:

* **Banner de Conforto Psicológico (Fixado no topo):**
  > 🔒 **Sala de Conversa Efêmera:** As mensagens e áudios desta sala são voláteis e descartáveis. Elas não ficam salvas no histórico público nem no Merkle DAG. Fale com liberdade para construir o consenso.
* **Gravador de Áudio com Waveform:** Botão de microfone simples (máximo 60 segundos), com visualização de ondas sonoras limpas.
* **Botão do Co-Piloto de IA:**
  * Botão discreto no topo do chat: **"Sintetizar Consenso da Conversa"**.
  * Ao ser clicado, a IA local do navegador (WebLLM) processa o chat e apresenta um card com a proposta unificada para o grupo.

---

## 4. Regras Técnicas e Diretrizes de Acessibilidade (A11y)

### 4.1. Conformidade WCAG 2.1 Nível AA
1. **Contraste Mínimo de Cores:**
   * Todo texto comum possui relação de contraste de no mínimo **4.5:1** contra o fundo.
   * Textos grandes (títulos $\ge 24\text{px}$) possuem contraste de no mínimo **3:1**.
2. **Navegação por Teclado e Foco Visível:**
   * Todos os elementos interativos (assentos, botões de voto, campos do editor) são acessíveis via `Tab` e `Shift+Tab`.
   * Proibido remover outline de foco. Usar anel de foco padronizado:
     ```css
     :focus-visible {
       outline: 2px solid var(--border-focus);
       outline-offset: 2px;
     }
     ```
3. **Semântica HTML5 e Leitores de Tela:**
   * Uso obrigatório de `<main>`, `<nav>`, `<article>`, `<header>` e `<footer>`.
   * Assentos de voto contêm labels acessíveis: `aria-label="Assento 3: ocupado por Bruno, voto na proposta A"`.
   * A contagem do timelock vivo utiliza `aria-live="polite"` para anunciar atualizações de prazo sem interromper a fala do leitor de tela.

### 4.2. Ergonomia Móvel (Mobile-First)
* **Touch Targets Mínimos:** Todos os botões, avatares e seletores possuem área de clique mínima de **$44 \times 44\text{ px}$**.
* **Sem dependência de Hover:** Nenhuma ação vital (como ver detalhes do voto ou ler a emenda) pode depender exclusivamente de `:hover`, garantindo experiência idêntica no smartphone.
* **Respeito à Preferência do Usuário:**
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

---

## 5. Classes Utilitárias Semânticas de UX (Semantic Component Classes)

Para evitar repetições caóticas de dezenas de classes atômicas no código, o design system estabelece classes compostas de alto nível. Elas já agrupam tamanho, cor, borda, sombra e comportamento de toque de acordo com a função de UX:

```css
/* ==========================================================================
   1. SUPERFÍCIES & CARDS
   ========================================================================== */

/* Cartão interativo clicável (propostas, opções de voto, cards de lista) */
.gov-card-interactive {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-normal) var(--ease-spring),
              border-color var(--duration-normal) var(--ease-spring),
              box-shadow var(--duration-normal) var(--ease-spring);
  cursor: pointer;
}

.gov-card-interactive:hover {
  transform: translateY(-2px);
  border-color: var(--border-default);
  box-shadow: var(--shadow-md);
}

.gov-card-interactive:active {
  transform: scale(0.99);
}

/* Cartão estático de conteúdo (contêiner de blocos sem clique) */
.gov-card-static {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

/* ==========================================================================
   2. TIPOGRAFIA SEMÂNTICA DE LEITURA
   ========================================================================== */

/* Tipografia de leitura relaxada para o texto de propostas e leis */
.gov-prose-reading {
  font-family: var(--font-reading);
  font-size: var(--text-lg);
  line-height: var(--line-relaxed);
  color: var(--text-primary);
  max-width: 68ch; /* Comprimento de linha ideal para leitura contínua */
}

.gov-prose-reading p {
  margin-bottom: var(--space-4);
}

.gov-prose-reading h2, .gov-prose-reading h3 {
  font-family: var(--font-sans);
  font-weight: 600;
  color: var(--text-primary);
  margin-top: var(--space-6);
  margin-bottom: var(--space-2);
}

/* ==========================================================================
   3. ERGONOMIA DE TOQUE (MOBILE-FIRST)
   ========================================================================== */

/* Garante o piso mínimo de 44x44px para qualquer elemento clicável no celular */
.gov-touch-target {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Anel de foco acessível para navegação por teclado (WCAG AA) */
.gov-focus-ring:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

/* ==========================================================================
   4. ETIQUETAS E PÍLULAS DE STATUS (BADGES)
   ========================================================================== */

/* Base para todas as pílulas */
.gov-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-full);
  line-height: var(--line-tight);
}

.gov-badge-consensus {
  background-color: var(--gov-consensus-subtle);
  color: var(--gov-consensus);
  border: 1px solid rgba(5, 150, 105, 0.2);
}

.gov-badge-revision {
  background-color: var(--gov-revision-subtle);
  color: var(--gov-revision);
  border: 1px solid rgba(217, 119, 6, 0.2);
}

.gov-badge-split {
  background-color: var(--gov-split-subtle);
  color: var(--gov-split);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

/* ==========================================================================
   5. MARCAÇÕES VISUAIS DE DIFFS / EMENDAS
   ========================================================================== */

.gov-diff-addition {
  background-color: var(--diff-add-bg);
  color: var(--diff-add-text);
  text-decoration: underline;
  text-underline-offset: 3px;
  padding: 1px 4px;
  border-radius: 3px;
}

.gov-diff-deletion {
  background-color: var(--diff-del-bg);
  color: var(--diff-del-text);
  text-decoration: line-through;
  opacity: 0.8;
  padding: 1px 4px;
  border-radius: 3px;
}
```

