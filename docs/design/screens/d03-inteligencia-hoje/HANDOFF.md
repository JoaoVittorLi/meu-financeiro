# EXECUTOR HANDOFF — D03 Inteligência Hoje V2 Aprovada

**Estado:** `IMPLEMENTATION_READY (design)` · **Produto:** `NOT_IMPLEMENTED` no PR de design.  
**Autorização do proprietário:** D03 V2 aprovada em 13/11/2026. **Não** fazer merge em `main`, gerar EXE, gastar CI pago nem ativar escrita financeira pessoal.  
**Integração/contrato:** issue #49; design D03 issue #61; pacote documental PR Draft #57; baseline funcional PR #54.  
**Entrada obrigatória:** [prototype.html](prototype.html), [DESIGN_SPEC_APPROVED.md](DESIGN_SPEC_APPROVED.md), [BEHAVIOR_SPEC.md](BEHAVIOR_SPEC.md), [D03_V2_APPROVED_FIXTURES.json](D03_V2_APPROVED_FIXTURES.json), [ACCEPTANCE.md](ACCEPTANCE.md).

## Missão de execução (não confundir com design)

Implementar no Electron a **tela completa D03 Inteligência Hoje**, com a direção visual exata dos três cards esmeralda e motor de prioridades derivadas de dados verificados, preservando fluxos D01/D02 e proteções financeiras. **Não se limitar a auditoria ou mock.** O usuário pediu avançar o roadmap; preferir um PR Draft e até dois checkpoints funcionais com testes reais.

### Antes de editar

1. Confirmar HEAD atual de PR #54 / branches de integração e de Inteligência; **não usar SHA histórico como se fosse o HEAD atual**. PR #54 estava no `55de81c...` no momento deste handoff, mas pode avançar.
2. Revisar implementações reais `src/intelligence-view.ts`, `app/intelligence.css`, `app/design-system.css`, `src/app.ts`, `app/index.html`, testes e contratos `docs/ai-context/INTELLIGENCE_UI_CONTRACT_V1.md`. Levantar mudanças já integradas por outros executores sem sobrescrevê-las.
3. Criar branch própria de implementação, de base funcional segura, sem merge na main e sem empurrar CSS de design diretamente sobre produto sem integrar classes.

### C1 — Estrutura, renderização, fontes e cenários

- Substituir a apresentação sobrecarregada de `renderIntelligencePremiumToday` (oito cards `UI-01`–`UI-08`) por D03: hero → 0–3 `SignalCard` → agenda e revisão quando válidas → painel de análise/contexto sob demanda.
- Usar sidebar, tipografia, cores, gradient, padding, raio e botões em linha com `prototype.html` e D01 V4.5. **Todos os SignalCard compartilham mesma primitiva visual**, independente de sinal. Em especial, os dois primeiros não podem parecer cartões diferentes do terceiro da referência.
- Não reintroduzir `Hoje/Conversar/Plano de ação` como tabs fixas pesadas dentro do chat. D03 é uma tela contextual própria, D02 mantém conversa principal, D01 chat lateral; preserve continuidade do histórico.
- Introduzir resolução `FinancialSnapshot` via serviços de leitura autorizados e `deriveTodaySignals` puro/testável. LLM pode ajudar no texto; não pode inventar saldo, limite, vencimento, categoria, lançamentos ou contagem.
- Implementar capacidade `verified/partial/stale/denied/none` por fato. Se saldo/pendências sem cobertura, indisponibilizar projeções; outros fatos verificados podem aparecer isoladamente sem mascarar parcial.
- Casos obrigatórios: saldo R$1700 → projetado R$1257 → reserva R$128,50; R$1150 → projetado R$707 → aperto; R$350 → projetado −R$93; R$1450 → projetado R$1007 e margem R$7; sem saldo, histórico revogado e limite zero.
- Não duplicar saldo nem subtrair despesa paga duas vezes. Tratar transferências e lançamentos pendentes corretamente; saldo disponível e previsão futura não são sinônimos.
- Se integração real do saldo não está pronta, mostrar estado útil não-autorizado/indisponível. **Nunca** injetar o fixture na conta do proprietário.

### C2 — Interações, refinamento, provas e QA

- Implementar drawer contextual para cada sinal; ajustar previsão em **rascunho separado**, previsões com valores/periodicidade e botão Restaurar. Atualizar cards, hero, agenda conforme fontes verificadas e overrides.
- Orçamento: diferença por limite, sem divisão por zero; análise detalhada categoria/grupo/lançamento usa VR-10 da D02. Entrega de propostas em **prévia**; só a D04 / confirmação D01 V4.5 pode aplicar se contrato explícito real autorizar.
- Conversar: sugestões derivadas dos sinais, histórico compartilhado, sem repetição do mesmo follow-up após uso. Não perder dados entre D01/D02/D03.
- Conservar um botão real/funcional por ação; se backend indisponível, desabilitar e explicar, não mostrar sucesso falso.
- Animações sutis condicionadas ao dado confirmado; movimentos reduzidos desabilitados; foco, contraste, responsividade, mobile e reabertura sem conteúdo duplicado.
- Executar suite oficial (TypeScript, testes, SQLite, Playwright/Electron, smoke e screenshots em 1366×768/1920×1080 dark/light). Registrar no PR os comandos, resultado real e capturas. Sem acesso a ambiente: marcar `NOT_EXECUTED` e não fingir homologação.
- Fazer correção de regressões concretas, sem ciclos de documentação intermináveis. Preferir PR Draft com dois checkpoints C1/C2, e até dois ciclos de QA.

## Contratos de segurança que não podem ser violados

1. **Leitura:** `IC-READ` e qualidade de dados por fonte/consentimento, sem acesso implicitamente global.
2. **Revisão:** `IC-REVIEW` em isolado/sintético até autorização verdadeira. Seleção de afetados, preço e escopo sempre revalidam previewVersion.
3. **Categorias/regras:** `IC-CATS` e eventual contrato de regras exigem reconfirmação, diff, IDs e proteção contra stale; nenhum APPLY real pela D03.
4. **LLM:** `IC-LLM` é complementar e não deve segurar o UI básico; cálculos determinísticos em centavos.
5. **Recibo:** só se houver retorno real de backend, com idempotência/undo elegível. Não mudar estado de transação por clique em card.
6. **Outros fluxos:** preservar D01 V4.5, D02 biblioteca de 26 famílias, dados financeiros, funcionalidades de Planejamento/Contas e bandeiras de autorização existentes.

## Critérios de entrega e documentação de PR

- Link do PR Draft, branch, HEAD SHA e resumo de arquivos modificados.
- Matriz **implementado / testado / não testado / bloqueado** por C1 e C2; anexar evidência real visual Electron, nunca screenshot de protótipo chamada de produto.
- Testes financeiros de projeção em centavos, comparações, fonte parcial e histórico desautorizado.
- Checklist UX: título e valor legíveis dark/light, cartões consistentemente esmeralda, sem textinhos técnicos UI-*, botões realmente funcionando, zero overflow, foco/teclado.
- Verificar `prefers-reduced-motion` e degradar graciosamente em ausência de dados.
- Sem merge em `main`, sem EXE, sem CI pago e sem escrita financeira pessoal até autorização explícita do proprietário/Arquiteto.

## Encaminhamento para o Arquiteto

O design da D03 está **aprovado**; engenharia pode implementá-lo coordenadamente com os trabalhos de Inteligência existentes. Em paralelo, **o Designer avança para D04 — Central de Revisão**, a próxima tela macro. O fechamento D03 como `IMPLEMENTED` depende de provas de execução, não desta documentação.
