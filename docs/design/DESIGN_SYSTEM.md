# MF2 — Design System Premium (estágio de prototipação)

Fonte canônica de decisões de direção: `docs/ai-context/DESIGN_DIRECTION_PREMIUM.md` na baseline do PR #54.

## Tokens propostos para D01 V4 (sujeitos a feedback)
- Canvas dark: `#0d1211`; superfície: `#151c1a`; painel: `#19221f`; borda: `#2a3531`.
- Canvas light: `#f5f7f5`; superfície: `#ffffff`; painel: `#ffffff`; borda: `#e0e7e2`.
- Positivo/acento dark: `#66d4b6`; positivo light: `#1f7a63`. Desfavorável: `#f37e82` em dark/`#b93f48` em light.
- Atenção: `#eab968`; neutro: text secondary/cinza. Evitar verde para aumento de despesas.
- Raio do drawer: `22px`; cards internos: `14px`; botões: `10px`.
- Transições: `140ms` micro, `240ms` painel, easing `cubic-bezier(.22,1,.36,1)`; respeitar `prefers-reduced-motion`.
- Drawer de referência: `min(440px, 100%)`; tela expandida com continuidade de sessão.
- Tipografia base: system-ui/sans-serif, números tabulares, legibilidade em 1366×768 e 1920×1080.

## Regras semânticas
- Receita aumenta → favorável; despesas aumentam → desfavorável, quando comparação válida.
- Despesas diminuem → favorável, quando comparação válida.
- Falta de base/fonte/tempo → neutro; nunca inventar percentuais no perfil pessoal.
- Protótipos podem usar valores sintéticos, desde que sinalizados.
- Ações financeiras reais requerem serviço autorizado, prévia, confirmação, recibo e auditoria; perfil pessoal não habilita por conta da interface.
- Componentes devem contemplar loading, vazio, erro, contexto expirado e disponibilidade.
