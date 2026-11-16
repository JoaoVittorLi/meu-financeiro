# ARQUITETURA DE FERRAMENTAS — I3-00

Auditoria estática feita sobre [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), SHA 1bc1b89bf5bdefc0196b0851e690a99f825ca85a, em 2026-11-16. **Os 26 contratos abaixo são PROPOSTAS e/ou adaptações, não novas funções criadas nesta missão.** Os módulos citados são alvos de reutilização; verificar suas APIs antes de codar.

## Ferramentas existentes que NÃO devem ser duplicadas
- electron/intelligence-tools.cjs: FinancialReadTools.execute() tem nove tool names: summary, compare, categories, merchants, transactions, budgets, commitments, simulate, quality.
- electron/financial-intelligence.cjs: LocalFinancialIntelligence.query() limita oito intents e valida grant; consulta do motor shared/finance-period-ledger.mjs.
- electron/intelligence-ic2-adapter.cjs: contrato readOnly, modelCalled=false, facts ≤4, blocks ≤3.
- electron/intelligence-category-rc.cjs: I2-B/C/D/E read/propose e qualidade, D05 hierarchy gate; sintético isolado.
- electron/d05-personal-gate.cjs: gate pessoal D05 com preview/snapshot/nonce/backup/recibo; produção continua bloqueada.
- electron/intelligence-provider.cjs: validatePlan permite no máximo quatro steps, e SyntheticPlanningAdapter não é motor LLM pessoal.

## Diagrama de execução desejado
Usuário (Hoje/Conversar/Plano/Central) → normalizador de intenção e contexto → verificador de grant/escopo → planejador de chamadas *tipadas e permitidas* → ferramentas determinísticas com ledger canônico SQLite → factual evidence graph → redator explicativo → insight/proposta imutável → Central de Revisão → confirmação nativa MAIN do **serviço específico** → recibo + leitura pós-execução + invalidação dos insights dependentes.

**Regra estrutural:** nenhum SQL arbitrário, JS, caminho de arquivo, API key, alteração financeira, owner ou token pode ser escrito pelo modelo. Renderer não é autoridade. O modelo só propõe nomes e parâmetros de ferramentas whitelisted. MAIN revalida tudo. Não criar um IPC genérico como executeAnyFinanceAction: os gateways de gravação devem ser distintos por domínio e aprovados um a um.

## Registro proposto — 26 contratos com 20 campos obrigatórios

### 01 — read_transactions_range

- **01. Nome lógico:** read_transactions_range
- **02. Finalidade:** Leitura filtrada de movimentações por períodos, conta e fonte
- **03. Parâmetros de entrada:** source, profile, accountId opcional, start, end, pageCursor, limit
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** FinanceDB.bankOverview/load + shared/finance-period-ledger.mjs
- **06. Serviço reaproveitável:** FinanceDB.bankOverview/load + shared/finance-period-ledger.mjs
- **07. Saída estruturada:** página de transações com IDs, total e cobertura
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P0

### 02 — read_subcategory_spend

- **01. Nome lógico:** read_subcategory_spend
- **02. Finalidade:** Agregar gastos por categoriaId/subcategoryId D05
- **03. Parâmetros de entrada:** scope, start, end, categoryId, subcategoryId|null
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** D05CategoryService + ledger canônico
- **06. Serviço reaproveitável:** D05CategoryService + ledger canônico
- **07. Saída estruturada:** agregado em centavos + quantidade + árvore
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P1

### 03 — read_merchant_periods

- **01. Nome lógico:** read_merchant_periods
- **02. Finalidade:** Comparar lojas normalizadas por períodos
- **03. Parâmetros de entrada:** scope, períodos, merchantFilter, limit
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** FinancialReadTools.merchants, FinanceDB
- **06. Serviço reaproveitável:** FinancialReadTools.merchants, FinanceDB
- **07. Saída estruturada:** série por merchant, IDs e cobertura
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P1

