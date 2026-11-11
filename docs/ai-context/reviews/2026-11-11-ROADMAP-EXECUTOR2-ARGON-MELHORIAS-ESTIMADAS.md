# MEU FINANCEIRO 2.0 — Roadmap coordenado Executor 2 × Argon

**Revisão:** 11/11/2026 · **Owner:** Arquiteto · **Tipo:** estratégia, backlog de produto e metas verificáveis; **NÃO** atesta implementação, testes nem release.  
**Repositório:** `JoaoVittorLi/meu-financeiro` · **Referência operacional:** PR #31 beta.8, PR #36 D1.5.1, PR #37 U5.1, PR #35 documentação.  
**Decisão do proprietário:** aguardar novas atualizações antes de gerar o próximo instalador Windows. **Não disparar CircleCI Windows, não fazer merge em main nem deploy PWA Production sem novo sinal verde.**

## 1. Estado no GitHub verificado nesta revisão

| Frente | Ref / HEAD conferido | Estado verificável | Gates faltantes |
|---|---|---|---|
| Base beta.8 | PR #31 / `d513c2be3f9b0cd018aed0b71f46ce8747a6556c` | Draft; Linux preflight + build Windows verdes **no SHA base** | Homologação da candidata atualizada |
| D1.5.1 | PR #36 / `87fb449c0232d80aebd7c50ad547197e34d3c806` | Código de precisão BRL, vínculo SQLite, hover, drawers e paleta publicado | Testes integrais Node/SQLite/TS/F08/ASAR/Electron/Windows |
| U5.1 | PR #37 / `10b9695305b0d2836f599b34971433955f64ea3b` | **Código já publicado** de popover categoria inline, filtros combináveis e produtividade, sobre PR #36 | Testes oficiais, GUI/teclado; arquivos alterados não incluem roadmap/handoff/log |
| Argon Inteligência | Missão especificada no PR #35 | Último checkpoint **parcial**, mapeamento/contratos; branch específica I1-A não identificada nas buscas de branches | Código de chat funcional salvo e publicado + testes |
| Identidade MF e A-D7 | Escopo documentado no PR #35 | Referências visuais e requisitos estabelecidos | SVG final, aprovação visual, integração de assets, GUI e empacotamento |
| Instalador Windows seguinte | — | **Não autorizado ainda** pelo proprietário | Gate do SHA final e CircleCI Linux→Windows |

Não confundir os 18/18 testes V8 e 6/6 reproduções SQLite isoladas da D1.5.1 com a execução dos 10 testes da classe FinanceDB na toolchain oficial. A U5.1 relata 12/12 filtros e 7/7 popover em V8 isolado, ainda sem a suíte oficial.

## 2. Estratégia e ownership

**Executor 2 (código funcional não-IA):** D1.5.1, U5.1, U5.2, U5.3, U5.4, F1/F2, integração final da marca e testes Windows. Não alterar `src/intelligence-view.ts`, `src/intelligence-integration.ts` e `app/intelligence.css` enquanto Argon for owner.

**Argon (código funcional de IA + direção visual):** I1-A/B/C, I2-A/B/C, I3; criar componentes reais do drawer e aba Inteligência, serviços e testes próprios. Também liderar conceito vetorial ID1 e diretrizes A-D7, em sub-branches/escopos separados da IA. Não alterar concorrencialmente `src/app.ts`, `electron/db.cjs`, `app/premium-interactions.css`, arquivos de build ou CSS do Executor. Se integração indispensável, fornecer adaptador e contrato, não conflito.

**Arquiteto (gate/integrador):** review de alterações, contratos financeiros, liberação de changes shared, consolidação de PRs encadeados e escolha do SHA de release, sem CI ad hoc.

**Antigravity Windows (QA):** testes e capturas de versão em perfil sintético/descartável, sem alterar mesmo checkout de um executor. Se vier a codificar, exigir worktree/branch e owner exclusivo.

**Bloqueio de ambiente Argon:** o agente relatou falta de git/node/tsc/escrita direta. Primeiro obter acesso autorizado via mecanismo de GitHub disponível ou produzir patches recuperáveis; **não repetir planejamento nem declarar entrega codificada sem commit/fonte recuperável**. Não editar bundle `app/app.js` manualmente; compilar TypeScript na homologação.

