# Meu Financeiro 2.0 — D05 E3 / Handoff de interface Premium V1.3

**Data:** 14/11/2026  
**PR:** #81 (Draft) · **branch:** `feat/mf2-d05-e1-hierarchy-20261113`  
**Base alvo:** PR #76 `integration/mf2-rc-all-01-i2a-20261113`  
**Design obrigatório:** PR #57 e issue #70, `DESIGN_APPROVED / IMPLEMENTATION_READY`  
**Coordenação:** #49 · **engenharia bloqueante:** #74 · **EXE:** #71

## Código E3 efetivamente publicado

- `src/d05-visual-assets.ts` — catálogo 14×61, código vetorial local dos **67 glifos SVG originais** aprovado pelo Designer, `iconKey`, `hue`, fallback seguro; apenas markup SVG fixo do registry, nunca HTML de merchant.
- `src/d05-movements.ts` — componente real `D05Movements`, integrado a `App.renderMovements()`, com leitura dos dados do App e acesso opcional ao contrato D05 E2. Não contém fixtures nem segundo app/iframe.
- `src/app.ts` — a rota existente renderiza a D05 e mantém a tela legada de categorias/regras acessível; preserva navegação externa para a fila de revisão. Importação CSV passou a exigir confirmação de quantidade antes de gravar lançamentos manuais.
- `app/d05-movements.css` + `app/index.html` — CSS isolado com tokens dark/light aprovados, 43px no ícone, merchant destacado, valores verde/vermelho, ponto azul, seleção circular, switch Premium e reduced-motion.
- `tsconfig.json` — inseriu os dois arquivos TS no bundle único existente, sem modificar D01–D04.
- `electron/d05-preload-bridge.cjs` — **adaptador isolado**, exporta `createD05PreloadBridge(ipcRenderer)` com canais nominados. NÃO está registrado em `electron/preload.cjs`, que pertence ao Integrador.
- `tests/d05-e3-renderer.test.cjs` — 6 testes Node versionados: fonte TypeScript, React16/DOM simulado, 14/61/67, KPI e estados POSTED/PENDING, modo demo, estilo/montagem e API allowlist. Sua execução oficial exige o checkout completo.

## Comportamentos E3 implementados no renderer

**Fonte de dados:** `host.state.data.transactions` e `host.state.bank.data.transactions` carregados pelos handlers financeiros existentes. Se os handlers D05 de leitura estiverem presentes, `d05Catalog` + `d05BankList` + `d05ManualList` resolvem IDs de pais/filhos de SQLite. Na ausência de contrato completo, mostrar explicitamente indisponibilidade/parcialidade; não inventar filiação.

**Tela:** quatro métricas do escopo filtrado (entradas e saídas confirmadas, resultado não é saldo, fila a conferir); origem banco/manual **não somada automaticamente** em visão mista; POSTED com revisão pendente = ponto azul ao lado do merchant; PENDING = relógio SVG e excluído dos totais e da revisão; contas, pesquisa, mês, família/filho, natureza, ordem, abas todas/a conferir/revisadas, grupo por dia switch, seleção circular e detalhes via handlers existentes.

**Categorias:** clique no próprio ícone abre popover de 14 pais, filhos opcionais, `subcategoryId: null` permitido, confirmação explícita antes da gravação. Em manual, `host.updateData` chama `finance:save`, cujo FinanceDB na branch E2 valida ID-pai/filho na transação. Banco requer `d05AssignBank` instalado pelo Integrador; sem este, a tela mostra indisponível/erro e **nunca emite sucesso**.

**Lote bancário:** só seleciona movimentos bancários; revalida seleção, busca prévia `d05BankBatchPreview` com `previewVersion`, mostra nomes/valores/contagem, exige segundo clique em `d05BankBatchApply` e só declara sucesso quando recibo afirma quantidade integral. Sem IPC a operação fica bloqueada. **Lote manual atômico não implementado** porque E2 não publica esse contrato.

**Revisão:** ponto azul só para banco POSTED não revisado; painel mostra merchant/conta/data/valor e ações Corrigir categoria, Marcar como revisada e Agora não. Operação usa fluxo bancário existente e reconsulta status após commit; não trata PENDING como aprovado.

