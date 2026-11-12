'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {seedCategoryReview}=require('./category-review-fixture.cjs');
const ITEM='11111111-1111-4111-8111-111111111111',ACCOUNT='22222222-2222-4222-8222-222222222222',OTHER='33333333-3333-4333-8333-333333333333';
function seedQ1(profile){
 seedCategoryReview(profile);const db=new FinanceDB(path.join(profile,'meu-financeiro.sqlite'));
 try{
  const tx=(id,description,extra={})=>({id,date:'2026-11-10',description,amount:-25,status:'POSTED',category:'Outros',...extra});
  db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'Conta de teste · dados fictícios',balance:null},transactions:[
   tx('medium-1','LIVRARIA DAS ARVORES'),tx('medium-2','LIVRARIA DAS ARVORES'),tx('medium-3','LIVRARIA DAS ARVORES'),
   tx('transport-1','METRO CIDADE'),tx('transport-2','METRO CIDADE'),tx('transport-3','METRO CIDADE'),tx('transport-4','METRO CIDADE'),
   tx('transfer-q1','TRANSFERENCIA ENTRE CONTAS'),tx('split-q1','COMPRA DIVIDIDA'),tx('ignore-q1','AJUSTE DE TESTE'),
   ...Array.from({length:55},(_,i)=>tx('review-'+String(i).padStart(2,'0'),'MOVIMENTO DE TESTE '+String(i).padStart(2,'0'),{amount:-(i+1)}))]},
   {account:{id:OTHER,name:'Segunda conta · dados fictícios',balance:5000},transactions:[tx('other-cafe','CAFETERIA FLORESTA')]}]});
  for(const id of ['medium-1','medium-2'])db.overrideBankCategory({accountId:ACCOUNT,externalId:id,category:'Educação'});
  for(const id of ['transport-1','transport-2','transport-3'])db.overrideBankCategory({accountId:ACCOUNT,externalId:id,category:'Transporte'});
  db.editBankTransaction({accountId:ACCOUNT,externalId:'transfer-q1',merchant:'',note:'Fixture Q1',nature:'transfer',reviewed:true});
  db.editBankTransaction({accountId:ACCOUNT,externalId:'ignore-q1',merchant:'',note:'Fixture Q1',nature:'ignore',reviewed:true});
  db.setBankSplits({accountId:ACCOUNT,externalId:'split-q1',parts:[{category:'Alimentação',amount:1500},{category:'Transporte',amount:1000}]});
  const manual=db.load('real');manual.budgets={Alimentação:10000,Transporte:15000,Assinaturas:0};db.save('real',manual);
  new PlanningStore(db).create({title:'Conta de teste Q1',kind:'expense',amount:24000,dueDate:'2026-11-15',category:'Contas',certainty:'confirmed'});
 }finally{db.close();}
}
if(require.main===module){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d1-electron-q1-'));seedQ1(profile);console.log(profile);
}
module.exports={seedQ1,ITEM,ACCOUNT,OTHER};
