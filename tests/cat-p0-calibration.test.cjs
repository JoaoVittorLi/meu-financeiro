'use strict';
// Synthetic Calibration & False-Positive Evaluation Suite for Issue #71 Gate G6.
// Tests provisional 5-corrections / 3-dates threshold, duplicate-anchor inflation,
// conflicting human overrides, non-Premium Pluggy path, processor/PIX rejections,
// and Naive Bayes strict review-only boundary.
// Uses MF_QA_SYNTHETIC=1, zero personal DBs, zero Pluggy credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { FinanceDB } = require('../electron/db.cjs');
const { D05CategoryService } = require('../electron/d05-category-service.cjs');
const { D05AutoCategorization, MIN_ANCHORS, MIN_DATES } = require('../electron/d05-auto-categorization.cjs');
const { normalizePluggyEvidence, isCnpj } = require('../electron/cat01-pluggy-evidence.cjs');
const { classifyCandidate, teachLocalModel, inferLocalModel } = require('../electron/cat02-classifier.cjs');

const ACCOUNT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACCOUNT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ITEM_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ITEM_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SPAN = { startDate: '2026-01-01', endDate: '2026-12-31' };

const TARGET_SUPER = { categoryId: 'cat:alimentacao', subcategoryId: 'sub:alimentacao/supermercados' };
const TARGET_FUEL = { categoryId: 'cat:transporte', subcategoryId: 'sub:transporte/combustivel' };
const TARGET_PHARM = { categoryId: 'cat:saude', subcategoryId: 'sub:saude/farmacia' };

const VALID_CNPJS = ['12345678000195', '11222333000181', '33000167000101'];

async function withSandbox(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-cat-calibration-'));
  const db = new FinanceDB(path.join(root, 'synthetic.sqlite'));
  try {
    db.ingestBank(ITEM_A, {
      item: { status: 'UPDATED' },
      data: [{ account: { id: ACCOUNT_A, name: 'CONTA CALIBRACAO A', type: 'CHECKING', currencyCode: 'BRL', balance: 2000 }, transactions: [] }]
    });
    db.ingestBank(ITEM_B, {
      item: { status: 'UPDATED' },
      data: [{ account: { id: ACCOUNT_B, name: 'CONTA CALIBRACAO B', type: 'CHECKING', currencyCode: 'BRL', balance: 1000 }, transactions: [] }]
    });
    const d05 = new D05CategoryService(db);
    const auto = new D05AutoCategorization({
      finance: () => db,
      backupDirectory: () => path.join(root, 'backups')
    });
    return await fn({ root, db, d05, auto });
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function ingestRows(db, accountId, itemId, transactions) {
  const name = accountId === ACCOUNT_A ? 'CONTA CALIBRACAO A' : 'CONTA CALIBRACAO B';
  db.ingestBank(itemId, {
    item: { status: 'UPDATED' },
    data: [{ account: { id: accountId, name, type: 'CHECKING', currencyCode: 'BRL', balance: 2000 }, transactions }]
  });
}

test('G6-01: below provisional 5-corrections / 3-dates threshold NEVER auto-applies', async () => {
  assert.equal(MIN_ANCHORS, 5);
  assert.equal(MIN_DATES, 3);

  // 1a. 4 corrections across 4 distinct dates (< 5 anchors)
  await withSandbox(async ({ db, d05, auto }) => {
    const anchors = ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07'].map((date, i) => ({
      id: `a4-${i}`, date, description: 'MERCADINHO PONTO CERTO', amount: -(20 + i), status: 'POSTED', category: 'Uncategorized'
    }));
    const targetTx = { id: 'cand-4', date: '2026-10-15', description: 'MERCADINHO PONTO CERTO', amount: -35.50, status: 'POSTED', category: 'Uncategorized' };
    ingestRows(db, ACCOUNT_A, ITEM_A, [...anchors, targetTx]);
    for (const a of anchors) d05.assignBank({ accountId: ACCOUNT_A, externalId: a.id, target: TARGET_SUPER });

    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 0);
    assert.equal(plan.reviewCount, 1);
    assert.equal(plan.review[0].reason, 'Evidência insuficiente');
    assert.equal((await auto.apply()).applied, 0);
  });

  // 1b. 5 corrections across only 2 distinct dates (< 3 distinct dates)
  await withSandbox(async ({ db, d05, auto }) => {
    const dates = ['2026-10-01', '2026-10-01', '2026-10-01', '2026-10-02', '2026-10-02'];
    const anchors = dates.map((date, i) => ({
      id: `d2-${i}`, date, description: 'MERCADINHO DUAS DATAS', amount: -(11 + i), status: 'POSTED', category: 'Uncategorized'
    }));
    const targetTx = { id: 'cand-2d', date: '2026-10-20', description: 'MERCADINHO DUAS DATAS', amount: -42.10, status: 'POSTED', category: 'Uncategorized' };
    ingestRows(db, ACCOUNT_A, ITEM_A, [...anchors, targetTx]);
    for (const a of anchors) d05.assignBank({ accountId: ACCOUNT_A, externalId: a.id, target: TARGET_SUPER });

    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 0);
    assert.equal(plan.review[0].reason, 'Evidência insuficiente');
    assert.equal((await auto.apply()).applied, 0);
  });

  // 1c. 5 corrections across 3 dates on ACCOUNT_A must NOT authorize ACCOUNT_B
  await withSandbox(async ({ db, d05, auto }) => {
    const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'];
    const anchors = dates.map((date, i) => ({
      id: `iso-${i}`, date, description: 'MERCEARIA CONTA ISOLADA', amount: -(15 + i), status: 'POSTED', category: 'Uncategorized'
    }));
    const otherAcctTx = { id: 'b-cand', date: '2026-10-12', description: 'MERCEARIA CONTA ISOLADA', amount: -99, status: 'POSTED', category: 'Uncategorized' };
    ingestRows(db, ACCOUNT_A, ITEM_A, anchors);
    ingestRows(db, ACCOUNT_B, ITEM_B, [otherAcctTx]);
    for (const a of anchors) d05.assignBank({ accountId: ACCOUNT_A, externalId: a.id, target: TARGET_SUPER });

    auto.configure({ accountIds: [ACCOUNT_A, ACCOUNT_B], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 0);
    assert.equal((await auto.apply()).applied, 0);
  });
});

