'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const view=fs.readFileSync('src/intelligence-staging.ts','utf8');
const js=ts.transpileModule(view,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2020}}).outputText;
const runtime=new Function('desktop','h','intelligenceFoldText','intelligenceContextFor','intelligenceNextTab',js+';return {workDemoInitial,workDemoSnapshot,workDemoLoad,workDemoExit,workDemoNewThread,workDemoSend,workDemoPrepare,workDemoResolve,renderWorkIntelligenceDemo,renderWorkIntelligencePanel};')(
 null,(name,props,...children)=>({name,props:props||{},children:children.flat()}),s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),()=>({label:'Orçamentos'}),()=>null);
const app=()=>({state:{workIntelligenceDemo:runtime.workDemoInitial(),intelligenceContext:'budgets'},setState(change){Object.assign(this.state,typeof change==='function'?change(this.state):change);}});
const fixture=async(source='bank')=>(await import('../shared/ai-financial-context.mjs')).buildSyntheticFinancialContext(source);
function nodes(tree){return tree&&typeof tree==='object'?[tree,...(tree.children||[]).flatMap(nodes)]:[];}

test('read adapter reuses exact deterministic synthetic context; no personal state read',async()=>{
 const a=app();Object.defineProperty(a.state,'data',{get(){throw Error('Personal data accessed');}});
 await runtime.workDemoLoad(a,'bank',fixture);
 assert.equal(a.state.workIntelligenceDemo.status,'ready');
 assert.equal(a.state.workIntelligenceDemo.snapshot.realized.expenseCents,185000);
 assert.equal(a.state.workIntelligenceDemo.snapshot.realized.netCents,115000);
 assert.equal(a.state.workIntelligenceDemo.snapshot.engine,'shared/finance-period-ledger.mjs');
});
test('adapter refuses real/unapproved payload and offers retry state',async()=>{
 for(const patch of [{realFinancialDataIncluded:true},{onlyFictitiousFinancialData:false},{inferenceCalled:true},{changesApplied:true},{cloudCutoverAllowed:true},{source:'manual'},{engine:'other'}]){
  const a=app();await runtime.workDemoLoad(a,'bank',async()=>({...await fixture(),...patch}));
  assert.equal(a.state.workIntelligenceDemo.status,'error');assert.equal(a.state.workIntelligenceDemo.snapshot,null);
 }
 const a=app();await runtime.workDemoLoad(a,'bank',async()=>{throw Error('Offline');});
 assert.equal(a.state.workIntelligenceDemo.error,'Offline');await runtime.workDemoLoad(a,'bank',fixture);
 assert.equal(a.state.workIntelligenceDemo.status,'ready');
});
test('malformed cents are rejected; extra input metadata is not retained',async()=>{
 const raw=await fixture();raw.secret='not-to-retain';
 assert.equal(runtime.workDemoSnapshot(raw,'bank').secret,undefined);
 raw.budgets[0].spentCents=0.1;assert.throws(()=>runtime.workDemoSnapshot(raw,'bank'),/inválido/);
});
test('out of order source responses cannot replace selected context',async()=>{
 const a=app();let release;const delayed=new Promise(r=>{release=r;});
 const first=runtime.workDemoLoad(a,'bank',()=>delayed);
 await runtime.workDemoLoad(a,'manual',fixture);release(await fixture('bank'));await first;
 assert.equal(a.state.workIntelligenceDemo.snapshot.source,'manual');
 assert.equal(a.state.workIntelligenceDemo.snapshot.realized.expenseCents,150000);
});
test('exit invalidates in-flight adapter response',async()=>{
 const a=app();let release;const delayed=new Promise(r=>{release=r;});
 const load=runtime.workDemoLoad(a,'bank',()=>delayed);runtime.workDemoExit(a);
 release(await fixture());await load;assert.equal(a.state.workIntelligenceDemo.enabled,false);
 assert.equal(a.state.workIntelligenceDemo.snapshot,null);
});
test('chat answers real deterministic fixture, rejects purchase availability and keeps history',async()=>{
 const a=app();await runtime.workDemoLoad(a,'bank',fixture);runtime.workDemoSend(a,'Quanto gastei com alimentação?');
 const d=a.state.workIntelligenceDemo,first=d.activeId;
 assert.match(d.threads[0].messages[1].text,/600,00/);
 runtime.workDemoNewThread(a);runtime.workDemoSend(a,'Posso comprar um celular parcelado?');
 assert.match(a.state.workIntelligenceDemo.threads[0].messages[1].text,/Dados insuficientes/);
 assert.equal(a.state.workIntelligenceDemo.threads.find(t=>t.id===first).messages.length,2);
});
test('allow/deny simulations are idempotent; snapshot and personal ledger never mutate',async()=>{
 for(const decision of ['allow','deny']){
  const a=app();a.state.data={transactions:[{id:'personal'}]};const personal=JSON.stringify(a.state.data);
  await runtime.workDemoLoad(a,'bank',fixture);const before=JSON.stringify(a.state.workIntelligenceDemo.snapshot);
  runtime.workDemoPrepare(a);const id=a.state.workIntelligenceDemo.proposal.id;
  runtime.workDemoResolve(a,id,decision);runtime.workDemoResolve(a,id,decision);
  assert.equal(a.state.workIntelligenceDemo.proposal.status,decision==='allow'?'approved':'denied');
  assert.equal(a.state.workIntelligenceDemo.audit.length,1);
  assert.equal(JSON.stringify(a.state.workIntelligenceDemo.snapshot),before);assert.equal(JSON.stringify(a.state.data),personal);
 }
});
test('stale proposal cannot be approved after source reload or target change',async()=>{
 const a=app();await runtime.workDemoLoad(a,'bank',fixture);runtime.workDemoPrepare(a);
 const id=a.state.workIntelligenceDemo.proposal.id;
 await runtime.workDemoLoad(a,'manual',fixture);runtime.workDemoResolve(a,id,'allow');
 assert.equal(a.state.workIntelligenceDemo.proposal.status,'stale');
 runtime.workDemoPrepare(a);const p=a.state.workIntelligenceDemo.proposal;
 a.state.workIntelligenceDemo.snapshot.budgets[0].limitCents++;
 runtime.workDemoResolve(a,p.id,'allow');assert.equal(a.state.workIntelligenceDemo.proposal.status,'stale');
});
test('UI buttons invoke proposal, decision and shared full/drawer conversation',async()=>{
 const a=app();await runtime.workDemoLoad(a,'bank',fixture);
 const prepare=nodes(runtime.renderWorkIntelligenceDemo(a)).find(n=>n.name==='button'&&n.children.includes('Preparar ajuste fictício'));
 prepare.props.onClick();assert.equal(a.state.workIntelligenceDemo.tab,'actions');
 const allow=nodes(runtime.renderWorkIntelligenceDemo(a)).find(n=>n.name==='button'&&n.children.includes('Permitir simulação'));
 allow.props.onClick();assert.equal(a.state.workIntelligenceDemo.proposal.status,'approved');
 runtime.workDemoSend(a,'Quanto tenho comprometido?');
 const thread=a.state.workIntelligenceDemo.activeId;
 const expand=nodes(runtime.renderWorkIntelligencePanel(a)).find(n=>n.name==='button'&&n.children.includes('Expandir demonstração'));
 expand.props.onClick();assert.equal(a.state.page,'intelligence');assert.equal(a.state.workIntelligenceDemo.activeId,thread);
 assert.equal(a.state.workIntelligenceDemo.threads[0].messages.length,2);
});
test('all explicit prototype interactions are local; no financial writes or external APIs',()=>{
 assert.doesNotMatch(view,/desktop\.(?:save|planCreate|categorySave|aiRunDemo|aiConnect|bank\w+)\b|fetch\(|localStorage|indexedDB/);
 const css=fs.readFileSync('app/intelligence-staging.css','utf8');
 assert.match(css,/prefers-reduced-motion:no-preference/);
 assert.doesNotMatch(css,/\.mf-border-reveal|budget-b3/);
});
test('preview server exposes synthetic reads and refuses writes, unknown sources and path escapes',async()=>{
 const {createPreviewServer}=require('../scripts/work-intelligence-preview.cjs');
 const server=await createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const response=await fetch(base+'/synthetic-context?source=bank');
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.onlyFictitiousFinancialData,true);
  assert.equal((await fetch(base+'/synthetic-context?source=real')).status,400);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/app/%ZZ')).status,400);
  assert.equal((await fetch(base+'/package.json')).status,404);
  assert.match(await (await fetch(base+'/')).text(),/protótipo Work/);
 }finally{await new Promise(r=>server.close(r));}
});
