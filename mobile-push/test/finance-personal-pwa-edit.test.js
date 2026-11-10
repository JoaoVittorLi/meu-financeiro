import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createSyntheticPersonalPackage} from '../src/finance-synthetic-quarantine.js';
import {beginPersonalTransfer,applyPersonalChunk,verifyPersonalTransfer}
  from '../src/finance-personal-batches.js';
import {readVerifiedPersonalOverview} from '../src/finance-personal-overview.js';
import {applyPersonalEdit} from '../src/finance-personal-edits.js';

function memory(){
 const db=new DatabaseSync(':memory:');
 return {db,store:{
  sql:{exec(query,...args){
   if(/^\s*SELECT\b/i.test(query)){
    const rows=db.prepare(query).all(...args);
    return {toArray:()=>rows,one:()=>rows[0]};
   }
   if(args.length)db.prepare(query).run(...args);else db.exec(query);
   return {toArray:()=>[],one:()=>undefined};
  }},
  transactionSync(cb){
   db.exec('BEGIN IMMEDIATE');
   try{const result=cb();db.exec('COMMIT');return result;}
   catch(error){db.exec('ROLLBACK');throw error;}
  }
 }};
}
async function importFake(storage){
 const pkg=await createSyntheticPersonalPackage();
 const importId='2f441b6a-42f0-48bb-abd8-3513b6e54e33';
 beginPersonalTransfer(storage,{importId,manifest:{
  ...pkg.manifest,format:pkg.format,schemaVersion:pkg.schemaVersion
 }});
 for(const [table,block] of Object.entries(pkg.tables))
  if(block.rows.length)applyPersonalChunk(storage,{
   importId,table,offset:0,rows:block.rows
  });
 await verifyPersonalTransfer(storage,importId);
 return pkg;
}
test('PWA sees exact planning ID and revision, edits a plan and budget through the Windows shared protocol',async()=>{
 const {db,store}=memory();
 try{
  const pkg=await importFake(store);
  const before=readVerifiedPersonalOverview(store);
  const plan=before.plans.find(p=>p.id==='fictional-plan');
  const budget=before.budgets.find(b=>b.category==='Moradia');
  assert.ok(plan);assert.equal(plan.revision,0);
  assert.ok(budget);assert.equal(budget.revision,0);
  assert.equal(plan.title,'Aluguel fictício');
  const initialPlan=store.sql.exec(
   "SELECT row_json FROM mf_transfer_rows WHERE table_name='planned_items'"
  ).one().row_json;
  const originalBudget=store.sql.exec(
   "SELECT row_json FROM mf_transfer_rows WHERE table_name='budgets' AND row_json LIKE '%Moradia%'"
  ).one().row_json;
  const editPlan=applyPersonalEdit(store,{
   mutationId:'pwa_plan_change_20261107',table:'planned_items',
   identity:{id:plan.id},baseRevision:plan.revision,
   patch:{title:'Aluguel revisado pelo PWA',notes:'Observação revisada'}
  });
  assert.equal(editPlan.ok,true);assert.equal(editPlan.revision,1);
  const replay=applyPersonalEdit(store,{
   mutationId:'pwa_plan_change_20261107',table:'planned_items',
   identity:{id:plan.id},baseRevision:plan.revision,
   patch:{title:'Aluguel revisado pelo PWA',notes:'Observação revisada'}
  });
  assert.equal(replay.replayed,true);
  const editBudget=applyPersonalEdit(store,{
   mutationId:'pwa_budget_change_20261107',table:'budgets',
   identity:{profile:'real',category:'Moradia'},baseRevision:budget.revision,
   patch:{amount_cents:99500}
  });
  assert.equal(editBudget.ok,true);assert.equal(editBudget.revision,1);
  const after=readVerifiedPersonalOverview(store);
  const updatedPlan=after.plans.find(p=>p.id===plan.id);
  assert.equal(updatedPlan.title,'Aluguel revisado pelo PWA');
  assert.equal(updatedPlan.notes,'Observação revisada');
  assert.equal(updatedPlan.revision,1);
  assert.equal(updatedPlan.amountCents,plan.amountCents);
  assert.equal(updatedPlan.status,plan.status);
  assert.equal(after.budgets.find(b=>b.category==='Moradia').amountCents,99500);
  assert.equal(after.budgets.find(b=>b.category==='Moradia').revision,1);
  assert.equal(store.sql.exec("SELECT row_json FROM mf_transfer_rows WHERE table_name='planned_items'").one().row_json,initialPlan);
  assert.equal(store.sql.exec("SELECT row_json FROM mf_transfer_rows WHERE table_name='budgets' AND row_json LIKE '%Moradia%'").one().row_json,originalBudget);
  const stale=applyPersonalEdit(store,{
   mutationId:'pwa_budget_stale_20261107',table:'budgets',
   identity:{profile:'real',category:'Moradia'},baseRevision:0,
   patch:{amount_cents:100000}
  });
  assert.equal(stale.conflict,true);
  assert.equal(after.financialSyncEnabled,false);
  assert.equal(after.bankDataReady,false);
  assert.equal(pkg.tables.planned_items.rows[0].amount_cents,plan.amountCents);
 }finally{db.close();}
});
test('PWA routes personal mutations through Access-protected CAS endpoint, no local financial copy',()=>{
 const html=readFileSync(new URL('../public/finance.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/finance-personal-edit.js',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../public/finance.js',import.meta.url),'utf8');
 for(const id of ['personalEditDialog','personalEditForm','planFilter','planSearch','budgetEditStatus'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/finance-personal-edit\.js/);
 assert.match(app,/\/api\/personal\/apply/);
 assert.match(app,/X-MF-Personal-Edit/);
 assert.match(app,/crypto\.randomUUID/);
 assert.match(app,/response\.status===409/);
 assert.match(app,/mutationId:/);
 assert.match(controller,/finance:personal-snapshot/);
 assert.doesNotMatch(app,/localStorage|sessionStorage|indexedDB|caches\.open|bank\/refresh/);
});