### 04 — read_recurring_candidates

- **01. Nome lógico:** read_recurring_candidates
- **02. Finalidade:** Encontrar candidatos de recorrência e assinatura
- **03. Parâmetros de entrada:** scope, janela mínima, tolerância de datas/valor
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** FinanceDB + ledger + regras existentes
- **06. Serviço reaproveitável:** FinanceDB + ledger + regras existentes
- **07. Saída estruturada:** candidatos, evidências, confiança não probabilística
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P1

### 05 — read_budget_tree

- **01. Nome lógico:** read_budget_tree
- **02. Finalidade:** Ler limites hierárquicos e consumo por pai/filho
- **03. Parâmetros de entrada:** scope, período, categoryId?, subcategoryId?
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** FinanceDB budgets + catálogo D05 + ledger
- **06. Serviço reaproveitável:** FinanceDB budgets + catálogo D05 + ledger
- **07. Saída estruturada:** árvore de limite, realizado e comprometimento
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P0

### 06 — read_planned_commitments

- **01. Nome lógico:** read_planned_commitments
- **02. Finalidade:** Consultar agenda com estado e certeza
- **03. Parâmetros de entrada:** scope + intervalo, kinds, status
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** PlanningStore.list + contexto autorizado
- **06. Serviço reaproveitável:** PlanningStore.list + contexto autorizado
- **07. Saída estruturada:** títulos, vencimentos, restantes, source IDs
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P1

### 07 — read_account_coverage

- **01. Nome lógico:** read_account_coverage
- **02. Finalidade:** Verificar saldos datados e integridade do histórico
- **03. Parâmetros de entrada:** scope, accountId?, period
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** FinanceDB.bankOverview/conta, metadados Pluggy
- **06. Serviço reaproveitável:** FinanceDB.bankOverview/conta, metadados Pluggy
- **07. Saída estruturada:** saldos datados + lacunas + cobertura
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P0

### 08 — read_debt_schedule

- **01. Nome lógico:** read_debt_schedule
- **02. Finalidade:** Ler contratos e parcelas declaradas
- **03. Parâmetros de entrada:** scope, contratoId?, intervalo
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** Planejamento/serviço de dívidas somente se identificado
- **06. Serviço reaproveitável:** Planejamento/serviço de dívidas somente se identificado
- **07. Saída estruturada:** parcelas e custo quando comprovados
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P2

### 09 — read_investment_positions

- **01. Nome lógico:** read_investment_positions
- **02. Finalidade:** Ler posições de investimentos cadastradas
- **03. Parâmetros de entrada:** scope, provider/account?
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** Serviço de posições inexistência ainda não comprovada
- **06. Serviço reaproveitável:** Serviço de posições inexistência ainda não comprovada
- **07. Saída estruturada:** posições com data/origem ou unsupported
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P4

### 10 — analyze_period_change

- **01. Nome lógico:** analyze_period_change
- **02. Finalidade:** Explicar contribuição de categoria/merchant para variação
- **03. Parâmetros de entrada:** scope, períodos, categoriaId?, merchant?
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** FinancialReadTools.compare + merchants + ledger
- **06. Serviço reaproveitável:** FinancialReadTools.compare + merchants + ledger
- **07. Saída estruturada:** decomposição reconciliada, nunca causalidade não provada
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P1

### 11 — detect_spend_anomalies

- **01. Nome lógico:** detect_spend_anomalies
- **02. Finalidade:** Sinalizar padrões fora do histórico
- **03. Parâmetros de entrada:** scope, lookbackMonths, sensitivity
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** read_transactions_range + ledger
- **06. Serviço reaproveitável:** read_transactions_range + ledger
- **07. Saída estruturada:** hipóteses, baseline e outliers auditáveis
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P2

### 12 — detect_savings_opportunities