## 3. Backlog por entrega — Executor 2

### E0 / D1.5.1 — Integridade financeira e base de homologação
**Já codificado:** parser BRL estrito para cadastro/edição; validação transacional de vínculos no SQLite antes de alterações; drawer/hover e cores do Planejamento.  
**Falta:** executar `npm ci`, `npm run test:types`, `npm run test:db` incluindo dez cenários FinanceDB, `npm run compile`, F08 e ASAR; reabrir SQLite sintético, testar conciliação/restore JSON/SQLite, verificar contraste e hovers no Electron.  
**Aceite:** 100% dos gates oficiais obrigatórios no mesmo SHA; nenhuma exclusão de conciliação silenciosa. Sem build Windows até autorização.  
**Risco:** alto para centavos/links, mitigado por regressões; custo de execução/QA **1–3 dias úteis efetivos**, se ambiente operacional.

### E1 / U5.1 — Movimentações Premium (PR #37 já aberto)
**Já codificado no PR:** popover compacto de categoria com pesquisa, teclado e persistência por origem; filtro origem/conta/categoria/tipo/revisão, pesquisa e ordenação; CSS dedicado.  
**Falta:** garantir integração segura sobre D1.5.1, testes novos SQLite reais, UI foco/Escape/race/duplicatas entre contas, tema e 1366px, testar multi-filtro, documentar roadmap/handoff/log **no próprio PR #37**.  
**Aceite:** duas operações para editar categoria sem abrir drawer; salvos permanecem após reinício; sem mutação do extrato Pluggy; filtros não misturam identidades.  
**Ganho-alvo (hipótese):** reduzir **40–60%** das interações manuais em categorização e **25–40%** do tempo mediano para localizar/classificar em tarefas amostradas. Medir antes/depois com 15–20 tarefas sintéticas; caso não se confirme, ajustar UI.  
**Esforço restante:** ~**1–3 dias úteis** para QA/correções se toolchain disponível.

### E2 / U5.2 — Planejamento e Simular Compra
**Planejamento:** eliminar duplicação da projeção diária sem apagar função, melhorar calendário com entradas/saídas confirmadas vs estimadas, sinalizar período/ciclo de recebimento, tooltip e navegação, resolver cortes em 1366px, restaurar clareza de fonte/manual/Pluggy.  
**Simular Compra:** preservar último cenário ao editar inputs como *desatualizado*, recalcular sob demanda, comparação clara A/B, premissas e interpretação de pior dia; não mostrar cálculo obsoleto como válido.  
**Aceite:** calendário e gráfico com valores idênticos aos motores determinísticos, testes de virada de mês/ano e data; nenhuma perda silenciosa de cenário; teclado.  
**Ganho-alvo:** -**20–35%** tempo para localizar compromisso no calendário; reduzir de "perda de resultado" a **zero** durante simples alteração de campo.  
**Esforço:** **3–6 dias úteis**.

### E3 / U5.3 — Orçamentos e Configurações
**Orçamentos:** editor lateral contextual, histórico comparável, realizado vs compromissos previstos sem dupla contagem, manter pace e distinção orçamento `0` explícito vs não cadastrado; rebalanceamento sugerido sem escrita silenciosa.  
**Configurações:** seleção de tema controlada, organização backup/restore, CSV exposto se fluxo for seguro, termos internos removidos, privacidade de IA e status sync em linguagem do usuário.  
**Aceite:** centavos/zero/fonte testados; nenhuma alteração no limite em categorias não escolhidas; backup com restore e termos compreensíveis.  
**Ganho-alvo:** -**20–35%** no tempo para editar limite/revisar risco; redução qualitativa de dúvidas na configuração (medir tarefas).  
**Esforço:** **3–5 dias úteis**.

