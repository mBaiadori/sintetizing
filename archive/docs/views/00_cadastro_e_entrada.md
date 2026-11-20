# Tela 0: Cadastro e Entrada Simples
**Nome técnico:** `OnboardingRegisterView`
**Endereço na barra (Rota):** `/cadastro`
**Quem acessa:** Qualquer pessoa que esteja abrindo o aplicativo pela primeira vez.

---

## 1. O Que É e Para Que Serve

Esta é a porta de entrada do aplicativo. O objetivo é permitir que qualquer cidadão comece a participar **em menos de 30 segundos**, sem precisar inventar senhas difíceis, sem preencher formulários compridos e sem precisar anotar palavras em inglês.

A pessoa só precisa:
1. Digitar como quer ser chamada (nome público ou apelido).
2. Tocar o dedo no leitor de digital ou olhar para o celular (FaceID / TouchID).
3. Escolher o seu bairro, condomínio ou cidade para começar.

---

## 2. De Onde o Usuário Vem e Para Onde Ele Vai

### Contexto de Entrada (De onde veio)
* O usuário acabou de abrir o app pela primeira vez ou clicou em um link de convite de uma comunidade (ex.: `meuapp.org/convite/bairro-central`).

### Conexões de Saída (Para onde vai)
* **Quando conclui o cadastro com a digital:** É levado direto para o **Painel da Comunidade** (`/c/:idComunidade`).
* **Se já tinha conta e só trocou de aparelho:** Pode clicar em *"Já tenho conta neste aparelho"* e entrar direto com a biometria.

---

## 3. O Que Aparece na Tela (Componentes)

1. **Mensagem de Boas-Vindas:** 
   * Título acolhedor: *"Participe das decisões do seu bairro"*.
   * Explicação simples em uma frase: *"Sem senhas difíceis. Suas decisões são assinadas com a segurança do seu próprio aparelho."*
2. **Campo de Nome ou Apelido:**
   * Campo de texto simples (mínimo 3 letras, máximo 40 letras).
3. **Botão Principal de Ação:**
   * Botão em destaque: **"Criar minha conta com a Digital / FaceID"**.
4. **Seletor de Comunidade Inicial:**
   * Lista simples com busca para escolher onde mora ou atua (ex.: "Bairro Central", "Condomínio Flores").
5. **Aviso de Privacidade:**
   * Mensagem tranquila: *"Seus dados ficam protegidos no seu aparelho. Não vendemos dados nem rastreamos o que você faz."*

---

## 4. Como a Tela se Comporta (Estados da Tela)

* **Tela Normal:** Formulário limpo e convidativo com o botão ativo.
* **Aguardando Digital:** Mensagem na tela: *"Toque no sensor do seu aparelho para confirmar..."*.
* **Sucesso:** Animação rápida de confirmação e redirecionamento instantâneo.
* **Erro:** Mensagem amigável caso a pessoa cancele a leitura da digital (*"Não foi possível ler a digital. Tente novamente"*).

---

## 5. Como Salva os Dados e Segurança

* **O que acontece por baixo dos panos:** O navegador ativa a tecnologia **Passkeys (WebAuthn)**. O celular cria uma chave de segurança protegida e associa ao nome escolhido.
* **Zero Senhas em Servidores:** Nenhuma senha viaja pela internet. O usuário é dono da sua própria conta.
