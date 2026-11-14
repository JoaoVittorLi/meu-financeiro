# Meu Financeiro 2.0 — arquivo de textos substituídos nas issues

> Cópia preservada em 14/11/2026 para rastreabilidade. **HISTÓRICO — NÃO É O ESTADO ATUAL DO PROJETO.** Consulte [STATUS_ATUAL.md](STATUS_ATUAL.md) e [Issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) para decisões atuais.


---

## Issue #71 — [RELEASE/INTEGRAÇÃO] RC-ALL-01 — D01–D04 + leitura financeira + I2-A para um único EXE experimental

**URL:** https://github.com/JoaoVittorLi/meu-financeiro/issues/71

<details><summary>Abrir descrição original preservada (histórica)</summary>

# MEU FINANCEIRO 2.0 — RC-ALL-01 | PRIMEIRO EXE COM TODAS AS ENTREGAS ATUAIS

## Decisão do proprietário / Arquiteto
**Objetivo:** não retroceder ao PR #54 isoladamente. Produzir **UMA candidata Windows x64 (EXE experimental)** que consolide o código já publicado e **implemente os handoffs visuais já aprovados D03 e D04**, com leitura financeira local funcional. O EXE é autorizado **somente como objetivo após QA e liberação do proprietário**, nunca automaticamente pela abertura desta issue.

**Corte de escopo (13/11/2026):**
- #54 `55de81c03c3171edd0b325eb66d63630018c23c4` — base funcional, provas históricas 542/542.
- #60 `7a5789e62d39c100e4c9dec64982db1dc9a87244` — D01 + VR07/08; empilhado no #54.
- #63 `0fa05f005d316a815e207eb4b4e043036f783828` — D02 26 renderers; empilhado no #60.
- #68 `bf08ec54fbcaf498eff12f1edeea5949cee1a524` — P1 identidade do grant; empilhado no #63.
- #64 `da117ce1145a748b653144c7f328145b71798e0e` — ferramentas I2-A **isoladas sobre #54**, exigem contrato/adaptador IPC homologado; não importar por merge cego, nenhum modelo pago nem dados pessoais enviados externamente.
- Design #57: D03 V2 **DESIGN_APPROVED / CODE_NOT_IMPLEMENTED**, handoff #66; D04 V1.1 **DESIGN_APPROVED / CODE_NOT_IMPLEMENTED**, handoff #69. **D05 Movimentações é próximo design, ainda sem handoff aprovado neste corte; não bloquear primeiro EXE.**
- #65 QA-GATE-01 mantém gates reais obrigatórios. HEADs fixos são referência; checar HEAD atualizado antes de tocar branch.

## Atribuições e ordem para evitar conflito

**Executor 1 — UI (D03 e D04):** pode iniciar imediatamente desenvolvimento da D03 e D04 **em UMA nova branch/PR Draft empilhada na #68** (ou base sucessora definida pelo Integrador), dois checkpoints: (C1) D03 inteira com 0–3 SignalCards reais e ações autorizadas, (C2) D04 Central de Revisão V1.1 com revisão/preview/consentimentos seguros. Reusar serviços e D01/D02, sem reimplementar ledger. D03 e D04 NÃO são apenas protótipos: exigir handlers reais para capacidades existentes e `unavailable` onde falta contrato. **Não editar IPC nem `app/app.js`**. Coordenar #49 se Integrador corrigir arquivos `src/intelligence*`/CSS; somente um owner por arquivo em cada integração.

**Integrador — QA/RC:** responsável por (A) corrigir/validar #60, (B) validar a cadeia #63+#68, (C) executar testes isolados de #64 e decidir o adaptador `IC2-READ-QUERY` sem forjar `IC-v1`, (D) reconciliar a branch D03/D04 e integrar #64 **por contrato**, em branch separada única de RC, (E) compilar renderer canônico, F08/ASAR, Electron/SQLite sintéticos e screenshots; nenhuma escrita pessoal pela IA. Priorizar primeira candidata **com leitura local**: caso integração I2-A bloqueie, declarar `I2-A_NOT_INTEGRATED` explicitamente e preparar decisão do proprietário sobre EXE parcial, sem chamar aquilo de 'tudo'.

