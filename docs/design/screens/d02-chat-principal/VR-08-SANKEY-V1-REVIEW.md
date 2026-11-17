# VR-08 — Fluxo de Dinheiro (Sankey) V1 — EM REVISÃO

**Estado:** `REVIEW_IN_PROGRESS`, ainda não aprovado; data 13/11/2026.  
**Sequência:** VR-07 Treemap V2 = `DESIGN_APPROVED`; VR-08 = próximo; VR-09 e demais = pendentes.  
**Contexto:** D02 Inteligência / Biblioteca Visual, issue #58. D01 V4.5 congelada.

## Objetivo

Mostrar a reconciliação **Receitas → Despesas por categoria + Resultado do período**, com espessuras calculadas a partir de números reconciliados, sem confundir “resultado” com saldo bancário disponível.

## Fixture exclusivamente sintética

| Categoria | Outubro | Novembro |
|---|---:|---:|
| Moradia | R$ 1.000 | R$ 1.000 |
| Alimentação | R$ 480 | R$ 760 |
| Lazer | R$ 250 | R$ 380 |
| Transporte | R$ 200 | R$ 240 |
| Saúde | R$ 110 | R$ 228 |
| Serviços | R$ 60 | R$ 119 |
| **Total de despesas** | **R$ 2.100** | **R$ 2.727** |
| **Receitas (hipótese)** | **R$ 3.000** | **R$ 3.000** |
| **Resultado** | **R$ 900** | **R$ 273** |

Verificação obrigatória: soma categorias = despesas; despesas + resultado = receitas. Caso dados reais não conciliem, mostrar estado parcial/diferença, **não fabricar fluxo** nem “Outros” oculto.

## Geometria fiel

- Gráfico SVG com ribbons de espessura = `valor / receitas * altura de referência`. Área da faixa e altura do nó guardam proporção do valor.
- Primeiro enlace: receitas → despesas + resultado. Segundo: despesas → seis categorias; soma das alturas dos seis enlaces = altura do nó despesas.
- Separações de layout nas colunas podem acrescentar espaço em branco, **não** podem alterar a espessura/área financeira das faixas.
- Faixa do resultado verde, despesas contidas em fluxos com cores distintas por categoria; selecionado realçado, não selecionado despriorizado.
- Etiquetas de todas as categorias em lista complementar e dentro da visualização quando legíveis; nenhuma omissão silenciosa.
- Base no mês: outubro e novembro são duas capturas estáticas de fixture; mudança de mês atualiza todos os rótulos, porcentagens, fluxos e detalhes.

## Interação prevista

- Clique em ribbon, nó ou item da legenda seleciona categoria. Mostrar montante, porcentagem das despesas e lista de transações que somam exatamente o selecionado.
- Seleção `Resultado` informa que resultado do período não equivale a saldo disponível.
- Botão comparar abre antes/depois no contexto do filtro/seleção.
- Chat principal e Espaço de Análise exibem SVG proporcional; Chat lateral compacto prioriza resumo e barras, com CTA para aprofundar; mobile usa lista proporcional tocável, com detalhes em fluxo vertical.
- Meses, seleção, comparação e navegação são locais ao mock. Não existe escrita financeira.

## Diretrizes visuais

Paleta D01: `#141414`, `#1a1a1a`, `#202328`, verde `#53d896`, vermelho `#ff7a88`, texto `#fafafa`; fontes e espaçamento oficiais. Nada de faixa superior de desenvolvedor; padrões de status e fonte sob disclosure quando necessário. Animações 160–260ms com `prefers-reduced-motion`.

## Critérios de aceite a validar com o proprietário

- Proporção verdadeira: R$ 2.727 = 90,9% de R$ 3.000; R$ 273 = 9,1%.
- Categorias representam 100% das despesas e são discrimináveis no gráfico/lista.
- Não confundir resultado com saldo de conta bancária, nem renda bruta com disponibilidade efetiva.
- Trocar outubro/novembro recalcula sem inconsistência. Total por categoria = soma de transações do mock.
- Fluxos com largura e cores legíveis em desktop, legenda acessível e mobile sem microfaixas difíceis de tocar.
- Densidade nas variantes compact/principal/analysis/mobile segue D02.
- Estados futuros: parcial, sem dados, conciliado, defasado; esta V1 foca o cenário pronto com fixtures.

**Importante:** protótipo V1 ficará disponível no chat para feedback; não promover a aprovado automaticamente. A implementação produtiva dependerá de dados validados pelo integrador e QA Electron.
