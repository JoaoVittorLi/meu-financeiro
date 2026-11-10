# Rodada A — aprofundamento funcional do benchmark de fintechs

**Data:** 09/11/2026 • **Natureza:** pesquisa e especificação de possibilidades para 2.0; **NÃO AUTORIZA IMPLEMENTAÇÃO**.  
**Relacionados:** [Produto](PRODUCT_BLUEPRINT.md), [Roadmap](../ROADMAP_MF2.md), [Ideias](IDEA_REGISTER.md), [Rodada A publicada](reviews/2026-11-09-MF2-ANALYSIS.md).

## 1. O objetivo não é clonar fintechs

O que diferencia Copilot, Monarch, Quicken Simplifi, Rocket Money, PocketGuard, YNAB, Actual, Origin e outros é a capacidade de reduzir uma decisão complexa a **dados corretos + explicação + ação útil**. O Meu Financeiro 2.0 deve criar uma experiência própria:

**Gasto/compromisso detectado → consequência calculada → decisão simulada → ação autorizada → conferência em todas as telas/dispositivos.**

Todos os componentes novos devem reutilizar o motor canônico e ter origem de dados, estado de confiança, teste e comportamento offline definidos.

## 2. Matriz de diferenciais concretos e destino no produto

| Concorrente / recurso documentado | Valor real da experiência | Aplicação proposta | Marco | Prioridade |
| --- | --- | --- | --- | --- |
| **Monarch Flex Budgeting** | Separar fixas, não mensais e flexíveis; rollover | Orçamento simples/avançado com provisões por período e transferência controlada entre categorias | MF2-07 | Alta, após motor |
| **Copilot Dashboard/Cash Flow** | Gráfico útil, interação com lançamentos e categorias | Home com indicadores auditáveis, clique abre dados filtrados, comparação temporal válida | MF2-04 | Alta |
| **Copilot categorização/revisão** | Sugestões com atenção aos casos incertos | Revisão em 5 minutos, classificação com precedência manual e recibo de lote | MF2-05 | Alta |
| **Simplifi Watchlists** | Acompanhar estabelecimento/tag sem criar orçamento para tudo | Observadores de gasto, mensal/anual, projeção quando houver histórico suficiente | MF2-05/06 | Média |
| **Simplifi Projected Cash Flow** | Detectar déficits futuros por data e conta | Linha do tempo, menor saldo projetado, riscos e ciclos de recebimento | MF2-06 | Alta |
| **PocketGuard In My Pocket** | Resposta prática à disponibilidade para gastar | Saldo seguro com premissas, reservas, qualidade de saldo e impossibilidade quando sem base | MF2-06 | Muito alta, risco de integridade |
| **Rocket Money subscriptions** | Descobrir assinaturas e aumento de custos | Recorrências confirmáveis, custo anual, delta de preço, radar sem cancelamento falso | MF2-05/09 | Alta |
| **Actual Budget rules/schedules** | Regras transparentes e repetíveis | Motor de regras determinísticas com prévia, revisão e reversão dos overlays | MF2-05 | Alta |
| **Origin AI Advisor** | Resumo contextual e recomendações proativas | Radar com três ações priorizadas e explicação com base em indicadores reais | MF2-09 | Alta, após G2 |
| **Cleo conversação** | Ação partindo da conversa | IA que cria proposta de edição, mostra diff, valida e executa com consentimento | MF2-09 | Alta, segurança crítica |
| **YNAB targets/debt** | Priorizar objetivos e visualizar quitação | Metas/parcelas/juros/antecipação integradas ao fluxo, sem pagamento automático | MF2-07 | Alta |
| **Kinvo investimentos** | Diferença entre aporte, provento e valorização | Patrimônio líquido e carteira básica com datas/fonte e rentabilidade correta | MF2-08 | Alta, requer dados |
| **Organizze/Mobills** | Padrões da rotina brasileira | Parcelas, vencimentos e ciclo salarial claros, linguagem local | MF2-03/06/07 | Alta |

