# VR-09 — Ranking de Variações V1.1 — Em revisão

**Estado:** `REVIEW_IN_PROGRESS`, **NÃO APROVADO**. V1 recebida com elogios visuais, mas o proprietário reportou botões sem resposta e texto invisível/ilegível no tema escuro (13/11/2026).

**Protótipo canônico V1.1:** [VR-09-RANKING-V1.1-PROTOTYPE.html](VR-09-RANKING-V1.1-PROTOTYPE.html).

## Correções V1.1

- Temas dark/light usam `--fg` e `--muted` explícitos em título, botões, rótulos, linhas de ranking, dados, mensagem e detalhes; remoção de herança ambígua.
- Barra de ranking agora usa `display:block;height:7px` com largura calculada e contraste compatível; em inspeção visual anterior, barras não apareciam como planejado.
- Todos os controles possuem ações definidas e estado visível `aria-pressed` ou conteúdo atualizado.
- `Principal`, `Análise`, `Lateral`, `Mobile`: mudam layout e densidade; Análise dispõe ranking e detalhe lado a lado; Lateral limita top3 e permite `Mostrar as 6 categorias`.
- `Impacto em R$` e `Crescimento em %` recalculam a ordem e escalas. `Saúde` assume liderança relativa; `Alimentação`, liderança absoluta.
- Filtros `Todas/Aumentos/Reduções/Sem mudança` alteram dados; `Reduções` vazio com ação `Mostrar todas`; `Sem mudança` apresenta Moradia.
- Seleção pela barra de concentração ou categoria do ranking sincroniza detalhe.
- `Ver/Ocultar movimentações`, `Outubro/Novembro` e CTA de mudança de métrica atuam sobre os dados e mantêm a conversa.
- Texto escuro/tema escuro e cores semânticas verificadas em Chromium local usando HTML programático; legibilidade ainda depende de aceite do proprietário.

## Smoke executado (Chromium local via set_content, sem rede e sem Electron)

- 24 controles dinâmicos no estado inicial, uma categoria selecionada.
- Quatro modos: todos alteraram `data-view`.
- Crescimento percentual: primeiro lugar Saúde `+107,3%`; impacto absoluto: Alimentação `+R$280`.
- Filtros: aumentos 5, reduções 0 + estado vazio, sem mudança 1, todas 6.
- Seleção Saúde atualizou detalhe, movimentações abriram, mês outubro totalizou R$110, mudança de métrica e tema funcionaram.
- Sem `pageerror` no fluxo testado; sem overflow horizontal no desktop/mobile; barra visível com 7 px de altura.
- Dark verificado em screenshot; categoria principal `rgb(250,250,250)`, fundo selecionado `rgb(32,35,40)`; texto de delta `rgb(255,122,136)`.

## Integridade financeira

Os dados fictícios outubro `R$2.100`, novembro `R$2.727`, aumento `R$627` mantêm relação de soma e contribuições. Ranking expressa variação descritiva, não causalidade. Nenhuma conexão bancária ou gravação executada.

## Status e próximo passo

Aguardar aprovação explícita de **VR-09 V1.1**. Somente após aprovação, marcar `DESIGN_APPROVED` em inventário e avançar VR-10. D01 V4.5, VR-07 V2 e VR-08 V1 seguem aprovados e intactos.
