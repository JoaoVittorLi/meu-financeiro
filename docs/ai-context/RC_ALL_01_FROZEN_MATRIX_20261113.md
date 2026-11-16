# RC-ALL-01 — Matriz de congelamento e evidências

**Decisão do proprietário:** parar novas funcionalidades; consolidar código aprovado para um único EXE experimental Windows x64; Pipeline/QA/EXE exclusivamente autorizados pelo proprietário.  
**PR único:** #76 — `integration/mf2-rc-all-01-i2a-20261113` (Draft).  
**Bases preservadas:** #54 → #60 (D01) → #63 (D02) → #68 (identidade grants) → #73 (D03/D04 final, SHA `845aa306778313ca9f41f368b6bdde5b4a4d44ad`).  
**Upstreams importados seletivamente:** #75 I2-B `4dc638650671712cbc1290f5814341edc8fea5b2`; #78 I2-C `42456554af7311bd85a925fe4633f10e715b6d82` (ancestrais de origem I2-A #64, não mesclar árvore do upstream sobre D01–D04).

## Código já consolidado e UI realmente conectada

| Recurso | Código RC | Interface conectada | Ambiente / segurança | Evidência |
|---|---|---|---|---|
| D01 aparência premium e propostas supervisionadas pré-existentes | Sim | Sim (telas existentes) | Restrições preexistentes | Gate Linux e QA Windows pendentes |
| D02 26 famílias visuais | Sim | Sim (renderers existentes) | IC-v1 / grant assinado, sem números inventados | 31 testes D02 versionados, NOT_RUN |
| D03 Inteligência Hoje V2 | Sim | Sim | IC-v1 local, sem projeções sem base | Testes D03/D04 versionados, NOT_RUN |
| D04 Central de Revisão V1.1 | Sim | Sim | revisão legada exige serviço autorizado; indisponível no perfil packaged onde não homologado | 21 testes D03/D04 versionados, NOT_RUN |
| I2-A conversa financeira | Sim | Sim (chat) | `IC2-READ-QUERY v2`, owner/fonte/perfil/mês; somente leitura | 10 testes I2-A + 8 testes gateway versionados, NOT_RUN |
| I2-B categorias sem uso / potenciais duplicidades | Sim | Sim (D04 → leitura pessoal e laboratório) | Autorização IC-READ pessoal válida, não modifica banco | 17 testes I2-B versionados, NOT_RUN |
| I2-B consultas/planos por texto conservadores | Sim | Sim (D04 → perguntar) | Sem IA paga e sem execução automática | Node/SQLite e interações Electron pendentes |
| I2-B prévias criação/edição categoria | Sim | Sim (D04 pessoal e sintético) | Pessoal `READ_ONLY_PERSONAL`; falta confirmação para perfil pessoal de propósito | Gate Node pendente |
| I2-B prévia reclassificar por ID real | Sim | Sim (D04 pessoal; bancário `conta|ID`, manual `ID`) | Apenas preview com período/identidade/exclusões; nenhuma escrita pessoal | Gate Node pendente |
| I2-B análise de regra existente (matcher canônico) | Sim | Sim por ID (D04, se IC-READ bancário autorizar) | Histórico carregado, não total global | Gate Node pendente |
| I2-C criação/edição/exclusão categoria sintética | Sim | Sim (D04 laboratório) | Confirmação nativa e `TEMP/mf-i2c-test-*/synthetic-finance.sqlite` atestado | Testes I2-C e gateway RC versionados, NOT_RUN |
| I2-C reclassificar movimentação sintética `demo-market` | Sim | Sim (D04 laboratório) | IDs inventados, sem importar transações pessoais | Testes RC versionados, NOT_RUN |
| I2-C cancelamento, edição e rejeição de prévia | Sim | Sim | Previews com nonce, fingerprint, prazo e consentimento separados | Node/SQLite pendente |
| I2-C recibo, consulta e histórico de ações sintéticas | Sim | Sim (D04 laboratório) | Recibo no mesmo COMMIT; quando estado incerto, consultar sem reexecutar | Node/SQLite/restart pendentes |
| I2-C rollback/fault injection/reativação de vault | Sim | Backend conectado; reinicialização de vault **não** exposta à UI do EXE | Criar nova sessão não recupera automaticamente arquivo de sessão anterior | 25 cenários reportados no upstream, NOT_RUN na RC |
| Isolamento do EXE experimental | Sim | Transparente | App ID RC, `appData/MeuFinanceiro-RC-ALL-01-Experimental` antes de SQLite/lock, sem importação automática | Testes estáticos RC; packaged Electron ainda NOT_RUN |
| Modo offline experimental | Sim | Transparente | HTTP(S) Chromium bloqueado; IPC Node para nuvem/Pluggy/IA paga bloqueado; sem polling em packaged | Smoke packaged ainda NOT_RUN |

