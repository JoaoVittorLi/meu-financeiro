# D3 — Planejamento, Simulador e Configurações

Continuidade: consulte `docs/DESIGN_D4.md` para o alinhamento de Inteligência/PWA e a validação posterior com TypeScript 5.8.3.

Checkpoint local sobre D1/D2, na branch `fix/asar-windows-nested-paths`. Sem commit, push, publicação, mudança de versão ou novo EXE.

## Implementação

- Configurações agora tem navegação por assunto: Aparência, Perfil financeiro, Dados e recuperação, Integrações, Inteligência e Demonstração. Os cartões e handlers existentes foram preservados e reorganizados por identificadores explícitos; backup completo continua distinto de exportação manual.
- Aparência oferece prévias claro/escuro e seletor Claro/Escuro/Sistema sincronizado com o seletor lateral. A preferência permanece por dispositivo.
- Planejamento apresenta ações compactas, próximos vencimentos e agenda antes do gráfico. A navegação de mês fica junto à agenda; a projeção diária abre sob demanda e usa o mesmo mês, sem um segundo controle concorrente.
- Editor de compromisso recebeu apresentação lateral e ocupa toda a largura no celular. Sua gravação, repetição, parcelamento, certeza e vinculação não foram alterados.
- Simulador recebeu composição mais simples e seção expansível de premissas, com reserva cadastrada e identificação do caráter de simulação. Formulário e resultado ficam lado a lado quando há espaço, empilhados em telas estreitas.
- Rótulos e acesso à demonstração permanecem visíveis na navegação lateral nas larguras intermediárias e móveis. A navegação móvel inferior definitiva ainda não foi implementada.

## Validação executada

- Compilação TypeScript: zero erros com o compilador 6.0.3 disponível localmente. O projeto continua declarando 5.8.3; não houve troca de dependência. A supressão de depreciações foi somente na chamada local.
- 65 testes focados aprovados, incluindo aparência, interface, categorias, datas, orçamentos, planejamento, paridade de parcelamento e preservação dos painéis/handlers de Configurações.
- Smoke de navegação das oito áreas nos dois temas, nas larguras 1366/390: 32 combinações sem erro JavaScript ou overflow horizontal da página.
- Fixture desktop inteiramente sintética: Planejamento/Simulador/Configurações em 1366/390/320 e nos dois temas, mais a visita aos seis grupos de Configurações em cada largura/tema.
- Interações: troca de tema sincronizada; editor de perfil cancela sem gravar; botões de backup completo e exportação manual continuam separados; auditoria E1 permanece disponível em Integrações; editor de compromisso cancela; período da agenda muda; projeção expande/recolhe.
- Simulação demonstrativa de R$ 1.200 em seis parcelas sem juros: parcela de R$ 200 e custo total de R$ 1.200, sem gravação no ledger da fixture. Os testes de planejamento e parcelamento verificam o motor separadamente; esse exemplo de navegador usa o caminho demonstrativo.
- Inspeção visual direta de Configurações clara, Planejamento escuro e Simulador claro móvel. Capturas contêm apenas dados fictícios.
- `git diff --check` sem problemas.

Não houve acesso ao SQLite pessoal, novas conexões bancárias, chamadas de IA ou ações de backup/restauração reais. Os controles de integração/backup foram conferidos pela presença e organização, sem executar ações sensíveis. Isso não certifica IPC real, Electron empacotado, instalação, acessibilidade com leitor de tela ou suíte geral completa.

## Próximas dependências

1. D4: revisar a apresentação da Inteligência e do painel contextual com capacidades reais claramente identificadas; não transformar demonstração em análise financeira real por mudança de texto ou desenho.
2. Alinhar o conteúdo e a navegação da PWA, incluindo configuração e estados móveis. Só os estilos compartilhados foram replicados nesta etapa; não há declaração de paridade de conteúdo.
3. Validar diálogos, teclado, contraste, zoom e renderer empacotado; concluir o build Windows com as versões declaradas e registrar o SHA dos artefatos antes de anunciar instalador.

Evidências locais: `../audit-review-temp/design-d3-tests.log`, `check-d3-fixtures.cjs`, `design-d3-browser-results.json` e capturas `d3-*`. A fixture reaproveita o mock sintético de `check-d2-fixtures.cjs`, sem acesso externo. `tests/design-d3.test.cjs` guarda os testes de preservação dos grupos de configuração.
