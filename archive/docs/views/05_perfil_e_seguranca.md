# Tela 5: Meu Perfil e Segurança
**Nome técnico:** `IdentityVaultModalView`
**Endereço na barra (Rota):** `/perfil`
**Quem acessa:** O próprio usuário, a qualquer momento, clicando no seu avatar no topo da tela.

---

## 1. O Que É e Para Que Serve

Esta tela é o seu **cofre pessoal e painel de controle**. 

Aqui você pode:
1. Ver como o seu nome aparece para os seus vizinhos.
2. Conferir em quais comunidades você participa (ex.: Bairro Central, Condomínio, Associação).
3. Gerenciar a segurança do seu aparelho (verificar se a sua digital/FaceID está ativa).
4. Adicionar um aparelho reserva (ex.: seu computador ou tablet) para nunca perder o acesso.

---

## 2. De Onde o Usuário Vem e Para Onde Ele Vai

### Contexto de Entrada (De onde veio)
* Clicou no ícone do seu perfil no topo de **qualquer tela** do aplicativo.
* Abre como uma gaveta lateral (*drawer*) ou janela modal sobre a tela atual.

### Conexões de Saída (Para onde vai)
* **Ao clicar em fechar ou no "X":** Volta exatamente para a tela onde estava antes.
* **Ao clicar em uma comunidade da lista:** Troca a comunidade ativa e vai para o **Painel da Comunidade** (`/c/:idComunidade`).
* **Ao clicar em "Sair deste aparelho":** Limpa as chaves locais do navegador (pede confirmação antes).

---

## 3. O Que Aparece na Tela (Componentes)

1. **Cartão de Identidade:**
   * Seu nome ou apelido público.
   * Ícone com escudo verde: *"Conta protegida com a digital deste celular"*.
2. **Minhas Comunidades Ativas:**
   * Lista dos lugares onde você participa (ex.: *"Bairro Central - São Paulo"*).
   * Botão para buscar ou entrar em uma nova comunidade via código ou convite.
3. **Segurança e Aparelhos Conectados:**
   * Lista dos dispositivos autorizados (ex.: *"iPhone 15 - Este aparelho"*).
   * Botão: **"+ Conectar outro aparelho com QR Code"** (permite autorizar seu notebook ou tablet usando a câmera, sem precisar digitar senhas).
4. **Histórico da Minha Participação:**
   * Resumo simples do seu impacto: *"Você já participou de 3 salas de decisão e votou em 4 melhorias aprovadas"*.
5. **Garantia de Privacidade:**
   * Caixa informativa clara:
     > 🛡️ **Você tem controle total:** Suas decisões são assinadas no seu celular. Nenhum servidor central tem acesso à sua digital ou pode votar em seu nome.

---

## 4. O Que Exige Biometria (TouchID / FaceID)

* Olhar seu perfil e histórico: **Livre e instantâneo**.
* Conectar um novo aparelho ou apagar seus dados deste celular: **Exige confirmação com a sua digital**.
