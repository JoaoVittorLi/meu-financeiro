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

test('G6-09: sub-acquirer/aggregator abbreviations, processor desc prefixes & PIX QR CODE with CNPJ stay review (unit + E2E)', async () => {
  const unitRejections = [
    { label: 'MP *PADARIA', desc: 'MP *PADARIA', name: 'MP *PADARIA', mcc: '5411' },
    { label: 'MP*SUPERMERCADO', desc: 'MP*SUPERMERCADO', name: 'MP*SUPERMERCADO', mcc: '5411' },
    { label: 'PAG*LOJA', desc: 'PAG*LOJA', name: 'PAG*LOJA', mcc: '5411' },
    { label: 'PAG *LOJA', desc: 'PAG *LOJA', name: 'PAG *LOJA', mcc: '5411' },
    { label: 'PAGSEG*POSTO', desc: 'PAGSEG*POSTO', name: 'PAGSEG*POSTO', mcc: '5541' },
    { label: 'TON *SUPERMERCADO', desc: 'TON *SUPERMERCADO', name: 'TON *SUPERMERCADO', mcc: '5411' },
    { label: 'TON*SUPERMERCADO', desc: 'TON*SUPERMERCADO', name: 'TON*SUPERMERCADO', mcc: '5411' },
    { label: 'PG *LOJA', desc: 'PG *LOJA', name: 'PG *LOJA', mcc: '5411' },
    { label: 'EBANX*LOJA', desc: 'EBANX*LOJA', name: 'EBANX*LOJA', mcc: '5411' },
    { label: 'ADYEN*LOJA', desc: 'ADYEN*LOJA', name: 'ADYEN*LOJA', mcc: '5411' },
    { label: 'ASAAS*CLINICA', desc: 'ASAAS*CLINICA', name: 'ASAAS*CLINICA', mcc: '5912' },
    { label: 'IUGU*CLINICA', desc: 'IUGU*CLINICA', name: 'IUGU*CLINICA', mcc: '5912' },
    { label: 'VINDI*ACADEMIA', desc: 'VINDI*ACADEMIA', name: 'VINDI*ACADEMIA', mcc: '5411' },
    { label: 'ZOOP*MERCADO', desc: 'ZOOP*MERCADO', name: 'ZOOP*MERCADO', mcc: '5411' },
    { label: 'SHIPAY*PADARIA', desc: 'SHIPAY*PADARIA', name: 'SHIPAY*PADARIA', mcc: '5411' },
    { label: 'BCASH*LOJA', desc: 'BCASH*LOJA', name: 'BCASH*LOJA', mcc: '5411' },
    { label: 'MOIP*LOJA', desc: 'MOIP*LOJA', name: 'MOIP*LOJA', mcc: '5411' },
    { label: 'WIRECARD*LOJA', desc: 'WIRECARD*LOJA', name: 'WIRECARD*LOJA', mcc: '5411' },
    { label: 'CLOUDWALK*LOJA', desc: 'CLOUDWALK*LOJA', name: 'CLOUDWALK*LOJA', mcc: '5411' },
    { label: 'REDE exact', desc: 'COMPRA REDE', name: 'REDE', mcc: '5411' },
    { label: 'REDECARD', desc: 'COMPRA REDECARD', name: 'REDECARD', mcc: '5411' },
    { label: 'REDE *LOJA', desc: 'REDE *LOJA', name: 'REDE *LOJA', mcc: '5411' },
    { label: 'REDE PAGAMENTOS', desc: 'REDE PAGAMENTOS', name: 'REDE PAGAMENTOS', mcc: '5411' },
    { label: 'desc MERCADOPAGO with clean merchantName', desc: 'MERCADOPAGO *POSTO IPIRANGA', name: 'POSTO IPIRANGA', mcc: '5541' },
    { label: 'desc PAGSEGURO with clean merchantName', desc: 'PAGSEGURO *SUPERMERCADO SAO JOAO', name: 'SUPERMERCADO SAO JOAO', mcc: '5411' },
    { label: 'desc PIX QR CODE with clean merchantName', desc: 'PIX QR CODE DROGASIL', name: 'DROGASIL', mcc: '5912' },
    { label: 'PIX QR CODE with CNPJ', desc: 'PIX QR CODE', name: 'PIX QR CODE', mcc: '5411' },
    { label: 'paymentMethod PIX with CNPJ and CARD_PURCHASE', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', mcc: '5411', paymentMethod: 'PIX' }
  ];

  for (let i = 0; i < unitRejections.length; i++) {
    const c = unitRejections[i];
    const id = `g609-${i}`;
    const ev = normalizePluggyEvidence({
      id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      paymentData: c.paymentMethod ? { paymentMethod: c.paymentMethod } : undefined,
      description: c.desc,
      category: null,
      merchant: { name: c.name, cnpj: VALID_CNPJS[0] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -4200,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'review', `${c.label} must remain review (got ${verdict.status}:${verdict.reason})`);
  }

  await withSandbox(async ({ db, auto }) => {
    const e2eTraps = [
      { id: 'e2e-mp', desc: 'MP *PADARIA', name: 'MP *PADARIA', mcc: '5411' },
      { id: 'e2e-mp-nospace', desc: 'MP*SUPERMERCADO', name: 'MP*SUPERMERCADO', mcc: '5411' },
      { id: 'e2e-pag', desc: 'PAG*LOJA', name: 'PAG*LOJA', mcc: '5411' },
      { id: 'e2e-pagseg', desc: 'PAGSEG*POSTO', name: 'PAGSEG*POSTO', mcc: '5541' },
      { id: 'e2e-ton', desc: 'TON *SUPERMERCADO', name: 'TON *SUPERMERCADO', mcc: '5411' },
      { id: 'e2e-pg', desc: 'PG *LOJA', name: 'PG *LOJA', mcc: '5411' },
      { id: 'e2e-asaas', desc: 'ASAAS*CLINICA', name: 'ASAAS*CLINICA', mcc: '5912' },
      { id: 'e2e-desc-mp', desc: 'MERCADOPAGO *POSTO IPIRANGA', name: 'POSTO IPIRANGA', mcc: '5541' },
      { id: 'e2e-desc-pagseg', desc: 'PAGSEGURO *SUPERMERCADO SAO JOAO', name: 'SUPERMERCADO SAO JOAO', mcc: '5411' },
      { id: 'e2e-desc-pixqr', desc: 'PIX QR CODE DROGASIL', name: 'DROGASIL', mcc: '5912' },
      { id: 'e2e-pix-method', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', mcc: '5411', paymentMethod: 'PIX' }
    ];
    ingestRows(db, ACCOUNT_A, ITEM_A, e2eTraps.map((c, i) => ({
      id: c.id,
      date: `2026-10-${String(10 + i).padStart(2, '0')}`,
      description: c.desc,
      amount: -(30 + i),
      status: 'POSTED',
      category: null,
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      paymentData: c.paymentMethod ? { paymentMethod: c.paymentMethod } : undefined,
      merchant: { name: c.name, cnpj: VALID_CNPJS[0] },
      creditCardMetadata: { payeeMCC: c.mcc }
    })));
    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 0, `Expected 0 candidates, got: ${plan.candidates.map((x) => x.externalId).join(',')}`);
    assert.equal((await auto.apply()).applied, 0);
  });
});

test('G6-10: legitimate "REDE DE POSTOS IPIRANGA" applies parent-only while REDE processor strings stay review', async () => {
  const legitName = 'REDE DE POSTOS IPIRANGA';
  const legitEv = normalizePluggyEvidence({
    id: 'rede-legit',
    status: 'POSTED',
    type: 'DEBIT',
    operationType: 'CARD_PURCHASE',
    description: `COMPRA CARTAO ${legitName} 10/10`,
    category: null,
    merchant: { name: legitName, cnpj: VALID_CNPJS[1] },
    creditCardMetadata: { payeeMCC: '5541' }
  }, { accountId: ACCOUNT_A });
  const legitVerdict = classifyCandidate({
    transaction: {
      accountId: ACCOUNT_A,
      externalId: 'rede-legit',
      accountType: 'BANK',
      status: 'POSTED',
      amountCents: -15000,
      description: `COMPRA CARTAO ${legitName} 10/10`
    },
    evidence: legitEv
  });
  assert.equal(legitVerdict.status, 'apply');
  assert.equal(legitVerdict.reason, 'VERIFIED_DIRECT_MERCHANT_MCC_PARENT');
  assert.deepEqual(legitVerdict.target, { categoryId: 'cat:transporte', subcategoryId: null });

  await withSandbox(async ({ db, auto }) => {
    ingestRows(db, ACCOUNT_A, ITEM_A, [
      {
        id: 'e2e-rede-legit',
        date: '2026-10-12',
        description: `COMPRA CARTAO ${legitName} 10/10`,
        amount: -150,
        status: 'POSTED',
        category: null,
        type: 'DEBIT',
        operationType: 'CARD_PURCHASE',
        merchant: { name: legitName, cnpj: VALID_CNPJS[1] },
        creditCardMetadata: { payeeMCC: '5541' }
      },
      {
        id: 'e2e-rede-card',
        date: '2026-10-13',
        description: 'COMPRA REDECARD',
        amount: -80,
        status: 'POSTED',
        category: null,
        type: 'DEBIT',
        operationType: 'CARD_PURCHASE',
        merchant: { name: 'REDECARD', cnpj: VALID_CNPJS[1] },
        creditCardMetadata: { payeeMCC: '5541' }
      },
      {
        id: 'e2e-rede-star',
        date: '2026-10-14',
        description: 'REDE *POSTO CENTRAL',
        amount: -90,
        status: 'POSTED',
        category: null,
        type: 'DEBIT',
        operationType: 'CARD_PURCHASE',
        merchant: { name: 'REDE *POSTO CENTRAL', cnpj: VALID_CNPJS[1] },
        creditCardMetadata: { payeeMCC: '5541' }
      },
      {
        id: 'e2e-rede-pag',
        date: '2026-10-15',
        description: 'REDE PAGAMENTOS',
        amount: -95,
        status: 'POSTED',
        category: null,
        type: 'DEBIT',
        operationType: 'CARD_PURCHASE',
        merchant: { name: 'REDE PAGAMENTOS', cnpj: VALID_CNPJS[1] },
        creditCardMetadata: { payeeMCC: '5541' }
      }
    ]);
    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 1);
    assert.equal(plan.candidates[0].externalId, 'e2e-rede-legit');
    assert.deepEqual(plan.candidates[0].target, { categoryId: 'cat:transporte', subcategoryId: null });
    assert.equal(plan.reviewCount, 3);
    assert.equal((await auto.apply()).applied, 1);
  });
});

test('G6-11: duplicate-pair human overrides block conflicting Pluggy external evidence from auto-applying', async () => {
  await withSandbox(async ({ db, d05, auto }) => {
    const overrides = [
      { id: 'dup-a1', date: '2026-10-01', amount: -50 },
      { id: 'dup-a2', date: '2026-10-01', amount: -50 },
      { id: 'dup-b1', date: '2026-10-02', amount: -60 },
      { id: 'dup-b2', date: '2026-10-02', amount: -60 }
    ].map((x) => ({
      ...x,
      description: 'POSTO CONFLITANTE SUL',
      status: 'POSTED',
      category: 'Uncategorized'
    }));
    const candidate = {
      id: 'cand-conflict',
      date: '2026-10-15',
      description: 'POSTO CONFLITANTE SUL',
      amount: -75,
      status: 'POSTED',
      category: 'Groceries',
      creditCardMetadata: { payeeMCC: '5411' }
    };
    ingestRows(db, ACCOUNT_A, ITEM_A, [...overrides, candidate]);
    for (const o of overrides) {
      d05.assignBank({ accountId: ACCOUNT_A, externalId: o.id, target: TARGET_FUEL });
    }

    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, 0);
    assert.equal(plan.reviewCount, 1);
    assert.equal(plan.review[0].reason, 'Evidência insuficiente');
    assert.equal((await auto.apply()).applied, 0);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n, 0);
  });
});

