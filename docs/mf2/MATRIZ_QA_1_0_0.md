# Matriz QA — gates da candidata 1.0.0

> **RECONCILIAÇÃO E EVIDÊNCIA ATUAL `1.0.0-rc.1` (19/11/2026):**
> - **M1 homologado tecnicamente (experimental):** [PR #105](https://github.com/JoaoVittorLi/meu-financeiro/pull/105) (`b7a3d8a` Nível C `15/15` em `0.9.5-beta.9`, docs `ffc70f2`). Estado oficial: `M1_IMPLEMENTATION_COMPLETE` · `M1_TECHNICALLY_HOMOLOGATED` · `V1_STABLE_RELEASE_PENDING` · `M2_IN_PROGRESS` (Marco 2 em `feat/mf2-intelligence-3-0-copilot-20261118` @ `e3c153cb00b3bc9c5bc4f7e8e53f296ba98214a6`, não bloqueante para `1.0.0`).
> - **Evidência verificada na candidata estável `release/v1.0.0-rc.1-candidate-20261119` (`1a22181e6adcb52cca214922821b9f265b76c753`, `v1.0.0-rc.1`):**
>   - `npm run test:types`, `npm run compile`, `node scripts/build-preload.cjs check`, `check-bundle` (`31` entradas): **PASS**.
>   - `npm run test:db` (inclui CAT-P0, D05 `14×61`, RC2.2/2.3, `V1-STABLE-01..03`): **1006/1006 PASS** (`0` fail, `0` skipped).
>   - `mobile-push` testes: **133/133 PASS** · `npm run test:asar`: **1/1 PASS** · `npm run provenance:verify`: **PASS** (`23` arquivos) · `npm run test:electron-smoke`: **PASS**.
>   - `dist:windows:stable` + `verify-asar` + `asar-stable-verification.json`: **PASS** (`mfDistributionChannel="stable"`, `productName="Meu Financeiro"`, `d05Parents=14`, `d05Subcategories=61`, `svgGlyphs=67`, `approvedForPersonal=false`, `financialDataEnabled=false`, `paidApiFallback=false`; `MeuFinanceiro-Instalador-1.0.0-rc.1-x64.exe`, `115.734.512` bytes, `SHA-256` `7dd641f3680ee38c34859593af31bb9d336d36793c7a0b320deeba18fb0e352e`).
>   - **Nível C do pacote `stable` no Windows:** **PENDING_ISOLATED_VM** (bloqueado intencionalmente neste host para não colidir com `%LOCALAPPDATA%\Programs\Meu Financeiro` e `%APPDATA%\meu-financeiro-desktop`). Decisão humana GO/NO-GO na [issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71).

---

## Snapshot histórico anterior à integração do PR #105 (17/11/2026 — preservado)

> **DECISÃO P0/OPÇÃO A (17/11/2026):** o proprietário tornou a **categorização automática pessoal por conta** obrigatória para v1.0.0. Código em [PR #100](https://github.com/JoaoVittorLi/meu-financeiro/pull/100) **Draft sobre #96**; consentimento persistente e revogável, D05 14×61, I2-E, backups, recibos e reversão. **Não homologada:** 19 regressões sintéticas versionadas, Node oficial/SQLite integral/TypeScript/Electron Windows/QA visual **NOT_RUN**; v1.0.0 NO-GO. A escrita pessoal da IA para outras ações permanece desativada.

**Atenção:** SHA #96 `2ce62fe...` tem regressões RC2.3, enquanto o código P0 vive em #100, sobre #96. Após integração, **novo SHA** exigirá reexecutar todos os gates pertinentes; não herdar PASS do #94 nem os checks isolados do PR #100.


**QA target:** PR #96 HEAD `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`; **nenhum gate oficial foi executado neste HEAD nesta missão documental**. Evidência anterior do PR #94 `674108e...` é histórica. [Issue QA #65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65).

| Gate / alvo | Comando ou procedimento | Evidência no SHA #96 | Aceite obrigatório |
|---|---|---|---|
| Source freeze | `git rev-parse HEAD`, diff branches #76/#94/#96; sem dirty renderer | NOT_RUN | SHA único registrado, sem novo commit funcional |
| Node/npm | `node --version`, `npm --version`, `npm ci --no-audit --no-fund` | NOT_RUN | 22.23.4 / 10.9.9, install exit 0 |
| TypeScript | `npm run test:types` | NOT_RUN | 0 erros/aviso não mascarado |
| Node/SQLite total | `npm run test:db` | NOT_RUN | Todos testes existentes e novos PASS; contagem real e 0 skip indevido |
| RC2.2 perfil/Pluggy | `node --test tests/rc-all-02-2-continuity.test.cjs` | NOT_RUN | 12 casos: 3 contas/600 sintéticos/cofre/erros/offline/RC |
| RC2.3 backup/migração | `node --test tests/rc-all-02-3-backup.test.cjs` | NOT_RUN | 5 casos: mesma versão, SHA, WAL ativo, imutável, corrupção/link/parcial |
| D05 SQLite v7 | `tests/d05-e1-hierarchy.test.cjs`, `d05-e2-category-service.test.cjs`, `d05-e3-renderer.test.cjs` | NOT_RUN | 14×61/67, FK, splits centavos, rollback, pai/filho, 600+ |
| I2-A/B/C/D/E | `tests/intelligence-i2*.test.cjs`, contratos de grants e quality gate | NOT_RUN | leitura escopada; stale/revoke; sem bypass nem personal writes |
| I3-01 | `node --test tests/i3-01-investigation.test.cjs` | NOT_RUN | períodos comparáveis, centavos, pendências, extrato parcial, follow-ups |
| B01–B05 | `tests/qa84-*.test.cjs`, visual real | NOT_RUN | conformidade com design aprovado sem side effect |
| Bundle/preload | `npm run compile`, `node scripts/build-preload.cjs check` | NOT_RUN | sandbox, 103 métodos públicos, invariantes IPC, sem Node no renderer |
| ASAR e F08 | `npm run test:asar`, `npm run provenance:create && npm run provenance:verify` | NOT_RUN | conteúdo e hashes correspondem ao SHA e source |
| Electron GUI/Windows | `npm run test:electron-smoke` sob perfil descartável | NOT_RUN | 32 PNG; 1366/1920; dark/light; 100/125/150%; navegação/foco |
| B05 composer e redução de movimento | Inspeção humana de Hoje/Conversar/Plano com filtros/grants e viewport baixo | NOT_RUN | uma borda, sem overlap, reduced-motion e fallback correto |
| Stable release channel ASAR | Inspecionar `app.asar/package.json` e `app.getName()` de binário autorizado | NOT_RUN | `mfDistributionChannel=stable`, appId/name estáveis; RC continua isolada |
| Pluggy offline e rollback Windows | Abrir perfil sintético, cofre fictício e SQLite/WAL, simular falha safeStorage, restaurar cópia | NOT_RUN | valores/IDs íntegros, sem segredo exposto ou alteração em perfil real |
| Worker/PWA | `cd mobile-push && npm ci && npm test && npx --no-install wrangler deploy --dry-run` | NOT_RUN | não publicar produção, dados pessoais fora do ambiente |
| Build Windows anterior #94 | GitHub status `ci/circleci: build_windows` | **ERROR no SHA #94**, não #96 | Obter log bruto do job; erro de infra/produto classificado |
| P0 automação #100 (branch separada) | `node --test tests/d05-auto-categorization.test.cjs` e full suite | **19 testes declarados / OFFICIAL_NOT_RUN** | 630+ fictícios, contas separadas, 90 dias, 14×61, I2-E, consentimento, duplicação/repetição, regras, PENDING, splits, erros COMMIT, backup/undo e restauração |
| P0 autorização e segurança | QA Electron Windows e métodos `bank:auto-*` em ASAR real | NOT_RUN | MAIN nativo per-account, default OFF, RC offline; revogar, reentrar, undo, sem grant geral |
| P0 calibração/precisão | Matriz sintética de falsos positivos/negativos, conflitos, contas desconhecidas, amostras parciais | NOT_RUN | 5 correções/3 datas é **limiar provisório**, exige aceite proprietário; heurística local ≠ inferência LLM |
| Publicação/tag | Decisão expressa [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) | NOT_AUTHORIZED | Todos gates aplicáveis + aceite e rollback |

**Nota:** pacote RC normal é offline, enquanto pacote stable tem permissões diferentes; testar ambos com fixture para não confundir falha de integração com restrição deliberada. Nenhum teste de dados pessoais em CI. SHA muda ⇒ invalidar/reexecutar etapas afetadas, atualizar manifesto e não promover PASS herdado.

## Evidências anteriores a preservar

- **PASS histórico #94 SHA `674108e...`:** proprietário reportou TypeScript, 901/901 Node/SQLite, ASAR e F08; status CircleCI preflight_linux success.
- **FAIL/ERROR #94:** build_windows error, causa ainda não identificada em log.
- **SHA #96 `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`:** 10/10 validações de fluxo em V8 com stubs; 5/5 prova isolada SQLite Node 22.16 (não suíte oficial); 17 testes RC2.2+RC2.3 versionados e não rodados no Node oficial.
- Qualquer PASS em código de teste sintético não implica UI real, perfil pessoal ou segurança pós-migração.

## Modelo para relatório oficial

```text
PR/branch:
SHA exato:
OS/Node/npm:
Comando:
Exit code:
PASS / FAIL / NOT_RUN:
Logs e jobs:
Arquivos/contagens:
Artefato ASAR/renderer/PNG + SHA256:
Dados: SOMENTE_SINTÉTICOS
Regressões/dependências:
Decisão: NO-GO / READY_FOR_NEXT_GATE / GO (apenas proprietário)
```

Registro canônico de gate na [issue #65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65) e GO/NO-GO em [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71).

## Gate adicional — CAT P0 duplicidade em evidência de treinamento (#104)

| Teste | Evidência presente | Situação |
|---|---|---|
| `tests/d05-auto-categorization.test.cjs`: 20º cenário, cinco overrides humanos, mas dois são registros potencialmente duplicados (mesma conta, estabelecimento, data e centavos com IDs diferentes) | Teste sintético Node/SQLite versionado no [PR #104](https://github.com/JoaoVittorLi/meu-financeiro/pull/104) | **NOT_RUN no Node 22.23.4** |
| Motor de classificação revalidado no COMMIT: âncoras deduplicadas, I2-E `suspiciousDuplicates`, hash com centavos e nenhuma autoaplicação em caso ambíguo | Código em PR #104, não incorporado em #96 | **NOT_RUN no SHA final** |

O valor **5 correções/3 datas é um requisito de evidência conservador provisório**, não precisão calibrada de um classificador. O GO exige ensaios sintéticos negativos/positivos, análise de falsos positivos e aceitação explícita dos critérios. O Integrador deve congelar um **único writer de auto-categorização** ao conciliar PRs #99/#101/#102 com #100/#104.