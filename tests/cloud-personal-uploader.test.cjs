'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {CONSENT,uploadPersonalQuarantine,loadMarker}
 =require('../electron/cloud-personal-uploader.cjs');
const {PREVIEW_ORIGIN}=require('../electron/cloud-preview-identity.cjs');

function store(){
 const db=new DatabaseSync(':memory:');
 return {sql:{exec(q,...params){
  if(/^\s*SELECT\b/i.test(q)){
   const rows=db.prepare(q).all(...params);return {toArray:()=>rows,one:()=>rows[0]};
  }
  if(params.length)db.prepare(q).run(...params);else db.exec(q);
  return {toArray:()=>[],one:()=>undefined};
 }},close:()=>db.close(),transactionSync(fn){
  db.exec('BEGIN IMMEDIATE');
  try{const result=fn();db.exec('COMMIT');return result;}
  catch(err){db.exec('ROLLBACK');throw err;}
 }};
}
function response(data,status=200){return new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json'}
});}
async function fixture(){
 return (await import('../mobile-push/src/finance-synthetic-batches.js')).createLargeSyntheticPersonalPackage();
}
test('owner-approved desktop uploads 207 real-shaped fictional records with session cookies, replays safely, and resumes after app restart',async()=>{
 const {beginPersonalTransfer,applyPersonalChunk,verifyPersonalTransfer,cancelPersonalTransfer,personalTransferStatus}
 =await import('../mobile-push/src/finance-personal-batches.js');
 const snap=await fixture(),db=store();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-owner-import-'));
 let attempts=0,failedAck=false;
 try{
  const fakeFetch=async(url,init)=>{
   assert.equal(url.startsWith(PREVIEW_ORIGIN+'/api/migration/personal/'),true);
   assert.equal(init.method,'POST');
   assert.equal(init.redirect,'manual');
   assert.equal(init.credentials,'include');
   assert.equal(init.headers.Origin,PREVIEW_ORIGIN);
   assert.equal(init.headers['X-MF-Migration-Consent'],CONSENT);
   const request=JSON.parse(init.body);
   assert.doesNotMatch(url,/token|secret|Pluggy|clientId/);
   const method=url.split('/').at(-1);
   attempts++;
   let r;
   if(method==='begin'){
    assert.equal(request.consent,CONSENT);
    r=beginPersonalTransfer(db,request);
   }else if(method==='status')r=personalTransferStatus(db,request.importId);
   else if(method==='chunk'){
    r=applyPersonalChunk(db,request);
    if(!failedAck&&request.table==='transactions'&&request.offset===0){
     failedAck=true;
     throw new Error('Connection lost after Durable Object committed');
    }
   }else if(method==='verify')r=await verifyPersonalTransfer(db,request.importId);
   else if(method==='cancel')r=cancelPersonalTransfer(db,request.importId);
   else throw Error('Unexpected method');
   return response(r);
  };
  assert.equal(loadMarker(dir),null);
  const first=await uploadPersonalQuarantine(snap,fakeFetch,dir,{consent:CONSENT});
  assert.equal(first.ok,true);
  assert.equal(first.stage,'quarantine_verified');
  assert.equal(first.recordsVerified,207);
  assert.equal(first.financialSyncEnabled,false);
  assert.equal(first.cloudActivated,false);
  assert.equal(first.alreadyTransferred,false);
  assert.equal(failedAck,true);
  assert.ok(attempts>19);
  const rowCount=db.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_rows').one().n;
  assert.equal(rowCount,207);
  const marker=loadMarker(dir);
  assert.equal(marker.digest,snap.manifest.digest);
  assert.equal(marker.mode,CONSENT);
  assert.doesNotMatch(fs.readFileSync(path.join(dir,'mf-personal-quarantine-progress.json'),'utf8'),
    /fictional|amount_cents|bank_accounts|description|category/);
  const second=await uploadPersonalQuarantine(snap,fakeFetch,dir,{consent:CONSENT});
  assert.equal(second.alreadyTransferred,true);
  assert.equal(second.recordsVerified,207);
  assert.equal(db.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_rows').one().n,207);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('without explicit owner consent the sender refuses any request, even when identity exists',async()=>{
 const snap=await fixture();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-no-consent-'));
 try{
  let contacted=false;
  await assert.rejects(()=>uploadPersonalQuarantine(snap,async()=>{
   contacted=true;throw Error('should not contact cloud');
  },dir,{}),/Autorização explícita/);
  assert.equal(contacted,false);
  assert.equal(fs.readdirSync(dir).length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('preview returns Access denial, never sends personal rows to another origin',async()=>{
 const snap=await fixture();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-deny-'));
 try{
  let requests=0;
  await assert.rejects(()=>uploadPersonalQuarantine(snap,async(url,init)=>{
   requests++;
   assert.ok(url.startsWith(PREVIEW_ORIGIN+'/api/migration/personal/'));
   assert.equal(init.credentials,'include');
   return response({error:'Cloudflare Access required'},403);
  },dir,{consent:CONSENT}),/Sessão protegida/);
  assert.equal(requests,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
