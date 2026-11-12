# Registro de frentes ativas e prevenção de conflitos

## Q1 — homologação integrada autorizada em 12/11/2026

**Entrega publicada no Draft #48:** código9e4b1a8,506 testes PASS, QA nativo/evidências e planos concluídos. [Handoff](Q1_WINDOWS_CANDIDATE.md). Sem trabalho concorrente pendente nesta sessão; build e escrita pessoal aguardam decisão específica do proprietário.

Codex: `qa/mf2-q1-integrated-windows-20261112`, base #47 `d52df2adcef6d105dc92480714639dece7448985`, já contém #46. Checkout isolado `mf2-q1-windows-qa`. Ownership exclusivo nesta sessão: Central/estilos próprios, correções localizadas de marca e semântica do simulador, gate sintético de backup, main e ferramentas/testes Q1. Sem subagentes. Instalação U3 e SQLite pessoal preservados. [Log](logs/2026-11-12-Q1-INTEGRATED-QA.md). Não executar CircleCI pago/instalador/merge.

## Execução autorizada — 12/11/2026: categorização supervisionada

Refinamento separado: `fix/mf2-review-layout-navigation-20261112`, empilhado sobre #46/a7f132a. Ownership local de `src/app.ts` (rolagem de navegação), marcação do formulário em `src/intelligence-local.ts`, abertura da Central em `src/intelligence-review.ts`, `app/intelligence.css`, bundle e regressão. Fluxos/sender/SQLite do PR funcional preservados. [QA real](logs/2026-11-12-VISUAL-REVIEW-POLISH.md).

Codex nesta missão: branch `feat/mf2-supervised-categorization-20261112`, base candidata `34750c9`. Ownership: `electron/category-review.cjs`, extensões localizadas de `db.cjs`/main/preload, `src/intelligence-review.ts`, hooks da Inteligência, CSS próprio, fixture e testes. Sem edição concorrente por subagentes. Não atualizar CURRENT_STATE nem promover candidata/main. Próxima frente em branch separada: formulário de leitura e rolagem de navegação, defeitos observados por Computer Use. [Log](logs/2026-11-12-SUPERVISED-CATEGORIES.md).

Última leitura via GitHub: 09/11/2026. **Work em execução não é inspecionável aqui**; itens marcados como "desconhecido" devem ser reconciliados com a sessão antes de qualquer escrita.

**Atualização técnica — 10/11/2026:** Executor PR #28 agora possui quatro regressões reais adicionais de identidade bancária (lotes com duplicados, contas duplicadas, vínculo indevido entre conexões e ID compartilhado entre contas distintas). **7/7 PASS** com Node 22.16.0 e SQLite real extraído do ASAR beta.7 + código D1.2 exato, sem CI/GUI novo. Staging `feat/mf2-beta8-premium-staging-20261110` SHA `HEAD da branch (consultar GitHub; staging ainda não homologado)`: **somente os dois CSS do Argon** somados à D1.2 de código, sem versão/beta.8, CI ou merge. PR #27 CSS-only continua fonte; PR #26 segue sob ownership do Arquiteto; A-D3 não publicada nesta verificação. Priorizar testes de regressão e smoke real antes de qualquer promoção.

## Checkpoint candidato para execução CircleCI — 10/11/2026

**Executor PR #31 (draft)**: `feat/mf2-beta8-premium-staging-20261110`, candidata `0.9.5-beta.8` com D1.2 funcional do PR #28 e **CSS A-D1/A-D2/A-D3/A-D4** dos PRs #23/#25/#29/#30. Argon continua dono de `app/overview.css`, `app/operations.css`, `app/decisions.css`; staging usa os blobs publicados sem reescrever o trabalho visual. **PR #26 do Arquiteto não deve ser mesclado em duplicidade**; PRs #19 e #22 recuperáveis e intocados. Beta.8 **sem CI, sem EXE**, 8/8 testes SQLite locais direcionados e 3/3 checagens de contrato CSS com dados simulados; smoke nativo Electron precisa da única pipeline Windows com Linux prévio. Worker/PWA sem novas funções e sem deploy.

## Checkpoint atual — Desktop First, 10/11/2026 (prevalece sobre o histórico abaixo)

