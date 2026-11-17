# Meu Financeiro 2.0 — Handoff de Design B01 + B02 (Rodada A / #84)

**DECISÃO DO PROPRIETÁRIO:** B01 V3 aprovada 100%; B02 V7 aprovada para handoff em 16/11/2026.  
**Estado:** `DESIGN_APPROVED / CODE_NOT_STARTED`. **Não** é homologação de Electron/Windows.  
**Origem:** protótipos interativos aprovados no chat de Design do projeto Meu Fin.  
**Integração:** PR #76 (HEAD observado em 16/11: `1bc1b89bf5bdefc0196b0851e690a99f825ca85a`), issue #84; coordenação #49; D05 catálogo aprovado PR #57, issue #70. PR #81 estava fechado na última leitura; conferir novos HEADs antes de editar.  
**Ownership:** Integrador coordenará conflitos em `src/app.ts` e CSS compartilhado; executor só altera em branch autorizada. **Sem** build Windows, CircleCI, merge, deploy nem escrita pessoal por IA sem autorização explícita.

## 1. B01 V3 — Visão Geral · Para onde foi seu dinheiro

### Aprovação visual / limites
- Preservar identidade premium do MF2 e título `Para onde foi seu dinheiro`; manter cálculos/escopo/fonte e comportamento de filtro.
- Acima da lista: faixa de distribuição em segmentos proporcionais ao valor agregado; os segmentos são clicáveis, mostram categoria/valor/percentual com teclado/ARIA.
- Lista: **ícone vetorial D05** + nome truncável + barra uniforme + valor BRL tabular à direita + participação percentual à direita. As colunas devem permanecer perfeitamente alinhadas a 1366 e 1920; no compacto/mobile, valor e % ficam na primeira linha e track na segunda.
- **UMA ÚNICA IDENTIDADE de cor por categoria**: faixa, ícone, fundo discreto, barra e detalhe vêm do mesmo descriptor D05, usando o `hue` do catálogo oficial. Não usar `palette[index]`, cores aleatórias ou emoji/texto para gerar hue.
- Realces: hover/foco discreto, seleção persistente, detalhes sob demanda; clique na categoria pode abrir drill-down contextual sem perder período/fonte/privacidade. Não mudar valores escondidos.
- Gráfico de participação: denominador **exatamente o conjunto de despesas válidas no período/fonte**; `transfer`, `ignore`, duplicados excluídos conforme contrato, POSTED/PENDING não misturados. Se lista mostrar top 5 apenas, a faixa deve representar o mesmo total com segmento `Outros` válido ou mostrar todas as categorias, não reescalonar indevidamente a soma a 100%.
- Botões e área clicável com foco/teclado; evitar aninhamento de botão; transações correlatas precisam ser consultáveis, mas nenhum clique de inspeção realiza gravação.

### Critérios de aceite
1. O ícone/hue de `cat:assinaturas` é invariável entre B01, B02 e D05.
2. Percentuais somam 100% dentro da precisão de exibição (ajuste visual residual sem falsificar valores); barras representam gasto relativo ao maior valor, **faixa** representa participação total.
3. Valores longos, nomes extensos, fonte manual/bancária, zero, categoria desconhecida, máscara, dark/light, reduced-motion, 1366×768 e 1920×1080 sem clipping/overflow.
4. Testes de agregação e filtros sem regressão no ledger; capturas reais Electron antes/depois, sem substituir por screenshots de mock.

## 2. B02 V7 — Orçamentos · Budget Orbit + hierarquia D05

### Tela A — cards gerais (preservar V6 aprovada)
- Card inteiro é botão (teclado/Enter/Space, hover sutil, chevron neutro). Não criar CTA separado `Explorar`.
- Anel **360°** de uso do limite, sem velocímetro semicircular, **sem marcador temporal**, sem pílula/botão dentro do círculo.
- Centro: valor **restante** (ou **excedido**), na **mesma cor semântica do anel**. O rótulo é neutro. Informações de gasto/limite em duas colunas.
- Ícone vetorial/hue da categoria é independente da semântica: verde normal, âmbar próximo (>=90% e <=100%) e vermelho excedido (>100%). Mesmo pai D05 com hue invariável.
- 100% ou mais: arco limitado a 100% do círculo, mas apresentar percentual real e excesso em BRL, sem esconder valor. **Limite R$ 0**: não dividir por zero; não apresentar ring percentual falso; exibir estado próprio e ação contextual. **Sem limite**: diferente de limite explicitamente zero.

