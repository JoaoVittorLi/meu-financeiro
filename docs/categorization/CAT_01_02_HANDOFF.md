# CAT-01 / CAT-02 — Handoff para Integrador | Meu Financeiro 1.0.0

**Estado:** código de serviço implementado em branch própria; P0 ainda não homologado. Baseline PR #96 HEAD `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff` (estado observado em 17/11/2026). Nenhuma mudança em MAIN, preload, db.cjs, 1.0 release ou dados reais.

## Código
- `electron/cat01-pluggy-evidence.cjs`: normalização versionada de `descriptionRaw`, `operationType`, `paymentData.receiver` (somente CNPJ comercial validado), MCC, campos `merchant`, `category/categoryId`; campos opcionais permanecem nulos. Nunca persistir CPF/payer/credenciais/payload completo.
- `electron/cat01-evidence-store.cjs`: migração SQLite aditiva transacional, idempotência por fingerprint, FK para `bank_transactions`, cobertura agregada por instituição e conta, reversão sem dados ou por backup completo se com dados.
- `electron/cat02-classifier.cjs`: resolvedor de catálogo D05 14×61 existente, distinção de classificação por regra aprovada, evidência externa, histórico humano e inferência local Naive Bayes. Qualidade de evidência exige corroborar fonte, D05 válido e POSTED/expense. Conflito, fonte insuficiente ou previsão não calibrada = revisão. Cartões CREDIT bloqueados até reconciliação de faturas.
- `tests/cat01-02-evidence-classifier.test.cjs`: 22 casos incluindo 3 contas/630 movimentos em SQLite, duplicados, rollback, MCC/CNPJ, estados protegidos, ausência de Premium e modelo local não calibrado.

## Fronteira de integração (ownership issue #49)
Somente o Integrador poderá modificar `electron/db.cjs`, `electron/main.cjs`, `electron/preload.cjs` e suas migrações/IPC. Adaptar a importação de Pluggy dentro da transação `FinanceDB.ingestBank` chamando `migrateCat01(db.db)` na inicialização e `persistEvidenceBatch(db.db, entradasOriginais, {withinTransaction:true})` após inserir cada bank transaction, antes do COMMIT, preservando rollback atômico. Não chamar metadata capture antes de a FK da movimentação existir. Não usar `bankOverview()` limitado a 2500 para classificação de todo o histórico.
Integrar o algoritmo como serviço independente da UI; somente o serviço CAT-05 poderá autorizar e persistir D05 automático, condicionado a consentimento nativo por conta. Não substituir a semântica de `bank_category_overrides` que hoje é manual, nem permitir o classificador escrever nessa tabela diretamente. `approvedForPersonal:()=>false` permanece inalterado; outros fluxos IA continuam bloqueados.

## Testes executados
- **PASS:** 19/19 casos de lógica normalizador/classificador em harness V8 com fontes reais do branch; erro encontrado e corrigido no formato de saída do Naive Bayes.
- **NOT_RUN:** 3 casos que dependem de `node:sqlite` real, Node 22.23.4 / npm 10.9.9, TypeScript, DB legado, ASAR, provenance, Electron Windows, backup/recovery e 630 lançamentos na integração real. O shell atual não possui checkout Git e github.com falha na resolução DNS.
- Nota: classificação de movimentações não representa aprendizado de IA calibrado com apenas regex. A inferência Naive Bayes local é executável, mas **sempre retorna sugestões para revisão** até calibração posterior; nenhuma probabilidade ou confiança fabricada habilita escrita.

## Próximos gates
1. Revalidar HEAD dos PRs #94/#96/#98 e resolver ownership. Construir migration backup-first; testar backup WAL e restauração com tabelas CAT-01.
2. Executar `node --test tests/cat01-02-evidence-classifier.test.cjs` com Node 22.23.4, `npm run test:db`, `npm run test:types`, ASAR/provenance e smoke em ambiente oficial; resolver FAIL antes de integrar.
3. CAT-03 fará prévia de histórico inteiro via cursor de SQLite; CAT-04/05 exige consentimento explícito, executor de escrita D05 específico, undo e rotina local.
4. Manter RC e 1.0.0 **NO-GO** até execução de todos os CATs com QA e autorização do proprietário.
