# Meu Financeiro 2.0 — RC-ALL-FULL / Hotfix P0.5: contrato pessoal D05 v7

**Missão:** corrigir as 11 falhas do preflight relacionadas à rejeição de colunas em `finance-personal-batches`, `finance-personal-validate` e `finance-personal-quarantine`, sem desabilitar validação.  
**PR de código:** #76 (Draft) · **branch:** `integration/mf2-rc-all-01-i2a-20261113`.  
**SHA de entrada (com 11 FAIL reportados):** `5e244d381ccaad408cb1daf6afa42d9889b7ee08`.  
**SHA de saída:** consultar o HEAD após a inclusão deste relatório; esta própria atualização produz um commit.

## Causa-raiz — confirmada no código

`electron/cloud-personal-snapshot.cjs` extrai com `PRAGMA table_info` **todas** as colunas físicas de cada uma das 17 tabelas do contrato pessoal. Após a migração D05, o schema do banco é **v7**, porém o lado Cloudflare ainda exigia explicitamente a disposição **v6**. A primeira divergência em `transactions` (`category_id`, `subcategory_id`) provocava uma rejeição precoce, mascarando em cascata os erros específicos de hash, contagem, duplicação e tipo previstos nos 11 testes. Cinco outras tabelas também haviam recebido colunas D05; mudar apenas `transactions` seria insuficiente.

**Contrato v7 exatamente sincronizado e com ordem preservada:**

| Tabela | Colunas v7 | Mudança D05 |
|---|---:|---|
| transactions | 10 | `category_id`, `subcategory_id` |
| categories | 9 | `id`, `icon_key`, `hue` |
| category_rules | 9 | `category_id`, `subcategory_id` |
| bank_category_overrides | 5 | `category_id`, `subcategory_id` |
| bank_transaction_splits | 7 | `category_id`, `subcategory_id` |
| planned_items | 19 | `category_id`, `subcategory_id` |
| Outras 11 tabelas pessoais | Inalteradas | Ordem e formato anteriores preservados |

`NULL` é legítimo nos vínculos D05 de registros antigos, bem como em `categories.icon_key/hue` de categorias personalizadas; `hue` numérico não-nulo deve ser inteiro seguro. Não foram removidas verificações de colunas extras, quantidade, bytes, hashes, PKs, chaves duplicadas ou tipos.

## Correções concretas publicadas

1. `mobile-push/src/finance-personal-validate.js`: `PERSONAL_COLUMNS` v7 exato (17 tabelas), constante `PERSONAL_SCHEMA_VERSION=7`, nullability D05, categoria-pai com ID único, verificação de parent IDs existentes e recusa de `subcategory_id` sem `category_id`. O pacote continua sem liberar cutover.
2. `mobile-push/src/finance-personal-batches.js`: manifesto, `safeRow` e pacote reconstituído na finalização usam a mesma versão física estrita. Lotes de **80 linhas**, limites de bytes, hash, replay idempotente e rollback não foram relaxados.
3. `electron/cloud-personal-snapshot.cjs`: identifica como v7 **apenas** backups com `app_meta.schema_version=7` validado em modo de leitura. Backup v6 não é reetiquetado como v7. Preserva a imutabilidade e o segredo dos dados.
4. `electron/cloud-transfer-plan.cjs`: aceita apenas a versão v7 fornecida pelo snapshot; repassa essa versão no manifesto. `FINANCIAL_TRANSFER_ACTIVE=false` e remetente real bloqueado.
5. `mobile-push/src/finance-synthetic-quarantine.js`: os **17 registros fictícios** agora incluem as colunas D05 em formato e ordem canônicos, com parent ID de teste e filho nulo; `schemaVersion=7`. Os demos de **207 registros** herdam o contrato sem modificar valores originais.
6. `mobile-push/src/finance-e1-audit.js`: auditoria de manifesto de transferência verificada compara com versão v7, sem ativar nuvem ou dados pessoais.
7. O manifesto independente `cloud-migration-manifest.cjs` (auditoria read-only legada com contrato próprio v6) e `finance-staging.js` (marcador de camada staging distinto) **não foram reclassificados** para evitar mistura de contratos.