**Executor I2-A:** sem concorrência em UI. Só correções dirigidas de `#64`, testes/contrato após solicitação do Integrador.

**Designer:** pode continuar D05 Movimentações, sem pressionar/editar código de RC. Design D05 aprovado depois deste corte entra na **próxima versão**, salvo decisão explícita do proprietário.

**Proprietário:** único responsável pelos preflights CircleCI sob demanda e pela autorização de QA/build Windows e uso do EXE.

## Sequência de validação e entrega
1. Criar PR Draft UI D03/D04 **sobre #68** com código real C1/C2. Checkar contrato de identidade do grant no mesmo escopo, inclusive revogação→nova autorização. Sem merge da main.
2. Integrador compõe candidato RC usando a cadeia de commits #54→#60→#63→#68→D03/D04 e, após revisão contratual, #64 por adaptador versão 2. Atualizar PR/issue com branch e SHA exatos; **não disparar CI sem SHA congelado**.
3. Proprietário executa CircleCI **somente após receber branch/SHA** do Integrador: para Linux `run_preflight=true,run_windows_qa=false,run_windows_build=false`. Retornar `pipeline ID, git SHA, step/erro completo`; integrador corrige e publica novo SHA se falhar.
4. Após Linux PASS e autorização separada, proprietário roda Windows QA **`run_windows_qa=true,run_windows_build=false,run_preflight=false`**; workflow configurado executa preflight Linux + Windows QA com Electron sintético, sem instalador. Retornar screenshots/hashes/logs, corrigir falhas.
5. Após RC aprovada para *experimento* e backup verificado, proprietário roda **`run_windows_build=true,run_windows_qa=false,run_preflight=false`**; workflow executa preflight Linux + build Windows x64 e produz NSIS/Portable. O EXE final deve corresponder ao SHA que passou os gates. Não instalar sobre perfil pessoal sem backup e validação do diretório de dados.
6. Checklist de aceite: leitura de despesas por categoria, maiores gastos, comparações, orçamentos e compromissos; D01/D02/D03/D04 dark/light e interações; fallback onde não há serviço; I2-A queries/follow-ups **somente se efetivamente integrada**; conta/fonte/mês/grant/stale, PENDING/POSTED, splits, valor R$0, não duplicar valores; F08/ASAR, screenshot Electron real, restore/backup isolados.

## Restrições
Nenhum merge em `main`, escrita financeira pessoal por IA, API paga, envio de dados pessoais externos, Cloudflare Production, CI/build Windows sem ordem do proprietário. **Não confundir DESIGN_APPROVED, CODE_PUBLISHED, DATA_CONNECTED e HOMOLOGATED.** Não declarar EXE pronto sem arquivos de release reais e rastreamento SHA.

## Protocolo de resposta de cada chat
Toda entrega termina em **PRÓXIMO PASSO** com: estado real, PR/branch/SHA, destino responsável e **prompt completo a copiar** para o próximo chat ou mensagem exata para continuar; parametrização de CI somente após publicação da branch/SHA, com proprietário sempre responsável por disparar.

</details>


---

## Issue #49 — MF2 FAST LANE — quadro compartilhado de Redesign e Inteligência

**URL:** https://github.com/JoaoVittorLi/meu-financeiro/issues/49

<details><summary>Abrir descrição original preservada (histórica)</summary>

# Coordenação oficial — Redesign Premium + Inteligência Operacional (Fast Lane)

**Decisão do proprietário, 12/11/2026:** acelerar **desenvolvimento visível e Inteligência funcional** em duas frentes conectadas por um contrato único. Não repetir auditoria geral já realizada. Este issue é o quadro vivo de dependências; as especificações versionadas ficam na branch documental `coord/mf2-premium-intelligence-20261112`.

