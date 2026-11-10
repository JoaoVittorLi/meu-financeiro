# D2 — Telas do cotidiano

Continuidade: o lote seguinte está registrado em `docs/DESIGN_D3.md`. As pendências abaixo descrevem o estado ao encerrar D2; confira também o novo checkpoint.

Implementação local, sobre o D1. Branch: `fix/asar-windows-nested-paths`. Sem commit, push, publicação ou EXE novo.

## Resultado

- Visão geral mostra despesas pendentes cadastradas no Planejamento, com vencimento, valor restante, identificação de atraso/estimativa e abertura do detalhe existente. Pagas e canceladas não entram; são exibidas até quatro, com indicação das demais. Não usa o período do extrato para ocultar uma dívida vencida.
- O resumo de orçamento da Visão geral usa gasto nas categorias com limite para acompanhar a porcentagem; excessos não são chamados de saldo disponível.
- Orçamentos apresenta gasto limitado, soma de limites, margem/excesso e gasto fora dos limites. Explica que o período filtra gastos e os limites atuais são recorrentes, sem prometer versionamento mensal inexistente.
- Categorias são ordenadas por excesso, proximidade (90% ou mais), demais limites e ausência de limite. Critérios estáveis preservam valores e o tratamento de limite zero. Sem limite não recebe barra vazia.
- Editor de limite abre à direita, mantendo o mesmo fluxo de salvar/cancelar. Em branco remove e zero é explícito; nenhuma escrita ocorre ao abrir ou cancelar.
- Minhas contas prioriza cobertura do saldo e cartões por conta. Mostra referência recebida quando informada, mantém saldo desconhecido distinto de zero e recolhe conexão/sincronização em seção expansível.
- Movimentações recebeu segmentos, toolbar e hierarquia visual coerentes com o novo padrão, preservando categoria editável e nome bancário original.
- Detalhe de planejamento recebeu papel/nome de diálogo acessível. Menus móveis mantêm rótulos; avisos temporários não ocupam o mesmo espaço do botão de IA.

## Validação

- TypeScript: zero erros com 6.0.3 disponível; somente a chamada local ignora depreciações do compilador. O projeto permanece fixando 5.8.3 para o build oficial.
- 47 testes focados aprovados: os 43 do lote anterior e quatro cenários novos de ordenação, valores nulos/zero, agenda e datas sem horário.
- 32 combinações em Chrome isolado: oito áreas, dois temas e larguras 1366/390, sem erros JavaScript ou overflow horizontal da página.
- Mais 24 combinações de Visão geral, Movimentações, Orçamentos e Minhas contas, nos dois temas e larguras 1366/390/320, com ponte desktop inteiramente fictícia.
- Fluxos exercitados nessa ponte: agenda abre o compromisso correto; cancelar limite não grava; salvar zero preserva o limite; campo vazio remove; conexão/sincronização expande e recolhe; cobertura parcial e saldo ausente aparecem explicitamente.
- Capturas com valores fictícios foram inspecionadas. Não se abriu SQLite pessoal, conexão bancária ou inferência de IA.

Essa cobertura não substitui IPC real, persistência no Electron empacotado, homologação de dados reais, leitores de tela ou build do instalador. A suíte geral completa continua com as limitações ambientais documentadas no D1; não é declarada aprovada.

O CSS compartilhado foi replicado na PWA, mas os novos blocos de conteúdo são do renderer desktop. A paridade visual e funcional da PWA continua uma entrega separada; não houve deploy.

## Continuidade

Próximo lote D3: composição de Planejamento e Simulador, configurações agrupadas, navegação móvel definitiva, revisão de todos os formulários e alinhamento dos conteúdos da PWA. D4 mantém a IA contextual e a tela dedicada com suas capacidades reais claramente identificadas. Depois executar validação empacotada e build Windows com as dependências declaradas.

Evidências locais: `../audit-review-temp/design-d2-tests.log`, `check-new-design.cjs`, `check-d2-fixtures.cjs`, `design-browser-results.json` e `design-d2-browser-results.json`. Os scripts de fixture usam Chrome isolado e dados sintéticos; não são automação da conta pessoal.
