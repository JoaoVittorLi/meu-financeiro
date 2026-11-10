'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const ITEM_A='11111111-1111-4111-8111-111111111111';
const ITEM_B='11111111-1111-4111-8111-222222222222';
const ACCOUNT='22222222-2222-4222-8222-222222222222';
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d12-bank-fictitious-'));const db=new FinanceDB(path.join(dir,'test.sqlite'));try{return fn(db)}finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}}
const tx=(id='first',amount=-15)=>({id,date:'2026-11-10',description:'SYNTHETIC TRANSACTION',amount,status:'POSTED',category:'Groceries'});
const acc=(transactions,accountId=ACCOUNT,name='SYNTHETIC BANK')=>({account:{id:accountId,name,balance:500,type:'BANK',currencyCode:'BRL'},transactions});
const batch=entries=>({item:{status:'UPDATED'},data:entries});
test('D1.2 — duplicate bank transaction IDs in one batch are rejected atomically',()=>fixture(db=>{
  const original=db.ingestBank(ITEM_A,batch([acc([tx('first')])]));
  assert.deepEqual([original.newCount,original.totalCount],[1,1]);
  const before=db.bankOverview();
  assert.throws(()=>db.ingestBank(ITEM_A,batch([acc([tx('duplicate',-15),tx('duplicate',-99)])])),/duplicad/i);
  const after=db.bankOverview();
  assert.equal(after.totalTransactions,before.totalTransactions);
  assert.equal(after.transactions[0].id,'first');
  assert.equal(after.transactions[0].amount,-1500);
  assert.deepEqual(db.integrity(),['ok']);
}));
test('D1.2 — duplicate accounts in one import never silently overwrite balance',()=>fixture(db=>{
  assert.throws(()=>db.ingestBank(ITEM_A,batch([acc([tx('a')],ACCOUNT,'SYNTHETIC BANK'),acc([tx('b')],ACCOUNT,'SYNTHETIC ALTERED')])),/duplicad/i);
  const state=db.bankOverview();
  assert.equal(state.totalTransactions,0);
  assert.equal(state.accounts.length,0);
  assert.deepEqual(db.integrity(),['ok']);
}));
test('D1.2 — same account ID from another Pluggy item cannot hijack prior owner',()=>fixture(db=>{
  db.ingestBank(ITEM_A,batch([acc([tx('original')])]));
  const before=db.bankOverview();
  assert.throws(()=>db.ingestBank(ITEM_B,batch([acc([tx('intruder')],ACCOUNT,'SYNTHETIC OTHER ITEM')])),/outra conex[aã]o|j[aá] vinculada/i);
  const after=db.bankOverview();
  assert.equal(after.accounts[0].itemId,ITEM_A);
  assert.equal(after.accounts[0].name,before.accounts[0].name);
  assert.equal(after.totalTransactions,1);
  assert.equal(after.transactions[0].id,'original');
  assert.deepEqual(db.integrity(),['ok']);
}));
test('D1.2 — same external transaction ID in distinct accounts remains valid',()=>fixture(db=>{
  const otherAccount='33333333-3333-4333-8333-333333333333';
  const result=db.ingestBank(ITEM_A,batch([acc([tx('shared')]),acc([tx('shared')],otherAccount,'SYNTHETIC SECOND ACCOUNT')]));
  assert.equal(result.newCount,2);
  assert.equal(result.totalCount,2);
  const bank=db.bankOverview();
  assert.equal(bank.totalTransactions,2);
  assert.equal(bank.transactions.filter(t=>t.id==='shared').length,2);
  assert.equal(bank.accounts.length,2);
  assert.deepEqual(db.integrity(),['ok']);
}));
