# UI-03 beta.6 — homologação visual isolada em Chromium

**Base:** PR #13 (F08), encadeado sobre PR #12 e PR #11. **Versão:** 0.9.5-beta.6.

## Ambiente e limitações
- Renderer **real** compilado com TypeScript 5.8.3; CSS de `app/style.css` e `app/intelligence.css` da branch; React e ReactDOM locais.
- Chromium **144** em display virtual, dirigido por Playwright/CDP, Node **22.16.0**.
- O navegador bloqueia navegações `http://`, `file://` e `data:` deste ambiente. Para realizar o teste, carregamos o documento via `page.set_content` e injetamos **os arquivos reais como scripts e estilos inline**. Isso **não prova** a CSP e o carregamento em `file://` do Electron de produção.
- Dados fictícios em `localStorage` isolado, ou `App.setState` com contas e transações fictícias; nenhuma conta bancária, segredo ou Cloudflare acessado.
- Imagens, medições e resultados detalhados foram entregues na galeria de evidências da conversa. **Não são capturas de instalador Windows.**

## Matriz de observações (após as correções)
- **32/32 combinações** (8 áreas × 1366/910/683/320 CSS pixels) carregadas sem erro JavaScript.
- `document.documentElement.scrollWidth <= innerWidth` em **todas**. Em Movimentações, a tabela excede a viewport apenas **dentro do contêiner de rolagem**, preservando a largura da página.
- F03: dados fictícios em **7 categorias**; cinco categorias + `Outras`, detalhamento de todas, sem quebra letra a letra. Legenda de duas colunas quando disponível, uma em 320px.
- F01: saldos **desconhecidos**, **parciais** e **total conhecido com zero explícito** apresentados distintamente no indicador e resumo bancário. Os testes visuais usam valores fictícios em centavos.
- F04: as **8 navegações** têm nomes na árvore de acessibilidade do Chromium em 320px (incluindo Configurações). Não equivale a validação NVDA.
- F05/F06: `SingleDatePicker` e `PeriodPicker` abrem em 320, 683 e 1366px, cabem na largura do viewport, **Escape fecha** e **foco retorna** ao gatilho. Em calendário de data, ArrowRight move foco ao dia seguinte.
- Corrigido um defeito **reproduzido no Chromium 320px**: scroll automático do viewport fechava o calendário no momento do clique; o handler agora reposiciona o popup no scroll de documento.
- Em 320px o aviso de demonstração agora é legível e todas as abas da Inteligência permanecem visíveis.

## Regressões e compilação
- Novo `tests/ui03-browser-regressions.test.cjs`: três testes para scroll dos dois calendários e contratos CSS estreitos.
- TypeScript 5.8.3 `test:types` e `compile` — **PASS**; `node --check app/app.js` e F08 `check-bundle` — **PASS**.
- Node/SQLite: **190/190 PASS**, PWA: **129/129 PASS**, com fixtures.
- Arquivos alterados: apenas `src/app.ts`, `app/style.css`, `app/intelligence.css`, teste e documentação; nenhuma mudança de versão/dados/cloud.

## Pendências antes de liberar o EXE
- Smoke **Electron real**, com origem `file://`, CSP original, main/preload reais e ASAR; verificação de zoom nativo 150/200% e leitor de tela NVDA.
- `wrangler deploy --dry-run` sem publicar, empacotamento e `verify-asar` real.
- Nenhum deploy, release, merge em `main` ou CircleCI pago executado. PR permanece em **draft**.
