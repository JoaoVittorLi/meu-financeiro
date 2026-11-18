'use strict';
// Synthetic end-to-end IPC contract & CAT-UX 01-06 verification against electron/main.cjs.
// Uses MF_QA_SYNTHETIC=1, temp isolated userData/appData, zero personal DBs, zero Pluggy credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { FinanceDB } = require('../electron/db.cjs');
const { D05CategoryService } = require('../electron/d05-category-service.cjs');

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';
const ITEM_A = '33333333-3333-4333-8333-333333333333';
const TARGET_SUPER = { categoryId: 'cat:alimentacao', subcategoryId: 'sub:alimentacao/supermercados' };
const TARGET_FUEL = { categoryId: 'cat:transporte', subcategoryId: 'sub:transporte/combustivel' };

function seedSyntheticDb(sqlitePath, {
  eligibleCount = 10,
  reviewCount = 3,
  manualOverrideCount = 0,
  splitCount = 0,
  transferCount = 0,
  outOfRangeCount = 0
} = {}) {
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  const db = new FinanceDB(sqlitePath);
  try {
    const tx = [];
    for (let i = 0; i < eligibleCount; i++) {
      tx.push({
        id: `elig-${String(i).padStart(4, '0')}`,
        date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
        description: `MERCADO SINTETICO ${i}`,
        amount: -(15 + i / 100),
        status: 'POSTED',
        category: 'Groceries',
        creditCardMetadata: { payeeMCC: '5411' }
      });
    }
    for (let i = 0; i < reviewCount; i++) {
      tx.push({
        id: `rev-${String(i).padStart(4, '0')}`,
        date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
        description: `ESTABELECIMENTO INCERTO ${i}`,
        amount: -(22 + i / 100),
        status: 'POSTED',
        category: 'Uncategorized'
      });
    }
    for (let i = 0; i < manualOverrideCount; i++) {
      tx.push({
        id: `man-${String(i).padStart(4, '0')}`,
        date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
        description: `COMPRA MANUAL PROTEGIDA ${i}`,
        amount: -(31 + i / 100),
        status: 'POSTED',
        category: 'Uncategorized'
      });
    }
    for (let i = 0; i < splitCount; i++) {
      tx.push({
        id: `spl-${String(i).padStart(4, '0')}`,
        date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
        description: `COMPRA DIVIDIDA PROTEGIDA ${i}`,
        amount: -40,
        status: 'POSTED',
        category: 'Uncategorized'
      });
    }
    for (let i = 0; i < transferCount; i++) {
      tx.push({
        id: `trf-${String(i).padStart(4, '0')}`,
        date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
        description: `TRANSFERENCIA PROTEGIDA ${i}`,
        amount: -(50 + i),
        status: 'POSTED',
        category: 'Uncategorized'
      });
    }
    for (let i = 0; i < outOfRangeCount; i++) {
      tx.push({
        id: `oor-${String(i).padStart(4, '0')}`,
        date: '2025-05-01',
        description: `FORA DO PERIODO ${i}`,
        amount: -19,
        status: 'POSTED',
        category: 'Groceries',
        creditCardMetadata: { payeeMCC: '5411' }
      });
    }
    db.ingestBank(ITEM_A, {
      item: { status: 'UPDATED' },
      data: [
        { account: { id: ACCOUNT_A, name: 'CONTA SINTETICA PRINCIPAL', type: 'CHECKING', currencyCode: 'BRL', balance: 5000 }, transactions: tx },
        { account: { id: ACCOUNT_B, name: 'CONTA SINTETICA SECUNDARIA', type: 'CHECKING', currencyCode: 'BRL', balance: 1000 }, transactions: [] }
      ]
    });
    const d05 = new D05CategoryService(db);
    for (let i = 0; i < manualOverrideCount; i++) {
      d05.assignBank({ accountId: ACCOUNT_A, externalId: `man-${String(i).padStart(4, '0')}`, target: TARGET_FUEL });
    }
    for (let i = 0; i < splitCount; i++) {
      db.setBankSplits({
        accountId: ACCOUNT_A,
        externalId: `spl-${String(i).padStart(4, '0')}`,
        parts: [{ category: 'Alimentação', amount: 2000 }, { category: 'Compras', amount: 2000 }]
      });
    }
    for (let i = 0; i < transferCount; i++) {
      db.editBankTransaction({ accountId: ACCOUNT_A, externalId: `trf-${String(i).padStart(4, '0')}`, nature: 'transfer' });
    }
    db.save('demo', {
      version: 5,
      settings: { opening: 0, income: 0, fixed: 0, existing: 0, reserve: 0 },
      budgets: {},
      transactions: [{ id: 'demo-tx-1', date: '2026-10-10', description: 'DEMO SYNTHETIC', kind: 'expense', amount: 2500, category: 'Alimentação' }]
    });
  } finally {
    db.close();
  }
}

