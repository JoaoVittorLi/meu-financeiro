'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assertSyntheticSnapshot,ProtocolError}=require('../shared/mf2-b2-synthetic-transport.cjs');
const fresh=()=>({accounts:[{account_id:'SYNTH-A',item_id:'SYNTH-ITEM',currency:'BRL',balance_cents:0}],
 transactions:[{account_id:'SYNTH-A',external_id:'SYNTH-X',date:'2026-11-10',
 description:'SYNTHETIC: fixture',amount_cents:123,status:'POSTED',category:'Outros'}],
 manualTransactions:[],overlays:[],metadata:{snapshotKind:'synthetic',historyComplete:true,overlayCoverage:'complete'}});
const rejected=x=>assert.throws(()=>assertSyntheticSnapshot(x),e=>e instanceof ProtocolError&&
 (e.code==='non_synthetic_record'||e.code==='non_synthetic_snapshot'));
test('strict B2 synthetic schema permits original genuine fictional fixture',()=>assert.equal(assertSyntheticSnapshot(fresh()),true));
test('reject unknown top-level financial records',()=>{const x=fresh();x.customerData=[{cpf:'xxx'}];rejected(x)});
test('reject metadata canary for secret, token or personal email',()=>{
 for(const k of ['token','customerEmail','pluginSecret']){const x=fresh();x.metadata[k]='secret';rejected(x)}
});
test('reject unexpected account fields',()=>{const x=fresh();x.accounts[0].customerDocument='x';rejected(x)});
test('reject unexpected bank transaction fields',()=>{const x=fresh();x.transactions[0].accessToken='secret';rejected(x)});
test('reject suspicious nested overlay and split keys',()=>{
 const x=fresh();x.overlays=[{account_id:'SYNTH-A',external_id:'SYNTH-X',splits:[{position:1,category:'Outros',amount_cents:123,token:'sensitive'}]}];rejected(x);
 const z=fresh();z.overlays=[{account_id:'SYNTH-A',external_id:'SYNTH-X',session:'secret'}];rejected(z);
});
test('reject malformed date and fractional monetary cents',()=>{
 const x=fresh();x.transactions[0].date='2026-02-30';rejected(x);
 const y=fresh();y.transactions[0].amount_cents=1.5;rejected(y)
});
test('reject missing synthetic marker or raw financial IDs',()=>{
 const x=fresh();x.transactions[0].external_id='BANK-REAL';rejected(x);
 const y=fresh();y.metadata.snapshotKind='windows_sqlite';rejected(y)
});
