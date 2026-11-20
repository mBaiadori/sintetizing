
# Fase 1: Motor Binário Posicional & Fita TLV (`.stz`)

**Arquivo:** `system-design/P2P_PHASE_1_BINARY_TLV.md`
**Status:** Pronto para Execução
**Onde será implementado:** `packages/core/src/wire/` e `packages/core/test/wire.spec.ts`

---

## 1. Objetivo desta Fase

Construir o codificador (`encode`), o decodificador (`decode`) e o validador de porta de entrada (`validate`) que transformam qualquer documento do Sintetize (Proposta, Pick ou Execução) em uma **fita de bytes brutos (`Uint8Array`)** sem JSON, sem nomes de campos em texto e sem hashes redundantes.

---

## 2. Especificação Byte a Byte do Cabeçalho Fixo (102 Bytes)

Todo documento na rede começa obrigatoriamente com estes **102 bytes fixos**:

| Bytes       | Nome          | Tipo Binário          | Descrição                                                                                                  |
| :---------- | :------------ | :--------------------- | :----------------------------------------------------------------------------------------------------------- |
| `0`       | `version`   | `Uint8` (1 byte)     | Versão do protocolo binário (valor atual =`1`).                                                          |
| `1`       | `docType`   | `Uint8` (1 byte)     | `1` = Proposta`2` = Pick Individual`3` = Pick de Comunidade/Sociedade`4` = Atestado de Execução    |
| `2..33`   | `authorPub` | `Uint8Array(32)`     | Chave pública Ed25519 de quem assinou (32 bytes puros).                                                     |
| `34..37`  | `seq`       | `Uint32BE` (4 bytes) | Número de sequência (`1, 2, 3...`). Em Propostas é sempre `1`. Em Picks sobe a cada mudança de voto. |
| `38..101` | `signature` | `Uint8Array(64)`     | Assinatura Ed25519 (64 bytes puros) assinando os bytes`[0..37]` + todos os bytes de `[102..fim]`.        |

> **Como obtemos o `docId` (Hash do documento)?**
> Calculamos o `SHA-256` sobre o pacote inteiro em tempo de execução. Ele não viaja dentro do pacote, economizando 32 bytes em todos os envios.

---

## 3. Especificação da Fita de Campos TLV (`Bytes 102 em diante`)

Logo após o byte `101`, começa a fila sequencial de blocos **TLV (`Tag - Length - Value`)**.
Cada bloco na fila tem o formato:

```text
[ TAG: Uint16BE (2 bytes) ] + [ LENGTH: Uint16BE (2 bytes) ] + [ VALUE: Uint8Array (LENGTH bytes) ]
```

* **`TAG` (2 bytes):** Identifica qual é o tipo do campo (suporta de `0` a `65.535` tipos de campos diferentes).
* **`LENGTH` (2 bytes):** Informa quantos bytes exatos o `VALUE` possui (de `0` a `65.535` bytes).
* **`VALUE` (`LENGTH` bytes):** Os bytes brutos do dado.
* **Repetição Permitida:** A fita é lida como uma lista ordenada (`Bloco #0, Bloco #1, Bloco #2...`). Uma proposta pode ter dois, três ou dez blocos com a mesma `TAG` (ex: vários campos de Valor ou vários Artigos de Lei) sem que um apague o outro.

---

## 4. Tabela Oficial de Tags e Validadores da Fase 1

| Código`TAG`   | Nome do Campo            | Formato do`VALUE`               | Regra Estrita do Validador                                                                                                    |
| :--------------- | :----------------------- | :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **`1`**  | `SCOPE` (Escopo)       | Texto UTF-8 curto                 | Obrigatório em Propostas. Mín: 3 bytes, Máx: 128 bytes (ex:`f1/s2/c9/a4`).                                               |
| **`2`**  | `PARENT_HASH` (Pai)    | `Uint8Array(32)`                | Hash de 32 bytes da proposta anterior (para o "vai e volta"). Pode repetir se for síntese de várias propostas.              |
| **`10`** | `TITLE` (Título)      | Texto UTF-8                       | Mín: 5 bytes, Máx: 160 bytes.                                                                                               |
| **`11`** | `BODY` (Texto Livre)   | Texto UTF-8                       | Mín: 1 byte, Máx: 4.000 bytes (comporta confortavelmente 2.000+ caracteres com acentos). Repetível.                        |
| **`12`** | `CURRENCY` (Valor)     | `Uint32BE (4B)` + Rótulo UTF-8 | Os primeiros 4 bytes são o valor inteiro em centavos; os bytes seguintes são o rótulo (ex:`"Material"`). Repetível.     |
| **`13`** | `DEADLINE` (Prazo)     | `Uint32BE (4B)`                 | Prazo em segundos ou timestamp Unix.                                                                                          |
| **`14`** | `LAW_ARTICLE` (Artigo) | `Uint16BE (2B)` + Texto UTF-8   | Os 2 primeiros bytes são o número do Artigo (`1, 2, 3...`); o resto é o texto do artigo (Máx: 2.000 bytes). Repetível. |
| **`20`** | `PICK_TARGET` (Alvo)   | `Uint32BE (4B)` ou `32B`      | No Pick simples dentro do assunto, pode usar o índice curto de 4 bytes (total =**106 bytes**) ou o hash de 32 bytes.   |

---

## 5. O que será criado quando executarmos a Fase 1

1. **`packages/core/src/wire/tlv.ts`**
   * Funções `encodeTLVBlocks(blocks)` e `decodeTLVBlocks(bytes)` que leem e gravam a fila de blocos `[TAG][LENGTH][VALUE]` com proteção contra tamanhos corrompidos.
2. **`packages/core/src/wire/binary-envelope.ts`**
   * Funções `packDocument(doc, privateKey)` e `unpackAndVerifyDocument(bytes)`:
     * Monta o cabeçalho de 102 bytes;
     * Assina com `Ed25519`;
     * Valida a assinatura e passa cada bloco TLV pelo validador de limites antes de aceitar.
3. **`packages/core/test/wire.spec.ts` (Bateria de Testes no Terminal)**
   * **Teste 1:** Empacota um `PICK` e comprova tamanho ultra-compacto (**106 a 110 bytes**).
   * **Teste 2:** Empacota uma Proposta contendo um texto de **2.000 caracteres** + **dois campos de Valor (`Tag 12`: "Material" e "Mão de Obra")** e comprova que ambos são lidos de volta na ordem exata sem colisão.
   * **Teste 3:** Altera 1 único byte no meio do pacote e comprova que o validador rejeita imediatamente na porta de entrada.
   * **Teste 4:** Simula um celular antigo lendo um pacote com uma `Tag 999` desconhecida (futura) e comprova que ele pula os bytes pelo `LENGTH` sem travar.

---

## 6. Critério de Pronto (Definition of Done)

* Todos os testes de `packages/core/test/wire.spec.ts` passando em verde no comando `pnpm --filter @sintetizing/core test`.
* Zero dependências pesadas adicionadas.
