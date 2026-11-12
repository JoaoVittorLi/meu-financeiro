'use strict';
// Contract test through the real isolated Electron preload/main/SQLite stack.
// No DOM interaction, viewport emulation, screenshots, network or personal data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchQ1}=require('./q1-native-session.cjs'),{evaluate}=require('./d1-electron-smoke.cjs');
const {FinanceDB}=require('../electron/db.cjs'),{ACCOUNT,OTHER,ITEM}=require('./q1-fixture.cjs');
async function run(){
 const r=await launchQ1();let db;
 try{
  db=new FinanceDB(path.join(r.metadata.profile,'meu-financeiro.sqlite'));
  const call=(method,input)=>evaluate(r.cdp,'return await window.financeDesktop['+JSON.stringify(method)+']('+JSON.stringify(input)+')');
  assert.equal((await call('categoryReviewStatus')).available,true);
  const g=await call('categoryReviewAuthorize',{consent:'SYNTHETIC_CATEGORY_REVIEW_V1'}),token=g.token;
  const prepare=(action,payload)=>call('categoryReviewPrepare',{token,action,payload});
  const confirm=p=>call('categoryReviewConfirm',{token,id:p.id,digest:p.digest,consent:'CONFIRM_CATEGORY_PREVIEW_V1'});
  const list=()=>call('categoryReviewList',{token});
  const report=await list();assert.deepEqual(report.suggestions.map(s=>s.confidence).sort(),['high','high','low','medium']);
  const cafe=report.suggestions.find(s=>s.pattern==='CAFETERIA FLORESTA');
  const approved=await confirm(await prepare('rule',{suggestionId:cafe.id,category:'Alimentação'}));assert.equal(approved.backup.verified,true);assert.equal(approved.historicalChanges,0);
  const row=id=>db.bankOverview().transactions.find(t=>t.id===id);
  assert.equal(row('cafe-4').category,'Outros');
  const tx=(id,amount=-10)=>({id,date:'2026-11-12',description:'CAFETERIA FLORESTA',amount,status:'POSTED',category:'Outros'});
  const ingest=(rows,account=ACCOUNT)=>db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:account,name:account===ACCOUNT?'Conta de teste · dados fictícios':'Segunda conta · dados fictícios',balance:null},transactions:rows}]});
  ingest([tx('q1-future'),tx('q1-income',10)]);ingest([tx('q1-future')]);ingest([tx('q1-other')],OTHER);
  assert.equal(row('q1-future').category,'Alimentação');assert.equal(row('q1-income').category,'Outros');assert.equal(row('q1-other').category,'Outros');
  assert.equal(db.db.prepare("SELECT COUNT(*) n FROM bank_transactions WHERE external_id='q1-future'").get().n,1);
  db.overrideBankCategory({accountId:ACCOUNT,externalId:'q1-future',category:'Transporte'});ingest([tx('q1-future')]);assert.equal(row('q1-future').category,'Transporte');
  await confirm(await prepare('manage-rule',{ruleId:approved.ruleId,change:'pause'}));ingest([tx('q1-paused')]);assert.equal(row('q1-paused').category,'Outros');
  await confirm(await prepare('manage-rule',{ruleId:approved.ruleId,change:'resume'}));assert.equal(row('q1-paused').category,'Alimentação');
  const queue=await call('categoryReviewQueue',{token,limit:50}),items=queue.rows.filter(r=>['cafe-4','cafe-5'].includes(r.externalId));assert.equal(items.length,2);
  const p=await prepare('classify',{items,category:'Alimentação'}),receipts=await Promise.all([confirm(p),confirm(p)]);assert.equal(receipts[0].id,receipts[1].id);assert.equal((await confirm(p)).replayed,true);
  assert.equal(row('cafe-4').category,'Alimentação');
  await confirm(await prepare('undo',{commandId:p.id}));assert.equal(row('cafe-4').category,'Outros');
  const fresh=(await call('categoryReviewQueue',{token})).rows.find(r=>r.externalId==='cafe-4');
  const stale=await prepare('classify',{items:[fresh],category:'Alimentação'});db.overrideBankCategory({accountId:ACCOUNT,externalId:'cafe-4',category:'Transporte'});
  await assert.rejects(confirm(stale),/desatualizada/);assert.equal(row('cafe-4').category,'Transporte');
  assert.deepEqual(db.integrity(),['ok']);
  assert.equal(db.db.prepare('SELECT COUNT(*) n FROM category_review_commands WHERE id=?').get(p.id).n,1);
  await call('categoryReviewRevoke',{token});await assert.rejects(list(),/Autorização/);
  const output={ok:true,...r.metadata,checks:['real preload/main IPC','verified backup before confirmation','future-only history preservation','account/nature boundaries','idempotent reimport','manual correction precedence','pause/resume','batch classify/undo','duplicate confirmation','stale preview rejection','grant revoke','SQLite integrity'],backups:fs.readdirSync(path.join(r.metadata.profile,'review-backups')).filter(n=>n.endsWith('.sqlite')).length};
  console.log(JSON.stringify(output,null,2));if(process.env.MF_Q1_IPC_REPORT)fs.writeFileSync(process.env.MF_Q1_IPC_REPORT,JSON.stringify(output,null,2));
 }finally{db?.close();r.cdp.socket.close();r.child.kill();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
