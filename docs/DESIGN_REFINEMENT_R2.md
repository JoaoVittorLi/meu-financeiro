# Acabamento R2 — conclusão da revisão visual

## Escopo implementado

Esta etapa estende o acabamento R1 às seis áreas restantes do desktop e aproxima a composição da PWA da mesma base visual. O padrão é inspirado no Despezzas, com adaptações às funções reais do Meu Financeiro. Áreas PRO não observadas continuam sendo propostas próprias.

- Planejamento: resumo contínuo com divisórias, agenda e próximos vencimentos, filtros compactos, linhas de movimentações, navegação mensal em SVG e edição lateral. Próximos compromissos mantêm prioridade sobre os indicadores e a projeção continua recolhível.
- Orçamentos: escala única para indicadores, cartões, limites e ações; estados de limite zero, sem limite, excesso e margem mantidos.
- Contas: valores e referências com tipografia consistente, cartões e ações com a mesma escala, conexão técnica recolhível. Saldo desconhecido continua diferente de zero.
- Simulador: formulário e resultado com a mesma hierarquia, exemplos compactos e estado vazio mais leve. Premissas e limitações continuam acessíveis.
- Configurações: navegação interna, cartões, valores editáveis e prévias de tema uniformizados.
- Inteligência: cartões, abas, rascunhos e painel contextual refinados. Continua uma prévia; o acabamento não habilita inferência financeira.
- Formulários: campos de 44 px, rótulos e ajuda consistentes, botões de fechar em SVG com nome acessível e campos empilhados em telas estreitas.
- PWA: navegação com ícones e grupos, faixa de localização sincronizada, indicadores agrupados, tabelas/listas e edição lateral nos dois temas. IDs e contratos de dados preservados.
- Calendário PWA estreito: células compactas com marcador de compromisso. Os detalhes e valores completos aparecem na seleção do dia, evitando quebra vertical de caracteres.

Não houve mudança de cálculo, migração de dados, conciliação automática ou habilitação de escrita bancária.

## Validação local

- Compilação e tipos: TypeScript 5.8.3, sem erros.
- 191 testes desktop passaram na suíte disponível sem os dois arquivos de testes abaixo; 129 testes Worker/PWA passaram.
- A suíte desktop completa terminou com 197 testes aprovados e cinco falhas nos testes do fluxo de login por navegador/loopback (`cloud-system-browser.test.cjs`) e no teste F08 de proveniência (`renderer-provenance.test.cjs`). Este último carrega o TypeScript 6 disponível no runtime de testes, enquanto o projeto usa 5.8.3. Esses arquivos não foram alterados nem suas verificações enfraquecidas. A suíte completa continua pendente de execução no ambiente de CI do projeto.
- Navegação desktop: 32 combinações das oito áreas, dois temas e larguras 1366/390 px.
- Dados sintéticos desktop: 24 combinações de Visão geral/Movimentações/Orçamentos/Contas; 18 de Planejamento/Simulador/Configurações; 18 de Inteligência. Cobertura também em 320 px, edição cancelada sem gravação, navegação mensal, limite zero/remoção e projeção recolhível.
- Seletores: oito combinações em 1366/910/390/320 px, nos dois temas; SVG centralizado, teclado, calendário e Escape preservando o formulário pai; zero gravações financeiras.
- PWA: 48 combinações sem sessão e 48 com API inteiramente sintética. Conferidos breadcrumb, indicadores preenchidos, nome original do banco e edição/cancelamento em 1366 e 320 px nos dois temas. Nenhuma requisição de escrita; nenhum envio à IA.
- Capturas revisadas em Chrome headless. A revisão do calendário em 320 px inclui limite de altura de 42 px por célula para impedir a regressão de quebra vertical.

## Estado da entrega

Código na branch de revisão `design/despezzas-d1-d4`, PR #16. Esta etapa conclui o recorte visual planejado R1/R2; não equivale a homologar o aplicativo empacotado.

Pendências de release: rodar a suíte completa no ambiente do projeto, corrigir eventual falha confirmada nesse ambiente, gerar o Windows com `run_windows_build=true` no CircleCI e validar o EXE/ASAR/proveniência. Nenhum instalador novo foi gerado, nenhum merge ou deploy cloud foi feito nesta etapa.