**Baseline técnico congelado para largada:** `qa/mf2-q1-integrated-windows-20261112` / `810a2bcb7706584474dbd2900cec536ff53edda5` / PR #48 (Draft). Inclui PRs #46–#47. Se Q1 evoluir, integrador avalia cherry-pick; não rebase automático.

## Duas frentes e fronteiras
- **R — Redesign (Work + Computer Use):** `feat/mf2-premium-redesign-20261112`; owns telas, componentes, UX, `src/app.ts`, `src/intelligence-view.ts`, `src/intelligence-review.ts` e CSS. UI consome contratos reais; sem card ou botão operacional fictício.
- **I — Inteligência (chat executor + GitHub):** `feat/mf2-intelligence-operational-20261112`; owns serviços, contratos de consulta/ação, serviços Electron/IPC e testes de domínio; sem redesenhar telas ou escrever em arquivos visualmente compartilhados.
- **Integrador / Arquiteto:** único responsável por consolidar contratos, resolver sobreposições, regenerar `app/app.js`, executar QA da junção e marcar integração.

## Sequência enxuta
1. **P0-A:** Inteligência Hoje + Conversar conectados a dados locais autorizados, com estados reais de capacidade/erro/sem dados.
2. **P0-B:** propostas de categorização/revisão no ambiente sintético e caminho claro para criar categoria; visual premium com Aceitar/Editar/Negar e prévia existentes.
3. **P1:** Movimentações e Visão Geral premium, cards com clique útil; expansão posterior de escritas supervisionadas para Orçamentos/Planejamento/Metas em sintético.

## Check-in obrigatório em cada PR ou quebra de contrato
Comentar neste issue: `[R/I] SHA / PR / contrato alterado (ID) / superfícies / testes / depende de / próximo`. Consultar os comentários do outro executor **antes de alterar contrato ou pontos de integração**. Propostas de novos cards precisam referenciar contrato, fonte, estado e ação. Contratos novos só são efetivos após aceite do integrador.

## Não autorizado
Sem alterar SQLite pessoal, habilitar escrita por IA no perfil pessoal, merge em main, deploy Production, custos API, CircleCI Windows pago, EXE/instalação ou cutover de sincronização. Somente branches, PRs Draft, testes e dados sintéticos, além de consultas locais existentes com consentimento.

**Critério de pronto:** ação não é apenas visual; fonte/dado + handler + permissão + carregando/vazio/erro + teste integrado. Sem evidência: EM_TESTE, não HOMOLOGADO.

**Leituras canônicas (após publicação do branch):** `docs/ai-context/FAST_LANE_20261112.md`, `docs/ai-context/INTELLIGENCE_UI_CONTRACT_V1.md`, `docs/ai-context/FAST_LANE_BACKLOG.md`, `docs/ai-context/DESIGN_DIRECTION_PREMIUM.md`, `docs/ai-context/FAST_LANE_HANDOFF_TEMPLATE.md`.

</details>


---

## Issue #65 — [INTEGRADOR/QA] QA-GATE-01 — Estabilizar #60/#63 e preparar I2-A #64 no Electron

**URL:** https://github.com/JoaoVittorLi/meu-financeiro/issues/65

<details><summary>Abrir descrição original preservada (histórica)</summary>

# Meu Financeiro 2.0 — QA-GATE-01 | Integração e homologação técnica

**Decisão do Arquiteto em 13/11/2026:** checkpoints de código das frentes visuais recebidos, **NÃO HOMOLOGADOS**. Iniciar uma única missão de estabilização real e integração controlada, sem voltar ao ciclo de protótipos e sem merge na `main`.