**Evidência e limite:** a matriz sintetiza a pesquisa oficial já publicada pela Rodada A no arquivo reviews/2026-11-09-MF2-ANALYSIS.md. Confirmado pela documentação pública da empresa **não** significa que um agente testou experiência interna paga ou que a API esteja acessível no Brasil. Não copiar ativos proprietários.

## 3. Dez módulos de experiência, com MVP e teste

### MKT-01 — Revisão inteligente, não categorização mágica
- **Usuário:** ao abrir Movimentações, vê uma fila curta de itens que realmente exigem decisão. Ao corrigir um estabelecimento, surge uma sugestão opcional de regra, com prévia do impacto.
- **MVP seguro:** classes "manual > regra > banco > sugestão", confiança explicada, aplicar uma regra com confirmação e histórico de mudanças. Nenhuma IA precisa ser chamada para aplicar regra simples.
- **Teste:** dois comerciantes de nomes parecidos, transações de contas diferentes, split, pendência, histórico incompleto e rejeição de sobrescrita manual.
- **Onde:** MF2-05, IDEA-21; reutilizar registros do 1.0.

### MKT-02 — Observadores de despesas
- **Usuário:** escolhe um estabelecimento ou categoria a acompanhar, sem precisar criar limite orçamentário. Vê gasto no mês, média de períodos completos e tendência.
- **MVP seguro:** filtro estruturado + soma determinística + sinal "histórico insuficiente", alerta opcional. Sem score opaco, sem nova base financeira.
- **Teste:** meses parciais, transferência própria, entrada de reembolso e lançamento manual duplicado.
- **Onde:** MF2-05/06; candidato opcional, não duplicar Orçamentos.

### MKT-03 — Fixas, não mensais e flexíveis
- **Usuário:** o aplicativo separa aluguel/contas, gasto flexível e provisão anual (como impostos) e explica o montante reservado por ciclo.
- **MVP seguro:** manter modo simples; adicionar categorias de verba por período persistidas, rollover com audit log e transferência explícita de verba. Não confundir envelope com saldo real.
- **Teste:** orçamento zero explícito, desconfigurado, mês sem gasto, provisão anual, rollover e calendário de recebimento.
- **Onde:** MF2-07, sem reescrever duas engines.

### MKT-04 — Saldo seguro com explicação
- **Usuário:** vê "disponível estimado até [data]" e pode abrir a composição: saldo bancário confirmado, despesas ainda não liquidadas, reserva mínima, qualidade do dado.
- **MVP seguro:** cenário conservador, horizonte escolhido, nenhuma receita incerta incorporada e estado NÃO CALCULÁVEL quando saldo/fonte incompleto.
- **Teste:** parcial de planejamento, saldo desatualizado, vencimento antes do próximo recebimento, compromisso liquidado, transferência própria.
- **Onde:** MF2-06; bloqueado por G1/G2.

### MKT-05 — Recorrências sob controle do usuário
- **Usuário:** detecta assinatura, próxima cobrança e aumento de preço. Pode confirmar, ignorar, alertar ou criar compromisso futuro.
- **MVP seguro:** detector por periodicidade/merchant e variação de preço com confiança; "suspeita" nunca vira boleto a pagar automaticamente.
- **Teste:** compras esporádicas, pagamentos com intervalos irregulares, variação sazonal, reembolso, cancelamento manual.
- **Onde:** MF2-05/09; **não** prometer cancelamento de assinaturas com terceiros.

### MKT-06 — Planejamento por ciclo salarial
- **Usuário:** vê o intervalo entre recebimentos, obrigações no meio do caminho, menor caixa projetado e melhor data para uma compra.
- **MVP seguro:** janela por ciclo configurável + projeção diária existente, comparação base vs compra e explicação das premissas.
- **Teste:** recebimento que cai após vencimento, mudança de mês, renda variável, recebimento incerto, feriado no ciclo.
- **Onde:** MF2-06, IDEA-20; evitar calcular duas vezes projeções da UI.

