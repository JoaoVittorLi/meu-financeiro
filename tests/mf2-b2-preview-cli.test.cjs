'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>{
  const text=execFileSync(process.execPath,[path.join(root,'scripts',name)],{
    cwd:root,encoding:'utf8',timeout:5000,maxBuffer:1024*1024});
  assert.doesNotMatch(text,/SYNTH-B2-ACCOUNT|SYNTH-TX001|SYNTHETIC:|authorization|cf-access-jwt-assertion/i);
  return JSON.parse(text);
};
test('B2-B1.0 isolated Preview-ready CLI executes and has no financial writes',()=>{
 const a=read('mf2-b2-preview-offline-demo.mjs');
 assert.equal(a.mode,'offline_synthetic_preview_adapter');
 assert.equal(a.diagnostic.windowsBank,1);
 assert.equal(a.diagnostic.cloudBank,2);
 assert.equal(a.diagnostic.pendingCloud,1);
 assert.equal(a.financialSyncEnabled,false);
 assert.equal(a.databaseChanged,false);
 assert.equal(a.readOnly,true);
});
test('B2-B0 HTTP CLI executes real B1 reconciliation engine with invented fixtures',()=>{
 const a=read('mf2-b2-http-demo.cjs');
 assert.equal(a.demo,'synthetic_http_loopback');
 assert.equal(a.sources.windows.bank,1);
 assert.equal(a.sources.cloud.bank,2);
 assert.equal(a.summary.bankCountDelta,1);
 assert.equal(a.financialSyncEnabled,false);
 assert.equal(a.databaseChanged,false);
});
