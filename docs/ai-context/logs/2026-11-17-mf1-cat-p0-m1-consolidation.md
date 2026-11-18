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
