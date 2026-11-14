# RC-ALL-FULL — Gate 1 | Matriz de código, UI, autorização e evidências (14/11/2026)

**PR único de integração:** #76 — branch `integration/mf2-rc-all-01-i2a-20261113`. **SHA de referência:** verificar HEAD corrente no PR #76 (nunca reutilizar SHAs antigos sem conferir).  
**Decisão do proprietário:** nenhuma nova feature. Unir D01–D05 + I2-A/B/C/D/E e somente depois executar QA e pedir GO/NO-GO. **Sem CI/EXE/merge main automático**. Issue #74 continua aberta.

## Fontes realmente integradas

- **D01–D04**: cadeia #54→#60→#63→#68→#73, preservada na base de #76. Inclui 26 renderers e garantia de grants/identidade.
- **I2-A/B/C**: código e testes já presentes em #76, IC2-READ-QUERY v2, gateway I2-B/C e executor atômico **exclusivamente SQLite sintético**.
- **D05 E1/E2/E3**: PR **#81**, HEAD `316a818fcdd6a6227e3d00352de0822d1c3d5017`, 19 arquivos específicos; o PR #81 era descendente exato da RC anterior, incorporado por avanço de branch após inspeção do diff. Migrador SQLite v7, `FinanceDB`, `PlanningStore`, 14 pais/61 filhos com IDs, 67 SVGs, D05 category service, adaptador, React 16 class renderer, CSS, rota real, testes E1/E2/E3 e handoffs.
- **I2-D**: PR **#79**, HEAD `fd5aca036ae96ca3aef99be752a2bfdeb9750688`, **exatamente os módulos exclusivos** `electron/intelligence-category-opportunities.cjs` e `electron/intelligence-category-advisor-bridge.cjs`, `tests/intelligence-i2d.test.cjs`, doc; sem reimportar B1/C2/IC2.
- **I2-E**: PR **#80**, HEAD `c56675d02f6d1b5ac9074fb9039aad3d74ff81e1`, `electron/intelligence-category-quality.cjs` + `electron/intelligence-category-quality-bridge.cjs` + `tests/intelligence-i2e.test.cjs` + 2 docs; integrados por SHA de blob, não merge cego das branches empilhadas.

## Matriz exigida

| Funcionalidade | CODE_PRESENT | UI_CONNECTED | TESTED (SHA final) | PERSONAL_WRITE_AUTHORIZED |
|---|---|---|---|---|
| D01 Visão Geral premium | YES | YES, rota existente | NOT_RUN | N/A (manual existente) |
| D02 26 renderers e IC-v1 | YES | YES, chat existente | NOT_RUN | NO |
| D03 Inteligência Hoje V2 | YES | YES, painel existente | NOT_RUN | NO |
| D04 Central de Revisão V1.1 | YES | YES, UI existente; legacy review service pode estar desativado em packaged | NOT_RUN | NO |
| I2-A IC2 consultas/follow-ups | YES | YES, MAIN/preload/chat | NOT_RUN | NO |
| I2-B catálogo/duplicidades/propostas | YES | YES, D04, leitura pessoal + laboratório sintético | NOT_RUN | NO |
| I2-C confirmação atômica e recibos sintéticos | YES | YES, D04 e MAIN; somente vault TEMP | NOT_RUN | NO (só synthetic) |
| D05 E1 hierarquia v7, 14×61 | YES | YES, consumida por D05 E3 | NOT_RUN | NO AI write |
| D05 E2 catálogo, resolve, lista manual/banco | YES | YES, `installD05Ipc` no MAIN + grant no preload | NOT_RUN | N/A read |
| D05 E2 mutações manual custom, subcategoria | YES | YES, IPCs e UI; demo isolada confirmada por MAIN, real negado | NOT_RUN | NO real |
| D05 E2 classificação bancária individual | YES | YES para **prévia supervisionada** (D05+MAIN); aplicação real **bloqueada** | NOT_RUN | NO real |
| D05 E2 lote bancário 2 etapas/previewVersion | YES | YES, D05 E3 e E2 IPC; **commit real bloqueado** até QA | NOT_RUN | NO real |
| D05 E2 regras/splits/planejamento hierárquicos | YES | YES, serviços E2 e métodos de preload; nem todos os formulários específicos E3 foram montados | NOT_RUN | NO real |
| D05 E3 67 SVG, 4 métricas, busca, filtros, icon picker, PENDING e POSTED | YES | YES, `renderMovements` em React16 class | NOT_RUN Electron | N/A read |
| D05 E3 CSV seguro e completo | YES | YES: parser RFC4180, SHA-256, linha a linha, duplicatas, backup antes de `finance:save`; não há recibo atômico próprio CSV | NOT_RUN | Manual confirmado existente; AI NO |
| I2-D diagnóstico proativo | YES | YES via camada I2-E obrigatória, D04 | NOT_RUN | NO |
| I2-E evidência/qualidade/inspeção | YES | YES, MAIN conta autorizada + D04 seletor explícito D05 | NOT_RUN | NO |
| I2-E `qualityDraft/qualityCompose` com IDs D05 | YES | YES: somente prévia validada por `categoryId,subcategoryId` e digest; nunca auto-commit | NOT_RUN | NO |
| Gateway D05 para escrita pessoal supervisionada **separado** de I2-C | YES | IPCs nomeados no preload e MAIN; confirmação real **desativada**, sem botão que a habilite | NOT_RUN (6 testes sintéticos publicados) | **NO, hard-disabled** |
| Backup/migração/restore/rollback/recibo | YES | Caminhos reais nos serviços; restore/backup do app preservados; automação pessoal não habilitada | NOT_RUN SQLite completo | NO real |
| Offline e isolamento do EXE experimental | YES | Início do packaged muda appId/userData antes do DB e bloqueia cloud/Pluggy/IA paga | NOT_RUN packaged | NO produção |

