# 08 — Guia Simples dos Tipos de Documentos TLV (`.cmnt`, `.memb`, `.stze`, `.snap`)

> Referência direta e enxuta do que vai dentro de cada documento binário no **Sintetize**, como eles se encaixam no formato já existente em `packages/wire` e como trafegam via **Nostr (`nostr-tools`)**.

---

## 1. Estrutura Única de Todo Pacote (102 bytes + Fita TLV)

Todos os documentos compartilham **exatamente o mesmo envelope binário**:

| Campo | Tamanho | O que guarda |
| :--- | :--- | :--- |
| `version` | `1 byte` | Versão do formato binário (`1`) |
| `docType` | `1 byte` | Tipo do documento (tabela abaixo) |
| `authorPub` | `32 bytes` | Chave pública Ed25519 de quem assinou |
| `seq` | `4 bytes` | Contador sequencial do autor (`Uint32BE`) |
| `signature` | `64 bytes` | Assinatura Ed25519 sobre cabeçalho + TLV |
| `blocks` | variável | Lista de blocos `[tag (1B) \| tamanho (2B) \| valor]` |

> Cada documento possui um **hash SHA-256 único** calculado sobre seus bytes — é esse hash que outros documentos citam para criar histórico inviolável (`PARENT_HASH`) ou apoios (`PICK_TARGET`).

---

## 2. Os 4 Universos e Seus Tipos (`docType`)

### Universo `.cmnt` — Comunidade e Regras
Define o que a comunidade é e quais parâmetros estão valendo (versão `v1 -> v2 -> v3`).

| Subtipo | `docType` | Para que serve | Principais campos (Tags TLV) |
| :--- | :--- | :--- | :--- |
| **Config / Versão da Comunidade** | `0` (`CONFIG` com `CONFIG_KIND=1`) | Criar comunidade (`v1`) ou propor alteração de regras (`v2+`) | `SCOPE` (ID da comunidade), `PARENT_HASH` (versão anterior, se `v2+`), `TITLE` (nome), `BODY` (estatuto/descrição), `QUORUM_PCT` (quórum %), `INACTIVITY_DAYS` *(novo)*, `INVITE_POLICY` *(novo)*, `PARENT_COMMUNITY_HASH` *(novo, p/ subcomunidades)*, `TIMESTAMP` *(novo)* |

---

### Universo `.memb` — Log Individual do Membro (1 por comunidade)
Cada integrante só assina o próprio `.memb` dentro de cada comunidade. **Não guarda leituras/cliques** — apenas vínculo e alterações de apoio (`picks`).

| Subtipo | `docType` | Para que serve | Principais campos (Tags TLV) |
| :--- | :--- | :--- | :--- |
| **Entrada por Convite (`JOIN`)** | `5` *(novo)* | Registrar entrada com convite válido assinado por membro ativo | `SCOPE` (ID da comunidade), `INVITE_PROOF` *(novo: token/assinatura do convidante)*, `AUTHOR_NAME` (apelido opcional), `TIMESTAMP` *(novo)* |
| **Apoio em Assunto (`PICK`)** | `2` (`PICK`) | Apoiar (ou trocar apoio para) uma proposta `.stze` | `SCOPE` (`communityId/subjectId`), `PICK_TARGET` (32B hash da proposta), `PARENT_HASH` (evento anterior do membro, opcional), `TIMESTAMP` *(novo)* |
| **Apoio em Regra/Comunidade (`COMMUNITY_PICK`)** | `3` (`COMMUNITY_PICK`) | Apoiar uma versão proposta de `.cmnt` (ex.: `v2`) | `SCOPE` (ID da comunidade), `PICK_TARGET` (32B hash do `.cmnt` proposto), `TIMESTAMP` *(novo)* |
| **Saída Voluntária (`LEAVE`)** | `6` *(novo)* | Encerrar participação ativa na comunidade | `SCOPE` (ID da comunidade), `PARENT_HASH` (32B hash do último evento do membro), `TIMESTAMP` *(novo)* |

---

### Universo `.stze` — Assuntos, Propostas e Execuções
Conteúdo colaborativo produzido dentro da comunidade por membros ativos.

| Subtipo | `docType` | Para que serve | Principais campos (Tags TLV) |
| :--- | :--- | :--- | :--- |
| **Abertura/Regra de Assunto** | `0` (`CONFIG` com `CONFIG_KIND=2`) | Abrir um novo assunto e definir seu prazo/quórum | `SCOPE` (`communityId/subjectId`), `TITLE`, `BODY`, `CURRENCY`, `DEADLINE`, `QUORUM_PCT`, `TIMESTAMP` *(novo)* |
| **Proposta / Síntese** | `1` (`PROPOSAL`) | Publicar proposta ou síntese revisada (`PARENT_HASH`) | `SCOPE` (`communityId/subjectId`), `PARENT_HASH` (opcional, se revisão), `TITLE`, `BODY`, `LAW_ARTICLE` (opcional), `AUTHOR_NAME`, `TIMESTAMP` *(novo)* |
| **Execução / Fechamento** | `4` (`EXECUTION`) | Registrar resultado aprovado ou execução concluída | `SCOPE` (`communityId/subjectId`), `PARENT_HASH` (32B hash da proposta vencedora), `BODY`, `TIMESTAMP` *(novo)* |

---

### Universo `.snap` — Snapshot / Checkpoint Assinado
Resumo consolidado para novos membros sincronizarem rápido sem baixar anos de eventos antigos.

| Subtipo | `docType` | Para que serve | Principais campos (Tags TLV) |
| :--- | :--- | :--- | :--- |
| **Snapshot de Estado (`SNAPSHOT`)** | `7` *(novo)* | Consolidar membros ativos + regra vigente até um ponto de corte | `SCOPE` (ID da comunidade), `PARENT_HASH` (snapshot anterior, se houver), `CUTOFF_HASH` *(novo: 32B)*, `ACTIVE_CMNT_HASH` *(novo: 32B)*, `ACTIVE_MEMBERS_TABLE` *(novo: `pubKey + lastTs`)*, `COSIGNATURES` *(novo: assinaturas de quórum)*, `TIMESTAMP` *(novo)* |

---

## 3. Como Tudo Viaja Pelo Nostr (`nostr-tools`)

O Nostr funciona apenas como **correio descentralizado** para esses pacotes:

1. **Tipo de evento Nostr:** Evento **regular/imutável** (por exemplo `kind` na faixa `1000–9999`), porque cada versão/evento TLV é imutável e nunca deve ser sobrescrita silenciosamente pelo relay.
2. **Conteúdo (`content`):** Os bytes do pacote TLV (`.cmnt`, `.memb`, `.stze` ou `.snap`) codificados em Base64.
3. **Tags Nostr para filtragem rápida no relay:**
   * `["t", "<communityId>"]` — separa o tráfego por comunidade.
   * `["u", "cmnt" | "memb" | "stze" | "snap"]` — permite *sync* seletivo por universo.
   * `["h", "<sha256Hex>"]` — identifica o hash exato do pacote TLV.
4. **Validação:** O cliente **nunca** confia cegamente no evento Nostr — ao receber o `content`, ele decodifica o Base64 e valida a assinatura Ed25519, os limites TLV e as regras da versão vigente do `.cmnt`.
