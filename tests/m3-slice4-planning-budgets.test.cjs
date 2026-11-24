'use strict';
// M3 Slice 4 — Supervised Single-Budget Edits, Planning Create/Update/Status & F4-to-Plan.
// Synthetic TEMP SQLite only; never touches personal %APPDATA% or Pluggy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { FinanceDB } = require('../electron/db.cjs');
const { PlanningStore } = require('../electron/planning.cjs');
const { LocalFinancialIntelligence } = require('../electron/financial-intelligence.cjs');
const { D05PersonalWriteGateway } = require('../electron/d05-personal-gate.cjs');
const { CopilotSessionContext } = require('../electron/copilot-session-context.cjs');
const { simulateDecisionForCopilot } = require('../electron/intelligence-simulator-copilot.cjs');
const { interpretCopilotAction } = require('../electron/copilot-actions.cjs');

const ACC_1 = '11111111-1111-4111-8111-111111111111';
const ITEM_1 = '22222222-2222-4222-8222-222222222222';

function setupS4() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-m3-s4-'));
  const db = new FinanceDB(path.join(dir, 's4.sqlite'));
  const planner = new PlanningStore(db);
  const backups = path.join(dir, 'backups');
  fs.mkdirSync(backups, { recursive: true });

  db.ingestBank(ITEM_1, {
    item: { status: 'UPDATED' },
    data: [
      {
        account: { id: ACC_1, name: 'Conta Principal', type: 'CHECKING', currencyCode: 'BRL', balance: 6500 },
        transactions: [
          { id: 'sal-11', date: '2026-11-05', description: 'SALARIO EMPRESA', amount: 6500.0, status: 'POSTED', category: 'Salary' },
          { id: 'laz-11', date: '2026-11-10', description: 'CINEMA SHOPPING', amount: -120.0, status: 'POSTED', category: 'Leisure' }
        ]
      }
    ]
  });
  db.save('real', {
    version: 5,
    settings: { opening: 0, income: 650000, fixed: 0, existing: 0, reserve: 50000 },
    budgets: { Lazer: 40000 },
    transactions: []
  });

  const local = new LocalFinancialIntelligence(db, planner);
  const sessionCtx = new CopilotSessionContext();
  const grant = local.authorize({ source: 'bank', profile: 'real', planning: true, consent: 'LOCAL_FINANCIAL_READ_V1' }, 21);
  const scope = { owner: 21, token: grant.token, source: 'bank', profile: 'real', month: '2026-11' };

  const sess = { owner: 21, token: 'd05-s4', profile: 'real', activeAccountId: ACC_1 };
  const ev = { sender: { id: 21, isDestroyed: () => false } };
  const gate = new D05PersonalWriteGateway({
    finance: () => db,
    readSession: () => sess,
    confirm: async () => true,
    backupDirectory: () => backups,
    approvedForPersonal: () => false,
    m3CapabilityCheck: () => true
  });

  return {
    dir,
    db,
    planner,
    local,
    sessionCtx,
    scope,
    ev,
    gate,
    cleanup: () => {
      gate.stopAll();
      sessionCtx.clearAll();
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

test('M3-S4 Single Budget Edit: month-scoped edit applies cleanly without overwriting recurring, and undoes', async () => {
  const ctx = setupS4();
  try {
    const draft = interpretCopilotAction({
      local: ctx.local,
      planner: ctx.planner,
      scope: ctx.scope,
      owner: 21,
      sessionCtx: ctx.sessionCtx,
      question: 'Deixe meu limite de lazer em R$ 250.'
    });
    assert.equal(draft.matched, true);
    assert.equal(draft.contract, 'MF3/BUDGET-EDIT-DRAFT-V1');
    assert.equal(draft.status, 'ready');
    assert.equal(draft.category, 'Lazer');
    assert.equal(draft.proposedLimitCents, 25000);
    assert.equal(draft.applyRecurring, false);

    const prep = await ctx.gate.prepare(ctx.ev, {
      action: 'budgets.reorganize',
      profile: 'real',
      month: '2026-11',
      applyRecurring: false,
      budgets: [{ category: 'Lazer', amountCents: 25000 }]
    });
    const app = await ctx.gate.confirmPreview(ctx.ev, { proposalId: prep.proposalId, nonce: prep.nonce });
    assert.equal(app.status, 'applied');

    // Only 2026-11 changes; 2026-12 retains 40000 recurring
    assert.equal(ctx.db.effectiveBudgets('real', '2026-11').effective.Lazer, 25000);
    assert.equal(ctx.db.effectiveBudgets('real', '2026-12').effective.Lazer, 40000);

    const undo = await ctx.gate.undoReceipt(ctx.ev, { proposalId: app.receipt.proposalId });
    assert.equal(undo.status, 'undone');
    assert.equal(ctx.db.effectiveBudgets('real', '2026-11').effective.Lazer, 40000);
  } finally {
    ctx.cleanup();
  }
});

test('M3-S4 Planning CRUD + Duplicate Warning + Explicit No-Payment Notice + F4 Simulation Conversion', async () => {
  const ctx = setupS4();
  try {
    // 1. Create single planned expense for next month
    const createDraft = interpretCopilotAction({
      local: ctx.local,
      planner: ctx.planner,
      scope: ctx.scope,
      owner: 21,
      sessionCtx: ctx.sessionCtx,
      question: 'Registre uma despesa prevista de R$ 135 para esportes no próximo mês.'
    });
    assert.equal(createDraft.matched, true);
    assert.equal(createDraft.contract, 'MF3/PLANNING-DRAFT-V1');
    assert.equal(createDraft.status, 'ready');
    assert.equal(createDraft.action, 'planning.create');
    assert.equal(createDraft.amountCents, 13500);
    assert.ok(createDraft.dueDate.startsWith('2026-12-'));
    assert.match(createDraft.noBankPaymentNotice, /NÃO efetua pagamento/i);

    const pPrep = await ctx.gate.prepare(ctx.ev, { action: 'planning.create', profile: 'real', ...createDraft.payload });
    const pApp = await ctx.gate.confirmPreview(ctx.ev, { proposalId: pPrep.proposalId, nonce: pPrep.nonce });
    assert.equal(pApp.status, 'applied');
    const createdId = pApp.receipt.result.createdIds[0];
    assert.ok(ctx.planner.list({}).some((x) => x.id === createdId && x.amount === 13500));

    // Duplicate check triggers warning on similar second draft
    const dupDraft = interpretCopilotAction({
      local: ctx.local,
      planner: ctx.planner,
      scope: ctx.scope,
      owner: 21,
      question: 'Registre uma despesa prevista de R$ 135 para esportes no próximo mês.'
    });
    assert.equal(dupDraft.duplicates.length, 1);
    assert.ok(dupDraft.warnings.some((w) => /duplicidade/i.test(w)));

    // 2. Update planned item due date -> confirm -> undo -> restores previous date
    const updDraft = interpretCopilotAction({
      local: ctx.local,
      planner: ctx.planner,
      scope: ctx.scope,
      owner: 21,
      question: 'Altere o vencimento do Esportes para dia 10.'
    });
    assert.equal(updDraft.action, 'planning.update');
    assert.equal(updDraft.dueDate, '2026-12-10');
    const uPrep = await ctx.gate.prepare(ctx.ev, { action: 'planning.update', profile: 'real', ...updDraft.payload });
    const uApp = await ctx.gate.confirmPreview(ctx.ev, { proposalId: uPrep.proposalId, nonce: uPrep.nonce });
    assert.equal(uApp.status, 'applied');
    assert.equal(ctx.planner.item(createdId).due_date, '2026-12-10');

    const uUndo = await ctx.gate.undoReceipt(ctx.ev, { proposalId: uApp.receipt.proposalId });
    assert.equal(uUndo.status, 'undone');
    assert.equal(ctx.planner.item(createdId).due_date, createDraft.dueDate);

    // Undo original creation cleanly
    const cUndo = await ctx.gate.undoReceipt(ctx.ev, { proposalId: pApp.receipt.proposalId });
    assert.equal(cUndo.status, 'undone');
    assert.equal(ctx.planner.list({}).some((x) => x.id === createdId), false);

    // 3. F4 simulation -> CopilotSessionContext -> Convert simulated installment purchase to planning -> Undo
    const simResult = await simulateDecisionForCopilot({
      local: ctx.local,
      scope: ctx.scope,
      intention: { kind: 'purchase', amountCents: 180000, installments: 6, monthlyRate: 0 }
    });
    assert.ok(simResult.principalCents === 180000 && simResult.installments === 6);
    ctx.sessionCtx.recordSkillOutput(ctx.scope, 21, 'simulation', simResult);

    const fromSimDraft = interpretCopilotAction({
      local: ctx.local,
      planner: ctx.planner,
      scope: ctx.scope,
      owner: 21,
      sessionCtx: ctx.sessionCtx,
      question: 'Adicione ao planejamento a compra parcelada que acabamos de simular.'
    });
    assert.equal(fromSimDraft.matched, true);
    assert.equal(fromSimDraft.contract, 'MF3/PLANNING-DRAFT-V1');
    assert.equal(fromSimDraft.fromSimulation, true);
    assert.equal(fromSimDraft.mode, 'installments');
    assert.equal(fromSimDraft.count, 6);
    assert.equal(fromSimDraft.totalAmountCents, 180000);

    const simPrep = await ctx.gate.prepare(ctx.ev, { action: 'planning.create', profile: 'real', ...fromSimDraft.payload });
    const simApp = await ctx.gate.confirmPreview(ctx.ev, { proposalId: simPrep.proposalId, nonce: simPrep.nonce });
    assert.equal(simApp.status, 'applied');
    assert.equal(simApp.receipt.result.createdIds.length, 6);
    const items = ctx.planner.list({}).filter((x) => simApp.receipt.result.createdIds.includes(x.id));
    assert.equal(items.reduce((s, x) => s + x.amount, 0), 180000);

    const simUndo = await ctx.gate.undoReceipt(ctx.ev, { proposalId: simApp.receipt.proposalId });
    assert.equal(simUndo.status, 'undone');
    assert.equal(ctx.planner.list({}).filter((x) => simApp.receipt.result.createdIds.includes(x.id)).length, 0);
  } finally {
    ctx.cleanup();
  }
});
