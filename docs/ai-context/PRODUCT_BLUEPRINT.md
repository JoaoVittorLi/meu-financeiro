# Blueprints de produto e experiência — ideias detalhadas para a Rodada A

**Status:** diretrizes e hipóteses para pesquisa e crítica. **Não** autoriza implementação automática. O roadmap canônico é [ROADMAP_MF2](../ROADMAP_MF2.md); o registro de propostas é [IDEA_REGISTER](IDEA_REGISTER.md).

## 1. Valor central: "controle que vira decisão"

A diferença do Meu Financeiro 2.0 não será somar mais gráficos; será conectar a trajetória **dado confiável → entendimento → projeção → ação autorizada → confirmação**. Cada tela responde: "o que sei?", "posso confiar?", "o que fazer agora?" e "qual o próximo passo?".

Métricas de sucesso a validar na análise, sem inventar números-alvo: tarefas para concluir classificação; tempo para localizar uma compra; precisão de fluxo/estado; erros de paridade; latência percebida; ações e alertas úteis versus descartados; custo por tarefa de IA; quantidade de cliques para uma decisão. KPIs devem ser medidos antes de definir metas.

## 2. Banco de referências e adaptação permitida

| App/padrão | Aprendizado de produto | Como transformar em algo nosso |
| --- | --- | --- |
| Despezzas | UI neutra, superfícies limpas, densidade equilibrada | Linguagem visual minimalista com foco em leitura |
| Copilot Money | Gráficos elegantes, revisão, fluxo de caixa | Investigar desvios a partir do dashboard em um toque |
| Monarch Money | Visão modular, orçamento flexível e metas | Cards funcionais, priorização por momento da jornada |
| PocketGuard | Safe-to-spend | Saldo seguro condicionado à qualidade dos dados |
| Simplifi | Projeção de gastos e caixa | Calendário de decisões e faixa de risco |
| Rocket Money | Recorrências/assinaturas | Detector de despesas invisíveis, sem cancelamento falso |
| Snoop | Insights proativos | Radar determinístico com explicação e frequência controlada |
| YNAB | Orçamento por alocação | Dois níveis simples/avançados no mesmo motor |
| Actual Budget | Regras e contabilidade confiáveis | Métricas reproduzíveis e histórico local/cloud auditado |
| Lunch Money | Regras, tags e automações | Revisão com preview, reversão de overlay |
| Origin/Cleo | IA contextual e conversa acessível | Assistente que pode **propor** e executar comandos validados |
| Mobills/Organizze | UX brasileira, parcelas, rotina | Ciclo de recebimento e contratos de empréstimos |
| Kinvo | Patrimônio e proventos | Carteira básica integrada ao patrimônio sem dados inventados |

**Rodada A deve reconfirmar referências atuais com fontes reais antes de propor dependências de mercado**. Não copiar ativos, designs internos não observados, marcas, dados privados ou fluxos pagos presumidos.

## 3. Arquitetura de navegação — oito áreas, sem novas abas gratuitas

1. **Visão Geral:** estado do dinheiro e o que exige atenção.
2. **Movimentações:** o que entrou/saiu, evidências, revisão, regras e recorrências.
3. **Planejamento:** compromissos, caixa futuro, alertas e Laboratório de Decisões (absorve Simulador).
4. **Orçamentos:** alocação e controle, simples/avançado.
5. **Metas e Patrimônio:** metas, dívidas, carteira e valor líquido.
6. **Inteligência:** Hoje, Conversar, Plano de ação, histórico e permissões.
7. **Contas:** instituições, saldos e qualidade da conexão, origem das fontes.
8. **Configurações:** segurança, dados, privacidade, aparência, alertas, backup/recovery.

**Rota legada:** manter transição acessível dos links "Simular compra" para "Planejamento → Laboratório", sem quebrar acesso existente. A análise pode sugerir outra navegação se demonstrar ganho real de usabilidade e migração segura.

## 4. Visão Geral: "painel de comando financeiro"

