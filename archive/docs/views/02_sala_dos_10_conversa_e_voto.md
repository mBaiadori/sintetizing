# Tela 2: Sala dos 10 (Conversa e Votação)
**Nome técnico:** `CellDeliberationView`
**Endereço na barra (Rota):** `/c/:idComunidade/celula/:idCelula`
**Quem acessa:** Os 10 moradores sorteados para esta mesa (com direito a falar e votar) e observadores (apenas assistindo).

---

## 1. O Que É e Para Que Serve

Esta tela é a **célula viva do protocolo**. Em vez de colocar 5.000 pessoas em um grupo caótico de WhatsApp, o sistema sorteia apenas 10 pessoas para conversar de forma civilizada e focada.

Aqui as pessoas:
1. Conversam em um **bate-papo descartável** (com texto ou áudio) para tirar dúvidas e negociar.
2. Veem uma **mesa visual com 10 cadeiras**, mostrando em qual proposta cada um está votando.
3. Podem pedir ajuda para um **Assistente de IA neutro** para resumir a conversa e sugerir um texto comum para todo mundo votar.

---

## 2. De Onde o Usuário Vem e Para Onde Ele Vai

### Contexto de Entrada (De onde veio)
* Veio do card de convocação no **Painel da Comunidade** (`/c/:idComunidade`).
* O aplicativo já sabe se você é uma das 10 pessoas com cadeira na mesa ou se é um vizinho apenas observando.

### Conexões de Saída (Para onde vai)
* **Ao clicar na proposta em votação:** Abre o texto completo na tela de **Leitura e Mudanças** (`/c/:idComunidade/proposta/:idProposta`).
* **Ao clicar em "Propor Outra Ideia":** Vai para a tela de **Criar Proposta** (`/c/:idComunidade/proposta/nova?para_celula=:idCelula`).
* **Se chegarem 13 pessoas na sala (Clivagem):** A tela avisa com gentileza: *"A sala cresceu e se dividiu em duas mesas irmãs para manter a conversa ágil"*. Quem sobrou vai automaticamente para a nova sala.

---

## 3. O Que Aparece na Tela (Componentes)

### Lado Esquerdo (ou Aba 1 no Celular): A Mesa de Decisão
1. **A Mesa dos 10 Assentos:**
   * 10 círculos representando as pessoas sorteadas.
   * Cada círculo tem uma bolinha colorida:
     * 🟢 **Verde:** Votou na proposta principal.
     * 🟡 **Amarelo:** Votou em uma proposta concorrente ou emenda.
     * ⚪ **Cinza:** Está na sala conversando, mas ainda não votou.
   * 3 assentos pontilhados adicionais indicam pessoas que entraram na fila de espera.
2. **O Relógio Vivo de Aprovação:**
   * Uma barra elástica mostrando o tempo restante (ex.: *"2 dias e 14 horas"*).
   * Mostra na hora o efeito da conversa: quando mais gente vota junto, o relógio acelera; se alguém muda de voto, o relógio dá mais tempo para conversar.
3. **Cartões das Propostas em Disputa na Sala:**
   * Lista das propostas que os membros da sala colocaram na mesa, com botão rápido: **"Mudar meu voto para esta versão"**.

### Lado Direito (ou Aba 2 no Celular): O Bate-Papo Descartável
1. **Aviso Fixo de Privacidade:**
   * *"🔒 Esta sala de bate-papo é descartável. Suas mensagens e áudios são apagados quando a decisão fechar. Fale com liberdade."*
2. **Histórico de Mensagens:**
   * Mensagens curtas de texto e gravações de áudio de até 1 minuto.
3. **Botão de Ajuda da Inteligência Artificial:**
   * Botão em destaque: **"✨ Resumir conversa e sugerir proposta comum"**.
   * Quando alguém clica, a IA lê o que o grupo falou e gera um texto neutro juntando as ideias de todo mundo.
4. **Campo de Envio:**
   * Caixa para digitar mensagem e botão de microfone para gravar áudio.

---

## 4. O Que Exige Biometria (TouchID / FaceID)

* Mandar mensagem ou áudio no chat: **Não precisa de biometria** (é instantâneo como no WhatsApp).
* Depositar ou mudar seu voto em uma proposta: **Pede a digital no aparelho**, garantindo que ninguém vote por você.
