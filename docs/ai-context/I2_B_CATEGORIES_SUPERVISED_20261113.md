# MF2 — I2-B | Categorias, regras e ações supervisionadas

**Missão:** #72. **Base:** PR #64, SHA `da117ce1145a748b653144c7f328145b71798e0e`.
**Branch:** `feat/mf2-i2b-categories-supervised-20261113`.
**Status:** CODE_DELIVERED / BACKEND_ISOLATED / NOT_HOMOLOGATED / IPC_NOT_CONNECTED.
**Ownership:** somente novos módulos electron/intelligence-category-*.cjs + teste e documentação. I2-A intacta. Não altera src/, app/, main.cjs, preload.cjs ou renderer.

## B1 — Leitura e propostas

`electron/intelligence-category-proposals.cjs` usa o IC-READ já existente para validar grant, owner, fonte, perfil e mês, depois reutiliza listCategories, dados e restrições de FinanceDB. Não existe outro cadastro de categorias.

Operações tipadas de B1:

- `category.list` e `category.analyze_usage` (via CategoryConversation): nomes, emojis, cores, tipos, regras, referências explícitas, candidatos sem uso e possíveis duplicatas de nome normalizado; resultados parciais sinalizados.
- `category.create`: nome, cor HEX, emoji validado pelo próprio módulo db.cjs, kind expense/income/both, colisões por normalização.
- `category.update`: nome anterior/novo, cor, emoji, tipo, categoria built-in, referências em transações/regras/orçamentos/planejamento, amostra de IDs e efeitos de renomeação. Renomear não faz migração implícita de categoria diferente; nome usado pelo provedor bancário bloqueia alteração potencialmente destrutiva.
- `category.delete`: bloqueia built-in, orçamentos, regras, transações, overrides, splits, planejamento e referências brutas do provedor. Exclusão não inclui migração em massa.
- `transaction.categorize`: IDs explícitos ou filtro de descrição, no máximo 100, data dentro do mês autorizado; rejeita PENDING, transfer/ignore, natureza incompatível, splits normais/desatualizados e overrides manuais sem opt-in de substituição explícito. Reclassificação não altera montantes, saldos ou natureza.
- `rule.create`: somente future-only, padrão exact, accountId e natureza explícitos; reutiliza `category_rule_constraints` do CategoryReviewService (account/nature/afterRowid), sem alterar histórico.
- `rule.update`, `rule.delete`: edição/exclusão apenas para regras supervisionadas com constraint; regras legadas não delimitadas ficam bloqueadas por poderem afetar histórico.
- `rule.inspect`: consulta pelo matchRule canônico; mostra IDs, valores e contagem da amostra local, precedência e limites de cobertura; não promete o resultado de um extrato completo.

Cada prévia devolve: proposalId, actionType, scope sem token, beforeVersion (SQLite total_changes), fingerprint, confirmationNonce, before/after, targetIds, affected, impact, conflicts, notes, requiredDependencies, expiresAt, status, capability e requiresExplicitConfirmation. Guardas B1 não gravam.

`electron/intelligence-category-conversation.cjs` oferece roteamento conservador por linguagem natural para exemplos simples. Perguntas vagas devolvem needs_clarification. Aceita planos tipados limitados a três ações; casos compostos de criação + reclassificação têm etapas independentes e a segunda espera a primeira confirmação. **Não existe LLM pessoal conectada nem parsing livre generalista homologado.**

## B2 — SQLite sintético isolado

`electron/intelligence-category-actions.cjs` usa diretamente FinanceDB.upsertCategory/deleteCategory/upsertRule/deleteRule/batchBankChanges/save, sem novo sistema de categoria. Requer:

1. Banco FinanceDB com filename literalmente `:memory:` (o perfil demo do banco pessoal não é um isolamento suficiente porque categorias são globais).
2. `syntheticProfile: true` e callback `authorizer` confiável injetado pelo host; sem ele o executor nem é criado.
3. Consentimento explícito `I2B_SYNTHETIC_WRITE_V1`, nonce da prévia, owner, token de leitura IC-READ, mesmo source/profile/month e prévia vigente.
4. Nova leitura autorizada e reconstrução determinística antes de executar; qualquer alteração em total_changes, fingerprint, seleção ou grant rejeita como stale.
5. Mutação por métodos FinanceDB e recibo em `i2b_synthetic_receipts`. Confirmação repetida com mesmo owner/escopo/nonce devolve recibo, não reaplica.

