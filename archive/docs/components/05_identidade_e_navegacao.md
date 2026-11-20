# Grupo 5: Componentes de Identidade, Navegação e Avisos
**Pasta de destino no código:** `src/components/layout/` e `src/components/identity/`

---

## 1. Componente: `CabecalhoComunidade` (`CommunityHeaderBar`)

### O que ele faz
É a barra fixa no topo do aplicativo. Ela identifica onde você está (qual bairro ou comunidade), mostra quantos vizinhos estão ativos e dá acesso rápido ao seu perfil pessoal.

### Informações que ele recebe (Entrada)
* **Nome da Comunidade:** Exemplo: *"Bairro Central - São Paulo"*.
* **Status de Conexão com a Rede:** Ícone discreto indicando se está tudo sincronizado com os vizinhos.
* **Foto/Inicial do Usuário:** O avatar da sua conta.

### O que acontece quando o usuário mexe nele (Ações)
* **Clicar no nome da comunidade:** Abre uma lista para trocar de bairro ou entrar em outra comunidade.
* **Clicar no avatar do usuário:** Abre a gaveta de **Meu Perfil e Segurança** (`IdentityVaultDrawer`).

### Onde ele aparece
* No topo de **todas as telas** do aplicativo (com exceção da tela inicial de cadastro).

---

## 2. Componente: `CardConvocacaoSorteio` (`VrfSelectionAlertCard`)

### O que ele faz
É o aviso de "parabéns" que aparece quando você é convocado pelo sorteio automático (VRF) para participar de uma mesa de decisão. Funciona como um chamado cívico acolhedor.

### Informações que ele recebe (Entrada)
* **Título do Tema:** Sobre o que a mesa vai decidir (ex.: *"Iluminação da Praça Central"*).
* **Prazo para Fazer Check-in:** Quanto tempo você tem para entrar na sala e confirmar sua presença antes que a cadeira passe para outro sorteado.

### O que acontece quando o usuário mexe nele (Ações)
* **Botão "Entrar na Minha Cadeira":** Leva o usuário direto para a **Tela 2: Sala dos 10** para começar a conversar e votar.

### Onde ele aparece
* Em destaque no topo da **Tela 1: Painel da Comunidade**.

---

## 3. Componente: `GavetaMeuPerfil` (`IdentityVaultDrawer`)

### O que ele faz
É a janela lateral que abre ao clicar na sua foto. Mostra a saúde da sua conta, os aparelhos conectados e as comunidades em que você participa.

### Informações que ele recebe (Entrada)
* **Nome Público:** O apelido que seus vizinhos veem.
* **Status da Chave Biométrica:** Indicador verde confirmando que sua conta está protegida pela digital do aparelho.
* **Lista de Aparelhos Autorizados:** Seus celulares e computadores conectados.
* **Resumo de Participação:** Quantas propostas você ajudou a aprovar.

### O que acontece quando o usuário mexe nele (Ações)
* **Botão "Conectar outro aparelho com QR Code":** Mostra um código na tela para você ler com a câmera de outro celular e autorizar o acesso com segurança.
* **Botão "Sair deste aparelho":** Limpa as chaves locais do navegador (pede confirmação da digital antes).

### Onde ele aparece
* Como uma gaveta lateral deslizante acessível de qualquer tela do aplicativo.
