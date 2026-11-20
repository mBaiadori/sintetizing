# Regra de Governança de Código: Reutilização, Escopos e Anti-Duplicação
**Escopo:** Todo o desenvolvimento do projeto Sintetize  
**Classificação:** Regra Ativa do Workspace Antigravity

---

## 1. Princípio da Consulta Prévia Obrigatória (*Search Before Write*)

Antes de implementar qualquer nova função, hook, componente ou classe CSS:
1. **Pesquise primeiro:** Verifique o que já existe em `packages/wire/`, `system-design/` e nas regras visuais de `system-design/06_INTERFACE.md` (e tokens de referência em `archive/docs/UI_DESIGN_SYSTEM.md`).
2. **The One-Version Rule:** Se já existe uma função ou componente que atende ao caso de uso ou resolve 80% do problema, **estenda ou componha** o item existente. Nunca crie uma versão alternativa ou "paralela" com pequenas modificações.
3. **Não reinvente o que a pilha já resolve:** Consulte se a funcionalidade já é fornecida por `shadcn/ui`, `Radix UI`, `@noble/ed25519`, `@noble/hashes`, `Zustand` ou `Zod`.

---

## 2. Proibição de Estilos Ad-Hoc e Consistência de UX

1. **Uso Exclusivo de Design Tokens e Classes Semânticas:**
   * Utilize exclusivamente tokens e classes semânticas padronizadas (`--gov-*`, `.gov-touch-target`, etc., definidos em `system-design/06_INTERFACE.md` e `archive/docs/UI_DESIGN_SYSTEM.md`).
   * Evite valores arbitrários de cores, espaçamentos ou bordas fora da paleta definida.
2. **Ergonomia Móvel Inegociável:**
   * Qualquer elemento clicável ou interativo deve respeitar a área de toque mínima de **44x44px** (`.gov-touch-target`).

---

## 3. Separação Estrita de Responsabilidades (Escopos)

1. **Componentes Focados:** Cada componente deve fazer apenas uma coisa. Se um componente precisa de mais de 150 linhas ou gerencia múltiplos fluxos assíncronos, ele deve ser decomposto em subcomponentes menores.
2. **Apresentação Separada da Lógica de Dados:**
   * Componentes visuais (`apps/web/src/components/`) cuidam estritamente da renderização e acessibilidade (props e eventos).
   * Lógica de consulta ao storage local, rede P2P ou assinaturas criptográficas deve viver exclusivamente em custom hooks ou services das camadas `Wire`/`Domain`/`Storage`/`Network`.

---

## 4. Checklist Obrigatório Antes de Submeter Qualquer Código

- [ ] Verifiquei se não estou recriando uma função utilitária ou componente já existente?
- [ ] O componente consome os tokens semânticos de `system-design/06_INTERFACE.md`?
- [ ] Acessibilidade por teclado (`:focus-visible`) e touch targets de 44px estão garantidos?
- [ ] Não utilizei o tipo `any` nem supressões (`@ts-ignore`) conforme exigido no `CONSTRAINTS.md`?
