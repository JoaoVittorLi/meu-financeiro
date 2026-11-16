# RC-ALL-FULL — Hotfix dirigido das 10 falhas em 798 testes

Data: 2026-11-14 · **Fonte:** relatório de FAIL do proprietário para o SHA `61e2829c2e8a583df17cc52d9abf8c4e299595b1`.  
**PR único:** [#76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), branch `integration/mf2-rc-all-01-i2a-20261113`.  
**Estado:** correções de código versionadas, **testes Node oficiais no novo SHA NÃO executados**, **NO-GO EXE**.

## Mapa de causas-raiz e correções

| # | Falha reportada | Causa-raiz concreta encontrada | Correção efetiva | Regressões preservadas ou reforçadas |
|---|---|---|---|---|
| 1 | `category-review-ui.test.cjs` preview `null.id` após alternar chat/painel | `categoryReviewOpen` sempre chamava `categoryReviewRefresh`, que invalida a prévia pendente do MESMO grant mesmo sem mudança de contexto | `src/intelligence-review.ts`: reabrir a central só atualiza quando relatório/fila faltam ou filtros mudaram; refresh explícito e mudanças de filtro continuam invalidando prévias | Teste existente `main and drawer chat reuse the same pending operation...`, além de revogação/stale em suite R3 |
| 2 | I2-C categoria em uso, esperado `applied`, resultado `unavailable` | Depois de `BEGIN IMMEDIATE` do executor, `SyntheticCategoryExecutor.apply` chama `FinanceDB.save` sem `inTransaction`, que rejeita `Transação inesperada` | `electron/intelligence-category-actions.cjs`: `save('demo',...,{inTransaction:true})`; o executor externo mantém um único COMMIT/recibo e rollback | `tests/intelligence-i2c.test.cjs`, categoria em uso e prévia stale após efetiva categorização |
| 3 | I2-C save manual/recibo `unavailable` | Mesma transação aninhada inválida da falha 2 | Mesma correção do fluxo canônico, sem alterar valores | Teste manual reforçado: 7500 centavos, 1 recibo, reconsulta `applied`, replay idempotente e `integrity=['ok']` |
| 4 | I2-D categoria customizada sem uso não aparece | A lista `unused` é limitada a 12; catálogo inicia por categorias built-in e pode ocultar customizadas mesmo sem qualquer referência | `electron/intelligence-category-opportunities.cjs`: ordenar customizadas antes das built-in, preservando `review_only`, `canDeleteAutomatically:false` e contagem total | `tests/intelligence-i2d.test.cjs` com `Sem Uso Teste`; nunca permitir exclusão automática |
| 5 | I2-E qualidade retorna `ready` para conta/período vazio | `EvidenceQualityService.analysis` propagava `scan.status=ready` mesmo quando `scan.visibleRows===0` na conta/mês autorizados | `electron/intelligence-category-quality.cjs`: ausência de observações bancárias retorna `empty` com `quality:[]` e `changesApplied:false` | `tests/intelligence-i2e.test.cjs`: teste negativo original mais novo teste explícito de `empty` e leitura exclusiva |
| 6 | R2 `mfVisualRequested is not defined` e `resolve is not a function` | Harness da UI premium compilava D03/V3, mas omitia `intelligence-visuals.ts`, origem de `mfVisualRequested`, abortando antes de chamar a Promise mockada | `tests/intelligence-premium-ui.test.cjs`: inclui o **módulo real** de visuais no bundle `module:none` do harness, sem export fictício e sem criar flag sem significado | R2 chat autorizado, período/ações e resposta tardia; bundle oficial já contém módulo original via tsconfig |
| 7 | PR RC I2-B prévia pessoal retorna `mayExecuteSynthetic:true` | `CategoryProposalService.preview` usava `:memory:` como indício de candidato sintético; o bridge pessoal transmitia essa capacidade mesmo **sem executor MAIN de escrita** | `electron/intelligence-category-bridge.cjs`: `decoratePreview` elimina sinalização sintética do fluxo pessoal e libera `synthetic_hardened` apenas quando há executor sintético real + host sintético | `tests/rc-all-01-categories.test.cjs`: `mayExecuteSynthetic === undefined` para pessoal, confirmação negada |
| 8 | RC I2-C preview manual `unavailable` | Mesmo erro de `FinanceDB.save` com transação externa das falhas 2–3 | Correção da falha 2; ledger pessoal permanece intocado | `tests/rc-all-01-categories.test.cjs`: transação demo inventada e confirmada exclusivamente no vault TEMP |
| 9 | RC FULL I2-E `Comando pessoal inválido` ao investigar `draftOpportunity` | `PERSONAL_FIELDS` não aceitava `opportunityId` antes de chegar ao gate; legado proativo deve ser **negado**, não lançar exceção de shape | `electron/intelligence-category-rc.cjs`: reconhece `opportunityId` como campo inerte de pedido; método `draftOpportunity` continua fora de `PERSONAL`, retornando `status:'denied'` sem executar I2-D | `tests/rc-all-full-d05-i2de.test.cjs` mantém afirmação de negação e ausência de bypass |
| 10 | D05 migração `índice/trigger legado requer revisão: category_rules` | Simulação real `ALTER TABLE categories RENAME TO categories_old` deixa **várias** FKs fantasma, inclusive em `subcategories`, e triggers **gerados pelo D05** reescritos pelo SQLite | `electron/d05-hierarchy.cjs`: inclui `subcategories` na reparação transacional; identifica triggers canônicos `d05_<table>_<insert/update>_relationship` e os **recria do código oficial**, sem copiar SQL antigo. Preserva regras/índices/demais triggers, verifica `foreign_key_check`, `integrity_check` e ausência de `categories_old` em `sqlite_master` antes de COMMIT. Qualquer trigger usuário desconhecido ou FK irrecuperável continua **fail-closed + ROLLBACK**; `foreign_keys=ON` restaura até em lock de `BEGIN` | `tests/reliability.test.cjs` original reforçado: categoria/regra/2200 centavos/61 filhos/triggers íntegros; `tests/d05-e1-hierarchy.test.cjs` expandida para 10 casos incluindo 630 lançamentos, colisão, rollback, lock e trigger usuário com referência fantasma recusado |

## Limites e segurança preservada

- Nenhuma gravação pessoal financeira da IA foi habilitada: `approvedForPersonal:()=>false` continua no MAIN. `qualityDraft` e `qualityCompose` pessoais seguem exigindo alvo D05 `categoryId` + `subcategoryId` explícitos; autorizações fictícias ou oportunidades não revisadas continuam negadas.
- Não modificar 14 pais/61 filhos, 67 SVGs, modelos D01–D05 ou a classificação original de valores. A correção de I2-C preserva transação manual e recibo no mesmo `BEGIN IMMEDIATE/COMMIT`, sem segundo COMMIT.
- Migração FK usa `PRAGMA foreign_keys=OFF` **somente durante reconstrução síncrona e transacional** e exige `PRAGMA foreign_key_check` e `integrity_check` antes de concluir. Em erro, rollback + restabelecimento ON; nenhum `categories_old` artificial.
- Deixar #74 aberta até homologação e PR Draft. Sem alterações em `main`, produção, dados pessoais do proprietário, pipelines, API paga ou rede externa.

## Evidências efetivamente obtidas

| Prova | Estado |
|---|---|
| Leitura e confirmação do HEAD, origem exata dos símbolos, funções e contratos via GitHub | **VERIFIED** |
| Sintaxe JS de 13 arquivos CJS de runtime/testes afetados, usando `new Function` V8 | **PASS somente parser** |
| Execução isolada das funções reais `decoratePreview` e `ensureRelationshipTriggers` extraídas do GitHub com mocks controlados | **PASS pontual**: pessoal não anuncia escrita sintética; sintético validado anuncia; 2 triggers stale regenerados |
| `FinanceDB.save('demo',...,{inTransaction:true})` na rotina real I2-C | **VERIFIED_SOURCE**, não executado no SQLite oficial |
| Novas/expandidas regressões nas suítes R3, I2-B/C/D/E, reliability e D05 | **VERSIONED, NOT_RUN** |
| `npm ci` Node 22.23.4, `npm run test:types`, `npm run test:db`, `npm run compile`, proveniência/F08 e `npm run test:asar` | **NOT_RUN no novo SHA** |
| 1366x768/1920x1080 Electron Windows claro/escuro, backup/restore completo, EXE | **NOT_RUN / NÃO AUTORIZADO** |
| Novo workflow CircleCI Linux | **PENDENTE do proprietário** |

A execução anterior teve **798 testes / 10 FAIL** segundo relatório do proprietário; esses resultados não podem ser reclassificados como PASS sem executar novamente. No próximo SHA existe pelo menos um caso adicional (`qualityScan` sem registros), sem previsão de total exato até a execução.

## Como repetir o preflight Linux — apenas proprietário

Selecionar branch `integration/mf2-rc-all-01-i2a-20261113` e o **HEAD novo final do PR #76**, conferindo SHA diretamente no GitHub.

```yaml
run_preflight: true
run_windows_qa: false
run_windows_build: false
```

Conferir `CIRCLE_SHA1`; devolver job/pipeline URL, totais PASS/FAIL e primeiro stack trace completo em caso de falha. **HOTFIX NOT OFFICIALLY VERIFIED / LINUX PENDING / NO-GO EXE.**
