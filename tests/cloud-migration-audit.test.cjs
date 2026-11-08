'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {FinanceDB} = require('../electron/db.cjs');
const {PlanningStore} = require('../electron/planning.cjs');
const {REQUIRED_TABLES, inspectDesktopSchema} = require('../electron/cloud-migration-audit.cjs');

test('desktop schema audit recognizes complete v0.9.4 SQLite structure', () => {
  const finance = new FinanceDB(':memory:');
  try {
    new PlanningStore(finance);
    const report = inspectDesktopSchema(finance);
    assert.equal(report.schemaCompatible, true, JSON.stringify(report));
    assert.equal(report.checkedTables, REQUIRED_TABLES.length);
    assert.equal(report.foreignKeyViolationCount, 0);
    assert.equal(report.integrityOK, true);
    assert.equal(report.financialDataIncluded, false);
    assert.deepEqual(report.missingTables, []);
    assert.deepEqual(report.missingColumns, []);
    assert.equal(Object.hasOwn(report, 'transactions'), false);
    assert.equal(Object.hasOwn(report, 'balances'), false);
  } finally {
    finance.close();
  }
});

test('preflight refuses a partially initialized desktop schema', () => {
  const finance = new FinanceDB(':memory:');
  try {
    const report = inspectDesktopSchema(finance);
    assert.equal(report.schemaCompatible, false);
    assert.ok(report.missingTables.includes('planned_items'));
    assert.ok(report.missingTables.includes('planned_bank_links'));
    assert.equal(report.financialDataIncluded, false);
  } finally {
    finance.close();
  }
});

test('preflight never accepts an object without a SQLite query interface', () => {
  assert.throws(() => inspectDesktopSchema(null), /Banco SQLite inválido/);
  assert.throws(() => inspectDesktopSchema({}), /Banco SQLite inválido/);
});
