# D02 — Biblioteca Visual Universal de Respostas da IA

**Estado:** DESIGN_MAPPED / PROTOTYPING; não aprovado nem implementado. **D01 V4.5** segue congelada.
**Issue:** #58; **data:** 2026-11-13; **branch:** design/mf2-screen-by-screen-20261113

## Princípio fundamental

A IA não gera HTML arbitrário nem valores financeiros livres. Ela propõe intenções e modelos de exibição; serviços resolvem fatos e validam contas, períodos, fontes, cálculos e permissões. Um roteador determinístico escolhe o renderer visual apropriado.

### Níveis de densidade

- N0 resposta curta — texto e eventualmente um indicador; sem gráfico forçado.
- N1 compacta — um card contextual (chat lateral aprovado e principal).
- N2 explicativa — gráfico + até 3 KPIs e base de cálculo.
- N3 investigável — painel sob demanda com filtros/drill-down, sem duplicar a resposta no chat.
- N4 acionável — proposta/preview → comparação → reconfirmação → recibo → undo quando suportado.

## Inventário de 26 famílias (não 26 telas rígidas)

| ID | Família | Exemplo de pergunta | Padrão | renderer | prioridade |
|---|---|---|---|---|---|
| VR-01 | Resumo executivo | Como foi meu mês? | headline + KPIs + interpretação | summary | P0 |
| VR-02 | Indicador isolado | Quanto gastei com alimentação? | valor, período e variação | kpi | P0 |
| VR-03 | Antes/depois | Foi melhor que outubro? | comparação de períodos equivalentes | compare | P0 |
| VR-04 | Tendência temporal | Evolução do saldo e gastos | linha/área com drill-down | trend | P0 |
| VR-05 | Barras comparativas | Compare meus seis meses | barras agrupadas/empilhadas | bar | P0 |
| VR-06 | Distribuição | Como dividi meu dinheiro? | rosca/legenda acessível | donut | P0 |
| VR-07 | Treemap | Quais gastos dominam? | blocos proporcionais com alternativa tabular | treemap | P1 |
| VR-08 | Fluxo de dinheiro | Para onde foi minha renda? | Sankey reconciliado | sankey | P1 |
| VR-09 | Ranking causal | Quem aumentou os gastos? | deltas por categoria com base comparável | rank | P0 |
| VR-10 | Investigação | De onde veio essa soma? | categoria → estabelecimento → transação | drilldown | P0 |
| VR-11 | Tabela de transações | Mostre compras sem categoria | filtros, seleção, IDs e detalhe | table | P0 |
| VR-12 | Recorrências | Quais assinaturas pago? | lista de serviços, datas e cobranças | recurring | P1 |
| VR-13 | Orçamento | Vou ultrapassar limite? | medidor, velocidade, previsão e ação | budget | P0 |
| VR-14 | Calendário e fluxo | Quanto sobra no dia 20? | eventos e saldo diário projetado | cashflow | P1 |
| VR-15 | Simulação | E se cortar 15% de lazer? | sliders e cálculo reproduzível | whatif | P0 |
| VR-16 | Cenários | Qual opção compensa? | A/B/C, premissas e incerteza | scenario | P1 |
| VR-17 | Metas | Quando alcanço reserva? | linha de progresso e prazo | goal | P1 |
| VR-18 | Dívidas | Vale antecipar parcelas? | amortização, datas e custos | debt | P1 |
| VR-19 | Patrimônio | Como evoluiu meu patrimônio? | ativos/passivos, tempo e alocação | portfolio | P1 |
| VR-20 | Oportunidades | O que devo priorizar? | recomendações justificadas | insight | P1 |
| VR-21 | Plano de ação | Monte um plano de economia | tarefas, prazos e acompanhamento | plan | P0 |
| VR-22 | Proposta de IA | Crie categoria e regra | diff, seleção, exceções e abrangência | proposal | P0 |
| VR-23 | Aprovação e recibo | Confirma esta alteração? | reconfirmação, recibo e undo seguro | approval | P0 |
| VR-24 | Relatório e arquivo | Gere relatório; analise CSV | preview, artefato e fontes | report | P1 |
| VR-25 | Qualidade de dados | Minhas contas estão atualizadas? | asOf, cobertura, atrasos, conflitos | quality | P0 |
| VR-26 | Estados especiais | Não tenho dados suficientes | empty, loading, stale, denied, error | state | P0 |

## Regras de apresentação

1. Resposta com 1 bloco visual principal e até 2 complementares; renderizar mais apenas sob demanda no Espaço de Análise.
2. Todo gráfico precisa de valores conferíveis, fonte, período, fallback tabular e drill-down até lançamentos autorizados.
3. Não renderizar linha temporal sem pontos históricos adequados, Sankey se fluxos não conciliam, taxa de crescimento com denominador zero, nem rosca com categorias negativas misturadas.
4. Transferências internas não viram receita ou despesa. Separar PENDING/POSTED, ignorados, duplicados, estornos, saldo disponível, contábil e projetado.
5. Metadados técnicos em disclosure quando relevantes; nunca faixas de desenvolvimento no cabeçalho da conversa.
6. Ações de alteração financeira usam prévia determinística, IDs, autorização contextual e reconfirmação como D01 V4.5. A biblioteca não permite escrita pessoal automaticamente.
7. Layout compacto D01, chat principal D02, painel sob demanda e mobile: mesmos modelos sem perda de informação.
8. Estados: idle, loading, partial, ready, empty, stale, denied, offline, error, conflict, expired, applied, undo unavailable.
9. Inclusão: contraste, foco visível, teclado, descrição/alternativa tabular de visualizações e reduced-motion.
10. pt-BR e BRL; datas e moeda conforme fonte. É proibido inventar percentual de confiança ou economia garantida.

## Fontes oficiais verificadas — novembro de 2026

- Copilot Money (2026-10-27): https://www.copilot.money/dispatch/meet-your-money-assistant
- Copilot Money Assistant ajuda: https://help.copilot.money/en/articles/14462982-money-assistant-overview
- Monarch AI (2026-11-10): https://help.monarch.com/hc/en-us/articles/37526856682260-AI-in-Monarch
- Monarch Reports (2026-09-21): https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports
- Origin AI Advisor (2026-09-08): https://support.useorigin.com/hc/en-us/articles/39419419459085-What-is-the-AI-Advisor
- Ramp reporting: https://ramp.com/reporting
- Rocket Money: https://www.rocketmoney.com/faq
- Organizze IA (2026-10-27): https://ajuda.organizze.com.br/hc/pt-br/articles/50425480701715-Gerando-gr%C3%A1ficos-relat%C3%B3rios-e-enviando-arquivos-com-o-assistente-de-IA-do-Organizze
- PocketSmith forecast e fontes: https://www.pocketsmith.com/features/
- YNAB spending trends: https://support.ynab.com/en_us/spending-trends-H1inlhzAc

## Fases sugeridas

**P0:** resumo/indicador/comparação, tendência, barras, rosca, ranking, investigação, tabela, orçamento, simulação, plano, proposta, confirmação/recibo e estados.
**P1:** treemap, Sankey, recorrências, calendário, cenários, metas, dívidas, patrimônio, oportunidades, relatórios, qualidade detalhada.

**Design mapeado ≠ implementação pronta.** O próximo passo é homologar visualmente as famílias e seus estados no protótipo, produzir payloads de teste e integrar renderers com QA Electron sob coordenação do integrador.
