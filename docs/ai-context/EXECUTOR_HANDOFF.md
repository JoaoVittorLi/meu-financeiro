# EXECUTOR HANDOFF — Meu Financeiro 2.0 / Desktop First

**Última atualização:** 10/11/2026. **Fonte de verdade:** código e SHA atual do [PR #31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31). Leia `docs/ai-context/README.md`, `CURRENT_STATE.md`, `ACTIVE_WORK.md`, `ROADMAP_UPDATE_RULES.md`, `ROADMAP_MF2.md`, `TESTING_AND_RELEASE.md` e o log mais recente antes de escrever.

## IDENTIDADE DO PROJETO

Repositório privado `JoaoVittorLi/meu-financeiro`. Aplicativo financeiro Windows Electron + React/TypeScript + SQLite local; PWA/Cloudflare em frentes separadas, congeladas na missão Desktop First. Prioridade: integridade de centavos, contas e IDs, backup/restore, UI Premium e executável Windows validado.

## MISSÃO ATUAL

D1.2: estabilização da candidata `0.9.5-beta.8`; corrigir falhas comprovadas do preflight, validar regressões financeiras, executar smoke Electron real e gerar NSIS/Portable com hashes. **Não** promover beta.8 como release ainda.

## BRANCH ATIVA

`feat/mf2-beta8-premium-staging-20261110`, [PR #31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31) draft, base funcional `feat/mf2-d1-2-functional-tests-20261110` / PR #28. HEAD **dinâmico**: consulte GitHub ao iniciar qualquer ação. Código da correção mais recente em `c109d905a4120b5820130e310e3dd36210781db6`; SHA anterior `dd30ddbd94d16b1cd415ff61b3dd4bd94ad2065b`. Os commits documentais posteriores alteram o HEAD sem alterar o código.

## ÚLTIMA ENTREGA COMPROVADA

`tests/categories.test.cjs` corrigido para tratar orçamento explícito R$ 0 como vínculo que impede excluir categoria. `electron/db.cjs` permaneceu intacto. Confirmação de edição no GitHub por commit `c109d905a4120b5820130e310e3dd36210781db6`. Ver log `docs/ai-context/logs/2026-11-10-MF2-D1-2-beta8-category-zero-test-fix.md`.

## ESTADO DOS TESTES

Pré-flight do SHA anterior: **FAILURE**, status GitHub `ci/circleci: preflight_linux`; job CircleCI https://app.circleci.com/workflow/5c01ade4-c4db-4a29-999b-c1b242c79f47/job/a9f9e06b-800d-4876-893e-a49f21aafccf. Código corrigido: sintaxe JS analisada em V8; harness SQL isolado Node 22.16.0/SQLite **6/6 PASS**, mas **não é teste do app**. Ainda NÃO executados no HEAD corrigido: `node --test tests/categories.test.cjs tests/d1-2-desktop-integration.test.cjs`, `npm run test:db`, tipos, provenance, PWA dry-run, smoke Electron, CircleCI Linux→Windows. **Sem EXE beta.8.**

## BLOQUEIOS

Acesso local a checkout/dependências não disponível nesta sessão; log completo CircleCI inacessível. Outras falhas no mesmo preflight não foram descartadas. Não divulgar sucesso além da evidência. Dados financeiros pessoais e Production proibidos nos testes.

## TRABALHO DE OUTROS AGENTES

Argon: proprietário de `app/overview.css`, `app/operations.css`, `app/decisions.css`; A-D1–A-D4 na beta.8, A-D5 posterior. Chat Arquiteto: coordenação, decisões de integração e atualização canônica de `CURRENT_STATE.md`. Não sobrescrever CSS ou promover gate global sem coordenação.

## ARQUIVOS SOB RESPONSABILIDADE DO EXECUTOR

`tests/**`, `electron/db.cjs`, `electron/main.cjs`, `electron/recovery.cjs`, integração local de categorias/Planejamento/Pluggy e smoke, `.circleci/**`, `scripts/**` conforme a missão e sem colidir com outras frentes. Manter `docs/ROADMAP_MF2.md`, logs e este handoff atualizados; `CURRENT_STATE.md` somente pelo integrador.

## PRÓXIMA AÇÃO EXATA

1. Reconsultar HEAD do PR #31 e `tests/categories.test.cjs`; não reaplicar patch se presente.
2. Em checkout integral Node 22 com dependências, executar `node --test tests/categories.test.cjs tests/d1-2-desktop-integration.test.cjs`; registrar resultado verdadeiro. Se houver falhas novas, corrigir na mesma branch com regressão.
3. Executar suíte financeira relevante (`npm run test:db`, `npm run test:types`, `npm run compile`, provenance); só então solicitar uma pipeline `windows_on_demand` Config/Checkout `feat/mf2-beta8-premium-staging-20261110`, `run_preflight=false`, `run_windows_build=true` (preflight_linux → build_windows).
4. Após a pipeline, verificar jobs, 16 PNGs (se produzidos), NSIS, Portable, SHA256 e smoke; não realizar merge, release ou deploy Production.

## INSTRUÇÕES DE RECUPERAÇÃO

Use PR #31, PR #28, `docs/ai-context/logs/2026-11-10-MF2-D1-2-beta8-candidate.md` e o log do ajuste atual. Capture data/SHA, comandos, testes aprovados/falhos/não realizados, artefatos, riscos e próxima ação em cada entrega. GitHub é a memória; chat não é fonte de verdade. Não criar nova branch de consolidação sem necessidade.
