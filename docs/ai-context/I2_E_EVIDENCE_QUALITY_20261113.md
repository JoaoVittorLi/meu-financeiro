# Meu Financeiro 2.0 — I2-E | Quality Gate de Evidências e Explicabilidade

**Base verificada:** PR Draft #79 `fd5aca036ae96ca3aef99be752a2bfdeb9750688`; PRs #75 `4dc638650671712cbc1290f5814341edc8fea5b2` e #78 `42456554af7311bd85a925fe4633f10e715b6d82` sem alteração.
**Estado:** CODE_DELIVERED / BACKEND_ISOLATED / NOT_HOMOLOGATED / NOT_INTEGRATED / PERSONAL_WRITES_DISABLED.

## Release freeze e propriedade de código

Issue #49 contém `RELEASE FREEZE` do proprietário: integração da candidata #76, D01–D04 + I2-A e I2-B/C, sem novas funcionalidades na release. O proprietário solicitou em conversa posterior continuar a linha I2-E. Esta branch é **experimental, segregada, empilhada sobre #79 e fora da candidata ao EXE**, sem requerer integração nem desviar recursos da RC. Não foi alterado main, db.cjs, main/preload, IPC, renderer, CSS, CircleCI, I2-A/B/C/D ou schema. O Integrador #65/#71 preserva exclusividade de release.

## Código entregue

### `electron/intelligence-category-quality.cjs`

`EvidenceQualityService` cria uma auditoria de qualidade exclusivamente de leitura sobre `ProactiveCategoryAdvisor.scan()` da I2-D. Reutiliza autorização `CategoryProposalService.authorize`, `FinanceDB.bankOverview`, `FinanceDB.listCategories`, `normalizeLabel`, `matchRule` canônico, contexto I2-A e prévias B1 por delegação a I2-D. Não calcula ledger financeiro alternativo nem faz writes.

Critérios conservadores antes de **permitir preparar** uma proposta:

- Duas ou mais classificações **explícitas do tipo override local** com a mesma conta, natureza, descrição normalizada **exata** e categoria de destino; pelo menos **dois dias diferentes** para reduzir repetições correlacionadas. O banco prova a origem de override local, não a identidade humana do autor; rótulos supervisionados no cadastro `category_review_applied_labels` são excluídos.
- Transações elegíveis devem ser POSTED, não transfer/ignore, sem split, split desatualizado, vínculo manual, categoria supervisionada stale ou montante inválido; limites de período e conta continuam os da concessão IC-READ.
- Possíveis duplicatas são identificadas apenas como **hipóteses**, quando account/date/amount/normalized description coincidem com IDs diferentes. Em caso de suspeita, **bloqueia a proposta e exige revisão** — não suprime movimentos nem afirma fraude.
- Simula precedência real de regras futuras com `matchRule` canônico sobre account/nature/rowid e regras atuais em prioridade. Regra concorrente bloqueia a proposta mesmo quando aparentemente compatível, para evitar criar regra redundante ou sombra de precedência.
- Qualquer cobertura parcial declarada por IC-READ ou por `bankOverview.truncated` bloqueia preparo de ações em lote; não extrapola contagens a todo o histórico.
- A recomendação só passa a `eligible_for_preview` quando os critérios mínimos foram atendidos. `qualityConfidence=high` exige pelo menos 3 referências e 3 dias; `medium` exige >=2 e >=2 dias; isso **não** representa probabilidade estatística de acerto.
- Explicação com razões tipadas (`same_day_evidence`, `potential_duplicate_records`, `existing_rule_precedence`, `partial_history`, `no_eligible_candidates`, `bulk_limit_100`, etc.), IDs amostrais, `amountCents`, dias distintos, regras conflitantes e `evidenceHash` verificável.
- `draft(qualityId, action, input, owner)` reconsulta fontes e recalcula hashes antes de delegar a `ProactiveCategoryAdvisor.propose`. Mudança de token, perfil, fonte, conta, mês, evento, regra, evidência ou valor resulta em `stale` / `review_required`; nenhuma ação oculta.
- `compose` aceita no máximo 3 passos `historical|future` com IDs explícitos. Duas ações no mesmo padrão/conta geram `blocked_dependency` para a segunda, exigindo reconstrução da prévia. **Nenhum passo é aplicado ou confirmado**; os recibos continuam exclusivos da I2-C sintética.

### `electron/intelligence-category-quality-bridge.cjs`

