'use strict';
// M3: Authorized GPT-6.2 Sol Copilot Inference Service.
// Strictly uses OAuth/PKCE ChatGPTSignIn, minimal sanitized aggregate context
// (NEVER raw bank statements, account IDs, tokens, or direct SQLite access),
// adaptive reasoning ('low'|'medium'|'high'), streaming SSE, user cancellation,
// zero paid API fallback, and explicit opt-in capability gating.

const { AI_MODEL, AI_INFERENCE_STATES, selectAdaptiveEffort } = require('../shared/ai-policy.mjs');
const { readSSE, normalizedError } = require('./ai-client.cjs');

const MAX_QUESTION_CHARS = 700;

const sanitizeText = (raw, max = 140) =>
  String(raw || '')
    .replace(/[\x00-\x1f\x7f<>`]/g, ' ')
    .replace(/\b(?:ignore previous|system prompt|override rules|DROP TABLE|SELECT \*|PRAGMA)\b/gi, '[filtered]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const moneyBRL = (cents) =>
  Number.isSafeInteger(cents)
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
    : 'indisponível';

/**
 * Builds a minimal, privacy-preserving summary context from local deterministic read outputs.
 * Never includes raw statement lines, external_ids, account numbers, CPFs, or secrets.
 */
function buildMinimalAuthorizedContext({ local, scope, sessionCtx = null }) {
  const radar = local.query({ token: scope.token, month: scope.month, intent: 'radar' }, scope.owner);
  const budgetsQuery = local.query({ token: scope.token, month: scope.month, intent: 'budgets' }, scope.owner);

  const f = radar?.facts || {};
  const topCategories = (Array.isArray(f.expenseCategories) ? f.expenseCategories : [])
    .slice(0, 8)
    .map((c) => `${sanitizeText(c.name, 40)}: ${moneyBRL(c.amountCents)}`);

  const budgetSummaries = (Array.isArray(budgetsQuery?.facts?.budgets) ? budgetsQuery.facts.budgets : [])
    .slice(0, 12)
    .map((b) => `${sanitizeText(b.category, 40)}: gasto ${moneyBRL(b.spentCents)} de limite ${moneyBRL(b.limitCents)}`);

  const st = sessionCtx ? sessionCtx.get(scope, scope.owner) : null;
  const activeState = [];
  if (st?.lastCategory) activeState.push(`categoria_em_foco=${sanitizeText(st.lastCategory, 40)}`);
  if (st?.activeSalaryDraft) {
    activeState.push(
      `proposta_salario_ativa=rev${st.activeSalaryDraft.revision || 1}(salario=${moneyBRL(st.activeSalaryDraft.salaryCents)},reserva=${moneyBRL(st.activeSalaryDraft.proposedReserveCents)})`
    );
  }
  if (st?.lastSimulation?.principalCents) {
    activeState.push(
      `ultima_simulacao=${moneyBRL(st.lastSimulation.principalCents)} em ${st.lastSimulation.installments}x`
    );
  }

  return {
    month: scope.month,
    profile: scope.profile,
    source: scope.source,
    incomeTotal: moneyBRL(f.incomeCents),
    expenseTotal: moneyBRL(f.expenseCents),
    netResult: moneyBRL(f.netCents),
    partial: !!radar?.references?.partial,
    topCategories,
    budgetSummaries,
    activeState,
    rawStatementsShared: false,
    accountIdentifiersShared: false,
    sqliteAccessGrantedToModel: false
  };
}

class CopilotInferenceService {
  constructor({ auth, personalStore = null, capabilityCheck = () => false, fetchFn = globalThis.fetch } = {}) {
    if (!auth) throw Error('CopilotInference: ChatGPTSignIn obrigatório.');
    this.auth = auth;
    this.personalStore = personalStore;
    this.capabilityCheck = typeof capabilityCheck === 'function' ? capabilityCheck : () => false;
    this.fetchFn = fetchFn;
    this.busy = false;
    this.activeController = null;
  }

  cancelActive() {
    if (!this.busy || !this.activeController) return { cancelled: false };
    try {
      this.activeController.abort('USER_CANCELLED');
      return { cancelled: true };
    } catch {
      return { cancelled: false };
    }
  }

  chooseEffort({ question, task = 'investigate', override = 'auto', sessionState = null } = {}) {
    const q = String(question || '').toLowerCase();
    const multiCategory = /\b(reorganiz|redistribu|orçament|orcament|guardar|poupar|cortar)\b/.test(q);
    const hasRuleConflict = /\b(regra|conflit|duplic|sempre que)\b/.test(q);
    const ambiguity = /\b(essas?|esses?|isso|aquilo|essa categoria)\b/.test(q);
    const chainedActions = Boolean(
      sessionState?.activeSalaryDraft || sessionState?.lastSimulation || /\b(e crie|e adicione|depois)\b/.test(q)
    );
    const effectiveTask = multiCategory
      ? 'salary_budget'
      : /\b(parcel|simul|compra|compromiss|planej)\b/.test(q)
        ? 'planning'
        : task;

    return selectAdaptiveEffort({
      task: effectiveTask,
      ambiguity,
      categoryCount: multiCategory ? 4 : 1,
      hasRuleConflict,
      chainedActions,
      multiCategory,
      override
    });
  }

  async ask({ local, scope, sessionCtx = null, question, effortOverride = 'auto', onDelta = () => {} } = {}) {
    if (!this.capabilityCheck()) {
      throw Error('Ative a inferência GPT-6.2 Sol e a permissão do Copiloto antes de consultar a IA externa.');
    }
    if (this.busy) {
      throw Error('Já existe uma consulta GPT-6.2 Sol em andamento.');
    }
    const cleanQuestion = sanitizeText(question, MAX_QUESTION_CHARS);
    if (!cleanQuestion) {
      throw Error('Informe uma pergunta válida.');
    }

    const summary = buildMinimalAuthorizedContext({ local, scope, sessionCtx });
    const sessionState = sessionCtx ? sessionCtx.get(scope, scope.owner) : null;
    const effort = this.chooseEffort({ question: cleanQuestion, override: effortOverride, sessionState });

    const contextPrompt = [
      `Mês=${summary.month} | Fonte=${summary.source} | Receitas=${summary.incomeTotal} | Despesas=${summary.expenseTotal} | Resultado=${summary.netResult}`,
      summary.topCategories.length ? `Categorias: ${summary.topCategories.join('; ')}` : 'Categorias: sem gastos no período',
      summary.budgetSummaries.length ? `Orçamentos: ${summary.budgetSummaries.join('; ')}` : 'Orçamentos: sem limites definidos',
      summary.activeState.length ? `Contexto de sessão: ${summary.activeState.join('; ')}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const instructions = [
      'Você é o Copiloto GPT-6.2 Sol do aplicativo desktop Meu Financeiro.',
      'Responda em português brasileiro claro, objetivo e educado usando APENAS os agregados autorizados informados.',
      'Nunca invente transações, saldos bancários ou valores fora dos agregados fornecidos.',
      'Nunca afirme ter gravado alterações no banco SQLite: mudanças financeiras exigem prévia local e confirmação nativa do proprietário.',
      'Se o usuário pedir ação (categorizar, regra, orçamento salarial, planejamento), explique objetivamente e sugira confirmar pela prévia local supervisionada.'
    ].join('\n');

    const requestBody = {
      model: AI_MODEL,
      reasoning: { effort },
      instructions,
      input: [
        { role: 'user', content: `Resumo autorizado (agregado):\n${contextPrompt}\n\nPergunta:\n${cleanQuestion}` }
      ],
      store: false,
      stream: true
    };

    const controller = new AbortController();
    this.busy = true;
    this.activeController = controller;
    try {
      const token = await this.auth.accessToken();
      const timeoutSignal = AbortSignal.timeout(90000);
      const composedSignal =
        typeof AbortSignal.any === 'function' ? AbortSignal.any([timeoutSignal, controller.signal]) : controller.signal;

      const response = await this.fetchFn('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: composedSignal,
        redirect: 'error'
      });

      if (!response.ok) {
        throw new Error(normalizedError(response.status));
      }
      const { text, usage } = await readSSE(response.body, onDelta);

      let usageStored = false;
      if (this.personalStore && usage) {
        try {
          const vault = await this.auth?.vault?.read?.();
          if (vault?.subject) {
            await this.personalStore.recordUsage(vault.subject, {
              ...usage,
              effort,
              caseId: 'copilot-authorized',
              memoryCount: 0
            });
            usageStored = true;
          }
        } catch {
          usageStored = false;
        }
      }

      return {
        model: AI_MODEL,
        effort,
        text,
        usage,
        usageStored,
        inferenceStatus: AI_INFERENCE_STATES.LIVE_VERIFIED,
        paidApiFallback: false,
        minimalContextSummary: {
          month: summary.month,
          source: summary.source,
          rawStatementsShared: false,
          accountIdentifiersShared: false,
          categoryCount: summary.topCategories.length,
          budgetCount: summary.budgetSummaries.length
        }
      };
    } catch (err) {
      if (controller.signal.aborted || err?.cause === 'USER_CANCELLED' || err?.message === 'USER_CANCELLED') {
        throw new Error('Consulta ao GPT-6.2 Sol cancelada pelo usuário. Nenhuma tentativa automática foi feita.');
      }
      throw err;
    } finally {
      this.busy = false;
      this.activeController = null;
    }
  }
}

module.exports = {
  CopilotInferenceService,
  buildMinimalAuthorizedContext,
  sanitizeText
};
