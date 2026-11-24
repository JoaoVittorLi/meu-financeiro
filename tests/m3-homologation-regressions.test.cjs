'use strict';
// M3 Pre-Release Integral Homologation Regression Suite (D-01..D-10 & C-01..C-19 & A-03).
// Runs strictly against synthetic TEMP SQLite & in-memory renderer compile; never touches %APPDATA% or Pluggy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const { FinanceDB } = require('../electron/db.cjs');
const { PlanningStore } = require('../electron/planning.cjs');
const { LocalFinancialIntelligence } = require('../electron/financial-intelligence.cjs');
const { IntelligenceOrchestrator } = require('../electron/intelligence-orchestrator.cjs');
const { CopilotInferenceService, sanitizeText } = require('../electron/ai-copilot-service.cjs');
const { parseBrlCents, recommendSavings } = require('../electron/intelligence-savings.cjs');
const { PluggyClient } = require('../electron/pluggy.cjs');
const { CopilotSessionContext } = require('../electron/copilot-session-context.cjs');
const { D05CategoryService } = require('../electron/d05-category-service.cjs');
const { D05PersonalWriteGateway } = require('../electron/d05-personal-gate.cjs');
const {
  parseMoneyToCents,
  parseSalaryBudgetCommand,
  buildSalaryBudgetProposal
} = require('../electron/copilot-salary-budget.cjs');
const { interpretCopilotAction } = require('../electron/copilot-actions.cjs');

