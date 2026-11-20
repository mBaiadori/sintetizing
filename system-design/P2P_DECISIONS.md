# Caderno de Decisões: Rede, Protocolo e Documentos (P2P)

> **Objetivo:** Especificação direta e funcional da rede, formato binário sem hashes redundantes, campos repetíveis e sobrevivência a desastres.

---

## Decisão 1: Topologia da Rede e Sobrevivência a Desastre Duplo
* **Cenário Extremo: E se a VPS quebrar E o celular do João também quebrar ao mesmo tempo?**
  1. **Os votos e propostas do João NÃO se perdem:** Como uma comunidade local é leve, **os celulares dos vizinhos têm uma cópia espelhada de todos os documentos e footprints da comunidade**.
  2. **Recuperação da Identidade do João:** Quando o João pega um celular novo, os 3 vizinhos do Círculo de Confiança dele assinam um documento confirmando a nova chave dele.
  3. **Restauração Total Automática:** Os celulares dos vizinhos devolvem para o celular novo do João (e para qualquer nova VPS) **100% das propostas, votos ativos e histórico (footprints)**.

---

## Decisão 2: Cabeçalho Binário Enxuto (Pick de apenas 106 Bytes!)
* **Zero Hashes Redundantes:** O ID do documento é calculado na hora pelos próprios bytes (economiza 32B) e a ordem do Pick usa o número inteiro `seq` (economiza mais 32B).

| Posição dos Bytes | Campo | Tamanho Fixo | Função |
| :--- | :--- | :--- | :--- |
| `Byte 0` | `version` | 1 byte | Versão da regra binária (`1`) |
| `Byte 1` | `docType` | 1 byte | `1` = Proposta, `2` = Pick, `3` = Execução |
| `Bytes 2..33` | `authorPub` | 32 bytes | Chave pública de quem assinou |
| `Bytes 34..37` | `seq` | 4 bytes | Número inteiro da sequência (`1, 2, 3...`) |
| `Bytes 38..101` | `signature` | 64 bytes | Assinatura Ed25519 |
| `Bytes 102+` | `fieldsTLV` | Variável | Fita de blocos `[TAG (2B)][LENGTH (2B)][VALUE]` |

---

## Decisão 3: Textos de 2.000+ Caracteres e Múltiplos Campos Iguais (Como a Fita TLV Resolve)

### 1. Como funciona o tamanho para 2.000 caracteres (Sem desperdiçar espaço)?
* O marcador `LENGTH` usa **2 bytes brutos**, o que permite guardar qualquer número de `0` até **`65.535` bytes**!
* **Tamanho Elástico Exato:** O campo não reserva espaço vazio.
  * Se a pessoa escrever 30 letras, o `LENGTH` marca `30` e gasta só 30 bytes.
  * Se a pessoa escrever **2.000 caracteres**, o `LENGTH` marca `2000` (ou ~900 bytes após a compressão binária) e o arquivo usa exatamente esse espaço.

### 2. E se a proposta tiver DOIS ou MAIS campos iguais (Ex: dois campos de Valor ou três de Texto)?
* Ao contrário do JSON comum (onde duas chaves iguais se apagam), a **Fita TLV é uma fila sequencial de blocos (`Bloco 0, Bloco 1, Bloco 2...`)**.
* Você pode repetir a mesma `TAG` quantas vezes quiser na ordem em que o usuário montou a proposta!
* **Exemplo Real na Fita Binária (Dois campos de Valor `Tag 12` na mesma proposta):**
  * `Bloco #0` -> `[Tag 10: Título]` `[Len: 14]` `["Reforma Geral"]`
  * `Bloco #1` -> `[Tag 11: Texto]` `[Len: 850]` `[Texto de 2.000 caracteres comprimido...]`
  * `Bloco #2` -> `[Tag 12: Valor]` `[Len: 13]` `["Material" + R$ 1.200]`
  * `Bloco #3` -> `[Tag 12: Valor]` `[Len: 16]` `["Mão de Obra" + R$ 500]`
* **Como o software lê e compara isso:**
  1. Ele lê a fita na ordem (`#0, #1, #2, #3`) e desenha na tela exatamente dois campos de valor separados (*"Material"* e *"Mão de Obra"*), podendo inclusive somar todas as `Tag 12` para exibir o custo total automaticamente.
  2. Se outra pessoa criar uma proposta mudando só o valor da *"Mão de Obra"*, o comparador (Diff) sabe que o item alterado foi o **`Bloco #3`**, sem confundir com o `Bloco #2`!

---

## Decisão 4: Como Guardamos os Picks e o Footprint (Vai e Volta `A -> B -> A`)
* **Para o Placar Atual:** O software conta apenas o maior `seq` de cada pessoa naquele assunto (`seq: 3 -> A`).
* **Para o Footprint (Auditoria e Backup):** Como cada Pick pesa apenas **106 bytes**, 500 moradores mudando de voto 3 vezes somam apenas **159 KB**. Todos os celulares da comunidade guardam a cópia completa da sua própria comunidade.

---

## Decisão 5: Escala para Sociedade e Federação (Compressão em Escada)
* **Propostas (Vai e Volta):** Propostas (~1 a 3 KB) sobem da Comunidade para a Sociedade/Federação, recebem melhorias (podendo alterar apenas 1 bloco `#N` da fita TLV sem reenviar o resto!) e descem sintetizadas.
* **Picks (Em Escada):** Cada Comunidade emite 1 único documento `PICK_COMUNIDADE` resumindo seu placar para a Sociedade, e cada Sociedade emite 1 `PICK_SOCIEDADE` para a Federação.

---

## Roteiro de Execução Passo a Passo (Fases Detalhadas)

Para executar cada etapa com calma, uma por vez, consulte os documentos técnicos de cada fase:

1. [**Fase 1: Motor Binário Posicional & Fita TLV (`P2P_PHASE_1_BINARY_TLV.md`)**](./P2P_PHASE_1_BINARY_TLV.md)
   * Cabeçalho de 102 bytes, Pick de 106 bytes, blocos `[TAG][LENGTH][VALUE]`, textos de 2.000+ caracteres, campos repetidos de Valor e validadores de porta de entrada.
2. [**Fase 2: Motor de Estado, Pulo de Picks e Federação (`P2P_PHASE_2_PICKS_AND_FOOTPRINT.md`)**](./P2P_PHASE_2_PICKS_AND_FOOTPRINT.md)
   * Vai-e-volta de voto (`A -> B -> A`), proteção contra replay de voto antigo, Footprint encadeado, emendas de artigos de lei e compressão em escada (`Pessoa -> Comunidade -> Sociedade -> Federação`).
3. [**Fase 3: Laboratório de Simulação e Desastre Duplo (`P2P_PHASE_3_SIMULATOR_LAB.md`)**](./P2P_PHASE_3_SIMULATOR_LAB.md)
   * Sincronização de diferenças (`SyncHello / SyncDelta`), tolerância a quedas de 4G, recuperação social e teste real de destruição simultânea da VPS + Celular do João reconstruindo tudo a partir dos vizinhos.

