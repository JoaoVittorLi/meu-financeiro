# U1 — remake da Visão geral

## Problema e resultado

A Visão geral anterior repetia o saldo, usava um gráfico dominado pela receita e reservava grande espaço para a agenda vazia. O U1 recompõe a tela: quatro indicadores distintos no topo, gasto acumulado e categorias em uma coluna, compromissos e orçamento em outra, movimentações clicáveis e contas compactas abaixo. O conteúdo tem largura de leitura limitada a 1500 px, escala maior na janela desktop e adaptação para janelas estreitas.

Escopo desta entrega: desktop Electron e seu renderer. A PWA mantém a composição anterior; sua adaptação equivalente está prevista na U4 do roadmap. Não houve deploy, alteração de backend ou migração financeira.

## Referências de produto

- Despezzas: referência principal de linguagem neutra, moldura, controles compactos, bordas e divulgação progressiva, conforme mapeamento autenticado de 08/11/2026. Não se atribui esta solução aos interiores PRO não observados.
- Monarch: resumos modulares de orçamento, tendências e transações. https://help.monarch.com/hc/en-us/articles/360058127551-Customizing-Your-Dashboard
- Copilot: separar receitas, despesas e resultado; comparar intervalos equivalentes e investigar os dados do período. https://help.copilot.money/en/articles/9682232-cash-flow-tab-overview
- Actual Budget: organização em relatórios/cartões e filtros explícitos. https://actualbudget.org/docs/reports/

As ideias foram adaptadas aos contratos existentes do Meu Financeiro. Nenhuma fonte, imagem ou componente proprietário foi copiado.

## Comportamento implementado

1. Saldo bancário/manual distinto de receitas, despesas e resultado; sem segunda faixa repetindo saldo. Expansão explica o cálculo e a cobertura. Não existe card de dinheiro livre.
2. Controle visual para ocultar valores. Oculta valores, percentuais, formas de gráficos e sua tabela na Visão geral; não é mecanismo de autenticação ou proteção da base financeira.
3. Ritmo de gastos acumulados, média diária e comparação com o intervalo anterior. Pode-se alternar para o fluxo existente de entradas e saídas.
4. Comparação mensal até o mesmo dia do mês anterior, com ajuste para meses menores. Mês passado usa meses completos. Demais modos usam o intervalo imediatamente anterior com mesma quantidade de dias.
5. Comparação só é apresentada quando o histórico disponível começa antes ou no início do intervalo anterior, sem sinal de truncamento bancário, e o período não termina no futuro. É comparação do histórico disponível, não uma homologação de completude bancária. A base zero não gera percentual; diferenças menores que 1% não são chamadas de igualdade exata.
6. Gráfico com no máximo 25 pontos acumulados, respeitando o fim de cada intervalo; tabela com os mesmos valores para conferência.
7. Agenda de despesas cadastradas vencidas e até o sétimo dia inclusivo a partir de hoje. Total inclui vencidos; máximo de três linhas e acesso à agenda completa. Diferencia agenda ainda não carregada e ausência de vencimentos cadastrados no intervalo. Nunca afirma que não existem contas a pagar.
8. Orçamento com gasto sob limites, limite total, margem/excesso e cobertura dos gastos mensais. Limite zero é preservado. Cobertura sem gasto é apresentada como sem gastos; excesso usa estado visual negativo.
9. Ranking das cinco maiores categorias do período, barras e valores. Cores personalizadas são respeitadas; a paleta diferencia categorias padrão que usavam a mesma cor. Clique abre a busca correspondente na fonte selecionada, não um filtro exato novo de domínio.
10. Movimentações confirmadas recentes clicáveis, priorizando título pessoal, com descrição bancária original secundária quando diferente. Contas levam ao extrato filtrado por conta e preservam saldo indisponível versus zero real.
11. Rodapé identifica `Interface U1` para distinguir este renderer no instalador. O commit do build continua sendo a referência de proveniência completa.

