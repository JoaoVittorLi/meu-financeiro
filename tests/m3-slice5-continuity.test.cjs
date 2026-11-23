'use strict';
// M3 Slice 5 — Multi-Turn Session Continuity, Refinement Without Premature Writes & Isolation.
// Synthetic TEMP SQLite only; never touches personal %APPDATA% or Pluggy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { FinanceDB } = require('../electron/db.cjs');
const { PlanningStore } = require('../electron/planning.cjs');
const { LocalFinancialIntelligence } = require('../electron/financial-intelligence.cjs');
const { CopilotSessionContext } = require('../electron/copilot-session-context.cjs');
const { interpretCopilotAction } = require('../electron/copilot-actions.cjs');

const ACC_1 = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ITEM_1 = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

function setupS5() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-m3-s5-'));
  const db = new FinanceDB(path.join(dir, 's5.sqlite'));
  const planner = new PlanningStore(db);

  db.ingestBank(ITEM_1, {
    item: { status: 'UPDATED' },
    data: [
      {
        account: { id: ACC_1, name: 'Conta Corrente', type: 'CHECKING', currencyCode: 'BRL', balance: 5000 },
        transactions: [
          { id: 'h-1', date: '2026-09-05', description: 'ALUGUEL SET', amount: -1800.0, status: 'POSTED', category: 'Housing' },
          { id: 'h-2', date: '2026-10-05', description: 'ALUGUEL OUT', amount: -1800.0, status: 'POSTED', category: 'Housing' },
          { id: 'f-1', date: '2026-09-10', description: 'MERCADO SET', amount: -900.0, status: 'POSTED', category: 'Groceries' },
          { id: 'f-2', date: '2026-10-10', description: 'MERCADO OUT', amount: -900.0, status: 'POSTED', category: 'Groceries' },
          { id: 't-1', date: '2026-09-12', description: 'UBER SET', amount: -400.0, status: 'POSTED', category: 'Transport' },
          { id: 't-2', date: '2026-10-12', description: 'UBER OUT', amount: -400.0, status: 'POSTED', category: 'Transport' },
          { id: 'c-1', date: '2026-11-04', description: 'SUPERMERCADO ATUAL 1', amount: -120.0, status: 'POSTED', category: 'Uncategorized' },
          { id: 'c-2', date: '2026-11-08', description: 'SUPERMERCADO ATUAL 2', amount: -95.0, status: 'POSTED', category: 'Uncategorized' }
        ]
      }
    ]
  });

  db.save('real', {
    version: 5,
    settings: { opening: 0, income: 600000, fixed: 0, existing: 0, reserve: 0 },
    budgets: { Moradia: 180000, Alimentação: 90000, Transporte: 40000, Lazer: 50000 },
    transactions: []
  });

  const local = new LocalFinancialIntelligence(db, planner);
  const sessionCtx = new CopilotSessionContext();
  const g1 = local.authorize({ source: 'bank', profile: 'real', planning: true, consent: 'LOCAL_FINANCIAL_READ_V1' }, 31);
  const scope = { owner: 31, token: g1.token, source: 'bank', profile: 'real', month: '2026-11' };

  return {
    dir,
    db,
    planner,
    local,
    sessionCtx,
    scope,
    cleanup: () => {
      sessionCtx.clearAll();
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

test('M3-S5 Multi-Turn Salary Refinements: v1 -> v2 -> v3 -> v4 keep revisionDiff accurate and SQLite untouched', () => {
  const ctx = setupS5();
  try {
    // Turn 1: Initial salary proposal (v1)
    const v1 = interpretCopilotAction({
      local: ctx.local,
      planner: ctx.planner,
      scope: ctx.scope,
      owner: 31,
      sessionCtx: ctx.sessionCtx,
      question: 'Meu salário este mês é R$ 6.000, reorganize meus orçamentos.'
    });
    assert.equal(v1.status, 'ready');
    assert.equal(v1.revision, 1);

    // Turn 2: Reserve boost ("Gostei, mas quero guardar R$ 200 a mais.")
    const v2 = interpretCopilotAction({
      local: ctx.local,
      planner: ctx.planner,
      scope: ctx.scope,
      owner: 31,
      sessionCtx: ctx.sessionCtx,
      question: 'Gostei, mas quero guardar R$ 200 a mais.'
    });
    assert.equal(v2.status, 'ready');
    assert.equal(v2.revision, 2);
    assert.equal(v2.previousRevision, 1);
    assert.ok(v2.proposedReserveCents >= v1.proposedReserveCents + 15000);
    assert.ok(Array.isArray(v2.revisionDiff) && v2.revisionDiff.length > 0);

    // Turn 3: Lock category ("Trave Moradia e recalcule.")
    const v3 = interpretCopilotAction({
      local: ctx.local,
      planner: ctx.planner,
      scope: ctx.scope,
      owner: 31,
      sessionCtx: ctx.sessionCtx,
      question: 'Trave Moradia e recalcule.'
    });
    assert.equal(v3.status, 'ready');
    assert.equal(v3.revision, 3);
    assert.ok(v3.lockedCategories.includes('moradia'));

    // Turn 4: Cut specific category while preserving Moradia lock ("Reduza mais R$ 100 em Alimentação.")
    const v3Alim = v3.items.find((x) => x.category === 'Alimentação').proposedLimitCents;
    const v3Moradia = v3.items.find((x) => x.category === 'Moradia').proposedLimitCents;
    const v4 = interpretCopilotAction({
      local: ctx.local,
      planner: ctx.planner,
      scope: ctx.scope,
      owner: 31,
      sessionCtx: ctx.sessionCtx,
      question: 'Reduza mais R$ 100 em Alimentação.'
    });
    assert.equal(v4.status, 'ready');
    assert.equal(v4.revision, 4);
    assert.equal(v4.items.find((x) => x.category === 'Alimentação').proposedLimitCents, v3Alim - 10000);
    assert.equal(v4.items.find((x) => x.category === 'Moradia').proposedLimitCents, v3Moradia);

    // Verify SQLite NEVER wrote anything before native confirm
    assert.deepEqual(ctx.db.load('real').monthlyBudgets || {}, {});
    assert.equal(ctx.db.load('real').budgets.Alimentação, 90000);
  } finally {
    ctx.cleanup();
  }
});

test('M3-S5 Anaphora Resolution & Session Isolation across token revoke / month change', () => {
  const ctx = setupS5();
  try {
    // Prepare list from S1 categorize -> remembered in ephemeral sessionCtx
    const first = interpretCopilotAction({
      local: ctx.local,
      scope: ctx.scope,
      owner: 31,
      sessionCtx: ctx.sessionCtx,
      question: 'Coloque compras do Supermercado Atual em Compras'
    });
    assert.equal(first.status, 'ready');
    assert.equal(first.eligibleCount, 2);

    // Anaphora follow-up: "Coloque essas movimentações em Alimentação"
    const second = interpretCopilotAction({
      local: ctx.local,
      scope: ctx.scope,
      owner: 31,
      sessionCtx: ctx.sessionCtx,
      question: 'Coloque essas movimentações em Alimentação'
    });
    assert.equal(second.status, 'ready');
    assert.equal(second.eligibleCount, 2);
    assert.equal(second.targetLabel, 'Alimentação');

    // Different month has isolated empty session -> must ask clarification instead of guessing
    const otherMonthScope = { ...ctx.scope, month: '2026-10' };
    const crossMonth = interpretCopilotAction({
      local: ctx.local,
      scope: otherMonthScope,
      owner: 31,
      sessionCtx: ctx.sessionCtx,
      question: 'Coloque essas movimentações em Transporte'
    });
    assert.equal(crossMonth.status, 'needs_clarification');

    // Token clear destroys session state cleanly
    ctx.sessionCtx.clearByToken(ctx.scope.token);
    const afterRevoke = interpretCopilotAction({
      local: ctx.local,
      scope: ctx.scope,
      owner: 31,
      sessionCtx: ctx.sessionCtx,
      question: 'Coloque essas movimentações em Lazer'
    });
    assert.equal(afterRevoke.status, 'needs_clarification');
  } finally {
    ctx.cleanup();
  }
});
