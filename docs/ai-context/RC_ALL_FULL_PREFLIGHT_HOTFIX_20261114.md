# RC-ALL-FULL — Hotfix P0 do primeiro preflight Linux (14/11/2026)

**PR #76**: `integration/mf2-rc-all-01-i2a-20261113` (Draft).  
**SHA que falhou**: `25621fb002cc95c212cd12ff48996f92ba8483a7`.  
**CircleCI**: https://app.circleci.com/workflow/523c4484-68d3-4dff-88b9-bb7f6236efcb/job/659806d7-dddc-435e-a466-e6c651555dd3  
**Status GitHub real**: `ci/circleci: preflight_linux = failure`.  
**SHA pós-hotfix**: consultar HEAD atual no PR #76; esta documentação integra a candidata e sua própria atualização produz um novo commit.

## Evidência, alcance e limites

Este ambiente teve acesso à **árvore exata GitHub** do SHA que falhou e confirmou o status de falha. A URL de logs CircleCI não forneceu o conteúdo detalhado sem acesso autenticado. Foi possível localizar e revisar os **arquivos e testes oficiais versionados**, mas não obter o log de todas as asserções FAIL. Também não é possível clonar a branch neste container (DNS externo indisponível); o Node disponível aqui é **22.16.0**, enquanto a pipeline exige **22.23.4**. **Nenhum `npm ci`, `test:types`, `test:db`, `compile`, F08, ASAR ou teste Node/SQLite completo foi executado neste SHA pelo Integrador.** Não apresentar parser V8 como substituto de QA real, nem declarar HOTFIX READY ou LINUX PASS sem nova pipeline.

As causas-raiz abaixo são **confirmadas por inspeção dos arquivos e contratos em SHA testado**, com regressões reais acrescentadas para execução no próximo CircleCI. Os FAIL adicionais não visíveis no log ainda não podem ser descartados.

## Causas-raiz e correções dirigidas

| Área | Causa-raiz demonstrável | Código corrigido | Teste de regressão |
|---|---|---|---|
| Backup v7 | `validateBackupFile` aceitava somente versão <=6, mas a própria D05 grava `schema_version=7`; backups recém-criados eram rejeitados | `electron/recovery.cjs` | `tests/recovery.test.cjs`: backup v7, restore, v8 rejeitado, corrupção/FK rejeitados |
| Futuro incompatível | `FinanceDB` atualizava `schema_version` incondicionalmente para 6/7, mesmo se abrisse banco futuro | `electron/db.cjs`: guarda de versão antes das migrations | Mesmo teste de recuperação v8, com `new FinanceDB(future)` rejeitado |
| D05 legado | `migrateHierarchy` inseria categorias com `emoji` e `kind` mesmo quando o schema legado não possuía essas colunas | `electron/d05-hierarchy.cjs`: `ADD COLUMN` transacional, sem mudar 14x61 | `tests/d05-e1-hierarchy.test.cjs`: migrador standalone pré-v6, 630 linhas e colunas reais |
| D05 catálogo colidente | A fixture propositalmente cria `subcategories` com a mesma chave normalizada. `CREATE TABLE IF NOT EXISTS` não é a causa: `INSERT OR IGNORE` encontra colisão e a conferência canônica deve abortar e fazer ROLLBACK | Migração preserva detecção e rollback; não criar tabela fictícia | Teste original `conflito no catálogo aprovado` preservado; novo caso standalone |
| `categories_old` | FKs remanescentes de renomeação de tabela devem ser rejeitadas explicitamente até existir migração dirigida, em vez de criar `categories_old` artificial | `electron/d05-hierarchy.cjs`: análise real de `PRAGMA foreign_key_list` e fail-closed | `tests/d05-e1-hierarchy.test.cjs`: FK pendurada aborta sem alterar transações |
| D05 leitura | `FinanceDB.load` omitira o par `categoryId/subcategoryId` persistido. A interface antiga poderia perder a associação em round-trip | `electron/db.cjs`: SELECT aditivo + salvar `null/null` legado sem exigir pai inventado | `tests/d05-e1-hierarchy.test.cjs`: parent/child/centavos antes e depois de load/save |
| I2-A split 6000+4000 | Um teste chamava `transactions` **sem `category`**, portanto um retorno bruto de 10000 estava semanticamente correto. O drilldown de 6000 **precisa declarar `category:'Alimentação'`**. Separadamente, `splitOutdated` não deve atribuir gross 10000 a uma categoria anterior | `electron/financial-intelligence.cjs`, `electron/intelligence-tools.cjs` atribuem divisão inválida a `A classificar` sem mudar o registro bruto; a chamada de teste filtrado foi explicitada | `tests/intelligence-i2a.test.cjs`: filtrado 6000, total bruto 10000, duas partes 6000+4000 e splitOutdated retém centavos sem atribuição incorreta |
| I2-C concorrência | Duas confirmações passam pelo `await authorizer` com o mesmo nonce; a segunda observa o recibo após BEGIN e era tratada como `stale`, apesar de commit válido já registrado | `electron/intelligence-category-atomic.cjs`: replay idempotente dentro da transação, revalida owner, grant, perfil, mês, hash/nonce e nunca executa duas mutações | `tests/intelligence-i2c.test.cjs`: confirmações concorrentes, 5 simultâneas, exatamente 1 categoria e 1 recibo |
| Gateway pessoal sintético | Reconsulta após troca de sessão/restart é distinta do replay do nonce. Um recibo genuinamente COMMITTED não deve se perder; recuperar não pode elevar grants reais | `electron/d05-personal-gate.cjs`: recuperação por ID **somente vault sintético verificado**, novo grant MAIN com mesmo perfil/conta, sem reexecutar commit; reforço de TTL e proteção de `:memory:` apenas sintético | `tests/rc-all-full-personal-gate.test.cjs`: falha pós-COMMIT, reopen real do vault SQLite, nova sessão, recibo recuperado, nonce antigo negado |
| D04 harness VM | Teste transpilava apenas `intelligence-review.ts` e chamava `categoryReviewEnable`, que depende do `localFinancialDisable` de outro arquivo, ausente na VM isolada | `tests/rc-all-01-ui.test.cjs`: dependência injetada com verificação explícita de revogação de IC-READ | Teste existente de reautorização mantém limpeza de estado, fila, cache e grant anterior |
| P1 símbolos D04/V3/IC2 | `mfD04Render`, `mfV3Requested` e `IC2ReadQueryGateway` **existem** na árvore do SHA, com ordem correta em `tsconfig.json`. Não criar exports falsos sem prova de ausência após compilação | Nenhum export artificial. Adicionado contrato do bundle e chamada funcional de IC2 | `tests/rc-all-full-build-symbols.test.cjs`: verifica `app/app.js` produzido por tsc, `module:none/outFile` e IC2 real |
| CSV parser obsoleto | Teste D1.5.1 pesquisava `parseMoney(row[va]` após o parser endurecido usar `parseMoney(String(row[va]||''))`. Corrigir regex isoladamente seria insuficiente | `tests/d1-5-1-money-input.test.cjs`: reconhece a coerção/validação nova | **Novo `tests/d05-csv-import.test.cjs`**: extrai métodos REAIS `App.importCSV/commitCSVPreview` via TS AST e persiste contra FinanceDB real; 123456/9001 centavos, duplicatas, backup antes de gravar, rejeição de fórmula |

