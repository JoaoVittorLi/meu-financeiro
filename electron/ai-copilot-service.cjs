'use strict';
// M3: Authorized GPT-6.2 Sol Copilot Inference Service.
// Strictly uses OAuth/PKCE ChatGPTSignIn, minimal sanitized aggregate context
// (NEVER raw bank statements, account IDs, tokens, or direct SQLite access),
// adaptive reasoning ('low'|'medium'|'high'), streaming SSE, user cancellation,
// zero paid API fallback, and explicit opt-in capability gating.

const { AI_MODEL, AI_INFERENCE_STATES, selectAdaptiveEffort } = require('../shared/ai-policy.mjs');
const { readSSE, normalizedError, connectionError } = require('./ai-client.cjs');

const MAX_QUESTION_CHARS = 700;
const DEFAULT_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function validateEndpointUrl(raw) {
  if (!raw) return DEFAULT_RESPONSES_URL;
  const parsed = new URL(String(raw));
  if (parsed.protocol === 'https:' && parsed.hostname === 'api.openai.com' && parsed.pathname === '/v1/responses') {
    return parsed.toString();
  }
  if (parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && parsed.pathname === '/v1/responses') {
    return parsed.toString();
  }
  throw Error('Endpoint do Copiloto não autorizado.');
}

