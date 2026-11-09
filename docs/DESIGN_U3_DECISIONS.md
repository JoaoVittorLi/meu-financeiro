# U3 — Orçamentos, Contas e Simulador

09/11/2026. Continuação da U1/U2 na branch `design/despezzas-d1-d4`, PR #16. Renderer desktop identificado no rodapé como **Interface U3**, mantendo a versão 0.9.5-beta.6.

## Direção e referências

O Despezzas continua sendo a referência de superfícies neutras, bordas discretas e controles compactos. A U3 adapta padrões documentados em fontes oficiais, sem copiar ativos:

- [Monarch — Creating Your Budget](https://help.monarch.com/hc/en-us/articles/360048883631-Creating-Your-Budget-in-Monarch): leitura de planejado, realizado e restante. Adaptação: limites, gastos, margem nos limites e cards de atenção.
- [Monarch — Using Flex Budgeting](https://help.monarch.com/hc/en-us/articles/32125337244052-Using-Flex-Budgeting): leitura agregada e comparação com categorias relevantes. Adaptação: cobertura dos gastos por categorias com limite e foco por situação. Não foi criado um motor de Flex Budgeting.
- [Copilot — Cash Flow Tab Overview](https://help.copilot.money/en/articles/9682232-cash-flow-tab-overview): informações financeiras organizadas para comparação. Adaptação: custos e efeito da compra apresentados separadamente, comparação A/B e gráfico com/sem compra.
- [Copilot — Dashboard Tab Overview](https://help.copilot.money/en/articles/6045480-dashboard-tab-overview): prioridade para movimentações e categorias que precisam de revisão. Adaptação: contadores e filtros acionáveis por categoria/conta.

Recursos como rollover, transferências entre envelopes e saldo “livre para gastar” exigem regras e persistência próprias. Esta entrega não os simula visualmente nem altera o contrato dos limites recorrentes.

## Orçamentos

Cards existentes de gasto com limite, total de limites, margem e gasto sem limite ganham composição mais clara. A margem continua explicitamente diferente de dinheiro disponível.

Novo painel de cobertura: percentual dos gastos da fonte/mês em categorias com limite. Sem gastos, mostra ausência de base para o percentual. Limite zero definido não é tratado como ausência de limite. Filtros acionáveis: Todas, Atenção (acima ou a partir de 90%) e Sem limite. Busca por categoria, contagem filtrada e estado vazio. Cards agrupados e ordenados pela prioridade canônica, com gasto, utilização, restante/excesso e edição do limite. A visualização de receitas mantém semântica própria.

Banco e manual permanecem separados; dados vêm dos snapshots existentes, incluindo agregados diários quando disponíveis. Histórico parcial sem agregados recebe aviso. Limites permanecem recorrentes para todos os meses; qualquer edição continua passando pelo editor existente. Sugestões históricas existentes não são aplicadas automaticamente.

## Contas

Quatro indicadores: saldo conhecido (com indicação de parcial/indisponível), contas com saldo informado, referências de até 24 horas e contas cuja referência precisa de conferência. Zero real continua distinto de ausência de saldo.

Cards por conta mostram saldo recebido, horário/data da referência, contagem de registros carregados, pendências bancárias e pendências de revisão. Os contadores são por ID de conta, considerando todos os períodos carregados. Não são confundidos com o saldo. Botão de movimentações aplica a identidade exata da conta e limpa busca/seleção anteriores.

Referência antiga: mais de 24h. Data sem horário, data inválida ou horário mais de cinco minutos no futuro são classificados como não verificados. Um horário recente não garante saldo em tempo real. Filtro de referência aplica esses sinais e não recomenda movimentação de dinheiro. Erros de conexão têm acesso aos detalhes; configuração/sincronização e proteção de credenciais foram preservadas. Tipos conhecidos de conta têm rótulos em português.

## Simulador

Nova bancada de decisão: parâmetros à esquerda, resultado/projeção à direita. Separa custo, reserva e efeito no fluxo de caixa. Gráfico de até 12 fechamentos mensais usa exclusivamente os resultados do motor diário existente, com e sem compra; tabela expansível disponibiliza todos os meses retornados. Fechamento mensal não é apresentado como mínimo diário. Valores negativos e dados insuficientes conservam alertas existentes.

Comparação A/B: guardar um resultado como referência da sessão; alterar valor, parcelas, taxa ou primeiro vencimento; analisar a segunda opção; comparar principal, número de parcelas, taxa, parcela de referência, juros e custo total. Mínimos de saldo só são comparados quando ambos os motores são diários. Principais diferentes não são anunciados como economia de juros. Cada análise conserva os dados daquele momento; a comparação não é persistida em registros financeiros e é limpa ao trocar de perfil.

Editar os parâmetros invalida o resultado anterior. Respostas assíncronas atrasadas são descartadas após uma edição, nova solicitação, navegação ou troca de perfil. O primeiro vencimento só é oferecido no motor diário; o cenário do perfil continua identificado como simplificado, iniciando no próximo mês. A ação de planejar conserva a confirmação e o editor existentes e nunca executa pagamento.

## Verificação e limites

- TypeScript 5.8.3: compilação, tipos e F08 aprovados.
- Desktop: **222/222 testes aprovados**, incluindo oito novos testes U3 sobre limites/cobertura, filtros/edição, referência bancária, identidade por conta, comparação imutável, invalidação de respostas atrasadas, gráficos/tabela e modos de simulação.
- Worker/PWA: **129/129 testes aprovados**; regressão real ASAR: **1/1 aprovada**.
- Inspeção estática de composição com dados fictícios em temas claro/escuro. O renderizador de impressão precisa de adaptações de grid, controles e SVG; as prévias são aproximadas e não certificam o layout no Chromium/Electron.
- Nenhum instalador Windows foi gerado/executado; o navegador local permanece indisponível neste ambiente. Não houve acesso ao PC nem aos dados pessoais do usuário.

Para homologar: executar a pipeline Windows existente (`run_windows_build=true`), manter testes e prova ASAR/proveniência, abrir o instalador em 1366×768 e tela ampla, conferir os dois temas, valores extensos, filtros, edição de limites, abertura de conta, comparação A/B, primeiro vencimento e a passagem da simulação ao editor. O rodapé deve indicar Interface U3. Esta pendência impede declarar homologação final no Windows.

A UI equivalente na PWA continua prevista na U4. Os testes da PWA são regressões; não significam implantação deste renderer nela. Próximo escopo: U4 — equivalência visual no PWA e acabamento das áreas restantes, preservando a integração de Inteligência que está sendo desenvolvida em paralelo.
