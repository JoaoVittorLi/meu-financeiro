# D05 Movimentações Premium — DESIGN SPEC V1.3 APROVADA

**Aceite expresso do proprietário:** 13/11/2026. **Estado:** `DESIGN_APPROVED / IMPLEMENTATION_READY`, **não** `CODE_IMPLEMENTED`, `ELECTRON_QA_PASS` ou `EXE_READY`. A D05 inteira é **obrigatória para o primeiro EXE experimental**, conforme decisão mais recente da #74. O primeiro EXE continua condicionado à integração/QA autorizados.

**Fonte canônica visual:** [prototype.html](prototype.html), publicado nesta branch da [PR #57](https://github.com/JoaoVittorLi/meu-financeiro/pull/57). **Catálogo imutável de design:** [14 pais/61 filhos](SUBCATEGORY_TAXONOMY_V1.json), [67 SVGs](SUBCATEGORY_SVG_REGISTRY_V1.json), [sistema de ícones](ICON_SYSTEM_SUBCATEGORIES.md). Não reabrir/recriar ícones e cores. Esta V1.3 **consolida as correções de V1.4–V1.6**, sem iniciar uma nova direção artística.

## 1. Linguagem visual — herdada de D01–D04
- Desktop premium, UI escura sem aparência de controles nativos Windows, fundo **#141414**, nav #141414, superfície #1a1a1a, raised #202328, borda #303034. Tema claro: #f4f4f6 / #fff / #e5e5e8. Tokens canônicos em [TOKENS.json](TOKENS.json).
- Hierarquia: H1 `Movimentações` ~26px/830; cabeçalho de módulo `Seu histórico` 16px/800; título do estabelecimento 14px/800 com cor de texto primária, legível; conta e trilha `pai › filho` ~10px e secundárias. **Títulos nunca podem herdar cor escura sobre tema escuro**.
- Quatro métricas de superfície no topo: Entradas confirmadas (verde), Saídas confirmadas (vermelho), Resultado dos registros (verde/vermelho de acordo com o sinal; explicitamente **não é saldo disponível**), A conferir (azul). O último card **abre a fila**, não é uma cifra solta.
- Espaçamentos coerentes 8/10/12/16/20; radius 10/12/14/16; microinterações hover 150–180ms, respeitar `prefers-reduced-motion`; nenhum deslocamento de layout do valor.
- Valores à direita, `font-variant-numeric:tabular-nums`; **saídas vermelhas mesmo em dark**, entradas verdes; transferências neutras. Cor dos ícones de classificação é *família semântica*, nunca sinal positivo/negativo.
- Fundo tonal e `iconKey` da categoria/subcategoria a partir do catálogo aprovado. **SVG local**, sem emoji do SO, placeholders com fallback explícito.

## 2. Composição integral da tela
1. Barra lateral real de navegação, selecionada em Movimentações.
2. Header com título/subtítulo e ações de tema, Importar, Nova movimentação.
3. Quatro métricas compactas e alinhadas ao mesmo escopo financeiro.
4. Painel `Seu histórico`: abas **Todas / A conferir / Revisadas**; pesquisa; origem Banco/Manuais/Todas; mês; filtros progressivos de conta/natureza/ordem.
5. Controles da lista: **Agrupar por dia** via switch premium de trilho arredondado (não checkbox), link Categorias e regras; cabeçalhos de data **somente data + divisor**, proibido contador `N registros` por dia.
6. Linha: **[seleção circular premium] [ícone categoria clicável 43px] [nome prioritário 14px + ponto azul se revisão elegível] [conta · categoria › subcategoria] [valor isolado à direita]**. Sem botão textual `Categoria⌄`, sem rótulos `Confirmada` e `A conferir` empilhados, sem palavra `Revisar` sob valor ou categoria.
7. Drawers sob demanda: detalhes, lançamento manual e prévia de importação, catálogo/regras; sem sobrecarregar a lista principal.
8. Barra de seleção em lote aparece somente após 1+ seleções; tarefas comuns são claras e reversíveis no mock.

## 3. Classificação e revisão
- **Somente o ícone** abre o popover hierárquico ancorado: escolha de pai entre 14 + busca; depois filho do pai (61 distribuídos) ou `Somente [pai]` = `subcategoryId=null`. Seleção via contorno discreto, sem cartão verde gigante, sem CTA branco do Windows. Preview mínimo `antes → depois`, botão esmeralda de confirmação. Lote exige **segunda reconfirmação**, lista e contagem dos afetados e snapshot válido no produto real.
- **Ponto azul**, não texto âmbar, ao lado do nome apenas para `source=bank && status=POSTED && !reviewed`. Clique → conferência rápida com fornecedor, data, conta, valor e classificação; ações `Marcar como revisada`, `Corrigir categoria`, `Agora não`. Depois do aceite o ponto some e a fila atualiza. Ao passar mouse/teclado, tooltip/aria-label descritivo.
- `PENDING`: relógio discreto com tooltip **em processamento**; não entra em review elegível nem em métricas confirmadas, sem revisão automática. `POSTED && reviewed`: **sem selo**. `MANUAL`: informação de origem, não fingir confirmação bancária.
- Histórico e revisão são independentes: **status bancário** e **status de conferência** aparecem separados apenas no detalhe.

## 4. Estados e acessibilidade
- `loading`: esqueletos sem falsas métricas; `empty`: explicar filtro vazio + limpar; `partial/truncated`: declarar cobertura e incerteza; `stale`: período/fonte desatualizado; `denied/error`: informar limitação, não inventar dados.
- Seletores circulares desenhados, botão semanticamente acessível (`aria-pressed`), alvo mínimo de 38–40px; switch `role=switch/aria-checked`; ícones e revisão com `aria-label`, ESC, clique externo, foco devolvido. Popover deve ser reposicionado ao viewport/scroll, sem clipping no rodapé. Teclado/foco são gates de engenharia.
- Cores em dark/light com contraste pelo menos WCAG AA para texto; 1366×768, 1920×1080, zoom 125%/200% e layout estreito; sem scroll horizontal.
- Dados financeiros dinâmicos e autorizados; `prototype.html` contém **somente dados fictícios** e altera apenas estado local na sessão. Não transformar fixtures em dados reais.

## 5. Fonte de verdade e estado
- A base funcional de integração **não é** PR #54 isolado: consulte HEAD atual da [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), coordene ownership com #49 e integre com D01–D04/IA, sem sobrescrever código já entregue.
- O código-fonte `src/app.ts` na RC conhecida contém `renderMovements()` e `renderTransactions()`; `electron/db.cjs` contém `category_rules`, `bank_category_overrides`, `bank_transaction_splits`, `electron/main.cjs` e `electron/preload.cjs` têm `categories:save`, `bank:categorize`, `bank:batch`. **Não foi confirmada subcategoria SQLite nativa nessa leitura**. Revalidar ao executar.
- E1/E2/E3 da [issue #74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74) é trabalho de **código real**. Migrações, QA Electron, CI e EXE ainda não são concluídos por este aceite.

## 6. Congelamento
**Aprovados:** organização da tela V1.3 consolidada, linguagem de revisão, switch, seleção circular, popover por ícone, catálogo 14×61/67 SVGs, cores, semântica positiva/negativa. Ajustes corretivos de contraste/bug podem ocorrer sem redesenhar o aprovado, mantendo rastreabilidade e confronto visual com HTML.

**Não autorizado:** redesenho do catálogo, alterar regras de banco, inferir subcategorias automaticamente, escrever via IA em dados pessoais, fazer merge main ou compilar EXE sem coordenar gates.
