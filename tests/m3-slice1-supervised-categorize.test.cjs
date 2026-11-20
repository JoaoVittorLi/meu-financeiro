'use strict';
// M3 Slice 1 — Supervised Categorization (single + batch, disambiguation, D05 hierarchy,
// native confirmation, verified SQLite backup, receipt, 1-click Undo, and preload boundary).
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
const { LocalFinancialIntelligence } = require('../electron/financial-intelligence.cjs');
const { D05PersonalWriteGateway } = require('../electron/d05-personal-gate.cjs');
const { D05CategoryService } = require('../electron/d05-category-service.cjs');
const {
  parseCategorizeCommand,
  resolveD05Target,
  interpretCopilotAction
} = require('../electron/copilot-actions.cjs');
const { generate } = require('../scripts/build-preload.cjs');

const ACCOUNT_A = 'aaaa1111-1111-4111-8111-111111111111';
const ACCOUNT_B = 'bbbb2222-2222-4222-8222-222222222222';
const ITEM_A = 'cccc3333-3333-4333-8333-333333333333';

function createTempFinance() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-m3-s1-'));
  const dbPath = path.join(dir, 'synthetic.sqlite');
  const db = new FinanceDB(dbPath);
  const backups = path.join(dir, 'backups');
  fs.mkdirSync(backups, { recursive: true });

  db.ingestBank(ITEM_A, {
    item: { status: 'UPDATED' },
    data: [
      {
        account: { id: ACCOUNT_A, name: 'Conta Corrente Principal', type: 'CHECKING', currencyCode: 'BRL', balance: 5000 },
        transactions: [
          { id: 'bh-1', date: '2026-11-05', description: 'SUPERMERCADO BH LOJA 12 <script>', amount: -145.9, status: 'POSTED', category: 'Uncategorized' },
          { id: 'bh-2', date: '2026-11-12', description: 'SUPERMERCADO BH EXPRESS', amount: -82.3, status: 'POSTED', category: 'Uncategorized' },
          { id: 'bh-pend', date: '2026-11-14', description: 'SUPERMERCADO BH PENDENTE', amount: -50.0, status: 'PENDING', category: 'Uncategorized' },
          { id: 'bh-split', date: '2026-11-10', description: 'SUPERMERCADO BH ATACADO', amount: -200.0, status: 'POSTED', category: 'Uncategorized' },
          { id: 'bh-trf', date: '2026-11-11', description: 'SUPERMERCADO BH PIX PROPRIO', amount: -100.0, status: 'POSTED', category: 'Transfer' },
          { id: 'drog-1', date: '2026-11-15', description: 'DROGASIL FILIAL 09', amount: -64.5, status: 'POSTED', category: 'Uncategorized' }
        ]
      },
      {
        account: { id: ACCOUNT_B, name: 'Cartão Reserva', type: 'CREDIT', currencyCode: 'BRL', balance: -900 },
        transactions: [
          { id: 'bh-b1', date: '2026-11-09', description: 'SUPERMERCADO BH CARTAO', amount: -110.0, status: 'POSTED', category: 'Uncategorized' }
        ]
      }
    ]
  });

  db.setBankSplits({
    accountId: ACCOUNT_A,
    externalId: 'bh-split',
    parts: [{ category: 'Alimentação', amount: 12000 }, { category: 'Moradia', amount: 8000 }]
  });
  db.editBankTransaction({ accountId: ACCOUNT_A, externalId: 'bh-trf', nature: 'transfer' });

  db.save('real', {
    version: 5,
    settings: { opening: 0, income: 0, fixed: 0, existing: 0, reserve: 0 },
    budgets: {},
    transactions: [
      { id: 'm-1', date: '2026-11-03', description: 'SUPERMERCADO BH CENTRO', kind: 'expense', amount: 9500, category: 'Outros' },
      { id: 'm-2', date: '2026-11-08', description: 'SUPERMERCADO BH BAIRRO', kind: 'expense', amount: 4200, category: 'Outros' }
    ]
  });

  return {
    dir,
    db,
    backups,
    cleanup: () => {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

test('M3-S1 Parser & Interpreter: separates future rules, strips injection, detects ambiguity & exclusions', () => {
  const ctx = createTempFinance();
  try {
    const parsed1 = parseCategorizeCommand(
      'Coloque minhas compras do Supermercado BH em Alimentação > Supermercados e crie uma regra para as próximas movimentações'
    );
    assert.equal(parsed1.merchantQuery, 'Supermercado BH');
    assert.equal(parsed1.targetRaw, 'Alimentação › Supermercados');
    assert.equal(parsed1.futureRuleRequested, true);

    const parsed2 = parseCategorizeCommand('Recategorize a compra de 15/11 da Drogasil como Saúde > Farmácia');
    assert.equal(parsed2.merchantQuery, 'Drogasil');
    assert.equal(parsed2.targetRaw, 'Saúde › Farmácia');
    assert.equal(parsed2.futureRuleRequested, false);

    const local = new LocalFinancialIntelligence(ctx.db, null);
    const bankGrant = local.authorize({ source: 'bank', profile: 'real', planning: false, consent: 'LOCAL_FINANCIAL_READ_V1' }, 10);
    const draft = interpretCopilotAction({
      local,
      scope: { owner: 10, token: bankGrant.token, source: 'bank', profile: 'real', month: '2026-11' },
      owner: 10,
      question: 'Coloque minhas compras do Supermercado BH em Alimentação > Supermercados e crie uma regra para as próximas movimentações'
    });

    assert.equal(draft.matched, true);
    assert.equal(draft.contract, 'MF3/ACTION-DRAFT-V1');
    assert.equal(draft.status, 'ready');
    assert.equal(draft.readOnly, true);
    assert.equal(draft.changesApplied, false);
    assert.deepEqual(draft.target, { categoryId: 'cat:alimentacao', subcategoryId: 'sub:alimentacao/supermercados' });
    assert.equal(draft.targetLabel, 'Alimentação › Supermercados');
    assert.equal(draft.eligibleCount, 3); // bh-1, bh-2 (Account A) + bh-b1 (Account B)
    assert.equal(draft.excludedBySafetyCount, 3); // pending, split, transfer
    assert.equal(draft.ambiguousAccounts, true);
    assert.equal(draft.ambiguousMerchants, true);
    assert.equal(draft.futureRuleRequested, true);
    assert.match(draft.futureRuleNotice, /etapas distintas/);

    // Verify zero rules were created and HTML tags were stripped from merchant description
    assert.equal(ctx.db.db.prepare('SELECT COUNT(*) AS n FROM category_rules').get().n, 0);
    const bh1 = draft.items.find((x) => x.id === 'bh-1');
    assert.ok(bh1 && !bh1.description.includes('<script>'));

    // Cross-source guardrail: ask for bank items while authorized on manual grant
    const manualGrant = local.authorize({ source: 'manual', profile: 'real', planning: false, consent: 'LOCAL_FINANCIAL_READ_V1' }, 10);
    const mismatch = interpretCopilotAction({
      local,
      scope: { owner: 10, token: manualGrant.token, source: 'manual', profile: 'real', month: '2026-11' },
      owner: 10,
      question: 'Categorize as compras do banco da Drogasil como Saúde > Farmácia'
    });
    assert.equal(mismatch.status, 'needs_clarification');
    assert.equal(mismatch.eligibleCount, 0);

    // Unknown target D05 yields clarification
    const badTarget = resolveD05Target('Alimentação > Inexistente', new D05CategoryService(ctx.db).listCatalog().parents);
    assert.equal(badTarget.ok, false);
    assert.equal(badTarget.reason, 'unknown_subcategory');
  } finally {
    ctx.cleanup();
  }
});

test('M3-S1 Gateway: batch apply + verified backup + 1-click Undo + double-undo & external-edit guards', async () => {
  const ctx = createTempFinance();
  try {
    let m3Enabled = false;
    let sessionState = { owner: 7, token: 'sess-1', profile: 'real', activeAccountId: ACCOUNT_A };
    const event = { sender: { id: 7 } };

    const gate = new D05PersonalWriteGateway({
      finance: () => ctx.db,
      readSession: () => sessionState,
      confirm: async () => true,
      backupDirectory: () => ctx.backups,
      approvedForPersonal: () => false,
      m3CapabilityCheck: () => m3Enabled
    });

    // Hard fail-closed lock when M3 opt-in is not granted
    const blockedPreview = await gate.prepare(event, {
      action: 'manual.batch-categorize',
      profile: 'real',
      items: [{ id: 'm-1' }, { id: 'm-2' }],
      target: { categoryId: 'cat:alimentacao', subcategoryId: 'sub:alimentacao/supermercados' }
    });
    assert.equal(blockedPreview.personalWriteAuthorized, false);
    const blockedConfirm = await gate.confirmPreview(event, {
      proposalId: blockedPreview.proposalId,
      nonce: blockedPreview.nonce
    });
    assert.equal(blockedConfirm.status, 'denied');
    assert.equal(blockedConfirm.changesApplied, false);

    // Enable M3 capability opt-in -> manual batch categorize + Undo
    m3Enabled = true;
    const manualPreview = await gate.prepare(event, {
      action: 'manual.batch-categorize',
      profile: 'real',
      items: [{ id: 'm-1' }, { id: 'm-2' }],
      target: { categoryId: 'cat:alimentacao', subcategoryId: 'sub:alimentacao/supermercados' }
    });
    assert.equal(manualPreview.personalWriteAuthorized, true);
    assert.equal(manualPreview.affectedCount, 2);

    const manualApplied = await gate.confirmPreview(event, {
      proposalId: manualPreview.proposalId,
      nonce: manualPreview.nonce
    });
    assert.equal(manualApplied.status, 'applied');
    assert.equal(manualApplied.changesApplied, true);
    assert.equal(manualApplied.undoState, 'available');
    assert.equal(manualApplied.receipt.backupVerified, true);

    const updatedM1 = ctx.db.db.prepare("SELECT category,category_id,subcategory_id FROM transactions WHERE profile='real' AND id='m-1'").get();
    assert.equal(updatedM1.category, 'Alimentação');
    assert.equal(updatedM1.category_id, 'cat:alimentacao');
    assert.equal(updatedM1.subcategory_id, 'sub:alimentacao/supermercados');

    // Undo restores exact prior state (category='Outros', null IDs) & blocks double-undo
    const undone = await gate.undoReceipt(event, { proposalId: manualPreview.proposalId });
    assert.equal(undone.status, 'undone');
    assert.ok(fs.statSync(undone.undoBackupPath).size > 0);
    const restoredM1 = ctx.db.db.prepare("SELECT category,category_id,subcategory_id FROM transactions WHERE profile='real' AND id='m-1'").get();
    assert.equal(restoredM1.category, 'Outros');
    assert.equal(restoredM1.category_id, null);

    const doubleUndo = await gate.undoReceipt(event, { proposalId: manualPreview.proposalId });
    assert.equal(doubleUndo.status, 'already_undone');

    // Bank batch categorize + Undo deleting null overrides + stale block after external edit
    const svc = new D05CategoryService(ctx.db);
    const bankTarget = { categoryId: 'cat:alimentacao', subcategoryId: 'sub:alimentacao/supermercados' };
    const batchItems = [
      { accountId: ACCOUNT_A, externalId: 'bh-1' },
      { accountId: ACCOUNT_A, externalId: 'bh-2' }
    ];
    const bankBatchPrev = svc.previewBankBatch({ items: batchItems, target: bankTarget });
    const bankPreview = await gate.prepare(event, {
      action: 'bank.batch-categorize',
      profile: 'real',
      accountId: ACCOUNT_A,
      items: batchItems,
      target: bankTarget,
      previewVersion: bankBatchPrev.previewVersion
    });
    const bankApplied = await gate.confirmPreview(event, {
      proposalId: bankPreview.proposalId,
      nonce: bankPreview.nonce,
      accountId: ACCOUNT_A
    });
    assert.equal(bankApplied.status, 'applied');
    assert.equal(
      ctx.db.db.prepare("SELECT subcategory_id FROM bank_category_overrides WHERE account_id=? AND external_id='bh-1'").get(ACCOUNT_A).subcategory_id,
      'sub:alimentacao/supermercados'
    );

    // Undo deletes previously non-existent overrides cleanly
    const bankUndone = await gate.undoReceipt(event, { proposalId: bankPreview.proposalId, accountId: ACCOUNT_A });
    assert.equal(bankUndone.status, 'undone');
    assert.equal(
      ctx.db.db.prepare("SELECT * FROM bank_category_overrides WHERE account_id=? AND external_id='bh-1'").get(ACCOUNT_A),
      undefined
    );

    // Apply again, then mutate bh-1 externally -> undo MUST refuse as stale!
    const bankPreview2 = await gate.prepare(event, {
      action: 'bank.batch-categorize',
      profile: 'real',
      accountId: ACCOUNT_A,
      items: batchItems,
      target: bankTarget,
      previewVersion: svc.previewBankBatch({ items: batchItems, target: bankTarget }).previewVersion
    });
    await gate.confirmPreview(event, { proposalId: bankPreview2.proposalId, nonce: bankPreview2.nonce, accountId: ACCOUNT_A });
    svc.assignBank({ accountId: ACCOUNT_A, externalId: 'bh-1', target: { categoryId: 'cat:compras', subcategoryId: null } });

    const staleUndo = await gate.undoReceipt(event, { proposalId: bankPreview2.proposalId, accountId: ACCOUNT_A });
    assert.equal(staleUndo.status, 'stale');
    assert.equal(staleUndo.changesApplied, false);
  } finally {
    ctx.cleanup();
  }
});

test('M3-S1 End-to-End IPC + Preload: stable capability opt-in, bank batch apply/undo, while IPC-06 remains intact', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-m3-ipc-'));
  const appDataDir = path.join(root, 'appData');
  const userDataDir = path.join(root, 'userData');
  fs.mkdirSync(path.join(appDataDir, 'Meu Financeiro'), { recursive: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  const dbPath = path.join(appDataDir, 'Meu Financeiro', 'meu-financeiro.sqlite');
  const seed = new FinanceDB(dbPath);
  seed.ingestBank(ITEM_A, {
    item: { status: 'UPDATED' },
    data: [{
      account: { id: ACCOUNT_A, name: 'Conta Principal', type: 'CHECKING', currencyCode: 'BRL', balance: 2500 },
      transactions: [
        { id: 'drog-a', date: '2026-11-15', description: 'DROGASIL 01', amount: -35, status: 'POSTED', category: 'Uncategorized' },
        { id: 'drog-b', date: '2026-11-16', description: 'DROGASIL 02', amount: -45, status: 'POSTED', category: 'Uncategorized' }
      ]
    }]
  });
  seed.close();

  const handlers = new Map();
  let nextResponse = 1;
  const appEmitter = new EventEmitter();
  const paths = { appData: appDataDir, userData: userDataDir };
  let winInstance = null;

  class MockBrowserWindow {
    constructor() {
      winInstance = this;
      this.webContents = { id: 88, isDestroyed: () => false, on: () => {}, setWindowOpenHandler: () => {}, send: () => {}, reload: () => {} };
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
      showMessageBox: async () => ({ response: nextResponse }),
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

  for (let i = 0; i < 40 && !handlers.has('copilot:action-interpret'); i++) {
    await new Promise((r) => setTimeout(r, 15));
  }
  const ev = { sender: winInstance.webContents, senderFrame: { url: 'file:///app/index.html' } };
  for (let i = 0; i < 60; i++) {
    const b = await handlers.get('finance:backup-status')(ev);
    if (b.copies >= 1) break;
    await new Promise((r) => setTimeout(r, 15));
  }

  try {
    // Run bundled preload in sandbox VM wired to main.cjs IPC handlers
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
    await assert.rejects(exposed.copilotActionPrepare({ action: 'bank.categorize' }), /autorize sessão/);

    // Initially disabled on fresh DB
    const cap0 = await exposed.copilotActionCapabilityStatus();
    assert.equal(cap0.available, true);
    assert.equal(cap0.enabled, false);
    assert.equal(cap0.personalWriteApproved, false);

    // Enable capability -> authorize read + d05 + bank account -> interpret -> prepare -> confirm -> undo -> revoke
    const enabledRes = await exposed.copilotActionCapabilityEnable();
    assert.equal(enabledRes.enabled, true);

    const readGrant = await exposed.localFinancialAuthorize({ source: 'bank', profile: 'real', planning: false, consent: 'LOCAL_FINANCIAL_READ_V1' });
    const draft = await exposed.copilotActionInterpret({
      token: readGrant.token,
      source: 'bank',
      profile: 'real',
      month: '2026-11',
      question: 'Coloque a compra de 15/11 da Drogasil em Saúde > Farmácia'
    });
    assert.equal(draft.status, 'ready');
    assert.equal(draft.eligibleCount, 2);

    await exposed.d05SessionAuthorize({ profile: 'real' });
    await exposed.d05BankAccountAuthorize({ accountId: ACCOUNT_A });
    const batchItems = draft.items.map((x) => ({ accountId: x.accountId, externalId: x.externalId }));
    const batchPrev = await exposed.d05BankBatchPreview({ items: batchItems, target: draft.target });
    const prepared = await exposed.copilotActionPrepare({
      action: 'bank.batch-categorize',
      profile: 'real',
      accountId: ACCOUNT_A,
      items: batchItems,
      target: draft.target,
      previewVersion: batchPrev.previewVersion
    });
    assert.equal(prepared.personalWriteAuthorized, true);

    const applied = await exposed.copilotActionConfirm({
      proposalId: prepared.proposalId,
      nonce: prepared.nonce,
      accountId: ACCOUNT_A
    });
    assert.equal(applied.status, 'applied');
    assert.equal(applied.changesApplied, true);

    const receipts = await exposed.copilotActionReceipts({ limit: 5 });
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].undoState, 'available');

    const undone = await exposed.copilotActionUndo({ proposalId: prepared.proposalId, accountId: ACCOUNT_A });
    assert.equal(undone.status, 'undone');

    const revoked = await exposed.copilotActionCapabilityRevoke();
    assert.equal(revoked.enabled, false);
  } finally {
    appEmitter.emit('before-quit');
    delete require.cache[mainPath];
    delete require.cache[releaseChannelPath];
    delete require.cache[pkgPath];
    await new Promise((r) => setTimeout(r, 40));
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch {}
  }
});
