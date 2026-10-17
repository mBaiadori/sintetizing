# Especificação Técnica — Fase 3: Aplicação do Cidadão, PWA, Chat Efêmero e IA Plugável

**PFS-CD (Protocolo Fractal de Síntese e Consenso Dinâmico)**
**Módulos Contemplados:** Bloco 6 (PWA Super Leve, Editor com Diffs visuais, Chat Descartável & IA Sintetizadora Plugável)

---

## 1. Objetivo da Fase 3

Construir a camada de **interação direta com o cidadão**, focada em ergonomia cognitiva, soberania técnica e eliminação total de jargões criptográficos.

Nesta fase, a aplicação entrega:

1. **PWA Super Leve e Soberano (Progressive Web App):** Instalação direta do navegador sem intermediação, censura ou taxas da Apple Store ou Google Play.
2. **Autenticação Biométrica Invisível:** Acesso nativo via Passkeys (TouchID / FaceID) destrancando a chave criptográfica Ed25519 armazenada com segurança no dispositivo.
3. **Câmara Deliberativa Efêmera:** Sala de bate-papo descartável onde os 10 membros sorteados dialogam sem receio de vigilância ou registro eterno no DAG.
4. **Editor com Diffs Amigáveis e CRDTs:** Sugestão de emendas e ramificações concorrentes (estilo Google Docs) sincronizadas via Yjs, com adições em verde e exclusões em vermelho.
5. **IA Sintetizadora Plugável (Interface Padrão):** Módulo de IA desacoplado capaz de conectar a modelos locais via **Ollama** (Llama 3, Qwen, Mistral) ou APIs REST padronizadas, processando JSONs concorrentes e devolvendo um JSON unificado estrito validado por Zod.
6. **Simulador Multi-Usuário Local:** Ferramenta para alternar entre as 10 Personas da célula no navegador e testar a dinâmica de consenso em segundos.

---

## 2. Dependências Open Source

```bash
# Editor colaborativo e CRDTs:
npm install @tiptap/core @tiptap/starter-kit @tiptap/extension-collaboration yjs y-indexeddb

# Interface, ícones e estado reativo leve:
npm install zustand lucide-react clsx tailwind-merge

# Validação estrita de Schemas e cliente de IA:
npm install zod
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa
```

* **`vite-plugin-pwa`**: Gera Service Workers com cache offline agressivo e manifesto web para instalação instantânea no celular.
* **`@tiptap` + `yjs`**: Base corporativa para edição colaborativa e cálculo de diffs visuais de contrapropostas.
* **`zod`**: Garante que o retorno da IA sintetizadora respeite rigorosamente o schema do protocolo antes de ser exibido como rascunho.
* **`zustand`**: Gerenciador de estado com pegada minúscula (<1KB) para reatividade da mesa dos 10 assentos.

---

## 3. Estrutura de Diretórios da Aplicação

```
apps/web/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── PasskeyLogin.tsx        # Botão de entrada rápida com TouchID/FaceID
│   │   ├── cell/
│   │   │   ├── CellMembersBar.tsx      # Visualização dos 10 assentos e status de presença
│   │   │   └── EphemeralChat.tsx       # Bate-papo descartável da célula (áudio e texto)
│   │   ├── editor/
│   │   │   ├── ProposalEditor.tsx      # Editor colaborativo Tiptap formatado
│   │   │   └── DiffVisualizer.tsx      # Visualizador de adições (+) e remoções (-)
│   │   ├── consensus/
│   │   │   ├── DynamicTimelockBar.tsx  # Barra de contagem regressiva viva T(v)
│   │   │   └── VoteMigrationAction.tsx # Botão biométrico de apoio e migração de votos
│   │   └── ai/
│   │       ├── SynthesisButton.tsx     # Ação "Gerar Síntese Convergente"
│   │       └── AiConfigModal.tsx       # Seletor de provedor (Ollama Local / API)
│   ├── services/
│   │   ├── ai/
│   │   │   ├── synthesizer.interface.ts # Interface padrão plugável
│   │   │   ├── ollama_provider.ts       # Provedor local Ollama (Llama 3 / Mistral)
│   │   │   └── api_provider.ts          # Provedor REST compatível com OpenAI/vLLM
│   │   └── pwa/
│   │       └── registerServiceWorker.ts # Registro e política de cache offline
│   ├── hooks/
│   │   ├── useCellState.ts             # Estado reativo do nó elementar
│   │   ├── usePasskeyAuth.ts           # Gestão de chaves Ed25519 no hardware
│   │   └── useAiSynthesizer.ts         # Hook de síntese unificada
│   ├── simulator/
│   │   └── MultiPersonaSwitcher.tsx    # Barra de troca de Personas (Modo Dev)
│   └── App.tsx
├── manifest.webmanifest
└── vite.config.ts
```

