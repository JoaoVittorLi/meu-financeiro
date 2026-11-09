# D1 — Fundamentos do novo design

Continuidade: o lote seguinte está registrado em `docs/DESIGN_D2.md`. Leia esse checkpoint também antes de retomar; o D1 abaixo descreve a primeira etapa.

Data: 08/11/2026. Implementação local na branch `fix/asar-windows-nested-paths`. Não publicada e sem instalador novo.

## Entregue

- Temas Claro, Escuro e Sistema com preferência persistida por dispositivo e atualização conforme o sistema.
- Navegação agrupada em Controle, Organização e Ferramentas; superfícies, bordas, botões, tipografia e estados com tokens semânticos.
- Aplicação dos fundamentos às oito áreas existentes, mantendo cálculos, integrações e persistência financeira.
- Botão flutuante que abre o painel contextual existente. Abertura não faz chamada de IA. O painel continua identificado como prévia.
- Correção do retorno de foco ao fechar esse painel com Escape.
- Cores semânticas de receitas/despesas e eixos adaptados aos dois temas no gráfico de fluxo.
- PWA com os mesmos tokens e preferência de aparência; ajuda contextual própria mantendo explícita a indisponibilidade de conversa financeira real.

## Validação executada

| Verificação | Resultado |
|---|---|
| TypeScript | Zero erros com compilador 6.0.3 disponível localmente; depreciações suprimidas apenas na chamada local, sem alterar a configuração do projeto |
| Testes focados | 43 aprovados: aparência, interface, datas, categorias, orçamento e IA |
| Navegação automatizada em Chrome isolado, com demonstração fictícia | Oito áreas × dois temas × duas larguras (1366 e 390 px): 32 combinações sem overflow horizontal da página ou erros JavaScript |
| Aparência | Persistência após recarregar; Sistema acompanha preferência do sistema até escolha explícita |
| Painel contextual | Abrir, fechar com Escape e devolver foco ao botão flutuante aprovados |
| Inspeção visual | Capturas locais de Visão geral, Orçamentos e Inteligência, nos dois temas e nas duas larguras; revisão direta de Visão geral clara e Orçamentos escuro |
| JavaScript adicional | Verificação de sintaxe aprovada |

A primeira execução da suíte geral teve 177 aprovações e 14 falhas: renomeações bloqueadas no diretório temporário protegido, testes de abertura de navegador e incompatibilidade do compilador local 6.0 com o teste de proveniência. Não se declara aprovação da suíte completa. O projeto continua fixando TypeScript 5.8.3; o build oficial precisa usar a versão declarada.

As telas foram verificadas no renderer de navegador com perfil de demonstração isolado, sem abrir SQLite pessoal, acionar Pluggy ou enviar informações à IA. Isso não substitui a validação do Electron empacotado nem de dados reais. A PWA recebeu os fundamentos, mas não teve verificação visual completa ou publicação nesta etapa.

## Próxima entrega

D2/D3: refinar a composição de cada página conforme o mapa consolidado (não apenas as cores), incluindo prioridade dos compromissos, simplificação de Orçamentos, edição por painel, configurações agrupadas e navegação móvel. Depois concluir as verificações de PWA e Electron e produzir o instalador com a ferramenta declarada no projeto. Não ativar migração ou inferência financeira por causa da mudança visual.

## Continuidade

`app/appearance.js` define a preferência antes de carregar a página; `app/design-system.css` é a camada final do tema. As cópias correspondentes ficam em `mobile-push/public/`. Preservar a igualdade desses arquivos ao alterar tokens e comportamento de aparência.

O JavaScript gerado que já estava modificado antes desta tarefa foi preservado em `../audit-review-temp/renderer-before-design.js`. `app/app.js` foi recompilado das fontes TypeScript; não foi editado à mão. A suíte automatizada visual e os resultados estão em `../audit-review-temp/check-new-design.cjs` e `design-browser-results.json`.

Não houve commit, push, deployment, build EXE ou alteração do número da versão. Não usar o instalador anterior esperando encontrar este design.
