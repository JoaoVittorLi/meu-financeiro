# MEU FINANCEIRO 2.0 — roadmap mestre, backlog e controle de avanço

**Identificador:** MF2-ROADMAP • **Revisão:** 1.2 — Rodada A documental • **Base verificada:** 09/11/2026  
**Natureza:** especificação de produto + plano de engenharia + acompanhamento, **não** atestado de funcionalidades entregues.  
**Contexto multiagente:** [README](ai-context/README.md) · [Estado comprovado](ai-context/CURRENT_STATE.md) · [Guia de análise](ai-context/ANALYSIS_PLAYBOOK.md) · [Catálogo de experiência](ai-context/PRODUCT_BLUEPRINT.md) · [Propostas criativas](ai-context/IDEA_REGISTER.md) · [Protocolo de atualização](ai-context/ROADMAP_UPDATE_RULES.md).

> **Regra permanente, vinculante para todas as IAs:** **cada mudança relevante DEVE atualizar este roadmap no mesmo PR da implementação**, além do log Markdown específico. Nunca concluir uma entrega apenas com código. Quem não integra pode atualizar o progresso **proposto em sua branch**; somente o integrador confirma o progresso global, gates e publicação.

## Checkpoint de engenharia D1.2 — consolidação financeira (10/11/2026)

