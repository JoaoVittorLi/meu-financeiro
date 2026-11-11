# MEU FINANCEIRO 2.0 — roadmap mestre, backlog e controle de avanço

**Identificador:** MF2-ROADMAP • **Revisão:** 1.2 — Rodada A documental • **Base verificada:** 09/11/2026  
**Natureza:** especificação de produto + plano de engenharia + acompanhamento, **não** atestado de funcionalidades entregues.  
**Contexto multiagente:** [README](ai-context/README.md) · [Estado comprovado](ai-context/CURRENT_STATE.md) · [Guia de análise](ai-context/ANALYSIS_PLAYBOOK.md) · [Catálogo de experiência](ai-context/PRODUCT_BLUEPRINT.md) · [Propostas criativas](ai-context/IDEA_REGISTER.md) · [Protocolo de atualização](ai-context/ROADMAP_UPDATE_RULES.md).

> **Regra permanente, vinculante para todas as IAs:** **cada mudança relevante DEVE atualizar este roadmap no mesmo PR da implementação**, além do log Markdown específico. Nunca concluir uma entrega apenas com código. Quem não integra pode atualizar o progresso **proposto em sua branch**; somente o integrador confirma o progresso global, gates e publicação.

## U5.1 — Movimentações Premium e produtividade (11/11/2026)

