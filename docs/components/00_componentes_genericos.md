# Sistema de Design: Componentes Genéricos e Padrões Visuais
**PFS-CD (Protocolo Fractal de Síntese e Consenso Dinâmico)**
**Classificação:** Guia Profissional de Estilo, Tipografia, Cores e Componentes Base

---

## 1. Padronização de Tipografia e Textos

Para que o aplicativo pareça coeso e profissional, cada tipo de texto tem uma função bem definida. Usamos **Inter** para os controles da interface e **Newsreader/Charter** para leitura agradável de propostas.

| Nível / Estilo | Tamanho / Peso | Onde Usar | Exemplo |
| :--- | :--- | :--- | :--- |
| **Título Principal (H1)** | 32px / Negrito (700) | Título da comunidade e cabeçalhos principais | *"Bairro Central - São Paulo"* |
| **Título de Seção (H2)** | 24px / Semi-negrito (600) | Nome de propostas e telas | *"Iluminação da Praça Central"* |
| **Subtítulo (H3)** | 18px / Médio (500) | Cabeçalhos de blocos (Problema, Solução) | *"Estimativa de Recursos e Custos"* |
| **Texto de Leitura (Leis)** | 18px / Normal (400) / Serif | Corpo completo de propostas e leis (leitura calma) | *"Instalação de postes solares..."* |
| **Corpo Normal (Body)** | 16px / Normal (400) | Parágrafos do bate-papo, descrições gerais | *"Concordo com a redução do prazo."* |
| **Texto Secundário (Small)** | 14px / Normal (400) | Rótulos de formulário, dicas e explicações | *"Toque para confirmar seu voto"* |
| **Metadados (Caption)** | 12px / Médio (500) | Timestamps, status de cadeiras e legendas | *"Ativo há 10 minutos • 7/10 votos"* |
| **Números & Prazos (Mono)** | 14px / Médio (500) / Monospaçado | Contadores de tempo e valores em dinheiro | `R$ 7.200,00` • `2d 14h restantes` |

---

## 2. Paleta Semântica de Cores (Padrão Profissional)

Evitamos cores puras ou agressivas. As cores servem para guiar o olhar sem cansar a visão:

### 2.1. Neutros e Superfícies
* **Fundo da Tela (`--bg-canvas`):** Cinza suave no modo claro (`#f8fafc`) e azul ardósia escuro no modo escuro (`#090d16`).
* **Superfície dos Cartões (`--bg-surface`):** Branco puro (`#ffffff`) no modo claro e cinza escuro acolhedor (`#111827`) no modo escuro.
* **Bordas Suaves (`--border-subtle`):** Delimitam cards sem pesar a visão (`#e2e8f0` no claro / `#1f2937` no escuro).

### 2.2. Cores de Ação e Feedback
* **Ação Primária / Marca (`--brand-primary`):** Azul profundo e confiável (`#2563eb`), usado no botão de entrar e ações principais.
* **Consenso / Sucesso (`--gov-consensus`):** Verde esmeralda suave (`#059669`), usado em votos aprovados e prazos acelerando.
* **Revisão / Debate Aberto (`--gov-revision`):** Âmbar dourado (`#d97706`), usado em emendas sugeridas e prorrogações de tempo.
* **Atenção / Limite (`--gov-alert`):** Coral rosado suave (`#e11d48`), usado em erros e cancelamentos (nunca vermelho sangue agressivo).

---

## 3. Catálogo de Componentes Genéricos

Estes são os blocos básicos reutilizados em todas as telas:

---

### 3.1. `Botao` (`Button`)
O elemento de interação padrão do aplicativo.

* **O que faz:** Dispara ações, confirmações e navegações.
* **Variantes Visuais:**
  * **Primário (Destaque):** Fundo colorido com texto branco (para ações principais como *"Votar com a Digital"* ou *"Criar Proposta"*).
  * **Secundário (Neutro):** Fundo cinza suave e borda discreta (para ações de apoio como *"Sugerir Mudança"* ou *"Ver Detalhes"*).
  * **Fantasma (Ghost):** Sem fundo, apenas texto (para botões de voltar, fechar modal e cancelar).
  * **Perigo (Destrutivo):** Fundo coral suave (para *"Sair da Conta"* ou *"Descartar Rascunho"*).
