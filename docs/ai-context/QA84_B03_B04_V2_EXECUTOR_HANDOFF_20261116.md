# QA-84 — B03 V2 / B04 V2 — Handoff de código para o Integrador

**Status:** CODE_PUBLISHED / ISOLATED_TESTS_NOT_RUN / WINDOWS_QA_NOT_RUN.  
**Data:** 16/11/2026.  
**PR de código:** [#87](https://github.com/JoaoVittorLi/meu-financeiro/pull/87) (Draft).  
**Branch:** `feat/mf2-qa84-b03v2-b04v2-20261116`, iniciada sobre a candidata [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), base `1bc1b89bf5bdefc0196b0851e690a99f825ca85a`.  
**Não integrar cegamente:** B01/B02 está no branch paralelo `feat/mf2-qa84-b01v3-b02v7-20261116`, com alterações simultâneas em `src/app.ts` e `src/d05-movements.ts`.

## Código efetivo — B03 V2

1. **Sem segunda tela**: `D05Movements` segue responsável pela rota existente, preservando KPIs, filtros, pesquisa, fonte, agrupamento, POSTED/PENDING, seleção em lote e prévias.
2. Ícone da linha chama `openPicker`; nome e metadados são alvos próprios para `openBankDetail`/`openManualDetail`; indicador de revisão tem ação independente. Não há evento duplo por bubbling.
3. O `renderDetailDrawer()` original do App continua em `mf-drawer-backdrop` e `mf-detail-drawer` (**overlay à direita**, não coluna fixa); o componente D05 expõe `openFromDetail(source,raw,trigger)` por **ref de instância**. O ícone do drawer e a ação contextual chamam o mesmo seletor B04 da lista, mantendo drawer montado sob ele.
4. `identityForDetail` resolve o ID de fonte, conta e movimentação no conjunto D05 em memória, incluindo referências parent/child carregadas pelo serviço; a gaveta usa o mesmo descriptor de linha, não um emoji extraído do nome/merchant ou um ícone por natureza.
5. Removido o `StyledSelect` legado de categoria bancária no drawer, que chamava `setBankCategory(tx,v)` diretamente; o seletor de categoria manual do drawer também delega para D05. O salvamento de descrição/data/valor manual deixa de sobrescrever o parent/child atual com o rascunho velho da gaveta.
6. `onGlobalKeydown` de App não sequestra Tab/Escape do seletor D05 que esteja acima do drawer; D05 devolve foco ao botão disparador após fechar.

## Código efetivo — B04 V2

1. Popover único contextual com largura responsiva até **730px**; grade 4 colunas (desktop amplo), 3 (intermediário) e 2 (compacto). Não vira painel lateral fixo.
2. Busca `NFD`/remoção de acentos única para categorias e filhos; o resultado de filho mostra o pai (p.ex. **Assinaturas › Streaming de vídeo**) e usa o SVG/hue do filho.
3. Fluxo pai → filho ou somente pai → **Antes/Depois** → confirmação explícita; abertura, navegação ou escolha não salvam sozinhas.
4. Classificação manual revalida ID/data/valor/kind/categoria original e parent/child contra o estado atual antes de `host.updateData()`; erro mantém histórico intacto. Estado visual é atualizado apenas após `saved=true`.
5. Classificação bancária pessoal continua exigindo autorização de conta e `d05PersonalWritePreview`. A prévia é mostrada como **indisponível para COMMIT pessoal**, preservando o drawer e o resultado Antes/Depois sem falsa confirmação. Nenhum `d05PersonalWriteConfirm` foi introduzido na UI.
6. Seleção em lote mantém implementação pré-existente `d05BankBatchPreview`, `previewVersion`, comparação exata dos IDs selecionados e `d05BankBatchApply` apenas em gateway autorizado; erros de stale/negação não produzem recibos falsos.
7. Overlay cancela por X/Escape/clique fora sem persistir; foco retorna ao trigger e rolagem do drawer/lista não causa fechamento destrutivo.

## Identidade visual — dependência transversal não duplicada

O B01/B02 criou `resolveCategoryVisualIdentity()` dentro de `src/d05-visual-assets.ts`. Este PR **não copia nem redefine o helper**, nem cria segundo registro SVG. O App tenta o resolvedor global quando presente; até a reconciliação usa exclusivamente `D05_APPROVED_PARENTS` para exibir categoria em detalhe. O D05 já usava o catálogo D05 para listagem e seletor. Essa compatibilidade **não é a prova de rollout global**: é necessário reconciliar a implementação real do resolvedor de B01/B02 antes de declarar icon/hue unificados em todas as áreas.

**IMPORTANTE para Integrador:** merge manual, não cego, em `src/app.ts` e `src/d05-movements.ts`. Não sobrescrever `src/qa84-overview.ts`, `src/qa84-budgets.ts`, `src/d05-visual-assets.ts` ou CSS B01/B02. Manter `renderDetailDrawer`, novas chamadas D05, helper global e controles de autorização; verificar DOM real de transações antes de pedir QA.

## Arquivos tocados

- `src/d05-movements.ts` — picker, busca pai/filho, foco, gatilho do drawer, controle de prévia, revalidação manual.
- `src/app.ts` — delegação App→D05, gaveta vetorial, bloqueio de bypass, categoria manual não sobrescrita.
- `app/d05-movements.css` — geometria B04 e drawer icon, foco, 4/3/2 e reduced-motion.
- `tests/qa84-b03-b04.test.cjs` — 6 cenários: cliques independentes, ligação drawer/picker, busca por filho, contrato de layout, cancelamento, preview pessoal sem COMMIT.

## Matriz honesta de QA

| Gate | Situação |
|---|---|
| Código em branch/PR separados sem modificar #76 | **PASS**, GitHub confirmável |
| Sintaxe JS do novo teste via V8 `new Function` | **PASS sintático** |
| Contrato histórico, popup, CSS e drawer no código | **CODE_PRESENT, NOT_RUNTIME_TESTED** |
| `npm ci`, TypeScript, `test:db`, SQLite, D05 14×61, F08 e ASAR | **NOT_RUN** no novo HEAD |
| `node --test tests/qa84-b03-b04.test.cjs` com TypeScript | **NOT_RUN** (requer checkout da branch + npm ci) |
| Electron real, 1366×768 e 1920×1080, dark/light, zoom 125/150, foco, screenshots | **NOT_RUN** |
| Fluxo de dados pessoais/QA Windows | **NÃO AUTORIZADO** |

Não declarar QA Windows concluído, integração B01/B02 efetivada, release ou gravações financeiras pessoais homologadas com base neste handoff.

## Próximo passo do Integrador

1. Conferir HEADs dos PRs #76, #87 e branch B01/B02; preservar toda alteração do Executor de Overview/Budget Orbit e do P0.6 Electron 45.
2. Reconciliar interfaces B01/B02 e B03/B04 numa branch de integração **após ownership na issue #49**. Executar testes reais de TypeScript/SQLite/UI e corrigir eventuais quebras, sem alterar comportamento de limites financeiros.
3. Testar transação streaming na lista, drawer e seletor usando mesma identidade; testar clique no ícone (picker), nome (drawer), ícone drawer (picker), Escape em camadas, rollback/stale, PENDING e lote com `previewVersion`.
4. Somente proprietário poderá disparar CircleCI/QA Windows e, em autorização posterior, build do EXE. Manter #74/#84 abertas, `approvedForPersonal:()=>false` e dados reais isolados.
