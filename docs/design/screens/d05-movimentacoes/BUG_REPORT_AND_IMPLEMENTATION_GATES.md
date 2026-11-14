# D05 — Relatório de problemas encontrados e pendências de implementação

**Data:** 13/11/2026 · **Autor:** Diretor de Design Premium  
**Aprovação recebida:** proprietário aprovou **100%** a identidade das **14 categorias-pai, 61 subcategorias, ícones e cores** da D05 V1.2.  
**Status:** `D05-SUBCAT DESIGN_APPROVED / ENGINEERING_REQUIRED`. **Não é homologação do Electron.** A tela D05 como um todo poderá ter outros ajustes, mas a família categoria/subcategoria aprovada não deve ser redesenhada sem novo feedback.  
**Issues:** [#70 Design D05](https://github.com/JoaoVittorLi/meu-financeiro/issues/70) · [#74 Engenharia obrigatória](https://github.com/JoaoVittorLi/meu-financeiro/issues/74) · [#49 Coordenação](https://github.com/JoaoVittorLi/meu-financeiro/issues/49).

## A. Problemas confirmados na inspeção do código da baseline PR #54

> **Precisão:** estes pontos foram confirmados na branch `feat/mf2-premium-productivity-sprint-20261112`, HEAD histórico `55de81c03c3171edd0b325eb66d63630018c23c4`. Não atestam o estado de eventuais branches de implementação posteriores; o Executor deve verificar HEADs antes de alterar arquivos.

| ID | Severidade | Arquivo / evidência | Problema confirmado | Correção exigida |
|---|---|---|---|---|
| C01 | P0 — bloqueio funcional | `electron/db.cjs` → `CREATE TABLE categories`; `src/app.ts` → `CategoryInfo` | **Não existe hierarquia nativa de subcategorias** no schema/tipos analisados; categoria é entidade plana. | Criar `subcategories` com FK para pai, IDs imutáveis, migração compatível e CRUD persistente. |
| C02 | P0 — integridade | `electron/db.cjs` → `transactions`, `bank_category_overrides`, `bank_transaction_splits`, `category_rules` | Esses vínculos registram **somente categoria**, não um `subcategoryId`. Regras e splits não podem persistir o filho aprovado. | Estender modelo/consultas/regras/splits/overrides preservando totais e dados legados; adicionar validação parent-child e tests. |
| C03 | P1 — compatibilidade | `categories(name PRIMARY KEY COLLATE NOCASE)`; `upsertCategory()` | A identidade atual é o **nome da categoria**. O código já tem rotinas de renomeação de referências, mas não um ID imutável para relacionamentos de filhos. Isso é um **risco técnico de migração**, não alegação de que rename atual esteja quebrado. | Introduzir IDs estáveis aditivamente, preservar coluna/FKs legadas e provar rename sem perda. |
| C04 | P1 — serviço ausente | `electron/main.cjs`, `electron/preload.cjs` | Na baseline, são expostas ações de categoria/regra/banco, **não CRUD de subcategoria**. | IPC validado com CRUD, snapshot/leitura e gravação supervisionada, sem SQL no renderer. |
| C05 | P1 — identidade visual | `src/app.ts` → `BUILTIN_EMOJIS`, `EMOJI_OPTIONS`, `CategoryEditor` | O app usa **emojis Unicode nativos**, dependentes da renderização do sistema operacional, e `CategoryInfo` armazena `emoji`; não usa registry SVG / `iconKey`. | Migrar progressivamente para registry vetorial local (67 glyphs já definidos), cores tonais por filho e fallback, preservando preferências legadas. |
| C06 | P1 — consistência transversal | `electron/db.cjs` + planejamento/orçamento/IA | O modelo existente não oferece caminho tipado para `{categoryId,subcategoryId|null}` entre sistemas. **É lacuna estrutural**, não erro constatado de algum relatório já emitido. | Estender contratos D01–D05, planejamento, orçamento e IA; agrupar pai = filhos + registros sem filho, sem dupla contagem. |

## B. Defeitos visuais observados **no protótipo anterior D05 V1** (captura do usuário)

| ID | Severidade | Evidência | Defeito | Correção herdada / gate real |
|---|---|---|---|---|
| V01 | P1 — contraste | Captura enviada pelo proprietário: card **Saídas confirmadas** em dark | O valor de despesa apareceu preto/quase invisível sobre superfície escura. | D05 V1.1/V1.2 atribui `--red` explicitamente a saídas e `--green` a entradas; Executor precisa validar contraste real no Electron. |
| V02 | P1 — contraste geral | Mesma captura: títulos/linhas do histórico e métricas | Alguns títulos e textos de destaque ficaram escuros/invisíveis por herança inadequada de estilos no protótipo. | Usar tokens `--text` explícitos em textos principais; QA dark/light, zoom 200% e WCAG AA. |
| V03 | P2 — direção artística | Captura e feedback | Emojis renderizados com formatos, tamanhos e backgrounds inconsistentes, incapazes de distinguir bem as categorias. | Remake aprovado com SVGs vetoriais padronizados e fundos coloridos específicos; 14 pais e 61 filhos. |

**Não confundir** defeitos da captura de **protótipo** com bug comprovado no Electron instalado: não houve captura comparativa/QA Electron deste design.

## C. Lacunas de verificação, **não erros reproduzidos**

- `prototype-subcategories.html`: 25 checks estáticos/isolados PASS, sintaxe JS válida; **nenhum teste real Playwright/Chromium de interações e layout**. Ícones podem precisar de polimento após screenshots reais.
- Nenhuma migração SQLite, API/IPC real, TypeScript prod, backup/restore, sync Cloudflare, PWA, CI CircleCI, installer Windows/EXE ou IA de escrita foi feita nesta missão de Design.
- Não há prova de integridade de dados com 630+ transações sintéticas em esquema novo; exigir migration dupla idempotente, regressões, perfis e revalidação dos vínculos.
- A persistência de ícones e classificações ainda está **somente no HTML demonstrativo**, não no produto. O usuário não autorizou aplicar reclassificações automáticas às movimentações antigas.

## D. Proteções inegociáveis para a entrega

1. **CÓDIGO obrigatório.** A issue #74 só pode ser fechada após migrations, schema, services, IPC, tipos, telas, IA/regras/recibos e testes reais.
2. **Sem reclassificação silenciosa.** Todo lançamento antigo recebe `subcategoryId=null` no novo modelo; “Sem subcategoria” é estado virtual, não uma linha de subcategoria persistida.
3. **Não perder vínculos financeiros.** Preserve IDs de banco, perfis, overrides, splits, links, categorias e orçamentos. Taxonomia não representa fluxo de caixa.
4. **Filho vinculado ao pai correto.** Backend rejeita filho de pai diverso, inclusive em regras, lotes e splits. Mudanças exigem prévia/versionamento.
5. **IA limitada por permissão.** `IC-READ` não autoriza `IC-CATS/IC-RULES`; nenhuma escrita pessoal da IA sem contrato/consentimento validado.
6. **Aprovação congelada:** 14 pais, 61 filhos, glyphs e paleta aprovados; apenas correções visuais/funcionais de QA sem refazer a direção.

## E. Próximo passo formal

Arquiteto/Integrador atribui Executor à [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74) com **E1 SQLite → E2 serviços/regra/IA → E3 UI+QA** e PR próprio. O Executor deve atualizar checklist com **PR/branch/HEAD, migration executada, testes PASS/FAIL/NOT_RUN, screenshots Electron**, bloqueios e dependências. Concluir só após a aplicação usar realmente subcategorias vinculadas, persistidas e testadas.
