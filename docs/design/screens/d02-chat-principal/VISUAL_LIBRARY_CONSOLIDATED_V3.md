# D02 — Visual Response Library V3 · CONSOLIDAÇÃO ÚNICA

**Data:** 13/11/2026  | **Issue:** #58 | **Roadmap:** #55 | **Branch:** `design/mf2-screen-by-screen-20261113`
**Estado:** `DESIGN_SPECIFIED_IN_BATCH / HANDOFF_CANDIDATE`. V3 é um **pacote normativo de design e contratos**; não significa que 26 componentes foram revisados individualmente, aprovados ou implementados.

## Decisão do proprietário

Parar de criar um protótipo por microtela na Inteligência. Finalizar a biblioteca inteira por herança das decisões já refinadas, com premium UX consistente e animações apenas quando verificáveis. Avançar depois para a próxima tela principal, **D03 Inteligência Hoje**. A revisão individual não é mais um gate para cada VR.

## Fontes de verdade e precedência

1. **D01 Chat Lateral V4.5 — DESIGN_APPROVED:** identidade, editor, proposta e reconfirmação.
2. **VR-07 Treemap V2 — DESIGN_APPROVED:** área proporcional, agrupamento e legenda.
3. **VR-08 Sankey V1 — DESIGN_APPROVED:** fluxos reconciliados e resultado ≠ saldo.
4. **VR-09 Ranking V1.1 — DESIGN_APPROVED:** contraste/controles funcionais, percentual ≠ impacto em R$.
5. **VR-10 Investigação V2 — BASELINE_ACCEPTED_IN_CONVERSATION:** elogio/avanço de roadmap; referência para heat scale, anatomia e navegação; falta artefato HTML reproduzível no GitHub e gate de QA Electron.
6. **VR-01–06 e VR-11–26 — DESIGN_SPECIFIED_BY_INHERITANCE:** aplicar o padrão universal por esta entrega; nenhuma homologação pixel a pixel individual.

**Ajuste importante:** o gradiente de calor é codificação de **magnitude do aumento de gastos** em um ranking de impacto ordenado. Não substitui cores semânticas universais: economia realizada favorável segue verde; gasto de uma transação normal segue cor neutra; risco/erro segue cor de alerta, não a ordem de um ranking.

## Regras premium globais

- **Camadas visuais:** superfície `#1a1a1a` dark / `#fff` light, elevações discretas; estrutura nítida sem repetição de molduras; text primary `#fafafa` / `#171717`, secundário `#b1b1ba` / `#64646e`. Não usar `color:inherit` para elementos essenciais sem definir cor no contêiner.
- **Hierarquia:** primeiro resposta direta, depois informação quantitativa, depois justificativa. 1 visual principal e até 2 auxiliares; investigações volumosas vão ao Espaço de Análise sob demanda.
- **Heat ranking:** positivo de R$ maior para menor = `#ff516a` → `#ff7470` → `#fa935d` → `#f4b350` → `#f4d363`; base de referência: VR-10 V2; sem aumento = cinza neutro. Mapear por **ranking entre categorias positivas existentes** e usar o último tom para restantes; se todos iguais, intensidade idêntica. R$ e % permanecem em spans alinhados separados.
- **Barras:** nome/delta em `grid`/`flex`; o trilho é um elemento `display:block` separado e com `overflow:hidden`; barra tem `display:block;height:100%`, largura normalizada ao máximo, sem `position:absolute` sobre labels.
- **Tipografia:** dinheiro com `font-variant-numeric:tabular-nums`, alinhamento à direita em células e sem truncamento do valor; textos contrastantes em ambos temas; título 14–18px, valor 22–32px, metadados 10–11px no desktop (mínimo de 11px nos controles touch).
- **Layout:** 4 superfícies: `compact` (D01, pergunta + insight + CTA), `standard` (D02, 1 primário), `analysis` (drilldown/contexto extra sob demanda), `mobile` (pilha + seleção fácil). Sem `overflow` de layout, sem chart ilocalizável.
- **Interatividade honesta:** cada controle visível tem handler e feedback (selecionado/disabled/loading/erro). Se ação não existe, esconder ou desabilitar com explicação; nunca um botão que faz de conta.
- **Evidência:** valores ligados a IDs, período, contas, última atualização e cobertura confiável. Só mostrar gráfico de pontos reais; não exibir faixas de desenvolvimento no app do cliente.
- **Motion progressivo:** hover 120–170ms, entrada 160–220ms, painel 220–260ms, redraw gráfico 200–320ms quando justificado; `prefers-reduced-motion` remove motion. Evitar animação de dados que implique mudança no valor não verificada.
- **Confirmações:** proposta → prévia → afetados/exclusões → autorização contextual → revalidação → apply somente por serviço permitido → recibo verdadeiro; a resposta de IA não é permissão de escrita.

## Matriz completa de ajustes por componente

