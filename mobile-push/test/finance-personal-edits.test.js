import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createSyntheticPersonalPackage} from '../src/finance-synthetic-quarantine.js';
import {beginPersonalTransfer,applyPersonalChunk,verifyPersonalTransfer} from '../src/finance-personal-batches.js';
import {applyPersonalEdit,personalEditChanges,mergePersonalOverlays} from '../src/finance-personal-edits.js';
import {readVerifiedPersonalOverview} from '../src/finance-personal-overview.js';
import worker from '../src/worker.js';

const ID='3a31565e-df1b-4d91-a5da-e331e116306f';
function memory(){
 const db=new DatabaseSync(':memory:');
 return {sql:{exec(q,...args){
  if(/^\s*SELECT\b/i.test(q)){
    const rows=db.prepare(q).all(...args);
    return {toArray:()=>rows,one:()=>rows[0]};
  }
  if(args.length)db.prepare(q).run(...args);else db.exec(q);
  return {toArray:()=>[],one:()=>undefined};
 }},transactionSync(fn){
  db.exec('BEGIN IMMEDIATE');
  try{const result=fn();db.exec('COMMIT');return result;}
  catch(e){db.exec('ROLLBACK');throw e;}
 },close:()=>db.close()};
}
async function imported(storage){
 const pkg=await createSyntheticPersonalPackage();
 beginPersonalTransfer(storage,{importId:ID,manifest:{
  ...pkg.manifest,format:pkg.format,schemaVersion:pkg.schemaVersion
 }});
 for(const [table,block] of Object.entries(pkg.tables)){
  if(block.rows.length)applyPersonalChunk(storage,{
   importId:ID,table,offset:0,rows:block.rows
  });
 }
 await verifyPersonalTransfer(storage,ID);
 return pkg;
}
test('verified personal data receives idempotent versioned overlays without changing immutable import rows',async()=>{
 const s=memory();
 try{
  const pkg=await imported(s);
  const original=s.sql.exec("SELECT row_json FROM mf_transfer_rows WHERE table_name='planned_items'").one().row_json;
  const change={mutationId:'valid_migration_edit_0001',table:'planned_items',
    identity:{id:'fictional-plan'},baseRevision:0,
    patch:{title:'Aluguel revisado',notes:'Pagamento planejado'}};
  const applied=applyPersonalEdit(s,change);
  assert.equal(applied.ok,true);assert.equal(applied.revision,1);assert.equal(applied.financialSyncEnabled,false);
  assert.equal(applyPersonalEdit(s,change).replayed,true);
  assert.equal(s.sql.exec("SELECT row_json FROM mf_transfer_rows WHERE table_name='planned_items'").one().row_json,original);
  assert.equal(readVerifiedPersonalOverview(s).plans[0].title,'Aluguel revisado');
  const changed=personalEditChanges(s,{since:0});
  assert.equal(changed.changes.length,1);
  assert.equal(changed.changes[0].revision,1);
  assert.equal(changed.changes[0].identity.id,'fictional-plan');
  assert.equal(changed.financialSyncEnabled,false);
  assert.equal(personalEditChanges(s,{since:changed.cursor}).changes.length,0);
  const conflict=applyPersonalEdit(s,{...change,mutationId:'different_device_edit_02',
    patch:{title:'Conflito'},baseRevision:0});
  assert.equal(conflict.ok,false);assert.equal(conflict.conflict,true);assert.equal(conflict.currentRevision,1);
  assert.throws(()=>applyPersonalEdit(s,{...change,patch:{title:'Reuso'}}),/reutilizado/);
  const next=applyPersonalEdit(s,{...change,mutationId:'valid_migration_edit_0002',
    patch:{notes:'Anotação atualizada'},baseRevision:1});
  assert.equal(next.revision,2);
  const merged=mergePersonalOverlays(s,'planned_items',pkg.tables.planned_items.rows);
  assert.equal(merged[0].title,'Aluguel revisado');
  assert.equal(merged[0].notes,'Anotação atualizada');
  assert.equal(merged[0].status,'settled','existing payment status must not be changed');
  assert.equal(merged[0].amount_cents,2500);
 }finally{s.close();}
});
test('financially dangerous edits are refused while budget and category safe fields sync',async()=>{
 const s=memory();
 try{
  await imported(s);
  const b=applyPersonalEdit(s,{mutationId:'budget_change_test_0001',table:'budgets',
    identity:{profile:'real',category:'Moradia'},baseRevision:0,patch:{amount_cents:85000}});
  assert.equal(b.ok,true);
  assert.equal(readVerifiedPersonalOverview(s).budgets[0].amountCents,85000);
  assert.throws(()=>applyPersonalEdit(s,{mutationId:'settlement_attempt_01',table:'planned_items',
    identity:{id:'fictional-plan'},baseRevision:0,patch:{status:'settled'}}),/campos não permitidos/);
  assert.throws(()=>applyPersonalEdit(s,{mutationId:'money_modification_01',table:'planned_items',
    identity:{id:'fictional-plan'},baseRevision:0,patch:{amount_cents:1}}),/campos não permitidos/);
  assert.throws(()=>applyPersonalEdit(s,{mutationId:'deleted_original_tx_01',table:'bank_transactions',
    identity:{account_id:'fake',external_id:'abc'},baseRevision:0,patch:{description:'changed'}}),/não autorizado/);
  assert.throws(()=>applyPersonalEdit(s,{mutationId:'invalid_category_0001',table:'planned_items',
    identity:{id:'fictional-plan'},baseRevision:0,patch:{category:'Unregistered Category'}}),/não cadastrada/);
  const c=applyPersonalEdit(s,{mutationId:'color_change_test_00001',table:'categories',
    identity:{name:'Moradia'},baseRevision:0,patch:{color:'#ffffff'}});
  assert.equal(c.ok,true);
  assert.equal(readVerifiedPersonalOverview(s).categories[0].color,'#ffffff');
 }finally{s.close();}
});
test('edits cannot run before the personal migration is verified',async()=>{
 const s=memory();
 try{
  assert.throws(()=>applyPersonalEdit(s,{mutationId:'valid_migration_edit_0001',
    table:'planned_items',identity:{id:'fictional-plan'},baseRevision:0,
    patch:{title:'New'}}),/não verificada/);
  assert.throws(()=>personalEditChanges(s),/não verificada/);
 }finally{s.close();}
});
test('personal edit HTTP endpoints remain closed without pilot and signed owner identity',async()=>{
 const origin='https://example.test';
 const env={APP_ACCESS_TOKEN:'private-safe-test-passcode-123456789',ASSETS:{fetch:()=>new Response('ok')}};
 const req=new Request(origin+'/api/personal/apply',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-MF-Personal-Edit':'optimistic-v1'},
  body:JSON.stringify({mutationId:'valid_migration_edit_0001'})
 });
 assert.equal((await worker.fetch(req,env)).status,401);
 const login=await worker.fetch(new Request(origin+'/api/login',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({code:env.APP_ACCESS_TOKEN})
 }),env);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const second=new Request(origin+'/api/personal/apply',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,
    'X-MF-Personal-Edit':'optimistic-v1'},
  body:'{}'
 });
 assert.equal((await worker.fetch(second,env)).status,403);
 const incoming=new Request(origin+'/api/personal/changes',{
  headers:{Cookie:cookie}
 });
 assert.equal((await worker.fetch(incoming,{...env,PERSONAL_QUARANTINE_ENABLED:'true',
  TEAM_DOMAIN:'https://fake.cloudflareaccess.com',POLICY_AUD:'a'.repeat(64),
  ACCESS_ALLOWED_EMAIL:'owner@example.test'})).status,403);
});
