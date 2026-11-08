'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const ITEM='c4c4c4c4-1111-4111-8111-111111111111';
const ACCOUNT='c4c4c4c4-2222-4222-8222-222222222222';
test('new cross-platform purchase-quote formula equals desktop planning simulator',async()=>{
  const {installmentQuote}=await import('../shared/finance-installment-quote.mjs');
  const fin=new FinanceDB(':memory:');
  try{
    fin.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{
      account:{id:ACCOUNT,name:'Teste fictício',balance:2500,type:'BANK',currencyCode:'BRL'},
      transactions:[]
    }]});
    const planning=new PlanningStore(fin);
    for(const params of [
      {today:'2026-11-07',amount:10000,installments:3,monthlyRate:0,firstDueDate:'2027-01-31'},
      {today:'2026-11-07',amount:120000,installments:12,monthlyRate:2,firstDueDate:'2026-12-07'},
      {today:'2026-11-07',amount:520000,installments:5,monthlyRate:1.5,firstDueDate:'2027-03-01'}
    ]){
      const web=installmentQuote(params);
      const windows=planning.simulatePurchase(params);
      assert.equal(web.principal,windows.principal);
      assert.equal(web.monthly,windows.monthly);
      assert.equal(web.total,windows.total);
      assert.equal(web.interest,windows.interest);
      assert.equal(web.installments,windows.installments);
      assert.deepEqual(web.schedule,windows.schedule);
      assert.equal(web.cloudCutoverAllowed,false);
      assert.equal(web.balanceVerified,false);
    }
  }finally{fin.close();}
});
