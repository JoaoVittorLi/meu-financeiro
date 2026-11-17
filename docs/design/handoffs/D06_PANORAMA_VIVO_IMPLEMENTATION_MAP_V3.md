# D06 V3 — Mapa de implementação e ownership

**DESIGN_APPROVED 17/11/2026 / ENGINEERING_NOT_STARTED.** Leia primeiro o [handoff principal](./D06_PANORAMA_VIVO_APPROVED_V3_20261117.md), [motion](./D06_PANORAMA_VIVO_MOTION_SPEC_V3.md), [fixture](./D06_PANORAMA_VIVO_FIXTURES_V3.json) e [QA](./D06_PANORAMA_VIVO_ACCEPTANCE_V3.md). Design issue #90 · Integrador PR #76 · Design PR #57 · Coordenação #49.

**Base confirmada:** PR #76 HEAD `1bc1b89bf5bdefc0196b0851e690a99f825ca85a` em 17/11/2026. Revalidar HEAD, build scripts, conflitos e símbolos exatos antes de codar. O código abaixo foi lido do checkout da branch de integração; estes são caminhos existentes, **não APIs novas já disponíveis**.

## 1. Caminho de dados e renderer que deve ser preservado

### `src/app.ts` — `renderOverview()` (~1450–1565 do HEAD consultado)

- `dateSpan(state.overviewPeriod,state.customStart,state.customEnd)`; `overviewPriorRange(start,end,state.overviewPeriod)`: fonte de períodos, inclusive custom; respeitar timezone e cortes do produto.
- `useBank = state.mode === 'real' && state.dashboardSource === 'bank' && bank.data.accounts.length > 0`: gate já existente. A alternância de origem é exclusiva; `renderSourcePicker()` implementa `dashboardSource` e estado de atualização `stale`.
- `range=(start,end)=> useBank ? bankSnapshotBetween(bank,start,end) : snapshotBetween(d,start,end)`: **reusar** para totais, categorias e comparativos; não gerar segundo cache de ledger para o gráfico.
- `bankBalanceCoverage(bank.data.accounts)` e `bankBalanceLabel(coverage)`: saldo referência, parcial e contas ausentes; não usar `s.balance` cegamente quando bancário tem cobertura incompleta.
- `overviewComparison(s.expense,prior.expense,compareAvailable)`: comparação não inventada; atual `compareAvailable` exige datas e `!bank.data.truncated`.
- `overviewCumulative(start,end,range,compareAvailable?previous:null)`: caminho para Ritmo real. Substituir efeito/seleção da visualização, **não os dados reais**.
- `flowSegments(start,end,range)`: gráfico de entradas/saídas existente; seu nome não implica Sankey por categoria, portanto não substituir por uma projeção falsa.
- `s.categories` e `this.getCategories()`: agregações/denominador da categoria. O atual `categoryColor(name,index)` faz fallback em `palette[index]` — **não reutilizar**; trocar pela resolução única D05.
- `state.overviewHideValues`: origem canônica de privacidade do overview, incluindo informações auxiliares.
- `state.overviewChart`: hoje `'spending'|'flow'`; compatibilizar migração de UI para `'rhythm'|'flow-map'` com owner do estado, sem quebrar atalhos/estado persistido. Novos nomes são **proposta**, não código existente.
- `pendingDashboardItems(state.planning.items)`, `generatedAt`, `upcoming`, `overdue`: agenda com vencidos/inclui hoje; a demonstração estática 17/20/22 é *apenas mock*.
- `limits`, `budgetCoverage`, `spentLimited`, `totalLimit`: orçamento mensal existe; consome apenas categorias com `hasLimit`.
- `recent`: somente banco `POSTED` e `effectiveNature` elegíveis; manual em fonte separada, com origem/valor real.
- `openOverviewTransactions`, `this.navigate('planning')`, `this.navigate('budgets')`, `openBankDetail`, `openManualDetail`, `openPlanDetail`, `openIntelligenceContext('overview')`: **reutilizar** para ações/drilldown; não criar no D06 um editor duplicado.

### CSS e fontes de identidade

| Caminho existente | Ownership | Ação |
| --- | --- | --- |
| `src/app.ts` | **Integrador reserva trecho/owner único** | montagem do D06 e estado de UI; preservar demais B01–B05 e core |
| `app/overview.css` | Executor D06, classe `.mf-d06-*` preferencial | adicionar tokens/motion isolados, manter seleção `.u1-*` legada somente enquanto usada |
| `app/index.html` | Integrador | conferir ordem real de CSS e arquivos no bundle/ASAR, sem dependência órfã |
| `src/d05-visual-assets.ts` | owner D05/Integrador | helper de descriptor único por ID para ícone/hue |
| `electron/d05-taxonomy.json`, `shared/d05-svg-registry.json` | D05 canônico | leitura, sem duplicar palette/index/emoji |
| `src/intelligence-view.ts` | owner B05 | **não alterar** para produzir detalhes de Visão Geral |
| `src/intelligence-review.ts` e CSS D04 | owner D04 | navegar/reutilizar; não reescrever |
| `electron/*` / `preload.cjs` / banco SQLite | owner de dados | fora do escopo de motion e só mudar após change de contrato |

