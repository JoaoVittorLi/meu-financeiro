# Meu Financeiro 2.0 — estado atual (fonte de referência)

> **Atualizado em 14/11/2026 após o Gate 1 de integração.** Este é o painel documental do PR #82 (Draft), **sem merge na main**. Antes de iniciar testes, confira o HEAD vivo do [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76).  
> **Decisão do proprietário:** somente um EXE experimental completo, após D01–D05, I2-A/B/C/D/E, testes oficiais e autorização explícita. **CircleCI, QA Windows e build somente pelo proprietário**.

## Candidata de código integrada

**PR único:** [#76 — RC-ALL-FULL](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), branch `integration/mf2-rc-all-01-i2a-20261113`.

**HEAD de integração publicado:** `10baa5272a8bb452dc379106d143e5eae8f1b7e8`. É um SHA fixo: revalidar antes do preflight.

**Estado comprovado:** `D01-D05+I2-A/B/C/D/E CODE_INTEGRATED` / `UI_PARTIALLY_FUNCTIONAL` / `LINUX_NOT_RUN` / `PERSONAL_AI_WRITES_DISABLED` / `WINDOWS_NOT_RUN` / `NO_GO_EXE`.

## P0 — primeiro preflight Linux falhou; hotfix publicado

**CircleCI no SHA anterior `25621fb002cc95c212cd12ff48996f92ba8483a7`: FAILED.** [Job de referência](https://app.circleci.com/workflow/523c4484-68d3-4dff-88b9-bb7f6236efcb/job/659806d7-dddc-435e-a466-e6c651555dd3). O Integrador corrigiu código de backup v7, migração/colunas/FKs D05, leitura de IDs, splits I2-A, confirmação concorrente I2-C, reconsulta de recibos sintéticos e compatibilidade dos testes CSV/VM. **Novo SHA candidato `10baa5272a8bb452dc379106d143e5eae8f1b7e8`**, [relatório técnico](https://github.com/JoaoVittorLi/meu-financeiro/blob/integration/mf2-rc-all-01-i2a-20261113/docs/ai-context/RC_ALL_FULL_PREFLIGHT_HOTFIX_20261114.md), [registro na issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71#issuecomment-6878982192).

**107 arquivos de testes Node versionados; execução oficial no novo SHA: NOT_RUN.** Não há evidência de `npm ci`, TypeScript, SQLite, ASAR ou F08 PASS no SHA atualizado. **NO-GO para QA Windows e EXE**, sem escrita pessoal real; CircleCI Linux só pelo proprietário.

## P0.2 — símbolos do bundle, I2-E e FK legadas corrigidos em código

**Novo HEAD exato do PR #76:** `10baa5272a8bb452dc379106d143e5eae8f1b7e8`. Base do segundo hotfix: `049537fbe352a3c9b23c883d23cecdfa5f6b91ed`; job CircleCI anterior continua FAILED no SHA `25621fb002cc95c212cd12ff48996f92ba8483a7`.

Regressões resolvidas em arquivos: harness R3 carrega o renderer legado real e confere D04 no `app/app.js`; os harnesses financeiros carregam os verdadeiros módulos V3/D03/IC2; integração B→D→E preserva motor de propostas compartilhado; I2-E distingue qualidade de evidência (`eligible_for_preview`) de autorização D05 pai/filho obrigatória; CSS compact tolera classe D01 adicional; tabelas filhas com FK para `categories_old` são reconstruídas transacionalmente sem tabela-pai fictícia, preservando regras, índice, trigger, valores e restauração `foreign_keys=ON` até em lock.

**Relatório:** [RC_ALL_FULL_SYMBOLS_D05_I2E_HOTFIX_20261114.md](https://github.com/JoaoVittorLi/meu-financeiro/blob/integration/mf2-rc-all-01-i2a-20261113/docs/ai-context/RC_ALL_FULL_SYMBOLS_D05_I2E_HOTFIX_20261114.md) · [issue #71, comentário da correção](https://github.com/JoaoVittorLi/meu-financeiro/issues/71#issuecomment-6879792992).

**Evidência disponível:** sintaxe CJS e ensaio SQLite **local representativo** com Node22.16; **nenhum PASS oficial Node22.23.4/TypeScript/SQLite integral/ASAR/F08/Electron** no HEAD P0.2. **NO-GO EXE**. Repetição CircleCI somente pelo proprietário, sem Windows QA/build automático.

### Complemento P0.2.1 — precisão numérica V3

O SHA 10baa5272a8bb452dc379106d143e5eae8f1b7e8 também corrige comparações V3 com percentuais de base zero e deltas além de inteiros seguros. O renderizador não permite que um valor não verificável seja mostrado como R$0 nem como variação neutra; dois testes de UI foram acrescentados a `tests/int-design-v3.test.cjs` (**33 casos V3 versionados**). Relatório na [issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71#issuecomment-6879891992). **Ainda NOT_RUN no Node oficial, NO-GO EXE.**

## P0.3 — 10 falhas do preflight de 798 testes corrigidas na candidata

**Novo HEAD para próximo Linux:** `10baa5272a8bb452dc379106d143e5eae8f1b7e8`, PR #76 (Draft). SHA com dez FAIL: `61e2829c2e8a583df17cc52d9abf8c4e299595b1`.

**Causas-raiz corrigidas no código:** (1) reabertura de revisão zerava prévia ainda válida; (2–3–8) escrita manual I2-C iniciava transação SQLite duplicada em vez de compartilhar o COMMIT/recibo; (4) categorias customizadas sem uso eram ocultadas pela paginação built-in; (5) I2-E retornava `ready` sem nenhuma linha bancária na conta/mês; (6) harness do chat R2 omitia `intelligence-visuals.ts` real; (7) proposta pessoal `:memory:` anunciava indevidamente execução sintética; (9) método proativo proibido com campo `opportunityId` lançava exceção de validação em vez de `denied`; (10) a reparação da FK `categories_old` não cobria `subcategories` nem recriava os triggers D05 legítimos.

**Regras financeiras:** `FinanceDB.save` compõe transação/recibo do executor; previews pessoais continuam sem escrita, MAIN `approvedForPersonal:()=>false`. O D05 preserva regras, índices, triggers desconhecidos (não alterados), 14×61, valores e `foreign_keys=ON`; falhas fazem rollback.

**Evidência:** testes de regressão acrescidos/reforçados (I2-C, I2-E, D05 E1, reliability); parser CJS e smoke isolado de funções reais PASS, mas **`npm ci`, `test:types`, `test:db`, `compile`, F08, ASAR e Linux CircleCI no novo SHA NOT_RUN**. Não declarar zero bugs nem GO para EXE. Issue #74 segue aberta.

**Handoff detalhado:** [P0.3 — dez falhas / causas, arquivos e matriz](https://github.com/JoaoVittorLi/meu-financeiro/blob/integration/mf2-rc-all-01-i2a-20261113/docs/ai-context/RC_ALL_FULL_PREFLIGHT_10FAIL_HOTFIX_20261114.md). [Issue #71 — comentário do hotfix](https://github.com/JoaoVittorLi/meu-financeiro/issues/71#issuecomment-6887298562).

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
| [#76 integração final](https://github.com/JoaoVittorLi/meu-financeiro/pull/76) | `10baa5272a8bb452dc379106d143e5eae8f1b7e8` |
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
