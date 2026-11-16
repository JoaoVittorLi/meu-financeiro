# ROADMAP I3 — Dependências, prioridades, executores e gates

**Auditoria I3-00 — 16/11/2026.** Base PR #76 HEAD 1bc1b89bf5bdefc0196b0851e690a99f825ca85a; investigação estática, sem testes executados. A I3-00 só documenta; a primeira linha abaixo é proposta para I3-01 depois de aprovação. Referências: [estado](ESTADO_ATUAL.md), [tools](ARQUITETURA_FERRAMENTAS.md), [proatividade](INTELIGENCIA_PROATIVA.md), [testes](TESTES_DE_ACEITACAO.md), [issue #89](https://github.com/JoaoVittorLi/meu-financeiro/issues/89).

## Decisões de priorização
1. **P0 — Verdade e capacidade de ler:** corrigir roteamento, status, cobertura, hierarquia, escopos ANTES de IA generativa. Ganho de curto prazo maior que redesenho visual.
2. **P1 — Recomendações úteis e simulador integrado:** usar transações/merchant/planejamento para produzir diagnósticos e economias por cenário.
3. **P2 — Motor proativo e experiência B05:** um conjunto compartilhado de insights verificáveis alimenta Hoje, Conversar, Plano e Central, sem duplicar cálculo.
4. **P3 — Ações supervisionadas:** somente depois de QA real, aprovação específica e conformidade com gates D05 e serviços de orçamento/planejamento. Não remover restrições de escrita pessoal na I3-00.
5. **P4 — Memória avançada, modelo externo e rotinas:** opt-in, controles de privacidade e custo. Não pressupor assinatura pessoal = APIs livres.

