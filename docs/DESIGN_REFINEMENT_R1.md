# Acabamento R1 — controles e telas de uso diário

## Entrega

Primeira de duas etapas do acabamento inspirado no Despezzas. Este recorte não representa uma medição percentual da remodelação.

- Seletores compartilhados: chevron SVG de 16 px centralizado; rotação ao abrir; check SVG na opção escolhida. Removida a dependência do alinhamento de caracteres da fonte.
- Seletores nativos: mesmo desenho de seta nos temas claro e escuro. Controles compactos de 36 px e campos de formulário de 44 px.
- Menus e calendário: bordas, foco, sombras e seleção com contraste nos dois temas; setas de navegação do calendário em SVG.
- Estrutura: faixa de navegação acima do título, identificação do modo e ações específicas por página. Movimentações tem uma única ação de novo lançamento.
- Visão geral: saldo e três métricas reunidos em um cartão; agenda ao lado; hierarquia mais leve em gráficos e conteúdo secundário.
- Movimentações: filtros, resumo de resultados, orientação de edição recolhível, cabeçalhos e linhas mais limpos; nome original da transação preservado.
- PWA: recebe a folha compartilhada de acabamento dos controles. A nova composição do dashboard desta etapa é do desktop.

## Verificação

- TypeScript 5.8.3: compilação e verificação de tipos.
- 68 testes focados do desktop e 129 testes Worker/PWA.
- Navegação desktop: oito áreas, dois temas, larguras 1366 e 390 px (32 combinações).
- PWA com API fictícia sem autorização: oito áreas, dois temas, larguras 1366, 390 e 320 px (48 combinações); nenhuma escrita financeira.
- Seletores: dois temas e larguras 1366, 910, 390 e 320 px. Conferidos SVG centralizado com desvio inferior a 1 px, teclado, seleção, calendário e Escape preservando o formulário pai; nenhuma gravação financeira.
- Dados sintéticos usados na revisão visual; sem alterações em contas bancárias reais.

Os testes de navegador foram executados em Chrome headless sobre o renderer compilado. O teste isolado de StyledSelect recebeu a dependência Icon usada agora na renderização. Isso preserva as verificações de teclado e portal existentes.

## Próxima entrega R2

1. Aplicar a mesma composição a Planejamento, Orçamentos, Contas, Simulador, Inteligência e Configurações, incluindo painéis de edição e estados vazios.
2. Revisar densidade, tipografia, ícones e ações em todos os estados; retirar resíduos visuais do tema anterior.
3. Completar a adaptação correspondente na PWA e verificar desktop/mobile nos dois temas.
4. Executar os gates completos do projeto no CI e verificar o instalador Windows gerado, incluindo ASAR e proveniência. Compilar o renderer localmente não equivale a testar o EXE empacotado.

## Build e publicação

Branch de revisão: `design/despezzas-d1-d4`, PR #16. A atualização de código não instala automaticamente uma nova versão no computador. A pipeline CircleCI exige `run_windows_build=true`; seus gates obrigatórios devem permanecer ativos. Nenhum EXE foi produzido ou validado localmente nesta etapa.
