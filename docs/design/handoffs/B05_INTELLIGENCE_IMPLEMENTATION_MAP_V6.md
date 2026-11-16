# B05 — MAPA DE IMPLEMENTAÇÃO / Ownership / anti-regressão

**Estado:** DESIGN_APPROVED, CODE_NOT_STARTED por este pacote. **Base inspecionada:** PR #76, HEAD `1bc1b89bf5bdefc0196b0851e690a99f825ca85a` em 16/11/2026. Reconsultar HEAD do PR e arquivos antes de editar. **Documentação canônica:** [handoff](./QA_EXE_B05_INTELLIGENCE_APPROVED_V6_20261116.md).

## 1. Caminho real que o Integrador/Executor deve percorrer

1. Abrir [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76) e conferir branch/HEAD, árvore e conflitos com PRs B01–B04, D03, D04 e I2-A/B/C/D/E.
2. Abrir `src/intelligence-view.ts`, em especial `renderIntelligenceView(app)` (em leitura de 16/11, região ~418–510). **Esse é o ponto de integração da navegação**; hoje usa `intelligenceMainMode` com IDs `today` / `chat` / `actions`, mas disponibiliza os outros destinos no `<details className="mf-ai-v3-tools">`. Não inventar novos IDs `plan` ou `home` no estado produtivo.
3. `renderIntelligencePremiumToday(app)` retorna `renderMfD03Today(app)`. Localizar **a definição atual** de `renderMfD03Today` via busca no checkout real, inspecionar import/ordem dos scripts em `app/index.html` e preservar seus efeitos, estados/contratos e testes. A B05 V6 pode compor uma nova vista Hoje usando o mesmo resolver de snapshot e os comportamentos D03. **Não substituir o motor por fixtures.**
4. `renderIntelligenceHistorySidebar(app)`, `intelligenceEnsureHydrated(app)`, `intelligenceCreateThread`, `intelligenceSelectThread`, `intelligenceDeleteThread`, `intelligenceClearHistory` e `intelligenceHistoryOpen` já integram a conversa; usar esses caminhos existentes em vez de implementar storage em paralelo.
5. `renderIntelligenceComposer(app)`, `renderIntelligenceMessageItem`, `renderIntelligenceFollowups`, `intelligenceSubmitQuestion` e `intelligencePageScope` são rotas do chat. Modernizar apresentação, mas manter submissão, permissões, scoping, context snapshot, estados e renderers tipados existentes.
6. `renderIntelligencePremiumToday` / `intelligencePremiumLoad` / `intelligencePremiumInvalidate` e `intelligencePremiumAction` dependem de serviços/autorizações existentes; trocar navegação e UI não substitui `IC-READ` por dados sintéticos.
7. `renderCategoryReview(app)` e `categoryReviewOpen(app)` são portas para a D04; não integrar novo editor/review engine próprio sem necessidade.
8. Testar a cadeia de chamadas e a montagem real no **Electron Windows** antes de declarar conclusão. No repositório, nomes e ownership podem mudar entre o HEAD lido e o checkout de execução.

## 2. Inventário de arquivos e quem os altera