## Integridade e autorização: critérios ainda a demonstrar

- **Nenhum dado pessoal foi utilizado ou gravado nesta missão.** Testes criam bancos temporários/sintéticos. O MAIN continua com `approvedForPersonal:()=>false`.
- Testes de recuperação preservam versões futuras e negam `restoreBackup` antes de substituir o ativo. `PRAGMA integrity_check` + `foreign_key_check` agora participam da validação da cópia.
- Migração D05 permanece aditiva, transacional, 14 pais/61 filhos/67 SVGs, com `FOREIGN KEY` e `ROLLBACK` na colisão. Nenhum `categories_old` artificial é criado; banco com FK de renomeação quebrada requer análise dirigida antes de aceitar upgrade.
- Leitura I2-A conserva **10000 centavos originais** para 6000+4000. A consulta filtrada por Alimentação é **6000**; um split outdated não herda o valor bruto para essa categoria.
- I2-C replays após autorização concorrente retornam `applied/replayed` para o **mesmo nonce/owner/escopo**; mudanças de nonce/conta/grant não executam.
- Acesso a recibo sintético após reinício exige novo grant MAIN e verificação de vault de teste. **Não habilita escrita pessoal real**.
- As 630+ movimentações de migração e backup SQLite, bem como 632 registros de integração, estão presentes nos testes oficiais, mas seus resultados são **NOT_RUN no novo HEAD**.

## Matriz do gate

| Comando/prova | Evidência disponível | Estado |
|---|---|---|
| CircleCI preflight SHA anterior | GitHub `ci/circleci: preflight_linux = failure` + link | **FAIL** |
| GitHub PR/HEAD/diffs | Fonte atual consultada | VERIFIED |
| V8 syntax parse para módulos CJS alterados | `new Function` isolado com conteúdo real do GitHub | PASS **somente sintaxe** |
| Presença no TS config de símbolos D04/V3/I2-E e parser CSV | Conferência estática dos arquivos | VERIFIED **não compilação** |
| `npm ci` Node 22.23.4 | Sem checkout nem Node exato neste executor | NOT_RUN |
| `npm run test:types` | Aguardando novo preflight proprietário | NOT_RUN |
| `npm run test:db` D05/I2-A/B/C/D/E e financeiro | Aguardando novo preflight proprietário | NOT_RUN |
| `npm run compile` | Aguardando novo preflight proprietário | NOT_RUN |
| F08/proveniência e ASAR | Aguardando novo preflight proprietário | NOT_RUN |
| Electron Windows 1366x768/1920x1080 dark/light | Não autorizado neste estágio | NOT_RUN |
| Escrita pessoal real | MAIN hard OFF | NOT_AUTHORIZED |
| Build EXE | Bloqueado e não autorizado | NO_GO |

## Repetição do preflight: apenas proprietário

Branch: `integration/mf2-rc-all-01-i2a-20261113`. Confirmar SHA atual no PR #76 **após esta documentação**.

```yaml
run_preflight: true
run_windows_qa: false
run_windows_build: false
```

Enviar URL/ID do novo job, `CIRCLE_SHA1`, resultados por comando e primeiro log completo em caso de FAIL. Não executar CircleCI, QA Windows, build, deploy, integração pessoal ou merge main sem autorização.

**Status objetivo:** `HOTFIX_CODE_PUBLISHED / TESTS_VERSIONED / LOCAL_OFFICIAL_NOT_RUN / LINUX_GATE_FAIL_PREVIOUS_SHA / NO_GO_EXE`. O critério **HOTFIX READY** não pode ser atestado sem os testes oficiais locais disponíveis; **LINUX_GATE_PASS** depende exclusivamente de nova execução SUCCESS pelo proprietário.
