# I-P0.1 — Adapter operacional Inteligência Hoje | 12/11/2026

**Frente:** I (Inteligência) · **Base:** coord/870b7da8 · **Status:** código publicado, teste dirigido V8; integração nativa pendente · **Issue:** #49

## Entrega concreta
- O serviço `electron/financial-intelligence.cjs` continua com autorização/revogação e fonte única. Ampliação **aditiva** do reply v1: `facts` numéricos (`incomeCents`, `expenseCents`, `netCents`, `transactionsIncluded`, `excluded`) e dados estruturados de categoria, orçamentos/radar, revisão bancária, compromissos e comparação.
- Novo `electron/intelligence-operational.cjs`: `overview` com oito IDs UI-01…UI-08, cobertura explícita, fontes, estado e ações; `ask` com roteamento financeiro determinístico e resposta evidenciada sem modelo pago.
- IPC protegido por `requireAppSender` em `electron/main.cjs`; preload disponibiliza somente `intelligenceOperationalOverview` e `intelligenceOperationalAsk`, sem acesso arbitrário ao IPC.
- UI-02 e UI-08 (sugestões e recibos) dependem do token separado de `CategoryReviewService` e do perfil sintético, sem liberar escrita pessoal. UI-06 abre editor manual existente; **não** cria categorias pelo chat.
- Nenhum arquivo do Redesign, CSS, `app/app.js` ou documento de contrato vinculante foi modificado.

## Contrato de consumo (Executor R)
```ts
const grant = await desktop.localFinancialAuthorize({
  consent: 'LOCAL_FINANCIAL_READ_V1', source: 'bank', profile: 'real', planning: true
});
const today = await desktop.intelligenceOperationalOverview({
  month: '2026-11', token: grant.token, source: grant.source, profile: grant.profile
});
const reply = await desktop.intelligenceOperationalAsk({
  month: '2026-11', token: grant.token, question: 'Compare minhas despesas com o mês anterior'
});
```

- `today.cards` contém UI-01…UI-08. Cada item inclui `id`, `kind`, `source`, `profile`, `asOf`, `period`, `coverage`, `capability`, `uiState`, `evidence`, `actions`, `status`, `valueCents` e `unavailableReason`. Valores monetários só como inteiros em centavos ou `null`.
- UI-01: `count` refere-se a movimentações não revisadas do cache bancário local; `postedCount` e `pendingBankCount` ficam separados. PENDING não significa “categoria pendente”. Respeitar `partial_local`.
- UI-03/04: `observations[]` / `budgets[]` com `spentCents`, `limitCents`, `percentage`. Limites do cadastro de orçamentos, consumo de apenas uma fonte autorizada; não certificar extrato integral.
- UI-05: `valueCents` apenas da soma de compromissos planejados confirmados e restantes; escopo `planning` exige grant com `planning:true`.
- UI-06: `categories[]` da API existente; ação `navigate:category-editor` **somente** abre edição manual, com `categorySave` no fluxo de usuário e preservação de rascunho pelo Redesign.
- UI-02 sintético: passar `reviewToken` obtido por `categoryReviewAuthorize` no perfil de teste; `suggestions[]` reais do `categoryReviewList`. `review:prepare-rule` requer `categoryReviewPrepare({token,action:'rule',payload:{suggestionId}})`; confirmação permanece protegida pelo IPC de backup e pela confirmação explícita do usuário.
- UI-08 sintético: `receipts[]` expõe o resumo da auditoria e o estado do undo, **não** implementa undo novo.
- `actions[].handler = 'navigation:*'` representa uma rota que o Redesign deve mapear para a navegação real; não ativar botões até esse mapeamento estar testado. `categoryReviewPrepare` é o endpoint existente e exige prévia antes de confirmação.
- `uiState:'loading'` é gerenciado pela interface durante o IPC. `denied`, `expired`, `error`, `unsupported`, `empty` e `ready` saem do adapter. Descartar resultados se fonte/token/período/perfil mudarem durante a Promise (generation guard).

## Evidências e limites
- `tests/intelligence-operational.test.cjs`: 11 testes cobrindo ausência de grant, cents, cobertura parcial, vazio, grant expirado, isolamento sintético, roteamento conversacional, proibição de escrita e parâmetros inválidos.
- `tests/intelligence-operational-facts.test.cjs`: seis regressões Node adicionais que exercitam `LocalFinancialIntelligence` e o ledger canônico: centavos, limites, POSTED/PENDING, compromisso confirmado, categoria/comparação, revogação e escopo de Planejamento.
- **Executado:** probe funcional no V8 do adapter: **11/11 PASS**; probe no V8 do serviço real + ledger canônico: **5/5 PASS**; os seis testes da nova suíte de facts executados no V8 adaptado: **6/6 PASS**. Ainda não equivale a execução Node/SQLite/Electron nativa.
- **Ainda não executado neste ambiente:** `npm test` Node/SQLite, Electron/IPC nativo, TypeScript, F08, ASAR e Windows; integrador deve executar antes de classificar como integrado/homologado.
- P0.2 ainda **parcial**: interpretador determinístico de intenções com respostas financeiras reais e consulta de sugestões/recibos **sintéticos mediante token de revisão**. Respostas incluem rotas explícitas de navegação. Não há provedor LLM nem tool calling liberado.
- Escrita pessoal de IA permanece bloqueada; nenhum custo de API, deploy, CircleCI ou instalador executado.

**Próximo:** Executor R consome os dois IPCs, valida handlers e estados; Integrador junta UI+serviços, recompila renderer, confirma QA e registra contrato IC v1 aditivo.