### E4 / U5.4 + F1 — Visão Geral, contas e inteligência financeira determinística
**Visão Geral:** selecionar, não empilhar, cards "Livre até próximo recebimento", previsão de fechamento, pior dia e alertas de categoria; data/fonte e cobertura explícitas. Se saldo desconhecido, *não computar disponibilidade como zero*.  
**Minhas Contas:** separar saldos bancários, passivos e liquidez; indicar atualização; avaliar conta manual com CRUD e sem somar dívida como saldo; transparência Pluggy.  
**Dados:** read-model determinístico compartilhável para radar Argon e UI Executor, sem criar segundo motor com regras divergentes.  
**Aceite:** cenários completos/incompletos, transferências próprias, saldos ausentes, dupla contagem, mês parcial, backup; fórmulas descritas e testes centavo a centavo.  
**Ganho-alvo:** 2–3 novas decisões suportadas por evidência, **100%** dos cards novos com proveniência e estado "sem dados" válido; não definir ganho percentual arbitrário sem estudo.  
**Esforço:** **5–9 dias úteis**.

### E5 / F2 — Ferramentas financeiras brasileiras
**Simular:** Pix com desconto vs parcelas, CDI hipotético *líquido de impostos/custos e prazo*, data ótima, antecipação e fluxo mínimo diário; metas e provisões sazonais somente após contratos de cálculo.  
**Aceite:** hipótese/taxa/data/inclusão de impostos explícitos; operações de centavos reprodutíveis; não apresentar rentabilidade estimada como promessa.  
**Ganho-alvo:** reduzir comparação manual de múltiplos cenários para **uma única tela**; comparação exata em fixtures; qualidade medida por erro de cálculo zero nas suites de referência.  
**Esforço:** **5–10 dias úteis**.

### E6 / Integração visual ID1/A-D7 e homologação R1
**Executor após assets Argon aprovados:** integrar logo MF em shell, about, splash, `build/icon.ico`, NSIS/Portable, taskbar e assets PWA Preview; hover/paleta/ícones padronizados, respeitar personalizações antigas, acessibilidade de 1366/1920/light/dark.  
**Aceite:** inventário de locais de marca, ícone reconhecível 16px a 512px, renderers e instaladores verificados; não forçar atualização da PWA Production.  
**Esforço integração:** **2–5 dias úteis**, além do design vetorial Argon.

## 4. Backlog por entrega — Argon

### A0 — Desbloquear publicação e garantir ownership
**Fazer:** confirmar base beta.8 HEAD atual e trabalho local existente; criar branch própria e postar commit/PR de alterações reais usando ferramentas habilitadas. Se não houver escrita ou runtime, entregar patches recuperáveis com relatório sucinto, não alegar funcionalidade.  
**Aceite:** SHA verificável, conteúdo completo e reproduzível.  
**Esforço:** **0,5–2 dias úteis**, dependente de permissões.

### A1 / I1-A — Chat lateral Premium (primeira entrega operacional)
**Fazer:** substituir drawer de rascunho pesado por conversa compacta que responde *no lugar*, com campo persistente, histórico leve, chip de contexto com opt-in/período, loading/cancel/retry, expandir para aba principal, foco/teclado/reduced motion, sem avisos permanentes gigantes. Reutilizar somente serviço de IA efetivamente autorizado; quando indisponível, estado honesto.  
**Aceite:** abrir de oito módulos, fazer pergunta e obter resposta real quando serviço estiver conectado; sem redirecionamento obrigatório; continuidade de sessão e sem dados reais em testes.  
**Ganho-alvo:** de "precisa preparar e navegar" para **0 redirecionamentos obrigatórios**; -**40–60%** passos até uma pergunta/resposta simples, após medição; reduzir espaço vertical fixo não essencial em ~**50%**, sujeito à acessibilidade.  
**Esforço:** **4–8 dias úteis**, com serviço operacional.

### A2 / I1-B — Aba Inteligência principal
**Fazer:** chat principal e sidebar compartilham threads, contexto, histórico e estados; layout Hoy/Conversar/Ações (nomes e posição podem mudar), respostas com tabelas/gráficos seguros (não HTML/JS arbitrário), configurações avançadas fora da primeira dobra; navegabilidade em 1366/1920, claro/escuro.  
**Aceite:** conversa iniciada no drawer persiste ao abrir aba; histórico recuperável após reinicialização; 0 mensagens duplicadas; screenshots reais e testes de estados.  
**Ganho-alvo:** 1 continuidade de histórico entre duas superfícies; -**30–50%** espaço de controles não essenciais na tela principal; metas de UX devem ser medidas.  
**Esforço:** **3–7 dias úteis**.