### Tela B — detalhe de categoria principal
- Breadcrumb `Orçamentos › Categoria`, mesmo anel principal com percentual de uso + gasto, limite e restante/excesso.
- Seção `Onde você gastou`: faixa proporcional de participação dos gastos da categoria por subcategoria, conciliada com valores efetivamente classificados.
- Cards de subcategoria inteiros clicáveis: ícone/hue **do filho D05**, nome, valor BRL, número de transações e mini-anel com **percentual da participação no gasto do pai**. Não inventar orçamento individual/limite para filhos.
- Mostrar por padrão somente subcategorias com gasto, com `Mostrar todas` incluindo zeradas. Exibir `Sem subcategoria` como grupo real para valor pai não detalhado (incluindo dados históricos e subcategoryId null); **nunca sumir dinheiro para fazer a distribuição fechar**.
- Somatório de subcategorias + `Sem subcategoria` deve ser idêntico ao total do pai, sob mesmos filtros, fonte e período; transferências/estornos/parcelas conforme domínio.
- Área de informação sem jargão técnico: texto claro indicando que mini-anéis representam **participação**, não uso de limite.

### Tela C — detalhe de subcategoria
- Breadcrumb `Orçamentos › Categoria › Subcategoria`; anel de participação, **não** percentual de orçamento; valor e movimentações reais filtradas.
- Histórico com datas, descrição, valor e IDs verificáveis; paginação/filtro em grande volume; estados vazio, parcial, sem acesso; clicar não recategoriza.
- Navegação de volta preserva mês, fonte, seleção, scroll e foco quando praticável; dark/light e mobile.

### Qualidade e compatibilidade
- Não alterar limites recorrentes, contratos de planejamento ou orçamento, fórmulas de soma, modelos SQLite nem natureza de transferências.
- Não remover capacidade existente de **Editar limite**, **Sugerir limite** e budget `Sem limite`; redistribuir essas ações na tela detalhe, sem criação de escrita invisível.
- Em `loading`, mostrar skeleton, em `partial` reconhecer cobertura, em `stale` mostrar data e em `error` permitir tentar novamente; não inventar saldos.
- Validar no Electron 1366/1920 dark/light e zoom 125/150%, teclado/foco, leitor de tela, 390px PWA futuro.

## 3. Bloqueio transversal: visual identity resolver único

Consultar [GLOBAL_CATEGORY_VISUAL_IDENTITY_CONTRACT.md](./GLOBAL_CATEGORY_VISUAL_IDENTITY_CONTRACT.md) e adotar **em B01 e B02 desde a implementação** — não remendar localmente. Esse mesmo contrato é **critério de aprovação de B03**, e o seletor B04 também deve consumi-lo.

## 4. Arquivos de referência e pontos de implementação

- PR #76: `src/app.ts` / `app/overview.css`: `.u1-category-row`, `palette[index]` em `categoryColor`; orçamento em `budget-grid` com `cat-symbol` via `info.emoji` e semicirculo `mf-budget-b3`.
- D05: `electron/d05-taxonomy.json`, `shared/d05-svg-registry.json`, `src/d05-visual-assets.ts`, `src/d05-movements.ts`, CSS D05.
- Evitar coeditar `electron/main.cjs`, `preload.cjs`, `src/intelligence-view.ts` ou migrations sem necessidade/coordenação. Atualizar documentação de arquitetura se criar helper compartilhado.

## 5. Entregáveis exigidos do executor

- Código funcional + testes unitários de resolver, B01, B02, orçamento zero e somatórios de subcategorias.
- Diff contra HEAD atual; QA Electron 1366×768 e 1920×1080 dark/light; capturas antes/depois, smoke teclado e verificação de performance com volume.
- Relatório `PASS/FAIL/NOT_RUN` por critério e justificativas de divergência.
- Handoff ao Integrador com limites de arquivo/ownership; **não enviar EXE nem disparar CI sem autorização do proprietário**.

**Conclusão:** B01 V3 e B02 V7 DESIGN_APPROVED. B03/B04 design em próxima rodada, sem aprovação implícita.
