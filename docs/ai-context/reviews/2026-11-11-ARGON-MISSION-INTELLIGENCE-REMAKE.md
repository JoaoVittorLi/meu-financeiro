# MF2 — Missão ARGON I1/I2/I3: Remake integral da Inteligência

**Data:** 11/11/2026. **Status:** APROVADO PARA DESENVOLVIMENTO ISOLADO, não integrado nem homologado.  
**Decisão:** ARGON assume integralmente a direção de produto, design e implementação da Inteligência (chat lateral presente em todas as áreas + aba Inteligência + motor de ações aprovadas). Executor 2 mantém D1.5.1, outras correções e build Windows. Arquiteto integra e valida gates.

## 1. Baseline comprovado

- Repositório: JoaoVittorLi/meu-financeiro. Staging beta.8 PR #31 HEAD d513c2be3f9b0cd018aed0b71f46ce8747a6556c.
- Executor PR #36 HEAD 71eb60d141a9346a9bf9d4744ab05d132101701d em fix/mf2-d1-5-premium-interactions-20261111, ainda draft, corrigindo riscos financeiros antes de novo Windows EXE.
- src/intelligence-view.ts (~143 linhas) implementa Hoje/Conversar/Plano de ação; a aba Hoje admite dados fictícios, o chat apresenta rascunho preparado e renderIntelligencePanel (drawer) contém aviso de rascunho local e botão "Preparar na Inteligência". A interação lateral não atende uma pergunta no próprio lugar.
- src/intelligence-integration.ts disponibiliza testes de conexão com IA usando perguntas fictícias e contexto sintético (aiFinancialContextDemo), ainda distinto de chat financeiro real e de autorização operacional.
- app/intelligence.css (~1646 linhas) guarda os componentes atuais da interface. A nova missão não deve causar regressões A-D1–A-D6 ou D1.5.1.
- Não afirmar que já existe motor read/write ou buildLocalBriefing(snapshot) — a função não foi encontrada no commit auditado.

## 2. Experiência-alvo (dois modos conectados)

### Modo rápido — assistente lateral
- Deve abrir de qualquer área sem navegar para outra página. Ser compacto, leve, responsivo e ter um primeiro estado com pergunta pronta e sugestões discretas contextualizadas (sem cartões enormes, badges repetidos e blocos de explicação).
- Foco do teclado diretamente no campo; Enter envia, Shift+Enter cria nova linha; Escape fecha quando apropriado; atalhos descobríveis; histórico resumido, expandir para aba completa mantendo pergunta e contexto.
- Ao perguntar sobre a página atual, contexto explícito e consentido: página, período e filtros. Mostrar indicador compacto "Usando: Movimentações · Outubro" com opção de alterar/desativar. Nunca enviar dados bancários brutos automaticamente.
- Respostas no próprio drawer: curtas por padrão, aprofundamento sob demanda; cartão de resultado ou mini gráfico apenas quando agrega valor; loading/streaming, cancelamento, retry e erro legíveis; estado offline/autenticação/limite sem informação supérflua.
- Não bloquear modal ou planilha por overlays complexos. Sem falso controle de clique, respeitar foco, tema claro/escuro e movimento reduzido.

### Modo completo — aba Inteligência
- Experiência articulada em três superfícies: Hoje (radar financeiro determinístico real), Conversar (histórico, fontes, filtros, gráficos e tabelas), Ações (propostas pendentes, aprovadas, negadas, executadas e erros).
- Cards devem nascer de dados verificáveis, com data, fontes e nível de completude; NÃO exibir números fictícios como resultados reais.
- Chat com threads, busca, reabertura, controle de contexto, tabelas, gráficos, navegação aos módulos e exportação/compartilhamento somente dentro das permissões.
- Configurações técnicas, tokens, modelos, cotas e laboratório devem sair da primeira dobra do chat para Configurações ou área avançada sem perder transparência.
- Argon pode propor layout superior, mas comprovar escolhas em imagens reais do Electron 1366x768 e 1920x1080, claro/escuro e reduced motion.

## 3. Ferramentas: começar por categorização autorizada

Exemplo: "Categorize minha compra no mercado de ontem como Alimentação".
1. Interpretar intenção como PROPOSTA, nunca executar a partir de texto do modelo.
2. Descobrir alvos com ferramentas determinísticas, apresentando estabelecimento, data, valor, conta/origem e IDs estáveis. Havendo ambiguidade, solicitar escolha; não inventar transação.
3. Preparar preview "de [categoria anterior] → para [Alimentação]" com impacto em relatórios/orçamento, quando calculável; indicar quais dados não mudam.
4. Exibir ações inequívocas **Permitir alteração** e **Negar**, com possibilidade de editar categoria e cancelar.
5. Em Negar: nenhuma escrita, resposta de cancelamento, registro mínimo opcional e sem reexecução.
6. Em Permitir: validar alvo, tipo/origem, versão/revisão, autorização e política. Para importação Pluggy usar API de categorização/override pessoal já existente, preservando extrato bruto. Para manual usar mutação transacional apropriada, sem usar o modelo para gravar diretamente no SQLite.
7. Registrar outcome real, ID de operação, sucesso/falha, diferenças e recuperação possível. Mensagem de sucesso só após confirmação backend. Reenvio não pode duplicar mutação (idempotência); operação pendente com estado stale deve ser revista.
8. Conjunto inicial de ações aprováveis: categorizar item manual/bancário; criação/ajuste de orçamento; criação de meta/planejamento, somente após contrato específico, testes e preview. Exclusão em lote, desfazer conciliação e mudança bancária original não entram nesta primeira wave.

