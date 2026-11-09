# Rodada A — Diagnóstico crítico, benchmark e opções de produto para Meu Financeiro 2.0

**Data:** 09/11/2026 | **Autor:** Chat arquiteto (auditoria documental remota) | **Status:** ANALISADO — AGUARDANDO DECISÕES, SEM HOMOLOGAÇÃO.
**Base de código inspecionada:** `design/despezzas-d1-d4`, SHA `c535cb01403689480d01560de3daa1cae71780d2`, [PR #16](https://github.com/JoaoVittorLi/meu-financeiro/pull/16).
**Branch documental:** `docs/mf2-multi-agent-context-20261109`, [PR #17](https://github.com/JoaoVittorLi/meu-financeiro/pull/17), base documental consultada `ed6f49a1913fa4684271f84f785c75362e83e894`.
**Linha estável:** `main` em `e0d5131ebeda855a792614d9986f40e5bb94af5e`, versão 0.9.4.
**Método:** leitura de AGENTS/README/PLAYBOOK/BLUEPRINT/STATE/ACTIVE_WORK/ROADMAP, árvore de arquivos e código selecionado via GitHub, PRs/commits/checks e benchmark em páginas oficiais de produtos. **Não foram executados npm tests, Electron, PWA autenticado, auditoria de banco, CI, instalador, deploy ou acesso à sessão Work anterior.** Inspeção estática e documentação de teste prévio não equivalem a homologação.

> **Regra de evidência:** COMPROVADO NO REPOSITÓRIO = arquivo/commit; RELATADO/TESTE ANTERIOR = documentação ou status de CI com SHA; NÃO OBSERVADO = não pode ser afirmado como funcional ou defeituoso. Propostas abaixo NÃO são escopo aprovado.

## 1. Resumo executivo — cinco riscos e cinco oportunidades

| Prioridade | Risco, evidência e consequência | Recomendação |
| --- | --- | --- |
| P0 | **Linhagem não integrada:** PRs #1–#17 abertos/draft no checkpoint, `main` 0.9.4 enquanto U1–U3 vivem no #16. Risco de integrar diferenças empilhadas ou anunciar código não publicado. [ACTIVE_WORK](../ACTIVE_WORK.md), [#16](https://github.com/JoaoVittorLi/meu-financeiro/pull/16) | MF2-00: mapa de ancestry/ownership, escolher candidato e congelar SHA, sem merge automático |
| P0 | **Build Windows/U3 não homologado:** sucesso CircleCI para #15 `44fb1b0` (preflight job 20, Windows job 21); **nenhum status de CI encontrado** para #16 `c535cb0`. U3 relata 222 desktop, 129 PWA e 1 ASAR, mas não EXE instalado. | Rodar preflight no SHA exato e, com autorização/controle de custo, build, hashes e smoke isolado |
| P0 | **Cloud não canônica:** staging com 630 transações relatadas inicialmente, 632 no diagnóstico posterior, 93 objetos/17 tabelas e 7/7 referências pontuais; sem prova de equivalência Windows×cloud e restore. [E1](../../../E1_CONCILIATION_REPORT.md) | Não classificar divergência 630/632 como duplicata sem confronto de ID/janela; G1 bloqueado |
| P0 | **Paridade incompleta:** U1–U3 são renderer desktop; PWA possui shell, dados e edições parciais, sem mesmas jornadas/contratos. [Paridade](../../../mobile-push/PARITY_AND_UNIFIED_RELEASE.md) | Evitar remake PWA do zero; U4 por jornadas sobre serviços comuns após G2 |
| P0 | **IA ainda demonstrativa:** `shared/ai-policy.mjs` declara `financialDataEnabled=false`, `pwaInferenceEnabled=false`, `dataSource=demonstration_only`; acesso real à API, custo, escrita financeira e 21 operações alegadas não demonstrados. | Gate separado de credencial/custo; construir IA como ferramenta de consulta/proposta/recibo, não contabilidade |

| Oportunidade | Valor provável e limite |
| --- | --- |
| **Confiança visível por número** | Fonte, período, atualização, cobertura e drill-down; independe de IA, mas precisa contratos G1/G2 |
| **Revisão de movimentações em 5 minutos** | Fila breve + sugestão de regra + preview de lote + undo auditado; substitui cliques repetidos; G5 |
| **Planejamento por ciclo salarial** | Obrigações até próximo recebimento, cenários A/B, risco de menor saldo; `saldo seguro` só com base suficiente; G6 |
| **Home contextual e modular** | Desktop: densidade equilibrada e cards; mobile: Hoje/7 dias/ações; não criar 10 telas extras; G3/G4 |
| **Inteligência com recibo** | Consultas verificáveis, ações tipadas com prévia, confirmação, revisão/CAS, audit log e desativação; G9 |

**Parecer técnico:** `NÃO_HOMOLOGADO_POR_FALTA_DE_EVIDÊNCIA` para G0–G10. Esta constatação NÃO nega o código existente, os testes anteriores ou o sucesso do #15. **Recomendação:** manter stack e domínios existentes, estabilizar e migrar por contratos em fatias; rejeitar reescrita total agora.

## 2. A0 — reconciliação factual e limites do Work

- `main`: v0.9.4 / `e0d5131`; release formal [v0.9.4](https://github.com/JoaoVittorLi/meu-financeiro/releases/tag/v0.9.4). Pacotes desktop e PWA em #16: `0.9.5-beta.6`.
- PR #17 aberto/draft, base do #16; PR #16 aberto/draft, base do #15; PR #15 aberto/draft, base #14. A série #1–#16 contém bases diferentes; seguir [ACTIVE_WORK](../ACTIVE_WORK.md) e não fazer merge/cherry-pick em cascata por intuição.
- No GitHub, entre as branches pesquisadas, **não apareceu novo branch de U4 nem avanço de IA multiárea posterior ao #16**. Isso NÃO exclui código não enviado ao GitHub.
- **Sessão Work “Meu Financeiro - Definitivo” não acessível por esta ferramenta**: não verificadas alterações não commitadas, screenshots locais, instalação ou “21 operações” que outro Work possa ter desenvolvido. Próximo agente deve obter checkpoint de branch/SHA/git status/ownership antes de escrever nos arquivos reservados.
- Checks CircleCI de `44fb1b04828dded9ba5e7944e7650f23a99bfa0d`: `ci/circleci: preflight_linux=success` ([20](https://circleci.com/gh/JoaoVittorLi/meu-financeiro/20)); `ci/circleci: build_windows=success` ([21](https://circleci.com/gh/JoaoVittorLi/meu-financeiro/21)). Sem checks no endpoint consultado para `c535cb0`, e sem novos runs GitHub Actions ali. **Ausência de status ≠ falha de pipeline**.
- PR #14 relata Chromium 144/Node 22, 32/32 combinações de oito telas e 320/683/910/1366 px, com dados fictícios; NÃO comprova Chromium/Electron instalado de U3, suporte NVDA ou PWA U4.
- **Matriz de prova:** código EXISTS (#16); testes relatados (#16); integração na main NÃO; release U3 NÃO; Preview financeiro PARCIAL; Electron U3 real NÃO OBSERVADO; PWA real autenticado nesta rodada NÃO OBSERVADO; Work local NÃO OBSERVADO.
- **Atualizações propostas, não executadas:** integrador deve atualizar `CURRENT_STATE.md` somente quando houver evidência de integração. `ACTIVE_WORK.md` deve refletir novo checkpoint Work e single-writer antes da Rodada B. Não alterar esses documentos como se a sessão local tivesse sido inspecionada.

## 3. A1 — matriz por área e por plataforma

Legenda: **D** = desktop no SHA #16 (implementação indicada por código/docs); **P** = PWA no SHA #16 (existência estática, não execução atual); **N/O** = não observado como experiência funcional completa.

| Área | D / P — observação | Déficit da 1.0 e causa/riscos a verificar | Correção incremental / experiência ousada / simplificação | Prioridade |
| --- | --- | --- | --- | --- |
| **Visão Geral** | D: U1, quatro métricas, ritmo, ranking, agenda e origem, sem confundir saldo com receita. P: shell com cartões de staging, não U1. | Histórico parcial pode tornar comparativos ilusórios; UI não paritária. [U1](../../DESIGN_U1_OVERVIEW.md) | **Incremental:** origem+data em todo KPI; **ousada:** “painel de decisões” com próximas 3 ações justificadas; **simplificar:** uma única área de saldo, sem repetir gráfico | P0/G3; P1/G4 |
| **Movimentações** | D: U2 com banco/manual separados, filtro, revisão, edição e splits. P: listas bancária/manual paginadas e edições seguras parciais. | Identidade conta+external_id, categorias de origem, revisões/lotes e histórico devem coincidir. [U2](../../DESIGN_U2_OPERATIONS.md) | **Incremental:** botão “revisar próxima”; **ousada:** fila contextual com preview de regras e lotes; **simplificar:** um drawer que mostre original+override+motivo | P0/G2/G3; P1/G5 |
| **Planejamento** | D: U2 agenda, calendário, projeção e quitações parciais; P: calendário/listagem e edições limitadas dos registros migrados. | Fontes diferentes, incerteza de receita e datas podem produzir projeções discrepantes; não repetir baixa bancária. | **Incremental:** legenda pago/pendente/incerto; **ousada:** timeline até próximo recebimento com faixa de risco; **simplificar:** modos Agenda/Calendário/Projeção em mesmo motor | P0/G2/G3; P1/G6 |
| **Orçamentos** | D: U3 limites, cobertura, filtros atenção/sem limite; P: limites com edições restritas e prévia de consumo não conciliado. | Limite zero ≠ sem limite; recorrente atual ≠ envelope/rollover; “margem” ≠ dinheiro em conta. [U3](../../DESIGN_U3_DECISIONS.md) | **Incremental:** proveniência do consumo; **ousada:** Flex (fixo/não mensal/variável) acima de categorias; **simplificar:** modo básico primeiro e avançado opcional | P0/G2/G3; P1/G7 |
| **Contas** | D: U3 referência do saldo e cobertura; P: conta Pluggy, status staging, diagnóstico E1 e leitura bancária. | Data da consulta ≠ data do saldo; saldo ausente ≠ zero; consentimento e reconexão sem duplicar histórico. | **Incremental:** etiqueta confiabilidade + “atualizado em”; **ousada:** trilha de saúde da conexão e fontes por conta; **simplificar:** alertas num único painel de diagnóstico | P0/G1/G3 |
| **Simulador / Laboratório** | D: U3 A/B e gráfico/tabela, sem salvar antes de confirmar; P: interface e fórmula de cotação compartilhada, mas **não** equivalente à projeção diária/CRUD Windows. | Comparar motores e primeira data de parcela; cenário não pode criar compromisso sozinho. | **Incremental:** hipóteses visíveis; **ousada:** “E se...?” contextual via Planejamento; **simplificar:** absorver rota como subseção preservando deep-link | P0/G2/G3; P1/G6 |
| **Inteligência** | D: E1–E4.1 em interface demo, memórias/contexto sintético; P: visualização de política/demo sem inferência. | Sem ferramenta real tipada, consentimento e recibo de ações; custo API não comprovado. | **Incremental:** resposta com fonte+cobertura; **ousada:** comando com diff e recibo; **simplificar:** Hoje/Conversar/Plano de ação, sem criar aba extra | P0/G9 |
| **Configurações / Metas / Patrimônio** | D: configurações, backup e controles; P: Preview protegido, preferências parciais; metas/patrimônio completos são **alvo 2.0**, não UI comprovada. | Backup/restore, notificações, segurança, preferências e patrimônio não unificados; risco de sobrecarga na navegação. | **Incremental:** origem/backup visíveis; **ousada:** visão única Metas e Patrimônio por objetivos; **simplificar:** configurações em grupos e ações críticas separadas | P0/G1/G10; P1/G7/G8 |

**Correções já relatadas, não reabrir como bugs atuais sem reproduzir:** F01 (saldo desconhecido), F03 (legenda donut), F04 (navegação), F05–F06 (calendário/foco/320 px), F07 (fila IPC) em PRs #12–#14. Persistem testes de instalação/assistivos/integração. **Nova suspeita ≠ bug comprovado**: diferenças entre motores PWA e desktop, qualidade de saldo, histórico incompleto, latência e fluxo de retorno de edição devem ser testados com cenários sintéticos.

## 4. A2 — arquitetura financeira, segurança e contratos

### O que merece ser MANTIDO
- Electron + React/TS + SQLite como linha local preservada; Cloudflare Worker + Durable Objects SQLite como staging isolado; Pluggy read-only.
- `shared/finance-period-ledger.mjs` já centraliza uma parcela do agregado por período com centavos inteiros, natureza e splits; `shared/finance-installment-quote.mjs` compartilha cotação de parcelas; `shared/bank-parity.mjs` e `shared/e1-*.mjs` são pontos de partida para conciliação.
- `electron/cloud-personal-safe-sync.cjs` e `mobile-push/src/finance-personal-edits.js` implementam fluxo restrito de overlay/CAS; não equivalem a sincronização total de CRUD. `mobile-push/public/finance-ai.js` explicita ausência de inferência no navegador.
- `.circleci/config.yml` traz preflight/Windows opt-in, mas `npm install --package-lock=false` sem lockfile reforça o risco C11 de reprodutibilidade.

### Invariantes obrigatórias e cenários de teste
1. **Centavos e datas exatos:** inteiro seguro, timezone/corte de mês, D+1, fevereiro, virada de ano, timezone local versus ISO, testados com fixtures.
2. **Identidade:** `account_id + external_id` por lançamento bancário; reimportação idempotente; `pending` ≠ `posted`; estorno e reembolso classificados sem dobrar receitas.
3. **Fontes:** banco/manual nunca agregados automaticamente; vínculo manual, split e transferência própria evitam duplicação; overrides não mutam bruto do banco.
4. **Saldos:** `zero conhecido`, `desconhecido`, `parcial`, `desatualizado` com `as-of` e cobertura; nenhuma “disponibilidade” inventada.
5. **Planejamento:** compromisso quitado/parcial não reduz caixa duas vezes; receita provável não aparece como recebida; cenários simulados não gravam sem ação.
6. **Escrita/concorrência:** revisão base/CAS, idempotency key, conflito 409, replay, undo possível e audit log; dois dispositivos, rede lenta/offline, segunda escrita.
7. **Recuperação:** cópia local exportável e restore em DB descartável ANTES do cutover; migração aditiva, dry-run, rollback e auditoria de 17 tabelas.
8. **IA:** servidor controla autenticação/custos/limites; ferramenta expõe apenas contratos permitidos; dados externos são não confiáveis; comando de escrita exige prévia e consentimento humano; o produto funciona sem IA.

**Opções de arquitetura:** 
- **MANTER / evoluir (recomendado):** estrangular duplicação com pacote de domínio puro e adapters Electron/Worker, contratos `schemaVersion`, `sourceVersion`, `revision`; migrar leitura primeiro, escrita depois. Custo **Médio/Alto**, risco controlável, preserva código e SQLite.
- **SUBSTITUIR todo stack/recriar UI (não recomendado):** grande esforço, multiplataforma e migração simultânea, perde provas e aumenta superfície de divergências. Custo **Muito alto**, risco **Alto**. Só reavaliar após medições que provem bloqueio estrutural.
- **Cloud canônica imediata (REJEITAR agora):** sem G1/restore, risco inaceitável de dado financeiro.
- **IA com acesso direto a SQL (REJEITAR):** substituí-la por ferramentas tipadas, autorização e recibo.

**Gates de liberação:** G0 = SHA, dependências, build e smoke; G1 = paridade e restauração; G2 = golden tests do motor; G3 = jornadas equivalentes; G9 = consentimento/custo/auditoria; G10 = release coordenada. **Nenhum gate promovido.**

## 5. A3 — benchmark público revalidado em 09/11/2026

Base **páginas públicas oficiais/centrais de ajuda**, não UX interna paga nem garantia de compatibilidade bancária brasileira.

| Referência | Evidência pública (fonte) | Aprendizado reaproveitável | Ressalva |
| --- | --- | --- | --- |
| Copilot Money | [Dashboard, 14/04/2026](https://help.copilot.money/en/articles/6045480-dashboard-tab-overview); [Cash Flow, 20/02/2026](https://help.copilot.money/en/articles/9682232-cash-flow-tab-overview) | Revisão logo na home, gastos acumulados, drill-down e comparações | “Free to Spend” do concorrente é orçamento, **não saldo bancário seguro** |
| Monarch Money | [Flex Budgeting, atualizado 06/11/2026](https://help.monarch.com/hc/en-us/articles/32125337244052-Using-Flex-Budgeting); [Reports, 21/09/2026](https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports) | Blocos fixo/não mensal/flexível e relatórios configuráveis clicáveis | Não importar motor Flex sem persistência |
| YNAB | [Features](https://www.ynab.com/features) | Alocação orientada a objetivos, dívidas e modo offline | Envelope ≠ saldo bancário; curva de aprendizado |
| Rocket Money | [FAQ](https://www.rocketmoney.com/faq); [cancelamento, 05/10/2026](https://help.rocketmoney.com/en/articles/934402-how-do-i-cancel-a-subscription-on-rocket-money) | Assinaturas e vencimentos visíveis | Serviço de cancelar assinatura é externo e **fora do escopo** |
| PocketGuard | [Bills, 01/09/2026](https://pocketguard.com/help/bills/); [Insights, 05/11/2026](https://pocketguard.com/help/how-to-use-insights-in-pocketguard/) | Projeção, recursão e relatórios comparativos, com alerta explícito de dupla contagem | “Leftover” depende de identificação confiável de contas/obrigações |
| Quicken Simplifi | [Projected Cash Flow, 29/12/2025](https://support.simplifi.quicken.com/en/articles/3357429-using-projected-cash-flow); [Watchlists, 16/09/2026](https://support.simplifi.quicken.com/en/articles/3472367-using-watchlists-on-the-web-app) | Linha futura por conta, watchlist de merchant/tag e comparação com histórico completo | Projeção não inclui todas as metas no produto de origem; não assumir completude |
| Actual Budget | [Rules](https://actualbudget.org/docs/budgeting/rules/); [Release 26.11.0, 01/11/2026](https://actualbudget.org/docs/releases/); [Bank Sync](https://actualbudget.org/docs/advanced/bank-sync/) | Regras auditáveis e personalização de navegação; integração Pluggy aparece documentada | Integração, hosting e criptografia têm compromissos próprios; não transplantar sem arquitetura |
| Origin | [AI Advisor, 08/09/2026](https://support.useorigin.com/hc/en-us/articles/39419419459085-What-is-the-AI-Advisor) | Verificações proativas, prioridades e cenários | Score abstrato pode simular exatidão: preferir motivos e evidência |
| Cleo | [Autopilot](https://web.meetcleo.com/blog/introducing-autopilot) | Conversa que se transforma em plano e ações contextualizadas | Autonomia de operações financeiras **não compatível** com nosso gate |
| Organizze | [Visão geral, 26/10/2026](https://ajuda.organizze.com.br/hc/pt-br/articles/6105543338771-O-que-%C3%A9-o-Organizze); [site](https://www.organizze.com.br/) | Terminologia brasileira, contas, cartões, alertas, categorias e IA de apoio | Marketing de paridade não equivale a teste da nossa PWA |
| Mobills | [Funcionalidades Premium](https://www.mobills.com.br/pricing/) | Metas e planejamento brasileiros com conexão e cartões | Frequência e cobertura do banco podem variar |
| Kinvo | [Conexão por posições](https://suporte.kinvo.com.br/articles/c832860e-a1da-4fa9-8733-0e8e989a51b4); [análises](https://suporte.kinvo.com.br/open-finance/articles/analises-detalhadas-de-investimentos-no-kinvo) | Patrimônio, origem, proventos e rentabilidade decomposta | Posições sem histórico NÃO permitem inventar retorno |

**Despezzas:** referência visual já documentada nas entregas D1–D4/U1–U3. Não houve nova inspeção autenticada de área paga nesta rodada; não alegar que reproduzimos recursos PRO. Capturas do concorrente não foram copiadas para o repo. Elementos visuais: propor identidade própria, tokens e testes de uso.

## 6. A4/A5 — portfólio de experiências e priorização

**Escala orientativa (0–3):** I impacto na decisão, F frequência, C confiança/segurança, R reutilização; E esforço (0 baixo, 3 alto). **Não somar como prova científica.** Destino é *recomendação*, não aprovação.

| ID | Hipótese com fluxo antes → depois | Dados, risco, custo e testes | I/F/C/R/E | P / decisão sugerida |
| --- | --- | --- | --- | --- |
| IDEA-19 **Sinal de confiança por número** | KPI opaco → clicar para ver origem, as-of, cobertura e linhas do total | G1/G2; risco baixo se indisponível declarado; testar parcial/zero/ausente | 3/3/3/3/1 | P1 **ADOTAR dentro do escopo existente** MF2-02/04 |
| IDEA-20 **Jornada do ciclo** | mês civil isolado → “até meu próximo recebimento”, obrigações e cenários | G2/G6; risco alto se receita presumida; golden tests por datas | 3/3/3/3/2 | P1 **MODIFICAR** Planejamento |
| IDEA-21 **Inbox de 5 minutos** | rever lista extensa → fila curta com preview e regras por merchant | G5/G3; falsos positivos, CAS e undo; testes lote/manual>regra | 3/3/3/2/2 | P1 **ADOTAR** como UX de Movimentações |
| IDEA-22 **Home em dois ritmos** | muitos cards iguais → mobile Hoje/7 dias, desktop Analisar/Agir | G3/G4; teste 320/390/768/1366/1920, foco e reordenação | 2/3/2/3/2 | P1 **MODIFICAR** dashboard |
| IDEA-23 **Recibo da IA** | resposta “feito” → diff, consentimento, ID, antes/depois, undo condicionado | G2/G9; P0 segurança, replay/permissões/custo; testes ataques | 3/2/3/3/3 | P1 **ADOTAR requisito já previsto**, executar tarde |
| IDEA-24 **Radar de três motivos** | avisos dispersos → máx. três achados verificáveis, silêncio e motivos | G5/G6/G9; falso alerta/push; testes frequência e privacidade | 3/2/3/3/2 | P1 **MODIFICAR** Radar existente |
| IDEA-25 **Panorama de origem e recuperação** | estados em configurações → status por conta, last sync, cobertura e backup | G0/G1; custo médio, benefício confiança; testes sessão/restore | 3/2/3/3/2 | P0/P1 **ADOTAR** em Contas/Configurações |
| IDEA-26 **Dívida vs reserva** | simulações isoladas → A/B com custo contratual, liquidez e hipótese | G6/G7; risco juros/taxas não documentadas; golden tests | 3/1/3/2/2 | P1 **MODIFICAR** Laboratório |
| IDEA-27 **Patrimônio decomposto** | saldo histórico agregado → aportes/valorização/proventos/transferências | G8; fonte incompleta e preços; testes sem falsa rentabilidade | 2/1/3/2/3 | P1 **ADOTAR** dentro do MF2-08 |
| IDEA-28 **Cartão de rotina semanal** | histórico passivo → digest opt-in com 3 tarefas, sem dados em notificação pública | G9; custo/push/privacidade; testes silencioso | 1/1/2/2/2 | P2 **ADIAR 2.1** |
| IDEA-29 **Score opaco de saúde financeira** | dados incompletos → número único sem explicação | Score pode fingir precisão/induzir decisão sem cobertura; custo alto | 1/1/0/1/3 | **REJEITAR** nesta fase; preferir fatos e checklists |
| IDEA-30 **Reescrita visual total imediata** | descartar U1–U3 → redesenhar sem gate | alto custo e regressão, sem ganho comprovado | 1/1/0/1/3 | **REJEITAR**; medir primeiro |

**Três de maior impacto:** confiança por número, ciclo até recebimento, inbox de revisão. **Três mais criativas:** Home contextual, IA com recibo, Radar de três motivos. Sobreposição deliberada: IDEA-19 + 25 compartilham indicador de proveniência; 20 + 26 usam **um** motor de projeção; 21 + 24 compartilham o motor de eventos. Não criar abas novas para cada ideia.

**Fluxos antes/depois específicos:** 
- **Compra:** saldo isolado → “conhecido em [data] / obrigações até [data] / cenário A x B” → enviar ao editor somente após confirmação, sem alterar banco.
- **Revisão:** 500 linhas → 3 pendências relevantes → aceitar, corrigir ou pré-visualizar regra em N casos → recibo/undo quando suportado; manual prevalece.
- **IA:** pergunta livre → consulta tipada com período e IDs autorizados → proposta escrita `expectedRevision` + diff → confirmar → aplicar transação idempotente → recibo ou conflito 409.
- **Dívida:** comparar antecipação versus reserva com taxa/data/base explícitas → simular sem persistir → salvar apenas decisão manual.
- **Investimento:** posição com data, aportes, proventos e valorização separados; se histórico insuficiente, informar retorno indisponível.

## 7. A5 — manter/modificar/adiar/rejeitar no roadmap

| Marco | Direção sugerida | Por quê |
| --- | --- | --- |
| MF2-00 | **MANTER e começar após aprovação** | Baseline/PR/CI/EXE são bloqueios reais, baixo risco de análise |
| MF2-01 | **MANTER, gate forte** | Cloud/desktop não reconciliados; restauro e CAS obrigatórios |
| MF2-02 | **MANTER, modularizar**, não reescrever | Há ledger e cotação compartilhados, falta cobertura completa |
| MF2-03 | **MANTER, U4 em jornadas** | PWA existe e deve ser aproveitada, sem paridade falsa |
| MF2-04 | **MODIFICAR home para dois ritmos** | Clareza e responsividade antes de personalização irrestrita |
| MF2-05 | **MODIFICAR com Inbox e regras auditáveis** | Reduz esforço, evita sobrescrever escolha manual |
| MF2-06 | **MODIFICAR por ciclo salarial e laboratório único** | Conecta fluxo e decisão sem somar modelos |
| MF2-07 | **MANTER modo simples/avançado, testar dívida** | Flex/rollover dependem de persistência e contrato |
| MF2-08 | **MANTER patrimônio com decomposição** | Não calcular performance sem histórico/fonte |
| MF2-09 | **MANTER IA operacional condicionada ao G2/G9** | Acesso GPT/Plus não equivale a API paga ou permissão de escrita |
| MF2-10 | **MANTER release coordenada** | Beta de um cliente não pode fingir v2 para os dois |

**Sem ampliação automática do MUST.** IDEA-28 para 2.1, IDEA-29/30 rejeitadas como recomendações. As decisões do usuário precisam preceder alteração dos requisitos vinculantes.

## 8. A6 — proposta de sequência para Rodada B (até três missões)

**B1 / MF2-00 — “Candidato comprovável”, primeira execução recomendada.**
- **Pré-requisito:** checkpoint do Work anterior (branch, SHA, `git status`, U4/IA não publicadas, ownership); confirmar base e conflito com #17 antes de editar.
- **Trabalho:** grafo #1–#16 com commits/ancestry e estratégia de integração não destrutiva; lockfile/dependências ou estratégia pinada validada; escolha de SHA candidato; testes e CircleCI do SHA; artefatos NSIS/portable+SHA256; smoke Windows isolado com dados sintéticos.
- **Arquivos a inspecionar, não editar sem ownership:** `.circleci/config.yml`, `.circleci/build-windows.ps1`, `package.json`, `mobile-push/package.json`, `scripts/renderer-provenance.cjs`, `tests/renderer-asar.integration.cjs`, `src/app.ts`, `app/*.css`.
- **Testes:** `npm run test:types`, `npm run test:db`, `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar`, `cd mobile-push && npm test`, `npx wrangler deploy --dry-run`; CircleCI preflight/Windows (job autorizado), launch Electron, 8 telas, temas, 1366/320 e NVDA/zoom se ambiente disponível.
- **Gate G0:** fonte/checks/artifacts SHA iguais; banco local intacto; rollback de perfil; relatório de smoke/limites; integrador aprova. Sem merge/main/Production.

**B2 / MF2-01 — “Conciliação cloud sem cutover”.**
- **Pré-requisito:** G0 + backup local privado; usar comparadores existentes, não enviar extratos aos agentes.
- **Trabalho:** `E1_CONCILIATION_REPORT.md`, `electron/cloud-e1-audit.cjs`, `shared/bank-parity.mjs`, `mobile-push/src/finance-bank-reconciliation.js`, `finance-personal-edits.js`; comparar por conta+external_id, data, centavos, origem, saldo as-of, 17 tabelas, categorias e vínculo; testar restore e conflitos 409 em fixtures.
- **Gate G1:** zero diferenças não explicadas; idempotência, rollback e restore testados; Cloudflare continua staging até autorização **separada**.

**B3 / MF2-02 — “Golden core e contrato de paridade”.**
- **Pré-requisito:** G1, ou design e fixtures de domínio podem iniciar antes em branch isolada sem usá-las para promover integração.
- **Trabalho:** portar funções, não reescrever de uma vez; `shared/finance-period-ledger.mjs`, `shared/finance-installment-quote.mjs`, `electron/planning.cjs`, `mobile-push/src/finance-period-preview.js` e adapters; schemas de source/revision/as-of/uncertainty; testes de propriedade e snapshots Windows/Worker.
- **Gate G2:** entradas iguais → centavos/datas iguais; saldos/receita/transferências/partial/dívidas coerentes; nenhuma regra autoritativa em UI/IA. Depois, abrir fatias U4 (MF2-03) por jornada, não remake simultâneo.

**Protocolo de agentes e esforço:** Chat = decisões/benchmark/prompts; Work **Leve** = status/CI/SHA, **Médio** = auditoria/teste por módulo, **Alto** = reconciliação financeira/arquitetura/IA com escopo fechado. Um único writer por `src/app.ts`, CSS, `shared/finance-*`, Worker e ROADMAP por vez; integrador aprova gate global. Cada PR da B: implementação + testes + log + `ROADMAP_MF2.md` na mesma branch.

**Prompts curtos para B (não ativar antes de autorizar):**
1. `B1 MF2-00: reconcilie Work vs GitHub e rode somente preflight/Windows homologável em SHA acordado; não altere financeiro nem main; publique matriz PR, hashes, smoke e log+roadmap.`
2. `B2 MF2-01: com G0 aprovado, audite paridade completa e restore em modo seguro; não ative cutover; publique diferenças explicadas e contrato de 409/idempotência.`
3. `B3 MF2-02: com G1 aprovado, consolide cálculos puramente determinísticos e golden tests, mantendo adapters desktop/Worker; não reescreva UX nem conceda escrita à IA.`

## 9. A7 — checkpoint: decisões para o proprietário

1. **Linha de base:** autorizar MF2-00 como primeira execução depois de obter checkpoint Work? (recomendação: **SIM**, sem merge automático).
2. **Arquitetura:** manter Electron/SQLite local + Worker/DO, com migração canônica gradual após G1? (**SIM**).
3. **Experiência:** aprovar diretriz de dashboard contextual em dois ritmos (desktop/mobile) sem reconstruir U1–U3? (**SIM, como hipótese para prototipar após G3**).
4. **Orçamento:** priorizar modo simples com Flex opcional em vez de migrar imediatamente tudo para envelope? (**SIM, selecionar persistência em G7**).
5. **IA:** limitar primeiras escritas a alterações internas reversíveis e com recibo; nenhuma transferência/pagamento/trade; só após contratos/G9? (**SIM**).
6. **Escopo:** IDEA-19–27 como direções a priorizar **dentro dos marcos existentes**, digest para 2.1, score opaco/rewrite total descartados? (**recomendação SIM**).
7. **Custos/credenciais:** qualquer API paga, CircleCI adicional e Production exigem autorização separada; assinatura ChatGPT Plus não certifica orçamento/credencial API.

**Estado final da Rodada A:** análise remota documentada, nenhuma feature implementada, nenhum gate homologado e nenhuma decisão de escopo presumida. Esta revisão é insumo para autorização explícita da Rodada B.