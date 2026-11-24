# Meu Financeiro v1.0.0 — Log Técnico de Homologação Integral Pré-Release

**Data:** 24/11/2026  
**Branch:** `feat/mf3-supervised-copilot-1-0-0-20261119`  
**PR:** `#108` (Draft)  
**Ambiente:** Worktree isolada (`m3-supervised-copilot`), banco e `userData` sintéticos temporários (`MF_QA_SYNTHETIC=1`), zero acesso a dados reais do proprietário.

## 1. Resumo das Correções Consolidadas

### Backend, SQLite, Segurança e IPC (`electron/`)
- `electron/ai-copilot-service.cjs`, `electron/intelligence-savings.cjs`, `electron/intelligence-orchestrator.cjs`, `electron/intelligence-investigation.cjs`: preservação estrita do fluxo sem legado OAuth/I2-A e endurecimento de contexto/economia/investigação.
- `electron/pluggy.cjs`, `electron/copilot-salary-budget.cjs`, `electron/copilot-actions.cjs`, `electron/db.cjs`, `electron/d05-category-service.cjs`, `electron/copilot-session-context.cjs`: validação de contas e `accountId`, tratamento explícito de erros parciais de sync bancário, integridade transacional em SQLite (`monthly_budgets`, revisões e recibos).
- `electron/d05-personal-gate.cjs`: prevenção de conflito case-insensitive no desfazimento (`undo`) de renomeação de categoria via verificação `COLLATE NOCASE`.
- `electron/preload.cjs` (+ `electron/preload-bundled.cjs`), `electron/main.cjs`: exposição limpa dos métodos de orçamento mensal e canais supervisionados sem relaxar gates de governança pessoal (`approvedForPersonal: () => false`, `qa84BankCategoryGateAuthorized = false`).
- `GERAR_EXE_WINDOWS.bat`: ajustes auxiliares no script de empacotamento local.

### Frontend, Fluxos Financeiros e Inteligência (`src/`)
- `src/intelligence-integration.ts` & `src/intelligence-local.ts`: higienização de histórico (`excludeFinancial: true` para remover tokens/valores quando não autorizado), ampliação do classificador de intenções financeiras, cancelamento automático de streaming ativo ao trocar modo ou criar thread, e bloqueio de leitura sem consentimento explícito em modo pessoal.
- `src/intelligence-view.ts` & `src/intelligence-b05-*.ts`: botão explícito de revogação de leitura local no drawer D01, limpeza de concessões expiradas, humanização de labels internos (`CONFIGURADO` -> `Configurado (aguarda 1ª consulta)`) e remoção de kickers técnicos (`INTELLIGENCE ALIVE`).
- `src/copilot-supervised-actions.ts`: rastreamento de `financeRevision` para invalidar rascunhos não aplicados após edições manuais preservando o botão `Desfazer` em recibos aplicados, propagação de `accountId` no Planejamento, invalidação de proposta salarial obsoleta e remoção de tags internas de desenvolvimento (`M3-S*`, `M3-SALARY`).
- `src/plan-view.ts`: exclusão de transferências e itens ignorados nas sugestões e candidatos de vínculo do Planejamento.
- `src/app.ts` & `src/d05-movements.ts`: sincronização bilateral de `setBudget` com `deleteMonthlyBudget`/`setMonthlyBudget`, incremento de `financeRevision` em escritas financeiras, cards de tema interativos em Configurações, sanitização de erros IPC, eliminação de `<h1>` duplicado em Movimentações, revisão em lote (`Marcar revisadas`), banner de duplicatas suspeitas e ocultação do FAB na tela de Inteligência.

### CSS & Responsividade (`app/`)
- `app/premium-interactions.css`, `app/decisions.css`, `app/refinement.css`, `app/intelligence-b05.css`, `app/intelligence.css`: remoção de flicker (`opacity: 0`) em resumo/anéis de Orçamentos, estilos de botões secundários/desabilitados, acomodação do CTA `Analisar compra` acima da dobra em `1366×768`, fluxo único de scroll no painel salarial M3, suporte ao contraste claro/escuro e `prefers-reduced-motion`.

## 2. Cobertura Automatizada Adicionada
- `tests/m3-homologation-regressions.test.cjs`: testes unitários e SQLite para regressões de histórico/privacidade, consentimento local, `financeRevision`, sugestões no Planejamento e `undo` case-insensitive.
- `scripts/nivel-b-full-homologation.cjs`: varredura E2E no Electron real em `1366×768`, `1440×900`, `1484×901` e `1920×1080` (claro e escuro), cobrindo todas as 8 telas, CRUD em Movimentações + persistência pós-reinício, Orçamentos + `monthly_budgets`, Simulador acima da dobra, Configurações + temas, chat Inteligência + M3 budget edit/undo, drawer D01 e isolamento Demonstração/Pessoal.

## 3. Gate Final Pré-Release e Limites Conhecidos
- Os resultados oficiais de Nível A (`test:types`, `compile`, `build-preload`, `renderer-provenance`, `test:db`, `test:asar`, `provenance`) e Nível B (smoke + matriz visual + jornadas interativas + homologação integral) são vinculados exclusivamente ao **SHA congelado** da branch.
- **Itens declarados `NOT_RUN`:** Codex CLI (`CD-03/CD-04`), Nível C (build/instalador NSIS em Windows), fluxo OAuth vivo em produção e sincronização real Pluggy.
