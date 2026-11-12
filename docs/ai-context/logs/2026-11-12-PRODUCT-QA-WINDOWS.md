# QA Windows operacional — aguardando autorização

Base #43: bc5ccb4f28c2e224614100dff41e03d0c1034fca; branch test/mf2-windows-product-qa-20261112. Sem alteração de CSS ou regras financeiras. Nenhum CI iniciado.

## Evidência atual

Windows local; Electron anteriormente encerrou 0x80000003 antes de CDP e sandbox_approval:false impede execução fora da restrição. Não repetir tentativa ou desligar proteções. Nenhuma GUI/CUA funcional nem conector CircleCI nesta sessão. Não há screenshot autêntico nesta entrega. Capturas futuras serão exclusivamente do Electron real, identificadas por SHA, versão, tema e dimensões no manifesto.

Comparação somente de código do ASAR instalado, sem abrir aplicativo/perfil/SQLite: todos os dez CSS comuns à instalação e à #43 são byte a byte iguais. intelligence-staging.css está somente na candidata, e index.html difere. Evidência em installed-code-comparison.json. Isso não prova o hover calculado nem autoriza corrigir por seletor; não foi realizada uma correção especulativa.

## Runner preparado, sem instalador

Novo parâmetro run_windows_qa=false por padrão. Após autorização específica e publicação da configuração na branch escolhida, disparar UMA pipeline no SHA aprovado com run_windows_qa=true, run_windows_build=false, run_preflight=false. O workflow executa preflight Linux e QA Windows GUI, sem dist:windows, electron-builder, releases ou atualização local. Não executar build_windows. Consumo do runner Windows exige autorização do proprietário; não inferir essa permissão da preparação do PR.

.circleci/qa-windows.ps1 usa o mesmo Node oficial 22.23.4 com SHA256 verificado/npm10.9.9, npm ci, tipos, SQLite, compilação canônica, ASAR, proveniência, F08, smoke oficial e captura de produto. Perfil temporário validado pelo smoke e caminho SQLite conferido via IPC antes de testes. Dados sintéticos; nenhum perfil do usuário. Mantém proteções Electron e sender. Logs/capturas em circleci-qa-artifacts, inclusive relatório FAIL se ocorrer exceção após lançamento. Sem instalação local e sem produção.

scripts/product-electron-qa.cjs exporta/reutiliza somente os helpers oficiais; gera 32 telas (8 áreas x 4 presets), amostras de todos os cards visíveis das 11 famílias e capturas Normal/Hover/Retorno para o primeiro card de cada família/página/preset. Move ponteiro via CDP genuíno; registra :hover, borda, fundo, variável semântica, transform, transição e pseudo-elemento calculados. Não força media hover nem finge homologação. Registra foco Tab, movimento reduzido, exceções e console.error. Uma mudança de tom é marcada para revisão, igualdade não é aprovação automática. Famílias/estados vazios têm contagem zero explícita; fixture não representa cobertura completa. O manifesto pede revisão humana de geometria e contraste.

## Checklist funcional que permanece pendente

| Área | Operações de homologação necessárias |
| --- | --- |
| Visão Geral | indicadores por fonte, saldo desconhecido, B3, hover de receita/despesa/resultado, navegação contextual |
| Movimentações | pesquisa/filtros, editar/categorizar/dividir, pendências, transfer/ignore, persistir/reabrir |
| Planejamento | criar/editar/cancelar, vencimento, parcial/pago, estimativas, recorrências |
| Orçamentos | zero/excedido/próximo, fonte correta, editar limite, persistir, B3 |
| Simular Compra | insuficiência de dados, premissas alteradas, recalcular e bloquear plano obsoleto |
| Minhas Contas | saldo desconhecido, fonte e conta, vazio e erro sem integração pessoal |
| Configurações | tema, teclado, backup/restauração exclusivamente descartáveis |
| Inteligência | Hoje, principal/lateral, histórico/expansão, Permitir/Negar/obsoleta; nova leitura só após integrar PR funcional |

O smoke oficial já exercita CRUD via IPC, link manual, planejamento, navegação, reinício/persistência e backups descartáveis. Isso não substitui a checklist completa por DOM. Esta nova ferramenta amplia evidência, não declara todas as operações homologadas. Live IPC tem feature detection e fica NOT_IN_THIS_BRANCH na base #43; não é PASS fictício.

## Validação desta preparação

Suíte base 448/448 PASS com alterações do harness, Node22.23.4/npm10.9.9; node --check de ambos scripts; parser PowerShell sem execução e YAML parse. Sem teste gráfico executado, sem Windows CI. Dependências do lockfile reutilizadas do checkout de gates. Artefatos de código em docs/ai-context/evidence/2026-11-12-product-qa.

## Integração

Draft independente para a branch #43. Integrar ferramenta de QA no topo do PR funcional antes de pedir execução se o objetivo incluir consultas locais; executar no SHA resultante. Reversão: remover este commit; nenhum dado migrado. Depois do runner, revisar evidência e corrigir apenas defeitos reproduzidos em outro commit, com novas capturas e gates. Melhorias de animação aguardam evidência; V1.3/B3 preservados.
