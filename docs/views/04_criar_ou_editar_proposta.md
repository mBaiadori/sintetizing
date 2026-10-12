# Tela 4: Criação e Edição de Proposta
**Nome técnico:** `ProposalEditorWizardView`
**Endereço na barra (Rota):** `/c/:idComunidade/proposta/nova`
**Quem acessa:** Qualquer pessoa cadastrada querendo sugerir uma melhoria ou criar uma emenda a uma proposta existente.

---

## 1. O Que É e Para Que Serve

Esta tela é o **bloco de notas inteligente** onde qualquer cidadão pode colocar uma ideia no papel ou propor uma melhoria em uma proposta que já existe.

O sistema foi desenhado para **não ter barreiras de entrada**:
* Você não precisa saber termos jurídicos nem preencher campos chatos logo de cara.
* Você pode começar escrevendo apenas uma frase ou um parágrafo simples.
* Se a ideia for uma obra ou ação com orçamento, o sistema te ajuda com perguntas simples: *"Tem ideia de quanto vai custar? Quem vai cuidar disso?"*.

---

## 2. De Onde o Usuário Vem e Para Onde Ele Vai

### Contexto de Entrada (De onde veio)
* Clicou em **"+ Propor Melhoria"** no Painel da Comunidade.
* Ou clicou em **"Sugerir Mudança"** enquanto lia uma proposta na Tela 3 (neste caso, a tela já abre com o texto original pronto para você só mudar o que quiser).
* Ou veio do bate-papo da **Sala dos 10**, querendo formalizar algo que o grupo conversou.

### Conexões de Saída (Para onde vai)
* **Ao clicar em "Salvar e Apresentar":** Pede a digital para confirmar e leva você direto para a tela de **Leitura da Proposta** (`/c/:idComunidade/proposta/:idNovaProposta`), já colocando a proposta na mesa da sala.
* **Ao clicar em "Cancelar":** Pergunta se quer descartar o rascunho e volta para onde você estava.

---

## 3. O Que Aparece na Tela (Componentes)

1. **Título da Ação:**
   * Se for uma proposta nova: *"Propor uma melhoria para o bairro"*.
   * Se for uma emenda: *"Sugerindo alteração em: Postes de Iluminação"*.
2. **Campo de Título Simples:**
   * Uma frase curta e direta (ex.: *"Mutirão de limpeza da Praça das Árvores"*).
3. **Editor de Texto Fluido (Estilo Bloco de Notas / Word):**
   * Escreva com tranquilidade o que está acontecendo e o que você sugere fazer.
   * Se você estiver editando uma proposta existente, o texto original já aparece com suas mudanças marcadas visualmente.
4. **Assistente Guiado de Recursos (Opcional no início):**
   * Botões opcionais que expandem para preencher:
     * 💰 *Estimativa de custos em reais (se houver)*
     * 👥 *Quem vai executar (voluntários, empresa, comissão)*
     * 📅 *Prazo estimado de entrega*
5. **Botão de Ajuda da IA (Opcional):**
   * *"✨ Melhorar clareza do texto"* — Organiza as suas palavras para ficarem bem fáceis de qualquer vizinho entender.
6. **Botão de Publicação:**
   * Botão em destaque: **"Assinar e Colocar em Votação"**.

---

## 4. O Que Exige Biometria (TouchID / FaceID)

* Digitar, rascunhar e pedir ajuda da IA: **Não pede biometria**.
* Clicar no botão final de **"Assinar e Colocar em Votação"**: **Exige a digital ou FaceID** do seu aparelho para registrar que você é o autor inicial do documento.
