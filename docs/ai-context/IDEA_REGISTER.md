# Registro de ideias — Meu Financeiro 2.0

**Status:** propostas iniciais para a Rodada A, **NENHUMA aprovada automaticamente para implementação**. O escopo vinculante continua no [ROADMAP](../ROADMAP_MF2.md). Atualizar propostas após pesquisa/avaliação, registrar aprovação explícita e não transformar ideias em novas abas por conveniência.

## Modelo de decisão

**ID • Problema • Proposta • Diferencial • Dependências • Custo relativo/risco • Status • Decisão**

Status permitidos: PROPOSTA, EM_ANALISE, RECOMENDADA, ADOTADA, SUBSTITUIR_EXISTENTE, ADIADA_2_1, REJEITADA. Só mudar para ADOTADA com decisão registrada em ADR e no roadmap, mencionando o recurso preexistente que se mantém ou substitui.

## Ideias iniciais para debate

| ID | Proposta / experiência | Benefício ao usuário | Dependência e risco | Direção inicial |
| --- | --- | --- | --- | --- |
| IDEA-01 | **Saldo seguro auditável**: limites explicados e cobertura do saldo | Decide compra sem falsa confiança | G1/G2/G6; alto risco se dados parciais | **Essencial** já previsto em MF2-06; detalhar método |
| IDEA-02 | **Radar de atenção focada**: até 3 eventos mais relevantes hoje | Identifica ação prioritária, reduz notificações | G5/G6/G9; priorização precisa justificar | Candidata à UI do radar |
| IDEA-03 | **Modo "E se..." global**: simulação contextual em qualquer tela | Menos esforço para comparar compra/antecipação | G6; não criar motor paralelo | Candidata, aproveitar Laboratório |
| IDEA-04 | **Fechamento do ciclo**: guia de revisão no fim do mês ou ciclo salarial | Corrige pendências antes do próximo período | G5/G6; sem inventar conciliação | Candidata ao Planejamento |
| IDEA-05 | **Caça às despesas invisíveis**: custo anual das recorrências pequenas | Descobre economia potencial | G5; falsas recorrências | Candidata ao Radar |
| IDEA-06 | **Revisão financeira em 5 minutos**: inbox em lotes e regras sugeridas | Reduz tarefa repetitiva | G5; lote precisa de preview/undo | Candidata a Movimentações |
| IDEA-07 | **Confiabilidade visível**: card de completude de dados e fonte | Usuário sabe quando confiar em números | G1/G2; requer cobertura real | Muito coerente com integridade |
| IDEA-08 | **Linha do tempo de decisões**: compra simulada, meta, efeito posterior | Aprende o impacto das próprias escolhas | G6/G7; causalidade difícil | Exploratória, não prioritária |
| IDEA-09 | **Orçamento em duas velocidades**: básico e envelope avançado | Simplicidade + profundidade | G7; modelo de rollover precisa persistência | Já previsto, avaliar UX |
| IDEA-10 | **Cartão "por que mudou?"**: explicar diferença entre dois períodos | Contexto útil sem navegar por muitas telas | G2/G4; base parcial, estatística | Candidata ao dashboard |
| IDEA-11 | **Dívida vs reserva**: comparação de antecipação e liquidez | Visualizar custo de oportunidade | G6/G7; risco de recomendação indevida | Candidata ao Laboratório |
| IDEA-12 | **Digest opt-in**: resumo semanal sem alarmismo | Acompanhamento regular sem abrir o app | G9; privacidade, custo e frequência | Opcional, talvez 2.1 |
| IDEA-13 | **Patrimônio explicado**: aporte vs valorização vs proventos | Não confundir enriquecimento com depósitos | G8; preços e datas | Essencial como relatório de patrimônio |
| IDEA-14 | **IA com recibo**: mostrar antes/depois e ID auditado | Confiança em edição assistida | G9; transação e autorização | Essencial como comportamento da IA |
| IDEA-15 | **Sugestões pelo ciclo salarial**: orçamento associado ao próximo crédito | Planejamento brasileiro mais realista | G6/G7; datas reais e incerteza | Candidata de alta utilidade |
| IDEA-16 | **Home móvel contextual**: prioridade do dia e atalho de revisão | Menos scroll e ruído no Android | G3/G4; consistência com desktop | Candidata de design |
| IDEA-17 | **Busca financeira unificada**: encontrar transação, conta, regra ou plano | Menos navegação para ações comuns | G3/G5; permissões e indexação | Avaliar custo/manutenção |
| IDEA-18 | **Explicação de alertas**: cada alerta informa por que disparou e como silenciar | Transparência, menos alarmes | G9; falso positivo | Essencial ao Radar |