### A3 / I1-C — Radar local real e explicável
**Fazer:** próximos compromissos, orçamento em risco, gastos atípicos, mudanças de tendência com motor determinístico, fontes/períodos/limitações; não fingir IA ou saldo real; read-model compartilhável com o Executor.  
**Aceite:** pelo menos **3 tipos** de insight verificáveis em fixtures, 100% dos valores com fonte e data ou estado de insuficiência; nenhum dado sintético apresentado como usuário.  
**Ganho-alvo:** substituir 3 cartões demonstrativos por **≥3 análises úteis reais**; evitar metas especulativas de economia monetária.  
**Esforço:** **4–8 dias úteis**.

### A4 / I2-A — Conversação financeira contextual
**Fazer:** contratos de consulta somente leitura com allowlist, seleção e minimização de dados por escopo, respostas com detalhes/referências ao conjunto consultado, custo/latência/erro/offline, streaming quando suportado e fallback honesto. Separar autenticação ChatGPT de cobrança/API; não presumir API grátis.  
**Aceite:** suíte com 20 perguntas sintéticas representativas de oito áreas, **≥90%** respondidas corretamente ou recusadas por falta de dados (alvo de QA, não promessa), zero vazamento de segredos e zero acesso fora do escopo.  
**Ganho-alvo:** de perguntas demonstrativas para **respostas efetivas e contextualizadas**; medir acerto e tempo, não inventar eficiência.  
**Esforço:** **6–12 dias úteis**, variando muito com o provedor e autenticação.

### A5 / I2-B — Ações supervisionadas (categorização primeiro)
**Fazer:** pedir "categorize a compra X"; localizar alvos com IDs reais, desambiguar, proposta `antes→depois`, botões **Permitir / Negar**, confirmar por operação transacional segura, sem alterar bruto Pluggy, proteger snapshot stale, idempotência, logs e mensagem após save. Integração com `setBankCategory` e manual categorização deve usar contratos tipados sem editar backend do Executor sem integração acordada.  
**Aceite:** rejeição grava **zero**; aceitação altera **somente** a classificação autorizada; cenários duplicata, consentimento, stale, falha, replay, override manual e bancário comprovados em SQLite/bridge; sem ação automática.  
**Ganho-alvo:** reduzir **40–70%** das etapas de categorização por comando contextual versus navegação manual em casos adequados; não é garantia em casos ambíguos.  
**Esforço:** **6–12 dias úteis**, depende de contratos compartilhados.

### A6 / I2-C e I3 — Orçamento, metas, planejamento e proatividade
**Fazer:** estender actions allowlist, prévia com impacto, transações auditáveis e undo possível; sugestões proativas úteis sem flood de alertas; custos e privacidade controláveis. Não oferecer deleção em lote ou alteração do bruto bancário como "comando geral".  
**Aceite:** cada ferramenta auditável, reversão definida quando segura, nenhum comando não aprovado, cenários de falha e permissão revogada; prova em fixtures antes do produto.  
**Ganho-alvo:** elevar cobertura de IA de leitura para **3–4 tipos de ação** com confirmação; redução de esforço medida por jornada.  
**Esforço:** **10–20 dias úteis**, por módulos e não num bloco único.

### A7 / ID1 + A-D7 — Direção de marca e acabamento visual
**Fazer:** desenho vetorial aprovado do monograma MF, lockup, logo claro/escuro/mono, ícones otimizados 16/32/256 e 192/512/maskable; guias de uso e tokens; mapa consolidado de resíduos roxos/emoji/hover; protótipos de transição discreta.  
**Aceite:** SVG original com geometria e licença/fontes claras, escala pequena legível e matriz visual de componentes; não migrar preferências personalizadas. **Não editar os arquivos pertencentes ao Executor em paralelo**.  
**Ganho-alvo:** atingir **100% dos pontos de marca inventariados** na integração, 0 roxo legado *inadequado* comprovado no novo design, sem forçar remoção de cores pessoais.  
**Esforço design:** **2–5 dias úteis**, pode ocorrer em paralelo ao A2/A3.

