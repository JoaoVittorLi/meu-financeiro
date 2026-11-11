# Meu Financeiro 2.0 — Plano integrado pós-auditoria ARGON, identidade MF e próximas entregas

**Data:** 11/11/2026 · **Natureza:** Rodada A (diagnóstico e especificação de produto; NÃO implementação nem homologação)  
**Responsável:** Chat Arquiteto · **Revisão-base verificada:** \`d513c2be3f9b0cd018aed0b71f46ce8747a6556c\`  
**Staging:** \`feat/mf2-beta8-premium-staging-20261110\` / PR #31 (draft) · **Design Premium:** A-D1 a A-D6 integrados via PR #34.  
**Origem da pesquisa:** pacote ARGON/Antigravity fornecido pelo proprietário, auditado em 10–11/11/2026 (13 relatórios, screenshots e artefatos complementares), observações visuais do proprietário sobre hover e três referências PNG da nova marca MF, mais inspeções direcionadas de código e CI do GitHub. **Esses arquivos de origem não estão integralmente publicados neste PR.**

> **Status global:** RECOMENDAÇÕES/ANÁLISE; não promover \`CURRENT_STATE.md\`, gates de release, versões ou status de implementação sem testes e integração verificados. Este plano detalha o que fazer, não afirma que já está feito.

## 1. Estado comprovado e limites da auditoria

- O GitHub registrou **\`preflight_linux=success\` e \`build_windows=success\`** para o SHA de referência \`d513c2be\` (workflow CircleCI \`224dd574-a058-442a-8df0-05caa892f114\`). PR #31 permanece draft na staging; **não há promoção automática para \`main\` ou Production**.
- O Argon relatou execução real do EXE Windows e análise do app.asar, 32 capturas da matriz, 10 verificações funcionais no binário, resultados 270/271 da bateria que executou, um catálogo detalhado de **BUG-01…BUG-10** e **18 ideias** em seu laboratório. A credibilidade é maior que a de inspeções apenas estáticas, mas o pacote contém divergências: 85 imagens declaradas vs. 95 PNG no material recebido, diferentes totais de cards/bugs em seus resumos, e metadados incompatíveis para o EXE em documentos distintos. Corrigir essas divergências na errata, não transportar números incertos para um gate.
- **Fato técnico adicional:** o relatório sugere conectar \`buildLocalBriefing(snapshot)\` já existente. Na inspeção direta do SHA auditado não foi encontrada essa função em \`src/intelligence-integration.ts\`, \`src/intelligence-view.ts\` ou \`src/app.ts\`; o radar deverá ser especificado/implementado/testado, não tratado como ligação pronta.
- **Regressão identificada pelo proprietário:** alguns cards ganham contorno cinza quando passam por hover, inclusive cartões com superfície já cinza. O código contém \`.u1-metric:hover\` e \`.u2-metric:hover\` com \`border-color: var(--subtle)\`. É problema de coerência de interação, não necessariamente falha lógica.
- O projeto possui motores determinísticos em centavos e salvaguardas já estabilizadas: orçamento zero ≠ ausente; saldo desconhecido ≠ zero; fontes manuais/bancárias separadas; sem duplicatas bancárias; backup e restauração; necessidade de evidências antes de cutover.
- **Segurança de repositório:** o conector GitHub reportou o repositório com visibilidade **public**, em divergência com vários documentos que dizem "privado". Confirmar se é intencional e revisar higiene de segredos no processo de segurança; sem assumir vazamento ou alterar visibilidade sem autorização.

## 2. Direção de identidade visual MF (imagens fornecidas pelo proprietário)

A referência adotada é o **monograma geométrico MF**, com linhas entrelaçadas/diagonais ascendentes e degradê verde-esmeralda → menta; fundo marinho profundo; wordmark "Meu Financeiro" branco/escuro e cinza secundário. Variantes fornecidas: lockup horizontal, estudo geométrico, ícone Windows, ícone mobile, aplicação em fundos claro/escuro e monocromática.

**Diretriz de criação:** usar os PNGs como **briefing visual**, não como arquivo vetorial final, nem converter automaticamente o desenho em um SVG impreciso. Obter/produzir ativo vetorial original aprovado (viewBox, espessura, cantos, margens, optical sizing e versões monocromáticas). Confirmar números de cores diretamente em arquivo de origem; cores lidas da imagem raster são aproximações. A indicação "Meu Financeiro Sans" é conceitual até existir fonte licenciada/arquivo de família apropriado; fallback confiável: Segoe UI Variable / fontes do design system.

### ID1 — Inventário e implementação da marca
- Inventariar o estado do branding nas rotas: sidebar, topbar, splash/loading, login/empty states, Configurações/Sobre, diálogos, About e documentos; Windows \`build/icon.ico\`, instalador NSIS, arquivos Portable, atalhos/Explorer/taskbar e eventuais assets do Electron; PWA (manifest, ícones 192/512, máscara, splash/favicon, cor de tema e navegador). **Verificar paths reais antes de alterar**.
- Criar *single source of truth* de logo/ícones com exportações específicas (16/20/24/32/48/64/128/256 Windows, 192/512 e \`maskable\` PWA), margem de segurança e alinhamento óptico; versões legíveis monocromáticas, em claro/escuro e em alto contraste. Não empacotar arquivos de fonte proprietários sem licença.
- Tokens: \`--brand-*\` em um lugar, separados de tokens funcionais \`--positive\`, \`--negative\`, \`--warning\`, \`--neutral\` e de paleta de categorias. O verde **não pode sinalizar todo tipo de informação indiscriminadamente**.
- Critérios: miniaturas 16–32 px legíveis, ausência de serrilhado e clipping; aplicação coerente no instalador, EXE, taskbar/atalhos, PWA install; manifest válido, alternância de tema, temas claros/escuros e DPI 100/125/150%; screenshot antes/depois; hashes e executáveis recompilados na revisão final.
- **Ownership:** Argon cria/refina identidade e assets originais; Executor implementa no Electron/empacotamento/PWA em branches isoladas; Arquiteto aprova o logotipo final. **Não ativar deployment PWA Production só por trocar ícone**.

### A-D7 — Consolidação do design system e microinterações
- Remover vazamentos reais de roxo antigo em \`app/style.css\`, \`src/plan-view.ts\`, fallback de categoria em \`src/app.ts\`, valores padrão em \`electron/db.cjs\`, sem substituir indiscriminadamente cores personalizadas gravadas pelo usuário. Diferenciar cor de marca da cor semântica por categoria.
- Unificar tipos de ícones para componentes da interface (vetoriais, alinhamento e stroke padronizados). Se emojis representarem **dados personalizados pelo usuário**, preservar sem mudança destrutiva e apresentar fallback/representação visual segura.
- Revisar \`u1/u2/u3\`/refinement como camadas; consolidar tokens gradualmente com regressões, **não apagar \`app/style.css\`** antes de análise de dependências.
- **Hover v2:** cartões *acionáveis* recebem elevação leve (\`translateY(-2px a -4px)\` + opcional \`scale(1.008–1.015)\`), sombra discreta e contorno coerente; cartões informativos não simulam ação e não ganham \`cursor:pointer\` falso; nenhuma mudança cinza chapada sobre fundo cinza. Duração de referência 180–240ms, easing de saída suave, \`prefers-reduced-motion\`, \`:focus-visible\`, estados \`active\`, \`disabled\`, contraste, animação sem layout shift, sem clipping em grid/overflow; testar foco/hover em oito áreas e modais.
- Corrigir drawer de detalhes tema claro (contrast ratio alvo WCAG AA para texto, checado contra cores computadas), temas escuro/claro e regra de leitura de gráficos e tooltip.
- Critérios: capturas comparáveis \`before/hover/focus/after\`, movimento normal e reduzido, 1366×768 e 1920×1080, testes de mouse/teclado/touch, sem regressões de contraste e sem CSS conflitante.

## 3. Roadmap integrado — ordem recomendada, dependências e critérios de entrega

**Regra:** este plano organiza *subentregas completas*. Não são datas prometidas, custos garantidos, nem autorização para fundir todas as mudanças num release. Cada fatia exige código + testes + log + atualização \`docs/ROADMAP_MF2.md\` na **mesma PR de implementação**.

| ID | Etapa | Dono principal | Depende de | Gate |
|---|---|---|---|---|
| G0 | Conferência de baseline, errata ARGON, recuperação e segurança de branch | Arquiteto + Executor | PR #31/CI + fontes auditoria | Consistência documental, reprodutibilidade |
| D1.5-F | CRUD seguro de movimentação manual e regressões | Executor | G0 | Fluxos editar/excluir reais, persistência |
| D1.5-V | Drawer claro/escuro e gráfico Planejamento | Executor + revisão Argon | G0 | Contraste e imagens reais |
| A-D7 | Hover Premium, cores legadas, ícones e CSS sustentável | Argon (direção), Executor (integração) | D1.5-V / ownership | Matriz visual |
| ID1 | MF logo, assets Windows, app shell e PWA Preview | Argon + Executor | source SVG aprovado | Assets e instalador testados |
| U5 | Eficiência operacional: Movimentações, Planejamento, Orçamentos, Configurações | Executor | D1.5-F, A-D7 | Jornadas, regressões |
| I1 | Nova arquitetura de Inteligência + Radar local determinístico real | Argon + Executor | G0, contratos de dados | Dados reais autorizados, sem demo enganosa |
| F1 | Dashboards de decisão, saldos e contas, novos cards | Executor | I1 dados/contabilidade, U5 | Fórmulas e fontes auditadas |
| I2 | Chat financeiro contextual, respostas visuais, permissões | Executor com Argon | I1 | Modelo/privacidade/teste real |
| F2 | Simulador Pix × parcelamento/CDI e recursos brasileiros | Executor | F1 / motor simulação | Precisão e cenários adversos |
| I3 | Copiloto transacional com diff, confirmação, undo auditável | Executor + Arquiteto | I2 + invariantes | Sem escrita não autorizada |
| P1-PWA | Paridade gradual Windows/PWA, dados, backup/sync | Executor cloud | Domínio estável, autorização | Comparação, conflito/rollback |
| R1 | Candidata Windows Premium e homologação | Executor CI + Arquiteto | Gates das subentregas escolhidas | Electron + EXEs + hashes + instalação |

### G0 — Base reproduzível e controle de risco (antes de novos merges)
**Mudanças:** validar SHA da staging e CI já existentes; reconciliar diferença de release/EXE da auditoria; corrigir inventários e scorecard do Argon (nota 7,48 não reconstruível sem penalidade documentada; fórmula por oito áreas difere); confirmar status do banco e backup sintético; verificar visibilidade GitHub e ausência de segredos; inventariar assets reais de branding. Não reabrir auditoria geral.
**Aceite:** checklist de evidências, SHA, scripts, bloqueios identificados; se algo não foi testado, rotular NÃO VERIFICADO.

### D1.5-F — Correção que o usuário sente imediatamente
**Movimentações:** habilitar editar descrição/data/valor/tipo/categoria e excluir **somente lançamentos manuais** na interface, com validação de centavos, confirmação de exclusão, cancelamento, estados de erro, recomputação de KPIs/orçamentos/planejamento e reload. Preservar imutabilidade do lançamento bancário bruto, IDs, links e operações atômicas.
**Aceite:** testes negativos e positivos em SQLite sintético, UI real com teclado, fechamento/reabertura, backup/restore; contas bancárias não modificadas. Sem prometer "edição completa" de extratos bancários.

### D1.5-V — Integridade de superfícies, temas e gráficos
**Movimentações/Planejamento:** corrigir contraste do drawer \`.mf-detail-section\` e hero e demais estados light; substituir cores roxas hardcoded do \`pTimeline\` por tokens semânticos; corrigir flash de fundo Electron se reproduzido. Não alterar matemática dos gráficos.
**Aceite:** temas claro/escuro, gráficos legendados, ratio de contraste AA, screenshots com drawer real e smoke.

### A-D7 + ID1 — Remake finalizado como produto consistente
**A-D7:** categorias vetoriais sem romper personalização, CSS legado sob controle, hover/press/focus/reduced motion coerente; sem efeitos excessivos em KPIs sem clique. **ID1:** logo MF, wordmark, app icons, splash, configurações e PWA Preview.
**Aceite:** inventário de todos os componentes e assets substituídos com screenshot pequeno/grande; bundles não regredidos; marca sem pixelização; comparar tema claro/escuro.

### U5 — Produtividade e fluidez diária
- **Movimentações:** popover inline para categorização, edição rápida, revisão em lote, filtros categoria/tipo, densidade compacta 1366×768, seleção preservada entre operações quando seguro; métricas de cliques/linhas visíveis.
- **Planejamento:** remover apresentação duplicada de Projeção diária *sem perder função*, calendário com valores contextualizados, timeline/crosshair acessível; situação de compromisso confirmado/incerto sempre clara.
- **Orçamentos:** melhorar editor lateral com histórico e contexto, diferenciação entre limite 0 e limite ausente, ações rápidas de realocação com validação de saldos; preservar motor de pace.
- **Configurações:** corrigir select tema controlado, integrar exportação CSV já existente, suprimir textos internos (\`U3\`, \`E1\`, \`Entrega 2\`), organizar Backup/IA/Sync por linguagem de usuário.
- **Simular compra:** evitar apagar resultado a cada digitação. Pode marcar resultado como "desatualizado" até recomputar; não exibir números obsoletos como válidos.
**Aceite:** jornadas cronometradas com dados sintéticos, acessibilidade por teclado, sem inconsistência entre visual e estado persistido.

### I1 — Inteligência como prioridade de produto, não apenas skin
**Redesenho da página:** Argon produzir três propostas reais (Chat Premium, Central Inteligente, Copiloto integrado), selecionar uma fundamentada, desenhar estados claro/escuro, histórico, campo de mensagem, chat longo, respostas com gráficos/tabelas e interação entre abas.
**Radar determinístico:** desenvolver um *read model* local seguro a partir de dados autorizados, com cartões \`Hoje\` de próxima obrigação, categoria em risco, recorrências e tendências, cálculo em centavos, data/fonte visíveis, nulidade/ausência respeitadas, explicação e confiança; quando nada puder ser calculado, renderizar estado honesto, não cards \`R$ 342/R$ 1.240/R$ 89,90\` fictícios com aparência de dados reais.
**Aceite:** fixtures reais sintéticas, 0 vazamento de dados, "dados incompletos" em vez de número inventado, telas visualmente aprovadas, sem requerer API de IA para cálculos determinísticos. **Não assumir \`buildLocalBriefing\` pronta**.

### F1 — Informações que ajudam decisões (sem inflar dashboard)
- **Visão Geral:** investigar substituir/condicionar cards repetitivos por \`Livre até o próximo recebimento\`, \`Previsão de fechamento\` e \`Pior dia\`; indicar janela, origem, contas inclusas, cenário, estimativas, incertezas e faltantes. Se saldos ou datas são insuficientes, não fabricar "livre".
- **Orçamentos:** barra de realizado + agendado *não duplicado*, pin de ritmo do mês, alerta nominal e editor com histórico.
- **Minhas contas:** contas manuais e override explícito de saldo apenas com origem/tempo e auditoria; distinção entre liquidez, fatura/cartão e patrimônio; não somar dívida como dinheiro disponível.
- **Movimentações:** raio-X por estabelecimento com total/média/ocorrências *sem assumir merchant IDs perfeitos*.
**Aceite:** contrato de cálculo por fonte, testes extremos, reconciliação manual/banco, transparência e datas.

### I2/I3 — Chat útil e ações seguras em etapas
- **I2:** conversa verdadeira (não só "preparar pergunta"), resposta progressiva, contexto por módulo com seleção explícita de fonte/período, gráficos/table cards, citações ao dado interno e ausência de logs sensíveis. Definir autenticação/autorização, limites/custos e fallback independente; **não presumir que plano ChatGPT garante API gratuita**.
- **I3:** a IA apenas **propõe** operação com \`before→after\` e ID/versão do snapshot; confirmação contextual, validadores contábeis determinísticos, atomicidade/idempotência, conflito de revisão, recibo auditável e undo condicional seguro. Nunca alterar dados bancários brutos, apagar histórico ou aceitar operações em silêncio.
**Aceite:** testes de erro, negação, conflito, permissão revogada, rollback e trilha de auditoria.

### F2 — Diferenciação brasileira em compras e planejamento
- Simular **Pix com desconto × parcelamento** levando em conta taxas reais, impostos do rendimento CDI, capitalização/prazo, custo total, liquidez e **pior dia de caixa**; cenário "comprar agora/depois", antecipação de parcelas, solver reverso de parcela máxima e metas relacionadas.
- Janela por ciclo de salário e provisões sazonais (IPVA, IPTU, material escolar, 13º), detecção de reajuste recorrente com falsos positivos controláveis, eventual command bar \`Ctrl+K\`/atalhos com discoverability.
**Aceite:** matemática e hipóteses explicadas; resultados não equivalem a aconselhamento de investimento personalizado.

### P1-PWA / R1 — Paridade, segurança e release
- Windows e PWA compartilham regras financeiras, não apenas aparências; Preview protegido, sem cutover por acidente. Critérios: identidades/IDs, saldos as-of, categorias, cents/datas, conflitos, offline, backup/restore e autenticação; somente após isso avaliar sync canônico.
- Build Windows no SHA aprovado: \`npm ci\`, \`npm run test:types\`, \`npm run test:db\`, \`npm run compile\`, F08, ASAR, Electron GUI 32 estados e testes direcionados pós-bug, NSIS/Portable e \`SHA256.txt\`; teste instalação isolada e rollback. Evitar pipelines redundantes. Deploy PWA Production exige gate separado.

## 4. Decisão por página — remover, manter, acrescentar

| Página | Manter | Refinar/reorganizar | Ideias candidatas (NÃO todas simultâneas) |
|---|---|---|---|
| Visão Geral | KPIs, separação de fontes, leitura editorial | barras de categoria, drilldown, densidade e hovers | \`Livre até recebimento\`, fechamento/pior dia, alerta de categoria |
| Movimentações | histórico/revisão, filtros existentes, conciliação | CRUD manual, drawer, densidade e edição rápida | popover inline, raio-X de merchant, triagem teclado |
| Planejamento | calendário e motor diário | gráfico roxo, UI duplicada, drawer, leitura em 1366 | ciclo salarial, compromissos futuros, marcadores de confiança |
| Orçamentos | pace e regras de categoria | cards/catálogos de emojis, editor quase vazio | barra realizado/agendado, histórico 3 meses, realocação |
| Minhas Contas | transparência Pluggy e saldos datados | redundâncias e semântica de saldo | liquidez vs dívida, contas manuais, rastreabilidade |
| Simular compra | A/B, pior dia, veredito determinístico | preservação do resultado e hover | duelo Pix/CDI, melhor data, parcela segura |
| Inteligência | contextos, proteção de demo e prévia | **refazer hierarquia/chat/Hoje/Ações** | radar local, chat gráfico, plano de ação com aprovação |
| Configurações | backup, aparência, diagnósticos | rótulos internos, select tema, divisão de grupos | privacidade IA, exportação CSV, sobre e identidade MF |

## 5. Organização de agentes e branch ownership

- **Arquiteto:** prioriza, mantém o roadmap e integra gates. Esta PR é **documental**; não vai para \`main\` sem revisão.
- **Executor 2:** implementação D1.5-F/V, testes financeiros, integração e build. Branch própria após inspeção de HEAD; editar \`src/app.ts\`, \`src/plan-view.ts\`, SQLite, tests e CI dentro do escopo, sem alterar CSS concorrente sem coordenação.
- **Argon:** identidade MF, tokens de design, ícones, motion, mockups I1 e padrões visuais; CSS em branch sua, com handoff/ownership claro.
- **Antigravity Windows:** teste de EXE/Portable em perfil isolado, screenshots reais antes/hover/depois e após release, automação CDP quando útil; não modificar os mesmos arquivos do Executor simultaneamente. Pode receber tarefa de código apenas numa branch/worktree própria e sob ownership exclusivo.
- **PWA/cloud:** separado do ciclo Windows, sem deploy decorrente de CI desktop.
- Novo executor deve ler este documento e os handoffs antes de trabalhar. Atualizar na própria PR código + documentação + evidências e retornar SHA/arquivos/testes.

## 6. Métricas de aceitação (não substituir por nota estética subjetiva)

1. **Cobertura funcional:** zero jornadas essenciais de manual CRUD/backup/restore com erro reprodutível no build-candidato.
2. **Visual:** sem blocos de texto ilegíveis (contraste WCAG AA), sem cortes 1366×768; matriz 32 screenshots reais + capturas de drawer/hover/focus não cobertas pela matriz.
3. **Marca:** símbolo visível/legível nos tamanhos de destino e versões claro/escuro, SVG original + ico/maskable, preview em Windows/PWA sem publicar Production.
4. **Interação:** cards acionáveis têm foco/hover coerente e sem falsas affordances; sem motion indevido em \`reduced-motion\`.
5. **Finanças:** zero alterações em dados reais; todas as operações teste em bancos sintéticos, centavos exatos, saldo ausente continua ausente, sem somar duplicidade.
6. **IA:** nenhum dado fictício disfarçado de análise real; prévia e confirmação explícitas para ações; trilha verificável.
7. **Release:** CI e artefatos comprovados no **mesmo SHA**, hashes e instalação isolada; sem promoção automática à main ou PWA.

## 7. Dependências, decisões em aberto e errata obrigatória

- **Fontes de branding:** fornecer SVG/arquivo de criação ou autorizar desenho vetorial final; só PNG não garante fidelidade geométrica de ícones pequenos.
- **Auditoria ARGON:** solicitar errata do número real de PNGs, contagem de cards e bugs, cálculo da nota, metadados conflitantes do EXE e provas dos hashes/ASAR; não reinspecionar indiscriminadamente todas as páginas.
- **Inteligência:** fazer discovery funcional e API/serviço antes de prometer chat financeiro com escrita; protótipo real em fixtures e permissões.
- **Prioridade de implementação:** D1.5-F e D1.5-V primeiro; A-D7 e ID1 depois de assets aprovados; I1 (alta prioridade estratégica) pode ter *design discovery* em paralelo sem tocar em código do Executor.
- **Segurança:** verificar se \`public\` no GitHub é desejado; não expor segredos, logs bancários, arquivos pessoais ou tokens nesse PR.

## 8. Referências internas

- \`docs/ROADMAP_MF2.md\` — roadmap mestre; este documento é **complemento pós-auditoria**.
- \`docs/ai-context/CURRENT_STATE.md\`, \`ACTIVE_WORK.md\`, \`EXECUTOR_HANDOFF.md\`, \`TESTING_AND_RELEASE.md\`, \`ROADMAP_UPDATE_RULES.md\`.
- PR #31 (candidata) · PR #34 (integração Premium).
- CI sucesso no SHA base: [Linux](https://app.circleci.com/workflow/224dd574-a058-442a-8df0-05caa892f114/job/bb6671d9-8452-4c47-96a5-4b0bf65a9752) / [Windows](https://app.circleci.com/workflow/224dd574-a058-442a-8df0-05caa892f114/job/552ffb92-bce6-4829-8985-76a3fc1ddafa).
- Auditoria local ARGON/Antigravity (13 relatórios, evidências, scorecard, roadmap de Ondas 0–3, A1); novas imagens da marca MF encaminhadas pelo proprietário em 11/11/2026.

**Não confundir um roadmap documentado com uma mudança implementada.** Revalidar HEAD antes de qualquer execução.