test('G6-12: bank-prefixed processor separators, truncated Mercado Pago, aggregators & merchantBusinessName stay review while non-colliding merchants apply (unit + E2E)', async () => {
  const bypassCases = [
    // 1. Bank-prefixed non-* abbreviated processor separators
    { id: 'byp-mp-space-hyphen', desc: 'COMPRA MP - PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp-mp-hyphen', desc: 'COMPRA CARTAO MP-PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp-mp-endash', desc: 'COMPRA MP \u2013 PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp-pag-slash', desc: 'COMPRA PAG/SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp-pag-hyphen', desc: 'DEB PAG - SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp-pagseg-hyphen', desc: 'COMPRA PAGSEG-AUTO POSTO SUL', name: 'AUTO POSTO SUL', mcc: '5541' },
    { id: 'byp-ton-hyphen', desc: 'COMPRA TON - AUTO POSTO SUL', name: 'AUTO POSTO SUL', mcc: '5541' },
    { id: 'byp-pg-hyphen', desc: 'COMPRA PG - DROGARIA CENTRAL', name: 'DROGARIA CENTRAL', mcc: '5912' },
    // 2. Truncated Mercado Pago descriptors
    { id: 'byp-mercpago', desc: 'MERCPAGO *POSTO IPIRANGA', name: 'POSTO IPIRANGA', mcc: '5541' },
    { id: 'byp-merc-pago-same', desc: 'MERC PAGO *PADARIA CENTRAL', name: 'MERC PAGO *PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp-merc-pago-clean', desc: 'MERC PAGO *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // 3. Delivery/marketplace aggregators
    { id: 'byp-ifood-super', desc: 'IFOOD *SUPERMERCADO EXTRA', name: 'IFOOD *SUPERMERCADO EXTRA', mcc: '5411' },
    { id: 'byp-ifood-pharm', desc: 'IFOOD *FARMACIA SAO PAULO', name: 'FARMACIA SAO PAULO', mcc: '5912' },
    { id: 'byp-rappi', desc: 'RAPPI *SUPERMERCADO DIA', name: 'RAPPI *SUPERMERCADO DIA', mcc: '5411' },
    { id: 'byp-uber-star', desc: 'UBER *CORNERSHOP MERCADO', name: 'UBER *CORNERSHOP MERCADO', mcc: '5411' },
    { id: 'byp-uber-eats', desc: 'UBER EATS *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp-ubereats', desc: 'UBEREATS PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // 4. evidence.merchantBusinessName intermediary
    {
      id: 'byp-bizname-mp',
      desc: 'PADARIA CENTRAL LTDA',
      name: 'PADARIA CENTRAL',
      businessName: 'MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA',
      mcc: '5411'
    },
    {
      id: 'byp-bizname-ifood',
      desc: 'DROGARIA CENTRAL LTDA',
      name: 'DROGARIA CENTRAL',
      businessName: 'IFOOD.COM AGENCIA DE RESTAURANTES ONLINE S.A.',
      mcc: '5912'
    }
  ];

  const legitimateCases = [
    { id: 'legit-pagamento', desc: 'COMPRA CARTAO PAGAMENTO FACIL DROGARIA', name: 'PAGAMENTO FACIL DROGARIA', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'legit-tonelada', desc: 'COMPRA CARTAO TONELADA SUPERMERCADO', name: 'TONELADA SUPERMERCADO', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'legit-uberlandia', desc: 'COMPRA CARTAO UBERLANDIA AUTO POSTO', name: 'UBERLANDIA AUTO POSTO', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'legit-rede-postos', desc: 'COMPRA CARTAO REDE DE POSTOS IPIRANGA 10/10', name: 'REDE DE POSTOS IPIRANGA', mcc: '5541', expectedCat: 'cat:transporte' }
  ];

  // Unit classifier checks
  for (const c of bypassCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      category: null,
      merchant: {
        name: c.name,
        ...(c.businessName ? { businessName: c.businessName } : {}),
        cnpj: VALID_CNPJS[0]
      },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -4500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'review', `${c.id} (${c.desc}) must remain review, got ${verdict.status}:${verdict.reason}`);
  }

  for (const c of legitimateCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      category: null,
      merchant: { name: c.name, cnpj: VALID_CNPJS[1] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -7500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'apply', `${c.id} (${c.desc}) must apply, got ${verdict.status}:${verdict.reason}`);
    assert.equal(verdict.reason, 'VERIFIED_DIRECT_MERCHANT_MCC_PARENT');
    assert.deepEqual(verdict.target, { categoryId: c.expectedCat, subcategoryId: null });
  }

  // E2E D05AutoCategorization checks
  await withSandbox(async ({ db, auto }) => {
    const allCases = [...bypassCases, ...legitimateCases];
    ingestRows(db, ACCOUNT_A, ITEM_A, allCases.map((c, i) => ({
      id: c.id,
      date: `2026-10-${String(1 + i).padStart(2, '0')}`,
      description: c.desc,
      amount: -(35 + i),
      status: 'POSTED',
      category: null,
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      merchant: {
        name: c.name,
        ...(c.businessName ? { businessName: c.businessName } : {}),
        cnpj: c.expectedCat ? VALID_CNPJS[1] : VALID_CNPJS[0]
      },
      creditCardMetadata: { payeeMCC: c.mcc }
    })));
    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, legitimateCases.length, `Expected only legitimate candidates, got: ${plan.candidates.map((x) => x.externalId).join(',')}`);
    assert.equal(plan.reviewCount, bypassCases.length);
    assert.deepEqual(
      plan.candidates.map((x) => x.externalId).sort(),
      legitimateCases.map((x) => x.id).sort()
    );
    for (const c of legitimateCases) {
      const cand = plan.candidates.find((x) => x.externalId === c.id);
      assert.deepEqual(cand.target, { categoryId: c.expectedCat, subcategoryId: null });
    }
    const res = await auto.apply();
    assert.equal(res.applied, legitimateCases.length);
    for (const b of bypassCases) {
      assert.equal(db.db.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT_A, b.id), undefined);
    }
  });
});

