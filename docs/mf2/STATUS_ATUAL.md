# Meu Financeiro 2.0 — estado atual (fonte de referência)

> **Atualizado em 16/11/2026 após P0.6 Electron 45.** Este é o painel documental do PR #82 (Draft), **sem merge na main**. Antes de iniciar testes, confira o HEAD vivo do [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76).  
> **Decisão do proprietário:** somente um EXE experimental completo, após D01–D05, I2-A/B/C/D/E, testes oficiais e autorização explícita. **CircleCI, QA Windows e build somente pelo proprietário**.

## Candidata de código integrada

**PR único:** [#76 — RC-ALL-FULL](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), branch `integration/mf2-rc-all-01-i2a-20261113`.

**HEAD de integração publicado:** `1bc1b89bf5bdefc0196b0851e690a99f825ca85a`. É um SHA fixo: revalidar antes do preflight.

**Estado comprovado:** `D01-D05+I2-A/B/C/D/E CODE_INTEGRATED` / `UI_PARTIALLY_FUNCTIONAL` / `LINUX_NOT_RUN` / `PERSONAL_AI_WRITES_DISABLED` / `WINDOWS_NOT_RUN` / `NO_GO_EXE`.

## P0 — primeiro preflight Linux falhou; hotfix publicado

**CircleCI no SHA anterior `25621fb002cc95c212cd12ff48996f92ba8483a7`: FAILED.** [Job de referência](https://app.circleci.com/workflow/523c4484-68d3-4dff-88b9-bb7f6236efcb/job/659806d7-dddc-435e-a466-e6c651555dd3). O Integrador corrigiu código de backup v7, migração/colunas/FKs D05, leitura de IDs, splits I2-A, confirmação concorrente I2-C, reconsulta de recibos sintéticos e compatibilidade dos testes CSV/VM. **Novo SHA candidato `10baa5272a8bb452dc379106d143e5eae8f1b7e8`**, [relatório técnico](https://github.com/JoaoVittorLi/meu-financeiro/blob/integration/mf2-rc-all-01-i2a-20261113/docs/ai-context/RC_ALL_FULL_PREFLIGHT_HOTFIX_20261114.md), [registro na issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71#issuecomment-6878982192).

**107 arquivos de testes Node versionados; execução oficial no novo SHA: NOT_RUN.** Não há evidência de `npm ci`, TypeScript, SQLite, ASAR ou F08 PASS no SHA atualizado. **NO-GO para QA Windows e EXE**, sem escrita pessoal real; CircleCI Linux só pelo proprietário.

## P0.2 — símbolos do bundle, I2-E e FK legadas corrigidos em código

**SHA da rodada anterior P0.2/P0.3:** `10baa5272a8bb452dc379106d143e5eae8f1b7e8`. Base do segundo hotfix: `049537fbe352a3c9b23c883d23cecdfa5f6b91ed`; job CircleCI anterior continua FAILED no SHA `25621fb002cc95c212cd12ff48996f92ba8483a7`.

Regressões resolvidas em arquivos: harness R3 carrega o renderer legado real e confere D04 no `app/app.js`; os harnesses financeiros carregam os verdadeiros módulos V3/D03/IC2; integração B→D→E preserva motor de propostas compartilhado; I2-E distingue qualidade de evidência (`eligible_for_preview`) de autorização D05 pai/filho obrigatória; CSS compact tolera classe D01 adicional; tabelas filhas com FK para `categories_old` são reconstruídas transacionalmente sem tabela-pai fictícia, preservando regras, índice, trigger, valores e restauração `foreign_keys=ON` até em lock.

**Relatório:** [RC_ALL_FULL_SYMBOLS_D05_I2E_HOTFIX_20261114.md](https://github.com/JoaoVittorLi/meu-financeiro/blob/integration/mf2-rc-all-01-i2a-20261113/docs/ai-context/RC_ALL_FULL_SYMBOLS_D05_I2E_HOTFIX_20261114.md) · [issue #71, comentário da correção](https://github.com/JoaoVittorLi/meu-financeiro/issues/71#issuecomment-6879792992).

**Evidência disponível:** sintaxe CJS e ensaio SQLite **local representativo** com Node22.16; **nenhum PASS oficial Node22.23.4/TypeScript/SQLite integral/ASAR/F08/Electron** no HEAD P0.2. **NO-GO EXE**. Repetição CircleCI somente pelo proprietário, sem Windows QA/build automático.

### Complemento P0.2.1 — precisão numérica V3

O SHA 10baa5272a8bb452dc379106d143e5eae8f1b7e8 também corrige comparações V3 com percentuais de base zero e deltas além de inteiros seguros. O renderizador não permite que um valor não verificável seja mostrado como R$0 nem como variação neutra; dois testes de UI foram acrescentados a `tests/int-design-v3.test.cjs` (**33 casos V3 versionados**). Relatório na [issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71#issuecomment-6879891992). **Ainda NOT_RUN no Node oficial, NO-GO EXE.**

## P0.3 — 10 falhas do preflight de 798 testes corrigidas na candidata

**SHA P0.3, substituído pelo P0.4:** `10baa5272a8bb452dc379106d143e5eae8f1b7e8`, PR #76 (Draft). SHA com dez FAIL: `61e2829c2e8a583df17cc52d9abf8c4e299595b1`.

**Causas-raiz corrigidas no código:** (1) reabertura de revisão zerava prévia ainda válida; (2–3–8) escrita manual I2-C iniciava transação SQLite duplicada em vez de compartilhar o COMMIT/recibo; (4) categorias customizadas sem uso eram ocultadas pela paginação built-in; (5) I2-E retornava `ready` sem nenhuma linha bancária na conta/mês; (6) harness do chat R2 omitia `intelligence-visuals.ts` real; (7) proposta pessoal `:memory:` anunciava indevidamente execução sintética; (9) método proativo proibido com campo `opportunityId` lançava exceção de validação em vez de `denied`; (10) a reparação da FK `categories_old` não cobria `subcategories` nem recriava os triggers D05 legítimos.

**Regras financeiras:** `FinanceDB.save` compõe transação/recibo do executor; previews pessoais continuam sem escrita, MAIN `approvedForPersonal:()=>false`. O D05 preserva regras, índices, triggers desconhecidos (não alterados), 14×61, valores e `foreign_keys=ON`; falhas fazem rollback.

**Evidência:** testes de regressão acrescidos/reforçados (I2-C, I2-E, D05 E1, reliability); parser CJS e smoke isolado de funções reais PASS, mas **`npm ci`, `test:types`, `test:db`, `compile`, F08, ASAR e Linux CircleCI no novo SHA NOT_RUN**. Não declarar zero bugs nem GO para EXE. Issue #74 segue aberta.

**Handoff detalhado:** [P0.3 — dez falhas / causas, arquivos e matriz](https://github.com/JoaoVittorLi/meu-financeiro/blob/integration/mf2-rc-all-01-i2a-20261113/docs/ai-context/RC_ALL_FULL_PREFLIGHT_10FAIL_HOTFIX_20261114.md). [Issue #71 — comentário do hotfix](https://github.com/JoaoVittorLi/meu-financeiro/issues/71#issuecomment-6887298562).

## P0.4 — transação I2-B e gatilho fantasma D05

**SHA anterior P0.4 (substituído por P0.5):** `5e244d381ccaad408cb1daf6afa42d9889b7ee08` — substitui `10baa5272a8bb452dc379106d143e5eae8f1b7e8`. O proprietário relatou quatro falhas: I2-B manual `FinanceDB.save` sem transação, RC personal confirm rejeitado por campo nonce, e migração D05 `ALTER TABLE` falhando porque **outro trigger D05** ainda apontava para `categories_old` inexistente.

**Corrigido na branch #76:** executor I2-B agora abre `BEGIN IMMEDIATE` também para transações manuais e comita categoria+recibo atomicamente; pessoal aceita `confirmationNonce` como campo inerte e retorna `denied`, sem liberar escrita; D05 remove **apenas triggers D05 conhecidos e obsoletos** antes de reconstruir FKs filhas, recriando-os a partir do código canônico na mesma transação. Custom triggers, saldos e taxonomia preservados; checagem FK + integridade exigida.

**Evidência:** novos testes versionados de rollback com receipt fault e de confirmação pessoal negada; teste legado `reliability` agora demonstra o trigger `categories_old` antes de reparar. Cenários representativos em SQLite real Node 22.16.0 **PASS pontual** (FK reparada, valores/índice/triggers mantidos; falha de recibo causa rollback), parser CJS PASS. **Node22.23.4 / `npm ci`, `test:types`, `test:db`, `compile`, F08, ASAR, CircleCI no novo HEAD NOT_RUN**; resultado oficial Linux ainda pendente. **NO-GO EXE**.

[Relatório técnico completo P0.4](https://github.com/JoaoVittorLi/meu-financeiro/blob/integration/mf2-rc-all-01-i2a-20261113/docs/ai-context/RC_ALL_FULL_PREFLIGHT_4FAIL_HOTFIX_20261114.md) · [Issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71#issuecomment-6887872132).

## P0.5 — Colunas de transferência pessoal v6 × banco D05 v7 (11 FAIL)

**SHA anterior P0.5, substituído pelo P0.6:** `d12a14a35910e4edf089fe6e2d3ea59f3301d177`, PR #76 Draft. SHA anterior com falhas reportadas: `5e244d381ccaad408cb1daf6afa42d9889b7ee08`.

**Causa-raiz:** snapshot Electron inclui colunas físicas D05 v7, porém o validador e a transferência pessoal Cloudflare exigiam v6. A diferença começava nas 10 colunas reais de `transactions` (em vez das oito antigas), e mais cinco tabelas tinham novos IDs e campos. Erro precoce de colunas mascarava falhas específicas de hash, contagem, duplicação e tipo.

**Correções versionadas:** `PERSONAL_COLUMNS` de **17 tabelas** agora coincide exatamente com o DDL Electron/Planning e D05; `schemaVersion=7` único no snapshot, transfer-plan, lote Cloudflare, validador, E1 e fixtures de 17/207 registros. Campos D05 nulos válidos; pai duplicado/ausente e filho sem pai rejeitados; versões v6 rejeitadas. Não se relaxa validação de checksum e colunas extras.

**Limite de segurança:** subcategorias D05 (61 filhos) **não são exportadas no contrato de quarentena de 17 tabelas**, portanto nenhuma migração definitiva/cutover pode ser autorizada. Transferência real no desktop continua desativada, Windows e dados pessoais não alterados, issue #74 aberta.

**Evidências:** **17/17 layouts MATCH em conferência estática de DDL e ordem**, V8 sintático PASS em 11 arquivos, validador isolado aceitou fixture fake e negou v6/colunas incompletas/`clientSecret` (SHA **simulado nesse ensaio**, não prova hash real). Regressões adicionadas em cinco suítes reais. **Node22.23.4, `npm ci`, `test:types`, `test:db`, `compile`, proveniência/F08, ASAR, `mobile-push npm test` e novo CircleCI NOT_RUN**. **NO-GO EXE**.

[Relatório P0.5 completo](https://github.com/JoaoVittorLi/meu-financeiro/blob/integration/mf2-rc-all-01-i2a-20261113/docs/ai-context/RC_ALL_FULL_PERSONAL_TRANSFER_SCHEMA_V7_HOTFIX_20261115.md) · [Issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71#issuecomment-6888555179).

## P0.6 — Electron 45 sandbox preload e preparação para QA Windows

**HEAD congelado do PR #76:** `1bc1b89bf5bdefc0196b0851e690a99f825ca85a`. Foi incorporado por fast-forward protegido o PR #83 (`aa06a24042a52eef2a5ec13ba023949391eaa2ad`), 6 arquivos, sem divergência, preservando D01–D05/I2-A/B/C/D/E. Novo teste adicional confirma equivalência de API original vs bundle e integridade byte a byte de preload/ícones no ASAR de teste.

**Correção da inicialização:** `npm run compile` constrói `electron/preload-bundled.cjs` determinístico e `BrowserWindow` carrega esse arquivo com `sandbox:true`, `contextIsolation:true` e `nodeIntegration:false`; nenhum `require` local. Verificados 103 métodos públicos, dos quais 26 D05; catálogos 14×61, 67 glyphs sem referências faltantes; `build.files` inclui `electron/**/*` e `shared/**/*`.

**Gates:** 806/806, F08, ASAR e preload reportados pelo proprietário para PR #83 **em Node24.22.2**, não certificam o novo HEAD no Node22.23.4. Na integração foram executadas somente inspeção GitHub, validação estática e teste isolado do preload em V8 com IPC simulado. **Node22.23.4/npm10.9.9, `npm ci`, `test:types`, `test:db`, `compile`, F08, ASAR de suíte e Windows QA NOT_RUN no SHA P0.6**. A ausência de check não é PASS. Nenhum EXE.

**QA Windows aguardando autorização/proprietário:** iniciar CircleCI na branch `integration/mf2-rc-all-01-i2a-20261113`, `CIRCLE_SHA1=1bc1b89bf5bdefc0196b0851e690a99f825ca85a`, `run_preflight=false`, `run_windows_qa=true`, `run_windows_build=false`. A workflow executa `preflight_linux` obrigatoriamente antes de `qa_windows`; realiza 8 áreas × 4 presets = 32 PNG, backups/SQLite isolados e relatório visual. Artefatos em `circleci-qa-artifacts`. QA SUCCESS exige revisão visual humana antes de autorização separada de EXE.

**Segurança:** RC empacotado tem `appId`/userData próprio (`MeuFinanceiro-RC-ALL-01-Experimental`), dados reais Windows/Cloud/Pluggy preservados e IA pessoal sem permissão de escrita; #74 OPEN. **READY FOR OWNER AUTHORIZED WINDOWS QA / NO-GO EXE**.

[Issue #71 — P0.6](https://github.com/JoaoVittorLi/meu-financeiro/issues/71#issuecomment-6916773677) · [Issue #65 — QA](https://github.com/JoaoVittorLi/meu-financeiro/issues/65#issuecomment-6916775913)

## Matriz de frentes e evidências

| Entrega | Fonte e estado no PR #76 | TESTED no HEAD | Observação de disponibilidade |
|---|---|---|---|
| D01–D04 + 26 renderers | Cadeia #54→#60→#63→#68→#73 mantida no #76 | NOT_RUN | UI pré-existente preservada |
| I2-A / IC2-READ-QUERY | Backend/IPC/chat no #76 | NOT_RUN | Somente leitura, grants e perfil |
| I2-B/I2-C | #75/#78 importados no #76 | NOT_RUN | Categorias e laboratório sintético; nenhuma escrita financeira pessoal pela IA |
| D05 E1/E2/E3 | #81 HEAD `316a818fcdd6a6227e3d00352de0822d1c3d5017`, 19 arquivos incorporados via ancestry exata | NOT_RUN | SQLite v7, 14 pais, 61 filhos, 67 SVG, React16, MAIN/preload/UI |
| I2-D | #79 HEAD `fd5aca036ae96ca3aef99be752a2bfdeb9750688` | NOT_RUN | Módulos exclusivos importados, via gateway de qualidade E |
| I2-E | #80 HEAD `c56675d02f6d1b5ac9074fb9039aad3d74ff81e1` | NOT_RUN | Quality Gate obrigatório, conta MAIN, evidência/seleção D05 por IDs na Central de Revisão |
| Escrita pessoal supervisionada separada de I2-C | `electron/d05-personal-gate.cjs` e IPC nomeado no #76 | NOT_RUN | Backend com preview/nonce/backup/COMMIT/recibo/recovery; **flag MAIN `approvedForPersonal:()=>false`**, sem liberação real |
| CSV D05 | `src/d05-csv.ts` e `src/app.ts` integrados | NOT_RUN | Prévia completa, SHA256, duplicatas, proteção de fórmula e backup manual obrigatório |
| QA oficial Linux + Windows | [#65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65) | NOT_RUN | Nenhuma prova oficial de compilação no SHA atual; screenshots reais indisponíveis |
| Primeiro EXE Windows | [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) | NO-GO | Nenhum instalador autorizado, gerado ou homologado |

**Matriz técnica por funcionalidade:** [RC_ALL_FULL_GATE1_MATRIX_20261114.md](https://github.com/JoaoVittorLi/meu-financeiro/blob/integration/mf2-rc-all-01-i2a-20261113/docs/ai-context/RC_ALL_FULL_GATE1_MATRIX_20261114.md).

## Bloqueios até GO

1. **Préflight Linux no HEAD da RC ainda não executado.** `test:types`, `test:db`, `compile`, proveniência/F08 e ASAR precisam PASS em Node oficial, inclusive 21 testes D05, 48 I2-D/E e regressões completas. Há **107 arquivos** de testes Node versionados no GitHub, mas versão não significa PASS.
2. **QA Electron Windows real** 1366×768 e 1920×1080 em claro/escuro e screenshots autênticos NOT_RUN; verificar 67 SVGs, seletor, indicadores, POSTED/PENDING, persistência, filtros e lote.
3. **Escritas pessoais reais/bancárias por IA desligadas até homologação e nova autorização.** A D05 individual e o lote exibem prévias, mas commits em dados reais não devem ser anunciados como disponíveis. O backend de supervisão não deve ser confundido com autorização do proprietário.
4. **Nem todos os controles de regras, splits e planejamento D05 são formulários independentes na E3.** Serviços SQLite/IPC existem; a UI precisa homologação dirigida para declarar paridade.
5. **CSV necessita QA de importação/restore e segurança** (inclui backup manual; não há recibo atômico próprio da importação CSV).
6. **Banco experimental** isolado do Windows instalado (`MeuFinanceiro-RC-ALL-01-Experimental`, appId próprio), offline em packaged; sem importação bancária automática, nenhum deploy/LLM pago.
7. Issue [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74) continua **OPEN/BLOQUEANTE** até QA. PR #81 é fonte de código; **não iniciar novas features**.

## SHAs de fontes confirmados em 14/11/2026

| PR | SHA |
|---|---|
| [#76 integração final](https://github.com/JoaoVittorLi/meu-financeiro/pull/76) | `1bc1b89bf5bdefc0196b0851e690a99f825ca85a` |
| [#81 D05](https://github.com/JoaoVittorLi/meu-financeiro/pull/81) | `316a818fcdd6a6227e3d00352de0822d1c3d5017` |
| [#79 I2-D](https://github.com/JoaoVittorLi/meu-financeiro/pull/79) | `fd5aca036ae96ca3aef99be752a2bfdeb9750688` |
| [#80 I2-E](https://github.com/JoaoVittorLi/meu-financeiro/pull/80) | `c56675d02f6d1b5ac9074fb9039aad3d74ff81e1` |
| [#57 Design D05](https://github.com/JoaoVittorLi/meu-financeiro/pull/57) | `f93497a86a50470ed3e86bd4c3e3250b2396ab5a` |

## Próximo passo e proprietários dos gates

**Ação única imediata do proprietário:** CircleCI branch `integration/mf2-rc-all-01-i2a-20261113` e SHA do PR #76 acima:

```yaml
run_preflight: true
run_windows_qa: false
run_windows_build: false
```

Devolver URL+ID da pipeline, SHA real `CIRCLE_SHA1`, PASS/FAIL por etapa e primeira falha completa. Em caso de FAIL, corrigir apenas regressões concretas no mesmo #76 e publicar outro SHA, sem novas features. QA Windows somente após Linux PASS e nova autorização. Build NSIS/Portable somente após QA/GO e outra autorização explícita.

**Coordenação de código:** [#49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49) · **QA:** [#65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65) · **Release:** [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) · **Documentos e trilha:** [PR #82](https://github.com/JoaoVittorLi/meu-financeiro/pull/82).

> **Não confundir:** parser V8 e comparação GitHub PASS não representam Node, SQLite, TypeScript, Electron ou EXE PASS. Sem merge main, CI autônomo, produção, importação pessoal ou API paga.