## Regra de concorrência
- Integrador geral ainda concilia [B01/B02 #85](https://github.com/JoaoVittorLi/meu-financeiro/pull/85) e as alternativas [B03/B04 #86](https://github.com/JoaoVittorLi/meu-financeiro/pull/86) / [#87](https://github.com/JoaoVittorLi/meu-financeiro/pull/87). Nenhuma tarefa I3 pode editar os mesmos arquivos no mesmo ciclo sem owner explícito.
- [B05 issue #84](https://github.com/JoaoVittorLi/meu-financeiro/issues/84) define design, não runtime. Projetar dados e contratos em paralelo, integrar só sobre SHA congelado do executor visual.
- [#65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65) e [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) continuam gates de release. Documentos de auditoria não autorizam build nem EXE.
- I2-D/E já estão no HEAD de #76 como módulos lidos. Não reimplementar advisor/quality. A aprovação final do runtime Windows ainda não foi produzida aqui.

## Matriz resumida de iniciativas
| ID | Prioridade | Iniciativa | Benefício | Esforço relativo | Testes de aceite |
|---|---|---|---|---|---|
| I3-01 | P0 | Consolidar seleção IC-v1/IC2/V3 para consulta financeira | Entrada única com plano tipado e resposta data-backed | L | T001,T003,T010,T023,T029 |
| I3-02 | P0 | Resposta com proveniência e cobertura sempre verificáveis | Contrato answer envelope: facts / estimates / simulations / source/period/excludes/asOf | M | T004,T008,T026,T030,T040 |
| I3-03 | P0 | Resolver hierarquia D05 em todos os leitores | consultar por IDs canônicos com null explícito | M | T011,T012,T031 |
| I3-04 | P0 | Contratos de escopo e dataVersion entre módulos | invalidate/recheck IC-read antes/depois de cada etapa | M | T024,T025,T033,T034 |
| I3-05 | P1 | Consultas de histórico por período e estabelecimentos | read_transactions_range/read_merchant_periods reutilizando ledger | M | T005,T009,T014,T028 |
| I3-06 | P1 | Orçamento hierárquico read-only com recomendações | read_budget_tree, gasto/limite, riscos por subcategoria | M | T006,T015,T016 |
| I3-07 | P1 | Recorrências e economia contextual | read_recurring_candidates/detect_savings_opportunities | L | T017,T018,T019,T020 |
| I3-08 | P1 | Simulações multi-hipótese e compromissos | simulate_budget_limits, simulate_purchase, 3 cenários | L | T021,T022,T027 |
| I3-09 | P2 | Motor proativo de insights com estado | insight scan, rank, lifecycle, recusa/adiamento/expiração | L | T035,T036,T037 |
| I3-10 | P2 | Integração funcional B05 em Hoje/Conversar/Plano | bind cards a facts, planos, estado e IDs | M | T038,T039 |
| I3-11 | P3 | Preparar ações de orçamento/planejamento supervisionadas | draft tipado + preview + fingerprint; nenhuma escrita antes do gate | L | T041,T042,T043 |
| I3-12 | P3 | Homologar gates específicos e recibos | somente autorizado: D05 + gateways separados para orçamento e plano | XL | T031,T032,T033,T044,T045 |
| I3-13 | P4 | Memória de objetivos com consentimento | memórias versionadas com opt-in, revogação e TTL | M | T046,T047 |
| I3-14 | P4 | Orquestrador assistido por LLM opcional | planejar tool calls em dados minimizados com consentimento | XL | T048,T049 |
| I3-15 | P4 | Relatórios e agendamento opt-in | scheduler com eventos e cancelamento, sem chamadas externas implícitas | L | T050 |

## Detalhamento por iniciativa

### I3-01 — Consolidar seleção IC-v1/IC2/V3 para consulta financeira
**Problema:** regex concorrentes podem divergir/retornar unsupported. **Benefício e solução:** Entrada única com plano tipado e resposta data-backed. **Módulos/caminhos iniciais:** intelligence-local.ts; intelligence-orchestrator.cjs; intelligence-v3-core.ts. **Dependência:** B05 apenas como consumidor; não editar PRs #85–#87. **Esforço:** L (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T001,T003,T010,T023,T029. **Gate de aceite:** sem números inventados, sem mudança de receita/despesa; rota correta e fallback explícito. **Owner sugerido:** INT-ROUTING. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-02 — Resposta com proveniência e cobertura sempre verificáveis
**Problema:** 2500 registros e fontes incompletas podem induzir certeza. **Benefício e solução:** Contrato answer envelope: facts / estimates / simulations / source/period/excludes/asOf. **Módulos/caminhos iniciais:** financial-intelligence.cjs; intelligence-tools.cjs; finance-period-ledger.mjs. **Dependência:** I3-01. **Esforço:** M (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T004,T008,T026,T030,T040. **Gate de aceite:** toda cifra reconciliada; erro stale impede uso do resultado. **Owner sugerido:** INT-TRUTH. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-03 — Resolver hierarquia D05 em todos os leitores
**Problema:** flat name conflita com categoryId/subcategoryId. **Benefício e solução:** consultar por IDs canônicos com null explícito. **Módulos/caminhos iniciais:** d05-category-service.cjs; intelligence-category-rc.cjs. **Dependência:** integração B01/B02 #85 e reconciliação B03/B04 #86/#87. **Esforço:** M (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T011,T012,T031. **Gate de aceite:** sem fallback textual ambiguo; filho e pai agregam coerentes. **Owner sugerido:** CAT-HIERARCHY. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-04 — Contratos de escopo e dataVersion entre módulos
**Problema:** token/conta/mês mudam durante pergunta. **Benefício e solução:** invalidate/recheck IC-read antes/depois de cada etapa. **Módulos/caminhos iniciais:** intelligence-context.cjs; intelligence-ic2-adapter.cjs. **Dependência:** I3-01/I3-02. **Esforço:** M (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T024,T025,T033,T034. **Gate de aceite:** revogação impede novos reads; data antiga nunca aprova proposta. **Owner sugerido:** INT-SCOPE. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-05 — Consultas de histórico por período e estabelecimentos
**Problema:** compare atual x anterior e 25 merchants limitam análise. **Benefício e solução:** read_transactions_range/read_merchant_periods reutilizando ledger. **Módulos/caminhos iniciais:** FinancialReadTools; FinanceDB. **Dependência:** I3-02/I3-04. **Esforço:** M (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T005,T009,T014,T028. **Gate de aceite:** truncamento explícito; séries e totais reconciliados. **Owner sugerido:** INT-ANALYTICS. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-06 — Orçamento hierárquico read-only com recomendações
**Problema:** não basta identificar orçamento estourado. **Benefício e solução:** read_budget_tree, gasto/limite, riscos por subcategoria. **Módulos/caminhos iniciais:** budgets + D05 + B02. **Dependência:** B02 aprovado no design e implementação #85 ainda QA. **Esforço:** M (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T006,T015,T016. **Gate de aceite:** limite zero correto; sugestões não criam limite real. **Owner sugerido:** INT-BUDGET. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-07 — Recorrências e economia contextual
**Problema:** I2-D analisa categoria, não oportunidades de custo pessoais. **Benefício e solução:** read_recurring_candidates/detect_savings_opportunities. **Módulos/caminhos iniciais:** I2-D/E + merchants + FinanceDB. **Dependência:** I3-05; qualidade de dados. **Esforço:** L (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T017,T018,T019,T020. **Gate de aceite:** sugestões quantitativas citam ID, recorrência é hipótese até confirmação. **Owner sugerido:** INT-SAVINGS. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-08 — Simulações multi-hipótese e compromissos
**Problema:** simulate existente é apenas percentual categoria. **Benefício e solução:** simulate_budget_limits, simulate_purchase, 3 cenários. **Módulos/caminhos iniciais:** simulator + PlanningStore, motor canônico. **Dependência:** I3-02; mapear APIs reais antes de tocar código. **Esforço:** L (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T021,T022,T027. **Gate de aceite:** sem tratar netCents como saldo; custo e fluxo consistentemente calculados. **Owner sugerido:** INT-SIM. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-09 — Motor proativo de insights com estado
**Problema:** Hoje tem cartões e I2-D focado em categorias. **Benefício e solução:** insight scan, rank, lifecycle, recusa/adiamento/expiração. **Módulos/caminhos iniciais:** I2-D, I2-E, IC-READ, SQLite de metadados. **Dependência:** I3-02, I3-05, I3-07; integração B05 pendente. **Esforço:** L (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T035,T036,T037. **Gate de aceite:** nenhum insight sem evidence; sem repetição indevida. **Owner sugerido:** INT-PROACTIVE. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-10 — Integração funcional B05 em Hoje/Conversar/Plano
**Problema:** design aprovado não garante backend. **Benefício e solução:** bind cards a facts, planos, estado e IDs. **Módulos/caminhos iniciais:** B05 handoff #84 + services I3. **Dependência:** I3-01/I3-09; implementação visual separada. **Esforço:** M (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T038,T039. **Gate de aceite:** mesma evidência em 4 superfícies, sem fixture em real. **Owner sugerido:** INT-B05. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-11 — Preparar ações de orçamento/planejamento supervisionadas
**Problema:** IA não dispõe de write adapters homologados. **Benefício e solução:** draft tipado + preview + fingerprint; nenhuma escrita antes do gate. **Módulos/caminhos iniciais:** PlanningStore e serviços de orçamento a inspecionar. **Dependência:** I3-02/I3-04/I3-06/I3-08. **Esforço:** L (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T041,T042,T043. **Gate de aceite:** preview sempre versões e before/after; cancelamento sem alterar ledger. **Owner sugerido:** INT-PREPARE. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-12 — Homologar gates específicos e recibos
**Problema:** D05 personal bloqueado; desatar sem QA é violação. **Benefício e solução:** somente autorizado: D05 + gateways separados para orçamento e plano. **Módulos/caminhos iniciais:** d05-personal-gate.cjs, MAIN, backup. **Dependência:** QA Windows, migração, recovery e aprovação expressa posterior. **Esforço:** XL (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T031,T032,T033,T044,T045. **Gate de aceite:** nonce, anti-replay, idempotência, rollback e receipt pós-commit testados. **Owner sugerido:** INT-WRITE. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-13 — Memória de objetivos com consentimento
**Problema:** contexto IC2 10min, threads de interface separadas. **Benefício e solução:** memórias versionadas com opt-in, revogação e TTL. **Módulos/caminhos iniciais:** intelligence-context.cjs; ai-personal.cjs como referência (não reutilizar secredo). **Dependência:** I3-04 + privacy review. **Esforço:** M (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T046,T047. **Gate de aceite:** sem dados externos, revogar apaga uso futuro. **Owner sugerido:** INT-MEMORY. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-14 — Orquestrador assistido por LLM opcional
**Problema:** client externo só demonstra casos sintéticos. **Benefício e solução:** planejar tool calls em dados minimizados com consentimento. **Módulos/caminhos iniciais:** ai-client.cjs + policy; plano tipado local. **Dependência:** I3-01/02/04/11; decisão sobre API/custo; privacy. **Esforço:** XL (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T048,T049. **Gate de aceite:** sem SQL, sem valores inventados, limites de custo e fallback offline. **Owner sugerido:** INT-LLM. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.

### I3-15 — Relatórios e agendamento opt-in
**Problema:** não há automação verificada na análise. **Benefício e solução:** scheduler com eventos e cancelamento, sem chamadas externas implícitas. **Módulos/caminhos iniciais:** lifecycle de insights e calendário interno. **Dependência:** I3-09 + estudo runtime Windows. **Esforço:** L (relativo: S/M/L/XL, não promessa de prazo). **Testes:** T050. **Gate de aceite:** sem alertas não autorizados e sem duplicidade. **Owner sugerido:** INT-AUTO. **Risco principal:** regressão de segurança/integração se alterar serviços sem snapshot, QA e ownership.


## Matriz de impacto, esforço e precedência (pesos de planejamento)
| Frente | Impacto ao usuário 1–5 | Frequência 1–5 | Reuso 1–5 | Risco (5 = alto) | Razão |
|---|---:|---:|---:|---:|---|
| Roteador / verdade / scope | 5 | 5 | 5 | 3 | Sem isso, a IA erra ou recusa solicitações legítimas |
| Leitura merchant e subcategoria | 5 | 4 | 5 | 3 | Permite economia concreta e aproveita ledger |
| Oportunidades e recorrências | 5 | 5 | 4 | 3 | Principal diferencial de valor mensal |
| Simulador financeiro estendido | 4 | 4 | 4 | 3 | Decisões explicáveis, sem risco de escrita |
| Proatividade | 5 | 5 | 3 | 4 | Requer dados, versionamento e anti-spam |
| B05 funcional | 4 | 5 | 3 | 4 | Deve respeitar handoff visual sem mocks |
| Escrita pessoal por IA | 4 | 3 | 3 | 5 | Boa utilidade, mas QA e autorização bloqueantes |
| LLM com finanças reais | 4 | 4 | 2 | 5 | Política de consentimento, custo e privacy |
| Metas persistentes e calendário | 3 | 3 | 3 | 3 | Benefício incremental após fundações |

**Quick wins reais (código existente):** expor erro de cobertura completo; melhorar recusas de intent; explicar melhor limitações de compra; conectar I2-D/E ao plano sem escrever; eliminar duplicação de classificador entre caminhos. Classificar como quick win de *investigação/implementação futura*, não funcionalidade concluída.

**Fundação necessária:** reuso FinanceDB + ledger, D05 resolvido, grants e envelope de fatos. **Diferenciais premium:** descoberta proativa, análise de economia por merchant/assinatura, recomendações contextualizadas, B05 viva. **Longo prazo:** opt-in de modelo financeiro externo, metas duráveis, escrita homologada e integrações externas.

## Sequência e dependências (DAG)
- Trilha A, Dados: I3-02 → I3-03/04 → I3-05/06 → I3-07 → I3-09 → I3-10.
- Trilha B, Orquestração: I3-01 → I3-04 → I3-05/I3-08 → I3-09; depois I3-14 condicionado à autorização.
- Trilha C, Segurança: I3-02/04 + B01–B04 integrado e QA → I3-11 → I3-12; execução pessoal continua BLOQUEADA até decisão expressa.
- Trilha D, Experiência: Design B05 #84 (aprovado) + contratos I3-09 → integração I3-10; não criar outra fonte de indicadores.
- Trilha E, Continuidade: I3-04 + I3-09 → I3-13/I3-15.

## Divisão sugerida de executores
**Executor IA-Core** (I3-01,02,04,05): backend typed plans e evidências, sem CSS. **Executor IA-Finance** (I3-03,06,07,08): serviços de consulta/simulação, sem escrever banco. **Executor IA-Proatividade** (I3-09): engine de oportunidades, schema e testes, isolado de interface. **Integrador/Designer B05** (I3-10): apenas consumo da interface aprovada. **Executor Segurança** (I3-11/12): prévia/recibos com gate do proprietário e QA formal; não iniciar sem liberação. **Executor Memória/LLM** (I3-13/14/15): posterior, isolado e opt-in.

## Condições de aceitação de qualquer PR I3
- HEAD, base, ownership, arquivos alterados, evidência de testes atual e motivo de qualquer NOT_RUN.
- Testes sintéticos determinísticos executados na plataforma relevante; nenhum extrato pessoal em CI.
- Paridade leitura com o motor financeiro canônico (centavos e split), proteção de PENDING/transfer/ignore, categorias hierárquicas, datas, zero explícito.
- Sem alteração de contrato MAIN/IPC ou writes sem gate/autorização por PR.
- Release check: QA Windows, preload sandbox Electron 45, TypeScript, Node/SQLite, backup/restore, F08/ASAR, fixtures de 630+ transações **quando proprietário autorizar a execução**.
- Marca CODE_IMPLEMENTED_NOT_TESTED até comprovada a execução específica; PR publicado ou teste mock isolado não é RUNTIME_VERIFIED.

## Próxima ordem proposta após aprovação desta auditoria
Abrir **I3-01 — Unificação de roteamento e contratos de verdade somente leitura** em branch própria partindo do HEAD canônico pós-B01–B04; começar com testes contra prompts reais da matriz, preservando todos os gates. **Não iniciar esta implementação como parte da I3-00.**
