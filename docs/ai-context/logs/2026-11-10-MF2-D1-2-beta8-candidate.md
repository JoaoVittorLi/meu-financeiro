# MF2 — D1.2 | Fechamento funcional da candidata 0.9.5-beta.8
**Data:** 10/11/2026 · **Executor:** PR draft #31 · **Branch:** `feat/mf2-beta8-premium-staging-20261110` · **Base funcional:** PR draft #28, `35abeb454107e094fc8c07e26af023810e5fe917`.

## Entregas funcionais
- Orçamento explicitamente R$0 protegido contra exclusão acidental da categoria.
- `FinanceDB.ingestBank` rejeita antes de iniciar a transação IDs bancários repetidos na mesma conta/lote, contas duplicadas no lote e conta vinculada a outro item Pluggy; mantém IDs iguais entre contas distintas.
- Bloqueio de instância Electron único. Perfil `userData` isolado em diretório temporário de teste, recusado no executável empacotado; operações HTTP externas bloqueadas apenas no teste.
- Suite de recuperação/persistência: real/demo, importação idempotente, edições manuais, vínculo bancário, categorias, orçamentos, parcelas, compromissos, backup/restore e arquivo inválido.
- `tests/d1-2-category-rename-links.test.cjs` acrescenta regressão de vínculos por SQLite `ON UPDATE CASCADE`: regra, split bancário, override, orçamento e planejamento preservados ao renomear.
- Smoke Electron real por CDP/IPC com abertura, navegação DOM, reinício, SQLite, backup e 16 imagens (4 áreas × viewports 1366×768/1920×1080, temas e movimento reduzido). `.circleci/build-windows.ps1` exige execução real antes da compilação final; `.circleci/config.yml` armazena imagens isoladas dos arquivos de release.

## Contribuições visuais incorporadas
A-D1 PR #23 (`overview.css` blob `e47e8d0206c193dca127a802e1b77691212638f3`); A-D2 PR #25 + A-D3 PR #29 incremental (`operations.css` blob `fc1ac6f79ebfa9b350298f6b76e6ef0eee21a04d`); A-D4 PR #30 (`decisions.css` blob `1d1d9b706b0a0a79b0dfce1df04bf418e6b6a5f3`). Comparado à base funcional, os únicos arquivos adicionais de implementação visual são esses CSS e seis ajustes de versão na fonte/renderer/manifestos; `tests/d1-2-premium-css-contract.test.cjs` verifica âncoras e reduced motion. Não incluiu A-D5, não substituiu nenhum CSS anterior por versão antiga e não modificou motores financeiros da D1.2.

## Evidências realmente executadas
- **8/8 PASS**: `node --test tests/d1-2-bank-batch-integrity.test.cjs tests/d1-2-desktop-integration.test.cjs tests/d1-2-category-rename-links.test.cjs` no arquivo local extraído do portátil beta.7 e sobreposto com os patches D1.2, com Node v22.16.0/`node:sqlite` e `tmpdir` sintético. TAP `/mnt/data/d1-2-beta8-sqlite-8-verified.tap`, SHA256 `ad600220541613a7f089e85ffc608179fa4ce0c6f54602b3a3d382b9d0c3096b`. Evidências anteriores do PR #28 incluem conferência de blobs exatos para o módulo SQLite e testes de importação; a árvore local não é checkout integral do candidato.
- **3/3 PASS em V8**: arquivo publicado `tests/d1-2-premium-css-contract.test.cjs` avaliado com mock de `node:fs` lendo fontes CSS reais do GitHub. Isso verifica seletor/reduced-motion/URLs, **não** navegador Electron.
- O Argon executou testes CSS direcionados A-D3 (33/33) e A-D4 (24/24) em snapshots anteriores; **não homologam** o HEAD integrado.
- **Chromium local**: navegação a `file://` e `localhost` impedida por `ERR_BLOCKED_BY_ADMINISTRATOR`. Nenhuma captura real realizada neste ambiente; não confundir bloqueio do navegador de testes com defeito do app.

## Gates bloqueantes para distribuição
**Ainda não realizados:** `npm run test:db` integral do checkout final, `test:types`, compile/F08, Worker dry-run, smoke Electron GUI com 16 PNGs/SQLite isolado no Windows, build NSIS/Portable, arquivos SHA256 e homologação nativa instalada. Não há executável beta.8. A versão beta.8 nos quatro manifestos + `src/app.ts`/`app/app.js` é apenas identificador de candidata; Cloudflare/PWA Production congelados. Beta.6/beta.7 preservadas.

**Próxima execução:** exatamente **UMA pipeline** em `feat/mf2-beta8-premium-staging-20261110` com `run_preflight=false`, `run_windows_build=true`. Só aprovar candidato se Linux e Windows/GUI passarem e hashes corresponderem; se falhar, corrigir PR #31 e gerar novo SHA antes de repetir. Não solicitar duas pipelines nem instalar beta.8 pendente.
