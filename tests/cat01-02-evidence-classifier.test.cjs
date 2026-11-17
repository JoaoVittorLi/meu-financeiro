'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {normalizePluggyEvidence,coverageSummary,isCnpj}=require('../electron/cat01-pluggy-evidence.cjs');
const {migrateCat01,persistEvidenceBatch,evidenceFor,coverageDiagnostic,revertEmptyCat01}=require('../electron/cat01-evidence-store.cjs');
const {buildCatalog,teachLocalModel,inferLocalModel,classifyCandidate}=require('../electron/cat02-classifier.cjs');
const DATE='2026-11-17T12:00:00Z';
const account=i=>'bank-synthetic-'+i;
const tx=(id,opts={})=>({id,accountId:account(1),status:'POSTED',
 type:'DEBIT',amount:-12.34,date:'2026-11-10',description:'Supermercado Exemplo',
 operationType:'CARTAO',creditCardMetadata:{payeeMCC:5411},category:'Supermarkets',...opts});
const evidence=opts=>normalizePluggyEvidence(tx('sample',opts),{accountId:account(1),observedAt:DATE});
const row=(extras={})=>({accountId:account(1),externalId:'sample',amountCents:-1234,status:'POSTED',
 description:'Supermercado Exemplo',nature:'auto',...extras});