## Evidência confirmada no GitHub
- **Base funcional:** PR #54 / `55de81c03c3171edd0b325eb66d63630018c23c4`, com QA histórico não transferível aos novos SHAs.
- **INT-DESIGN-01:** PR #60 / `7a5789e62d39c100e4c9dec64982db1dc9a87244`; C1 D01 V4.5, C2 VR-07 Treemap + VR-08 Sankey; 27/27 **somente verificações isoladas V8**, 32 regressões novas versionadas.
- **INT-DESIGN-02:** PR #63 / `0fa05f005d316a815e207eb4b4e043036f783828`, empilhado no #60; C1 VR01–11, C2 VR12–26; 26/26 **somente verificações isoladas V8**, 26 regressões versionadas. 26 renderers ≠ 26 serviços financeiros homologados.
- **I2-A:** PR #64 / `da117ce1145a748b653144c7f328145b71798e0e`, isolado sobre PR #54; nove ferramentas read-only, orquestrador contextual, provider mock desabilitado; **não integrado**, com gates oficiais pendentes.
- **Design:** PR #57 D01 V4.5 aprovado, VR07/08/09 aprovados individualmente, VR10 base aceita, D02 V3 especificado para integração; D03 #61 continua separada.

Os SHAs acima são checkpoints, **consulte HEADs novos** antes de executar. Hoje não foram comprovados os runners Node/SQLite/TS/compile/F08/ASAR nem smoke Electron/screenshots nos HEADs #60/#63/#64. PR #63 não tem checks de CI registrados no HEAD mencionado. Um deploy Preview Cloudflare não substitui execução Electron desktop.

## Critério de entrada
Esta tarefa depende de ambiente com **checkout autenticado real do repositório privado**, Node 22.23.4 / npm 10.9.9, dependências do projeto e capacidade de iniciar Electron/SQLite sintético. Não confundir extração parcial de arquivos do GitHub/strip de TS em V8 com build, ASAR, SQLite nativo ou Electron real. Se esse ambiente não existir, registrar blocker e encaminhar à infraestrutura/Integrador que disponha dele; **não alegar execução nem gastar CI/Windows pago sem autorização**.

