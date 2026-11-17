# D03 — Inteligência Hoje | Protótipo de tela completa V1

**Status:** `PROTOTYPING / WAITING_FEEDBACK`. 13/11/2026. **Não aprovado**, não implementado no Electron.
**Issue:** #61; **roadmap:** #55; **precedências:** D01 V4.5 (design aprovado), D02 Biblioteca Visual V3 (sistema consolidado).

## Diagnóstico factual do app (branch de base: feat/mf2-premium-productivity-sprint-20261112)

No `src/intelligence-view.ts`, `renderIntelligencePremiumToday` já renderiza oito contratos/cards UI-01 a UI-08: radar de atenção, revisão, orçamentos, compromissos, regras, categorias, conversa e histórico. A tela apresenta texto de operação/contrato (`UI-03 · RADAR FINANCEIRO`) e usa `intelligenceTab` para navegação `Hoje / Conversar / Plano de ação` no método `renderIntelligenceView`. A interface atual concentra conteúdo, enquanto o proprietário já rejeitou esta hierarquia pesada. Preservar serviços e lógica já existentes; redesenhar a apresentação e a seleção editorial.

## Direção V1

Um **panorama proativo de valor próprio**, não um resumo mensal e não uma réplica de D02. Desktop Windows com sidebar idêntica à aprovada em D01; corpo sem três tabs permanentes. Organização:
1. Contexto leve: `Seu dia financeiro`, data, estado de conexão somente se material para a interpretação.
2. **O que merece atenção:** 1–3 prioridades verificáveis, ordenadas por impacto/contexto; cada uma contém evidência, intervalo, impacto e CTA.
3. **Próximos compromissos:** linha do tempo concreta (data, valor, status), total previsto e diferença entre agendado/registrado.
4. **Oportunidade contextual:** hipótese de economia apoiada em lançamentos, com simulação determinística de redução, nunca sucesso garantido.
5. **Revisões supervisonadas:** proposta aguardando conferência em superfície discreta; a D03 apenas direciona à Central D04 / D01, sem replicar todo o fluxo.
6. **Espaço de análise sob demanda**: painel lateral com contexto de card, período, categoria, grupo e detalhe. Não ocupar 30% da tela permanentemente.

## O que não entra

- `Hoje / Conversar / Plano de ação` como barra de abas persistente no chat.
- Cards UI-* ou indicadores de desenvolvimento visíveis.
- Perguntas fixas repetitivas, alertas inventados, porcentagens comparando períodos não equivalentes.
- Copiar a D02 (chat grande) em um card da tela Hoje; conversa contextual abre sob ação.
- Autorização implícita de escrita financeira real por clicar em `Aplicar`.

## Fixture de demonstração

`13/11/2026`, janela `01–13/nov` comparada com `01–13/out`, valores sintéticos: Outubro R$ 2.100 e Novembro R$ 2.727; Δ + R$ 627. Categorias (R$) moradia 1000/1000; alimentação 480/760; lazer 250/380; transporte 200/240; saúde 110/228; serviços 60/119. Limite Alimentação R$ 700, excedido R$ 60. Delivery R$150 → R$340 (+ R$190), 67,9% da diferença de Alimentação. Próximos agendamentos sintéticos: 16/11 energia R$220, 20/11 internet R$119, 22/11 academia R$104, total previsto R$443. Proposta de regra Streaming, cinco lançamentos e R$177,50 afetados, **somente prévia demonstrativa**.

Comparação de janelas iguais de 13 dias é *premissa sintética explícita*, não fato bancário. Todas as cifras e compromissos são mock; não há acesso à conta do proprietário.

## Interação V1

- Tema dark/light; cards de prioridade → painel contextual; clique de categoria → comparação e visual de heat sem barras sobre texto.
- Simulação de redução do delivery ajustável, em centavos, e texto com condição/horizonte, sem afirmar economia realizada.
- Agenda permite selecionar compromisso e mostrar próximos. Ação sobre proposta abre resumo e exclusões, não grava dados.
- Perguntas progressivas só com fatos autoritativos e histórico; no protótipo, respostas podem ser demonstrativas com rótulo de exemplo.
- Escape / fechar voltam à tela; cards preservam contexto e seleção no período. Mobile empilha agenda e cards, sem painel de análise permanente.
- Motion 150–240ms em feedback/entrada, sem mover valores durante atualizações não concluídas; `prefers-reduced-motion`.

## Estados e segurança

`ready/loading/empty/partial/stale/denied/offline/error` devem ser previstos na implementação; no protótipo V1, cenário de leitura é sintético `ready`. Se não há evidências, a tela deve mostrar um estado útil de instrução/autorização, não KPIs fictícios nem dicas alarmistas. O renderer nunca afirma gravação sem confirmação real do backend.

## Critérios de aceite visual

Uma tela leve e premium (1366×768/1920×1080), contraste dark/light, nenhum overflow horizontal mobile, hover e controles funcionais, hierarquia inteligível em 5 segundos, microanimações reduzíveis. Proprietário deve aprovar V1 ou solicitar ajustes. Design apenas; a implementação Electron e QA de produto são posteriores.
