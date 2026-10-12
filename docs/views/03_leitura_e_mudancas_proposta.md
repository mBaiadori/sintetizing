# Tela 3: Leitura e Comparação da Proposta
**Nome técnico:** `ProposalDiffReaderView`
**Endereço na barra (Rota):** `/c/:idComunidade/proposta/:idProposta`
**Quem acessa:** Qualquer pessoa lendo o documento, membros votando ou pessoas comparando versões.

---

## 1. O Que É e Para Que Serve

Esta tela é onde você **lê o documento completo com calma e compara sugestões de mudança**. 

Em vez de você ter que ler 500 comentários soltos discutindo uma ideia, você vê o documento original e as **melhorias propostas lado a lado**, com marcações coloridas idênticas às sugestões do Word ou Google Docs:
* O que alguém sugeriu tirar aparece **tachado em vermelho**.
* O que alguém sugeriu incluir aparece **destacado em verde**.

---

## 2. De Onde o Usuário Vem e Para Onde Ele Vai

### Contexto de Entrada (De onde veio)
* Veio da **Sala dos 10** (`/c/:idComunidade/celula/:idCelula`) para analisar o texto antes de votar.
* Ou veio do **Painel da Comunidade** (`/c/:idComunidade`) para consultar uma regra aprovada.

### Conexões de Saída (Para onde vai)
* **Ao clicar em "Sugerir Mudança neste trecho":** Abre a tela de **Edição e Criação** (`/c/:idComunidade/proposta/nova?ramo_de=:idProposta`) já com o texto carregado para alterar.
* **Ao clicar em "Voltar para a Sala":** Retorna para a **Sala dos 10** para continuar conversando no bate-papo.
* **Ao clicar em "Votar nesta versão":** Aciona a digital do celular, computa o voto e atualiza o relógio da proposta na hora.

---

## 3. O Que Aparece na Tela (Componentes)

1. **Barra Superior com Status do Relógio:**
   * Título da proposta (ex.: *"Instalação de postes solares na Praça Central"*).
   * Barra de contagem regressiva em tempo real: *"Adesão: 7 de 10 votos | Fecha em 2 dias e 14h"*.
2. **Corpo do Documento (Tipografia de Leitura Relaxada):**
   * **O Problema:** Por que esta proposta existe.
   * **A Solução:** O que será feito na prática.
   * **Recursos e Custos:** Quanto vai custar em reais (se houver custo) e quem vai executar.
   * **Como Saberemos se Deu Certo:** Metas e prazos auditáveis.
3. **Seletor de Versões e Emendas (Abas no Topo do Texto):**
   * *Versão Principal (7 votos)*
   * *Sugestão do Carlos: Reduzir para 4 postes e economizar R$ 4.200 (2 votos)*
4. **Painel de Diferenças Visuais (Modo de Comparação):**
   * Mostra com clareza o que muda entre uma versão e outra sem termos técnicos:
     > *"O Carlos alterou o valor de R$ 7.200 para R$ 3.000 e trocou postes solares por postes de LED comuns."*
5. **Botão de Ação Inferior:**
   * Se você tem cadeira na sala: Botão fixo **"Votar nesta versão com a Digital"** ou **"Sugerir uma nova mudança"**.
   * Se for apenas observador: Botão de compartilhar o link do documento.

---

## 4. O Que Exige Biometria (TouchID / FaceID)

* Ler o documento e navegar entre as versões: **Livre e instantâneo**.
* Depositar seu voto ou migrar seu voto para uma versão melhor: **Exige confirmação com a digital**.
