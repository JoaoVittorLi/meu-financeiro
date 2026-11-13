# D02 — Critérios de aceite unificados V3

**Estado:** TEST PLAN / NOT EXECUTED. Isto é plano de testes para a implementação futura, não log de execução. Design consolidado em 13/11/2026.

## Gates globais obrigatórios

| Categoria | Cenários e resultado esperado | Evidência necessária |
|---|---|---|
| Data integrity | Money in cents, 0/negative/null, denom 0, currency mismatch, refunds, PENDING/POSTED and transfers exclusions, sum(category)=sum(records), graph sum = filtered list sum | Financial numeric tests |
| Heat semantics | Positive spend delta ranks descending; if deltas 280/130/118/59/40/0, heat colors exactly 1..5+neutral; no heat on simple balances; contrast dark/light | Visual DOM+CSS |
| Layout | Column labels and money cannot overlap; bars in separate tracks and min-height; stable heights at 1366×768 / 1920×1080 / mobile 390; zoom 125/150/200%; zero horizontal overflow | Playwright screenshot + geometry |
| Keyboard and contrast | Tab cycles all controls, Enter/Space equivalent to click, focus visible, ARIA names, rosca/treemap/sankey with table fallback; WCAG AA; no invisible text dark | Accessibility + contrast test |
| Functionality | Every button with handler, disabled when unsupported, category/group/record breadcrumbs, month filters and search, history thread preservation, restoring baseline, exact data set after navigation | E2E interaction |
| Motion | hover 150ms, entry 200ms, panel 240ms, bars 220ms max; verified calc before motion; prefers-reduced-motion removes motion, no flashing alerts | Playwright reduced motion |
| States | ready/loading/empty/partial/stale/denied/offline/error/conflict/expired/applied/undo unavailable; no fake summaries when missing source | State component tests |
| Approval and write safety | D01 V4.5 flow; previewVersion invalidated on edits; selected affected IDs; explicit consent; no personal write API enabled; no fake receipt; undo eligibility | Contract / adversarial tests |
| Finance semantics | Period comparability; result not account balance; income not investing return; zero and negatives contextual; recurrence not asserted from one charge | Acceptance fixtures |
| Provenance | query/source IDs, period/timezone, asOf/coverage, verified aggregate math, explainability disclosure only when relevant | Integration test |

## Gates por famílias

| IDs | Grupo | Verificação específica |
|---|---|---|
| VR-01–03 | KPIs & comparações | números e datas comprováveis; teste de denominador zero e períodos diferentes |
| VR-04–06 | Gráficos comuns | pontos e barras reais, filtros e legenda acessível; rosca não exibe valores negativos |
| VR-07–08 | Treemap e Sankey aprovados | áreas/espessuras proporcionais, seis categorias reconciliadas, fallback se fluxo incompleto |
| VR-09–11 | Ranking/Investigação/Tabela | R$/% distintos, gradiente de impacto, labels sem sobreposição, filtros e drill-down com IDs |
| VR-12–14 | Recorrência/Orçamento/Caixa | assinaturas incertas, limite zero, saldo disponível versus projeção, vencimentos pagos não duplicados |
| VR-15–17 | Simulação/Cenários/Metas | premissas editáveis e reset, não prometer resultado, valores calculados determinísticamente |
| VR-18–19 | Dívida/Patrimônio | cotação oficial de liquidação e datas; ativo ≠ patrimônio líquido; aporte ≠ rentabilidade |
| VR-20–21 | Recomendações/Plano | prioridade com evidência, sem repetição, tarefa e compromisso reais vs rascunho |
| VR-22–24 | Propostas/Aprovações/Relatórios | diff e consentimento revalidável, proteção D01, relatórios só se artefato real existe |
| VR-25–26 | Qualidade e Estados | stale/partial/offline/error/denied visíveis, acesso bloqueado, rótulos contextualizados |

## Fixtures e invariantes obrigatórias

1. Outubro: despesas R$ 2.100; novembro: despesas R$ 2.727, receitas R$ 3.000, resultado do mês R$ 273; aumento de despesas R$ 627.
2. Categoria Alimentação R$ 480 → R$ 760 (Δ R$ 280, +58,3%, 44,7% do aumento total); Lazer +R$130; Saúde +R$118; Serviços +R$59; Transporte +R$40; Moradia R$0. Soma Δ = R$627.
3. Gradiente do ranking: Alimentação vermelho #ff516a; Lazer coral #ff7470; Saúde laranja #fa935d; Serviços âmbar #f4b350; Transporte amarelo #f4d363; Moradia cinza. Medir contraste do texto independente da cor da barra.
4. Alimentação, novembro = Delivery R$340 + Supermercados R$389 + Cafeteria R$31. Outubro = Delivery R$150 + Supermercados R$300 + Cafeteria R$30. Delivery Δ R$190 = 67,9% da variação da categoria. Sem transação duplicada.
5. Fluxo mês novembro: R$3.000 receitas = R$2.727 despesas + R$273 resultado (diferença contábil do período, não saldo disponível).
6. Categoria/ranking/filtro: ao selecionar item, título/delta/legenda/percentual/lançamentos são da mesma seleção. Gráfico e tabela sempre reconciliam.

## Matriz de compatibilidade planejada

- **4 destinos:** compact (D01), standard (D02), analysis, mobile.
- **2 temas:** dark/light.
- **12 estados:** ready/loading/empty/partial/stale/denied/offline/error/conflict/expired/applied/undoUnavailable.
- **26 famílias:** executar testes de contratos em todas; não exigir screenshot para cada produto cartesiano se o renderer compartilha primitive testada, mas pelo menos uma captura por família/tema e por destino significativo.
- **Telas:** Electron 1366×768, 1920×1080; PWA mobile 390×844 somente quando PWA for retomado.

## Critérios de falha bloqueante

- Um botão que não atua ou oferece confirmação não implementada.
- Texto invisível, truncamento de valor monetário, barras cobrindo labels ou conteúdo fora do card.
- Incongruência entre totals e registros, variações sem denominador válido, barras não proporcionais ou resultado confundido com saldo.
- Escrita por IA sem autorização, ação com estado anterior expirado, recibo anunciado sem retorno do backend.
- Erro/partial/stale que pareça resultado verificado e atualizado.

## O que esta entrega não alega

Não houve execução de QA Electron, nem comprovação de interação para cada um dos 26 renderers no aplicativo. Os arquivos de design não são novos componentes produtivos. O Executor deve anexar o log de testes e capturas reais ao PR de integração ao implementar.
