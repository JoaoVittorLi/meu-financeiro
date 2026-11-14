# D05 V1.3 — Interações Premium do Extrato (EM REVISÃO)

**Data:** 14/11/2026 (fuso BRT) · **Estado:** `PROTOTYPING / WAITING_FEEDBACK` **para interações da lista de Movimentações**, não aprovado.  
**Aprovado anteriormente e preservado:** taxonomia de **14 categorias, 61 subcategorias, 67 ícones SVG, cores tonais por subcategoria**, conforme D05 V1.2.  
**Design #70** · **implementação obrigatória de subcategorias #74**. O usuário rejeitou os controles específicos do extrato de V1.2/V1.1; **isso NÃO revoga a aprovação dos ícones nem da taxonomia**.

## Evidência: capturas do usuário de 14/11/2026

- **V04 — Checkbox nativo**: seleção múltipla parece checkbox padrão Windows, destoando da linguagem premium.
- **V05 — Dropdown separado**: botão textual com seta ao lado do nome da categoria é redundante e visualmente pesado.
- **V06 — Ícone não interativo**: a ação desejada é clicar **diretamente no ícone da categoria da movimentação**, sem botão extra de categoria.
- **V07 — Menu pouco ágil**: troca de categoria/subcategoria deve acontecer no próprio botão/ícone, com escolha rápida em duas etapas **categoria → subcategoria opcional** (sem troca involuntária de pai+filho).
- **V08 — Estados empilhados**: mostrar literalmente “Confirmada” e “A conferir” juntos na linha mistura dois eixos distintos (status bancário e revisão), causando ruído. Eliminar “Confirmada” da lista normal; mostrar status bancário somente em detalhes quando POSTED, e uma única anotação contextual por linha.
- **V09 — Semântica de pendência**: “Pendente no banco” (PENDING) é diferente de “Revisão pendente” (POSTED a revisar). Não confundir, nem usar cor de entrada/saída para isso.

**Classificação da evidência:** esses são problemas vistos nas **capturas do protótipo** encaminhadas pelo proprietário. Não atestar que o app Electron instalado já foi reproduzido/testado com essas falhas.

## Proposta de comportamento V1.3 (pendente de aprovação)

### A. Ícone da movimentação = controle de classificação

1. Ícone de cada linha passa a ser um botão acessível (aria-label “Alterar categoria e subcategoria de [descrição]”), com mesma estética tonal aprovada.
2. Ao clicar, abrir painel contextual **ancorado ao próprio ícone**, sem seta `⌄`, sem badge/botão de categoria separado.
3. Etapa **Categoria:** seleção rápida a partir da taxonomia aprovada de 14 grupos, busca por nome e ícone; grupo atual identificado por borda/check. Não selecionar filho automaticamente por heurística.
4. Etapa **Subcategoria (opcional):** após escolher pai, mostrar filhos válidos **apenas daquele pai**; opção grande `Manter somente [Categoria]` (grava `subcategoryId=null`); opcionalmente botão `Voltar às categorias`. Incluir busca se filhos forem numerosos.
5. Seleção de filho substitui proposta/rascunho local; pode clicar `Conferir alteração` / `Confirmar` para concluir. **Nunca** aplicar escrita pessoal via IA automaticamente. Manual UI pode usar confirmação contextual compacta, mas revisão de regra em massa segue D04.
6. O menu fecha por Escape/clique fora; foco retorna ao ícone; entrada pelo teclado funciona; position/clamping evita recorte em linhas baixas e resoluções 1366x768. Padrão de modal e confirmação é acessível.

### B. Seleção múltipla premium

- Substituir checkbox nativo por **botão de seleção estilizado de 20–22px** com borda/tom de superfície e marca de check SVG ao ativar; `aria-pressed` e `aria-label`, alvo clicável >= 38px via padding.
- Não usar `input[type=checkbox]` visual do Windows. Seleção de linha **não** abre detalhes, nem categoriza. Seleções permanecem estáveis por ID até mudar o escopo/filtro; a toolbar de ações surge acima da lista somente quando há itens.
- Bulk edit: exige mesma checagem de IDs, escopo e confirmação antes de aplicar; IA não recebe escrita pessoal.

### C. Status financeiro discreto e desambiguado

