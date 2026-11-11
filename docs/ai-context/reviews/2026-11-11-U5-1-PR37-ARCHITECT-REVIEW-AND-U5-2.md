# Meu Financeiro 2.0 — Checkpoint arquitetural U5.1 (PR #37) e missão U5.2

**Data:** 11/11/2026 · **Natureza:** review dirigido e autorização de testes oficiais, **sem homologação e sem build Windows**.  
**Repositório:** `JoaoVittorLi/meu-financeiro`. **U5.1:** PR #37 draft / `feat/mf2-u5-1-movements-productivity-20261111` / HEAD verificado `d3455505cedd1f6b40d7ca71e89a299039baa6b4`. **Base:** PR #36 draft / `fix/mf2-d1-5-premium-interactions-20261111` / HEAD `87fb449c0232d80aebd7c50ad547197e34d3c806`. **Staging:** PR #31 draft.  
**Decisão do proprietário:** receber mais atualizações antes de gerar novo EXE. **Não acionar CircleCI Windows, não gerar instalador, não fazer merge para main nem deployment PWA.**

## 1. Parecer

**APROVADO COM RESSALVAS PARA TESTES OFICIAIS, NÃO PARA MERGE/HOMOLOGAÇÃO.** PR #37 tem **2 commits à frente da base, 0 atrás, 10 arquivos modificados**, todos no escopo de Movimentações/testes/docs; não modifica `electron/db.cjs`, módulos Argon, PWA, CI ou dados pessoais. Os arquivos `docs/ROADMAP_MF2.md`, `docs/ai-context/EXECUTOR_HANDOFF.md` e log U5.1 agora constam efetivamente no PR (corrige observação documental anterior do Arquiteto).

**Positivo, confirmado por diff e código:** categoria inline abre popover; busca compatível com acentos, Enter/setas/Escape e retorno de foco; manual via `updateData`; banco via override `bankCategorize({accountId,externalId,category})` que não altera extrato bruto; locks de duplo clique; busca + filtros combináveis/ordenadores + chips; CSS escopado e arquivo `app/index.html` atualizado. O drawer de detalhes fica acessível. Há 19 testes novos (6 de filtros, 9 de popover, 4 de `FinanceDB`); **nenhum foi executado no test runner oficial no novo HEAD**.

**Evidência limitada:** Executor relatou 12/12 cenários de filtro e 7/7 de popover em V8 com TypeScript adaptado e mocks; não é `npm run test:db`, Node pinado, compilação `tsc`, Electron GUI, F08/ASAR nem homologação Windows. `get_commit_combined_status` não retornou checks no HEAD. Não reutilizar green CI da beta.8 pai.

## 2. Duas verificações/correções dirigidas

### U5.1-P2-01 — coerência da natureza financeira entre filtros e popover
Em `src/app.ts`, `transactionViewRows()` usa `effectiveNature(bank)` para filtrar receitas/despesas (respeitando natureza manual `auto/income/expense/transfer/ignore`); `quickCategoryContext()` para lançamentos bancários atualmente deriva `kind` **somente do sinal** de `tx.amount`. Assim uma movimentação bancária de valor negativo marcada como natureza `income`, ou de valor positivo marcada `expense`, recebe opções de categoria diferentes da interpretação atual usada nos filtros/resumos.

**Ação:** adotar semântica consistente para casos `income/expense`, e desenhar comportamento explícito para `transfer/ignore` sem reclassificar a natureza financeira automaticamente; distinguir categoria vs. natureza, validar categoria compatível quando aplicável. Não alterar bruto Pluggy. Cobrir tests de banco negativo/nature income, positivo/nature expense, transfer, ignore, e preservar centavos e status.

### U5.1-P2-02 — resultados parciais em histórico longo
`electron/db.cjs` `bankOverview()` só carrega até **2.500** transações bancárias na lista `transactions`, mesmo quando os agregados diários cobrem todo histórico. `transactionViewRows()` filtra as linhas carregadas, e `transactionViewSummary(filtered, source)` resume esse subconjunto. O cabeçalho avisa `Histórico do banco parcial`, mas os cartões da Movimentações e o texto de resumo podem ser interpretados como totais de todos os registros do período quando `bank.data.truncated=true`.

**Ação:** provar comportamento com fixture sintética de 2.501+ registros ou state explícito `truncated`; sinalizar no próprio resumo que os valores filtrados se referem às linhas carregadas ou usar agregados confiáveis para os casos suportados; não dizer `todos os resultados` quando não foram carregados todos. Não desenvolver paginação complexa nesta U5.1 sem justificar impacto e gate.

**Classificação:** ajustes de coerência e transparência; não há P0/P1 financeiro novo comprovado por inspeção estática. Se a execução da suíte oficial descobrir erro de compilação ou persistência, isso passa a ser bloqueante para merge.

## 3. Gates oficiais autorizados (sem build)

