'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {TABLE_KEYS}=require('../electron/cloud-migration-contract.cjs');
const {PERSONAL_TABLES,PLUGGY_TABLES,INTERNAL_TABLES,ALL_TABLES,REQUIREMENTS,migrationRoutingOverview}
  =require('../electron/cloud-data-routing.cjs');

test('all 22 SQLite tables have a unique migration responsibility',()=>{
  assert.equal(new Set(ALL_TABLES).size,22);
  assert.deepEqual(new Set(ALL_TABLES),new Set(Object.keys(TABLE_KEYS)));
  assert.equal(PERSONAL_TABLES.length,17);
  assert.equal(PLUGGY_TABLES.length,4);
  assert.deepEqual(INTERNAL_TABLES,['app_meta']);
  assert.ok(PERSONAL_TABLES.includes('planned_bank_links'));
  assert.ok(PERSONAL_TABLES.includes('bank_transaction_splits'));
  assert.ok(PERSONAL_TABLES.includes('bank_manual_links'));
  assert.ok(PERSONAL_TABLES.includes('bank_transaction_notes'));
  assert.ok(PERSONAL_TABLES.includes('bank_custom_titles'));
  assert.ok(PLUGGY_TABLES.includes('bank_transactions'));
});

test('transfer routing preserves historical gaps, user overrides, and blocks premature cutover',()=>{
  const plan=migrationRoutingOverview();
  assert.equal(plan.mode,'personal_first_pluggy_refresh');
  assert.equal(plan.totalMappedTables,22);
  assert.equal(plan.realTransferEnabled,false);
  assert.equal(plan.backgroundSyncEnabled,false);
  assert.equal(plan.serverPluggyConfigured,false);
  assert.ok(REQUIREMENTS.some(x=>x.includes('histórico')));
  assert.ok(REQUIREMENTS.some(x=>x.includes('rollback')));
  assert.ok(REQUIREMENTS.some(x=>x.includes('account_id + external_id')));
});