---

## 4. Componentes Centrais da Experiência

### 4.1. Instalação e Soberania PWA (`manifest.webmanifest`)

O aplicativo é entregue via web moderna:
* **Zero Lojas de Apps:** O usuário clica em "Adicionar à Tela de Início" e o app se comporta como aplicativo nativo (ícone na gaveta de apps, tela cheia sem barras de navegação).
* **Persistência Offline:** O Service Worker armazena em cache os assets essenciais. Aberturas sem internet mostram imediatamente as propostas já sincronizadas.

### 4.2. Autenticação Biométrica Invisível (WebAuthn + Ed25519)

* No cadastro, o navegador invoca `navigator.credentials.create()` (Passkeys).
* A biometria do celular destranca a chave privada `Ed25519` armazenada no cofre seguro local (`IndexedDB` isolado).
* O cidadão assina transações e vota com um toque de digital, sem precisar memorizar senhas nem copiar mnemônicos em papel.

### 4.3. Câmara Deliberativa Efêmera (`EphemeralChat.tsx`)

* Espaço livre de conversa informal entre os 10 cidadãos da célula ativa.
* Mensagens de texto e notas curtas de voz trafegam via WebRTC (ou canal volátil do Relay).
* **Descarte Obrigatório:** Ao fechar a síntese ou ao clivar a célula, o banco efêmero apaga o bate-papo. O histórico informal **jamais é registrado no Merkle DAG**, garantindo privacidade e foco exclusivo no documento consensual final.

### 4.4. Editor de Diffs e Emendas Humanizado (`ProposalEditor.tsx` / `DiffVisualizer.tsx`)

* Baseado em **Tiptap + Yjs (CRDT)**:
  * Proposições concorrentes e emendas parciais são tratadas como branches de texto.
  * O cidadão vê claramente o que muda: palavras excluídas ficam riscadas em vermelho; palavras adicionadas ganham destaque verde.
  * O sistema exibe um resumo simples: *"Bruna sugeriu trocar o prazo de 30 para 15 dias"*.
  * Com um toque biométrico, qualquer membro da célula pode migrar seu apoio para a nova versão.

---

## 5. IA Sintetizadora Plugável (Interface Padrão)

A IA atua estritamente como **secretária neutra** (facilitadora de redação), sem qualquer poder de veto ou voto.

### 5.1. Interface Padronizada (`synthesizer.interface.ts`)

```typescript
import { z } from "zod";

// Schema estrito de saída que a IA DEVE cumprir
export const AiSynthesisOutputSchema = z.object({
  title: z.string().min(5).max(120),
  summary: z.string().min(20).max(500),
  unified_text: z.string().min(50),
  key_convergences: z.array(z.string()),
  preserved_concerns: z.array(z.string())
});

export type AiSynthesisOutput = z.infer<typeof AiSynthesisOutputSchema>;

export interface IAiSynthesizerProvider {
  name: string;
  synthesize(params: {
    cellGoal: string;
    chatTranscript: string[];
    competingDrafts: string[];
  }): Promise<AiSynthesisOutput>;
}
```

