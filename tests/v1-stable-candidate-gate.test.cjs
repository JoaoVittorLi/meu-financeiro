'use strict';
// V1.0.0-RC.1 Stable Release Candidate Gate Tests (Synthetic-only, Windows-isolated):
// 1. Legacy v0.9.4 ('meu-financeiro-desktop') profile continuity -> 1.0.0-rc.1 stable pre-migration backup + Pluggy vault continuity.
// 2. Full CAT-P0 Opcao A lifecycle under stablePackaged=true (consent, history preview, confirm/batch, subsequent post-auth tx,
//    pause/resume, human correct, paginated receipts, individual undo, revoke, and finance:restore rebinding).
// 3. Hard security locks preserved on stable channel (approvedForPersonal()===false, ai-policy locks, experimental isolation).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { FinanceDB } = require('../electron/db.cjs');
const { PlanningStore } = require('../electron/planning.cjs');
const { PluggyVault } = require('../electron/pluggy-vault.cjs');
const { D05CategoryService } = require('../electron/d05-category-service.cjs');
const { STABLE_NAME, STABLE_ID, EXPERIMENTAL_ID } = require('../electron/release-channel.cjs');

const ITEM_A = '33333333-3333-4333-8333-333333333333';
const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';
const TARGET_SUPER = { categoryId: 'cat:alimentacao', subcategoryId: 'sub:alimentacao/supermercados' };
const TARGET_FUEL = { categoryId: 'cat:transporte', subcategoryId: 'sub:transporte/combustivel' };

const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  isAsyncEncryptionAvailable: async () => true,
  encryptString: (s) => Buffer.from('syn-enc:' + String(s), 'utf8'),
  decryptString: (b) => {
    const txt = Buffer.from(b).toString('utf8');
    if (!txt.startsWith('syn-enc:')) throw new Error('Bad cipher');
    return txt.slice('syn-enc:'.length);
  },
  encryptStringAsync: async (s) => Buffer.from('syn-enc:' + String(s), 'utf8'),
  decryptStringAsync: async (b) => {
    const txt = Buffer.from(b).toString('utf8');
    if (!txt.startsWith('syn-enc:')) throw new Error('Bad cipher');
    return { result: txt.slice('syn-enc:'.length) };
  }
};

function makeTransactions(prefix, count, { mcc = '5411', category = 'Groceries', baseAmount = 15 } = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: `${prefix}-${String(i).padStart(4, '0')}`,
      date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
      description: `${prefix.toUpperCase()} MERCADO SINTETICO ${i}`,
      amount: -(baseAmount + (i % 17) / 100),
      status: 'POSTED',
      category,
      ...(mcc ? { creditCardMetadata: { payeeMCC: mcc } } : {})
    });
  }
  return out;
}

function seedLegacyProfile(profileDir) {
  fs.mkdirSync(profileDir, { recursive: true });
  const sqliteFile = path.join(profileDir, 'meu-financeiro.sqlite');
  const db = new FinanceDB(sqliteFile);
  try {
    db.save('real', {
      version: 5,
      settings: { opening: 123456, income: 310000, fixed: 100000, existing: 15000, reserve: 20000 },
      budgets: { 'Alimentação': 0, Transporte: 25000 },
      transactions: [
        { id: 'manual-v094-1', date: '2026-10-05', description: 'Aluguel sintético legado', kind: 'expense', amount: 100000, category: 'Moradia' }
      ]
    });
    const accountATxs = [
      ...makeTransactions('hist', 310, { mcc: '5411', category: 'Groceries' }),
      ...makeTransactions('rev', 15, { mcc: null, category: 'Uncategorized', baseAmount: 42 }),
      ...makeTransactions('man', 5, { mcc: null, category: 'Uncategorized', baseAmount: 31 })
    ];
    const accountBTxs = makeTransactions('sec', 275, { mcc: '5411', category: 'Groceries', baseAmount: 20 });
    db.ingestBank(ITEM_A, {
      item: { status: 'UPDATED' },
      data: [
        { account: { id: ACCOUNT_A, name: 'CONTA PRINCIPAL SINTETICA', type: 'CHECKING', currencyCode: 'BRL', balance: 5000 }, transactions: accountATxs },
        { account: { id: ACCOUNT_B, name: 'CONTA SECUNDARIA SINTETICA', type: 'CHECKING', currencyCode: 'BRL', balance: 1500 }, transactions: accountBTxs }
      ]
    });
    const svc = new D05CategoryService(db);
    for (let i = 0; i < 5; i++) {
      svc.assignBank({ accountId: ACCOUNT_A, externalId: `man-${String(i).padStart(4, '0')}`, target: TARGET_FUEL });
    }
    new PlanningStore(db).create({
      title: 'Compromisso legado sintético',
      kind: 'expense',
      amount: 7350,
      dueDate: '2026-12-15',
      category: 'Contas'
    });
  } finally {
    db.close();
  }
  return sqliteFile;
}