### MKT-07 — "E se..." como ação global
- **Usuário:** a partir de uma despesa, meta ou dívida, seleciona "Simular impacto" e chega ao Laboratório com parâmetros preenchidos, sem salvar nada.
- **MVP seguro:** link contextual para motor único e resultado A/B; persistência somente quando usuário aceita no editor canônico.
- **Teste:** fechar/reabrir, trocar conta, respostas atrasadas, taxa/parcelas, segurança contra criar gasto não autorizado.
- **Onde:** MF2-06/07; unifica o Simulador atual, não cria aba nova.

### MKT-08 — Radar com motivos e prioridade
- **Usuário:** recebe até três achados significativos: vencimento, tendência de excesso, variação de assinatura, saldo mínimo. Pode ver "por que apareceu?" e silenciar.
- **MVP seguro:** triggers determinísticos com condição, evidência e dedup; IA apenas resume. Sem pressão, alarmismo nem avalanche de notificações.
- **Teste:** condições repetidas, dados parciais, mensagem sem PII, push opt-in e horário silencioso.
- **Onde:** MF2-09, IDEA-24.

### MKT-09 — IA que executa com recibo
- **Usuário:** "ajuste meu limite de transporte" → a IA consulta período e categoria → exibe antes/depois → pede aprovação → aplica comando com revisão e log, confirma o que mudou.
- **MVP seguro:** poucas ferramentas de leitura e escrita com schema, idempotência e CAS, política explícita de custos. Não executar SQL livre.
- **Teste:** prompt injection, permissão insuficiente, dado alterado entre consulta e confirmação, duplicidade, falha de execução e cancelamento.
- **Onde:** MF2-09, IDEA-23; sem pagamentos, Pix ou ordens de ativos.

### MKT-10 — Patrimônio explicado, não apenas cotado
- **Usuário:** vê evolução de patrimônio desmembrada em aportes, valor de mercado, dividendos e dívidas; consegue investigar de onde veio cada diferença.
- **MVP seguro:** posições com data/fonte e transações patrimoniais tipadas; retorno indisponível se não houver histórico/custo confiável.
- **Teste:** aporte em conta própria e investimento, dividendo reinvestido, ausência de cotação, preço histórico incompleto.
- **Onde:** MF2-08, IDEA-27.

## 4. Três experiências integradas que eu priorizaria na análise

**Fluxo A: "Posso comprar agora?"** Dashboard → saldo seguro/composição → simular à vista vs parcelado → impacto no caixa/ciclo → planejar compra no editor com confirmação. Combina PocketGuard + Simplifi + simulação existente. **Não implementar antes de G1/G2/G6**.

**Fluxo B: "Onde perdi dinheiro sem perceber?"** Movimentações → revisão de 5 minutos → recorrências confirmadas e custo anual → Watchlist de gasto → Radar de variação. Combina Copilot + Actual + Rocket Money + Simplifi. Pode ser implementado em fases após G2/G3, com regras determinísticas antes de IA.

**Fluxo C: "A IA consegue fazer por mim?"** Pergunta → ferramentas reais de leitura → explicação com evidência → diff de mudança → confirmação → recibo auditável. Combina Origin/Cleo com arquitetura de validação. Bloqueado até G2 e controles G9.

Todos os três fluxos reaproveitam o mesmo ledger, serviços e estados; nenhuma experiência justifica um novo banco financeiro paralelo.

## 5. Uma proposta ousada, sem inflar o escopo

