'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
function setup({partial=true}={}){
 const calls={load:0,bank:0,plan:0};
 const db={
  load(){calls.load++;return {transactions:[],budgets:{Alimentação:20000}}},
  bankOverview(){calls.bank++;return {truncated:partial,transactions:[
   {date:'2026-11-01',description:'MERCADO',merchant:'MERCADO',amount:-17000,status:'POSTED',nature:'expense',category:'Alimentação',reviewed:false},
   {date:'2026-11-02',description:'OUTRO',amount:-5000,status:'PENDING',nature:'expense',category:'Alimentação',reviewed:false}
  ]}}
 };
 const planner={list(){calls.plan++;return [{kind:'expense',status:'planned',certainty:'confirmed',remaining:12345,title:'Aluguel',dueDate:'2026-12-10'}]}};
 const local=new LocalFinancialIntelligence(db,planner,{clock:()=>Date.parse('2026-11-12T18:05:00Z')});
 const grant=local.authorize({consent:CONSENT,source:'bank',profile:'real',planning:true},37);
 const query=(intent,extras={})=>local.query({token:grant.token,month:'2026-11',intent,...extras},37);
 return {calls,local,grant,query};
}
test('I-P0.1 ledger facts preserve integer cents and partial coverage',()=>{
 const {query}=setup();
 const x=query('budgets');
 assert.equal(x.version,1);assert.equal(x.readOnly,true);assert.equal(x.changesApplied,false);
 assert.equal(x.facts.expenseCents,17000);
 assert.equal(x.facts.transactionsIncluded,1);
 assert.equal(x.facts.excluded,1);
 assert.equal(x.facts.budgets[0].spentCents,17000);
 assert.equal(x.facts.budgets[0].limitCents,20000);
 assert.equal(x.references.partial,true);
 assert.equal(x.facts.alertCount,1);
});
test('I-P0.1 bank PENDING is distinct from non-reviewed POSTED',()=>{
 const {query}=setup();
 const x=query('review');
 assert.deepEqual(x.facts.review,{count:2,postedCount:1,pendingBankCount:1});
 assert.equal(x.references.loaded,2);
});
test('I-P0.1 confirmed future commitments exclude non-planned uncertainty',()=>{
 const {query}=setup();
 const x=query('commitments');
 assert.equal(x.facts.commitments.totalCents,12345);
 assert.equal(x.facts.commitments.count,1);
 assert.deepEqual(x.facts.commitments.period,{start:'2026-12-01',end:'2026-12-31'});
});
test('I-P0.2 category and comparative amounts are pure ledger facts',()=>{
 const {query}=setup();
 assert.equal(query('category',{category:'Alimentação'}).facts.amountCents,17000);
 assert.equal(query('compare').facts.deltaExpenseCents,17000);
});
test('I-P0.1 revocation invalidates all read routes without changing records',()=>{
 const {local,grant,query,calls}=setup();
 query('radar');
 const before={...calls};
 local.revoke(grant.token,37);
 assert.throws(()=>query('radar'),/Autorização/);
 assert.deepEqual(calls,before);
});
test('I-P0.1 planning read requires explicit planning scope',()=>{
 const {local}=setup();
 const grant=local.authorize({consent:CONSENT,source:'bank',profile:'real',planning:false},37);
 assert.throws(()=>local.query({token:grant.token,month:'2026-11',intent:'commitments'},37),/Planejamento/);
});