### Conteúdo aprovado como direção
- Cabeçalho com período, origem (banco ou manual), cobertura de dados, ocultar valores e ação principal.
- Quatro noções não confundidas: saldo bancário conhecido, receita, despesa e resultado; a renda líquida do mês não vira "saldo livre".
- Gráfico com comparação temporal equivalente, ranking de categoria, movimentações recentes clicáveis, próximos compromissos, orçamento de atenção, contas compactas.
- Drill-down em todos os números: toque mostra filtro, origem e qualidade dos dados.
- Responsive: desktop com leitura espaçosa; celular prioriza "hoje/próximos sete dias/ações".

### Evolução por dependência
- MF2-04: personalização modular; cards reposicionáveis e três tamanhos controlados; restaurar padrão; compactação acessível; esconder valores.
- MF2-06: card de **saldo seguro** só após disponibilidade do motor e identificação de saldo insuficiente/desconhecido.
- MF2-09: card de **Radar** baseado em eventos, com explicação de IA opcional.

### Exemplo de experiência desejada
"Saldo conhecido R$ X, sujeito à atualização de [data]" → "R$ Y de obrigações até seu próximo recebimento" → "simular uma compra" ou "ajustar orçamento". Se dados forem parciais, a tela deve dizer "estimativa indisponível" e oferecer a conferência necessária.

### Não fazer
Mais de uma grande área repetindo saldos, gráfico que distorce comparação por intervalo diferente, card de dinheiro livre calculado a partir de limite de orçamento, IA como fonte do saldo.

## 5. Movimentações: "caixa de entrada que se organiza"

- **Fila A revisar:** itens não categorizados, status ambíguo, duplicatas suspeitas, merchant alterado, valor recorrente fora do padrão; não abrir milhares de alertas.
- **Uma linha, múltiplas evidências:** nome pessoal, original do banco, conta/ID, status, data, categoria manual ou do provedor, origem e link ao planejamento.
- **Revisão rápida:** aceitar categoria, mudar manualmente, corrigir merchant, aplicar regra a semelhantes, desfazer override.
- **Motor de regras:** modo "Se descrição/merchant X e conta Y, sugerir categoria Z" com prévia da quantidade e escopo de registros afetados; não sobrescrever escolha manual protegida.
- **Recorrências:** confirmar/desconfirmar detecção; custo mensal/anual estimado; mudanças de valor e próxima cobrança; cancelamento apenas como ação manual sugerida, jamais serviço integrado fictício.
- **Detecção de anomalias:** comparação com histórico apropriado, justificativa, risco de falso positivo e opção "não me alertar para isso".

## 6. Planejamento: "linha do tempo de decisões"

- Visões Agenda, Calendário, Projeção diária e Laboratório de Decisões usando **o mesmo motor**.
- Deixar claro o que já foi liquidado, o que está pendente, o que é previsão, o que está vencido e o que depende de recebimento incerto.
- Fluxo real de salário/ciclo personalizado; obrigações podem cruzar o mês civil.
- **Faixa de saúde do caixa**: menor saldo projetado, dia de maior risco e cobertura; nunca mostrar garantia de pagamento.
- **Laboratório:** alternativa A/B, à vista vs parcelas, antecipação, redução de assinatura, poupança de meta; custo + reserva + efeito no caixa. Resultados salvos somente quando usuário escolhe persistir.
- **Saldo seguro:** descontar obrigações ainda não quitadas e reserva configurada, respeitar versão e referência das contas; separar cenários e marcar "não calculável" se base insuficiente.

## 7. Orçamentos: "planejamento simples, profundidade quando preciso"

- Modo simples: gasto, limite, margem/excesso, previsão do fechamento, categorias com limite e sem limite, alertas.
- Modo avançado: orçamento do período, verba alocada, transferência entre categorias, rollover opcional, prioridade e explicação do saldo de cada envelope; não duplicar saldo bancário.
- Criação/edição em drawer ou modal acessível e teclado; foco em categorias com maior impacto; recomendações não aplicadas automaticamente.
- Distinguir categoria com zero de categoria sem orçamento, e histórico parcial de gasto zero.

## 8. Metas, dívidas e patrimônio: "objetivos e mapa do patrimônio"

