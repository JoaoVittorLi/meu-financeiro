# Meu Financeiro 2.0 — Sequência oficial de revisão de Design
Data: 2026-11-13 · Índice: #55 · Coordenação: #49 · Baseline PR #54 / 55de81c03c3171edd0b325eb66d63630018c23c4.

| Ordem | Tela | Estado | Issue | Versão |
|---|---|---|---|---|
| D01 | Chat Lateral | **IMPLEMENTATION_READY** (DESIGN_APPROVED) | #56 | **V4.5 FINAL** · protótipo/specs/handoff congelados |
| D02 | Chat Principal / Expandido | **DESIGN HANDOFF V3 CONSOLIDADO** (implementação pendente) | #58 | Biblioteca de 26 famílias especificada por herança; 3 aprovadas individualmente, VR-10 V2 referência; sem mais microscreens |
| D03 | Inteligência Hoje | **IMPLEMENTATION_READY** (DESIGN_APPROVED) | #61 | **V2 FINAL** · cartões premium uniformes + prioridades dinâmicas · HTML/spec/QA/handoff publicados; Electron pendente |
| D04 | Central de Revisão | **IMPLEMENTATION_READY** (DESIGN_APPROVED) | #67 | **V1.1 FINAL** · fila premium, edição persistente, escopos separados, reconfirmação; Executor #69, QA Electron pendente |
| D05 | Movimentações | **DESIGN_APPROVED / IMPLEMENTATION_READY (V1.3 FINAL)** · #74 E1/E2/E3 bloqueante | #70 | Tela completa, ícones 14×61/67 SVGs e interações premium aprovados; app/SQLite/QA ainda pendentes |
| D06 | Visão Geral | NOT_STARTED | — | — |
| D07 | Orçamentos | NOT_STARTED | — | — |
| D08 | Planejamento | NOT_STARTED | — | — |
| D09 | Simulador | NOT_STARTED | — | — |
| D10 | Minhas Contas | NOT_STARTED | — | — |
| D11 | Configurações | NOT_STARTED | — | — |
| D12 | Sistema visual global e fluxos compartilhados | NOT_STARTED | — | — |

Fluxo de estados: NOT_STARTED → CURRENT_UI_REVIEWED → PROTOTYPING → WAITING_FEEDBACK → DESIGN_APPROVED → IMPLEMENTATION_READY → IN_DEVELOPMENT → IMPLEMENTED → VISUAL_QA → HOMOLOGATED.

**V3 do chat:** base visual histórica aprovada; seu HTML original não foi recuperado. A D01 V4.5 é o design aprovado atualmente, sem alegação de equivalência pixel a pixel com a V3.

**D01 — aprovação do proprietário:** 13/11/2026, protótipo V4.4 com ajustes finais autorizados e consolidados na V4.5. A entrega oficial está no [pacote D01](screens/d01-chat-lateral/) do PR Draft #57. O código Electron não foi alterado; integração, UI real e escrita supervisionada permanecem pendentes.

Critérios para DESIGN_APPROVED: aprovação explícita do proprietário sobre versão exata. Critérios IMPLEMENTATION_READY: prototype.html reproduzível, specs, tokens, fixtures, acceptance, changelog e handoff publicados. O código de produção é responsabilidade do executor em branch separada. Nenhum build pago ou merge em main autorizado.


### D02 — Etapa 2 — Biblioteca Visual (histórico, 13/11/2026)

- **Estado:** `DESIGN_SPECIFIED / WAITING_FEEDBACK`, NÃO `DESIGN_APPROVED` e não implementado.
- **Escopo:** 26 famílias de respostas tipadas; `compact` lateral D01, `standard` principal D02, `analysis` workspace, `mobile` PWA; dark/light e 10 estados demonstráveis.
- **Fontes:** [Galeria HTML](screens/d02-chat-principal/VISUAL_GALLERY_STAGE2.html), [Design System](screens/d02-chat-principal/VISUAL_DESIGN_SYSTEM_STAGE2.md), [QA/estados](screens/d02-chat-principal/VISUAL_STATES_QA_STAGE2.md), [Evidências](screens/d02-chat-principal/VISUAL_STAGE2_ACCEPTANCE.md).
- **Gates seguintes:** aprovação visual do proprietário, contratos autorizados, implementação separada e QA Electron real. D01 V4.5 permanece intacta.

