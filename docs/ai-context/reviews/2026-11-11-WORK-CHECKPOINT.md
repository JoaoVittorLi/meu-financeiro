# Meu Financeiro 2.0 — handoff Work ao Arquiteto Principal

## Resultado deste checkpoint

Branch `feat/mf2-work-intelligence-staging-20261112`, derivada exatamente de `ce8dd04669a474957dc2d6c1107bc91d862031fc` (PR #39). Desenvolvimento explicitamente autorizado pelo proprietário na missão Work. PR #39 preservado; nenhuma instalação, migração, inferência paga ou alteração de dados pessoais.

**Entregue:** clone separado; toolchain Node 22.23.4/npm 10.9.9; testes reais de código; primeira fatia navegável da Inteligência com dados fictícios; reprodução de inconsistência do resumo; scripts e evidências versionados. **Não entregue:** homologação visual, screenshots Electron, execução no Windows nesta etapa, inferência real ou gravação financeira pelo assistente.

## Ambiente e versões A/B

| Referência | O que é comprovado | Limite |
| --- | --- | --- |
| A: instalação Windows | Diagnóstico anterior leu `0.9.5-beta.8.58`, package interno `0.9.5-beta.8`, em `C:\Users\joaov\AppData\Local\Programs\Meu Financeiro\Meu Financeiro.exe` | Não foi iniciada; commit de origem não identificado; comparação funcional/visual direta NÃO EXECUTADA |
| B: integração PR #39 | `ce8dd04669a474957dc2d6c1107bc91d862031fc`; contém U5.1/U5.2, I1-B.1, V1.1–V1.3 e B3 | Versão igual no package não prova equivalência à instalação A |
| C: esta branch | Protótipo opt-in adicional, compilado no renderer; sem mudar motores financeiros | PR Draft independente contra B; requer revisão e QA Electron |
| Execução atual | Linux remoto do Work; Node 22.23.4/npm 10.9.9; Electron 45.2.3 do lockfile | O Windows local ficou indisponível após mudança de ambiente; nenhum teste Linux é apresentado como teste Windows |

O checkout antigo `meu-financeiro-dev` permaneceu intocado. Nenhum perfil pessoal foi copiado. Node foi obtido da distribuição oficial com SHA-256 conferido; npm instalado em diretório isolado. Lockfiles preservados. Diretório do clone remoto: `/workspace/scratch/5bfcfcfb454b/mf2-work-staging`.

## Evidências e comandos

Arquivos em [evidence/2026-11-11-work](../evidence/2026-11-11-work/).

| Verificação | Baseline B | Branch C | Categoria |
| --- | --- | --- | --- |
| `npm ci --no-audit --no-fund` | PASS | Mesmas dependências, sem novo lockfile | CONFIRMADO EM TESTE LOCAL |
| `npm run test:types` | PASS | PASS | CONFIRMADO EM TESTE LOCAL |
| `npm run test:db` | 420/420 PASS | 431/431 PASS | CONFIRMADO EM TESTE LOCAL; suíte Node inclui SQLite, VM, contratos e callbacks |
| `npm run compile` | PASS | PASS | CONFIRMADO EM TESTE LOCAL |
| `node scripts/renderer-provenance.cjs check-bundle` | PASS | PASS | CONFIRMADO EM TESTE LOCAL |
| `npm run provenance:create` / `provenance:verify` | PASS/PASS no checkout limpo B | PASS/PASS no commit de código `fb56ddc` | CONFIRMADO EM TESTE LOCAL |
| `npm run test:asar` | 1/1 PASS | 1/1 PASS | CONFIRMADO EM TESTE LOCAL; arquivo ASAR temporário real, não instalador |
| `npm run test:electron-smoke` | FAIL ao iniciar/CDP; bloqueio do ambiente | Mesmo bloqueio, nenhuma execução aprovada | BLOQUEADO |
| Chromium/Playwright local | Falha de socket Unix no início | Idem; sem screenshot | BLOQUEADO |
| Navegador cloud | Não alcança `localhost:4180` do terminal | Sem captura | BLOQUEADO |
| Windows instalado / desenvolvimento Windows | NÃO EXECUTADO | NÃO EXECUTADO | NÃO EXECUTADO |
| CircleCI Linux/Windows | Não disparados | Não disparados | NÃO EXECUTADO; resultados locais não são CI oficial |

Tentativa inicial C teve 428/431 PASS: três contratos detectaram que o novo CSS estava após `premium-interactions.css`. A ordem foi corrigida na implementação; nenhum teste foi relaxado. Nova execução integral: 431/431 PASS.

### Por que não há screenshots

O script oficial foi lido integralmente antes da execução. `isolateSmokeProfile` exige desenvolvimento, caminho absoluto real dentro do temporário e basename `mf-d1-electron-*`; redefine `userData` antes do lock/FinanceDB. `main.cjs` usa esse `userData` para SQLite/cofres/backups e bloqueia HTTP/HTTPS nas duas sessões do smoke. O script cria exclusivamente fixtures fictícias e confere `financeDesktop.info().path` quando consegue chegar ao CDP.

Foi possível instalar e iniciar o binário oficial do Electron. O processo interrompeu antes do CDP com `process_singleton_posix.cc: socket() failed: Operation not permitted`. Xorg dummy chegou a iniciar via TCP, mas isso não libera os sockets Unix requeridos pelo Chromium. Playwright/Chromium confirmou a mesma restrição. Nenhum lock ou proteção do app foi removido. Sem capturas 1366/1920, escala Windows 125%, inspeção de hover ou console do renderer. Não substituir essas provas por HTML ilustrativo.

## Auditoria inicial das oito áreas

Classificações visuais abaixo são **propostas baseadas no código**, não inspeção de tela. As jornadas DOM/IPC/SQLite integradas continuam pendentes; os testes Node não homologam o uso cotidiano.

| Área / benefício | Estado atual verificado e evidência | Classificação / próxima validação |
| --- | --- | --- |
| Visão Geral: entender receitas, despesas e posição | `bankTotalsInRange`, proveniência de saldo, V1.1–V1.3 presentes; regressões semânticas passam | MANTER indicadores aprovados; REFINAR somente após inspeção de overflow/valores longos no Electron |
| Movimentações: registrar, encontrar, revisar | U5.1 filtros/ordenação/lotes, editor manual e proteção BRL; `d1-2-desktop-integration`, categorias/vínculos passam | MANTER ganhos; REORGANIZAR apenas se fluxo real comprovar cliques excessivos; testar busca+categoria+seleção+persistência |
| Planejamento: antecipar compromissos | Agenda/calendário/projeção, natureza prevista/realizada e receitas incertas; `planning`, `u5-2-planning` passam | MANTER distinções; REFINAR legenda/densidade após capturas; restore e calendário via UI pendentes |
| Orçamentos: acompanhar limites | B3 colorido sólido semicircular e limite zero estão na integração; `b3-budget-gauge`, `budgets-v094` passam | MANTER B3; REORGANIZAR prioridade de risco apenas como proposta futura; verificar arco/textos em claro/escuro |
| Simular Compra: avaliar hipóteses | Cenário desatualizado recusa planejamento; A/B, parser BRL e passagem ao editor; `u5-2-simulator` passa | MANTER guardas; REFINAR explicação de saldo mínimo e cenários somente após uso real |
| Minhas Contas: reconhecer fontes/saldos | Saldo ausente permanece `null`; identidade composta e ingestão atômica cobertas por testes | MANTER semântica; REORGANIZAR status/cobertura numa próxima fatia; conectividade pessoal não consultada |
| Configurações: preferências e recuperação | `appearance`, `recovery`, integração SQLite passam; backup/restore sintético em Node | REORGANIZAR agrupamentos é hipótese; diálogo nativo, temas e acessibilidade precisam teste Windows |
| Inteligência: explicar e preparar ações | I1-B histórico/drawer/resumo/categorização local presentes; motor aberto não implementado; novo protótipo abaixo | REDESENHAR Hoje por opt-in; REFINAR chat existente; distribuição do resumo tem falha reproduzida |

### Achados novos

**WORK-AUDIT-01 — P1, OPEN, CONFIRMADO EM TESTE LOCAL.** `intelligenceBuildStructuredSummaryCard` ignora `splits`. Um único débito fictício de R$ 100, categoria original Compras, dividido em Alimentação R$ 60 + Transporte R$ 40, produz categoria Compras R$ 100 no chat. `aggregateFinancePeriod` retorna a divisão correta. Totais coincidem; distribuição é incorreta. Reprodução: `node scripts/work-audit-probes.cjs`; fixture e resultado em `audit-probe.json`. Falha financeira de apresentação na origem B; não foi corrigida incidentalmente na fatia visual C. Próxima correção deve reutilizar o agregado determinístico e testar splits válidos/desatualizados, fontes, pendências e limites de carregamento.

**WORK-AUDIT-02 — P2, CONFIRMADO NO CÓDIGO.** O chat usa `localStorage` e sua mensagem afirma “salva com segurança”. Isso não oferece a proteção criptográfica do cofre Electron. O PR #39 já reconhece a limitação. Refinar o texto e explicar retenção antes de habilitar consultas pessoais amplas; nenhum histórico pessoal foi lido.

**WORK-AUDIT-03 — escopo, CONFIRMADO NO CÓDIGO.** Perguntas abertas retornam indisponibilidade/I2-A; os cards Hoje são conceituais. Presença de interface ou OAuth não comprova inferência. O protótipo C acrescenta respostas determinísticas fictícias e nunca anuncia IA real.

### Reconciliação da auditoria histórica

Lido o diagnóstico de 09/11 e o roadmap de 22 entregas do PR #40 (`d4539a3341d4d0d79fc2e47da0669de87b26710b`), sem mesclá-lo na candidata.

- BUG-01: edição/exclusão manual existem no código novo e regressões passam; uso no Electron ainda pendente.
- BUG-02: refinamento de contraste V1.2 existe; validação visual continua aberta.
- BUG-03/04: CSS modernizado presente; personalizações e legado precisam capturas, sem declarar encerramento.
- BUG-05: exemplos já rotulados como fictícios; radar real segue pendente. Esta branch não o entrega.
- BUG-07: TypeScript fixado 5.8.3 e F08 passam; compatibilidade com TS6 não foi investigada.
- BUG-06/08–16, 88 cards e 24 iniciativas: o inventário integral não está neste clone. Não inventar detalhes nem marcar todos resolvidos. Recuperação dos materiais continua necessária.

## Nova Inteligência: código preparado

`src/intelligence-staging.ts`, `app/intelligence-staging.css`, dois hooks no renderer da Inteligência, entrada no tsconfig e CSS carregado **antes** do stylesheet premium final. Opt-in pelo botão **“Explorar nova Inteligência · dados fictícios”** na aba Hoje; sair retorna à experiência existente.

| Componente | Implementado nesta fatia | Limite |
| --- | --- | --- |
| Hoje | Radar prioriza orçamentos excedidos; compromissos futuros; aviso de dados insuficientes; origem/período/limitações | PROTÓTIPO DEMONSTRATIVO, sem diagnóstico das contas pessoais |
| Conversar | Perguntas sugeridas, respostas determinísticas, referências, múltiplas conversas temporárias e estados de erro | Sem LLM, sem persistência após encerrar; não substitui histórico I1-B |
| Chat lateral | Usa mesma conversa, alterna contexto pelo nome da seção, fecha/expande; teclado Escape/Tab preparado | Nenhuma leitura do conteúdo pessoal da página; QA de foco real pendente |
| Ações | Prévia de ajuste fictício de limite; Permitir/Negar; fonte/revisão/valores revalidados; decisão idempotente e registro na sessão | Um tipo de ação; categorização/metas/compromissos e execução real permanecem futuras fatias |
| Adaptador | Reutiliza `desktop.aiFinancialContextDemo` → `shared/ai-financial-context.mjs` → motor determinístico existente | Rejeita payload com dados reais/inferência/alterações; nada é enviado à IA |

Aprovação de simulação não altera sequer o snapshot fictício. Registros de decisão têm resultado `approved/denied/stale` e são apenas memória de sessão. Nenhuma chamada `save`, `planCreate`, `bankCategorize`, API paga ou `localStorage` na nova camada. Troca de fonte invalida prévia pendente; resposta atrasada não substitui fonte mais recente; sair invalida requisições em voo.

### Executar e revisar

1. No clone isolado, usar Node 22.23.4/npm 10.9.9 e `npm ci`.
2. Testes: `npm run test:types`, `npm run test:db`, `npm run test:asar` e F08.
3. Para protótipo em navegador: `node scripts/work-intelligence-preview.cjs`, abrir `http://localhost:4180`. Este host serve apenas dados fictícios e componentes React reais da branch; **não é Electron**.
4. Para homologação Electron: usar o script oficial com perfil temporário validado em um host que permita sockets; não iniciar `npm start` no perfil principal.
5. Nova sessão Windows deve produzir as 32 capturas originais e testar também o opt-in, chat/expansão, fonte manual/banco, confirmação/negação/stale, teclado e temas.

## Referências de experiência consultadas

Somente documentação pública; nenhuma conta de concorrente foi acessada e nenhuma interface proprietária foi copiada.

- [Copilot — Dashboard](https://help.copilot.money/en/articles/6045480-dashboard-tab-overview): revisão de novas transações e compromissos próximos. Aplicação proposta: poucos itens priorizados com ação de conferência.
- [Monarch — AI features](https://help.monarch.com/hc/en-us/articles/16116906962452-About-Monarch-s-AI-Features): explicar contexto e pedir confirmação antes de mudanças. Aplicação: prévia explícita e recibo de decisão, sem movimentar dinheiro.
- [Actual — Introduction](https://actualbudget.org/docs/): organização por orçamento/envelopes. Aplicação futura: separar planejamento de gastos de saldo disponível; não introduzir envelopes nesta missão.
- [YNAB — Foundations](https://www.ynab.com/guide/foundations-the-ynab-method): atribuir propósito ao dinheiro. Aplicação futura: metas com base conhecida, sem transformar receitas incertas em disponibilidade.

## Próximas entregas, preservando a ordem do PR #40

| Prioridade / entrega existente | Problema e solução | Código/visual preparado | Impacto, dependências, complexidade e risco | Teste de saída |
| --- | --- | --- | --- | --- |
| P1: #4 Verificação completa / #5 Prévia Windows | Falta prova da interface; retomar smoke em Windows ou Electron com sockets permitidos | Script oficial intacto; gates locais executados | Alto; acesso Windows; média; risco de confundir ambiente | 32 capturas + jornadas reais + backup/restore + provenance do SHA; build só autorizado |
| P1: #15 Converse com seu dinheiro | Resumo ignora splits; corrigir agregado sem duplicar motor | Reprodução executável pronta; código de correção não iniciado | Alto; contrato compartilhado; média; valores por categoria | Split válido/desatualizado, pending, transfer/ignore, origem única |
| P1: #14 Radar Financeiro | Hoje conceitual; evoluir este radar sobre leitura autorizada | UI/adaptador fictícios preparados | Alto; cobertura/saldo/data corretos; alta; alertas enganosos | Dados faltantes, limiar zero, período, fonte e reconciliação |
| P2: #15 Conversar / #17 Assistente contextual | Continuidade e respostas explicáveis | Chat/full/drawer e perguntas fictícias preparados | Médio; inferência/custo e consentimento separados; alta; privacidade | Threads, erro/retentativa, contexto mínimo, nenhuma chamada silenciosa |
| P2: #16 Alterações autorizadas | Falta execução supervisionada real | Fluxo de limite fictício e estado stale preparados | Alto; contratos backend/CAS/auditoria; alta; escrita indevida | Negar não escreve; confirmar só um alvo; replay, conflito e rollback |
| P2: #18 Visual coerente | Faltam capturas para julgar alinhamento, contraste e animação | Componentes opt-in com tokens atuais e movimento reduzido | Médio; QA visual real; média; regressão CSS | Temas, 1366/1920, teclado, escala 125% real |

Não há nova PWA, Cloudflare Production, merge, migração ou release. G0/G9 continuam **NÃO HOMOLOGADOS**.

## Integração, riscos e reversão

Revisar o diff contra PR #39, especialmente os hooks em `intelligence-view.ts`, ordem dos CSS e bundle emitido. A branch é um incremento **opt-in**, não substitui I1-B.1 nem B3. Evitar reaplicar os commits de base. Se a integração avançar, refazer os testes no SHA resultante; nunca usar este checkpoint como autorização de build Windows.

Riscos: interação visual ainda não observada; contraste/overflow/foco não homologados; conversas fictícias somem ao encerrar e estão explicitamente identificadas assim. O chat de produção e suas permissões permanecem fora da execução fictícia. Atualização futura de fonte/estado precisa manter invalidação de prévias e evitar misturar chats reais/fictícios.

Reversão: sair da demonstração desativa o incremento na sessão; reverter o commit da feature restaura o renderer anterior. Nenhum esquema de banco ou registro financeiro precisa ser revertido. Aprovação exigida para integração, futura escrita real, inferência paga, produção e build Windows.

## Prompt de continuidade

> Revise o PR Draft da branch `feat/mf2-work-intelligence-staging-20261112`, base `feat/mf2-int1-ai-workbench-integration-20261111`, SHA base `ce8dd04669a474957dc2d6c1107bc91d862031fc`. Leia AGENTS, este handoff, log Work, ROADMAP_MF2 e evidências. Confira HEADs atuais antes de agir. Já houve 420/420 testes na base e 431/431 na branch, Node 22.23.4/npm 10.9.9, TypeScript/compile/F08/ASAR locais aprovados; confirme o registro final de proveniência. Não são resultados oficiais CircleCI nem execução Windows. Electron e Chromium foram bloqueados por socket Unix no Linux remoto; não há screenshots autênticos. Homologue primeiro no Windows com perfil temporário validado; preserve instalação/checkouts/dados reais. Teste 8 áreas e opt-in demonstrativo, chat/full/drawer, allow/deny/stale, histórico, fonte e teclado; obtenha capturas 1366/1920 claro/escuro. WORK-AUDIT-01 reproduz resumo que ignora splits; prepare correção determinística separada com regressões. A nova Inteligência usa somente adaptador sintético existente, não chama LLM nem escreve dados. Revise diff e conflitos; não faça merge/build Windows/Production/PWA/cutover sem autorização correspondente. Atualize roadmap e log com SHA/resultados reais. Integre apenas os componentes aprovados após revisão.

### Registro final de código

Commit funcional `fb56ddc`: proveniência criada e verificada com checkout limpo; manifesto com SHA e hashes das fontes/assets anexado às evidências. Commit seguinte acrescenta somente registros de teste/documentação, preservando os bytes do renderer. Logs integrais Node em `.tap`, demais comandos em `.txt`.