| Família | Ajuste visual obrigatório | Interações exigidas | Motion só se verificável | Fallback / estado |
|---|---|---|---|---|
| VR-01 Resumo executivo | Mostrar headline factual, 3 métricas e leitura de mudança; remover chips técnicos | Abrir investigação do principal desvio; não repetir pergunta já consumida | Fade-in 180ms dos indicadores após dados válidos | Comparação ausente → KPIs sem delta |
| VR-02 Indicador isolado | Valor principal tabular, intervalo visível, ícone lineal, variação contextual | Clique abre fonte e movimentações do número; sem dupla função em card | Contagem animada só se cálculo final idêntico, senão crossfade 160ms | Período ausente → não mostrar evolução |
| VR-03 Antes e depois | Colunas alinhadas antes/depois e diferença; indicador positivo/negativo por sentido | Abrir detalhe das diferenças; períodos coerentes | Crossfade entre períodos 180ms; não deslizar números de lugar | Base zero → ocultar taxa, exibir Δ em R$ |
| VR-04 Tendência temporal | Gráfico responsivo com pontos reais, eixo e tabela alternativa | Hover + teclado mostram ponto; seleção abre lista do período | Desenho de traço 320ms só com dados validados e reduced motion off | Sem dados suficientes → comparação/estado parcial |
| VR-05 Barras comparativas | Barras em trilho próprio, nome/valor em flex ou grid separados; escala coerente | Alternar ordem e ver lista por categoria | Transição de largura 220ms apenas no recálculo, sem sobreposição | Zero → barra neutra, negativos → eixo zero divergente |
| VR-06 Distribuição | Rosca com centro, legenda acessível, total conciliado e rótulo Outros se necessário | Segmento e item de legenda sincronizados; abrir composição | Realce/atenuação 150ms; nada piscando | Valores mistos → barras divergentes |
| VR-07 Treemap V2 aprovado | Área proporcional a valores, 6 categorias, seleção, % e total | Selecionar área/legenda, comparar outubro, abrir movimentações | Hover 150ms, painel de detalhe 180ms | Bloco pequeno → abreviação + legenda legível |
| VR-08 Sankey V1 aprovado | Ribbons/nós proporcionais, origens-destinos conciliados, resultado ≠ saldo | Selecionar nó/ribbon/legenda, abrir movimentações e período | Realce dos fluxos 220ms, sem movimento de geometria enganoso | Fluxos não conciliados → tabela reconciliatória/partial |
| VR-09 Ranking V1.1 aprovado | Ranking por R$/%, cores/legendas e barras em trilhos sem sobreposição | Alternar métrica/filtros; detalhe e lista de lançamentos | Reordenação discreta 180ms; barras 220ms | Filtro sem itens → estado vazio com retorno |
| VR-10 Investigação V2 aceita como direção | Cards alinhados; heat scale vermelho→coral→laranja→âmbar→amarelo no impacto, zero neutro | Categoria→grupo→lançamento, busca, breadcrumb, troca de período, tema | Hover 160ms; detalhe/nível entra 200ms | Sem IDs ou subconjunto incompleto → mostrar parcial, nunca inventar lançamentos |
| VR-11 Tabela de movimentações | Linhas harmonizadas com VR-10: valor/datas alinhados, categoria com acento heat só se há comparação | Filtrar, selecionar, detalhes, totais recalculados; controles úteis e consistentes | Realce de linha 140ms, seleção 150ms | Sem permissão de item → linhas agregadas sem identificação |
| VR-12 Recorrências | Timeline limpa, fornecedor, periodicidade e próximas cobranças; sem serviço confirmado como assinatura por heurística | Explorar série de cobranças e contestar suspeita; recomendações contextualizadas | Timeline entra 180ms; realce de vencimento 150ms | Recorrência não confirmada → suspeita explícita |
| VR-13 Orçamentos | Consumo/limite, base em centavos e risco contextual; sem barras sobre texto | Abrir categorias, analisar ritmo de gasto, sugerir ajuste com revisão | Progresso 220ms após verificação, reduzido sem animação | Limite zero/sem metas → estado apropriado |
| VR-14 Fluxo de caixa | Linha do tempo de eventos e saldo projetado separado de disponível | Mudar data, abrir evento e premissas, validar já pago/pendente | Deslizamento de detalhe 200ms; timeline não inventada | Saldo inicial desatualizado → projeção indisponível |
| VR-15 Simulador | Sliders consistentes com baseline, valores antes/depois e resultado recalculado | Editar premissas, restaurar base, salvar somente como proposta supervisionada | Transição do resultado 180ms, sem confete ou promessas | Parâmetros inválidos → controle desabilitado e explicação |
| VR-16 Cenários A/B/C | Alternativas com comparação clara, uma recomendação condicional e critérios iguais | Selecionar e comparar premissas; seguir para plano revisado | Card selecionado 160ms, resultado recalculado 180ms | Cenários incomparáveis → avisar diferenças |
| VR-17 Metas | Progresso legível, acumulado, restante, prazo estimado em contexto | Alterar aporte, ver projeção e diferença vs meta | Animação radial 260ms somente no dado consolidado | Prazo inviável → faixa/indisponibilidade sem data falsa |
| VR-18 Dívidas | Cronograma e custo, saldo, juros, desconto, opções de antecipação | Explorar parcelas e ofertas verificadas; propor, nunca quitar sem confirmação | Timeline discreta 220ms; sem urgência artificial | Falta cotação de quitação → hipótese etiquetada |
| VR-19 Patrimônio | Ativos/passivos e líquido, série reconciliada; desempenho separado de aporte | Explorar classes e evidências; trocar janela temporal | Transição de série 200ms quando intervalo muda | Cotações ausentes → último valor com data, não cotação atual |
| VR-20 Oportunidades | Top3 oportunidades priorizadas por materialidade com razão e valor verificável | Abrir evidência e ação; dispensar sugestão sem perdi-la da conversa | Entrada por linha 140ms; evitar alertas piscantes | Sem oportunidade verificável → insight neutro, sem encher tela |
| VR-21 Plano de ação | Tarefas curtas, status verdadeiro, prazo, efeito esperado ≠ obtido | Editar proposta, revisar escopo e marcar etapa só quando ação ocorre | Check 140ms sem emitir sucesso antes de confirmar | Sem persistência → rascunho claramente marcado |
| VR-22 Proposta de IA | Prévia atual→sugerido, regras, critérios, afetados, exclusões e quantidade/valor | Selecionar/excluir, editar nome e regra, revalidar prévia | Transição diff 180ms; destaque apenas dos campos mudados | Mudança de dados → expirar prévia |
| VR-23 Aprovação e recibo | D01 V4.5 canônica: reconfirmação e autorização contextual; recibo com IDs e possibilidade real de undo | Confirmar/recusar/editar/adiar; disabled até revisão; desfazer se elegível | Sucesso só após resposta real; 180ms de feedback sem animação enganosamente definitiva | Serviço write indisponível → somente proposta |
| VR-24 Relatório e arquivo | Prévia em página limpa, sumário, filtros e abrangência; botão de exportar só quando arquivo existe | Rever fonte/intervalo, gerar arquivo, abrir preview e baixar artefato verificado | Transição de páginas 170ms e skeleton quando gerando | Falha de geração → não mostrar link falso |
| VR-25 Qualidade dos dados | Última atualização, cobertura e lacunas em card informativo discreto, no contexto | Abrir fontes, reconectar/atualizar quando autorizado | Indicador de carregamento apenas durante fetch real | Stale/offline/partial → bloquear conclusões incompletas |
| VR-26 Estados especiais | Empty/loading/partial/stale/denied/offline/error/conflict/expired/applied/undo unavailable | Ação contextual real; retry ou mudança de filtro não estética decorativa | Skeleton suave máximo 1200ms, respeitar reduced motion | Nunca inventar dados nem afirmar gravação |

