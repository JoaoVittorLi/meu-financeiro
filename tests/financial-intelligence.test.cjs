'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs'),{PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const ITEM='11111111-1111-4111-8111-111111111111',ACCOUNT='22222222-2222-4222-8222-222222222222';
const settings={opening:0,income:0,fixed:0,existing:0,reserve:0};
function fixture(){
 const db=new FinanceDB(':memory:'),planner=new PlanningStore(db);
 const manual={transactions:[{id:'manual-1',date:'2026-11-10',description:'Manual food',kind:'expense',amount:9999,category:'Alimentação'}],budgets:{Alimentação:5000,Transporte:10000,Assinaturas:0},settings};db.save('real',manual);
 db.save('demo',{...manual,transactions:[{...manual.transactions[0],amount:1500}]});
 db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'SYNTHETIC',balance:null},transactions:[
 {id:'split',date:'2026-11-10',description:'Mercado',amount:-100,status:'POSTED',category:'Groceries'},
 {id:'old',date:'2026-10-10',description:'Mercado',amount:-20,status:'POSTED',category:'Groceries'},
 {id:'pending',date:'2026-11-10',description:'Pendente',amount:-500,status:'PENDING',category:'Groceries'},
 {id:'transfer',date:'2026-11-10',description:'Transfer',amount:-300,status:'POSTED',category:'Groceries'},
 {id:'ignore',date:'2026-11-10',description:'Ignore',amount:-200,status:'POSTED',category:'Groceries'}]}]});
 db.setBankSplits({accountId:ACCOUNT,externalId:'split',parts:[{category:'Alimentação',amount:6000},{category:'Transporte',amount:4000}]});
 for(const [id,nature] of [['transfer','transfer'],['ignore','ignore']])db.editBankTransaction({accountId:ACCOUNT,externalId:id,nature,merchant:'',note:'',reviewed:true});
 const service=new LocalFinancialIntelligence(db,planner);
 const grant=(source='bank',extra={})=>service.authorize({consent:CONSENT,profile:'real',source,...extra},1);
 return {db,planner,service,grant,manual};
}
const q=(f,g,intent,extra={})=>f.service.query({token:g.token,intent,month:'2026-11',...extra},1);
test('no authorization, foreign owner, expiry and revoke block reads before accessing DB',()=>{
 let reads=0,now=0;const service=new LocalFinancialIntelligence({load(){reads++;throw Error('read');}},null,{clock:()=>now});
 assert.throws(()=>service.authorize({source:'bank',profile:'real',consent:true},1),/Autorize/);
 assert.throws(()=>service.query({intent:'category',month:'2026-11'},1),/Autoriza/);
 const grant=service.authorize({source:'bank',profile:'real',consent:CONSENT},1);
 assert.throws(()=>service.query({token:grant.token,intent:'category',month:'2026-11'},2),/Autoriza/);
 now=grant.expiresAt;assert.throws(()=>service.query({token:grant.token,intent:'category',month:'2026-11'},1),/expirada/);assert.equal(reads,0);
 const again=service.authorize({source:'manual',profile:'real',consent:CONSENT},1);service.revoke(again.token,1);assert.throws(()=>service.query({token:again.token,intent:'radar',month:'2026-11'},1),/Autoriza/);
});
test('SQLite-backed food query uses actual 60/40 split and excludes pending/transfer/ignore',()=>{const f=fixture();try{const r=q(f,f.grant(),'category',{category:'Alimentação'});assert.match(r.text,/60,00/);assert.equal(r.references.loaded,5);assert.equal(r.inferenceCalled,false);assert.equal(r.changesApplied,false);}finally{f.db.close();}});
test('single source, demo isolation and changed database produce new computed answers',()=>{const f=fixture();try{
 const g=f.grant('manual');assert.match(q(f,g,'category',{category:'Alimentação'}).text,/99,99/);
 f.db.save('real',{...f.manual,transactions:[{...f.manual.transactions[0],amount:8400}]});assert.match(q(f,g,'category',{category:'Alimentação'}).text,/84,00/);
 assert.throws(()=>f.grant('bank',{profile:'demo'}),/somente/);assert.throws(()=>f.grant('manual',{profile:'demo',planning:true}),/somente/);
 const demo=f.grant('manual',{profile:'demo'});assert.match(q(f,demo,'category',{category:'Alimentação'}).text,/15,00/);
}finally{f.db.close();}});
test('radar, category increases, largest expenses and review have explainable references',()=>{const f=fixture();try{
 const g=f.grant();const radar=q(f,g,'radar');assert(radar.card.rows.some(r=>r.col1==='Alimentação'&&r.col3==='Excedido'));
 assert.match(q(f,g,'compare').card.rows.find(r=>r.col1==='Alimentação').col3,/40,00/);
 const large=q(f,g,'largest');assert.equal(large.card.rows.length,1);assert.match(large.card.rows[0].col3,/100,00/);
 assert.match(q(f,g,'review').text,/revisada/);assert.match(q(f,g,'purchase').text,/não é possível|Não é possível/);
 assert.equal(radar.references.engine,'shared/finance-period-ledger.mjs');assert.equal(radar.references.planningRead,false);
}finally{f.db.close();}});
test('planning permission is separate and amounts reuse remaining balance from PlanningStore',()=>{const f=fixture();try{
 const id=f.planner.create({title:'Conta parcial',kind:'expense',amount:20000,dueDate:'2026-12-10',category:'Contas',certainty:'confirmed'}).ids[0];
 f.planner.link({itemId:id,accountId:ACCOUNT,externalId:'split'});
 f.planner.create({title:'Estimativa',kind:'expense',amount:30000,dueDate:'2026-12-11',category:'Contas',certainty:'estimated'});
 assert.throws(()=>q(f,f.grant(),'commitments'),/Planejamento/);
 const result=q(f,f.grant('bank',{planning:true}),'commitments');assert.match(result.text,/100,00/);assert.equal(result.card.rows.length,1);assert.equal(result.references.planningRead,true);
}finally{f.db.close();}});
test('all query intents are read only and reject mutation intent and malformed month',()=>{const f=fixture();try{
 const g=f.grant('bank',{planning:true}),before=f.db.db.prepare('SELECT total_changes() AS n').get().n;
 for(const intent of ['radar','category','largest','budgets','commitments','compare','review','purchase'])q(f,g,intent,{category:'Alimentação'});
 assert.equal(f.db.db.prepare('SELECT total_changes() AS n').get().n,before);
 assert.throws(()=>q(f,g,'categorize'),/somente de leitura/);assert.throws(()=>q(f,g,'radar',{month:'2026-13'}),/mês válido/);
}finally{f.db.close();}});
test('actual truncated SQLite cache is explicitly labelled and never presented as full history',()=>{
 const db=new FinanceDB(':memory:'),p=new PlanningStore(db);try{
 db.save('real',{transactions:[],budgets:{},settings});db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'SYNTHETIC',balance:null},transactions:Array.from({length:2501},(_,i)=>({id:'row-'+String(i).padStart(5,'0'),date:'2026-11-10',description:'SYNTHETIC',amount:-1,status:'POSTED',category:'Groceries'}))}]});
 const service=new LocalFinancialIntelligence(db,p),g=service.authorize({consent:CONSENT,source:'bank',profile:'real'},1);
 const result=service.query({token:g.token,intent:'category',category:'Alimentação',month:'2026-11'},1);
 assert.equal(result.references.partial,true);assert.equal(result.references.loaded,2500);assert.match(result.card.footnote,/parcial/);assert.match(result.text,/2\.500,00/);
 }finally{db.close();}
});
