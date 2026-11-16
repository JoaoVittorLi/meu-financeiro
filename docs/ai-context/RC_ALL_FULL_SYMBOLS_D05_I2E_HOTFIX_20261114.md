# RC-ALL-FULL — Hotfix dirigido: símbolos do bundle, I2-E e FK legadas (14/11/2026)

**Branch:** `integration/mf2-rc-all-01-i2a-20261113`; **PR único:** #76 (Draft).  
**Situação:** CORREÇÕES VERSIONADAS / QA OFICIAL PENDENTE / NO-GO EXE. Não executar CI, QA Windows, build, deploy, merge `main`, API paga ou escrita pessoal real.

## Diagnóstico e solução por falha relatada

| Falha | Causa-raiz no SHA anterior | Correção versionada | Regressão / prova |
|---|---|---|---|
| `mfD04Render` ausente em R3 | A VM do teste carregava apenas `src/intelligence-review.ts`; o D04 aprovado está em `src/intelligence-review-v11.ts`, na compilação única `module:none/outFile`. O teste R3 exercitava a delegação D04, embora seus controles esperados fossem do renderer legado | `tests/category-review-ui.test.cjs` executa o **verdadeiro `renderCategoryReviewLegacy`** para contratos R3; teste independente confere que `app/app.js` contém a delegação para o D04. A suíte `rc-all-01-ui` continua cobrindo D04 real | 11 casos no arquivo R3; sem exports fictícios |
| `mfV3Requested` ausente no harness financeiro | `tests/financial-intelligence-ui.test.cjs` concatenava fontes sem `intelligence-v3-core.ts`; chamadas reais ao roteador visual acessavam nome inexistente na VM | Harness compila também as fontes V3 reais. `src/intelligence-local.ts` não converte uma consulta SQLite legada em visual indisponível quando não existe endpoint operacional | Quatro casos no arquivo financeiro + testagem independente do bundle em `rc-all-full-build-symbols` |
| `IC2ReadQueryGateway` ausente no restore | `tests/intelligence-recovery.test.cjs` extraía um trecho enorme do MAIN incluindo D05 e classes externas mas não fornecia as dependências importadas na VM | Extração limitada à função real `bindLocalFinancialServices`; VM recebe a classe **real** `IC2ReadQueryGateway` e o gateway RC, verifica rebind após restore | Quatro combinações originais sintético/recuperado preservadas |
| `renderMfD03Today` ausente e `resolve` indefinido | Harness R1/R2 compilava só `intelligence-view.ts`, omitindo D03 e V3. A exceção antecipada impedia chamar o endpoint simulado, deixando `resolve` sem callback | `tests/intelligence-premium-ui.test.cjs` inclui implementações reais D03/V3; testes R1 verificam prioridades verificadas e não os 8 tiles antigos; R2 avalia leitura sem request de visual V3 | 12 cenários R1/R2; nenhuma implementação de desenho simulada |
| Padrão `this.personal=new IntelligenceCategoryBridge` obsoleto | I2-E passou corretamente a envolver I2-D e I2-B com `EvidenceQualityBridge` | `tests/rc-all-01-categories.test.cjs` confirma composição runtime B→D→E, com uma instância compartilhada de `CategoryProposalService` | Nove cenários no arquivo; não reverter gate de qualidade |
| I2-E sempre `review_required` | `unresolvedHierarchy` retornava verdadeiro pela mera existência da tabela D05 `subcategories`, destruindo resultados válidos de evidência I2-E e impedindo `ready/stale/proposed` | `electron/intelligence-category-quality.cjs`: avalia correções humanas, duplicatas, regras e recência independentemente do formato do destino; marca `requiresD05Resolution` e `personalWriteAuthorized:false`. `RCCategoryGateway.personalCall` nega `qualityDraft/Compose` pessoais sem `categoryId,subcategoryId` explícitos; não remove motivos de conflito | 23 casos I2-E preservados com D05 adicional: evidência elegível sem autorização de escrita, stale real e composição read-only; regressão RC bloqueia targets planos |
| Drawer compact rejeitado | Teste exigia literal exato de duas classes, mas a D01 acrescentou `mf-d01` à combinação legítima | `tests/v1-2-layout-integrity.test.cjs` verifica no **aside real** os tokens CSS `mf-ai-drawer` + `mf-ai-drawer-compact`, permitindo classes semânticas adicionais | Oito cenários V1.2 preservados |
| FK de categoria para `categories_old` | Um rename de tabela SQLite pré-D05 deixou referências em child tables; erro puro bloqueava bancos históricos legítimos | `electron/d05-hierarchy.cjs`: identifica FK antiga por PRAGMA, reconstrói **tabela filha real** em `BEGIN IMMEDIATE`, preserva registros, índices, triggers e nomes; muda `REFERENCES categories_old` para `REFERENCES categories`. Só suspende `foreign_keys` durante reconstrução, executa `PRAGMA foreign_key_check` para TODOS os dados antes do COMMIT e restaura ON inclusive após erro em BEGIN; FK sem pai real causa rollback (sem inventar tabela pai) | `tests/d05-e1-hierarchy.test.cjs`: 9 testes incluindo 630 lançamentos, regras, index, trigger, idempotência, FK irrecuperável e lock de escritor. Mecânica SQLite validada também em Node 22.16.0 local isolado |

