# MF1 / CAT-P0 — Consolidação M1 (PR #105)

**Data:** 2026-11-17
**Branch:** `feat/mf1-cat-p0-consolidation-20261117` (base PR #105 `931848e89e84405bb34f997d3d6a89191d800131`)
**Escopo:** Consolidação do Marco 1 (v1.0.0) — correção de contraste claro, proteção de regex de processadores, otimização de desempenho do `plan()` / `nextBatch()`, recompilação F08 do bundle renderer, suítes sintéticas IPC e calibração Gate G6, e triagem do status `build_windows` do PR #94.

## 1. Correções de Interface e Acessibilidade (`app/d05-movements.css`, `app/app.js`)

- **`app/d05-movements.css`**:
  - Corrigido contraste insuficiente no tema claro em `.d05-screen .mf-cat-toolbar .d05-confirm`: substituído `var(--d05-selected)` (`#e8f8ef`, contraste `1.08:1` com `#fff`) por `background: #16835c; border-color: #16835c; color: #fff` (`4.73:1`) e `:hover:not(:disabled)` em `#116c4c` (`6.37:1`).
  - Ajustado seletor `.d05-screen .mf-cat-toolbar button:not(.d05-confirm):hover:not(:disabled)` para impedir sobrescrita do hover do botão `.d05-confirm`.
  - Removido `opacity: .72` de `.mf-cat-nav button small` (contraste no tema claro elevado de `3.25:1` para `>= 4.5:1` WCAG AA).
- **`app/app.js`**:
  - Recompilado via `npm run compile` (`tsc --project tsconfig.json` + `scripts/build-finance-ledger.cjs` + `scripts/build-preload.cjs build`) para sincronizar integralmente o bundle com as 31 entradas TypeScript/ledger de `tsconfig.json` (verificado por `scripts/renderer-provenance.cjs check-bundle`).

## 2. Desempenho do Motor D05 e Evidências (`electron/d05-auto-categorization.cjs`, `electron/cat01-evidence-store.cjs`)

- **`electron/cat01-evidence-store.cjs`**:
  - Adicionado `evidenceFromRow(row)` para reconstrução direta de registros `cat01_metadata` sem alocação repetida de `Object.fromEntries` por linha.
- **`electron/d05-auto-categorization.cjs`**:
  - Eliminadas consultas SQLite N+1 por linha dentro de `plan()` mediante pré-carregamento único em `Map` por chamada (`categories`, `subcategories`, `mf_auto_labels` e varredura única `SELECT * FROM cat01_metadata ORDER BY account_id,external_id`).
  - Memoização de `validDate`, pré-normalização de `merchant_aliases` sem mutação dos objetos usados em hashes de versão, e cache por chamada de `_fp`/`_merchant`/`_dupKey` em `allRows()`.
  - Em `apply()`: statements SQLite preparados e `D05CategoryService` instanciado uma única vez fora do loop de candidatos; verificação síncrona de backup já existente em `batchId` antes de `BEGIN IMMEDIATE`, preservando `sourceVersion`, `MANIFEST_STALE`, backups verificados com `integrity_check` e semântica canônica de escritor único.
  - Em `nextBatch()`: removida chamada redundante de `plan()` pré-`apply()` e pós-commit em páginas intermediárias quando não há falha (`!this.fault && applied.applied === limit && applied.remainingCandidateCount > 0`), mantendo `plan()` completo na página final e em cenários de falha/parcial.

## 3. Calibração de Processadores (`electron/cat02-classifier.cjs`)

- **`electron/cat02-classifier.cjs`**:
  - Corrigida regex `processor` na linha 177 para aceitar nomes concatenados ou espaçados de processadores/intermediadores (`pag ?seguro`, `pag ?bank`, `mercado ?pago`, `stone`, `cielo`, `pay ?pal`, `pic ?pay`, `get ?net`, `rede`, `sum ?up`, `pagar ?me`, `infinite ?pay`), bloqueando falsos positivos como `MERCADOPAGO`, `PAGARME` e `PAGBANK` da regra `VERIFIED_DIRECT_MERCHANT_MCC_PARENT` (Gate G6-06).

## 4. Novas Suítes Sintéticas de Contrato IPC e Calibração (`tests/`)

- **`tests/cat-p0-ipc-contract.test.cjs`** (`IPC-01` a `IPC-06`):
  - Verifica fechamento completo dos handlers `bank:auto-*`, `d05:personal-write-*` (`approvedForPersonal() === false`) e `finance:restore` diretamente sobre `electron/main.cjs` em sandbox sintético (`MF_QA_SYNTHETIC=1`), incluindo paginação de 250 linhas, prévia/confirmação separada, recibos, undo individual, cancelamento de lote, revogação mid-run e rebinding após restauração SQLite.
- **`tests/cat-p0-calibration.test.cjs`** (`G6-01` a `G6-08`):
  - Verifica limiar provisório `5 correções / 3 datas distintas`, deduplicação contra inflação por âncoras repetidas `(date, amountCents)`, bloqueio por conflitos humanos, caminho Pluggy não-Premium (`MCC 5411/5541/5912` + `DEBIT` + `CARD_PURCHASE` + CNPJ válido + merchant `>= 8`), rejeição estrita de processadores/PIX/MCC amplo (`G6-06`), isolamento strict `review-only` do Naive Bayes (`cat02-classifier.cjs`) e matriz de calibração com `precision = 1.0` e `falsePositives = 0`.

## 5. Triagem PR #94 (`build_windows: error`) & Pré-requisitos Locais Windows

- Consulta às APIs de Status do GitHub (`pulls/94`, head `674108e961691d419700cbce7fe5f2c3ed3b962e`) e CircleCI v2 (`workflow/7bffdb8d-7e1d-44bc-a02b-06822c0b06c5/job`):
  - `preflight_linux` (job `#81`) concluiu com `success` (`2026-11-17T01:58:35Z`–`01:59:44Z`).
  - `build_windows` (job `#82`) foi **cancelado manualmente** (`status: "canceled"`, `4m43s`), que o GitHub mapeia como commit status `error` (`Your CircleCI tests were canceled`), não tratando-se de falha de compilação.
  - Risco latente mitigado: antes da otimização do `plan()`, o estresse `A01` (20.001 candidatos) levava ~9,2 min sem stdout sob `no_output_timeout: 25m`; com a otimização, conclui em ~59–80s.
- Pré-requisitos de empacotamento local Windows (`electron-builder` `26.0.0`, `build/icon.ico`, `app/icon.png`, `app/icon.svg`, `app/vendor/LICENSE_REACT.txt`, `electron/preload-bundled.cjs`, `app/app.js`) verificados em ambiente limpo. Nenhum EXE/instalador gerado nesta etapa (aguarda validação integral dos gates e autorização explícita do proprietário).

## 6. Iteração 2 — Correções Adversariais e Regressões (`electron/cat02-classifier.cjs`, `electron/d05-auto-categorization.cjs`, `tests/`)

- **`electron/cat02-classifier.cjs` (`VERIFIED_DIRECT_MERCHANT_MCC_PARENT`)**:
  - Expandida a detecção de subadquirentes, agregadores e prefixos abreviados (`MP *` / `MP*`, `PAG*` / `PAG *`, `PAGSEG*`, `TON *` / `TON*`, `PG *`, `EBANX`, `ADYEN`, `ASAAS`, `IUGU`, `VINDI`, `ZOOP`, `SHIPAY`, `BCASH`, `MOIP`, `WIRECARD`, `CLOUDWALK`), além da lista existente de processadores.
  - Verificação aplicada tanto em `evidence.merchantName` quanto em `transaction.description`, `evidence.description` e `evidence.descriptionRaw`, bloqueando casos como `desc="MERCADOPAGO *POSTO IPIRANGA"` com `merchantName` limpo.
  - Bloqueio explícito em `directCommerce` para `paymentMethod === 'pix'` (case-insensitive) e ocorrências de `PIX` / `QR CODE` / `QRCODE` mesmo quando `merchantCnpj` está presente.
  - Estreitada a correspondência de `REDE` (`\brede\s*\*`, `\brede ?card\b`, `\brede\b(?! de\b(?! pagamentos?\b))`) para preservar estabelecimentos legítimos como `"REDE DE POSTOS IPIRANGA"`, mantendo o bloqueio sobre `REDE`, `REDECARD`, `REDE *LOJA`, `REDE PAGAMENTOS` e `REDE DE PAGAMENTOS`.
- **`electron/d05-auto-categorization.cjs` (`plan()`)**:
  - Corrigida a checagem de conflito com evidência externa na linha 410 para `(!anchors.length || sameTarget(anchors[0], external.target))`, impedindo que âncoras humanas formadas apenas por pares duplicados (`anchors.length > 0`, `verified.length === 0`) sejam sobrescritas por sugestão externa conflitante.
- **`tests/cat-p0-calibration.test.cjs` & `tests/cat-p0-ipc-contract.test.cjs`**:
  - Adicionados testes regressivos `G6-09`, `G6-10` e `G6-11` cobrindo prefixos de subadquirentes/agregadores, prefixos em `description`, `PIX QR CODE` / `paymentMethod='PIX'` com CNPJ, aceitação legítima de `"REDE DE POSTOS IPIRANGA"` e bloqueio de evidência externa conflitante sobre âncoras humanas duplicadas.
  - Substituído caminho absoluto de worktree em `tests/cat-p0-ipc-contract.test.cjs` (`senderFrame.url`) por `'file:///app/index.html'`.
  - Verificação direcionada aprovada (`54/54` em `cat-p0-calibration`, `cat-p0-ipc-contract`, `d05-auto-reconciled.integration`, `d05-auto-categorization` e `intelligence-recovery`), junto com `npm run compile`, `npm run test:types`, `build-preload.cjs check` e `renderer-provenance.cjs check-bundle`.

## 7. Iteração 3 — Fechamento de Bypasses Restantes (`electron/cat02-classifier.cjs`, `tests/cat-p0-calibration.test.cjs`)

- **`electron/cat02-classifier.cjs` (`VERIFIED_DIRECT_MERCHANT_MCC_PARENT`)**:
  - Expandida `rawProcessorPrefix` para cobrir prefixos abreviados de processadores após prefixos bancários com separadores não-`*` (`COMPRA MP - ...`, `COMPRA CARTAO MP-...`, `DEB PAG - ...`, `COMPRA TON - ...`, `COMPRA PG - ...`, variantes com travessão/barra) e agregadores com `*` (`uber *`), sem colidir com palavras legítimas (`PAGAMENTO`, `TONELADA`, `UBERLANDIA`, `REDE DE POSTOS`).
  - Expandida `processor` com descritores truncados do Mercado Pago (`merc(?:ado)? ?pago`, cobrindo `MERCPAGO *` e `MERC PAGO *`) e agregadores de entrega/marketplace (`i ?food`, `rappi`, `uber ?eats`), mantendo `UBERLANDIA AUTO POSTO` elegível.
  - Adicionada verificação `!hasIntermediary(evidence.merchantBusinessName||'')` em `directCommerce` para bloquear razão social de intermediador/agregador quando `merchantName` estiver limpo.
- **`tests/cat-p0-calibration.test.cjs` (`G6-12`)**:
  - Adicionada regressão unitária (`classifyCandidate`) e E2E (`D05AutoCategorization`) cobrindo os 4 bypasses e os 4 estabelecimentos legítimos não colidentes (`PAGAMENTO FACIL DROGARIA`, `TONELADA SUPERMERCADO`, `UBERLANDIA AUTO POSTO`, `REDE DE POSTOS IPIRANGA`).
  - Verificação direcionada aprovada (`56/56` em `cat-p0-calibration` 12/12, `cat-p0-ipc-contract`, `d05-auto-reconciled.integration`, `d05-auto-categorization`, `intelligence-recovery` e `renderer-asar.integration`).

## 8. Matriz Reconstruída de Funcionalidades v1.0.0 (7 Áreas)

| Área | Cobertura consolidada na v1.0.0 (`feat/mf1-cat-p0-consolidation-20261117`) |
|---|---|
| 1. Visão geral (`overview`) | Saldo de referência, receitas/despesas, mascaramento (`Ocultar/Mostrar valores`), fonte `Contas conectadas` vs `Adicionado por você`, `PeriodPicker`, alternância de gráficos (`Acumulado`/`Entradas e saídas`) e tabela `<details>`, distribuição por categorias `B01` e drilldown `Ver movimentações`. |
| 2. Movimentações D05 (`transactions` / `review` / `categories`) | Lançamentos manuais (`+ Nova movimentação`), busca/filtros (`Origem`, `Ordenação`, `Agrupar por dia`, `A conferir`/`Revisadas`/`Todas`), edição/exclusão protegida quando vinculado, revisão rápida/detalhada, alias de estabelecimento, vínculo manual, divisão bancária com soma exata, picker hierárquico inline D05 (`demo` real SQLite e `real` bloqueado em `personal-locked`), categorias/regras + teste ao vivo e central `CAT-P0` / `CAT-UX` (`bank:auto-*`). |
| 3. Orçamentos (`budgets`) | Resumos, filtros (`Pedem atenção`, `Sem limite`, `Todas`), busca, drilldown categoria/subcategoria e histórico de subcategoria, edição/remoção de limite no SQLite, aba `Receitas` e separação de transferências/reembolsos. |
| 4. Planejamento & Simulador (`planning` / `assistant`) | Compromissos únicos/recorrentes/parcelados (até 36x), `Agenda`, `Calendário` (navegação por teclado `End`/`Home`), `Projeção diária` (slider SVG + `Incluir receitas incertas`), edição/status/vínculo com histórico de auditoria (`Criado`, `Editado`), e `Simular compra` (motor diário, guarda de desatualização, referência A vs B). |
| 5. Inteligência (`intelligence`) | Superfície `B05` (`Hoje`, `Conversar`, `Plano de Ação`), autorização local com `D05RCSecureGate` (`LOCAL_FINANCIAL_READ_V1`), sinais `D03` com gaveta/Escape/retorno de foco, consultas determinísticas `IC2` (`intelligence:ic2-read-query`), desambiguação e prévia sem gravação `D01`, histórico de sessão temporária e `Encerrar leitura`. |
| 6. Minhas contas & Nuvem (`banks` / `cloud`) | Proteção estrita em canal experimental isolado (`u3-connection-alert`, sincronização desativada, `forbidExperimentalNetwork` bloqueando Pluggy/Cloud/OpenAI externos), além de fluxos de auditoria/paridade para builds estáveis homologados. |
| 7. Configurações, Tema & Recuperação (`settings`) | `Reserva mínima protegida`, temas `Claro`/`Escuro`/`Sistema`, backups automáticos com `PRAGMA integrity_check`, rejeição de backups corrompidos (`validateBackupFile` / `restoreBackup`) e recuperação de jobs interrompidos no restart (`INTERRUPTED_ON_RESTART`). |

## 9. Resultados Nível A & Nível B (`scripts/nivel-b-interactive-qa.cjs`)

### 9.1 Nível A (Gates Automatizados & Contrato IPC/DB/ASAR/Visual)
- `npm run test:types`: **PASS** (`tsc --project tsconfig.json --noEmit`)
- `npm run compile`: **PASS** (`tsc` + `build-finance-ledger.cjs` + `build-preload.cjs build`)
- `node scripts/build-preload.cjs check`: **PASS** (`preload em arquivo único, compatível com sandbox`)
- `node scripts/renderer-provenance.cjs check-bundle`: **PASS** (`app.js recompilado virtualmente bate com fontes (31 entradas)`)
- `npm run test:asar`: **PASS** (`1/1` — integridade ASAR + licença React aninhada)
- `npm run test:db`: **PASS** (`985/985`, `fail 0`, `cancelled 0`, `skipped 0` — inclui `tests/release-channel.test.cjs` e `tests/nivel-b-ui-fixes.test.cjs`)
- `npm run test:electron-smoke` + `node scripts/verify-visual-matrix.cjs`: **PASS** (Electron real + `32 entradas JSON, 32 PNGs, 8 áreas, 4 presets, arquivos e dimensões conferidos`)
- `mobile-push` (`npm test`): **PASS** (`133/133`, `fail 0`)
- `npm run provenance:create` && `npm run provenance:verify`: **PASS** (verificado sobre o commit limpo da consolidação; `app/renderer-provenance.json` permanece ignorado em `.gitignore`).

### 9.2 Nível B (QA Interativo Real no Electron via CDP — `MF_QA_SYNTHETIC=1`, perfil TEMP isolado, `PLUGGY_*` e `MF_REAL_PROFILE` ausentes)
- Execução final: **14/14 PASS (`FAIL: 0`, `RuntimeIssues: 0`)** — executado em diretório temporário isolado em `%TEMP%` (removido após inspeção de `report.json` e capturas, fora do repositório git).
- **Jornadas Positivas (`PJ-01`..`PJ-09`)**:
  - `PJ-01` (**PASS**): Startup `PRIVADO`, mascaramento, troca de fonte/período, gráficos/tabela `<details>`, drilldown `B01` + autorização nativa `D05`.
  - `PJ-02` (**PASS**): Lançamento manual D05 (`Padaria Nova QA`), busca/filtros/agrupamento por dia, edição em gaveta (`Padaria Nova Editada QA`, `150,00`) e picker inline D05 em `demo`.
  - `PJ-03` (**PASS**): Revisão bancária (`A conferir` -> `Marcar como revisada` -> `Revisadas`), metadados + alias (`Cafeteria Expresso VIP` + regra) e conciliação manual (`MERCADO UNICO LINK QA` + `Recibo Mercado Manual QA`).
  - `PJ-04` (**PASS**): Categoria personalizada (`Pets QA`), regra `PETSHOP AMIGO -> Pets QA` e teste ao vivo no editor de regras.
  - `PJ-05` (**PASS**): Orçamentos (`Pedem atenção`, busca, drilldown categoria/subcategoria, edição de limite para `R$ 800,00`, aba `Receitas`).
  - `PJ-06` (**PASS**): Planejamento (`Notebook QA` 3x, navegação teclado no Calendário `End`/`Home`, slider SVG `Projeção diária` + `Incluir receitas incertas`, edição `Notebook QA Editado` e trilha de auditoria `Editado`).
  - `PJ-07` (**PASS**): Simulador de compra diário, guarda de desatualização e comparação lado a lado `Referência A` vs `Atual B`.
  - `PJ-08` (**PASS**): Inteligência `B05` + `D01`/`D02`/`D03` (prévia `D01` sem gravação, leitura local, gaveta `Hoje` + Escape + retorno de foco ao opener, consultas `IC2` com totais sintéticos reais, estágios do `Plano de Ação` e `Encerrar leitura`).
  - `PJ-09` (**PASS**): Configurações (reserva `R$ 1.200,00`, tema Claro/Escuro, backup automático), fechamento limpo do Electron, `PRAGMA integrity_check === ok` no SQLite em disco, e reabertura no **mesmo `userData` temporário** com validação integral na **UI DOM** (`1.200,00`, `800,00`, `Notebook QA Editado`, `Padaria Nova Editada QA`, `150,00`, `Cafeteria Expresso VIP`, `Pets QA`, `SUPERMERCADO ALFA QA` em `Revisadas`).
- **Jornadas Negativas (`NJ-01`..`NJ-05`)**:
  - `NJ-01` (**PASS**): Cancelamento seguro com `Escape` em modal manual / etapa `confirm` do picker D05 e `Cancelar` em `window.confirm` de exclusão.
  - `NJ-02` (**PASS**): Bloqueio `personal-locked` em categorização pessoal (`real`), recusa `d05PersonalWriteConfirm` (`status: 'denied'`, `changesApplied: false`, `personalWriteAuthorized: false`), e bloqueio de rede experimental (`aiConnect`, `previewQuarantineDemo`, sincronização Pluggy desabilitada).
  - `NJ-03` (**PASS**): Rejeição de BRL inválido (`10,999`, `-50`, `abc`, `0,00`), proteção de vínculo manual (`Valor`/`Data`/`Excluir` desabilitados), divisão bancária divergente (`Salvar divisão` desabilitado) e proteção contra exclusão de categoria em uso (`Pets QA`).
  - `NJ-04` (**PASS**): Estado sem autorização na Inteligência (`Sem leitura pessoal autorizada`, sem saldo fabricado) e desambiguação obrigatória em `D01` para termo ambíguo (`MERCADO`).
  - `NJ-05` (**PASS**): Rejeição de backup inválido (texto plano, SQLite sem `app_meta`, SQLite com `schema_version = '99'`) e recuperação de `mf_auto_apply_jobs` / `mf_auto_jobs` interrompidos para `INTERRUPTED_ON_RESTART` no restart.

### 9.3 Defeitos Reais de UI Corrigidos Durante o Nível B (+ Regressões em `tests/nivel-b-ui-fixes.test.cjs`)
1. **`src/app.ts` (`App.toggleMode`)**: Alternar entre `real` e `demo` mantinha filtros residuais de `Movimentações`/`Orçamentos` (`txSource: 'bank'`, `bankFilter`, `txCategoryFilter`, `qa84TransactionsSpan`, `qa84TransactionsCategory`, `qa84BudgetDrill`, etc.), ocultando registros manuais no modo `demo`; corrigido com reset completo do escopo transitório em `toggleMode()`.
2. **`src/plan-view.ts` (`pTimeline` `<svg role="slider">`)**: React 16 descarta `tabIndex: 0` em elementos `<svg>` (`tabindex` ausente no DOM, `tabIndex === -1`), impedindo foco e navegação por teclado no gráfico diário; corrigido atribuindo `tabindex="0"` via `ref`, focando no `onPointerDown` e protegendo `setPointerCapture` com `try/catch`.
3. **`app/design-system.css` & `src/app.ts` (`renderPlanModal` sobre `renderPlanDetail`)**: Ao clicar `Editar` dentro da gaveta do Planejamento (`.mf-drawer-backdrop`, `z-index: 450`), `.p-editor-backdrop` herdava `z-index: 30` de `.modal-backdrop` e ficava oculto atrás da gaveta; corrigido adicionando `z-index: 470` em `.p-editor-backdrop` (abaixo de `--mf-z-select-portal: 600` e `.mf-single-calendar: 610`) e posicionando `renderPlanDetail()` antes de `renderPlanModal()`.

## 10. Empacotamento NSIS-Only e Isolamento Seguro para Testes
- **Limpeza NSIS-Only (`portable` descartado)**:
  - `package.json`, `scripts/build-stable-windows.cjs`, `.github/workflows/build-windows.yml` e `scripts/preview-windows-local.ps1` atualizados para gerar **exclusivamente o instalador NSIS x64** (`--win nsis --x64`).
  - **Nenhum EXE/instalador foi gerado nesta etapa** (`dist:windows` não executado).
- **Isolamento de `userData` Exclusivo para `experimentalPackaged` (`electron/release-channel.cjs`, `electron/main.cjs`, `tests/release-channel.test.cjs`)**:
  - `experimentalProfileDirectory(app, options)` aceita `MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR` ou `--user-data-dir=...` **somente** quando `releaseChannel.channel === 'experimental'`.
  - Validação rígida rejeita caminhos relativos, vazios, UNC, raiz, `appData`, segmentos com symlink/junction (`lstatSync`), e qualquer caminho igual ou interno aos diretórios protegidos (`meu-financeiro-desktop`, `Meu Financeiro`, `MeuFinanceiro-RC-ALL-01-Experimental`, `STABLE_NAME`).
  - `stablePackaged` ignora incondicionalmente qualquer variável/argumento de override e sempre usa `stableProfileDirectory(app)` (protegido contra downgrade/corrupção).
  - **Nota de ambiente host (Windows 11 Home)**: `WindowsSandbox.exe` não está disponível nesta edição; perfis preexistentes `%APPDATA%\meu-financeiro-desktop`, `%APPDATA%\Meu Financeiro` e `%APPDATA%\MeuFinanceiro-RC-ALL-01-Experimental` foram estritamente preservados sem leitura ou escrita.

## 11. Matriz Planejada Nível C (Pendente de Autorização Explícita do Proprietário — Etapas 1–13)

| Etapa | Ação Planejada Nível C (Após Aprovação para `dist:windows`) |
|---|---|
| 1 | Pré-condições: checar SHA limpo, `provenance:verify` e ausência de artefatos temporários no workspace. |
| 2 | Gerar instalador experimental NSIS x64 (`--win nsis --x64`, **sem** `portable`) somente após autorização do proprietário. |
| 3 | Validar assinatura/hash SHA-256 do instalador NSIS gerado e manifesto `app.asar` embutido (`npm run provenance:verify` e `npm run test:asar`). |
| 4 | Instalar em caminho de teste isolado (`C:\Dev\mf-nsis-test-install` ou usuário local dedicado, nunca sobrescrevendo `Meu Financeiro` estável sem aprovação). |
| 5 | Executar o app instalado com `MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR=C:\Dev\mf-nsis-test-userdata` e `MF_QA_SYNTHETIC=1`. |
| 6 | Confirmar via Process Explorer / log seguro que `userData` ativo aponta estritamente para `C:\Dev\mf-nsis-test-userdata` e que `meu-financeiro-desktop` / `Meu Financeiro` não foram tocados (timestamps intactos). |
| 7 | Confirmar rejeição de override apontando para diretório protegido ou junction, e isolamento total de `stablePackaged` contra `MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR`. |
| 8 | Executar fumaça interativa no binário instalado (Visão geral, Movimentações D05, Orçamentos, Planejamento, Simulador, Inteligência B05, Configurações). |
| 9 | Validar fechamento limpo, `PRAGMA integrity_check === ok` e reabertura do binário instalado preservando alterações na UI DOM. |
| 10 | Validar desinstalação limpa via `Uninstall Meu Financeiro RC Experimental.exe` sem afetar instalação estável nem perfis pessoais. |
| 11 | Validar fluxo Pluggy/Cloud somente após transição explícita e autorizada para canal estável homologado. |
| 12 | Conferir integridade pós-teste dos diretórios pessoais/RC em `%APPDATA%` e `%LOCALAPPDATA%`. |
| 13 | Registrar parecer final GO/NO-GO para release v1.0.0.


## 12. Iteração 4 — Correções Wave 3 e Polimento (`release-channel.cjs`, `cat02-classifier.cjs`, `src/app.ts`)

- **`electron/release-channel.cjs` (`validateExperimentalOverridePath`, `normalizeForCompare`)**:
  - Rejeição explícita de qualquer segmento (na entrada bruta e no caminho resolvido, excluindo a raiz da unidade) que termine com `.` ou whitespace (`/[.\s]+$/`), comece com whitespace (`/^\s/`), contenha espaços nas extremidades do valor bruto ou corresponda a nomes reservados de dispositivo Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1..9`, `LPT1..9`).
  - Normalização canônica Win32 (`seg.replace(/[. ]+$/, '').toLowerCase()`) aplicada em `normalizeForCompare` (cobrindo `isSameOrInside` e comparação com `appData`) e na checagem de `PROTECTED_SEGMENTS`, bloqueando todas as variantes de ponto/espaço final (ex.: `Meu Financeiro.`, `meu-financeiro-desktop..`, `Meu Financeiro .`, `Meu Financeiro \nested`, `appData.`).
  - Regressão adicionada em `tests/release-channel.test.cjs`.
- **`electron/cat02-classifier.cjs` (`rawProcessorPrefix` & normalização de travessões)**:
  - Normalização de travessões Unicode (`[\u2010-\u2015\u2212] -> '-'`) em `unaccent` e inclusão explícita de `\u2011` / `\u2212` na classe de separadores.
  - Redução do lookahead pós-separador compacto de `{3,}` para 1+ caracteres alfanuméricos (`(?=[a-z0-9])`), inclusão de `uber` nos grupos com separadores `[-–—‑−/]` e captura de tokens de processador precedidos por prefixo bancário separado apenas por espaço (`\b(?:compra|deb|debito|credito|cartao|pgto|pagto)\s+(?:mp|pag|pagseg|ton|pg|uber)\b`), preservando comerciantes legítimos (`UBERLANDIA AUTO POSTO`, `TONELADA SUPERMERCADO`, `PAGAMENTO FACIL DROGARIA`, `REDE DE POSTOS IPIRANGA`).
  - Regressão unitária e E2E (`D05AutoCategorization.plan()`) adicionada em `tests/cat-p0-calibration.test.cjs` (`G6-13`).
- **`src/app.ts` & `app/app.js` (`onGlobalKeydown`, `toggleMode`)**:
  - Em `onGlobalKeydown`: `this.state.planOpen` verificado antes de `this.state.planSelected` no tratamento de `Escape`, e `.p-editor-backdrop [role="dialog"]` / `.modal-backdrop [role="dialog"]` priorizado antes de `.mf-detail-drawer` no aprisionamento de foco `Tab`.
  - Em `toggleMode()`: reset adicional de `budgetFocus: null` e `budgetSearch: ''`.
  - Recompilado `app/app.js` via `npm run compile` e adicionada verificação em `tests/nivel-b-ui-fixes.test.cjs`.

## 13. Iteração 5 — Endurecimento Estrutural (SFN Realpath, Tokenização CAT02 e Cleanup WAL)

- **`electron/release-channel.cjs` (`validateExperimentalOverridePath`, `resolveDeepestExistingAncestor`, `assertAllowedOverrideTarget`)**:
  - Expansão de `WINDOWS_RESERVED_DEVICE` com `conin$` e `conout$`, mais rejeição Win32 explícita de segmentos curtos 8.3 (`WINDOWS_SHORT_NAME_SEGMENT`) e caracteres inválidos (`WINDOWS_INVALID_SEGMENT_CHARS`, incluindo `:` de NTFS ADS).
  - Canonicalização baseada em sistema de arquivos via `resolveDeepestExistingAncestor` (`fs.lstatSync` + `fs.realpathSync.native` até o ancestral existente mais profundo, reanexando `nonExistentTail`) e validação completa pré- e pós-`mkdirSync` (`assertAllowedOverrideTarget` verificando tanto o caminho lexical quanto o resolvido de `appData` e `LOCALAPPDATA`), com rollback seguro via `rmdirSync` somente dos diretórios recém-criados vazios em caso de falha pós-criação.
  - Regressões em `tests/release-channel.test.cjs` usando `fs.realpathSync.native(os.tmpdir())`, cobrindo vetores SFN 8.3 (`MEUFIN~1`, `MEUFIN~1\sub`, `MEU-FI~1`, `Programs\MEUFIN~1\sub`, `PROGRA~1\sub`, `MEUFIN~1.V1`), `CONIN$`/`CONOUT$`, ADS, junctions internas, criação aninhada (`new1\new2`) e rollback.
- **`electron/cat02-classifier.cjs` (`normalizeForIntermediaryScan`, `tokenizeWithSeparators`, `hasIntermediarySignal`)**:
  - Substituição das regexes acopladas por normalização determinística com preservação de separadores (remoção de zero-width `[\u200B-\u200D\uFEFF]`, NFD sem diacríticos e normalização de travessões Unicode) e varredura linear sobre tokens e bigramas (`FULL_INTERMEDIARY_TOKENS`, `BIGRAM_INTERMEDIARY_PAIRS`, `ABBREV_INTERMEDIARY_TOKENS`, `BANK_CARD_PREFIX_TOKENS`, `CONNECTOR_PREPOSITIONS`, `INTERMEDIARY_PUNCT_SEP` e `rede` contextual), incluindo `evidence.receiverName || ''`.
  - Regressão unitária e E2E (`D05AutoCategorization.plan()` + `apply()`) adicionada em `tests/cat-p0-calibration.test.cjs` (`G6-14`).
- **`electron/recovery.cjs` (`restoreBackup` `finally`)**:
  - Limpeza completa dos arquivos auxiliares de staging (`['', '-wal', '-shm']`) no bloco `finally`, espelhando `automaticBackup`, com regressão em `tests/recovery.test.cjs` provando zero sobras `.importacao-*-wal`/`.sqlite-shm` após rejeição de backup WAL corrompido.

## 14. Iteração 6 — Isolamento Cross-Field CAT02, Cleanup Staging WAL/Pre-v7 e Rollback ENOENT

- **`electron/cat02-classifier.cjs` (`hasDescriptorIntermediarySignal`, `extractResidualOutsideMerchant`, `hasTokenSubsequence`, `scanIntermediarySpans`)**:
  - Remoção de caracteres invisíveis `\p{Cf}` / formatadores (`INVISIBLE_FORMAT_RE`, cobrindo `\u2060`, `\u00AD`, `\u034F`, `\u200B-\u200D`, `\uFEFF`) combinada com normalização `NFKD` em `fold` e `normalizeForIntermediaryScan`, fechando iniciais com separadores/compatibilidade (`M\u2060P *`, `\uFF2D\uFF30 *`, `MP\u00B9*`, `M.P *`) e adicionando `99pay` / `99|pay` e sufixos numerados (`MP1*`, `PAG1*`, `TON1*`, `PG1*`, `99PAY1*`, `REDE1*`).
  - Substituição do lookback fixo de 1–2 tokens por **Isolamento Cross-Field do Resíduo do Descritor** (`extractResidualOutsideMerchant` + `hasDescriptorIntermediarySignal`) e alinhamento de fronteira de tokens (`hasTokenSubsequence`), tratando qualquer sigla intermediadora (`mp`, `pag`, `ton`, `pg`) fora de `merchantName`, em posição inicial/final ou adjacente a qualquer separador não-espaço (`/\S/`) como sinal de gateway (`review`), ao mesmo tempo preservando comerciantes legítimos com expressão comercial interior como `DROGARIA PAG MENOS` (`COMPRA CARTAO DROGARIA PAG MENOS`), `PAGAMENTO FACIL DROGARIA`, `TONELADA SUPERMERCADO`, `UBERLANDIA AUTO POSTO`, `REDE DE POSTOS IPIRANGA` e `REDE DE FARMACIAS SAO PAULO`.
  - Regressão unitária (`classifyCandidate`) e E2E (`D05AutoCategorization.plan()` + `apply()`) adicionada em `tests/cat-p0-calibration.test.cjs` (`G6-15`).
- **`electron/db.cjs` & `electron/recovery.cjs` (`FinanceDB` constructor & `restoreBackup`)**:
  - Em `electron/db.cjs`: construtor `FinanceDB(filename, options = {})` envolve todo o ciclo de inicialização e migração (linhas 153–344) em `try/catch` que fecha `this.db` com segurança antes de relançar qualquer erro (evitando vazamento de handle SQLite e `EBUSY` no Windows quando o `probe` ou abertura falha após a checagem de `schema_version`), e aceita `{ skipPreV7Rescue: true }` para não duplicar `.d05-before-v7.sqlite` em arquivos temporários de staging.
  - Em `electron/recovery.cjs`: `restoreBackup` passa `{ skipPreV7Rescue: true }` ao `probe = new FinanceDB(staging, { skipPreV7Rescue: true })`, expande a lista de limpeza no `finally` para `['', '-wal', '-shm', '.d05-before-v7.sqlite', '.d05-before-v7.sqlite-wal', '.d05-before-v7.sqlite-shm']`, e protege cada `fs.rmSync` com `try/catch` individual para não mascarar o erro primário nem interromper a limpeza dos demais sufixos.
  - 3 regressões adicionadas em `tests/recovery.test.cjs` cobrindo falha de `probe` em WAL após `schema_version` (zero `EBUSY` e zero sobras `.importacao-*`), preservação do erro primário sob `EBUSY` simulado em `fs.rmSync`, e restauração limpa de backup WAL pré-v7 (`schema_version=6`) sem sobras `.importacao-*.d05-before-v7.sqlite` (preservando os testes existentes de criação de `.d05-before-v7.sqlite` em `tests/d05-e1-hierarchy.test.cjs`).
- **`electron/release-channel.cjs` (`validateExperimentalOverridePath` rollback)**:
  - Rollback pós-falha em `validateExperimentalOverridePath` atualizado de `catch(_){break;}` para `catch(rmErr){if(rmErr?.code!=='ENOENT')break;}` para concluir a remoção de diretórios pai recém-criados mesmo quando segmentos mais profundos ainda não existiam após falha parcial de `fs.mkdirSync`, com regressão em `tests/release-channel.test.cjs`.
- **Verificação Iteração 6 (`MF_QA_SYNTHETIC=1`)**:
  - `npm run test:types`: **PASS**
  - `node scripts/build-preload.cjs check`: **PASS**
  - `npm run test:asar`: **PASS** (`1/1`)
  - `npm run test:db`: **PASS** (`997/997`, `fail 0`, `cancelled 0`, `skipped 0`)
  - `mobile-push` (`npm test`): **PASS** (`133/133`, `fail 0`)
  - `npm run test:electron-smoke` + `node scripts/verify-visual-matrix.cjs`: **PASS** (`32/32` PNGs, 8 áreas, 4 presets)
  - `node scripts/nivel-b-interactive-qa.cjs`: **PASS** (`14/14` PASS, `FAIL: 0`, `RuntimeIssues: 0`)

## 15. Iteração 7 — Fechamento de Vetores Wave 6 CAT02, PSPs Brasileiros, Truncamento Raw e Preservação `PAG-MENOS`

- **`electron/cat02-classifier.cjs`**:
  - **Prefixos POS/gateway numerados**: `TRAILING_DIGITS_RE` expandida de `\d{1,3}` para `\d+` (`/^([a-z0-9]*[a-z])\d+$/`) e adicionada `LEADING_DIGITS_RE` (`/^\d+([a-z]+)$/`) em `isNumberedIntermediaryToken`, encaminhando para `review` variantes com 4+ dígitos e prefixo numérico (`MP1000*`, `MP1234*`, `PAG1234*`, `TON1234*`, `REDE1234*`, `STONE1234*`, `1MP*`).
  - **Bigrama `"M P"` separado por espaço**: `hasSplitMpBigram` ajustada para detectar `'m'` seguido de `'p'` inclusive com espaço simples (`COMPRA M P PADARIA CENTRAL`, `M P PADARIA CENTRAL`).
  - **Subadquirentes e PSPs brasileiros**: adicionados `'pags'`, `'paygo'`, `'safrapay'`, `'efipay'`, `'gerencianet'`, `'c6pay'`, `'itaupay'`, `'bempaggo'`, `'magalupay'` em `FULL_INTERMEDIARY_TOKENS` e `'m|pago'`, `'pay|go'`, `'safra|pay'`, `'efi|pay'`, `'c6|pay'`, `'itau|pay'` em `BIGRAM_INTERMEDIARY_PAIRS`.
  - **Descritores sujos/aglutinados/truncados em `descriptionRaw` e `merchantName` (`ADV-21..24`, `ADV-27`)**: em `hasDescriptorIntermediarySignal`, executada primeiro a varredura `scanIntermediarySpans(spans)` sobre os spans completos (bloqueando `COMPRA PADARIA MP CENTRAL` com `merchantName` sujo `PADARIA MP CENTRAL` via `seenTxVerb`), adicionada detecção de prefixos aglutinados (`mp`, `pag`, `ton`, `pg`, `rede`, `pix`) sobre `merchantTokens[0]` (`length >= 4`, bloqueando `MPPADARIA CENTRAL` / `PAGPADARIA CENTRAL` em `descriptionRaw`), estendida `extractResidualOutsideMerchant` para também remover runs multi-token com truncamento no último token (`tokens 0..n-2` exatos e `merchantTokens[n-1].startsWith(span.token)` com `span.token.length >= 3`), e adicionados `'parc'`, `'parcela'`, `'parcelas'`, `'loja'`, `'loj'`, `'br'` em `STATEMENT_CHANNEL_TOKENS` (bloqueando `PARC 3X MP PADARIA CENT` e `LOJA 01 MP PADARIA CENT`).
  - **Preservação de `PAG MENOS` / `PAG-MENOS`**: definido o helper `isPagMenosPhrase(spans, i)` e aplicado `!isPagMenosPhrase(spans, i)` tanto em `scanIntermediarySpans` quanto na checagem `NON_SPACE_SEP` de `hasDescriptorIntermediarySignal`, preservando `COMPRA DROGARIA PAG-MENOS`, `descriptionRaw: "DROGARIA PAG-MENOS 10/10"` e `PAG MENOS DROGARIA` em `VERIFIED_DIRECT_MERCHANT_MCC_PARENT` enquanto `COMPRA ONLINE MP DROGARIA PAG MENOS` continua em `review`.
- **`tests/cat-p0-calibration.test.cjs` (`G6-16`)**:
  - Adicionada regressão `G6-16` cobrindo todos os 25 novos vetores de bypass (`ADV-01..ADV-24`, `ADV-27`), PSPs brasileiros adicionais, guarda `COMPRA ONLINE MP DROGARIA PAG MENOS` e os 3 casos legítimos `PAG MENOS` / `PAG-MENOS` (unitário `classifyCandidate` e E2E `D05AutoCategorization.plan()` + `apply()`).
- **Verificação Iteração 7 (`MF_QA_SYNTHETIC=1`)**:
  - `npm run test:types`: **PASS**
  - `node scripts/build-preload.cjs check`: **PASS**
  - `npm run test:asar`: **PASS** (`1/1`)
  - `npm run test:db`: **PASS** (`998/998`, `fail 0`, `cancelled 0`, `skipped 0`)
  - `mobile-push` (`npm test`): **PASS** (`133/133`, `fail 0`)
  - `npm run test:electron-smoke` + `node scripts/verify-visual-matrix.cjs`: **PASS** (`32/32` PNGs, 8 áreas, 4 presets)
  - `node scripts/nivel-b-interactive-qa.cjs`: **PASS** (`14/14` PASS, `FAIL: 0`, `RuntimeIssues: 0`)


## 16. Iteração 8 — Fechamento Wave 7 CAT02 (`NEW-01..23`, `LEG-13..14`), `.agents/` Persistente e Reexecução Integral Nível A/B

- **`electron/cat02-classifier.cjs`**:
  - Adicionado `'pgs'` em `FULL_INTERMEDIARY_TOKENS` e `GLUED_INTERMEDIARY_PREFIXES` (`NEW-19..20`), e adicionadas expressões `ALNUM_POS_RE` e `ALNUM_DIGIT_LEAD_POS_RE` em `isNumberedIntermediaryToken` para detectar terminais POS alfanuméricos como `MP01A*`, `1MP2*` e `PAG1A*` (`NEW-16..18`).
  - Atualizado `isRedeProcessorAt` para exigir separação exclusivamente por espaços após `DE` (`!NON_SPACE_SEP.test(next.sepAfter)` e `!NON_SPACE_SEP.test(curr.sepBefore)`), bloqueando `REDE DE *PADARIA CENTRAL` (`NEW-23`) e preservando `REDE DE POSTOS IPIRANGA` e `REDE DE FARMACIAS SAO PAULO`.
  - Atualizado `hasDescriptorIntermediarySignal` para remover o piso `firstMerchantTok.length >= 4` (permitindo `>= 3` quando único token ou seguido por `merchantTokens[1]`) e reconhecer prefixos colados de `ABBREV_INTERMEDIARY_TOKENS`, `FULL_INTERMEDIARY_TOKENS` e `isNumberedIntermediaryToken` (`NEW-01..10`, como `MPBAR DO JOAO`, `PAGSPADARIA`, `MP1PADARIA`, `STONEPADARIA`, `C6PAYPADARIA`).
  - Estendido `extractResidualOutsideMerchant` com recuperação de descritores truncados no final (`descriptionRaw` com prefixo de estabelecimento precedido por códigos de filial/terminal como `EC 01 MP PADARIA`, `FILIAL 02 MP SUPERMERCADO ALFA`, `001 PAG DROGARIA VIDA`, `AUT 99 TON PADARIA`, `TERM 5 MP AUTO POSTO` — `NEW-11..15`).
  - Bloqueio explícito de tokens isolados `mp` e `pg` em `scanIntermediarySpans` (`NEW-21..22`: `PADARIA MP CENTRAL`, `AUTO POSTO MP BRASIL`) e extensão de `isPagMenosPhrase` com `isInsideTokenSubsequence` para preservar `COMPRA PAG MENOS DROGARIA` e `COMPRA PAG-MENOS DROGARIA` (`LEG-13..14`) mantendo `COMPRA PAG MENOS PADARIA CENTRAL` em `review`.
- **`tests/cat-p0-calibration.test.cjs` (`G6-17`)**:
  - Adicionado teste `G6-17` cobrindo unitário (`classifyCandidate`) e E2E SQLite (`D05AutoCategorization.plan()` + `apply()`) para todos os 23 vetores `NEW-01..23`, controle negativo `COMPRA PAG MENOS PADARIA CENTRAL` e todos os 12 casos legítimos `LEG-01..09`, `LEG-13..15`.
- **Estrutura Persistente `.agents/` & Documentação Canônica**:
  - Criados `.agents/rules/00..03`, `.agents/skills/{qa-guardian-sqlite,forensic-auditor,electron-nivel-b-c-qa,d05-financial-integrity}/SKILL.md` e `.agents/scripts/run_workflow.py`; atualizados `AGENTS.md`, `docs/ROADMAP_MF2.md` e documentos canônicos em `docs/ai-context/`.
- **Verificação Iteração 8 (`MF_QA_SYNTHETIC=1`, Node `v22.23.4`, npm `10.9.9`)**:
  - `python .agents/scripts/run_workflow.py --marco MF1 --stage 01_descoberta`: **PASS**
  - `npm run test:types`: **PASS**
  - `npm run compile`: **PASS**
  - `node scripts/build-preload.cjs check`: **PASS**
  - `node scripts/renderer-provenance.cjs check-bundle`: **PASS** (`31 entradas`)
  - `npm run test:asar`: **PASS** (`1/1`)
  - `npm --prefix mobile-push test`: **PASS** (`133/133`, `fail 0`)
  - `npm run test:db`: **PASS** (`999/999`, `fail 0`, `cancelled 0`, `skipped 0`, `duration_ms 83400.14`)
  - `npm run test:electron-smoke` + `node scripts/verify-visual-matrix.cjs`: **PASS** (`32 entradas JSON, 32 PNGs, 8 áreas, 4 presets, arquivos e dimensões conferidos`)
  - `node scripts/nivel-b-interactive-qa.cjs`: **PASS** (`14/14` jornadas `PJ-01..09`, `NJ-01..05`, `FAIL: 0`, `RuntimeIssues: 0`)

## 17. Iteração 9 — Fechamento Adversarial Wave 8 (`CAT-02`), Higiene NSIS/Docs e Reexecução Integral Nível A/B

- **Origem:** Auditorias independentes (`pro`) sobre o SHA `47c95d79` apontaram `7` classes de contorno no `electron/cat02-classifier.cjs` (`REJECT` do Guardião SQLite) e `5` ajustes menores documentais/CI (`GO` condicional do Auditor Forense).
- **`electron/cat02-classifier.cjs`**:
  - Expansão de `INVISIBLE_FORMAT_RE` (`\u180B-\u180F`, `\u2060-\u206F`, `\u2800` Braille blank, `\uFE00-\uFE0F`, `\u{E0100}-\u{E01EF}`) e remoção geral de diacríticos/combinantes via `\p{Mn}+` em `fold` e `normalizeForIntermediaryScan`.
  - Adição de `mercpag`, `pagbanks`, `sipag`, `stelo` em `FULL_INTERMEDIARY_TOKENS`, `mercado|pag` em `BIGRAM_INTERMEDIARY_PAIRS`, `CONTEXTUAL_INTERMEDIARY_TOKENS` (`vero`, `bin`, `cora`, `pp`, `ml`, `qr`) via `isContextualIntermediaryAt` (com guarda contra falso positivo métrico `/^\d{2,}ml$/`, ex.: `DROGARIA SAUDE 500ML`), e ampliação de `GLUED_INTERMEDIARY_PREFIXES`.
  - Ampliação de `ALNUM_POS_RE` / `ALNUM_DIGIT_LEAD_POS_RE` (`[a-z0-9]*`) e adição de `ALNUM_PREFIX_POS_RE` em `isNumberedIntermediaryToken`, bloqueando `A1MP*`, `EC1MP*` e `MP01ABCDE*`.
  - Bloqueio incondicional de `ton` e `pag` fora de `isPagMenosPhrase` em `scanIntermediarySpans`, impedindo `PADARIA TON CENTRAL`, `PADARIA PAG CENTRAL` e `MERCADO PAG PADARIA CENTRAL` mesmo em `merchantName` sujo sem verbo bancário inicial.
  - Refatoração de `extractResidualOutsideMerchant` (`matchTruncatedMerchantAt`, `isSingleLeadingMerchantIdentifiable`) removendo ocorrências truncadas em qualquer posição interna do `descriptionRaw` (inclusive `k=1` para tokens iniciais `>= 3` chars não stopwords/não intermediários como `BAR`/`SAO`/`TIA`, último token truncado com `>= 2` chars e sufixos pós-corte como `<UF>` ou `10/10`), e eliminação do loop redundante em `hasDescriptorIntermediarySignal`.
  - Substituição da comparação exata `'pix'` por fronteira de palavra `isPixPaymentMethod` (`/\bpix\b/`), bloqueando `paymentMethod: 'PIX QR CODE'` / `'PIX_TRANSFER'` sem afetar `SUPERMERCADO PIXOTE`.
- **`tests/cat-p0-calibration.test.cjs` (`G6-17` `leg-10..12` + `G6-18`)**:
  - Enumeração explícita `leg-10..12` na `G6-17` (`leg-01..15` contínuo) e nova suíte `G6-18` (unitário + E2E SQLite) cobrindo todas as `7` classes Wave 8 + guarda negativa e `19` estabelecimentos brasileiros legítimos (`PASS` sem regressão).
- **Higiene Documental, Workflow & CI NSIS-Only**:
  - Corrigida contagem em `docs/ai-context/GAPS_AND_GATES.md` (`release-channel.test.cjs` `11/11`, 48 asserções).
  - Atualizado `.agents/scripts/run_workflow.py` para responder explicitamente em estágios agênticos (`02_projeto`, `03_implementacao`, `05_correcao`, `07_entrega`).
  - Atualizado `.circleci/build-windows.ps1` para formato exclusivo **NSIS x64** (`1` instalador + `SHA256.txt` = `2` artifacts; preservando contratos de `tests/d1-2-electron-contract.test.cjs` e mantendo `.github/workflows/unified-preview-gate.yml` intacto devido ao contrato de `tests/e1-build-contract.test.cjs`).
- **Verificação Iteração 9 (`MF_QA_SYNTHETIC=1`, Node `v22.23.4`, npm `10.9.9`)**:
  - `python .agents/scripts/run_workflow.py --marco MF1 --stage 01_descoberta`: **PASS**
  - `npm run test:types`: **PASS**
  - `npm run compile`: **PASS**
  - `node scripts/build-preload.cjs check`: **PASS**
  - `node scripts/renderer-provenance.cjs check-bundle`: **PASS** (`31 entradas`)
  - `npm run test:asar`: **PASS** (`1/1`)
  - `npm run test:db`: **PASS** (`1000/1000`, `fail 0`, `cancelled 0`, `skipped 0`, `duration_ms 127237.81`)
  - `npm --prefix mobile-push test`: **PASS** (`133/133`, `fail 0`, `duration_ms 8178.69`)
  - `npm run test:electron-smoke` + `node scripts/verify-visual-matrix.cjs`: **PASS** (`32 entradas JSON, 32 PNGs, 8 áreas, 4 presets, arquivos e dimensões conferidos`)
  - `node scripts/nivel-b-interactive-qa.cjs`: **PASS** (`14/14` jornadas `PJ-01..09`, `NJ-01..05`, `FAIL: 0`, `RuntimeIssues: 0`)

## 18. Iteração 10 — Fechamento Estrutural Wave 9 (`CAT-02`), Preservação `DONA CORA`/`5ML` e Higiene Pré-Push

- **Origem:** Auditorias independentes (`pro`) sobre o SHA `0f632f67` reportaram `8` classes de contorno + regressão de `seenTxVerb`/`ml` em `electron/cat02-classifier.cjs` (`REJECT` do Guardião) e `1` caminho pessoal literal em `.agents/rules/02-worktree-isolation-and-github-memory.md:6` (`HOLD` do Auditor Forense).
- **`electron/cat02-classifier.cjs`**:
  - **Unicode & homóglifos (`normalizeHomoglyphsAndEnclosed`, `\p{Me}`, `hasSplitIntermediaryBigram`)**: mapeamento determinístico de cirílico/grego confusável (`МР`, `РAG`) e símbolos envolvidos/quadrados (`\u{1F130}-\u{1F189}`, ex.: `🅿🅰🅶`), remoção de marcas `\p{Mn}` + `\p{Me}` (`P\u20DDAG`), detecção de bigramas divididos por espaço/NBSP (`m p`, `p g`, `p ix`/`pi x`, `t on`/`to n`, `p ag` fora de `PAG MENOS`) e captura de junções pós-ZWSP (`REDEPAGAMENTOS`, `STONEPAGAMENTOS`).
  - **PSPs/adquirentes & prefixos POS/colados**: adicionados `mercadopag`, `redepagamentos`, `stonepagamentos`, `aiqfome`, `stripe`, `dlocal`, `payu` em `FULL_INTERMEDIARY_TOKENS` / `BIGRAM_INTERMEDIARY_PAIRS` / `GLUED_INTERMEDIARY_PREFIXES`; `ALNUM_PREFIX_POS_RE` e `DIGIT_BEARING_INTERMEDIARY_RE` capturando `CAIXA01MP*`, `FILIAL1MP*`, `A1B2MP*`, `C6PAY1A*`, `199PAY*`, `EC99PAY*`; guarda métrica `/^\d{1,4}ml$/` agora só isenta quando não está em `idx === 0` nem adjacente a pontuação (`5ML` / `500ML` passam, `10ML*` bloqueia); varredura geral de prefixos colados com radical de qualquer token de `merchantTokens` (`MPLA`, `PAGLA`, `MPO REI`, `MPBAR JOAO`, `PAGBAR`, `EC 01 MPPAD CENT`, `MPIPIRANGA`, `MERCADOPAGPADARIA`).
  - **Contextuais & não-regressão (`DONA CORA` / `CORA CORALINA`)**: `vero`/`bin`/`pp`/`ml`/`qr`/`mp`/`pg`/`ton` bloqueados incondicionalmente; `cora` bloqueado exceto dentro de `isLegitCoraPhrase` (`dona|tia|santa cora` ou `cora coralina` dentro de `merchantTokens`), removendo a regressão de `seenTxVerb` pegajoso sobre `COMPRA PADARIA DONA CORA` e `DROGARIA CORA CORALINA`.
  - **`isPagMenosPhrase`, `isRedeProcessorAt`, PIX/BOLETO e `MULTI_SIGNAL_RECONCILED`**: `isPagMenosPhrase` e `isRedeProcessorAt` passaram a exigir presença real de `pag menos` / `rede de` dentro de `merchantTokens` quando disponível (`isInsideMerchantPrefixOrSubsequence`), fechando `EC 01 PAG MENOS PRECO`, `PAG MENOS PREC` e `REDE DE PADARIA CENTRAL`; `isPixPaymentMethod` (`/\bpix(?!ote)\w*/`) e `isNonCardPaymentMethod` (`BOLETO`/transferências) aplicadas em `directCommerce` e compartilhamento de `intermediaryFree` + guarda anti-PIX/intermediário em `hasExternalPair` (`MULTI_SIGNAL_RECONCILED`).
- **`tests/cat-p0-calibration.test.cjs` (`G6-18`)**:
  - Expandida `G6-18` (unitário + E2E SQLite `FinanceDB` + `D05AutoCategorization`) com todos os `44` casos adversariais Wave 9 (incl. `MULTI_SIGNAL_RECONCILED` com PIX+`MERCADO PAGO`) e `23` casos legítimos (incl. `COMPRA PADARIA DONA CORA`, `COMPRA CARTAO PADARIA DONA CORA 10/10`, `COMPRA CARTAO DROGARIA CORA CORALINA` e `COMPRA CARTAO DROGARIA SAUDE 5ML`).
- **Higiene Documental / Repo**:
  - Removido caminho pessoal literal de `.agents/rules/02-worktree-isolation-and-github-memory.md:6` e sincronizados `docs/ROADMAP_MF2.md:9`, `docs/ai-context/ACTIVE_WORK.md:8`, `CURRENT_STATE.md` e `GAPS_AND_GATES.md`.
- **Verificação Iteração 10 (`MF_QA_SYNTHETIC=1`, Node `v22.23.4`, npm `10.9.9`)**:
  - `npm run test:types`: **PASS**
  - `npm run compile`: **PASS**
  - `node scripts/build-preload.cjs check`: **PASS**
  - `node scripts/renderer-provenance.cjs check-bundle`: **PASS** (`31 entradas`)
  - `npm run test:asar`: **PASS** (`1/1`, `duration_ms 226.56`)
  - `npm run test:db`: **PASS** (`1000/1000`, `fail 0`, `cancelled 0`, `skipped 0`, `duration_ms 133805.87`)
  - `npm --prefix mobile-push test`: **PASS** (`133/133`, `fail 0`, `duration_ms 7965.64`)
  - `npm run test:electron-smoke` + `node scripts/verify-visual-matrix.cjs`: **PASS** (`32 entradas JSON, 32 PNGs, 8 áreas, 4 presets, arquivos e dimensões conferidos`)
  - `node scripts/nivel-b-interactive-qa.cjs`: **PASS** (`14/14` jornadas `PJ-01..09`, `NJ-01..05`, `FAIL: 0`, `RuntimeIssues: 0`)

## 19. Iteração 11 — Fechamento Wave 10 (`CAT-02`: Homóglifos Pós-NFKD, Splits `2/3`-Tokens, POS Estendido, Colados e Fluxos Não-Cartão)

- **Origem:** Auditoria forense independente Wave 10 devolveu `GO`, porém o Guardião Financeiro Wave 10 (`3ccc7c16`) devolveu `REJECT` no SHA `dc11fad1` apontando `4` classes adversariais extras (preservando `31/31` regressões Wave 8/9 e `33/33` nomes BR legítimos).
- **`electron/cat02-classifier.cjs`**:
  - **Unicode pós-NFKD (`mapAstralAndStripInvisibles` + `canonicalizeRawText`)**: remoção de `INVISIBLE_FORMAT_RE` e mapeamento de símbolos envolvidos (`\u{1F130}-\u{1F189}`) e Indicadores Regionais (`\u{1F1E6}-\u{1F1FF}`, ex.: `🇲🇵`) antes de `.normalize('NFKD').replace(/[\p{Mn}\p{Me}]+/gu, '')`, aplicando `CONFUSABLE_HOMOGLYPHS` (cirílico/grego com/sem tonos pré-compostos, `\u0131`, `\u0261`, small-caps `\u1D0D\u1D18`, palochka `\u04C0`) **após** a decomposição.
  - **Separador `*` e splits `2/3`-tokens (`hasSplitIntermediaryBigram`)**: captura direta de `norm.includes('*')` em `hasIntermediarySignal` e `hasDescriptorIntermediarySignal`, além de splits de `3` tokens (`p|a|g`, `t|o|n`, `p|i|x`, `b|i|n`, `p|g|s`) e `2` tokens (`p|p`, `m|l`, `q|r`, `b|in`, `ver|o`, `st|one`, `pa|g`, `c|ora` preservando `DONA/TIA/SANTA CORA` e `CORA CORALINA`).
  - **POS estendido & guarda métrica `ml`**: `SUFFIXED_INTERMEDIARY_RE` (`MPBR*`, `MPX*`, `TONBR*`, `PAGBR*`, `VEROBR*`, `C6PAYBR*`, `EC01MPBR*`), `ALNUM_PREFIX_POS_RE` e `DIGIT_BEARING_INTERMEDIARY_RE` suportando prefixos com dígito inicial ou `>8` letras (`01CAIXA02MP*`, `SUPERCAIXA01MP*`, `01CAIXA99PAY*`, `SUPERCAIXA99PAY*`); `/^\d{1,4}ml$/` só é isento quando em posição interna com precedente não-verbo/não-canal/não-numérico e presente em `merchantTokens` (`5ML` e `500ML` passam, `COMPRA 10ML` / `EC 01 10ML` / `10ML*` bloqueiam).
  - **Prefixos, sufixos e infixos colados (`hasDescriptorIntermediarySignal`)**: suporte a radicais colados de `2+` chars (`EC 01 MPLA`, `MPPA CENT`, `MPDR SAO PAULO`, `MPJO`, `MPDO JOAO`, `PAGBARDOJOAO`, `MPPADARIACENTRAL`), sufixos colados (`PADARIA CENTRALMP`, `PADARIAMP CENTRAL`) e infixos colados (`PADARIAMPCENTRAL`), além de remoção de literal `'mercadopag'` duplicado (mantendo único no `Set`).
  - **Fluxos não-cartão e `providerCategory` (`classifyCandidate`)**: `isNonCardPaymentMethod` expandido para capturar variantes sem fronteira final (`BOLETO1`, `BOLETOBANCARIO`, `TED01`) e aplicado também sobre `evidence.operationType` (`BOLETO`, `TED`, `DOC`, `TRANSFERENCIA`, `SAQUE`) e `evidence.providerCategory` (ex.: `Transfer - PIX`), fechando tanto `MULTI_SIGNAL_RECONCILED` quanto `VERIFIED_DIRECT_MERCHANT_MCC_PARENT`.
- **`tests/cat-p0-calibration.test.cjs` (`G6-18`)**:
  - Adicionados `62` novos vetores adversariais Wave 10 em `G6-18` (unitário + E2E SQLite `FinanceDB` + `D05AutoCategorization` com `limit: 500`).
- **Verificação Iteração 11 (`MF_QA_SYNTHETIC=1`, Node `v22.23.4`, npm `10.9.9`)**:
  - `npm run test:types`: **PASS**
  - `npm run compile`: **PASS**
  - `node scripts/build-preload.cjs check`: **PASS**
  - `node scripts/renderer-provenance.cjs check-bundle`: **PASS** (`31 entradas`)
  - `npm run test:asar`: **PASS** (`1/1`, `duration_ms 245.22`)
  - `npm run test:db`: **PASS** (`1000/1000`, `fail 0`, `cancelled 0`, `skipped 0`, `duration_ms 128260.42`)
  - `npm --prefix mobile-push test`: **PASS** (`133/133`, `fail 0`, `duration_ms 7873.94`)
  - `npm run test:electron-smoke` + `node scripts/verify-visual-matrix.cjs`: **PASS** (`32 entradas JSON, 32 PNGs, 8 áreas, 4 presets, arquivos e dimensões conferidos`)
  - `node scripts/nivel-b-interactive-qa.cjs`: **PASS** (`14/14` jornadas `PJ-01..09`, `NJ-01..05`, `FAIL: 0`, `RuntimeIssues: 0`)

## 20. Iteração 12 — Invariantes de Mundo Fechado Wave 11 (`CAT-02`: Anti-Não-ASCII Pós-NFKD, Whitelist de Cartão, Janela Deslizante `2..6` e Wrappers/Colados Universais)

- **Origem:** Auditoria forense independente Wave 11 devolveu `GO`, porém o Guardião Financeiro Wave 11 (`c816b30e`) devolveu `REJECT` no SHA `44cbb417` apontando `4` classes generalizáveis extras (com `63/63` Wave 8/9/10 bloqueados e `31/31` nomes BR reais aprovados).
- **`electron/cat02-classifier.cjs`**:
  - **Unicode fechado (`hasNonAsciiLetterOrSymbol`) & homóglifos**: além da expansão de `CONFUSABLE_HOMOGLYPHS` (`\u03F9`/`\u03F2`, `\u0196`/`\u01C0`/`\u0269`, `\uA7AF`/`\u024A`/`\u024B`, `\u04AE`/`\u04AF`, `\u0474`/`\u0475`, numerais romanos `\u2160-\u217F`), qualquer caractere restante `> 0x7F` em `\p{L}|\p{Nl}|\p{So}` pós-NFKD/`[\p{Mn}\p{Me}]` (exceto `\u00A9`/`\u00AE`) falha para `review` em `hasIntermediarySignal`, `hasDescriptorIntermediarySignal` e `isNonCardPaymentMethod` (português acentuado normalizado decompõe integralmente para ASCII).
  - **Whitelist fechada de fluxo e trilhos não-cartão**: adicionada rejeição `NON_DEBIT_TRANSACTION_TYPE` para `evidence.transactionType && !== 'DEBIT'`; `allowedCardOp` (`CARD_PURCHASE` / `PURCHASE` / ausente) e `NON_CARD_RAIL_RE` (aplicado após `fold` sobre `paymentMethod`, `operationType`, `providerCategory`, `transaction.description`, `evidence.description`, `evidence.descriptionRaw`, junto com `hasIntermediarySignal` em `paymentMethod`/`operationType`/`providerCategory`) bloqueiam `PAGAMENTO_FATURA`, `PAGAMENTO_DE_FATURA`, `AUTOMATIC_DEBIT`, `DIRECT_DEBIT`, `DEBITO_AUTOMATICO`, `WITHDRAWAL`, `QR_CODE`, `MERCADO_PAGO`, `CREDIT` negativo e descrições `BOLETO`/`TED`/`DOC`/`TRANSF` em ambos os caminhos (`MULTI_SIGNAL_RECONCILED` e `VERIFIED_DIRECT_MERCHANT_MCC_PARENT`).
  - **Janela deslizante algorítmica (`hasSplitIntermediaryWindow`)**: substitui enumeração de pares fixos por concatenação de `2..6` tokens adjacentes contra `FULL_INTERMEDIARY_TOKENS`, `ALWAYS_BLOCKED_SHORT_PROCESSORS`, `pag` (exceto `PAG MENOS` legítimo), `cora` (exceto `DONA/TIA/SANTA CORA` / `CORA CORALINA` legítimo) e `rede`, capturando `V ERO`, `S TONE`, `COR A`, `P GS`, `R EDE`, `RE DE`, `V.E.R.O`, `C.O.R.A`, `MER CPAG`, `PI CPAY`, `U BER`, `CI ELO`.
  - **Wrappers POS universais & radicais colados cross-field (`POS_WRAPPED_INTERMEDIARY_RE`, `SAFE_PORTUGUESE_PREFIX_WORDS`, `COMMON_MERCHANT_STEMS`)**: captura combinações `<wrapper>*<base><wrapper>*` mesmo sem dígitos internos (`ECMP`, `POSMP`, `ECPAG`, `ECTON`, `CAIXAMP`, `MPAPP`, `MPLINK`, `MPSP`, `MERCADOPAGOBR`, `EC01MPPAY`, `01CAIXA02MPPOS`) protegendo palavras portuguesas válidas via `SAFE_PORTUGUESE_PREFIX_WORDS`, e generaliza `hasDescriptorIntermediarySignal` (executado também sobre `merchantName`, `merchantBusinessName` e `receiverName`) para prefixos, sufixos e infixos colados inclusive com UF/filial/ometimento de preposição (`MPPADARIACENTRALSP`, `PAGPADARIACENTRAL01`, `MPBARJOAO`, `MPP CENT`, `MPL PADARIA`, `LAMP PADARIA`, `PADARIAVEROCENTRAL`, `PADARIASTONECENTRAL`, `PADARIAMPCE`, `PADARIAMPSP`, `MPPADARIA CENTRAL`, `PADARIA CENTRALMP`).
- **`tests/cat-p0-calibration.test.cjs` (`G6-18`)**:
  - Adicionados `59` vetores adversariais Wave 11 (`w11-01..w11-59`, unitário + E2E SQLite) cobrindo todos os 4 blocos.
- **Verificação Iteração 12 (`MF_QA_SYNTHETIC=1`, Node `v22.23.4`, npm `10.9.9`)**:
  - `npm run test:types`: **PASS**
  - `npm run compile`: **PASS**
  - `node scripts/build-preload.cjs check`: **PASS**
  - `node scripts/renderer-provenance.cjs check-bundle`: **PASS** (`31 entradas`)
  - `npm run test:asar`: **PASS** (`1/1`, `duration_ms 222.92`)
  - `npm run test:db`: **PASS** (`1000/1000`, `fail 0`, `cancelled 0`, `skipped 0`, `duration_ms 136929.25`)
  - `npm --prefix mobile-push test`: **PASS** (`133/133`, `fail 0`, `duration_ms 7991.27`)
  - `npm run test:electron-smoke` + `node scripts/verify-visual-matrix.cjs`: **PASS** (`32 entradas JSON, 32 PNGs, 8 áreas, 4 presets, arquivos e dimensões conferidos`)
  - `node scripts/nivel-b-interactive-qa.cjs`: **PASS** (`14/14` jornadas `PJ-01..09`, `NJ-01..05`, `FAIL: 0`, `RuntimeIssues: 0`)


## 21. Iteração 13 — Fechamento dos 5 Blocos Wave 12 (`cat01-pluggy-evidence.cjs`, `cat02-classifier.cjs` Open-World, 27 UFs e Splits até 24 Tokens)

- **Origem:** Auditoria forense Wave 12 (`52309bf0`) devolveu `GO` sobre o SHA `9833525f`, porém o Guardião Financeiro Wave 12 (`8c7ce4a0`) devolveu `REJECT` apontando `5` classes de contorno restantes (com `202/202` vetores Wave 8–11 bloqueados e `64/64` nomes BR legítimos aprovados).
- **`electron/cat01-pluggy-evidence.cjs`**:
  - Preservação de `receiverName: receiverDocType==='CPF' ? 'CPF_RECEIVER' : clean(receiver.name, 120)` mesmo quando `receiverCnpj` está ausente ou inválido (evitando perda silenciosa de sinais como `{ paymentData: { receiver: { name: 'MERCADO PAGO IP' } } }` sem expor nome de pessoa física com `CPF`), e atualização de `presence.paymentData`.
- **`electron/cat02-classifier.cjs`**:
  - **Open-world para colados (`UNAMBIGUOUS_OPEN_PREFIXES`, `UNAMBIGUOUS_OPEN_SUFFIXES`, `MP_UF_SUFFIX_RE`, `ALPHA_WORD_OR_NUM_TAIL_RE`, `ALPHA_PREFIX_DIGITS_RE`)**: detecção universal sem depender de lista fechada de radicais comerciais mesmo quando `merchant.name` espelha o token sujo (`MPDROGASIL`, `MPCARREFOUR`, `CARREFOURMP`, `DROGASILMP`, `PAGCARREFOUR`, `TONASSAI`, `DROGASILMPCE`, `MPPAD01`, `BOTECOMP01`, `BOTECO01MP`) ou é `null` em `MULTI_SIGNAL_RECONCILED` (`MPLOJA SHELL`, `CARREFOURPAG`), mantendo proteção contra palavras portuguesas válidas via `SAFE_PORTUGUESE_PREFIX_WORDS` expandida (`whatsa`/`supera` excluídos, `ton` fora dos sufixos open-world para preservar `MILTON`/`EVERTON`/`GLADSTONE`).
  - **Todas as 27 UFs BR & POS wrappers completos (`BR_ALL_UFS`, `POS_WRAP_LEFT`, `POS_WRAP_RIGHT`, `POS_WRAP_BASE`, `SUFFIXED_INTERMEDIARY_RE`, `UF_OR_DIGITS_RE`)**: inclusão das 27 UFs em sufixos/direitos (`MPRN`, `MPES`, `PADARIAMPES`, `PADARIA CENTRALMPRN`), wrappers `terminal|balcao|totem|quiosque|venda|vendas|cob|cobranca|gtw|gateway|checkout|chk|sub|ag|agencia` (`TERMINALMP`, `BALCAOMP`, `TOTEMMP`, `QUIOSQUEMP`, `VENDAMP`, `TERMINALTON`), e todos os PSPs completos em `POS_WRAP_BASE` (`STRIPEBR`, `WIRECARDCE`, `TERMINALADYEN`).
  - **Janela deslizante ampliada (`hasSplitIntermediaryWindow`)**: `maxW = Math.min(24, spans.length - i)` (capturando `A I Q F O M E`, `W.I.R.E.C.A.R.D`, `C L O U D W A L K`, `S A F R A P A Y`, `I N F I N I T E P A Y`, `G E R E N C I A N E T`, `M E R C A D O L I V R E`) e remoção de variável redundante `allSameJoined`.
  - **Blindagem de `receiverName` e histórico humano (`verifiedMerchantLabel`, `FULL_INTERMEDIARY_TOKENS`)**: inclusão de `'cpfreceiver'` / `'cpf|receiver'` e exigência de `receiverCnpj` para `receiverName` contar positivamente no histórico humano; unificação de `hasIntermediarySignal` sobre `hasDescriptorIntermediarySignal(raw, [])`.
  - **Trilhos não-cartão colados & `REDE DE` não-ancorado (`NON_CARD_RAIL_RE`, `isRedeProcessorAt`, `allowedCardOp`)**: espaços opcionais em `NON_CARD_RAIL_RE` (`DIRECTDEBIT`, `AUTOMATICDEBIT`, `DEB_AUTOMATICO`, `DEBITOAUTOMATICO`, `PAGFATURA`), exigência de substantivo comercial explícito de rede (`LEGIT_REDE_DE_CHAIN_NOUNS`) quando `merchantTokens` está ausente (bloqueando `REDE DE PADARIA CENTRAL` em `MULTI_SIGNAL_RECONCILED` e preservando `REDE DE POSTOS/FARMACIAS/SUPERMERCADOS`), e alinhamento de `allowedCardOp` com `'card payment'`.
- **`tests/cat-p0-calibration.test.cjs` (`G6-18`)**:
  - Expandida `G6-18` (unitário + E2E SQLite) com `46` novos vetores adversariais (`w12-01..46`), `5` controles legítimos BR (`w12-leg-24..28`, incl. `GLADSTONE`, `MILTON`, `EVERTON` com `CARD_PAYMENT`, `VERONICA`, `EMPORIO ESTAMPA CAMPO GRANDE`) e `3` controles `MULTI_SIGNAL_RECONCILED` sem `merchant.name`.
- **Verificação Iteração 13 (`MF_QA_SYNTHETIC=1`, Node `v22.23.4`, npm `10.9.9`)**:
  - `npm run test:types`: **PASS**
  - `npm run compile`: **PASS**
  - `node scripts/build-preload.cjs check`: **PASS**
  - `node scripts/renderer-provenance.cjs check-bundle`: **PASS** (`31 entradas`)
  - `npm run test:asar`: **PASS** (`1/1`, `duration_ms 223.44`)
  - `npm run test:db`: **PASS** (`1000/1000`, `fail 0`, `cancelled 0`, `skipped 0`, `duration_ms 121294.00`)
  - `npm --prefix mobile-push test`: **PASS** (`133/133`, `fail 0`, `duration_ms 1965.22`)
  - `npm run test:electron-smoke` + `node scripts/verify-visual-matrix.cjs`: **PASS** (`32 entradas JSON, 32 PNGs, 8 áreas, 4 presets`)
  - `node scripts/nivel-b-interactive-qa.cjs`: **PASS** (`14/14` jornadas `PJ-01..09`, `NJ-01..05`, `FAIL: 0`, `RuntimeIssues: 0`)


## 22. Iteração 14 — Fechamento Estrutural das 5 Brechas Wave 13 (`cat01` Não-PII `UNVERIFIED_RECEIVER`, Sincronização Canônica de PSPs/POS/27 UFs e Splits com Borda Colada)

- **Origem:** Auditoria forense Wave 13 (`8a3fa97b`) devolveu `VEREDITO: GO` sobre `ac5f58daffb142a8f62325f0a3a788fc969fb008`, porém o Guardião Financeiro Wave 13 (`d0d7d348`) devolveu `VEREDITO: REJECT` apontando `5` brechas estruturais restantes (todas reproduzidas em `classifyCandidate` + E2E `FinanceDB.ingestBank` -> `D05AutoCategorization.plan()`).
- **`electron/cat01-pluggy-evidence.cjs`**:
  - **Invariante de privacidade e mundo fechado (`UNVERIFIED_RECEIVER`)**: qualquer `paymentData.receiver` sem `receiverCnpj` comercial válido (seja `CPF`, CNPJ inválido ou ausência de `documentNumber`, como `receiver: { name: 'JOAO DA SILVA' }` ou `receiver: { name: 'SOL01MPCE' }`) passa a gravar `receiverName: 'UNVERIFIED_RECEIVER'` em vez de expor nome natural ou permitir contorno open-world no campo `receiver`.
- **`electron/cat02-classifier.cjs`**:
  - **Fontes canônicas únicas (`ALL_INTERMEDIARY_BASES`, `FULL_INTERMEDIARY_SORTED`, `POS_WRAP_BASE`, `SUFFIXED_INTERMEDIARY_RE`, `POS_CONTROL_WORDS`)**: derivação automática a partir dos `Set`s canônicos (sem listas manuais dessincronizadas), incorporando `meli`, `mercadolivre`, `nuvempay`, `99food`, `cornershop`, `unverifiedreceiver`, `box`, `maq`, `maquina`, `maquineta`, `ponto`, `pto`, `centro`, `unid`, `unidade`, `matriz`, `banca`, `stand`, `estande`, além de guarda `posWrapSafeSuffix` + `afterDigits` contra falso positivo em palavras portuguesas válidas com dígitos (`LOJA01PAGAMENTO`, `FILIAL12`, etc.).
  - **Fechamento open-world para dígitos à esquerda/meio e caudas POS/UF/alnum (`hasDescriptorIntermediarySignal`)**: avaliação de variantes sem dígitos à esquerda (`^\d+[a-z]{4,}` -> `01DROGASILMP`, `01BOTECOMP`, `01BOTECOPAG`), stems `^[a-z]{3,}\d+$` (`SOL01MPCE`, `BOX01MPBA`, `TOP01PAGSP`, `VIP01MPCE`, `BOTECO01MP`), `UNAMBIGUOUS_WRAPPED_SUFFIX_RE` + `SAFE_OPEN_MP_UF_SUFFIX_RE` (`BOTECOMP01A`, `BOTECOMPSP01`, `BOTECOMPBR01`, `BOTECOMPPOS`, `BOTECOPAGPOS`, `BOTECOTONSP01`, `BOTECOTON01`, `BOTECOTONBR`, `BOTECOVERO01`, `BOTECOSTONEBR`) e infixos POS/PSPs longos (`BOXMPPADARIA`, `MAQMPPADARIA`, `PONTOMPPADARIA`, `CENTROMPBOTECO`).
  - **Splits com bordas coladas (`hasSplitIntermediaryWindow`)**: suporte a janelas fragmentadas (`2..24` tokens, com `hasShortFragment`) formando identificadores numerados/POS/UF/BR (`M P01`, `EC01M P`, `01M P`, `M PBR`, `M PCE`, `P AG01`, `V ERO01`, `A I Q F O M E01`, `I N F I N I T E P A YBR`, `C 6 P A Y`, `99 F O O D`) enquanto preserva `10/10`, `DONA CORA`, `PAG MENOS` e métricas declaradas (`5ML`/`500ML`).
  - **Trilhos não-cartão e métricas POS (`NON_CARD_RAIL_RE`, `POS_CONTROL_TOKENS`)**: bloqueio de `AUTO_DEBIT`, `AUTODEBIT`, `AUTODEBITO`, `DEBITO_DIRETO`, `DEBITO_EM_CONTA` sem falso positivo em `AUTO POSTO`, e bloqueio de `TERMINAL 10ML` / `EC 10ML` mesmo quando `merchant.name` é `null` em `MULTI_SIGNAL_RECONCILED`.
  - **Melhoria conservadora de recall (`isPagMenosPhrase`, `isLegitCoraPhrase`)**: permissão controlada de hífen espaçado pós-frase (`DROGARIA PAG MENOS - FILIAL 01`, `PADARIA DONA CORA - CENTRO`) sem liberar pontuação acoplada (`*`/`/`/`-palavra`).
- **`tests/cat-p0-calibration.test.cjs` (`G6-18`)**:
  - Expandida `G6-18` (unitário + E2E SQLite) com `51` vetores Wave 13 (`w13-01..51`), `8` controles legítimos BR (`w13-leg-29..36`, incl. `PAG MENOS - FILIAL 01`, `DONA CORA - CENTRO`, `COMPER`, `IMPERATRIZ`, `CAMPINAS`, `OLIMPO`, `MELISSA`, `REDENTOR`) e asserções de não-armazenamento de PII em `normalizePluggyEvidence` (`ev.receiverName === 'UNVERIFIED_RECEIVER'`).
- **Verificação Iteração 14 (`MF_QA_SYNTHETIC=1`, Node `v22.23.4`, npm `10.9.9`)**:
  - `npm run test:types`: **PASS**
  - `npm run compile`: **PASS**
  - `node scripts/build-preload.cjs check`: **PASS**
  - `node scripts/renderer-provenance.cjs check-bundle`: **PASS** (`31 entradas`)
  - `npm run test:asar`: **PASS** (`1/1`, `duration_ms 221.09`)
  - `npm run test:db`: **PASS** (`1000/1000`, `fail 0`, `cancelled 0`, `skipped 0`, `duration_ms 138867.30`)
  - `npm --prefix mobile-push test`: **PASS** (`133/133`, `fail 0`, `duration_ms 1854.61`)
  - `npm run test:electron-smoke` + `node scripts/verify-visual-matrix.cjs`: **PASS** (`32 entradas JSON, 32 PNGs, 8 áreas, 4 presets`)
  - `node scripts/nivel-b-interactive-qa.cjs`: **PASS** (`14/14` jornadas `PJ-01..09`, `NJ-01..05`, `FAIL: 0`, `RuntimeIssues: 0`)
