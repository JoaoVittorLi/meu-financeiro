# V1.2 — Alinhamento e prevenção de sobreposições (11/11/2026)

**PR:** #39 · **branch:** `feat/mf2-int1-ai-workbench-integration-20261111` · **HEAD inicial:** `310f374605d562f5163209c0a703efc3bc6de578`.

## Escopo e causa verificada

A missão do Arquiteto cita cinco capturas reais do proprietário, mas **as cinco imagens não estavam disponíveis ao Executor 3 nesta sessão**. Não foi possível confirmar pixel a pixel cada defeito original. Foram corrigidas causas objetivamente presentes no CSS e cobertas com regressões. **Não se declara a aplicação integrada homologada.**

- `app/overview.css`: `.u1-category-row` e `.u1-recent-row` usavam `width:calc(100% + 16px)` com `margin-inline:-8px` apesar de efeitos de translação. O grid de categorias ainda usava mínimo rígido de 100px; valores e últimas movimentações tinham `white-space:nowrap`/`text-overflow:ellipsis`. Passaram a respeitar o tamanho do próprio painel (`width:100%; min-width:0`) e permitir quebra dos textos e valores. Cabeçalhos de painéis, resumo de orçamento e fonte dos indicadores ganham wrap quando necessário. A altura imposta `100%` dos painéis de detalhes foi substituída por stretch sem altura artificial. Até 1180 CSS px, a Visão Geral distribui os KPIs em duas colunas e usa pilhas únicas para grids principal e de detalhes. Não há `overflow:hidden` novo, conteúdo removido ou mudança nos totais.
- `app/intelligence.css`: `.mf-ai-today` não definia qualquer grid/gap apesar de conter introdução, cards e banner — agora possui `display:grid; gap:16px`. Cards de Hoje e textos dos botões Preparar análise não estouram colunas; banner de Insights e resumo do Laboratório mantêm separação/quebra natural; ações são flexíveis. Para o drawer contextual I1-B, o cabeçalho pode quebrar em linhas sem sobrepor os botões, o scroll é restrito ao corpo, o compositor permanece visível e mensagens longas podem quebrar sem empurrar a largura. O backdrop sobre a página é **modal intencional** e foi preservado.
- `app/premium-interactions.css`: BUG-02 parcial — dentro do drawer de detalhe, CSS Argon antigo tinha `padding:20px 0` em sections e fundo escuro hardcoded; a camada D1.5 já substituía o fundo por tokens de tema. A V1.2 completa o espaçamento `16px 18px` e reforça `background:var(--surface2); color:var(--text)`, sem interferir nos indicadores V1.1.

**Preservado:** efeitos Border Reveal/Scale-Up V1.1, `src/app.ts`, `src/intelligence-view.ts`, cálculos, transações, bancos, APIs, SQLite, Pluggy, Cloudflare, histórico IA e fluxos de autorização. Sem PR40, sem merge.

## Testes efetivamente executados

1. **25/25 PASS, 0 FAIL em harness V8 isolado**: foram executadas as asserções reais dos arquivos `tests/v1-2-layout-integrity.test.cjs` (8 novas), `tests/v1-1-overview-border-reveal.test.cjs` (6 anteriores) e `tests/d1-5-interactions.test.cjs` (11 anteriores), usando os arquivos-fonte obtidos do HEAD do GitHub. **Não equivale a `node --test` na árvore completa.**
2. **17/17 PASS, 0 FAIL de geometria em Chromium headless local** (Playwright/Chromium em `/usr/bin/chromium`): HTML **sintético, não o renderer Electron**, testando Visão Geral e Inteligência nas combinações de tema claro/escuro, 1366×768/1920×1080, viewport equivalente a 100%/125% de escala; um cenário adicional de drawer aberto 1366×768. Verificações: sem overflow horizontal do documento, sem interseção entre cards/seções irmãs, sem overflow horizontal dos blocos avaliados e compositor do drawer visível. Capturas e manifesto foram produzidos na conversa (arquivo `v1_2_chromium_synthetic_layout.zip`). **O teste de 125% foi realizado estreitando o viewport CSS; não equivale a DPI real no Windows.**
3. **NÃO EXECUTADO:** compile oficial, suite integral Node/SQLite, F08/ASAR, Worker/PWA, Electron GUI, 8 áreas e 32 capturas oficiais; CircleCI Linux não disparado nesta sessão. O terminal não tem checkout nem conectividade DNS GitHub; o conector GitHub permite alterações, mas não executa CircleCI. Nenhum status oficial novo foi confirmado.

## Pendências e decisão

- Abrir as cinco capturas originais e confrontar com Electron real. Verificar 8 áreas, 1366×768 e 1920×1080, escala 100%/125% no Windows, temas, chat lateral, longa descrição, movimento reduzido, cards zerados, foco e estado hover, console e BUG-02 no drawer claro; produzir screenshots autenticados com manifest. Os 17 PNGs sintéticos **não** são evidência Electron.
- Executar **exclusivamente** preflight Linux `preflight_on_demand` no HEAD final do PR #39, parâmetros `run_preflight=true`, `run_windows_build=false`. Colher link e ID, SHA testado, logs de npm ci, types, DB, compile, provenance/F08, ASAR e Worker/PWA. Se FAIL, corrigir e repetir.
- **Decisão: BLOCKED para Windows Preview** até gates verdes e homologação visual integrada; não gerar EXE, acionar runner Windows, promover produção nem fazer merge.
