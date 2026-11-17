# MEU FINANCEIRO 2.0 — I3-01 / M1-S1 — Handoff de investigação verificável

Data: 2026-11-16. Base recomposta sobre RC-ALL-02 PR #94 HEAD `1a82a2c16303fcf73bb9241366c25c7bcb4af9d0`. Branch: `feat/mf2-i3-01-verifiable-investigation-20261116`. **PR de código separado; não modifica diretamente #94.**

## Entrega de código
| Arquivo | Objetivo |
|---|---|
| `electron/intelligence-investigation.cjs` | Parser contextual de intenção, janelas comparáveis, leitura com grant IC-READ, ledger canônico, decomposição por categoria/merchant, ID D05, evidência por IDs, dataVersion, cobertura, proteção a sync/duplicatas |
| `electron/intelligence-orchestrator.cjs` | Nova rota IC2 de investigação, resposta de evidências com um fato tipo `compare_spending_breakdown`, follow-up e estado de erro/stale |
| `src/intelligence-local.ts` | Envio do Conversar B05 direciona questões de investigação ao IC2 existente, sem desviar para gráfico V3 |
| `src/intelligence-ic2.ts` | Card estruturado do chat: anterior, atual, delta e principais contribuições |
| `tests/i3-01-investigation.test.cjs` | 22 testes funcionais e adversariais com fixture F1 sintética, fake owner/grant/DB e ledger real |

## Exemplos suportados
- “Por que minhas despesas aumentaram?”
- “Investigue meus gastos de outubro e novembro.”
- “Quais categorias mais contribuíram para o aumento?”
- “Quais estabelecimentos cresceram em outubro e novembro?”
- Follow-up: “E no supermercado?”, “E no transporte?”
- Follow-up: “Esse aumento é recorrente ou isolado?”

**Comportamento:** interpretação por intenção/contexto local, não um texto pronto. O motor de linguagem externo **não** é chamado; não existe SQL gerado por modelo. M1-S1 não implementa automaticamente todo o mapa de 120 intenções.

## Prova sintética dirigida (executada em V8)
Fixture outubro despesas 37000 centavos; novembro 42000; delta 5000.
- Seguros +6000 em `cat:contas` / `sub:contas/seguros`.
- Transporte +4000 em `cat:transporte`.
- Alimentação -5000 em `cat:alimentacao`.
- Assinaturas 0 em `cat:assinaturas`.
- Contribuições somadas = +5000; pendentes e transferências excluídos pelo ledger.
- Fonte de cada valor: `shared/finance-period-ledger.mjs` e IDs de movimentação autorizados.
- Query sem dados ⇒ resposta sem valores; período atual ⇒ janelas alinhadas e estado partial.
- Merchant exato ⇒ frequência/ticket; ambiguidade pede identificação, não agrupa por semelhança.
- DataVersion é hash do snapshot consultado, recalculado antes/depois de cada investigação; grant validado novamente. Nenhum dado antigo reutilizado para novo fato.

## Testes
| Gate | Resultado | Evidência |
|---|---|---|
| Sintaxe módulo principal e orquestrador | PASS em compilação V8 | `new Function` em fonte do GitHub; **não é TypeScript/Node compilado** |
| Suite I3-01 | **22/22 PASS em harness V8** | Código real dos testes `tests/i3-01-investigation.test.cjs` avaliado com módulos CJS injetados, ledger canônico executado, IPC/orquestrador/fatos em V8; mocks de Node builtin e DB |
| Verificação de F1/D05 | PASS nesse harness | 37000→42000, soma de variação e taxonomia real |
| Node oficial `npm ci` / `node --test tests/i3-01-investigation.test.cjs` | **NOT_RUN** | Sem checkout completo / módulos nativos na sessão |
| `test:types`, `test:db`, `test:asar`, `provenance:create/verify` | **NOT_RUN** | Necessária execução no ambiente oficial |
| Smoke Electron e QA Windows B01–B05 | **NOT_RUN** | Homologação do integrador/proprietário |
| Backup/restore, D01–D05 e B05 end-to-end Windows | **NOT_RUN** | Gate release permanece fechado |

**Limitação importante:** os 22 testes executados em V8 com dependências injetadas não equivalem a `node --test` real, Electron, SQLite integrado ou QA homologado. Não promover a status RELEASE_READY.

## Escopo e segurança
- Acesso pessoal somente por grant prévio IC-READ no MAIN; o IPC `intelligence:ic2-read-query` já existe. Não foi criado IPC, token, banco ou mecanismo de autenticação paralelo.
- O escopo IC2 atual é **fonte bancária agregada ou fonte manual**, não uma autorização por conta individual. Pedido de conta específica não pode alegar filtro de conta até surgir gate próprio.
- `approvedForPersonal:()=>false` permanece no MAIN; nenhuma escrita de orçamento, planejamento, categorização, banco ou transferência.
- `bankOverview()` pode truncar em 2500 linhas; status partial e aviso. Sem certificação de histórico completo.
- Nome legado sem match inequívoco na taxonomia fica sem ID e indica cobertura parcial.
- B05 Hoje V6 e snapshot financeiro composto permanecem **fora do escopo** da M1-S1.

