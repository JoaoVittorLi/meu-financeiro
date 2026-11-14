# EXECUTOR HANDOFF — D04 Central de Revisão Premium V1.1

**Status:** `IMPLEMENTATION_READY` (design aprovado) — **produto NÃO IMPLEMENTADO neste PR de design**.  
**Autorização do proprietário:** aprovou direção V1 e solicitou polimento final, revisão de interações e handoff em 13/11/2026.  
**Issues:** #67 design · #49 coordenação · #55 roadmap · PR Draft #57 pacote documental.  
**Baseline funcional:** PR #54 `feat/mf2-premium-productivity-sprint-20261112`, **consultar HEAD real e branches atuais dos executores antes de editar**.

## Referências que devem ser abertas antes da implementação

1. [prototype.html](prototype.html) — tela completa V1.1, interface premium e comportamentos demonstrativos.
2. [DESIGN_SPEC_APPROVED.md](DESIGN_SPEC_APPROVED.md) — anatomia, estilo e decisões congeladas.
3. [BEHAVIOR_SPEC.md](BEHAVIOR_SPEC.md) — máquina de estados e revalidação de capacidade/previews.
4. [FIXTURES.json](FIXTURES.json) — categorias e movimentos sintéticos com IDs/valores em centavos.
5. [ACCEPTANCE.md](ACCEPTANCE.md) — testes já feitos (isolados JS) e os gates reais ainda não executados.
6. D01 V4.5 `docs/design/screens/d01-chat-lateral/BEHAVIOR_SPEC.md`, D02 V3, D03 V2; contrato `docs/ai-context/INTELLIGENCE_UI_CONTRACT_V1.md`.

## Missão

**Implementar código funcional React/TypeScript/Electron**, não entregar somente auditoria ou screenshot de HTML. Convergir a Central legada `renderCategoryReview`, a fila de propostas no `src/intelligence-view.ts` e os estilos `app/intelligence-review.css` para uma experiência D04 unificada; manter as capacidades e proteções atuais, sem dar poderes novos à IA.

Trabalhe em **branch própria e PR Draft de integração**, preferencialmente dois checkpoints; não fazer merge em main, EXE, CI pago ou escrita financeira pessoal sem autorização.

### C1 — Shell e fila funcional

- Analisar as implementações atuais e evitar sobrescrever mudanças de outros executores. Inspecionar tipos, IPCs, services e gates, comparar bases/SHAs.
- Implementar layout desktop Premium: breadcrumb `Inteligência > Central de revisões`, fila selecionável e pesquisável, `Pendentes/Histórico/Todas`, detalhe `Antes → Depois`, contagem real por status e empty state honesto.
- Estados: loading/ready/empty/partial/stale/denied/offline/error e rascunho; cor e tipografia legíveis dark/light; no mobile, detalhes em stack.
- Fila usa ID estável de proposta; ao mudar filtro/pesquisa, limpar detalhe de item oculto ou selecionar primeiro visível; preservar rascunho de edição quando navegar.
- Três tipos tipados: `category_rule`, `category_change`, `budget_change`. Integrar com contratos reais de origem, sem fabricar a fila do usuário a partir das fixtures.
- Seleção da regra: cinco lançamentos sintéticos totalizam R$177,50; excluir Spotify R$21,90 produz R$155,60; atualizar escopo histórico zera impacto passado. Testes unitários em centavos.
- Manter o preview existente e conectividade com D01/D02/D03: o usuário pode chegar a D04 por proposta da IA ou movimentação, mantendo contexto, IDs e conta.

### C2 — Editor, reconfirmação e QA real

- Editor em rascunho isolado (nome/termos/cor/categoria/limite). Cancelar restaura a proposta anterior. Salvar reconsulta matches e invalida preview/consentimento; preserva exclusões manuais compatíveis.
- Independência histórica/futura e limites. Não chamar efeito no perfil real somente por `Concluir revisão`; no **fluxo IA pessoal** usar somente simulação/proposta enquanto as capacidades não estiverem liberadas. Fluxos manuais explícitos continuam disponíveis pelo contrato individual.
- Modal de reconfirmação forte: snapshot/previewVersion, perfil/grant, escopo, contas, fontes, transações/valor e exclusões; checkbox desmarcada em toda abertura. Prévia stale/expired/conflitada bloqueia apply.
- `categoryReviewConfirm` apenas no perfil sintético em que IC-REVIEW está habilitado, com retorno/recibo real. No pessoal, não há "aplicação" no mock; exibir disponibilidade real sem fake successes.
- Recusar/adiar/histórico: estados reais; lembrete só se backend de agenda/automação confirmar. Undo somente se operação permitida e não conflitante.
- Corrigir regressões concretas, executar testes unitários, TypeScript/SQLite, F08/ASAR, testes Electron sintéticos e screenshots de Electron 1366×768/1920×1080 em claro e escuro. Explicitar PASS/FAIL/NOT_RUN; anexar capturas e SHA ao PR.
- Testar teclado/Tab/Escape/restauração de foco, reduced-motion, botões todos ativos, contrastes WCAG AA, zoom 200%, layouts narrow e situações offline/permission denied.

## Obrigações de integridade

- **IC-READ:** autorização de leitura não implica escrita.
- **IC-REVIEW:** revisão/confirm/receipt no estado real de implementação é **somente sintético** hoje.
- **IC-CATS/IC-RULES/IC-MOVE:** caminhos manuais existentes podem editar dados pessoais, mas não podem ser invocados automaticamente pela IA como se fosse uma capacidade de apply já autorizada.
- **IC-PLAN:** orçamento/plano é referência de planejamento, não saldo disponível.
- **IC-LLM:** pode explicar e sugerir; não decide IDs, valores, elegibilidade nem previewVersion.
- Sem transferir fixtures/demo para contas reais. Sem tokens/credenciais em logs. Sem fake receipt nem falso sucesso parcial.

## Entregável do Executor

Publicar branch, PR Draft, HEAD, lista de arquivos modificados, evidência real por C1/C2, problemas conhecidos, testes executados/não executados e matriz das capabilities. Nenhum "código pronto" baseado apenas no protótipo HTML.

## Próxima ação / coordenação

**Arquiteto** atribui issue de implementação D04 ao executor adequado, coordena conflitos com PRs de Inteligência/Design e decide gates de merge. **Designer** segue D05 Movimentações enquanto Engenharia implementa D04. Não abrir novo ciclo de aprovação por microcard, salvo regressões concretas apontadas no QA.