function db3(){
 const db=new DatabaseSync(':memory:');
 db.exec("PRAGMA foreign_keys=ON;CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);"+
 "CREATE TABLE bank_items(item_id TEXT PRIMARY KEY,institution TEXT);"+
 "CREATE TABLE bank_accounts(account_id TEXT PRIMARY KEY,item_id TEXT,name TEXT,subtype TEXT);"+
 "CREATE TABLE bank_transactions(account_id TEXT,external_id TEXT,PRIMARY KEY(account_id,external_id),"+
 "FOREIGN KEY(account_id) REFERENCES bank_accounts(account_id));");
 const addAccount=db.prepare("INSERT INTO bank_accounts(account_id,item_id,name,subtype) VALUES(?,?,?,?)");
 const addTx=db.prepare("INSERT INTO bank_transactions(account_id,external_id) VALUES(?,?)");
 for(let i=1;i<=3;i++){
  db.prepare("INSERT INTO bank_items(item_id,institution) VALUES(?,?)").run('item-'+i,'Instituição sintética '+i);
  addAccount.run(account(i),'item-'+i,'Conta '+i,'CHECKING');
  for(let j=0;j<210;j++)addTx.run(account(i),'tx-'+j);
 }
 return db;
}
test('CAT01 T1 — Pluggy nullable fields stay nullable without invented identifiers',()=>{
 const x=normalizePluggyEvidence(tx('sample',{merchant:null,category:null,categoryId:null,
  creditCardMetadata:null,paymentData:null,descriptionRaw:null}),{accountId:account(1),observedAt:DATE});
 assert.equal(x.mcc,null);assert.equal(x.receiverCnpj,null);assert.equal(x.providerCategory,null);
 assert.equal(x.presence.mcc,false);assert.equal(x.descriptionRaw,null);
});
test('CAT01 T2 — merchant CNPJ valid, CPF never retained',()=>{
 const x=evidence({merchant:{name:'Loja Exemplo',cnpj:'11.222.333/0001-81'},
  paymentData:{receiver:{name:'Pessoa',documentNumber:{type:'CPF',value:'12345678901'}}}});
 assert.equal(isCnpj('11.222.333/0001-81'),true);
 assert.equal(x.merchantCnpj,'11222333000181');assert.equal(x.receiverCnpj,null);
 assert.equal(JSON.stringify(x).includes('12345678901'),false);
});
test('CAT01 T3 — CNPJ irregular cannot identify a business',()=>{
 const x=evidence({merchant:{cnpj:'11.111.111/1111-11'},creditCardMetadata:{payeeMCC:'invalid'}});
 assert.equal(x.merchantCnpj,null);assert.equal(x.mcc,null);
});
test('CAT01 T4 — operationType, MCC, provider categorization have precise provenance',()=>{
 const x=evidence({descriptionRaw:'MERCADO EXEMPLO 123',paymentData:{paymentMethod:'PIX',
   receiver:{name:'Loja',documentNumber:{type:'CNPJ',value:'11222333000181'}}}});
 assert.equal(x.operationType,'CARTAO');assert.equal(x.mcc,'5411');
 assert.equal(x.receiverCnpj,'11222333000181');assert.equal(x.providerCategory,'Supermarkets');
 assert.equal(x.descriptionRaw,'MERCADO EXEMPLO 123');
});
test('CAT01 T5 — malformed input and credentials never normalized as fields',()=>{
 assert.throws(()=>normalizePluggyEvidence({},{}),/identidade/);
 const x=evidence({clientSecret:'should-not-store',apiKey:'should-not-store'});
 assert(!JSON.stringify(x).includes('should-not-store'));
});
test('CAT01 T6 — sidecar migrates idempotently and persists 3 accounts × 210 movements',()=>{
 const db=db3();
 try{
  migrateCat01(db);migrateCat01(db);
  const rows=[];
  for(let i=1;i<=3;i++)for(let j=0;j<210;j++)rows.push({accountId:account(i),transaction:tx('tx-'+j,{
    accountId:account(i),creditCardMetadata:j%2?{payeeMCC:5411}:null,category:null
  })});
  const first=persistEvidenceBatch(db,rows,{observedAt:DATE});
  assert.equal(first.stored,630);
  const second=persistEvidenceBatch(db,rows,{observedAt:'2026-11-17T15:00:00Z'});
  assert.equal(second.unchanged,630);assert.equal(second.stored,0);
  const d=coverageDiagnostic(db);assert.equal(d.length,3);
  assert.equal(d.reduce((n,x)=>n+x.count,0),630);
  const got=evidenceFor(db,account(3),'tx-14');
  assert.equal(got.version,'CAT01/PLUGGY-EVIDENCE-V1');
  assert.equal(got.accountId,account(3));
  assert.throws(()=>revertEmptyCat01(db),/backup/);
 }finally{db.close();}
});
test('CAT01 T7 — SQLite batch rollback on missing transaction FK',()=>{
 const db=db3();try{migrateCat01(db);
  assert.throws(()=>persistEvidenceBatch(db,[{accountId:account(1),transaction:tx('tx-0')},
   {accountId:account(1),transaction:tx('missing')}],{observedAt:DATE}),/constraint/i);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cat01_metadata').get().n,0);
 }finally{db.close();}
});
test('CAT01 T8 — duplicate keys in one batch are rejected before transaction',()=>{
 const db=db3();try{migrateCat01(db);
  assert.throws(()=>persistEvidenceBatch(db,Array.from({length:2},()=>({accountId:account(1),transaction:tx('tx-0')})),{observedAt:DATE}),/repetido/);
 }finally{db.close();}
});
test('CAT01 T9 — no evidence state produces counts, not personal row details',()=>{
 const rows=[evidence({}),evidence({creditCardMetadata:null,merchant:null,category:null})];
 const summary=coverageSummary(rows);
 assert.equal(summary.length,1);assert.equal(summary[0].count,2);
 assert.equal('description' in summary[0],false);
});
test('CAT02 T10 — canonical 14 × 61 D05',()=>{
 const cat=buildCatalog();
 assert.equal(cat.byId.size,75);
 assert.equal(cat.byId.get('sub:contas/seguros').categoryId,'cat:contas');
});
test('CAT02 T11 — MCC and category agree, safe candidate applies without Premium merchant',()=>{
 const x=classifyCandidate({transaction:row(),evidence:evidence()});
 assert.equal(x.status,'apply');assert.deepEqual(x.target,{
  categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/supermercados'});
 assert.equal(x.modelUsed,false);
});
test('CAT02 T12 — no Premium and zero human labels -> honest review',()=>{
 const x=classifyCandidate({transaction:row(),evidence:evidence({category:null,merchant:null,
  creditCardMetadata:null,paymentData:null}),history:[],model:teachLocalModel([])});
 assert.equal(x.status,'review');assert.equal(x.reason,'INSUFFICIENT_EVIDENCE');
});
test('CAT02 T13 — wrong MCC vs provider category is explicit conflict',()=>{
 const x=classifyCandidate({transaction:row(),evidence:evidence({creditCardMetadata:{payeeMCC:5541}})});
 assert.equal(x.status,'review');assert.equal(x.reason,'EVIDENCE_CONFLICT');
});
test('CAT02 T14 — pending, transfer, split, manual override and linked manual protected',()=>{
 for(const t of [row({status:'PENDING'}),row({nature:'transfer'}),row({nature:'ignore'}),
  row({splitCount:2}),row({manualOverride:true}),row({linkedManualId:'manual1'})]){
  assert.equal(classifyCandidate({transaction:t,evidence:evidence()}).status,'protected');
 }
});
test('CAT02 T15 — invoice payments and refunds never become expenses',()=>{
 for(const type of ['PAGAMENTO_FATURA','ESTORNO','CASHBACK','TRANSFERENCIA_MESMA_INSTITUICAO']){
  const x=classifyCandidate({transaction:row(),evidence:evidence({operationType:type})});
  assert.equal(x.status,'protected',type);
 }
});
test('CAT02 T16 — credit card flows are disabled until bill parity QA',()=>{
 const x=classifyCandidate({transaction:row({accountType:'CREDIT'}),evidence:evidence()});
 assert.equal(x.status,'review');assert.equal(x.reason,'CREDIT_CARD_BILL_PARITY_NOT_APPROVED');
});
test('CAT02 T17 — explicit signed rule respected, but conflicting rules sent for review',()=>{
 const target={categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'};
 const r={approvedByHuman:true,enabled:true,target,matchMode:'exact',pattern:row().description,
  scope:'bank',priority:10};
 const ok=classifyCandidate({transaction:row(),evidence:evidence(),rules:[r]});
 assert.equal(ok.status,'apply');assert.equal(ok.reason,'HUMAN_APPROVED_RULE');
 const bad=classifyCandidate({transaction:row(),evidence:evidence(),rules:[
  r,{...r,priority:11,target:{categoryId:'cat:transporte',subcategoryId:null}}
 ]});
 assert.equal(bad.status,'review');
});
test('CAT02 T18 — 3 human confirmed events from distinct dates corroborate MCC',()=>{
 const target={categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/supermercados'};
 const history=[1,2,3].map(n=>({approvedByHuman:true,merchant:'Loja',
  cnpj:'11222333000181',date:'2026-11-0'+n,nature:'expense',target}));
 const x=classifyCandidate({transaction:row(),evidence:evidence({
  merchant:{cnpj:'11222333000181'},category:null}),history});
 assert.equal(x.status,'apply');assert(x.evidenceTypes.includes('human_cnpj_history'));
});
test('CAT02 T19 — conflicting human categories never auto-apply',()=>{
 const history=[1,2,3].map(n=>({approvedByHuman:true,merchant:'Loja',
 cnpj:'11222333000181',date:'2026-11-0'+n,nature:'expense',target:{
 categoryId:n===3?'cat:transporte':'cat:alimentacao',subcategoryId:null}}));
 const x=classifyCandidate({transaction:row(),evidence:evidence({merchant:{
  cnpj:'11222333000181'}}),history});
 assert.equal(x.status,'review');assert.equal(x.reason,'HUMAN_HISTORY_CONFLICT');
});
test('CAT02 T20 — local Naive Bayes learns only human labels; uncalibrated cannot auto-write',()=>{
 const labels=[...Array.from({length:6},(_,i)=>({approvedByHuman:true,
  description:'mercado supermercado cesta arroz '+i,target:{categoryId:'cat:alimentacao',subcategoryId:null}})),
 ...Array.from({length:6},(_,i)=>({approvedByHuman:true,
  description:'corrida transporte taxi uber '+i,target:{categoryId:'cat:transporte',subcategoryId:null}}))];
 const model=teachLocalModel(labels);
 assert.equal(model.trained,true);const answer=inferLocalModel('supermercado arroz',model);
 assert.equal(answer.status,'ranked_for_review');
 assert.equal(answer.candidates[0].target.categoryId,'cat:alimentacao');
 assert.equal('confidence' in answer.candidates[0],false);
});
test('CAT02 T21 — model alone must not authorize classification',()=>{
 const labels=[...Array.from({length:6},()=>({approvedByHuman:true,description:'supermercado fruta',
 target:{categoryId:'cat:alimentacao',subcategoryId:null}})),
 ...Array.from({length:6},()=>({approvedByHuman:true,description:'taxi corrida',
 target:{categoryId:'cat:transporte',subcategoryId:null}}))];
 const x=classifyCandidate({transaction:row(),evidence:{},model:teachLocalModel(labels)});
 assert.equal(x.status,'review');assert.equal(x.modelUsed,true);
 assert.equal(x.localInference.status,'ranked_for_review');
});
test('CAT02 T22 — PIX to unidentified individual does not auto-apply despite category clues',()=>{
 const x=classifyCandidate({transaction:row(),evidence:evidence({paymentData:{
 paymentMethod:'PIX'},merchant:null})});
 assert.equal(x.status,'review');assert.equal(x.reason,'PIX_PAYEE_NOT_VERIFIED');
});
