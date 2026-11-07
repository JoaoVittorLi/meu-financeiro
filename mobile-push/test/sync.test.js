import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMutation,validateBatch,isFinancial,COLLECTIONS,FINANCIAL_SCHEMA_ACTIVE,CloudSyncStore} from '../src/cloud-sync.js';
test('preview permits test data but blocks financial records until explicitly activated',()=>{
 assert.equal(isFinancial('test_notes'),false);
 assert.ok(COLLECTIONS.includes('bank_transactions'));
 assert.equal(validateMutation({collection:'test_notes',id:'one-note',baseRevision:0,deleted:false,value:{text:'hello'}}).id,'one-note');
 assert.throws(()=>validateMutation({collection:'bank_transactions',id:'bank:123',baseRevision:0,deleted:false,value:{amount:123}}),/não foram habilitados/);
});
test('revisions and payloads require validation',()=>{
 const base={collection:'test_notes',id:'test',baseRevision:0,deleted:false,value:{text:'ok'}};
 assert.throws(()=>validateMutation({...base,baseRevision:-1}),/revisão/);
 assert.throws(()=>validateMutation({...base,value:{clientSecret:'secret'}}),/Credenciais/);
 assert.throws(()=>validateMutation({...base,id:'../../private'}),/Identificador/);
 assert.throws(()=>validateMutation({...base,value:{text:'x'.repeat(65000)}}),/grande demais/);
});
test('batches reject conflicting identifiers and duplicate records',()=>{
 const change={collection:'test_notes',id:'one-note',baseRevision:0,deleted:false,value:{text:'a'}};
 assert.deepEqual(validateBatch({mutationId:'123456789012',changes:[change]}).changes,[change]);
 assert.throws(()=>validateBatch({mutationId:'123456789012',changes:[change,change]}),/duplicados/);
 assert.throws(()=>validateBatch({mutationId:'short',changes:[change]}),/identificador da operação/i);
});
// A Cloudflare dashboard setting must not be able to expose financial writes
// before schema, identity and migration checks have been implemented in code.
test('finance stays locked even when an environment flag is enabled',async()=>{
 assert.equal(FINANCIAL_SCHEMA_ACTIVE,false);
 const financial={collection:'bank_transactions',id:'bank:123',baseRevision:0,deleted:false,value:{amount:100}};
 assert.throws(()=>validateMutation(financial,true),/não foram habilitados/);
 assert.throws(()=>validateBatch({mutationId:'financial-lock-12345',changes:[financial]},true),/não foram habilitados/);
 const state={storage:{sql:{exec:()=>({toArray:()=>[]})}}};
 const cloud=new CloudSyncStore(state);
 const health=await cloud.fetch(new Request('https://internal/health'),true);
 const result=await health.json();
 assert.equal(result.financialEnabled,false);
 assert.equal(result.mode,'test_only');
 const preview=await cloud.fetch(new Request('https://internal/snapshot'),true);
 assert.deepEqual((await preview.json()).documents,[]);
});