- **POSTED + revisada:** nada no extrato (estado normal), ou indicação sutil somente no detalhe.
- **POSTED + a revisar:** apenas microindicador de atenção `A revisar` com ponto/ícone, em uma linha, sem `Confirmada`.
- **PENDING:** apresentar somente `Em processamento` / `Pendente no banco`; detalhes mostram o status original e revisão em campos separados. Não misturar status, não somar PENDING aos totais confirmados.
- **MANUAL:** origem informada na segunda linha (Manual), sem rótulos duplicados de confirmação.
- **Transfer/ignore:** ícone e valor neutros e exclusão do cálculo de entradas/saídas. Valores de gastos vermelhos, entradas verdes com contraste AA em dark/light; estados de banco/revisão não colorem valores.

### D. Dados e integração real (Executor #74)

- CategoryTarget tipado `{ categoryId, subcategoryId: string|null }` em `src/app.ts`, SQLite, IPC e bancos.
- Menu ancorado obtém 14+61 **do catálogo persistido**, não de fixtures estáticas; custom categories/subcategories incluídas no serviço.
- Pai escolhido invalida filho anterior se diferente; o backend valida FK/pertinência. Trocar só categoria mantém filho `null`.
- Antes do apply, prévia da movimentação-alvo com valor/conta/data, nova categoria+filho; autenticação/capability e reconfirmação conforme política. Regras de IA/ações em lote usam `previewVersion` e escopo da D04.
- Nunca gravar no feed Pluggy de origem; persistir override com IDs e garantir idempotência, eventual reconciliação PENDING→POSTED, backup/restore e compatibilidade.
- **QA obrigatório:** dark/light, 1366/1920, teste de clique em ícone, teclado/Escape/foco, scroll perto do rodapé, sem seta textual, visual de seleção próprio, indicação de status única, concorrência/versão, compatibilidade de categoria personalizada, e acessibilidade.

## Critérios de aceite desta rodada (ainda PENDENTES)

- [ ] Usuário confirmar que o novo **controle de seleção** tem aparência premium.
- [ ] Usuário confirmar que clique **no ícone** abre seleção rápida de categoria e depois subcategoria, sem seta/botão separado.
- [ ] Usuário confirmar que os dois rótulos `Confirmada` + `A conferir` desapareceram da linha e a nova apresentação está clara.
- [ ] Aprovação visual V1.3 expressa, então congelar o design/handoff atualizado; **não declarar já aprovado**.
- [ ] Execução Electron e implementação SQLite permanecem obrigatórias e **não executadas** por esta missão de design.

## Testes declarados

Documento de requisitos e revisão das capturas; **não foi realizado QA real em navegador/Electron nem migração** neste arquivo. Um protótipo inline é apresentado ao proprietário para interação; não confundir com código instalado.


## 14/11/2026 — Feedback V1.3 rejeitado / direção V1.4 em revisão

**Capturas do proprietário:** cabeçalho por dia com `2 registro(s)` isolado à direita, visualmente inadequado; seletor ancorado ao ícone ainda é popover alto/pesado, com blocos cinzas, prévia excessivamente grande, título repetitivo e CTA branco. **V1.3 não aprovada**.

- **DAY-01:** remover `N registro(s)` de todos os cabeçalhos diários. Apenas data discreta e divisória. Contagem geral do filtro pode ir para lugar contextual, sem badge solto por dia.
- **PICK-01:** clique no ícone colorido da linha é **único gatilho** para classificar. Zero botão `Categoria⌄` ou seta.
- **PICK-02:** popover compacto, sombras/bordas/tokens D01–D04; cabeçalho enxuto, catálogo de categorias em grade e subcategorias em lista densa e legível. Evitar repetição de títulos, verde maciço na opção, preview gigante, CTA branco.
- **PICK-03:** primeira etapa busca 14 categorias, segunda `Manter somente [pai]` + filhos; borda/check discreto, proposta `Atual → Novo` minimalista só quando houver alteração; CTA esmeralda. Nada de apply automático.
- **PICK-04:** ancorar com reposicionamento seguro junto ao ícone e viewport, sem clipping no rodapé, outside/Escape/focus, responsivo e reduced motion.
- **STATUS-01:** manter uma informação por linha: POSTED revisado sem etiqueta, POSTED não revisado `A revisar`, PENDING `Em processamento`. Banco/revisão separados em detalhe.
- **SELECT-01:** manter seleção custom premium, não nativo Windows.

**Preservar aprovado:** 14 categorias, 61 subcategorias, ícones/cores e vínculo pai→filho. Não declarar V1.4 aprovada antes do proprietário. Implementação real no SQLite/IPC/regras/IA segue obrigatória na #74; defeitos são do protótipo capturado, não comprovados no Electron.