## Presentes mas propositalmente indisponíveis

| Recurso | Código presente | Interface / motivo |
|---|---|---|
| Escrita pessoal automática por I2-B/I2-C | Propostas e executor sintético, **não** executor pessoal | **Desativada**: IPC pessoal aceita leitura/prévia/rejeição; `confirm` negado independentemente da solicitação |
| Regras bancárias futuras em ambiente sintético manual | Serviços I2-B/I2-C | **Não habilitadas** no laboratório atual: vault expõe somente transações manuais fictícias; falta fixture bancária autorizada com conta e natureza verificadas |
| Undo automático do executor | Não homologado | **Desativado**: recibos informam ausência de undo; reexecução de estado incerto é proibida |
| Recuperar vault da sessão anterior após encerrar EXE | Backend `close/reopen` no vault | **Não conectado** na interface RC: nova sessão usa banco TEMP distinto, sem promessa de recuperação automática |
| D05 14 categorias / 61 subcategorias | Somente design/handoff #74 | **Não implementado** no SQLite, IPC ou Electron; `{categoryId,subcategoryId}` retorna `unsupported` |
| I2-D e demais novos designs | Fora do corte | Congelados por decisão do proprietário |
| Integrações Cloudflare, Pluggy live, IA paga no EXE RC | Código legado presente | **Bloqueadas** em packaged, sem chamada automática à rede |
| Legacy D04 `CategoryReviewService` no EXE packaged | Código legado preservado | Desabilitado fora de smoke de perfil sintético; usar laboratório I2-C separado para testes |

### Segurança e regras de operação

- **Nunca** instanciar o `AtomicSyntheticCategoryExecutor` com o `FinanceDB` do aplicativo pessoal: exige `createSyntheticFinanceVault()` e comprovação do mesmo objeto SQLite.
- A tela não cria `verifiedGesture`: MAIN verifica remetente `file://app/index.html`, vincula owner pelo `webContents.id`, valida sessão sintética e abre `dialog.showMessageBox` nativo **antes** de executar. Cancelamento mantém o banco intacto.
- O `sessionId` sintético não é o token IC-READ. O grant verdadeiro fica apenas no MAIN, expira e é revisto antes de cada comando.
- Categorias globais e os dados pessoais nunca são importados para o vault TEMP. Três movimentações de demonstração são fabricadas localmente no mês escolhido.
- Restauro do DB aplicativo recria os serviços de leitura, desarma grants/previews e destrói o laboratório anterior. Encerrar o EXE destrói o vault da sessão.
- Falhas pós-COMMIT retornam `recovery_required`; o chamador deve consultar recibo, nunca informar alteração bem-sucedida sem status `applied`.
- Alterações no perfil pessoal continuam possíveis pelos **controles manuais já existentes do aplicativo**, não pela IA I2-B/I2-C; são caminhos distintos.

### Testes e evidência

- A branch registra **98 arquivos `tests/*.test.cjs`** na suíte oficial `npm run test:db` (`node --test tests/*.test.cjs`).
- Suítes diretamente relacionadas ao corte: I2-A **10**, I2-B **17**, I2-C **21 declarações de teste / 25 casos parametrizados**, IC2 integração **8**, D03/D04 **21**, D02 **31**, novo gateway RC I2-B/C **8**.
- **Executado neste trabalho (isolado):** parser V8 de módulos CJS importados, gateway RC, MAIN/preload e arquivos de teste consultados — **PASS sintático**; integridade de blobs upstream; checagem GitHub de branches/diffs. O Executor 3 executou somente seus V8 isolados no SHA da branch dele.
- **Não executado nesta RC:** Node oficial, `npm ci`, `test:types`, `test:db`, `compile`, renderer bundle/F08, `test:asar`, execução real SQLite dos testes integrados, smoke Electron, QA visual, packaged/ASAR/EXE e CircleCI.
- **Estado:** CODE_DELIVERED / TESTS_VERSIONED / NOT_HOMOLOGATED / NO_EXE.

## Gates exclusivamente do proprietário

1. Primeiro CircleCI na branch **`integration/mf2-rc-all-01-i2a-20261113`**, SHA congelado indicado no PR #76. Parâmetros:
   - `run_preflight=true`
   - `run_windows_qa=false`
   - `run_windows_build=false`
2. Verificar `CIRCLE_SHA1`, Node 22.23.4/npm 10.9.9, `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar` e PWA Wrangler dry-run. Não confundir dry-run com deploy.
3. Somente **PASS** autoriza solicitar separadamente QA Windows (sem instalador) e, depois, com nova autorização, build Windows x64 NSIS/portable. Não rodar CI nem gerar EXE pela integração.
4. Em caso de FAIL: devolver ID/link da pipeline, SHA efetivo, primeira falha com stack/log completo; corrigir **a mesma PR #76** e congelar novo SHA. Nenhuma nova funcionalidade.