## Fronteiras de segurança que permanecem obrigatórias

- **I2-E**: `qualityStatus='eligible_for_preview'` indica **qualidade da evidência**, não autorização para mutar banco ou inferir categoria filha. Fluxo pessoal no MAIN exige destino D05 `{categoryId,subcategoryId:string|null}` explicitamente selecionado e resolvido; conflito/stale/duplicidade persistem como bloqueio.
- **I2-C e gateway pessoal D05**: não alterados neste hotfix. `approvedForPersonal:()=>false` continua ativo no MAIN. Nenhum `confirm` pessoal real é liberado; os recibos e backups são apenas dos testes sintéticos autorizados.
- **Migration**: nenhuma tabela `categories_old` fabricada, nenhum `DROP` de categoria pai, nenhuma perda intencional de regras, saldos ou subcategorias aprovadas (14×61). Em FK com referência que não existe em `categories`, a recuperação aborta e mantém banco antigo para reparação dirigida.
- **Compatibilidade**: a compilação real usa `tsconfig.json` `module:none/outFile:app/app.js`; funções não precisam ser exportadas globalmente em CommonJS. Testes isolados devem carregar seus módulos verdadeiros ou exercitar explicitamente o renderer legado, nunca inventar símbolos.

## Evidências executadas (não confundir com homologação)

1. GitHub: SHA atual e arquivos commitados no PR #76, test cases versionados.
2. Parser ECMAScript V8 isolado de todos os módulos CJS alterados e das suítes consultadas: **PASS sintático**.
3. SQLite **real local Node 22.16.0 (subconjunto representativo, não o repositório)**: reconstrução de `category_rules` referindo `categories_old`, preservação de row/index/trigger, `foreign_key_check=0`; caso de `BEGIN IMMEDIATE` bloqueado com `foreign_keys` restaurado para 1. **PASS somente desses cenários pontuais**.
4. `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, F08/proveniência, `npm run test:asar` no Node **22.23.4**: **NOT_RUN neste ambiente** (sem checkout completo nem acesso autenticado ao CircleCI).
5. CircleCI do novo SHA: **NOT_RUN**. Falha comprovada somente do SHA anterior (`25621fb002cc95c212cd12ff48996f92ba8483a7`), job [CircleCI #659806d7-dddc-435e-a466-e6c651555dd3](https://app.circleci.com/workflow/523c4484-68d3-4dff-88b9-bb7f6236efcb/job/659806d7-dddc-435e-a466-e6c651555dd3).

## GATE E GO/NO-GO

- **Código corrigido** para os oito grupos relatados. A ausência de CI não permite declarar **ZERO BUGS**, **HOTFIX READY** conforme critério do proprietário nem **LINUX GATE PASS**.
- **NO-GO** para Windows QA, release pessoal e EXE até `test:types`, `test:db`, compile/proveniência/ASAR + pipeline Linux SUCCESS no SHA correto.
- Primeira execução Linux **somente pelo proprietário** na branch `integration/mf2-rc-all-01-i2a-20261113`, HEAD corrente do PR #76:
  ```yaml
  run_preflight: true
  run_windows_qa: false
  run_windows_build: false
  ```
- Retornar pipeline URL, `CIRCLE_SHA1`, resumo por etapa e logs integrais em caso de falha. Corrigir apenas falhas comprovadas na mesma branch. Issue #74 permanece aberta; PR #82 documental continua Draft sem merge `main`.
