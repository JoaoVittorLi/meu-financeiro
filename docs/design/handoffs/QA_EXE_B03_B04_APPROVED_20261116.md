# MEU FINANCEIRO 2.0 — HANDOFF B03 + B04 (RODADA B) — DESIGN APROVADO

> **DESIGN_APPROVED pelo proprietário em 16/11/2026.** Aprovação explícita da versão **B03/B04 V2 — Movimentações D05 fiel ao Electron** após rejeição da proposta anterior que usava coluna de detalhes em vez de gaveta e retirava o clique direto no ícone.  
> **CODE_NOT_STARTED / WINDOWS_QA_NOT_RUN.** Este documento não autoriza alteração de produção, disparo de CI, merge, release ou gravação financeira sem execução/validação separada.

**Repositório:** `JoaoVittorLi/meu-financeiro`  
**Base verificada em 16/11/2026:** PR #76, `integration/mf2-rc-all-01-i2a-20261113`, HEAD `1bc1b89bf5bdefc0196b0851e690a99f825ca85a` (revalidar antes de implementação).  
**Questão-mãe:** #84; **Integração/ownership:** PR #76 e coordenação #49; **catálogo D05:** #70 e PR de design #57.  
**Dependências aprobadas:** [B01 V3 + B02 V7](./QA_EXE_B01_B02_APPROVED_20261116.md), [contrato de identidade visual global](./GLOBAL_CATEGORY_VISUAL_IDENTITY_CONTRACT.md).

## A. Invariantes de produto — não negociar

1. **Tela D05 real permanece completa:** métricas e indicadores no topo, filtros, busca, abas de revisão, seleção em lote e histórico agrupado; preservar semântica de receitas/despesas, fontes, período e revisão.
2. **Clique no ícone da linha → edição da categoria** (abre seletor B04 imediatamente). **Clique no nome/corpo da linha → detalhe na gaveta lateral direita** (B03). São alvos de ação distintos; não pode haver propagação dupla.
3. **Detalhes = drawer RIGHT OVERLAY**, sobre a tela existente; **NUNCA** painel fixo na direita, bloco abaixo da lista ou nova página. Backdrop, X, Escape, foco e scroll da lista preservados.
4. **Mesma identidade D05** (iconKey + hue + nome, inclusive emoji legado se exigido) em: ícone da linha, detalhes, seletor, recibo de classificação, Últimas Movimentações e componentes de orçamento/visão geral. Resolver por `categoryId/subcategoryId`, não por nome, merchant ou `kind`.
5. **Sem escrita automática por clique visual.** Alterar classificação exige escopo correto, prévia, consentimento explícito/reconfirmação e retorno real de sucesso pelo serviço autorizado. Na UI de demonstração, essa ação foi simulada exclusivamente com dados fictícios.

## B03 — Movimentações + gaveta lateral

### Layout aprovado (V2)
- Sidebar do MF2, título e resumo `Movimentações`, cartões de Entradas, Saídas, Resultado e A conferir, histórico por dia, filtros e busca.
- Linha com áreas distintas: seleção para lote (quando permitida), **botão de ícone** com SVG D05, **botão de corpo** com descrição, origem, categoria/subcategoria e valor alinhado. Estados `POSTED`/`PENDING` e revisão aparecem em metadados, não substituem o ícone.
- Ao clicar no nome/corpo, exibir gaveta lateral com categoria/subcategoria atual, valor, data, descrição, origem e status; o ícone da gaveta e o botão `Alterar` abrem a mesma classificação.
- A gaveta pode ser mantida sob o seletor enquanto uma classificação é revisada, porém deve voltar com identidade atualizada após **sucesso confirmado**. Cancelamento não altera nada.
- O ícone no histórico só deve mudar depois da aplicação bem-sucedida. Revalidar filtro/seleção/histórico sem invalidar ações do usuário.

### Fonte real no código
- `src/d05-movements.ts`: handler atual `.d05-row-icon` → `openPicker(e,r)`; clique na descrição/corpo → `host.openBankDetail(r.raw)` ou `host.openManualDetail(r.raw)`.
- `src/app.ts`: `renderDetailDrawer`, `mf-drawer-backdrop`, `mf-detail-drawer`; o integrador deve preservar ambos os contratos de ação.
- Corrigir pontos legados que ainda exibem `cat.emoji` ou icon por `kind` segundo o contrato global. Não criar implementações paralelas que falhem na mesma transação entre lista/detalhe/resumo.

