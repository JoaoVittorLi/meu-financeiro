'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {FinanceDB}=require('../electron/db.cjs'),{PlanningStore}=require('../electron/planning.cjs'),{LocalFinancialIntelligence}=require('../electron/financial-intelligence.cjs');
function harness(){
 const db=new FinanceDB(':memory:'),planner=new PlanningStore(db);db.save('real',{transactions:[{id:'synthetic',date:'2026-11-10',description:'Mercado synthetic',kind:'expense',category:'Alimentação',amount:4215}],budgets:{Alimentação:4000},settings:{opening:0,income:0,fixed:0,existing:0,reserve:0}});
 const service=new LocalFinancialIntelligence(db,planner),api={localFinancialAuthorize:x=>Promise.resolve(service.authorize(x,1)),localFinancialQuery:x=>Promise.resolve(service.query(x,1)),localFinancialRevoke:x=>Promise.resolve(service.revoke(x,1))};
 const names=['ai-markdown.ts','intelligence-view.ts','intelligence-integration.ts','intelligence-local.ts'];
 const js=ts.transpileModule(names.map(n=>fs.readFileSync('src/'+n,'utf8')).join('\n'),{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2020}}).outputText;
 const h=(name,props,...children)=>({name,props:props||{},children:children.flat()});
 const cats=[{name:'Alimentação',kind:'expense'}];
 const fn=new Function('desktop','h','Icon','Card','DEFAULT_CATEGORY_INFOS','spanLabel','dateSpan','prettyMonth','iso','document','FinancePeriodLedger',js+';return {localFinancialEnable,localFinancialDisable,localFinancialQuery,localFinancialSubmit,localFinancialParse,intelligenceOpenFullChat,intelligenceClearHistory,renderIntelligenceView};');
 const runtime=fn(api,h,()=>null,()=>null,cats,()=> 'Novembro',()=>({start:'2026-11-01',end:'2026-11-30'}),x=>x,()=> '2026-11-12',{getElementById:()=>null},require('../shared/finance-period-ledger.mjs'));
 const original=[{id:'old-personal-history',messages:[]}];let storageCalls=0;
 const app={state:{mode:'real',page:'intelligence',month:'2026-11',localFinancialSource:'manual',intelligenceTab:'today',intelligenceThreads:original,intelligenceMessages:[],intelligenceActiveThreadId:null,intelligenceHydratedMode:'real',categories:cats,aiStatus:{connected:false,secure:false},aiBusy:false,aiError:'',intelligenceContext:'budgets'},chatStorage:{getItem(){storageCalls++;throw Error('Storage touched');},setItem(){storageCalls++;throw Error('Storage touched');},removeItem(){storageCalls++;throw Error('Storage touched');}},setState(p,cb){Object.assign(this.state,typeof p==='function'?p(this.state):p);cb?.();}};
 return {db,app,runtime,api,original,storageCalls:()=>storageCalls};
}
test('live UI uses SQLite response, main/drawer share thread, history stays out of localStorage',async()=>{const f=harness();try{
 await f.runtime.localFinancialEnable(f.app);await f.runtime.localFinancialSubmit(f.app,'Quanto gastei com alimentação neste mês?');
 assert.match(f.app.state.intelligenceMessages[1].text,/42,15/);assert.equal(f.app.state.intelligenceMessages[1].status,'done');assert.ok(f.app.state.intelligenceMessages[1].structuredCard);
 const active=f.app.state.intelligenceActiveThreadId;f.app.state.intelligencePanelOpen=true;f.app.state.intelligenceContextSnapshot={label:'Orçamentos',period:'Novembro',filters:[],mode:'Pessoal'};f.runtime.intelligenceOpenFullChat(f.app);assert.equal(f.app.state.intelligenceActiveThreadId,active);
 assert.equal(f.storageCalls(),0);f.runtime.intelligenceClearHistory(f.app);assert.equal(f.storageCalls(),0);
 f.runtime.localFinancialDisable(f.app);assert.equal(f.app.state.localFinancialAccess,null);assert.equal(f.app.state.intelligenceThreads,f.original);
 }finally{f.db.close();}});
test('mutation wording is not interpreted as financial write and unsupported questions are explicit',async()=>{const f=harness();try{
 assert.equal(f.runtime.localFinancialParse('Categorize mercado como Alimentação',f.app.state.categories),null);
 await f.runtime.localFinancialEnable(f.app);await f.runtime.localFinancialSubmit(f.app,'Crie um orçamento');
 assert.match(f.app.state.intelligenceMessages[1].text,/não são executados/);assert.equal(f.app.state.intelligenceMessages[1].structuredCard,null);assert.equal(f.storageCalls(),0);
 }finally{f.db.close();}});

test('all eight starter questions select the intended financial query',()=>{const f=harness();try{
 const samples=[['Quanto gastei com alimentação neste mês?','category'],['Quais foram minhas maiores despesas?','largest'],['Quais categorias ultrapassaram o orçamento?','budgets'],['Quanto tenho comprometido para o próximo mês?','commitments'],['Quais despesas aumentaram?','compare'],['Que movimentações preciso revisar?','review'],['Quanto gastei em assinaturas?','category'],['Quais dados faltam para avaliar uma compra?','purchase']];
 for(const [question,intent] of samples)assert.equal(f.runtime.localFinancialParse(question,f.app.state.categories)?.intent,intent,question);
 }finally{f.db.close();}});
test('a reply for an obsolete month is rejected',async()=>{const f=harness();try{
 await f.runtime.localFinancialEnable(f.app);let resolve;f.api.localFinancialQuery=()=>new Promise(r=>resolve=r);
 const pending=f.runtime.localFinancialQuery(f.app,{intent:'category',category:'Alimentação'});f.app.state.localFinancialMonth='2026-12';resolve({version:1,readOnly:true,inferenceCalled:false,changesApplied:false});
 await assert.rejects(pending,/período mudou/);
 }finally{f.db.close();}});
