'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const { CopilotInferenceService, resolveQaLoopbackMock, validateEndpointUrl } = require('../electron/ai-copilot-service.cjs');
const { AIPersonalStore } = require('../electron/ai-personal.cjs');
const { FinanceDB } = require('../electron/db.cjs');
const { LocalFinancialIntelligence } = require('../electron/financial-intelligence.cjs');
const { recommendSavings } = require('../electron/intelligence-savings.cjs');
const { scanProactiveInsights } = require('../electron/intelligence-proactive.cjs');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function compileFullIntelligenceUi(desktopApi) {
  const mdSrc = read('src/ai-markdown.ts');
  const viewSrc = read('src/intelligence-view.ts');
  const integSrc = read('src/intelligence-integration.ts');
  const localSrc = read('src/intelligence-local.ts');
  const combined = [mdSrc, viewSrc, integSrc, localSrc].join('\n');
  const js = ts.transpileModule(combined, {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat() });
  const Icon = (props) => ({ tag: 'Icon', props });
  const Card = (props, ...children) => ({ tag: 'Card', props, children: children.flat() });
  const DEFAULT_CATEGORY_INFOS = [
    { name: 'Moradia', kind: 'expense' },
    { name: 'Alimentação', kind: 'expense' },
    { name: 'Transporte', kind: 'expense' },
    { name: 'Lazer', kind: 'expense' },
    { name: 'Outros', kind: 'both' },
    { name: 'Salário', kind: 'income' }
  ];
  const globals = {
    h,
    Icon,
    Card,
    DEFAULT_CATEGORY_INFOS,
    desktop: desktopApi,
    spanLabel: () => '01/11/2026 a 24/11/2026',
    dateSpan: () => ({ start: '2026-11-01', end: '2026-11-24' }),
    prettyMonth: (m) => m,
    iso: () => '2026-11-24',
    document: { getElementById: () => ({ focus() {} }), querySelectorAll: () => [] },
    FinancePeriodLedger: require('../shared/finance-period-ledger.mjs'),
    intelligencePremiumSignature: () => 'sig',
    intelligencePremiumLoad: () => {},
    intelligencePremiumMoney: (c) => String(c),
    intelligencePremiumCoverage: () => 'ok',
    mfIC2Valid: () => true,
    mfIC2Card: () => null,
    mfIC2BindMessage: () => {},
    mfIC2MessageLive: () => true,
    mfV3Requested: () => null,
    mfV3NeedsPrevious: () => false,
    mfV3BindGrant: (v) => v,
    mfV3FromOperational: () => null,
    mfV3Render: () => null,
    mfVisualMonthBefore: (m) => m,
    mfVisualRequested: () => null,
    mfVisualFromOperational: () => null,
    renderMfVisual: () => null,
    renderMfD01Proposal: () => null,
    renderMfIC2Adaptive: () => null
  };
  const keys = Object.keys(globals);
  const fn = new Function(
    ...keys,
    js +
      ';return {intelligenceSubmitQuestion,intelligenceRunPermissionAction,intelligenceConversationState,intelligenceClassifyQuestion,renderIntelligenceMessageItem,localFinancialSubmit};'
  );
  return fn(...keys.map((k) => globals[k]));
}

