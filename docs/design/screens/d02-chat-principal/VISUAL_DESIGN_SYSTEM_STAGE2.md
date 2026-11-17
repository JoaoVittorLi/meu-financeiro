# D02 — Etapa 2 · Sistema Visual de Respostas
**Estado:** `DESIGN_SPECIFIED` / revisão pendente; **não aprovado pelo proprietário** e **não implementado**. 13/11/2026.  
**Contexto:** biblioteca visual D02 (#58); D01 V4.5 permanece aprovada e congelada.  
**Objetivo:** transformar o inventário de 26 renderers em padrões utilizáveis, semanticamente consistentes e válidos em `compact`, `standard`, `analysis` e `mobile`.

## 1. Base de identidade (alinhada à D01 aprovada)

| Papel | Dark | Light |
|---|---|---|
| Background | `#141414` | `#f4f4f6` |
| Surface | `#1a1a1a` | `#ffffff` |
| Surface raised | `#202328` | `#f4f4f5` |
| Surface hover | `#2b2d32` | `#ebebed` |
| Stroke | `#303034` | `#e5e5e8` |
| Text primary | `#fafafa` | `#171717` |
| Text secondary | `#b1b1ba` | `#64646e` |
| Positive | `#53d896` | `#087e49` |
| Negative | `#ff7a88` | `#c92a3c` |
| Warning | `#f5bc63` | `#975b00` |

- Fonte: Segoe UI Variable (fallback Segoe UI/system-ui). Valores usam numerais tabulares. Tipografia: KPI principal 24–32 px, título de card 14–16 px, corpo 12–13 px, metadado 10–11 px. No mobile, evitar fonte inferior a 11 px para controles essenciais.
- Cards: raio 16 px (interno 10–12), borda 1 px só onde define estrutura. Evitar card dentro de card e bordas duplicadas; linhas de separação internas discretas.
- Sem faixas técnicas permanentes e sem exibir dados de teste como se fossem reais; fontes/tempo/contas aparecem na própria evidência quando impactam a decisão.
- Cores semânticas descrevem favorável/desfavorável **no contexto**: queda de gastos pode ser positiva; aumento de receitas positivo; nem toda variação é verde.
- Motion: entrada 160–220ms, painel lateral 220–260ms; números recalculados sem saltos de layout; feedback hover <170ms; reduzido movimento sem animações sob `prefers-reduced-motion`.
- Ícones: mesma família de ícones lineares, 16–20 px; nunca misturar emoji aleatório com Lucide na UI de produção.
- Espaçamento: escala 4/8/12/16/24/32; densidade define quantidade de informação, não apenas largura.

## 2. Anatomia universal

`Source Context (oculto ou sob demanda)` → `Título / pergunta atendida` → `Resposta direta` → `Visual primário` → `Evidência / metodologia` → `Ação explorar` → `Follow-up contextual`.

- Componente **não precisa** de todos os slots. Ausência legítima de dados omite slot, não cria conteúdo inventado.
- Máximo 1 visual principal + 2 complementares visíveis por resposta. O restante só no espaço de análise sob demanda.
- Renderização exclusivamente tipada: dados financeiros e aggregate IDs vêm de serviços autorizados. Não permitir HTML/JS gerado livremente pela IA.
- A mesma resposta conserva filtros, conversa e rascunho ao alternar chat lateral ↔ principal; não duplicar cálculo nem virar uma tela separada.

## 3. Regras de densidade por destino

| Destino | Comportamento |
|---|---|
| `compact` (D01 lateral) | ~360–510 px de superfície; texto/indicador + 1 CTA; aprofundar em D02 sem transformar D01 em dashboard |
| `standard` (D02 principal) | ~600–840 px de conteúdo; narrativa + 1 chart/card + até 3 KPIs |
| `analysis` (Espaço de Análise) | painel responsivo 45–60% quando possível; filtros, exploração, lista/tabela e hipóteses, sem duplicação de chat |
| `mobile` (PWA) | largura 320–420 px; conteúdo em pilha, listagem compacta, botões de altura ≥ 44 px, modal em tela inteira em operação sensível |

## 4. Matriz de anatomia e adaptações (26 famílias)

| ID | Família | Anatomia da resposta | Compacto / Principal / Expandido / Mobile | Critério de fallback |
|---|---|---|---|---|
| VR-01 | Resumo executivo | summary | Header de período + 3 métricas + 1 leitura + Explorar | Compacto 1 métrica; principal 3; expandido decomposição; mobile métricas empilhadas | sem referência comparável → ocultar variação |
| VR-02 | Indicador | kpi | Valor destaque + rótulo inequívoco + período + variação válida | Compacto valor único; principal delta; expandido série/transações; mobile valor escalável | sem período anterior → mostrar apenas valor |
| VR-03 | Comparação | compare | 2 períodos equivalentes + delta absoluto + relativo + explicação | Compacto antes→depois; principal lado a lado; expandido filtros; mobile pilha | base zero → taxa não disponível |
| VR-04 | Evolução | trend | Gráfico real + eixo de datas + tooltip + tabela | Compacto microtendência quando validada; principal linha; expandido zoom; mobile scroll | menos de 3 pontos → comparação simples |
| VR-05 | Barras | bar | Barras com rótulos acessíveis e escalas consistentes | Compacto ranking 3; principal até 6; expandido filtros; mobile horizontal | negativos → linha zero explícita |
| VR-06 | Distribuição | donut | Composição com total e legenda interativa | Compacto top2 + outros; principal rosca; expandido detalhe; mobile legenda abaixo | negativos/misto → barras divergentes |
| VR-07 | Treemap | treemap | Áreas proporcionais e rótulos não cortados | Compacto top3 lista; principal blocos; expandido drill; mobile lista | áreas pequenas → agrupar outros |
| VR-08 | Sankey | sankey | Fluxos reconciliados com origens e destinos | Compacto resumo; principal fluxograma; expandido Sankey; mobile lista | não conciliado → tabela de entradas e saídas |
| VR-09 | Ranking de variação | rank | Top aumentos/quedas em moeda e contribuição | Compacto top2; principal top5; expandido todas; mobile lista | sem pares comparáveis → não sugerir causa |
| VR-10 | Investigação | drilldown | Categoria→comerciante→transação; breadcrumbs | Compacto botão Explorar; principal resumo; expandido níveis; mobile drill uma coluna | dados sem IDs → abrir somente agregados |
| VR-11 | Movimentações | table | Lista com categoria, data, valor e seleção | Compacto top2; principal lista; expandido filtros/páginas; mobile cards | sem permissão de item → mascarar detalhe |
| VR-12 | Recorrências | recurring | Próximas cobranças, frequência, valor, mudanças | Compacto total; principal 3 serviços; expandido timeline; mobile lista | frequência incerta → não marcar como confirmada |
| VR-13 | Orçamento | budget | Consumo vs limite com faixa e projeção | Compacto velocímetro compacto; principal progresso; expandido ritmo; mobile card | limite zero → não dividir por zero |
| VR-14 | Fluxo caixa | cashflow | Saldo inicial, entradas/saídas, datas, projeção | Compacto próximo evento; principal timeline; expandido calendário; mobile agenda | sem saldo inicial confiável → não mostrar final |
| VR-15 | E-se | whatif | Controles editáveis, premissas, recálculo, antes/depois | Compacto CTA; principal 1-2 sliders; expandido múltiplos; mobile sliders verticais | dados desatualizados → cenário sinalizado |
| VR-16 | Cenários | scenario | Alternativas A/B/C + critérios comparáveis | Compacto indicação curta; principal 2 cenários; expandido 3; mobile pilha | premissas distintas → explicar limites |
| VR-17 | Metas | goal | Meta, acumulado, falta, aportes e prazo | Compacto progresso; principal jornada; expandido simulação; mobile anel e resumo | prazo incerto → faixa e premissas |
| VR-18 | Dívidas | debt | Parcelas, custo, antecipação e fluxo | Compacto saldo; principal opções; expandido cronograma; mobile cards | sem quitação oficial → sem economia afirmada |
| VR-19 | Patrimônio | portfolio | Ativos/passivos, variação e composição | Compacto saldo líquido; principal alocação; expandido drill; mobile lista | datas diferentes → informar descasamento |
| VR-20 | Oportunidades | insight | Severidade contextual, benefício, justificativa | Compacto uma ação; principal top3; expandido detalhes; mobile lista | sem evidência → hipótese, não alerta |
| VR-21 | Plano | plan | Metas/tarefas, progresso, datas e revisão | Compacto próximo passo; principal checklist; expandido calendário; mobile etapas | ação não persistida → indicador de rascunho |
| VR-22 | Proposta | proposal | Atual→sugerido, contagem, exceções, escopo | Compacto sugestão; principal preview; expandido lista; mobile modal | alteração de regra → invalidar prévia |
| VR-23 | Aprovação/recibo | approval | Resumo, consentimento explícito, resultado idempotente | Compacto modal D01; principal recibo; expandido log; mobile full dialog | sem contrato write → botão indisponível |
| VR-24 | Relatório/arquivo | report | Prévia, fontes, escopo, formato e entrega | Compacto link; principal capa e resumo; expandido paginação; mobile preview | sem arquivo gerado → não simular download |
| VR-25 | Qualidade | quality | Cobertura e última atualização, lacunas e alternativas | Compacto aviso; principal qualidade; expandido por fonte; mobile status | não inferir acesso atualizado |
| VR-26 | Estados | state | Skeleton, vazio, parcial, stale, negado, offline, erro | Compacto inline; principal aviso; expandido diagnóstico; mobile full width | não esconder falhas silenciosamente |

## 5. Regras para interação

- Inspeção visual (legenda, filtro, período, clique em barra/linha) **não autoriza escrita**.
- Interação em filtros deve recalcular e atualizar todos os totais vinculados; preservar seleção e breadcrumb.
- Sliders de cenários calculam determinísticamente com premissas explícitas, reset e comparação baseline; nunca “economia conseguida” antes de realizada.
- Ações financeiras: proposta read-only → lista de afetados → excluir/editar → última confirmação desmarcada por padrão → revalidação → aplicar → recibo real → undo se permitido. Reutilizar D01 V4.5.
- Falha de dados nunca provoca gráfico vazio em silêncio; mostrar estado contextual, ação viável e origem da indisponibilidade quando relevante.
- Follow-ups crescem com a conversa; não repetir pergunta consumida e não sugerir algo sem dado ou serviço habilitado.

## 6. Cobertura técnica e qualidade

A biblioteca de design é **completa em especificação de padrões**, não em implementação: a galeria pode usar dados sintéticos, mas backend, contratos, UI real Electron e QA final seguem pendentes. Nenhuma mudança deve chegar à `main` ou habilitar escrita por IA a partir deste pacote.

## 7. Próximo gate

Validar a galeria nas 26 famílias, quatro contextos, temas claro/escuro e estados essenciais. Registrar feedback por ID `VR-XX`. Quando proprietário aprovar, congelar `DESIGN_APPROVED` e enviar pacote para engenharia; antes disso, continuar `PROTOTYPING`.