Executor poderá fazer no checkout pinado: `npm ci` (Node 22.23.4 / npm 10.9.9), `npm run test:types`, `npm run test:db` (incluindo FinanceDB U5.1 e D1.5.1), `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar`. Testar GUI Electron em perfil descartável, tema claro/escuro, 1366×768 e 1920×1080, filtro+popover+teclado+erro+foco+reabertura, transação bancária com externalId repetido entre contas, status/natureza manual, conciliada, banco truncado, backup/restore.

**Aceite:** gates oficiais verdes no SHA efetivamente testado, registros de falha/correção no log, capturas reais (não mockups), nenhum vazamento de dados. Sem toolchain: marcar `NÃO EXECUTADO`, sem declarar sucesso. Não usar CircleCI Windows até autorização específica.

## 4. Missão seguinte — Executor 2 / U5.2

**Nome:** U5.2 — Planejamento & Simular Compra: clareza, continuidade e produtividade. **Pré-requisito:** U5.1 corrigida/revisada e branch/PR #37 com log final atualizado; não iniciar mais uma cadeia de mudanças não revisadas.  
**Branch sugerida:** `feat/mf2-u5-2-planning-simulator-20261111` **a partir do HEAD revisado da U5.1**; abrir PR draft com **base PR #37** para preservar dependência empilhada. Revalidar HEAD em cada início. Não empurrar para branch Argon nem main.

### U5.2-A — Planejamento
- Trabalhar em `src/plan-view.ts`, trechos relevantes de `src/app.ts`, CSS próprios `app/planning-productivity.css` / `app/index.html` apenas se necessário, e novos testes U5.2.
- Inventariar duas apresentações de projeção diária e eliminar redundância sem perder a função, melhorar calendário com diferenciação **confirmado vs. estimado** (fontes e período claros), estados de vazio, tooltip, foco/teclado, fluxo 1366×768 e 1920×1080. Preservar cálculos, IDs e regras de transferência, Pluggy e saldo desconhecido. Não criar projeção numérica baseada em dado ausente.
- Aceite: fixtures de virada de mês/ano, sem dupla contagem, simetria calendário/gráfico/cálculo do motor, nenhum corte visual; dois temas.

### U5.2-B — Simular Compra
- Em `src/app.ts`, `setSimulation` apaga `outcome` ao digitar; **corrigir**: preservar último resultado como desatualizado quando input difere das premissas calculadas, com botão claro de **Recalcular**, sem tratar número antigo como válido. Evitar corrida entre requisições `runSim` e edição; não misturar último cenário salvo `simSaved` com resultado calculado.
- Testar cenário A/B, primeiro vencimento, taxa, arredondamento, erro, cancelamento, mudança de valor, restauro do resultado e ausência de retorno stale.
- Aceite: zero perda silenciosa de resultado anterior, zero cálculo antigo rotulado como atual, centavos e cenário fidedignos ao motor.

### U5.2-C — Revisão focada UX
- Reduzir cliques e redundância por jornada em Planejamento e Simular; manter design Premium, tipos de cartões, hover/focus/reduced-motion do D1.5; sem refatorar o design system inteiro. Medir baseline e depois (metas de produto, não fatos): redução de 20–35% na tarefa de localizar compromisso e preservação de contexto em todos os cenários de simulação.
- Atualizar `docs/ROADMAP_MF2.md`, `docs/ai-context/EXECUTOR_HANDOFF.md` e log próprio no PR, com testes reais vs não executados.

**Não incluir nesta U5.2:** IA/Argon, identidade MF, F2 Pix/CDI, novas integrações PWA, refatoração geral da persistência ou Windows build.

## 5. Argon e coordenação

**Argon:** concluir I1-A.1 do chat lateral usando o patch validado, corrigir desambiguação de candidatos e estado "Permitir" não persistente; publicar primeiro PR real, depois I1-B e I1-C, mantendo propriedade de `src/intelligence-view.ts`, `src/intelligence-integration.ts`, `app/intelligence.css`. Não editar `src/app.ts` concorrencialmente. O app.js compilado é produto de `tsc`, não patch manual.

**Executor 2:** U5.1 correções dirigidas e U5.2, atuando em `src/app.ts`, `src/plan-view.ts` e CSS específicos. A eventual integração entre a proposta de categorização do Argon e popover U5.1 deve ocorrer por **contrato tipado e backend autorizador**, após estabilizar ambos, sem aplicação de patch concorrente.

**Arquiteto:** revisar cada gate e merge **base PR #36 → U5.1 #37 → U5.2**; coordenar futura integração I1 sobre staging já consolidada, sem cherry-pick de bundle gerado. Monitorar custo de adiar EXE; uma candidata Windows de avaliação após U5.2 pode seguir independentemente de I2/I3 e PWA, sempre com consentimento explícito do proprietário.

**Este documento não faz merge nem valida executáveis.**