## 5. Ordem e sincronização

**Trilha Executor:** E0 (gates quando houver ambiente) → fechar E1 (PR #37) → E2 → E3/E4 por impacto e menor risco → E5. E6 quando assets e release integráveis. **Não empilhar mudanças não testadas em um único PR.**

**Trilha Argon:** A0 (primeiro commit real) → A1 (drawer) → A2 (aba) → A3 (radar) → A4 (chat contextual) → A5 (categorização autorizada) → A6 (demais ações). A7 (marca) pode andar paralelo, sem arquivos de aplicação em colisão.

**Integração:** Argon trabalha em `src/intelligence-*`, `app/intelligence.css`, novos serviços/testes; Executor mantém `src/app.ts`, `electron/db.cjs`, `app/movements-productivity.css`, `app/premium-interactions.css`. Arquiteto define contrato de leitura/gravação, revisa patch compartilhado e testa sobre SHA consolidado. PR #37 depende PR #36; tratar branches empilhadas corretamente antes de merge.

**Checkpoint de Windows R1 (preferência):** após U5.1 + U5.2 corrigidas, D1.5.1 validada e opcionalmente ID1 se já aprovada; **não esperar I2/I3 nem paridade PWA**. Requer autorização explícita do proprietário para disparar um workflow `windows_on_demand` com `run_preflight=false` e `run_windows_build=true`, que executa Linux→Windows. Confirmar NSIS, Portable, hashes, screenshots e instalação em perfil isolado. Depois novos releases em checkpoints úteis, sem gastar CI a cada commit.

**PWA/sincronização:** continuar como trilha separada, congelada nesta fase Desktop First; o objetivo posterior é paridade funcional real (6 áreas PWA e funcionalidades equivalentes), IDs, centavos, conflitos, backup/rollback e consentimento. A regra "atualização para um, atualização para todos" só pode ser aplicada após contratos compartilhados e gate de paridade; **não afirmar sincronização plena sem prova**.

## 6. Estimativas: hipótese, não KPI real nem prazo prometido

Os percentuais de melhoria acima são **metas de design/engenharia, não medições atuais nem benefícios garantidos**. Para verificar: estabelecer baseline na beta.8 com tarefas sintéticas (e.g. categorizar, localizar, editar orçamento, iniciar conversa), cronometrar cliques/teclas/tempo com no mínimo 15–20 casos por fluxo, repetir na build nova e publicar mediana, p75 e taxa de sucesso.

**Esforço em dias úteis efetivos**, assumindo checkout, ferramentas, dependências e permissão de publicação:  
Executor E0/E1/E2/E3/E4/E5/E6: aproximadamente **20–41 dias-pessoa**, podendo andar em paralelo a Argon. Argon A0–A7: aproximadamente **36–74 dias-pessoa** para o escopo integral. Esses valores não são datas de entrega nem estimativas confiáveis para agentes sem acesso à toolchain/GitHub. O primeiro checkpoint Windows exige apenas subconjunto E0/E1/E2 e aceite do usuário; I1-A pode evoluir independentemente.

**Prioridade de valor:** (1) integridade e produtividade diária; (2) chat lateral leve e funcional; (3) Inteligência real e autorização; (4) visual/brand consolidado; (5) novos motores, PWA e paridade de longo prazo.

## 7. Próxima decisão por agente

- **Executor 2:** fechar QA/manifesto documental do PR #37 e preparar U5.2 numa branch filha do SHA U5.1 somente após revisão de dependências, mantendo gates oficiais pendentes visíveis; não acionar Windows CI.
- **Argon:** a prioridade **não é novo mapeamento**; publicar **primeiro commit recuperável do I1-A**, com drawer efetivamente implementado, e abrir PR antes de iniciar I1-B. Se ausência de `git` persistir, usar mecanismo de publicação autorizado ou fornecer patch versionável que outro integrador possa aplicar; não declarar "implementado" sem fonte.
- **Arquiteto:** revisar PR #37, coordenar interfaces de categorização e autorização (manual vs Pluggy) para a futura I2-B, validar os próximos SHAs e gatilhos de release.

**NENHUMA tarefa deste plano constitui autorização de build, merge ou deploy.**