### 5.2. Provedor Local Ollama (`ollama_provider.ts`)

Conexão com instâncias do **Ollama** rodando localmente (ex: Llama 3.2 3B ou Qwen 2.5):

```typescript
import { IAiSynthesizerProvider, AiSynthesisOutput, AiSynthesisOutputSchema } from "./synthesizer.interface";

export class OllamaSynthesizerProvider implements IAiSynthesizerProvider {
  name = "Ollama Local";

  constructor(
    private endpoint: string = "http://localhost:11434",
    private model: string = "llama3.2:3b"
  ) {}

  async synthesize(params: {
    cellGoal: string;
    chatTranscript: string[];
    competingDrafts: string[];
  }): Promise<AiSynthesisOutput> {
    const systemPrompt = `Você é um secretário neutro de governança comunitária participativa.
Sua função é harmonizar pontos de vista concorrentes em um texto unificado e equilibrado.
Responda EXCLUSIVAMENTE em formato JSON com o seguinte schema:
{
  "title": "string",
  "summary": "string",
  "unified_text": "string (texto completo da proposta consolidada)",
  "key_convergences": ["ponto 1", "ponto 2"],
  "preserved_concerns": ["preocupação preservada 1"]
}`;

    const userContent = `
Objetivo da Célula: ${params.cellGoal}

Transcrição da Deliberação:
${params.chatTranscript.join("\n")}

Rascunhos Concorrentes Submetidos:
${params.competingDrafts.join("\n---\n")}
`;

    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: `${systemPrompt}\n\n${userContent}`,
        format: "json",
        stream: false,
        options: { temperature: 0.1 } // Fidelidade factual máxima
      })
    });

    const data = await response.json();
    const parsedJson = JSON.parse(data.response);

    // Validação estrita Zod do retorno da IA
    return AiSynthesisOutputSchema.parse(parsedJson);
  }
}
```

### 5.3. Princípio de Não-Autoridade da IA
O retorno gerado pelo sintetizador é apresentado como um **rascunho colaborativo (draft)**. Ele só se torna uma proposta formal quando uma ou mais Personas humanas decidem assiná-la com suas chaves `Ed25519` e submetê-la ao voto da célula.

---

## 6. Simulador Multi-Usuário Local (`MultiPersonaSwitcher.tsx`)

Para viabilizar testes ergonômicos e fluxos completos sem a necessidade de 10 celulares físicos durante o desenvolvimento:

* O simulador exibe os 10 assentos da célula no topo da interface.
* O desenvolvedor alterna com 1 clique a Persona ativa, assumindo sua chave criptográfica e seu histórico de votos.
* Permite testar todo o ciclo de vida do consenso em menos de 3 minutos:
  1. Criação de proposta pela Persona 1.
  2. Votos das Personas 2 a 5 ativando o cronômetro $T(v)$.
  3. Persona 6 sugerindo uma emenda com corte de custos no editor.
  4. Migração em tempo real dos votos para a nova versão.
  5. Acionamento da IA Sintetizadora para fundir dois textos concorrentes em uma síntese consensual.
  6. Aprovação final com 10/10 e fechamento atômico da deliberação.

---

## 7. Critérios de Aceite (Definition of Done)

1. **Instalação PWA Transparente:** O aplicativo deve ser instalável diretamente a partir do navegador em Android e iOS, sem qualquer mensagem de erro de certificado ou manifesto.
2. **Conformidade de Schema da IA:** Toda síntese gerada pela IA deve passar com sucesso pela validação do Zod Schema; caso o modelo falhe no formato, o sistema deve solicitar nova geração automaticamente.
3. **Privacidade e Descarte do Chat:** O bate-papo efêmero deve ser descartado da memória ao final da célula e não pode aparecer em nenhuma exportação do Merkle DAG.
4. **Legibilidade dos Diffs:** Qualquer alteração textual proposta deve ser compreensível para um leigo em menos de 10 segundos através do destaque visual verde/vermelho.
