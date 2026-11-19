# Log de Implementação — Marco 2: Inteligência Financeira 3.0 (Copiloto Financeiro)

- **Branch:** `feat/mf2-intelligence-3-0-copilot-20261118`
- **Worktree isolada:** `C:\Dev\meu-financeiro-worktrees\m2-copilot`
- **Base:** `ffc70f2b61e247bda7b00bbfb72dbbc95650cb7d` (`M1.1` / PR #105)
- **Status:** Implementado em fatias verticais (`F1–F5`, Sistema Adaptativo e Guia Permanente); aguardando commit final da Fatia 4 + documentação, execução cumulativa pós-commit (Nível A + Nível B + tipos/bundle/provenance/smoke/asar/mobile-push), auditorias independentes `pro` (Forense/Financeira e Visual/Design) e revisão de plano antes de qualquer geração de instalador Nível C.

## 1. Fatia 1 (`9aacc0a`) — Guia Permanente, F1 (Detetive Financeiro) e Respostas Adaptativas
- Criado `docs/intelligence/COPILOT_PERMANENT_GUIDE.md` (`M2-GUIDE-V1`) com separação epistêmica (Fato, Hipótese, Estimativa, Simulação, Limitação), zero fabricação numérica, copy PT-BR calmo e ausência de jargão interno para o usuário final.
- Criado `shared/copilot-language.cjs` (`COPILOT_GUIDE_VERSION`, `EPISTEMIC_KIND`, `GUARDRAIL_COPY`, `formatMoneyBRL`, `formatPercentOrNull`, `stripInternalJargon`, `buildCopilotAnswer`).
- Atualizados `electron/intelligence-investigation.cjs` (`focusIncome`, campos aditivos `incomePreviousCents`, `incomeCurrentCents`, `incomeDeltaCents`, `guideVersion`, `epistemicSections`, `GUARDRAIL_COPY`) e `electron/intelligence-orchestrator.cjs` (`followUps` acionáveis com `question`).
- Atualizados `src/intelligence-ic2.ts` (`mfIC2AdaptiveDensity`, `mfIC2AdaptiveModel`, `renderMfIC2Adaptive` e handlers `mfIC2Card` auto-contidos para compatibilidade com `rc-all-01-ic2.test.cjs`), `src/intelligence-local.ts` (densidades `compact`/`mobile`/`standard` e anexo de `ic2Reply`/`ic2FollowUps`), `src/intelligence-view.ts` (renderização de `renderMfIC2Adaptive`), `app/intelligence.css` (regras `.mf-ic2-*`) e `tests/m2-slice1-guide-f1-adaptive.test.cjs`.

## 2. Fatia 2 (`dba8677`) — F2 (Economia Anti-Dupla-Contagem) e F3 (Recorrências e Hábitos)
- Exportados `{ authorized, snapshot }` em `electron/intelligence-investigation.cjs`.
- Criado `electron/intelligence-savings.cjs` (`parseSavingsIntent`, `parseBrlCents`, `recommendSavings` com `overlapGroup` para evitar dupla contagem entre categoria pai/subcategoria/lojista, cenários em centavos inteiros e `targetVerified` honesto, `describeSavings`).
- Criado `electron/intelligence-recurring.cjs` (`parseRecurringIntent`, `detectRecurringCandidates` com varredura read-only 12m, `INSUFFICIENT_MONTHS`, `strong_candidate`/`candidate`, `priceHikes`, `habits` e recusa de cancelamento externo `C36`, `describeRecurring`).
- Atualizados `electron/intelligence-orchestrator.cjs` (`_finishVertical` e precedência de `followup` F1 para `T25` / cortes `%` / consultas de categorias), `src/intelligence-local.ts` (`copilotIntentRequested` preservando `i3Requested`), `src/intelligence-b05-actions.ts` e `tests/m2-slice2-savings-recurring.test.cjs`.

## 3. Fatia 3 (`00b9b4e`) — F4 (Simulador), F5 (Proatividade Cross-Surface) e Contexto de Página
- Corrigido `parseBrlCents` em `electron/intelligence-savings.cjs` para inteiros multi-dígito.
- Criado `electron/intelligence-simulator-copilot.cjs` (`parseSimulatorIntent`, `simulateDecisionForCopilot` usando `PlanningStore.simulatePurchase` quando consentimento `planning` ativo e `quality` em `['unverified','manual','recent']` com fallback em `shared/finance-installment-quote.mjs`, e `describeDecisionSimulation`).
- Criado `electron/intelligence-proactive.cjs` (`scanProactiveInsights`, formato `MF2-PROACTIVE-V1`, máximo 3 insights deduplicados).
- Atualizados `electron/main.cjs` e `electron/preload.cjs` (canal `intelligence:copilot-insights` / `intelligenceCopilotInsights`), `electron/intelligence-ic2-adapter.cjs` (whitelist sanitizada de `pageContext`, preservando rejeição de `accountId`), `electron/intelligence-orchestrator.cjs` (despacho F4 e `followUps` de `pageContext`).
- Atualizados `src/intelligence-local.ts`, `src/intelligence-b05-motion.ts`, `src/intelligence-b05-today.ts` (`MF_COPILOT_INSIGHTS_GRANTS` via `WeakMap`, `mfCopilotInsightsLive`, `intelligenceCopilotInsightsLoad`, faixa `.mf-copilot-proactive` em `Hoje` preservando fallback `B05-20/21`), `app/intelligence.css` e `tests/m2-slice3-simulator-proactive.test.cjs`.

## 4. Fatia 4 (pré-commit final + QA E2E) — PJ-10, Auto-Scroll e Ajustes de Drawer Compacto
- Adicionada jornada E2E `PJ-10` em `scripts/nivel-b-interactive-qa.cjs` cobrindo cards proativos em `Hoje` -> `"Investigar no Copiloto"` -> análise expandida F1 -> cenários F2 anti-dupla-contagem -> recorrências F3 + recusa de cancelamento -> simulador F4 (`1366x768` claro e `1920x1080` escuro) -> drawer compacto em `Orçamentos` -> limpeza imediata pós-revogação.
- Adicionado auto-scroll no encerramento de carregamento em `src/intelligence-local.ts` (`scrollTop = scrollHeight` em `.mf-b05-chat-thread, .mf-ai-drawer-body` quando `localFinancialBusy: false`) e ajuste de quebra de linha / pílula `nowrap` no drawer compacto em `app/intelligence.css` (e recompilação `app/app.js`).

## 5. Invariantes Preservadas
- `approvedForPersonal: () => false`, `financialDataEnabled: false`, `paidApiFallback: false` e zero chamadas pagas externas.
- Rejeição estrita de `accountId` em `electron/intelligence-ic2-adapter.cjs` e preservação do contrato `IC-v1/I-P0.1` (8 cards).
- Aritmética em centavos inteiros (`integer cents`), zero escritas no SQLite a partir do Copiloto e isolamento via `WeakMap` (`MF_COPILOT_INSIGHTS_GRANTS`).
- Próxima etapa: commitar Fatia 4 + documentos, regenerar e verificar proveniência, executar a bateria cumulativa completa após o último commit em `MF_QA_SYNTHETIC=1` e submeter às auditorias independentes `pro` antes do Nível C.