**Código publicado, SEM release:** PR draft [#28](https://github.com/JoaoVittorLi/meu-financeiro/pull/28), branch `feat/mf2-d1-2-functional-tests-20261110`. Além da proteção de orçamento zero e da automação Electron, foi corrigido `FinanceDB.ingestBank`: (a) duas transações com mesma chave em uma conta/lote não podem sobrescrever o extrato silenciosamente; (b) uma conta repetida no mesmo payload não pode alterar saldo/nome pela ordem de entrada; (c) a mesma conta ligada a outro `item_id` não pode ser reatribuída silenciosamente. Rejeição ocorre **antes de BEGIN IMMEDIATE**, sem importação parcial. Identificadores externos iguais em **contas diferentes** continuam válidos. Testes reais em Node v22.16.0 sobre código SQLite extraído do EXE beta.7 (`app.asar` com SHA-256 `75105078e54def5aab7993a4cc2ab4c498ee05f62eaf8c42e21670a44f228d70` idêntico ao manifesto), com patches D1.2 correspondentes byte a byte ao GitHub: **7/7 PASS** (4 regressões de lote bancário + 3 integrações equivalentes de orçamento/vínculos/parcelas/backup/restore). Regressões bancárias: **0/3 antes, 4/4 após**. Ver evidência `/mnt/data/d1-2-consolidated-sqlite-7.tap` da conversa. Os 3 testes de integração locais preservam as mesmas asserções dos testes no PR, com formatação reorganizada. **Não confundir com CI de branch completa, Electron real ou Windows**: ainda não executados no novo SHA.

**Premium staging sem merge:** branch `feat/mf2-beta8-premium-staging-20261110` @ `HEAD da branch (consultar GitHub; staging ainda não homologado)` reúne funcional D1.2 com os blobs originais `app/overview.css` A-D1 e `app/operations.css` A-D2. Diff contra base funcional: **somente 2 CSS**, sem motores/serviços modificados. Essa branch ainda não inclui atualizações documentais subsequentes, não tem CI/EXE, e **não foi promovida ao PR #28**; A-D3 incremental ainda não encontrada como PR/branch `ad3`. Versão mantida `0.9.5-beta.7` nos manifestos, beta.8 reservada até candidata funcional visualmente testada. Beta.6 e beta.7 de recuperação inalteradas. Cloudflare/PWA congelados na frente Desktop First.

## Checkpoint vigente — Beta.8 candidata D1.2 + Premium (10/11/2026)

**Estado: CANDIDATA PARA CI, NÃO HOMOLOGADA / NÃO DISTRIBUÍDA.** [PR draft #31](https://github.com/JoaoVittorLi/meu-financeiro/pull/31), branch `feat/mf2-beta8-premium-staging-20261110`, versão `0.9.5-beta.8` consistente em `package.json`, `package-lock.json`, `mobile-push/package.json`, `mobile-push/package-lock.json` e nos três rótulos correspondentes de `src/app.ts` e `app/app.js`. **Não houve deploy PWA:** apenas metadados de versão foram sincronizados por contrato. Cloudflare/PWA Production congelados.

**D0 beta.6**: preflight Linux e build Windows aprovados e 2 EXEs com SHA-256 conferidos, sem homologação de uso pessoal. **D1.1 beta.7**: PR #22 SHA `8734a34db8ec9b5592d666cc14fea9a5b8a826b4`, preflight Linux e Windows SUCCESS, 2 EXEs com SHA-256 verificados, **smoke nativo instalado pendente**; versões antigas preservadas como recuperação. **D1.2 funcional**: PR #28, proteção de orçamento R$0, rejeição atômica de duplicatas de extrato e conflito de ownership bancário, lock Electron único e smoke de perfil isolado; **8/8 testes SQLite direcionados PASS** no runtime local Node v22.16.0 (`/mnt/data/d1-2-beta8-sqlite-8-verified.tap`); suíte Node/CI completos da beta.8 ainda não executados. Novo teste `tests/d1-2-category-rename-links.test.cjs` preserva renomeação cascata por orçamentos, regras, overrides, splits e planejamento.

**Premium A-D1–A-D4 incorporados somente na candidata:** PR #23 `app/overview.css` (blob `e47e8d0206c193dca127a802e1b77691212638f3`); PRs #25/#29 `app/operations.css` A-D2 + A-D3 incremental (`fc1ac6f79ebfa9b350298f6b76e6ef0eee21a04d`); PR #30 `app/decisions.css` A-D4 (`1d1d9b706b0a0a79b0dfce1df04bf418e6b6a5f3`). `tests/d1-2-premium-css-contract.test.cjs` publicado; lógica de suas três asserções executada em V8 sobre CSS reais do GitHub **3/3 PASS com filesystem simulado**. **Não é teste visual Electron.** O Simulador A-D5 não foi integrado (não é dependência para a beta.8).

**Gate operacional próximo:** CircleCI com **UMA única pipeline** no SHA final da candidata: Config/Checkout Branch `feat/mf2-beta8-premium-staging-20261110`, `run_preflight=false`, `run_windows_build=true`. Fluxo `preflight_linux` → `build_windows`, este último exige smoke GUI real, persistência, 16 PNGs e checks de provenance ASAR/NSIS/SHA. Se falhar, corrigir o PR #31 antes de distribuir. Se passar, conferir hashes físicos e artefatos, **sem afirmar homologação de instalação Windows pessoal nem merge/release automático**.

---

## 1. Objetivo do 2.0

Construir uma plataforma pessoal de **controle + previsão + decisão + automação assistida**, com dados financeiros confiáveis, sincronização entre Windows/PWA, design diferenciado e IA que compreenda o contexto real e prepare alterações sob controle do usuário.

O 2.0 corrige a dívida técnica e a experiência fragmentada da linha 0.9.x; não será uma coleção de recursos desconectados. Todo recurso deve ajudar a responder pelo menos uma destas perguntas:
1. **Onde estou?** patrimônio, contas, receitas, despesas, qualidade dos dados.
2. **O que vai acontecer?** compromissos, caixa, risco, metas.
3. **O que posso fazer?** orçamento, antecipação, comparação de opções.
4. **O que mudou ou exige atenção?** anomalia, assinaturas, limite, vencimento.
5. **O que pode ser feito com menos esforço?** automações e IA com prévia/consentimento.

**Contratos de produto:** mobile tão completo quanto desktop; sem mentir sobre saldos; finanças usáveis mesmo quando a IA está indisponível; ações da IA nunca executam pagamentos, Pix ou ordens de ativos; experiência premium sem copiar design/propriedade intelectual alheia.

## 2. Regime de trabalho: duas rodadas separadas

### RODADA A — Análise, diagnóstico, benchmark e criatividade (primeira)

**Missão:** examinar o produto real, desafiar decisões fracas, mapear problemas herdados da 1.0, aprofundar o benchmark, formular soluções de UX e arquitetura, comparar opções e recomendar mudanças para o 2.0. **Ampla liberdade criativa nesta rodada**, com obrigação de demonstrar valor e custo.

**Permitido:** ler GitHub e PRs; navegar no preview/ambiente controlado, coletar capturas sintéticas; pesquisar soluções atuais; inspecionar testes; propor arquitetura, fluxos, wireframes/descrições e pequenas provas sem alterar produção; registrar conclusões nos documentos. Separar claramente fatos, hipóteses e propostas.

**Não permitido por padrão:** refazer telas, migrar dados, alterar schema financeiro, publicar production, consumir API paga sem autorização, ativar acesso real da IA ou misturar feature com diagnóstico.

**Entregáveis obrigatórios:** (a) diagnóstico por área e por plataforma, (b) matriz de lacunas 1.0→2.0, (c) benchmark fundamentado, (d) propostas criativas e alternativas ranqueadas, (e) riscos/dependências, (f) backlog recomendado com MANTER/MODIFICAR/ADIAR/REJEITAR, (g) plano de execução em fatias verticais, (h) critérios de aceitação e estratégia de teste, (i) atualização deste roadmap com o **status da análise**, sem alegar implementação.

**Gate de A:** o usuário/Chat arquiteto revisa e autoriza os ajustes de escopo e a primeira fatia de execução. A análise pode levar a propostas novas, mas **propostas não são automaticamente requisitos aprovados**. Ver [ANALYSIS_PLAYBOOK](ai-context/ANALYSIS_PLAYBOOK.md).

### RODADA B — Implementação, testes e homologação (segunda)

**Missão:** executar o escopo aprovado, em missões pequenas e verificáveis, respeitando gates e dependências; não reabrir o design inteiro a cada commit.

**Por fatia:** inspecionar SHA → criar branch/ownership → implementar interface + persistência + contratos + testes → homologar → log → atualizar roadmap **na mesma branch/PR** → revisão → integração controlada. Não considerar "feito" enquanto código e documentação não estiverem publicados.

**Retorno à A:** apenas se surgir fato novo, risco estrutural, falha impossível de resolver na fatia ou proposta superior que substitua claramente requisito existente; registrar decisão. O protocolo não bloqueia criatividade, bloqueia improvisação não documentada.

## 3. Estado herdado, sem interpretações otimistas

Atualizado a partir de GitHub em 09/11/2026. Consultar [CURRENT_STATE](ai-context/CURRENT_STATE.md) para detalhes, links e evidências.

| Linha | Base verificável | Estado / implicação |
| --- | --- | --- |
| main | commit e0d5131, package v0.9.4 | Última linha publicada formalmente, não inclui o conjunto U1–U3 |
| PR #16 | design/despezzas-d1-d4, SHA c535cb0, v0.9.5-beta.6 | D1–D4 + U1/U2/U3 no desktop, ainda draft |
| U1 | visão geral modernizada, cobertura, período, gráficos, categorias e agenda | Código + testes documentados, **sem EXE instalado homologado** |
| U2 | movimentações e planejamento, filtros, revisão, calendário e projeção | Código + testes documentados, **sem paridade comprovada no PWA** |
| U3 | orçamentos, contas e simulador A/B | Código + testes relatados: 222 desktop, 129 Worker, 1 ASAR; **não reexecutados nesta auditoria** |
| U4 | equivalente mobile de U1–U3 | **não comprovado no GitHub** |
| IA E1–E4.1 | tela, cliente experimental, memória e contexto sintético | shared/ai-policy.mjs informa financialDataEnabled=false e pwaInferenceEnabled=false |
| Pluggy/cloud | staging 630 inicialmente; 632 depois; 1 conta; 93 registros de 17 tabelas relatados | Diagnóstico parcial; identidades, centavos, histórico, saldo as-of e restore ainda exigem prova |
| CircleCI | success no PR #15, SHA 44fb1b0 | Não equivale a build/instalação do SHA U3 c535cb0 |
| Work anterior | "Meu Financeiro - Definitivo" em outra sessão | Arquivos não publicados e progresso local **desconhecidos**; obter checkpoint antes de retomar |
| Documentação | PR #17, docs/mf2-multi-agent-context-20261109 | Ponto de entrada multi-IA; **draft, ainda não integrado** |

**Correções prioritárias do 1.0**: falta de baseline/release coerente; PRs empilhados; paridade PWA; cloud cutover ainda não homologado; regras parcialmente duplicadas; falta de contrato real de IA; UX heterogênea; orçamento avançado incompleto; saldo seguro não implementado; rastreabilidade e distribuição coordenada insuficientes.

## 4. Prioridades, decisões e fronteira do escopo

### Obrigatório para 2.0 (MUST)
Confiabilidade financeira; sync/paridade; UI de alta qualidade; movimentos/regras; planejamento e saldo seguro com ressalvas; orçamentos, metas/dívidas; relatórios/patrimônio básico; IA operacional com autorização e controle de custos; radar; segurança, teste, release.

### Desejável quando sustenta os requisitos (SHOULD)
Personalização moderada de painel; ações contextuais; explicações de origem; comparações A/B; regras sugeridas; estimativas com faixa de incerteza; indicadores de completude da base.

### Propostas a avaliar na Rodada A (CANDIDATE, não aprovadas)
Modo "se eu...?", assistente de fechamento do mês, timeline de decisão, digest semanal, score de previsibilidade, cartão de despesas invisíveis, jornada simplificada de revisão. Ver [IDEA_REGISTER](ai-context/IDEA_REGISTER.md).

### Fora do 2.0 por padrão (OUT)
Pagamentos/Pix reais, trades automáticos, cancelamento externo de assinaturas, agentes financeiros autônomos, gestão contábil empresarial, sistema fiscal, social/gamificação pesada, multiusuário e apps nativos macOS/Linux.

**Critério de promoção de uma ideia:** problema real + melhoria mensurável ou verificável + origem de dados + teste + custo + dependências + risco + decisão explícita. Ideias competem com itens existentes; não há adição infinita.

## 5. Arquitetura de referência

**DADOS:** SQLite local preservado até conciliação; Pluggy read-only; staging Cloudflare protegido; versão de schema, IDs e revisões; backups/restores verificáveis.

**DOMÍNIO:** ledger único; centavos exatos; natureza, posted/pending, splits, transferências, manual vinculado, orçamentos, compromissos, recorrência, parcelas, metas, dívida e patrimônio.

**SERVIÇOS:** consultas tipadas; comandos idempotentes com autorização, concorrência e auditoria; projeções determinísticas; indicação de confiança e de dados incompletos.

**EXPERIÊNCIA:** Windows Electron e PWA Android/web com mesma definição de números, componentes adaptativos e tema coeso. Diferença visual de plataforma é aceitável; divergência de regras, não.

**INTELIGÊNCIA:** orquestrador de consultas e ações propostas; nunca fonte autoritativa de saldo. Autenticação, limites, contexto mínimo, confirmação de cada escrita, histórico e recusa quando revisão mudar.

**Invariantes**: conta+external_id é identidade bancária; banco/manual não somados automaticamente; transferência própria neutra; status pendente distinto; saldo desconhecido ≠ R$ 0; receita incerta ≠ recebida; compromissos pagos não descontados de novo; margem de orçamento ≠ dinheiro livre; reserva virtual ≠ dinheiro transferido; simulação nunca salva automaticamente; IA não altera o bruto bancário.

Mais detalhes em [ARCHITECTURE](ai-context/ARCHITECTURE.md).

## 6. Mapa de dependências e gates

| Marco | Entrega | Base necessária | Gate de saída |
| --- | --- | --- | --- |
| MF2-00 | Estabilização e integração controlada | Auditoria atual + estado do Work | G0: código e EXE de candidato homologáveis |
| MF2-01 | Conciliação cloud e sincronização | G0 | G1: dados equivalentes e restauráveis |
| MF2-02 | Núcleo financeiro único | G1 | G2: mesma matemática, APIs e golden tests |
| MF2-03 | U4: paridade Windows/PWA | G2 | G3: jornadas completas em ambos |
| MF2-04 | Design System e Visão Geral premium | G3 | G4: dashboard coeso e modular |
| MF2-05 | Movimentações inteligentes | G2/G3 | G5: automação explicável e segura |
| MF2-06 | Planejamento preditivo e Laboratório | G2/G5 | G6: futuro e saldo seguro corretos |
| MF2-07 | Orçamentos, metas e dívidas | G6 | G7: alocação, obrigações e objetivos |
| MF2-08 | Relatórios, patrimônio e investimentos | G2/G7 | G8: análise patrimonial auditável |
| MF2-09 | IA operacional e Radar | G2, interfaces/domínios G4–G8 | G9: leitura/escrita autorizadas e alertas |
| MF2-10 | Qualidade, segurança e release | G0–G9 | G10: Windows/PWA 2.0.0 homologados |

**Flexibilidade:** análise e especificação de marcos posteriores podem ocorrer em paralelo aos primeiros; execução pode ser dividida em fatias se interfaces e contratos estiverem isolados. Não integrar resultado de um marco sobre dados incompatíveis.

## 7. Entregas detalhadas — produto + execução + testes

### MF2-00 — Fundamento confiável e recuperação de contexto

**Problema:** 0.9.4 publicada, código 0.9.5-beta.6 em PRs draft, Work possivelmente mais recente que GitHub, CI de candidato não homologado.

**Trabalho:** inventário de branches, PRs, commits e mudanças locais; identificar hierarquia sem cherry-pick redundante; preservar projetos existentes; baseline de integração; reprodutibilidade de dependências e scripts; preflight TypeScript/Node/SQLite/Worker/ASAR; CircleCI Windows SHA exato; instalador+portable+checksums; smoke Electron com dados sintéticos e backup de perfil.

**Qualidade UX:** inspecionar oito áreas (não criar outras), temas e 320/390/768/1366/1920 conforme plataforma; textos longos, teclado, menu, scroll e acessibilidade; registrar dívida visual sem abrir redesign completo.

**Gate G0:** árvore e cadeia de PRs reconciliadas; artefatos verificáveis; execução Windows sem regressões bloqueantes; roteiro de integração; logs e versão de baseline. CI sucesso do PR #15 não substitui o PR #16.

**Não fazer:** merge direto em main, cutover, deploy de Production, ativação de IA com finanças.

### MF2-01 — Uma vida financeira consistente em todos os dispositivos

**Problema:** Windows SQLite e staging cloud diferem por natureza, cobertura e revisão; PWA já tem dados, mas não é fonte homologada.

**Trabalho de engenharia:** comparar conta, external_id, datas, centavos, descrição/status, natureza/categoria, referências, splits, vínculos, históricos e 17 tabelas pessoais; investigar 630 vs 632 como diferença temporal de staging, não duplicata presumida; identificar saldo bancário as-of e histórico parcial; controle de versão/CAS, idempotency-key, conflits 409 e trilha de eventos; backup exportável e restore testado; migração aditiva/dry-run; permissões; operação PC↔Android com escrita simultânea e conexão interrompida.

**Trabalho de produto:** estado visível "sincronizando/atualizado/desatualizado/conflito"; explicar origem do dado, permitir revisar conflitos e mostrar que certas contas não informam saldo.

**Gate G1:** zero diferenças não explicadas na base de referência, reenvio sem duplicação, restore comprovado, consentimento e decisão explícita antes de promover cloud canônica.

### MF2-02 — Engine financeira compartilhada e contratos

**Problema:** formulas hoje estão apenas parcialmente centralizadas; duas telas podem mostrar números diferentes para a mesma pergunta.

**Trabalho:** domínio compartilhado para bancos/manual, receitas/despesas, status, revisão, categorias e splits, planejamento, parcelas, dívida, orçamento, metas, projeção/simulação, patrimônio. Definir schemas read/write, ID/revision, dados parciais e período. Criar golden fixtures por data, mês e limites; portar funções existentes antes de reescrever.

**UX:** cada número possui período, fonte, qualidade e drill-down; categoria "Outros" não prova informação de origem.

**Gate G2:** mesmas entradas e revisões → mesmos centavos e datas no desktop, Worker e testes; comando inválido rejeitado; nenhum cálculo autoritativo escondido em UI/IA.

### MF2-03 — U4: a mesma experiência útil no PWA

**Problema:** redesign U1/U2/U3 foi desktop; funções PWA parcialmente diferentes; a IA PWA tem rascunho, não inferência real.

**Trabalho por área:** Visão Geral (indicadores, período, gráfico, categorias, compromissos); Movimentações (consulta, filtros, revisão, categorias, edição e seleção); Planejamento (agenda/calendário/projeção, CRUD, parcelas); Orçamentos (limite, consumo, cobertura, origem); Laboratório de Decisões (mesmo simulador A/B); Contas (saldos e referências); Inteligência (capacidade real declarada, nunca fake); Configurações (segurança, sincronização, preferências). Usar componentes/serviços comuns onde viável, sem redesign de tudo antes dos contratos.

**UX:** mobile-first, navegação com uma mão, painéis/drawers acessíveis, gráficos e tabelas úteis em 320px, scroll horizontal apenas onde justificado.

**Gate G3:** jornadas completas, mesmas contas e resultados, 2 temas e larguras, autenticação de Preview real validada; nenhuma tela marca função como pronta quando API não existe.

### MF2-04 — Visual premium, organização e dashboard modular

**Problema:** visual moderno em partes, mas sem experiência final coerente, personalização e acessibilidade completa.

**Produto:** hierarquia com saldo real, despesas, receitas, resultado, tendência e próximas obrigações; painel com cards escolhidos/ordenados; origem e período explícitos; privacidade visual; atalhos úteis; comparação com período anterior contextual; estados vazios elegantes; cores e tipografia consistentes; animações leves e opcionais.

**Design:** visual inspirado em Copilot/Monarch/Despezzas/Actual, sem copiar interfaces/ativos. Evitar excesso de cartões. Priorizar decisões a gráficos decorativos; dashboards diferentes desktop e mobile podem reorganizar o mesmo conteúdo.

**Dependência:** "saldo seguro" entra no card somente após motor MF2-06 estar validado, nunca como fórmula improvisada.

**Gate G4:** preferências persistem, contraste/teclado/responsividade, dados corretos e captura real antes/depois no ambiente disponível.

### MF2-05 — Movimentações que se organizam com menos trabalho

**Problema:** regras e categorizações ainda exigem esforço e não oferecem radar completo de recorrência/anomalia.

**Produto:** fila "precisa de atenção", tags e favoritos úteis, buscar por fonte/conta/tipo/merchant, revisão rápida, reclassificação em lote com preview, regras por descrição/merchant/valor e prioridade manual>regra>provedor>sugestão; detectar recorrência/assinatura e mudança de preço; sugerir possível duplicata sem excluir nada; distinguir estorno/reembolso/transferência.

**Engenharia:** overrides não mutam transação Pluggy, regras idempotentes, simulação antes de edição massiva, event log, confiança de detecção; testes com lançamentos parecidos e bancos diferentes.

**Gate G5:** usuário consegue corrigir/silenciar sugestão; false positives não alteram pagamentos ou natureza automaticamente; logs de antes/depois.

### MF2-06 — Planejamento que antecipa problemas

**Problema:** mostrar compromissos não basta; usuário precisa decidir se uma compra cabe nos próximos dias e meses.

**Produto:** linha temporal de caixa, calendário de obrigações, visão por ciclo de recebimento, compromissos atrasados/pagos parcialmente, receita prevista confirmada/incerta, cenário conservador/base/otimista sem mistura; "menor saldo do período" e riscos; cartão "saldo seguro para gastar" parametrizado, com detalhes de reserva e cobertura; Laboratório de Decisões (comprar/adiar/parcelar, antecipar dívida, poupar mensalmente, A/B). Recomendações são explicações de cenários, não ordens.

**Engenharia:** previsões só derivadas de motor diário reconciliado; fluxo sem pagamento duplicado, parcelas corretas, horizonte claro e dados parciais; A/B não grava financeiro sem confirmação.

**Gate G6:** usuário vê hipóteses/indisponibilidades; teste de datas, valores extremos, saldo zero/parcial, receita incerta e concorrência; simulações auditáveis.

### MF2-07 — Orçamentos, objetivos e dívidas concretos

**Problema:** limites recorrentes atuais não fazem alocação avançada nem acompanham objetivo/juros de modo completo.

**Produto:** modo simples (limite/gasto/restante/alerta) e avançado (envelopes, transferência controlada de verba, rollover opcional); sugestões históricas nunca autoaplicadas; meta com prazo, contribuição, projeção de conclusão e reserva virtual; dívida com saldo principal, taxas, vencimentos, pagamento, antecipação e economia condicionada à regra contratual.

**Engenharia:** orçamento por período com auditoria e versão; zero≠ausente; dinheiro comprometido por meta não é necessariamente dinheiro numa conta separada; motor de dívida suporta parâmetros explícitos e estimativa quando contrato não estiver completo.

**Gate G7:** reconciliar com transações, previsões e simulações; rollovers e pagamentos parciais nos golden tests; nenhuma quitação automática.

### MF2-08 — Relatórios que explicam evolução + patrimônio

**Problema:** sem análise duradoura de posição e desempenho, controle diário não dá visão de riqueza/dívidas.

**Produto:** relatórios por período, categoria, comerciante, orçamento e assinatura; comparação de comportamento; evolução de patrimônio líquido (ativos menos passivos); carteira simples (posições, aportes/retiradas, custo, dividendos/proventos, rentabilidade separada de fluxos); exportação.

**Engenharia:** fontes cotadas com data e qualidade, sem cotações inventadas; transferências para investimentos não criam receitas, preço e desempenho distinguem variação de aportes; dados ausentes marcados.

**Gate G8:** tabela detalhada auditável, testes de rentabilidade e transferências, sem recomendações de trading ou ordens.

### MF2-09 — Inteligência que entende, explica e age com permissão

**Subfases obrigatórias:**
- **A — Integração e custo:** validar autenticação/entitlement real, modelo elegível, consumo, limites, segurança e falhas; assinatura Plus do ChatGPT não presume crédito livre de API.
- **B — Consultar:** ferramentas tipadas para períodos, contas, transações, orçamento, fluxo, metas, dívida e investimentos; respostas citam fonte e revisões, nunca inventam saldo.
- **C — Escrever:** propor alterações multiárea (classificar, criar regras/orçamentos/compromissos/metas, ajustar parâmetros manuais); prévia diff, revisão base, confirmação explícita, transação validada, audit log, idempotência e undo quando permitido. **Não** pagar, transferir ou negociar ativos.
- **D — Proagir:** radar determinístico para insuficiência de caixa, anomalias, assinaturas, vencimentos, metas e orçamento, com IA explicando e sugerindo ações. Frequência, silêncio, privacidade e push opt-in.

**UX:** Hoje / Conversar / Plano de ação, modo contextual em qualquer tela, mini-insights sem poluir, "por que sugeriu?" com dados; classificar o que é fato, hipótese e sugestão. Memória controlada, atualização quando dados mudam e indicação de ação aprovada/executada.

**Gate G9:** testes com prompt injection, dados desatualizados, ações múltiplas, falha parcial, permissões, limite de custo, PWA sem chave privada e auditabilidade. O app financeiro funciona sem IA.

### MF2-10 — Hardening, segurança e release sincronizada

**Escopo:** suites unitárias, integração e e2e; autenticação, sessão, vulnerabilidades, concorrência, performance, backup/restore, migração/rollback, acessibilidade, visual Windows/PWA e contratos N/N-1; artefatos NSIS/portable, hashes, changelog, release e Preview→Production sob autorização.

**Gate G10:** release v2.0.0 estável somente após G0–G9 concluídos e verificáveis; não divulgar build beta como estável.

## 8. Jornadas transversais que definem o produto (testar end-to-end)

1. **Compra segura:** abrir dashboard → conferir obrigações e saldo seguro → comparar A/B → planejar compra após confirmar → ver novo compromisso em calendário/orçamento, sem modificar saldo bancário.
2. **Revisão inteligente:** Pluggy novo → identificar pendência → sugerir categoria/regra → usuário confirma → alterações aparecem em visão/relatório/PWA sem duplicar a linha bancária.
3. **Dívida:** cadastrar contrato → previsão de parcelas → comparar antecipação → escolher cenário → só persistir alteração manual validada; nenhum pagamento efetuado.
4. **Meta e renda:** definir meta → visualizar contribuição recomendada → comparar impacto na liquidez e no orçamento → registrar reserva virtual sem fingir movimentação bancária.
5. **IA assistente:** perguntar sobre gastos → conferir evidência → pedir mudança → revisar diff e confirmar → reabrir outra tela/dispositivo e verificar persistência e audit log.
6. **Falha de rede:** PWA/Windows informa dado desatualizado; rejeita overwrite silencioso; retoma sync sem duplicar.
7. **Investimentos:** transferência da conta para carteira não aumenta patrimônio; dividendo aparece separado de aporte e valorização.

## 9. Política de produto e criatividade

A Rodada A pode sugerir novas experiências e repensar navegação, visual e fluxos. Priorizar ideias que:
- eliminam um problema do 1.0;
- simplificam uma tarefa recorrente;
- tornam um número verificável ou uma decisão melhor;
- funcionam em ambas as plataformas;
- têm motor e dados reais disponíveis;
- podem ser testadas com baixo risco;
- não exigem reimplementar o que já funciona.

Para cada ideia, registrar **problema, persona/jornada, alternativa atual, solução, mock/fluxo, origem de dados, benefício, risco, custo relativo, dependência, testes e destino: ADOTAR/SUBSTITUIR/ADIAR/REJEITAR**. O usuário/Chat arquiteto aprova mudanças significativas no escopo antes da Rodada B.

Não abrir novas abas para cada card, radar, chatbot, relatório ou objetivo. Não replicar telas dos concorrentes; buscar combinação própria e melhor de elementos.

## 10. Acompanhamento permanente — atualizar em todo PR

**Este quadro acompanha o progresso; não é uma declaração de que marcos foram executados.** Atualizado na rodada documental de 09/11/2026. Reavaliar a cada nova evidência/commit.

| Marco | Rodada A | Rodada B | Gate | Evidência mais recente / próximo passo |
| --- | --- | --- | --- | --- |
| MF2-00 | AGUARDANDO_DECISAO | EM_TESTE | NAO_HOMOLOGADO | **D0 beta.6:** CircleCI Linux/Windows SUCCESS no `a4d88ced28c59b21520f4d67a51373cd71bdc8a2`, instalador e portátil x64 com hashes SHA256 verificados no PR #19; sem smoke instalado. **D1.1 beta.7:** PR draft [#22](https://github.com/JoaoVittorLi/meu-financeiro/pull/22), SHA `8734a34db8ec9b5592d666cc14fea9a5b8a826b4`; CI [Linux SUCCESS](https://app.circleci.com/workflow/97d647b6-be40-416a-a69c-d6259f22f8c2/job/4c64a3ed-2442-4295-8cd0-a89b01aaae87) + [Windows SUCCESS](https://app.circleci.com/workflow/97d647b6-be40-416a-a69c-d6259f22f8c2/job/a9c7f44f-5094-4ef5-9c0e-355ab4948ebe), 2/2 executáveis SHA256 **idênticos ao manifesto** (ver [registro da verificação](https://github.com/JoaoVittorLi/meu-financeiro/pull/22#issuecomment-6778657259)), correção de validação de backup/WAL, **instalação Windows e operação real NÃO HOMOLOGADAS**, sem merge/release. **D1.2 EM_DESENVOLVIMENTO:** branch `feat/mf2-d1-2-functional-tests-20261110`, PR draft [#28](https://github.com/JoaoVittorLi/meu-financeiro/pull/28), base imutável beta.7. Defeito reproduzido: `electron/db.cjs` permitia excluir categoria com orçamento explícito `R$ 0` (filtro `amount_cents>0`), descartando limite salvo; corrigido para considerar qualquer orçamento. `electron/main.cjs` tinha lock/listener de instância única duplicados; foi unificado. Novo `electron/smoke-profile.cjs` aceita `userData` temporário só em Electron não empacotado; `scripts/d1-electron-smoke.cjs` automatiza Chromium/CDP DOM + bridge IPC + SQLite fictício + fechamento/reabertura; gate `npm run test:electron-smoke` preparado no script CircleCI Windows **para a próxima candidata**, sem executar ainda. **Testes executados localmente:** 4/4 PASS em Node v22.16.0 (3 testes de perfil com blob exato GitHub e reprodução SQLite real do orçamento zero), script de smoke passa parser V8; **testes D1.2 integrais e Electron real ainda NÃO executados**. **Argon:** A-D1 [#23](https://github.com/JoaoVittorLi/meu-financeiro/pull/23) `app/overview.css`, A-D2 [#25](https://github.com/JoaoVittorLi/meu-financeiro/pull/25) `app/operations.css`, cada uma relatou 18 testes no snapshot; candidata CSS-only [#27](https://github.com/JoaoVittorLi/meu-financeiro/pull/27) criada com blobs exatos, **sem merge**, aguardando A-D3 incremental em `operations.css` e smoke visual real Electron. **Cloudflare/PWA congelados temporariamente**; nenhuma sincronização ou dado pessoal usado. Próximo: consolidar testes/defeitos D1.2 e contribuição visual A-D3, sem bump para beta.8 até haver versão funcional candidata; quando pronta, **UMA pipeline `run_preflight=false`/`run_windows_build=true`** (Linux → Windows e smoke GUI), hashes, smoke instalado, sem distribuir por CI apenas. [Log D1.2](ai-context/logs/2026-11-10-MF2-D1-2-desktop-first-automation.md). **Consolidação automatizada D1.2 (10/11/2026):** na branch PR #28 foram implementados 16 screenshots reais **a executar** no smoke Electron (4 áreas × matriz de 1366×768/1920×1080, claro/escuro e redução de movimentos), validação explícita do breadcrumb, aba ativa, tema, viewport, ausência de overflow horizontal global e assinatura PNG. A matriz grava `visual-matrix.json`; `.circleci/build-windows.ps1` exige 16 PNGs na próxima candidata e `.circleci/config.yml` preserva as capturas em `MeuFinanceiro-Desktop-Smoke` separado dos EXEs. Três novos testes `tests/d1-2-visual-matrix.test.cjs` (positiva, overflow e imagem inválida) publicados. **3/3 cenários da função exata `visualMatrix` do blob GitHub `e295401f1479969b0044ff6c5c3fd84a2c126db9` PASS em V8 com CDP/FS simulados**; isso valida a lógica, não a execução Electron/Windows nem os três testes Node do repositório. A-D3 ainda **não publicada em branch/PR verificável**; PR #27 mantém A-D1/A-D2 CSS-only, sem merge sobre D1.2. Sem bump beta.8, sem nova pipeline/executável. 

**G0 NAO_HOMOLOGADO; PRs draft; versões beta.6/beta.7 recuperáveis.** |
| MF2-01 | ANALISADO | BLOQUEADO_G0 | NAO_HOMOLOGADO | E1_CONCILIATION_REPORT, 630/632 sem comparação completa · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-02 | ANALISADO | BLOQUEADO_G1 | NAO_HOMOLOGADO | shared/finance-period-ledger.mjs já existe parcialmente · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-03 | ANALISADO | BLOQUEADO_G2 | NAO_HOMOLOGADO | U4 solicitada, ainda não publicada/comprovada · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-04 | AGUARDANDO_DECISAO | BLOQUEADO_G3 | NAO_HOMOLOGADO | fundamentos D1–D4 e U1–U3 presentes · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-05 | AGUARDANDO_DECISAO | BLOQUEADO_G2_G3 | NAO_HOMOLOGADO | categorias/regras já existem em modo parcial · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-06 | AGUARDANDO_DECISAO | BLOQUEADO_G2_G5 | NAO_HOMOLOGADO | planejamento e simulador parcial existentes · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-07 | AGUARDANDO_DECISAO | BLOQUEADO_G6 | NAO_HOMOLOGADO | limites recorrentes U3, sem envelopes completos · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-08 | AGUARDANDO_DECISAO | BLOQUEADO_G2_G7 | NAO_HOMOLOGADO | patrimônio/investimentos em escopo 2.0 · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-09 | AGUARDANDO_DECISAO | BLOQUEADO_G2_G4_G8 | NAO_HOMOLOGADO | IA de demonstração; leitura/escrita real não homologada · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |
| MF2-10 | ANALISADO | BLOQUEADO_G0_G9 | NAO_HOMOLOGADO | Release mais recente v0.9.4 · **Rodada A: revisão estática #17, sem testes novos; decisão/execução pendentes** ([relatório](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md)) |

### Checkpoint da Rodada A — 09/11/2026, PR #17 (somente análise)

**Documento de evidência:** [Relatório completo A0–A7](ai-context/reviews/2026-11-09-MF2-ANALYSIS.md) · [registro de ideias](ai-context/IDEA_REGISTER.md) · [log](ai-context/logs/2026-11-09-MF2-rodada-a-diagnostico.md). Base de código #16 `c535cb0`, base documental inicial #17 `ed6f49a`. **Inspeção remota do GitHub; sem acesso ao Work anterior, sem testes novos de app e sem homologação Windows/PWA.**

- **MANTER:** MF2-00/01/02/03/10 como prioridades técnicas e gates inalterados; preservar investimentos já feitos em U1–U3, PWA e serviços existentes.
- **MODIFICAR se aprovado:** MF2-04 home contextual e qualidade por indicador; MF2-05 inbox de revisão; MF2-06 ciclo salarial/Laboratório único; MF2-07 Flex como camada simples opcional; MF2-08 patrimônio decomposto; MF2-09 ferramentas tipadas com recibo. **Propostas ainda NÃO incorporadas como requisito novo.**
- **ADIAR 2.1:** digest opt-in (IDEA-28). **REJEITAR por ora:** score único opaco e reescrita visual/arquitetural total (IDEA-29/30).
- **Decisão exigida:** autorizar a primeira missão B de MF2-00, depois de reconciliar as alterações locais do Work; confirmar stack gradual, UX e limites de IA. Nenhuma linha da coluna Rodada B ou Gate foi promovida e nenhuma flag de migração foi alterada.

**Na Rodada A:** atualizar coluna A, evidências, backlog e decisões; preservar B/gates como não executados. **Na Rodada B:** atualizar B + evidências do SHA/teste/PR após cada fatia; gate somente após homologação. **Integrador:** valida estado global e publica o progresso real; status em branch draft não representa publicação.

### Modelo obrigatório de atualização por mudança

A cada PR ou correção significativa, atualizar:
1. A linha do marco (A/B/gate/evidência, com SHA e PR).
2. O escopo ou critério de aceite alterado **somente se houver decisão registrada**.
3. O arquivo de contexto [ACTIVE_WORK](ai-context/ACTIVE_WORK.md) para indicar ownership/branch quando aplicável.
4. Um log novo em [logs](ai-context/logs/) com o que foi alterado/testado/não testado.
5. [CURRENT_STATE](ai-context/CURRENT_STATE.md) **apenas após integração homologada**, pelo integrador, para evitar declarar drafts como estáveis.
6. Se houver mudança de direção: ADR em [decisions](ai-context/decisions/) + proposta no [IDEA_REGISTER](ai-context/IDEA_REGISTER.md) ou decisão formal.

**Não apagar itens pendentes para melhorar aparências.** Mudanças de escopo exigem rastreabilidade MANTER/ALTERAR/ADIAR/REMOVER e links. Ver [ROADMAP_UPDATE_RULES](ai-context/ROADMAP_UPDATE_RULES.md).

## 11. Qualidade e definição universal de concluído

Testes criados ≠ testes executados; build gerado ≠ instalado; PR aberto ≠ integrado; Preview ≠ Production. Cada fatia informa SHA, arquivos, testes, ambiente, valores de referência sintéticos, evidência visual real quando aplicável, limites e rollback. A aprovação técnica e a aprovação visual são **independentes**.

Matriz mínima: banco/manual vinculados sem double count; transferência neutra; pending distinto; orçamento zero≠ausente; saldo desconhecido; parcela e juros; receita incerta; pagamento parcial; conta errada; conflito PC↔PWA; reenvio idempotente; IA com dado desatualizado; simulação sem escrita; investimentos sem rentabilidade inflada; recuperação e migração.

Escala de auditoria: **APROVADO / APROVADO_COM_PENDENCIAS / REPROVADO / NAO_HOMOLOGADO_POR_FALTA_DE_EVIDENCIA**. A última classificação evita tanto falsos sucessos quanto falsos bugs.

## 12. Próximo passo — não pular

**Agora: Rodada A de análise aprofundada do estado + produto**, considerando MF2-00 como primeiro gate técnico. Antes de iniciar execução:
1. Verificar se o Work anterior possui U4 ou IA não publicadas, comparar SHA e arquivos.
2. Fazer auditoria visual e financeira das áreas existentes e do Preview protegido **sem tocar em dados pessoais ou produção**.
3. Mapear lacunas e propostas criativas por impacto/risco, escolher o que deve permanecer ou ser ajustado no plano.
4. Atualizar este roadmap como **ANALISADO / AGUARDANDO_DECISAO**, criar relatório de análise e subentregas recomendadas.
5. Após autorização, iniciar **Rodada B: MF2-00**, com build e smoke do candidato, e prosseguir pelos gates.

O esforço sugerido ao Work é **Alto na primeira análise arquitetural ampla, Médio para investigações por módulo, Leve para checkpoints**. O Chat pode preparar pesquisas, priorização e prompts sem consumir Work. Consultar [WORK_PROMPT](ai-context/WORK_PROMPT.md).


## Anexo documental de 09/11/2026 — consolidação e benchmark aprofundado (Rodada A)

**Status:** proposta documental na branch candidata `integration/mf2-baseline-candidate-20261109`, derivada da revisão mais recente do PR #17. **Nenhum gate de execução promovido.** Este adendo não altera escopo previamente aprovado nem declara código testado.

- [BRANCH_CONSOLIDATION_PLAN](ai-context/BRANCH_CONSOLIDATION_PLAN.md): a linhagem #1→#16→#17 já é majoritariamente ancestral; não mesclar PRs antigos cegamente. Branches de Inteligência/CI divergentes (#2/#3/#4/#5) exigem diff funcional e testes antes de encerrar; Work local pode ter mudanças não publicadas. A nova branch é **CANDIDATA**, não baseline homologada.
- [MARKET_FEATURES_DEEP_DIVE](ai-context/MARKET_FEATURES_DEEP_DIVE.md): especificação de dez experiências com referência de mercado, fluxo do usuário, MVP, contratos, dependências e testes. São **recomendações para a Rodada A**, não novas entregas aprovadas.
- Primeiro gate técnico continua **MF2-00**: recuperar checkpoint do Work, validar equivalência de branches divergentes, executar CI Windows e smoke no SHA final, confirmar documentação e rollback.
- Decisões de UX/pesquisa não podem acionar automaticamente a Rodada B. Integrador atualiza CURRENT_STATE após verificação; branch candidata não altera `main`.
