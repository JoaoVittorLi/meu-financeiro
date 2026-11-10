# EXECUTOR HANDOFF — Meu Financeiro 2.0 / Desktop First

**Última atualização:** 10/11/2026. **Fonte de verdade:** código e SHA atual do [PR #31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31). Leia `docs/ai-context/README.md`, `CURRENT_STATE.md`, `ACTIVE_WORK.md`, `ROADMAP_UPDATE_RULES.md`, `ROADMAP_MF2.md`, `TESTING_AND_RELEASE.md` e o log mais recente antes de escrever.

## IDENTIDADE DO PROJETO

Repositório privado `JoaoVittorLi/meu-financeiro`. Aplicativo financeiro Windows Electron + React/TypeScript + SQLite local; PWA/Cloudflare em frentes separadas, congeladas na missão Desktop First. Prioridade: integridade de centavos, contas e IDs, backup/restore, UI Premium e executável Windows validado.

## MISSÃO ATUAL

D1.3: estabilizar a candidata `0.9.5-beta.8` enquanto o Argon conclui A-D6. Corrigir falhas demonstráveis, ampliar smoke/contratos e preparar integração A-D5/A-D6 **sem mesclar CSS ainda, sem CircleCI, sem EXE, sem release e sem mexer na main**. Prévia da integração Premium somente após pacote A-D6 aprovado pelo Arquiteto.

## BRANCH ATIVA

`feat/mf2-beta8-premium-staging-20261110`, [PR #31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31) draft, base funcional `feat/mf2-d1-2-functional-tests-20261110` / PR #28. HEAD **dinâmico**: consulte GitHub ao iniciar qualquer ação. Código da correção mais recente em `c109d905a4120b5820130e310e3dd36210781db6`; SHA anterior `dd30ddbd94d16b1cd415ff61b3dd4bd94ad2065b`. Os commits documentais posteriores alteram o HEAD sem alterar o código.

## CHECKPOINT D1.3 — PREMIUM FINAL (10/11/2026)

- **Último commit de código da missão:** `661bf754bfcdf8cd270e14dc1946c08d2f9c35bd` — `scripts/d1-electron-smoke.cjs` com oito áreas e quatro presets (32 PNGs), `.circleci/build-windows.ps1` agora exige as 32 imagens + manifesto sem duplicação, e novo `tests/d1-3-smoke-matrix.test.cjs`. Config/Checkout Branch continuam `feat/mf2-beta8-premium-staging-20261110`; **HEAD pode mudar após commit documental, reconferir antes de alterar**.
- **Teste realmente executado:** 3/3 asserções do novo teste em V8 com `require`/módulos Node simulados lendo textos exatos do SHA publicado; V8 parse OK. **Não é execução real do Node Test Runner**. Não há checkout npm nem Electron instalável disponível nesta sessão; sem testes reais completos, sem F08/ASAR/GUI e sem novo CI. A verificação anterior 6/6 SQL foi um harness isolado, não a suíte do app.
- **A-D5:** PR #32 `c4f1b657d30e3da59b4302ed3f4f68b78b0ae70f`, somente `app/decisions.css` e `app/intelligence.css`. Ambos os blobs **base** no staging correspondem à base PR #30 de A-D5; aplicar versão final do Argon após a A-D6 ser aceita, sem reaplicar patches anteriores em duplicidade.
- **A-D6:** em desenvolvimento conforme Arquiteto; branch `ad6` não identificada por busca nesta sessão. **Não foi integrada.** Solicitar decisão/HEAD do PR final só quando Argon publicar.
- **Conflitos a vigiar:** `app/decisions.css` da A-D5/A-D4, `app/intelligence.css`, e quaisquer `overview.css`/`operations.css`/outras áreas tocadas pela A-D6. Argon mantém ownership CSS. Reconciliar o diff final antes do cherry-pick/cópia, sem sobrescrever CSS mais recente.
- **Plano pós A-D6:** Arquiteto aprova conteúdo visual; Executor compara blobs/contratos, integra somente CSS efetivo, valida testes Node, types, F08, ASAR e smoke Electron 32 PNGs, restauro sintético e hashes; só então **uma** pipeline Linux→Windows autorizada. `CURRENT_STATE.md` continua exclusivo do integrador.
- **Log da missão:** `docs/ai-context/logs/2026-11-10-MF2-D1-3-beta8-final-prep.md`.

## ÚLTIMA ENTREGA COMPROVADA

`tests/categories.test.cjs` corrigido para tratar orçamento explícito R$ 0 como vínculo que impede excluir categoria. `electron/db.cjs` permaneceu intacto. Confirmação de edição no GitHub por commit `c109d905a4120b5820130e310e3dd36210781db6`. Ver log `docs/ai-context/logs/2026-11-10-MF2-D1-2-beta8-category-zero-test-fix.md`.

## ESTADO DOS TESTES

Pré-flight do SHA anterior: **FAILURE**, status GitHub `ci/circleci: preflight_linux`; job CircleCI https://app.circleci.com/workflow/5c01ade4-c4db-4a29-999b-c1b242c79f47/job/a9f9e06b-800d-4876-893e-a49f21aafccf. Código corrigido: sintaxe JS analisada em V8; harness SQL isolado Node 22.16.0/SQLite **6/6 PASS**, mas **não é teste do app**. Ainda NÃO executados no HEAD integrado D1.3: `node --test tests/categories.test.cjs tests/d1-2-desktop-integration.test.cjs`, `npm run test:db`, tipos, provenance, PWA dry-run, smoke Electron, CircleCI Linux→Windows. **Sem EXE beta.8.**

## BLOQUEIOS

Acesso local a checkout/dependências não disponível nesta sessão; log completo CircleCI inacessível. Outras falhas no mesmo preflight não foram descartadas. Não divulgar sucesso além da evidência. Dados financeiros pessoais e Production proibidos nos testes.

## TRABALHO DE OUTROS AGENTES

Argon: proprietário de `app/overview.css`, `app/operations.css`, `app/decisions.css` e `app/intelligence.css`; A-D1–A-D4 na beta.8, A-D5 publicada no PR #32 e A-D6 em desenvolvimento. Chat Arquiteto: coordenação, decisões de integração e atualização canônica de `CURRENT_STATE.md`. Não sobrescrever CSS ou promover gate global sem coordenação.

## ARQUIVOS SOB RESPONSABILIDADE DO EXECUTOR

`tests/**`, `electron/db.cjs`, `electron/main.cjs`, `electron/recovery.cjs`, integração local de categorias/Planejamento/Pluggy e smoke, `.circleci/**`, `scripts/**` conforme a missão e sem colidir com outras frentes. Manter `docs/ROADMAP_MF2.md`, logs e este handoff atualizados; `CURRENT_STATE.md` somente pelo integrador.

## PRÓXIMA AÇÃO EXATA

1. Reconsultar HEAD do PR #31 e `tests/categories.test.cjs`; não reaplicar patch se presente.
2. Em checkout integral Node 22 com dependências, executar `node --test tests/categories.test.cjs tests/d1-2-desktop-integration.test.cjs`; registrar resultado verdadeiro. Se houver falhas novas, corrigir na mesma branch com regressão.
3. Executar suíte financeira relevante (`npm run test:db`, `npm run test:types`, `npm run compile`, provenance); aguardar aceite do Arquiteto para o pacote A-D6 e integrar seu CSS sem regressão. Somente com autorização, solicitar uma pipeline `windows_on_demand` Config/Checkout `feat/mf2-beta8-premium-staging-20261110`, `run_preflight=false`, `run_windows_build=true` (preflight_linux → build_windows).
4. Após a pipeline autorizada, verificar jobs, 32 PNGs (se produzidos), NSIS, Portable, SHA256 e smoke; não realizar merge, release ou deploy Production.

## INSTRUÇÕES DE RECUPERAÇÃO

Use PR #31, PR #28, `docs/ai-context/logs/2026-11-10-MF2-D1-2-beta8-candidate.md` e o log do ajuste atual. Capture data/SHA, comandos, testes aprovados/falhos/não realizados, artefatos, riscos e próxima ação em cada entrega. GitHub é a memória; chat não é fonte de verdade. Não criar nova branch de consolidação sem necessidade.
