# D06 — VISÃO GERAL / PANORAMA VIVO V3 — HANDOFF FINAL DE DESIGN

> **DESIGN_APPROVED (17/11/2026)**. O proprietário aprovou explicitamente a V3 — **Panorama Vivo · Motion Edition** — com a resposta “Autorizado” após avaliar o protótipo. A V1 foi considerada muito básica; a V2 introduziu o mapa exploratório; a V3 mantém a composição V2 e aprova a **camada de animações inovadoras, funcionais e canceláveis**.
>
> **CODE_NOT_STARTED / ELECTRON_QA_NOT_RUN / NOT_RELEASED** — esta documentação NÃO significa implementação aprovada, PR integrado, build Windows, merge ou autorização de escrita financeira.

**Projeto:** `JoaoVittorLi/meu-financeiro` (privado). **Design:** PR #57 e branch `design/mf2-screen-by-screen-20261113`. **Revisão D06:** issue #90. **Integração atual:** PR #76, branch `integration/mf2-rc-all-01-i2a-20261113`, HEAD observado `1bc1b89bf5bdefc0196b0851e690a99f825ca85a` (revalidar ao implementar). **Coordenação:** issue #49. **Roadmap:** issue #55.

**Protótipo aprovado na conversa:** `AppBlock id="mf-d06-motion-v3"` com raiz `#d06motion`, título “Meu Financeiro — D06 V3 · Panorama Vivo Motion Edition”. **IMPORTANTE:** essa referência é um componente interativo na conversa, **NÃO um arquivo HTML reproduzível publicado no repositório**. Não apresentar screenshots de uma versão reconstruída como evidência de fidelidade pixel a pixel sem comparar com o protótipo aprovado.

**Outras fontes obrigatórias**:
- [Mapa de código, ownership e integração](./D06_PANORAMA_VIVO_IMPLEMENTATION_MAP_V3.md).
- [Contrato de animações, interações e acessibilidade](./D06_PANORAMA_VIVO_MOTION_SPEC_V3.md).
- [Fixture determinística e exceções](./D06_PANORAMA_VIVO_FIXTURES_V3.json).
- [QA e critérios de aceite](./D06_PANORAMA_VIVO_ACCEPTANCE_V3.md).
- [B01+B02 previamente aprovadas](./QA_EXE_B01_B02_APPROVED_20261116.md) e [catálogo visual único D05](./GLOBAL_CATEGORY_VISUAL_IDENTITY_CONTRACT.md).
- [B05 Inteligência aprovada](./QA_EXE_B05_INTELLIGENCE_APPROVED_V6_20261116.md) — D06 pode *abrir* Inteligência/contexto, não reimplementá-la.

## 1. O que foi aprovado — V3 é a fonte visual da D06 inteira

**Arquitetura visual:**
1. Sidebar e topo reais do produto, filtro de fonte **Contas conectadas / Adicionado por você**, seletor de período, privacidade e contexto de origem.
2. Intro editorial `Seu dinheiro em movimento.` com fonte/período explícitos.
3. Faixa coesa com quatro métricas: **Saldo nas contas (ou saldo manual)**, **Receitas**, **Despesas** e **Resultado**. A primeira tem maior ênfase, mas todas continuam separadas por significado.
4. **Panorama Vivo** como palco protagonista com dois modos no mesmo espaço:
   - **Fluxo**: diagrama proporcional tipo Sankey que parte da base financeira elegível até categorias e, em cenário superavitário, resultado do período. Hover/foco/seleção ilumina a rota, desprioriza as demais; **pulso único** via marcador que percorre a curva, somente em resposta ao evento ou reprodução voluntária.
   - **Ritmo**: gráfico acumulado do período, linha anterior tracejada somente com histórico comparável, **régua deslizante de datas** controlada por range/teclado; guia/ponto, título e valor acumulado atualizados em conjunto.