## Gate A — estabilizar PR #60
1. Checkout exato no HEAD atualizado do #60; inspecionar árvore/lockfile/ownership.
2. `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, proveniência/F08 e `npm run test:asar`; ASAR real temporário se houver execução local sem publicar instalador.
3. Corrigir falhas na branch/PR adequado, preservando ledger e D01 consentimento, sem relaxar asserções.
4. Smoke real Electron+SQLite sintético e screenshots D01/VR07/VR08 nas resoluções 1366x768 e 1920x1080, dark/light; reportar SHA dos PNGs e do bundle.
5. Gate aprovado **apenas** com logs de comandos, exit codes, mesmo SHA do código testado e evidências visuais vinculadas.

## Gate B — estabilizar PR #63
1. Trabalhar sobre o PR #63 empilhado no #60 **depois de reconciliar eventual correção do Gate A sem sobrescritas**. Não rebase cego.
2. Repetir Node/SQLite, TS, compile, proveniência/F08, ASAR no **HEAD final #63** (incluindo 26 testes novos e regressões legadas).
3. Rodar Electron sintético: D01 + VR07/08/09/10, tabelas, orçamentos R$0, cenários indisponíveis, filtros, drilldown, modal, contexto, teclado, zoom/resize, `prefers-reduced-motion`; capturas reais dark/light 1366x768/1920x1080 e 390px quando suportado.
4. Contrastar design #57 D02 V3, sem fingir que 22 famílias herdadas têm aprovação individual; mapear `RENDERER_IMPLEMENTED` vs `DATA_CONNECTED` vs `OPERATIONAL_HOMOLOGATED`.
5. **P1 a verificar e corrigir:** `src/intelligence-v3-ui.ts` `mfV3Live(app,d)` valida existência do grant, prazo, fonte, perfil e mês, porém `MfV3Card` não vincula o snapshot ao ID/token/geração da autorização original. Reproduzir: gerar análise com grant A, revogar, autorizar grant B para a mesma fonte/perfil/mês (e simular troca de conta/owner ou dataset), reexibir resposta A. Garantir estado **stale** em vez de ressuscitar valores antigos. Vincular snapshot a identidade opaca de sessão/grant sem persistir ou logar token sensível. Incluir regressão de troca de grant **mesmo quando os campos fonte/perfil/mês são iguais**, troca de conta, restore, autorização expirada e contextos concorrentes. Não assumir esse risco resolvido apenas porque algumas conversas são limpas no fluxo usual.
6. Checar que renderers `partial/unavailable` não exibem visuais enganosos ou CTA de escrita; que `visualV3` e `visual` não duplicam; que folgas de 20 registros são explicitamente amostras; que resultado mensal não vira saldo disponível.

## Gate C — revisar I2-A e preparar integração em 1 candidata
1. Executar isoladamente a suíte Node/SQLite do PR #64 (`tests/intelligence-i2a.test.cjs`) sobre seu HEAD e revisão do contrato `IC2-READ-QUERY` no issue #49. Gate A/B não depende da aprovação do modelo generativo.
2. Integrador define contrato **único** de resposta: `factRef`, IDs, filtros, fonte, perfil, período, assinatura/validade, cobertura, qualidade, `kind`, ação permitida, densidade e fallback. Comparar `MfV3Card` #63 com saída I2-A #64; sem duplicação de cálculo, confiança inventada, HTML por LLM ou autorização implícita.
3. Após Gates A/B aprovados e revisão do contrato, criar **uma única branch/PR Draft de integração** sobre a candidata visual estável #63, incorporar módulos isolados do #64 sem reescrever os arquivos de UI nem presumir que provider simulado significa IA pessoal ativa. Integração por IPC apenas após contrato aceito; regressões de troca de conta, concessão, mês, privacidade e failure modes.
4. Reexecutar testes oficiais, compile, Electron e QA financeiro no **SHA da integração**. Sem prova integrada, manter `NOT_HOMOLOGATED`.

## Governança e autorização
- **Integrador:** único responsável pela alteração de `app/app.js`, integração Electron/IPC, aprovação de contratos e reconciliação de PRs. Executor visual não modifica backend I2-A; Executor I2-A não sobrescreve src/CSS.
- Não fazer merge `main`, gerar EXE/Windows CI pago, Cloudflare Production, publicar app, usar API paga ou enviar dados pessoais a modelo externo, nem habilitar escrita financeira pessoal pela IA.
- **Entrega obrigatória:** PR/branch/HEAD por gate, logs reais com comando/exits, matriz PASS/FAIL/NOT_RUN, capturas Electron com hashes, regressões corrigidas, cobertura financeira, contrato aceito e decisões do Arquiteto. Falha de ambiente deve ser reportada, não escondida.

**Próxima ação:** Integrador executar Gate A no checkout real. Não iniciar D03 antes de handoff aprovado do Designer.


</details>


---

## Issue #74 — [EXECUTOR D05 / 1º EXE — BLOQUEANTE] Implementar tela V1.3 aprovada + 14×61/67 SVGs em SQLite/IPC/Electron com QA

**URL:** https://github.com/JoaoVittorLi/meu-financeiro/issues/74

<details><summary>Abrir descrição original preservada (histórica)</summary>

## DECISÃO MAIS RECENTE — D05 NO PRIMEIRO EXE / DESIGN TOTALMENTE APROVADO (13/11/2026)

**O proprietário aprovou a tela D05 V1.3 completa**, mantendo aprovados e congelados os **14 pais, 61 filhos e 67 SVGs**. **D05 faz parte do escopo obrigatório do PRIMEIRO EXE experimental**, substituindo qualquer corte anterior que a deixava para depois. A issue **#74 continua ABERTA E BLOQUEANTE** até implementação E1 SQLite/migração, E2 IPC/serviços/regras/IA e E3 Electron UI + QA reais. Não encerrar com somente HTML/CSS/docs.

**Fonte visual canônica:** [pacote de design PR #57](https://github.com/JoaoVittorLi/meu-financeiro/pull/57) · [protótipo aprovado](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/screens/d05-movimentacoes/prototype.html) · [handoff completo](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/screens/d05-movimentacoes/HANDOFF.md) · [QA](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/screens/d05-movimentacoes/ACCEPTANCE.md). Partir da RC [#76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), revalidar SHA e ownership [#49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49) antes de editar. Coordenar com Integrador; não fazer merge main, migração de banco pessoal, CI/build Windows sem autorização.

**Estado correto:** DESIGN_APPROVED / IMPLEMENTATION_READY; CODE_NOT_IMPLEMENTED / DB_MIGRATION_NOT_RUN / ELECTRON_QA_NOT_RUN / EXE_NOT_READY.

---

## ✅ Aprovação integral do proprietário — 13/11/2026

> “Você mandou muito bem nas categorias e subcategorias! Muito bem mesmo! 100% aprovadas. Lembre de avisar no git que precisa ser criado essas subcategorias no código, e relata os erros q vc mesmo encotrou.”

**CONGELADO (design):** 14 categorias principais, **61 subcategorias**, identidade por ícone/fundo tonal, registry de **67 SVGs** e vinculação pai → filho. Não bloquear E1/E2/E3 pedindo mais aprovação visual para os mesmos componentes. Se QA encontrar defeito, corrigir sem desmontar a direção aprovada.

**Aprovação visual ≠ produto pronto:** **obrigatório** implementar verdadeiramente no Electron/React/SQLite. Esta issue #74 continua **ABERTA E BLOQUEANTE** até migração, CRUD, serviços/IPC, bancos/manual/splits/regras/planejamento/orçamentos, IA autorizada, sync/backup e QA reais. **Não** entregar somente prompt, JSON, HTML, SVG, CSS ou relatório.

**Relatório técnico preciso:** [C01–C06: lacunas confirmadas na baseline + V01–V03: falhas visuais observadas no protótipo + QA não executado](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/screens/d05-movimentacoes/BUG_REPORT_AND_IMPLEMENTATION_GATES.md). Os defeitos de contraste foram observados na **captura do protótipo**, não confirmados no Electron; a ausência de subcategorias/IPC foi confirmada na **branch base PR #54**, não inspecionada em todas as branches paralelas.

**Taxonomia aprovada:** [14×61](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/screens/d05-movimentacoes/SUBCATEGORY_TAXONOMY_V1.json) · [SVGs](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/screens/d05-movimentacoes/SUBCATEGORY_SVG_REGISTRY_V1.json) · [contrato obrigatório](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/screens/d05-movimentacoes/SUBCATEGORIES_IMPLEMENTATION_CONTRACT.md) · [handoff E1/E2/E3](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/screens/d05-movimentacoes/SUBCATEGORY_EXECUTOR_HANDOFF.md) · [QA isolado](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/screens/d05-movimentacoes/SUBCATEGORY_QA.md).

**Sequência exigida:** E1 — migração aditiva/backup + IDs de pai/filho; E2 — APIs/IPC/regras/IA/permissões; E3 — interface real + verificação Electron + 630+ transações sintéticas. Reportar branch, SHA, PR, PASS/FAIL/NOT_RUN e bloqueios. **Não fechar issue sem código funcional.**

---

# D05-SUBCAT — IMPLEMENTAÇÃO OBRIGATÓRIA DE SUBCATEGORIAS NO CÓDIGO (não apenas design)

**Status:** `DESIGN_APPROVED / ENGINEERING_BACKLOG / BLOCKER_FOR_D05_COMPLETION` · **14 categorias, 61 subcategorias e ícones 100% APROVADOS (13/11/2026)** · **Código ainda não implementado.** Issue de Design #70 · Coordenação #49 · Roadmap #55.  
**Solicitação explícita do proprietário:** criar ícones para subcategorias vinculadas às categorias e **garantir que elas sejam mapeadas e criadas no código**. Uma tela bonita sem persistência, migração, regras, filtros, IA e testes **NÃO satisfaz esta missão**.

**Fonte de design:** [Taxonomia com 14 categorias e 61 subcategorias propostas](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/screens/d05-movimentacoes/SUBCATEGORY_TAXONOMY_V1.json). **Catálogo visual aprovado 100% pelo proprietário em 13/11/2026**, mas ainda **não existe migração executada** na branch de design.

## Estado real auditado (PR #54, `feat/mf2-premium-productivity-sprint-20261112`, HEAD histórico `55de81c`)

- `electron/db.cjs`: `categories(name PRIMARY KEY COLLATE NOCASE, color, built_in, emoji, kind)` — **sem subcategoria nativa**.
- `transactions(profile, id, date, kind, amount_cents, category, ...)`, `budgets(profile, category, amount_cents)`.
- `category_rules(category TEXT REFERENCES categories(name))`, `bank_category_overrides(category TEXT)`, `bank_transaction_splits(category TEXT)`, `planned_items` (quando presente).
- `upsertCategory` renomeia explicitamente a categoria em várias tabelas; `deleteCategory` impede exclusão em uso; `listCategories` retorna categorias/regras planas.
- `electron/preload.cjs` / `electron/main.cjs`: IPCs `categories:save`, `rules:save`, `bank:categorize`, `bank:batch`, `bank:split`; **nenhuma API de subcategorias encontrada nesta base**.
- `src/app.ts`: `CategoryInfo` por nome/cor/emoji/tipo, `RuleInfo` por nome de categoria. `EMOJI_OPTIONS` usa Unicode do SO; refatorar para `iconKey` com SVG local.
- PRs posteriores podem ter alterado arquivos. **Antes de editar, consultar HEADs atuais e reconciliar integrações recentes.**

## CHECKPOINT E1 — SQLite / migração SEM PERDA

- [ ] Criar **ID estável de categoria** (sem quebrar nomes e vínculos antigos) e tabela `subcategories(id, parent_category_id, name, icon_key, hue/accent, kind, active, sort_order, timestamps)` com FK e unique `(parent_id, normalized_name)`.
- [ ] Chave de categoria é identificador imutável; renomear pai não move filhos nem quebra regras. Dois níveis apenas; proibir ciclos/orfandade.
- [ ] Adicionar referências opcionais de subcategoria em **movimentações manuais**, overrides bancários (sem alterar fonte Pluggy), splits, regras e planejamento; orçamentos por categoria continuam somando filhos sem duplicar totais.
- [ ] Migração idempotente e atômica, backup primeiro. **Todos os registros antigos devem permanecer com subcategoria = null**; jamais adivinhar a classificação, reescrever movimentos bancários, perder overrides/links/parcelas, ou converter registros reais em fixtures.
- [ ] Sem excluir categoria-pai que possua filhos/uso. Exclusão/movimentação de filho exige preview de impactos e reatribuição confirmada, não cascata silenciosa.
- [ ] Backup/restore JSON, SQLite legacy e perfis `real/demo`; considerar contratos de sync Desktop/Cloud/PWA com versão e compatibilidade progressiva.

## CHECKPOINT E2 — Serviços, regras, IA e IPC

- [ ] CRUD de subcategoria com nome, ícone e tonalidade, categoria-mãe obrigatória, validação de duplicata dentro do pai, sem duplicidade por acento/case.
- [ ] `categories:list` / `subcategories:list/create/update/move/delete` (nomes exatos a decidir no código) com validação no **main process**; renderer nunca recebe SQL.
- [ ] Categorização banco/manual usa par coerente `{categoryId, subcategoryId|null}`. `subcategoryId` deve pertencer a `categoryId`; troca de categoria limpa ou pede novo filho, nunca mistura pais diferentes.
- [ ] Regras automáticas podem ter **destino pai + filho** e conferência de affected IDs/previewVersion; resolução/precedência auditável; não ativar escrita por IA no perfil pessoal por causa desta entrega.
- [ ] Batch edit, splits (totais em centavos), import CSV, Planning/Orçamentos, drill-down, agrupamentos e relatórios respeitam subcategoria e agregação da mãe. Transfer/ignore continuam fora de E/S, sem desaparecimento do histórico.
- [ ] IA IC-READ: ler taxonomia/valores autorizados; IC-CATS/IC-RULES: propostas de criar/editar filhos e regras **somente mediante preview, permissões e reconfirmação**. Não fingir recibo.

## CHECKPOINT E3 — Design System / UI D05 + regressão

- [ ] Criar **biblioteca vetorial local** e `iconKey` com fallback consistente; cada subcategoria possui seu próprio glyph/fundo tonal, herda a família da categoria; **sem emoji Unicode nativo** no novo fluxo.
- [ ] D05: seletor hierárquico pai → subcategoria, busca, favoritos/recente opcional, escolher categoria sem filho, editar no detalhe, seleção em lote, filtro pai/filho, breadcrumb visual, lista e resumo.
- [ ] Todas outras telas que exibem categorias (D01 chat lateral, D02 resposta IA, D03 Hoje, D04 Revisão, Planejamento, Orçamentos, Contas, Simulador) usam IDs/tokens e não exibem nomes planos quebrados.
- [ ] Valores: entrada verde `--green`, saída vermelha `--red`, transferência neutra; **cor do fundo de ícone nunca representa fluxo financeiro**. Contraste AA dark/light e reduced-motion.
- [ ] QA Electron 1366×768 e 1920×1080 dark/light; clique de todos os botões, teclado/foco, scroll e mobile quando PWA for retomada.

## GATES NEGATIVOS OBRIGATÓRIOS

- [ ] Migração sobre SQLite legado com 630+ movimentações e backup/restore reproduzível sem perder dinheiro ou identificadores (dados de teste, não dados pessoais do proprietário).
- [ ] Renomear categoria-pai preserva filhos/regras/movimentos. Renomear filho preserva IDs. Duplicação dentro do mesmo pai bloqueada; mesmo nome em pais diferentes é permitido quando apropriado.
- [ ] Trocar pai sem trocar filho compatível → erro ou subcategoria limpa após confirmação; nenhuma associação cruzada.
- [ ] Registros antigos `subcategoryId = null` continuam válidos e agregados em `Sem subcategoria` (estado nulo, **não** criar subcategoria fake como ID).
- [ ] Atualizar splits, lotes e regras mantém soma em centavos e fonte da verdade; conciliação 630×632 não regressiva.
- [ ] Perfis `demo/real`, concessões IC e consentimentos existentes preservados.
- [ ] Renderização continua com fallback de ícone para categoria custom sem `iconKey`; nada invisível dark.

## ENTREGA E CRITÉRIO DE FECHAMENTO

**Obrigatório** abrir PR de **código funcional** com branch/SHA, migração SQLite, IPC/serviços, types, testes unitários e integrados, Electron screenshots e resultados PASS/FAIL/NOT_RUN. Finalizar E1/E2/E3 em checkpoints sem bloquear trabalho de Design.

**PROIBIDO fechar issue como concluída** se houver só protótipo, CSS, JSON, prompt, relatório ou documentação. Sem merge em `main`, build pago CircleCI ou EXE sem autorização do proprietário. Proprietário executa os preflights CircleCI quando coordenados pelo Integrador, mediante branch/SHA/parametrização exatos.

**Próximo passo do Integrador:** atribuir Executor dedicado ao backend/migração (E1), alinhar com os responsáveis pela Inteligência/Categorias (E2) e UI D05 (E3). Atualizar #70 e #49 sem declarar D05 aprovada antes do aceite visual.

</details>

