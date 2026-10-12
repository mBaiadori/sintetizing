# Especificação Técnica — Fase 3: Aplicação do Cidadão, Chat Efêmero e Experiência

**PFS-CD (Protocolo Fractal de Síntese e Consenso Dinâmico)**
**Módulos Contemplados:** Bloco 6 (UI, Editor com Diffs, Chat Descartável & Co-Piloto IA)

---

## 1. Objetivo da Fase 3

Construir a camada de **interação direta com o cidadão**, focada em ergonomia cognitiva e eliminação total de jargões técnicos.
Nesta fase, a aplicação entrega:

1. **Autenticação Biométrica Invisível:** Acesso via Passkeys (TouchID / FaceID) sem sementes mnemônicas de 12 palavras.
2. **Câmara Deliberativa Efêmera:** Sala de bate-papo descartável onde os 10 membros sorteados conversam sem medo de julgamento permanente.
3. **Editor Colaborativo com Diffs Amigáveis:** Interface estilo Google Docs/Word para propor e revisar emendas parciais.
4. **Co-Piloto de IA Neutro:** Síntese sob demanda no próprio navegador via WebGPU (custo zero de servidor).
5. **Simulador Multi-Usuário Local:** Ferramenta de desenvolvimento para alternar entre as 10 Personas da célula na mesma tela.

---

## 2. Dependências Open Source

```bash
npm install @tiptap/core @tiptap/starter-kit @tiptap/extension-collaboration yjs y-indexeddb
npm install @mlc-ai/web-llm lucide-react clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer
```

* **`@tiptap` + `yjs`**: Editor de texto de nível corporativo (fundação do Notion/Linear) com suporte nativo a controle de alterações (*diffs/suggestions*) e resolução de conflitos descentralizada.
* **`@mlc-ai/web-llm`**: Motor de inteligência artificial open-source que executa LLMs (Llama 3.2 1B/3B, SmolLM2) diretamente na GPU do navegador do usuário via WebGPU.
* **`lucide-react`**: Ícones modernos e limpos.

---

## 3. Estrutura de Diretórios da Aplicação

```
apps/web/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── PasskeyLogin.tsx        # Botão de entrada com TouchID/FaceID
│   │   ├── cell/
│   │   │   ├── CellMembersBar.tsx      # Visualização dos 10 assentos e status
│   │   │   └── EphemeralChat.tsx       # Bate-papo descartável da célula
│   │   ├── editor/
│   │   │   ├── ProposalEditor.tsx      # Editor Tiptap formatado
│   │   │   └── DiffVisualizer.tsx      # Visualizador de adições (+) e remoções (-)
│   │   ├── consensus/
│   │   │   ├── DynamicTimelockBar.tsx  # Barra de contagem regressiva viva T(v)
│   │   │   └── VoteMigrationAction.tsx # Botão de apoio e migração de votos
│   │   └── ai/
│   │       └── SynthesisCoPilot.tsx    # Botão "Sintetizar Consenso da Conversa"
│   ├── hooks/
│   │   ├── useCellState.ts             # Estado reativo do nó elementar
│   │   ├── usePasskeyAuth.ts           # Gestão de credenciais locais
│   │   └── useWebLlm.ts                # Inicialização e inferência da IA local
│   ├── simulator/
│   │   └── MultiPersonaSwitcher.tsx    # Barra de troca de Personas (Modo Dev)
│   └── App.tsx
└── tailwind.config.js
```

---

## 4. Componentes Centrais da Experiência

### 4.1. Câmara Deliberativa Efêmera (`EphemeralChat.tsx`)

A sala de conversa é a válvula de escape dialógica da célula de 10 participantes:

* **Características Técnicas:**
  * As mensagens são mantidas apenas na memória da sessão e no banco efêmero local.
  * Suporta mensagens de texto curtas e gravações rápidas de áudio do microfone.
  * Quando a célula atinge o fechamento da proposta ou cliva ($\beta$-split), o histórico do chat é **destruído automaticamente**.
  * Zero integração com o Merkle DAG. O DAG não guarda bate-papo, apenas a proposta resultante.

### 4.2. Editor de Diffs e Emendas Humanizado (`ProposalEditor.tsx`)

