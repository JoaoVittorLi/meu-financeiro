'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {syncPersonalSafeFields}=require('../electron/cloud-personal-safe-sync.cjs');
const {PREVIEW_ORIGIN}=require('../electron/cloud-preview-identity.cjs');
const ID='38170573-5c02-4f92-b7cf-07aca9b463aa';

function memory(){
 const db=new DatabaseSync(':memory:');
 return {sql:{exec(q,...args){
  if(/^\s*SELECT\b/i.test(q)){
   const rows=db.prepare(q).all(...args);return {toArray:()=>rows,one:()=>rows[0]};
  }
  if(args.length)db.prepare(q).run(...args);else db.exec(q);
  return {toArray:()=>[],one:()=>undefined};
 }},transactionSync(fn){
  db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}
  catch(e){db.exec('ROLLBACK');throw e;}
 },close:()=>db.close()};
}
async function createFixture(){
 const {createSyntheticPersonalPackage}=await import('../mobile-push/src/finance-synthetic-quarantine.js');
 const {beginPersonalTransfer,applyPersonalChunk,verifyPersonalTransfer}=await import('../mobile-push/src/finance-personal-batches.js');
 const edits=await import('../mobile-push/src/finance-personal-edits.js');
 const server=memory(),pkg=await createSyntheticPersonalPackage();
 beginPersonalTransfer(server,{importId:ID,manifest:{
  ...pkg.manifest,format:pkg.format,schemaVersion:pkg.schemaVersion
 }});
 for(const [table,block] of Object.entries(pkg.tables)){
  if(block.rows.length)applyPersonalChunk(server,{importId:ID,table,offset:0,rows:block.rows});
 }
 await verifyPersonalTransfer(server,ID);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-window-sync-'));
 const finance=new FinanceDB(path.join(dir,'real.sqlite'));
 new PlanningStore(finance);
 finance.db.prepare("INSERT INTO profiles(profile,initialized_at) VALUES('real','2026-11-07')").run();
 finance.db.prepare("INSERT INTO budgets(profile,category,amount_cents) VALUES('real','Moradia',80000)").run();
 finance.db.prepare("INSERT INTO planned_items(id,group_id,group_type,occurrence,total_occurrences,title,kind,amount_cents,due_date,category,account_id,notes,certainty,status,created_at,updated_at,settled_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
  .run('fictional-plan',null,'single',1,1,'Aluguel fictício','expense',2500,'2026-11-07',
   'Moradia',null,'Plano fictício','confirmed','settled','2026-11-07','2026-11-07','2026-11-07');
 const response=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
 const fakeFetch=async(url,opts)=>{
  assert.equal(url.startsWith(PREVIEW_ORIGIN+'/api/personal/'),true);
  assert.equal(opts.credentials,'include');
  assert.equal(opts.redirect,'manual');
  const u=new URL(url);
  if(u.pathname==='/api/personal/baseline'){
   return response(edits.personalEditBaseline(server));
  }
  if(u.pathname==='/api/personal/changes'){
   return response(edits.personalEditChanges(server,{
    since:Number(u.searchParams.get('since')||0),
    limit:Number(u.searchParams.get('limit')||100)
   }));
  }
  if(u.pathname==='/api/personal/apply'){
   assert.equal(opts.method,'POST');
   assert.equal(opts.headers.Origin,PREVIEW_ORIGIN);
   assert.equal(opts.headers['X-MF-Personal-Edit'],'optimistic-v1');
   const result=edits.applyPersonalEdit(server,JSON.parse(opts.body));
   return response(result,result.ok?200:409);
  }
  throw new Error('Unknown endpoint');
 };
 return {server,finance,dir,fakeFetch,edits,cleanup(){
  finance.close();server.close();fs.rmSync(dir,{recursive:true,force:true});
 }};
}

test('primeiro espelhamento não publica diferenças locais anteriores nem repete envio no retry',async()=>{
  const fx=await createFixture();
  try{
    const {server,finance,fakeFetch,edits}=fx;
    const initial=edits.personalEditChanges(server,{since:0});
    assert.equal(initial.changes.length,0,'No remote edits before initial sync');
    const first=await syncPersonalSafeFields(finance,fakeFetch);
    assert.equal(first.outboundConfirmed,0,'Baseline mismatch must not become an unsolicited write');
    assert.equal(edits.personalEditChanges(server,{since:0}).changes.length,0);
    const retry=await syncPersonalSafeFields(finance,fakeFetch);
    assert.equal(retry.outboundConfirmed,0,'Repeated sync must be idempotent without new local edits');
    assert.equal(edits.personalEditChanges(server,{since:0}).changes.length,0);
    assert.deepEqual(finance.integrity(),['ok']);
  }finally{fx.cleanup();}
});

test('cloud edits flow to Windows; local safe edits sync back without changing money or settlement',async()=>{
 const fx=await createFixture();
 try{
  const {server,finance,fakeFetch,edits}=fx;
  const incoming=edits.applyPersonalEdit(server,{
   mutationId:'android_edit_title_0001',table:'planned_items',
   identity:{id:'fictional-plan'},baseRevision:0,
   patch:{title:'Aluguel no celular'}
  });
  assert.equal(incoming.revision,1);
  const first=await syncPersonalSafeFields(finance,fakeFetch);
  assert.equal(first.inboundApplied,1);
  assert.equal(finance.db.prepare("SELECT title FROM planned_items WHERE id='fictional-plan'").get().title,'Aluguel no celular');
  finance.db.prepare("UPDATE planned_items SET notes='Observação alterada no Windows' WHERE id='fictional-plan'").run();
  const second=await syncPersonalSafeFields(finance,fakeFetch);
  assert.equal(second.outboundConfirmed,1);
  const remote=edits.personalEditChanges(server,{since:0});
  assert.equal(remote.changes.length,2);
  assert.equal(remote.changes.at(-1).patch.notes,'Observação alterada no Windows');
  const local=finance.db.prepare("SELECT amount_cents,status FROM planned_items WHERE id='fictional-plan'").get();
  assert.equal(local.amount_cents,2500);
  assert.equal(local.status,'settled');
  assert.equal(second.financialSyncEnabled,false);
  assert.equal(second.bankDataSynchronized,false);
  assert.equal(second.conflictsDetected,0);
 }finally{fx.cleanup();}
});

test('concurrent local and mobile edits are preserved with conflict, not silently overwritten',async()=>{
 const fx=await createFixture();
 try{
  const {server,finance,fakeFetch,edits}=fx;
  await syncPersonalSafeFields(finance,fakeFetch);
  finance.db.prepare("UPDATE planned_items SET title='Windows mudou' WHERE id='fictional-plan'").run();
  edits.applyPersonalEdit(server,{
   mutationId:'android_edit_title_0002',table:'planned_items',
   identity:{id:'fictional-plan'},baseRevision:0,
   patch:{title:'Celular mudou'}
  });
  const result=await syncPersonalSafeFields(finance,fakeFetch);
  assert.ok(result.conflicts>0);
  assert.equal(finance.db.prepare("SELECT title FROM planned_items WHERE id='fictional-plan'").get().title,'Windows mudou');
  const latest=edits.personalEditChanges(server,{since:0});
  assert.equal(latest.changes.length,1);
  assert.equal(latest.changes[0].patch.title,'Celular mudou');
  const conflict=finance.db.prepare("SELECT reason FROM mf_personal_client_conflicts WHERE table_name='planned_items'").get();
  assert.equal(conflict.reason,'CONCURRENT_LOCAL_EDIT');
 }finally{fx.cleanup();}
});

test('initial baseline prevents preexisting local edits from being overwritten by the server',async()=>{
 const fx=await createFixture();
 try{
  const {server,finance,fakeFetch,edits}=fx;
  finance.db.prepare("UPDATE planned_items SET title='Windows antes de conectar' WHERE id='fictional-plan'").run();
  edits.applyPersonalEdit(server,{
   mutationId:'android_edit_title_0003',table:'planned_items',
   identity:{id:'fictional-plan'},baseRevision:0,
   patch:{title:'Celular já mudou'}
  });
  const result=await syncPersonalSafeFields(finance,fakeFetch);
  assert.ok(result.conflicts>0);
  assert.equal(finance.db.prepare("SELECT title FROM planned_items WHERE id='fictional-plan'").get().title,'Windows antes de conectar');
 }finally{fx.cleanup();}
});

test('authentication failures never erase or overwrite local SQLite finance',async()=>{
 const fx=await createFixture();
 try{
  const {finance}=fx;
  const before=finance.db.prepare("SELECT title FROM planned_items WHERE id='fictional-plan'").get().title;
  await assert.rejects(()=>syncPersonalSafeFields(finance,async()=>new Response('{}',{status:403})),/Sessão/);
  assert.equal(finance.db.prepare("SELECT title FROM planned_items WHERE id='fictional-plan'").get().title,before);
 }finally{fx.cleanup();}
});