async function bootStableMainHarness({ seedLegacyDir = null, seedCurrentDir = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-v1-stable-gate-'));
  const appDataDir = path.join(root, 'appData');
  const userDataDir = path.join(root, 'userData');
  fs.mkdirSync(appDataDir, { recursive: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  if (seedLegacyDir) {
    const legacyDir = path.join(appDataDir, seedLegacyDir);
    seedLegacyProfile(legacyDir);
    await new PluggyVault(legacyDir, fakeSafeStorage).put({
      clientId: 'SYNTHETIC-PLUGGY-CLIENT-ID',
      clientSecret: 'SYNTHETIC-NEVER-REAL-SECRET',
      itemIds: [ITEM_A]
    });
  } else if (seedCurrentDir) {
    seedLegacyProfile(path.join(appDataDir, STABLE_NAME));
  }

  const prevSmoke = process.env.MF_DESKTOP_SMOKE_DIR;
  delete process.env.MF_DESKTOP_SMOKE_DIR;

  const handlers = new Map();
  let nextMessageBox = async () => ({ response: 0 });
  let nextOpenDialog = async () => ({ canceled: true, filePaths: [] });
  let nextSaveDialog = async () => ({ canceled: true, filePath: '' });
  let mainWindowInstance = null;
  let reloadCount = 0;
  const appEmitter = new EventEmitter();
  const paths = { appData: appDataDir, userData: userDataDir };

  const pkgPath0 = path.join(__dirname, '..', 'package.json');
  const currentVersion = JSON.parse(fs.readFileSync(pkgPath0, 'utf8')).version;
  const appMock = {
    isPackaged: true,
    getName: () => STABLE_NAME,
    getVersion: () => currentVersion,
    getPath: (k) => paths[k] || path.join(root, k),
    setPath: (k, v) => { paths[k] = v; },
    requestSingleInstanceLock: () => true,
    setAppUserModelId: () => {},
    whenReady: () => Promise.resolve(),
    on: (ev, fn) => appEmitter.on(ev, fn),
    emit: (ev, ...args) => appEmitter.emit(ev, ...args),
    quit: () => {}
  };

  class MockBrowserWindow {
    constructor() {
      mainWindowInstance = this;
      this.webContents = {
        id: 88,
        isDestroyed: () => false,
        on: () => {},
        setWindowOpenHandler: () => {},
        send: () => {},
        reload: () => { reloadCount++; }
      };
    }
    once(ev, fn) { if (ev === 'ready-to-show') setImmediate(fn); }
    show() {}
    loadFile() {}
    isDestroyed() { return false; }
    isFocused() { return true; }
    isMinimized() { return false; }
    restore() {}
    focus() {}
    getBounds() { return { x: 0, y: 0, width: 1500, height: 940 }; }
    getContentBounds() { return { x: 0, y: 0, width: 1500, height: 940 }; }
    static getAllWindows() { return mainWindowInstance ? [mainWindowInstance] : []; }
  }

  const fakeSession = {
    setPermissionRequestHandler: () => {},
    setPermissionCheckHandler: () => {},
    webRequest: { onBeforeRequest: () => {} },
    cookies: { get: async () => [], set: async () => {}, remove: async () => {} },
    fetch: async () => ({ ok: false, status: 503 })
  };

  const electronMock = {
    app: appMock,
    BrowserWindow: MockBrowserWindow,
    session: { defaultSession: fakeSession, fromPartition: () => fakeSession },
    ipcMain: { handle: (ch, fn) => { handlers.set(ch, fn); } },
    dialog: {
      showMessageBox: async (_w, opts) => nextMessageBox(opts),
      showOpenDialog: async (_w, opts) => nextOpenDialog(opts),
      showSaveDialog: async (_w, opts) => nextSaveDialog(opts),
      showErrorBox: (t, m) => { throw new Error(`Electron errorBox: ${t}: ${m}`); }
    },
    shell: { openPath: async () => '', openExternal: async () => {} },
    safeStorage: fakeSafeStorage
  };

  const pkgPath = require.resolve('../package.json');
  const relPath = require.resolve('../electron/release-channel.cjs');
  const mainPath = require.resolve('../electron/main.cjs');
  const pkgOverride = { ...JSON.parse(fs.readFileSync(pkgPath, 'utf8')), mfDistributionChannel: 'stable' };
  delete require.cache[mainPath];
  delete require.cache[relPath];
  delete require.cache[pkgPath];

  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') return electronMock;
    if (request === '../package.json' && parent?.filename === relPath) return pkgOverride;
    return origLoad.call(this, request, parent, isMain);
  };
  try {
    require(mainPath);
  } finally {
    Module._load = origLoad;
  }

  for (let i = 0; i < 60 && !handlers.has('bank:auto-status'); i++) {
    await new Promise((r) => setTimeout(r, 15));
  }
  assert.equal(handlers.has('bank:auto-status'), true, 'main.cjs must register bank:auto-status');

  const validEvent = { sender: mainWindowInstance.webContents, senderFrame: { url: 'file:///app/index.html' } };
  for (let i = 0; i < 60; i++) {
    const b = await handlers.get('finance:backup-status')(validEvent);
    if (b.copies >= 1) break;
    await new Promise((r) => setTimeout(r, 15));
  }

  return {
    root,
    appDataDir,
    paths,
    get reloadCount() { return reloadCount; },
    setMessageBox: (fn) => { nextMessageBox = fn; },
    setOpenDialog: (fn) => { nextOpenDialog = fn; },
    setSaveDialog: (fn) => { nextSaveDialog = fn; },
    invoke: async (ch, ...args) => {
      const fn = handlers.get(ch);
      assert.ok(fn, `Missing IPC handler: ${ch}`);
      return await fn(validEvent, ...args);
    },
    close: async () => {
      appEmitter.emit('before-quit');
      delete require.cache[mainPath];
      delete require.cache[relPath];
      delete require.cache[pkgPath];
      if (prevSmoke !== undefined) process.env.MF_DESKTOP_SMOKE_DIR = prevSmoke;
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

test('V1-STABLE-01: stable candidate inherits legacy v0.9.4 profile, validates Pluggy vault offline/online, and writes verified pre-upgrade backup', async () => {
  const h = await bootStableMainHarness({ seedLegacyDir: 'meu-financeiro-desktop' });
  try {
    const legacyDir = path.join(h.appDataDir, 'meu-financeiro-desktop');
    assert.equal(path.resolve(h.paths.userData), path.resolve(legacyDir), 'Stable must inherit legacy profile in place');

    const currentVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
    const backupDir = path.join(legacyDir, 'copias-de-seguranca');
    const preUpgrade = path.join(backupDir, `pre-upgrade-${currentVersion}.sqlite`);
    assert.equal(fs.existsSync(preUpgrade), true, `Expected verified pre-upgrade-${currentVersion}.sqlite snapshot`);

    const backupCheckDb = new FinanceDB(preUpgrade);
    try {
      assert.deepEqual(backupCheckDb.integrity(), ['ok']);
      assert.equal(backupCheckDb.bankOverview().totalTransactions, 605);
      assert.equal(backupCheckDb.load('real').budgets['Alimentação'], 0);
    } finally {
      backupCheckDb.close();
    }

    const bank = await h.invoke('bank:status');
    assert.equal(bank.connection.channel, 'stable');
    assert.equal(bank.connection.isolated, false);
    assert.equal(bank.connection.connectionEnabled, true);
    assert.equal(bank.connection.profileState, 'existing');
    assert.equal(bank.config.configured, true);
    assert.equal(bank.config.clientId, 'SYNTHETIC-PLUGGY-CLIENT-ID');
    assert.equal('clientSecret' in bank.config, false, 'Client secret must never reach IPC renderer');
    assert.equal(bank.data.totalTransactions, 605);
    assert.equal(bank.data.accounts.length, 2);

    const info = await h.invoke('finance:info');
    assert.equal(path.resolve(info.path), path.resolve(legacyDir, 'meu-financeiro.sqlite'));
    assert.deepEqual(info.integrity, ['ok']);
  } finally {
    await h.close();
  }
});

test('V1-STABLE-02: CAT-P0 Opcao A full lifecycle (including subsequent new transactions, pause/resume, correct, undo, revoke, restore) & hard locks on stablePackaged=true', async () => {
  const h = await bootStableMainHarness({ seedCurrentDir: true });
  try {
    const cleanBackup = path.join(h.root, 'clean-before-auto.sqlite');
    h.setSaveDialog(async () => ({ canceled: false, filePath: cleanBackup }));
    await h.invoke('finance:backup');
    assert.equal(fs.existsSync(cleanBackup), true);

    const init = await h.invoke('bank:auto-status');
    assert.equal(init.available, true);
    assert.equal(init.enabled, false);
    assert.equal(init.modelInference, false);

    // 1. Native per-account consent grants scope ONLY (changesApplied: false)
    h.setMessageBox(async () => ({ response: 1 }));
    const cfg = await h.invoke('bank:auto-configure', {
      accountIds: [ACCOUNT_A],
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      historyEnabled: true,
      newEnabled: true
    });
    assert.equal(cfg.changesApplied, false);
    assert.equal(cfg.previewRequired, true);
    assert.equal(cfg.authorization.enabled, true);
    assert.equal(cfg.authorization.permissions.length, 1);

    // 2. Full-history paged preview & initial confirmed batch (ACCOUNT_B stays untouched)
    let scan = await h.invoke('bank:auto-preview-start');
    while (scan.state === 'scanning') scan = await h.invoke('bank:auto-preview-next', scan.jobId);
    assert.equal(scan.state, 'ready');
    assert.equal(scan.preview.candidateCount, 310);
    assert.equal(scan.preview.reviewCount, 15);
    assert.equal(scan.preview.protectedCount, 5);

    const started = await h.invoke('bank:auto-apply', { previewVersion: scan.preview.previewVersion });
    assert.equal(started.batch.state, 'running');
    assert.equal(started.batch.proposedTotal, 310);
    let b = await h.invoke('bank:auto-batch-next', started.batch.jobId);
    while (b.state === 'running') b = await h.invoke('bank:auto-batch-next', started.batch.jobId);
    assert.equal(b.state, 'completed');
    assert.equal(b.committed, 310);

    // 3. Pause / resume control
    const paused = await h.invoke('bank:auto-pause');
    assert.equal(paused.paused, true);
    const resumed = await h.invoke('bank:auto-resume');
    assert.equal(resumed.paused, false);

    // 4. Subsequent new POSTED transactions ingested after authorization -> post-auth manual check classifies ONLY eligible new rows
    const liveDb = new FinanceDB(path.join(h.paths.userData, 'meu-financeiro.sqlite'));
    try {
      liveDb.ingestBank(ITEM_A, {
        item: { status: 'UPDATED' },
        data: [{
          account: { id: ACCOUNT_A, name: 'CONTA PRINCIPAL SINTETICA', type: 'CHECKING', currencyCode: 'BRL', balance: 4900 },
          transactions: makeTransactions('after', 2, { mcc: '5411', category: 'Groceries', baseAmount: 19 })
        }]
      });
    } finally {
      liveDb.close();
    }
    const postAuthRun = await h.invoke('bank:auto-apply', {});
    assert.equal(postAuthRun.state, 'completed');
    assert.equal(postAuthRun.applied, 2);

    // 5. Paginated receipts, human correction override, and single-item undo
    const receipts = await h.invoke('bank:auto-receipts', { action: 'apply', limit: 20 });
    assert.equal(receipts.total, 312);
    const first = receipts.items[0];
    const second = receipts.items[1];

    const corrected = await h.invoke('bank:auto-correct', {
      accountId: first.accountId,
      externalId: first.externalId,
      target: TARGET_FUEL
    });
    assert.equal(corrected.corrected, true);

    const undone = await h.invoke('bank:auto-undo', {
      accountId: second.accountId,
      externalId: second.externalId
    });
    assert.equal(undone.undone, true);
    assert.equal(undone.needsReview, true);

    // 6. Revoke per-account consent and restore clean backup -> clean state rebound
    const revoked = await h.invoke('bank:auto-revoke', ACCOUNT_A);
    assert.equal(revoked.enabled, false);

    h.setOpenDialog(async () => ({ canceled: false, filePaths: [cleanBackup] }));
    const restored = await h.invoke('finance:restore');
    assert.deepEqual(restored, { ok: true });
    assert.equal(h.reloadCount, 1);
    const postRestore = await h.invoke('bank:auto-status');
    assert.equal(postRestore.counts.classified, 0);
    assert.equal(postRestore.counts.appliedEver, 0);

    // 7. Generic AI personal writer remains locked even on stablePackaged=true
    const session = await h.invoke('d05:session-authorize', { profile: 'real' });
    await h.invoke('d05:account-authorize', { sessionToken: session.token, accountId: ACCOUNT_A });
    const preview = await h.invoke('d05:personal-write-preview', {
      sessionToken: session.token,
      action: 'bank.categorize',
      accountId: ACCOUNT_A,
      externalId: 'rev-0000',
      target: TARGET_SUPER
    });
    assert.equal(preview.personalWriteAuthorized, false);
    const denied = await h.invoke('d05:personal-write-confirm', {
      sessionToken: session.token,
      proposalId: preview.proposalId,
      nonce: preview.nonce
    });
    assert.equal(denied.status, 'denied');
    assert.equal(denied.changesApplied, false);
    assert.equal(denied.personalWriteAuthorized, false);
  } finally {
    await h.close();
  }
});

test('V1-STABLE-03: AI policy locks and build-stable-windows contract match v1.0.0-rc.1 isolation rules', async () => {
  const { publicCapabilities } = await import('../shared/ai-policy.mjs');
  const caps = publicCapabilities();
  assert.equal(caps.financialDataEnabled, false);
  assert.equal(caps.paidApiFallback, false);
  assert.equal(caps.pwaInferenceEnabled, false);

  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const mobilePkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mobile-push', 'package.json'), 'utf8'));
  assert.match(pkg.version, /^(0\.9\.5-beta\.\d+|1\.0\.0(?:-rc\.\d+)?)$/);
  assert.equal(mobilePkg.version, pkg.version);
  assert.equal(pkg.build.appId, EXPERIMENTAL_ID, 'package.json must keep experimental appId by default');
  assert.equal(STABLE_ID, 'app.local.meufinanceiro');
  assert.equal(STABLE_NAME, 'Meu Financeiro');
});