* **Estados Suportados:** Normal, Passando o mouse (Hover), Carregando (com spinner sutil) e Desabilitado.
* **Regra de Toque:** Altura mínima de **44px** no celular para o polegar nunca errar o clique.

---

### 3.2. `CampoTexto` e `AreaTexto` (`TextInput` / `TextArea`)
Caixas de entrada de dados simples e sem poluição.

* **O que faz:** Permite digitar nomes, títulos de propostas e parágrafos de texto.
* **O que contém:**
  * **Rótulo Superior:** Nome claro do campo (ex.: *"Como você quer ser chamado?"*).
  * **Dica Cinza (Placeholder):** Exemplo de preenchimento (ex.: *"Ex: Maria do Bairro"*).
  * **Mensagem de Ajuda ou Erro:** Texto pequeno abaixo do campo orientando o morador.
  * **Anel de Foco Visível:** Ao clicar no campo, surge um contorno azul elegante garantindo acessibilidade visual.

---

### 3.3. `CardBase` (`SurfaceCard`)
O contêiner retangular que agrupa informações relacionadas.

* **O que faz:** Cria a sensação de cartões organizados e limpos sobre a mesa de trabalho.
* **Propriedades:** Cantos arredondados orgânicos (raio de 12px), borda sutil e leve sombra para dar profundidade.

---

### 3.4. `PílulaStatus` (`Badge` / `Tag`)
Pequenas etiquetas coloridas que indicam o estado de algo rapidamente.

* **O que faz:** Mostra status sem ocupar espaço.
* **Exemplos de Uso:**
  * 🟢 **Verde Claro:** *"Em Votação"* ou *"Aprovada"*
  * 🟡 **Amarelo Claro:** *"Em Discussão"* ou *"Emenda Concorrente"*
  * 🔵 **Azul Claro:** *"Ação com Prazo"* ou *"Estatuto/Regra"*
  * ⚪ **Cinza Claro:** *"Arquivada por Inatividade"*

---

### 3.5. `JanelaModal` (`Dialog` / `Modal`)
Caixa de confirmação ou formulário rápido que surge sobre a tela.

* **O que faz:** Foca a atenção do usuário em uma decisão importante sem tirá-lo do contexto.
* **Comportamento:**
  * Escurece e desfoca o fundo suavemente (`backdrop-filter: blur(8px)`).
  * Fecha ao apertar a tecla `Esc` ou ao clicar fora da caixa.
  * Traz um botão de fechar "X" bem visível no canto superior.

---

### 3.6. `AbasNavegacao` (`Tabs`)
Seletor horizontal para alternar entre diferentes visões sem recarregar a tela.

* **O que faz:** Organiza conteúdos sem poluir a visão.
* **Exemplos de Uso:**
  * Alternar entre *"Propostas Abertas"* e *"Regras Aprovadas"* no Painel.
  * Alternar entre *"Mesa dos 10"* e *"Bate-Papo"* na tela da célula no smartphone.

---

### 3.7. `AvatarUsuario` (`Avatar`)
O círculo que representa a pessoa visualmente.

* **O que faz:** Identifica um vizinho de forma amigável.
* **Comportamento:**
  * Se a pessoa não subiu foto: Mostra um fundo colorido com a letra inicial do nome.
  * Possui uma micro-bolinha verde no canto inferior indicando se está online agora.

---

### 3.8. `EsqueletoCarregamento` (`Skeleton`)
Retângulos e círculos cinzas pulsantes que aparecem enquanto os dados carregam.

* **O que faz:** Dá a sensação de rapidez e estabilidade. O usuário vê a forma do cartão antes do texto carregar, evitando que a tela pule bruscamente.

---

### 3.9. `AvisoFlutuante` (`Toast`)
Notificação rápida que sobe na parte inferior da tela e some sozinha em 4 segundos.