## B04 — Seletor D05 premium

### Layout aprovado (V2)
- Seletor contextual desencadeado pelo **ícone**: quando houver espaço, preservar ancoragem e leveza; para o desktop, permitir overlay/modal até ~730px de largura, sem renderizar como coluna fixa. A prévia pode abrir em modal ampliado para comportar afetados. Prioridade absoluta para resposta correta ao clique.
- Grade dos **14 pais** em quatro colunas no desktop amplo, três no intermediário, duas no mobile, com SVG e hue D05; não criar um novo catálogo. **61 subcategorias** pesquisáveis.
- Busca única, inclusive por acentos, em pais e filhos; resultados de filho identificam o pai.
- Fluxo **pais → filhos / somente pai → prévia Antes/Depois → confirmação → recibo real**.
- Para lote, mostrar quantidade, nomes/valores afetados, exceções e recálculo de `previewVersion`; consentimento não fica pré-marcado. Não confirmar quando `previewVersion` desatualizado, status/consentimento não habilita ou escrita indisponível.
- Os registros `PENDING` devem obedecer à regra atual do domínio e autorização, **não** serem recategorizados silenciosamente pelo protótipo.
- Layout/teclado: foco inicial no seletor, Escape cancela, foco retorna ao ícone, click-outside cancela sem gravação, max-height ~90vh, mobile com rolagem interna apropriada e sem overflow.
- Contexto de lote/documentos técnicos não aparece como mensagem permanente ao cliente.

## Contrato transversal (bloqueante)

O resolvedor global aprovado **não é uma recomendação opcional**. Os 67 SVGs, 14 pais/61 filhos e seus `hue` devem ser fornecidos juntos por **um descriptor**; o `legacyEmoji` caso exigido deve ser derivado desse mesmo ID. O executor deve remover renderização independente por `info.emoji`, `cat.emoji`, `palette[index]` e `kind` onde usados incorretamente. Em agregados, pai; em transações, filho se válido, senão pai; em custom/legado, fallback estável e sem recategorização de dados.

## QA de aceite (após código)

| Cenário | Resultado obrigatório |
|---|---|
| Clique **ícone** em Netflix | abre B04, **não** abre drawer |
| Clique **nome** em Netflix | abre drawer à direita, **não** abre B04 |
| Clique no ícone **dentro** do drawer | abre B04 com transação correta |
| Cancelamento (Esc/X/outside) | nenhuma mudança; foco retornado |
| Confirmar Netflix → Lazer/Cinema | somente após serviço bem-sucedido, lista/drawer/resumo apresentam novo `iconKey,hue` |
| Netflix antes, Spotify depois, Assinatura pai sem filho | `tv` hue270, `headphones` hue277, `repeat-2` hue282, respectivamente |
| Um pai/filho não reconhecido | fallback controlado e rótulo preservado |
| Classificação em lote | linhas afetadas legíveis, reconfirmação e bloqueio de snapshot obsoleto |
| POSTED/PENDING, manual/banco, transfer/ignore | contratos de elegibilidade intactos |
| Visual | 1366×768 e 1920×1080, tema dark/light, responsividade, zoom, reduced-motion, nomes e valores grandes |
| Regressão | TypeScript, testes D05, contratos de revisão, SQLite, ledger, smoke Playwright/Electron, capturas reais |

**Entregáveis de engenharia:** PR de código separado, testes e evidências reais do Electron, tabela `PASS/FAIL/NOT_RUN`, relato dos contratos preservados e handoff final ao Integrador. O mock de design **não** comprova a execução desses gates.

## Decisão/roteamento

- **B01 V3** — DESIGN_APPROVED; **B02 V7** — DESIGN_APPROVED; **B03 V2** — DESIGN_APPROVED; **B04 V2** — DESIGN_APPROVED.
- **B05 Inteligência / hierarquia visual** — próxima entrega de design do QA #84, ainda **NOT_STARTED/NOT_APPROVED** neste recorte.
- Integrador deve verificar HEAD atual, branch ownership/colisões (`src/app.ts`, `app/*.css`, `src/d05-movements.ts`) e agendar desenvolvimento supervisionado. **Nenhum patch, build ou merge foi realizado por este handoff.**