### D02 — V3 CONSOLIDADO · Entrega de design em lote (13/11/2026)

**Decisão do proprietário:** encerrar o loop de protótipos por microcomponente e aplicar o padrão premium aprovado às 26 famílias restantes; o próximo design é D03.

- **Status correto:** pacote `DESIGN_SYSTEM_SPECIFIED / HANDOFF_CANDIDATE` entregue; não há implementação Electron nem homologação global. A designação `DESIGN_APPROVED` só existe individualmente em VR-07 V2, VR-08 V1, VR-09 V1.1; VR-10 V2 é referência aceita para a consolidação; 22 famílias herdaram especificação, sem aprovação individual.
- **Entrega principal:** [D02 V3 — índice único](screens/d02-chat-principal/D02_V3_DELIVERY_INDEX.md), [galeria interativa V3](screens/d02-chat-principal/VISUAL_GALLERY_V3_CONSOLIDATED.html), [sistema visual](screens/d02-chat-principal/VISUAL_LIBRARY_CONSOLIDATED_V3.md), [tokens](screens/d02-chat-principal/VISUAL_LIBRARY_TOKENS_V3.json), [CSS referência](screens/d02-chat-principal/VISUAL_LIBRARY_PREMIUM_V3.css), [handoff](screens/d02-chat-principal/VISUAL_LIBRARY_HANDOFF_V3.md), [aceite/QA](screens/d02-chat-principal/VISUAL_LIBRARY_ACCEPTANCE_V3.md).
- **Progresso confirmado:** conteúdo da galeria V3 e JS sintaticamente validados, documentação versionada. **Não verificado:** screenshots Chromium dessa V3, testes de clique, QA Electron, integração e escrita financeira real.
- **Próximo item do roteiro:** [D03 — Inteligência Hoje, issue #61](https://github.com/JoaoVittorLi/meu-financeiro/issues/61). Rever D03 como **uma tela inteira**, sem ciclos de microcomponentes já padronizados; respeitar design principal leve, histórico recolhido e painel opcional.

### D03 — V1 Inteligência Hoje (histórico; superada pela V2)

- O estado atual de `src/intelligence-view.ts` contém oito cards operacionais com metadados UI-01–08. A V1 mantém a lógica como referência, mas redesenha a superfície inteira sem abas permanentes.
- [D03 V1 Design Spec](screens/d03-inteligencia-hoje/D03_V1_DESIGN_SPEC.md) · [Fixtures sintéticas](screens/d03-inteligencia-hoje/D03_V1_FIXTURES.json) · [Issue #61](https://github.com/JoaoVittorLi/meu-financeiro/issues/61).
- V1 não foi aprovada e foi substituída pela V2. O Electron ainda não foi implementado neste pacote.

### D03 — V2 FINAL APROVADA · 13/11/2026

**Aprovação explícita do proprietário** sobre a tela inteira D03 V2, identidade esmeralda compartilhada pelos cards e motor contextual de prioridades. Polimento final concluído e artefatos publicados em branch de Design:

- [Protótipo HTML reproduzível](screens/d03-inteligencia-hoje/prototype.html) · [Design Spec final](screens/d03-inteligencia-hoje/DESIGN_SPEC_APPROVED.md) · [Regras dinâmicas](screens/d03-inteligencia-hoje/BEHAVIOR_SPEC.md) · [Fixtures sintéticas](screens/d03-inteligencia-hoje/D03_V2_APPROVED_FIXTURES.json).
- [Aceite e resultados de smoke](screens/d03-inteligencia-hoje/ACCEPTANCE.md) · [Handoff Executor C1/C2](screens/d03-inteligencia-hoje/HANDOFF.md) · [Changelog](screens/d03-inteligencia-hoje/CHANGELOG.md).
- **Verificação executada:** sintaxe JavaScript e cenários de folga/aperto/insuficiência/margem curta, saldo indisponível, histórico revogado, limite zero e coverage parcial; sem smoke de navegador/Electron.
- **Polimento:** ajustar ordem da margem curta acima dos alertas secundários; não alterar cores de cartões por severidade, só valores/ícones semânticos.
- **Status:** `DESIGN_APPROVED / IMPLEMENTATION_READY`, produto `NOT_IMPLEMENTED`. Não merge/main/EXE/escrita financeira pessoal por esta aprovação.

**Próxima tela principal de Design:** D04 — Central de Revisão. O Executor pode implementar D03 em branch separada conforme contratos e QA; não bloquear o design D04 por build.

### D04 — Central de Revisão V1 (histórico, direção aprovada em 13/11/2026)

- [Issue de design #67](https://github.com/JoaoVittorLi/meu-financeiro/issues/67): tela principal de fila e decisão, não revisão de microtelas.
- Legado auditado: `src/intelligence-view.ts`, `app/intelligence-review.css`, contrato IC v1 e D01 V4.5. A disponibilidade de escrita via IA no perfil pessoal **não foi homologada**; mostrar fluxo ilustrativo sem sucesso falso.
- V1 interativa apresentada no chat: pendências, históricos, busca, seleção, propostas de regra/categorização/orçamento, editar/descartar, seleção de afetados, escopo e reconfirmação. Status histórico da V1. A direção foi aprovada, V1.1 final publicada; Electron ainda não implementado.

### D04 — V1.1 FINAL · direção aprovada e polimento concluído (13/11/2026)

**Aprovação:** proprietário aprovou a direção artística da tela D04 V1 e autorizou explicitamente o polimento final, revisão de interações e handoff. V1.1 preserva a composição da V1, com correções de rascunho, seleção e reconfirmação.

- [Protótipo interativo canônico](screens/d04-central-revisao/prototype.html) · [Design Spec aprovado](screens/d04-central-revisao/DESIGN_SPEC_APPROVED.md) · [Contrato de comportamento](screens/d04-central-revisao/BEHAVIOR_SPEC.md) · [Fixtures](screens/d04-central-revisao/FIXTURES.json).
- [Critérios de aceite](screens/d04-central-revisao/ACCEPTANCE.md) · [Handoff](screens/d04-central-revisao/HANDOFF.md) · [Changelog](screens/d04-central-revisao/CHANGELOG.md).
- **Validação realizada:** compilação da sintaxe JS, 12 testes isolados de seleção/escopo/filtros/validade e verificação de fixtures. **Não** houve screenshot de navegador nem QA Electron.
- **Segurança:** em perfil pessoal a IA não recebeu autorização para escrita financeira; conclusão demonstrativa é estado local apenas.
- **Executor:** [issue #69](https://github.com/JoaoVittorLi/meu-financeiro/issues/69), checkpoints C1/C2; **design issue #67**.
- **Próximo design macro:** D05 **Movimentações**. Não reabrir microscreens D04 sem regressão ou feedback novo do proprietário.

`DESIGN_APPROVED / IMPLEMENTATION_READY` não implica `IMPLEMENTED`, `VISUAL_QA` ou `HOMOLOGATED`.

### D05 — V1 Movimentações Premium (histórico anterior à aprovação final)

- [Issue #70](https://github.com/JoaoVittorLi/meu-financeiro/issues/70); auditoria da implementação existente em `src/app.ts` (`renderMovements`, `renderTransactions`), `app/movements-productivity.css` e `app/operations.css`, PR #54 HEAD `55de81c`.
- Recursos a preservar: histórico/revisão/categorias, busca/filtros, agrupamento por data, origem banco/manual, detalhes, categoria rápida, lotes, nova categoria, importação CSV, status POSTED/PENDING e histórico parcial.
- V1 é protótipo de **tela completa** apresentado no chat; valores sintéticos, sem escrita real. Aguardar aprovação do proprietário para congelar HTML canônico, specs, QA e handoff ao Executor.


### D05 — Subcategorias V1.2 · DESIGN APROVADO (13/11/2026)

**Feedback:** usuário aprovou a evolução dos ícones vetoriais com fundos de cor por categoria e pediu agora **subcategorias reais**, com ícones próprios para cada filho. **Aprovação explícita recebida em 13/11/2026: categorias, subcategorias e ícones 100% aprovados.**

- [D05 Design #70](https://github.com/JoaoVittorLi/meu-financeiro/issues/70): V1.2 visual visual de subcategorias aprovado; [HTML interativo](screens/d05-movimentacoes/prototype-subcategories.html); [14×61](screens/d05-movimentacoes/SUBCATEGORY_TAXONOMY_V1.json); [67 SVG](screens/d05-movimentacoes/SUBCATEGORY_SVG_REGISTRY_V1.json); [identidade visual](screens/d05-movimentacoes/ICON_SYSTEM_SUBCATEGORIES.md).
- [Issue de ENGENHARIA #74 — BLOQUEANTE](https://github.com/JoaoVittorLi/meu-financeiro/issues/74): [Contrato SQLite/IPC/IA](screens/d05-movimentacoes/SUBCATEGORIES_IMPLEMENTATION_CONTRACT.md) + [Handoff E1/E2/E3](screens/d05-movimentacoes/SUBCATEGORY_EXECUTOR_HANDOFF.md). **O Executor deve criar modelo real no código; protótipo ou documentação não bastam**.
- [QA isolado](screens/d05-movimentacoes/SUBCATEGORY_QA.md): 25 verificações do catálogo, parsing JS e modelo sintético PASS; **nenhuma migration SQLite nem Electron QA executados**.
- Subcategoria nula para histórico antigo, vinculação pai/filho por IDs estáveis, sem duplicar orçamentos, pagamentos ou efeitos IA; taxonomia e identidade visual congeladas por aprovação; restante da tela D05 pode receber ajustes. O Integrador deve reservar E1 migrator, E2 services e E3 UI como dependências do release D05.

**Declarar `DESIGN_APPROVED` somente para a taxonomia e identidade visual de subcategorias D05 V1.2.** Ainda **não** declarar `IMPLEMENTED`, `HOMOLOGATED`, `READY_FOR_EXE` nem aprovação global de outros componentes da tela.

### D05 — Aceite final da taxonomia e ícones (13/11/2026)

> **Proprietário:** “Você mandou muito bem nas categorias e subcategorias! Muito bem mesmo! 100% aprovadas.”

**Congelado visualmente:** 14 categorias-pai / 61 subcategorias / 67 glyphs SVG, fundos coloridos por subcategoria, vínculo pai→filho, estados sem filho. A prova funcional HTML e os testes isolados **não** significam SQL/IPC implementados.

**Erros e lacunas detectados:** [Relatório completo por evidência](screens/d05-movimentacoes/BUG_REPORT_AND_IMPLEMENTATION_GATES.md) (C01–C06 no código baseline PR#54; V01–V03 na captura do protótipo). Problemas observados: despesas invisíveis no dark, títulos sem contraste, emojis Unicode irregulares; falta modelo de subcategoria, vínculo por ID e IPC de filhos na branch auditada.

**Obrigação de release:** [Executor #74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74) deve implementar **E1 migrations SQLite, E2 serviços/regras/IA, E3 UI e QA Electron**, incluindo migrar sem perdas com subcategoria null em registros antigos, não classificar histórico automaticamente e preservar regras/overrides/splits/orçamentos. Só encerrar depois de código, tests, SHA/PR e evidências. Coordenação via #49; design issue #70 permanece aberta para quaisquer ajustes restantes da tela macro.

### D05 — Interações V1.3 (histórico de rodadas rejeitadas, superado pelo aceite final)

**Feedback explícito do proprietário, com capturas de tela:** checkbox nativo Windows reprovado, botão separado de categoria com seta reprovado, desejo de classificação clicando **diretamente no ícone da categoria**, picker rápido pai→filho opcional, e linha com dupla etiqueta `Confirmada` + `A conferir` visualmente inadequada.

**Nova direção provisória:** botão de seleção customizado acessível; ícone tonal funciona como único gatilho; popover ancorado mostra catálogo aprovado de 14 categorias e 61 filhos, opção sem filho; status POSTED+revisado fica omitido, POSTED não revisado mostra apenas `A revisar`, PENDING mostra apenas `Em processamento`; detalhes abrem os dois eixos separados. [Spec V1.3](screens/d05-movimentacoes/D05_V1_3_INTERACTION_SPEC.md).

**Estado preciso:** taxonomia e ícones V1.2 continuam `DESIGN_APPROVED`. **Interações V1.3 e tela global NÃO aprovadas**, sem QA Electron/SQLite. Engenharia de subcategorias #74 continua aberta e vinculada, com QA e implementação reais obrigatórios.

### D05 — Auditoria V1.6 da página inteira (histórico, refinamentos incorporados ao final)

O proprietário enviou **dois prints** da D05 V1.5 e pediu corrigir `Revisar`, visual nativo do checkbox de `Agrupar por dia` e avaliar a página toda com pesquisa de apps premium. [Relatório com 12 itens, evidências e pesquisa](screens/d05-movimentacoes/D05_V1_6_FULL_PAGE_AUDIT_AND_REVIEW_DESIGN.md).

Direção **proposta, não aprovada**: revisão via ponto azul no nome do comerciante, ação rápida, card `A conferir` como atalho; `Agrupar por dia` como switch premium sem checkbox; seleção múltipla circular; corrigir contraste do título `Movimentações recentes`. Fontes: Copilot, Monarch, YNAB, Rocket Money (links no relatório). Preservar categoria/subcategoria 14×61 aprovada e #74 de engenharia até SQLite/IPC/IA/QA reais. Sem regressão banco/PENDING/revisão.


### D05 — V1.3 FINAL CONSOLIDADA — DESIGN_APPROVED / IMPLEMENTATION_READY (13/11/2026)

**Aprovação explícita do proprietário da tela completa:** V1.3 final incorpora correções de V1.4–V1.6 (ponto azul e revisão contextual, círculos em seleção múltipla, switch agrupar, valor vermelho/verde isolado, title legível, datas sem contagem, popover premium no ícone), sem redesenhar catálogo 14 pais / 61 filhos / 67 SVGs. Todos os comentários anteriores de “D05 tela em revisão” são registros históricos **substituídos por este aceite**, não pendências atuais de design.

**Pacote final publicado no PR Draft #57:** [Índice canônico](screens/d05-movimentacoes/D05_FINAL_DELIVERY_INDEX.md) · [Protótipo final](screens/d05-movimentacoes/prototype.html) · [Spec aprovada](screens/d05-movimentacoes/DESIGN_SPEC_APPROVED.md) · [Comportamento](screens/d05-movimentacoes/BEHAVIOR_SPEC.md) · [Handoff](screens/d05-movimentacoes/HANDOFF.md) · [QA/aceite](screens/d05-movimentacoes/ACCEPTANCE.md).

**Primeiro EXE obrigatório:** novo Executor D05 implementa E1 SQLite/migração/backup, E2 IPC/regras/IA/autorização, E3 renderer+QA na RC #76 coordenada por #49. A issue **#74 segue aberta e bloqueante**. Não afirmar código implementado, QA Electron PASS, release/exe concluído ou executar CI/build pago sem autorização do proprietário.