test('G6-02: duplicate-anchor inflation attack is deduped/excluded and NEVER crosses 5/3 threshold', async () => {
  // 2a. 2 independent anchors + 4 cloned anchors sharing (date, amountCents) -> 6 stored overrides, only 2 verified
  await withSandbox(async ({ db, d05, auto }) => {
    const anchors = [
      { id: 'orig-1', date: '2026-10-01', amount: -25.00 },
      { id: 'orig-2', date: '2026-10-04', amount: -30.00 },
      { id: 'dup-1a', date: '2026-10-08', amount: -19.90 },
      { id: 'dup-1b', date: '2026-10-08', amount: -19.90 },
      { id: 'dup-2a', date: '2026-10-11', amount: -27.50 },
      { id: 'dup-2b', date: '2026-10-11', amount: -27.50 }
    ].map((x) => ({ ...x, description: 'MERCADO ATAQUE INFLACAO', status: 'POSTED', category: 'Uncategorized' }));
    const targetTx = { id: 'cand-inf', date: '2026-10-20', description: 'MERCADO ATAQUE INFLACAO', amount: -44.00, status: 'POSTED', category: 'Uncategorized' };
    ingestRows(db, ACCOUNT_A, ITEM_A, [...anchors, targetTx]);
    for (const a of anchors) d05.assignBank({ accountId: ACCOUNT_A, externalId: a.id, target: TARGET_SUPER });

    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 0);
    assert.equal(plan.review[0].reason, 'Evidência insuficiente');
    assert.equal((await auto.apply()).applied, 0);
  });

  // 2b. 4 independent anchors on 4 dates + 2 duplicate-date-amount anchors on 5th date (6 overrides -> 4 verified < 5)
  await withSandbox(async ({ db, d05, auto }) => {
    const anchors = [
      { id: 'ind-1', date: '2026-10-01', amount: -10.00 },
      { id: 'ind-2', date: '2026-10-02', amount: -12.00 },
      { id: 'ind-3', date: '2026-10-03', amount: -14.00 },
      { id: 'ind-4', date: '2026-10-04', amount: -16.00 },
      { id: 'clone-5a', date: '2026-10-05', amount: -18.00 },
      { id: 'clone-5b', date: '2026-10-05', amount: -18.00 }
    ].map((x) => ({ ...x, description: 'MERCADO QUASE CINCO', status: 'POSTED', category: 'Uncategorized' }));
    const targetTx = { id: 'cand-q5', date: '2026-10-22', description: 'MERCADO QUASE CINCO', amount: -33.00, status: 'POSTED', category: 'Uncategorized' };
    ingestRows(db, ACCOUNT_A, ITEM_A, [...anchors, targetTx]);
    for (const a of anchors) d05.assignBank({ accountId: ACCOUNT_A, externalId: a.id, target: TARGET_SUPER });

    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 0);
    assert.equal((await auto.apply()).applied, 0);
  });
});

