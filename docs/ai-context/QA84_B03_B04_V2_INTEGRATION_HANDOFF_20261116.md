# QA-84 / B03 V2 + B04 V2 — Handoff de implementação isolada
**Data:** 2026-11-16 · **Design:** [QA_EXE_B03_B04_APPROVED_20261116.md](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/handoffs/QA_EXE_B03_B04_APPROVED_20261116.md).

**Branch exclusiva:** `feat/mf2-qa84-b03-b04-v2-20261116`. **Base:** PR #76 HEAD `1bc1b89bf5bdefc0196b0851e690a99f825ca85a`. **PR:** [#86 — B03/B04 V2](https://github.com/JoaoVittorLi/meu-financeiro/pull/86) (Draft). **Fonte de identidade definitiva:** PR #85, `feat/mf2-qa84-b01v3-b02v7-20261116`, **NÃO mesclado nesta branch**. **NÃO** promover em #76 antes de reconciliação de ownership e QA.

## Código funcional entregável (não é redesign B01/B02)

1. **B03 D05 existente** — `src/d05-movements.ts`: checkbox, SVG, descrição/corpo e revisão têm ações independentes; clique em ícone abre B04; clique no corpo chama a **gaveta REAL do App** com a origem, accountId, transação e categoryId/subcategoryId, sem nova lista/página/coluna. Eventos de classificador na gaveta reutilizam o seletor montado no único componente D05.
2. **Gaveta direita real** — `src/app.ts`: `renderDetailDrawer()`, `mf-drawer-backdrop` e `mf-detail-drawer` existentes preservados. O ícone/ação `Alterar categoria` solicita `qa84B03RequestDrawerPicker`. O legada `StyledSelect` categorizava diretamente banco; removido da interface deste fluxo e substituído por entrada no B04. `safeData` preserva parent/child IDs manuais no reload, sem inferir subcategoria, alterar valor ou reclassificar por merchant. Métodos legados de split e rule dentro da gaveta ficam expressamente desabilitados pelo flag privado falso `qa84BankCategoryGateAuthorized` até que MAIN tenha autorização/previews homologadas. **Não autorizar esse flag na integração.**
3. **B04 premium** — `src/d05-movements.ts` e `app/d05-movements.css`: overlay contextual até 730px, grid 4/3/2 colunas, 14 pais/61 filhos do catálogo D05 aprovado; busca NFD por pai e filho, resultado filho rotulado `Assinaturas › Streaming de vídeo`. Seleção pai/filho → preview → reconfirmação. Sem write on click. Popup e drawer coexistem, overlay z-index 1400 sobre drawer 450, Escape fecha primeiro a classificação e restaura foco ao trigger, click outside cancela; reduz movimento com CSS; tamanho máximo respeita o viewport.
4. **Gravação supervisionada** — leitura **pessoal** de classificação usa `d05PersonalWritePreview` do preload autorizado MAIN; código exige contrato/estado `changesApplied:false`, nunca chama `d05PersonalWriteConfirm` ou legacy `bankCategorize` para B03/B04 real. Apresenta estado `personal-locked` sem botão de gravar. **DEMO somente**, manual usa duas etapas, fingerprint de transação, `host.updateData` + reconsulta `bridge.load('demo')`; o recibo exibe o mesmo SVG/hue D05 **somente após confirmação da persistência**. Gravação não confirmada é reportada como tal. Batch é preview com `previewVersion` real, contagem, POSTED/PENDING, chave exata e fingerprint; commit pessoal bloqueado.
5. **Adaptador mínimo** — `src/qa84-b03-b04-bridge.ts`: nenhuma taxonomia duplicada; chama `window.resolveCategoryVisualIdentity` de PR85 se presente, senão usa somente `D05_APPROVED_PARENTS` aprovado como fallback determinístico até integração. Identidade por ID/sub-ID; não infere categoria pelo estabelecimento. Inclui busca, geometria, fingerprint e **evento UI** `mf2:d05:open-picker`; **não cria IPC**, não envia ação financeira e não autoriza writes.
6. **Compilação** — `tsconfig.json` inclui o adaptador imediatamente após `d05-visual-assets.ts` e antes da UI D05. Mantém `React.Component` com slots internos (React 16, sem hooks React), `module:none/outFile:app/app.js`.

## Fronteiras B01/B02 / PR #85 — Integração obrigatória posteriormente

