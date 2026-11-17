# VR-08 — Fluxo de Dinheiro (Sankey) V1 — DESIGN_APPROVED

**Aprovação explícita:** proprietário aprovou “VR-08 Sankey V1” em 13/11/2026.

**Escopo:** aprovação de design e comportamento do protótipo no chat, **não homologação Electron**. Implementação de produção: `NOT_STARTED`. Não há arquivos HTML versionados do protótipo de VR-08 nesta branch; a especificação abaixo e a [revisão V1](VR-08-SANKEY-V1-REVIEW.md) são o handoff textual, e a fonte interativa está na conversa de aprovação. **Não afirmar que o protótipo já está implementado ou validado em produção.**

## Experiência congelada

- Tema dark/light seguindo tokens do Meu Financeiro.
- Pergunta “Para onde foi minha renda?”, resposta curta mais fluxo proportional reconciliado e seleção de categorias.
- Novembro: `R$ 3.000` de receitas = `R$ 2.727` despesas + `R$ 273` resultado do período.
- Outubro: `R$ 3.000` receitas = `R$ 2.100` despesas + `R$ 900` resultado.
- As seis categorias somam `R$ 2.727` em novembro; os links são proporcionais aos valores e os totais da legenda correspondem aos fluxos.
- Modos Principal / Análise (Sankey detalhado) / Lateral e Mobile (resumo proporcional touch-friendly), sem encher o chat lateral.
- Interação de selecionar ribbon/nó/categoria, destaque da seleção, lista de movimentações sintéticas conciliadas, comparação outubro × novembro e notas contextualizadas.
- Resultado é **receitas menos despesas do período**, não saldo disponível. Fluxos reais só se dados autorizados e conciliados.
- Microanimações leves, foco visível, alternativa textual/lista e movimento reduzido.

## Restrições de execução

- Antes de passar a `IMPLEMENTATION_READY`, o Executor deverá criar e versionar um renderer real e testes (geometria, responsividade, acessibilidade e totais) sob revisão do Integrador. O design aprovado não substitui o código-fonte faltante.
- Nenhuma autorização de escrita, sincronização ou mudança de dados financeiros foi conferida por esta aprovação.
- D01 V4.5 e VR-07 Treemap V2 permanecem congelados. D02 / demais componentes seguem revisão individual.
- **Próximo:** VR-09 Ranking de Variações V1; aguardar aprovação explícita para seguir VR-10.

## Referências

[Inventário](VISUAL_RESPONSE_INVENTORY.json) · [Revisão Sankey V1](VR-08-SANKEY-V1-REVIEW.md) · [Issue #58](https://github.com/JoaoVittorLi/meu-financeiro/issues/58).