- **01. Nome lógico:** detect_savings_opportunities
- **02. Finalidade:** Gerar oportunidades com estimativa conservadora
- **03. Parâmetros de entrada:** scope, objectiveCents?, janela, excludedCategoryIds
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** recorrências + limites + planejamento + ledger
- **06. Serviço reaproveitável:** recorrências + limites + planejamento + ledger
- **07. Saída estruturada:** oportunidades, premissas, incerteza e ação
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P1

### 13 — project_cashflow

- **01. Nome lógico:** project_cashflow
- **02. Finalidade:** Projetar caixa sem confundir resultado mensal com saldo
- **03. Parâmetros de entrada:** scope, openingBalanceSource, interval, certaintyPolicy
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** PlanningStore + saldo confirmado quando existir
- **06. Serviço reaproveitável:** PlanningStore + saldo confirmado quando existir
- **07. Saída estruturada:** faixa/curva diária e cenário insuficiente
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: hipótese não persistente
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P2

### 14 — simulate_budget_limits

- **01. Nome lógico:** simulate_budget_limits
- **02. Finalidade:** Simular alterações de limites e subcategorias
- **03. Parâmetros de entrada:** scope, changes[{categoryId,subcategoryId,amountCents}]
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** budgetProgress + D05 + budgets
- **06. Serviço reaproveitável:** budgetProgress + D05 + budgets
- **07. Saída estruturada:** antes/depois, alertas e efeito mensal
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: hipótese não persistente
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P1

### 15 — simulate_purchase

- **01. Nome lógico:** simulate_purchase
- **02. Finalidade:** Simular compra à vista/parcelada
- **03. Parâmetros de entrada:** scope, priceCents, installments, interest, purchaseDate
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** simulador/Planejamento existentes a mapear
- **06. Serviço reaproveitável:** simulador/Planejamento existentes a mapear
- **07. Saída estruturada:** cenários e custo total em centavos
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: hipótese não persistente
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P2

### 16 — simulate_debt_advance

- **01. Nome lógico:** simulate_debt_advance
- **02. Finalidade:** Simular antecipação de parcelas
- **03. Parâmetros de entrada:** scope, debtId, offerSchedule, targetDate
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** compromissos + proposta de desconto verificável
- **06. Serviço reaproveitável:** compromissos + proposta de desconto verificável
- **07. Saída estruturada:** economia hipotética, custo e liquidez
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: hipótese não persistente
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P3

### 17 — draft_budget_change

- **01. Nome lógico:** draft_budget_change
- **02. Finalidade:** Preparar proposta de limite de orçamento
- **03. Parâmetros de entrada:** scope, categoriaId, valorCents, oldVersion
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** serviço de orçamento canônico a confirmar
- **06. Serviço reaproveitável:** serviço de orçamento canônico a confirmar
- **07. Saída estruturada:** draft immutable + diff e impacto
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Sim: payload canônico, antes/depois e efeitos, não aplica valores
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P3

### 18 — draft_planning_change

- **01. Nome lógico:** draft_planning_change
- **02. Finalidade:** Preparar proposta de compromisso planejado
- **03. Parâmetros de entrada:** scope, itemId?, vencimento, valorCents, oldVersion
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** PlanningStore / serviço oficial de planejamento
- **06. Serviço reaproveitável:** PlanningStore / serviço oficial de planejamento
- **07. Saída estruturada:** draft immutable + impact e conflito
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Sim: payload canônico, antes/depois e efeitos, não aplica valores
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P3

### 19 — draft_category_batch

- **01. Nome lógico:** draft_category_batch
- **02. Finalidade:** Preparar alterações com IDs D05 resolvidos
- **03. Parâmetros de entrada:** scope, txIds[], target(categoryId,subcategoryId), version
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** D05CategoryService.previewBankBatch + I2-E quality
- **06. Serviço reaproveitável:** D05CategoryService.previewBankBatch + I2-E quality
- **07. Saída estruturada:** preview por ID, evidências e bloqueios
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Sim: payload canônico, antes/depois e efeitos, não aplica valores
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PARTIAL: D05/I2-E já têm preview; API universal não implementada; P3

