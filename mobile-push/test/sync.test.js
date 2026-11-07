import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMutation,validateBatch,isFinancial,COLLECTIONS} from '../src/cloud-sync.js';
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