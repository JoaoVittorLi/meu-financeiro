import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileBankSnapshot} from '../src/finance-bank-reconcile.js';

const transaction=(id,extras={})=>({
  account_id:'itau-account-fixture',
  external_id:id,date:'2026-11-07',
  description:'COMPRA FICTÍCIA',amount_cents:-2511,
  status:'POSTED',category:'Outros',
  updated_at:'2026-11-07T18:00:00Z',...extras
});

test('Pluggy replay inserts once, changes once, then becomes a no-op',()=>{
  const first=reconcileBankSnapshot([],[transaction('pluggy-001')]);
  assert.equal(first.records.length,1);
  assert.equal(first.summary.inserted,1);
  const replay=reconcileBankSnapshot(first.records,[transaction('pluggy-001')]);
  assert.equal(replay.summary.inserted,0);
  assert.equal(replay.summary.updated,0);
  assert.equal(replay.summary.unchanged,1);
  assert.deepEqual(replay.records,first.records);
  const revised=reconcileBankSnapshot(replay.records,[transaction('pluggy-001',{
    status:'POSTED',description:'COMPRA FICTÍCIA ATUALIZADA'
  })]);
  assert.equal(revised.summary.updated,1);
  assert.equal(revised.summary.total,1);
  const repeat=reconcileBankSnapshot(revised.records,[transaction('pluggy-001',{
    status:'POSTED',description:'COMPRA FICTÍCIA ATUALIZADA'
  })]);
  assert.equal(repeat.summary.updated,0);
  assert.equal(repeat.summary.deleted,0);
});

test('a restricted Pluggy historical window must not erase old bank records',()=>{
  const old=[transaction('old-001',{date:'2023-02-01'}),transaction('recent-002')];
  const newest=reconcileBankSnapshot(old,[transaction('recent-002'),transaction('new-003')]);
  assert.equal(newest.summary.historicalPreserved,1);
  assert.equal(newest.summary.inserted,1);
  assert.equal(newest.records.length,3);
  assert.ok(newest.records.some(x=>x.external_id==='old-001'));
});

test('bank IDs are scoped to account, avoiding duplicate identities across accounts',()=>{
  const x=reconcileBankSnapshot([
    transaction('same-external-id',{account_id:'itau-account-fixture'})
  ],[
    transaction('same-external-id',{account_id:'other-bank'})
  ]);
  assert.equal(x.records.length,2);
  assert.equal(x.summary.inserted,1);
});

test('duplicate identifiers and invalid cent values fail before any cloud write',()=>{
  const item=transaction('dup');
  assert.throws(()=>reconcileBankSnapshot([],[item,item]),/duplicado/);
  assert.throws(()=>reconcileBankSnapshot([item,item],[]),/duplicado/);
  assert.throws(()=>reconcileBankSnapshot([],[transaction('bad',{amount_cents:25.12})]),/Centavos/);
  assert.throws(()=>reconcileBankSnapshot([],[transaction('bad',{date:'2026-02-30'})]),/impossível/);
  assert.throws(()=>reconcileBankSnapshot([],[transaction('bad',{account_id:''})]),/inválido/);
});

test('source arrays are never mutated and user overrides remain outside bank provider rows',()=>{
  const old=Object.freeze([Object.freeze(transaction('unchanged'))]);
  const input=Object.freeze([Object.freeze(transaction('unchanged'))]);
  const result=reconcileBankSnapshot(old,input);
  assert.equal(result.records.length,1);
  assert.equal(result.summary.databaseChanged,false);
  assert.equal(Object.hasOwn(result.records[0],'customTitle'),false);
  assert.equal(Object.hasOwn(result.records[0],'planned_link'),false);
});
