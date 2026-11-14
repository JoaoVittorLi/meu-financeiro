# D05 V1.5 — Hierarquia da transação e revisão integrada

**Estado:** `PROTOTYPING / WAITING_FEEDBACK` — **não aprovado**. A taxonomia de **14 categorias, 61 subcategorias e 67 ícones** continua **aprovada**, sem alteração. A implementação real permanece bloqueante em #74.

## Feedback do proprietário
“O título da transação tá muito difícil de identificar” e “o A revisar ficou MUITO feio, tá sem concisão visual nenhuma”, após ver V1.4. Não confundir feedback visual do protótipo com falha validada no Electron.

## Correção de design V1.5

### TX-01 — Identidade primeiro
- Nome da transação passa a ser a âncora visual: tamanho entre 13,5–14px, peso 740–800, cor `--text` forte nos temas escuro e claro, limite 1 linha com ellipsis e tooltip de texto integral. Não usar opacity/filtros na linha.
- Fonte/conta e trilha `Categoria › Subcategoria` ficam em 2ª linha, 10–11px, cor `--muted`, com espaçamento claro; o título não divide o mesmo nível hierárquico com metadados.
- Cabeçalho de data somente com data e linha fina; **sem N registros**.
- Ícone colorido continua o único botão de classificação, sem botão `Categoria⌄`.
- Montante ocupa coluna própria alinhada à direita, valores negativos `--red`, positivos `--green` e transferência neutra.

### TX-02 — Revisão contextual sem badge solto
- **Eliminar** microstatus `A revisar` abaixo do preço; preço deve ocupar apenas uma linha, sem status monetário empilhado.
- Estado `POSTED + reviewed` não tem selo. `POSTED + !reviewed` apresenta um **pequeno ponto âmbar + “Revisar”** anexado à linha de metadados da movimentação, com tipografia coerente (cor âmbar mais sutil); não usar card/caixa/linha separada nem label bancária “Confirmada” em paralelo.
- `PENDING` mostra **ponto e “Em processamento”** integrado aos metadados, sem `Revisar` concorrente; status de revisão continua independente no detalhe.
- No detalhe mostrar separadamente `Situação bancária` e `Situação de revisão`. `MANUAL` continua apenas origem, sem selo de banco.
- Para a ação em massa, seleção deve ficar com o componente premium custom, nunca checkbox nativo. Nenhum hover animado deve ofuscar o título.

### TX-03 — Densidade, recorte e contraste
- Row min-height 63–68px com layout `[select] [ícone 42px] [nome + metadados] [valor]`. Gap 10–12px, alinhamento vertical centrado.
- Nome de fornecedor legível e prioritário; informação secundária pode quebrar em mobile/1366 sem colidir com valor; não reduzir título abaixo de 12px na viewport-alvo.
- Estado de revisão visível como contexto, não como alerta de erro nem tinta vermelha. Pontos de atenção em `--amber` com contraste AA.
- Contêineres D01–D04 premium dark/light, foco e keyboard/reduced-motion.

## QA/critério
1. Nome “Supermercado Avenida”, “Mercado Central”, “Cafeteria” e “Transferência própria” legíveis.
2. “A revisar” **não aparece na coluna do valor**; só “Revisar” na linha de metadados, um único eixo visível.
3. “Confirmada + A conferir” nunca aparece na lista; PENDING “Em processamento” não é confundido com review; detalhamento mantém ambas as informações.
4. Sem contador de registros no cabeçalho de dia; seletor V1.4 continua por ícone.
5. Testar dark/light, 1366×768 e 1920×1080, zoom 125/200, linha longa, status longo, scroll e foco no Electron. **Ainda não executado.**

**Nenhum código do Electron, SQLite ou preflight foi alterado nesta missão de design.** Aprovação V1.5 somente após feedback expresso do proprietário.
