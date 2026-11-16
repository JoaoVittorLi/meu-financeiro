# I3-00 V2 — Jornadas de produto e fatias verticais

**Estado:** SPEC_ONLY; sem implementação nova ou teste de runtime. Propriedade: IA é orquestrador; ledger/FinanceDB e cálculos determinísticos são fonte de verdade. Requer grant vigente, fonte não duplicada, período explícito e cobertura declarada. Em qualquer jornada: sem dados ⇒ estado vazio/necessidade de autorização; falha/stale ⇒ interromper, não improvisar números. Todas as cifras representam centavos na camada de domínio.

## J1 — Consultor de economia pessoal (maior prioridade)
**Pedido:** “Quero economizar R$ 300 por mês. Analise minhas despesas, encontre oportunidades e monte um plano.”

**Fluxo completo:** consentimento e escopo ⇒ leitura de 3–6 meses equivalentes ⇒ reconciliação POSTED/transferências/splits ⇒ compromissos essenciais ⇒ ranking de gastos discricionários/recorrências ⇒ oportunidades com evidências e intervalo de economia ⇒ soma não sobreposta ⇒ avaliação de viabilidade ⇒ cenário conservador/base/otimista ⇒ plano priorizado ⇒ cartão em Conversar e Plano ⇒ proposta revisável quando contrato existir. Nunca prometer R$300 sem sustentar R$300 com oportunidades independentes.

**Dados:** source/profile/account/period/dataVersion, histórico por categoria e merchant, orçamento pai/filho D05, compromissos com vencimento, recorrências candidatas, metas consentidas. **Ferramentas propostas:** read_transactions_range, aggregate_category_spend, compare_merchant_periods, detect_recurring_candidates, read_budget_tree, read_commitments, recommend_savings, simulate_savings, build_evidence_answer. **Serviços reutilizáveis:** FinanceDB, shared/finance-period-ledger.mjs, FinancialReadTools, PlanningStore, D05.

**Interface:** Conversar explica método e card “Economia possível”; Plano de Ação apresenta iniciativas não redundantes e progresso; Hoje oferece oportunidade com mesmo insightId. **Autorização:** leitura + grant planning independente; criar plano local não é gravar orçamento. **Exceções:** gasto essencial indeterminado ⇒ pedir classificação; conta com 2500/2600 lançamentos ⇒ parcial e nenhuma meta garantida; renda prevista ≠ recebida; transferências excluídas. **Aceite:** fixture seis meses, saldo não inventado, plano quantificado e itens vinculados a transações; meta inviável explicitada; nenhum write. **Marco:** M2 (primeiro ciclo funcional M1 reutilizável).

## J2 — Detetive financeiro
**Pedido:** “Por que estou gastando mais este mês? Investigue.”

**Fluxo:** escolher períodos completos ou alinhados por dias corridos ⇒ calcular delta mensal total ⇒ decompor por categorias/subcategorias ⇒ localizar comerciantes e frequência/ticket médio ⇒ distinguir despesas extraordinárias e candidatas a recorrência ⇒ classificar fatos vs hipóteses ⇒ explicar até três principais contribuições sem confundir correlação com causa ⇒ permitir follow-up no mesmo escopo.

**Dados:** transações POSTED e data de competência, período, categorias D05, merchant normalizado, cobertura, fonte e exclusões. **Ferramentas:** read_transactions_range, aggregate_category_spend, compare_merchant_periods, detect_recurring_candidates, build_evidence_answer. **UI:** Conversar com tabela de deltas e links de exploração; Hoje apenas quando o delta exceder limiar fundamentado. **Autorização:** read-grant; segue escopo da conta original; se grant mudar, recomputar. **Exceções:** mês parcial não compara diretamente com fechado; mês base zero ⇒ percentual nulo; merchant homônimo ⇒ ambíguo; cobertura insuficiente ⇒ hipótese não conclusão. **Aceite:** fixture F1 demonstrar +R$50/mês, decomposição -R$50 alimentação, +R$40 transporte, +R$60 seguro, 0 assinatura; reconciliar exatamente. **Marco:** M1.

## J3 — Planejador financeiro
**Pedido:** “Organize meu próximo mês, sugira orçamentos e veja se consigo comprar um celular.”

**Fluxo:** consultar compromissos confirmed/planned/remaining e rendas confirmadas vs previstas ⇒ avaliar histórico e orçamento zero/null ⇒ simular limites D05 ⇒ verificar preço, parcelas e calendário ⇒ criar três cenários quando há dados ⇒ medir impacto no fluxo previsto; se saldo inicial não existe, declarar que compra não está comprovadamente viável ⇒ propostas de alteração sem persistência.