test('G6-03: conflicting human corrections (including duplicate-anchor conflicts) force review with zero false positives', async () => {
  await withSandbox(async ({ db, d05, auto }) => {
    // 5 anchors to SUPER + 1 conflicting anchor to FUEL
    const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'];
    const good = dates.map((date, i) => ({
      id: `g-${i}`, date, description: 'LOJA CONVENIENCIA MISTA', amount: -(15 + i), status: 'POSTED', category: 'Uncategorized'
    }));
    const conflict = { id: 'c-1', date: '2026-10-06', description: 'LOJA CONVENIENCIA MISTA', amount: -80, status: 'POSTED', category: 'Uncategorized' };
    const cand = { id: 'cand-conf', date: '2026-10-18', description: 'LOJA CONVENIENCIA MISTA', amount: -29, status: 'POSTED', category: 'Uncategorized' };
    ingestRows(db, ACCOUNT_A, ITEM_A, [...good, conflict, cand]);
    for (const a of good) d05.assignBank({ accountId: ACCOUNT_A, externalId: a.id, target: TARGET_SUPER });
    d05.assignBank({ accountId: ACCOUNT_A, externalId: conflict.id, target: TARGET_FUEL });

    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 0);
    assert.equal(plan.review[0].reason, 'Correções anteriores contraditórias');
    assert.equal((await auto.apply()).applied, 0);
  });

  // Conflicting anchor present only as duplicate pair must still block
  await withSandbox(async ({ db, d05, auto }) => {
    const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'];
    const good = dates.map((date, i) => ({
      id: `gd-${i}`, date, description: 'POSTO E MERCADO DUAL', amount: -(15 + i), status: 'POSTED', category: 'Uncategorized'
    }));
    const dupConflict = [
      { id: 'cd-1', date: '2026-10-09', description: 'POSTO E MERCADO DUAL', amount: -50, status: 'POSTED', category: 'Uncategorized' },
      { id: 'cd-2', date: '2026-10-09', description: 'POSTO E MERCADO DUAL', amount: -50, status: 'POSTED', category: 'Uncategorized' }
    ];
    const cand = { id: 'cand-dup-conf', date: '2026-10-18', description: 'POSTO E MERCADO DUAL', amount: -31, status: 'POSTED', category: 'Uncategorized' };
    ingestRows(db, ACCOUNT_A, ITEM_A, [...good, ...dupConflict, cand]);
    for (const a of good) d05.assignBank({ accountId: ACCOUNT_A, externalId: a.id, target: TARGET_SUPER });
    for (const c of dupConflict) d05.assignBank({ accountId: ACCOUNT_A, externalId: c.id, target: TARGET_FUEL });

    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 0);
    assert.equal(plan.review[0].reason, 'Correções anteriores contraditórias');
  });
});

