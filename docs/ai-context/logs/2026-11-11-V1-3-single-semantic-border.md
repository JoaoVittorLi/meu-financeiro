# Meu Financeiro 2.0 — V1.3 | Borda semântica única (11/11/2026)

**Escopo:** correção visual dirigida de inconsistência de cor e moldura duplicada, sem reconstrução de páginas. **PR:** #39, `feat/mf2-int1-ai-workbench-integration-20261111`. **HEAD antes da missão:** `3a92eefa0f6cd8eabf6dd7cf494d077940b41d1f`. **PR #40 documental não alterado.**

## Causas verificadas

1. `app/premium-interactions.css` aplicava `border-color:var(--mf-hover-stroke)` (verde genérico) em seletores `.u2-metric:hover` e equivalentes; `app/operations.css` declarava a borda superior vermelha em `.u2-metric.expense`. No hover, a regra genérica de cor integral criava borda verde, incluindo **Saídas confirmadas**.
2. A V1.1 combinava **border-top 3px nativa** com `::after` posicionado `inset:-1px`, fundo `conic-gradient`, padding de **2px** e máscara vazando por uma segunda geometria. O desenho produzia dois traços separados / espessuras divergentes, principalmente em Saldo e Despesas.
3. O efeito estava concentrado nos quatro KPIs da Visão Geral; indicadores equivalentes de Movimentações, Orçamentos e Contas mantinham regras independentes de hover/cor.

## Código publicado

- `app/premium-interactions.css`: a classe compartilhada `mf-border-reveal` controla **uma única borda real de 3px no `::after`**. A linha nativa superior se torna transparente, preservando sua largura de 3px e, portanto, a geometria externa. A mesma borda é exposta por duas máscaras **aditivas**: topo sempre visível + restante revelado de `0deg` a `360deg`, sem `background:conic-gradient`, padding interno de anel ou `mask-composite:exclude`. Pseudoelemento `inset:-1px` e `border-radius:inherit`, com `scale(1.022)`, 230–240ms, retorno, foco e reduced-motion. Cores vêm exclusivamente de `--mf-border-tone`, default neutro com baixa especificidade e classes `mf-tone-*` de semântica local. Os hovers genéricos D1.5 passam a usar `:not(.mf-border-reveal)` nos grupos financeiros.
- `src/app.ts`: alterados **somente nomes de classe, role/tabIndex e classificação visual do resultado com valores já calculados**. U1 Visão Geral: saldo teal, receitas verde, despesas vermelho, resultado conforme sinal. U2 Movimentações: entradas verde, **Saídas confirmadas vermelho**, resultado positivo/negativo/neutro conforme sinal, pendentes amarelo e registros manuais teal. U3 Orçamentos: gasto vermelho, limites teal, margem conforme excesso/sobra e gasto descoberto warning. U3 Contas: saldo teal, quantidade neutra, referência recente verde, referência a conferir warning. Sem modificação de fórmulas, persistência ou integrações.
- **Exclusões deliberadas:** formulários e cards de simulação, áreas de Inteligência e outras superfícies com interação diferente; não aplicar `border reveal` indiscriminadamente.
- `tests/v1-3-semantic-border.test.cjs`: 8 novas regressões, e atualização dirigida dos testes V1.1/V1.2/D1.5 para a nova arquitetura; preservados contratos funcionais.

## Testes e limites

- **33/33 PASS**, zero FAIL: 8 testes V1.3, 6 V1.1, 8 V1.2 e 11 D1.5, executando as asserções dos próprios `.test.cjs` em harness isolado V8 com arquivos-fonte reais do GitHub no HEAD da implementação. **Não equivalem a `node --test` no checkout.**
- **38/38 PASS** de verificações interativas computadas em **Chromium headless real**, usando fixture HTML sintética e bloco CSS V1.3 **idêntico aos 3973 caracteres publicados no GitHub** (hash de caracteres validado, CSS SHA256 `358fd3fa99617fbbe3d48d4d42e954d7637bfcfeb96f1dae33cc25fccb53df87`). Casos: 1366×768 e 1920×1080; dark/light; 16 KPIs inspecionados com cores em repouso, subamostra com hover/mouseout, resultado positivo/negativo/neutro, valores 0 e textos longos, foco e reduced-motion. Comparou `getComputedStyle` de borda nativa e `::after`, cor RGB, espessura 3px, raio de canto, posição -1px, `mask-image`, progresso 0→360deg, `scale(1.022)`, fundo idêntico e ausência de colisões na fixture. Varredura PIL do topo/base/laterais dos hover de saldo, despesas e saídas confirmou faixa única sem segundo traço colorido.
- **Evidência visual:** duas comparações antes/depois capturadas em Chromium: *antes* = reconstituição sintética da técnica CSS anterior; *depois* = CSS V1.3 real aplicado na fixture. Pacote com PNG, JSON e CSS foi entregue ao proprietário nesta conversa (`v1_3_evidencias_semanticas_sinteticas.zip`). Essas imagens **NÃO** são capturas da aplicação Electron instalada nem substituem as **quatro capturas originais**, que não estavam acessíveis a este executor.
- **Não executados:** testes oficiais TypeScript/Node/SQLite/F08/ASAR, preflight CircleCI no HEAD pós-correção, Electron real e capturas do app instalado. O terminal não tem checkout completo/GitHub DNS e não há integração CircleCI. O check verde de Workers Preview não é preflight.

## Pendências e gate

1. **Executar somente** CircleCI `preflight_on_demand` com branch INT1 e `run_preflight=true`, `run_windows_build=false` no HEAD final, obtendo URL, pipeline/workflow IDs, SHA, resultados e logs. Em FAIL: corrigir causa real e repetir no novo SHA.
2. **Homologar Electron completo**, dados sintéticos, temas, resoluções, hover/mouseout/focus, cartões semânticos U1/U2/U3, contraste do drawer e cinco/oito áreas restantes, ausência de colisões, capturas reais antes/depois. Comparar as quatro imagens originais quando recebidas. DPI 125% Windows só após aprovação específica do runner Windows.
3. **Decisão QA: BLOCKED para Windows Preview** sem CI Linux verde e sem evidência da UI Electron real. Sem merge, Windows build/EXE, produção nem novas funcionalidades.