| Arquivo / caminho existente no PR #76 | O que contém / por que importa | Recomendações |
| --- | --- | --- |
| `src/intelligence-view.ts` | Renderer principal `renderIntelligenceView`; modo hoje/chat/actions; composer, histórico, followups, permissões e ações premium | **Executor UI B05 (owner exclusivo em janela de integração)**. Extrair componentes de apresentação para reduzir diffs; preservar contratos e callbacks |
| `src/app.ts` | Estado raiz, roteamento e regras financeiras globais; guardas de perfil e categoria | **Integrador / owner do estado**. Alterar só com revisão explícita de colisões B01–B04; não manipular ledger |
| `app/intelligence.css` | CSS existente (inclusive tokens próprios e keyframes A-D5.2) | **Executor UI B05**. Preferir camada/namespace B05 em CSS específico para evitar sobrescrever D01/D03/D04 |
| `app/intelligence-review.css` | D04 Central de Revisão / revisão visual | **NÃO redesenhar** para B05, exceto ajuste mínimo aprovado de integração |
| `app/intelligence-staging.css` | CSS opt-in da demonstração antiga | Não substituir a UI produtiva por staging; reusar somente tokens quando aplicável |
| `src/intelligence-local.ts` | UI e contrato de consultas locais / autorizações | Referência de read-only e qualidades da fonte; não quebrar token, expiration nem revogação |
| `src/intelligence-ic2.ts`, `src/intelligence-v3-core.ts`, `src/intelligence-v3-ui.ts` | Fluxos/elementos de Inteligência e composição V3 | Integrar sem duplicar renderizadores ou reescrever motor |
| `src/intelligence-review.ts` / `src/intelligence-review-v11.ts` | Revisão e UIs existentes | Preservar D04 V1.1, versões/escopo e reconfirmação |
| `src/intelligence-category-rc.ts`, `src/intelligence-quality-rc.ts` | Integração proposta/categoria/qualidade | Reutilizar qualidade/evidência; não importar segredo ou mock para browser |
| `electron/financial-intelligence.cjs`, `electron/intelligence-ic2-adapter.cjs` | Dados/capabilities via processo principal e IPC | Owner IA/contrato; **não alterar por motivo puramente visual** |
| `electron/intelligence-orchestrator.cjs`, `electron/intelligence-provider.cjs` | Integração e orquestração de IA | Não inventar acesso genérico; observar provider/custos/permissões reais |
| `app/index.html` | Inclusão de CSS e scripts do renderer | Ao criar CSS/TS B05, verificar ordem real e bundle; não deixar CSS que não carrega |
| `electron/d05-taxonomy.json`, `shared/d05-svg-registry.json`, `src/d05-visual-assets.ts` | Identidade visual D05 única | Consumo read-only pelo renderer B05; nenhuma duplicação de emoji/hue |
| `docs/ai-context/INTELLIGENCE_UI_CONTRACT_V1.md` | Capacidades IC-READ/IC-PLAN/IC-REVIEW/LLM, fontes e estados | Contrato de segurança obrigatório |
| `docs/design/screens/d03-inteligencia-hoje/BEHAVIOR_SPEC.md` | FinancialSnapshot, Signal, projection e prioridades | Base de semântica do anel, timeline e propostas |

**Nota sobre path e função:** alguns símbolos acima são apontados pela referência do `src/intelligence-view.ts` consultado; nomes exatos e definição final devem ser confirmados no checkout HEAD atual. Não são uma nova API prometida pronta.

## 3. Fatiamento de integração para minimizar conflitos

### Fatia R1 — Estrutura sem mudar dados
- Introduzir uma barra de 3 modos no topo de `Inteligência` e retirar os links duplicados de `Mais ferramentas`.
- Reutilizar `intelligenceMainMode` (`today/chat/actions`) e callbacks existentes.
- Mover `Laboratório` para Configurações avançadas mantendo controles de grants; status compacto e renovação continuam presentes.
- Confirmar que D01 lateral e D04 são navegáveis, sem duas barras de tabs; nada de mudança em SQLite.
- TESTE: abrir/fechar cada modo e voltar após refresh/switch profile sem perder histórico.

### Fatia R2 — Hoje V6 sobre o resolver D03
- Criar componente isolado sugerido `src/intelligence-b05-today.ts` ou equivalente **novo proposto, NÃO arquivo existente**. Em `src/intelligence-view.ts`, plugar no caminho `renderIntelligencePremiumToday`.
- Modelar `TimelinePoint[]` com eventos futuros únicos do snapshot/`Fact[]`; criar selector determinístico que calcule cents, recorte e coverage **antes** de renderizar.
- Resolver anel/saldo/ficha do marco do **mesmo objeto derivado**, e disparar transição visual de forma consistente.
- Separar `motionState` de `financialData`; nenhum `setTimeout` de efeito atualiza ledger, nenhum estado visual modifica `IC-READ`.
- Reutilizar prioridade D03; quando não houver previsão completa, não mostrar a timeline sintética de futuro e manter diagnósticos parciais somente se comprovados.
- TESTE: matriz centavos fixture V6, estados negativos, duplicidade e grants, dark/light, teclado/zoom.

### Fatia R3 — Conversar V5
- Trocar coluna lateral persistente por drawer recolhido por padrão, com mesmo histórico e storage; composer em destaque; preservar suporte de cards ricos da D02 e chat lateral D01.
- Substituir apenas a origem **estática** dos followups por seletor baseado em sinais válidos e perguntas já feitas; preservar fallback quando não houver fatos.
- TESTE: restauração de thread, chat lateral/expandido, revoke grant, IA offline, resposta tardia e composer/IME.

### Fatia R4 — Plano de Ação V5
- Converter lista de exemplos ilustrativos em compositor de decisão protagonista com fila secundária e 3 etapas; derivar propostas disponíveis de resolver/serviços, NÃO de 3 strings de mock.
- Ações read-only/simuladas independentes de `PREPARE/CONFIRM`; D04 aplicável só com capability efetiva.
- TESTE: sliders 0/limite, previewVersion stale, opção de cancelar, nenhum side effect em banco, cross-navigation.