**Dados:** income/expenses POSTED, planejamento autorizado, vencimentos, compromissos quitados/cancelados, saldo inicial somente se autorizado e comprovado, preço informado, taxas/parcelas. **Ferramentas:** read_commitments, read_budget_tree, simulate_purchase, simulate_savings, draft_budget_proposal (M4, proposta), draft_planning_proposal (M4). **UI:** Conversar explica premissas; Plano oferece cenários e propostas revisáveis. **Autorização:** read + planning; orçamento e plano são escritas futuras em gate próprio, não D05 genérico. **Exceções:** receita prevista não é entrada; taxa ausente proíbe inferir CET; parcelamento sem juros não significa ausência de risco de caixa. **Aceite:** custo total invariável para seis parcelas sem juros, sem alegar saldo disponível sem saldo inicial; orçamento zero distinto de ausente. **Marco:** M2 para simular, M4 para preparar alterações.

## J4 — Assistente proativo
**Contexto:** usuário abre Hoje sem escrever pergunta.

**Fluxo:** verificar consentimento e dataVersion ⇒ varredura local autorizada de excesso e tendência de gastos, recorrências, vencimentos e classificações pendentes ⇒ score determinístico de impacto/relevância/certeza ⇒ deduplicar por evidenceFingerprint ⇒ renderizar 1–3 insights com ação concreta ⇒ levar insightId a Conversar/Plano ⇒ registrar dismissed/snoozed somente em storage consentido.

**Dados:** snapshots, metas opt-in, eventos de importação/atualização, histórico de sugestões, cobertura. **Ferramentas:** scan_opportunities, get_insight, explain_insight (M3); reutilizar resultados M1/M2. **UI:** B05 Hoje V6 (“Pulso Financeiro”); Conversar V5 e Plano V5 consomem mesmo ID. **Autorização:** read, memória opcional separada. **Exceções:** nenhuma conta autorizada ⇒ CTA consentimento, nunca insight inventado; erro de sync ⇒ invalidar e recalcular; sugestão descartada ⇒ não repetir sem dado novo ou mudança material. **Aceite:** abrir Hoje com fixture e receber oportunidade real, ação executável de investigar/simular, sem repetição diária e sem vazamento entre contas. **Marco:** M3.

## J5 — Agente de execução supervisionada
**Pedido:** “Gostei do plano. Prepare os novos limites e organize meus compromissos.”

**Fluxo:** converter intenções em drafts com registros afetados ⇒ prévia antes/depois e IDs canônicos ⇒ exibir na Central de Revisão ⇒ confirmar escopo, owner, grant, dataVersion, snapshot, nonce e confirmação nativa independente ⇒ gateway específico de orçamento ou planejamento (a construir/homologar) ⇒ COMMIT atômico e recibo idempotente ⇒ leitura pós-COMMIT ⇒ invalidar insights dependentes. **Nesta V2, só especificação, nenhum write**.

**Dados:** IDs de destino, propostas e versionamento, vínculos pai/filho D05, backup, journal, recibo. **Ferramentas:** draft_budget_proposal, draft_planning_proposal, preview_proposal e gateways restritos (futuros). **UI:** Plano e Central de Revisão; botão explícito Aprovar/Recusar, não consentimento por texto no chat. **Autorização:** read ≠ prepare ≠ write; D05 approvedForPersonal permanece false no MAIN; gatilhos pessoais só após missão separada + QA. **Exceções:** snapshot antigo ⇒ exigir nova prévia; falha pós-COMMIT ⇒ consultar recibo, jamais repetir cegamente; ID ambíguo ⇒ bloquear; cancelar serviços ou transferir dinheiro ⇒ não autorizado. **Aceite:** sandbox sintético prova replay/recibo/rollback; perfil real permanece negado mesmo se o texto instruir ignorar autorização. **Marco:** M4.

## Matriz de fechamento por jornada
| Jornada | Primeiro marco demonstrável | Resultado que encerra o marco | Teste-gate |
|---|---|---|---|
| J1 | M2 | plano viável ou inviabilidade explicada e comprovada | teste mestre seis meses + cruzamento de gastos |
| J2 | M1 | explicação reconciliada do aumento, sem causalidade fictícia | V1 T-007/T-026 + follow-up |
| J3 | M2/M4 | compra simulada sem falso saldo; depois proposta estruturada | V1 T-022/T-025/T-037 |
| J4 | M3 | oportunidade espontânea, deduplicada, explicável | testes insightId e no-data |
| J5 | M4 (somente preparação) | prévia idempotente sem gravação pessoal | V1 T-033/T-050 e prova sintética |

Os designs B05 não devem ser refeitos: os contratos funcionais são adaptadores para seus componentes já aprovados.
