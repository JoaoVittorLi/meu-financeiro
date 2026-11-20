# Log de Implementação — Marco 2: Inteligência Financeira 3.0 (Copiloto Financeiro)

- **Branch:** `feat/mf2-intelligence-3-0-copilot-20261118`
- **Worktree isolada:** `C:\Dev\meu-financeiro-worktrees\m2-copilot`
- **Base:** `ffc70f2b61e247bda7b00bbfb72dbbc95650cb7d` (`M1.1` / PR #105)
- **Status:** Implementação F1–F5 consolidada no commit funcional auditado `e3c153cb00b3bc9c5bc4f7e8e53f296ba98214a6` (`0.9.5-beta.9` experimental); aprovado por ambas as auditorias `pro` (Visual e Forense/Financeira) e homologado em Nível C no instalador NSIS isolado (`15/15` PASS, `VEREDITO: GO` pós-Nível C). **Não bloqueante para a promoção da v1.0.0 (`V1_STABLE_RELEASE_PENDING` em `release/v1.0.0-rc.1-candidate-20261119` @ `1a22181e`).**

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

## 6. Homologação Técnica Experimental — Commit Auditado `e3c153cb00b3bc9c5bc4f7e8e53f296ba98214a6`
- **Bateria cumulativa pré-NSIS em `e3c153c`:** `test:types` PASS, `compile` PASS, `build-preload check` PASS, `check-bundle` PASS, `test:asar` (`1/1`), `mobile-push` (`133/133`), `test:electron-smoke` PASS, `nivel-b-interactive-qa.cjs` (`15/15` incluindo `PJ-10`, `FAIL: 0`, `RuntimeIssues: 0`), `test:db` (`1013/1013` PASS, `0` skipped) e `provenance:verify` (`23` arquivos).
- **Re-auditorias independentes `pro` em `e3c153c`:**
  - **Visual & Design (`ec88d31d-4866-4b62-a76a-7f8c097ede19`):** `VEREDITO: APPROVE` (validados os 7 PNGs pós-correção `pj10-*`, conformidade `M2-GUIDE-V1`, datas `DD/MM/YYYY`, glifos fallback D05 e composer visível em `1366x768`).
  - **Financeira & Adversarial Forense (`bd91a757-e6b0-477e-b0a3-4b14dc9ee22f`):** `VEREDITO: APPROVE` (`provenance:verify`, `test:types`, `build-preload check`, `50/50` M2/I3-01, `166/166` suítes de inteligência e probes adversariais em memória PASS).
- **Build NSIS Experimental & Nível C Isolado (`e3c153c`):**
  - Artefato: `C:\Dev\releases\M2-COPILOT-RC\MeuFinanceiro-Instalador-0.9.5-beta.9-x64.exe` (`115.758.882` bytes, `SHA-256`: `f94e1b16d0f52882f0b885d0929019a49d19f88d8f8ca8ad12a1ac3367b37159`), com `SHA256.txt`, `renderer-provenance.json` (`sourceCommit: e3c153c`, `verify-asar` PASS no binário instalado) e `report-nivel-c.json`.
  - Instalação silenciosa e perfil sintético isolados em `C:\Dev\mf-nsis-m2-install` e `C:\Dev\mf-nsis-m2-userdata`: **`15/15` jornadas PASS**, `FAIL: 0`, `RuntimeIssues: 0`, `dbSummary: { integrity: "ok", integerCentsOnly: true }`, `HOST_FOLDERS_UNTOUCHED: true`.
  - **Parecer pós-Nível C (`bd91a757`, `pro`):** `VEREDITO: GO`.

## 7. Inventário Honesto F1–F5 (Completo / Parcial / Pendente)
| Capacidade | Estado | Implementado e Conectado na UI | Lacunas / Limites Explicitados |
| --- | --- | --- | --- |
| **Linguagem Permanente & Design Adaptativo (`M2-GUIDE-V1`)** | **Completo (local)** | `docs/intelligence/COPILOT_PERMANENT_GUIDE.md`, `shared/copilot-language.cjs`, cards adaptativos `standard`/`compact`/`mobile` em `Conversar`, `Hoje` e drawer lateral, separação epistêmica sem jargão interno. | Copy e formatação exclusivamente determinísticos/locais (`financialDataEnabled: false`). |
| **F1 — Detetive Financeiro** | **Completo (read-only)** | `electron/intelligence-investigation.cjs`, `focusIncome`, comparação justa de mês em andamento, drill-down por categoria/estabelecimento, evidências verificadas e follow-ups contextuais. | Depende de grants locais por sessão (`WeakMap`); sem inferência por modelo pago externo. |
| **F2 — Consultor de Economia** | **Parcial** | `electron/intelligence-savings.cjs` (`recommendSavings` com `overlapGroup` anti-dupla-contagem, metas em BRL parseadas sem truncar decimais, `targetVerified` honesto sob leitura parcial). | Sugestões não aplicam nem editam limites no SQLite automaticamente (escrita pessoal bloqueada por `approvedForPersonal: () => false` / Marco 5). |
| **F3 — Recorrências e Hábitos** | **Parcial** | `electron/intelligence-recurring.cjs` (detecção read-only em janela de até 12 meses, candidatos fortes/moderados, variação de preço, hábitos, `INSUFFICIENT_MONTHS` e recusa de cancelamento externo `C36`). | Não executa cancelamentos/contestações externas nem gera alertas push recorrentes integrados a M3/M4. |
| **F4 — Simulador de Decisões** | **Completo (simulação read-only)** | `electron/intelligence-simulator-copilot.cjs` (validação `1..60` parcelas e `0..30%` juros sem coerção silenciosa, soma integral de compromissos confirmados, datas `DD/MM/YYYY`, delegação ao `PlanningStore` quando consentido + fallback, botão compacto `"Abrir Simular Compra"`). | Não grava automaticamente a compra no Planejamento a partir do chat (bloqueado por Marco 5). |
| **F5 — Radar Proativo & Contexto de Página** | **Parcial** | `electron/intelligence-proactive.cjs` (`MF2-PROACTIVE-V1`, até 3 sinais deduplicados em `Hoje`), canal IPC `intelligence:copilot-insights` com `WeakMap` e checagem estrita de chaves, drawer compacto com `pageContext`/`pageContext.category` e limpeza pós-revogação. | Baseado em heurísticas determinísticas locais sobre o ledger 1–12m; sem geração por LLM na nuvem, sem envio PWA `mobile-push` (M4) e sem ações assistidas (M5). |
