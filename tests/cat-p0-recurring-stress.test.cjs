'use strict';
// A01 P0 recurring automation regressions with synthetic bank data only.
// No Pluggy credentials, Electron userData, remote API or personal profiles.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {D05AutoCategorization}=require('../electron/d05-auto-categorization.cjs');
const {D05AutoLocalScheduler}=require('../electron/d05-auto-local-scheduler.cjs');
const IDS=[
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
];
const ITEMS=[
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'ffffffff-ffff-4fff-8fff-ffffffffffff'
];
const account=(i)=>({id:IDS[i],name:'CONTA ARTIFICIAL '+(i+1),
 type:'CHECKING',currencyCode:'BRL',balance:0});
const transaction=(i,label='recurring')=>({
 id:label+'-'+String(i).padStart(6,'0'),
 date:'2026-11-'+String(1+i%28).padStart(2,'0'),
 description:'MERCADO TOTALMENTE FICTICIO '+String(i),
 amount:-(50+i/100),status:'POSTED',category:'Groceries',
 creditCardMetadata:{payeeMCC:'5411'}
});
async function harness(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-a01-synthetic-'));
 const db=new FinanceDB(path.join(dir,'finance.sqlite'));
 try{
  for(let i=0;i<3;i++)
   db.ingestBank(ITEMS[i],{item:{status:'UPDATED'},data:[
    {account:account(i),transactions:[]}]});
  const engine=new D05AutoCategorization({finance:()=>db,
   backupDirectory:()=>path.join(dir,'backups')});
  engine.configure({accountIds:IDS,startDate:'2026-01-01',endDate:'2026-12-31',
   historyEnabled:true,newEnabled:true},true);
  await engine.confirmInitialPreview(engine.plan({limit:1}).previewVersion);
  const clock=()=>new Date('2026-11-17T16:00:00.000Z');
  const scheduler=new D05AutoLocalScheduler({finance:()=>db,engine:()=>engine,clock});
  const ingest=(start,count,label='recurring')=>{
   const buckets=[[],[],[]];
   for(let j=0;j<count;j++){
    const i=start+j;
    buckets[i%3].push(transaction(i,label));
   }
   for(let a=0;a<3;a++)if(buckets[a].length)
    db.ingestBank(ITEMS[a],{item:{status:'UPDATED'},
     data:[{account:account(a),transactions:buckets[a]}]});
  };
  return await fn({dir,db,engine,scheduler,ingest});
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
}
const count=(db,sql,...args)=>db.db.prepare(sql).get(...args).n;

test('A01 >20000 across 3 accounts: full daily COMMIT, receipt equality, sync + idempotence and bounded heap',()=>{
 return harness(async({db,engine,scheduler,ingest})=>{
  const beforeHeap=process.memoryUsage().heapUsed;
  ingest(0,20001);
  const planned=engine.plan({futureOnly:true,limit:1});
  assert.equal(planned.candidateCount,20001);
  assert.equal(planned.candidates.length,1,
   'Plan must retain at most a page of proposal objects');
  let maxHeap=beforeHeap,commits=0;
  const original=engine.nextBatch.bind(engine);
  engine.nextBatch=async(...args)=>{
   const result=await original(...args);
   commits++;maxHeap=Math.max(maxHeap,process.memoryUsage().heapUsed);
   return result;
  };
  const started=process.hrtime.bigint();
  const daily=await scheduler.run('daily');
  const elapsedMs=Number((process.hrtime.bigint()-started)/1000000n);
  assert.equal(daily.state,'completed');
  assert.equal(daily.applied,20001);
  assert.equal(daily.proposedTotal,20001);
  assert.equal(daily.remaining,0);
  assert(commits>=81,'A single 20000-limited apply must fail this regression');
  assert.equal(engine.plan({futureOnly:true,limit:1}).candidateCount,0);
  assert.equal(count(db,'SELECT COUNT(*) AS n FROM mf_auto_labels'),20001);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE action='apply'"),20001);
  assert.equal(count(db,"SELECT COUNT(DISTINCT account_id) AS n FROM mf_auto_labels"),3);
  assert.deepEqual(IDS.map(id=>count(db,
   'SELECT COUNT(*) AS n FROM mf_auto_labels WHERE account_id=?',id)),[6667,6667,6667]);
  assert.equal((await scheduler.run('daily')).state,'already_completed');
  const preSync=count(db,"SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE action='apply'");
  ingest(20001,301,'after-sync');
  const sync=await scheduler.run('sync',{syncId:101});
  assert.equal(sync.state,'completed');
  assert.equal(sync.applied,301);
  assert.equal(sync.remaining,0);
  assert.equal((await scheduler.run('sync',{syncId:101})).state,'already_completed');
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE action='apply'"),preSync+301);
  assert.equal(engine.plan({futureOnly:true,limit:1}).candidateCount,0);
  const growthMb=Math.max(0,maxHeap-beforeHeap)/1048576;
  // High but finite upper limit; threshold is not a speed/quality approval.
  assert(growthMb<768,'Unbounded proposal accumulation exceeded synthetic heap budget');
  assert(elapsedMs<20*60*1000,'20k synthetic recurring job exceeded 20-minute safety ceiling');
  process.stdout.write('A01 PERF SHA='+String(process.env.MF_QA_SHA||'local')+
   ' candidates=20001 pages='+commits+' elapsed_ms='+elapsedMs+
   ' sampled_heap_growth_mb='+growthMb.toFixed(1)+'\n');
 });
});

test('A01 backup failure after first 250 COMMITs: journal resume + exact receipts',()=>harness(async({
 db,engine,scheduler,ingest
})=>{
 ingest(0,551,'backup-resume');
 const originalVerify=engine.verifyBatchBackup.bind(engine);
 let verifies=0;
 engine.verifyBatchBackup=file=>{
  verifies++;
  if(verifies===2)throw Error('SYNTHETIC_BACKUP_UNAVAILABLE_BETWEEN_PAGES');
  return originalVerify(file);
 };
 const failure=await scheduler.run('daily');
 assert.equal(failure.state,'failed');assert.equal(failure.applied,250);
 assert.equal(scheduler.status().paused,true);
 assert.equal(count(db,"SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE action='apply'"),250);
 engine.verifyBatchBackup=originalVerify;
 const reopened=new D05AutoLocalScheduler({finance:()=>db,engine:()=>engine,
  clock:()=>new Date('2026-11-17T16:00:00.000Z')});
 assert.equal(reopened.status().paused,true);
 reopened.resume();
 const recovered=await reopened.run('daily');
 assert.equal(recovered.state,'completed');
 assert.equal(recovered.applied,551);
 assert.equal(recovered.proposedTotal,551);
 assert.equal(count(db,"SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE action='apply'"),551);
 assert.equal(count(db,"SELECT COUNT(*) AS n FROM mf_auto_labels"),551);
 assert.equal((await reopened.run('daily')).state,'already_completed');
}));

test('A01 revocation between pages prevents all remaining writes and blocks reauthorization bypass',()=>harness(async({
 db,engine,scheduler,ingest
})=>{
 ingest(0,501,'revoke');
 const original=engine.nextBatch.bind(engine);let calls=0;
 engine.nextBatch=async(...args)=>{
  const page=await original(...args);calls++;
  if(calls===1)engine.revoke(IDS[0]);
  return page;
 };
 const result=await scheduler.run('daily');
 assert.equal(result.state,'failed');assert.equal(result.reason,'MANIFEST_STALE');
 assert.equal(result.applied,250);
 assert.equal(count(db,"SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE action='apply'"),250);
 assert.equal(scheduler.status().paused,true);
 const job=scheduler.status().jobs[0];
 assert.equal(job.state,'failed');
 assert.equal(job.applied,250);
 // Two other accounts remain authorized, but the old generation cannot
 // silently continue or start a new writer after partial revocation.
 scheduler.resume();
 const retry=await scheduler.run('daily');
 assert.equal(retry.state,'failed');
 assert.equal(count(db,"SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE action='apply'"),250);
}));

test('A01 no-progress guard never marks empty COMMIT loop completed',()=>harness(async({
 db,engine,scheduler,ingest
})=>{
 ingest(0,7,'no-progress');
 const original=engine.nextBatch.bind(engine);let count=0;
 engine.nextBatch=async id=>{
  const before=engine.batchStatus(id);count++;
  if(count===1)return {...before,state:'running',committed:0};
  return original(id,{limit:250});
 };
 const result=await scheduler.run('daily');
 assert.equal(result.state,'failed');
 assert.equal(result.reason,'NO_PROGRESS');
 assert.equal(count,1,'No busy-loop on uncommitted page');
 assert.equal(scheduler.status().jobs[0].state,'failed');
 assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE action='apply'").get().n,0);
}));

test('A01 legacy completed jobs without a batch receipt cannot hide candidates above the old cap',()=>harness(async({
 db,engine,ingest
})=>{
 ingest(0,7,'legacy-pending');
 db.db.prepare(`INSERT INTO mf_auto_jobs(job_key,trigger,state,attempts,started_at,
  finished_at,applied,review_count,error_code)
  VALUES ('daily:2026-11-17','daily','completed',1,?, ?,20000,0,NULL)`)
  .run('2026-11-17T16:00:00.000Z','2026-11-17T16:00:01.000Z');
 const upgraded=new D05AutoLocalScheduler({finance:()=>db,engine:()=>engine,
  clock:()=>new Date('2026-11-17T16:00:00.000Z')});
 assert.equal(upgraded.status().paused,true);
 assert.equal(upgraded.status().jobs[0].state,'failed');
 assert.equal(upgraded.status().jobs[0].errorCode,'LEGACY_COMPLETION_UNVERIFIED');
 upgraded.resume();
 const result=await upgraded.run('daily');
 assert.equal(result.state,'completed');
 assert.equal(result.applied,7,'Never inherit fictitious applied=20000 from legacy state');
 assert.equal(count(db,"SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE action='apply'"),7);
 assert.equal(engine.plan({futureOnly:true,limit:1}).candidateCount,0);
}));
