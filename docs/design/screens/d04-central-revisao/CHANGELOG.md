# D04 — Central de Revisão · Changelog

## 13/11/2026 — V1.1 FINAL, direção V1 aprovada e polida

**Mensagem de aprovação:** “Aprovo a direção da D04 Central de Revisão V1. Faça o polimento visual final, revise as interações e prepare o handoff para o Executor.”

**Status:** `DESIGN_APPROVED / IMPLEMENTATION_READY`, **não** `IMPLEMENTED` e **não** `HOMOLOGATED`.

### Preservado da V1
- Sidebar Premium Meu Financeiro, hero leve com contador real de pendências, fila com busca/filtros e detalhe selecionável, antes/depois visual, lista de afetados/valores, escopos histórico/futuro separados, editar/recusar/adiar/reconfirmar.
- Cores e hierarquia D01/D02/D03; modais com checkbox desmarcada; mensagens de conclusão somente na demonstração.

### Polimento da V1.1
- Filtro e pesquisa sincronizados com item aberto: se o item some, detalhe muda ou mostra vazio.
- Cores, bordas, tipografia e gradientes mais coesos; textos principais explícitos nos temas escuro e claro.
- Rascunho de edição isolado e retido durante troca de cor, busca/filtro e navegação entre propostas; descartar não altera a proposta.
- Correspondências recalculadas ao editar termos com exclusões por ID preservadas quando compatíveis.
- Escopo `futuro` independente de `anteriores`: zero histórico quando desativado; bloquear se não houver ação elegível.
- Valores em centavos inteiros; R$177,50 de cinco assinaturas; retirar Spotify R$21,90 → R$155,60; Mercado Central R$389; limite R$700→R$800 sem criar saldo.
- Conclusões locais com texto explícito de demonstração; nenhum sucesso bancário ou regra pessoal prometidos.
- Modal de reconfirmação desmarca consentimento em cada abertura e confronta revision da prévia antes de concluir estado local; no app, revalidar no backend ainda é obrigatório.
- Estados de recusada/adiada no histórico e reabrir; adiar não cria lembrete.
- CSS responsivo, hover discreto, Escape, foco básico em modal, reduced-motion.

### Evidência
- `prototype.html` publicado no GitHub e reaberto para revisão; JS parseado e modelo isolado testado com 12 casos, todos PASS. Correções finais de editor parseadas depois da execução isolada.
- Não foram feitos screenshots reais Chromium/Playwright/Electron ou testes de integração de serviços. O pacote de design não contém alterações em código de produção.
- O usuário não revisou uma captura pixel-a-pixel adicional da V1.1: o polimento foi solicitado após aprovar a **direção V1**; nenhum gate de homologação Electron foi reivindicado.

### Próximos passos
- Executor: issue de implementação C1/C2, QA real com capturas, contratos IC-*.
- Designer: próxima tela D05 Movimentações, sem atrasar o roadmap.
