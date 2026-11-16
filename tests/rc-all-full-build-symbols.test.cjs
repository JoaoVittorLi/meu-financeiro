'use strict';
// Integration preflight: verify the actual tsc --outFile result, not isolated
// TypeScript transpileModule mocks that can hide missing cross-file symbols.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const {IC2ReadQueryGateway}=require('../electron/intelligence-ic2-adapter.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Preflight P1 — actual tsc module:none/outFile contains D04 and V3 runtime symbols',()=>{
 const cfg=JSON.parse(read('tsconfig.json'));
 assert.equal(cfg.compilerOptions.module,'none');
 assert.equal(cfg.compilerOptions.outFile,'app/app.js');
 for(const filename of ['src/intelligence-review-v11.ts','src/intelligence-v3-core.ts',
  'src/intelligence-quality-rc.ts','src/intelligence-ic2.ts'])
  assert(cfg.files.includes(filename),'Required runtime module missing: '+filename);
 const output=read('app/app.js'); // npm run test:db compiles before node --test
 assert.match(output,/function\s+mfD04Render\s*\(/);
 assert.match(output,/function\s+mfV3Requested\s*\(/);
 assert.match(output,/function\s+mfI2QualityPanel\s*\(/);
 const index=read('app/index.html');
 assert.match(index,/app\.js/);
 assert.match(read('src/intelligence-review.ts'),/return mfD04Render\(app\)/);
});
test('Preflight P1 — real IC2ReadQueryGateway symbol creates an authorized ledger query',async()=>{
 assert.equal(typeof IC2ReadQueryGateway,'function');
 const db=new FinanceDB(':memory:');
 try{
  db.save('demo',{version:5,transactions:[{id:'demo',date:'2026-11-11',
   description:'Compra fictícia',kind:'expense',amount:6000,category:'Alimentação'}],
   budgets:{},settings:{opening:0,income:0,fixed:0,existing:0,reserve:0}});
  const local=new LocalFinancialIntelligence(db,new PlanningStore(db));
  const owner=91,g=local.authorize({consent:CONSENT,source:'manual',profile:'demo'},owner);
  const bridge=new IC2ReadQueryGateway(local);
  const reply=await bridge.ask({token:g.token,source:'manual',profile:'demo',
   month:'2026-11',question:'Quanto gastei?'},owner);
  assert.equal(reply.version,2);
  assert.equal(reply.changesApplied,false);
  assert.equal(reply.modelCalled,false);
  assert.equal(reply.facts[0].value.expenseCents,6000);
 }finally{db.close();}
});
