# D05-SUBCAT — Contrato de implementação REAL · Hierarquia categoria → subcategoria

> **Situação:** `DESIGN_PROPOSAL / ENGINEERING_REQUIRED`. Este documento é uma **especificação executável para o Executor**, não alegação de alteração do produto. O protótipo visual e a taxonomia NÃO implementam persistência por si só. Issue bloqueante de engenharia: [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74); design ainda em revisão: [#70](https://github.com/JoaoVittorLi/meu-financeiro/issues/70).

## 0. Requisito inegociável do proprietário

“Criar ícones para novas subcategorias, vinculadas às categorias, e documentar que as subcategorias precisam ser devidamente mapeadas e criadas **no código além do design**.”

**Definição de concluído:** a subcategoria existe no SQLite, pode ser criada/editada/reordenada/excluída com proteção; a movimentação manual/bancária/regras/splits podem apontar para ela sem perder pai; filtros/visões/IA a leem; backup/migrações/QA passam. Prototipagem ou CSS isolados **não concluem** a funcionalidade.

## 1. Auditoria da baseline de código (PR #54, HEAD histórico `55de81c`)

| Arquivo / contrato | Situação confirmada na branch consultada |
|---|---|
| `electron/db.cjs` | `categories` com **name PK** e colunas color, built_in, emoji, kind; **sem `subcategories`**. |
| `transactions` | `profile,id,category` com categoria texto, sem campo de filho. |
| `budgets` | `profile,category,amount_cents` — orçamento por categoria-pai. |
| `bank_transactions` | lançamentos bancários com categorias de provedor, status, chave composta account_id/external_id. Não escrever na fonte do provedor. |
| `bank_category_overrides` | override do usuário em categoria pelo nome, sem filho. |
| `bank_transaction_splits` | divisão por categoria e centavos, sem filho. |
| `category_rules` | destino `category TEXT` referenciando categorias; sem subcategoria. |
| `planned_items` | tabela opcional que é atualizada na renomeação de categoria; também requer integração. |
| `electron/preload.cjs` / `electron/main.cjs` | `categories:save`, `rules:save`, `bank:categorize`, `bank:batch`, `bank:split`; sem endpoint de subcategoria nessa baseline. |
| `src/app.ts` | `CategoryInfo` e `RuleInfo` planas com nome/cor/`emoji`; `EMOJI_OPTIONS` gera Unicode do sistema. |
| `electron/category-review.cjs` | prévias e confirmação de regras/labels supervisionadas com IDs/versionamentos; extensão é obrigatória sem afrouxar o contrato. |

**Limite factual:** a auditoria foi da branch/PR #54 de referência. Pull requests paralelos podem mudar os HEADs; Executor deve verificar HEADs atuais antes de criar migration e inspecionar PRs posteriores relevantes.

## 2. Taxonomia aprovada apenas como proposta visual

[SUBCATEGORY_TAXONOMY_V1.json](SUBCATEGORY_TAXONOMY_V1.json) tem **14 categorias-pai e 61 subcategorias sugeridas**, com `id`, `parentId`, `name`, `iconKey` e `hue`. As 14 categorias refletem a família padrão do código (`Moradia`, `Alimentação`, `Transporte`, `Saúde`, `Lazer`, `Educação`, `Assinaturas`, `Compras`, `Contas`, `Outros`, `Salário`, `Transferências`, `Rendimentos`, `Reembolsos`). **Nomes/filhos propostos precisam de aceite visual/produto; nenhum registro real deve ser reclassificado automaticamente.**

Níveis: `Categoria → Subcategoria → Movimentação` (2 níveis taxonômicos, sem netos); pai é obrigatório, subcategoria é **opcional** nos registros. “Sem subcategoria” é o valor **null** ou um agrupamento de UI, e **não** um filho com ID artificial. Na categoria Outros, **Pequenas despesas** é uma subcategoria real. **Sem subcategoria** é um estado virtual de agrupamento para `subcategory_id IS NULL` — nunca criar ID de filho fictício.

## 3. Modelo de IDs (não usar nomes como chave de identidade)

```ts
type ParentCategory = {
  id: string; name: string; kind:'income'|'expense'|'both';
  iconKey: string; baseHue: number; builtIn:boolean; profileScope: 'shared'|'real'|'demo';
};
type Subcategory = {
  id: string; parentCategoryId: string; name: string;
  normalizedName:string; iconKey:string; hue:number; order:number;
  builtIn:boolean; active:boolean; profileScope:'shared'|'real'|'demo';
};
type CategoryTarget = {categoryId:string; subcategoryId:string|null};
type AllocationPart = {categoryId:string; subcategoryId:string|null; amountCents:number};
```

Os IDs de fábrica podem usar `cat:alimentacao`, `sub:alimentacao/delivery`; IDs de usuário: UUID/ULID gerados uma única vez e estáveis. Alterar nome, ícone, cor ou pai **não altera ID**; mover filho para outro pai exige confirmação e reconciliação de referências. Nomes iguais entre pais diferentes podem ser permitidos; dentro do mesmo pai + escopo, `normalizedName` deve ser exclusivo, inclusive variações de acento/case.

**Ponto de decisão técnico importante:** a tabela `categories` atual é global enquanto as movimentações manuais são por `profile`. Não assumir que categorias custom podem circular entre `real` e `demo`. Definir/adotar política `profileScope` explicitamente para evitar compartilhamento involuntário. Nunca misturar movimentos de um perfil em outro.

## 4. Plano de migração SQLite — obrigatório

### 4.1 Fase aditiva segura

1. Executar backup verificável e escrever versão de migração em `app_meta` ou migrator existente. Transação `BEGIN IMMEDIATE` / `COMMIT`; rollback em falha.
2. Criar `category_id` nullable em `categories`, backfill 1:1 de nomes existentes para IDs estáveis, índice `UNIQUE` (após backfill). **Não trocar imediatamente PK por nome**, pois FKs antigas dependem dela.
3. Criar tabela `subcategories` com `id TEXT PRIMARY KEY`, `parent_category_id TEXT NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT`, `name`, `normalized_name`, `icon_key`, `hue`, `profile_scope`, `built_in`, `active`, `sort_order`, `created_at`, `updated_at` e `UNIQUE(parent_category_id,profile_scope,normalized_name)`. Respeitar suporte SQLite/Node 22 e FKs ON.
4. Criar referências **nullable** para filho: `transactions.subcategory_id`, `category_rules.subcategory_id`, `bank_transaction_splits.subcategory_id`, `planned_items.subcategory_id` onde cabível. Para banco, preferir `bank_subcategory_overrides(account_id,external_id,subcategory_id)` referenciando `bank_transactions` sem alterar valores/categorias vindos do Pluggy.
5. Backfill **somente** das definições padrão de pais/filhos como catálogo; todos os lançamentos anteriores ficam com `subcategory_id=NULL`. Não inferir “iFood → Delivery” retroativamente sem prévia e ação explícita.
6. Manter `category` legado como campo de compatibilidade durante transição; toda gravação nova deve passar por validador de pai/filho para não introduzir drift.
7. Se o app sincroniza com Cloudflare/PWA, negociar `schemaVersion`, payload e downgrade/forward-compatibility com integrador; não publicar mobile/PWA parcialmente incompatível.

### 4.2 Integridade e mudança

- Regra no serviço: `SELECT parent_category_id FROM subcategories WHERE id=?` deve coincidir com categoria alvo; rejeitar órfãos, filhos inativos, scope errado ou pai incompatível.
- Rename de pai não altera `category_id`; rename do filho não altera `subcategory_id`.
- Não deletar pai com filhos ou referências; deletar filho com lançamentos, regras ou orçamentos exige política explícita: **reatribuir sob preview** ou bloquear. Nunca `ON DELETE CASCADE` para apagar silenciosamente histórico.
- Manter campos/índices históricos durante rollout de compatibilidade; prova de backup/restore antes de remover qualquer coluna.

## 5. Operações atômicas e contratos IPC

Novos métodos **propostos** (nomes a harmonizar com código real): `subcategories:list`, `subcategories:create`, `subcategories:update`, `subcategories:move`, `subcategories:delete`, `bank:categorize-target`, `manual:categorize-target`, `rules:save-target`, `bank:split-targets`.

- Renderer nunca manda SQL; `requireAppSender` e validações de shape/perfil/tipo executadas no main.
- `categorySave` e `ruleSave` antigos permanecem compatíveis; novos métodos usam `{categoryId,subcategoryId|null}`.
- Trocar pai sem filho compatível deve mostrar “Escolha uma subcategoria” ou explicitamente limpar o filho; **nunca** manter `subcategoryId` de outro pai.
- Categorização manual/IA: `prepare → previewVersion → reconfirmação → apply por backend autorizado → receipt`. A UI de D05 nunca bypassa D01 V4.5/D04.
- Regras futuras usam prioridade, match mode, scope e IDs; categoria mãe deriva do filho quando aplicável. Regras sobre status `PENDING` não devem duplicar `POSTED`, e `transfer/ignore` continuam fora de entradas/saídas.
- Splits: cada parte `{categoryId,subcategoryId|null,amountCents}`; soma deve ser exatamente o valor absoluto da despesa em centavos. Totais por pai = soma dos filhos + `Sem subcategoria` do pai.
- Orçamentos: inicialmente manter teto no pai (compatibilidade); habilitar orçamento filho apenas se houver contrato que **não some limites de filho como dinheiro extra**. Gráfico drill-down pai/filho usa mesmo universo sem dupla contagem.

## 6. Onde o Executor **deve implementar** (matriz)

| Componente | Alteração obrigatória |
|---|---|
| `electron/db.cjs` | schema + migrator + CRUD + links + somas + rename/delete seguro |
| `electron/main.cjs`, `electron/preload.cjs` | IPCs tipados e validações no main, somente renderer legítimo |
| `electron/category-review.cjs` | preview/affected/confirm de regra com filho, revisão de stale e escopo |
| `src/app.ts` | `CategoryInfo`, `RuleInfo`, modelos de transação/edição e seletor hierárquico |
| `app/movements-productivity.css`, `app/operations.css`, design tokens | layout premium de chips/filtros hierárquicos e fundos tonais |
| `src/intelligence-view.ts` e handlers IA | leitura e propostas por pai+filho, sem escrita pessoal implícita |
| `electron/planning.cjs` / Planejamento | pai/filho nos compromissos, projeções sem dupla contagem |
| `src/app.ts` / Orçamentos, Simulador, Overview | agrega filhos corretamente sob pai, drill-down isolado |
| `mobile-push/src/*` e `shared/*` | compatibilidade/versionamento, se sincronização ativa contemplar taxonomia |
| `tests/categories.test.cjs`, `tests/sqlite.test.cjs`, `tests/d1-2-category-rename-links.test.cjs`, testes novos | migração/CRUD/rename/rules/splits/backup/isolamento de perfil |

## 7. Gate de testes reproduzível

**Sem nenhum dado pessoal do usuário.** Criar DB legado sintético com 630+ transações, overrides, links, splits, rules, budgets, planned items e dois perfis. Executar migrator duas vezes e confirmar:
- IDs antigos + contagens/totalizações permanecem iguais; todas atribuições históricas de filho null.
- Renomear categoria e filho não altera vínculo por ID nem totais.
- Excluir filho em uso é bloqueado ou exige remap explícito; pai com filhos não pode ser deletado de forma silenciosa.
- Mesmo nome de sub em pais diferentes válido; duplicidade por caixa/acentuação dentro do pai bloqueada.
- `subcategoryId` fora do pai rejeitado em TODOS os caminhos: manual, banco, rule, batch, split e planejamento.
- Filtrar categoria-pai retorna todos filhos mais transações sem filho; filtrar filho retorna apenas ele; transfer/ignore, PENDING/POSTED, sync e reconciliação sem regressão.
- Restore de backup e sync com versões antigas/novas preservam integridade.
- No aplicativo Electron real, evidências dark/light em 1366×768 e 1920×1080, fonte e família iconográfica coerentes, teclado/foco e reduced-motion.

## 8. Gates e permissões

`IC-READ` é leitura limitada; `IC-REVIEW` segue isolado/sintético; `IC-CATS`, `IC-RULES`, `IC-MOVE` continuam governando alterações manuais/supervisionadas. A nova taxonomia não autoriza IA a gravar categorias ou subcategorias na conta real sem contrato de apply verificado.

**Critério de fechamento da issue [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74):** PR de **código funcional com migração + IPC + leitura/escrita permitidas + UI integrada + testes reais e evidência Electron**, não apenas artefato de design. Owner executa CircleCI quando Integrador fornecer branch, SHA, flags e resultados esperados; não lançar preflight pago por conta própria. Não integrar main nem gerar EXE sem autorização de release.
