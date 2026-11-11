# MF2 — D1.2 | Correção da regressão do teste de categoria com orçamento zero

**Data:** 10/11/2026. **Responsável:** Executor 2. **Branch:** `feat/mf2-beta8-premium-staging-20261110`. **PR:** [#31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31). **SHA anterior:** `dd30ddbd94d16b1cd415ff61b3dd4bd94ad2065b`. **Commit da alteração:** [`c109d905a4120b5820130e310e3dd36210781db6`](https://github.com/JoaoVittorLi/meu-financeiro/commit/c109d905a4120b5820130e310e3dd36210781db6).

## Problema, evidência e causa

A pipeline CircleCI marcou `ci/circleci: preflight_linux` como `failure` no SHA anterior. Link: https://app.circleci.com/workflow/5c01ade4-c4db-4a29-999b-c1b242c79f47/job/a9f9e06b-800d-4876-893e-a49f21aafccf. Em `tests/categories.test.cjs`, o teste “categorias em uso não são excluídas; categorias padrão são protegidas” esperava sucesso de `deleteCategory('Investimentos')` após salvar `budgets:{Investimentos:0}`. Em `electron/db.cjs`, a consulta `SELECT 1 FROM budgets WHERE category=? LIMIT 1` corretamente considera orçamento zero como vínculo e lança “Categoria em uso”. Não se verificou o log inteiro do CircleCI; outras falhas seguem não descartadas.

## Mudança efetiva

Somente `tests/categories.test.cjs` foi modificado. O teste agora verifica: (1) movimentação e orçamento de valor positivo bloqueiam exclusão e preservam lançamentos; (2) orçamento explicitamente R$ 0 permanece e bloqueia exclusão mesmo sem transações; (3) depois de salvar `budgets:{}`, a categoria customizada pode ser excluída. Proteção de categoria padrão e integridade `['ok']` também verificadas pelo contrato do teste. **O módulo de produção `electron/db.cjs` não foi alterado.** Nenhum CSS Argon foi modificado.

## Testes e limites

- **Check estático:** conteúdo completo do teste analisado sintaticamente por V8 (`V8_PARSE_OK`), com verificação da presença das asserções e dos três cenários — **não executa o CommonJS real**.
- **Execução local real e isolada:** `node --no-warnings /tmp/mf2-category-zero-sql-smoke.cjs`, Node `v22.16.0` e `node:sqlite`, banco em memória, consultas SQL de `deleteCategory` copiadas do arquivo verificado; **6/6 PASS** (uso por transação, categoria padrão, orçamento zero bloqueado, persistência do zero, exclusão liberada, categoria ausente). Esse harness **não é** a classe FinanceDB do app e **não substitui** a suíte real.
- **NÃO executado:** `node --test tests/categories.test.cjs tests/d1-2-desktop-integration.test.cjs` no checkout integral; `npm run test:db`, tipos, compile/F08, PWA dry-run, smoke nativo Electron, CircleCI novo, geração de EXE.
- **Motivo do limite:** ambiente local tem Node/SQLite, mas não possui acesso de rede para clonar o repositório privado/dependências; somente os fontes consultados pelo conector GitHub puderam ser verificados. Não declarar CI aprovado.

## Integração, riscos e próximo passo

PR #31 permanece **draft**, beta.8 candidata não homologada. Beta.6 e beta.7 não foram modificadas; PWA/Cloudflare Production congelados. Próximo Executor: conferir HEAD vivo, executar as duas suites direcionadas no checkout correto; se aprovadas, rodar regressões financeiras relevantes e acionar **uma** pipeline `windows_on_demand`, Config/Checkout `feat/mf2-beta8-premium-staging-20261110`, `run_preflight=false`, `run_windows_build=true`. Conferir preflight e job Windows, smoke, 16 PNGs, NSIS/Portable e hashes antes de sugerir instalação. Sem merge/main, release ou dados reais.
