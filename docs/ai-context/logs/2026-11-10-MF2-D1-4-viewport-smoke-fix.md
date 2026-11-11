# MF2 2.0 — D1.4.2: correção de viewport CDP no smoke Electron beta.8

**Data:** 10/11/2026. **Branch:** `feat/mf2-beta8-premium-staging-20261110`; **PR:** #31 draft. **HEAD inicial:** `92a99c7454722826ef0908c5d26cdbe623ee2ad6`. **Commit de código:** `745afd5d69a022205324a0d4613f5bc9e182c4b4`. O HEAD da documentação avança após este registro.

## Causa raiz analisada

A falha reportada no smoke Windows, `scripts/d1-electron-smoke.cjs` linha ~188, correspondia ao teste `assert(state.width>=cfg.width-2)`, em que `state.width` vinha de `document.documentElement.clientWidth`. Essa propriedade mede o layout de conteúdo que **pode excluir** a barra de rolagem vertical clássica, comum no Windows, por exemplo 1349px com emulação de 1366px. A API CDP `Emulation.setDeviceMetricsOverride` sobrescreve `window.innerWidth` e `window.innerHeight`, apropriados para validar a dimensão exigida. Além disso, apesar da correção anterior nos dois testes de contrato, ainda havia no próprio `smoke()` um `assert.equal(visuals.count,16)` herdado da D1.2; se o viewport passasse, esse assert causaria falha posterior.

## Alteração precisa

- `scripts/d1-electron-smoke.cjs`: helper `waitForEmulatedViewport` consulta via CDP `window.innerWidth/innerHeight` até 20 vezes, com intervalo de 100ms, falhando com diagnóstico esperado/real quando não aplica. A matriz confere o viewport verdadeiro após cada navegação, usa `contentWidth` para detecção de overflow (sem relaxar a rejeição), guarda `viewportWidth/Height` e `contentWidth` no manifesto, e substitui `visuals.count===16` por `SMOKE_VIEWS.length*SMOKE_PRESETS.length` = 32.
- `tests/d1-2-visual-matrix.test.cjs`: manteve os testes de 32 capturas e de falha para overflow/PNG inválido; acrescentou verificações da scrollbar de 17px, atraso de 3 leituras CDP e falha fechada para viewport 120px menor com diagnóstico explícito.
- `tests/d1-3-smoke-matrix.test.cjs`: guarda estática do contrato de 32 imagens no smoke integral, `window.innerWidth`, `window.innerHeight` e espera do CDP.

## Testes executados e não executados

1. **6/6 cenários PASS em V8 isolado**, invocando a implementação integral `visualMatrix` publicada no HEAD do Github com CDP, filesystem e Buffer simulados: (1) 32 PNGs/manifesto, (2) scrollbar Windows de 17px, (3) métricas CDP com atraso, (4) viewport 120px menor → rejeição e sem manifesto, (5) overflow horizontal → rejeição e sem manifesto, (6) PNG corrompido → rejeição e sem manifesto.
2. **10/10 callbacks de testes de matriz D1.2 e contrato D1.3 em V8** sobre os arquivos exatos da branch com imports Node simulados. Um harness de teste tinha inicialmente omitido o arquivo PowerShell: resultado inconclusivo do contrato correspondente; o mock foi corrigido e esse contrato passou usando o PS1 verdadeiro. Essa falha de fixture **não é uma falha do app**.
3. **Parser V8 PASS** nos três arquivos modificados. Inspeção direcionada em sete arquivos de smoke/testes: nenhuma expectativa antiga de 16. Uma consulta de busca GitHub também não retornou ocorrências dos padrões antigos, mas a busca pode depender da indexação do serviço.
4. **NÃO EXECUTADOS**: `node --test` oficial no checkout, `npm run test:db`, TS, F08, ASAR, Electron GUI, screenshots reais, Windows e CircleCI. Repositório privado não disponível como checkout local, sem DNS de `github.com` pelo terminal; sem executáveis nesta missão. Nenhuma aprovação foi inferida a partir dos mocks.

## Segurança do escopo, pendências e próximo gate

Nenhum CSS do Argon, regra financeira, SQLite, Pluggy, perfil real, `electron/main.cjs`, `.circleci/build-windows.ps1`, PWA/Cloudflare, `main` ou lançamento foram alterados. Pacotes transitivos marcados como deprecated (`glob`, `tar`, `inflight`, `rimraf`) não são a causa do viewport e exigem análise semver/audit própria, não `npm update` indiscriminado.

**Próxima ação:** executar uma única pipeline CircleCI com Config/Checkout Branch `feat/mf2-beta8-premium-staging-20261110`, parâmetros `run_preflight=false`, `run_windows_build=true`; esse workflow roda preflight Linux → Windows x64. O gate Windows deve efetivamente produzir 32 screenshots, executar persistência/backup e gerar dois EXEs com hashes; a beta.8 só pode ser homologada após os gates reais e conferência física dos artifacts. Se outro erro aparecer, corrigir a causa reproduzível no mesmo branch, não reduzir requisitos de teste.