## Regras de dados e acessibilidade

- Monetário em centavos inteiros; comparações com cobertura/período equivalente; transferências internas e registros `PENDING`/`POSTED` não podem inflar entrada/saída.
- Todas as formas visuais precisam de resumo textual, alternativa tabular/legenda quando gráfico, teclado, foco visível e contraste WCAG AA.
- Sem cores únicas para indicar sinal: sempre rótulos e valores. Comparações devem especificar denominador; base zero não produz % falso.
- O valor de cada grupo deve bater com a soma da lista de lançamentos; qualidade parcial não pode ser apresentada como total consolidado.
- Nenhuma sugestão fixa repetida em páginas. Follow-ups derivados de evidência, período, filtro e respostas anteriores; quando não há dados, sem sugestão inventada.
- Cenários explicitamente simulados não podem assumir o estado de execução/sucesso; detalhar premissas e permitir revisão.

## Responsabilidade e status

- **Design especificado aqui:** as 26 famílias e as variantes em quatro superfícies, incluindo motion e estados.
- **Protótipos com aprovação individual documentada:** VR-07, VR-08 e VR-09; VR-10 V2 aceito como referência visual nesta etapa, sem código canônico publicado nesta entrega.
- **Não realizado:** implementação React/Electron, integração de rotas/contextos e IPC, QA real cross-platform, captura Electron, habilitação da escrita financeira, validação de 26 famílias com fixtures de produção.
- **Entrega ao Executor:** seguir `VISUAL_LIBRARY_HANDOFF_V3.md` e `VISUAL_LIBRARY_ACCEPTANCE_V3.md`. Alterações de produto em branch de integração separada, não neste PR Draft documental.

## Próxima tela principal

**D03 — Inteligência Hoje**. Ela reunirá resumo proativo e contexto diário, sem reintroduzir abas persistentes `Hoje / Conversar / Plano de ação` no chat principal. Para D03, definir superfície principal própria com entradas discretas a partir do menu e do contexto D02.
