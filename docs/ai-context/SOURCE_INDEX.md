# Índice das fontes originais (evitar duplicações)

O material abaixo é preexistente na branch design/despezzas-d1-d4 e preserva detalhes que os resumos de ai-context **não substituem**. Conferir sempre o SHA antes de tratar um documento como atualizado.

## U1–U3 e design
- docs/DESIGN_D1.md, DESIGN_D2.md, DESIGN_D3.md, DESIGN_D4.md — fundações visuais, temas, Inteligência e PWA inicial.
- docs/DESIGN_REFINEMENT_R1.md, DESIGN_REFINEMENT_R2.md — refinamentos posteriores.
- docs/DESIGN_U1_OVERVIEW.md — novo painel desktop, indicadores, comparação temporal, cobertura.
- docs/DESIGN_U2_OPERATIONS.md — Movimentações e Planejamento, fontes, calendário, estados e revisão.
- docs/DESIGN_U3_DECISIONS.md — Orçamentos, Contas, Simulador A/B; 222/129/1 testes relatados; EXE pendente.
- docs/UI_03_DAILY_REDESIGN.md, UI03_STABILIZATION_F01_F07.md, UI03_F08_SOURCE_PROVENANCE.md, UI03_CHROME_VISUAL_SMOKE_BETA6.md — auditoria UX, fixes, proveniência, visual smoke.
- docs/ASAR_WINDOWS_PATH_HOTFIX.md — Windows ASAR hotfix na PR #15.

## Integrações e cloud
- E1_CONCILIATION_REPORT.md — auditoria staging/SQLite e bloqueios de cutover, 630→632.
- mobile-push/PARITY_AND_UNIFIED_RELEASE.md — matriz histórica de diferenças desktop/PWA e política release conjunto.
- mobile-push/CLOUD_MIGRATION_PLAN.md, FINANCE_MIGRATION_DRY_RUN.md, ONE_CLICK_CLOUD_MIGRATION.md — procedimentos, **não autorização para executar**.
- mobile-push/ACCESS_SETUP.md, CLOUD_BANK_AND_SYNC.md — autenticação e fonte bancária.
- INTELLIGENCE_PARALLEL_INTEGRATION.md — fronteiras entre integração Cloudflare e IA.

## Inteligência
- docs/INTEGRATION_V095_INTELLIGENCE.md
- docs/INTELLIGENCE_DELIVERY_2.md
- docs/INTELLIGENCE_DELIVERY_3.md
- docs/INTELLIGENCE_DELIVERY_4_1.md
- shared/ai-policy.mjs — capacidades **reais declaradas no código**, incl. demonstração e desativação de dados reais.

## Build e releases
- .circleci/config.yml e .circleci/build-windows.ps1 — fonte executável do pipeline.
- docs/CIRCLECI_WINDOWS_MANUAL.md — instruções históricas para branch beta.1; **substituir branch pela revisão candidata real**, não seguir cegamente beta.1.
- scripts/renderer-provenance.cjs — checagem source→bundle→ASAR.
- package.json e mobile-push/package.json — versões correntes no SHA escolhido.
- README.md e LEIA_PRIMEIRO.md — guias históricos 0.9.4, potencialmente desatualizados.
- https://github.com/JoaoVittorLi/meu-financeiro/pulls — verificar PRs e branches.
- https://github.com/JoaoVittorLi/meu-financeiro/releases — versões efetivamente lançadas.

## Suíte de testes existente
- tests/overview-u1.test.cjs, operations-u2.test.cjs, decisions-u3.test.cjs
- tests/renderer-provenance.test.cjs, renderer-asar.integration.cjs, ui03-*.test.cjs
- tests/cloud-*.test.cjs, e1-*.test.cjs, ai-*.test.cjs
- mobile-push/test/*.test.js

Os arquivos listados podem evoluir. O índice é um mapa de navegação, não uma afirmação de completude ou execução dos testes.

## Documentação estratégica ampliada (PR #17)

- docs/ROADMAP_MF2.md — roadmap detalhado, duas rodadas e tabela de progresso a atualizar por PR.
- docs/ai-context/PRODUCT_BLUEPRINT.md — jornadas, referências e UX por área, propostas iniciais.
- docs/ai-context/ANALYSIS_PLAYBOOK.md — roteiro da primeira rodada criativa e diagnóstica.
- docs/ai-context/IDEA_REGISTER.md — hipóteses/propostas ainda não aprovadas.
- docs/ai-context/ROADMAP_UPDATE_RULES.md — atualização obrigatória contínua.
- docs/ai-context/reviews/ — análises datadas.

## Enforcements e templates Markdown

- AGENTS.md — ponto de entrada reconhecível no root do repositório para agentes de programação.
- .github/pull_request_template.md — checklist documental de PR para roadmap+log e distinção de evidências.
- docs/ai-context/templates/DELIVERY_LOG_TEMPLATE.md — log de implementação.
- docs/ai-context/templates/ANALYSIS_REPORT_TEMPLATE.md — estrutura de review de Rodada A.