### Fatia R5 — Motion / integração visual / regressões
- Aplicar contrato de [movimento](./B05_INTELLIGENCE_MOTION_SPEC_V6.md) nas três áreas, respeitando reduced-motion.
- Validar performance, acessibilidade, D05 visual, B01–B04 visual, D01–D04/I2-* funcionais, flags de modo pessoal/demo e build Windows autorizado.

## 4. Proposta de interfaces internas (não existentes)

A equipe pode criar nomes diferentes desde que preserve estes contratos:

    B05ViewModel = {
      mode: 'today' | 'chat' | 'actions',
      snapshotVersion: string,
      asOf: ISODateTime,
      currency: 'BRL',
      coverage: 'verified' | 'partial' | 'stale' | 'denied' | 'none',
      focusDate: ISODate,
      timeline: TimelinePoint[],
      selectedPoint: TimelinePoint | null,
      signals: Signal[],
      grants: ...existingAuthority,
      simulatedOverrides: { safetyBufferCents?: number; balanceCents?: number },
      capabilities: ...existingCapability
    }

- `TimelinePoint` deve carregar `id, date, commitmentIds, consideredCents, projectedCents|null, protectedCents|null, headroomCents|null, evidence[]` e dados de recorte, **sem converter para float BRL antes do renderer**.
- Uma única função pura de projeção alimenta anel, gráfico, ficha do marco, sinais e Plano de Ação.
- `selectedDate` é seleção visual; **não é** `paymentStatus`, `asOf`, `postedAt` ou `confirmedAt`.
- Eventos previsões de renda devem ser representados com identificação explícita antes de entrar no `projected`; não ajustar regra do anel sem tornar sua decomposição verdadeira.

## 5. Padrão de qualidade de código

- CSS `.mf-b05-*` ou outro namespace isolado com tokens herdados. NUNCA aplicar `.card`, `.button`, `.drawer` genéricos a todas as telas do MF2.
- Não inserir ``React Router`, módulos ESM ou bibliotecas de animação` sem conferir bundler atual; `src/intelligence-view.ts` declara que roda em `TypeScript module:none` no bundle de `src/app.ts`.
- Animação na UI somente de apresentação; cancelamento em unmount/troca de thread/conta. Não deixar promises pendentes escreverem uma UI de outro grant.
- Números no estado financeiro em `integer cents`, valores de slider também; só `Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})` no display.
- Não depender de rede ou baixar SVG externo em runtime; não expor tokens ou metadados de IA no DOM/console.
- Verificar ARIA de radio/tabs, `aria-pressed` nos marcos, botões de fatia e drawers com foco/restauração; telas de 1366 e 1920 não podem causar overflow de reais.
- Se um serviço/capability não existe, documentar bloqueio e deixar interface desabilitada/honesta, nunca “aprovar” um mock.

## 6. QA concreto: suíte existente e novos testes

Arquivos comprovadamente listados no PR #76, que o Executor deve rodar e estender onde necessário:
- `tests/financial-intelligence-ui.test.cjs`
- `tests/intelligence-premium-ui.test.cjs`
- `tests/intelligence-i2a.test.cjs`, `tests/intelligence-i2b.test.cjs`, `tests/intelligence-i2c.test.cjs`, `tests/intelligence-i2d.test.cjs`, `tests/intelligence-i2e.test.cjs`
- `tests/rc-all-01-ic2.test.cjs`, `tests/rc-all-01-ui.test.cjs`
- `tests/category-review-ui.test.cjs`
- `tests/preload-sandbox.integration.test.cjs`, `tests/recovery.test.cjs`
- E scripts vigentes para TypeScript, unit, smoke Playwright/Electron, F08/ASAR e Windows, **confirmados no checkout** (não inventar comando de build nem declarar sucesso sem logs).

**Artefatos esperados do Executor:** PR separado; tabela `PASS/FAIL/NOT_RUN`; evidências screenshot/vídeo das 3 áreas V5/V6 nos dois temas e resoluções; testes centavos; relatório de rotas/IPC preservadas; smoke Electron Windows; explicação de capacidades bloqueadas; SHA e CircleCI job se autorizado.

## 7. Ponto de atenção crítico

**D03 V2 aprovado em 13/11 tinha regra de não exibir tabs permanentes e cards uniformemente esmeralda. A aprovação do usuário à B05 V6 em 16/11 modifica a apresentação dessa **superfície B05**: agora a navegação é sempre visível, o panorama tem anel + timeline + dois diagnósticos neutros. Não derrubar o **contrato de dados D03**, somente trocar sua apresentação.**

**Conversar e Plano de Ação = V5**. A V6 isolada contém shells simplificados nessas abas e **não as substitui**. Esta distinção é bloqueante para aceite visual.
