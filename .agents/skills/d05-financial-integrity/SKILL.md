---
name: d05-financial-integrity
description: D05 taxonomy (14x61x67 SVGs), CAT-P0/CAT-UX 01-06, and Copilot Financial Intelligence verification skill.
---

# Skill — Integridade D05, CAT-P0 & Inteligência Financeira

## Quando ativar
Ao alterar taxonomia D05, categorização automática (`D05AutoCategorization`, `cat02-classifier.cjs`), fluxos `CAT-UX 01–06`, orçamentos/planejamento integrados ou capacidades do Copiloto Financeiro (`F1–F5`, `I3-00`, `IC2`, `B05`).

## Verificações obrigatórias
1. **D05 Visual & Taxonomia:** preservar 14 categorias pai, 61 subcategorias e 67 SVGs em `electron/d05-taxonomy.json` e `shared/d05-svg-registry.json`, com contraste WCAG AA claro/escuro e sem emojis improvisados no lugar de SVGs D05.
2. **CAT-P0 & Calibração:** executar `tests/cat-p0-calibration.test.cjs`, `tests/cat-p0-ipc-contract.test.cjs`, `tests/cat-p0-recurring-stress.test.cjs` (>20k candidatos paginados), `tests/d05-auto-categorization.test.cjs` e `tests/d05-auto-reconciled.integration.test.cjs`.
3. **Separação do Copiloto (M2+):** garantir 3 camadas separadas (intenção/contexto -> ferramentas determinísticas no `shared/finance-period-ledger.mjs` -> apresentação estruturada sem HTML/JS arbitrário), com `dataVersion`, `grant` e estado explícito de cobertura parcial.
4. **Bloqueio de escrita pessoal:** confirmar `approvedForPersonal() === false` salvo autorização explícita e separada do proprietário.
