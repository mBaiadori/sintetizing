# Fase 2: Motor de Estado, Pulo de Picks (`A -> B -> A`) e Escada de Federação

**Arquivo:** `system-design/P2P_PHASE_2_PICKS_AND_FOOTPRINT.md`  
**Status:** Planejado (Executar após a Fase 1)  
**Onde será implementado:** `packages/core/src/state/` e `packages/core/test/state.spec.ts`

---

## 1. Objetivo desta Fase
Construir a inteligência de memória (`SubjectStateEngine`) que roda dentro de qualquer Celular ou VPS. Ela recebe os pacotes binários validados na Fase 1 e gerencia:
1. A árvore de propostas que vão e voltam entre níveis (`Comunidade ↔ Sociedade ↔ Federação`).
2. O pulo de Picks individuais (incluindo ir e voltar para a mesma proposta: `A -> B -> A`).
3. O armazenamento do Footprint sem inflar o placar.
4. A compressão em escada (`PICK_PESSOA` → `PICK_COMUNIDADE` → `PICK_SOCIEDADE`).

---

## 2. Regras de Negócio e Estruturas de Memória

### 2.1. Árvore de Propostas Bidirecional (Vai e Volta)
* Toda proposta recebida com `docType = 1` é indexada pelo seu `docId` (Hash SHA-256 calculado na chegada).
* As propostas são **imutáveis**.
* Quando uma Comunidade melhora uma proposta da Sociedade ou a IA gera uma síntese, a nova proposta traz um ou mais blocos `TAG 2 (PARENT_HASH)`.
* **Emenda Modular de Artigos de Lei:** Se a proposta filha trouxer apenas o `Artigo 4` (`TAG 14`), o motor herda automaticamente os demais artigos da proposta-mãe (`PARENT_HASH`) e substitui apenas o `Artigo 4` na visualização.

### 2.2. Tabela de Placar Ativo vs. Fita de Footprint (`A -> B -> A`)
Quando um pacote `PICK` (`docType = 2`) chega para um determinado Assunto:

1. **Verificação Anti-Replay (Segurança contra Voto Antigo):**
   * O motor busca na **Tabela de Placar Ativo** qual é o `seq` atual guardado para aquele `authorPub`.
   * Se `pacote.seq <= atual.seq`: **Rejeita imediatamente!** (Isso impede que alguém reenvie o `seq: 1` ou `seq: 2` antigo do João para desfazer o `seq: 3` atual dele).
2. **Atualização Atômica do Placar (Sobrescrita):**
   * Se `pacote.seq > atual.seq`:
     * O voto antigo na proposta anterior perde `-1`;
     * O voto novo na proposta escolhida ganha `+1`;
     * O registro ativo do João é **substituído** pelo novo pacote (mantendo o gasto fixo de ~106 bytes por pessoa no placar).
3. **Gravação no Footprint (Histórico de Auditoria):**
   * O pacote binário é anexado na lista de histórico do assunto (`seq: 1 -> seq: 2 -> seq: 3`), permitindo provar toda a trajetória de mudança de opinião da comunidade em apenas ~159 KB (para 500 moradores com 3 mudanças cada).

### 2.3. Compressão em Escada (Comunidade → Sociedade → Federação)
* **`generateCommunityPick()`:**
  * Lê todos os votos ativos dos moradores da comunidade naquele assunto;
  * Calcula a **Raiz Merkle (32 bytes)** de todos os pacotes de Pick ativos;
  * Gera um único pacote binário `docType = 3 (PICK_COMUNIDADE)` com `seq` incrementado, apontando para a proposta vencedora local e levando o placar resumido + a Raiz Merkle.
* **Na Sociedade / Federação:**
  * O motor da Sociedade recebe os pacotes `PICK_COMUNIDADE` de cada condomínio/cooperativa e aplica exatamente a mesma regra de `seq` quando uma comunidade inteira "pula" de uma proposta para outra!

---

## 3. O que será criado quando executarmos a Fase 2

1. **`packages/core/src/state/merkle.ts`**
   * Calculador leve de Raiz Merkle (32 bytes) e Prova Merkle (para qualquer morador provar que seu voto está dentro do resumo da comunidade).
2. **`packages/core/src/state/subject-engine.ts`**
   * Classe `SubjectStateEngine`:
     * `ingestBinaryPacket(bytes)`
     * `getTally()` (retorna o placar exato de cada proposta em tempo real)
     * `getPersonFootprint(authorPub)` (retorna a fita `seq: 1, 2, 3...` do cidadão)
     * `exportCommunityRollupPick()` (gera o pacote resumido da comunidade para subir à Sociedade/Federação).
3. **`packages/core/test/state.spec.ts` (Bateria de Testes no Terminal)**
   * **Teste 1 (Vai e Volta de Voto `A -> B -> A`):** João vota em `A (seq 1)`, pula para `B (seq 2)` e volta para `A (seq 3)`. Comprova que o placar de `A` é `1`, `B` é `0`, e o Footprint do João mostra os 3 passos.
   * **Teste 2 (Ataque de Replay):** Tenta injetar novamente o pacote `seq 2 (B)` do João após ele já estar no `seq 3 (A)` e comprova que o motor bloqueia.
   * **Teste 3 (Emenda de Lei e Síntese):** Cria uma Lei com 5 artigos na Comunidade A, manda para a Sociedade, a Comunidade B altera só o Artigo 3, a IA sintetiza e devolve.
   * **Teste 4 (Escada Completa):** 3 comunidades com 100 moradores cada geram seus `PICK_COMUNIDADE`, sobem para a Sociedade, uma comunidade muda de ideia (`seq 2`) e o placar da Sociedade atualiza instantaneamente.
