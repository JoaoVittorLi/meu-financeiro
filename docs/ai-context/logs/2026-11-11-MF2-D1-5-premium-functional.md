# MEU FINANCEIRO 2.0 — D1.5 | Interações Premium, drawer e editor manual

**Data:** 11/11/2026 · **Repositório:** `JoaoVittorLi/meu-financeiro` · **Branch:** `fix/mf2-d1-5-premium-interactions-20261111` · **PR:** #36 draft, base staging beta.8 `d513c2be3f9b0cd018aed0b71f46ce8747a6556c`. **Último commit funcional:** `aefdcf9c75794534971ee3b3465c59df77229a70`. Este log é complementar aos logs D1.2–D1.4; não substitui a fonte de verdade GitHub.

## Entregas versionadas

- `6a0bace5cc2edd84429d935403d6413946981069` — nova `app/premium-interactions.css` com tokens e seletores para eight áreas, focus/reduced motion, shadow/translate/scale. `app/index.html` carrega o arquivo depois dos CSS Argon; `src/plan-view.ts` substitui cores roxas fixas do gráfico. Corrige drawer claro com tokens de superfície e contraste, preservando tema escuro.
- `52b2b60b8911a9eec4a63963dd3fbe57c3a0063b` — `src/app.ts` oferece edição de descrição/data/valor/categoria e exclusão de lançamento manual, com guarda de `linkedManualId`, formulário descartável, confirmação, validação e persistência antes de fechar. `SingleDatePicker` respeita `disabled`. Novos 13+11 testes e adaptação de `tests/transaction-category-edit.test.cjs`. Não altera arrays de extratos Pluggy.
- `64c0e47e98e9302a14b437bbc57ed1620d49630a` — paleta de categoria inicial no SQLite e frontend, preservando cores persistidas pelo `INSERT OR IGNORE`; teste de 3 casos criado para sementes e persistência.
- `aefdcf9c75794534971ee3b3465c59df77229a70` — catálogo de swatches sem roxos padrão e regressão de 4 casos corrigida para emoji permitido `🐶`, com editor HEX personalizado preservado.

## Integridade financeira e riscos evitados

1. `saveManualDetail` percorre **somente** `state.data.transactions` por ID. Mantém `id`, `kind`, `origin` e lançamentos não selecionados. Usa `parseMoney` em centavos seguros, data com `iso(fromISO())`, valida descrição/categoria e confirma persistência de `updateData` antes de fechar.
2. `isManualLinked` consulta vínculos do extrato (`linkedManualId`). Bloqueia excluir e alterar valor/data de lançamentos vinculados; mantém descrições/categorias editáveis para o usuário, mas não modifica extrato bancário original.
3. Paleta `DEFAULT_CATEGORIES` modifica apenas novos dados de seeds. `UPDATE categories SET color` não foi adicionado; registros existentes continuam inalterados. Emojis padrão/personalizados não são removidos.
4. Hover por componente e `@media(hover:hover) and (pointer:fine)` evita forçar gestos no touch. `prefers-reduced-motion` desliga transform/transition; o foco é visível. Cartões de alertas mantêm cor semântica.

## Testes executados — distinção de evidências

- **PASS (V8 com simulações): 24/24** callbacks versionados de `tests/d1-5-manual-edit.test.cjs` (13: editar todos campos, data inválida, zero/negativo, vínculo bancário, exclusão confirmada, falha de gravação etc.) e `tests/d1-5-interactions.test.cjs` (11: CSS carregado, 8 áreas, tokens, contraste, foco, redução de movimento, SVG sem hex, picker desabilitado). Foram exercitados textos exatos dos blobs GitHub com `node:test`/`fs` simulados no V8 do conector. **Não é `node --test` real.**
- **PASS (V8 renderer sintético):** extraído o método `renderDetailDrawer` atual, removendo somente anotações TS e non-null para parsing V8; foi instanciado com uma movimentação fictícia, confirmando renderização de botões de salvar, cancelar e excluir. Não é screenshot Electron.
- **Não executados:** `npm run test:types`, `npm run test:db`, `npm run compile`, `npm run test:asar`, F08, testes nativos de persistência SQLite dos novos 4 cenários, smoke Electron e 32 imagens reais, hover keyboard/pointer no Windows, NSIS/Portable, SHA256.txt. **Motivo:** ambiente sem checkout privado em disco nem DNS GitHub no terminal; GitHub connector consegue versionar, mas não fornece Electron GUI instalado. O histórico da beta.8 pai teve Linux+Windows SUCCESS; isso não atesta esta branch D1.5.

## Próximas ações e rollback

Revisar PR #36; checkout com Node 22.23.4, npm 10.9.9, TypeScript 5.8.3, executar suíte oficial e resolver regressões reais sem reduzir exigências. Testar todos os cards em tema claro/escuro, duas resoluções e reduced motion, antes/durante/após hover e teclado; o SVG com tooltips, drawers e persistência com dados sintéticos. Não alterar banco pessoal em testes; usar perfil isolado, backup validado. Após aprovação, fazer merge **apenas na staging** com Arquiteto, e **uma** pipeline Linux→Windows para entregar EXEs e hashes. Se falhar, rollback revertendo os commits exclusivos da D1.5; dados existentes não foram migrados.
