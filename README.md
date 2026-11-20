# Sintetize — Infraestrutura Local-First de Síntese e Consenso Dinâmico

O **Sintetize** é um protocolo e aplicação de governança direta para comunidades reais (condomínios, bairros, cooperativas e coletivos). Ele substitui discussões caóticas e intermediação política por propostas estruturadas, comparação visual de diferenças, apoio único transferível (`Pick`) e sincronização descentralizada sobre pacotes binários compactos **`.stze`**.

> **Comece por aqui:** leia o resumo executivo e técnico em **[system-design/RESUMO.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/system-design/RESUMO.md)**.

---

## 🗺️ Estrutura do Repositório

| Caminho | Papel | Status |
| :--- | :--- | :--- |
| **`system-design/`** | Especificação canônica da arquitetura (`00_OVERVIEW.md` a `06_INTERFACE.md`, decisões P2P e [RESUMO.md](file:///Users/MarcosBaiadori/Desktop/sintetizing/system-design/RESUMO.md)) | ✅ Canônico |
| **`packages/wire/`** | Motor binário `.stze` (cabeçalho 102B + TLV), Ed25519, `SubjectStateEngine`, Merkle, `NodePeer` (`SyncHello`/`SyncDelta`), `SocialRecovery` e simuladores | ✅ Implementado (39 testes) |
| **`interactive-page/`** | Jornada interativa explicativa publicada via GitHub Pages ([index.html](file:///Users/MarcosBaiadori/Desktop/sintetizing/index.html)) | ✅ Ativo |
| **`CONSTRAINTS.md`** | Contrato de tipagem estrita, cobertura de testes, segurança (teto 100 KB, anti-XSS, custódia zero) e SLOs | ✅ Ativo |
| **`archive/`** | Documentação e código legado da versão anterior (PFS-CD v2.2 celular / `packages/core` / `docs/`) preservados para referência | 📦 Arquivado |

---

## 🛠️ Comandos Principais

```bash
# Testes e verificação de tipos
pnpm test               # Suíte completa do @sintetizing/wire (39 testes)
pnpm test:coverage      # Cobertura de código
pnpm typecheck          # TypeScript estrito (--noEmit)
pnpm build              # Compilação dos pacotes

# Laboratório e inspeção local de pacotes .stze
pnpm rede:criar         # Gera rede local física (VPSs + celulares + pacotes .stze)
pnpm arvore             # Lista a árvore de nós e pacotes .stze gerados
pnpm inspecionar <arq>  # Inspeção forense (cabeçalho, TLV, assinatura e DocID) de um .stze
pnpm simular            # Simulação P2P passo a passo (use simular:rapido para sem delay)
pnpm estresse           # Benchmark de carga com milhares de cidadãos e verificação Merkle
pnpm painel             # Sobe o painel local de visualização em http://localhost:3333
```
