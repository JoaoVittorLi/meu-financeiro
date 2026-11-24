'use strict';
// M3 Slice 2 (M3-SALARY) — Salary-driven budget reorganization, canonical ledger averages,
// planned obligation protection without double counting, deficit honesty, and 1-click Undo.
// Synthetic TEMP SQLite only; never touches personal %APPDATA% or Pluggy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const { EventEmitter } = require('node:events');

const { FinanceDB } = require('../electron/db.cjs');
const { PlanningStore } = require('../electron/planning.cjs');
const { LocalFinancialIntelligence } = require('../electron/financial-intelligence.cjs');
const { D05PersonalWriteGateway } = require('../electron/d05-personal-gate.cjs');
const { interpretCopilotAction } = require('../electron/copilot-actions.cjs');
const {
  parseMoneyToCents,
  parseSalaryBudgetCommand,
  buildSalaryBudgetProposal
} = require('../electron/copilot-salary-budget.cjs');
const { generate } = require('../scripts/build-preload.cjs');

const ACCOUNT_A = 'aaaa4444-1111-4111-8111-111111111111';
const ITEM_A = 'bbbb4444-3333-4333-8333-333333333333';

function seedHistoryFinance() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-m3-s2-'));
  const dbPath = path.join(dir, 'synthetic.sqlite');
  const db = new FinanceDB(dbPath);
  const planner = new PlanningStore(db);
  const backups = path.join(dir, 'backups');
  fs.mkdirSync(backups, { recursive: true });

  // 3 complete prior months (2026-08, 2026-09, 2026-10) + current partial month (2026-11)
  // Plus a pending tx, a transfer, and a split tx in 2026-08..2026-10 to test single-source filters
  const bankTx = [];
  for (const ym of ['2026-08', '2026-09', '2026-10']) {
    bankTx.push(
      { id: `${ym}-rent`, date: `${ym}-05`, description: 'ALUGUEL RESIDENCIAL', amount: -2000, status: 'POSTED', category: 'Moradia' },
      { id: `${ym}-mkt`, date: `${ym}-12`, description: 'SUPERMERCADO TESTE', amount: -1200, status: 'POSTED', category: 'Alimentação' },
      { id: `${ym}-trp`, date: `${ym}-15`, description: 'POSTO DE GASOLINA', amount: -500, status: 'POSTED', category: 'Transporte' },
      { id: `${ym}-laz`, date: `${ym}-20`, description: 'CINEMA E RESTAURANTE', amount: -600, status: 'POSTED', category: 'Lazer' },
      // Must be excluded from expense averages:
      { id: `${ym}-pend`, date: `${ym}-22`, description: 'COMPRA PENDENTE', amount: -999, status: 'PENDING', category: 'Compras' },
      { id: `${ym}-trf`, date: `${ym}-25`, description: 'PIX CONTA PROPRIA', amount: -800, status: 'POSTED', category: 'Outros' }
    );
  }
  // Partial current month 2026-11: spent R$ 1.000 in Moradia (already linked to planned rent), R$ 400 in Alimentação
  bankTx.push(
    { id: '2026-11-rent-paid', date: '2026-11-05', description: 'PARTE ALUGUEL NOV', amount: -1000, status: 'POSTED', category: 'Moradia' },
    { id: '2026-11-mkt', date: '2026-11-08', description: 'SUPERMERCADO NOV', amount: -400, status: 'POSTED', category: 'Alimentação' }
  );

  db.ingestBank(ITEM_A, {
    item: { status: 'UPDATED' },
    data: [{
      account: { id: ACCOUNT_A, name: 'Conta S2', type: 'CHECKING', currencyCode: 'BRL', balance: 4500 },
      transactions: bankTx
    }]
  });

  // Mark internal transfers as transfer nature so canonical ledger excludes them
  for (const ym of ['2026-08', '2026-09', '2026-10']) {
    db.editBankTransaction({ accountId: ACCOUNT_A, externalId: `${ym}-trf`, nature: 'transfer' });
  }

  // Split one current-month tx if needed? Instead test splits on historical Lazer vs Saude:
  db.ingestBank(ITEM_A, {
    item: { status: 'UPDATED' },
    data: [{
      account: { id: ACCOUNT_A, name: 'Conta S2', type: 'CHECKING', currencyCode: 'BRL', balance: 4500 },
      transactions: [
        { id: '2026-10-split', date: '2026-10-18', description: 'LOJA MISTA', amount: -300, status: 'POSTED', category: 'Compras' }
      ]
    }]
  });
  db.setBankSplits({
    accountId: ACCOUNT_A,
    externalId: '2026-10-split',
    parts: [{ category: 'Saúde', amount: 20000 }, { category: 'Contas', amount: 10000 }]
  });

  // Planned items for 2026-11:
  // 1) Remaining half of rent (R$ 2.000 planned total, linked to R$ 1.000 paid -> remaining R$ 1.000 ONLY -> no double counting!)
  const rentPlan = planner.create({
    title: 'Aluguel Novembro',
    kind: 'expense',
    amount: 200000,
    dueDate: '2026-11-10',
    category: 'Moradia',
    accountId: ACCOUNT_A
  });
  planner.link({ itemId: rentPlan.ids[0], accountId: ACCOUNT_A, externalId: '2026-11-rent-paid' });
  // 2) Open unlinked Contas commitment R$ 350
  planner.create({
    title: 'Energia e Internet',
    kind: 'expense',
    amount: 35000,
    dueDate: '2026-11-20',
    category: 'Contas'
  });

  // Pre-existing limits & manual demo transactions (separate profile)
  db.save('real', {
    version: 5,
    settings: { opening: 0, income: 500000, fixed: 0, existing: 0, reserve: 0 },
    budgets: { Moradia: 180000, Lazer: 50000 },
    transactions: []
  });

  return {
    dir,
    db,
    planner,
    backups,
    cleanup: () => {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

test('M3-S2 Parser: understands PT-BR salary amounts, reserve targets, modes, and missing-salary clarification', () => {
  assert.equal(parseMoneyToCents('R$ 7.500,00'), 750000);
  assert.equal(parseMoneyToCents('7.500'), 750000);
  assert.equal(parseMoneyToCents('7,5 mil'), 750000);
  assert.equal(parseMoneyToCents('5800.50'), 580050);

  const p1 = parseSalaryBudgetCommand('Meu salário este mês é R$ 7.500, reorganize meus orçamentos');
  assert.equal(p1.salaryCents, 750000);
  assert.equal(p1.reserveGoalCents, null);
  assert.equal(p1.profileMode, 'balanced');

  const p2 = parseSalaryBudgetCommand('Recebi R$ 5.800 líquidos; quero guardar R$ 1.000 e distribuir o resto em modo conservador');
  assert.equal(p2.salaryCents, 580000);
  assert.equal(p2.reserveGoalCents, 100000);
  assert.equal(p2.profileMode, 'conservative');

  const p3 = parseSalaryBudgetCommand('Quero poupar 20% do meu salário de R$ 6.000 e atualizar minha renda');
  assert.equal(p3.salaryCents, 600000);
  assert.equal(p3.reserveGoalCents, 120000);
  assert.equal(p3.updateIncomeSetting, true);

  const p4 = parseSalaryBudgetCommand('Ajuste meus orçamentos para uma renda de R$ 4.500 preservando Moradia e Saúde');
  assert.equal(p4.salaryCents, 450000);
  assert.deepEqual(p4.protectedHints, ['moradia', 'saude']);

  const missing = parseSalaryBudgetCommand('Reorganize meus orçamentos com base no meu salário deste mês');
  assert.equal(missing.matched, true);
  assert.equal(missing.missingSalary, true);

  assert.equal(parseSalaryBudgetCommand('Quanto gastei em alimentação?'), null);
});

test('M3-S2 Engine: 3 complete months only, zero planned double-counting, exact cents invariant, and honest deficit', () => {
  const ctx = seedHistoryFinance();
  try {
    // Even with R$ 7.500 + odd cents (750003) -> exact conservation law holds!
    for (const [mode, salary] of [['conservative', 750003], ['balanced', 750001], ['flexible', 750002]]) {
      const prop = buildSalaryBudgetProposal({
        db: ctx.db,
        planner: ctx.planner,
        profile: 'real',
        source: 'bank',
        month: '2026-11',
        salaryCents: salary,
        profileMode: mode
      });
      assert.equal(prop.contract, 'MF3/SALARY-BUDGET-PROPOSAL-V1');
      assert.equal(prop.readOnly, true);
      assert.equal(prop.changesApplied, false);
      assert.equal(prop.completeMonthsAnalyzed, 3);
      assert.deepEqual(prop.monthsAnalyzed, ['2026-10', '2026-09', '2026-08']);
      assert.equal(prop.confidence, 'high');
      assert.equal(prop.deficit, false);

      // Exact integer conservation invariant
      assert.equal(
        prop.totalProposedLimitsCents + prop.proposedReserveCents + prop.unallocatedCents,
        salary,
        `Exact cent invariant failed for mode=${mode}`
      );

      // Check Moradia: spent R$ 1.000 + planned remaining R$ 1.000 = R$ 2.000 (NOT R$ 3.000 double-counted!)
      const moradia = prop.items.find((x) => x.category === 'Moradia');
      assert.equal(moradia.currentSpentCents, 100000);
      assert.equal(moradia.plannedRemainingCents, 100000);
      assert.equal(moradia.committedFloorCents, 200000);
      assert.ok(moradia.proposedLimitCents >= 200000);

      // Check Compras had ONLY PENDING tx + split parent -> 0 historical expense in Compras!
      const compras = prop.items.find((x) => x.category === 'Compras');
      assert.equal(compras?.historicalAvgCents ?? 0, 0);
      // Check Saúde split: 20.000 cents over 3 complete months -> avg 6667 cents
      const saude = prop.items.find((x) => x.category === 'Saúde');
      assert.equal(saude.historicalAvgCents, Math.round(20000 / 3));
    }

    // Deficit scenario: totalCommittedCents in 2026-11 = Moradia(200000) + Alimentação(40000) + Contas(35000) = 275000 cents (R$ 2.750)
    // Supplying salary R$ 2.200 (220000) must report deficit R$ 550 truthfully, reserve 0, and NEVER fake cuts below committed floor
    const defProp = buildSalaryBudgetProposal({
      db: ctx.db,
      planner: ctx.planner,
      profile: 'real',
      source: 'bank',
      month: '2026-11',
      salaryCents: 220000,
      profileMode: 'balanced'
    });
    assert.equal(defProp.deficit, true);
    assert.equal(defProp.deficitCents, 55000);
    assert.equal(defProp.proposedReserveCents, 0);
    assert.equal(defProp.totalCommittedCents, 275000);
    assert.equal(
      defProp.totalProposedLimitsCents + defProp.proposedReserveCents + defProp.unallocatedCents,
      220000
    );

    // Zero prior history scenario (e.g. demo manual profile with only partial/empty history) -> low confidence
    const sparse = buildSalaryBudgetProposal({
      db: ctx.db,
      planner: null,
      profile: 'demo',
      source: 'manual',
      month: '2026-11',
      salaryCents: 400000
    });
    assert.equal(sparse.completeMonthsAnalyzed, 0);
    assert.equal(sparse.confidence, 'low');
    assert.equal(
      sparse.totalProposedLimitsCents + sparse.proposedReserveCents + sparse.unallocatedCents,
      400000
    );

    // Chat interpreter integration: read grant -> MF3/SALARY-BUDGET-PROPOSAL-V1
    const local = new LocalFinancialIntelligence(ctx.db, ctx.planner);
    const grant = local.authorize({ source: 'bank', profile: 'real', planning: true, consent: 'LOCAL_FINANCIAL_READ_V1' }, 15);
    const chatDraft = interpretCopilotAction({
      local,
      planner: ctx.planner,
      scope: { owner: 15, token: grant.token, source: 'bank', profile: 'real', month: '2026-11' },
      owner: 15,
      question: 'Meu salário este mês é R$ 7.500, reorganize meus orçamentos preservando Moradia'
    });
    assert.equal(chatDraft.contract, 'MF3/SALARY-BUDGET-PROPOSAL-V1');
    assert.equal(chatDraft.salaryCents, 750000);
  } finally {
    ctx.cleanup();
  }
});

test('M3-S2 Gateway + IPC + Preload: budgets.reorganize apply, optional income update, verified backup & 1-click Undo', async () => {
  const ctx = seedHistoryFinance();
  try {
    let m3Enabled = false;
    const sessionState = { owner: 21, token: 'tok-s2', profile: 'real', activeAccountId: ACCOUNT_A };
    const event = { sender: { id: 21 } };
    const gate = new D05PersonalWriteGateway({
      finance: () => ctx.db,
      readSession: () => sessionState,
      confirm: async () => true,
      backupDirectory: () => ctx.backups,
      approvedForPersonal: () => false,
      m3CapabilityCheck: () => m3Enabled
    });

    // Fail-closed when opt-in is false
    const deniedPrev = await gate.prepare(event, {
      action: 'budgets.reorganize',
      profile: 'real',
      budgets: [{ category: 'Moradia', amountCents: 210000 }, { category: 'Alimentação', amountCents: 130000 }]
    });
    assert.equal(deniedPrev.personalWriteAuthorized, false);
    const deniedConf = await gate.confirmPreview(event, { proposalId: deniedPrev.proposalId, nonce: deniedPrev.nonce });
    assert.equal(deniedConf.status, 'denied');

    // Enable M3 opt-in -> apply update (Moradia existed=true 180000 -> 210000, Alimentação existed=false -> 130000) + income 500000 -> 750000
    m3Enabled = true;
    const prev = await gate.prepare(event, {
      action: 'budgets.reorganize',
      profile: 'real',
      budgets: [{ category: 'Moradia', amountCents: 210000 }, { category: 'Alimentação', amountCents: 130000 }],
      updateIncomeSetting: true,
      salaryCents: 750000
    });
    assert.equal(prev.personalWriteAuthorized, true);
    assert.equal(prev.affectedCount, 2);

    const applied = await gate.confirmPreview(event, { proposalId: prev.proposalId, nonce: prev.nonce });
    assert.equal(applied.status, 'applied');
    assert.equal(applied.changesApplied, true);
    assert.equal(applied.receipt.affectedCount, 2);
    assert.equal(applied.receipt.backupVerified, true);

    const afterLoaded = ctx.db.load('real');
    assert.equal(afterLoaded.budgets.Moradia, 210000);
    assert.equal(afterLoaded.budgets.Alimentação, 130000);
    assert.equal(afterLoaded.settings.income, 750000);

    // Undo restores exact prior budgets (Moradia=180000, Alimentação removed) AND prior income=500000
    const undone = await gate.undoReceipt(event, { proposalId: prev.proposalId });
    assert.equal(undone.status, 'undone');
    assert.ok(fs.statSync(undone.undoBackupPath).size > 0);
    const restored = ctx.db.load('real');
    assert.equal(restored.budgets.Moradia, 180000);
    assert.equal(Object.prototype.hasOwnProperty.call(restored.budgets, 'Alimentação'), false);
    assert.equal(restored.settings.income, 500000);

    // Apply again, then mutate Alimentação externally -> Undo must reject as stale!
    const prev2 = await gate.prepare(event, {
      action: 'budgets.reorganize',
      profile: 'real',
      budgets: [{ category: 'Moradia', amountCents: 220000 }, { category: 'Alimentação', amountCents: 140000 }]
    });
    await gate.confirmPreview(event, { proposalId: prev2.proposalId, nonce: prev2.nonce });
    ctx.db.db.prepare("UPDATE budgets SET amount_cents=150000 WHERE profile='real' AND category='Alimentação'").run();
    const stale = await gate.undoReceipt(event, { proposalId: prev2.proposalId });
    assert.equal(stale.status, 'stale');
    assert.equal(stale.changesApplied, false);
  } finally {
    ctx.cleanup();
  }
});

test('M3-S2 End-to-End IPC + Preload: copilotSalaryBudgetPropose + apply + undo keeps 26 d05 keys', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-m3-s2-ipc-'));
  const appDataDir = path.join(root, 'appData');
  const userDataDir = path.join(root, 'userData');
  fs.mkdirSync(path.join(appDataDir, 'Meu Financeiro'), { recursive: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  const dbPath = path.join(appDataDir, 'Meu Financeiro', 'meu-financeiro.sqlite');
  const seed = new FinanceDB(dbPath);
  seed.save('real', {
    version: 5,
    settings: { opening: 0, income: 500000, fixed: 0, existing: 0, reserve: 0 },
    budgets: { Moradia: 150000 },
    transactions: [
      { id: 't1', date: '2026-09-10', description: 'ALUGUEL', kind: 'expense', amount: 160000, category: 'Moradia' },
      { id: 't2', date: '2026-10-10', description: 'ALUGUEL', kind: 'expense', amount: 160000, category: 'Moradia' },
      { id: 't3', date: '2026-10-15', description: 'MERCADO', kind: 'expense', amount: 90000, category: 'Alimentação' }
    ]
  });
  seed.close();

  const handlers = new Map();
  const appEmitter = new EventEmitter();
  const paths = { appData: appDataDir, userData: userDataDir };
  let winInstance = null;

  class MockBrowserWindow {
    constructor() {
      winInstance = this;
      this.webContents = { id: 91, isDestroyed: () => false, on: () => {}, setWindowOpenHandler: () => {}, send: () => {}, reload: () => {} };
    }
    once(ev, fn) { if (ev === 'ready-to-show') setImmediate(fn); }
    show() {}
    loadFile() {}
    isDestroyed() { return false; }
    isFocused() { return true; }
    isMinimized() { return false; }
    static getAllWindows() { return winInstance ? [winInstance] : []; }
  }

  const fakeSession = {
    setPermissionRequestHandler: () => {},
    setPermissionCheckHandler: () => {},
    webRequest: { onBeforeRequest: () => {} },
    cookies: { get: async () => [], set: async () => {}, remove: async () => {} },
    fetch: async () => ({ ok: false, status: 503 })
  };
  const electronMock = {
    app: {
      isPackaged: true,
      getName: () => 'Meu Financeiro',
      getVersion: () => '0.9.5-beta.9',
      getPath: (k) => paths[k] || path.join(root, k),
      setPath: (k, v) => { paths[k] = v; },
      requestSingleInstanceLock: () => true,
      setAppUserModelId: () => {},
      whenReady: () => Promise.resolve(),
      on: (ev, fn) => appEmitter.on(ev, fn),
      emit: (ev, ...a) => appEmitter.emit(ev, ...a),
      quit: () => {}
    },
    BrowserWindow: MockBrowserWindow,
    session: { defaultSession: fakeSession, fromPartition: () => fakeSession },
    ipcMain: { handle: (ch, fn) => handlers.set(ch, fn) },
    dialog: {
      showMessageBox: async () => ({ response: 1 }),
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      showSaveDialog: async () => ({ canceled: true, filePath: '' }),
      showErrorBox: (t, m) => { throw Error(t + ': ' + m); }
    },
    shell: { openPath: async () => '', openExternal: async () => {} },
    safeStorage: { isEncryptionAvailable: () => false, encryptString: (s) => Buffer.from(s), decryptString: (b) => b.toString() }
  };

  const mainPath = require.resolve('../electron/main.cjs');
  const releaseChannelPath = require.resolve('../electron/release-channel.cjs');
  const pkgPath = require.resolve('../package.json');
  const realPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  delete require.cache[mainPath];
  delete require.cache[releaseChannelPath];
  delete require.cache[pkgPath];

  const origLoad = Module._load;
  Module._load = function (req, parent, isMain) {
    if (req === 'electron') return electronMock;
    if (req === '../package.json' && parent?.filename === releaseChannelPath) {
      return { ...realPkg, mfDistributionChannel: 'stable' };
    }
    return origLoad.call(this, req, parent, isMain);
  };
  try { require(mainPath); } finally { Module._load = origLoad; }

  for (let i = 0; i < 40 && !handlers.has('copilot:salary-budget-propose'); i++) {
    await new Promise((r) => setTimeout(r, 15));
  }
  const ev = { sender: winInstance.webContents, senderFrame: { url: 'file:///app/index.html' } };
  for (let i = 0; i < 60; i++) {
    const b = await handlers.get('finance:backup-status')(ev);
    if (b.copies >= 1) break;
    await new Promise((r) => setTimeout(r, 15));
  }

  try {
    let exposed = null;
    vm.runInNewContext(generate(path.resolve(__dirname, '..')), {
      require: (name) => {
        assert.equal(name, 'electron');
        return {
          contextBridge: { exposeInMainWorld: (_n, api) => { exposed = api; } },
          ipcRenderer: {
            invoke: async (ch, ...args) => {
              const fn = handlers.get(ch);
              assert.ok(fn, 'Missing handler ' + ch);
              return await fn(ev, ...args);
            },
            on: () => {},
            removeListener: () => {}
          }
        };
      }
    });

    assert.equal(Object.keys(exposed).filter((k) => k.startsWith('d05')).length, 26);

    const proposal = await exposed.copilotSalaryBudgetPropose({
      profile: 'real',
      source: 'manual',
      month: '2026-11',
      salaryCents: 600000,
      profileMode: 'balanced'
    });
    assert.equal(proposal.contract, 'MF3/SALARY-BUDGET-PROPOSAL-V1');
    assert.equal(proposal.completeMonthsAnalyzed, 2);
    assert.equal(
      proposal.totalProposedLimitsCents + proposal.proposedReserveCents + proposal.unallocatedCents,
      600000
    );

    await exposed.copilotActionCapabilityEnable();
    await exposed.d05SessionAuthorize({ profile: 'real' });
    const budgetsPayload = proposal.items.slice(0, 3).map((i) => ({
      category: i.category,
      amountCents: i.proposedLimitCents
    }));
    const prep = await exposed.copilotActionPrepare({
      action: 'budgets.reorganize',
      profile: 'real',
      budgets: budgetsPayload,
      updateIncomeSetting: true,
      salaryCents: 600000
    });
    assert.equal(prep.personalWriteAuthorized, true);

    const applied = await exposed.copilotActionConfirm({ proposalId: prep.proposalId, nonce: prep.nonce });
    assert.equal(applied.status, 'applied');
    const loaded = await exposed.load('real');
    assert.equal(loaded.settings.income, 600000);
    assert.equal(loaded.budgets[budgetsPayload[0].category], budgetsPayload[0].amountCents);

    const undone = await exposed.copilotActionUndo({ proposalId: prep.proposalId });
    assert.equal(undone.status, 'undone');
    const reverted = await exposed.load('real');
    assert.equal(reverted.settings.income, 500000);
    assert.equal(reverted.budgets.Moradia, 150000);
  } finally {
    appEmitter.emit('before-quit');
    delete require.cache[mainPath];
    delete require.cache[releaseChannelPath];
    delete require.cache[pkgPath];
    await new Promise((r) => setTimeout(r, 40));
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch {}
  }
});

test('M3-S2 Full Spec: 6m/3m averages, atypical outlier trimming, received salary check, locks, redistributions & month-only scope', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-m3-s2-full-'));
  const dbPath = path.join(dir, 'full.sqlite');
  let db = new FinanceDB(dbPath);
  const planner = new PlanningStore(db);
  const backups = path.join(dir, 'backups');
  fs.mkdirSync(backups, { recursive: true });

  try {
    // 6 complete months prior to 2026-11: Alimentacao over-budgeted (limit 100000, avg 50000),
    // Transporte under-budgeted (limit 25000, avg 40000), Saude has an atypical outlier spike in 2026-07 (95000 vs ~15000 normal)
    const manualTx = [];
    for (const [idx, ym] of ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].entries()) {
      manualTx.push(
        { id: `sal-${ym}`, date: `${ym}-04`, description: 'SALARIO', kind: 'income', amount: 420000, category: 'Salário' },
        { id: `mor-${ym}`, date: `${ym}-05`, description: 'ALUGUEL', kind: 'expense', amount: 150000, category: 'Moradia' },
        { id: `ali-${ym}`, date: `${ym}-10`, description: 'MERCADO', kind: 'expense', amount: 50000, category: 'Alimentação' },
        { id: `trp-${ym}`, date: `${ym}-12`, description: 'TRANSPORTE', kind: 'expense', amount: 40000, category: 'Transporte' },
        { id: `sau-${ym}`, date: `${ym}-16`, description: 'SAUDE', kind: 'expense', amount: idx === 2 ? 95000 : 15000, category: 'Saúde' }
      );
    }
    // Current month 2026-11 ALREADY has salary received in statement
    manualTx.push(
      { id: 'sal-2026-11', date: '2026-11-04', description: 'SALARIO NOV', kind: 'income', amount: 420000, category: 'Salário' },
      { id: 'trp-2026-11', date: '2026-11-06', description: 'TRANSPORTE NOV', kind: 'expense', amount: 30000, category: 'Transporte' }
    );
    db.save('real', {
      version: 5,
      settings: { opening: 100000, income: 400000, fixed: 150000, existing: 0, reserve: 50000 },
      budgets: { Moradia: 150000, Alimentação: 100000, Transporte: 25000, Saúde: 10000 },
      transactions: manualTx
    });

    const p1 = buildSalaryBudgetProposal({
      db,
      planner,
      profile: 'real',
      source: 'manual',
      month: '2026-11',
      salaryCents: 420000,
      profileMode: 'balanced',
      lockedCategories: { Lazer: 15000 }
    });
    assert.equal(p1.completeMonthsAnalyzed, 6);
    assert.equal(p1.salaryStatus, 'received_in_statement');
    assert.equal(p1.observedSalaryCents, 420000);
    assert.equal(p1.applyRecurring, false);
    assert.ok(p1.incomeVsBalanceNote.includes('saldo bancário'));
    assert.ok(p1.atypicalMonths.some((a) => a.category === 'Saúde' && a.month === '2026-07'), 'Outlier in 2026-07 detected');
    const saude = p1.items.find((i) => i.category === 'Saúde');
    assert.equal(saude.atypicalDetected, true);
    assert.ok(saude.avg3mCents === 15000 && saude.avg6mCents > 15000);
    const lazer = p1.items.find((i) => i.category === 'Lazer');
    assert.equal(lazer.isLocked, true);
    assert.equal(lazer.proposedLimitCents, 15000);
    assert.ok(p1.redistributions.some((r) => r.fromCategory === 'Alimentação' && (r.toCategory === 'Transporte' || r.toCategory === 'Saúde')));

    // Month-scoped commit must update monthly_budgets for 2026-11 while leaving recurring `budgets` intact
    const sess = { owner: 55, token: 'tok', profile: 'real', activeAccountId: null };
    const gate = new D05PersonalWriteGateway({
      finance: () => db,
      readSession: () => sess,
      confirm: async () => true,
      backupDirectory: () => backups,
      approvedForPersonal: () => false,
      m3CapabilityCheck: () => true
    });
    const ev = { sender: { id: 55 } };
    const prep = await gate.prepare(ev, {
      action: 'budgets.reorganize',
      profile: 'real',
      month: '2026-11',
      applyRecurring: false,
      budgets: [
        { category: 'Alimentação', amountCents: 60000 },
        { category: 'Transporte', amountCents: 42000 },
        { category: 'Lazer', amountCents: 15000 }
      ]
    });
    const res = await gate.confirmPreview(ev, { proposalId: prep.proposalId, nonce: prep.nonce });
    assert.equal(res.status, 'applied', res.reason || 'should apply');

    // Close & reopen DB cleanly to prove SQLite persistence across restart
    db.close();
    db = new FinanceDB(dbPath);
    const loaded = db.load('real');
    assert.equal(loaded.budgets.Alimentação, 100000, 'Recurring limit for Alimentação untouched for other months');
    assert.equal(loaded.monthlyBudgets['2026-11'].Alimentação, 60000, 'Monthly override persisted');
    assert.equal(loaded.monthlyBudgets['2026-11'].Transporte, 42000);
    assert.equal(loaded.monthlyBudgets['2026-11'].Lazer, 15000);

    // LocalFinancialIntelligence must read the monthly limit for 2026-11
    const local = new LocalFinancialIntelligence(db, new PlanningStore(db));
    const auth = local.authorize({ source: 'manual', profile: 'real', planning: false, consent: 'LOCAL_FINANCIAL_READ_V1' }, 55);
    const qBudgets = local.query({ token: auth.token, intent: 'budgets', month: '2026-11' }, 55);
    const bTrp = qBudgets.facts.budgets.find((b) => b.category === 'Transporte');
    assert.equal(bTrp.limitCents, 42000);

    // Undo restores exact prior monthly state
    const undoSess = { owner: 55, token: 'tok', profile: 'real', activeAccountId: null };
    const gateUndo = new D05PersonalWriteGateway({
      finance: () => db,
      readSession: () => undoSess,
      confirm: async () => true,
      backupDirectory: () => backups,
      approvedForPersonal: () => false,
      m3CapabilityCheck: () => true
    });
    const undone = await gateUndo.undoReceipt(ev, { proposalId: prep.proposalId });
    assert.equal(undone.status, 'undone');
    assert.deepEqual(db.getMonthlyBudgets('real', '2026-11'), {});
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