Criar um **Painel de Decisões**, não uma nova tela: um bloco opcional da Visão Geral que destaca "O que mudou", "Por que importa" e "O que posso fazer". Ele é composto por cartões vindos dos motores do produto, por exemplo:
- "Conta atualizada há dois dias: confira o saldo antes de simular" — qualidade, não IA.
- "Uma recorrência aumentou em relação a meses completos comparáveis" — regra com base histórica.
- "Uma obrigação pode deixar o caixa abaixo da reserva mínima em [data]" — projeção determinística.
- "Esta meta não alcança o prazo com a contribuição atual" — projeção.
- "Quer comparar a antecipação com a reserva?" — atalho para simulação.

**Candidato de UX para Rodada A**, não novo requisito aprovado. Critérios de aceitação: máximo três itens, dedup, motivo verificável, caminho de ação, opção de dispensar e nenhum dado inventado.

## 6. Priorização sem acumulação de features

| Prioridade | Experiência | Razão |
| --- | --- | --- |
| P0 — confiabilidade | proveniência e cobertura, fluxos com centavos exatos | Toda inovação depende disso |
| P1 — alto valor | MKT-01, MKT-04, MKT-05, MKT-06, MKT-07, MKT-08, MKT-09 | Melhora decisão e reduz trabalho |
| P1 — sustentação | MKT-03 e MKT-10 | Orçamento e patrimônio concretos |
| P2 — opcional | MKT-02 e Painel de Decisões como card | Exige priorização de UX para não duplicar |
| 2.1 | digest programado, score único e automações externas | Custo/risco sem dependência obrigatória |

Não iniciar todas as P1 em paralelo. A ordem de execução permanece MF2-00…10 com gates.

## 7. URLs oficiais citadas na Rodada A (reconfirmar antes de implementar)

- Copilot: https://help.copilot.money/en/articles/6045480-dashboard-tab-overview ; https://help.copilot.money/en/articles/9682232-cash-flow-tab-overview
- Monarch Flex: https://help.monarch.com/hc/en-us/articles/32125337244052-Using-Flex-Budgeting ; Reports: https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports
- Simplifi Cash Flow: https://support.simplifi.quicken.com/en/articles/3357429-using-projected-cash-flow ; Watchlists: https://support.simplifi.quicken.com/en/articles/3472367-using-watchlists-on-the-web-app
- PocketGuard: https://pocketguard.com/help/bills/ ; https://pocketguard.com/help/how-to-use-insights-in-pocketguard/
- Rocket Money: https://www.rocketmoney.com/faq ; https://help.rocketmoney.com/en/articles/934402-how-do-i-cancel-a-subscription-on-rocket-money
- Actual Budget: https://actualbudget.org/docs/budgeting/rules/ ; https://actualbudget.org/docs/releases/
- Origin: https://support.useorigin.com/hc/en-us/articles/39419419459085-What-is-the-AI-Advisor
- Cleo: https://web.meetcleo.com/blog/introducing-autopilot
- YNAB: https://www.ynab.com/features
- Organizze: https://www.organizze.com.br/ ; Mobills: https://www.mobills.com.br/pricing/
- Kinvo: https://suporte.kinvo.com.br/open-finance/articles/analises-detalhadas-de-investimentos-no-kinvo

**Transparência:** a lista aproveita fontes trazidas pela pesquisa publicada pela Rodada A; esta adição documental não alega execução de testes, acesso a funções privadas dos concorrentes, autorização de modelos de IA ou validação de compatibilidade brasileira dos produtos.

## 8. Decisões pendentes

1. Priorizar orçamento flexível completo em 2.0, ou entregar primeiro provisões não mensais e rollover depois?
2. Observadores de gastos devem ficar em Movimentações ou serem cards filtráveis de Orçamentos?
3. Quais três achados do Radar entram como primeira versão e como medir falsos positivos?
4. Como criar saldo seguro com política conservadora e UI de confiabilidade clara?
5. Quanto da edição multiárea pela IA deverá ser habilitada inicialmente? Começar por orçamento/categoria e ampliar após auditoria?
6. Quanto de personalização de dashboard melhora a UX sem deteriorar manutenção?

Responder em Rodada A, registrar proposta de escolha e não implementar por inferência.
