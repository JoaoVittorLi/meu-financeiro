# Meu Financeiro 2.0 — I2-C | C1 Resiliência + C2 Contrato Electron

**Issue:** #77 | **Base congelada:** PR Draft #75 `4dc638650671712cbc1290f5814341edc8fea5b2` | **Próximo PR:** único Draft empilhado em #75.

**Status:** CODE_DELIVERED / BACKEND_ISOLATED / SQLITE_OFFICIAL_NOT_RUN / ELECTRON_NOT_INTEGRATED / NOT_HOMOLOGATED. Nenhuma escrita financeira pessoal é autorizada.

## Escopo ownership

Apenas quatro novos módulos `electron/intelligence-category-{vault,fingerprint,atomic,bridge}.cjs` mais `tests/intelligence-i2c.test.cjs` e esta documentação. Não foram alterados `electron/db.cjs`, `electron/main.cjs`, `electron/preload.cjs`, arquivos UI/renderer ou módulos I2-A/I2-B. PR #75 não recebeu commits desta missão.

## C1 — atomicidade e recuperação em SQLite REAL sintético

1. `createSyntheticFinanceVault()` cria um novo banco físico em diretório `mf-i2c-test-*` de `os.tmpdir()` (0700), com marcador aleatório, arquivo SQLite (0600) e verificação de `realpath`, identidade do objeto e symlinks. Não aceita caminho custom, jamais abre `userData` do aplicativo e não reutiliza SQLite pessoal. `close()/reopen()` permitem simular reinícios; `destroy()` remove os arquivos sintéticos.
2. `AtomicSyntheticCategoryExecutor` exige prova ativa do vault, `CategoryProposalService` com o MESMO FinanceDB, `CategoryReviewService(syntheticProfile:true)` para restrições de regras, autorizador confiável, consentimento literal, nonce válido, owner/grant/fonte/perfil/mês e prazo vigente. `profile=demo` por si só NÃO autoriza escrita.
3. `prepare`/`armProposal` registram em memória um digest criptográfico SHA-256 do conteúdo e do esquema das tabelas SQLite sintéticas. O hash cobre categorias, regras, constraints, transações, budgets, contas, extratos, overrides/splits/notas/revisões e recibos. A validação bloqueia inclusive writes externos à conexão que não alterem `total_changes()` do processo autor.
4. Após gesto humano confirmado pelo HOST, usa `BEGIN IMMEDIATE` e reconstrói deterministicamente a prévia antes de aplicar. `canonicalSavepointView` fornece uma sombra de FinanceDB cujas chamadas internas de BEGIN/COMMIT/ROLLBACK viram SAVEPOINT/RELEASE/ROLLBACK TO. Os métodos VALIDADOS do FinanceDB continuam sendo chamados (sem copiar cadastro/validadores) e a mutação só é durável junto com a inserção do recibo `i2c_atomic_receipts` no MESMO COMMIT externo. Nenhum hack de patch global de `FinanceDB.db`.
5. Falha antes do COMMIT: ROLLBACK anula a ação e o recibo. Falha depois do COMMIT: responde `recovery_required` com `changesApplied:null`, sem afirmar que não executou nem reexecutar. `readReceipt()` encontra o commit após reabertura do SQLite sintético e reautorização no mesmo owner/fonte/perfil/mês. `confirm` com nonce/escopo idêntico oferece recibo idempotente; novo grant exige recuperação, nunca replay silencioso.
6. Descarte/edição de proposta enquanto `authorizer` aguarda invalida o comando original. Concorrência entre confirmações usa turno síncrono sem await entre lock/mutação/COMMIT + PK por proposalId. Todas as respostas de falha são genéricas, sem token ou stack financeiro.
7. Reversão automática: `undoAvailable=false`; não inventar compensação ou migração destrutiva. Recibo em arquivo SQLite agora sobrevive à reabertura do **mesmo vault**, mas a arquitetura não foi promovida a produção nem suporta importação/movimentação de dados pessoais.

**Pontos de falha injetáveis nos testes:** `before_transaction`, `before_apply`, `after_apply`, `after_receipt`, `before_commit`, `after_commit`, além de exceção logo após `FinanceDB.upsertCategory` fechar seu savepoint. Testar rollback, tabelas, foreign_keys, receipt e restart. A reabertura não permite executar novamente uma ação sem nova proposta.

## C2 — ponte/adaptador para Integrador e D01/D04

**Módulo:** `electron/intelligence-category-bridge.cjs`. Não é registro de IPC. `IntelligenceCategoryBridge.handle(request, trustedHostContext)` tem whitelist: `capabilities`, `ask`, `list`, `analyze`, `propose`, `edit`, `reject`, `inspectRule`, `confirm`, `receipt`, `recovery`, `history`.

**Fluxo de UI a conectar pelo Integrador:** D01 conversa → `ask/list/analyze` (investigar) → `propose` ou `ask.proposals` (prepare) → UI D04 compara `before/after`, `affected/impact/conflicts/coverage` → `edit/reject` (revalidar rascunho) → clique humano MAIN verifica gesto e owner → `confirm` (apenas no vault sintético) → `receipt`/`recovery`. O adaptador não aceita SQL livre nem invoca handlers manuais `categories:save`/`bank:categorize`.

**Modos da resposta:**