## Preservação financeira

Os indicadores continuam usando `bankSnapshotBetween`, `snapshotBetween`, cobertura de saldo e regras existentes de natureza, divisões e vínculos. As fontes bancária e manual não são somadas. A agenda usa o estado canônico de Planejamento. Novas funções só calculam janelas comparativas, apresentação de cobertura e pontos acumulados; nenhuma gravação financeira foi acrescentada.

## Verificação

- TypeScript 5.8.3: compilação e tipos.
- 197 testes desktop passaram, incluindo seis testes novos de janelas, ano bissexto, base zero, cobertura e limites dos pontos acumulados.
- O teste de estabilização foi ajustado para conferir a chamada de cobertura na nova composição em vez da propriedade do antigo componente Stat; os testes de saldo desconhecido/parcial/zero foram preservados.
- Navegação geral: 32 combinações das oito áreas em dois temas e duas larguras, sem erros.
- Fixtures D2: 24 combinações, também em 320 px; agenda, orçamento zero/remoção e contas com saldo ausente preservados.
- U1: dez combinações em 1920/1366/910/390/320 px nos dois temas. Conferidos comparação controlada, tabela do gráfico, ocultação de valores sem moeda no texto da tela, abertura de detalhes, busca por categoria e ausência de gravações financeiras.
- Capturas de Chrome headless com dados sintéticos foram inspecionadas. Não houve nova validação do EXE instalado com este código.

Os arquivos `cloud-system-browser.test.cjs` e `renderer-provenance.test.cjs` não fazem parte dos 197 testes acima. A revisão R2 registrou quatro falhas de login loopback e uma de proveniência no ambiente local com TypeScript 6; esses fluxos e seus testes não foram alterados nesta U1. A suíte completa e ASAR devem ser executados pelo CI com a ferramenta do projeto antes de homologar a release. Não se deve pular gates.

## Publicação e próxima etapa

Branch: `design/despezzas-d1-d4`, PR #16, permanecendo em revisão. Base anterior: `fc650078583b405ee91b809add588619cd138881`.

Nenhum novo EXE foi gerado localmente. Para revisar esta versão instalada, a pipeline CircleCI deve usar esta branch com `run_windows_build=true`, passar os testes obrigatórios e verificar ASAR/proveniência. O rodapé deve mostrar Interface U1.

Próxima etapa do roadmap: U2 — Movimentações e Planejamento. O resultado visual deste U1 ainda deve ser avaliado no instalador, com os dados reais, antes de declarar a remodelação global aprovada.

## Continuidade em outro computador — 09/11/2026

O trabalho foi recuperado em ambiente Linux isolado, sem acesso ao app instalado nem aos dados pessoais do novo PC. Os 231 arquivos de texto recuperados foram comparados aos hashes dos blobs GitHub, sem diferenças. A base da U1 havia sido preparada em uma árvore Git antes da troca de ambiente; esta continuidade publica essa mesma implementação.

Validação adicional com as dependências declaradas do projeto:

- TypeScript 5.8.3: tipos e verificação F08 da correspondência exata de `app/app.js` com as seis entradas do compilador aprovados.
- Suíte desktop completa: 208 testes aprovados, zero falhas. As cinco falhas do ambiente Windows anterior não se repetiram neste ambiente; nenhum teste ou fluxo de login foi alterado para obter esse resultado.
- Worker/PWA: 129 testes aprovados, zero falhas.
- A tentativa de repetir os testes visuais com Chromium local não iniciou: falha de criação do socket do processo do navegador. Isso não invalida nem substitui a revisão visual anterior no Windows; impede apenas nova certificação visual neste ambiente.

Nenhum novo instalador Windows foi produzido nesta continuidade. A U1 não altera a composição da PWA, cuja adaptação continua prevista para U4. O app instalado no novo PC e seus arquivos pessoais não foram acessados ou modificados.