**Cadastro/CSV:** novo movimento manual em perfil atual com data, descrição, valor, tipo, categoria e filho opcional. CSV usa o fluxo já existente no App, agora exigindo confirmação agregada da importação, mas **preview CSV linha a linha e histórico de fingerprint de importação ainda exigem integração/QA**; não declarar esse gate fechado.

**React legado:** `app/vendor/react.min.js` é **React 16.0.0**, `react-dom.min.js` é 16.0.1. A primeira tentativa usou hooks, incompatíveis; corrigido para `D05Movements extends React.Component` com estados/ref/effects implementados no ciclo de vida da classe e sem `React.Fragment`. **Não** atualizar React sem aprovação do Integrador. Validar regressão real Electron.

## Handoff obrigatório ao Integrador: IPC real e segurança

1. **Ownership exclusivo do Integrador:** `electron/main.cjs`, `electron/preload.cjs`, IA I2-A/B/C/D/E e `integration/mf2-rc-all-01-i2a-20261113`. O PR #81 não alterou esses arquivos compartilhados.
2. MAIN após instanciar FinanceDB: instalar somente quando houver gates definitivos `installD05Ipc({ipcMain,finance:db,requireAppSender,authorizeRead,authorizeWrite})` de `electron/d05-ipc-adapter.cjs`. `authorizeRead` deve validar sessão, escopo, conta e perfil no processo principal. `authorizeWrite` deve validar proprietário, perfil, conta, gesto humano, backup/preview e token de confirmação quando aplicável. **Não aceitar `owner` ou `approved` arbitrário do renderer/modelo.**
3. Preload: mesclar allowlist **dentro do contexto financeDesktop existente** (`...createD05PreloadBridge(ipcRenderer)`), sem criar ponte IPC genérica, sem substituir funções D01–D04. Arquivo `electron/d05-preload-bridge.cjs` está pronto para importação; o Integrador deve revisar/autorizá-lo.
4. Renderer já procura `d05Catalog,d05BankList,d05ManualList,d05AssignBank,d05BankBatchPreview,d05BankBatchApply`; outros canais existem para regras, splits, subcategory CRUD e planejamento. O renderer NÃO tem qualquer concessão de IA.
5. IA I2-E mantém propostas de categoria plana bloqueadas até a integração com o resolvedor D05 validado; usar `new D05CategoryService(db).asReadOnlyFacade({authorize: trustedScopeCheck})` somente para leituras com grant real e owner no MAIN. Não ativar escrita pessoal sem homologação e autorização própria.
6. Em transações manuais, separar o perfil `real/demo`; não migrar dados reais para testes, nem mudar fonte Pluggy, apenas overrides locais. Sincronização Cloud/PWA **não** liberada por E3.

## QA e limitações transparentes

| Verificação | Status |
|---|---|
| Cabeças PR #81/#76 e design #57/#70 | PASS, consultas GitHub |
| Aprovação 14×61 e 67 glyphs + iconKeys | PASS, conferência estática |
| Sintaxe V8 e balanceamento delimitadores em E3 | PASS, teste isolado |
| Smoke **isolado do código de GitHub** com TS apagado mecanicamente e React16 simulado | PASS (4 métricas, 4 linhas, 1 ponto revisão, 1 relógio PENDING, 14 pais no picker, modo demo isolado) |
| 6 testes E3 versionados no **checkout Node + TypeScript** | **NOT_RUN** |
| Suites E1/E2 e `npm run test:db` / `npm run test:types` / `npm run compile` | **NOT_RUN** |
| QA Electron real 1366×768 / 1920×1080, dark/light | **NOT_RUN** (sem ambiente desktop acessível neste executor) |
| CI CircleCI, Windows build, ASAR e EXE | **NOT_RUN** (proibidos sem autorização) |
| MAIN/preload autorização definitiva, I2-D/E, sync/PWA | **INTEGRATION_PENDING** |

**Estado correto:** `E3_CODE_PUBLISHED / RENDERER_MOUNTED / NODE_ELECTRON_QA_PENDING / MAIN_IPC_PENDING`. A D05 ainda **não** é homologada/EXE_READY. Manter issue #74 aberta. O Integrador incorpora PR #81 à candidata #76 somente com validação de segurança e HEAD atual, corrige regressões e executa gates do proprietário. Sem merge main, Windows build, pipeline pago, deploy ou escrita pessoal IA nesta entrega.