* **O que faz:** Confirma que uma ação deu certo sem exigir que a pessoa clique em "OK".
* **Exemplos:**
  * *"✅ Seu voto foi confirmado com a digital!"*
  * *"📋 Rascunho salvo no seu aparelho."*
  * *"📡 Conexão restaurada com a rede."*

---

### 3.10. `DicaExplicativa` (`Tooltip` / `Popover`)
Pequeno balão de ajuda que aparece ao tocar ou passar o mouse sobre termos ou ícones.

* **O que faz:** Elimina dúvidas no momento exato em que a pessoa precisa de ajuda.
* **Exemplo:** Passar o mouse sobre o relógio da proposta mostra: *"Esta proposta encerra quando atingir o prazo ou alcançar 10 votos"*.

---

## 4. Pilha Técnica de Aceleração (Bibliotecas Recomendadas)

Para não perder semanas programando do zero detalhes de acessibilidade, foco de teclado e suporte a leitores de tela, adotamos o padrão de fato da indústria moderna de frontend:

```
┌────────────────────────────────────────────────────────┐
│  shadcn/ui + Radix UI Primitives (Componentes Base)    │
│  • Button, Input, Textarea, Card, Dialog, Tabs, etc.  │
│  • Acessibilidade WCAG 2.1 AA nativa e código próprio  │
├────────────────────────────────────────────────────────┤
│  Sonner (Notificações Toast Fluídas)                   │
│  • Avisos instantâneos com 1 linha de código           │
├────────────────────────────────────────────────────────┤
│  Lucide Icons (Iconografia Unificada)                  │
│  • Ícones leves: Fingerprint, Clock, Mic, Sparkles     │
├────────────────────────────────────────────────────────┤
│  Zustand (Gerenciamento de Estado de Alta Performance) │
│  • Reatividade instantânea com menos de 1 KB           │
└────────────────────────────────────────────────────────┘
```

### Mapeamento Direto para o Código:

| Componente Genérico | Pacote / Componente Adotado | Comando / Origem |
| :--- | :--- | :--- |
| **`Botao`** | `Button` | `npx shadcn@latest add button` |
| **`CampoTexto` / `AreaTexto`** | `Input` / `Textarea` | `npx shadcn@latest add input textarea` |
| **`CardBase`** | `Card` | `npx shadcn@latest add card` |
| **`PílulaStatus`** | `Badge` | `npx shadcn@latest add badge` |
| **`JanelaModal`** | `Dialog` | `npx shadcn@latest add dialog` |
| **`AbasNavegacao`** | `Tabs` | `npx shadcn@latest add tabs` |
| **`AvatarUsuario`** | `Avatar` | `npx shadcn@latest add avatar` |
| **`EsqueletoCarregamento`** | `Skeleton` | `npx shadcn@latest add skeleton` |
| **`DicaExplicativa`** | `Tooltip` / `Popover` | `npx shadcn@latest add tooltip popover` |
| **`AvisoFlutuante`** | `sonner` | `npx shadcn@latest add sonner` |
| **Ícones do Sistema** | `lucide-react` | `npm install lucide-react` |
| **Gerenciamento de Estado** | `zustand` | `npm install zustand` |

### Vantagens Estratégicas desta Escolha:
1. **Economia de 80% do Código de Interface:** Elimina centenas de linhas de CSS e bugs de navegação por teclado em modais e abas.
2. **Total Controle e Customização:** Os componentes do `shadcn/ui` não ficam escondidos em pacotes fechados do `node_modules`; eles são gerados diretamente dentro da pasta `src/components/ui/`, consumindo perfeitamente os nossos **Design Tokens** definidos em `docs/UI_DESIGN_SYSTEM.md`.
3. **Foco no que é Inovador:** Liberamos todo o tempo de desenvolvimento para focar nos componentes exclusivos do PFS-CD: a mesa de 10 assentos com clivagem, o timelock elástico e o comparador de emendas com Tiptap e IA.

