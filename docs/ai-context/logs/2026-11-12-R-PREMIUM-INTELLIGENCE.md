# R0 + R1 + R2 inicial — Inteligência Premium | 12/11/2026

**Status:** código visual publicado em branch R exclusiva, **EM_TESTE / NÃO HOMOLOGADO**. Contrato base IC v1; serviço externo ao PR visual: **PR #51** / HEAD inicial consultado `c45a01c`. Issue de coordenação: #49. Este trabalho **não** fez merge/cópia do backend I.

## Entrega concreta
- `src/intelligence-view.ts`: substituição da antiga aba Hoje conceitual e fictícia por **central de comando Premium baseada nas oito respostas UI-01..UI-08**. Topo orientado a radar, fila de revisão, orçamentos visuais, compromissos e quatro cartões secundários de regras, categorias, conversa e recibos. Todos os valores exibidos provêm dos campos efetivamente retornados pelo endpoint ou são suprimidos em estado não autorizado.
- `app/intelligence.css`: tema light/dark via tokens existentes, hierarquia editorial, movimento discreto, foco de teclado, breakpoints 1280/900/560 e reduced-motion. Nenhum screenshot inventado; a fidelidade visual real depende de abrir Electron.
- `src/app.ts`: navegação para Inteligência carrega o adaptador; `navigation:category-editor` leva ao editor real de Movimentações/Categorias e preserva o rascunho do formulário.
- `src/intelligence-local.ts`: ciclo grant/período/revogação atualiza cards, enquanto o envio do chat preferencialmente chama **`intelligenceOperationalAsk`** em vez de reconstruir interpretação ou cálculo. Mantém compatibilidade de leitura legada quando a branch R estiver isolada sem o IPC do PR I.
- A resposta conversacional inclui contexto de origem/cobertura e ações com roteamento real. O chat lateral e principal compartilham o mesmo `localFinancialSubmit`, a mesma lista temporária de mensagens e o mesmo grant.
- `tests/intelligence-premium-ui.test.cjs`: dez casos automatizados de contrato, UI, navegação, stale, ausência de grant, perfis sintéticos, comandos não suportados e fluxo de chat. São testes **versionados, não executados em Node neste ambiente**.

## Contrato / dependência
- A branch R fica em `feat/mf2-premium-redesign-20261112`, PR Draft contra `coord/mf2-premium-intelligence-20261112`; **não inclui nem modifica** `electron/intelligence-operational.cjs`, `electron/main.cjs`, `electron/preload.cjs`, `electron/financial-intelligence.cjs` do PR #51.
- Na integração, `intelligenceOperationalOverview({month,token,source,profile,reviewToken})` devolve **UI-01…UI-08**. Backend e permissões permanecem propriedade do Executor I.
- `intelligenceOperationalAsk({month,token,question})` retorna fatos/evidências e `actions[]`, renderizados sem gravar token no histórico. Quando IPC está ausente na branch R, o painel explicita que falta a integração do PR #51.
- Handlers aceitos: `navigation:transactions-review`, `navigation:transactions`, `navigation:budgets`, `navigation:planning`, `navigation:category-editor`, `navigation:intelligence-chat`, `navigation:review-history`, `categoryReviewPrepare`. O último só oferece **prévia** dentro da Central **sintética** com token de revisão específico; confirmação/backup mantêm o IPC protegido e aprovação humana já existente.
- Pendente bancário não é "pendente de categoria"; a UI apresenta contagens separadas quando a fonte fornece `posted` e `pendingBank`. Cobertura parcial é informada e o usuário não recebe garantia de completude do extrato.
- Mudança de conta/fonte/perfil/mês/grant gera assinatura de sessão; resposta assíncrona antiga é descartada e não exibe dados stale.

## Provas executadas e limitações
- Confirmados no GitHub: R branch inicialmente idêntica à coord/870b7da8, PR #51 publicado separadamente, Issue #49 e contratos obrigatórios lidos.
- **Executado em V8 isolado sobre código extraído do arquivo remoto:** 7/7 probes (invalidação de período, centavos formatados, rotas whitelist, ações sintéticas/desconhecidas bloqueadas, carregamento de payload autorizado, descarte de resposta stale e rejeição de contrato inseguro).
- **Não executado / não afirmar sucesso:** instalação/checkout Windows, screenshot Electron antes/depois, Computer Use nativo, testes Node, TypeScript `npm run test:types`, `npm test`, F08, ASAR, teste integral de IPC e temas em 1366x768/1920x1080. O teste Node adicionado precisa ser executado pelo integrador ou Work com checkout real.
- **Limite do PR visual isolado:** os serviços do PR #51 ainda não existem nesta branch; a integração funcional de ponta a ponta e a regeneração canônica de `app/app.js` devem ocorrer **na branch do Integrador**, nunca como substituição do backend.
- Não foram alterados dados pessoais, segredos, configuração de API paga, main, produção, CircleCI pago nem gerado EXE.

**Próximo:** integrar os dois PRs em worktree descartável / branch de integração, compilar TypeScript, executar testes Node/SQLite, F08/ASAR, Electron sintético, conferir abertura efetiva de cada handler, screenshots nativas light/dark e correções visuais antes de homologação.