Para regras e batch bancário, a mutação e o recibo final ocorrem sob BEGIN IMMEDIATE/COMMIT, com ROLLBACK em falha. Para upsertCategory/deleteCategory/save, FinanceDB controla sua própria transação; o executor usa journal `prepared` antes da chamada e `applied` após. Se ocorrer interrupção nesse intervalo, o journal exige reconciliação explícita e NÃO pode ser reexecutado automaticamente. **Essa lacuna de atomicidade e o banco em memória impedem declarar durabilidade após reinício e bloquearão qualquer promoção a escrita pessoal.**

Recibo fornece before/after, IDs, impacto, confirmedBy, syntheticOnly e undoAvailable=false. Undo automático não está homologado; nenhuma remoção silenciosa é permitida. Não existe ação de IA conectada ao perfil pessoal nem à UI.

## Estados e contratos propostos ao Integrador

- `I2-B/CATEGORY-CATALOG-V1`: categorias + regras + estatística com escopo/fonte/cobertura.
- `I2-B/PROPOSAL-V1`: prévia editável, status ready/blocked, fingerprints, consentimento e desafio, fontes, IDs e impacto.
- `I2-B/RULE-IMPACT-V1`: evidência de matching, IDs, exclusões, cap de histórico, impacto atual/futuro.
- `I2-B/CHAT-PLANS-V1`: propostas separadas, dependências, needs_clarification, sem alterações aplicadas.
- Futuro IPC deve ser responsabilidade exclusiva do Integrador #65/#71, revalidar gesto de confirmação e identidade no MAIN; **não** usar diretamente categories:save/bank:categorize em nome do modelo.

## Evidências e testes

17 testes Node/SQLite reais foram adicionados a `tests/intelligence-i2b.test.cjs` e ainda **NÃO EXECUTADOS** no runtime oficial. Cobrem leitura, create/update/delete, regras futuras/edição/exclusão, seleção manual/banco, PENDING/transfer/split/override, reconhecimento textual, plano composto, nonce/owner, stale, revogação, idempotência, rejeição e inspeção de regra.

Smoke V8 isolado (módulos reais, FinanceDB e SQLite SUBSTITUÍDOS por dublês): 9/9 PASS antes das últimas ampliações (inspectRule, amostras de rename, mask de uso). Parsing de 6 frases reais do pedido: 6 resultados coerentes. Verificação de sintaxe JavaScript dos novos módulos: PASS. Isso NÃO comprova integridade SQLite, nem representa gates TypeScript/F08/ASAR/Electron.

Checkout externo bloqueado por resolução DNS de github.com; Node local é 22.16.0 / npm 10.9.2, diferentes dos valores fixados Node 22.23.4 / npm 10.9.9. Não foi executado npm ci, npm run test:db, TypeScript, compile, F08, ASAR, Electron nem Windows.

## Gates e próximos responsáveis

**Proprietário, se liberar preflight Linux CircleCI:** usar a branch e SHA finais deste PR, parâmetros `run_preflight=true`, `run_windows_qa=false`, `run_windows_build=false`. Esse workflow executa npm ci, test:types, test:db, compile, check-bundle, test:asar e verificações PWA. O Executor não dispara CI.

**Integrador:** revisar conflitos com I2-A #64 e interfaces D01/D04 #60/#63/#68, testar contrato proposto, não colocar I2-B no RC-ALL-01 sem homologação e confirmação específica. Nenhum merge main, EXE, API paga, Production ou escrita pessoal.

**Limites intencionais:** no-op de regra pause/disable, merges em massa, migração de categorias, Undo durável e criação automática de regras históricas estão indisponíveis até adaptador seguro. Sem ChatGPT Plus como cota API.