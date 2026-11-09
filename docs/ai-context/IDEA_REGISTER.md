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