async function bootMainHarness({
  isPackaged = false,
  appName = 'meu-financeiro-desktop',
  mfDistributionChannel = undefined,
  seedOptions = null
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-ipc-contract-'));
  const appDataDir = path.join(root, 'appData');
  const userDataDir = path.join(root, 'userData');
  fs.mkdirSync(appDataDir, { recursive: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  if (seedOptions) {
    const dbTarget = (isPackaged && mfDistributionChannel === 'stable')
      ? path.join(appDataDir, 'Meu Financeiro', 'meu-financeiro.sqlite')
      : (isPackaged && mfDistributionChannel === 'experimental')
        ? path.join(appDataDir, 'MeuFinanceiro-RC-ALL-01-Experimental', 'meu-financeiro.sqlite')
        : path.join(userDataDir, 'meu-financeiro.sqlite');
    seedSyntheticDb(dbTarget, seedOptions);
  }

  const prevSmokeEnv = process.env.MF_DESKTOP_SMOKE_DIR;
  delete process.env.MF_DESKTOP_SMOKE_DIR;

  const handlers = new Map();
  const dialogsShown = [];
  let nextMessageBox = async () => ({ response: 0 });
  let nextOpenDialog = async () => ({ canceled: true, filePaths: [] });
  let nextSaveDialog = async () => ({ canceled: true, filePath: '' });
  let windowFocused = true;
  let mainWindowInstance = null;
  let reloadCount = 0;

  const appEmitter = new EventEmitter();
  const paths = { appData: appDataDir, userData: userDataDir };
  const appMock = {
    isPackaged,
    getName: () => appName,
    getVersion: () => '0.9.5-beta.8',
    getPath: (key) => paths[key] || path.join(root, key),
    setPath: (key, value) => { paths[key] = value; },
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
        id: 77,
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
    isFocused() { return windowFocused; }
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
    ipcMain: { handle: (channel, fn) => { handlers.set(channel, fn); } },
    dialog: {
      showMessageBox: async (_win, opts) => {
        dialogsShown.push({ type: 'messageBox', opts });
        return nextMessageBox(opts);
      },
      showOpenDialog: async (_win, opts) => {
        dialogsShown.push({ type: 'openDialog', opts });
        return nextOpenDialog(opts);
      },
      showSaveDialog: async (_win, opts) => {
        dialogsShown.push({ type: 'saveDialog', opts });
        return nextSaveDialog(opts);
      },
      showErrorBox: (title, msg) => {
        throw new Error(`Electron errorBox: ${title}: ${msg}`);
      }
    },
    shell: { openPath: async () => '', openExternal: async () => {} },
    safeStorage: { isEncryptionAvailable: () => false, encryptString: (s) => Buffer.from(s), decryptString: (b) => b.toString() }
  };

  const realPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const pkgOverride = mfDistributionChannel === undefined
    ? realPkg
    : { ...realPkg, mfDistributionChannel };

  const mainPath = require.resolve('../electron/main.cjs');
  const releaseChannelPath = require.resolve('../electron/release-channel.cjs');
  const pkgPath = require.resolve('../package.json');
  delete require.cache[mainPath];
  delete require.cache[releaseChannelPath];
  delete require.cache[pkgPath];

  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') return electronMock;
    if (request === '../package.json' && parent?.filename === releaseChannelPath) return pkgOverride;
    return origLoad.call(this, request, parent, isMain);
  };

  try {
    require(mainPath);
  } finally {
    Module._load = origLoad;
  }

  // Allow app.whenReady().then(...) + initial automaticBackup() to settle so autoBackupBusy is false.
  for (let i = 0; i < 40 && !handlers.has('bank:auto-status'); i++) {
    await new Promise((r) => setTimeout(r, 15));
  }
  assert.equal(handlers.has('bank:auto-status'), true, 'main.cjs must register bank:auto-status IPC handler');

  const validEvent = {
    sender: mainWindowInstance.webContents,
    senderFrame: { url: 'file:///C:/Dev/meu-financeiro-worktrees/m1-dev/app/index.html' }
  };

  for (let i = 0; i < 50; i++) {
    const b = await handlers.get('finance:backup-status')(validEvent);
    if (b.copies >= 1) break;
    await new Promise((r) => setTimeout(r, 15));
  }

  return {
    root,
    paths,
    handlers,
    dialogsShown,
    validEvent,
    mainWindow: mainWindowInstance,
    get reloadCount() { return reloadCount; },
    setMessageBox: (fn) => { nextMessageBox = fn; },
    setOpenDialog: (fn) => { nextOpenDialog = fn; },
    setSaveDialog: (fn) => { nextSaveDialog = fn; },
    setFocused: (v) => { windowFocused = v; },
    invoke: async (channel, ...args) => {
      const fn = handlers.get(channel);
      assert.ok(fn, `IPC handler missing: ${channel}`);
      return await fn(validEvent, ...args);
    },
    invokeWithEvent: async (event, channel, ...args) => {
      const fn = handlers.get(channel);
      assert.ok(fn, `IPC handler missing: ${channel}`);
      return await fn(event, ...args);
    },
    activeDbPath: () => path.join(paths.userData, 'meu-financeiro.sqlite'),
    close: async () => {
      appEmitter.emit('before-quit');
      delete require.cache[mainPath];
      delete require.cache[releaseChannelPath];
      delete require.cache[pkgPath];
      if (prevSmokeEnv !== undefined) process.env.MF_DESKTOP_SMOKE_DIR = prevSmokeEnv;
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

test('IPC-01: non-stablePackaged (development & experimental) gates bank:auto-* without weakening security', async () => {
  // 1a. Development channel
  const dev = await bootMainHarness({ isPackaged: false, appName: 'meu-financeiro-desktop', seedOptions: { eligibleCount: 5 } });
  try {
    const status = await dev.invoke('bank:auto-status');
    assert.equal(status.available, false);
    assert.equal(status.enabled, false);
    assert.equal(status.modelInference, false);

    for (const [ch, arg] of [
      ['bank:auto-configure', { accountIds: [ACCOUNT_A], startDate: '2026-01-01', endDate: '2026-12-31' }],
      ['bank:auto-preview-start', undefined],
      ['bank:auto-apply', { previewVersion: '0'.repeat(64) }],
      ['bank:auto-revoke', ACCOUNT_A],
      ['bank:auto-pause', undefined],
      ['bank:auto-resume', undefined],
      ['bank:auto-batch-next', '00000000-0000-4000-8000-000000000000'],
      ['bank:auto-undo', { accountId: ACCOUNT_A, externalId: 'elig-0000' }]
    ]) {
      await assert.rejects(() => dev.invoke(ch, arg), /distribuição estável homologada/);
    }

    const suggestions = await dev.invoke('bank:auto-rule-suggestions', {});
    assert.equal(suggestions.contract, 'D05/AUTO-RULE-SUGGESTIONS-V1');
    assert.deepEqual(suggestions.rules, []);
    assert.equal(suggestions.changesApplied, false);

    // Forged senderFrame URL or foreign sender must be denied by requireAppSender
    await assert.rejects(
      () => dev.invokeWithEvent({ sender: dev.mainWindow.webContents, senderFrame: { url: 'https://attacker.invalid/app/index.html' } }, 'bank:auto-status'),
      /Origem da requisição negada/
    );
    await assert.rejects(
      () => dev.invokeWithEvent({ sender: { id: 999, isDestroyed: () => false }, senderFrame: { url: 'file:///app/index.html' } }, 'bank:auto-status'),
      /Origem da requisição negada/
    );
  } finally {
    await dev.close();
  }

  // 1b. Experimental packaged channel
  const exp = await bootMainHarness({
    isPackaged: true,
    appName: 'Meu Financeiro RC Experimental',
    mfDistributionChannel: 'experimental',
    seedOptions: { eligibleCount: 5 }
  });
  try {
    const status = await exp.invoke('bank:auto-status');
    assert.equal(status.available, false);
    const bank = await exp.invoke('bank:status');
    assert.equal(bank.connection.channel, 'experimental');
    assert.equal(bank.connection.isolated, true);
    await assert.rejects(() => exp.invoke('bank:auto-preview-start'), /distribuição estável homologada/);
  } finally {
    await exp.close();
  }

  // 1c. Mismatched stable channel + wrong appName must throw at releaseChannel()
  await assert.rejects(
    () => bootMainHarness({ isPackaged: true, appName: 'Meu Financeiro RC Experimental', mfDistributionChannel: 'stable' }),
    /Identidade estável incompatível/
  );
});

test('IPC-02: bank:auto-configure validates inputs & native dialog and NEVER auto-applies writes on configuration', async () => {
  const h = await bootMainHarness({
    isPackaged: true,
    appName: 'Meu Financeiro',
    mfDistributionChannel: 'stable',
    seedOptions: { eligibleCount: 10, reviewCount: 2 }
  });
  try {
    const initialStatus = await h.invoke('bank:auto-status');
    assert.equal(initialStatus.available, true);
    assert.equal(initialStatus.enabled, false);
    assert.equal(initialStatus.permissions.length, 0);

    // Validation guards
    await assert.rejects(() => h.invoke('bank:auto-configure', { accountIds: ['unknown-id'], startDate: '2026-01-01', endDate: '2026-12-31' }), /Conta bancária desconhecida/);
    await assert.rejects(() => h.invoke('bank:auto-configure', { accountIds: [ACCOUNT_A], historyEnabled: false, newEnabled: false }), /Selecione histórico ou novas/);

    // Unfocused window blocks native consent
    h.setFocused(false);
    await assert.rejects(() => h.invoke('bank:auto-configure', { accountIds: [ACCOUNT_A], startDate: '2026-01-01', endDate: '2026-12-31' }), /janela ativa/);
    h.setFocused(true);

    // Native cancel leaves authorization disabled and zero writes
    h.setMessageBox(async () => ({ response: 0 }));
    const cancelled = await h.invoke('bank:auto-configure', { accountIds: [ACCOUNT_A], startDate: '2026-01-01', endDate: '2026-12-31' });
    assert.deepEqual(cancelled, { cancelled: true });
    assert.equal((await h.invoke('bank:auto-status')).enabled, false);

    // Native approval configures capability ONLY; zero labels written
    h.setMessageBox(async () => ({ response: 1 }));
    const configured = await h.invoke('bank:auto-configure', {
      accountIds: [ACCOUNT_A],
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      historyEnabled: true,
      newEnabled: true
    });
    assert.equal(configured.changesApplied, false);
    assert.equal(configured.previewRequired, true);
    assert.equal(configured.authorization.enabled, true);
    assert.equal(configured.authorization.initialConfirmed, false);
    assert.equal(configured.authorization.counts.classified, 0);
    assert.equal(configured.authorization.counts.appliedEver, 0);

    const checkDb = new FinanceDB(h.activeDbPath());
    try {
      assert.equal(checkDb.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n, 0);
      assert.equal(checkDb.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_receipts').get().n, 0);
    } finally {
      checkDb.close();
    }
  } finally {
    await h.close();
  }
});

test('IPC-03: bank:auto-preview-start/next/pause/resume/cancel enforces 250-row paging and full reconciliation invariant', async () => {
  // 520 eligible + 30 review + (5 manual + 5 splits + 5 transfer = 15 protected) = 565 scoped rows (+ 5 out-of-range)
  const h = await bootMainHarness({
    isPackaged: true,
    appName: 'Meu Financeiro',
    mfDistributionChannel: 'stable',
    seedOptions: { eligibleCount: 520, reviewCount: 30, manualOverrideCount: 5, splitCount: 5, transferCount: 5, outOfRangeCount: 5 }
  });
  try {
    h.setMessageBox(async () => ({ response: 1 }));
    await h.invoke('bank:auto-configure', { accountIds: [ACCOUNT_A], startDate: '2026-01-01', endDate: '2026-12-31' });

    const started = await h.invoke('bank:auto-preview-start');
    assert.equal(started.contract, 'D05/AUTO-PREVIEW-PAGED-V1');
    assert.equal(started.total, 565);
    assert.equal(started.processed, 0);
    assert.equal(started.state, 'scanning');
    assert.equal(started.readOnly, true);
    assert.equal(started.changesApplied, false);

    const p1 = await h.invoke('bank:auto-preview-next', started.jobId);
    assert.equal(p1.processed, 250);
    assert.equal(p1.state, 'scanning');

    const paused = await h.invoke('bank:auto-preview-pause', started.jobId);
    assert.equal(paused.state, 'paused');
    await assert.rejects(() => h.invoke('bank:auto-preview-next', started.jobId), /ativas/);

    const resumed = await h.invoke('bank:auto-preview-resume', started.jobId);
    assert.equal(resumed.state, 'scanning');

    const p2 = await h.invoke('bank:auto-preview-next', started.jobId);
    assert.equal(p2.processed, 500);
    assert.equal(p2.state, 'scanning');

    const p3 = await h.invoke('bank:auto-preview-next', started.jobId);
    assert.equal(p3.processed, 565);
    assert.equal(p3.state, 'ready');
    assert.equal(p3.changesApplied, false);

    const { preview } = p3;
    assert.equal(preview.candidateCount, 520);
    assert.equal(preview.reviewCount, 30);
    assert.equal(preview.protectedCount, 15);
    assert.equal(preview.unavailableCount, 0);
    assert.equal(preview.analyzedCount, 565);
    assert.equal(
      preview.candidateCount + preview.reviewCount + preview.protectedCount + preview.unavailableCount,
      started.total,
      'Reconciliation invariant: eligible + review + protected + discarded === total'
    );

    // Cancel removes preview job without mutating labels
    const cancelled = await h.invoke('bank:auto-preview-cancel', started.jobId);
    assert.deepEqual(cancelled, { cancelled: true, readOnly: true, changesApplied: false });
    await assert.rejects(() => h.invoke('bank:auto-apply', { previewVersion: preview.previewVersion }), /não concluída/);
  } finally {
    await h.close();
  }
});

test('IPC-04: bank:auto-apply, paged batch lifecycle, bank:auto-receipts, and individual bank:auto-undo (plus stale undo rejection)', async () => {
  const h = await bootMainHarness({
    isPackaged: true,
    appName: 'Meu Financeiro',
    mfDistributionChannel: 'stable',
    seedOptions: { eligibleCount: 520, reviewCount: 10, manualOverrideCount: 2 }
  });
  try {
    h.setMessageBox(async () => ({ response: 1 }));
    await h.invoke('bank:auto-configure', { accountIds: [ACCOUNT_A], startDate: '2026-01-01', endDate: '2026-12-31' });

    // Missing/wrong previewVersion rejected before dialog
    await assert.rejects(() => h.invoke('bank:auto-apply', {}), /obrigatória/);
    await assert.rejects(() => h.invoke('bank:auto-apply', { previewVersion: 'a'.repeat(64) }), /não concluída/);

    // Complete preview scan
    let scan = await h.invoke('bank:auto-preview-start');
    while (scan.state === 'scanning') scan = await h.invoke('bank:auto-preview-next', scan.jobId);
    assert.equal(scan.state, 'ready');
    const pv = scan.preview.previewVersion;

    // Native confirmation cancel
    h.setMessageBox(async () => ({ response: 0 }));
    const applyCancelled = await h.invoke('bank:auto-apply', { previewVersion: pv });
    assert.deepEqual(applyCancelled, { cancelled: true, changesApplied: false });

    // Native confirmation approve -> creates verified backup + starts batch
    h.setMessageBox(async () => ({ response: 1 }));
    const appliedStart = await h.invoke('bank:auto-apply', { previewVersion: pv });
    assert.equal(appliedStart.changesApplied, false);
    assert.equal(appliedStart.batch.state, 'running');
    assert.equal(appliedStart.batch.proposedTotal, 520);
    assert.equal(appliedStart.batch.committed, 0);

    const jobId = appliedStart.batch.jobId;
    const b1 = await h.invoke('bank:auto-batch-next', jobId);
    assert.equal(b1.committed, 250);
    assert.equal(b1.state, 'running');
    assert.equal(b1.backupVerified, true);

    const bPaused = await h.invoke('bank:auto-batch-pause', jobId);
    assert.equal(bPaused.state, 'paused');
    const bResumed = await h.invoke('bank:auto-batch-resume', jobId);
    assert.equal(bResumed.state, 'running');

    const b2 = await h.invoke('bank:auto-batch-next', jobId);
    assert.equal(b2.committed, 500);
    const b3 = await h.invoke('bank:auto-batch-next', jobId);
    assert.equal(b3.committed, 520);
    assert.equal(b3.remaining, 0);
    assert.equal(b3.state, 'completed');

    // Receipts paging
    const rPage1 = await h.invoke('bank:auto-receipts', { action: 'apply', limit: 20 });
    assert.equal(rPage1.contract, 'D05/AUTO-RECEIPTS-V1');
    assert.equal(rPage1.total, 520);
    assert.equal(rPage1.items.length, 20);
    assert.equal(rPage1.hasMore, true);
    assert.equal(rPage1.items[0].active, true);
    assert.equal(rPage1.items[0].reversed, false);

    const rPage2 = await h.invoke('bank:auto-receipts', { action: 'apply', limit: 20, cursor: rPage1.nextCursor });
    assert.equal(rPage2.items.length, 20);
    assert.notEqual(rPage2.items[0].receiptId, rPage1.items[0].receiptId);

    const single = await h.invoke('bank:auto-receipt', rPage1.items[0].receiptId);
    assert.equal(single.id, rPage1.items[0].receiptId);

    // Individual undo cancel preserves label
    const targetItem = rPage1.items[0];
    h.setMessageBox(async () => ({ response: 0 }));
    const undoCancelled = await h.invoke('bank:auto-undo', { accountId: targetItem.accountId, externalId: targetItem.externalId });
    assert.deepEqual(undoCancelled, { cancelled: true });

    // Individual undo approve reverts only that transaction and blocks re-application
    h.setMessageBox(async () => ({ response: 1 }));
    const undone = await h.invoke('bank:auto-undo', { accountId: targetItem.accountId, externalId: targetItem.externalId });
    assert.equal(undone.undone, true);
    assert.equal(undone.needsReview, true);
    assert.ok(undone.receiptId);

    // Stale/already-reverted receipt undo must NOT create a second undo receipt
    const staleUndo = await h.invoke('bank:auto-undo', { accountId: targetItem.accountId, externalId: targetItem.externalId });
    assert.equal(staleUndo.undone, false);

    const undoList = await h.invoke('bank:auto-receipts', { action: 'undo', limit: 20 });
    assert.equal(undoList.total, 1);
    const afterApplyList = await h.invoke('bank:auto-receipts', { action: 'apply', limit: 20 });
    const oldReceipt = afterApplyList.items.find((x) => x.receiptId === targetItem.receiptId);
    assert.equal(oldReceipt.active, false);
    assert.equal(oldReceipt.reversed, true);

    // Invalid undo parameters must throw
    await assert.rejects(() => h.invoke('bank:auto-undo', { accountId: '', externalId: 'x' }), /inválido/);
  } finally {
    await h.close();
  }
});

test('IPC-05: bank:auto-batch-cancel preserves committed receipts; bank:auto-revoke mid-run fails closed; finance:restore rebinds services', async () => {
  // 5a. Batch cancel after page 1 preserves 250 receipts, skips remaining
  const hCancel = await bootMainHarness({
    isPackaged: true,
    appName: 'Meu Financeiro',
    mfDistributionChannel: 'stable',
    seedOptions: { eligibleCount: 300 }
  });
  try {
    hCancel.setMessageBox(async () => ({ response: 1 }));
    await hCancel.invoke('bank:auto-configure', { accountIds: [ACCOUNT_A], startDate: '2026-01-01', endDate: '2026-12-31' });
    let scan = await hCancel.invoke('bank:auto-preview-start');
    while (scan.state === 'scanning') scan = await hCancel.invoke('bank:auto-preview-next', scan.jobId);
    const { batch } = await hCancel.invoke('bank:auto-apply', { previewVersion: scan.preview.previewVersion });
    const p1 = await hCancel.invoke('bank:auto-batch-next', batch.jobId);
    assert.equal(p1.committed, 250);
    const cancelled = await hCancel.invoke('bank:auto-batch-cancel', batch.jobId);
    assert.equal(cancelled.state, 'cancelled');
    assert.equal(cancelled.committed, 250);
    assert.equal((await hCancel.invoke('bank:auto-status')).counts.classified, 250);
  } finally {
    await hCancel.close();
  }

  // 5b. Mid-run revocation + database restore rebinding
  const h = await bootMainHarness({
    isPackaged: true,
    appName: 'Meu Financeiro',
    mfDistributionChannel: 'stable',
    seedOptions: { eligibleCount: 300 }
  });
  try {
    // Take clean pre-auto backup via finance:backup
    const cleanBackup = path.join(h.root, 'clean-before-auto.sqlite');
    h.setSaveDialog(async () => ({ canceled: false, filePath: cleanBackup }));
    await h.invoke('finance:backup');
    assert.equal(fs.existsSync(cleanBackup), true);

    h.setMessageBox(async () => ({ response: 1 }));
    await h.invoke('bank:auto-configure', { accountIds: [ACCOUNT_A], startDate: '2026-01-01', endDate: '2026-12-31' });
    let scan = await h.invoke('bank:auto-preview-start');
    while (scan.state === 'scanning') scan = await h.invoke('bank:auto-preview-next', scan.jobId);
    const { batch } = await h.invoke('bank:auto-apply', { previewVersion: scan.preview.previewVersion });
    assert.equal((await h.invoke('bank:auto-batch-next', batch.jobId)).committed, 250);

    // Revoke mid-run: next page must fail-closed as stale and NOT write remaining 50
    const revokedStatus = await h.invoke('bank:auto-revoke', ACCOUNT_A);
    assert.equal(revokedStatus.enabled, false);
    const stopped = await h.invoke('bank:auto-batch-next', batch.jobId);
    assert.equal(stopped.state, 'stale');
    assert.equal(stopped.errorCode, 'MANIFEST_STALE');
    assert.equal(stopped.committed, 250);
    await assert.rejects(() => h.invoke('bank:auto-batch-resume', batch.jobId), /retomada não disponível/);

    // Restore clean pre-auto snapshot via finance:restore -> must rebind db + auto services
    h.setOpenDialog(async () => ({ canceled: false, filePaths: [cleanBackup] }));
    const restored = await h.invoke('finance:restore');
    assert.deepEqual(restored, { ok: true });
    assert.equal(h.reloadCount, 1);

    const postRestoreStatus = await h.invoke('bank:auto-status');
    assert.equal(postRestoreStatus.enabled, false);
    assert.equal(postRestoreStatus.counts.classified, 0);
    assert.equal(postRestoreStatus.counts.appliedEver, 0);
  } finally {
    await h.close();
  }
});

test('IPC-06: D05PersonalWriteGateway enforces approvedForPersonal() === false hard lock for all non-approved personal AI writes', async () => {
  const h = await bootMainHarness({
    isPackaged: true,
    appName: 'Meu Financeiro',
    mfDistributionChannel: 'stable',
    seedOptions: { eligibleCount: 3 }
  });
  try {
    h.setMessageBox(async () => ({ response: 1 }));

    // Real bank personal write attempt
    const realSession = await h.invoke('d05:session-authorize', { profile: 'real' });
    await h.invoke('d05:account-authorize', { sessionToken: realSession.token, accountId: ACCOUNT_A });
    const realPreview = await h.invoke('d05:personal-write-preview', {
      sessionToken: realSession.token,
      action: 'bank.categorize',
      accountId: ACCOUNT_A,
      externalId: 'elig-0000',
      target: TARGET_FUEL
    });
    assert.equal(realPreview.contract, 'D05/PERSONAL-SUPERVISED-PREVIEW-V1');
    assert.equal(realPreview.personalWriteAuthorized, false);
    assert.equal(realPreview.changesApplied, false);
    assert.equal(realPreview.readOnly, true);

    const realConfirm = await h.invoke('d05:personal-write-confirm', {
      sessionToken: realSession.token,
      proposalId: realPreview.proposalId,
      nonce: realPreview.nonce
    });
    assert.equal(realConfirm.status, 'denied');
    assert.equal(realConfirm.changesApplied, false);
    assert.equal(realConfirm.personalWriteAuthorized, false);
    assert.match(realConfirm.reason, /não homologada\/aprovada/);

    // Demo manual write via personal gateway in main.cjs (no syntheticVault) must also be denied
    const demoSession = await h.invoke('d05:session-authorize', { profile: 'demo' });
    const demoPreview = await h.invoke('d05:personal-write-preview', {
      sessionToken: demoSession.token,
      action: 'manual.categorize',
      profile: 'demo',
      id: 'demo-tx-1',
      target: TARGET_SUPER
    });
    const demoConfirm = await h.invoke('d05:personal-write-confirm', {
      sessionToken: demoSession.token,
      proposalId: demoPreview.proposalId,
      nonce: demoPreview.nonce
    });
    assert.equal(demoConfirm.status, 'denied');
    assert.equal(demoConfirm.changesApplied, false);
    assert.equal(demoConfirm.personalWriteAuthorized, false);

    // Preload parity check: every bankAuto* method in electron/preload.cjs must map to a registered handler
    const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
    const invokedAutoChannels = [...preloadSource.matchAll(/ipcRenderer\.invoke\('(bank:auto-[a-z-]+)'/g)].map((m) => m[1]);
    assert(invokedAutoChannels.length >= 16, 'Expected all CAT-UX bank:auto-* IPC channels in preload.cjs');
    for (const ch of invokedAutoChannels) {
      assert.equal(h.handlers.has(ch), true, `Missing main.cjs handler for preload channel ${ch}`);
    }
  } finally {
    await h.close();
  }
});