test('G6-04: valid >=5 independent corrections across >=3 distinct dates auto-applies accurately without cross-merchant leakage', async () => {
  await withSandbox(async ({ db, d05, auto }) => {
    // Boundary: exactly 5 corrections across exactly 3 distinct dates (2 + 2 + 1)
    const anchors = [
      { id: 'v-1', date: '2026-10-01', amount: -12.10 },
      { id: 'v-2', date: '2026-10-01', amount: -18.20 },
      { id: 'v-3', date: '2026-10-05', amount: -24.30 },
      { id: 'v-4', date: '2026-10-05', amount: -31.40 },
      { id: 'v-5', date: '2026-10-10', amount: -45.50 }
    ].map((x) => ({ ...x, description: 'MERCADO VERIFICADO ALFA', status: 'POSTED', category: 'Uncategorized' }));

    const shouldApply = [
      { id: 'tp-1', date: '2026-10-12', description: 'MERCADO VERIFICADO ALFA', amount: -55.00, status: 'POSTED', category: 'Uncategorized' },
      { id: 'tp-2', date: '2026-10-14', description: 'MERCADO VERIFICADO ALFA', amount: -62.00, status: 'POSTED', category: 'Uncategorized' }
    ];
    const unrelated = { id: 'fp-guard', date: '2026-10-14', description: 'MERCADO VERIFICADO BETA', amount: -62.00, status: 'POSTED', category: 'Uncategorized' };

    ingestRows(db, ACCOUNT_A, ITEM_A, [...anchors, ...shouldApply, unrelated]);
    for (const a of anchors) d05.assignBank({ accountId: ACCOUNT_A, externalId: a.id, target: TARGET_SUPER });

    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 2);
    assert.equal(plan.reviewCount, 1);
    assert.deepEqual(plan.candidates.map((c) => c.externalId).sort(), ['tp-1', 'tp-2']);
    assert(plan.candidates.every((c) => c.target.categoryId === TARGET_SUPER.categoryId && c.target.subcategoryId === TARGET_SUPER.subcategoryId));

    const res = await auto.apply();
    assert.equal(res.applied, 2);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n, 2);
    assert.equal(db.db.prepare('SELECT 1 FROM mf_auto_labels WHERE external_id=?').get('fp-guard'), undefined);
  });
});