**Status: IMPLEMENTAÇÃO PUBLICADA, TESTES OFICIAIS E HOMOLOGAÇÃO PENDENTES.** [PR #37](https://github.com/JoaoVittorLi/meu-financeiro/pull/37), *draft*, branch `feat/mf2-u5-1-movements-productivity-20261111`; **base PR #36** na branch `fix/mf2-d1-5-premium-interactions-20261111`, SHA herdado `87fb449c0232d80aebd7c50ad547197e34d3c806`. Commit funcional U5.1: `10b9695305b0d2836f599b34971433955f64ea3b`. **Não integrar PR #37 à main ou staging sem decisão do Arquiteto e sem os gates P1-01/P1-02.** Nada de CircleCI Windows ou EXE nesta entrega.

- **U5.1-A — Categorização inline:** na tabela, botão de categoria abre popover em React portal, mostrando categoria atual, pesquisa normalizada, lista por tipo, destaque da opção ativa, Enter/ArrowUp/ArrowDown/Escape, foco restaurado e estados de erro/salvamento. Categoria manual chama `updateData` (não altera ID, centavos, data ou vínculos); categoria bancária chama o override pessoal `bankCategorize({accountId,externalId,category})`, conservando o extrato Pluggy original e IDs compostos. Gravações assíncronas e fila de snapshots têm locks contra clique duplicado. O nome da movimentação mantém a abertura do drawer avançado; assim a mudança de categoria já não exige abrir o drawer.
- **U5.1-B — Pesquisa/filtros:** reutilizados pesquisa, período global do topo, origem, conta e tab de revisão. Adicionados categoria exata, receitas/despesas por `effectiveNature`, status de revisão bancária e ordenação determinística por data/valor absoluto. Controles avançados recolhíveis, chips individuais removíveis, limpar todos, filtragem sem mutação; resumos de banco/manual continuam calculados em separado sobre o conjunto completo antes do limite de 500 linhas renderizadas. A revisão considera todos os períodos carregados e somente registros bancários.
- **U5.1-C — Teclado e acessibilidade:** disparo por botão nativo, foco visível, `aria-expanded`/`combobox`/`listbox`, Enter, Escape sem gravação, setas de navegação, feedback após persistência, retorno ao gatilho e bloqueio de revisões/categorizações simultâneas. Estilos responsivos, claro/escuro e preferência de movimento reduzido no novo `app/movements-productivity.css`, sem alterar o design system global nem os módulos da Inteligência.
- **Jornada antes/depois:** (1) manual antes categoria→drawer→seleção→salvar, agora categoria→popover→seleção com gravação; (2) banco antes categoria→drawer→seleção, agora categoria→popover pesquisável→seleção, reduzindo troca de contexto (não foi medido ganho de tempo); (3) filtros antes busca/origem/conta e revisão, agora combinação avançada com chips para retirar uma condição sem refazer o restante.
- **Arquivos de código e testes:** `src/app.ts`, `app/index.html`, `app/movements-productivity.css`, `tests/transaction-category-edit.test.cjs`, novos `tests/u5-1-filters.test.cjs` (6), `tests/u5-1-inline-category.test.cjs` (9) e `tests/u5-1-category-sqlite.test.cjs` (4, `FinanceDB` real). `electron/db.cjs`, SQL schema, Pluggy raw, backups, código IA, Cloudflare/PWA e `main` intactos.
- **Provas executadas:** 12/12 cenários de filtros sobre função real `transactionViewRows` em V8 (tipos removidos apenas no harness); 7/7 cenários sobre métodos de categorização/popover em V8 com IPC e armazenamento simulados; todos usam dados sintéticos. **Não são a suíte Node oficial.** Os **19 testes novos publicados não foram executados no checkout integral**, nem testes D1.5.1, `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, F08, ASAR ou GUI Electron. Falta checkout privado integral com Node/npm fixados e dependências; não alegar screenshot/CI verde.
- **Próximos gates:** em ambiente com checkout real executar testes oficiais e D1.5.1, depois QA visual do popover, tabela, filtros, foco, dark/light, movimento reduzido, tamanhos 1366×768/1920×1080, persistência SQLite sintética/reabertura. Resolver falhas concretas antes da integração. **Sem build Windows até autorização do proprietário.** [Log U5.1](ai-context/logs/2026-11-11-MF2-U5-1-movements-productivity.md).

## D1.5.1 — P1-01 precisão BRL e P1-02 guardas de conciliação (11/11/2026)

**Status: CÓDIGO E TESTES PUBLICADOS NO PR #36; HOMOLOGAÇÃO WINDOWS PENDENTE.** Correções dirigidas aprovadas pelo Arquiteto em `docs/ai-context/reviews/2026-11-11-D1-5-PR36-ARCHITECT-DECISION.md` da branch documental PR #35. **Commit funcional:** `1bd18db6d1393825fab04a1623ce3a9c03a849cf`. A branch da D1.5 segue `fix/mf2-d1-5-premium-interactions-20261111` e deriva da beta.8 staging; `main`, produção Cloudflare/PWA e release não foram modificados.

- **P1-01:** novo `parsePositiveBRLInput` em `src/app.ts`, utilizado **somente** por `saveEntry` e `saveManualDetail`. Rejeita arredondamento silencioso (ex. `10,999`), três casas, expoentes, negativos, zero, notação internacional, agrupamento inválido e valores acima de **100.000.000.000 centavos** (limite existente em `FinanceDB.isCents`); aceita `10,99`, `1.234,56`, `R$ 1.234,56`. Feedback humano em ambas as telas. Parser legado `parseMoney`, CSV, budgets, JSON e backup permanecem intocados. **Nenhuma conversão de dados existentes.**
- **P1-02:** `FinanceDB.save('real', payload)` abre `BEGIN IMMEDIATE` e confere **os vínculos SQLite reais** antes do `DELETE FROM transactions`. Com manual vinculado, rejeita remoção e mudança de valor/data/tipo, inclusive com `state.bank.data.transactions` desatualizado, propagando erro para UI e executando `ROLLBACK`. Edições de descrição/categoria compatíveis continuam possíveis; valores originais Pluggy não são escritos por este fluxo. `pruneInvalidManualLinks` e caminhos separados de `restoreBackup`/desvinculação explícita não foram alterados. Importação JSON que pretenda substituir transação vinculada agora **falha explicitamente** até desvinculação autorizada; evita perda silenciosa da conciliação.
- **Testes versionados novos:** `tests/d1-5-1-money-input.test.cjs` (5) e `tests/d1-5-1-sqlite-links.test.cjs` (10, banco nativo sintético); ajuste em `tests/d1-5-manual-edit.test.cjs` para transpilar a nova função no harness. **Evidências desta sessão:** 18/18 testes de parser + editor executados em V8 usando os arquivos versionados e módulos Node simulados (não `node --test`); 6/6 testes **Node 22.16.0 + `node:sqlite` real**, executados em reprodução isolada do SQL/guarda, cobrindo rollback, exclusão/valor/data/tipo e edição permitida. **Estes 6 não usam a classe `FinanceDB` completa** e **os 10 testes do repositório estão PENDENTES de execução em checkout oficial**.
- **Bloqueio operacional local:** checkout privado não montado; terminal sem DNS GitHub, Node `22.16.0`/npm `10.9.2` divergentes do pin `22.23.4`/`10.9.9`. Não foram executados no checkout `npm ci`, `test:types`, `test:db`, `compile`, F08, ASAR, GUI Electron, workflow CircleCI ou EXEs. **Não há artefatos Windows D1.5.1 verificados.** CI verde no SHA pai beta.8 **não valida este commit**.
- **Próximo gate sem inventar sucesso:** disparar uma única pipeline CircleCI `windows_on_demand` no **HEAD atualizado desta branch**, Config Branch = Checkout Branch = `fix/mf2-d1-5-premium-interactions-20261111`, `run_preflight=false` e `run_windows_build=true`. O job Linux executa as suítes reais/TypeScript/ASAR; Windows faz smoke Electron 32 PNGs e empacota NSIS/Portable, SHA256. **Antes de chamar D1.5.1 de entregue** confirmar build green, versões/hash SHA idênticos, download real do instalador e do portable, e jornada manual sintética em perfil descartável. Se falhar, corrigir erro comprovado sem relaxar gates. [Log D1.5.1](ai-context/logs/2026-11-11-MF2-D1-5-1-financial-gates.md).

## D1.5 — Interações Premium, integridade visual e Movimentações manuais (11/11/2026)

**Status: CÓDIGO EM PR DRAFT, GATES DE HOMOLOGAÇÃO PENDENTES.** [PR #36](https://github.com/JoaoVittorLi/meu-financeiro/pull/36), branch `fix/mf2-d1-5-premium-interactions-20261111`, criada da staging beta.8 `d513c2be3f9b0cd018aed0b71f46ce8747a6556c`. HEAD do código `aefdcf9c75794534971ee3b3465c59df77229a70`, a documentação posterior altera o SHA. **PR #31 continua em staging; sem merge em `main`, deploy PWA, release ou EXE D1.5.** Os workflows CircleCI `preflight_linux` e `build_windows` estavam **SUCCESS no commit pai da staging**; não transportá-los para esta branch.

**D1.5-A implementada:** `app/premium-interactions.css` carregado por último no `app/index.html`: tokens por tema, hover com elevação de 2–3px/scale 1.008–1.01, sombra menta sutil, foco de teclado visível, `prefers-reduced-motion`, media hover apenas em ponteiro fino. Seletor para oito áreas, evitando aplicar a `.card` globalmente; cards financeiros sem ação não recebem `cursor:pointer`; status de orçamento acima do limite preserva bordas semânticas. Os seletores antigos do Argon A-D1–A-D6 continuam na origem; o novo CSS é refinamento específico e reversível.

**D1.5-B implementada parcialmente:** fundo/hero/sections do drawer no tema claro agora usam tokens `--surface`, `--surface2` e contraste de tema, em vez do roxo `rgba(25,22,34,.65)`; tema escuro conserva tokens próprios. `src/plan-view.ts` substitui sete hex roxos do SVG por `var(--green)`, `var(--muted)` e `var(--surface)`. `electron/db.cjs` altera **apenas a paleta de novas categorias e defaults de INSERT OR IGNORE**, sem atualização de cores existentes, personalizações ou emojis. `src/app.ts` alinha a paleta e opções de cores novas, mantendo campo livre de HEX personalizado. Uma limpeza integral de emojis antigos e normalização segura dos presets já persistidos **não foi feita** nesta missão; exige avaliação visual e decisão de migração não destrutiva.

**D1.5-C implementada:** `src/app.ts` adiciona edição completa de descrição, data, valor em centavos e categoria para lançamentos locais (manual/CSV) no drawer; mantém `kind`, `id`, `origin` e demais registros; confirma exclusão; bloqueia editar data/valor ou excluir registro vinculado a extrato até desvinculação, sem alterar dados originais Pluggy. Valida data de calendário real e centavos inteiros seguros, e fecha drawer **somente após persistência confirmada**. Inclui foco e inputs associados ao drawer; `SingleDatePicker` respeita `disabled`. Teste de categoria preexistente atualizado para novo fluxo, com verificação específica da edição local.

**Testes efetivamente executados aqui:** **24/24 callbacks em V8** sobre blobs reais da branch: 13 cenários de métodos financeiros de edição/exclusão, 11 contratos de CSS/tema/interações; dependências Node/FS simuladas, não `node --test` oficial nem compilação TypeScript. O método real `renderDetailDrawer()`, após remoção apenas das anotações TS no harness, foi analisado e executado com dados sintéticos em V8, renderizando todos os botões esperados. Os **quatro testes SQLite** do novo `tests/d1-5-category-palette.test.cjs`, contratos anteriores com `typescript`, `npm run test:db`, `npm run test:types`, compile, F08/ASAR, screenshots reais Windows e instaladores **NÃO foram executados nesta branch** por ausência de checkout privado, dependências e Electron no ambiente. Não declarar D1.5 homologada. [Log D1.5](ai-context/logs/2026-11-11-MF2-D1-5-premium-functional.md).

**Próxima decisão do Arquiteto:** validar o PR #36 e executar no checkout o `npm ci`/Node e TypeScript fixados, `npm run test:db`, `npm run test:types`, `npm run compile`, proveniência F08 e ASAR; realizar smoke Electron com capturas de hover pré/durante/depois, drawer claro/escuro, manual persistido/reiniciado e perfis sintéticos em 1366×768/1920×1080. Só integrar à staging após gates e evidência; depois, preparar **uma** pipeline Windows para novo executável D1.5. Sem atualizar `main` ou produção automaticamente.

## Hotfix D1.4.3 — JSON visual interpretado como 1 objeto no PowerShell (10/11/2026)

**Rodada B: EM_TESTE; gate NAO_HOMOLOGADO.** No [PR #31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31), branch `feat/mf2-beta8-premium-staging-20261110`, o CI Windows capturou **32 arquivos PNG**, mas a verificação em `.circleci/build-windows.ps1` alegou haver **1 entrada** no manifesto. A causa está na construção PowerShell `$matrix = @(Get-Content -Raw ... | ConvertFrom-Json)`: em Windows PowerShell, `ConvertFrom-Json` pode emitir um array como um único objeto de pipeline e o `@(...)` o encapsula novamente. **Não foi identificada falha de gravação ou corrida:** `scripts/d1-electron-smoke.cjs` acumula `rows.push()` e escreve um único `JSON.stringify(rows,null,2)` após as 32 capturas. Documentação PowerShell confirma a semântica de arrays na pipeline. 

**Correção publicada:** código no commit `ecc08b5fed9bcfed50966fad3135899247fcf293` e extensão de testes de CLI `c29ce3578708cf38c0b96595a058efb2e7f69365`. Retirada a interpretação do JSON no PowerShell: depois do smoke, o Windows chama `& $nodeExecutable scripts/verify-visual-matrix.cjs $env:MF_SMOKE_OUTPUT_DIR` e reprova via `Assert-Success` se o Node devolver código não zero. O novo verificador Node 22, sem dependências externas, lê o array completo via `JSON.parse`, exige **32 registros e 32 arquivos físicos**, cobertura exata das oito áreas × quatro presets (1366/1920, claro/escuro, movimento), unicidade, correspondência nomes, viewport/overflow registrado e cabeçalho IHDR + dimensões de cada PNG. Foram ajustados os contratos `tests/d1-2-electron-contract.test.cjs` e `tests/d1-3-smoke-matrix.test.cjs`, sem remover verificações de persistência, backup, ASAR, NSIS/Portable ou hashes. O smoke de captura e CSS Argon permanecem intocados.

**Testes realmente executados:** `node --test tests/d1-4-visual-matrix-manifest.test.cjs` **15/15 PASS**, Node `v22.16.0`, em fixture isolada local com o arquivo do verificador idêntico por Git blob SHA (`c85af625de4bc2f57dc8a8615f1759dacea6a0ed`) e o arquivo do teste idêntico à versão publicada (`eb89dcfc0ed50bdd7f8dd8c63cef3d49ddb9aa7c`). Para executá-los localmente sem checkout privado foi usada uma representação isolada das constantes de oito áreas e quatro presets do smoke, conferidas com o original no GitHub: **não é suíte integral do aplicativo**. Testes cobrem sucesso JSON/PNG 32×32, raiz JSON aninhada/objeto, duplicatas, ausências, arquivo extra, assinatura PNG, dimensões, metadados, viewport, overflow, JSON malformado e **exit code CLI 0/1**. Além disso, **8/8 callbacks reais** de contratos D1.2/D1.3 executados com imports de filesystem simulados e textos reais GitHub, PASS; **não** equivalem a `node --test` no checkout. Sem PowerShell instalado nesta sessão, teste real GUI Windows, suíte SQLite completa, tipos, F08, ASAR, CircleCI e empacotamento permanecem **pendentes no SHA novo**.

**Próxima ação:** executar **uma** pipeline CircleCI Linux→Windows, Config/Checkout Branch `feat/mf2-beta8-premium-staging-20261110`, `run_preflight=false`, `run_windows_build=true`. A suíte de 15 testes passará pela `npm run test:db` do runner Linux antes de prosseguir para Windows; o verificador Node será executado após o Electron real. **Não prometer ausência absoluta de falhas futuras**: a beta.8 só estará homologada depois de CI verde, evidências GUI, 32 imagens físicas, NSIS, Portable e hashes. Registrar eventuais novas falhas específicas em vez de relaxar os gates. [Log de D1.4.3](ai-context/logs/2026-11-10-MF2-D1-4-manifest-count-fix.md).

## Hotfix D1.4.2 — viewport Chromium/Windows no smoke de 32 capturas (10/11/2026)

**Rodada B: EM_TESTE · Gate: NAO_HOMOLOGADO.** O smoke real `scripts/d1-electron-smoke.cjs` utilizava `document.documentElement.clientWidth` para verificar a **largura do viewport emulado**, confundindo-a com a área de conteúdo que pode excluir a barra de rolagem vertical clássica (ex.: 1366px emulado, 1349px de conteúdo). Isso causava falso negativo Windows na asserção da linha 188, mesmo quando a largura de `window.innerWidth` era a correta. Também foi localizado no fluxo completo `smoke()` outro `assert.equal(visuals.count,16)` herdado da D1.2 e incompatível com 32 PNGs. **Commit de correção:** `745afd5d69a022205324a0d4613f5bc9e182c4b4` no [PR #31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31).

**Correções:** `scripts/d1-electron-smoke.cjs` agora aguarda com limite de 20 tentativas/100ms a aplicação da emulação CDP, verifica `window.innerWidth/innerHeight` contra o tamanho-alvo e usa `document.documentElement.clientWidth` **somente** para detectar overflow real (`scrollWidth <= contentWidth + 2`). Mensagens de falha incluem tamanhos esperado/observado e o manifesto registra viewport e área útil efetivos. O smoke integral exige `SMOKE_VIEWS.length * SMOKE_PRESETS.length` = **32**, sem expectativa obsoleta de 16. `tests/d1-2-visual-matrix.test.cjs` ganhou casos para scrollbar 17px, atraso de aplicação do CDP e viewport realmente errado, preservando testes de overflow/PNG corrompido; `tests/d1-3-smoke-matrix.test.cjs` ganhou guarda do smoke integral para não retornar a 16. **Não alterados:** `electron/main.cjs`, domínio SQLite/Pluggy, CSS Premium, `.circleci/build-windows.ps1`, `main`, Cloudflare/PWA.

**Provas nesta sessão:** (a) **6/6 cenários** exercitados sobre a função real `visualMatrix` extraída dos textos do HEAD GitHub no motor V8 com mocks de CDP/filesystem/Buffer: cenário básico 32 imagens, scrollbar 17px, sincronização tardia, viewport genuinamente menor (reprova), overflow real (reprova), PNG corrompido (reprova); (b) **10/10 callbacks de contrato** dos arquivos `tests/d1-2-visual-matrix.test.cjs` e `tests/d1-3-smoke-matrix.test.cjs` em V8 com módulos Node simulados; a primeira tentativa do último contrato falhou **por omissão do PowerShell no mock do harness**, foi repetida com o arquivo real da branch e aprovada; (c) V8 parse dos três JS PASS; (d) inspeção dirigida de sete contratos relacionados sem expectativas antigas de 16. Essas provas **NÃO são Node Test Runner no checkout**, Electron GUI/Windows nem CI. `npm ci`, `npm run test:db`, tipos, F08, ASAR, screenshots físicos e EXEs continuam sem execução no HEAD novo por falta de checkout e dependências instaladas no ambiente. **Não baixar a exigência de viewport**, nem alterar renderização financeira para contornar falha. Ver [log técnico](ai-context/logs/2026-11-10-MF2-D1-4-viewport-smoke-fix.md).

**Alertas de dependências** como `glob`, `tar`, `inflight` e `rimraf` são independentes desta falha; **não executar `npm update` às cegas** no lockfile antes do gate Windows. Abrir tarefa específica com `npm ls`/`npm audit` e regressão isolada após o build. A próxima ação é rodar o workflow CI Linux→Windows **uma vez** no HEAD mais recente, identificar eventuais falhas reais restantes e só liberar os instaladores com artifacts/hashes comprovados.

## Hotfix D1.4 — regressão no contrato de 16 → 32 capturas (10/11/2026)

**Rodada B: EM_TESTE · Gate: NAO_HOMOLOGADO.** Na branch `feat/mf2-beta8-premium-staging-20261110`, commit de correção `eb705603600b821a59a5950c56b4e12c2769bfa9`, foram atualizados **somente** `tests/d1-2-visual-matrix.test.cjs` e `tests/d1-2-electron-contract.test.cjs`. A automação de smoke D1.3 corretamente passou a cobrir 8 áreas × 4 presets = **32 capturas**; os dois testes D1.2 ainda exigiam **16**, falhando apesar do comportamento correto. O teste de matriz agora deriva a contagem de `SMOKE_VIEWS.length * SMOKE_PRESETS.length`, exige 32, confere navegações/capturas/PNG/manifesto, nomes únicos, 2 resoluções, temas, movimento e as 8 áreas. O contrato PowerShell verifica `$expectedScreenshots = 32`, quantidade de registros e PNGs, além de unicidade. **Nenhuma alteração** no `scripts/d1-electron-smoke.cjs`, no PowerShell, CSS Premium, SQLite ou backend; nenhum teste foi relaxado.

**Verificações executadas neste ambiente:** sintaxe dos dois testes verificada pelo parser V8; **4/4** callbacks do teste `d1-2-electron-contract.test.cjs` executados em V8 com mocks apenas de leitura de arquivos/módulos Node sobre os textos integrais do commit, PASS. Isso **NÃO** é `node --test` no checkout, nem smoke GUI real. Checkout privado e dependências não disponíveis no filesystem deste agente; **NÃO executados no SHA atual:** `npm run test:db` integral, `test:types`, compile, F08, ASAR, Electron real, Windows/CircleCI. O Arquiteto pode manter a etapa única de CI Linux→Windows; a falha relatada de expectativa 16 deixa de existir como contrato antigo, mas **outras falhas não podem ser descartadas**. [Log do hotfix](ai-context/logs/2026-11-10-MF2-D1-4-screenshot-matrix-hotfix.md).

## Checkpoint vigente — D1.4 beta.8 Premium A-D1–A-D6 integrada, aguardando gates (10/11/2026)

**Rodada B: EM_TESTE · Gate: NAO_HOMOLOGADO · SEM release/EXE.** A integração visual aprovada pelo Arquiteto foi incorporada na branch `feat/mf2-beta8-premium-staging-20261110` por *fast-forward* seguro do SHA D1.3 `09b48637b106c9c8937873adf2469dc19440a950` para o commit `0a320d467dda50ce0d1509b61d3fc071081792ef`. [PR #34](https://github.com/JoaoVittorLi/meu-financeiro/pull/34) foi confirmado pelo GitHub como **merged/closed**, apenas contra staging; [PR #31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31) permanece **draft**, não mesclado em `main`. O *fast-forward* preservou a cadeia de seis commits e todo o código D1.2/D1.3. Nenhum deploy/CI/release foi acionado nesta missão.

**Diff exato do PR #34:** `app/decisions.css` (A-D5 Simulador), `app/intelligence.css` (A-D5 Inteligência), `app/refinement.css` (A-D6 refinamento global) e apenas três testes com regex mais tolerantes a espaços: `tests/category-overlay.test.cjs`, `tests/ui-daily-redesign.test.cjs`, `tests/ui03-browser-regressions.test.cjs`. As regras verificadas pelos testes permanecem exigidas (z-index e seletores sem relaxamento semântico). Os blobs `electron/db.cjs`, `tests/categories.test.cjs`, `scripts/d1-electron-smoke.cjs`, `.circleci/build-windows.ps1`, `tests/d1-3-smoke-matrix.test.cjs` e `package.json` eram **idênticos** entre base D1.3 e integração D1.4; orçamento R$ 0 e 32 capturas previstas preservados. Não houve alterações em lógica financeira, `main`, PWA/Worker nem segredos.

**Verificações executadas diretamente no HEAD integrado:** comparação GitHub `ahead_by=6`, `behind_by=0` e seis caminhos exatos; leitura dos arquivos por blob SHA; **7/7 verificações de contrato em V8 sobre textos do GitHub** (âncoras A-D1–A-D5, CSS vinculado, reduced motion, ausência de URL externa, camadas da seleção, disclosure/tabbar IA e contrato das 32 capturas). **Estes 7 checks NÃO são a suíte Node real, não provam imagem no Electron nem validade do pacote Windows.** Evidência **histórica externa**, sem reexecução aqui: o Arquiteto reportou em snapshot beta.6 + CSS da integração `test:db` **222/222 PASS**, `test:types` PASS e F08 PASS; ASAR não pôde rodar no snapshot por dependência ausente. O ambiente desta missão tem Node v22.16.0, TypeScript global 5.8.3, mas não possui checkout privado em disco nem conexão DNS GitHub no terminal, Electron ou `@electron/asar`; portanto `npm ci`, `npm run test:db`, `npm run test:types`, `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar`, smoke GUI, backup/restauração real e NSIS/Portable **NÃO FORAM EXECUTADOS neste HEAD**.

**Próximo gate operacional (UMA pipeline, não disparada ainda):** CircleCI [projeto Meu Financeiro](https://app.circleci.com/pipelines/github/JoaoVittorLi/meu-financeiro) com Config Branch e Checkout Branch `feat/mf2-beta8-premium-staging-20261110`, `run_preflight=false`, `run_windows_build=true`. O workflow `windows_on_demand` contém `preflight_linux` (Node 22.23.4, `npm ci`, tipos, Node/SQLite, compile, F08, ASAR, PWA test + dry-run SEM deploy) → `build_windows` (Electron real, 8 áreas × 4 condições = 32 PNGs sintéticos, persistência e integridade SQLite, backup físico, NSIS/Portable, proveniência/ASAR e `SHA256.txt`). Se falhar, corrigir apenas a causa comprovada e repetir após teste direcionado. **Não aprovar a beta.8 para uso financeiro até validar os artifacts físicos, hashes e instalação segura.** O smoke GUI atual não realiza diretamente a restauração pelo diálogo; a suíte Node D1.2 contém teste sintético de `restoreBackup`, e a homologação de uso pessoal ainda precisa dessa prova completa.

[Log D1.4](ai-context/logs/2026-11-10-MF2-D1-4-premium-final-integration.md) · [Handoff Executor](ai-context/EXECUTOR_HANDOFF.md). Os checkpoints D1.2 e D1.3 abaixo são **históricos**, não o estado atual da integração.

## Checkpoint de engenharia D1.2 — consolidação financeira (10/11/2026)

**Código publicado, SEM release:** PR draft [#28](https://github.com/JoaoVittorLi/meu-financeiro/pull/28), branch `feat/mf2-d1-2-functional-tests-20261110`. Além da proteção de orçamento zero e da automação Electron, foi corrigido `FinanceDB.ingestBank`: (a) duas transações com mesma chave em uma conta/lote não podem sobrescrever o extrato silenciosamente; (b) uma conta repetida no mesmo payload não pode alterar saldo/nome pela ordem de entrada; (c) a mesma conta ligada a outro `item_id` não pode ser reatribuída silenciosamente. Rejeição ocorre **antes de BEGIN IMMEDIATE**, sem importação parcial. Identificadores externos iguais em **contas diferentes** continuam válidos. Testes reais em Node v22.16.0 sobre código SQLite extraído do EXE beta.7 (`app.asar` com SHA-256 `75105078e54def5aab7993a4cc2ab4c498ee05f62eaf8c42e21670a44f228d70` idêntico ao manifesto), com patches D1.2 correspondentes byte a byte ao GitHub: **7/7 PASS** (4 regressões de lote bancário + 3 integrações equivalentes de orçamento/vínculos/parcelas/backup/restore). Regressões bancárias: **0/3 antes, 4/4 após**. Ver evidência `/mnt/data/d1-2-consolidated-sqlite-7.tap` da conversa. Os 3 testes de integração locais preservam as mesmas asserções dos testes no PR, com formatação reorganizada. **Não confundir com CI de branch completa, Electron real ou Windows**: ainda não executados no novo SHA.

**Premium staging sem merge:** branch `feat/mf2-beta8-premium-staging-20261110` @ `HEAD da branch (consultar GitHub; staging ainda não homologado)` reúne funcional D1.2 com os blobs originais `app/overview.css` A-D1 e `app/operations.css` A-D2. Diff contra base funcional: **somente 2 CSS**, sem motores/serviços modificados. Essa branch ainda não inclui atualizações documentais subsequentes, não tem CI/EXE, e **não foi promovida ao PR #28**; A-D3 incremental ainda não encontrada como PR/branch `ad3`. Versão mantida `0.9.5-beta.7` nos manifestos, beta.8 reservada até candidata funcional visualmente testada. Beta.6 e beta.7 de recuperação inalteradas. Cloudflare/PWA congelados na frente Desktop First.

## Checkpoint vigente — Beta.8 candidata D1.2 + Premium (10/11/2026)

**Estado: CANDIDATA PARA CI, NÃO HOMOLOGADA / NÃO DISTRIBUÍDA.** [PR draft #31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31), branch `feat/mf2-beta8-premium-staging-20261110`, versão `0.9.5-beta.8` consistente em `package.json`, `package-lock.json`, `mobile-push/package.json`, `mobile-push/package-lock.json` e nos três rótulos correspondentes de `src/app.ts` e `app/app.js`. **Não houve deploy PWA:** apenas metadados de versão foram sincronizados por contrato. Cloudflare/PWA Production congelados.

**D0 beta.6**: preflight Linux e build Windows aprovados e 2 EXEs com SHA-256 conferidos, sem homologação de uso pessoal. **D1.1 beta.7**: PR #22 SHA `8734a34db8ec9b5592d666cc14fea9a5b8a826b4`, preflight Linux e Windows SUCCESS, 2 EXEs com SHA-256 verificados, **smoke nativo instalado pendente**; versões antigas preservadas como recuperação. **D1.2 funcional**: PR #28, proteção de orçamento R$0, rejeição atômica de duplicatas de extrato e conflito de ownership bancário, lock Electron único e smoke de perfil isolado; **8/8 testes SQLite direcionados PASS** no runtime local Node v22.16.0 (`/mnt/data/d1-2-beta8-sqlite-8-verified.tap`); suíte Node/CI completos da beta.8 ainda não executados. Novo teste `tests/d1-2-category-rename-links.test.cjs` preserva renomeação cascata por orçamentos, regras, overrides, splits e planejamento.

**Premium A-D1–A-D4 incorporados somente na candidata:** PR #23 `app/overview.css` (blob `e47e8d0206c193dca127a802e1b77691212638f3`); PRs #25/#29 `app/operations.css` A-D2 + A-D3 incremental (`fc1ac6f79ebfa9b350298f6b76e6ef0eee21a04d`); PR #30 `app/decisions.css` A-D4 (`1d1d9b706b0a0a79b0dfce1df04bf418e6b6a5f3`). `tests/d1-2-premium-css-contract.test.cjs` publicado; lógica de suas três asserções executada em V8 sobre CSS reais do GitHub **3/3 PASS com filesystem simulado**. **Não é teste visual Electron.** O Simulador A-D5 não foi integrado (não é dependência para a beta.8).

**Gate operacional próximo:** CircleCI com **UMA única pipeline** no SHA final da candidata: Config/Checkout Branch `feat/mf2-beta8-premium-staging-20261110`, `run_preflight=false`, `run_windows_build=true`. Fluxo `preflight_linux` → `build_windows`, este último exige smoke GUI real, persistência, 16 PNGs e checks de provenance ASAR/NSIS/SHA. Se falhar, corrigir o PR #31 antes de distribuir. Se passar, conferir hashes físicos e artefatos, **sem afirmar homologação de instalação Windows pessoal nem merge/release automático**.

### D1.2 — ajuste do teste de exclusão de categorias (10/11/2026)

**Rodada B: EM_TESTE; GATE: NAO_HOMOLOGADO.** O pré-flight Linux falhou no SHA `dd30ddbd94d16b1cd415ff61b3dd4bd94ad2065b` porque `tests/categories.test.cjs` esperava excluir uma categoria ainda vinculada a orçamento explícito de R$ 0. No [PR #31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31), commit de código `c109d905a4120b5820130e310e3dd36210781db6`, foi alterada **somente a expectativa do teste**: movimentação bloqueia; orçamento zero bloqueia e permanece; remoção explícita do orçamento libera exclusão. Categorias padrão permanecem protegidas e `electron/db.cjs` não foi alterado. Evidência local limitada: sintaxe JS analisada em V8, mais **6/6 PASS** num harness SQL SQLite isolado com as consultas do método (Node 22.16.0). **NÃO executados:** `node --test tests/categories.test.cjs tests/d1-2-desktop-integration.test.cjs` sobre checkout integral, suíte, Electron real ou nova pipeline CI. Outra possível falha do preflight não foi descartada, pois o log completo CircleCI não estava acessível. Próximo responsável: Executor — validar suíte no checkout real e usar somente uma pipeline Linux→Windows após correção; registrar hashes e arquivos gerados. Ver log `docs/ai-context/logs/2026-11-10-MF2-D1-2-beta8-category-zero-test-fix.md`.

## D1.3 — preparação funcional da beta.8 Premium Final (10/11/2026)

**Rodada B: EM_TESTE; GATE: NAO_HOMOLOGADO; nenhum CircleCI acionado.** No [PR #31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31), commit `661bf754bfcdf8cd270e14dc1946c08d2f9c35bd`, a automação de smoke Electron foi ampliada de **16 para 32 capturas previstas**: oito áreas (Visão Geral, Movimentações, Planejamento, Orçamentos, Minhas Contas, Simular Compra, Inteligência e Configurações) × quatro presets cobrindo 1366×768, 1920×1080, claro/escuro e movimento reduzido. `scripts/d1-electron-smoke.cjs` centraliza a lista de áreas e presets; `.circleci/build-windows.ps1` exige 32 PNGs, 32 entradas no `visual-matrix.json`, nomes únicos e imagens referenciadas existentes. Novo `tests/d1-3-smoke-matrix.test.cjs` verifica contrato. **Não** houve alteração de código de domínio financeiro, de CSS Argon, deploy, merge ou build.

**Prova executada nesta missão:** 3/3 verificações do novo teste **em V8 isolado com imports Node simulados**, sobre o código exato publicado no GitHub no commit `661bf754bfcdf8cd270e14dc1946c08d2f9c35bd`; análise de sintaxe V8 do script e do teste. Isso **não equivale** a `node --test` no checkout. O ambiente dispõe de Node 22.16.0 e `node:sqlite`, mas não de clone local do repositório privado, dependências npm, acesso a github.com pelo terminal ou Electron instalável. **Não executados no HEAD D1.3:** suíte real de banco, `npm run test:types`, `npm run compile`, F08, testes ASAR, GUI Electron e backup/restore pelo aplicativo. Retêm-se apenas evidências históricas referenciadas nos logs D1.2, sem promover gates.

**A-D5 externa confirmada:** [PR #32](https://github.com/JoaoVittorLi/meu-financeiro/pull/32), SHA `c4f1b657d30e3da59b4302ed3f4f68b78b0ae70f`, muda exclusivamente `app/decisions.css` e `app/intelligence.css`, sobre PR #30. A base CSS da beta.8 ainda corresponde aos blobs originais da A-D4: decisions `1d1d9b706b0a0a79b0dfce1df04bf418e6b6a5f3` e intelligence `f2ad554f5dbee77de6c44a63371b9e26ffb12cb6`; os CSS de A-D5 são `aa3415f32dd93b073f1e48a5f6156ae7aabf8539` e `5429f43547ad0cd595d112988e1d65252adbcf0e`, respectivamente. **Não integrar ainda.** A-D6 está em desenvolvimento e não foi localizada uma branch `ad6` nesta verificação; é preciso o pacote e aceite do Arquiteto. Quando disponível, reconciliar HEADs e diffs, preservar os CSS acumulados sem reaplicar A-D5 em duplicidade, executar testes da árvore integrada e **uma** pipeline Windows somente com autorização.

**Riscos/pendências:** o smoke real foi expandido, **mas ainda não foi executado**; possíveis falhas de navegação/overflow na Inteligência e Simulador serão detectadas no Windows. `tests/d1-2-desktop-integration.test.cjs` exercita restauração sintética em Node, mas o smoke GUI atual só valida existência e integridade de backups, **não o diálogo de restauração**. O log do preflight antigo não foi totalmente acessado, logo outras falhas de CI não estão descartadas. Ver `docs/ai-context/logs/2026-11-10-MF2-D1-3-beta8-final-prep.md` para o plano de integração e evidências.

---

## 1. Objetivo do 2.0

Construir uma plataforma pessoal de **controle + previsão + decisão + automação assistida**, com dados financeiros confiáveis, sincronização entre Windows/PWA, design diferenciado e IA que compreenda o contexto real e prepare alterações sob controle do usuário.

O 2.0 corrige a dívida técnica e a experiência fragmentada da linha 0.9.x; não será uma coleção de recursos desconectados. Todo recurso deve ajudar a responder pelo menos uma destas perguntas:
1. **Onde estou?** patrimônio, contas, receitas, despesas, qualidade dos dados.
2. **O que vai acontecer?** compromissos, caixa, risco, metas.
3. **O que posso fazer?** orçamento, antecipação, comparação de opções.
4. **O que mudou ou exige atenção?** anomalia, assinaturas, limite, vencimento.
5. **O que pode ser feito com menos esforço?** automações e IA com prévia/consentimento.

**Contratos de produto:** mobile tão completo quanto desktop; sem mentir sobre saldos; finanças usáveis mesmo quando a IA está indisponível; ações da IA nunca executam pagamentos, Pix ou ordens de ativos; experiência premium sem copiar design/propriedade intelectual alheia.

## 2. Regime de trabalho: duas rodadas separadas

### RODADA A — Análise, diagnóstico, benchmark e criatividade (primeira)

**Missão:** examinar o produto real, desafiar decisões fracas, mapear problemas herdados da 1.0, aprofundar o benchmark, formular soluções de UX e arquitetura, comparar opções e recomendar mudanças para o 2.0. **Ampla liberdade criativa nesta rodada**, com obrigação de demonstrar valor e custo.

**Permitido:** ler GitHub e PRs; navegar no preview/ambiente controlado, coletar capturas sintéticas; pesquisar soluções atuais; inspecionar testes; propor arquitetura, fluxos, wireframes/descrições e pequenas provas sem alterar produção; registrar conclusões nos documentos. Separar claramente fatos, hipóteses e propostas.

**Não permitido por padrão:** refazer telas, migrar dados, alterar schema financeiro, publicar production, consumir API paga sem autorização, ativar acesso real da IA ou misturar feature com diagnóstico.

**Entregáveis obrigatórios:** (a) diagnóstico por área e por plataforma, (b) matriz de lacunas 1.0→2.0, (c) benchmark fundamentado, (d) propostas criativas e alternativas ranqueadas, (e) riscos/dependências, (f) backlog recomendado com MANTER/MODIFICAR/ADIAR/REJEITAR, (g) plano de execução em fatias verticais, (h) critérios de aceitação e estratégia de teste, (i) atualização deste roadmap com o **status da análise**, sem alegar implementação.

**Gate de A:** o usuário/Chat arquiteto revisa e autoriza os ajustes de escopo e a primeira fatia de execução. A análise pode levar a propostas novas, mas **propostas não são automaticamente requisitos aprovados**. Ver [ANALYSIS_PLAYBOOK](ai-context/ANALYSIS_PLAYBOOK.md).

### RODADA B — Implementação, testes e homologação (segunda)

**Missão:** executar o escopo aprovado, em missões pequenas e verificáveis, respeitando gates e dependências; não reabrir o design inteiro a cada commit.

**Por fatia:** inspecionar SHA → criar branch/ownership → implementar interface + persistência + contratos + testes → homologar → log → atualizar roadmap **na mesma branch/PR** → revisão → integração controlada. Não considerar "feito" enquanto código e documentação não estiverem publicados.

**Retorno à A:** apenas se surgir fato novo, risco estrutural, falha impossível de resolver na fatia ou proposta superior que substitua claramente requisito existente; registrar decisão. O protocolo não bloqueia criatividade, bloqueia improvisação não documentada.

## 3. Estado herdado, sem interpretações otimistas

Atualizado a partir de GitHub em 09/11/2026. Consultar [CURRENT_STATE](ai-context/CURRENT_STATE.md) para detalhes, links e evidências.

| Linha | Base verificável | Estado / implicação |
| --- | --- | --- |
| main | commit e0d5131, package v0.9.4 | Última linha publicada formalmente, não inclui o conjunto U1–U3 |
| PR #16 | design/despezzas-d1-d4, SHA c535cb0, v0.9.5-beta.6 | D1–D4 + U1/U2/U3 no desktop, ainda draft |
| U1 | visão geral modernizada, cobertura, período, gráficos, categorias e agenda | Código + testes documentados, **sem EXE instalado homologado** |
| U2 | movimentações e planejamento, filtros, revisão, calendário e projeção | Código + testes documentados, **sem paridade comprovada no PWA** |
| U3 | orçamentos, contas e simulador A/B | Código + testes relatados: 222 desktop, 129 Worker, 1 ASAR; **não reexecutados nesta auditoria** |
| U4 | equivalente mobile de U1–U3 | **não comprovado no GitHub** |
| IA E1–E4.1 | tela, cliente experimental, memória e contexto sintético | shared/ai-policy.mjs informa financialDataEnabled=false e pwaInferenceEnabled=false |
| Pluggy/cloud | staging 630 inicialmente; 632 depois; 1 conta; 93 registros de 17 tabelas relatados | Diagnóstico parcial; identidades, centavos, histórico, saldo as-of e restore ainda exigem prova |
| CircleCI | success no PR #15, SHA 44fb1b0 | Não equivale a build/instalação do SHA U3 c535cb0 |
| Work anterior | "Meu Financeiro - Definitivo" em outra sessão | Arquivos não publicados e progresso local **desconhecidos**; obter checkpoint antes de retomar |
| Documentação | PR #17, docs/mf2-multi-agent-context-20261109 | Ponto de entrada multi-IA; **draft, ainda não integrado** |

**Correções prioritárias do 1.0**: falta de baseline/release coerente; PRs empilhados; paridade PWA; cloud cutover ainda não homologado; regras parcialmente duplicadas; falta de contrato real de IA; UX heterogênea; orçamento avançado incompleto; saldo seguro não implementado; rastreabilidade e distribuição coordenada insuficientes.

## 4. Prioridades, decisões e fronteira do escopo

### Obrigatório para 2.0 (MUST)
Confiabilidade financeira; sync/paridade; UI de alta qualidade; movimentos/regras; planejamento e saldo seguro com ressalvas; orçamentos, metas/dívidas; relatórios/patrimônio básico; IA operacional com autorização e controle de custos; radar; segurança, teste, release.

### Desejável quando sustenta os requisitos (SHOULD)
Personalização moderada de painel; ações contextuais; explicações de origem; comparações A/B; regras sugeridas; estimativas com faixa de incerteza; indicadores de completude da base.

### Propostas a avaliar na Rodada A (CANDIDATE, não aprovadas)
Modo "se eu...?", assistente de fechamento do mês, timeline de decisão, digest semanal, score de previsibilidade, cartão de despesas invisíveis, jornada simplificada de revisão. Ver [IDEA_REGISTER](ai-context/IDEA_REGISTER.md).

### Fora do 2.0 por padrão (OUT)
Pagamentos/Pix reais, trades automáticos, cancelamento externo de assinaturas, agentes financeiros autônomos, gestão contábil empresarial, sistema fiscal, social/gamificação pesada, multiusuário e apps nativos macOS/Linux.

**Critério de promoção de uma ideia:** problema real + melhoria mensurável ou verificável + origem de dados + teste + custo + dependências + risco + decisão explícita. Ideias competem com itens existentes; não há adição infinita.

## 5. Arquitetura de referência

**DADOS:** SQLite local preservado até conciliação; Pluggy read-only; staging Cloudflare protegido; versão de schema, IDs e revisões; backups/restores verificáveis.

**DOMÍNIO:** ledger único; centavos exatos; natureza, posted/pending, splits, transferências, manual vinculado, orçamentos, compromissos, recorrência, parcelas, metas, dívida e patrimônio.

**SERVIÇOS:** consultas tipadas; comandos idempotentes com autorização, concorrência e auditoria; projeções determinísticas; indicação de confiança e de dados incompletos.

**EXPERIÊNCIA:** Windows Electron e PWA Android/web com mesma definição de números, componentes adaptativos e tema coeso. Diferença visual de plataforma é aceitável; divergência de regras, não.

**INTELIGÊNCIA:** orquestrador de consultas e ações propostas; nunca fonte autoritativa de saldo. Autenticação, limites, contexto mínimo, confirmação de cada escrita, histórico e recusa quando revisão mudar.

**Invariantes**: conta+external_id é identidade bancária; banco/manual não somados automaticamente; transferência própria neutra; status pendente distinto; saldo desconhecido ≠ R$ 0; receita incerta ≠ recebida; compromissos pagos não descontados de novo; margem de orçamento ≠ dinheiro livre; reserva virtual ≠ dinheiro transferido; simulação nunca salva automaticamente; IA não altera o bruto bancário.

Mais detalhes em [ARCHITECTURE](ai-context/ARCHITECTURE.md).

## 6. Mapa de dependências e gates

| Marco | Entrega | Base necessária | Gate de saída |
| --- | --- | --- | --- |
| MF2-00 | Estabilização e integração controlada | Auditoria atual + estado do Work | G0: código e EXE de candidato homologáveis |
| MF2-01 | Conciliação cloud e sincronização | G0 | G1: dados equivalentes e restauráveis |
| MF2-02 | Núcleo financeiro único | G1 | G2: mesma matemática, APIs e golden tests |
| MF2-03 | U4: paridade Windows/PWA | G2 | G3: jornadas completas em ambos |
| MF2-04 | Design System e Visão Geral premium | G3 | G4: dashboard coeso e modular |
| MF2-05 | Movimentações inteligentes | G2/G3 | G5: automação explicável e segura |
| MF2-06 | Planejamento preditivo e Laboratório | G2/G5 | G6: futuro e saldo seguro corretos |
| MF2-07 | Orçamentos, metas e dívidas | G6 | G7: alocação, obrigações e objetivos |
| MF2-08 | Relatórios, patrimônio e investimentos | G2/G7 | G8: análise patrimonial auditável |
| MF2-09 | IA operacional e Radar | G2, interfaces/domínios G4–G8 | G9: leitura/escrita autorizadas e alertas |
| MF2-10 | Qualidade, segurança e release | G0–G9 | G10: Windows/PWA 2.0.0 homologados |

**Flexibilidade:** análise e especificação de marcos posteriores podem ocorrer em paralelo aos primeiros; execução pode ser dividida em fatias se interfaces e contratos estiverem isolados. Não integrar resultado de um marco sobre dados incompatíveis.

## 7. Entregas detalhadas — produto + execução + testes

### MF2-00 — Fundamento confiável e recuperação de contexto

**Problema:** 0.9.4 publicada, código 0.9.5-beta.6 em PRs draft, Work possivelmente mais recente que GitHub, CI de candidato não homologado.

**Trabalho:** inventário de branches, PRs, commits e mudanças locais; identificar hierarquia sem cherry-pick redundante; preservar projetos existentes; baseline de integração; reprodutibilidade de dependências e scripts; preflight TypeScript/Node/SQLite/Worker/ASAR; CircleCI Windows SHA exato; instalador+portable+checksums; smoke Electron com dados sintéticos e backup de perfil.

**Qualidade UX:** inspecionar oito áreas (não criar outras), temas e 320/390/768/1366/1920 conforme plataforma; textos longos, teclado, menu, scroll e acessibilidade; registrar dívida visual sem abrir redesign completo.

**Gate G0:** árvore e cadeia de PRs reconciliadas; artefatos verificáveis; execução Windows sem regressões bloqueantes; roteiro de integração; logs e versão de baseline. CI sucesso do PR #15 não substitui o PR #16.

**Não fazer:** merge direto em main, cutover, deploy de Production, ativação de IA com finanças.

### MF2-01 — Uma vida financeira consistente em todos os dispositivos

**Problema:** Windows SQLite e staging cloud diferem por natureza, cobertura e revisão; PWA já tem dados, mas não é fonte homologada.

**Trabalho de engenharia:** comparar conta, external_id, datas, centavos, descrição/status, natureza/categoria, referências, splits, vínculos, históricos e 17 tabelas pessoais; investigar 630 vs 632 como diferença temporal de staging, não duplicata presumida; identificar saldo bancário as-of e histórico parcial; controle de versão/CAS, idempotency-key, conflits 409 e trilha de eventos; backup exportável e restore testado; migração aditiva/dry-run; permissões; operação PC↔Android com escrita simultânea e conexão interrompida.

**Trabalho de produto:** estado visível "sincronizando/atualizado/desatualizado/conflito"; explicar origem do dado, permitir revisar conflitos e mostrar que certas contas não informam saldo.

**Gate G1:** zero diferenças não explicadas na base de referência, reenvio sem duplicação, restore comprovado, consentimento e decisão explícita antes de promover cloud canônica.

### MF2-02 — Engine financeira compartilhada e contratos

**Problema:** formulas hoje estão apenas parcialmente centralizadas; duas telas podem mostrar números diferentes para a mesma pergunta.

**Trabalho:** domínio compartilhado para bancos/manual, receitas/despesas, status, revisão, categorias e splits, planejamento, parcelas, dívida, orçamento, metas, projeção/simulação, patrimônio. Definir schemas read/write, ID/revision, dados parciais e período. Criar golden fixtures por data, mês e limites; portar funções existentes antes de reescrever.

**UX:** cada número possui período, fonte, qualidade e drill-down; categoria "Outros" não prova informação de origem.

**Gate G2:** mesmas entradas e revisões → mesmos centavos e datas no desktop, Worker e testes; comando inválido rejeitado; nenhum cálculo autoritativo escondido em UI/IA.

### MF2-03 — U4: a mesma experiência útil no PWA

**Problema:** redesign U1/U2/U3 foi desktop; funções PWA parcialmente diferentes; a IA PWA tem rascunho, não inferência real.

**Trabalho por área:** Visão Geral (indicadores, período, gráfico, categorias, compromissos); Movimentações (consulta, filtros, revisão, categorias, edição e seleção); Planejamento (agenda/calendário/projeção, CRUD, parcelas); Orçamentos (limite, consumo, cobertura, origem); Laboratório de Decisões (mesmo simulador A/B); Contas (saldos e referências); Inteligência (capacidade real declarada, nunca fake); Configurações (segurança, sincronização, preferências). Usar componentes/serviços comuns onde viável, sem redesign de tudo antes dos contratos.

**UX:** mobile-first, navegação com uma mão, painéis/drawers acessíveis, gráficos e tabelas úteis em 320px, scroll horizontal apenas onde justificado.

**Gate G3:** jornadas completas, mesmas contas e resultados, 2 temas e larguras, autenticação de Preview real validada; nenhuma tela marca função como pronta quando API não existe.

### MF2-04 — Visual premium, organização e dashboard modular

**Problema:** visual moderno em partes, mas sem experiência final coerente, personalização e acessibilidade completa.

**Produto:** hierarquia com saldo real, despesas, receitas, resultado, tendência e próximas obrigações; painel com cards escolhidos/ordenados; origem e período explícitos; privacidade visual; atalhos úteis; comparação com período anterior contextual; estados vazios elegantes; cores e tipografia consistentes; animações leves e opcionais.

**Design:** visual inspirado em Copilot/Monarch/Despezzas/Actual, sem copiar interfaces/ativos. Evitar excesso de cartões. Priorizar decisões a gráficos decorativos; dashboards diferentes desktop e mobile podem reorganizar o mesmo conteúdo.

**Dependência:** "saldo seguro" entra no card somente após motor MF2-06 estar validado, nunca como fórmula improvisada.

**Gate G4:** preferências persistem, contraste/teclado/responsividade, dados corretos e captura real antes/depois no ambiente disponível.

### MF2-05 — Movimentações que se organizam com menos trabalho

**Problema:** regras e categorizações ainda exigem esforço e não oferecem radar completo de recorrência/anomalia.

**Produto:** fila "precisa de atenção", tags e favoritos úteis, buscar por fonte/conta/tipo/merchant, revisão rápida, reclassificação em lote com preview, regras por descrição/merchant/valor e prioridade manual>regra>provedor>sugestão; detectar recorrência/assinatura e mudança de preço; sugerir possível duplicata sem excluir nada; distinguir estorno/reembolso/transferência.

**Engenharia:** overrides não mutam transação Pluggy, regras idempotentes, simulação antes de edição massiva, event log, confiança de detecção; testes com lançamentos parecidos e bancos diferentes.

**Gate G5:** usuário consegue corrigir/silenciar sugestão; false positives não alteram pagamentos ou natureza automaticamente; logs de antes/depois.

### MF2-06 — Planejamento que antecipa problemas

**Problema:** mostrar compromissos não basta; usuário precisa decidir se uma compra cabe nos próximos dias e meses.

**Produto:** linha temporal de caixa, calendário de obrigações, visão por ciclo de recebimento, compromissos atrasados/pagos parcialmente, receita prevista confirmada/incerta, cenário conservador/base/otimista sem mistura; "menor saldo do período" e riscos; cartão "saldo seguro para gastar" parametrizado, com detalhes de reserva e cobertura; Laboratório de Decisões (comprar/adiar/parcelar, antecipar dívida, poupar mensalmente, A/B). Recomendações são explicações de cenários, não ordens.

**Engenharia:** previsões só derivadas de motor diário reconciliado; fluxo sem pagamento duplicado, parcelas corretas, horizonte claro e dados parciais; A/B não grava financeiro sem confirmação.

**Gate G6:** usuário vê hipóteses/indisponibilidades; teste de datas, valores extremos, saldo zero/parcial, receita incerta e concorrência; simulações auditáveis.

### MF2-07 — Orçamentos, objetivos e dívidas concretos

**Problema:** limites recorrentes atuais não fazem alocação avançada nem acompanham objetivo/juros de modo completo.

**Produto:** modo simples (limite/gasto/restante/alerta) e avançado (envelopes, transferência controlada de verba, rollover opcional); sugestões históricas nunca autoaplicadas; meta com prazo, contribuição, projeção de conclusão e reserva virtual; dívida com saldo principal, taxas, vencimentos, pagamento, antecipação e economia condicionada à regra contratual.

**Engenharia:** orçamento por período com auditoria e versão; zero≠ausente; dinheiro comprometido por meta não é necessariamente dinheiro numa conta separada; motor de dívida suporta parâmetros explícitos e estimativa quando contrato não estiver completo.

**Gate G7:** reconciliar com transações, previsões e simulações; rollovers e pagamentos parciais nos golden tests; nenhuma quitação automática.

### MF2-08 — Relatórios que explicam evolução + patrimônio

**Problema:** sem análise duradoura de posição e desempenho, controle diário não dá visão de riqueza/dívidas.

**Produto:** relatórios por período, categoria, comerciante, orçamento e assinatura; comparação de comportamento; evolução de patrimônio líquido (ativos menos passivos); carteira simples (posições, aportes/retiradas, custo, dividendos/proventos, rentabilidade separada de fluxos); exportação.

**Engenharia:** fontes cotadas com data e qualidade, sem cotações inventadas; transferências para investimentos não criam receitas, preço e desempenho distinguem variação de aportes; dados ausentes marcados.

**Gate G8:** tabela detalhada auditável, testes de rentabilidade e transferências, sem recomendações de trading ou ordens.

### MF2-09 — Inteligência que entende, explica e age com permissão

**Subfases obrigatórias:**
- **A — Integração e custo:** validar autenticação/entitlement real, modelo elegível, consumo, limites, segurança e falhas; assinatura Plus do ChatGPT não presume crédito livre de API.
- **B — Consultar:** ferramentas tipadas para períodos, contas, transações, orçamento, fluxo, metas, dívida e investimentos; respostas citam fonte e revisões, nunca inventam saldo.
- **C — Escrever:** propor alterações multiárea (classificar, criar regras/orçamentos/compromissos/metas, ajustar parâmetros manuais); prévia diff, revisão base, confirmação explícita, transação validada, audit log, idempotência e undo quando permitido. **Não** pagar, transferir ou negociar ativos.
- **D — Proagir:** radar determinístico para insuficiência de caixa, anomalias, assinaturas, vencimentos, metas e orçamento, com IA explicando e sugerindo ações. Frequência, silêncio, privacidade e push opt-in.

**UX:** Hoje / Conversar / Plano de ação, modo contextual em qualquer tela, mini-insights sem poluir, "por que sugeriu?" com dados; classificar o que é fato, hipótese e sugestão. Memória controlada, atualização quando dados mudam e indicação de ação aprovada/executada.

**Gate G9:** testes com prompt injection, dados desatualizados, ações múltiplas, falha parcial, permissões, limite de custo, PWA sem chave privada e auditabilidade. O app financeiro funciona sem IA.

### MF2-10 — Hardening, segurança e release sincronizada

**Escopo:** suites unitárias, integração e e2e; autenticação, sessão, vulnerabilidades, concorrência, performance, backup/restore, migração/rollback, acessibilidade, visual Windows/PWA e contratos N/N-1; artefatos NSIS/portable, hashes, changelog, release e Preview→Production sob autorização.

**Gate G10:** release v2.0.0 estável somente após G0–G9 concluídos e verificáveis; não divulgar build beta como estável.

## 8. Jornadas transversais que definem o produto (testar end-to-end)

1. **Compra segura:** abrir dashboard → conferir obrigações e saldo seguro → comparar A/B → planejar compra após confirmar → ver novo compromisso em calendário/orçamento, sem modificar saldo bancário.
2. **Revisão inteligente:** Pluggy novo → identificar pendência → sugerir categoria/regra → usuário confirma → alterações aparecem em visão/relatório/PWA sem duplicar a linha bancária.
3. **Dívida:** cadastrar contrato → previsão de parcelas → comparar antecipação → escolher cenário → só persistir alteração manual validada; nenhum pagamento efetuado.
4. **Meta e renda:** definir meta → visualizar contribuição recomendada → comparar impacto na liquidez e no orçamento → registrar reserva virtual sem fingir movimentação bancária.
5. **IA assistente:** perguntar sobre gastos → conferir evidência → pedir mudança → revisar diff e confirmar → reabrir outra tela/dispositivo e verificar persistência e audit log.
6. **Falha de rede:** PWA/Windows informa dado desatualizado; rejeita overwrite silencioso; retoma sync sem duplicar.
7. **Investimentos:** transferência da conta para carteira não aumenta patrimônio; dividendo aparece separado de aporte e valorização.

## 9. Política de produto e criatividade

A Rodada A pode sugerir novas experiências e repensar navegação, visual e fluxos. Priorizar ideias que:
- eliminam um problema do 1.0;
- simplificam uma tarefa recorrente;
- tornam um número verificável ou uma decisão melhor;
- funcionam em ambas as plataformas;
- têm motor e dados reais disponíveis;
- podem ser testadas com baixo risco;
- não exigem reimplementar o que já funciona.

Para cada ideia, registrar **problema, persona/jornada, alternativa atual, solução, mock/fluxo, origem de dados, benefício, risco, custo relativo, dependência, testes e destino: ADOTAR/SUBSTITUIR/ADIAR/REJEITAR**. O usuário/Chat arquiteto aprova mudanças significativas no escopo antes da Rodada B.

Não abrir novas abas para cada card, radar, chatbot, relatório ou objetivo. Não replicar telas dos concorrentes; buscar combinação própria e melhor de elementos.

## 10. Acompanhamento permanente — atualizar em todo PR

**Este quadro acompanha o progresso; não é uma declaração de que marcos foram executados.** Atualizado na rodada documental de 09/11/2026. Reavaliar a cada nova evidência/commit.

| Marco | Rodada A | Rodada B | Gate | Evidência mais recente / próximo passo |
| --- | --- | --- | --- | --- |
| MF2-00 | AGUARDANDO_DECISAO | EM_TESTE | NAO_HOMOLOGADO | **D0 beta.6:** CircleCI Linux/Windows SUCCESS no `a4d88ced28c59b21520f4d67a51373cd71bdc8a2`, instalador e portátil x64 com hashes SHA256 verificados no PR #19; sem smoke instalado. **D1.1 beta.7:** PR draft [#22](https://github.com/JoaoVittorLi/meu-financeiro/pull/22), SHA `8734a34db8ec9b5592d666cc14fea9a5b8a826b4`; CI [Linux SUCCESS](https://app.circleci.com/workflow/97d647b6-be40-416a-a69c-d6259f22f8c2/job/4c64a3ed-2442-4295-8cd0-a89b01aaae87) + [Windows SUCCESS](https://app.circleci.com/workflow/97d647b6-be40-416a-a69c-d6259f22f8c2/job/a9c7f44f-5094-4ef5-9c0e-355ab4948ebe), 2/2 executáveis SHA256 **idênticos ao manifesto** (ver [registro da verificação](https://github.com/JoaoVittorLi/meu-financeiro/pull/22#issuecomment-6778657259)), correção de validação de backup/WAL, **instalação Windows e operação real NÃO HOMOLOGADAS**, sem merge/release. **D1.2 EM_DESENVOLVIMENTO:** branch `feat/mf2-d1-2-functional-tests-20261110`, PR draft [#28](https://github.com/JoaoVittorLi/meu-financeiro/pull/28), base imutável beta.7. Defeito reproduzido: `electron/db.cjs` permitia excluir categoria com orçamento explícito `R$ 0` (filtro `amount_cents>0`), descartando limite salvo; corrigido para considerar qualquer orçamento. `electron/main.cjs` tinha lock/listener de instância única duplicados; foi unificado. Novo `electron/smoke-profile.cjs` aceita `userData` temporário só em Electron não empacotado; `scripts/d1-electron-smoke.cjs` automatiza Chromium/CDP DOM + bridge IPC + SQLite fictício + fechamento/reabertura; gate `npm run test:electron-smoke` preparado no script CircleCI Windows **para a próxima candidata**, sem executar ainda. **Testes executados localmente:** 4/4 PASS em Node v22.16.0 (3 testes de perfil com blob exato GitHub e reprodução SQLite real do orçamento zero), script de smoke passa parser V8; **testes D1.2 integrais e Electron real ainda NÃO executados**. **Argon:** A-D1 [#23](https://github.com/JoaoVittorLi/meu-financeiro/pull/23) `app/overview.css`, A-D2 [#25](https://github.com/JoaoVittorLi/meu-financeiro/pull/25) `app/operations.css`, cada uma relatou 18 testes no snapshot; candidata CSS-only [#27](https://github.com/JoaoVittorLi/meu-financeiro/pull/27) criada com blobs exatos, **sem merge**, aguardando A-D3 incremental em `operations.css` e smoke visual real Electron. **Cloudflare/PWA congelados temporariamente**; nenhuma sincronização ou dado pessoal usado. Próximo: consolidar testes/defeitos D1.2 e contribuição visual A-D3, sem bump para beta.8 até haver versão funcional candidata; quando pronta, **UMA pipeline `run_preflight=false`/`run_windows_build=true`** (Linux → Windows e smoke GUI), hashes, smoke instalado, sem distribuir por CI apenas. [Log D1.2](ai-context/logs/2026-11-10-MF2-D1-2-desktop-first-automation.md). **Consolidação automatizada D1.2 (10/11/2026):** na branch PR #28 foram implementados 16 screenshots reais **a executar** no smoke Electron (4 áreas × matriz de 1366×768/1920×1080, claro/escuro e redução de movimentos), validação explícita do breadcrumb, aba ativa, tema, viewport, ausência de overflow horizontal global e assinatura PNG. A matriz grava `visual-matrix.json`; `.circleci/build-windows.ps1` exige 16 PNGs na próxima candidata e `.circleci/config.yml` preserva as capturas em `MeuFinanceiro-Desktop-Smoke` separado dos EXEs. Três novos testes `tests/d1-2-visual-matrix.test.cjs` (positiva, overflow e imagem inválida) publicados. **3/3 cenários da função exata `visualMatrix` do blob GitHub `e295401f1479969b0044ff6c5c3fd84a2c126db9` PASS em V8 com CDP/FS simulados**; isso valida a lógica, não a execução Electron/Windows nem os três testes Node do repositório. A-D3 ainda **não publicada em branch/PR verificável**; PR #27 mantém A-D1/A-D2 CSS-only, sem merge sobre D1.2. Sem bump beta.8, sem nova pipeline/executável. 

**G0 NAO_HOMOLOGADO; PRs draft; versões beta.6/beta.7 recuperáveis.** |
| MF2-01 | ANALISADO | BLOQUEADO_G0 | NAO_HOMOLOGADO | E1_CONCILIATION_REPORT, 630/632 sem comparação completa · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-02 | ANALISADO | BLOQUEADO_G1 | NAO_HOMOLOGADO | shared/finance-period-ledger.mjs já existe parcialmente · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-03 | ANALISADO | BLOQUEADO_G2 | NAO_HOMOLOGADO | U4 solicitada, ainda não publicada/comprovada · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-04 | AGUARDANDO_DECISAO | BLOQUEADO_G3 | NAO_HOMOLOGADO | fundamentos D1–D4 e U1–U3 presentes · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-05 | AGUARDANDO_DECISAO | BLOQUEADO_G2_G3 | NAO_HOMOLOGADO | categorias/regras já existem em modo parcial · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-06 | AGUARDANDO_DECISAO | BLOQUEADO_G2_G5 | NAO_HOMOLOGADO | planejamento e simulador parcial existentes · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-07 | AGUARDANDO_DECISAO | BLOQUEADO_G6 | NAO_HOMOLOGADO | limites recorrentes U3, sem envelopes completos · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-08 | AGUARDANDO_DECISAO | BLOQUEADO_G2_G7 | NAO_HOMOLOGADO | patrimônio/investimentos em escopo 2.0 · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-09 | AGUARDANDO_DECISAO | BLOQUEADO_G2_G4_G8 | NAO_HOMOLOGADO | IA de demonstração; leitura/escrita real não homologada · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-10 | ANALISADO | BLOQUEADO_G0_G9 | NAO_HOMOLOGADO | Release mais recente v0.9.4 · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |

### Checkpoint da Rodada A — 09/11/2026, PR #17 (somente análise)

**Documento de evidência:** [Relatório completo A0–A7](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md) · [registro de ideias](ai-context/IDEA_REGISTER.md) · [log](ai-context/logs/2026-11-09-MF2-rodada-a-diagnostico.md). Base de código #16 `c535cb0`, base documental inicial #17 `ed6f49a`. **Inspeção remota do GitHub; sem acesso ao Work anterior, sem testes novos de app e sem homologação Windows/PWA.**

- **MANTER:** MF2-00/01/02/03/10 como prioridades técnicas e gates inalterados; preservar investimentos já feitos em U1–U3, PWA e serviços existentes.
- **MODIFICAR se aprovado:** MF2-04 home contextual e qualidade por indicador; MF2-05 inbox de revisão; MF2-06 ciclo salarial/Laboratório único; MF2-07 Flex como camada simples opcional; MF2-08 patrimônio decomposto; MF2-09 ferramentas tipadas com recibo. **Propostas ainda NÃO incorporadas como requisito novo.**
- **ADIAR 2.1:** digest opt-in (IDEA-28). **REJEITAR por ora:** score único opaco e reescrita visual/arquitetural total (IDEA-29/30).
- **Decisão exigida:** autorizar a primeira missão B de MF2-00, depois de reconciliar as alterações locais do Work; confirmar stack gradual, UX e limites de IA. Nenhuma linha da coluna Rodada B ou Gate foi promovida e nenhuma flag de migração foi alterada.

**Na Rodada A:** atualizar coluna A, evidências, backlog e decisões; preservar B/gates como não executados. **Na Rodada B:** atualizar B + evidências do SHA/teste/PR após cada fatia; gate somente após homologação. **Integrador:** valida estado global e publica o progresso real; status em branch draft não representa publicação.

### Modelo obrigatório de atualização por mudança

A cada PR ou correção significativa, atualizar:
1. A linha do marco (A/B/gate/evidência, com SHA e PR).
2. O escopo ou critério de aceite alterado **somente se houver decisão registrada**.
3. O arquivo de contexto [ACTIVE_WORK](ai-context/ACTIVE_WORK.md) para indicar ownership/branch quando aplicável.
4. Um log novo em [logs](ai-context/logs/) com o que foi alterado/testado/não testado.
5. [CURRENT_STATE](ai-context/CURRENT_STATE.md) **apenas após integração homologada**, pelo integrador, para evitar declarar drafts como estáveis.
6. Se houver mudança de direção: ADR em [decisions](ai-context/decisions/) + proposta no [IDEA_REGISTER](ai-context/IDEA_REGISTER.md) ou decisão formal.

**Não apagar itens pendentes para melhorar aparências.** Mudanças de escopo exigem rastreabilidade MANTER/ALTERAR/ADIAR/REMOVER e links. Ver [ROADMAP_UPDATE_RULES](ai-context/ROADMAP_UPDATE_RULES.md).

## 11. Qualidade e definição universal de concluído

Testes criados ≠ testes executados; build gerado ≠ instalado; PR aberto ≠ integrado; Preview ≠ Production. Cada fatia informa SHA, arquivos, testes, ambiente, valores de referência sintéticos, evidência visual real quando aplicável, limites e rollback. A aprovação técnica e a aprovação visual são **independentes**.

Matriz mínima: banco/manual vinculados sem double count; transferência neutra; pending distinto; orçamento zero≠ausente; saldo desconhecido; parcela e juros; receita incerta; pagamento parcial; conta errada; conflito PC↔PWA; reenvio idempotente; IA com dado desatualizado; simulação sem escrita; investimentos sem rentabilidade inflada; recuperação e migração.

Escala de auditoria: **APROVADO / APROVADO_COM_PENDENCIAS / REPROVADO / NAO_HOMOLOGADO_POR_FALTA_DE_EVIDENCIA**. A última classificação evita tanto falsos sucessos quanto falsos bugs.

## 12. Próximo passo — não pular

**Agora: Rodada A de análise aprofundada do estado + produto**, considerando MF2-00 como primeiro gate técnico. Antes de iniciar execução:
1. Verificar se o Work anterior possui U4 ou IA não publicadas, comparar SHA e arquivos.
2. Fazer auditoria visual e financeira das áreas existentes e do Preview protegido **sem tocar em dados pessoais ou produção**.
3. Mapear lacunas e propostas criativas por impacto/risco, escolher o que deve permanecer ou ser ajustado no plano.
4. Atualizar este roadmap como **ANALISADO / AGUARDANDO_DECISAO**, criar relatório de análise e subentregas recomendadas.
5. Após autorização, iniciar **Rodada B: MF2-00**, com build e smoke do candidato, e prosseguir pelos gates.

O esforço sugerido ao Work é **Alto na primeira análise arquitetural ampla, Médio para investigações por módulo, Leve para checkpoints**. O Chat pode preparar pesquisas, priorização e prompts sem consumir Work. Consultar [WORK_PROMPT](ai-context/WORK_PROMPT.md).


## Anexo documental de 09/11/2026 — consolidação e benchmark aprofundado (Rodada A)

**Status:** proposta documental na branch candidata `integration/mf2-baseline-candidate-20261109`, derivada da revisão mais recente do PR #17. **Nenhum gate de execução promovido.** Este adendo não altera escopo previamente aprovado nem declara código testado.

- [BRANCH_CONSOLIDATION_PLAN](ai-context/BRANCH_CONSOLIDATION_PLAN.md): a linhagem #1→#16→#17 já é majoritariamente ancestral; não mesclar PRs antigos cegamente. Branches de Inteligência/CI divergentes (#2/#3/#4/#5) exigem diff funcional e testes antes de encerrar; Work local pode ter mudanças não publicadas. A nova branch é **CANDIDATA**, não baseline homologada.
- [MARKET_FEATURES_DEEP_DIVE](ai-context/MARKET_FEATURES_DEEP_DIVE.md): especificação de dez experiências com referência de mercado, fluxo do usuário, MVP, contratos, dependências e testes. São **recomendações para a Rodada A**, não novas entregas aprovadas.
- Primeiro gate técnico continua **MF2-00**: recuperar checkpoint do Work, validar equivalência de branches divergentes, executar CI Windows e smoke no SHA final, confirmar documentação e rollback.
- Decisões de UX/pesquisa não podem acionar automaticamente a Rodada B. Integrador atualiza CURRENT_STATE após verificação; branch candidata não altera `main`.
