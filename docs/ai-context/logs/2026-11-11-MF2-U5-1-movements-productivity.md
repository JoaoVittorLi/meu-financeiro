# MF2 — U5.1 | Movimentações Premium e produtividade

**Data:** 2026-11-11. **Executor:** Executor 2. **Repositório:** `JoaoVittorLi/meu-financeiro`. **PR:** [#37](https://github.com/JoaoVittorLi/meu-financeiro/pull/37), draft. **Branch:** `feat/mf2-u5-1-movements-productivity-20261111`. **Base:** PR #36 / D1.5.1, commit `87fb449c0232d80aebd7c50ad547197e34d3c806`. **Commit do código:** `10b9695305b0d2836f599b34971433955f64ea3b`; o commit documental é posterior.

## Código publicado e decisões de produto

**A — Popover no lugar de abrir drawer para categorizar:** botão da coluna Categoria mostra categoria atual, permite pesquisar nome sem acentos, lista categorias compatíveis com o tipo, setas/Enter/Escape, `aria-expanded`, busca `combobox`, lista `listbox`, foco visível e retorno ao botão. O fechamento por Escape não grava. Para manual, atualiza somente a categoria pelo mesmo `updateData` existente; a guarda SQLite P1-02 herdada impede alterar/excluir manual vinculado sem desvinculação explícita. Para banco, executa `bankCategorize({accountId,externalId,category})`, guardando o override pessoal sem modificar o extrato Pluggy original. Serializa retornos completos de IPC e bloqueia cliques repetidos; só mostra sucesso após resposta de persistência. Em erro, a categoria original persiste e um aviso permanece no popover. Clicar no nome mantém o drawer para edição avançada/divisões/vínculos.

**B — Filtros combináveis:** mantém pesquisa, período no topo, conta e origem, e as abas Histórico/A revisar. Painel `Filtros` abre quatro selects: categoria, receitas/despesas, situação de revisão bancária, ordenação data/valor absoluto. Condições ativas aparecem em chips com remoção individual; o botão limpar tudo retorna aos padrões, inclusive período mensal. `transactionViewRows` filtra dados de banco/manual de modo independente, cria chaves `accountId|externalId` e `manual|id`, busca nome/estabelecimento/conta/categoria, respeita natureza bancária e oferece sort determinístico. A contagem de revisão continua somente bancária e independe do período; resumo utiliza apenas uma origem por vez antes do limite de 500 linhas da tabela.

**C — Interações/estilo:** bloqueio de clique duplo na revisão, visual neutro/menta, popover reposicionado pela viewport, reação a scroll/resize/outside click, foco e animação reduzida em `app/movements-productivity.css`. Não existem atalhos globais novos para exclusão. Mantém CSS Premium D1.5 intacto.

## Arquivos e segurança

Alterados: `src/app.ts`, `app/index.html`, `tests/transaction-category-edit.test.cjs`. Criados: `app/movements-productivity.css`, `tests/u5-1-filters.test.cjs`, `tests/u5-1-inline-category.test.cjs`, `tests/u5-1-category-sqlite.test.cjs`. **Não alterados:** `electron/db.cjs`, `src/intelligence-view.ts`, `src/intelligence-integration.ts`, `app/intelligence.css`, main, PWA/Cloudflare, DDL/migrações, dados financeiros. Não houve deploy, merge ou executável.

## Antes e depois

| Ação | Antes | Agora | Evidência |
|---|---|---|---|
| Alterar categoria manual | Categoria → drawer → selecionar → salvar | Categoria → popover → escolher | Reduz tela intermediária e passo de salvar |
| Alterar categoria bancária | Categoria → drawer → seletor | Categoria → popover → procurar/escolher | Menor troca de contexto; tempo não medido |
| Encontrar/revisar transações | Busca, origem, conta, período e tab de revisão | Combinar categoria/tipo/revisão/ordenação e remover chips | Mais precisão; sem benchmark cronometrado |
| Revisar linha | Botão Revisar sem lock específico | Mesmo botão com lock de chave composta | Impede envios simultâneos por repetição |

## Testes (rigor de evidência)

**Executados no motor V8 sobre métodos/funções de produção, apagando apenas anotações TypeScript:**
- **12/12 PASS**: linhas manuais/bancárias com externalId coincidente, categoria+conta+tipo+revisão, busca normalizada, período de revisão, ordenação absoluta e por data.
- **7/7 PASS**: escolha inline por origem, override com accountId correto, persistência manual preservando centavos, falha bancária sem sucesso falso, clique duplicado, Escape/setas e retorno de foco.
- Ambos com dados sintéticos e mocks, **não** representam `node --test`, electron ou SQLite integral.

**Testes automatizados publicados, aguardando checkout real:** `tests/u5-1-filters.test.cjs` (6), `tests/u5-1-inline-category.test.cjs` (9), `tests/u5-1-category-sqlite.test.cjs` (4 com `FinanceDB` SQLite nativa), atualização de contrato legado `tests/transaction-category-edit.test.cjs`. Os 19 testes escritos **não foram executados na árvore completa** nesta missão. Também pendem as regressões D1.5.1 (BRL estrito e integridade de vínculos), `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar` e GUI Electron/temas/tamanhos/foco/screenshots. Sem checkout integral e toolchain pin no runtime atual; não inferir aprovação.

## Próximo responsável e integração

Entregar PR #37 e este checkpoint ao Arquiteto. Primeiro obter gates financeiros e de testes oficiais no checkout completo; executar QA real, corrigir falhas confirmadas e planejar integração segura de #37 **após** #36. **Não disparar CircleCI Windows**, não gerar EXE, não fazer release nem alterar main/Cloudflare/Inteligência. O proprietário pediu continuar desenvolvimento de alto valor e adiar binário.