test('P0-REG-01: CopilotInferenceService general mode answers without FinanceDB, preserves multi-turn history, records copilot usage, and surfaces real errors', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-p0-sol-gen-'));
  const fakeSafe = {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (t) => Buffer.from('enc:' + Buffer.from(t).toString('base64')),
    decryptStringAsync: async (b) => ({ result: Buffer.from(Buffer.from(b).toString('utf8').slice(4), 'base64').toString('utf8') })
  };
  try {
    const store = new AIPersonalStore(dir, fakeSafe);
    const sentPayloads = [];
    const sseReply = (text) =>
      [
        { type: 'response.output_text.delta', delta: text },
        {
          type: 'response.completed',
          response: { usage: { input_tokens: 40, output_tokens: 18, output_tokens_details: { reasoning_tokens: 2 } } }
        }
      ]
        .map((x) => 'data: ' + JSON.stringify(x) + '\n\n')
        .join('');

    const svc = new CopilotInferenceService({
      auth: {
        vault: { read: async () => ({ subject: 'sub-p0-user' }) },
        accessToken: async () => 'oauth-tok-p0'
      },
      personalStore: store,
      capabilityCheck: () => true,
      fetchFn: async (_url, opts) => {
        sentPayloads.push(JSON.parse(opts.body));
        const bodyText =
          sentPayloads.length === 1
            ? 'Oi! Estou conectado e pronto no modo geral.'
            : 'Para construir uma reserva de emergência, comece separando de 3 a 6 meses de gastos essenciais.';
        const bytes = new TextEncoder().encode(sseReply(bodyText));
        return { ok: true, body: new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } }) };
      }
    });

    // Turn 1: greeting without local financial scope
    const r1 = await svc.ask({
      local: null,
      scope: null,
      question: 'Opa, testando!'
    });
    assert.equal(r1.contextMode, 'general_no_financial_data');
    assert.equal(r1.minimalContextSummary.financialDataIncluded, false);
    assert.equal(r1.usageStored, true, 'Guardian fix: caseId copilot must persist usage');
    assert.match(r1.text, /modo geral/i);
    assert.equal(sentPayloads[0].input.length, 1);

    // Turn 2: multi-turn history sanitized & included
    const r2 = await svc.ask({
      local: null,
      scope: null,
      question: 'Como construir uma reserva de emergência?',
      history: [
        { role: 'user', text: 'Opa, testando!' },
        { role: 'assistant', text: r1.text + ' DROP TABLE users' }
      ]
    });
    assert.equal(r2.contextMode, 'general_no_financial_data');
    assert.equal(sentPayloads[1].input.length, 3);
    assert.equal(sentPayloads[1].input[1].content.includes('DROP TABLE'), false);
    assert.match(r2.text, /reserva de emergência/i);

    const summary = await store.summary('sub-p0-user');
    assert.equal(summary.completedSamples, 2);

    // Real network error surfaced cleanly without retrying or simulating
    const svcNetErr = new CopilotInferenceService({
      auth: { accessToken: async () => 'oauth-tok-p0' },
      capabilityCheck: () => true,
      fetchFn: async () => {
        const err = new Error('connect ECONNREFUSED');
        err.code = 'ECONNREFUSED';
        throw err;
      }
    });
    await assert.rejects(() => svcNetErr.ask({ question: 'Opa?' }), /Falha de rede.*Nenhuma nova tentativa automática/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('P0-REG-02: QA loopback endpoint mock strictly forbidden in packaged/non-smoke apps and rejects non-127.0.0.1 URLs', () => {
  assert.deepEqual(
    resolveQaLoopbackMock({
      appIsPackaged: true,
      smokeProfileActive: true,
      env: { MF_QA_SYNTHETIC: '1', MF_QA_MOCK_AI_URL: 'http://127.0.0.1:4100/v1/responses', MF_QA_MOCK_OAUTH: '1' }
    }),
    { endpointUrl: null, mockOAuth: false }
  );
  assert.deepEqual(
    resolveQaLoopbackMock({
      appIsPackaged: false,
      smokeProfileActive: false,
      env: { MF_QA_SYNTHETIC: '1', MF_QA_MOCK_AI_URL: 'http://127.0.0.1:4100/v1/responses', MF_QA_MOCK_OAUTH: '1' }
    }),
    { endpointUrl: null, mockOAuth: false }
  );
  assert.throws(
    () =>
      resolveQaLoopbackMock({
        appIsPackaged: false,
        smokeProfileActive: true,
        env: { MF_QA_SYNTHETIC: '1', MF_QA_MOCK_AI_URL: 'http://evil.example/v1/responses' }
      }),
    /127\.0\.0\.1/
  );
  assert.throws(() => validateEndpointUrl('http://localhost:4100/v1/responses'), /não autorizado/);
  assert.equal(
    resolveQaLoopbackMock({
      appIsPackaged: false,
      smokeProfileActive: true,
      env: { MF_QA_SYNTHETIC: '1', MF_QA_MOCK_AI_URL: 'http://127.0.0.1:4100/v1/responses', MF_QA_MOCK_OAUTH: '1' }
    }).endpointUrl,
    'http://127.0.0.1:4100/v1/responses'
  );
});

test('P0-REG-03: monthly_budgets overrides are respected by F2 recommendSavings and F5 scanProactiveInsights', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-p0-monthly-'));
  const db = new FinanceDB(path.join(dir, 'monthly.sqlite'));
  try {
    const ym = '2026-11';
    db.save('real', {
      version: 5,
      settings: { opening: 100000, income: 600000, fixed: 150000, existing: 0, reserve: 50000 },
      budgets: { 'Alimentação': 200000, Moradia: 150000 },
      transactions: []
    });
    db.ingestBank('item-p0', {
      item: { status: 'UPDATED' },
      data: [
        {
          account: { id: 'acc-p0', name: 'Conta P0', type: 'CHECKING', currencyCode: 'BRL', balance: 4000 },
          transactions: [
            { id: 'tx-food-1', date: `${ym}-05`, description: 'SUPERMERCADO P0', amount: -900, status: 'POSTED', category: 'Groceries' }
          ]
        }
      ]
    });
    // Override recurring R$ 2.000 limit with monthly R$ 800 limit -> R$ 900 spent is OVER budget!
    db.setMonthlyBudget('real', ym, 'Alimentação', 80000);

    const local = new LocalFinancialIntelligence(db);
    const grant = local.authorize({ source: 'bank', profile: 'real', consent: 'LOCAL_FINANCIAL_READ_V1' }, 11);
    const scope = { owner: 11, token: grant.token, source: 'bank', profile: 'real', month: ym };

    const savings = recommendSavings({ local, scope, clock: () => Date.parse(`${ym}-20T12:00:00Z`) });
    const foodOpp = savings.opportunities.find((o) => o.categoryLabel === 'Alimentação');
    assert.ok(foodOpp, 'Alimentação opportunity must exist');
    assert.equal(foodOpp.limitCents, 80000, 'F2 recommendSavings must see monthly R$ 800 override instead of R$ 2000 recurring');
    assert.equal(foodOpp.confidence, 'high');
    assert.match(foodOpp.reason, /acima do limite/);

    const proactive = scanProactiveInsights({ local, scope, clock: () => Date.parse(`${ym}-20T12:00:00Z`) });
    const budgetAlert = proactive.insights.find((i) => i.type === 'budget_risk' && i.categoryLabel === 'Alimentação');
    assert.ok(budgetAlert, 'F5 Radar Proativo must emit budget_risk based on monthly_budgets');
    assert.match(budgetAlert.title, /acima do limite/);
    assert.match(budgetAlert.summary, /800,00/);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('P0-REG-04: Full renderer routing eliminates I2-A legacy strings, provides clickable CTAs, and routes OAuth/local/M3 paths cleanly', async () => {
  const asked = [];
  let ic2Called = 0;
  let localAuthorized = false;
  let solEnabled = false;

  const rt = compileFullIntelligenceUi({
    localFinancialAuthorize: async () => {
      localAuthorized = true;
      return { token: 'loc-tok', source: 'bank', profile: 'real', planning: false, expiresAt: Date.now() + 600000 };
    },
    aiCopilotCapabilityEnable: async () => {
      solEnabled = true;
      return { cancelled: false, enabled: true };
    },
    aiStatus: async () => ({ connected: true, secure: true, email: 'owner@test.local' }),
    aiCopilotCapabilityStatus: async () => ({ available: true, enabled: solEnabled, inferenceStatus: 'CONFIGURADO' }),
    copilotActionCapabilityStatus: async () => ({ available: true, enabled: false }),
    intelligenceIC2ReadQuery: async () => {
      ic2Called++;
      return {
        version: 2,
        contract: 'I2-A/D02-V3',
        readOnly: true,
        changesApplied: false,
        modelCalled: false,
        status: 'ready',
        answer: 'Suas maiores despesas foram R$ 900,00 em Alimentação.',
        conversationId: 'c1',
        source: 'bank',
        profile: 'real',
        period: '2026-11',
        facts: [],
        blocks: [],
        alerts: [],
        actions: [],
        followUps: []
      };
    },
    aiCopilotAsk: async (input) => {
      asked.push(input);
      return {
        model: 'gpt-6.2-sol',
        effort: 'low',
        text: 'Olá! Estou online sem ler seus dados pessoais.',
        inferenceStatus: 'TESTADO_COM_MOCK'
      };
    }
  });

  const app = {
    state: {
      mode: 'real',
      page: 'intelligence',
      month: '2026-11',
      today: '2026-11-24',
      overviewPeriod: 'month',
      customStart: '2026-11-01',
      customEnd: '2026-11-24',
      categories: [{ name: 'Alimentação', kind: 'expense' }],
      bank: { data: { transactions: [] } },
      data: { transactions: [] },
      intelligenceMessages: [],
      intelligenceThreads: [],
      intelligenceActiveThreadId: null,
      aiStatus: { connected: true, secure: true, email: 'owner@test.local' },
      aiCopilotCap: { available: true, enabled: false, inferenceStatus: 'CONFIGURADO' },
      m3ActionCap: { available: true, enabled: false },
      localFinancialAccess: null
    },
    setState(patch, cb) {
      const next = typeof patch === 'function' ? patch(this.state) : patch;
      this.state = { ...this.state, ...next };
      if (typeof cb === 'function') cb();
    },
    navigate() {}
  };

  // 1. User has OAuth connected, NO opt-in, NO financial access -> asks "Opa, testando!"
  await rt.intelligenceSubmitQuestion(app, 'Opa, testando!');
  const m1 = app.state.intelligenceMessages.at(-1);
  assert.equal(m1.status, 'permission_needed');
  assert.equal(m1.permissionActions[0].id, 'enable_ai_copilot');
  assert.equal(/Aguarda I2-A|Funcionalidade ainda não implementada|aguarda I2-A/i.test(JSON.stringify(m1)), false);

  // 2. Click CTA to enable GPT-6.2 Sol -> retries automatically & answers without FinanceDB!
  await rt.intelligenceRunPermissionAction(app, m1.permissionActions[0]);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(solEnabled, true);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].token, null);
  assert.equal(ic2Called, 0);
  const m2 = app.state.intelligenceMessages.at(-1);
  assert.equal(m2.status, 'done');
  assert.match(m2.text, /Estou online sem ler seus dados pessoais/);

  // 3. Personal financial question without financial authorization -> permission CTA (NEVER sent to GPT-6.2 Sol!)
  await rt.intelligenceSubmitQuestion(app, 'Quais foram minhas maiores despesas?');
  assert.equal(asked.length, 1);
  const m3 = app.state.intelligenceMessages.at(-1);
  assert.equal(m3.status, 'permission_needed');
  assert.equal(m3.permissionActions[0].id, 'authorize_local_read');

  // 4. Click CTA to authorize local financial read -> auto-queries IC2 cleanly!
  await rt.intelligenceRunPermissionAction(app, m3.permissionActions[0]);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(localAuthorized, true);
  assert.equal(ic2Called, 1);
  assert.match(app.state.intelligenceMessages.at(-1).text, /900,00 em Alimentação/);

  // 5. General coaching questions using "minha/meus" remain general rather than blocking on local DB access
  assert.equal(rt.intelligenceClassifyQuestion('Como montar minha reserva de emergência?'), 'general');
  assert.equal(rt.intelligenceClassifyQuestion('E como organizar meus gastos variáveis sem perder o controle?'), 'general');
  assert.equal(rt.intelligenceClassifyQuestion('Quais foram minhas maiores despesas?'), 'personal_financial');
  assert.equal(rt.intelligenceClassifyQuestion('Meus gastos de novembro aumentaram?'), 'personal_financial');
});
