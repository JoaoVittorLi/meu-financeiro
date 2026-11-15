# RC-ALL-FULL — P0.4 / quatro falhas de transação I2-B e migração D05

Data local: 14/11/2026. **PR:** [#76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), branch `integration/mf2-rc-all-01-i2a-20261113`.  
**SHA de partida (com falhas reportadas):** `10baa5272a8bb452dc379106d143e5eae8f1b7e8`.  
**Novo SHA da correção:** conferir o HEAD vivo do PR #76 após este relatório (a própria documentação gera commit adicional).

## Correções: evidências e causas, sem trocar asserções

| Falha | Causa-raiz demonstrada na fonte | Código alterado | Regressão |
|---|---|---|---|
| I2-B/B2: exclusão de categoria sem uso interrompida | O caminho de preparo de exclusão usa `transaction.categorize` para marcar uma categoria como usada. Na rodada P0.3, o método compartilhado `SyntheticCategoryExecutor.apply` passou a usar `FinanceDB.save(...,{inTransaction:true})` para I2-C, mas o **executor legado I2-B** só abria `BEGIN IMMEDIATE` para regras e categorizações bancárias. A reclassificação manual ficava sem transação e falhava com `Transação externa ausente`. | `electron/intelligence-category-actions.cjs`: `confirm` abre `BEGIN IMMEDIATE` para **todas** as categorizações (manual ou bancária); categoria create/update/delete seguem usando transações canônicas próprias. Atualização de recibo e mutação manual passam a ter um COMMIT comum; o catch remove journal preparado após rollback. | `tests/intelligence-i2b.test.cjs`: exclusão de categoria em uso continua bloqueada, classificação manual segue gravada; NOVO teste injeta falha no UPDATE do recibo, verifica rollback da classificação, 7500 centavos inalterados, recibo não duplicado e retry confirmado |
| I2-B/B2: classificação manual supervisionada | A mesma ausência de transação externa: `FinanceDB.save` exige `this.db.isTransaction===true` quando `inTransaction:true` | Mesma correção acima, sem mudar dados, IDs, centavos ou envelopes de autorização. **I2-C** chama o método com seu próprio `BEGIN IMMEDIATE`, preservado. | Testes originais de classificação manual I2-B e I2-C, mais rollback/recibo acima |
| RC I2-B: preview pessoal é read-only, confirm retorna exceção de shape | O comando era legítimo para ser **NEGADO**, mas `RCCategoryGateway.personalCall` rejeitava o campo `confirmationNonce` antes de chegar ao gate que nega método `confirm`. | `electron/intelligence-category-rc.cjs`: campo `confirmationNonce` agora é reconhecido como input inerte. O método `confirm` segue FORA de `PERSONAL` e retorna `status:'denied'`, `changesApplied:false`. `verifiedGesture`/owner/ambiente injetados seguem inválidos. Nenhum bypass do MAIN. | `tests/rc-all-01-categories.test.cjs`: NOVO caso com nonce pessoal válido recebe `denied`, categoria não é escrita; tentativa de `verifiedGesture` injetado lança erro de comando inválido |
| D05: `error in trigger d05_transactions_insert_relationship: no such table: main.categories_old` | A migração já tentava reconstruir FKs filhas para `categories`, mas um `ALTER TABLE categories RENAME TO categories_old` anterior reescreve o SQL dos **triggers D05 em OUTRAS tabelas**. Quando `repairLegacyFKTable` executa `ALTER TABLE`, SQLite revalida trigger pendente e falha antes da sua reconstrução. Verificar apenas a existência de `categories_old` ou criar a tabela falsa NÃO resolve o problema com segurança. | `electron/d05-hierarchy.cjs`: `removeGhostD05Triggers` é executada **dentro do BEGIN IMMEDIATE e ANTES da reconstrução de qualquer FK**; remove somente triggers de relacionamento D05 com nome, tabela, causa e referências canônicas verificadas. `ensureRelationshipTriggers` recria esses triggers do código-fonte aprovado após restaurar as filhas. Triggers personalizados nunca são removidos; `foreign_key_check`, `integrity_check` e ausência de `categories_old` em `sqlite_master` são validados antes do COMMIT. Qualquer erro implica rollback + restauração de `foreign_keys=ON`. | `tests/reliability.test.cjs`: o caso legado agora comprova ANTES a presença do trigger `d05_transactions_insert_relationship` apontando para `categories_old` inexistente e a FK de `subcategories`; DEPOIS verifica 61 subcategorias, categoria, regra, 2200 centavos, integridade e ausência de ghosts. Testes D05 E1 adicionais de 630 movimentos, FK, triggers customizados e rollback permanecem intactos |

## Evidências realmente executadas

1. **GitHub:** HEAD inicial confirmado, os arquivos reais foram lidos e as correções foram commitadas na mesma branch; não houve alterações de taxonomia ou produção.
2. **Sintaxe JavaScript:** verificação V8 `new Function` com conteúdo GitHub de `electron/intelligence-category-actions.cjs`, `electron/intelligence-category-rc.cjs`, `electron/d05-hierarchy.cjs`, `tests/intelligence-i2b.test.cjs`, `tests/rc-all-01-categories.test.cjs` e `tests/reliability.test.cjs`: **PASS sintático**.
3. **SQLite real isolado, Node v22.16.0** (experimentos reprodutivos em `/tmp`, sem conexão com banco pessoal): o cenário `ALTER TABLE categories RENAME TO categories_old` + DROP da tabela antiga reproduziu o erro **exato** `error in trigger ... no such table: main.categories_old` sem remover triggers antes do rebuild. Ao remover os triggers canônicos antecipadamente, reconstruções de `category_rules`, `transactions` e `subcategories` preservaram linhas/índice/trigger personalizado, `foreign_key_check=0`, `integrity_check=ok` e `foreign_keys=ON`: **PASS pontual**. Uma segunda prova de transação sintética com `node:sqlite` injetou falha no recibo, conferiu rollback financeiro e posterior COMMIT único de 7500 centavos: **PASS pontual**.
4. Os testes oficiais **Node 22.23.4 / `npm ci` / `npm run test:types` / `npm run test:db` / `npm run compile` / F08-proveniência / `npm run test:asar`**: **NOT_RUN** neste SHA. O container não possui checkout GitHub completo nem acesso externo para clonar repositório privado. **CircleCI pertence exclusivamente ao proprietário; nenhum pipeline foi iniciado pelo Integrador**.
5. Electron Windows/QA visual/EXE: **NOT_RUN / NÃO AUTORIZADOS**. Status da release: **NO-GO**, sem promessa de zero bugs sem teste oficial.

## Segurança e próxima etapa

- `approvedForPersonal:()=>false` permanece no MAIN. A IA não pode escrever no banco pessoal, apenas no laboratório sintético isolado sob confirmação humana.
- Não se inventa `categories_old`, não se desativa FK permanentemente, não se relaxa verificação de owner/nonce/escopo; restauração/migração permanece atomicamente protegida.
- Manter #74 aberta. PR #76 e painel #82 permanecem Draft. Não fazer merge na `main`, deploy, APIs pagas, Windows QA ou build.
- Primeiro pipeline Linux deve ser executado **exclusivamente pelo proprietário** no HEAD novo do PR #76, branch `integration/mf2-rc-all-01-i2a-20261113`, com:
```yaml
run_preflight: true
run_windows_qa: false
run_windows_build: false
```
- O usuário deverá fornecer link/ID do job, `CIRCLE_SHA1`, contagem PASS/FAIL e primeiro stack trace integral. Nenhum PASS histórico substitui esse requisito.
