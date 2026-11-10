'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {runSyntheticDemo,makeFixture}=require('../scripts/mf2-b2-synthetic-demo.cjs');

test('B2 synthetic transport interoperates with the real B1 deterministic engine',async()=>{
  const report=await runSyntheticDemo();
  assert.equal(report.contract,'mf2-reconciliation-b1-v1');
  assert.equal(report.stage,'read_only_dry_run');
  assert.equal(report.sources.windows.bank,1);
  assert.equal(report.sources.cloud.bank,2);
  assert.equal(report.summary.bankCountDelta,1);
  assert.equal(report.summary.byType.only_one_source,1);
  assert.equal(report.flowClassification.windows.bankExpense,1);
  assert.equal(report.flowClassification.cloud.bankExpense,1);
  assert.equal(report.flowClassification.cloud.pendingBankExpense,1);
  assert.equal(report.databaseChanged,false);
  assert.equal(report.financialSyncEnabled,false);
  assert.equal(report.cloudCutoverAllowed,false);
  assert.equal(report.personalDataIncluded,false);
  assert.ok(report.differences.every(d=>/^R\d{6}$/.test(d.reference)));
  assert.doesNotMatch(JSON.stringify(report),/SYNTH-ACCOUNT|SYNTH-TX001|SYNTH-TX002|SYNTHETIC: (breakfast|scheduled)/);
});
test('B2 same fake data produce identical B1 report for repeat runs',async()=>{
  assert.deepEqual(await runSyntheticDemo(),await runSyntheticDemo());
  assert.equal(makeFixture(1).transactions.length,1);
});
