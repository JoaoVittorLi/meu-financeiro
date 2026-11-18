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
