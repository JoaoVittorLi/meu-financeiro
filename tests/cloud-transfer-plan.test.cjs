'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {buildTransferPlan,publicTransferSummary,testTransferWithFakeAdapter,
  sendPersonalTransferPlan,FINANCIAL_TRANSFER_ACTIVE,MAX_CHUNK_ROWS,MAX_CHUNK_BYTES}
 =require('../electron/cloud-transfer-plan.cjs');

function fakeStore(){
 const db=new DatabaseSync(':memory:');
 return {sql:{exec(query,...args){
   if(/^\s*SELECT\b/i.test(query)){
     const rows=db.prepare(query).all(...args);
     return {toArray:()=>rows,one:()=>rows[0]};
   }
   if(args.length)db.prepare(query).run(...args);else db.exec(query);
   return {toArray:()=>[],one:()=>undefined};
  }},close:()=>db.close(),
  transactionSync(fn){
   db.exec('BEGIN IMMEDIATE');
   try{const r=fn();db.exec('COMMIT');return r;}
   catch(e){db.exec('ROLLBACK');throw e;}
  }};
}

test('desktop creates 207-row migration plan and sends to fake Cloudflare batch adapter with 80-row retry',async()=>{
 const {createLargeSyntheticPersonalPackage}=await import('../mobile-push/src/finance-synthetic-batches.js');
 const {beginPersonalTransfer,applyPersonalChunk,verifyPersonalTransfer,cancelPersonalTransfer}
  =await import('../mobile-push/src/finance-personal-batches.js');
 const pkg=await createLargeSyntheticPersonalPackage();
 const id='7532671a-5441-4f92-ad16-684aff5849e2';
 const plan=buildTransferPlan(pkg,{importId:id});
 assert.equal(plan.summary.tableCount,17);
 assert.equal(plan.summary.rowCount,207);
 assert.equal(plan.summary.chunkCount,19);
 assert.ok(plan.chunks.every(x=>x.count<=MAX_CHUNK_ROWS&&x.bytes<=MAX_CHUNK_BYTES));
 assert.ok(plan.chunks.find(x=>x.table==='transactions'&&x.count===80));
 const summary=publicTransferSummary(plan);
 assert.deepEqual(summary,{personalTables:17,personalRecords:207,chunks:19,
  realRecordsUploaded:0,financialSyncEnabled:false});
 assert.doesNotMatch(JSON.stringify(summary),/fictional|manual|account_id|digest|amount_cents/i);
 const storage=fakeStore();
 let failedAck=false,retries=0;
 try{
  const adapter={
   begin:args=>beginPersonalTransfer(storage,args),
   chunk:args=>{
    const receipt=applyPersonalChunk(storage,args);
    if(!failedAck&&args.table==='transactions'&&args.offset===0){
     failedAck=true;retries++;
     throw new Error('Simulated network interruption after server committed');
    }
    return receipt;
   },
   verify:importId=>verifyPersonalTransfer(storage,importId)
  };
  const result=await testTransferWithFakeAdapter(plan,adapter);
  assert.equal(result.ok,true);
  assert.equal(result.recordsVerified,207);
  assert.equal(result.cloudActivated,false);
  assert.equal(result.financialSyncEnabled,false);
  assert.equal(retries,1);
  assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_rows').one().n,207);
  assert.equal(storage.sql.exec('SELECT state FROM mf_transfer_session').one().state,'verified');
  cancelPersonalTransfer(storage,id);
  assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_rows').one().n,0);
 }finally{storage.close();}
});

test('the Windows real-data sender is blocked unconditionally, regardless of any environment variable',async()=>{
 assert.equal(FINANCIAL_TRANSFER_ACTIVE,false);
 const original=process.env.FINANCE_SYNC_ENABLED;
 try{
  process.env.FINANCE_SYNC_ENABLED='true';
  await assert.rejects(sendPersonalTransferPlan(),/bloqueada/);
 }finally{
  if(original===undefined)delete process.env.FINANCE_SYNC_ENABLED;
  else process.env.FINANCE_SYNC_ENABLED=original;
 }
});

test('transport refuses extra large records and will not leak rows through summaries',async()=>{
 const {createSyntheticPersonalPackage}=await import('../mobile-push/src/finance-synthetic-quarantine.js');
 const p=await createSyntheticPersonalPackage();
 const id='7532671a-5441-4f92-ad16-684aff5849e2';
 const forged={...p,tables:{...p.tables,transactions:{
   ...p.tables.transactions,rows:[{
     ...p.tables.transactions.rows[0],description:'A'.repeat(MAX_CHUNK_BYTES+1)
   }]
 }}};
 assert.throws(()=>buildTransferPlan(forged,{importId:id}),/grande demais/);
 assert.throws(()=>buildTransferPlan(p,{importId:'wrong'}),/identificador/);
 assert.throws(()=>buildTransferPlan({...p,manifest:{...p.manifest,cutoverReady:true}},{importId:id}),/não autorizado/);
 const plan=buildTransferPlan(p,{importId:id});
 assert.equal(plan.summary.rowCount,17);
 assert.equal(plan.summary.realRecordsUploaded,0);
 assert.ok(plan.chunks.every(c=>c.bytes<=MAX_CHUNK_BYTES));
});

test('fake adapter rejects server claiming cloud activation or returning an unverified receipt',async()=>{
 const {createSyntheticPersonalPackage}=await import('../mobile-push/src/finance-synthetic-quarantine.js');
 const p=await createSyntheticPersonalPackage();
 const plan=buildTransferPlan(p,{importId:'7532671a-5441-4f92-ad16-684aff5849e2'});
 let chunks=0;
 const bad={
  begin:()=>({ok:true,financialSyncEnabled:false}),
  chunk:()=>{chunks++;return {ok:true,inserted:1,replayed:0,financialSyncEnabled:true}},
  verify:()=>({ok:true,personalTables:17,personalRecords:17,financialSyncEnabled:false,cutoverAllowed:false,realDataPublished:false})
 };
 await assert.rejects(()=>testTransferWithFakeAdapter(plan,bad),/lote não foi confirmado/);
 assert.equal(chunks,1);
 const notValidated={
  begin:()=>({ok:true,financialSyncEnabled:false}),
  chunk:({rows})=>({ok:true,inserted:rows.length,replayed:0,financialSyncEnabled:false}),
  verify:()=>({ok:true,personalTables:17,personalRecords:17,financialSyncEnabled:false,cutoverAllowed:true,realDataPublished:false})
 };
 await assert.rejects(()=>testTransferWithFakeAdapter(plan,notValidated),/nuvem não confirmou/);
});
