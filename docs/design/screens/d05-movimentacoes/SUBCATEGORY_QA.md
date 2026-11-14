# D05-SUBCAT — QA realizado e gates pendentes

**Estado:** `DESIGN_TESTS_PASS / PRODUCT_NOT_IMPLEMENTED`. Não confundir QA de protótipo e homologação Electron/SQLite.

## 1. Verificações executadas nesta missão

**Ambiente real:** leitura pelo conector GitHub dos arquivos publicados em `design/mf2-screen-by-screen-20261113`. `prototype-subcategories.html` foi analisado por parser de JS embutido e as funções do modelo foram executadas isoladamente com dados sintéticos (sem navegador). Referência do HTML validado: blob `588cf7f58a344df0b33a8227096b06b99cf4e4e8`.

### Catálogo e registry (13/13 PASS)

1. 14 categorias-mãe e 61 filhos na taxonomia.
2. Contagem declarada bate com a lista.
3. IDs de pai e filho únicos.
4. Cada filho aponta para um pai válido.
5. Não existe subcategoria real chamada “Sem subcategoria” — representar `null`.
6. Matizes 0…359.
7. Todas as `iconKey` possuem SVG local.
8. Registry com 67 desenhos.
9. Botões de criar e personalizar existem estruturalmente.
10. Prévia de categorização e reconfirmação existem estruturalmente.
11. Reduced motion e dialog ARIA presentes na marcação/CSS.
12. Tokens para receitas verdes, despesas vermelhas.
13. Script JavaScript embutido passa no parser de sintaxe.

### Modelo executado (12/12 PASS)

1. App carrega 14/61.
2. Alimentação apresenta 3 registros sintéticos, incluindo um sem filho.
3. Selecionar Delivery filtra apenas iFood (1).
4. Selecionar Sem subcategoria filtra somente o registro com `subcategoryId=null`.
5. Entradas confirmadas R$3.120 (não incluem transferência interna).
6. `resultado = entradas − despesas`.
7. A conferir é independente do status bancário.
8. Delivery referencia Alimentação pelo ID.
9. Registro legado mantém filho nulo.
10. Fixtures incluem `PENDING` e `transfer`.
11. Troca de pai limpa filho e reconfirmação bloqueia associação cruzada.
12. Elementos de criar/editar/reconfirmar presentes.

**Total de verificações executadas:** 25 checks isolados/estáticos, todos PASS; compilação sintática PASS. **Não houve simulação de eventos reais em Chromium**. Os checks de UI são estruturais e os de lógica rodam sem DOM real.

## 2. QA visual e de produto — NÃO EXECUTADO

- [ ] Executar e comparar o HTML canônico no navegador Chromium em resoluções 1366×768/1920×1080, dark/light, reduzido e zoom 200%.
- [ ] Abrir categoria, selecionar todos 61 filhos, ver glyph/fundo individual, texto sem corte, legibilidade em tela.
- [ ] Testar criador de subcategoria (nome, acento/duplicata, ícone, matiz, persistência local e cancelamento).
- [ ] Testar `Personalizar ícone`, cor, retorno de foco e animações; teclado/Tab/Escape.
- [ ] Testar mover movimentação entre pais; filho incompatível não aparece; confirmação começa desmarcada e invalida ao mudar alvo.
- [ ] **Produto:** implementar migração SQLite com banco legado sintético, backup, perfis, regras, overrides, splits, orçamentos, planejamentos, IA e sincronização.
- [ ] Rodar gates TypeScript/Node/SQLite/F08/ASAR/Electron no PR real; capturas e SHA de build Windows.
- [ ] Preservar dados bancários, sem dupla contagem de PENDING/POSTED, transfer e ignore, e sem reclassificação automática de histórico.
- [ ] Verificar todos painéis D01/D02/D03/D04/D05 com renderização e filtros `categoryId/subcategoryId`.

## 3. Gatilhos de bloqueio

Falha se subcategoria existir só visualmente, se `subcategoryId` não persistir no SQLite, se um filho puder ser vinculado ao pai errado, se nomes (em vez de IDs estáveis) quebrarem rename, se haver perda de histórico/limites/splits, se ícones ficarem invisíveis no dark ou se a IA aplicar alterações reais sem autorização/preview.

**Issue de fechamento técnico obrigatória:** [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74). A D05 visual permanece em revisão [#70](https://github.com/JoaoVittorLi/meu-financeiro/issues/70). **Não gerar EXE nem aprovar engenharia com base nestes testes isolados.**