test('G6-05: non-Premium Pluggy path (narrow MCC 5411/5541/5912 + DEBIT + CARD_PURCHASE + valid CNPJ + merchant>=8) yields parent-only', async () => {
  for (const c of VALID_CNPJS) assert.equal(isCnpj(c), true, `Expected valid synthetic CNPJ: ${c}`);

  const cases = [
    { id: 'np-5411', mcc: '5411', name: 'SUPERMERCADO ALFA SUL', cnpj: VALID_CNPJS[0], expectedCat: 'cat:alimentacao', expectedName: 'Alimentação' },
    { id: 'np-5541', mcc: '5541', name: 'AUTO POSTO ESTRADA REAL', cnpj: VALID_CNPJS[1], expectedCat: 'cat:transporte', expectedName: 'Transporte' },
    { id: 'np-5912', mcc: '5912', name: 'DROGARIA VIDA PLENA', cnpj: VALID_CNPJS[2], expectedCat: 'cat:saude', expectedName: 'Saúde' }
  ];

  // Unit classifier check (no providerCategory / no Pluggy Premium)
  for (const item of cases) {
    const ev = normalizePluggyEvidence({
      id: item.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: `COMPRA CARTAO ${item.name} 10/10`,
      category: null,
      merchant: { name: item.name, cnpj: item.cnpj },
      creditCardMetadata: { payeeMCC: item.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: item.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -4200,
        description: `COMPRA CARTAO ${item.name} 10/10`
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'apply', `Expected apply for MCC ${item.mcc}`);
    assert.equal(verdict.reason, 'VERIFIED_DIRECT_MERCHANT_MCC_PARENT');
    assert.deepEqual(verdict.target, { categoryId: item.expectedCat, subcategoryId: null });
    assert.equal(verdict.quality, 'restricted_parent_only');
    assert.equal(verdict.modelUsed, false);
  }

  // End-to-end SQLite + D05AutoCategorization check
  await withSandbox(async ({ db, auto }) => {
    ingestRows(db, ACCOUNT_A, ITEM_A, cases.map((item, i) => ({
      id: item.id,
      date: `2026-10-${10 + i}`,
      description: `COMPRA CARTAO ${item.name} 10/10`,
      amount: -(42 + i),
      status: 'POSTED',
      category: null,
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      merchant: { name: item.name, cnpj: item.cnpj },
      creditCardMetadata: { payeeMCC: item.mcc }
    })));
    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 3);
    assert.equal(plan.candidates.every((c) => c.target.subcategoryId === null), true);

    const applied = await auto.apply();
    assert.equal(applied.applied, 3);
    for (const item of cases) {
      const label = db.db.prepare('SELECT category_id, subcategory_id FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT_A, item.id);
      assert.equal(label.category_id, item.expectedCat);
      assert.equal(label.subcategory_id, null);
      const raw = db.db.prepare('SELECT category FROM bank_transactions WHERE account_id=? AND external_id=?').get(ACCOUNT_A, item.id);
      assert.equal(raw.category, 'Outros');
      const view = db.bankOverview().transactions.find((t) => t.id === item.id);
      assert.equal(view.categorySource, 'automatic');
      assert.equal(view.category, item.expectedName);
    }
  });
});

test('G6-06: payment processors/aggregators, PIX, mismatched description, non-DEBIT, invalid CNPJ & broad MCC are strictly rejected', async () => {
  const rejectedEvidenceCases = [
    { label: 'processor MERCADO PAGO', desc: 'COMPRA MERCADO PAGO', name: 'MERCADO PAGO', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'processor MERCADOPAGO (concatenated)', desc: 'COMPRA MERCADOPAGO', name: 'MERCADOPAGO', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'processor PAGSEGURO', desc: 'COMPRA PAGSEGURO INTERNET', name: 'PAGSEGURO INTERNET', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'processor PICPAY', desc: 'COMPRA PICPAY SERVICOS', name: 'PICPAY SERVICOS', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'processor STONE', desc: 'COMPRA STONE PAGAMENTOS', name: 'STONE PAGAMENTOS', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'processor CIELO', desc: 'COMPRA CIELO BRASIL', name: 'CIELO BRASIL', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'processor PAYPAL', desc: 'COMPRA PAYPAL BRASIL', name: 'PAYPAL BRASIL', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'processor GETNET', desc: 'COMPRA GETNET BRASIL', name: 'GETNET BRASIL', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'processor REDE', desc: 'COMPRA REDE CARD', name: 'REDE CARD', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'processor SUMUP', desc: 'COMPRA SUMUP SOLUCOES', name: 'SUMUP SOLUCOES', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'processor PAGAR.ME', desc: 'COMPRA PAGAR.ME PAGAMENTOS', name: 'PAGAR.ME PAGAMENTOS', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'PIX without verified CNPJ', desc: 'PIX SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', cnpj: null, mcc: '5411', type: 'DEBIT', op: 'PIX', paymentMethod: 'PIX' },
    { label: 'PIX operationType even with CNPJ', desc: 'PIX SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'PIX', paymentMethod: 'PIX' },
    { label: 'non-DEBIT CREDIT type', desc: 'ESTORNO SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'CREDIT', op: 'CARD_PURCHASE' },
    { label: 'mismatched description vs merchantName', desc: 'COMPRA LOJA ALEATORIA XYZ', name: 'SUPERMERCADO ALFA SUL', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'short merchantName < 8 chars', desc: 'COMPRA PADARIA SOL', name: 'PADARIA', cnpj: VALID_CNPJS[0], mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'invalid CNPJ check digit', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', cnpj: '12345678000100', mcc: '5411', type: 'DEBIT', op: 'CARD_PURCHASE' },
    { label: 'broad non-narrow MCC 5812 without providerCategory', desc: 'COMPRA RESTAURANTE ESTRELA', name: 'RESTAURANTE ESTRELA', cnpj: VALID_CNPJS[0], mcc: '5812', type: 'DEBIT', op: 'CARD_PURCHASE' }
  ];

  const failures = [];
  for (let i = 0; i < rejectedEvidenceCases.length; i++) {
    const c = rejectedEvidenceCases[i];
    const id = `rej-${i}`;
    const ev = normalizePluggyEvidence({
      id,
      status: 'POSTED',
      type: c.type,
      operationType: c.op,
      paymentData: c.paymentMethod ? { paymentMethod: c.paymentMethod } : undefined,
      description: c.desc,
      category: null,
      merchant: { name: c.name, cnpj: c.cnpj },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -3500,
        description: c.desc
      },
      evidence: ev
    });
    if (verdict.status === 'apply') {
      failures.push(`${c.label} unexpectedly returned apply (${verdict.reason})`);
    }
  }
  assert.deepEqual(failures, [], `False positives detected in processor/non-DEBIT rejection matrix: ${failures.join('; ')}`);

  // Credit card accountType must also remain review-only
  const creditVerdict = classifyCandidate({
    transaction: {
      accountId: ACCOUNT_A,
      externalId: 'cc-1',
      accountType: 'CREDIT',
      status: 'POSTED',
      amountCents: -5000,
      description: 'COMPRA SUPERMERCADO ALFA SUL'
    },
    evidence: normalizePluggyEvidence({
      id: 'cc-1',
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: 'COMPRA SUPERMERCADO ALFA SUL',
      category: 'Groceries',
      merchant: { name: 'SUPERMERCADO ALFA SUL', cnpj: VALID_CNPJS[0] },
      creditCardMetadata: { payeeMCC: '5411' }
    }, { accountId: ACCOUNT_A, accountType: 'CREDIT' })
  });
  assert.equal(creditVerdict.status, 'review');
  assert.equal(creditVerdict.reason, 'CREDIT_CARD_BILL_PARITY_NOT_APPROVED');
});

test('G6-07: Naive Bayes classifier (cat02-classifier.cjs) remains strictly review-only and never authorizes apply', async () => {
  const trainingRows = [
    ...Array.from({ length: 6 }, (_, i) => ({
      approvedByHuman: true,
      description: `SUPERMERCADO ESTRELA DO SUL FILIAL ${i}`,
      target: TARGET_SUPER
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      approvedByHuman: true,
      description: `POSTO COMBUSTIVEL RODOVIA NORTE ${i}`,
      target: TARGET_FUEL
    }))
  ];
  const model = teachLocalModel(trainingRows);
  assert.equal(model.trained, true);
  assert.equal(model.samples, 12);
  assert.equal(model.classes, 2);

  const ranked = inferLocalModel('SUPERMERCADO ESTRELA DO SUL COMPRA', model);
  assert.equal(ranked.status, 'ranked_for_review');
  assert.equal(ranked.model, 'local-naive-bayes-v1-uncalibrated');
  assert.deepEqual(ranked.candidates[0].target, TARGET_SUPER);

  // Without deterministic evidence, classifyCandidate MUST return review (never apply)
  const noEvidence = classifyCandidate({
    transaction: {
      accountId: ACCOUNT_A,
      externalId: 'nb-1',
      accountType: 'BANK',
      status: 'POSTED',
      amountCents: -8900,
      description: 'SUPERMERCADO ESTRELA DO SUL COMPRA'
    },
    evidence: {},
    model
  });
  assert.equal(noEvidence.status, 'review');
  assert.equal(noEvidence.readOnly, true);
  assert.equal(noEvidence.changesApplied, false);
  assert.equal(noEvidence.modelUsed, true);
  assert.equal(noEvidence.localInference.status, 'ranked_for_review');

  // Even with a single uncorroborated signal + trained Naive Bayes, status MUST stay review
  const singleSignalPlusNb = classifyCandidate({
    transaction: {
      accountId: ACCOUNT_A,
      externalId: 'nb-2',
      accountType: 'BANK',
      status: 'POSTED',
      amountCents: -8900,
      description: 'SUPERMERCADO ESTRELA DO SUL COMPRA'
    },
    evidence: normalizePluggyEvidence({
      id: 'nb-2',
      status: 'POSTED',
      description: 'SUPERMERCADO ESTRELA DO SUL COMPRA',
      category: 'Groceries'
    }, { accountId: ACCOUNT_A }),
    model
  });
  assert.equal(singleSignalPlusNb.status, 'review');
  assert.equal(singleSignalPlusNb.reason, 'SINGLE_UNCORROBORATED_SIGNAL');

  await withSandbox(async ({ auto }) => {
    assert.equal(auto.status().modelInference, false);
  });
});

test('G6-08: End-to-end Gate G6 calibration matrix measures precision=1.0 and falsePositives=0', async () => {
  await withSandbox(async ({ db, d05, auto }) => {
    // 5 human anchors across 3 dates for valid merchant
    const humanAnchors = [
      { id: 'cal-h1', date: '2026-10-01', amount: -21.00 },
      { id: 'cal-h2', date: '2026-10-01', amount: -22.00 },
      { id: 'cal-h3', date: '2026-10-04', amount: -23.00 },
      { id: 'cal-h4', date: '2026-10-04', amount: -24.00 },
      { id: 'cal-h5', date: '2026-10-08', amount: -25.00 }
    ].map((x) => ({ ...x, description: 'SACOLAO CENTRAL CALIBRACAO', status: 'POSTED', category: 'Uncategorized' }));

    // 4-anchor under-threshold merchant (must stay review)
    const underAnchors = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((date, i) => ({
      id: `cal-u${i}`, date, description: 'PADARIA QUATRO ANCORAS', amount: -(10 + i), status: 'POSTED', category: 'Uncategorized'
    }));

    const expectedTruePositives = [
      // Human 5/3 candidates (2)
      { id: 'tp-human-1', date: '2026-10-12', description: 'SACOLAO CENTRAL CALIBRACAO', amount: -31.10, status: 'POSTED', category: 'Uncategorized' },
      { id: 'tp-human-2', date: '2026-10-15', description: 'SACOLAO CENTRAL CALIBRACAO', amount: -32.20, status: 'POSTED', category: 'Uncategorized' },
      // Non-Premium direct narrow MCC (2)
      { id: 'tp-np-1', date: '2026-10-16', description: 'COMPRA DROGARIA SAUDE TOTAL', amount: -48.00, status: 'POSTED', category: null, type: 'DEBIT', operationType: 'CARD_PURCHASE', merchant: { name: 'DROGARIA SAUDE TOTAL', cnpj: VALID_CNPJS[2] }, creditCardMetadata: { payeeMCC: '5912' } },
      { id: 'tp-np-2', date: '2026-10-17', description: 'COMPRA AUTO POSTO AVENIDA', amount: -150.00, status: 'POSTED', category: null, type: 'DEBIT', operationType: 'CARD_PURCHASE', merchant: { name: 'AUTO POSTO AVENIDA', cnpj: VALID_CNPJS[1] }, creditCardMetadata: { payeeMCC: '5541' } },
      // Reconciled MCC + Pluggy providerCategory (1)
      { id: 'tp-rec-1', date: '2026-10-18', description: 'SUPERMERCADO RECONCILIADO SUL', amount: -95.00, status: 'POSTED', category: 'Groceries', creditCardMetadata: { payeeMCC: '5411' } }
    ];

    const falsePositiveTraps = [
      { id: 'trap-under-4', date: '2026-10-19', description: 'PADARIA QUATRO ANCORAS', amount: -19.00, status: 'POSTED', category: 'Uncategorized' },
      { id: 'trap-pix-unverified', date: '2026-10-20', description: 'PIX LOJA DESCONHECIDA', amount: -60.00, status: 'POSTED', category: null, type: 'DEBIT', operationType: 'PIX', paymentData: { paymentMethod: 'PIX' }, creditCardMetadata: { payeeMCC: '5411' } },
      { id: 'trap-proc-mp', date: '2026-10-21', description: 'COMPRA MERCADO PAGO', amount: -70.00, status: 'POSTED', category: null, type: 'DEBIT', operationType: 'CARD_PURCHASE', merchant: { name: 'MERCADO PAGO', cnpj: VALID_CNPJS[0] }, creditCardMetadata: { payeeMCC: '5411' } },
      { id: 'trap-proc-pagseguro', date: '2026-10-22', description: 'COMPRA PAGSEGURO', amount: -71.00, status: 'POSTED', category: null, type: 'DEBIT', operationType: 'CARD_PURCHASE', merchant: { name: 'PAGSEGURO', cnpj: VALID_CNPJS[0] }, creditCardMetadata: { payeeMCC: '5411' } },
      { id: 'trap-single-signal', date: '2026-10-23', description: 'MERCADO SEM MCC CONFIADO', amount: -72.00, status: 'POSTED', category: 'Groceries' },
      { id: 'trap-pending', date: '2026-10-24', description: 'SUPERMERCADO PENDENTE', amount: -73.00, status: 'PENDING', category: 'Groceries', creditCardMetadata: { payeeMCC: '5411' } }
    ];

    ingestRows(db, ACCOUNT_A, ITEM_A, [...humanAnchors, ...underAnchors, ...expectedTruePositives, ...falsePositiveTraps]);
    for (const a of humanAnchors) d05.assignBank({ accountId: ACCOUNT_A, externalId: a.id, target: TARGET_SUPER });
    for (const u of underAnchors) d05.assignBank({ accountId: ACCOUNT_A, externalId: u.id, target: TARGET_SUPER });

    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    const proposedIds = new Set(plan.candidates.map((c) => c.externalId));
    const tpIds = expectedTruePositives.map((x) => x.id);
    const trapIds = falsePositiveTraps.map((x) => x.id);

    const truePositives = tpIds.filter((id) => proposedIds.has(id)).length;
    const falsePositives = trapIds.filter((id) => proposedIds.has(id)).length;
    const precision = (truePositives + falsePositives) > 0 ? truePositives / (truePositives + falsePositives) : 0;

    assert.equal(truePositives, expectedTruePositives.length);
    assert.equal(falsePositives, 0);
    assert.equal(precision, 1.0);

    const res = await auto.apply();
    assert.equal(res.applied, expectedTruePositives.length);
    for (const trap of trapIds) {
      assert.equal(db.db.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT_A, trap), undefined);
    }
  });
});