test('G6-13: 1-2 char tokens after compact separators, UBER dash/slash, Unicode dashes, and space-only bank-prefixed processor tokens stay review while legitimate merchants apply (unit + E2E)', async () => {
  const bypassCases = [
    { id: 'byp2-mp-la', desc: 'COMPRA MP-LA PADARIA CENTRAL', name: 'LA PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp2-mp-o', desc: 'COMPRA MP-O REI DO PAO', name: 'O REI DO PAO', mcc: '5411' },
    { id: 'byp2-mp-24', desc: 'COMPRA MP-24 HORAS FARMACIA', name: '24 HORAS FARMACIA', mcc: '5912' },
    { id: 'byp2-pag-o', desc: 'DEB PAG-O BOM SUPERMERCADO', name: 'O BOM SUPERMERCADO', mcc: '5411' },
    { id: 'byp2-ton-z1', desc: 'COMPRA TON-Z1 AUTO POSTO', name: 'Z1 AUTO POSTO', mcc: '5541' },
    { id: 'byp2-pg-a', desc: 'COMPRA PG-A DROGARIA CENTRAL', name: 'A DROGARIA CENTRAL', mcc: '5912' },
    { id: 'byp2-uber-dash-sp', desc: 'UBER - SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp2-uber-slash-sp', desc: 'UBER / SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp2-uber-dash', desc: 'UBER-SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp2-mp-minus', desc: 'COMPRA MP \u2212 PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp2-mp-nbhyphen', desc: 'COMPRA MP\u2011PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp2-mp-space', desc: 'COMPRA MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' }
  ];

  const legitimateCases = [
    { id: 'legit2-uberlandia', desc: 'COMPRA CARTAO UBERLANDIA AUTO POSTO', name: 'UBERLANDIA AUTO POSTO', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'legit2-tonelada', desc: 'COMPRA CARTAO TONELADA SUPERMERCADO', name: 'TONELADA SUPERMERCADO', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'legit2-pagamento', desc: 'COMPRA CARTAO PAGAMENTO FACIL DROGARIA', name: 'PAGAMENTO FACIL DROGARIA', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'legit2-rede-postos', desc: 'COMPRA CARTAO REDE DE POSTOS IPIRANGA 10/10', name: 'REDE DE POSTOS IPIRANGA', mcc: '5541', expectedCat: 'cat:transporte' }
  ];

  for (const c of bypassCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      category: null,
      merchant: { name: c.name, cnpj: VALID_CNPJS[0] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -4500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'review', `${c.id} (${c.desc}) must remain review, got ${verdict.status}:${verdict.reason}`);
  }

  for (const c of legitimateCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      category: null,
      merchant: { name: c.name, cnpj: VALID_CNPJS[1] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -7500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'apply', `${c.id} (${c.desc}) must apply, got ${verdict.status}:${verdict.reason}`);
    assert.equal(verdict.reason, 'VERIFIED_DIRECT_MERCHANT_MCC_PARENT');
    assert.deepEqual(verdict.target, { categoryId: c.expectedCat, subcategoryId: null });
  }

  await withSandbox(async ({ db, auto }) => {
    const allCases = [...bypassCases, ...legitimateCases];
    ingestRows(db, ACCOUNT_A, ITEM_A, allCases.map((c, i) => ({
      id: c.id,
      date: `2026-10-${String(1 + i).padStart(2, '0')}`,
      description: c.desc,
      amount: -(40 + i),
      status: 'POSTED',
      category: null,
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      merchant: { name: c.name, cnpj: c.expectedCat ? VALID_CNPJS[1] : VALID_CNPJS[0] },
      creditCardMetadata: { payeeMCC: c.mcc }
    })));
    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, legitimateCases.length, `Expected only legitimate candidates, got: ${plan.candidates.map((x) => x.externalId).join(',')}`);
    assert.equal(plan.reviewCount, bypassCases.length);
    assert.deepEqual(
      plan.candidates.map((x) => x.externalId).sort(),
      legitimateCases.map((x) => x.id).sort()
    );
    const res = await auto.apply();
    assert.equal(res.applied, legitimateCases.length);
    for (const b of bypassCases) {
      assert.equal(db.db.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT_A, b.id), undefined);
    }
  });
});

test('G6-14: structural tokenizer blocks bank/card-prefixed, underscore, zero-width, aggregator, preposition & receiverName intermediaries while preserving legitimate merchants (unit + E2E)', async () => {
  const bypassCases = [
    { id: 'byp3-uber-bare', desc: 'UBER SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp3-visa-mp', desc: 'COMPRA VISA MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp3-elo-mp', desc: 'COMPRA ELO MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp3-pagto-mp', desc: 'PAGAMENTO MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp3-mp-underscore', desc: 'COMPRA MP_PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp3-uber-underscore', desc: 'UBER_PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp3-meli-star', desc: 'MELI *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp3-99food-star', desc: '99FOOD *SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp3-99-food-star', desc: '99 FOOD *SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp3-rede-star-de', desc: 'REDE *DE POSTOS', name: 'REDE *DE POSTOS', mcc: '5541' },
    { id: 'byp3-compra-rede', desc: 'COMPRA REDE', name: 'COMPRA REDE', mcc: '5411' },
    { id: 'byp3-mp-zwsp', desc: 'MP\u200B*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp3-via-mp', desc: 'COMPRA VIA MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp3-receiver-mp', desc: 'COMPRA CARTAO PADARIA CENTRAL', name: 'PADARIA CENTRAL', receiverName: 'MERCADO PAGO IP', mcc: '5411' }
  ];

  const legitimateCases = [
    { id: 'legit3-uberlandia', desc: 'COMPRA CARTAO UBERLANDIA AUTO POSTO', name: 'UBERLANDIA AUTO POSTO', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'legit3-tonelada', desc: 'COMPRA CARTAO TONELADA SUPERMERCADO', name: 'TONELADA SUPERMERCADO', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'legit3-pagamento', desc: 'COMPRA CARTAO PAGAMENTO FACIL DROGARIA', name: 'PAGAMENTO FACIL DROGARIA', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'legit3-rede-postos', desc: 'COMPRA CARTAO REDE DE POSTOS IPIRANGA 10/10', name: 'REDE DE POSTOS IPIRANGA', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'legit3-pag-menos', desc: 'COMPRA CARTAO DROGARIA PAG MENOS', name: 'DROGARIA PAG MENOS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'legit3-alfa-sul', desc: 'COMPRA CARTAO SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', mcc: '5411', expectedCat: 'cat:alimentacao' }
  ];

  for (const c of bypassCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      category: null,
      ...(c.receiverName ? {
        paymentData: { receiver: { name: c.receiverName, documentNumber: { type: 'CNPJ', value: VALID_CNPJS[0] } } }
      } : {}),
      merchant: { name: c.name, cnpj: VALID_CNPJS[0] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -4500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'review', `${c.id} (${c.desc}) must remain review, got ${verdict.status}:${verdict.reason}`);
  }

  for (const c of legitimateCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      category: null,
      merchant: { name: c.name, cnpj: VALID_CNPJS[1] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -7500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'apply', `${c.id} (${c.desc}) must apply, got ${verdict.status}:${verdict.reason}`);
    assert.equal(verdict.reason, 'VERIFIED_DIRECT_MERCHANT_MCC_PARENT');
    assert.deepEqual(verdict.target, { categoryId: c.expectedCat, subcategoryId: null });
  }

  await withSandbox(async ({ db, auto }) => {
    const allCases = [...bypassCases, ...legitimateCases];
    ingestRows(db, ACCOUNT_A, ITEM_A, allCases.map((c, i) => ({
      id: c.id,
      date: `2026-10-${String(1 + i).padStart(2, '0')}`,
      description: c.desc,
      amount: -(50 + i),
      status: 'POSTED',
      category: null,
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      ...(c.receiverName ? {
        paymentData: { receiver: { name: c.receiverName, documentNumber: { type: 'CNPJ', value: VALID_CNPJS[0] } } }
      } : {}),
      merchant: { name: c.name, cnpj: c.expectedCat ? VALID_CNPJS[1] : VALID_CNPJS[0] },
      creditCardMetadata: { payeeMCC: c.mcc }
    })));
    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, legitimateCases.length, `Expected only legitimate candidates, got: ${plan.candidates.map((x) => x.externalId).join(',')}`);
    assert.equal(plan.reviewCount, bypassCases.length);
    assert.deepEqual(
      plan.candidates.map((x) => x.externalId).sort(),
      legitimateCases.map((x) => x.id).sort()
    );
    const res = await auto.apply();
    assert.equal(res.applied, legitimateCases.length);
    for (const b of bypassCases) {
      assert.equal(db.db.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT_A, b.id), undefined);
    }
  });
});

