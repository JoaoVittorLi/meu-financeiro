'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {D05CategoryService}=require('../electron/d05-category-service.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const ITEM='11111111-1111-4111-8111-111111111111';
const ACC='22222222-2222-4222-8222-222222222222';
const SETTINGS={opening:0,income:0,fixed:0,existing:0,reserve:0};
const expenses=(n)=>({version:5,transactions:Array.from({length:n},(_,i)=>({
 id:'synthetic-'+i,date:'2026-11-03',kind:'expense',amount:i+1,description:'Gasto demonstrativo '+i,
 category:'Alimentação',origin:'manual'
})),budgets:{Alimentação:600000},settings:SETTINGS});
function seedBank(db){
 db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{
  account:{id:ACC,name:'Banco sintético',balance:1000},
  transactions:[
   {id:'posted',date:'2026-11-03',amount:-29.99,status:'POSTED',description:'IFOOD demonstrativo',category:'Outros'},
   {id:'pending',date:'2026-11-04',amount:-30.01,status:'PENDING',description:'Mercado demonstrativo',category:'Outros'},
   {id:'income',date:'2026-11-05',amount:10.00,status:'POSTED',description:'Salário demonstrativo',category:'Outros'}
  ]
 }]});
}
function setup(){
 const db=new FinanceDB(':memory:');
 return {db,service:new D05CategoryService(db)};
}
test('D05 E2 — catálogo, IDs, CRUD e normalização de duplicatas com acento',()=>{
 const {db,service:s}=setup();
 try{
  const all=s.listCatalog();
  assert.equal(all.parents.length,14);
  assert.equal(all.parents.reduce((n,p)=>n+p.subcategories.length,0),61);
  assert.equal(s.resolve({categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'}).child.name,'Delivery');
  assert.throws(()=>s.resolve({categoryId:'cat:moradia',subcategoryId:'sub:alimentacao/delivery'}),/incompatível/);
  assert.throws(()=>s.resolve({categoryId:'cat:alimentacao',subcategoryId:'sub:inventada'}),/incompatível/);
  const a=s.createSubcategory({parentCategoryId:'cat:alimentacao',name:'Café especial',iconKey:'coffee',hue:23});
  assert(a.id.startsWith('sub:custom:'));
  assert.throws(()=>s.createSubcategory({parentCategoryId:'cat:alimentacao',name:'  CAFE ESPECIAL ',iconKey:'coffee',hue:25}),/duplicada/);
  const another=s.createSubcategory({parentCategoryId:'cat:moradia',name:'Café especial',iconKey:'coffee',hue:210});
  assert.notEqual(a.id,another.id);
  const edited=s.updateSubcategory({id:a.id,name:'Café da tarde'});
  assert.equal(edited.id,a.id);assert.equal(edited.name,'Café da tarde');
  assert.throws(()=>s.updateSubcategory({id:'sub:alimentacao/delivery',name:'Outra coisa'}),/imutável/);
  const preview=s.previewSubcategoryDelete({id:a.id});
  assert.equal(preview.canDelete,true);
  assert.throws(()=>s.deleteSubcategory({id:a.id}),/prévia/);
  assert.equal(s.deleteSubcategory({id:a.id,previewVersion:preview.previewVersion}).deleted,a.id);
  const movable=s.createSubcategory({parentCategoryId:'cat:alimentacao',name:'Assunto exclusivo',iconKey:'tag',hue:24});
  const proposal=s.previewSubcategoryMove({id:movable.id,parentCategoryId:'cat:moradia'});
  assert.equal(proposal.canMove,true);
  assert.throws(()=>s.moveSubcategory({id:movable.id,parentCategoryId:'cat:moradia',previewVersion:'0'.repeat(64)}),/desatualizada/);
  assert.equal(s.moveSubcategory({...proposal}).id,movable.id);
  assert.equal(s.resolve({categoryId:'cat:moradia',subcategoryId:movable.id}).child.id,movable.id);
  assert.equal(db.db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close();}
});
test('D05 E2 — 630 registros manuais, categoria opcional e persistência legada sem reclassificação',()=>{
 const {db,service:s}=setup();
 try{
  db.save('real',expenses(630));
  const original=db.db.prepare('SELECT SUM(amount_cents) AS cents FROM transactions').get().cents;
  assert.equal(s.listManual({profile:'real',categoryId:'cat:alimentacao'}).total,630);
  assert.equal(s.listManual({profile:'real',categoryId:'cat:alimentacao',subcategoryId:null}).total,630);
  assert.equal(s.listManual({profile:'demo'}).total,0);
  s.assignManual({profile:'real',id:'synthetic-0',target:{categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'}});
  assert.equal(s.listManual({profile:'real',categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'}).total,1);
  assert.equal(s.listManual({profile:'real',categoryId:'cat:alimentacao',subcategoryId:null}).total,629);
  assert.equal(s.aggregateManual({profile:'real'}).groups.reduce((x,g)=>x+g.expenseCents,0),original);
  db.save('real',db.load('real'));
  assert.equal(s.listManual({profile:'real',categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'}).total,1);
  s.assignManual({profile:'real',id:'synthetic-0',target:{categoryId:'cat:moradia',subcategoryId:null}});
  assert.equal(s.listManual({profile:'real',categoryId:'cat:moradia'}).total,1);
  assert.equal(db.db.prepare("SELECT category FROM transactions WHERE profile='real' AND id='synthetic-0'").get().category,'Moradia');
  assert.equal(db.db.prepare('SELECT SUM(amount_cents) AS cents FROM transactions').get().cents,original);
  assert.equal(db.load('real').budgets['Alimentação'],600000);
  assert.throws(()=>s.assignManual({profile:'system',id:'synthetic-0',target:{categoryId:'cat:moradia'}}),/perfil/);
 }finally{db.close();}
});
test('D05 E2 — lote bancário com previewVersion e status POSTED/PENDING sem tocar no original',()=>{
 const {db,service:s}=setup();
 try{
  seedBank(db);
  const target={categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'};
  const items=[{accountId:ACC,externalId:'posted'},{accountId:ACC,externalId:'pending'}];
  const preview=s.previewBankBatch({items,target});
  assert.equal(preview.count,2);assert.equal(preview.posted,1);assert.equal(preview.pending,1);
  assert.equal(preview.changesApplied,false);
  assert.throws(()=>s.assignBankBatch({items,target,previewVersion:'0'.repeat(64)}),/desatualizada/);
  assert.equal(s.assignBankBatch({items,target,previewVersion:preview.previewVersion}).changed,2);
  const before=db.db.prepare("SELECT status,amount_cents,category FROM bank_transactions WHERE external_id='posted'").get();
  assert.equal(before.category,'Outros');
  assert.equal(before.status,'POSTED');assert.equal(before.amount_cents,-2999);
  const b=s.bankView({categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'});
  assert.equal(b.items.length,2);
  db.editBankTransaction({accountId:ACC,externalId:'posted',merchant:'',note:'revisado',nature:'ignore'});
  const stale=s.previewBankBatch({items,target});
  assert.notEqual(stale.previewVersion,preview.previewVersion);
  assert.throws(()=>s.assignBankBatch({items,target,previewVersion:preview.previewVersion}),/desatualizada/);
  assert.equal(db.db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close();}
});
test('D05 E2 — splits preservam centavos, validam pai e fazem rollback na diferença',()=>{
 const {db,service:s}=setup();
 try{
  seedBank(db);
  const parts=[
   {target:{categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'},amount:1001},
   {target:{categoryId:'cat:moradia',subcategoryId:null},amount:1998}
  ];
  assert.equal(s.setBankSplits({accountId:ACC,externalId:'posted',parts}).sumCents,2999);
  assert.throws(()=>s.setBankSplits({accountId:ACC,externalId:'posted',parts:[{...parts[0],amount:1002},parts[1]]}),/diferente/);
  assert.equal(db.db.prepare("SELECT SUM(amount_cents) AS cents FROM bank_transaction_splits WHERE external_id='posted'").get().cents,2999);
  assert.throws(()=>s.setBankSplits({accountId:ACC,externalId:'posted',parts:[{...parts[0],target:{categoryId:'cat:moradia',subcategoryId:'sub:alimentacao/delivery'}},parts[1]]}),/incompatível/);
  assert.equal(db.db.prepare("SELECT SUM(amount_cents) AS cents FROM bank_transaction_splits WHERE external_id='posted'").get().cents,2999);
  assert.equal(s.setBankSplits({accountId:ACC,externalId:'posted',parts:[]}).sumCents,0);
 }finally{db.close();}
});
test('D05 E2 — regras por filho seguem precedência e override manual vence',()=>{
 const {db,service:s}=setup();
 try{
  seedBank(db);
  const ruleA={pattern:'IFOOD',matchMode:'contains',scope:'bank',priority:10,target:{categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'}};
  const ruleB={pattern:'IFOOD',matchMode:'contains',scope:'bank',priority:20,target:{categoryId:'cat:compras',subcategoryId:null}};
  assert.equal(s.previewRule(ruleA).candidateBankMatches,1);
  assert.throws(()=>s.saveRule(ruleA),/prévia/);
  s.saveRule({...ruleA,previewVersion:s.previewRule(ruleA).previewVersion});
  assert.throws(()=>s.saveRule({...ruleB,previewVersion:'0'.repeat(64)}),/desatualizada/);
  s.saveRule({...ruleB,previewVersion:s.previewRule(ruleB).previewVersion});
  let bank=s.bankView();
  let row=bank.items.find(x=>x.id==='posted');
  assert.equal(row.categoryId,'cat:alimentacao');
  assert.equal(row.subcategoryId,'sub:alimentacao/delivery');
  assert.equal(row.categorySource,'rule');
  s.assignBank({accountId:ACC,externalId:'posted',target:{categoryId:'cat:moradia',subcategoryId:'sub:moradia/aluguel'}});
  row=s.bankView().items.find(x=>x.id==='posted');
  assert.equal(row.categoryId,'cat:moradia');
  assert.equal(row.subcategoryId,'sub:moradia/aluguel');
  assert.equal(row.categorySource,'manual');
 }finally{db.close();}
});
test('D05 E2 — planejamento e orçamento não duplicam totais; edição plana limpa filho incompatível',()=>{
 const {db,service:s}=setup();
 try{
  const planner=new PlanningStore(db);
  const created=planner.create({title:'Aluguel demonstrativo',kind:'expense',amount:10000,
    dueDate:'2026-12-10',category:'Moradia'});
  const id=created.ids[0];
  s.assignPlanned({id,target:{categoryId:'cat:moradia',subcategoryId:'sub:moradia/aluguel'}});
  assert.equal(db.db.prepare('SELECT subcategory_id FROM planned_items WHERE id=?').get(id).subcategory_id,'sub:moradia/aluguel');
  planner.edit({id,category:'Alimentação'});
  assert.equal(db.db.prepare('SELECT subcategory_id FROM planned_items WHERE id=?').get(id).subcategory_id,null);
  assert.equal(db.db.prepare('SELECT amount_cents FROM planned_items WHERE id=?').get(id).amount_cents,10000);
 }finally{db.close();}
});
test('D05 E2 — IA só recebe facade fail-closed com autorização explícita por fonte/perfil',()=>{
 const {db,service:s}=setup();
 try{
  assert.throws(()=>s.asReadOnlyFacade(),/autorizador/);
  const calls=[];const read=s.asReadOnlyFacade({authorize:scope=>{
    calls.push(scope);return scope.capability==='taxonomy'||(scope.capability==='manual'&&scope.profile==='demo');
  }});
  assert.equal(read.list().parents.length,14);
  assert.equal(read.manual({profile:'demo'}).items.length,0);
  assert.throws(()=>read.manual({profile:'real'}),/não autorizado/);
  assert.throws(()=>read.bank({}),/não autorizado/);
  assert.equal('assignBank' in read,false);
  assert.equal('createSubcategory' in read,false);
  assert.equal(calls.some(x=>x.capability==='bank'),true);
 }finally{db.close();}
});

test('D05 E2 — JSON portátil manual restaura ID custom e filho, preserva 630 registros e orçamentos',()=>{
 const source=new FinanceDB(':memory:');const target=new FinanceDB(':memory:');
 try{
  source.upsertCategory({name:'Pets',color:'#aabbcc'});
  const svc=new D05CategoryService(source);
  const custom=svc.listCatalog().parents.find(p=>p.name==='Pets');
  const child=svc.createSubcategory({parentCategoryId:custom.id,name:'Veterinário',iconKey:'stethoscope',hue:120});
  source.save('demo',expenses(630));
  svc.assignManual({profile:'demo',id:'synthetic-0',target:{categoryId:custom.id,subcategoryId:child.id}});
  const snap=svc.exportManualProfile('demo');
  const restored=new D05CategoryService(target);
  assert.equal(restored.restoreManualProfile('demo',snap).restored,630);
  const out=restored.listManual({profile:'demo',categoryId:custom.id,subcategoryId:child.id});
  assert.equal(out.total,1);
  assert.equal(target.load('demo').transactions.length,630);
  assert.equal(target.load('demo').budgets['Alimentação'],600000);
  assert.equal(target.db.prepare('PRAGMA foreign_key_check').all().length,0);
  const invalid=structuredClone(snap);
  invalid.manualTargets[0].categoryId='cat:moradia'; // incompatible with original Alimentação
  assert.throws(()=>restored.restoreManualProfile('demo',invalid),/divergente|incompatível/);
  assert.equal(restored.listManual({profile:'demo',categoryId:custom.id,subcategoryId:child.id}).total,1);
 }finally{source.close();target.close();}
});
test('D05 E2 — IPC exige sender, escopo e confirmação de escrita pelo processo principal',()=>{
 const db=new FinanceDB(':memory:');
 try{
  const {installD05Ipc,CHANNELS}=require('../electron/d05-ipc-adapter.cjs');
  const routes=new Map(),ipcMain={handle:(channel,fn)=>routes.set(channel,fn)};
  const handler=installD05Ipc({ipcMain,finance:db,
    requireAppSender:ev=>{if(ev?.trusted!==true)throw Error('sender');},
    authorizeRead:(ev,scope)=>ev.allowed==='read',
    authorizeWrite:(ev,action)=>ev.allowed==='write'&&action==='subcategory.create'});
  assert.equal(handler.service.listCatalog().parents.length,14);
  assert.throws(()=>routes.get(CHANNELS.catalog)({trusted:false,allowed:'read'}),/sender/);
  assert.throws(()=>routes.get(CHANNELS.catalog)({trusted:true,allowed:'denied'}),/não autorizada/);
  assert.equal(routes.get(CHANNELS.catalog)({trusted:true,allowed:'read'}).parents.length,14);
  assert.throws(()=>routes.get(CHANNELS.assignBank)({trusted:true,allowed:'write'},{accountId:'a'}),/obrigatória/);
  const created=routes.get(CHANNELS.createSubcategory)({trusted:true,allowed:'write'},{
    parentCategoryId:'cat:moradia',name:'Teste de IPC',iconKey:'house',hue:200});
  assert(created.id.startsWith('sub:custom:'));
 }finally{db.close();}
});

test('D05 E2 — FinanceDB.save valida e persiste hierarquia sem segunda gravação',()=>{
 const db=new FinanceDB(':memory:');const svc=new D05CategoryService(db);
 try{
  const content=expenses(3);
  content.transactions[0].categoryId='cat:alimentacao';
  content.transactions[0].subcategoryId='sub:alimentacao/delivery';
  assert.equal(db.save('demo',content).txCount,3);
  assert.equal(svc.listManual({profile:'demo',categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'}).total,1);
  const invalid=structuredClone(content);
  invalid.transactions[0].categoryId='cat:moradia';
  assert.throws(()=>db.save('demo',invalid),/divergente/);
  assert.equal(svc.listManual({profile:'demo',categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'}).total,1);
 }finally{db.close();}
});
test('D05 E2 — PlanningStore.create aceita alvo hierárquico validado no mesmo COMMIT',()=>{
 const db=new FinanceDB(':memory:');
 try{
  const p=new PlanningStore(db);
  const created=p.create({title:'Delivery de teste',kind:'expense',amount:2151,
   dueDate:'2026-12-10',target:{categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'}});
  const item=p.item(created.ids[0]);
  assert.equal(item.category,'Alimentação');
  assert.equal(item.category_id,'cat:alimentacao');
  assert.equal(item.subcategory_id,'sub:alimentacao/delivery');
  assert.throws(()=>p.create({title:'Incorreto',kind:'expense',amount:100,
   dueDate:'2026-12-12',category:'Moradia',target:{categoryId:'cat:alimentacao'}}),/divergente/);
 }finally{db.close();}
});