- `READ_ONLY_PERSONAL` — consultas e propostas sem escrita pessoal. Se não houver executor sintético, confirm retorna `denied`.
- `SYNTHETIC_PREVIEW` — `propose/ask/edit` quando executor está ligado ao vault e host declara ambiente sintético. Proposta pronta ganha `capability=synthetic_hardened`, depois de `armProposal` com fingerprint.
- `SYNTHETIC_WRITE_ONLY` — somente `confirm`, `receipt`, `recovery`, `history` no vault provado, gesto humano verificado no MAIN. Nenhum token financeiro é copiado para resposta.

**Estados:** `ready/proposed/partial/needs_clarification/blocked/stale/denied/unavailable/unsupported/applied/recovery_required`. Os `changesApplied` em falha ambígua após COMMIT são `null` (não falso). Todas as decisões com `status=stale` exigem nova prévia. A saída contém `contract=I2-C/ELECTRON-REVIEW-V1`, `version=1`, `method`, `mode`, `status`, `changesApplied` e `data` quando válido.

**Obrigação do MAIN (Integrator #65/#71):** derivar `trustedHostContext.owner`, `verifiedGesture` e `environment` de sender/autorização internamente, jamais de texto do modelo ou payload IPC; impor sender trusted; manter grants de IC2-READ-QUERY; conferir `activeAccountId` para comandos bancários, vinculando a conta apresentada ao usuário; integrar logs redigidos e o nonce de confirmação ao rascunho D04 sem persistir tokens. Nunca importar a ponte como acesso direto a SQL pelo renderer.

**Limite de C2:** executar ações bancárias exige conta ativa confiável; se IDs afetados pertencem a outra conta, retorna denied. O grant IC-READ I2-A atual é por fonte e não fornece concessão individual por conta: o MAIN tem obrigação de definir/validar seleção de conta, e a autorização pessoal para writes continua proibida.

## D05 — subcategorias, sem antecipar migration

O Design D05 está como `DESIGN_PROPOSAL / ENGINEERING_REQUIRED` no contrato `docs/design/screens/d05-movimentacoes/SUBCATEGORIES_IMPLEMENTATION_CONTRACT.md` da branch design #57, vinculado à issue #74. A taxonomia 14 pais × 61 filhos e os IDs `categoryId/subcategoryId` AINDA não foram homologados para o SQLite.

O bridge publica `capabilities.taxonomy` com categoria legada suportada e `subcategory` em `awaiting_approved_D05_contract`. Qualquer `target` que forneça `{categoryId,subcategoryId}` (mesmo com filho `null`) ou `level:'subcategory'` retorna `unsupported` sem fallback para nome de categoria. Nenhuma migração, FK, backfill, reclassificação retroativa, catálogo inventado ou alteração da identidade do pai foi implementada.

**Depende de:** aprovação do Designer e do Arquiteto do contrato D05, decisão sobre `profileScope`, IDs estáveis e migração aditiva de SQLite; Integrador owns SQL/IPC; Executor IA adapta resolver/preview somente depois. Sem filho presumido pelo modelo.

## Testes e resultados honestos

- **25 testes Node/SQLite versionados** em `tests/intelligence-i2c.test.cjs` (21 declarações, um caso parametrizado em cinco fases) **NOT_RUN como suíte oficial**, até preflight do proprietário; incluem uso real de `node:sqlite`, arquivo temporário, reopen, rollback, SQL externo, regras, PENDING/split, budgets, owner/grant/mês/conta, revisão assíncrona, bridge e taxonomia.
- **Prova independente local (Node 22.16.0 + `node:sqlite` REAL): 5/5 PASS** nos cenários antes de apply, depois da mutação, depois do receipt, depois do COMMIT e sem falha. Validou que `categories` e `receipts` sempre ficaram com contagens iguais (0/0 antes de COMMIT; 1/1 depois). Essa POC NÃO importa os módulos MF2 do PR e não substitui a suíte de 25 casos.
- **Sintaxe JS** dos novos módulos e testes na branch: PASS em verificador de parser isolado, sem execução Node/SQLite dos módulos MF2.
- **NOT_RUN no HEAD I2-C:** `npm ci`, `npm run test:db`/todos os testes, `test:types`, `compile`, F08/proveniência, ASAR, Electron/Playwright, Windows. Checkout completo não montável por DNS. Não declarar que C1 passou gate até logs de CI.

**Preflight #75 congelado para proprietário:** branch `feat/mf2-i2b-categories-supervised-20261113` SHA `4dc638650671712cbc1290f5814341edc8fea5b2`; flags `run_preflight=true`, `run_windows_qa=false`, `run_windows_build=false`. Se falhar, correção dirigida vai ao PR #75 ANTES de sincronizar a branch I2-C; registrar novo HEAD e refazer comparação.

**Preflight posterior I2-C (somente proprietário):** branch `feat/mf2-i2c-synthetic-atomic-bridge-20261113`, SHA final informado pelo PR Draft, mesmas flags Linux. Não disparar CI do Executor nem acionar Windows QA/build automaticamente.

## Handoff e evolução

- **Integrador #65/#71**: avaliar contrato C2 sem misturar com RC-ALL-01 automaticamente. I2-A read-only #64 já tem integração isolada em PR #76; I2-B/C não são parte do primeiro EXE sem decisão e testes adicionais.
- **Executor 2 / possível I2-D**: próximo desenvolvimento em nova branch própria, após #77, poderá ampliar detecção de categorias duplicadas sem uso, classificação sugerida por evidência, planos compostos reversíveis sem migrar ou habilitar escrita pessoal; D05 depende de especificação aprovada.
- **Arquiteto #49**: decidir aceite do contrato C2, ownership do futuro `main/preload`, migração D05 e sequência de preflights, sem colidir com UI.