### 20 — confirm_budget_change

- **01. Nome lógico:** confirm_budget_change
- **02. Finalidade:** Confirmar exclusivamente proposta de orçamento aprovada
- **03. Parâmetros de entrada:** proposalId, nonce, verified native user gesture
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** gateway tipado MAIN orçamento **a construir após aprovação**
- **06. Serviço reaproveitável:** gateway tipado MAIN orçamento **a construir após aprovação**
- **07. Saída estruturada:** recibo orçamento + prova POST-COMMIT
- **08. Erros previsíveis:** denied, stale_snapshot, replay_conflict, consent_cancelled, recovery_required
- **09. Autenticação:** proposta aprovada, principal autenticado, escopo da conta, confirmação nativa recente e gate de produção
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** ALTO: escrita financeira, proibida até QA e autorização específica
- **12. Prévia:** Sim: payload canônico, antes/depois e efeitos, não aplica valores
- **13. Reversibilidade:** Somente compensação/restauração verificada, nunca apagar recibo
- **14. Idempotência:** Chave proposalId+nonce+owner+scope; recibo único persistido
- **15. Proteção contra replay:** nonce assinado e expirável, fingerprint da proposta, um único COMMIT
- **16. Dados desatualizados:** bloquear; recriar preview; nunca autoaprovar
- **17. Confirmação:** Sim: modal nativo independente; texto do LLM não confirma
- **18. Evidência de execução:** consulta pós-COMMIT + recibo SQLite com hash + backup verificado
- **19. Testes:** T-031..T-048: negação, stale, double-click, restart, rollback, confirmação
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P3

### 21 — confirm_planning_change

- **01. Nome lógico:** confirm_planning_change
- **02. Finalidade:** Confirmar exclusivamente proposta de planejamento aprovada
- **03. Parâmetros de entrada:** proposalId, nonce, verified native user gesture
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** gateway tipado MAIN planejamento **a construir após aprovação**
- **06. Serviço reaproveitável:** gateway tipado MAIN planejamento **a construir após aprovação**
- **07. Saída estruturada:** recibo planejamento + prova POST-COMMIT
- **08. Erros previsíveis:** denied, stale_snapshot, replay_conflict, consent_cancelled, recovery_required
- **09. Autenticação:** proposta aprovada, principal autenticado, escopo da conta, confirmação nativa recente e gate de produção
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** ALTO: escrita financeira, proibida até QA e autorização específica
- **12. Prévia:** Sim: payload canônico, antes/depois e efeitos, não aplica valores
- **13. Reversibilidade:** Somente compensação/restauração verificada, nunca apagar recibo
- **14. Idempotência:** Chave proposalId+nonce+owner+scope; recibo único persistido
- **15. Proteção contra replay:** nonce assinado e expirável, fingerprint da proposta, um único COMMIT
- **16. Dados desatualizados:** bloquear; recriar preview; nunca autoaprovar
- **17. Confirmação:** Sim: modal nativo independente; texto do LLM não confirma
- **18. Evidência de execução:** consulta pós-COMMIT + recibo SQLite com hash + backup verificado
- **19. Testes:** T-031..T-048: negação, stale, double-click, restart, rollback, confirmação
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P3

### 22 — confirm_d05_category_change