test('G6-15: cross-field descriptor residual isolation, Unicode format/NFKD, numbered/split/bracketed gateways, and interior PAG MENOS protection (unit + E2E)', async () => {
  const bypassCases = [
    // 1. All 10 Wave 5 vectors (+ dirty-merchantName mirrors for key patterns)
    { id: 'byp4-online-mp', desc: 'COMPRA ONLINE MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-online-mp-dirty', desc: 'COMPRA ONLINE MP PADARIA CENTRAL', name: 'COMPRA ONLINE MP PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-eletr-mp', desc: 'PAGAMENTO ELETRONICO MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-emconta-mp', desc: 'DEBITO EM CONTA MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-pelo-mp', desc: 'COMPRA PELO MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-noapp-mp', desc: 'COMPRA NO APP MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-paren-mp', desc: 'COMPRA PADARIA CENTRAL (MP)', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-paren-mp-dirty', desc: 'COMPRA PADARIA CENTRAL (MP)', name: 'COMPRA PADARIA CENTRAL (MP)', mcc: '5411' },
    { id: 'byp4-mp1-star', desc: 'MP1*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-mp1-star-dirty', desc: 'MP1*PADARIA CENTRAL', name: 'MP1*PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-99pay-star', desc: '99PAY *SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp4-99-pay-star', desc: '99 PAY *SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp4-mp-wj', desc: 'M\u2060P *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-mp-wj-dirty', desc: 'M\u2060P *PADARIA CENTRAL', name: 'M\u2060P *PADARIA CENTRAL', mcc: '5411' },
    // 2. Arbitrary unseen descriptor modifiers before MP
    { id: 'byp4-avista-3x-mp', desc: 'COMPRA A VISTA PARCELADA 3X MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-qualquer-mp-pagmenos', desc: 'COMPRA QUALQUER COISA MP DROGARIA PAG MENOS', name: 'DROGARIA PAG MENOS', mcc: '5912' },
    // 3. Parenthesized / bracketed / trailing abbreviated tags
    { id: 'byp4-paren-pg', desc: 'COMPRA PADARIA CENTRAL (PG)', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-bracket-ton', desc: 'COMPRA PADARIA CENTRAL [TON]', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-paren-pag', desc: 'COMPRA PADARIA CENTRAL (PAG)', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-trail-mp-compra', desc: 'COMPRA PADARIA CENTRAL MP', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-trail-mp-bare', desc: 'PADARIA CENTRAL MP', name: 'PADARIA CENTRAL', mcc: '5411' },
    // 4. Numbered gateways
    { id: 'byp4-pag1-star', desc: 'PAG1*SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp4-ton1-star', desc: 'TON1*AUTO POSTO SUL', name: 'AUTO POSTO SUL', mcc: '5541' },
    { id: 'byp4-pg1-star', desc: 'PG1*DROGARIA CENTRAL', name: 'DROGARIA CENTRAL', mcc: '5912' },
    { id: 'byp4-99pay1-star', desc: '99PAY1*SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA', mcc: '5411' },
    { id: 'byp4-rede1-star', desc: 'REDE1*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // 5. Unicode format/compatibility & split initials
    { id: 'byp4-mp-shy', desc: 'M\u00ADP *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-mp-cgj', desc: 'M\u034FP *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-mp-fullwidth', desc: '\uFF2D\uFF30 *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-mp-sup1', desc: 'MP\u00B9*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-mp-dot', desc: 'M.P *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // 6. Glued prefix & dirty descriptionRaw
    { id: 'byp4-glued-mp', desc: 'MPPADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'byp4-dirty-raw', desc: 'COMPRA CARTAO PADARIA CENTRAL', descriptionRaw: 'COMPRA ONLINE MP PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' }
  ];

  const legitimateCases = [
    { id: 'legit4-pag-menos', desc: 'COMPRA CARTAO DROGARIA PAG MENOS', name: 'DROGARIA PAG MENOS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'legit4-pag-menos-online', desc: 'COMPRA ONLINE CARTAO DROGARIA PAG MENOS 10/10', name: 'DROGARIA PAG MENOS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'legit4-pag-menos-sa', desc: 'COMPRA CARTAO DROGARIA PAG MENOS', name: 'DROGARIA PAG MENOS', businessName: 'DROGARIA PAG MENOS S.A.', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'legit4-pagamento-facil', desc: 'COMPRA CARTAO PAGAMENTO FACIL DROGARIA', name: 'PAGAMENTO FACIL DROGARIA', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'legit4-tonelada', desc: 'COMPRA CARTAO TONELADA SUPERMERCADO', name: 'TONELADA SUPERMERCADO', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'legit4-uberlandia', desc: 'COMPRA CARTAO UBERLANDIA AUTO POSTO', name: 'UBERLANDIA AUTO POSTO', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'legit4-rede-postos', desc: 'COMPRA CARTAO REDE DE POSTOS IPIRANGA 10/10', name: 'REDE DE POSTOS IPIRANGA', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'legit4-rede-farmacias', desc: 'COMPRA CARTAO REDE DE FARMACIAS SAO PAULO', name: 'REDE DE FARMACIAS SAO PAULO', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'legit4-alfa-sul', desc: 'COMPRA CARTAO SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'legit4-estrada-real', desc: 'COMPRA CARTAO AUTO POSTO ESTRADA REAL 10/10', name: 'AUTO POSTO ESTRADA REAL', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'legit4-mercearia-teste', desc: 'COMPRA MERCEARIA ALFA DE TESTE', name: 'MERCEARIA ALFA DE TESTE', mcc: '5411', expectedCat: 'cat:alimentacao' }
  ];

  for (const c of bypassCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      ...(c.descriptionRaw ? { descriptionRaw: c.descriptionRaw } : {}),
      category: null,
      merchant: { name: c.name, cnpj: VALID_CNPJS[0] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -4500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'review', `${c.id} (${c.desc}) must remain review, got ${verdict.status}:${verdict.reason}`);
  }

  for (const c of legitimateCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      category: null,
      merchant: { name: c.name, ...(c.businessName ? { businessName: c.businessName } : {}), cnpj: VALID_CNPJS[1] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -7500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'apply', `${c.id} (${c.desc}) must apply, got ${verdict.status}:${verdict.reason}`);
    assert.equal(verdict.reason, 'VERIFIED_DIRECT_MERCHANT_MCC_PARENT');
    assert.deepEqual(verdict.target, { categoryId: c.expectedCat, subcategoryId: null });
  }

  await withSandbox(async ({ db, auto }) => {
    const allCases = [...bypassCases, ...legitimateCases];
    ingestRows(db, ACCOUNT_A, ITEM_A, allCases.map((c, i) => ({
      id: c.id,
      date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10),
      description: c.desc,
      ...(c.descriptionRaw ? { descriptionRaw: c.descriptionRaw } : {}),
      amount: -(60 + i),
      status: 'POSTED',
      category: null,
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      merchant: {
        name: c.name,
        ...(c.businessName ? { businessName: c.businessName } : {}),
        cnpj: c.expectedCat ? VALID_CNPJS[1] : VALID_CNPJS[0]
      },
      creditCardMetadata: { payeeMCC: c.mcc }
    })));
    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, legitimateCases.length, `Expected only legitimate candidates, got: ${plan.candidates.map((x) => x.externalId).join(',')}`);
    assert.equal(plan.reviewCount, bypassCases.length);
    assert.deepEqual(
      plan.candidates.map((x) => x.externalId).sort(),
      legitimateCases.map((x) => x.id).sort()
    );
    const res = await auto.apply();
    assert.equal(res.applied, legitimateCases.length);
    for (const b of bypassCases) {
      assert.equal(db.db.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT_A, b.id), undefined);
    }
  });
});

test('G6-16: wave 6 adversarial bypass vectors (ADV-01..ADV-24, ADV-27), Brazilian PSPs, glued/truncated raw, and hyphenated/leading PAG MENOS preservation (unit + E2E)', async () => {
  const bypassCases = [
    // ADV-01..02: Space-separated M P
    { id: 'adv-01-compra-m-p', desc: 'COMPRA M P PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-02-m-p-bare', desc: 'M P PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // ADV-03..09: 4+ digit trailing & leading-digit numbered POS/gateway prefixes
    { id: 'adv-03-mp1000', desc: 'MP1000*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-04-compra-mp1234', desc: 'COMPRA MP1234*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-05-pag1234', desc: 'PAG1234*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-06-ton1234', desc: 'TON1234*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-07-rede1234', desc: 'REDE1234*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-08-stone1234', desc: 'STONE1234*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-09-1mp', desc: '1MP*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // ADV-10..20 (+ additional Brazilian sub-acquirers/PSPs)
    { id: 'adv-10-m-pago', desc: 'M PAGO *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-11-m-dot-pago', desc: 'M.PAGO *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-12-pags', desc: 'PAGS *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-13-paygo', desc: 'PAYGO *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-14-pay-go', desc: 'PAY GO *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-15-safrapay', desc: 'SAFRAPAY *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-16-safra-pay', desc: 'SAFRA PAY *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-17-efipay', desc: 'EFIPAY *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-18-gerencianet', desc: 'GERENCIANET *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-19-c6pay', desc: 'C6PAY *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-20-c6-pay', desc: 'C6 PAY *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-psp-itaupay', desc: 'ITAUPAY *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-psp-itau-pay', desc: 'ITAU PAY *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-psp-bempaggo', desc: 'BEMPAGGO *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-psp-magalupay', desc: 'MAGALUPAY *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // ADV-21..22: Glued prefix in evidence.descriptionRaw with clean transaction.description
    { id: 'adv-21-raw-mppadaria', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'MPPADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-22-raw-pagpadaria', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'PAGPADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // ADV-23..24: Prefix-truncated merchant run in evidence.descriptionRaw
    { id: 'adv-23-raw-parc-3x-mp', desc: 'PADARIA CENTRAL', descriptionRaw: 'PARC 3X MP PADARIA CENT', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-24-raw-loja-01-mp', desc: 'PADARIA CENTRAL', descriptionRaw: 'LOJA 01 MP PADARIA CENT', name: 'PADARIA CENTRAL', mcc: '5411' },
    // ADV-27: Dirty merchantName containing MP in the middle
    { id: 'adv-27-dirty-mid-mp', desc: 'COMPRA PADARIA MP CENTRAL', name: 'PADARIA MP CENTRAL', mcc: '5411' },
    // Guard: MP before DROGARIA PAG MENOS still routes to review
    { id: 'adv-guard-mp-pagmenos', desc: 'COMPRA ONLINE MP DROGARIA PAG MENOS', name: 'DROGARIA PAG MENOS', mcc: '5912' }
  ];

  const legitimateCases = [
    { id: 'leg-pag-menos-hyphen', desc: 'COMPRA DROGARIA PAG-MENOS', name: 'DROGARIA PAG MENOS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'leg-pag-menos-raw-hyphen', desc: 'DROGARIA PAG MENOS', descriptionRaw: 'DROGARIA PAG-MENOS 10/10', name: 'DROGARIA PAG MENOS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'leg-pag-menos-leading', desc: 'PAG MENOS DROGARIA', name: 'PAG MENOS DROGARIA', mcc: '5912', expectedCat: 'cat:saude' }
  ];

  for (const c of bypassCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      ...(c.descriptionRaw ? { descriptionRaw: c.descriptionRaw } : {}),
      category: null,
      merchant: { name: c.name, cnpj: VALID_CNPJS[0] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -4500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'review', `${c.id} (${c.desc} | raw=${c.descriptionRaw || ''}) must remain review, got ${verdict.status}:${verdict.reason}`);
  }

  for (const c of legitimateCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      ...(c.descriptionRaw ? { descriptionRaw: c.descriptionRaw } : {}),
      category: null,
      merchant: { name: c.name, cnpj: VALID_CNPJS[1] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -7500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'apply', `${c.id} (${c.desc} | raw=${c.descriptionRaw || ''}) must apply, got ${verdict.status}:${verdict.reason}`);
    assert.equal(verdict.reason, 'VERIFIED_DIRECT_MERCHANT_MCC_PARENT');
    assert.deepEqual(verdict.target, { categoryId: c.expectedCat, subcategoryId: null });
  }

  await withSandbox(async ({ db, auto }) => {
    const allCases = [...bypassCases, ...legitimateCases];
    ingestRows(db, ACCOUNT_A, ITEM_A, allCases.map((c, i) => ({
      id: c.id,
      date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10),
      description: c.desc,
      ...(c.descriptionRaw ? { descriptionRaw: c.descriptionRaw } : {}),
      amount: -(60 + i),
      status: 'POSTED',
      category: null,
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      merchant: {
        name: c.name,
        cnpj: c.expectedCat ? VALID_CNPJS[1] : VALID_CNPJS[0]
      },
      creditCardMetadata: { payeeMCC: c.mcc }
    })));
    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, legitimateCases.length, `Expected only legitimate candidates, got: ${plan.candidates.map((x) => x.externalId).join(',')}`);
    assert.equal(plan.reviewCount, bypassCases.length);
    assert.deepEqual(
      plan.candidates.map((x) => x.externalId).sort(),
      legitimateCases.map((x) => x.id).sort()
    );
    const res = await auto.apply();
    assert.equal(res.applied, legitimateCases.length);
    for (const b of bypassCases) {
      assert.equal(db.db.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT_A, b.id), undefined);
    }
  });
});


test('G6-17: wave 7 boundary vectors (NEW-01..23) blocked while COMPRA PAG(-)MENOS DROGARIA and Brazilian merchants apply cleanly (unit + E2E)', async () => {
  const bypassCases = [
    // NEW-01..04: Glued prefix when merchantTokens[0].length < 4
    { id: 'new-01-mpbar', desc: 'COMPRA BAR DO JOAO', descriptionRaw: 'MPBAR DO JOAO', name: 'BAR DO JOAO', mcc: '5411' },
    { id: 'new-02-pagbar', desc: 'COMPRA BAR DO JOAO', descriptionRaw: 'PAGBAR DO JOAO', name: 'BAR DO JOAO', mcc: '5411' },
    { id: 'new-03-mptia', desc: 'COMPRA TIA MARIA', descriptionRaw: 'MPTIA MARIA', name: 'TIA MARIA', mcc: '5411' },
    { id: 'new-04-tonsao', desc: 'COMPRA SAO JOSE', descriptionRaw: 'TONSAO JOSE', name: 'SAO JOSE', mcc: '5411' },
    // NEW-05..10: Glued numbered or full PSP prefixes in descriptionRaw
    { id: 'new-05-mp1pad', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'MP1PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'new-06-mp1000pad', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'MP1000PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'new-07-pagspad', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'PAGSPADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'new-08-paygopad', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'PAYGOPADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'new-09-stonepad', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'STONEPADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'new-10-c6paypad', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'C6PAYPADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // NEW-11..15: Truncated descriptionRaw dropping final merchant token + non-verb/non-channel prefix
    { id: 'new-11-ec01', desc: 'PADARIA CENTRAL', descriptionRaw: 'EC 01 MP PADARIA', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'new-12-filial02', desc: 'SUPERMERCADO ALFA SUL', descriptionRaw: 'FILIAL 02 MP SUPERMERCADO ALFA', name: 'SUPERMERCADO ALFA SUL', mcc: '5411' },
    { id: 'new-13-001pag', desc: 'DROGARIA VIDA PLENA', descriptionRaw: '001 PAG DROGARIA VIDA', name: 'DROGARIA VIDA PLENA', mcc: '5912' },
    { id: 'new-14-aut99', desc: 'PADARIA CENTRAL', descriptionRaw: 'AUT 99 TON PADARIA', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'new-15-term5', desc: 'AUTO POSTO ESTRADA REAL', descriptionRaw: 'TERM 5 MP AUTO POSTO', name: 'AUTO POSTO ESTRADA REAL', mcc: '5541' },
    // NEW-16..20: Alphanumeric POS prefixes & PGS*
    { id: 'new-16-mp01a', desc: 'MP01A*PADARIA CENTRAL', descriptionRaw: 'MP01A*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'new-17-1mp2', desc: '1MP2*PADARIA CENTRAL', descriptionRaw: '1MP2*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'new-18-pag1a', desc: 'PAG1A*PADARIA CENTRAL', descriptionRaw: 'PAG1A*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'new-19-pgs-space', desc: 'PGS *PADARIA CENTRAL', descriptionRaw: 'PGS *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'new-20-pgs-star', desc: 'PGS*PADARIA CENTRAL', descriptionRaw: 'PGS*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // NEW-21..22: Dirty merchantName with interior MP and no leading bank verb
    { id: 'new-21-mp-mid-padaria', desc: 'PADARIA MP CENTRAL', descriptionRaw: 'PADARIA MP CENTRAL', name: 'PADARIA MP CENTRAL', mcc: '5411' },
    { id: 'new-22-mp-mid-posto', desc: 'AUTO POSTO MP BRASIL', descriptionRaw: 'AUTO POSTO MP BRASIL', name: 'AUTO POSTO MP BRASIL', mcc: '5541' },
    // NEW-23: REDE DE *
    { id: 'new-23-rede-de-star', desc: 'REDE DE *PADARIA CENTRAL', descriptionRaw: 'REDE DE *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Negative control for COMPRA PAG MENOS: must still block when merchant is PADARIA CENTRAL
    { id: 'new-guard-pag-menos-padaria', desc: 'COMPRA PAG MENOS PADARIA CENTRAL', descriptionRaw: 'COMPRA PAG MENOS PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' }
  ];

  const legitimateCases = [
    { id: 'leg-01-drog-pag-menos', desc: 'DROGARIA PAG MENOS', name: 'DROGARIA PAG MENOS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'leg-02-compra-drog-pag-menos-h', desc: 'COMPRA DROGARIA PAG-MENOS', name: 'DROGARIA PAG MENOS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'leg-03-raw-drog-pag-menos-h', desc: 'DROGARIA PAG MENOS', descriptionRaw: 'DROGARIA PAG-MENOS 10/10', name: 'DROGARIA PAG MENOS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'leg-04-pag-menos-drog', desc: 'PAG MENOS DROGARIA', name: 'PAG MENOS DROGARIA', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'leg-05-tonelada', desc: 'TONELADA SUPERMERCADO', name: 'TONELADA SUPERMERCADO', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'leg-06-uberlandia', desc: 'UBERLANDIA AUTO POSTO', name: 'UBERLANDIA AUTO POSTO', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'leg-07-rede-postos', desc: 'REDE DE POSTOS IPIRANGA', name: 'REDE DE POSTOS IPIRANGA', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'leg-08-rede-farmacias', desc: 'REDE DE FARMACIAS SAO PAULO', name: 'REDE DE FARMACIAS SAO PAULO', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'leg-09-pagamento-facil', desc: 'PAGAMENTO FACIL DROGARIA', name: 'PAGAMENTO FACIL DROGARIA', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'leg-10-super-alfa-sul', desc: 'COMPRA CARTAO SUPERMERCADO ALFA SUL 10/10', name: 'SUPERMERCADO ALFA SUL', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'leg-11-posto-estrada-real', desc: 'COMPRA CARTAO AUTO POSTO ESTRADA REAL 10/10', name: 'AUTO POSTO ESTRADA REAL', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'leg-12-mercearia-alfa', desc: 'COMPRA MERCEARIA ALFA DE TESTE', name: 'MERCEARIA ALFA DE TESTE', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'leg-13-compra-pag-menos', desc: 'COMPRA PAG MENOS DROGARIA', descriptionRaw: 'COMPRA PAG MENOS DROGARIA', name: 'PAG MENOS DROGARIA', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'leg-14-compra-pag-menos-h', desc: 'COMPRA PAG-MENOS DROGARIA', descriptionRaw: 'COMPRA PAG-MENOS DROGARIA', name: 'PAG MENOS DROGARIA', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'leg-15-compra-cartao-drog-pag-menos', desc: 'COMPRA CARTAO DROGARIA PAG-MENOS 10/10', name: 'DROGARIA PAG MENOS', mcc: '5912', expectedCat: 'cat:saude' }
  ];

  for (const c of bypassCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      ...(c.descriptionRaw ? { descriptionRaw: c.descriptionRaw } : {}),
      category: null,
      merchant: { name: c.name, cnpj: VALID_CNPJS[0] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -4500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'review', `${c.id} (${c.desc} | raw=${c.descriptionRaw || ''}) must remain review, got ${verdict.status}:${verdict.reason}`);
  }

  for (const c of legitimateCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      ...(c.descriptionRaw ? { descriptionRaw: c.descriptionRaw } : {}),
      category: null,
      merchant: { name: c.name, cnpj: VALID_CNPJS[1] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -7500,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'apply', `${c.id} (${c.desc} | raw=${c.descriptionRaw || ''}) must apply, got ${verdict.status}:${verdict.reason}`);
    assert.equal(verdict.reason, 'VERIFIED_DIRECT_MERCHANT_MCC_PARENT');
    assert.deepEqual(verdict.target, { categoryId: c.expectedCat, subcategoryId: null });
  }

  await withSandbox(async ({ db, auto }) => {
    const allCases = [...bypassCases, ...legitimateCases];
    ingestRows(db, ACCOUNT_A, ITEM_A, allCases.map((c, i) => ({
      id: c.id,
      date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10),
      description: c.desc,
      ...(c.descriptionRaw ? { descriptionRaw: c.descriptionRaw } : {}),
      amount: -(60 + i),
      status: 'POSTED',
      category: null,
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      merchant: {
        name: c.name,
        cnpj: c.expectedCat ? VALID_CNPJS[1] : VALID_CNPJS[0]
      },
      creditCardMetadata: { payeeMCC: c.mcc }
    })));
    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 100 });
    assert.equal(plan.candidateCount, legitimateCases.length, `Expected only legitimate candidates, got: ${plan.candidates.map((x) => x.externalId).join(',')}`);
    assert.equal(plan.reviewCount, bypassCases.length);
    assert.deepEqual(
      plan.candidates.map((x) => x.externalId).sort(),
      legitimateCases.map((x) => x.id).sort()
    );
    const res = await auto.apply();
    assert.equal(res.applied, legitimateCases.length);
    for (const b of bypassCases) {
      assert.equal(db.db.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT_A, b.id), undefined);
    }
  });
});

test('G6-18: wave 8 adversarial bypass classes (truncated k=1/2, dirty TON/PAG, alnum POS, Unicode invisibles, PIX methods, BR PSPs) blocked while BR merchants apply (unit + E2E)', async () => {
  const bypassCases = [
    // Class 1: k=1 short first token (<4 chars) + PAG/TON in truncated descriptionRaw
    { id: 'adv-w8-01-ec01-pag-bar', desc: 'COMPRA BAR DO JOAO', descriptionRaw: 'EC 01 PAG BAR', name: 'BAR DO JOAO', mcc: '5411' },
    { id: 'adv-w8-02-filial-ton-bar', desc: 'COMPRA BAR DO JOAO', descriptionRaw: 'FILIAL 02 TON BAR', name: 'BAR DO JOAO', mcc: '5411' },
    { id: 'adv-w8-03-001-pag-sao', desc: 'COMPRA SAO JOSE', descriptionRaw: '001 PAG SAO', name: 'SAO JOSE', mcc: '5411' },
    { id: 'adv-w8-04-aut99-ton-tia', desc: 'COMPRA TIA MARIA', descriptionRaw: 'AUT 99 TON TIA', name: 'TIA MARIA', mcc: '5411' },
    // Class 2: <3 char last-token truncation or trailing UF / installments in descriptionRaw
    { id: 'adv-w8-05-trunc-pl', desc: 'DROGARIA VIDA PLENA', descriptionRaw: 'EC 01 PAG DROGARIA VIDA PL', name: 'DROGARIA VIDA PLENA', mcc: '5912' },
    { id: 'adv-w8-06-trunc-uf-sp', desc: 'SUPERMERCADO ALFA SUL', descriptionRaw: '001 PAG SUPERMERCADO ALFA SP', name: 'SUPERMERCADO ALFA SUL', mcc: '5411' },
    { id: 'adv-w8-07-trunc-es', desc: 'AUTO POSTO ESTRADA REAL', descriptionRaw: 'EC 01 PAG AUTO POSTO ES', name: 'AUTO POSTO ESTRADA REAL', mcc: '5541' },
    { id: 'adv-w8-08-trunc-parc', desc: 'PADARIA CENTRAL', descriptionRaw: 'EC 01 PAG PADARIA 10/10', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'ext-17-trunc-ce', desc: 'PADARIA CENTRAL', descriptionRaw: 'EC 01 PAG PADARIA CE', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Class 3: dirty merchantName containing interior TON/PAG without leading bank verb
    { id: 'adv-w8-09-dirty-ton-pad', desc: 'PADARIA TON CENTRAL', name: 'PADARIA TON CENTRAL', mcc: '5411' },
    { id: 'adv-w8-10-dirty-ton-posto', desc: 'AUTO POSTO TON BRASIL', name: 'AUTO POSTO TON BRASIL', mcc: '5541' },
    { id: 'adv-w8-11-dirty-pag-pad', desc: 'PADARIA PAG CENTRAL', name: 'PADARIA PAG CENTRAL', mcc: '5411' },
    { id: 'adv-w8-12-dirty-pag-super', desc: 'SUPERMERCADO PAG SUL', name: 'SUPERMERCADO PAG SUL', mcc: '5411' },
    { id: 'adv-w8-22-mercado-pag-bigram', desc: 'MERCADO PAG PADARIA CENTRAL', name: 'MERCADO PAG PADARIA CENTRAL', mcc: '5411' },
    // Class 4: Alphanumeric POS prefixes & PAGBANKS*
    { id: 'adv-w8-39-a1mp', desc: 'A1MP*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'ext-02-ec1mp', desc: 'EC1MP*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'ext-01-mp01abcde', desc: 'MP01ABCDE*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'aud-pagbanks', desc: 'PAGBANKS*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Class 5: Non-exact paymentMethod containing word PIX
    { id: 'adv-w8-33-pm-pixqr', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', mcc: '5411', paymentMethod: 'PIX QR CODE' },
    { id: 'adv-w8-34-pm-pixtransfer', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', mcc: '5411', paymentMethod: 'PIX_TRANSFER' },
    // Class 6: Unicode variation selectors, Braille blank, combining marks
    { id: 'adv-w8-13-vs1-pix', desc: 'PI\uFE00X PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-14-vs1-pag', desc: 'P\uFE00AG *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-15-braille-pix', desc: 'PI\u2800X PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-16-braille-stone', desc: 'ST\u2800ONE *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-18-mvs-pag', desc: 'P\u180BAG *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-19-comb-pag', desc: 'P\u20D0AG *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Class 7: Truncated MERCPAG + Brazilian PSPs / contextual acquirers
    { id: 'adv-w8-20-mercpag-star', desc: 'MERCPAG *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-21-mercpag-glued', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'MERCPAGPADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-24-sipag', desc: 'SIPAG *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-25-stelo', desc: 'STELO *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-26-vero', desc: 'VERO *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-27-bin', desc: 'BIN *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-28-cora', desc: 'CORA *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-29-pp', desc: 'PP *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-30-ml', desc: 'ML *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-31-qr', desc: 'QR *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'adv-w8-32-vero-num', desc: 'VERO01*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Wave 9 Finding 1: glued prefixes with short/truncated/omitted merchant tokens & MERCADOPAG
    { id: 'w9-01-mpla', desc: 'COMPRA LA PADARIA CENTRAL', descriptionRaw: 'MPLA PADARIA CENTRAL', name: 'LA PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-02-pagla', desc: 'COMPRA LA PADARIA CENTRAL', descriptionRaw: 'PAGLA PADARIA CENTRAL', name: 'LA PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-03-mpo', desc: 'COMPRA O REI DO PAO', descriptionRaw: 'MPO REI DO PAO', name: 'O REI DO PAO', mcc: '5411' },
    { id: 'w9-04-mpbar-joao', desc: 'COMPRA BAR DO JOAO', descriptionRaw: 'EC 01 MPBAR JOAO', name: 'BAR DO JOAO', mcc: '5411' },
    { id: 'w9-05-pagbar-only', desc: 'COMPRA BAR DO JOAO', descriptionRaw: 'PAGBAR', name: 'BAR DO JOAO', mcc: '5411' },
    { id: 'w9-06-mppad-cent', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'EC 01 MPPAD CENT', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-07-mpipiranga', desc: 'COMPRA AUTO POSTO IPIRANGA', descriptionRaw: 'MPIPIRANGA', name: 'AUTO POSTO IPIRANGA', mcc: '5541' },
    { id: 'w9-08-mercadopag-glued', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'MERCADOPAGPADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Wave 9 Finding 2: contextual processors in dirty merchantName or truncated descriptionRaw
    { id: 'w9-09-dirty-ec-vero', desc: 'EC 01 VERO PADARIA CENTRAL', name: 'EC 01 VERO PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-10-dirty-mid-vero', desc: 'PADARIA VERO CENTRAL', name: 'PADARIA VERO CENTRAL', mcc: '5411' },
    { id: 'w9-11-dirty-mid-pp', desc: 'PADARIA PP CENTRAL', name: 'PADARIA PP CENTRAL', mcc: '5411' },
    { id: 'w9-12-dirty-mid-ml', desc: 'SUPERMERCADO ML SUL', name: 'SUPERMERCADO ML SUL', mcc: '5411' },
    { id: 'w9-13-dirty-mid-bin', desc: 'AUTO POSTO BIN BRASIL', name: 'AUTO POSTO BIN BRASIL', mcc: '5541' },
    { id: 'w9-14-raw-vero-sp', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'EC 01 VERO CENTRAL SP', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-15-raw-vero-pad-parc', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'EC 01 VERO PAD 10/10', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-16-raw-vero-la-sp', desc: 'COMPRA LA PADARIA CENTRAL', descriptionRaw: 'EC 01 VERO LA SP', name: 'LA PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-17-raw-cora-o-sp', desc: 'COMPRA O REI DO PAO', descriptionRaw: 'FILIAL 02 CORA O SP', name: 'O REI DO PAO', mcc: '5411' },
    { id: 'w9-18-raw-bin-city-sp', desc: 'AUTO POSTO ESTRADA REAL', descriptionRaw: '001 BIN ESTRADA CAMPINAS SP', name: 'AUTO POSTO ESTRADA REAL', mcc: '5541' },
    { id: 'w9-19-raw-ml-a', desc: 'COMPRA A DROGARIA CENTRAL', descriptionRaw: 'EC 01 ML A', name: 'A DROGARIA CENTRAL', mcc: '5912' },
    // Wave 9 Finding 4: extended alphanumeric & digit-bearing POS prefixes & 10ML*
    { id: 'w9-20-caixa01mp', desc: 'CAIXA01MP*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-21-filial1mp', desc: 'FILIAL1MP*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-22-a1b2mp', desc: 'A1B2MP*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-23-c6pay1a', desc: 'C6PAY1A*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-24-199pay', desc: '199PAY*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-25-ec99pay', desc: 'EC99PAY*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-26-10ml-star', desc: '10ML*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Wave 9 Finding 5: isPagMenosPhrase & isRedeProcessorAt bypasses
    { id: 'w9-27-pag-menos-alimentos', desc: 'COMPRA ALIMENTOS MENOS PRECO', descriptionRaw: 'EC 01 PAG MENOS PRECO', name: 'ALIMENTOS MENOS PRECO', mcc: '5411' },
    { id: 'w9-28-pag-menos-prec', desc: 'COMPRA DROGARIA MENOS PRECO', descriptionRaw: 'PAG MENOS PREC', name: 'DROGARIA MENOS PRECO', mcc: '5912' },
    { id: 'w9-29-rede-de-padaria', desc: 'REDE DE PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-30-raw-rede-de-pad', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'REDE DE PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Wave 9 Finding 6: glued PIX, BOLETO on PURCHASE & PIX+MP MULTI_SIGNAL_RECONCILED
    { id: 'w9-31-pixqr', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', mcc: '5411', paymentMethod: 'PIXQR' },
    { id: 'w9-32-pixtransfer', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', mcc: '5411', paymentMethod: 'PIXTRANSFER' },
    { id: 'w9-33-boleto', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', mcc: '5411', operationType: 'PURCHASE', paymentMethod: 'BOLETO' },
    { id: 'w9-34-pix-reconciled-mp', desc: 'PIX MERCADO PAGO', name: null, receiver: { name: 'MERCADO PAGO', documentNumber: { type: 'CNPJ', value: VALID_CNPJS[0] } }, category: 'Groceries', mcc: '5411', operationType: 'PIX', paymentMethod: 'PIX' },
    // Wave 9 Finding 7: homoglyphs, \p{Me}, NBSP & ZWSP merge
    { id: 'w9-35-cyr-mp', desc: '\u041C\u0420 *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-36-cyr-pag', desc: '\u0420AG *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-37-me-pag', desc: 'P\u20DDAG *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-38-nbsp-pag', desc: 'P\u00A0AG *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-39-squared-pag', desc: '\u{1F17F}\u{1F170}\u{1F176} PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-40-zwsp-rede', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'REDE\u200BPAGAMENTOS PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Wave 9 Finding 8: additional aggregators/PSPs
    { id: 'w9-41-aiqfome', desc: 'AIQFOME *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-42-stripe', desc: 'STRIPE *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-43-dlocal', desc: 'DLOCAL *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w9-44-payu', desc: 'PAYU *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Wave 10 Block 1: glued short/concatenated stems, suffixes & infixes
    { id: 'w10-01-ec-mpla', desc: 'COMPRA LA PADARIA CENTRAL', descriptionRaw: 'EC 01 MPLA', name: 'LA PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-02-mppa-cent', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'MPPA CENT', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-03-mpdr-sao', desc: 'COMPRA DROGARIA SAO PAULO', descriptionRaw: 'MPDR SAO PAULO', name: 'DROGARIA SAO PAULO', mcc: '5912' },
    { id: 'w10-04-mpjo', desc: 'COMPRA BAR DO JOAO', descriptionRaw: 'MPJO', name: 'BAR DO JOAO', mcc: '5411' },
    { id: 'w10-05-mpdo-joao', desc: 'COMPRA BAR DO JOAO', descriptionRaw: 'MPDO JOAO', name: 'BAR DO JOAO', mcc: '5411' },
    { id: 'w10-06-pagbardojoao', desc: 'COMPRA BAR DO JOAO', descriptionRaw: 'PAGBARDOJOAO', name: 'BAR DO JOAO', mcc: '5411' },
    { id: 'w10-07-mppadariacentral', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'MPPADARIACENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-08-centralmp-suf', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'PADARIA CENTRALMP', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-09-padariamp-suf', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'PADARIAMP CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-10-padariampcentral-infix', desc: 'COMPRA PADARIA CENTRAL', descriptionRaw: 'PADARIAMPCENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Wave 10 Block 2: non-card operations, non-boundary paymentMethod & PIX providerCategory
    { id: 'w10-11-op-boleto-rec', desc: 'BOLETO SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', category: 'Groceries', mcc: '5411', operationType: 'BOLETO' },
    { id: 'w10-12-op-ted-rec', desc: 'TED ENVIADO SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', category: 'Groceries', mcc: '5411', operationType: 'TED' },
    { id: 'w10-13-op-doc-rec', desc: 'DOC ENVIADO SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', category: 'Groceries', mcc: '5411', operationType: 'DOC' },
    { id: 'w10-14-op-transf-rec', desc: 'TRANSF SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', category: 'Groceries', mcc: '5411', operationType: 'TRANSFERENCIA' },
    { id: 'w10-15-op-saque-rec', desc: 'SAQUE SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', category: 'Groceries', mcc: '5411', operationType: 'SAQUE' },
    { id: 'w10-16-pm-boleto1', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', category: 'Groceries', mcc: '5411', operationType: 'PURCHASE', paymentMethod: 'BOLETO1' },
    { id: 'w10-17-pm-boletobancario', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', category: 'Groceries', mcc: '5411', operationType: 'PURCHASE', paymentMethod: 'BOLETOBANCARIO' },
    { id: 'w10-18-pm-ted01', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', category: 'Groceries', mcc: '5411', operationType: 'PURCHASE', paymentMethod: 'TED01' },
    { id: 'w10-19-cat-transfer-pix', desc: 'PADARIA CENTRAL', name: 'PADARIA CENTRAL', category: 'Transfer - PIX', mcc: '5411', operationType: 'CARD_PURCHASE' },
    // Wave 10 Block 3: extended POS prefixes, alpha-suffixed PSPs & unpunctuated 10ML
    { id: 'w10-20-01caixa02mp', desc: '01CAIXA02MP*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-21-supercaixa01mp', desc: 'SUPERCAIXA01MP*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-22-01caixa99pay', desc: '01CAIXA99PAY*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-23-supercaixa99pay', desc: 'SUPERCAIXA99PAY*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-24-mpbr', desc: 'MPBR*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-25-mpx', desc: 'MPX*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-26-tonbr', desc: 'TONBR*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-27-pagbr', desc: 'PAGBR*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-28-verobr', desc: 'VEROBR*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-29-c6paybr', desc: 'C6PAYBR*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-30-ec01mpbr', desc: 'EC01MPBR*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-31-mpbr-reconciled', desc: 'COMPRA SUPERMERCADO ALFA SUL', descriptionRaw: 'MPBR*SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', category: 'Groceries', mcc: '5411' },
    { id: 'w10-32-compra-10ml', desc: 'COMPRA 10ML PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-33-ec01-10ml', desc: 'EC 01 10ML PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    // Wave 10 Block 4: precomposed NFKD homoglyphs, lookalikes & 2/3-token splits
    { id: 'w10-34-ton-greek-omicron-tonos', desc: 'T\u038CN *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-35-bin-greek-iota-tonos', desc: 'B\u038AN *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-36-cora-greek-tonos', desc: 'C\u038CRA *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-37-vero-greek-tonos', desc: 'V\u0388RO *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-38-pix-greek-tonos', desc: 'P\u038AX *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-39-stone-greek-tonos', desc: 'ST\u038CNE *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-40-aiqfome-greek-tonos', desc: '\u0386IQFOME *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-41-pix-cyr-yi', desc: 'P\u0407X *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-42-dotless-bin', desc: 'B\u0131N *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-43-greek-nu-vero', desc: '\u03BDERO *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-44-smallcaps-mp', desc: '\u1D0D\u1D18 *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-45-ipa-g-pag', desc: 'PA\u0261 *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-46-palochka-pix', desc: 'P\u04C0X *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-47-regional-mp', desc: '\u{1F1F2}\u{1F1F5} PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-48-pm-dotless-pix', desc: 'COMPRA SUPERMERCADO ALFA SUL', name: 'SUPERMERCADO ALFA SUL', category: 'Groceries', mcc: '5411', paymentMethod: 'P\u0131X' },
    { id: 'w10-49-nbsp-pa-g', desc: 'PA\u00A0G *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-50-nbsp-st-one', desc: 'ST\u00A0ONE *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-51-nbsp-ver-o', desc: 'VER\u00A0O *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-52-nbsp-p-p', desc: 'P\u00A0P *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-53-nbsp-m-l', desc: 'M\u00A0L *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-54-nbsp-q-r', desc: 'Q\u00A0R *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-55-nbsp-b-in', desc: 'B\u00A0IN *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-56-nbsp-c-ora', desc: 'C\u00A0ORA *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-57-dot-pag', desc: 'P.A.G*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-58-dot-ton', desc: 'T.O.N*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-59-dot-pix', desc: 'P.I.X*PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-60-space-pag', desc: 'P A G *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-61-space-ton', desc: 'T O N *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' },
    { id: 'w10-62-space-pix', desc: 'P I X *PADARIA CENTRAL', name: 'PADARIA CENTRAL', mcc: '5411' }
  ];

  const legitimateCases = [
    { id: 'w8-leg-01-pao-acucar', desc: 'SUPERMERCADO PAO DE ACUCAR', name: 'SUPERMERCADO PAO DE ACUCAR', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'w8-leg-02-farm-sp', desc: 'FARMÁCIA SÃO PAULO', name: 'FARMÁCIA SÃO PAULO', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'w8-leg-03-drog-pague-menos', desc: 'DROGARIA PAGUE MENOS', name: 'DROGARIA PAGUE MENOS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'w8-leg-04-drog-pag-menos', desc: 'DROGARIA PAG MENOS', name: 'DROGARIA PAG MENOS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'w8-leg-05-compra-pag-menos', desc: 'COMPRA PAG-MENOS DROGARIA', name: 'PAG MENOS DROGARIA', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'w8-leg-06-ext08-express', desc: 'COMPRA PAG MENOS EXPRESS', name: 'PAG MENOS EXPRESS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'w8-leg-07-tonin', desc: 'SUPERMERCADO TONIN', name: 'SUPERMERCADO TONIN', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'w8-leg-08-toninho', desc: 'TONINHO AUTO POSTO', name: 'TONINHO AUTO POSTO', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'w8-leg-09-pague-pouco', desc: 'SUPERMERCADO PAGUE POUCO', name: 'SUPERMERCADO PAGUE POUCO', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'w8-leg-10-rede-extra', desc: 'REDE DE SUPERMERCADOS EXTRA', name: 'REDE DE SUPERMERCADOS EXTRA', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'w8-leg-11-auto-posto-tom', desc: 'AUTO POSTO TOM', name: 'AUTO POSTO TOM', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'w8-leg-12-droga-raia', desc: 'DROGA RAIA FILIAL 12', name: 'DROGA RAIA FILIAL 12', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'w8-leg-13-panvel', desc: 'PANVEL FARMACIAS', name: 'PANVEL FARMACIAS', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'w8-leg-14-uberaba', desc: 'UBERABA AUTO POSTO', name: 'UBERABA AUTO POSTO', mcc: '5541', expectedCat: 'cat:transporte' },
    { id: 'w8-leg-15-pixote', desc: 'SUPERMERCADO PIXOTE', name: 'SUPERMERCADO PIXOTE', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'w8-leg-16-pagou-levou', desc: 'MERCADINHO PAGOU LEVOU', name: 'MERCADINHO PAGOU LEVOU', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'w8-leg-17-pagbem', desc: 'DROGARIA PAGBEM', name: 'DROGARIA PAGBEM', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'w8-leg-18-500ml', desc: 'DROGARIA SAUDE 500ML', name: 'DROGARIA SAUDE 500ML', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'w8-leg-19-dona-cora', desc: 'PADARIA DONA CORA', name: 'PADARIA DONA CORA', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'w9-leg-20-compra-dona-cora', desc: 'COMPRA PADARIA DONA CORA', name: 'PADARIA DONA CORA', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'w9-leg-21-cartao-dona-cora', desc: 'COMPRA CARTAO PADARIA DONA CORA 10/10', name: 'PADARIA DONA CORA', mcc: '5411', expectedCat: 'cat:alimentacao' },
    { id: 'w9-leg-22-cora-coralina', desc: 'COMPRA CARTAO DROGARIA CORA CORALINA', name: 'DROGARIA CORA CORALINA', mcc: '5912', expectedCat: 'cat:saude' },
    { id: 'w9-leg-23-5ml', desc: 'COMPRA CARTAO DROGARIA SAUDE 5ML', name: 'DROGARIA SAUDE 5ML', mcc: '5912', expectedCat: 'cat:saude' }
  ];

  for (const c of bypassCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: c.operationType || 'CARD_PURCHASE',
      paymentData: (c.paymentMethod || c.receiver) ? {
        ...(c.paymentMethod ? { paymentMethod: c.paymentMethod } : {}),
        ...(c.receiver ? { receiver: c.receiver } : {})
      } : undefined,
      description: c.desc,
      ...(c.descriptionRaw ? { descriptionRaw: c.descriptionRaw } : {}),
      category: c.category ?? null,
      ...(c.name ? { merchant: { name: c.name, cnpj: VALID_CNPJS[0] } } : {}),
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -4800,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'review', `${c.id} (${c.desc} | raw=${c.descriptionRaw || ''}) must stay review, got ${verdict.status}:${verdict.reason}`);
  }

  for (const c of legitimateCases) {
    const ev = normalizePluggyEvidence({
      id: c.id,
      status: 'POSTED',
      type: 'DEBIT',
      operationType: 'CARD_PURCHASE',
      description: c.desc,
      ...(c.descriptionRaw ? { descriptionRaw: c.descriptionRaw } : {}),
      category: null,
      merchant: { name: c.name, cnpj: VALID_CNPJS[1] },
      creditCardMetadata: { payeeMCC: c.mcc }
    }, { accountId: ACCOUNT_A });
    const verdict = classifyCandidate({
      transaction: {
        accountId: ACCOUNT_A,
        externalId: c.id,
        accountType: 'BANK',
        status: 'POSTED',
        amountCents: -6200,
        description: c.desc
      },
      evidence: ev
    });
    assert.equal(verdict.status, 'apply', `${c.id} (${c.desc}) must apply, got ${verdict.status}:${verdict.reason}`);
    assert.equal(verdict.reason, 'VERIFIED_DIRECT_MERCHANT_MCC_PARENT');
    assert.deepEqual(verdict.target, { categoryId: c.expectedCat, subcategoryId: null });
  }

  await withSandbox(async ({ db, auto }) => {
    const allCases = [...bypassCases, ...legitimateCases];
    ingestRows(db, ACCOUNT_A, ITEM_A, allCases.map((c, i) => ({
      id: c.id,
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      description: c.desc,
      ...(c.descriptionRaw ? { descriptionRaw: c.descriptionRaw } : {}),
      amount: -(50 + i),
      status: 'POSTED',
      category: c.category ?? null,
      type: 'DEBIT',
      operationType: c.operationType || 'CARD_PURCHASE',
      paymentData: (c.paymentMethod || c.receiver) ? {
        ...(c.paymentMethod ? { paymentMethod: c.paymentMethod } : {}),
        ...(c.receiver ? { receiver: c.receiver } : {})
      } : undefined,
      ...(c.name ? {
        merchant: {
          name: c.name,
          cnpj: c.expectedCat ? VALID_CNPJS[1] : VALID_CNPJS[0]
        }
      } : {}),
      creditCardMetadata: { payeeMCC: c.mcc }
    })));
    auto.configure({ accountIds: [ACCOUNT_A], ...SPAN }, true);
    const plan = auto.plan({ limit: 500 });
    assert.equal(plan.candidateCount, legitimateCases.length, `Expected ${legitimateCases.length} legitimate candidates, got: ${plan.candidates.map((x) => x.externalId).join(',')}`);
    assert.equal(plan.reviewCount, bypassCases.length);
    assert.deepEqual(
      plan.candidates.map((x) => x.externalId).sort(),
      legitimateCases.map((x) => x.id).sort()
    );
    const res = await auto.apply();
    assert.equal(res.applied, legitimateCases.length);
    for (const b of bypassCases) {
      assert.equal(db.db.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT_A, b.id), undefined);
    }
  });
});