const ROOT = path.resolve(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const ACC1 = '11111111-1111-4111-8111-111111111111';
const ITEM1 = '22222222-2222-4222-8222-222222222222';

function compileIntelligenceIntegrationRuntime(desktopOverride = null) {
  const mdSrc = readSrc('src/ai-markdown.ts');
  const viewSrc = readSrc('src/intelligence-view.ts');
  const integSrc = readSrc('src/intelligence-integration.ts');
  const js = ts.transpileModule([mdSrc, viewSrc, integSrc].join('\n'), {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const h = (name, props, ...children) => ({ name, props: props || {}, children: children.flat() });
  const Icon = (props) => ({ name: 'Icon', props });
  const Card = (props, ...children) => ({ name: 'Card', props, children: children.flat() });
  const DEFAULT_CATEGORY_INFOS = [
    { name: 'Moradia', kind: 'expense' },
    { name: 'Alimentação', kind: 'expense' },
    { name: 'Transporte', kind: 'expense' },
    { name: 'Lazer', kind: 'expense' },
    { name: 'Outros', kind: 'both' },
    { name: 'Salário', kind: 'income' }
  ];
  const fn = new Function(
    'h', 'Icon', 'Card', 'DEFAULT_CATEGORY_INFOS', 'desktop',
    'spanLabel', 'dateSpan', 'prettyMonth', 'iso', 'document', 'FinancePeriodLedger',
    js + ';return {intelligenceRecentPlainHistory,intelligenceSubmitQuestion,intelligenceClassifyQuestion,intelligenceCreateThread,intelligenceSwitchProfileMode};'
  );
  return {
    DEFAULT_CATEGORY_INFOS,
    runtime: fn(
      h, Icon, Card, DEFAULT_CATEGORY_INFOS, desktopOverride,
      () => '01/11/2026 a 30/11/2026',
      () => ({ start: '2026-11-01', end: '2026-11-30' }),
      (ym) => ym,
      () => '2026-11-24',
      { getElementById: () => ({ focus() {} }) },
      require('../shared/finance-period-ledger.mjs')
    )
  };
}

function makeTempEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-homolog-reg-'));
  const db = new FinanceDB(path.join(dir, 'reg.sqlite'));
  const planner = new PlanningStore(db);
  const backups = path.join(dir, 'backups');
  fs.mkdirSync(backups, { recursive: true });
  return {
    dir,
    db,
    planner,
    backups,
    cleanup: () => {
      try { db.close(); } catch {}
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  };
}

test('D-01: sanitizeText removes script blocks safely and intelligenceRecentPlainHistory strips personal financial leakage', () => {
  const cleaned = sanitizeText('Olá <script>alert("xss")</script> "Alimentação & Pet"!', 120);
  assert(!/<\/?\s*script/i.test(cleaned));
  assert(cleaned.includes('[filtered]'));
  assert(cleaned.includes('"Alimentação & Pet"'));

  const { runtime } = compileIntelligenceIntegrationRuntime(null);
  const messages = [
    { id: 'usr-1', role: 'user', text: 'Oi, como funciona a reserva?' },
    { id: 'ast-1', role: 'assistant', status: 'done', text: 'A reserva de emergência cobre de 3 a 6 meses.' },
    { id: 'ic2-2', role: 'assistant', status: 'done', text: 'Gasto secreto R$ 4.321,00 no Mercado X' },
    { id: 'local-3', role: 'assistant', status: 'done', text: 'Saldo nas contas R$ 9.999,00' },
    { id: 'm3a-4', role: 'assistant', status: 'done', text: 'Prévia supervisionada de R$ 500,00', m3ActionDraft: { contract: 'MF3/ACTION-DRAFT-V1' } },
    { id: 'ast-5', role: 'assistant', status: 'done', text: 'O gasto em Alimentação foi R$ 850,00 neste mês.' },
    { id: 'usr-6', role: 'user', text: 'Pode me explicar regra 50-30-20?' }
  ];
  const plain = runtime.intelligenceRecentPlainHistory(messages, 6);
  assert.equal(plain.length, 3);
  assert.deepEqual(plain.map((m) => m.text), [
    'Oi, como funciona a reserva?',
    'A reserva de emergência cobre de 3 a 6 meses.',
    'Pode me explicar regra 50-30-20?'
  ]);
});

test('D-02 & A-03 & D-04: desktop local consent blocks ungranted summaries/categorization and classifies personal phrases', async () => {
  const { runtime, DEFAULT_CATEGORY_INFOS } = compileIntelligenceIntegrationRuntime({
    localFinancialAuthorize: async () => ({ token: 'tok', expiresAt: Date.now() + 60000 })
  });
  const makeApp = () => {
    const app = {
      state: {
        mode: 'real',
        page: 'transactions',
        month: '2026-11',
        today: '2026-11-24',
        categories: DEFAULT_CATEGORY_INFOS,
        bank: {
          config: { configured: true },
          data: {
            accounts: [{ id: ACC1, name: 'Banco X' }],
            transactions: [{ id: 'tx1', accountId: ACC1, date: '2026-11-10', description: 'IFOOD RESTAURANTE', amount: -8900, status: 'POSTED', category: 'Outros' }]
          }
        },
        data: { version: 5, transactions: [], budgets: {}, settings: { opening: 0, income: 0, fixed: 0, existing: 0, reserve: 0 } },
        localFinancialAccess: null,
        intelligenceThreads: [],
        intelligenceMessages: [],
        intelligenceActiveThreadId: null,
        aiStatus: { connected: false, secure: true }
      },
      setState(patch, cb) {
        const next = typeof patch === 'function' ? patch(app.state) : patch;
        app.state = { ...app.state, ...next };
        if (cb) cb();
      }
    };
    return app;
  };

  assert.equal(runtime.intelligenceClassifyQuestion('onde gastei mais?'), 'personal_financial');
  assert.equal(runtime.intelligenceClassifyQuestion('quanto sobrou neste mês?'), 'personal_financial');
  assert.equal(runtime.intelligenceClassifyQuestion('como organizar minhas finanças pessoais?'), 'general');

  const app1 = makeApp();
  await runtime.intelligenceSubmitQuestion(app1, 'Me dê o resumo estruturado das minhas movimentações');
  assert.equal(app1.state.intelligenceMessages.at(-1).status, 'permission_needed');
  assert.equal(app1.state.intelligenceMessages.at(-1).structuredCard || null, null);

  const app2 = makeApp();
  await runtime.intelligenceSubmitQuestion(app2, 'Categorize Ifood como Alimentação');
  const d01Msg = app2.state.intelligenceMessages.at(-1);
  assert.ok(d01Msg.proposal && d01Msg.proposal.status === 'pending' && d01Msg.proposal.origin === 'bank');
  assert.deepEqual(
    runtime.intelligenceRecentPlainHistory(app2.state.intelligenceMessages).filter((m) => m.role === 'assistant'),
    []
  );

  const app3 = makeApp();
  await runtime.intelligenceSubmitQuestion(app3, 'Deixe meu limite de Moradia em R$ 1.500');
  assert.equal(app3.state.intelligenceMessages.at(-1).status, 'permission_needed');
  assert(app3.state.intelligenceMessages.at(-1).permissionActions?.some((a) => a.id === 'authorize_local_read'));
});

test('D-03 & D-08: cancel aborts SSE inference cleanly, post-SSE capability loss rejects without recording usage, and thread/mode switches cancel active request', async () => {
  let capEnabled = true;
  const usages = [];
  const sseBody = [
    'data: ' + JSON.stringify({ type: 'response.output_text.delta', delta: 'Parcial ' }),
    'data: ' + JSON.stringify({ type: 'response.completed', response: { usage: { input_tokens: 10, output_tokens: 5 } } })
  ].join('\n\n') + '\n\n';

  const svc = new CopilotInferenceService({
    auth: { accessToken: async () => 'oauth-tok' },
    personalStore: { recordUsage: (u) => usages.push(u) },
    capabilityCheck: () => capEnabled,
    endpointUrl: 'https://api.openai.com/v1/responses',
    fetchFn: async (_url, opts) => {
      capEnabled = false; // simulate user revoking capability while SSE is in-flight
      assert.ok(opts.signal);
      return new Response(sseBody, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
  });

  await assert.rejects(
    () => svc.ask({ question: 'Oi, tudo bem?', history: [], effortOverride: 'low' }),
    /desativad|cancelad|autoriz|revogad|interrompid/i
  );
  assert.equal(usages.length, 0);

  let cancelledCalls = 0;
  const { runtime, DEFAULT_CATEGORY_INFOS } = compileIntelligenceIntegrationRuntime({
    aiCopilotCancel: async () => { cancelledCalls++; }
  });
  const app = {
    state: {
      mode: 'real',
      page: 'intelligence',
      month: '2026-11',
      categories: DEFAULT_CATEGORY_INFOS,
      aiCopilotBusy: true,
      aiCopilotStreaming: 'texto parcial',
      aiCopilotRequestId: 'req-1',
      intelligencePreparedQuestion: 'rascunho antigo',
      intelligenceDraftScope: { label: 'Antigo', period: 'Nov' },
      intelligenceThreads: [],
      intelligenceMessages: [],
      intelligenceActiveThreadId: null
    },
    setState(patch, cb) {
      app.state = { ...app.state, ...(typeof patch === 'function' ? patch(app.state) : patch) };
      if (cb) cb();
    }
  };
  runtime.intelligenceCreateThread(app);
  assert.equal(cancelledCalls, 1);
  assert.equal(app.state.aiCopilotBusy, false);
  assert.equal(app.state.aiCopilotStreaming, '');
  assert.equal(app.state.intelligencePreparedQuestion, '');

  app.state.aiCopilotBusy = true;
  app.state.aiCopilotRequestId = 'req-2';
  runtime.intelligenceSwitchProfileMode(app, 'demo');
  assert.equal(cancelledCalls, 2);
  assert.equal(app.state.mode, 'demo');
  assert.equal(app.state.aiCopilotBusy, false);
});

test('D-05 & D-07 & C-12: trailing periods parse cleanly, conceptual prompts return unsupported, and split attribution uses parts', async () => {
  assert.equal(parseBrlCents('Quero economizar R$ 250.'), 25000);
  assert.equal(parseBrlCents('Economizar 1.200.'), 120000);

  const env = makeTempEnv();
  try {
    env.db.save('real', { version: 5, settings: { opening: 0, income: 500000, fixed: 0, existing: 0, reserve: 0 }, budgets: { Saúde: 5000 }, transactions: [] });
    env.db.ingestBank(ITEM1, {
      item: { status: 'UPDATED' },
      data: [{
        account: { id: ACC1, name: 'Conta A', type: 'BANK', subtype: 'CHECKING_ACCOUNT', currencyCode: 'BRL', balance: 3000 },
        transactions: [
          { id: 't-split', date: '2026-11-10', description: 'LOJA MISTA', amount: -300, status: 'POSTED', category: 'Compras' }
        ]
      }]
    });
    env.db.setBankSplits({
      accountId: ACC1,
      externalId: 't-split',
      parts: [{ category: 'Saúde', amount: 20000 }, { category: 'Lazer', amount: 10000 }]
    });
    const local = new LocalFinancialIntelligence(env.db, env.planner);
    const grant = local.authorize({ source: 'bank', profile: 'real', planning: true, consent: 'LOCAL_FINANCIAL_READ_V1' }, 31);
    const sav = recommendSavings({
      local,
      scope: { owner: 31, token: grant.token, source: 'bank', profile: 'real', month: '2026-11' },
      intention: { question: 'onde posso economizar neste mês?' }
    });
    const lazerOpp = (sav.opportunities || []).find((o) => o.categoryLabel === 'Lazer');
    const saudeOpp = (sav.opportunities || []).find((o) => o.categoryLabel === 'Saúde');
    const comprasOpp = (sav.opportunities || []).find((o) => o.categoryLabel === 'Compras');
    assert.ok(lazerOpp && lazerOpp.currentCents === 10000);
    assert.ok(saudeOpp && saudeOpp.currentCents === 20000);
    assert.equal(comprasOpp, undefined);

    const orch = new IntelligenceOrchestrator({ localFinancial: local, planner: env.planner });
    const conceptual = await orch.ask({
      token: grant.token,
      source: 'bank',
      profile: 'real',
      month: '2026-11',
      question: 'o que é reserva de emergência?'
    }, 31);
    assert.equal(conceptual.status, 'unsupported');

    const multiMonth = await orch.ask({
      token: grant.token,
      source: 'bank',
      profile: 'real',
      month: '2026-11',
      question: 'compare meus gastos dos últimos meses'
    }, 31);
    assert.match(multiMonth.answer, /Nota de escopo/i);
  } finally {
    env.cleanup();
  }
});

test('D-06 & D-09 & C-08 & C-10 & C-13 & C-16: salary refinements, zero allowance, estimated floor isolation, G/H warnings, F0b fallback', () => {
  const env = makeTempEnv();
  try {
    env.db.save('real', { version: 5, settings: { opening: 0, income: 500000, fixed: 0, existing: 0, reserve: 0 }, budgets: { Moradia: 100000 }, transactions: [] });
    env.db.ingestBank(ITEM1, {
      item: { status: 'UPDATED' },
      data: [{
        account: { id: ACC1, name: 'Conta A', type: 'BANK', subtype: 'CHECKING_ACCOUNT', currencyCode: 'BRL', balance: 5000 },
        transactions: [
          { id: 'c1', date: '2026-11-05', description: 'MORADIA', amount: -1200, status: 'POSTED', category: 'Moradia' },
          { id: 'b1', date: '2026-11-06', description: 'BONUS EXTRA', amount: 1500, status: 'POSTED', category: 'Outros' }
        ]
      }]
    });
    env.planner.create({
      title: 'Viagem incerta',
      kind: 'expense',
      amount: 90000,
      dueDate: '2026-11-28',
      category: 'Lazer',
      certainty: 'estimated'
    });

    const local = new LocalFinancialIntelligence(env.db, env.planner);
    const grant = local.authorize({ source: 'bank', profile: 'real', planning: true, consent: 'LOCAL_FINANCIAL_READ_V1' }, 41);
    const sessionCtx = new CopilotSessionContext();

    // Zero allowance
    assert.equal(parseMoneyToCents('0,00', { allowZero: true }), 0);
    const zeroDraft = interpretCopilotAction({
      local,
      planner: env.planner,
      scope: { owner: 41, token: grant.token, source: 'bank', profile: 'real', month: '2026-11' },
      owner: 41,
      sessionCtx,
      question: 'Deixe o orçamento de Moradia em R$ 0,00.'
    });
    assert.equal(zeroDraft.matched, true);
    assert.equal(zeroDraft.proposedLimitCents, 0);

    // Starter fallback + Scenarios G/H + estimated exclusion + locked protected category
    const cmd = parseSalaryBudgetCommand('Organize meu orçamento com salário de R$ 5.000, sem mexer em Moradia');
    assert.ok(cmd && cmd.protectedHints.some((h) => /moradia/i.test(h)));
    const proposal = buildSalaryBudgetProposal({
      db: env.db,
      planner: env.planner,
      source: 'bank',
      profile: 'real',
      month: '2026-11',
      salaryCents: 500000,
      lockedCategories: { Moradia: 100000 },
      protectedCategories: ['Moradia']
    });
    assert(proposal.warnings.some((w) => /estimadas \(incertas\)/i.test(w)));
    const lazerItem = (proposal.items || []).find((i) => i.category === 'Lazer');
    assert.equal(lazerItem?.committedFloorCents || 0, 0);
    assert(proposal.warnings.some((w) => /Moradia/i.test(w))); // Scenario G (locked 1000 < spent 1200)
    assert(proposal.warnings.some((w) => /outras categorias/i.test(w))); // Scenario H (non-Salário Bonus)

    // Refinement transfer command via sessionCtx
    sessionCtx.recordDraft({ owner: 41, token: grant.token, source: 'bank', profile: 'real', month: '2026-11' }, 41, proposal);
    const tr = interpretCopilotAction({
      local,
      planner: env.planner,
      scope: { owner: 41, token: grant.token, source: 'bank', profile: 'real', month: '2026-11' },
      owner: 41,
      sessionCtx,
      question: 'Transfira R$ 100 de Lazer para Alimentação'
    });
    assert.equal(tr.matched, true);
    assert.equal(tr.revision, 2);

    // Clear session drafts guard (C-07)
    const activeScope = { owner: 41, token: grant.token, source: 'bank', profile: 'real', month: '2026-11' };
    assert.ok(sessionCtx.get(activeScope, 41)?.activeSalaryDraft);
    sessionCtx.invalidateFinancialDrafts();
    assert.equal(sessionCtx.get(activeScope, 41)?.activeSalaryDraft, null);
  } finally {
    env.cleanup();
  }
});

test('C-01..C-19 SQLite, Pluggy, Category Service & Gateway guarantees', async () => {
  const env = makeTempEnv();
  try {
    // C-02 & C-14: 70-char category name + NOCASE uniqueness + delete guards
    const name70 = 'C'.repeat(70);
    env.db.upsertCategory({ name: name70, color: '#3e9a85', emoji: '✨', kind: 'expense' });
    assert.throws(() => env.db.upsertCategory({ name: name70.toLowerCase(), color: '#3e9a85', emoji: '✨', kind: 'expense' }), /já existe|duplicad/i);
    assert.throws(() => env.db.upsertCategory({ name: 'C'.repeat(71), color: '#3e9a85', emoji: '✨', kind: 'expense' }), /70|longo|máximo/i);

    env.db.setMonthlyBudget('real', '2026-11', name70, 50000);
    assert.throws(() => env.db.deleteCategory(name70), /orçamento|em uso/i);
    env.db.deleteMonthlyBudget('real', '2026-11', name70);
    assert.equal(env.db.effectiveBudgets('real', '2026-11')[name70], undefined);

    // C-03 & C-04: PIX DEVOLVIDO -> Reembolsos parity + unbounded bankOverview(limit:null)
    env.db.ingestBank(ITEM1, {
      item: { status: 'UPDATED' },
      data: [{
        account: { id: ACC1, name: 'Conta A', type: 'BANK', subtype: 'CHECKING_ACCOUNT', currencyCode: 'BRL', balance: 1000 },
        transactions: [
          { id: 'pix-dev', date: '2026-11-05', description: 'PIX DEVOLVIDO LOJA', amount: 150, status: 'POSTED', category: 'Moradia' }
        ]
      }]
    });
    const ov = env.db.bankOverview({ limit: null });
    assert.equal(ov.transactions[0].category, 'Reembolsos');
    const day = ov.dailyTotals.find((d) => d.date === '2026-11-05');
    assert.equal(day.incomeCategories[0].name, 'Reembolsos');

    // C-11: recordBankSyncFailure persistence
    env.db.recordBankSyncFailure(ITEM1, { status: 'LOGIN_ERROR' });
    const ovErr = env.db.bankOverview({ limit: 50 });
    assert.equal(ovErr.items.find((i) => i.itemId === ITEM1).status, 'LOGIN_ERROR');

    // C-05: rule constraints returned & evaluated cleanly inside D05CategoryService.bankView
    const svc = new D05CategoryService(env.db);
    const subC5 = svc.createSubcategory({ parentCategoryId: 'cat:alimentacao', name: 'Mercado C5', iconKey: 'utensils', hue: 120, kind: 'expense' });
    const ruleRes = env.db.upsertRule({ pattern: 'TESTEC5', matchMode: 'contains', category: 'Alimentação', scope: 'bank', priority: 50 });
    const insertedRule = (ruleRes.rules || []).find((r) => r.pattern === 'TESTEC5');
    assert.ok(insertedRule);
    env.db.db.prepare('UPDATE category_rules SET category_id=?, subcategory_id=? WHERE id=?').run('cat:alimentacao', subC5.id, insertedRule.id);
    env.db.db.prepare('INSERT INTO category_rule_constraints (rule_id, account_id, nature, after_rowid) VALUES (?, ?, ?, ?)').run(insertedRule.id, ACC1, 'expense', 0);
    env.db.ingestBank(ITEM1, {
      item: { status: 'UPDATED' },
      data: [{
        account: { id: ACC1, name: 'Conta A', type: 'BANK', subtype: 'CHECKING_ACCOUNT', currencyCode: 'BRL', balance: 1000 },
        transactions: [
          { id: 'rule-c5', date: '2026-11-06', description: 'COMPRA TESTEC5 SUPER', amount: -42.5, status: 'POSTED', category: 'Uncategorized' }
        ]
      }]
    });
    const bv = svc.bankView();
    const matchedRow = bv.items.find((r) => r.id === 'rule-c5');
    assert.ok(matchedRow && matchedRow.categoryId === 'cat:alimentacao' && matchedRow.subcategoryId === subC5.id);

    // C-15 & C-17 & C-19: Case-only category rename + double undo 'already_undone' + integrity check
    env.db.upsertCategory({ name: 'pets', color: '#3e9a85', emoji: '🐶', kind: 'expense' });
    const sess = { owner: 51, token: 'd05-c', profile: 'real', activeAccountId: ACC1 };
    const ev = { sender: { id: 51, isDestroyed: () => false } };
    const gate = new D05PersonalWriteGateway({
      finance: () => env.db,
      readSession: () => sess,
      confirm: async () => true,
      backupDirectory: () => env.backups,
      approvedForPersonal: () => false,
      m3CapabilityCheck: () => true
    });
    try {
      const prep = await gate.prepare(ev, { action: 'category.rename', profile: 'real', currentName: 'pets', newName: 'Pets' });
      const conf = await gate.confirmPreview(ev, { proposalId: prep.proposalId, nonce: prep.nonce });
      assert.equal(conf.status, 'applied');
      assert(env.db.listCategories().categories.some((c) => c.name === 'Pets'));

      const undo1 = await gate.undoReceipt(ev, { proposalId: prep.proposalId });
      assert.equal(undo1.status, 'undone');
      const confAfterUndo = await gate.confirmPreview(ev, { proposalId: prep.proposalId, nonce: prep.nonce });
      assert.equal(confAfterUndo.status, 'already_undone');
    } finally {
      gate.stopAll();
    }

    // C-18: Pluggy pagination validation & skipped non-BANK accounts
    const client = new PluggyClient({
      fetchFn: async (url) => {
        const u = String(url);
        if (u.endsWith('/auth')) return new Response(JSON.stringify({ apiKey: 'k' }), { status: 200 });
        if (u.endsWith('/items/' + ITEM1)) return new Response(JSON.stringify({ id: ITEM1, status: 'UPDATED' }), { status: 200 });
        if (u.includes('/accounts')) {
          return new Response(JSON.stringify({
            results: [
              { id: ACC1, type: 'BANK', currencyCode: 'BRL', name: 'Checking', balance: 100 },
              { id: 'cc-1', type: 'CREDIT', currencyCode: 'BRL', name: 'Card', balance: -500 }
            ]
          }), { status: 200 });
        }
        if (u.includes('/transactions')) {
          return new Response(JSON.stringify({ results: [], next: 'https://evil.example.com/v2/transactions?accountId=' + ACC1 }), { status: 200 });
        }
        return new Response('{}', { status: 404 });
      }
    });
    await client.authenticate('cid', 'sec');
    await assert.rejects(() => client.syncItem(ITEM1), /cursor|permitid/i);

    const client2 = new PluggyClient({
      fetchFn: async (url) => {
        const u = String(url);
        if (u.endsWith('/auth')) return new Response(JSON.stringify({ apiKey: 'k' }), { status: 200 });
        if (u.endsWith('/items/' + ITEM1)) return new Response(JSON.stringify({ id: ITEM1, status: 'UPDATED' }), { status: 200 });
        if (u.includes('/accounts')) {
          return new Response(JSON.stringify({
            results: [
              { id: ACC1, type: 'BANK', currencyCode: 'BRL', name: 'Checking', balance: 100 },
              { id: 'cc-1', type: 'CREDIT', currencyCode: 'BRL', name: 'Card', balance: -500 }
            ]
          }), { status: 200 });
        }
        if (u.includes('/transactions')) return new Response(JSON.stringify({ results: [], next: null }), { status: 200 });
        return new Response('{}', { status: 404 });
      }
    });
    await client2.authenticate('cid', 'sec');
    const synced = await client2.syncItem(ITEM1);
    assert.equal(synced.data.length, 1);
    assert.equal(synced.skippedAccounts.length, 1);
    assert.equal(synced.skippedAccounts[0].type, 'CREDIT');
  } finally {
    env.cleanup();
  }
});

test('D-10: src/app.ts exposes high reasoning effort option', () => {
  const appSrc = readSrc('src/app.ts');
  assert.match(appSrc, /aiEffort:'auto'\|'low'\|'medium'\|'high'/);
  const integSrc = readSrc('src/intelligence-integration.ts');
  assert.match(integSrc, /\['auto','low','medium','high'\]/);
});
