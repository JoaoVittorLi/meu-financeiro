'use strict';
// MF2-01/B1 — all inputs are invented. No private SQLite/Pluggy/Cloudflare access.
const test=require('node:test');
const assert=require('node:assert/strict');
const {reconcileSnapshots}=require('../shared/mf2-reconciliation.mjs');
const {readWindowsReconciliationSnapshot}=require('../electron/cloud-reconciliation-read.cjs');
const {readCloudReconciliationSnapshot}=require('../mobile-push/src/finance-reconciliation-read.js');

const account=(extra={})=>({account_id:'FAKE-ACCOUNT',item_id:'FAKE-ITEM',
  currency:'BRL',balance_cents:12000,updated_at:'2026-11-10',...extra});
const bank=(id='FAKE-TX',extra={})=>({
  account_id:'FAKE-ACCOUNT',external_id:id,date:'2026-11-10',
  description:'Lançamento inteiramente inventado',amount_cents:-1099,status:'POSTED',
  category:'Outros',updated_at:'2026-11-10',...extra
});
const manual=(id='MAN-1',extra={})=>({profile:'real',id,date:'2026-11-10',
  description:'Registro manual fictício',kind:'expense',amount_cents:1099,
  category:'Outros',origin:'manual',...extra});
const snapshot=(extra={})=>({accounts:[account()],transactions:[bank()],
  manualTransactions:[],overlays:[],metadata:{
    historyComplete:true,overlayCoverage:'complete',snapshotKind:'synthetic'
  },...extra});
const clone=x=>JSON.parse(JSON.stringify(x));
const run=(a,b)=>reconcileSnapshots(a,b);
const count=(r,type)=>r.summary.byType[type]||0;
const secure=r=>{
  assert.equal(r.databaseChanged,false);
  assert.equal(r.cloudCutoverAllowed,false);
  assert.equal(r.financialSyncEnabled,false);
  assert.equal(r.personalDataIncluded,false);
  const json=JSON.stringify(r);
  assert.doesNotMatch(json,/FAKE-ACCOUNT|FAKE-TX|FAKE-ITEM|Lançamento inteiramente inventado|-1099/);
};

