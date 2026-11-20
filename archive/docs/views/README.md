# Guia e Mapa das Telas do Aplicativo (Views)

**PFS-CD (Protocolo Fractal de Síntese e Consenso Dinâmico)**

Este documento resume a jornada do cidadão pelo aplicativo e conecta todas as 6 telas principais, escritas em linguagem simples e acessível.

---

## 🗺️ Mapa de Navegação entre as Telas

```mermaid
flowchart TD
    V0["0. Cadastro e Entrada\n(Digital / FaceID em 30s)"]
    V1["1. Painel da Comunidade\n(Praça Central e Regras)"]
    V2["2. Sala dos 10\n(Mesa de Votação + Bate-papo)"]
    V3["3. Leitura e Mudanças\n(Documento + Comparações)"]
    V4["4. Criar ou Editar\n(Bloco de Notas e Emendas)"]
    V5["5. Meu Perfil\n(Chave de Segurança e Aparelhos)"]

    %% Conexões
    V0 -->|Criou conta com biometria| V1
    V1 -->|Entra na sala dos 10 sorteados| V2
    V1 -->|Lê proposta ou regra aprovada| V3
    V1 -->|Abre Meu Perfil| V5

    V2 -->|Clica em Proposta em debate| V3
    V2 -->|Clica em Criar Nova Proposta| V4
    V2 -->|Célula divide com 13 pessoas| V2

    V3 -->|Clica em Sugerir Mudança| V4
    V3 -->|Volta para a sala de conversa| V2
  
    V4 -->|Salva mudança e vota nela| V3
    V4 -->|Cancela e volta| V2

    V5 -.->|Acessível no topo de qualquer tela| V1
```

---

## 📋 Lista de Telas Documentadas

1. **[00. Cadastro e Entrada Simples](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/00_cadastro_e_entrada.md)** (`/cadastro`):
   * Criação de conta em 30 segundos usando apenas nome e biometria do celular (Passkeys). Zero senhas difíceis.
2. **[01. Painel da Comunidade](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/01_painel_da_comunidade.md)** (`/c/:idComunidade`):
   * Visão geral do bairro/comunidade, card de convocação para os sorteados, propostas ativas e acervo de regras aprovadas.
3. **[02. Sala dos 10 (Conversa e Voto)](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/02_sala_dos_10_conversa_e_voto.md)** (`/c/:idComunidade/celula/:idCelula`):
   * A mesa com as 10 cadeiras mostrando os votos ao vivo, o relógio dinâmico que estica ou acelera, e o bate-papo descartável com suporte a áudio e resumo por IA.
4. **[03. Leitura e Comparação da Proposta](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/03_leitura_e_mudancas_proposta.md)** (`/c/:idComunidade/proposta/:idProposta`):
   * Leitura agradável do documento completo com comparações visuais de emendas (sugestões em verde e tachadas em vermelho estilo Word/Google Docs).
5. **[04. Criação e Edição de Proposta](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/04_criar_ou_editar_proposta.md)** (`/c/:idComunidade/proposta/nova`):
   * Bloco de notas simples para escrever ideias ou propor emendas em documentos existentes sem barreiras burocráticas.
6. **[05. Meu Perfil e Segurança](file:///Users/MarcosBaiadori/Desktop/sintetizing/docs/views/05_perfil_e_seguranca.md)** (`/perfil`):
   * Gerenciamento de aparelhos conectados, proteção biométrica, comunidades ativas e garantias de privacidade.
