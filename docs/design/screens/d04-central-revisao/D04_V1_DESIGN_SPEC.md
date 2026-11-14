# D04 — Central de Revisão · Design V1 em revisão

**Histórico:** V1 inicial, cuja **direção foi aprovada pelo proprietário em 13/11/2026**. O polimento V1.1 foi autorizado e publicado em [Design Spec final](DESIGN_SPEC_APPROVED.md), [protótipo canônico](prototype.html), [contrato](BEHAVIOR_SPEC.md), [QA](ACCEPTANCE.md) e [handoff](HANDOFF.md). Issue #67; roadmap #55; Executor #69.  
**Esta V1 é histórica.** V1.1 está `DESIGN_APPROVED / IMPLEMENTATION_READY`, mas **não implementada/homologada no Electron**. A direção foi aprovada em chat e a versão polida está no GitHub.

## Referências de design
- D01 Chat Lateral V4.5: proposta→prévia→edição→reconfirmação→recibo verdadeiro; contrato de segurança para grant/version/fonte/escopo.
- D02: 26 famílias de resposta padronizadas; previews, diffs, tabelas, heat scale só quando adequados.
- D03 V2: gradiente esmeralda discreto, tipografia premium contrastante, microinterações justificadas, hierarquia limpa, sem elementos técnicos no cliente.
- Código legado: `src/intelligence-view.ts`, `app/intelligence-review.css`; contrato `docs/ai-context/INTELLIGENCE_UI_CONTRACT_V1.md`. IC-REVIEW continua isolado no perfil sintético; escrita pessoal pela IA **não liberada**.

## Tela única V1
- Navegação lateral e breadcrumb `Inteligência / Central de revisões`, sem abas triplas do chat.
- Cabeçalho com quantidade **derivada** de decisões pendentes, não contador estático.
- Coluna de fila: busca, filtros Pendentes/Concluídas/Todas, item selecionado e resumo; nenhum botão inerte.
- Coluna de detalhe: seleção de proposta e antes/depois. Três famílias demonstrativas: categoria + regra Streaming (5 lançamentos, R$177,50), uma recategorização Mercado Central (R$389), limite Alimentação R$700→R$800.
- Editor em rascunho: nome, termos e cor (regras), valor (orçamento); desfazer rascunho e invalidar consentimento anterior.
- Prévia de escopo: histórico e futuras transações **independentes**. Lançamentos selecionáveis com soma e contagem calculadas. Regras futuras nunca são apresentadas como valor financeiro certo.
- Reconferência em etapa dedicada, com confirmação sempre desmarcada e explicação do escopo/impacto; modificar rascunho, conta, perfil ou prévia invalida confirmação anterior.
- Recusar/adiar atualizam estado local **somente do protótipo**, sem promover escrita. Estado vazio e histórico são desenhados.
- Recibo real apenas com resposta da API autorizada; no protótipo, mostrar **conclusão local ilustrativa, sem alteração de dados pessoais**.
- Contraste AA, foco e teclado, Escape, mobile stack, motion 150–240ms e reduced motion.

## Valores para comparação
Assinaturas: Netflix R$44,90; Spotify R$21,90; Disney+ R$43,90; duas assinaturas de R$33,40; soma R$177,50.  
Mercado Central: R$389,00 em Outros → Alimentação.  
Orçamento: valor atual R$700,00, sugestão R$800,00, gasto observado R$760,00; mudar limite não altera caixa nem gera economia.

## Gates para aprovação visual
Testar tema, seleção da fila, busca/filtros, editar/cancelar/salvar, checkboxes/escopos/soma, reconfirmação desmarcada, recusar/adiar, histórico, seleção ao sair de filtro e feedback honesto. Nenhum passo deve parecer aplicação real em perfil pessoal. Depois de aprovação explícita, `DESIGN_APPROVED` e handoff; QA Electron fica separado.