test('B1 identical snapshots and empty snapshots produce deterministic no-write reports',()=>{
  const a=snapshot(),r=run(a,clone(a));
  assert.equal(r.comparable.bank.equivalent,1);
  assert.equal(r.summary.issues,0);
  assert.equal(r.summary.state,'consistent_observed_scope');
  assert.deepEqual(r,run(clone(a),a));secure(r);
  const e=snapshot({accounts:[],transactions:[]}),result=run(e,clone(e));
  assert.equal(result.sources.cloud.bank,0);
  assert.equal(result.summary.bankCountDelta,0);
  secure(result);
});
test('B1 centavos are exact and date/status differences remain separate',()=>{
  const a=snapshot();
  const b=snapshot({transactions:[bank('FAKE-TX',{amount_cents:-1100,
    date:'2026-11-09',status:'PENDING'})]});
  const r=run(a,b);
  assert.equal(count(r,'financial_difference'),2);
  assert.equal(count(r,'status_difference'),1);
  assert.equal(r.comparable.bank.equivalent,0);secure(r);
});
test('B1 category change, description mismatch and incomplete sidecar do not silently match',()=>{
  const a=snapshot(),b=snapshot({transactions:[bank('FAKE-TX',{category:'Lazer',
    description:'Texto cloud diferente'})]});
  assert.equal(count(run(a,b),'category_difference'),1);
  assert.equal(count(run(a,b),'attribute_difference'),1);
  const missing=snapshot({transactions:[bank('FAKE-TX',{category:null,categoryCovered:false})]});
  assert.equal(count(run(a,missing),'incomplete'),1);
});
test('B1 explicit null provider category maps to default Outros only if covered',()=>{
  const a=snapshot();
  const cloud=snapshot({transactions:[bank('FAKE-TX',{category:null,categoryCovered:true})]});
  assert.equal(run(a,cloud).comparable.bank.equivalent,1);
});
test('B1 account identities, balance unknown versus zero and invalid item are detected',()=>{
  const a=snapshot(),b=snapshot({accounts:[account({item_id:'OTHER-ITEM',balance_cents:null})]});
  const r=run(a,b);
  assert.equal(count(r,'account_identity_difference'),1);
  assert.equal(count(r,'incomplete'),1);
  assert.equal(run(snapshot({accounts:[account({balance_cents:0})]}),
    snapshot({accounts:[account({balance_cents:0})]})).comparable.accounts.equivalent,1);
});
test('B1 630 versus 632 is a hypothesis, not data loss',()=>{
  const build=n=>Array.from({length:n},(_,i)=>bank('FAKE-'+String(i).padStart(4,'0')));
  const a=snapshot({transactions:build(630)});
  const b=snapshot({transactions:build(632),metadata:{snapshotKind:'cloud_staging',
    lastFetched:630,historyComplete:null,overlayCoverage:'unavailable'}});
  const r=run(a,b);
  assert.equal(r.sources.windows.bank,630);
  assert.equal(r.sources.cloud.bank,632);
  assert.equal(r.summary.bankCountDelta,2);
  assert.equal(count(r,'only_one_source'),2);
  assert.ok(r.summary.historicalHypotheses.includes('cloud_staging_preserved_prior_fetches'));
  assert.equal(r.cloudCutoverAllowed,false);
  secure(r);
});
test('B1 identical account/external ID duplicated inside a source is blocked',()=>{
  const a=snapshot({transactions:[bank(),bank()]});
  const r=run(a,snapshot());
  assert.equal(count(r,'duplicate_identity'),1);
  assert.equal(r.comparable.bank.equivalent,0);
});
test('B1 likely same-day duplicate is review only and never collapsed',()=>{
  const a=snapshot({transactions:[bank('FAKE-TX'),bank('FAKE-TX-2')]});
  const r=run(a,clone(a));
  assert.equal(count(r,'possible_duplicate'),4);
  assert.equal(r.sources.windows.bank,2);
  assert.equal(r.automaticSettlementEnabled,false);
});
test('B1 manual edits, transfer nature, splits, links and revision conflict need review',()=>{
  const a=snapshot({overlays:[{account_id:'FAKE-ACCOUNT',external_id:'FAKE-TX',
    category:'Gastos',nature:'transfer',manual_id:'MAN-1',revision:1,
    splits:[{position:0,category:'Gastos',amount_cents:1099}]}]});
  const b=snapshot({overlays:[{account_id:'FAKE-ACCOUNT',external_id:'FAKE-TX',
    category:'Outros',nature:'expense',manual_id:null,revision:2,
    splits:[{position:0,category:'Outros',amount_cents:1099}]}]});
  const r=run(a,b);
  assert.equal(count(r,'personal_edit_difference'),4);
  assert.equal(count(r,'revision_conflict'),1);
  assert.equal(r.automaticSettlementEnabled,false);
});
test('B1 unavailable cloud overlays mean unknown coverage, not equality',()=>{
  const a=snapshot({overlays:[{account_id:'FAKE-ACCOUNT',external_id:'FAKE-TX',
    category:'Lazer'}]});
  const b=snapshot({metadata:{overlayCoverage:'unavailable',historyComplete:null}});
  const r=run(a,b);
  assert.equal(r.comparable.overlay.checked,false);
  assert.equal(r.summary.state,'consistent_observed_scope_only');
});
test('B1 manual and bank namespaces never merge or double count',()=>{
  const a=snapshot({manualTransactions:[manual()]});
  const b=snapshot({manualTransactions:[manual('MAN-2')]});
  const r=run(a,b);
  assert.equal(r.sources.windows.bank,1);
  assert.equal(r.sources.windows.manual,1);
  assert.equal(count(r,'only_one_source'),2);
});
test('B1 invalid dates and money are incomplete, never rounded',()=>{
  const a=snapshot(),b=snapshot({transactions:[bank('FAKE-TX',{
    date:'2026-02-30',amount_cents:12.35})]});
  const r=run(a,b);
  assert.equal(count(r,'incomplete'),2);
  assert.equal(r.summary.state,'requires_manual_review');
  secure(r);
});
test('B1 permutation invariance, pure function, max rows and error boundary',()=>{
  const a=snapshot({transactions:[bank('X'),bank('Y',{amount_cents:123})]});
  const b=snapshot({transactions:[bank('Y',{amount_cents:123}),bank('X')]});
  const beforeA=JSON.stringify(a),beforeB=JSON.stringify(b);
  assert.deepEqual(run(a,b),run(b,a));
  assert.equal(JSON.stringify(a),beforeA);
  assert.equal(JSON.stringify(b),beforeB);
  assert.throws(()=>run(snapshot({transactions:new Array(100001).fill(bank())}),b));
  assert.throws(()=>run(snapshot({transactions:[null]}),b));
});
function fakeWindowsDb(tables){
  const queries=[];
  const db={prepare(sql){queries.push(sql);
    assert.match(sql,/^\s*SELECT\b/i);
    const table=sql.match(/\bFROM\s+(\w+)/i)?.[1];
    return {all(){return (tables[table]||[]).filter(x=>!sql.includes("profile='real'")||x.profile==='real');}};
  }};
  return {db,queries};
}
test('B1 Windows adapter reads real schema names using SELECT-only; excludes demo',()=>{
  const {db,queries}=fakeWindowsDb({
    bank_accounts:[account()],bank_transactions:[bank()],
    transactions:[manual(),manual('DEMO',{profile:'demo'})],
    bank_category_overrides:[{account_id:'FAKE-ACCOUNT',external_id:'FAKE-TX',category:'Lazer'}],
    bank_transaction_notes:[{account_id:'FAKE-ACCOUNT',external_id:'FAKE-TX',nature:'transfer'}]
  });
  const s=readWindowsReconciliationSnapshot({db});
  assert.equal(s.manualTransactions.length,1);
  assert.equal(s.overlays.length,1);
  assert.equal(s.overlays[0].nature,'transfer');
  assert.equal(s.metadata.overlayCoverage,'complete');
  assert.ok(queries.length>=7);
});
function fakeCloudStorage(tables){
  const queries=[];
  const storage={sql:{exec(sql,...args){
    queries.push(sql);
    assert.match(sql,/^\s*SELECT\b/i);
    let data=[];
    if(sql.includes('sqlite_master'))data=Object.hasOwn(tables,args[0])?[{name:args[0]}]:[];
    else if(sql.includes('mf_transfer_session'))data=tables.mf_transfer_session||[];
    else if(sql.includes('mf_transfer_rows'))data=(tables.mf_transfer_rows||[])
      .filter(x=>x.import_id===args[0]&&x.table_name===args[1]);
    else if(sql.includes('mf_personal_edits'))data=tables.mf_personal_edits||[];
    else {const table=sql.match(/\bFROM\s+(\w+)/i)?.[1];data=tables[table]||[];}
    return {toArray:()=>data};
  }}};
  return {storage,queries};
}
test('B1 Cloudflare adapter reads existing staging without CREATE, no HTTP or Pluggy',()=>{
  const {storage,queries}=fakeCloudStorage({
    mf_bank_staging_accounts:[account()],
    mf_bank_staging_transactions:[{...bank(),source_updated_at:'2026-11-10'}],
    mf_bank_staging_categories:[{account_id:'FAKE-ACCOUNT',external_id:'FAKE-TX',
      category_original:null}],
    mf_bank_sync_state:[{last_count:1}]
  });
  const s=readCloudReconciliationSnapshot(storage);
  assert.equal(s.transactions[0].category,'Outros');
  assert.equal(s.transactions[0].categoryCovered,true);
  assert.equal(s.metadata.lastFetched,1);
  assert.equal(s.metadata.overlayCoverage,'unavailable');
  assert.ok(queries.every(q=>q.startsWith('SELECT')));
});
test('B1 adapters compose to one deterministic reconciliation without side effects',()=>{
  const windows=fakeWindowsDb({
    bank_accounts:[account()],bank_transactions:[bank()],transactions:[]
  });
  const cloud=fakeCloudStorage({
    mf_bank_staging_accounts:[account()],
    mf_bank_staging_transactions:[{...bank(),source_updated_at:'2026-11-10'}],
    mf_bank_staging_categories:[{account_id:'FAKE-ACCOUNT',external_id:'FAKE-TX',
      category_original:null}]
  });
  const r=run(readWindowsReconciliationSnapshot(windows.db),
    readCloudReconciliationSnapshot(cloud.storage));
  assert.equal(r.comparable.bank.equivalent,1);
  assert.equal(r.comparable.accounts.equivalent,1);
  assert.equal(r.summary.state,'consistent_observed_scope_only');
  secure(r);
});
