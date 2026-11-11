# U5.1.1 — Fechamento dirigido de Movimentações

**Data:** 2026-11-11. **PR #37**, branch `feat/mf2-u5-1-movements-productivity-20261111`. **Commit de correção:** `2fa9abd3cc4ffe29f4235c2eb60556ce0db8f8f3`. A revisão que motivou a missão está em `docs/ai-context/reviews/2026-11-11-U5-1-PR37-ARCHITECT-REVIEW-AND-U5-2.md` (PR #35).

**Causa P2-01:** filtro bancário usava `effectiveNature`, mas o popover derivava `kind` somente do sinal. Corrigido `quickCategoryContext` com fonte consistente; sobrescritas de `income`/`expense` têm prioridade sobre sinal; `transfer`/`ignore` mostram mensagem e bloqueiam categorização rápida até revisão da natureza no drawer. `chooseQuickCategory` valida explicitamente e não envia write de transferência/desconsiderada. Sem gravar `nature`, montante, status ou bruto Pluggy.

**Causa P2-02:** `bankOverview()` retorna apenas 2500 linhas na lista, e os resumos/contagens da aba não representam necessariamente todas as movimentações históricas. Inserido aviso explícito junto dos cards, com contagem de carregadas e total bruto e qualificação de métricas e revisão; resultados não são anunciados como históricos completos. Agregados diários de todo o histórico não foram modificados; sem paginação.

**Arquivos alterados:** `src/app.ts`, `app/movements-productivity.css`, `tests/u5-1-inline-category.test.cjs`; novo `tests/u5-1-history-limits.test.cjs`.

**Evidência REAL desta sessão:** 6/6 cenários do código de produção de categorização/guardas sob V8 com sintaxe TypeScript retirada no harness e dados inteiramente sintéticos (auto, override de natureza e transfer/ignore). **Teste SQLite real de 2501 registros foi versionado, mas não executado nesta sessão.** A suíte oficial `npm ci`, `test:types`, `test:db`, `compile`, F08, ASAR, regressões D1.5.1 e GUI Electron não foi executada porque não há checkout integral com toolchain pinned neste ambiente. Nenhum green test oficial, screenshot real, merge, deploy ou Windows build foi produzido.

**Status:** revisão de código U5.1.1 concluída, **homologação não concluída**. U5.2 será branch/PR empilhados a partir do HEAD documentado desta fase, sem mudanças em Inteligência, main ou dados pessoais.