- **Metas:** nome, valor, prazo, saldo alocado/reservado, contribuição, cenário com o que sobra no caixa. Reserva virtual não é depósito.
- **Dívidas:** principal, taxa, custo, cronograma, juros, valor antecipado, economia e impacto no fluxo. Simulação de crédito precisa informar base/condições; não extrapolar contrato real.
- **Patrimônio:** ativos + passivos, atualizações com data e fonte, linha de evolução; transferência entre contas/investimentos não cria riqueza.
- **Investimentos:** posições, quantidades, preço médio, aportes/retiradas, rendimento, dividendos e cotações com data/fonte; sem trade automático nem promessas de retorno.

## 9. Inteligência: "assistente com recibo"

Não construir um chatbot que apenas responde. Construir uma **interface de decisões verificáveis**.

### Leitura
Perguntas sobre categoria, contas, orçamento, liquidez, parcelas, meta e carteira são respondidas com consultas a ferramentas reais; incluir período, quantidade de registros, qualidade/cobertura, data da última sincronização.

### Ações
O usuário pede "mude o limite de alimentação para X" → IA identifica categoria e período → mostra mudança exata antes/depois + possíveis consequências → pede confirmação → camada de domínio valida permissões/revisão → executa → mostra recibo de atualização, ID de auditoria e destino → sugere undo quando suportado.

### Proatividade
Radar sinaliza problemas calculados pelo motor mesmo sem serviço de IA. IA serve para resumir e explicar cenários. Modo "por que meu saldo seguro caiu?" mostra fatores observáveis, não interpretações inventadas.

### Segurança
Contexto pequeno e sob consentimento, nenhuma chave no PWA, limitação de tokens, custo, autorização por recurso, bloqueio de prompt injection, prevenção de replays, confirmação humana de mudança. Se não há acesso legítimo ao modelo, exibir limitação real e permitir operações manuais.

## 10. Contas + configurações: "confiança e controle"

- Estado da conexão Pluggy, referência do saldo, conta conhecida/parcial/desatualizada, reautenticação quando necessário.
- Origem e qualidade de cada banco, consentimento e histórico de sincronização.
- Backup/restore, exportação, segurança, identificação de dispositivo, preferências de temas, notificações e privacidade visual.
- Operações críticas exigem confirmação proporcional ao risco; não confundir reautenticar com refazer importação ou perder overrides.

## 11. Propostas criativas para debate (não requisitos)

- **Resumo financeiro de domingo:** síntese do período, sem alarmismo; custo e push opt-in.
- **Foco da semana:** no máximo três ações de maior impacto; origem verificável.
- **"E se..." global:** uma ação de simulação que abre no Laboratório com contexto da tela.
- **Linha do tempo financeira comentada:** marcos, escolhas e impacto real sem atribuir causalidade não comprovada.
- **Despesas invisíveis:** recorrências pequenas que acumulam valor relevante no ano.
- **Modo organização de 5 minutos:** revisar itens pendentes em lote, reduzir ruído e abrir análise.
- **Verificador de qualidade financeira:** quantos registros/dias têm referência confiável antes de mostrar comparativos.
- **Assistente de fechamento do mês:** tarefas de reconciliação, limites e planejamento para o próximo ciclo, sem fechamento contábil fictício.

Avaliar em [IDEA_REGISTER](IDEA_REGISTER.md); não adicionar oito novas telas para oito ideias.

## 12. Padrões de experiência e testes de aceitação visual

- Um design system semântico (cores, espaçamento, tipografia, componentes, estados), dark/light/system, contraste, ícones consistentes.
- Navegação por teclado, ESC, foco visível e modais acessíveis; loading/error/empty bem definidos.
- Gráficos com tabelas alternativas, labels legíveis e comparação temporal válida; animações discretas, respeitando reduced-motion.
- 320/390/768/1366/1920; preservar densidade sem truncar números ou criar overflow horizontal indevido.
- Screenshots **reais** antes/depois com dados sintéticos, e notas sobre ambiente; renderização estática não substitui smoke real Electron/PWA.
- Sempre diferenciar qualidade técnica da qualidade percebida.

**Pergunta final de cada review:** Qual situação do usuário ficou mais clara ou mais fácil, e qual parte dos dados a sustenta? Se não houver resposta concreta, revisar a proposta.