- **01. Nome lógico:** confirm_d05_category_change
- **02. Finalidade:** Confirmar exclusivamente proposta D05 autorizada
- **03. Parâmetros de entrada:** proposalId, nonce, verified native user gesture
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** D05PersonalWriteGateway, approvedForPersonal gate
- **06. Serviço reaproveitável:** D05PersonalWriteGateway, approvedForPersonal gate
- **07. Saída estruturada:** recibo D05 persistido, idempotente
- **08. Erros previsíveis:** denied, stale_snapshot, replay_conflict, consent_cancelled, recovery_required
- **09. Autenticação:** proposta aprovada, principal autenticado, escopo da conta, confirmação nativa recente e gate de produção
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** ALTO: escrita financeira, proibida até QA e autorização específica
- **12. Prévia:** Sim: payload canônico, antes/depois e efeitos, não aplica valores
- **13. Reversibilidade:** Somente compensação/restauração verificada, nunca apagar recibo
- **14. Idempotência:** Chave proposalId+nonce+owner+scope; recibo único persistido
- **15. Proteção contra replay:** nonce assinado e expirável, fingerprint da proposta, um único COMMIT
- **16. Dados desatualizados:** bloquear; recriar preview; nunca autoaprovar
- **17. Confirmação:** Sim: modal nativo independente; texto do LLM não confirma
- **18. Evidência de execução:** consulta pós-COMMIT + recibo SQLite com hash + backup verificado
- **19. Testes:** T-031..T-048: negação, stale, double-click, restart, rollback, confirmação
- **20. Estado atual:** BLOCKED_BY_POLICY: gateway D05 já existe, integração IA pessoal não aprovada; P3

### 23 — verify_action_receipt

- **01. Nome lógico:** verify_action_receipt
- **02. Finalidade:** Ler recibo após COMMIT e detectar resultado incerto
- **03. Parâmetros de entrada:** scope, proposalId, receiptId
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** tabela de recibos do serviço tipado
- **06. Serviço reaproveitável:** tabela de recibos do serviço tipado
- **07. Saída estruturada:** applied / denied / stale / recovery_required
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** BAIXO: leitura/análise local autorizada
- **12. Prévia:** Apenas resultado informativo e rastreamento
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Não para a consulta, mas requer grant de leitura válido
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P3

### 24 — manage_insight_state

- **01. Nome lógico:** manage_insight_state
- **02. Finalidade:** Registrar aceite/adiamento/rejeição de insight (não financeiro)
- **03. Parâmetros de entrada:** scope, insightId, state, expiresAt
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** SQLite de metadados de insight novo, sem duplicar ledger
- **06. Serviço reaproveitável:** SQLite de metadados de insight novo, sem duplicar ledger
- **07. Saída estruturada:** novo estado versionado e recibo de metadados
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** MÉDIO: metadados pessoais, revogação obrigatória
- **12. Prévia:** Sim: payload canônico, antes/depois e efeitos, não aplica valores
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Sim: consentimento opt-in separado; jamais inferido do chat
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P2

### 25 — manage_goal_memory

- **01. Nome lógico:** manage_goal_memory
- **02. Finalidade:** Salvar meta ou preferência com opt-in e revogação
- **03. Parâmetros de entrada:** scope, goalId?, goal, expiresAt, consent
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** armazenamento local versionado e criptografável, distinto de transações
- **06. Serviço reaproveitável:** armazenamento local versionado e criptografável, distinto de transações
- **07. Saída estruturada:** objetivo/pref com revogação e proveniência
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** MÉDIO: metadados pessoais, revogação obrigatória
- **12. Prévia:** Sim: payload canônico, antes/depois e efeitos, não aplica valores
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Sim: consentimento opt-in separado; jamais inferido do chat
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P4

### 26 — schedule_financial_report