## 2. Componentes novos sugeridos (não existem ainda)

- `OverviewSnapshotSelector` (puro): recebe `source, range, snapshot`, devolve `incomeCents,expenseCents,netCents, categories[], coverage, accountReference`, sem DOM e sem bancos novos.
- `OverviewFlowModel` (puro): categoria→quantia, top5/Outras, resultado positivo/negativo e geometria com escala. Não considerar total da receita como base se `expense>income`.
- `OverviewRhythmModel` (puro): vetor diário validado, acumulados e `comparisonValid`, com zero legítimo por dia.
- `OverviewStage`: renderiza `Fluxo/Ritmo` e foco, compartilha `selectedCategoryId` e `selectedDay` com a lente.
- `OverviewLens`: leitura derivada exclusivamente de model ativo; contextos carregamento/sem dados/grant negado.
- `OverviewMotionController`: atualiza foco/animadores e cancela no unmount; não toca SQLite, IPC, authorization ou categoria.
- `OverviewDrawer` opcional **apenas** quando puder reutilizar drawer de detalhes já existente; o padrão é navegar para D05/D04/Planejamento e preservar contexto.

**Não** copiar `#d06motion`, `.route` globais, CSS ou dados do AppBlock para produção indiscriminadamente; o HTML inline é referência de comportamento e estética, não arquitetura de componentes obrigatória.

## 3. Sequência de implementação sem conflitos

**R1 (core preservado):** owner do estado fixa `src/app.ts`, integra 4 KPIs + source/period/privacy com testes dos contratos existentes. Nenhuma mudança nas fórmulas.

**R2 (Fluxo):** resolver de centavos + categoriaId D05 + validação reconciliação, cenário superavitário e deficitário, tratamento `Outras` e sem-categoria; exposição de gráfico com foco/teclado. Só depois permitir pulso.

**R3 (Ritmo):** usar `overviewCumulative` ou derivação de transações reais; slider com `selectedDay`, comparação equivalente e guias SVG; mudança de dias não atualiza dados.

**R4 (detalhes):** lente vinculada à mesma seleção, B01 V3 completa **com faixa segmentada B01** (presente no contrato, apesar de omitida no mock inline), B02 V7 correta, prioridades verificadas, agenda real, movimentos POSTED e detalhes D05.

**R5 (motion e QA):** ativar pulse/crossfade/disclosures do motion_spec; dark/light, reduced motion, privacy, viewport, regressões, Electron Windows e controle de recursos em PC sem GPU estável.

Em toda R: PR próprio de código, SHA atualizado, divisão de responsabilidades, testes que foram efetivamente executados. Sem merge/release/EXE automáticos por autorização de design.

## 4. Invariantes técnicos obrigatórios

- Estado do mapa e gráfico derivado do **mesmo snapshot**; a seleção de visualização não muda categoria, registro, ledger, saldos, orçamento ou grants.
- Valor do resultado é receita − despesa; saldo é referência distinta; fluxo deficitário mostra explicitamente resultado negativo, sem compensação inventada.
- Porcentagem de B01 divide por total de despesas válido. Faixa segmentada por participação; **barra de cada linha** conforme o contrato B01 (normalizada ao **maior valor**), não por percentual do total.
- Cores vetoriais e IDs: `resolveCategoryVisualIdentity({categoryId,subcategoryId})` é API **ilustrativa** no contrato global; buscar helper real e implementar/estender de forma única, sem palette por índice. Não usar strings do mock como `categoryId`.
- Orçamento com `null` ≠ `0`; estado com sem limite/zero/100%/>100% de forma explícita.
- Tempo real não significa transações reais ocorrendo: pulsos só movimento decorativo orientado ao dado **já calculado**.
- Se `overviewHideValues===true`, não expor valor em SVG, title, tooltip, ARIA, logs, lens nem drawer.
- No cenário `mode=demo`, rotular os dados demonstrativos; não exportar fixtures para modo pessoal ou enviar dados pessoais à IA por mera navegação.
- `prefers-reduced-motion`, botão in-app, teclado, foco restaurado e sem animações ociosas são parte bloqueante da aprovação.

## 5. Regressões e ferramentas

Inspecionar scripts e verificar as suites reais em `tests/` para overview, snapshot, orçamento, transações, conversão de fontes, B01–B05, perfis; não inventar nome/comando de teste. Validar TS/Node, Electron Windows, ASAR/preload, modo demo/real, 1366x768/1920x1080/zoom125/150%, 20 alterações rápidas de seleção, CPU/GPU degradada.

**Não declarar** PASS ou fidelidade ao design em Electron sem capturas/reprodução real. Matriz [acceptance](./D06_PANORAMA_VIVO_ACCEPTANCE_V3.md).