| Frente | Branch / PR | Situação comprovada | Arquivos sob ownership / conflito |
| --- | --- | --- | --- |
| D0 beta.6 | `fix/mf2-c11-reproducible-build-20261110` / PR #19 | Linux/Windows SUCCESS, 2 EXEs íntegros; sem smoke Windows | Base de recuperação congelada |
| D1.1 beta.7 | `feat/mf2-desktop-first-20261110` / PR #22 · SHA `8734a34d` | Linux/Windows SUCCESS, 2 EXEs e hashes verificados; instalação NÃO homologada | Base funcional congelada da D1.2 |
| D1.2 funcional | `feat/mf2-d1-2-functional-tests-20261110` / PR #28 | Correção de orçamento zero; único single-instance lock; perfil de teste e smoke Electron versionados; CI D1.2 pendente | `electron/db.cjs`, `electron/main.cjs`, `electron/smoke-profile.cjs`, `scripts/d1-electron-smoke.cjs`, testes e CI Windows (sem CSS) |
| A-D1 / A-D2 Premium | PR #23 e PR #25; candidata CSS-only PR #27 | Só `overview.css` + `operations.css` com blobs idênticos; não integrado, Electron visual pendente | Argon dono do CSS; D1.2 NÃO alterar CSS |
| A-D3 | Branch/PR ainda não verificados nesta rodada | Alterará `app/operations.css`; deve herdar integralmente A-D2, sem substituição regressiva | Argon dono de `app/operations.css` |
| Cloudflare/PWA | Branches separadas | Congeladas para Desktop First (sem deploy/migração/cutover nesta frente) | `mobile-push/**`, `electron/cloud-*`, segredos/dados reais fora de escopo |

**Workflow futuro:** não rodar CI a cada commit. Quando D1.2 for candidata funcional (prevista beta.8), uma única pipeline `run_preflight=false`/`run_windows_build=true`, que exige preflight Linux seguido de teste Electron real e build Windows; não declarar homologação antes do smoke real.

## Matriz de coordenação (histórico anterior)

| Frente | Quem/onde | Branch / PR | Estado conhecido | Área protegida |
| --- | --- | --- | --- | --- |
| Redesign U1–U3 | Work/chat anterior | design/despezzas-d1-d4 / #16 | Publicado na branch; Windows não homologado | src/app.ts, app/*css, src/plan-view.ts, tests U1–U3 |
| Cloud/sync | PRs empilhados | safety/cloud-migration-preflight-20261107 / #1, mais integração #6 | Implementação em Preview; E1 ainda não homologada | electron/cloud-*, mobile-push/src/finance-*, shared/finance-* |
| Inteligência | PRs #2/#3/#7/#8 e empilhados | Atravessa a linha da PR #16 | Contratos de demonstração; novos trabalhos de Work **desconhecidos** | src/intelligence-*, electron/ai-*, shared/ai-* |
| Homologação Windows | CircleCI/Work | PR #15 / #16 | #15 verde; #16 sem job CircleCI comprovado | .circleci/*, scripts/renderer-provenance.cjs |
| Documentação de continuidade | Chat arquiteto | docs/mf2-multi-agent-context-20261109 / #17 | PR draft documental; roadmap ampliado, requer revisão e integração | docs/ROADMAP_MF2.md e docs/ai-context/** |
| Work "Meu Financeiro - Definitivo" | Outra sessão ativa | **Branch, commit local e alterações não publicadas desconhecidos** | Consultar checkpoint do Work; não assumir U4 ou operadores 21 ações publicados | **Nenhum arquivo é seguro para edição concorrente até verificar** |

## Linha de PRs existente (não achatar às cegas)

- #1 safety/cloud-migration-preflight-20261107 → base main.
- #2 feat/inteligencia-interface-e1 → base main, protótipo separado.
- #3 feat/inteligencia-e2-chatgpt-shared → base #1.
- #4 ci/circleci-windows-manual → base main.
- #5 ci/circleci-inteligencia-e1-e2 → base #3.
- #6 integration/v0.9.5-beta.1-inteligencia-circleci → base #1.
- #7 feat/inteligencia-e3-contexto-memoria-uso → base #6.
- #8 feat/inteligencia-e4-contexto-financeiro-sintetico → base #7.
- #9 fix/category-overlay-b00-b01 → base #8.
- #10 feat/transaction-category-edit-b02 → base #9.
- #11 feat/ui-daily-redesign-b07 → base #10.
- #12 fix/ui03-audit-f01-f07 → base #11.
- #13 fix/ui03-provenance-f08 → base #12.
- #14 fix/ui03-visual-smoke-f05-f06 → base #13.
- #15 fix/asar-windows-nested-paths → base #14.
- #16 design/despezzas-d1-d4 → base #15.

