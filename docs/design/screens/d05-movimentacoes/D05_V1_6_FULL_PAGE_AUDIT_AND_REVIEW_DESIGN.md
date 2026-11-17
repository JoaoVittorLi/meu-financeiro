# D05 V1.6 — Auditoria visual de página inteira e revisão do estado "A conferir"

**Estado**: `DESIGN_PROTOTYPING / WAITING_FEEDBACK`, **não aprovado**. **Aprovado e preservado**: 14 categorias principais, 61 subcategorias, 67 SVGs, identidade cromática hierárquica e clique no ícone para classificar. **Engenharia #74 continua em aberto** até SQLite/IPC/IA/QA realmente funcionais.

**Fonte principal**: duas capturas de tela da D05 V1.5 enviadas pelo proprietário em 13/11/2026 no chat de Design (arquivos de imagem no próprio chat; não presumir que estão versionados no GitHub). Feedback explícito: “Revisar ainda ficou ruim”, “checkbox do dia também ser padrão”, analisar página completa e pesquisar referências de grandes apps financeiros. **Os problemas visuais apontados pertencem ao protótipo**, sem alegar reprodução no Electron instalado.

## 1. Auditoria dos dois prints — elementos, achados e ações

| ID | Prioridade | Elemento observado | Achado documentado | Melhoria obrigatória |
|---|---|---|---|---|
| V16-01 | P0 visual | Título `Movimentações recentes` | Contraste muito baixo/preto sobre fundo escuro no print. | Fixar `color:var(--text)` para títulos/h3 e auditá-los também no tema claro. |
| V16-02 | P1 | `Revisar` âmbar no metadado do iFood | Texto inline depois da trilha categoria/subcategoria compete com informação contábil e parece uma etiqueta solta. | **Remover integralmente o texto “Revisar” das linhas.** Novo indicador azul-claro de revisão pendente junto ao **nome** do estabelecimento, acessível e clicável, com tooltip “Revisão pendente”. A ação abre revisão rápida (não altera dado sem confirmação). |
| V16-03 | P1 | `Agrupar por dia` com square/check verde | Apesar de desenhado, visualmente parece checkbox do Windows, sobretudo no zoom e no dark. | Substituir por **switch próprio/segmented toggle** com trilho arredondado e botão móvel, `aria-pressed`/`role=switch`, estado ligado/desligado, hover e reduced-motion. |
| V16-04 | P1 | Quadrados vazios de seleção em cada linha | Ainda se parecem com `input[type=checkbox]` padrão e recebem pouco destaque no uso em lote. | Seletores **circulares vetoriais** de ~19–20px em área clicável >=38px; hover de contorno, check verde preenchido, estado `aria-pressed`. Exibir barra de ações somente com seleção ativa. |
| V16-05 | P1 | Card `A conferir · 06` | Bom resumo, porém sem conexão clara com uma fila executável; no extrato já existiam rótulos duplicados. | Transformar card em **atalho real** à aba/filtro `A conferir`; azul de revisão usado no número/ícone, sem acusar problema bancário. |
| V16-06 | P1 | Status bancário vs revisão | `POSTED`, `PENDING`, `reviewed` são eixos diferentes; UI anterior misturou “Confirmada / A conferir”. | Regra: POSTED+revisada nenhum indicador; POSTED+!revisada ponto azul ao lado do título; PENDING relógio discreto (texto “Em processamento” apenas nos detalhes/tooltip), sem confundir com revisão; detalhes mostram ambos estados. |
| V16-07 | P1 | Nome do estabelecimento | V1.5 melhorou (iFood/Supermercado Avenida legíveis), manter hierarquia que funcionou. | Merchant 13.5–14px 750–800, contraste AA, conta e `categoria › subcategoria` em 10–11px muted, sem termos de workflow nos metadados. |
| V16-08 | P2 | Cards 2×2 do topo | Em viewport da captura ocupam muito espaço; card de revisão tem mais valor operacional do que só número. | Ajustar altura/padding, alinhamento e interação; não introduzir texto técnico nem tornar tudo clicável sem propósito. Resultados financeiros sempre tabular nums, sem confundir “resultado” com saldo disponível. |
| V16-09 | P2 | `Seu histórico` e toolbar | Estrutura aprovada como direção, mas lacunas de densidade, controles com tamanhos diferentes e hit areas. | Normalizar 40px de altura de filtros, ajuste responsivo, destaque de busca/foco e toolbar contextual; manter filtros funcionais. |
| V16-10 | P2 | Divisores 13/12 de novembro | Data + linha sutil da V1.5 ficou adequada. | **Preservar; proibir retorno do contador `N registros` por dia**. |
| V16-11 | P2 | Ícones de categoria nos lançamentos | Fundos cromáticos aprovados e distintos, mas ação de trocar categoria precisa permanecer fácil de achar. | Preservar **clique direto no ícone**, sem `Categoria⌄`; tooltip/foco/hover e popover pai → subcategoria. |
| V16-12 | P1 engenharia | Filtros/contagens e seleção | Mudanças de filtro podem afetar card, seleção, ações em lote e o banco. | Mesmo universo de registros para totais; POSTED/PENDING separados, transfers/ignore fora E/S, reviews contados separadamente; IDs estáveis para bulk. |

