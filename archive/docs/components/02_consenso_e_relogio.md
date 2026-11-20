# Grupo 2: Componentes de Consenso e Relógio Vivo
**Pasta de destino no código:** `src/components/consensus/`

---

## 1. Componente: `BarraRelogioDinamico` (`DynamicTimelockBar`)

### O que ele faz
É o cronômetro elástico em tempo real que representa a equação $T(v)$ sem matemática complicada.
* Se mais pessoas votam na mesma ideia: a barra avança e o prazo encurta.
* Se alguém muda de ideia e vota em uma alternativa: a barra recua suavemente em tom âmbar e dá mais tempo para conversar.
* Se atingir unanimidade (10/10): a barra completa instantaneamente com brilho de sucesso e fecha a decisão.

### Informações que ele recebe (Entrada)
* **Votos Atuais ($v$):** Número de votos na proposta líder.
* **Segundos Restantes:** Tempo calculado em segundos.
* **Status do Quórum:** Se já atingiu o mínimo de 5 votos para ligar o cronômetro.
* **Foi Esticado Recentemente?** Indicador se o tempo acabou de recuar por causa de uma nova emenda.

### O que acontece quando o usuário mexe nele (Ações)
* **Passar o mouse ou tocar:** Mostra um balão com a regra simples: *"Com mais 2 votos, esta decisão é aprovada em 24 horas"*.

### Onde ele aparece
* **Tela 2: Sala dos 10** (`CellDeliberationView`).
* **Tela 3: Leitura e Comparação** (`ProposalDiffReaderView`).
* Em versão reduzida nos cards da **Tela 1: Painel da Comunidade**.

---

## 2. Componente: `PlacarAdesaoVotos` (`ConsensusScoreWidget`)

### O que ele faz
Mostra de forma compacta e direta a contagem de votos da proposta:
* Exibe a fração (ex.: `7 / 10`).
* Indica se já atingiu o quórum mínimo (5 votos) ou se a proposta ainda está dormente aguardando apoio inicial.

### Informações que ele recebe (Entrada)
* **Votos Favoráveis:** Quantidade de pessoas que votaram nesta versão.
* **Quórum Mínimo:** Meta mínima para ativar o relógio (padrão 5).
* **Total da Sala:** Tamanho do grupo (padrão 10).

### Onde ele aparece
* Cabeçalho de propostas, cartões de listas e dentro do leitor de documentos.

---

## 3. Componente: `BotaoVotarComDigital` (`VoteWithPasskeyButton`)

### O que ele faz
É o botão de ação decisiva. Transforma a intenção do usuário em um voto formal assinado com a segurança do próprio aparelho celular (Passkey/Biometria).

### Informações que ele recebe (Entrada)
* **ID da Proposta:** A versão específica em que o voto será depositado.
* **Já Votei Nesta?** Se o usuário já estiver votando nela, o botão muda para *"Seu voto está aqui"*.
* **É uma Migração?** Se o usuário já votou em outra versão antes, o botão avisa: *"Mudar meu voto para esta versão"*.

### O que acontece quando o usuário mexe nele (Ações)
* **Clicar no botão:** O celular aciona o sensor de digital ou FaceID.
* **Após confirmação biométrica:** O voto é registrado, o relógio recalcula e a cadeira do usuário na mesa muda de cor na mesma hora.

### Onde ele aparece
* **Tela 2: Sala dos 10**.
* **Tela 3: Leitura e Comparação**.