- **01. Nome lógico:** schedule_financial_report
- **02. Finalidade:** Criar tarefa local de relatório periódico mediante opt-in
- **03. Parâmetros de entrada:** scope, recurrence, reportType, destination
- **04. Validações:** JSON schema estrito, centavos inteiros, datas ISO válidas, enum fonte/perfil, cardinalidade/tamanho limitados; accountId e target verificados pelo MAIN
- **05. Fonte dos dados:** scheduler do aplicativo a identificar/propor
- **06. Serviço reaproveitável:** scheduler do aplicativo a identificar/propor
- **07. Saída estruturada:** job id, próximo gatilho e opções de cancelar
- **08. Erros previsíveis:** denied, stale, partial_data, missing_input, invalid_scope, unsupported, timeout
- **09. Autenticação:** grant de leitura owner/token/fonte/perfil/intervalo; para metadados, consentimento expresso isolado
- **10. Escopo da autorização:** somente owner + perfil + fonte + período + contas e itens explicitamente autorizados
- **11. Nível de risco:** MÉDIO: metadados pessoais, revogação obrigatória
- **12. Prévia:** Sim: payload canônico, antes/depois e efeitos, não aplica valores
- **13. Reversibilidade:** Não se aplica a leitura/simulação; metadados podem ser revogados
- **14. Idempotência:** Read: puro, cache key scope+dataVersion; metadata: chave por ID e versão
- **15. Proteção contra replay:** token/versão do dado, sem mutações por leitura; metadata CAS
- **16. Dados desatualizados:** stale/partial com justificativa e exigir nova consulta
- **17. Confirmação:** Sim: consentimento opt-in separado; jamais inferido do chat
- **18. Evidência de execução:** contract/version + IDs/fontes/período/asOf/coverage + engine usado
- **19. Testes:** T-001..T-030: fixture, reconciliação, cobertura, escopo, input adversarial
- **20. Estado atual:** PROPOSTO: contrato I3, não declarar endpoint implementado; P4

## Orquestração e reconciliabilidade
1. A entrada preserva enunciado, intenção, período, provenance do scope, tipo fato/estimativa/simulação e nível de ambiguidade.
2. Planner local serve consultas simples sem API; pedido multi-etapa usa contrato estruturado com maxSteps, maxQueryRows, deadline, retries idempotentes e circuito anti-loop.
3. Cada ferramenta deve utilizar a **mesma** camada canônica de leitura e centavos do app. Não permitir consultas do modelo ao SQLite cru nem segunda tabela de verdade financeira.
4. Respostas são referências a evidências calculadas: ids, fonte, versão, período, cobertura, exclusions, engine, asOf, confidence qualitativa e limitações.
5. Se mudança de fonte/mês/conta/owner/dataVersion, invalidar plano e resultados antes de responder/confirmar.
6. A Central de Revisão e o chat lateral podem *encaminhar* propostas; não executá-las. Execução requer contrato de MAIN específico, modal separado e recibo persistido.
7. Limitar volume de dados enviados a modelos externos; usar resumos locais, consentimento e separação rígida de modo sintético. Não presumir que assinatura ChatGPT inclua API.
8. Trace local privacidade-first: operação, duração, versão de motor e hashes; sem guardar payload sensível, token ou dados reais em log.

## Segurança e políticas por classe
| Classe | Semântica | Permitido no MVP | Gate |
|---|---|---|---|
| read-only | consulta autorizada a dados reais locais | após grant IC-READ | owner/scope/freshness |
| analysis | agregação local, recomendação não vinculante | após leitura autorizada | data quality |
| simulation | hipótese não persistida | em sessão autorizada | distinguir fato de simulação |
| prepare | diffs não gravados | somente onde serviço suportar | revisão, alvo resolvido |
| metadata-write | metas, preferência, estado insight | apenas após opt-in específico | consentimento e revogação |
| write | modificar finanças pessoais | **não autorizado atualmente pela IA** | gate tipado futuro, backup/nonce/recibo |
| external | mover dinheiro/cancelar serviço/comprar ativos | fora do escopo | integração e autorização externas futuras |

## Correção priorizada de desacoplamento
Primeiro unificar a seleção de rotas entre IC-v1, IC2, V3 e I2-D/E; preservar IDs D05 sem converter em label plano. Depois disponibilizar novas leituras determinísticas, conectar resultados à B05 com estados observáveis e só então desenhar propostas supervisionadas. A B05 é uma **superfície de consumo de fatos**, não um motor de cálculo.

[Estado atual](ESTADO_ATUAL.md) · [120 intenções](MAPA_INTENCOES.md) · [Proatividade](INTELIGENCIA_PROATIVA.md) · [Roadmap](ROADMAP_I3.md).
