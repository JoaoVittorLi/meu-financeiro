'use strict';
// M3 Slice 3 — Supervised Account-Bound Future Rules & Category/Subcategory Structure.
// Synthetic TEMP SQLite only; never touches personal %APPDATA% or Pluggy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { FinanceDB } = require('../electron/db.cjs');
const { LocalFinancialIntelligence } = require('../electron/financial-intelligence.cjs');
const { D05PersonalWriteGateway } = require('../electron/d05-personal-gate.cjs');
const { D05CategoryService } = require('../electron/d05-category-service.cjs');
const { interpretCopilotAction } = require('../electron/copilot-actions.cjs');

const ACC_1 = '11111111-1111-4111-8111-111111111111';
const ACC_2 = '22222222-2222-4222-8222-222222222222';
const ITEM_1 = '33333333-3333-4333-8333-333333333333';

function setupS3() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-m3-s3-'));
  const db = new FinanceDB(path.join(dir, 's3.sqlite'));
  const backups = path.join(dir, 'backups');
  fs.mkdirSync(backups, { recursive: true });

  db.ingestBank(ITEM_1, {
    item: { status: 'UPDATED' },
    data: [
      {
        account: { id: ACC_1, name: 'Conta Principal', type: 'CHECKING', currencyCode: 'BRL', balance: 4000 },
        transactions: [
          { id: 'old-ifood-1', date: '2026-11-05', description: 'IFOOD *RESTAURANTE ANTIGO', amount: -49.9, status: 'POSTED', category: 'Uncategorized' },
          { id: 'old-uber-1', date: '2026-11-06', description: 'UBER *TRIP', amount: -25.0, status: 'POSTED', category: 'Uncategorized' }
        ]
      },
      {
        account: { id: ACC_2, name: 'Cartão Outro', type: 'CREDIT', currencyCode: 'BRL', balance: -500 },
        transactions: [
          { id: 'other-ifood-1', date: '2026-11-07', description: 'IFOOD *CARTAO', amount: -32.0, status: 'POSTED', category: 'Uncategorized' }
        ]
      }
    ]
  });

  // Pre-existing rule for conflict warning test
  db.upsertRule({ pattern: 'IFOOD', matchMode: 'contains', category: 'Lazer', scope: 'bank', priority: 200 });

  const local = new LocalFinancialIntelligence(db);
  const readGrant = local.authorize({ source: 'bank', profile: 'real', consent: 'LOCAL_FINANCIAL_READ_V1' }, 11);
  const scope = { owner: 11, token: readGrant.token, source: 'bank', profile: 'real', month: '2026-11' };

  const sess = { owner: 11, token: 'd05-tok', profile: 'real', activeAccountId: ACC_1 };
  const ev = { sender: { id: 11, isDestroyed: () => false } };
  const gate = new D05PersonalWriteGateway({
    finance: () => db,
    readSession: (_e, input) => {
      if (input?.accountId && input.accountId !== sess.activeAccountId) throw Error('PersonalWrite: conta fora da autorização');
      return sess;
    },
    confirm: async () => true,
    backupDirectory: () => backups,
    approvedForPersonal: () => false,
    m3CapabilityCheck: () => true
  });

  return {
    dir,
    db,
    local,
    scope,
    ev,
    gate,
    cleanup: () => {
      gate.stopAll();
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

test('M3-S3 Rules: rejects missing constraint, creates account-bound future-only rule, preserves history, applies to new ingest, and undoes', async () => {
  const ctx = setupS3();
  try {
    // 1. Contract check: missing constraint STILL throws exact canonical error
    await assert.rejects(
      () =>
        ctx.gate.prepare(ctx.ev, {
          action: 'rule.save',
          profile: 'real',
          accountId: ACC_1,
          pattern: 'IFOOD',
          target: { categoryId: 'cat:alimentacao', subcategoryId: 'sub:alimentacao/delivery' }
        }),
      /PersonalWrite: regra pessoal sem contrato por conta\/afterRowid/
    );

    // 2. Interpreter detects conflict + up to 10 sample matches + future-only boundary
    const draft = interpretCopilotAction({
      local: ctx.local,
      scope: ctx.scope,
      owner: 11,
      question: 'Sempre que aparecer iFood, coloque em Alimentação > Delivery'
    });
    assert.equal(draft.matched, true);
    assert.equal(draft.contract, 'MF3/RULE-DRAFT-V1');
    assert.equal(draft.status, 'ready');
    assert.equal(draft.action, 'rule.save');
    assert.equal(draft.futureOnly, true);
    assert.ok(draft.afterRowid >= 3);
    assert.equal(draft.conflicts.length, 1);
    assert.equal(draft.sampleMatches.length, 2);

    // 3. Remove conflicting legacy rule so we isolate S3 rule behavior in bankOverview
    ctx.db.deleteRule(draft.conflicts[0].id);

    // 4. Prepare & confirm supervised future rule on ACC_1
    const prep = await ctx.gate.prepare(ctx.ev, {
      action: 'rule.save',
      profile: 'real',
      accountId: ACC_1,
      pattern: draft.pattern,
      matchMode: draft.matchMode,
      priority: 100,
      target: draft.target,
      constraint: { accountId: ACC_1, nature: 'expense', afterRowid: draft.afterRowid }
    });
    assert.equal(prep.personalWriteAuthorized, true);
    const applied = await ctx.gate.confirmPreview(ctx.ev, {
      proposalId: prep.proposalId,
      nonce: prep.nonce,
      accountId: ACC_1
    });
    assert.equal(applied.status, 'applied');
    assert.equal(applied.changesApplied, true);
    const ruleId = applied.receipt.result.ruleId;
    assert.ok(Number.isInteger(ruleId));

    // Historic rowid <= afterRowid remains untouched (not reclassified by new rule!)
    let overview = ctx.db.bankOverview();
    const oldAcc1 = overview.transactions.find((t) => t.id === 'old-ifood-1');
    assert.equal(oldAcc1.category, 'Outros');
    assert.notEqual(oldAcc1.categorySource, 'rule');

    // Ingest new transactions AFTER afterRowid in BOTH accounts
    ctx.db.ingestBank(ITEM_1, {
      item: { status: 'UPDATED' },
      data: [
        {
          account: { id: ACC_1, name: 'Conta Principal', type: 'CHECKING', currencyCode: 'BRL', balance: 3900 },
          transactions: [
            { id: 'new-ifood-1', date: '2026-11-20', description: 'IFOOD *PEDIDO NOVO', amount: -55.0, status: 'POSTED', category: 'Uncategorized' }
          ]
        },
        {
          account: { id: ACC_2, name: 'Cartão Outro', type: 'CREDIT', currencyCode: 'BRL', balance: -560 },
          transactions: [
            { id: 'new-ifood-2', date: '2026-11-20', description: 'IFOOD *OUTRA CONTA', amount: -60.0, status: 'POSTED', category: 'Uncategorized' }
          ]
        }
      ]
    });

    overview = ctx.db.bankOverview();
    const newAcc1 = overview.transactions.find((t) => t.id === 'new-ifood-1');
    const newAcc2 = overview.transactions.find((t) => t.id === 'new-ifood-2');
    assert.equal(newAcc1.category, 'Alimentação');
    assert.equal(newAcc1.categorySource, 'rule');
    // Scoped strictly to ACC_1: ACC_2 must NOT match ACC_1's rule!
    assert.equal(newAcc2.category, 'Outros');

    // 5. Toggle rule disable -> verify, then Undo toggle -> re-enabled
    const togDraft = interpretCopilotAction({
      local: ctx.local,
      scope: ctx.scope,
      owner: 11,
      question: 'Desative a regra do iFood'
    });
    assert.equal(togDraft.action, 'rule.toggle');
    assert.equal(togDraft.enabled, false);
    const togPrep = await ctx.gate.prepare(ctx.ev, {
      action: 'rule.toggle',
      profile: 'real',
      id: togDraft.ruleId,
      enabled: false,
      accountId: ACC_1
    });
    const togApp = await ctx.gate.confirmPreview(ctx.ev, {
      proposalId: togPrep.proposalId,
      nonce: togPrep.nonce,
      accountId: ACC_1
    });
    assert.equal(togApp.status, 'applied');
    assert.equal(ctx.db.listCategories().rules.find((r) => r.id === ruleId).enabled, 0);

    const undoTog = await ctx.gate.undoReceipt(ctx.ev, {
      proposalId: togApp.receipt.proposalId,
      accountId: ACC_1
    });
    assert.equal(undoTog.status, 'undone');
    assert.equal(ctx.db.listCategories().rules.find((r) => r.id === ruleId).enabled, 1);

    // 6. Undo rule creation -> removes rule & constraint cleanly
    const undoRule = await ctx.gate.undoReceipt(ctx.ev, {
      proposalId: applied.receipt.proposalId,
      accountId: ACC_1
    });
    assert.equal(undoRule.status, 'undone');
    assert.equal(ctx.db.listCategories().rules.some((r) => r.id === ruleId), false);
  } finally {
    ctx.cleanup();
  }
});

test('M3-S3 Categories & Subcategories: create, rename, block built-in rename, and safe undo', async () => {
  const ctx = setupS3();
  try {
    // 1. Built-in category rename refused gracefully
    const blocked = interpretCopilotAction({
      local: ctx.local,
      scope: ctx.scope,
      owner: 11,
      question: 'Renomeie a categoria Alimentação para Comida'
    });
    assert.equal(blocked.matched, true);
    assert.equal(blocked.status, 'unavailable');

    // 2. Create custom category "Pets" -> confirm -> undo
    const catDraft = interpretCopilotAction({
      local: ctx.local,
      scope: ctx.scope,
      owner: 11,
      question: 'Crie a categoria Pets'
    });
    assert.equal(catDraft.action, 'category.create');
    assert.equal(catDraft.status, 'ready');
    const cPrep = await ctx.gate.prepare(ctx.ev, { action: 'category.create', profile: 'real', ...catDraft.payload });
    const cApp = await ctx.gate.confirmPreview(ctx.ev, { proposalId: cPrep.proposalId, nonce: cPrep.nonce });
    assert.equal(cApp.status, 'applied');
    assert.ok(ctx.db.listCategories().categories.some((c) => c.name === 'Pets'));

    // 3. Rename custom category Pets -> Animais -> undo rename -> Pets restored
    const renDraft = interpretCopilotAction({
      local: ctx.local,
      scope: ctx.scope,
      owner: 11,
      question: 'Renomeie a categoria Pets para Animais'
    });
    assert.equal(renDraft.action, 'category.rename');
    const rPrep = await ctx.gate.prepare(ctx.ev, { action: 'category.rename', profile: 'real', ...renDraft.payload });
    const rApp = await ctx.gate.confirmPreview(ctx.ev, { proposalId: rPrep.proposalId, nonce: rPrep.nonce });
    assert.equal(rApp.status, 'applied');
    assert.ok(ctx.db.listCategories().categories.some((c) => c.name === 'Animais'));

    const undoRen = await ctx.gate.undoReceipt(ctx.ev, { proposalId: rApp.receipt.proposalId });
    assert.equal(undoRen.status, 'undone');
    assert.ok(ctx.db.listCategories().categories.some((c) => c.name === 'Pets'));

    const undoCat = await ctx.gate.undoReceipt(ctx.ev, { proposalId: cApp.receipt.proposalId });
    assert.equal(undoCat.status, 'undone');
    assert.equal(ctx.db.listCategories().categories.some((c) => c.name === 'Pets'), false);

    // 4. Create custom subcategory -> rename -> undo blocks if in use, succeeds when unused
    const subDraft = interpretCopilotAction({
      local: ctx.local,
      scope: ctx.scope,
      owner: 11,
      question: 'Crie a subcategoria Gourmet em Alimentação'
    });
    assert.equal(subDraft.action, 'subcategory.create');
    const sPrep = await ctx.gate.prepare(ctx.ev, { action: 'subcategory.create', profile: 'real', ...subDraft.payload });
    const sApp = await ctx.gate.confirmPreview(ctx.ev, { proposalId: sPrep.proposalId, nonce: sPrep.nonce });
    assert.equal(sApp.status, 'applied');
    const subId = sApp.receipt.result.id;

    const svc = new D05CategoryService(ctx.db);
    assert.ok(svc.listCatalog().parents.find((p) => p.id === 'cat:alimentacao').subcategories.some((s) => s.id === subId));

    const sRenDraft = interpretCopilotAction({
      local: ctx.local,
      scope: ctx.scope,
      owner: 11,
      question: 'Renomeie a subcategoria Gourmet em Alimentação para Artesanal'
    });
    assert.equal(sRenDraft.action, 'subcategory.rename');
    const srPrep = await ctx.gate.prepare(ctx.ev, { action: 'subcategory.rename', profile: 'real', ...sRenDraft.payload });
    const srApp = await ctx.gate.confirmPreview(ctx.ev, { proposalId: srPrep.proposalId, nonce: srPrep.nonce });
    assert.equal(srApp.status, 'applied');

    const undoSubRen = await ctx.gate.undoReceipt(ctx.ev, { proposalId: srApp.receipt.proposalId });
    assert.equal(undoSubRen.status, 'undone');
    const undoSub = await ctx.gate.undoReceipt(ctx.ev, { proposalId: sApp.receipt.proposalId });
    assert.equal(undoSub.status, 'undone');
    assert.equal(svc.listCatalog().parents.find((p) => p.id === 'cat:alimentacao').subcategories.some((s) => s.id === subId), false);
  } finally {
    ctx.cleanup();
  }
});
