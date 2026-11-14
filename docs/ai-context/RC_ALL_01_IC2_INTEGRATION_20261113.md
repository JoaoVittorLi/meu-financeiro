# RC-ALL-01 — integração read-only / candidato para preflight (13/11/2026)

**Status:** CODE_PUBLISHED / NODE_SQLITE_TYPES_F08_ASAR_NOT_RUN / ELECTRON_NOT_RUN / EXE_NOT_BUILT. Nenhum merge em main.

## Base preservada
PR #73 com D01→D04 e cadeia #54→#60→#63→#68. Reconciliação dirigida dos últimos ajustes do Executor 1: `src/intelligence-today-v2.ts`, `src/intelligence-review.ts` e documentação publicados após o HEAD inicial.

## I2-A integrada sem I2-B
Copiados sem sobrescrever UI os quatro módulos `electron/intelligence-{context,tools,orchestrator,provider}.cjs` e os testes `tests/intelligence-i2a.test.cjs` do PR #64 `da117ce1145a748b653144c7f328145b71798e0e`. Serviço não generativo; planejador mock permanece desabilitado. Sem API externa, escrita de categorias, regras, movimentações ou planejamento por IA.

`electron/intelligence-ic2-adapter.cjs` faz o gate versionado **IC2-READ-QUERY** separado de IC-v1: concessão IC-READ válida antes e depois da consulta, owner IPC, fonte, perfil e mês iguais, `contract=I2-A/D02-V3`, `version=2`, `modelCalled=false`, `readOnly=true`, `changesApplied=false`, `facts[].id/factRef` coerentes, ações vazias, sem tokens serializados. `main.cjs` instancia esse gateway e o recria após restore, em canal único `intelligence:ic2-read-query`. `preload.cjs` expõe só uma chamada explícita; nenhum IPC genérico.

`src/intelligence-ic2.ts` converte exclusivamente fatos autorizados para tabela/cards do chat; não recalcula o ledger. `src/intelligence-local.ts` escolhe IC2 para consultas conversacionais, preserva IC-v1/V3 para pedidos visuais e D01–D04. Follow-ups são efêmeros por objeto de concessão/assinatura/mês. Respostas IC2 ficam presas a WeakMap da sessão: expiração/troca A→B, restore/cópia ou troca de escopo não podem ressuscitar números. Não persiste tokens, fatos nem mensagens da leitura autorizada no histórico local.

## Correções dirigidas
- Testes P1 do PR #68 possuíam três regex de valor monetário duplamente escapadas; corrigidas em `tests/int-design-v3.test.cjs`.
- Cliente IC2 oculta respostas antigas quando o grant muda/expira, mesmo se fonte/perfil/mês e token textual forem iguais em outro objeto.
- Correções mais recentes da D03/D04 do HEAD de #73 recuperadas sem sobrescrever `src/intelligence-view.ts` nem a UI de revisão.
- `tests/rc-all-01-ic2.test.cjs`: gateway real com SQLite sintético, follow-ups, escopo/owner/grant, não escrita, fatos forjados, binding de mensagens e contrato do pacote.

## Isolamento do executável
`package.json` define `appId=app.local.meufinanceiro.rcall01` e `productName=Meu Financeiro RC Experimental`. Em `electron/main.cjs`, builds **packaged** usam o diretório fixo separado `appData/MeuFinanceiro-RC-ALL-01-Experimental`, antes do single-instance lock, do SQLite e dos vaults; recusam symlink para a pasta experimental. O RC empacotado bloqueia HTTP(S) em ambas as sessões Chromium. O smoke do Electron de desenvolvimento segue usando `MF_DESKTOP_SMOKE_DIR` com SQLite temporário sintético. Não há cópia/importação automática do SQLite estável. **Portátil não é sinônimo de banco isolado em versões anteriores; apenas ESTE RC com a alteração explicitada.** Não abrir dados pessoais até QA completo/backup.

## Gates oficiais e responsável
O proprietário dispara o primeiro CircleCI:
- Branch: `integration/mf2-rc-all-01-i2a-20261113`
- SHA: o **HEAD exato publicado após a última alteração nesta branch**, a registrar no PR
- `run_preflight=true`, `run_windows_qa=false`, `run_windows_build=false`
- Comandos do workflow: Node 22.23.4/npm 10.9.9, `npm ci`, `test:types`, `test:db`, `compile`, `renderer-provenance check-bundle`, `test:asar`, mais PWA dry-run sem deploy.

Só considerar PASS com links da execução, `CIRCLE_SHA1` exato, contagem real e exit code. Se houver FAIL, não executar Windows. Depois de PASS, owner autoriza em etapa separada `run_windows_qa=true` (preflight+Electron QA, sem EXE), depois `run_windows_build=true` (preflight+Windows build e 32 PNGs). Nenhum CircleCI foi disparado aqui.

**Não implementado:** I2-B #72, escrita pessoal, APIs pagas, Cloudflare Production, merge main, build Windows ou EXE. **Não homologado:** QA Electron, captação de imagens, integridade ASAR executada, regressão Node/SQLite/TS oficial.