PRs representam uma **pilha de dependências**. Marcar como merged somente após consultar o GitHub. Evitar cherry-picks redundantes que duplicariam commits ou funcionalidades.

## Rodada de análise em curso

O roadmap agora explicita **Rodada A antes de Rodada B**. O próximo novo Work deve entregar diagnóstico e ideias documentadas, não iniciar reescrita de funcionalidades. O PR #17 guarda contexto e propostas; não colidir com a branch de código. Caso a sessão Work anterior esteja avançando, primeiro coletar o checkpoint e preservar suas mudanças.

**Atualização por agente:** toda alteração posterior precisa registrar progresso no ROADMAP_MF2.md da própria branch e log técnico. Para análise: registrar no roadmap como ANALISADO/PROPOSTO sem mudar execução. Integração global fica com o integrador.

## Protocolo de posse de trabalho

Antes de iniciar, agente registra no PR ou log:
- identificador da entrega; branch; base SHA; arquivos previstos; dependências; quem integra; status.
- disponibilidade de outro agente para alterar os mesmos arquivos; caso desconhecida, **não realizar escrita concorrente**.
- em caso de mesmo arquivo, combinar divisão por fases ou uma branch de integração sequencial.

Um único integrador é responsável por CURRENT_STATE e atualizações dos gates. As demais frentes apenas registram logs próprios e links para seus PRs. A documentação foi aberta em branch separada para não tocar no Work.

## Próximo checkpoint a pedir ao Work ativo

Perguntar sem alterar nada: tarefa atual; branch e SHA; alterações locais não commitadas; U4 e IA realmente implementadas; últimos testes executados; riscos; arquivos em uso; próxima ação. Publicar código e logs em PR apropriado **somente após o agente concluir sua execução em andamento**, sem interrompê-la.


## 09/11/2026 — frente de consolidação candidata

- **Branch criada:** `integration/mf2-baseline-candidate-20261109`, derivada do HEAD do PR #17 (`b3a53ea`) para oferecer ponto único **candidato** com código histórico U1–U3 e documentação da Rodada A.
- **Sem merge de PRs:** #1–#17 permanecem rastreáveis; `main` continua 0.9.4; nenhum gate foi aprovado.
- **Ownership desta frente:** documentação de plano de branches e pesquisa de mercado; não modificar código do Work em andamento.
- **Estado de análise:** consultar BRANCH_CONSOLIDATION_PLAN.md e MARKET_FEATURES_DEEP_DIVE.md nesta branch.
- **Próximo integrador:** verificar alterações locais do Work e PR17 mais novo; se moverem, comparar/reconciliar antes de usar a branch candidata para execução. Só marcar G0 após testes/homologação.

## WORK-AUDIT-01 — hotfix dirigido, 11/11/2026

Branch fix/mf2-ai-summary-splits-20261112 sobre ce8dd04. Ownership: intelligence-integration.ts, gerador de bundle compartilhado, proveniência, testes e log/roadmap. PR #41 e componentes staging intocados. Integrador deve reconciliar bundle/documentação e atualizar o probe do #41 após integrar. Sem alterações em CURRENT_STATE ou gates globais.

## Work staging autorizado — 11/11/2026

Branch `feat/mf2-work-intelligence-staging-20261112`, base PR #39 `ce8dd04`. Ownership desta proposta: novos `src/intelligence-staging.ts`, `app/intelligence-staging.css`, scripts/testes Work; hooks mínimos em `src/intelligence-view.ts`, `app/index.html`, `tsconfig.json` e bundle gerado. Reconciliar alterações de outros executores nesses quatro arquivos antes de integrar. Nenhuma edição da branch #39, CURRENT_STATE, motores, Electron main/preload ou PWA. Checkpoint e evidências no [handoff Work](reviews/2026-11-11-WORK-CHECKPOINT.md).

## Candidata #42 + #41 — 12/11/2026

Branch integration/mf2-ai-summary-staging-20261112. Ownership limitado à candidata: resolução dos três conflitos, probe compatível, regressão e documentação/evidências. #39/#41/#42 preservados. Produto novo não desenvolvido. CURRENT_STATE e gates globais não promovidos; integração definitiva depende de revisão e QA gráfico autorizado.