| Arquivo | Trabalho PR #85 | Trabalho B03/B04 | Estratégia de reconciliação |
|---|---|---|---|
| `src/app.ts` | B01/B02, orçamento, overview, estado e carregamento do catálogo visual | `safeData` de IDs, drawer, guards de category write legado | aplicar mudanças cirúrgicas por função, sem sobrescrever B01/B02; manter o catálogo de PR85 |
| `src/d05-movements.ts` | filtros compartilhados/incoming period e `resolveCategoryVisualIdentity` no ícone | eventos, picker premium, preview, rows/drawer | manter filtros entrantes de PR85 e trocar o adapter temporário pelo resolver PR85; não ter 2 renderers |
| `tsconfig.json` | novas fontes B01/B02 | 1 adaptador D05 | combinar TODOS os arquivos na ordem correta |
| `src/d05-visual-assets.ts` | `resolveCategoryVisualIdentity` e `CategoryVisualGlyph` globais | **NÃO MODIFICADO aqui** | PR85 é a fonte definitiva |
| CSS | `app/qa84-b01-b02.css` | `app/d05-movements.css` | ambos; sem paletas paralelas |

**Gate bloqueante:** só marcar `GLOBAL_VISUAL_IDENTITY_CONNECTED` após o PR85 estar realmente na mesma árvore e testes com o resolver global em overview, budgets, D05, detalhe e seletor. Não mesclar cegamente branches empilhadas. A branch B03/B04 não cria catálogo ou regras novas, não altera B01/B02.

## Testes e evidências honestas

**Teste versionado:** `tests/qa84-b03-b04.test.cjs` com **12 cenários** declarados: targets clicáveis distintos, handoff drawer/event, pesquisa normalizada, preview pessoal negado, demonstração com dupla confirmação e mock de readback, Escape/foco, lote `previewVersion`, preferir PR85 global, responsividade CSS, bloqueio de regra/split legacy, preservação IDs e centavos via `safeData`, stale fingerprint por account/status/amount/date.

| Validação | Estado nesta execução |
|---|---|
| Revisão dos HEADs PR #76, design e PR #85, comparação de arquivos | **VERIFIED** via GitHub |
| Criação/atualização efetiva dos 6 arquivos acima, parsers JS de testes | **CODE_PRESENT / PASS sintático no teste CJS** |
| Contratos por inspeção de `onClick`, `useEffect`, `d05PersonalWritePreview`, `safeData`, proteção dos legados | **SOURCE_VERIFIED, não E2E** |
| `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, proveniência/F08, `npm run test:asar` | **NOT_RUN** — checkout completo/Node22.23.4 indisponível neste executor |
| `node --test tests/qa84-b03-b04.test.cjs` no projeto inteiro | **NOT_RUN** — suíte versionada, mas não executada |
| QA Electron45 real, B03/B04 visual 1366/1920, dark/light, zoom 125/150 e screenshots | **NOT_RUN / NÃO AUTORIZADO** |
| Personal bank writes, deploy, CircleCI, EXE, merge `main` ou PR #76 | **NOT_EXECUTED**, bloqueados |

**ATENÇÃO:** Os testes de demo usam React/IPC mockados, não comprovam SQLite ou Electron Windows. A simples inclusão dos testes não equivale a PASS.

## Próximos gates do Integrador (quando autorizado)

1. Com PR85 e este PR **sem merge na main**, integrar seletivamente em candidata #76 atual e resolver apenas conflitos em `src/app.ts`, `src/d05-movements.ts`, `tsconfig.json`.
2. Substituir fallback da identidade visual por ligação real a `resolveCategoryVisualIdentity` do PR85; executar testes transversais B01/B02/B03/B04.
3. Executar Node22.23.4/npm10.9.9 `npm ci`, `test:types`, `test:db`, `compile`, F08, ASAR e a suíte nova, corrigindo FAILs reais. CircleCI somente proprietário.
4. QA Electron Windows autorizado depois, incluindo 32 capturas base e checagens zoom/reduced-motion/overlays, com dados sintéticos. A UI ainda exige validação humana real.
5. Escrita pessoal, regras/splits legados e lote real permanecem bloqueados até homologação. #74 e #84 abertas; **NO-GO EXE** neste PR isolado.

**Conclusão:** `B03_B04_CODE_VERSIONED / NO_PARALLEL_B01_B02_OVERWRITE / PR85_DEPENDENCY_OPEN / TESTS_NOT_RUN / WINDOWS_NOT_HOMOLOGATED / NO_GO_EXE`.