const sanitizeText = (raw, max = 140) =>
  String(raw || '')
    .replace(/<\s*\/?\s*script\b[^>]*>/gi, '[filtered]')
    .replace(/[\x00-\x1f\x7f<>`]/g, ' ')
    .replace(/\b(?:ignore\s+(?:all\s+)?(?:previous|prior|above)(?:\s+(?:instructions?|rules?))?|ignore\s+(?:previous|all)\s+rules|desconsidere\s+(?:todas?\s+as\s+)?instru[cç][oõ]es|system\s*prompt|override\s+(?:all\s+)?rules|DROP\s+TABLE|SELECT\s+\*|PRAGMA)\b/gi, '[filtered]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

function sanitizeHistory(history, limit = 6, maxChars = 450) {
  if (!Array.isArray(history)) return [];
  const out = [];
  for (const item of history.slice(-Math.max(limit * 2, limit))) {
    if (!item || typeof item !== 'object') continue;
    const role = item.role === 'user' || item.role === 'assistant' ? item.role : null;
    if (!role || typeof item.text !== 'string') continue;
    const clean = sanitizeText(item.text, maxChars);
    if (clean) out.push({ role, content: clean });
  }
  return out.slice(-limit);
}

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
    .map((c) => `${JSON.stringify(sanitizeText(c.name, 40))}: ${moneyBRL(c.amountCents)}`);

  const budgetSummaries = (Array.isArray(budgetsQuery?.facts?.budgets) ? budgetsQuery.facts.budgets : [])
    .slice(0, 12)
    .map((b) => `${JSON.stringify(sanitizeText(b.category, 40))}: gasto ${moneyBRL(b.spentCents)} de limite ${moneyBRL(b.limitCents)}`);

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

function resolveQaLoopbackMock({ appIsPackaged = true, smokeProfileActive = false, env = {} } = {}) {
  if (appIsPackaged === true || smokeProfileActive !== true) return { endpointUrl: null, mockOAuth: false };
  if (env?.MF_QA_SYNTHETIC !== '1') return { endpointUrl: null, mockOAuth: false };
  const rawUrl = typeof env.MF_QA_MOCK_AI_URL === 'string' ? env.MF_QA_MOCK_AI_URL.trim() : '';
  if (!rawUrl) return { endpointUrl: null, mockOAuth: false };
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw Error('MF_QA_MOCK_AI_URL inválido.');
  }
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || parsed.pathname !== '/v1/responses') {
    throw Error('MF_QA_MOCK_AI_URL deve apontar exclusivamente para http://127.0.0.1:<porta>/v1/responses.');
  }
  return { endpointUrl: parsed.toString(), mockOAuth: env.MF_QA_MOCK_OAUTH === '1' };
}

class CopilotInferenceService {
  constructor({ auth, personalStore = null, capabilityCheck = () => false, fetchFn = globalThis.fetch, endpointUrl = DEFAULT_RESPONSES_URL } = {}) {
    if (!auth) throw Error('CopilotInference: ChatGPTSignIn obrigatório.');
    this.auth = auth;
    this.personalStore = personalStore;
    this.capabilityCheck = typeof capabilityCheck === 'function' ? capabilityCheck : () => false;
    this.fetchFn = fetchFn;
    this.endpointUrl = validateEndpointUrl(endpointUrl);
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

  async ask({ local = null, scope = null, sessionCtx = null, question, history = [], effortOverride = 'auto', onDelta = () => {} } = {}) {
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

    const safeHistory = sanitizeHistory(history, 6, 450);
    const hasFinancialScope = Boolean(local && scope && typeof scope.token === 'string' && scope.token);
    const summary = hasFinancialScope ? buildMinimalAuthorizedContext({ local, scope, sessionCtx }) : null;
    const sessionState = hasFinancialScope && sessionCtx ? sessionCtx.get(scope, scope.owner) : null;
    const effort = this.chooseEffort({
      question: cleanQuestion,
      task: hasFinancialScope ? 'investigate' : 'explain',
      override: effortOverride,
      sessionState
    });

    const instructions = hasFinancialScope
      ? [
          'Você é o Copiloto GPT-6.2 Sol do aplicativo desktop Meu Financeiro.',
          'Responda em português brasileiro claro, objetivo e educado usando APENAS os agregados autorizados informados.',
          'Nunca invente transações, saldos bancários ou valores fora dos agregados fornecidos.',
          'Nunca afirme ter gravado alterações no banco SQLite: mudanças financeiras exigem prévia local e confirmação nativa do proprietário.',
          'Se o usuário pedir ação (categorizar, regra, orçamento salarial, planejamento), explique objetivamente e sugira confirmar pela prévia local supervisionada.'
        ].join('\n')
      : [
          'Você é o assistente financeiro GPT-6.2 Sol do aplicativo desktop Meu Financeiro.',
          'Este modo é de conversa geral SEM acesso aos registros financeiros pessoais, saldos bancários ou SQLite do usuário.',
          'Responda em português brasileiro claro, educado e objetivo a saudações e perguntas gerais de educação financeira, reservas, planejamento ou uso do aplicativo.',
          'Nunca invente saldos, transações, faturas ou metas do usuário. Se a pergunta exigir consultar registros pessoais ou aplicar mudanças no orçamento/categorias, informe que o usuário pode autorizar a leitura local na própria tela de Inteligência.'
        ].join('\n');

    let userPrompt = cleanQuestion;
    if (summary) {
      const contextPrompt = [
        `Mês=${summary.month} | Fonte=${summary.source} | Receitas=${summary.incomeTotal} | Despesas=${summary.expenseTotal} | Resultado=${summary.netResult}`,
        summary.topCategories.length ? `Categorias: ${summary.topCategories.join('; ')}` : 'Categorias: sem gastos no período',
        summary.budgetSummaries.length ? `Orçamentos: ${summary.budgetSummaries.join('; ')}` : 'Orçamentos: sem limites definidos',
        summary.activeState.length ? `Contexto de sessão: ${summary.activeState.join('; ')}` : ''
      ]
        .filter(Boolean)
        .join('\n');
      userPrompt = `Resumo autorizado (agregado):\n${contextPrompt}\n\nPergunta:\n${cleanQuestion}`;
    }

    const requestBody = {
      model: AI_MODEL,
      reasoning: { effort },
      instructions,
      input: [...safeHistory, { role: 'user', content: userPrompt }],
      store: false,
      stream: true
    };

    const controller = new AbortController();
    this.busy = true;
    this.activeController = controller;
    try {
      let token;
      try {
        token = await this.auth.accessToken();
      } catch (authErr) {
        if (authErr?.name === 'TypeError' || authErr?.name === 'TimeoutError' || authErr?.name === 'AbortError') {
          throw connectionError('de acesso à sessão ChatGPT', authErr);
        }
        throw authErr;
      }

      const timeoutSignal = AbortSignal.timeout(90000);
      const composedSignal =
        typeof AbortSignal.any === 'function' ? AbortSignal.any([timeoutSignal, controller.signal]) : controller.signal;

      let response;
      try {
        response = await this.fetchFn(this.endpointUrl, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: composedSignal,
          redirect: 'error'
        });
      } catch (fetchErr) {
        if (controller.signal.aborted || fetchErr?.cause === 'USER_CANCELLED' || fetchErr?.message === 'USER_CANCELLED') {
          throw fetchErr;
        }
        throw connectionError('de envio ao Copiloto GPT-6.2 Sol', fetchErr, true);
      }

      if (!response.ok) {
        throw new Error(normalizedError(response.status));
      }
      const { text, usage } = await readSSE(response.body, (delta) => {
        if (controller.signal.aborted || !this.capabilityCheck()) return;
        onDelta(delta);
      });
      if (controller.signal.aborted) {
        throw Object.assign(new Error('USER_CANCELLED'), { cause: 'USER_CANCELLED' });
      }
      if (!this.capabilityCheck()) {
        throw new Error('Consulta ao GPT-6.2 Sol interrompida porque a permissão foi revogada em voo.');
      }

      let usageStored = false;
      if (this.personalStore && usage) {
        try {
          const vault = await this.auth?.vault?.read?.();
          if (vault?.subject) {
            await this.personalStore.recordUsage(vault.subject, {
              ...usage,
              effort,
              caseId: 'copilot',
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
        inferenceStatus:
          this.endpointUrl === DEFAULT_RESPONSES_URL ? AI_INFERENCE_STATES.LIVE_VERIFIED : AI_INFERENCE_STATES.MOCK_TESTED,
        paidApiFallback: false,
        contextMode: summary ? 'financial_aggregates' : 'general_no_financial_data',
        minimalContextSummary: summary
          ? {
              month: summary.month,
              source: summary.source,
              financialDataIncluded: true,
              rawStatementsShared: false,
              accountIdentifiersShared: false,
              categoryCount: summary.topCategories.length,
              budgetCount: summary.budgetSummaries.length
            }
          : {
              month: null,
              source: null,
              financialDataIncluded: false,
              rawStatementsShared: false,
              accountIdentifiersShared: false,
              categoryCount: 0,
              budgetCount: 0
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
  sanitizeText,
  sanitizeHistory,
  validateEndpointUrl,
  resolveQaLoopbackMock
};
