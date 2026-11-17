# VR-10 — Investigação detalhada V2 · REFERÊNCIA PARA BIBLIOTECA

**Estado:** `BASELINE_ACCEPTED_FOR_BATCH`. Em 13/11/2026, após rejeitar a V1, o proprietário avaliou a V2 como "Excelente. Ficou muito bom" e direcionou a consolidação de todas as demais famílias, sem continuar protótipos micro individuais. Este status registra a direção aceita; **não é certificação de QA Electron**.

## Problemas rejeitados na V1

- Indicadores invisíveis e texto escuro sobre fundo escuro.
- Barra de variação ocupando a camada dos nomes e valores, provocando sobreposição e layout desalinhado.
- Uso exclusivo de vermelho igual para todos os aumentos; não representava a intensidade relativa de cada categoria.
- Imagem estática entregue no lugar do protótipo interativo, sem validação de navegação.

## Direção V2 consolidada

- Dark `#141414` / texto `#fafafa`; light `#f4f4f6` / texto `#171717`. Contraste legível em todos os labels, títulos, deltas e botões.
- **Heat scale somente em impactos positivos sobre despesas**, com categorias ordenadas: Alimentação `#ff516a` (R$280), Lazer `#ff7470` (R$130), Saúde `#fa935d` (R$118), Serviços `#f4b350` (R$59), Transporte `#f4d363` (R$40), Moradia neutro (R$0).
- Cada linha: ícone consistente, título, gasto do período, participação no aumento e delta; abaixo fica um `track` isolado, com `fill` de comprimento normalizado. **Não usar position:absolute para o preenchimento atravessar texto**.
- Seleção contextual → quadro de detalhes da categoria → grupos ordenados → lançamentos por período → detalhe individual. Breadcrumb preserva escopo.
- Valores de exemplo: outubro R$2.100, novembro R$2.727, Δ R$627. Alimentação R$480 → R$760; Delivery R$150 → R$340, delta R$190.
- Busca por categoria, tema claro/escuro, comparação, mudanças de período e estados com controles funcionais.
- Motion: hover 150ms, entrada do detalhe 200ms, largura de barra 220ms após cálculo, sem animação em `prefers-reduced-motion`.
- Sem texto técnico persistente; evidências via disclosure e explicação de limitações. Nenhuma escrita por IA.

## Assets e níveis de confiabilidade

- Protótipo V2 **está no chat de revisão**, não há cópia HTML autônoma canônica do V2 verificada no GitHub. Os componentes de **heat + layout** foram reaplicados na [Galeria Consolidada V3](VISUAL_GALLERY_V3_CONSOLIDATED.html) e no [CSS de referência](VISUAL_LIBRARY_PREMIUM_V3.css); a galeria **não constitui captura idêntica da V2**.
- O [Handoff V3](VISUAL_LIBRARY_HANDOFF_V3.md) manda o Executor implementar a navegação completa e testar com dados validados; a galeria V3 é demonstração sintética.
- Não alegar equivalência pixel a pixel nem implementação no Electron sem teste.

**Próxima atividade:** D03 Inteligência Hoje; a revisão micro VR-11–26 foi substituída pelo sistema V3 consolidado.
