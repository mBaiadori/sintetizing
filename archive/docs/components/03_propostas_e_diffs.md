# Grupo 3: Componentes de Propostas e Comparações (Diffs)
**Pasta de destino no código:** `src/components/proposal/`

---

## 1. Componente: `CardResumoProposta` (`ProposalCard`)

### O que ele faz
É o cartão resumido usado em listagens. Mostra em poucas linhas o título da proposta, o problema que ela resolve, quantos votos ela tem e quanto tempo falta para o encerramento.

### Informações que ele recebe (Entrada)
* **Título da Proposta:** Frase curta (ex.: *"Iluminação da Praça Central"*).
* **Resumo do Problema:** Um ou dois parágrafos curtos.
* **Quantidade de Votos:** Número atual de votos e status do relógio.
* **Categoria:** Se é uma Ação com prazo, uma Regra/Lei da comunidade ou uma Ideia livre.

### O que acontece quando o usuário mexe nele (Ações)
* **Clicar no cartão:** Abre a tela completa de **Leitura e Mudanças da Proposta** (`ProposalDiffReaderView`).

### Onde ele aparece
* **Tela 1: Painel da Comunidade** (listas de propostas ativas e acervo).
* **Tela 2: Sala dos 10** (na listagem de propostas concorrentes daquela mesa).

---

## 2. Componente: `LeitorDocumentoSerifado` (`ProposalDocumentReader`)

### O que ele faz
Apresenta o texto completo da proposta com tipografia agradável e espaçada (estilo livro ou artigo de jornal), facilitando a leitura de documentos longos sem cansar a vista.

### Informações que ele recebe (Entrada)
* **Texto do Problema:** Descrição da necessidade.
* **Texto da Solução:** O plano ou artigo normativo detalhado.
* **Recursos e Custos (se houver):** Valor em reais, fontes de verba e quem executa.
* **Metas de Sucesso:** Lista de indicadores auditáveis.

### O que acontece quando o usuário mexe nele (Ações)
* **Selecionar um trecho com o mouse/dedo:** Faz surgir um botão flutuante com a opção: **"Sugerir Mudança neste Trecho"**.

### Onde ele aparece
* **Tela 3: Leitura e Comparação da Proposta**.

---

## 3. Componente: `ComparadorDeMudancas` (`ProposalDiffVisualizer`)

### O que ele faz
É o coração da evolução colaborativa do texto. Em vez de você ter que ler duas versões inteiras para achar a diferença, este componente destaca exatamente o que mudou:
* Trechos que foram removidos ou alterados aparecem **tachados em vermelho claro**.
* Trechos novos ou valores corrigidos aparecem **sublinhados em verde claro**.

### Informações que ele recebe (Entrada)
* **Texto da Versão Original:** O documento base.
* **Texto da Versão Proposta:** A emenda sugerida por outro morador.
* **Resumo Explicativo:** Frase gerada automaticamente explicando a diferença em linguagem humana (ex.: *"Reduziu o orçamento de R$ 7.200 para R$ 3.000 e estendeu o prazo em 10 dias"*).

### Onde ele aparece
* **Tela 3: Leitura e Comparação da Proposta** (ao alternar entre as abas de versões).

---

## 4. Componente: `EditorDeEmendas` (`ProposalEditorForm`)

### O que ele faz
É o bloco de notas onde o usuário escreve sua ideia do zero ou altera um documento existente. Permite formatar títulos, listas e parágrafos sem complicação, além de oferecer gavetas opcionais para indicar prazos e estimativas financeiras.

### Informações que ele recebe (Entrada)
* **Texto Inicial (se for emenda):** O texto original pronto para ser modificado.
* **Modo de Operação:** *"Criando Nova Proposta"* ou *"Sugerindo Emenda em Documento Existente"*.

### O que acontece quando o usuário mexe nele (Ações)
* **Digitar texto:** Salva um rascunho automático no celular para a pessoa não perder nada se a bateria acabar.
* **Botão "Sugerir com IA":** Pede ao assistente local para reescrever o texto de forma mais clara e objetiva.
* **Botão "Salvar e Assinar":** Dispara a validação e aciona a biometria para publicar.

### Onde ele aparece
* **Tela 4: Criação e Edição de Proposta** (`ProposalEditorWizardView`).
