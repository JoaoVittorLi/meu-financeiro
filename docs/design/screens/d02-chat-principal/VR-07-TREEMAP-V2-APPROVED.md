# VR-07 — Treemap de Despesas V2 — DESIGN_APPROVED

**Aprovação explícita:** proprietário aprovou “Treemap V2 (VR-07)” em 13/11/2026.  
**Status:** `DESIGN_APPROVED` **somente para VR-07**; a biblioteca inteira, D02 e os outros 25 padrões ainda não estão aprovados.  
**Implementação:** `NOT_STARTED` no Electron. O protótipo interativo foi apresentado no chat, com fixtures sintéticas; nenhum dado real alterado.

## Decisões congeladas na V2

1. Exibir seis categorias com blocos de área **proporcionais aos valores**: Moradia R$ 1.000, Alimentação R$ 760, Lazer R$ 380, Transporte R$ 240, Saúde R$ 228, Serviços R$ 119. **Total conciliado: R$ 2.727**.
2. Destaque da categoria por seleção (sem depender apenas de cor). Blocos pequenos apresentam abreviação e rótulos completos na legenda ou na seleção.
3. Mostrar total, porcentagem do total e quantidade de categorias no contexto de novembro/2026, além de observação interpretativa curta.
4. Detalhe sob demanda da categoria: valor, participação percentual, número de movimentações e variação para outubro quando há dado comparável.
5. Ações **Ver movimentações** e **Comparar com outubro** abrem detalhes locais sem abandonar a conversa.
6. Modos de apresentação Principal / Lateral / Mobile; dark/light com identidade D01 e motion discreto.
7. Sem texto de desenvolvedor na superfície principal; evidenciação de fontes e cobertura sob demanda no app real.
8. Treemap e legenda acessíveis por teclado, selecionáveis e com alternativa tabular obrigatória para implementação.

## QA e contratos para o executor

- Geometria usa medidas quantitativas: **área dos retângulos** deve variar proporcionalmente ao valor, independente do aspect ratio.
- Nunca omitir categorias silenciosamente. Agrupamento `Outros` só com soma, quantidade e drill-down.
- Gráfico da categoria e lista de lançamentos devem coincidir; caso não haja cobertura transacional completa, declarar `parcial` e não inventar registros.
- Modo lateral pode resumir o gráfico, sem perder valor/percentual; mobile precisa aceitar toque em todos os blocos.
- Borda visual, contraste e fallback de blocos pequenos precisam de QA Electron real (1366, 1920, 390 mobile quando aplicável).
- Datas, variações, saldo e gastos seguem contratos reais do integrador, sem valores criados pela IA.

## Próximo item

**VR-08 — Fluxo de Dinheiro / Sankey** iniciado na sequência. Está em prototipação, **não aprovado**. Ao aprovar VR-08, seguir VR-09 sem reiniciar a revisão já concluída de VR-07.

## Referências

- Índice: issue #58; catálogo: `VISUAL_RESPONSE_LIBRARY.md`, inventário: `VISUAL_RESPONSE_INVENTORY.json`.
- D01 Chat Lateral Premium V4.5 permanece `DESIGN_APPROVED`, sem alterações.
