# Fase 3: Laboratório de Simulação P2P e Teste de Desastre Duplo

**Arquivo:** `system-design/P2P_PHASE_3_SIMULATOR_LAB.md`  
**Status:** Planejado (Executar após a Fase 2)  
**Onde será implementado:** `packages/core/src/p2p/` e `packages/core/test/p2p-disaster-lab.spec.ts`

---

## 1. Objetivo desta Fase
Criar o protocolo de sincronização entre nós (`SyncProtocol` — troca de documentos que faltam entre máquinas) e rodar o **Laboratório de Guerra no Terminal**, provando na prática que:
1. A rede aguenta quedas de conexão no meio de envios sem duplicar nem perder votos.
2. Se **a VPS quebrar E o celular do João quebrar ao mesmo tempo**, os celulares dos vizinhos restauram 100% da VPS e 100% da conta e dos votos do João gastando apenas ~159 KB.
3. A fila de síntese da IA na VPS funciona como um nó neutro que gera propostas sem direito a voto.

---

## 2. Como Funciona a Sincronização entre Dois Nós (Celular ↔ VPS ou Celular ↔ Celular)

Quando uma máquina `A` conecta em uma máquina `B` (ex: morador saiu do elevador e reconectou, ou uma VPS nova acabou de ligar):

1. **Passo 1 — Resumo do que eu já tenho (`SyncHello`):**
   * A máquina `A` envia uma listinha minúscula dizendo:
     * Quais IDs de Propostas ela já tem naquele assunto;
     * Qual é o maior `seq` que ela tem de cada morador.
2. **Passo 2 — Envio apenas da Diferença (`SyncDelta`):**
   * A máquina `B` compara com a memória dela e responde enviando **apenas os pacotes binários que faltam em `A`** (ou que têm `seq` mais novo em `B`).
   * E se `A` tiver pacotes que `B` não tem (por exemplo, quando a VPS nova está vazia!), `A` envia os pacotes dela para `B`!
3. **Interrupção no meio do caminho:**
   * Se o 4G cair depois de receber 10 pacotes de um lote de 50, os 10 recebidos já estão validados e salvos. Na próxima reconexão, o `SyncHello` pede apenas os 40 restantes.

---

## 3. Como Funciona a Recuperação do Desastre Duplo (VPS Quebrou + Celular do João Quebrou)

O protocolo inclui o documento especial `KEY_RECOVERY` (Recuperação Social M-de-N):
1. João compra um celular novo, que gera uma `Chave_Nova_Joao`.
2. 3 vizinhos do Círculo de Confiança do João (Maria, Pedro e Ana) assinam um pacote binário atestando:
   * `"Antiga: Chave_Velha_Joao -> Sucessora: Chave_Nova_Joao"`.
3. Quando esse pacote atinge as 3 assinaturas, todas as máquinas da comunidade reconhecem que a `Chave_Nova_Joao` é a continuação legítima da `Chave_Velha_Joao` (herdando o `seq` atual dele sem perder o voto!).

---

## 4. O que será criado quando executarmos a Fase 3

1. **`packages/core/src/p2p/node-peer.ts`**
   * Representa um Nó completo (pode operar como `MOBILE_CITIZEN` ou `VPS_RELAY_AI`).
   * Possui fila de saída offline (`outbox`) para quando estiver desconectado e método `syncWith(otherNode)`.
2. **`packages/core/src/p2p/social-recovery.ts`**
   * Validador do pacote de recuperação de chave com $M$ de $N$ assinaturas de vizinhos.
3. **`packages/core/test/p2p-disaster-lab.spec.ts` (O Grande Teste no Terminal)**
   * **Cenário 1 — Queda de Internet no Meio do Envio:** Morador vota offline no elevador, tenta sincronizar, a conexão cai na metade, reconecta depois e comprova zero perda e zero voto duplicado.
   * **Cenário 2 — Desastre Total (VPS + Celular do João Destruídos):**
     1. Simula 200 moradores e 1 VPS. Todos votam e mudam de ideia 3 vezes.
     2. O teste **destrói a VPS** (`vps = null`) e **destrói o celular do João** (`joaoPhone = null`).
     3. O teste cria uma `novaVPS` zerada e um `novoCelularJoao` zerado.
     4. Maria, Pedro e Ana assinam a recuperação do João e sincronizam seus celulares com a `novaVPS` e com o `novoCelularJoao`.
     5. **Prova Final:** O teste verifica que a `novaVPS` e o `novoCelularJoao` recuperaram **100% das propostas, 100% do placar e 100% do footprint do João**, e imprime na tela o peso exato transferido (comprovando que ficou na casa dos ~150 KB!).
   * **Cenário 3 — Fila de IA na VPS:** A VPS recebe 3 propostas concorrentes das comunidades, processa na fila neutra, gera a proposta de síntese `P4` (sem poder votar nela) e distribui de volta para as comunidades.
