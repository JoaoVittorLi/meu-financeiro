# MEU FINANCEIRO 2.0 — D05 E1/E2 | Handoff de integração (14/11/2026)

**PR de código:** #81 (Draft) · **base:** PR #76 / `545ac5e00199ad4969c69b76e433f17f242ad44e` · **issue:** #74 · **coordenação:** #49.

## Código realmente incorporado à branch do PR #81

- `electron/d05-taxonomy.json`: catálogo integral aprovado 14×61.
- `electron/d05-hierarchy.cjs`: migração SQLite idempotente e transacional, schema v7, chaves estáveis, índices/FKs, triggers contra vínculo cruzado, registro legado sem filho, proteção de catálogo.
- `electron/db.cjs`: boot de migração com cópia `.d05-before-v7.sqlite` para bancos existentes; transações manuais com `categoryId` e `subcategoryId` validados atomicamente no save; fluxo legacy preserva filho se pai igual, limpa se trocado; suporte a `save(...,{inTransaction:true})` apenas para restauração coordenada.
- `electron/planning.cjs`: migra `planned_items`; `PlanningStore.create/edit` aceita `target:{categoryId,subcategoryId|null}` atômico e preserva métodos legados.
- `electron/d05-category-service.cjs`: `D05CategoryService` com catálogo, resolver, CRUD, previews de exclusão/movimentação de filhos customizados, classificação manual/banco, lote bancário com digest stale, splits em centavos, regras com preview e precedência, Planejamento, leitura/agrupamento hierárquicos, JSON portátil para **perfil manual** (não substitui backup SQLite completo) e fachada de leitura IA com autorizador obrigatório.
- `electron/d05-ipc-adapter.cjs`: canais explícitos D05 para integração futura pelo MAIN, **não instalados automaticamente**. Exige injeção obrigatória de `requireAppSender`, `authorizeRead`, `authorizeWrite` antes de qualquer handler.
- `tests/d05-e1-hierarchy.test.cjs`, `tests/d05-e2-category-service.test.cjs`: testes versionados 630 movimentos sintéticos, CRUD, migração/restore, lote stale, rules, splits, PlanningStore, JSON/manual backup, autorização IPC e rejeições.

## Contrato D05/CATEGORY-TARGET-V1

Entrada estrita: `{categoryId: string, subcategoryId: string|null}`. `subcategoryId` é sempre opcional/nulo. O serviço rejeita ID inexistente, inativo ou filho de outro pai; nenhuma atribuição retroativa, nenhuma dedução automática de filho pela descrição/merchant. Categorias antigas por nome continuam apenas para back-compat; não gerar IDs via LLM.

### Integração IPC (responsabilidade exclusiva do Integrador)

1. Instanciar `installD05Ipc({ipcMain,finance:db,requireAppSender,authorizeRead,authorizeWrite})` em `electron/main.cjs` **somente após validar dono da sessão, conta ativa, permissões e o gesto humano**. Não aceitar `owner`, `grant`, `approved` ou `activeAccountId` de texto da IA.
2. Expor explicitamente no preload apenas handlers autorizados, sem canal genérico. Mapear catálogos, extrato manual/banco, previews, CRUD, regras, splits e Planejamento na UI D05.
3. Para escritas em perfil pessoal, exigir backup SQLite validado, prévia íntegra onde aplicável, confirmação pelo host, escopo por perfil/conta, reconfirmação contra dados stale e recibo verdadeiro. A biblioteca E2 **não ativa escrita de IA** e não fornece esses gates host-side.
4. O adaptador publica contrato e exige hooks, mas **nenhum `main.cjs`/`preload.cjs` foi alterado por este Executor**; não tratar os IPCs como ativos ou testados no Electron.
5. Para IC-READ/I2-B/C/D/E, montar `new D05CategoryService(db).asReadOnlyFacade({authorize: trustedScopeCheck})`, com owner e concessão conferidos pelo Integrador. Não injetar `FinanceDB` bruto nem `D05CategoryService` mutável na ponte IA. Manter I2-E fail-closed enquanto o resolvedor não estiver formalmente conectado e auditado.
6. Origem bancária Pluggy permanece imutável. Overrides/splits gravados em tabelas locais; `POSTED/PENDING` e revisão são estados distintos; transfer/ignore fora de entradas/saídas, mas presentes no histórico. Consultas bancárias que usam a visão existente de até 2.500 movimentos retornam `truncated`; não afirmar completude quando true.
7. Backup JSON D05 é para perfil **manual** com customizações da hierarquia e restauração atômica; usar os backups SQLite existentes para banco, regras, planejamento e consistência integral. Não ativar sync cloud sem contrato de versão entre apps.

## DESIGN D05 V1.3 — APROVADO

A issue #70 agora registra `DESIGN_APPROVED / IMPLEMENTATION_READY` para a tela inteira. O E3 está liberado: implementar a tela real respeitando protótipo/spec do PR #57, 67 SVGs, interação por ícone, seleção circular, microindicador de revisão, agrupamento por dia, dark/light e QA Electron. **E3 ainda não foi codificado nesta frente.**

## QA honesto

- PASS: recuperação de arquivos exatos do GitHub, parsing sintático V8 da migração/serviços/adapter/DB/PlanningStore/testes; inspeção estática do catálogo 14×61.
- Evidência local anterior: testes Node 22.16 isolados para partes de E1 (não substituem checkout do PR).
- **NOT_RUN:** os testes versionados E1/E2 em Node 22.23.4, suíte completa Node/SQLite, TypeScript/compile, integração IPC Electron, screenshots, CircleCI, Windows.
- Status: `E1 CODE_PUBLISHED / QA_PENDING`, `E2 CODE_PUBLISHED / IPC_INTEGRATION_PENDING / QA_PENDING`, `E3 DESIGN_APPROVED / ENGINEERING_PENDING`.
- Nenhum merge, deploy, pipeline, EXE, escrita pessoal por IA ou dados do proprietário utilizados.

## Gates para o Integrador

Rebase/merge seletivo **somente no PR #76**, não em `main`; verificação de conflitos `electron/db.cjs`, `electron/planning.cjs`, `main.cjs`, `preload.cjs` e I2-D/E. Rodar `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, F08/ASAR e Electron no mesmo HEAD consolidado. CircleCI e Windows dependem de autorização do proprietário; não declarar qualquer teste não executado como PASS.