## 2. Pesquisa externa verificada (acessada 13/11/2026)

- **Copilot Money (web/macOS)**: indicador **azul-claro para transações ainda não revisadas** em listas e ações rápidas/atalhos R para revisar, C para categoria e X para selecionar. Fontes oficiais: https://help.copilot.money/en/articles/11780342-copilot-money-for-web e https://help.copilot.money/en/articles/6778561-copilot-money-for-macos.
- **Monarch Money**: `Needs Review` por transação com filtros, checks de revisão, edição em lote e fluxo dedicado de revisão. Fontes oficiais: https://help.monarch.com/hc/en-us/articles/5528707082516-Reviewing-Transactions e https://www.monarch.com/blog/quicker-and-easier-transaction-review-and-more.
- **YNAB**: ícone de aprovação pendente separado de estado `cleared`; barra contextual de ação ao selecionar múltiplos itens; os eixos são distintos. Fontes oficiais: https://support.ynab.com/en_us/colors-and-icons-in-your-account-register-Hk_w6UBki e https://support.ynab.com/en_us/how-to-edit-and-delete-transactions-BJG4oS1s.
- **Rocket Money**: fluxo separado de `Category Review` com cards e aprovação/correção em mobile; categorização pode ser acessada pelo contexto da transação. Fonte oficial: https://help.rocketmoney.com/en/articles/13778317-transaction-category-review.

**Síntese própria** (não alegar cópia funcional): unir discrição de **Copilot** (ponto azul), organização operacional de **Monarch** (fila/filtro e ação individual), distinção semântica de **YNAB** (banco vs revisão) e revisão dedicada de **Rocket Money**. O código/arranjo deve ser original do Meu Financeiro.

## 3. Padrão aprovado? NÃO — candidato V1.6

### Revisão dentro da linha

- Mostrar `review-dot` junto ao nome, nunca acrescentar `Revisar` no texto da conta/categoria. Diâmetro 7–8px em target 26–30px, cor `--review-blue` com halo pequeno opcional. Se focus/hover, tooltip `Revisão pendente · Clique para conferir`, não depender da cor isolada.
- Clique abre **painel rápido de conferência** com merchant, conta, data, valor, categoria atual e subcategoria, fontes de classificação e botões `Marcar como revisada`, `Corrigir categoria`, `Agora não`. Não executar alterações só por mouse hover, e nenhuma escrita bancária real sem capacidades.
- O estado revisado não ganha badge verde na lista: o ponto some, sem ruído extra. Em filtro `A conferir`, ao revisar o registro ele desaparece da fila, contagem atualiza. `PENDING` não representa review e usa relógio próprio com tooltip; revisão só é concluída após ação expressa.
- Toolbar `A conferir` e card `06` abrem a mesma fila; ações em lote independentes de categoria, PreviewVersion em ambiente real.

### Agrupamento e seleção

- Agrupar por dia → switch `Agrupar por dia` custom (pílula 32×18, thumb 12px, deslocamento 14px, check de foco, reduz motion).
- Seletores de cada linha → círculo próprio (nada de `input type=checkbox` nativo), aria-pressed true/false, alvo de 38px, sem roubar clique do ícone de categoria. Seleção múltipla exibe toolbar com `Categorizar`, `Marcar revisadas`, `Limpar`.
- Não exigir checkbox no cabeçalho de **cada dia**; agrupamento não precisa de um controle por grupo. Caso funcionalidade de selecionar todos do dia seja solicitada futuramente, usar botão de ação separado, nunca checkbox Windows.

### Hierarquia do conteúdo

`[seleção] [ícone categoria] [NOME DO ESTABELECIMENTO   ◉ azul se não revisado]`   
`                                    [conta] · [categoria › subcategoria]             [− R$ 68,00]`

Sem `Confirmada` no extrato; status detalhado fica no painel. Cores financeiras positivas/negativas `--green`/`--red`, transfer neutro, categoria com matiz independente. Com `PENDING`, mostrar clock discreto junto ao merchant e descrição via tooltip/detalhe.

## 4. Critérios/gates

**Design**: exemplos obrigatórios iFood (!reviewed), Supermercado Avenida (reviewed), Uber (PENDING), Cafeteria (!reviewed), Aluguel (reviewed). Testar clique no ponto azul, revisão rápida, desaparecimento do ponto/fila e card, switch agrupar, seleção circular, ícone categoria pai→filho. Testar tema dark/light, mobile/1366/1920, foco/teclado e modo de movimento reduzido, com capture real.

**Código**: #74 bloqueia conclusão de SQLite/IPC/regra/subcategoria; revisão em lote e single devem usar revalidação da snapshot/IDs; backend impede alterar feed Pluggy e confundir PENDING/POSTED. **Nenhum Electron ou SQLite foi alterado na missão de Design V1.6**.

**Estado**: revisão visual **pendente de aprovação explícita**. O proprietário aprovou catálogo 14×61 anteriormente, não a V1.6 nem o fluxo de revisão rápida.
