# MF2 I2-A — Motor conversacional de leitura

Status: BACKEND_ISOLATED / NOT_INTEGRATED / NOT_HOMOLOGATED
Base: PR #54, SHA 55de81c03c3171edd0b325eb66d63630018c23c4.
Execução isolada do Designer #57 e do Executor visual #60. Integração depende do Integrador no issue #49.

## Checkpoint A1 — código entregue

- electron/intelligence-context.cjs: contexto efêmero por proprietário, grant, fonte, perfil e mês; TTL 10 minutos e invalidação por alteração de escopo.
- electron/intelligence-tools.cjs: nove ferramentas com validação estrita e allowlist; todo acesso passa por LocalFinancialIntelligence.query e reaproveita o aggregateFinancePeriod canônico. Valores monetários somente em centavos inteiros.
- electron/intelligence-orchestrator.cjs: até quatro consultas encadeadas, follow-up com exclusão de categorias e recálculo no ledger, referências verificáveis e blocos compatíveis com D02 V3.
- electron/intelligence-provider.cjs: adaptador de planejador SIMULADO, desligado por padrão, restrito a fonte manual/perfil demo. Sem rede, API, SQL dinâmico ou envio de dados pessoais.
- tests/intelligence-i2a.test.cjs: dez testes versionados com FinanceDB e PlanningStore sintéticos.

Ferramentas: summary, compare, categories, merchants, transactions, budgets, commitments, simulate e quality.
Drill-down por estabelecimento fornece IDs rastreáveis, valores atuais e anteriores e delta mensal. Rankings aritméticos não são causalidade. Simulações mostram hipóteses, não garantias.

## Checkpoint A2 — limite claro

O adaptador suporta plano estruturado de até quatro ferramentas e valida esquema e permissões, mas NENHUM modelo remoto foi conectado, pago ou chamado. Não há chatbot generativo pessoal homologado.

## Contrato proposto (IC2-READ-QUERY / D02-V3)

Response version=2, contract=I2-A/D02-V3, readOnly=true, changesApplied=false, modelCalled=false, conversationId, contextReset, source, profile, period, density, status, answer, alerts[], actions[], facts[], blocks[], evidence[], followUps[].
Cada fact tem id, kind, tool, value (centavos inteiros), source, profile, period, asOf, coverage, excludedCategories e version.
Cada block tem id, kind, factRef e density. Um primário e até dois complementares. Os 26 kinds do D02 são aceitos no schema do planejador, mas somente visuais fundamentados pelos fatos disponíveis são emitidos. Os demais devolvem estado seguro.

Sem alteração nos arquivos compartilhados da UI, IPC, financial-intelligence ou no PR #60. O Integrador deverá aprovar a adição ao contrato no #49 antes de conectá-la ao aplicativo.

## Evidência de teste

Smoke isolado em V8: 13/13 PASS com módulos da branch (antes do ajuste adicional de delta por estabelecimento), serviço IC-READ e shared/finance-period-ledger efetivos, carregados em runtime simulado. Não equivale a Node/SQLite/Electron.
Os 10 testes Node/SQLite foram PUBLICADOS mas NÃO EXECUTADOS neste ambiente.
Não executados para este SHA: npm ci, npm run test:types, npm run test:db, compile, F08, ASAR, proveniência, Electron e Windows. Os 542/542 testes do PR #54 pertencem à base, não a esta branch.

## Diálogo fictício e reprodutível

Pergunta: Por que meus gastos aumentaram? Resposta: delta verificado de R$ 110,00 entre outubro/novembro no cenário sintético.
Follow-up: Agora desconsidere Transporte. Resposta: delta recalculado R$ 90,00 na mesma fixture, sem alterar registros.
Pergunta: Mostre para onde foi minha renda. Resposta: dados financeiros disponíveis, mas Sankey de origem/destino BLOQUEADO sem reconciliação real; não inventa fluxos.
Pergunta: Se reduzir Delivery em 20%? Resposta: economia hipotética R$ 6,00 de uma base fictícia R$ 30,00.
Pergunta: Apague todas as movimentações. Resposta: denied, leitura somente.

## Gatilhos e limitações pendentes

- Validar schema SQLite com teste Node real. Cobrir regressões extras de histórico truncado, duplicados, estornos e dados negativos antes de homologação.
- Contrato IC-READ não permite autorização individual por conta; filtro accountId é recusado, não ignorado silenciosamente.
- Sem vínculos entre renda e despesas, um Sankey renda-para-destinos permanecerá indisponível; mostrar estado sem números falsos.
- Viabilidade de compra depende de saldo inicial, compromissos confirmados e cobertura; nunca inferir pela diferença receitas/despesas.
- Integrador conecta ao IPC somente após validar e estabilizar PR #60; smoke real Electron e QA visual são gates separados.

Não autorizado: merge main, EXE, CI Windows pago, deploy Production, API paga, dados financeiros pessoais enviados a modelo externo ou escrita por IA pessoal.