# MEU FINANCEIRO 2.0 — Revisão do Arquiteto: U5.1.1 e U5.2

**Data:** 11/11/2026 · **Status:** revisão dirigida concluída, **homologação oficial pendente**.  
**Owner:** Arquiteto. **Decisão:** não executar CircleCI Windows, não gerar binário, não integrar `main` nem Cloudflare; proprietário deseja mais atualizações e validação antes do próximo EXE.

## Estado confirmado dos PRs

| PR | Entrega | HEAD conferido | Base |
|---|---|---|---|
| [#31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31) | Staging beta.8 | `d513c2be3f9b0cd018aed0b71f46ce8747a6556c` | D1.2 |
| [#36](https://github.com/JoaoVittorLi/meu-financeiro/pull/36) | D1.5.1, P1-01/02, Premium | `87fb449c0232d80aebd7c50ad547197e34d3c806` | #31 |
| [#37](https://github.com/JoaoVittorLi/meu-financeiro/pull/37) | U5.1.1, Movimentações | `5a4963133795182e5d73344c1ad6df0a78fa0bfb` | #36 |
| [#38](https://github.com/JoaoVittorLi/meu-financeiro/pull/38) | U5.2, Planejamento + Simular | `acad34635e81e485042002a8d28ba9c3a6f34003` | #37 |

PRs #36/37/38 permanecem drafts, sem merge. Com `compare_commits(5a496313, acad34635)`: **ahead 2, behind 0**, 11 arquivos no PR #38, sem conflitos de branch verificados; não representa validação de execução.

## U5.1.1 — Parecer positivo para fase de testes

No PR #37, `quickCategoryContext()` passou a usar `effectiveNature(tx)` para natureza bancária, impedindo seleção incoerente de categoria; `transfer/ignore` exigem revisão explícita. Histórico parcial de mais de 2500 registros é anunciado ao lado dos resumos/contagens; teste SQLite com 2501 transações foi **criado, ainda não executado**. Sem alteração do bruto bancário. **Status:** código revisto; suites integrais pendentes.

## U5.2 — Duas correções dirigidas

**P1-U52-01: resultado stale pode criar compromisso incorreto.** Após `setSimulation()`, a UI mantém `outcome` antigo com aviso, o que é o comportamento visual desejado. Porém `renderResult(out)` ainda mostra o botão `Planejar esta compra` com `disabled` apenas se `out.installments>36` e `planSimulatedPurchase()` não valida `isSimulationStale()`, `simBusy`, `simError` ou `simCalculatedInput` versus `sim`. Assim valor antigo pode preencher o planejamento após alteração não recalculada. **Obrigatório:** bloquear a ação na UI e no método, validar input snapshot e resposta, incluir testes de stale, falha, corrida e sucesso apenas após recálculo.

**P2-U52-02: calendário diário ignora natureza explícita bancária.** `pFilterTransactions()` em `src/plan-view.ts` calcula `kind` bancário exclusivamente pelo sinal; `pCalendarDayInfo()` soma por kind. Registros `nature:'income'` com valor negativo, `nature:'expense'` com valor positivo, `nature:'transfer'` ou `'ignore'` podem produzir entradas/saídas divergentes de Movimentações. **Obrigatório:** aplicar regra coerente com `effectiveNature()`, sem alterar os fatos bancários nem motores, decidir representação de transfer/ignore e testar fixtures das quatro naturezas, com alinhamento à contabilidade do app.

**Classificação:** um bloqueio funcional crítico de qualidade financeira de fluxo; outro de coerência de apresentação. Não foi comprovada regressão de guarda SQLite, erro de sintaxe TypeScript ou crash Electron sem testes oficiais.

## Testes e evidências

Executor reporta **6/6 U5.1.1** e **11/11 U5.2** em V8 com dados sintéticos. U5.2 escreveu **7 testes de Planejamento + 10 de Simulador** para test runner Node, mas não executou checkout integral. Não converter 11/11 V8 em 17/17 oficiais.

O ambiente de revisão tem `git`, `node v22.16.0`, `npm 10.9.2`, `tsc 5.8.3`, porém **não existe checkout integral** e DNS `github.com` indisponível. O projeto fixa `node v22.23.4` e `npm 10.9.9`. Não é possível executar `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar` nem Electron GUI **sobre o HEAD oficial** neste ambiente. Não chamar o resultado de homologado. GitHub combined-status dos dois HEADs não trouxe checks registrados.

**Gate em checkout correto, a executar na sequência quando existir ambiente:** `npm ci --no-audit --no-fund`; `npm run test:types`; `npm run test:db`; `npm run compile`; `node scripts/renderer-provenance.cjs check-bundle`; `npm run test:asar`; Electron synthetic smoke de 8 áreas/32 capturas (se disponível) e manual visual 1366×768/1920×1080 claro/escuro, reinicialização/persistência/backup/conciliado e cenários stale/categoria. O QA Windows real e empacotamento permanecem para etapa posterior autorizada. Um preflight Linux-only no CircleCI é tecnicamente separado de Windows; não foi disparado nesta revisão.

## Prioridades e responsabilidades

1. **Executor 2 imediato — U5.2.1:** corrigir P1-U52-01 e P2-U52-02 *no PR #38*, com testes novos/atualizados e log, sem nova feature. Manter PR #37 / #36 intactos. Testar em Node pin e checkout quando houver. Sem U5.3/F1 antes de resolver P1 e gates oficiais.
2. **Argon paralelo — I1-B:** continuar somente em módulos próprios `src/intelligence-view.ts`, `src/intelligence-integration.ts`, `app/intelligence.css` e novos serviços, baseado no pacote I1-A.2 validado; ainda precisa publicar branch/PR. Não modificar `src/app.ts` ou `electron/db.cjs` do Executor. Foco em histórico compartilhado/persistente e UI Premium.
3. **Arquiteto:** revisar patch da U5.2.1, coordenar contrato `effectiveNature` comum sem tocar arquivos simultaneamente, verificar gates e integrar na ordem **#36 → #37 → #38** somente quando permitido.
4. **Próxima prioridade de produto após gates:** U5.3 (Orçamentos/Configurações) ou checkpoint de avaliação Windows após permissão do proprietário; não aumentar backlog técnico sem medir riscos. A IA avançará I1-C depois da I1-B verificada.

**Checkpoints públicos de revisão:** [PR #37](https://github.com/JoaoVittorLi/meu-financeiro/pull/37#issuecomment-6799161274) e [PR #38](https://github.com/JoaoVittorLi/meu-financeiro/pull/38#issuecomment-6799162291).
