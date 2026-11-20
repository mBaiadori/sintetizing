# Tela 1: Painel da Comunidade
**Nome técnico:** `CommunityHomeView`
**Endereço na barra (Rota):** `/c/:idComunidade`
**Quem acessa:** Qualquer pessoa cadastrada na comunidade ou visitantes lendo as regras.

---

## 1. O Que É e Para Que Serve

Esta tela é a "praça central" do seu bairro ou comunidade. É aqui que você vê:
1. Se você foi **sorteado para debater em uma sala de 10 pessoas**.
2. Quais propostas estão sendo votadas no momento.
3. O mural de regras, leis e melhorias que já foram aprovadas e estão valendo.

O objetivo é dar uma visão rápida e transparente de tudo o que está acontecendo, sem poluição de fofocas ou brigas.

---

## 2. De Onde o Usuário Vem e Para Onde Ele Vai

### Contexto de Entrada (De onde veio)
* Veio da **Tela de Cadastro** (se for a primeira vez).
* Ou abriu o aplicativo já logado no celular.
* Ou trocou de comunidade no menu superior.

### Conexões de Saída (Para onde vai)
* **Se foi sorteado em uma sala:** Clica no card de destaque e vai para a **Sala dos 10** (`/c/:idComunidade/celula/:idCelula`).
* **Se clicou em uma proposta ou lei:** Vai para a tela de **Leitura e Mudanças** (`/c/:idComunidade/proposta/:idProposta`).
* **Se quiser propor algo novo:** Clica no botão **"+ Nova Proposta"** e vai para a tela de **Criar Proposta** (`/c/:idComunidade/proposta/nova`).
* **Se clicar na foto de perfil:** Abre o modal **Meu Perfil e Segurança** (`/perfil`).

---

## 3. O Que Aparece na Tela (Componentes)

1. **Cabeçalho da Comunidade:**
   * Nome do bairro/comunidade (ex.: *"Bairro Central - São Paulo"*).
   * Quantidade de moradores ativos e botão de trocar de comunidade.
2. **Card de Convocação (Destaque do Topo):**
   * Se a pessoa foi sorteada: Um card verde chamativo dizendo:
     > 🎲 **Você foi sorteado!** Você tem uma cadeira ativa na sala de debate sobre *"Melhoria da Iluminação"*. Entre para conversar e votar.
   * Se não foi sorteada no momento: Fica na fila automática para os próximos sorteios.
3. **Aba: Propostas em Votação (Ao Vivo):**
   * Lista de cartões com as propostas abertas no momento.
   * Cada cartão mostra: título simples, quantos votos já tem, e uma barra colorida com o tempo restante (ex.: *"Faltam 3 dias para fechar"*).
4. **Aba: Regras e Ações em Vigor (Biblioteca da Comunidade):**
   * O acervo de tudo o que a comunidade já decidiu e aprovou no passado, organizado por categorias (Obras, Estatuto, Festas, Orçamento).
5. **Botão Flutuante de Ação:**
   * Botão fixo no canto inferior: **"+ Propor Melhoria"**.

---

## 4. Como a Tela se Comporta (Estados da Tela)

* **Carregando:** Mostra cartões com efeito esqueleto cinza suave enquanto busca do banco local do celular.
* **Tudo Vazio (Comunidade Nova):** Mensagem acolhedora: *"Nenhuma proposta foi aberta ainda. Que tal ser o primeiro a sugerir uma melhoria?"*.
* **Normal:** Lista atualizada com os cronômetros rodando em tempo real.
* **Sem Internet (Offline):** Funciona perfeitamente para leitura com o que já estava salvo no aparelho, com um aviso discreto: *"Mostrando dados salvos. Conectando à rede..."*.