Utiliza extensões do **Tiptap** integradas com **Yjs**:

* **Experiência do Usuário:**
  * O cidadão abre uma proposta existente e clica em **"Sugerir Melhoria"**.
  * A proposta vira um rascunho de *branch*. Ao deletar um trecho, ele fica tachado em vermelho. Ao digitar uma nova frase, ela aparece sublinhada em verde.
  * Os outros 9 membros da célula veem um resumo automático: *"Marcos sugeriu alterar o valor de R$ 7.200 para R$ 3.000 e mudar o prazo de entrega"*.
  * Com 1 clique, qualquer membro pode migrar seu voto para a nova versão sugerida.

### 4.3. Co-Piloto de IA para Síntese Neutra (`useWebLlm.ts`)

Executa um modelo leve no navegador para superar o bloqueio da redação:

```typescript
import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";

let engineInstance: MLCEngine | null = null;

export async function getLocalAiEngine(): Promise<MLCEngine> {
  if (!engineInstance) {
    // Modelo ultraleve de 1 bilhão a 3 bilhões de parâmetros
    engineInstance = await CreateMLCEngine("Llama-3.2-1B-Instruct-q4f16_1-MLC", {
      initProgressCallback: (report) => console.log(`Carregando IA Local: ${report.text}`)
    });
  }
  return engineInstance;
}

export async function synthesizeChatDeliberation(chatTranscript: string[]): Promise<string> {
  const engine = await getLocalAiEngine();
  
  const prompt = `
Você é um facilitador neutro de governança participativa.
Analise a conversa dos 10 cidadãos abaixo e gere uma proposta de síntese unificada e equilibrada.
Destaque o problema central acordado, a solução convergente e eventuais pontos de atenção.
Mantenha linguagem clara, acessível e objetiva.

Conversa:
${chatTranscript.join("\n")}
`;

  const reply = await engine.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2 // Baixa temperatura para fidelidade estrita
  });

  return reply.choices[0].message.content || "";
}
```

### 4.4. Monitor de Consenso em Tempo Real (`DynamicTimelockBar.tsx`)

Visualizador vivo da equação $T(v)$:

* Exibe a contagem regressiva em dias, horas e minutos.
* Mostra uma barra de progresso que avança quando novos votos chegam (encurtando o tempo) e **recua visualmente** quando alguém migra de voto para uma emenda concorrente.
* Notifica de forma clara o status: *"Faltam 2 votos para acelerar a aprovação em 5 dias"*.

---

## 5. Simulador Multi-Usuário Local (Ambiente de Testes)

Para validar a ergonomia sem depender de 10 pessoas físicas com 10 celulares durante o desenvolvimento:

* O componente `MultiPersonaSwitcher` exibe 10 avatares no topo da tela (Alice, Bruno, Carlos, Daniela, etc.).
* Clicar em um avatar troca imediatamente a identidade ativa, a chave privada de assinatura e a visão do participante.
* Permite ao desenvolvedor simular uma votação completa de 10 pessoas em 3 minutos:
  1. Persona 1 cria uma proposta.
  2. Persona 2 a 5 votam a favor (atingindo o quórum mínimo de 5). O timer $T(v)$ é ativado para 10 dias.
  3. Persona 6 abre o chat efêmero e reclama do orçamento.
  4. Persona 6 cria um *diff* reduzindo a verba.
  5. Personas 3, 4 e 5 migram os votos para a nova versão. O timer da primeira proposta estica e a nova versão ganha força.
  6. Todas as 10 Personas votam na versão corrigida: o timer vai a zero e o documento é aprovado por unanimidade!

---

## 6. Critérios de Aceite (Definition of Done)

1. **Zero Fricção Criptográfica:** O usuário consegue entrar, criar uma proposta e votar sem ver nenhum hash SHA-256 ou chave pública em hexadecimal.
2. **Descarte Confiável do Chat:** Garantir que o chat efêmero seja completamente apagado quando a deliberação é concluída.
3. **Privacidade e Custo Zero da IA:** O resumo de convergência da conversa funciona sem enviar nenhum dado para servidores de terceiros.
4. **Legibilidade de Diffs:** Usuários sem formação técnica conseguem discernir as alterações de uma contraproposta em menos de 10 segundos.