## Handoff do integrador
1. Revalidar HEAD do PR #94 e do PR I3-01; confirmar que a árvore I3-01 foi rebased em 1a82a2c e contém somente cinco alterações funcionais + este handoff.
2. Executar Node 22.23.4/npm 10.9.9: `npm ci --no-audit --no-fund`, `node --test tests/i3-01-investigation.test.cjs`, `npm run test:types`, `npm run test:db`, `npm run test:asar`, `npm run provenance:create`, `npm run provenance:verify`.
3. Rodar suites IC2 e QA84 B05, smoke Electron com autorização local, Windows 1366×768 e 1920×1080, dark/light.
4. Conferir regressões de D05, categorização I2-D/E, backup/restore e isolamentos de segurança; nenhuma mudança na lógica de ledger deve ser introduzida para aprovar I3.
5. Em FAIL, reportar primeiro log real, corrigir no PR I3-01 e repetir gate. Em NOT_RUN, manter NO_GO.
6. Somente após QA e aprovação, integrar ao PR #94 por fluxo controlado; **não fazer merge automático**.


---
## I3-01.1 — Estabilização dirigida (16/11/2026)

**Estado de QA:** `NO-GO / V8_DIRECTED_PASS / NODE_QA_NOT_RUN / ELECTRON_QA_NOT_RUN`.

### Problemas reproduzidos e corrigidos
| Severidade | Falha encontrada | Correção | Testes |
|---|---|---|---|
| P1 | Parser não reconhecia “Por que gastei mais?”, “Compare outubro e novembro”, “Onde estou gastando mais?” e outras expressões | Expansão coerente do parser determinístico e do desvio IC2 no Conversar B05 | T24 e T25 |
| P1 | `truncated=false` podia coexistir com total maior que os registros retornados, produzindo cobertura indevidamente completa | Derivar `truncated` também de `totalTransactions > transactions.length`; preservar aviso explícito | T6, T26 |
| P1 | IDs bancários ausentes eram transformados em `account:` e aceitos como identificadores válidos | Rejeitar item sem ID/conta, registrar incompletude; evitar resposta “verificada” em divergência de IC-READ | T27, T28, T34 |
| P1 | Estados bancários não previstos não acionavam limitação de cobertura | Detectar e sinalizar `status` inesperado sem tratar como POSTED | T29 |
| P1 | Sync anterior ao fim da competência não era sinalizado em meses já encerrados | Comparar timestamp de sincronização com o fim de período solicitado, não só o mês corrente | T30 |
| P1 | Continuidade IC2 podia atravessar threads no mesmo grant | Vincular `conversationId` ao ID da resposta anterior existente na thread; não herdar contexto ao abrir nova conversa | Inspeção da rota B05; E2E Electron pendente |
| P1 | Resposta assíncrona antiga podia chegar após mudança de thread | Capturar `threadAtStart` e descartar resposta ao detectar troca de conversa | Inspeção de guarda TS; E2E Electron pendente |
| P2 | Mensagem de truncamento afirmava implicitamente que todo caso tinha 2.500 registros | Aviso esclarece incompletude por contagem/cap e não declara histórico integral | T6 |

### Resultado dos testes dirigidos
- `tests/i3-01-investigation.test.cjs`: **39/39 PASS** em V8 executando a fonte real da branch obtida do GitHub, com `shared/finance-period-ledger.mjs` real e gateway IC2 real; dependências Node e DB substituídas por mocks de teste.
- O harness confirmou F1 (R$ 370 em outubro, R$ 420 em novembro, delta R$ 50); reconciliação dos grupos Alimentação -50, Transporte +40, Seguros +60 em `cat:contas/sub:contas/seguros`, Assinaturas 0; negativos de token, fonte, truncamento, sem ID e injeção em descriptions.
- **Limitação:** testes V8 ≠ `node --test`, SQLite nativo, TypeScript oficial ou Electron. Nenhum gate oficial foi executado.

### Execução oficial bloqueada pelo ambiente atual
- O ambiente acessível nesta sessão contém **Node 22.16.0 / npm 10.9.2**, mas o ambiente definido pela missão exige Node 22.23.4 / npm 10.9.9.
- **Checkout completo indisponível** em `/workspaces/meu-financeiro`; acesso direto a github.com via shell retorna erro DNS. Não foi possível executar `npm ci`, `node --test`, `npm run test:types`, `npm run test:db`, preload check, ASAR, provenance, Electron smoke.
- O código foi revisado e atualizado pela conexão GitHub, mas isso não simula um runner Node real.
- **Não homologar Windows**; não fazer merge no #94 ou main.

### Rodada obrigatória do próximo executor, no checkout completo
```bash
node -v    # esperado v22.23.4
npm -v     # esperado 10.9.9
git fetch origin --prune
git switch feat/mf2-i3-01-verifiable-investigation-20261116
git pull --ff-only origin feat/mf2-i3-01-verifiable-investigation-20261116
git rev-parse HEAD
npm ci --no-audit --no-fund
node --test tests/i3-01-investigation.test.cjs
npm run test:types
npm run test:db
node scripts/build-preload.cjs check
npm run test:asar
npm run provenance:create
npm run provenance:verify
npm run test:electron-smoke
```

Executar regressões IC2, financial-intelligence, QA84 B05 e restore/backups aplicáveis. Registrar **log real**, SHA e flags. Em FAIL, abrir patch no PR #95, não reduzir asserts para “passar”; em NOT_RUN, manter NO-GO.

### Continuidade
O PR #94 continuou evoluindo depois da primeira base da I3-01. Antes de integrar, comparar o HEAD real do #94 com esta branch e exigir diff exclusivo da I3-01. O Pulso Financeiro V6 composto permanece fora do escopo. Não foram adicionados grants paralelos, IPC, SQL gerado por LLM, chamadas API ou escrita financeira; o bloqueio pessoal do MAIN é preservado.