## Ideação aberta na Rodada A

A IA responsável pela análise deverá adicionar ou substituir propostas **após observar o produto**; não deve apenas reempacotar esta tabela. Para cada ideia relevante: descrição do fluxo antes/depois, telas, contratos, testes necessários, valor percebido, custo relativo, risco, dependência, fonte de referência e alternativas. Produzir três propostas de maior impacto e três de maior criatividade, identificando sobreposição para simplificar o escopo.

## Decisões ainda não tomadas

- Quais ideias entram no 2.0 além do escopo essencial e quais devem esperar 2.1?
- Qual a melhor arquitetura de personalização do dashboard com mínimo de fragilidade?
- Qual UX de saldo seguro realmente informa incerteza sem alarmismo?
- Quanto controle a IA terá em lote, e em que telas a confirmação é obrigatória?
- Qual o desenho final de Metas e Patrimônio sem sobrecarregar navegação?
- Quais melhorias podem **substituir** funcionalidades existentes, em vez de adicionar complexidade?

As respostas deverão surgir no relatório ANALYSIS e decisão do usuário/Chat arquiteto, não da suposição de um agente.

## Rodada A — triagem de 09/11/2026 (PROPOSTAS, não aprovadas)

Fonte: [Análise completa da Rodada A](reviews/2026-11-09-MF2-ANALYSIS.md), benchmark de fontes oficiais registrado na seção A3. **Nenhuma proposta abaixo altera o escopo aprovado, a Rodada B ou os gates por si só.** A expressão **RECOMENDADA** significa “para decisão do proprietário”, não autorizada.

