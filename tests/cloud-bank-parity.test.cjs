'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {compareLocalBankWithPreview}=require('../electron/cloud-bank-parity.cjs');
const {PREVIEW_ORIGIN}=require('../electron/cloud-preview-identity.cjs');
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
const rows=[
 {account_id:'checking-01',external_id:'txn-01',date:'2026-11-07',description:'Fictícia',amount_cents:-2000,status:'POSTED'},
 {account_id:'checking-01',external_id:'txn-02',date:'2026-11-06',description:'Fictícia 2',amount_cents:3000,status:'POSTED'}
];
function local(){return {db:{prepare(sql){
  assert.match(sql,/SELECT account_id,external_id,date,description,amount_cents,status/);
  return {all:()=>rows};
}}};}
test('Windows comparison does not transmit local rows and uses exact Preview endpoint',async()=>{
 const {bankParityManifest}=await import('../shared/bank-parity.mjs');
 const cloud=await bankParityManifest([...rows].reverse(),sha);
 let called=0;
 const fetcher=async(url,options)=>{
   called++;
   assert.equal(url,PREVIEW_ORIGIN+'/api/bank/parity');
   assert.equal(options.method,'GET');
   assert.equal(options.body,undefined);
   assert.equal(options.redirect,'manual');
   return new Response(JSON.stringify(cloud),{
     status:200,headers:{'Content-Type':'application/json'}
   });
 };
 const compare=await compareLocalBankWithPreview(local(),fetcher);
 assert.equal(called,1);
 assert.equal(compare.matched,true);
 assert.equal(compare.localCount,2);
 assert.equal(compare.cloudCutoverAllowed,false);
 assert.equal(compare.financialSyncEnabled,false);
});
test('Windows rejects missing or mismatched server fingerprints',async()=>{
 const {bankParityManifest}=await import('../shared/bank-parity.mjs');
 const changed=await bankParityManifest([{...rows[0],amount_cents:-2100},rows[1]],sha);
 const out=await compareLocalBankWithPreview(local(),async()=>new Response(JSON.stringify(changed),{
  status:200,headers:{'Content-Type':'application/json'}
 }));
 assert.equal(out.matched,false);
 assert.equal(out.sameCount,true);
 assert.equal(out.exactIdentities,true);
 assert.equal(out.exactDatesAndCents,false);
 const invalid=await compareLocalBankWithPreview(local(),async()=>new Response('<html>Access denied</html>',{
  status:200,headers:{'Content-Type':'text/html'}
 }));
 assert.equal(invalid.ok,false);
 assert.equal(invalid.reason,'preview_not_authorized_or_unavailable');
});
