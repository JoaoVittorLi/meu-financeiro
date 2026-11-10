'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const item='11111111-1111-4111-8111-111111111111';
const account='22222222-2222-4222-8222-222222222222';
test('D1.2 categoria renomeada conserva regras, decisões bancárias e split, orçamento e planejamento',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-category-rename-'));let db;
 try{
  db=new FinanceDB(path.join(root,'db.sqlite'));let plan=new PlanningStore(db);
  db.upsertCategory({name:'Original Teste',color:'#aabbcc',emoji:'🎯'});
  db.save('real',{version:5,transactions:[{id:'man-1',date:'2026-11-10',description:'synthetic',kind:'expense',amount:2500,category:'Original Teste',origin:'manual'}],budgets:{'Original Teste':0},settings:{opening:0,income:0,fixed:0,existing:0,reserve:0}});
  db.ingestBank(item,{item:{status:'UPDATED'},data:[{account:{id:account,name:'SYNTHETIC',balance:200,type:'BANK',currencyCode:'BRL'},transactions:[{id:'bank-1',date:'2026-11-10',description:'FATURA TESTE',amount:-50,status:'POSTED',category:'Shopping'}]}]});
  db.upsertRule({pattern:'FATURA TESTE',category:'Original Teste',matchMode:'contains',scope:'bank',priority:30});
  db.overrideBankCategory({accountId:account,externalId:'bank-1',category:'Original Teste'});
  db.setBankSplits({accountId:account,externalId:'bank-1',parts:[{category:'Original Teste',amount:3000},{category:'Outros',amount:2000}]});
  const planId=plan.create({title:'SYNTHETIC BILL',kind:'expense',amount:5000,dueDate:'2026-11-20',category:'Original Teste'}).ids[0];
  db.upsertCategory({previousName:'Original Teste',name:'Nova Categoria',color:'#aabbcc',emoji:'🎯'});
  assert.equal(db.load('real').transactions[0].category,'Nova Categoria');
  assert.equal(db.load('real').budgets['Nova Categoria'],0);
  assert.equal(plan.item(planId).category,'Nova Categoria');
  assert.equal(db.listCategories().rules.find(r=>r.pattern==='FATURA TESTE').category,'Nova Categoria');
  const bank=db.bankOverview();
  const tx=bank.transactions.find(t=>t.id==='bank-1');
  assert.equal(tx.category,'Nova Categoria');
  assert.equal(tx.splits[0].category,'Nova Categoria');
  assert(bank.dailyTotals.some(d=>d.categories.some(c=>c.name==='Nova Categoria'&&c.total===3000)));
  assert.deepEqual(db.integrity(),['ok']);
  db.close(); db=new FinanceDB(path.join(root,'db.sqlite'));plan=new PlanningStore(db);
  assert.equal(db.listCategories().rules.find(r=>r.pattern==='FATURA TESTE').category,'Nova Categoria');
  assert.equal(db.bankOverview().transactions.find(t=>t.id==='bank-1').splits[0].category,'Nova Categoria');
 }finally{db?.close();fs.rmSync(root,{recursive:true,force:true});}
});