5. **Lente Financeira** contextual ao lado do palco: valor e narrativa do caminho/dia selecionado, participação, barra proporcional e CTA `Investigar`; mantém 3 prioridades com dados atuais, sem cards enormes repetidos.
6. `Para onde foi seu dinheiro` conserva a **B01 V3**: **faixa segmentada proporcional total + lista** com icon/hue/bar/value/percent perfeitamente alinhados, sempre resolvidos pelo ID D05. A lista do mock não mostra explicitamente a faixa superior; **o contrato anterior B01 aprovado continua sendo obrigatório e não pode ser omitido na versão Electron**. Seleção por categoria sincroniza com o mapa/lente e permite drill-down.
7. `Orçamento em perspectiva` conserva o **anel 360° B02 V7**, sem bolinha/marcador temporal, com valor restante ou excedente, usado/limite, cor semântica distinta da cor da categoria. O pequeno anel V3 é um resumo, não substitui as telas A/B/C completas da B02.
8. Agenda de compromissos, movimentações recentes e contas de referência abaixo, com detalhes em drawer e navegação para módulos existentes.
9. Dark/light, breakpoints responsivos e opção `Reduzir movimento`. A aparência geral é **carvão neutro, bordas discretas, realce seletivo**; proibir “green wash” e efeitos ociosos contínuos.

**Precedência:** D06 V3 prevalece sobre a composição geral da Visão Geral V1/V2. **B01 V3** prevalece sobre qualquer simplificação da lista ou faixa de distribuição que tenha aparecido no D06 V3. **B02 V7** prevalece sobre qualquer simplificação do anel. **D05** prevalece sobre qualquer ícone ou hue demonstrativo no inline. **B05** continua módulo próprio; D06 não altera sua interface aprovada.

## 2. Movimento aprovado, como comportamento de produto

- No `Fluxo`, a entrada e as rotas revelam seus caminhos por um período curto de ~900–1200ms após montar o mapa ou clicar `Reproduzir fluxo`. **Pulso** de luz discreto caminha por cada caminho na primeira entrada; ao escolher um, apenas o caminho selecionado recebe pulso/iluminação (demais em baixa opacidade), e a lente muda para a mesma categoria/resultado.
- O pulso não **acrescenta dinheiro**, não simula transação POSTED, não indica que o saldo foi transferido nem roda em loop eterno. É uma animação da mesma geometria calculada por receitas/despesas.
- Seleção em mapa ou lista B01 deve apontar ao **mesmo categoryId**; click/tap/foco tem reação e o detalhe preserva a seleção e fonte.
- No `Ritmo`, slider escolhido por teclado/pointer muda guia, ponto, data, gastos do dia e valor acumulado da lente; valores reais são derivados de transações validadas. Novo movimento cancela o anterior; sem atraso de contador depois da seleção.
- Alternar Fluxo/Ritmo faz crossfade e reposicionamento curto, preservando fonte, período, privacidade e outros módulos. Ao esconder valores, **toda** a superfície deve respeitar a máscara, inclusive SVG, tooltip, aria-label e drawer.
- Tempo ocioso = interface calma. Sem spark girando continuamente, brilho excessivo ou replay ao mudar foco fora do componente.

Ver [motion_spec](./D06_PANORAMA_VIVO_MOTION_SPEC_V3.md) para durações, cancellation, reduced motion e foco acessível.

## 3. Matriz de fatos e invariantes

