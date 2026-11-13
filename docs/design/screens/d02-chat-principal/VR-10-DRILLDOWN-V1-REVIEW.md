# VR-10 — Investigação detalhada / Drill-down V1 — EM REVISÃO

**Sequência oficial:** VR-07 Treemap V2, VR-08 Sankey V1, VR-09 Ranking V1.1 = `DESIGN_APPROVED`; VR-10 = `REVIEW_IN_PROGRESS`; VR-11–26 pendentes. 13/11/2026. D01 V4.5 intacta.

## Valor exclusivo deste componente

Descer de um **total reconciliado** para `categoria` → `tipo de gasto/comerciante` → `lançamento`. A conversa apresenta uma explicação curta; a investigação interativa abre somente sob demanda no D02 principal. Sem equivalência falsa entre associação matemática e causa/comportamento.

## Fixture de comparação — integralmente sintética

Despesas outubro R$ 2.100, novembro R$ 2.727, aumento R$ 627.
| Categoria | Out | Nov | Δ |
|---|---:|---:|---:|
| Moradia | 1.000 | 1.000 | 0 |
| Alimentação | 480 | 760 | +280 |
| Lazer | 250 | 380 | +130 |
| Transporte | 200 | 240 | +40 |
| Saúde | 110 | 228 | +118 |
| Serviços | 60 | 119 | +59 |

Para **Alimentação**, novembro: Supermercados R$389, Delivery R$340, Cafeteria R$31. Outubro: Supermercados R$300, Delivery R$150, Cafeteria R$30. A maior diferença interna é Delivery (+R$190), representando 67,9% do aumento desta categoria. Cada grupo abre lançamentos **cuja soma bate exatamente com o grupo**.

## Anatomia V1

1. Contexto e evidência: período comparado, receita/transferências fora da análise, total e variação.
2. Breadcrumbs interativos `Todas as despesas / Categoria / Grupo`, com retorno preservando filtros.
3. Painel de categorias (comparação visual e ranking de diferenças), com seleção.
4. Painel de grupo/estabelecimento: desempenho atual x anterior e progressão para registros.
5. Nível transacional: linhas identificáveis por descrição, data, mês, montante, total conciliado e status apenas se disponível.
6. Botões de retorno claros, temas dark/light, modos principal/analysis/lateral/mobile; reduzir densidade em telas pequenas.
7. Pesquisa contextual por nome de categoria ou grupo somente quando o campo está no nível correspondente; estado sem resultados claro.
8. Ações estritamente de leitura; nenhum “confirmar” financeiro sem um contrato de escrita.

## Segurança e semântica

- Mudança de nível deve manter IDs/escopo; totais de cada nível devem reconciliar em centavos antes de serem mostrados.
- Não afirmar motivo de uma compra sem prova: `O gasto aumentou em delivery` é conclusão descritiva, `Você fez mais pedidos por X` exige dados adicionais.
- Período parcial/stale/denied/conflict → fallback visual explícito e sem números imaginados.
- Categoria vazia, grupo com 0 transações, reversão/estorno, reembolso, transferências, comparador zero e valores negativos exigem testes.
- Sem ações de edição nem integração bancária neste mock; dados totalmente fictícios.
- Teclado/foco/ARIA, contraste WCAG e `prefers-reduced-motion` devem acompanhar os quatro layouts.

## Aceite visual pendente

O proprietário deve experimentar seleção de categoria, grupo, períodos dos lançamentos, busca e breadcrumbs. Somente depois de aprovação explícita: congelar em `DESIGN_APPROVED` no inventário e seguir para VR-11.

QA Electron e implementação real **não executados**.