`EvidenceQualityBridge({quality,baseBridge})` acrescenta à ponte I2-D os comandos read-only `qualityCapabilities`, `qualityScan`, `qualityDetail`, `qualityDraft` e `qualityCompose` no contrato `I2-E/QUALITY-BRIDGE-V1`, sem registrar IPC. A identidade e a conta ativa precisam vir do contexto confiável do MAIN; outra conta retorna `denied`. Alvos `{categoryId,subcategoryId}` continuam barrados por `taxonomyGate` até implementação SQLite/IPC D05 pela frente #74.

**Separação:** `READ_ONLY_PERSONAL` é o único modo da ponte I2-E. Ela não expõe confirmação, gravação, execução sintética própria, SQL arbitrário, provedor generativo externo, API paga ou acesso a credenciais. A delegação de métodos existentes preserva as proteções B1/C2; qualquer homologação de write pessoal exigirá missão distinta e autorização expressa.

## Testes e QA

**23 testes Node/SQLite novos foram versionados em** `tests/intelligence-i2e.test.cjs` e entram no `npm run test:db` por `tests/*.test.cjs`. Abrangência: duas datas, mesma data, compras duplicadas, strings de estabelecimentos semelhantes, regras `contains` de prioridade, PENDING/transfer/split, referências de outro mês, stale após reclassificação, propostas históricas e futuras por B1, plano composto com/sem colisão, histórico com +2.530 movimentos, troca de escopo/token/owner, conta MAIN, D05 bloqueada e invariantes de centavos e confidencialidade.

**Resultados realmente executados no código I2-E:** verificação de sintaxe via parser V8 **3/3 PASS** e smoke V8 isolado com módulos reais e dublês para FinanceDB/IC-READ **10/10 PASS** (qualificação, centavos, draft, composição, mesma data, duplicatas, parcialidade, matchRule, stale e ausência de mutação). O smoke **não é o Node/SQLite integrado**.

**NOT_RUN no repositório completo:** os 23 testes Node/SQLite, npm ci, test:types, test:db, compile, F08, ASAR, Electronic/Playwright e Windows. O checkout do repositório não foi materializado no runtime terminal (resolução DNS GitHub indisponível); Node local v22.16.0/npm 10.9.2 divergem das versões fixadas 22.23.4/10.9.9. Não declarar PASS de gate oficial.

## Handoff e próximos limites

- **Integrador**: contrato read-only I2-E pode ser analisado como artefato futuro. Não adicionar #79/#I2-E ao PR #76/EXE sem decisão de escopo; não tocar em I2-E durante a fase de freeze.
- **Proprietário**: se e quando liberar o gate desta branch, usar o SHA final do PR Draft e CircleCI `run_preflight=true`, `run_windows_qa=false`, `run_windows_build=false`. Prioridade atual é o preflight do SHA **consolidado do Integrador**, não disparar múltiplas pipelines apenas porque PRs experimentais existem.
- **D05**: taxonomia 14×61 aprovada no DESIGN, persistência E1/E2/E3 ainda não implementada. Nenhuma migração, mudança de FK/ID, reparo massivo ou backfill realizado.
- **Próxima etapa recomendada da IA (após release freeze/gates)**: I2-F integração supervisionada de explicações e métricas de qualidade no D04 em parceria com Integrador; ou auditoria dirigida de falhas reais do CircleCI quando recebidas. Não iniciar um novo PR de feature durante release freeze sem ordem explícita.

**Regra de integridade:** sem escrita pessoal por IA, sem geração de EXE, sem branch de release automática, sem merge main e sem CI pago disparado pelo executor.

## Fechamento para integração RC — revisão dirigida posterior

O PR #80 recebeu correções de segurança sem criar funcionalidades novas: (1) bloqueio, no `EvidenceQualityBridge`, dos métodos legados I2-D `discover/advice/inspectOpportunity/draftOpportunity` quando usados para contornar `qualityScan/qualityDraft` (o fluxo de recomendação precisa passar pelo gate I2-E); (2) bloqueio fail-closed de `draft/compose` baseado em categoria plana ao detectar a tabela oficial D05 `subcategories`, até existir resolvedor canônico `categoryId/subcategoryId`; (3) cinco novos testes de contrato para bypass, owner/conta, stale, plano composto e D05. O módulo não foi ligado ao IPC e não habilita escrita pessoal. Handoff completo: `docs/ai-context/I2_DE_RC_INTEGRATION_HANDOFF_20261113.md`.