**Nota de segurança importante:** o contrato de quarentena continua restrito às **17 tabelas pessoais pré-existentes**, sem carregar a tabela de catálogo D05 `subcategories`. IDs de pais são verificados e IDs de filhos sem pai são rejeitados; **o pertencimento de um filho ao catálogo 14×61 ainda não pode ser homologado nesse pacote**. Por isso a execução continua em quarentena, com `cutoverAllowed=false`; não declarar migração pessoal completa nem habilitar sincronização financeira real.

## Testes versionados, sem mudar regex antigas

- `mobile-push/test/finance-personal-validate.test.js`: novo teste de paridade da **ordem real `PRAGMA table_info` das 17 tabelas**, integridade de `category_id/subcategory_id` com valor e `NULL`, custom `icon_key=null`; outro rejeita versão v6, colunas faltantes, referência de pai ausente, filho sem pai.
- `mobile-push/test/finance-personal-batches.test.js`: novo teste de validação pré-gravação com manifesto v6, colunas D05 ausentes e `clientSecret` extras; replay idempotente preservado.
- `tests/cloud-personal-snapshot.test.cjs`: novo teste rejeita backup v6 antes de exportar; asserções v7, IDs nulos e ausência intencional do catálogo filho.
- `tests/cloud-transfer-plan.test.cjs`: novo teste v7 no manifesto e rejeição de plano v6, sem upload.
- `mobile-push/test/finance-e1-audit.test.js`: novo teste rejeita auditoria de manifesto v6 mesmo se sessão tiver sido marcada `verified`.
- Suítes originais de quarentena, checksum, duplicação, 80-row, 207-row, sincronização segura e uploader continuam **inalteradas** e deverão ser executadas integralmente.

## Evidências efetivamente produzidas nesta sessão

- **VALIDAÇÃO ESTÁTICA: 17/17 tabelas MATCH**, comparando a lista exata do validador com DDL SQL original do Electron/Planning e colunas aditivas D05, incluindo a ordem, sem diferir campos.
- **ISOLATED V8:** pacote sintético com 17 linhas e seis vínculos bancários passou `validatePersonalMigrationPackage`; versão v6, coluna `subcategory_id` ausente e credencial extra foram rejeitadas. Esse ensaio usou **digest simulado**, portanto **NÃO valida os hashes SHA256 reais** e NÃO é PASS de suíte Node.
- **SINTAXE JS:** 11 arquivos CJS/ESM e de teste inspecionados passaram parser V8 após retirar somente a sintaxe de import/export para essa verificação.
- **NODE OFICIAL NÃO EXECUTADO:** este runtime possui Node **22.16.0**, não Node **22.23.4**, e não há checkout completo da branch privada disponível no container. Assim, `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, F08/proveniência, `npm run test:asar`, `cd mobile-push && npm test` e suíte completa **NOT_RUN no novo SHA**. Os 11 FAIL anteriormente reportados **não devem ser reclassificados como PASS** até nova pipeline.
- Nenhum CircleCI, Windows QA, build, deploy ou merge foi iniciado pelo Integrador.

## Go/No-Go e preflight do proprietário

**Status:** `CODE_HOTFIX_PUBLISHED / SCHEMA_17_OF_17_VERIFIED_STATICALLY / OFFICIAL_TESTS_NOT_RUN / LINUX_PENDING / NO_GO_EXE`.

Somente o proprietário poderá executar o CircleCI na branch `integration/mf2-rc-all-01-i2a-20261113`, com SHA novo verificado no #76:

```yaml
run_preflight: true
run_windows_qa: false
run_windows_build: false
```

Verificar `CIRCLE_SHA1`, enviar URL do job, resultados dos comandos e os primeiros logs completos de qualquer FAIL. Manter **issue #74 aberta**, IA pessoal sem escrita (`approvedForPersonal:()=>false`), dados Windows offline e nenhum merge na main. Somente após Linux SUCCESS e aprovação separada iniciar QA Windows; EXE exige outra autorização.
