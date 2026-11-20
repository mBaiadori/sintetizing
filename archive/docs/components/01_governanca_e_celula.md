# Grupo 1: Componentes de Governança e Célula
**Pasta de destino no código:** `src/components/cell/`

---

## 1. Componente: `MesaDosAssentos` (`CellSeatsBar`)

### O que ele faz
É o centro visual da deliberação. Mostra uma "mesa redonda digital" com as **10 cadeiras ativas** da célula e as **3 vagas pontilhadas do buffer de espera**. Permite ao participante entender de relance quem está na mesa e como os votos estão distribuídos.

### Informações que ele recebe (Entrada)
* **Lista de Participantes Ativos:** Nomes públicos, avatares e em qual proposta cada um está votando no momento.
* **Lista de Membros no Buffer:** Lista de pessoas na fila de espera (até 3).
* **ID do Usuário Atual:** Para destacar qual é a sua própria cadeira na mesa.

### O que acontece quando o usuário mexe nele (Ações)
* **Clicar em uma cadeira:** Abre um pequeno balão mostrando o nome da pessoa e qual versão da proposta ela está apoiando.
* **Ao passar o mouse ou focar:** Destaca com uma linha sutil a proposta que aquele assento apoia.

### Onde ele aparece
* **Tela 2: Sala dos 10** (`CellDeliberationView`).

---

## 2. Componente: `CardAssentoIndividual` (`SeatAvatarItem`)

### O que ele faz
É o círculo individual que representa um participante específico na mesa. Mostra visualmente se a pessoa está conectada no momento e qual cor de voto ela tem.

### Informações que ele recebe (Entrada)
* **Identificador da Pessoa:** Nome público e inicial.
* **Cor do Voto:**
  * 🟢 **Verde:** Votando na proposta principal.
  * 🟡 **Amarelo:** Votando em uma emenda/contraproposta.
  * ⚪ **Cinza:** Presente na sala, mas ainda não votou.
* **Estado de Conexão:** Bolinha verde pequena indicando se está online na sala agora.
* **Tipo do Assento:** Cadeira titular (1 a 10) ou assento de buffer pontilhado (11 a 13).

### O que acontece quando o usuário mexe nele (Ações)
* Clicar no assento seleciona a pessoa e destaca no bate-papo as mensagens que ela enviou.

### Onde ele aparece
* Usado como parte de repetição dentro da `MesaDosAssentos`.

---

## 3. Componente: `AlertaClivagem` (`CellSplitBanner`)

### O que ele faz
Avisa de forma tranquila e elegante quando a sala atingiu o limite máximo de 13 pessoas (10 titulares + 3 no buffer) e foi dividida em duas salas irmãs de 10 pessoas.

### Informações que ele recebe (Entrada)
* **Novo ID da Sala:** O identificador da nova sala para onde o usuário está sendo movido.
* **Mensagem Explicativa:** *"A sala atingiu 13 pessoas e se dividiu para manter a conversa ágil. Você e mais 2 colegas formaram o núcleo da nova sala com novos vizinhos sorteados."*

### O que acontece quando o usuário mexe nele (Ações)
* **Botão "Ir para a Minha Nova Sala":** Redireciona o usuário para o novo espaço de conversa sem travar nada.

### Onde ele aparece
* **Tela 2: Sala dos 10** (quando o evento de clivagem ocorre).
