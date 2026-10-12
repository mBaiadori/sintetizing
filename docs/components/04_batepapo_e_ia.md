# Grupo 4: Componentes de Bate-Papo Efêmero e Inteligência Artificial
**Pasta de destino no código:** `src/components/chat/`

---

## 1. Componente: `PainelBatePapoDescartavel` (`EphemeralChatPanel`)

### O que ele faz
É o espaço de conversa informal dos 10 membros da sala. Funciona como uma janela de chat limpa (estilo WhatsApp ou Telegram), mas com uma garantia fundamental: **tudo o que é conversado aqui é descartável e não fica gravado para sempre no histórico público da comunidade**.

### Informações que ele recebe (Entrada)
* **ID da Sala de Decisão:** A qual mesa o chat pertence.
* **Lista de Mensagens:** Mensagens de texto e gravações de áudio enviadas pelos 10 participantes na sessão atual.
* **Aviso de Efemeridade:** Alerta fixo informando que o conteúdo será apagado assim que a votação fechar.

### O que acontece quando o usuário mexe nele (Ações)
* **Digitar e enviar:** Envia a mensagem imediatamente para os outros 9 aparelhos conectados.
* **Tocar em um áudio:** Reproduz a voz do vizinho com controle de velocidade (1x, 1.5x, 2x).

### Onde ele aparece
* **Tela 2: Sala dos 10** (como painel lateral no computador ou aba no celular).

---

## 2. Componente: `GravadorDeAudioCurto` (`AudioVoiceRecorder`)

### O que ele faz
Permite que o morador grave um áudio de até 60 segundos explicando seu ponto de vista falando naturalmente, o que é essencial para quem não gosta ou tem dificuldade de digitar no celular.

### Informações que ele recebe (Entrada)
* **Tempo Máximo:** Limite rígido de 60 segundos por mensagem (para manter a conversa objetiva).

### O que acontece quando o usuário mexe nele (Ações)
* **Segurar ou Clicar no Microfone:** Inicia a gravação e mostra o tempo correndo na tela.
* **Soltar / Enviar:** Envia o áudio para a sala.
* **Arrastar para o lado (Cancelar):** Cancela e joga fora a gravação sem enviar.

### Onde ele aparece
* Dentro da barra de digitação do `PainelBatePapoDescartavel`.

---

## 3. Componente: `CardSinteseIA` (`AiSummaryProposalCard`)

### O que ele faz
Apresenta o resultado do trabalho da inteligência artificial quando o grupo pede ajuda para sair de um impasse. Ele lê as conversas do bate-papo e gera um cartão com uma proposta unificada, destacando onde os participantes concordaram.

### Informações que ele recebe (Entrada)
* **Pontos de Acordo Encontrados:** O que os vizinhos concordaram durante a conversa.
* **Texto Sugerido:** Um rascunho de proposta neutra redigida pela IA para resolver o problema.
* **Status do Processamento:** Indicador de que a IA está lendo o chat na GPU do próprio aparelho celular (sem mandar nada para a nuvem).

### O que acontece quando o usuário mexe nele (Ações)
* **Botão "Criar Proposta a partir deste Resumo":** Copia o texto da IA e abre o editor de proposta para os participantes darem o toque final e votarem.
* **Botão "Descartar":** Fecha a sugestão se o grupo não concordar com o resumo.

### Onde ele aparece
* Aparece no topo do bate-papo da **Tela 2: Sala dos 10** quando alguém clica no botão *"Sintetizar com IA"*.