## Contratos e segurança efetivamente ligados

- **MAIN D05:** `electron/main.cjs` instala `installD05Ipc({finance:()=>db,requireAppSender,authorizeRead,authorizeWrite})`. Valida remetente `file://app/index.html`, owner pelo `webContents.id`, token de sessão de perfil expira/revoga, leitura manual/banco conforme perfil, confirmação nativa e teste isolado para ações permitidas. A factory dinâmica é necessária após restore.
- **Preload:** `createD05PreloadBridge()` integrado dentro do `financeDesktop` preexistente, métodos nomeados, token guardado na closure; **sem IPC genérico**.
- **AI:** `RCCategoryGateway` compõe I2-B+I2-D+I2-E na mesma conexão FinanceDB/IC-READ; I2-E bloqueia rotas D não certificadas, captação de conta confiável via sessão MAIN com diálogo nativo; destino deve ser `{categoryId,subcategoryId:string|null}`, verificado pelo `D05CategoryService.resolve`. Flat-name transaction/rule proposals são recusadas quando ambíguas. I2-E revalida source, account, owner, grant, mês, hash, quantidade e regras; retorna prévias de leitura e planos sem executar.
- **Escrita pessoal:** `electron/d05-personal-gate.cjs` (gateway distinto do executor I2-C), preview antes/depois, nonce/TTL/escopo, fingerprint de categoria/SQL, nativo MAIN, backup SQLite, transação externa com SAVEPOINT E2, recibo na mesma COMMIT, idempotência por proposalId+nonce, stale/rollback/recovery_required. Seu uso real está **explicitamente desativado** por `approvedForPersonal:()=>false` no MAIN. QA sintético só executa se receber vault provado pelo factory. Rotas genéricas e modelos não podem habilitar a flag. Regras históricas sem `afterRowid/accountId` seguro ficam negadas.
- **CSV:** prévia de todas as linhas e de duplicatas, parser com aspas, limite de 4 MB/10k linhas, validação de valor/data/categoria, proteção CSV formula e SHA256 revalidado; backup completo via diálogo antes de gravar no `finance:save`. A gravação CSV é **manual explícita**, não via IA.

## Testes: evidência real vs. pendências

- **105 arquivos oficiais `tests/*.test.cjs` versionados** na branch integrada (contagem do diretório GitHub), sem inventar contagem global de casos.
- D05 E1/E2/E3 **4+11+6=21 casos versionados**; I2-D/E **25+23=48 casos**; novos `tests/rc-all-full-d05-i2de.test.cjs` **10**, `tests/rc-all-full-personal-gate.test.cjs` **6**, incluindo 632 movimentações sintéticas, backup/reopen, grant, owner, conto/escopo, rollback e falha pós-COMMIT. I2-A/B/C/IC2, D01–D04 e serviços financeiros permanecem na suíte oficial.
- **Executado pelo Integrador aqui:** reconciliação de GitHub, parsers V8 isolados dos CJS criados/editados, verificação do catálogo 14×61 e registro de 67 SVGs. **Não representa PASS de Node/SQLite/TypeScript/ASAR/Electron**.
- **NOT_RUN** neste SHA: `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, renderer provenance/F08, `npm run test:asar`, SQLite real (incluindo 632 registros), Electron Windows 1366×768 / 1920×1080 × dark/light, screenshots autênticos, CI/EXE.
- O gate de qualidade só pode ser considerado homologado após os 48 casos I2-D/E (e negativos novos) passarem no mesmo commit testado.

## Bloqueios concretos para GO/EXE

1. **Préflight Linux da branch consolidada ainda não executado.** Falhas TypeScript/Node/SQLite não podem ser descartadas por inspeção.
2. **QA Windows/Electron real e screenshots ausentes**, inclusive react16, D05 persistência, perfis, fallback e 4 resoluções/temas.
3. **Escrita real pessoal e bancária D05/IA desautorizada por decisão do proprietário.** Backend supervisionado existe, mas a flag MAIN segue false; não alegar recurso pessoal ativo até QA e aprovação específica.
4. **UI D05 E3 não cobre toda a gestão de regras/splits/planejamento D05 com fluxos especializados**; os serviços IPC estão instalados, mas isso não equivale a UI completa homologada. Lote bancário real também não aplica até liberação segura.
5. O histórico SQLite legacy e restore integral, incluindo 630+ sintéticos, precisam PASS em Node e evidência auditável. O CSV exige backup manual e não possui recibo atômico próprio.
6. Propostas I2-E de regra futura por conta/afterRowid permanecem bloqueadas até existir execução versionada equivalente; nunca substituir por regra global.
7. O EXE continua **NO-GO**. Issue #74 aberta, PR #82 somente documental, sem merge main.

## Próximo gate sob responsabilidade exclusiva do proprietário

Selecionar branch `integration/mf2-rc-all-01-i2a-20261113` e o **HEAD exato do PR #76 após esta integração** no CircleCI com:
```yaml
run_preflight: true
run_windows_qa: false
run_windows_build: false
```
Verificar `CIRCLE_SHA1` no job. Enviar URL/ID, SHA e primeiro erro completo se FAIL. Se PASS, o Integrador corrige apenas falhas adicionais dirigidas e prepara QA Windows mediante autorização separada; **não disparar Windows/EXE, nem merge main**.

**Gate 1:** integração de código executada, conexão D05 e I2-D/E publicada; **PASS de compilação e plena disponibilidade NÃO COMPROVADOS**.  
**Gate 2:** NOT_RUN.  
**Gate 3:** NO-GO, relatório final ainda não aprovado por ausência de QA.
