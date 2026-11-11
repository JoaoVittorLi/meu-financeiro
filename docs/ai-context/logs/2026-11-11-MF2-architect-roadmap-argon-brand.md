# MF2 — Planejamento pós-Auditoria ARGON + Identidade Visual MF

**Data:** 2026-11-11 · **Executor documental:** Chat Arquiteto · **Escopo:** documentação e priorização, sem código de aplicativo.  
**Fonte técnica:** branch `feat/mf2-beta8-premium-staging-20261110` / PR #31, commit `d513c2be3f9b0cd018aed0b71f46ce8747a6556c`. CI desse SHA: Linux success e Windows success.  
**Fontes de pesquisa:** pacote ARGON/Antigravity disponibilizado pelo proprietário (13 relatórios e evidências) e três imagens da nova identidade MF; observações sobre hover, tema, emojis e roxo antigo. O material bruto permanece na conversa e **não foi integralmente versionado nesta PR**.

## Objetivo e execução

Consolidar de forma completa o mapa de problemas/ideias e criar um plano rastreável de entregas com prioridades, dependências, owners, aceites, requisitos de segurança e orientação de identidade visual oficial para Windows e PWA.

1. Consultado estado GitHub do PR #31 e documentação existente. Confirmado SHA do HEAD e CI verde nessa revisão.
2. Analisados relatórios do ARGON: diagnóstico, oito páginas, catálogo de cards, benchmark, laboratório de 18 propostas, bugs BUG-01 a BUG-10, scorecard, roadmap e design legado.
3. Separados defeitos comprovados (ex.: CRUD manual ausente, drawer claro, SVG roxo, tratamento hover) de hipóteses e diferenciais propostos (radar, Pix/CDI, ações por IA).
4. Incorporadas instruções de nova marca MF, incluindo vetores/fontes licitados, Windows ICO, NSIS, Portable, desktop shell, PWA manifest, maskable icon e estados claro/escuro.
5. Publicada revisão abrangente em `docs/ai-context/reviews/2026-11-11-ARGON-ROADMAP-PREMIUM-BRAND-INTELLIGENCE.md` e link no `docs/ROADMAP_MF2.md`.

## Limitações e pendências

- **Não foram modificados:** renderer, Electron, SQLite, CSS, PWA, CI, binários, instaladores ou dados do proprietário; nenhum teste de código executado por este plano.
- A auditoria apresenta algumas divergências (notas, quantidades, versão/tamanho de binários e alegação de função de briefing). Requer errata dirigida, não nova auditoria geral.
- O conector GitHub retornou visibilidade `public`; confirmar intencionalidade antes de decisões de divulgação/segurança. Não foram alteradas configurações do repositório.
- Os PNGs de identidade são referências; faltam fontes vetoriais definitivas para a implementação fiel. Não foram enviados ícones binários ao GitHub.
- O Chat Executor deve ler novo plano antes de aplicar D1.5, preservar os serviços contábeis, implementar em branch de código própria e registrar os testes da entrega. O Argon/Antigravity não deve alterar o mesmo CSS simultaneamente.

## Próximo gate

**D1.5-F** (CRUD manual + testes), **D1.5-V** (contraste e gráficos) e **A-D7** (hover refinado e remoção cuidadosa de legado), seguidos por **ID1** (identidade oficial) e **I1** (Inteligência local e UX). Integrar somente após revisão de diffs, matrizes GUI e regressões financeiras, sem `main`, Cloudflare Production ou cutover implícitos.