**Modelo de segurança:** leitura mínima, ferramentas com allowlist/esquemas tipados, validação independente da IA, isolamento por perfil, proteção de segredo, rastreabilidade, sem execução arbitrária de código/SQL e sem "autorizar tudo" persistente. Nenhum custo de API assumido como incluso no plano ChatGPT; respeitar autorização e limites reais do provedor. Never use production financial data in CI.

## 4. Missões com entregas funcionais

- **I1-A arquitetura + UI rápida:** descoberta focada no código/fluxos atuais, UX do lateral e tela completa, protótipos antes/depois, reestruturação de componentes e implementação real do fluxo compacto. Não entregar apenas mockup.
- **I1-B radar local:** read model determinístico com próximos compromissos, tendências e orçamentos em risco; centavos e datas auditáveis; estados sem dados; sem depender da IA externa; testes com fixtures.
- **I2-A conversa de verdade:** integração de perguntas com fonte autorizada, contexto mínimo, threads, streaming, respostas visuais, cancel/retry, custos/permissões, sem confundir simulação com produção.
- **I2-B autorização de ações:** implementar categorização ponta a ponta em dados sintéticos, fluxo Permitir/Negar, preview, backend autorizado, resultado e idempotência. Expandir para orçamento/planejamento depois da operação de categoria homologada.
- **I3:** análises proativas, ação com undo seguro, radar avançado e workflows combinados, após I1/I2 reais e revisão do Arquiteto.

## 5. Branch e ownership sem conflitos

Argon deve criar **branch/worktree isolada**, sugestão feat/mf2-i1-intelligence-remake-argon-20261111, a partir de commit verificado da staging. Nunca comitar na branch do Executor ou main. **Não editar simultaneamente:** src/app.ts, electron/db.cjs, app/premium-interactions.css, app/operations.css, app/overview.css, app/decisions.css, .circleci/* nem scripts de release. Esses caminhos são de alta colisão com D1.5.1.

**Ownership inicial do Argon:** src/intelligence-view.ts, src/intelligence-integration.ts, app/intelligence.css, novos src/intelligence-* e shared/ai-* / electron/ai-* conforme infraestrutura existente, testes intelligence. Se for indispensável tocar arquivos compartilhados, primeiro projetar integração isolada/adaptador e registrar o patch proposto, sem publicar alteração conflitante. Após D1.5.1 fechar, Arquiteto coordena integração mínima e testes no HEAD da staging; não cherry-pick cegamente.

Argon é proprietário integral da **implementação** da nova Inteligência, não apenas mockups. Executor 2 não deve construir uma segunda IA nem modificar arquivos da Inteligência até liberação. PWA/Cloudflare Production fora da missão; prever contratos reaproveitáveis posteriormente.

## 6. Qualidade/QA

- Benchmark focado em produtos financeiros e experiências de IA (Copilot Money, Monarch, Revolut, ChatGPT, Claude, Gemini): usar evidências atuais de funcionalidades e design, não listas de marketing; escolher princípios, não copiar visual.
- Testes Node/TypeScript, contratos de dados, real SQLite para operações, tratamento de falhas, bloqueio de autorização, stale state, perfil, idempotência, offline, teclado, acessibilidade/contraste, Electron GUI de chat e drawer nas oito páginas.
- Capturas reais 1366/1920 claro/escuro, estados compactos, longos, loading, resposta, confirmação, negado e erro; não renderizar mockups como screenshots do EXE.
- Ações testadas com registros sintéticos, Pluggy mockado. Não usar nem publicar dados pessoais, chaves ou tokens. Separar testes simulados de runtime nativo.
- Cada subentrega: branch/PR/commit, arquivos, matrizes, testes executados e não executados, screenshots, rollback, dependências, impacto no roadmap. Não promover como "funcional" sem ação executada e verificada.

## 7. Critérios de aceite de produto

1. Pergunta curta pode ser formulada e respondida **no drawer**, sem navegação obrigatória para Inteligência.
2. Drawer não apresenta o catálogo de configuração/avisos como conteúdo principal; primeiro estado compacto.
3. Chat principal apresenta resposta realmente originada de dados autorizados, e não cards de ficção.
4. Solicitação de categorizar gera preview com alvo inequívoco e **Permitir / Negar**; Negar não escreve nada; Permitir altera apenas classificação pessoal e confirma após persistência.
5. Sem dados suficientes, não inventar análise ou transação; mensagens honestas de erro, limite ou offline.
6. Dados de usuário e extratos Pluggy protegidos; testes reais e acesso mínimo.
7. Design Premium consistente com nova identidade MF (sem esperar assets ID1 para fazer o código), acessível, leve e com aparência própria.
8. Primeiro EXE D1.5.1 pode ser liberado independentemente. A integração da nova Inteligência requer gate separado e SHA próprio.

## 8. Próximas decisões

**AGORA:** Argon começa I1-A e parte independente de I1-B em branch própria; Executor concentra D1.5.1 e novo EXE. Arquiteto revisa contratos para categorizar via autorização e coordena conexão futura com src/app.ts/SQLite. Não atrasar o teste Windows do proprietário.

**Esta documentação não altera código nem atesta conclusão.** Integrar somente após provas de segurança, função real e UX.