| Superfície | Regra financeira |
| --- | --- |
| **Fonte** | `dashboardSource='bank'/'manual'` e `mode='real'`/grants aplicam isolamento. **NUNCA somar** lançamentos manuais + banco sem conciliação explícita |
| **Saldo** | Saldo bancário = referência por conta/instituição, com cobertura parcial/stale. **Não depende da janela de receitas/despesas**. Saldo manual é cálculo distinto, não referência bancária |
| **Resultado** | `periodIncomeCents - periodExpenseCents`. **Não** é saldo em conta, reserva, sobra futura nem orçamento |
| **Fluxo superavitário** | Com fonte/escopo consistentes, `income = Σ validExpenseCategories + positiveNet`. Se o saldo/receita não reconciliar, **não desenhar** a origem como se toda despesa viesse daquela entrada |
| **Fluxo deficitário** | Se `income < expense`, **não desenhar falsa divisão da receita**. Criar base visual explicitamente rotulada “Despesas do período” com categorias somando ao total, e resultado negativo destacado em paralelo, ou alternativa semanticamente correta |
| **Categorias** | Resolver visual por ID do D05, denominador igual a despesas válidas na fonte/intervalo. Excluir transferências/ignore/duplicadas conforme contrato. Agrupar `Outras` apenas com soma explícita real; preservar entradas sem categoria |
| **Ritmo** | Somar gastos por data de referência do domínio; acumulado `C(t) = Σ expense(d), d<=t`. Nunca preencher datas reais com pesos pseudoaleatórios do protótipo; usar zeros legítimos. Comparar só com janela de cobertura equivalente |
| **Orçamento** | ``spentLimited = Σ gasto nas categorias com orçamento definido`; `limitTotal = Σ limites``; orçamento no mês devido a `budgetMonth`, não precisa ser igual à janela selecionada. `null` e `0` são estados distintos. Não dividir por zero |
| **Movimentações** | Fonte bancária = apenas `POSTED` efetivo; não misturar `PENDING` em somatório/trend sem contrato. Últimas = amostra e não base integral |
| **Agenda** | Datas futuras permanecem compromissos **previstos/a vencer**, não POSTED nem automaticamente subtraídas do período realizado |
| **Privacidade** | `overviewHideValues` abrange labels SVG, tooltips, barra, drawer, ARIA narrando valores, screenshots esperados |
| **Revisão** | Entrar na D04 ou filtro de transações existente; clicar insight **não faz escrita**; aguardar capability/receipt para aplicar qualquer proposta |
| **Dados parciais** | Cobertura `partial/denied/stale/expired/empty`: não completar visualmente saldos ou fluxos com números fictícios; estado vazio/contextual e acesso ao detalhe ou reconexão |

**NUNCA** transportar os valores de demo para o perfil pessoal. Somar e armazenar em **integer cents**. Formatador `pt-BR/BRL` só na camada de apresentação. Visual do total e fatias **deve conciliar**, independentemente de easing/frames intermediários.

## 4. Conteúdo e tipografia aprovados

- Título editorial curto, sem jargões como “Sankey”, “ledger”, “POSTED”, “IC2” na tela para usuário final.
- Cards/carvão neutros, contraste do texto acima de qualquer animação. Nome de categoria pode truncar, mas valor BRL e percentual permanecem visíveis com tabular numerals e sem clipping.
- Distinção clara de saldo (referência), resultado (fluxo do período) e margem de orçamento (não dinheiro livre).
- B01 ícone/barra/segmento/percentual por descriptor canônico D05; **sem emoji aleatório**, palette[index], cor por texto ou gráficos de categoria com hue divergente.
- Sem CTA que pareça executar transferência automática. Animações informam relações e escolhas, não atividade bancária.

## 5. Implementação, verificações e bloqueios

O Integrador deve nomear executor/owners e travar edições concorrentes em `src/app.ts`. Fatiamento recomendado:

**R1** preservar estado/filtros/4 métricas; **R2** criar seletores financeiros puros + Fluxo; **R3** Ritmo + slider + comparação; **R4** lente contextual, B01/B02, agenda, listas e drawers; **R5** motion, responsive, acessibilidade, integração e Electron Windows QA.

**Não feito nesta missão:** extração de HTML standalone, alteração de frontend produtivo, fixtures executadas no Electron, build Windows, testes regressivos/CI, merge ou publicação EXE. O protótipo inline é a referência visual; produzir versão reproduzível na etapa de handoff/engenharia antes do gate `IMPLEMENTATION_READY`, e comparar com a V3 aprovada.

**Status final correto:** **D06 DESIGN_APPROVED / HANDOFF_DOCUMENTED / STANDALONE_PROTOTYPE_NOT_EXPORTED / CODE_NOT_STARTED / QA_NOT_RUN**.

Próxima tela na sequência de **design**, após este congelamento: **D07 — Orçamentos** (sem alterar B02 aprovada até revisão explícita).