| ID | Proposta e origem de dados / jornada | Benefício, custo e risco | Dependência e prova de aceite | Status proposto |
| --- | --- | --- | --- | --- |
| IDEA-19 | **Confiabilidade por indicador:** KPI → origem, período, as-of, cobertura, linhas/drill-down. Fonte: ledger e status da conta. | Evita interpretar dado parcial como dinheiro disponível; esforço baixo/médio, risco baixo se ausência declarada. | G1/G2/G4; testes saldo 0/ausente/parcial, período truncado e equivalência. | **RECOMENDADA** dentro de MF2-02/04; complementa IDEA-07/10 |
| IDEA-20 | **Ciclo até o próximo recebimento:** mês → fluxo até dia de pagamento, obrigações, menor caixa, receita incerta separada. Fonte: agenda + conta as-of. | Decisão mais útil no Brasil; esforço médio, risco alto de falsa garantia. | G2/G6; fixtures com ciclo que cruza meses, atraso, parcial, ausência de saldo. | **RECOMENDADA** para modificar MF2-06; complementa IDEA-15 |
| IDEA-21 | **Inbox de 5 minutos:** lista longa → fila curta → prévia de regra/lote → revisão e recibo. Fonte: transação, overlays, merchant e revisão. | Mais agilidade; esforço médio, falso positivo e CAS precisam proteção. | G3/G5; testar prioridade manual>regra>provedor e undo quando permitido. | **RECOMENDADA** para MF2-05; operacionaliza IDEA-06 |
| IDEA-22 | **Home em dois ritmos:** desktop analisa, mobile foca hoje/7 dias, mesmos dados e links. | Interação premium sem duplicar motor; esforço médio, risco de densidade/reflow. | G3/G4; 320/390/768/1366/1920px, teclado, foco, temas, ocultar valores. | **RECOMENDADA** em MF2-04; evolui IDEA-16 |
| IDEA-23 | **IA com recibo:** pergunta → consulta tipada → diff/consentimento → comando com revisão → ID e confirmação/undo. Fonte: API de domínio, não SQL livre. | Controle de escrita assistida; esforço alto, risco de autorização, custo e replay. | G2/G9; testes prompt injection, 409, orçamento API e auditoria. | **RECOMENDADA**, requisito comportamental já previsto; detalha IDEA-14 |
| IDEA-24 | **Radar de 3 motivos:** achados determinísticos priorizados e explicados, silenciar, sem notificação excessiva. | Foco e valor real; esforço médio, risco de falso alerta e privacidade. | G5/G6/G9; testes cobertura, dedup, push opt-in e rate-limit. | **RECOMENDADA** como revisão da UX de IDEA-02/18 |
| IDEA-25 | **Saúde da conexão e da cópia:** cada conta indica último dado, fonte, cobertura, consentimento e rota de recuperação. | Confiabilidade visível; esforço médio, risco de expor estado incorreto. | G0/G1; testes reauth, refresh tardio, backup/restore e erro de sessão. | **RECOMENDADA** em Contas/Configurações; vincular IDEA-07 |
| IDEA-26 | **Antecipação versus reserva:** A/B com custo contratual e efeito no caixa, sem pagamento. | Evita decisão por taxa isolada; esforço médio, alto risco se simular contrato fictício como real. | G6/G7; juros, parcelas, base e sensibilidade explícitos. | **RECOMENDADA** como extensão de IDEA-11 |
| IDEA-27 | **Patrimônio explicado:** evolução separa aporte, valor de mercado e proventos; retorno indisponível sem histórico. | Patrimônio compreensível; esforço alto, risco de dados insuficientes. | G8; testes transferência neutra e posição sem histórico. | **RECOMENDADA** em MF2-08; detalha IDEA-13 |
| IDEA-28 | **Digest semanal opt-in:** resumo de até 3 tarefas quando regras apontam ação relevante. | Valor episódico; custo de push/IA e privacidade. | G9/G10; consentimento, quiet hours, sem exposição de valores. | **ADIADA_2_1**, refinamento de IDEA-12 |
| IDEA-29 | **Score único de saúde financeira:** nota agregada que aparenta precisão sem base completa. | Alto risco de interpretação errada e baixo valor incremental. | Não desenvolver sem definição pública/reproduzível de indicadores. | **REJEITADA como recomendação** para 2.0, aguardando decisão; preferir checklist |
| IDEA-30 | **Reescrita visual/stack integral:** substituir U1–U3/PWA/engine de uma vez. | Custo e regressão altos, benefício ainda não demonstrado. | Só revisitar se medição provar inviabilidade do stack atual. | **REJEITADA como recomendação**; preservar investimento |

### Critério comparativo e simplificação
Em escala qualitativa 0–3 (**impacto / frequência / confiabilidade / reutilização / esforço**, onde esforço alto = 3), exemplos: IDEA-19 = **3/3/3/3/1**; IDEA-20 = **3/3/3/3/2**; IDEA-21 = **3/3/3/2/2**; IDEA-23 = **3/2/3/3/3**; IDEA-29 = **1/1/0/1/3**. Escala orienta conversa, não substitui validação. 
**Reutilização para não inflar escopo:** IDEA-19+25 partilham proveniência; IDEA-20+26 partilham simulação determinística; IDEA-21+24 partilham eventos; IDEA-22 não exige outra base de dados.
**Antes de aceitar:** decidir explicitamente qual melhoria substitui experiência antiga, qual cabe no marco já aprovado, quais métricas de usabilidade servirão de aceite e quem coordena a branch/contrato.
