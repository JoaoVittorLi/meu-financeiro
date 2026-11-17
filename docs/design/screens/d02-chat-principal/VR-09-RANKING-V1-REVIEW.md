# VR-09 — Ranking de Variações V1 (EM REVISÃO)

**Estado:** `REVIEW_IN_PROGRESS`, não aprovado. **Data:** 13/11/2026.  
**Biblioteca:** VR-07 Treemap V2 e VR-08 Sankey V1 = `DESIGN_APPROVED`; VR-09 = atual; VR-10–26 pendentes. D01 V4.5 inalterada.

## Finalidade

Responder “Quais categorias mais contribuíram para o aumento das minhas despesas?” com dois rankings diferentes:
- **Impacto absoluto (R$):** `despesaAtual − despesaAnterior`; percentual de contribuição ao aumento líquido também visível.
- **Crescimento relativo (%):** `(atual − anterior) / anterior × 100` para base anterior positiva; **não** usar mesmo significado de impacto.
- O ranking representa **contribuição aritmética**, não uma atribuição causal aos motivos das compras.

## Fixture sintética conciliada

| Categoria | Outubro (R$) | Novembro (R$) | Variação (R$) | Variação % |
|---|---:|---:|---:|---:|
| Moradia | 1.000 | 1.000 | 0 | 0% |
| Alimentação | 480 | 760 | +280 | +58,3% |
| Lazer | 250 | 380 | +130 | +52,0% |
| Transporte | 200 | 240 | +40 | +20,0% |
| Saúde | 110 | 228 | +118 | +107,3% |
| Serviços | 60 | 119 | +59 | +98,3% |
| **Total** | **2.100** | **2.727** | **+627** | **+29,9%** |

Contribuição: Alimentação 44,7%, Lazer 20,7%, Saúde 18,8%, Serviços 9,4%, Transporte 6,4%, Moradia 0%. Somatório (antes de arredondar) 100%.

## Experiência V1 a avaliar

1. Card único, com comparação compacta de gastos anteriores/atuais e aumento total; filtro contextual claro.
2. Alternador `Impacto em R$` / `Crescimento em %`, que muda ranking e escala da barra; nenhuma mudança de base de dados.
3. Filtros `Todas`, `Aumentos`, `Quedas`, `Estáveis`. Quando não há quedas, mostrar estado vazio próprio, não ocultar opção.
4. Seleção de categoria destaca barra e atualiza detalhe com valores, contribuição, variação e lista de transações verificáveis; dados da fixture usados para outubro/novembro.
5. Período anterior 10/2026 → atual 11/2026; nunca confundir o resultado do mês com saldo bancário.
6. Modos Chat principal, Espaço de Análise, Lateral compacto, Mobile; tema claro/escuro e motion discreto.
7. Fonte/metodologia num `details` sem faixas técnicas permanentes; não exibir falsa confiança da IA.
8. Ações de **investigação somente leitura**. Nenhuma categorização, orçamento ou escrita por IA neste componente.

## Regras de integridade para implementação

- Categorias incompletas → estado `partial`; divergência entre variação das categorias e total → bloquear conclusão, evidenciar cobertura.
- Categorias negativas, despesas zeradas, transferências excluídas, estornos e base anterior `0`: não permitir percentuais matematicamente inválidos.
- Para períodos parciais, exigir comparação de intervalos equivalentes ou marcar incomparabilidade.
- Barras exibem magnitude com eixo zero. Categorias com reduções têm barra/sinal positivo no contexto financeiro, nunca usar vermelho universal para números negativos.
- Lançamentos de demonstração devem somar precisamente o total da categoria e do período; lista com datas de exemplo, sem simular IDs bancários reais.
- Informar que o aumento contábil por categoria não explica **por que** um gasto foi necessário; a IA só pode sugerir hipóteses marcadas, com evidência quando houver.

## Critérios de aceite do proprietário

Hierarquia visual premium sem cartões empilhados desnecessários; seleção e ordenação compreensíveis; mudança de métrica recalcula rankings; empty-state de quedas; detalhes e modo mobile legíveis; tonalidade alinhada a D01 e VR-07/08. Não avançar VR-10 antes da aprovação explícita de VR-09.

**Estado de produção:** não iniciado; mock interativo e documentação de design somente.
