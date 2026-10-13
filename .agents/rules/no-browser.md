# Regra: Proibido Uso de Browser / Subagente de Navegador

- **NUNCA** utilize ferramentas de navegador como `browser_subagent` ou acesse páginas web locais/externas via browser automatizado.
- O desenvolvimento e a validação de layout, responsividade e lógica devem ser feitos estritamente **via código** (CSS, HTML, JS) e análise estática/estrutural.
- Respeite integralmente as decisões declaradas em código e as fórmulas de medição matemática de viewport (`calc(100dvh - var(--header-height))`, `clamp()`, media queries).
