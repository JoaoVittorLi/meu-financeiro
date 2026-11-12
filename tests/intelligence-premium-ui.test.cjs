'use strict';
/* Renderer contract tests run in Node using the repository's pinned TypeScript.
 * No Electron, network, personal SQLite, or external LLM. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const filename=path.join(__dirname,'../src/intelligence-view.ts');
const source=fs.readFileSync(filename,'utf8');
const output=ts.transpileModule(source,{
 compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}
}).outputText;
const h=(tag,props,...children)=>({tag,props:props||{},children:children.flat(8).filter(x=>x!==null&&x!==undefined)});
function context(api={}){
 const sandbox={desktop:api,h,Icon:function Icon(){},Intl,Date,JSON,Number,String,Math,Array,Object,Set,Map,
  document:{getElementById(){return null}},setTimeout(){},console};
 vm.createContext(sandbox);
 vm.runInContext(output,sandbox,{filename:'intelligence-view.compiled.js',timeout:1500});
 return sandbox;
}
function app(state={}){
 return {state:{mode:'real',month:'2026-11',localFinancialMonth:'2026-11',
  localFinancialSource:'bank',intelligencePremiumLoading:false,
  bank:{config:{configured:true}},...state},
  setState(update,callback){Object.assign(this.state,update);if(callback)callback();},
  navigations:[],navigate(page){this.navigations.push(page);}};
}
function report({profile='real'}={}){
 const ids=Array.from({length:8},(_,i)=>'UI-0'+(i+1));
 const cards=ids.map((id,i)=>({
  id,kind:'financial_metric',title:id,source:i===4?'planning':'bank',profile,
  asOf:'2026-11-12T18:00:00.000Z',coverage:'partial_local',
  period:{start:'2026-11-01',end:'2026-11-30'},capability:'available_read_only',uiState:'ready',
  evidence:[],actions:[],count:i===0?2:0,valueCents:i===4?4500:null
 }));
 cards[0].evidence=[{}, {posted:1,pendingBank:1}];
 cards[2].observations=[{category:'Alimentação',spentCents:22000,limitCents:30000}];
 cards[3].budgets=[{category:'Alimentação',spentCents:22000,limitCents:30000,percentage:73}];
 return {contract:'IC-v1/I-P0.1',privacy:{changesApplied:false,personalAIWritingEnabled:false},cards};
}
function flatten(value,all=[]){
 if(!value||typeof value!=='object')return all;
 if('tag' in value)all.push(value);
 for(const child of value.children||[])flatten(child,all);
 return all;
}
test('R1: handles all eight cards without fabricating missing financial figures',()=>{
 const ctx=context(),a=app({intelligencePremiumReport:report()});
 a.state.intelligencePremiumSignature=ctx.intelligencePremiumSignature(a);
 const tree=ctx.renderIntelligencePremiumToday(a),nodes=flatten(tree);
 assert.equal(nodes.filter(n=>n.props.className?.includes('mf-premium-tile')).length>=5,true);
 const rendered=JSON.stringify(tree);
 for(const id of ['UI-01','UI-02','UI-03','UI-04','UI-05','UI-06','UI-07','UI-08'])assert.ok(rendered.includes(id));
 assert.ok(!rendered.includes('dados fictícios'));
 assert.ok(rendered.includes('45,00')); // 4.500 centavos, not 4.500 reais.
});
test('R1: without a grant Today remains permission-driven',async()=>{
 let payload=null;
 const ctx=context({intelligenceOperationalOverview:async input=>{payload=input;return report()}});
 const a=app();
 await ctx.intelligencePremiumLoad(a);
 assert.equal(payload.token,null);
 assert.equal(a.state.intelligencePremiumReport.cards.length,8);
 assert.equal(JSON.stringify(ctx.renderIntelligencePremiumToday(a)).includes('Autorize a leitura local'),true);
});
test('R1: stale previous-month reply cannot reach the current profile',async()=>{
 let resolve;
 const ctx=context({intelligenceOperationalOverview:()=>new Promise(r=>{resolve=r})});
 const a=app({localFinancialAccess:{token:'ephemeral',source:'bank',profile:'real'}});
 const waiting=ctx.intelligencePremiumLoad(a);
 a.state.localFinancialMonth='2026-12';
 resolve(report());await waiting;
 assert.equal(a.state.intelligencePremiumReport,null);
 assert.equal(ctx.intelligencePremiumSignature(a)===a.state.intelligencePremiumSignature,false);
});
test('R1: invalid contract is rejected and no data is rendered',async()=>{
 const ctx=context({intelligenceOperationalOverview:async()=>({contract:'wrong',privacy:{changesApplied:true},cards:[]})});
 const a=app();
 await ctx.intelligencePremiumLoad(a);
 assert.equal(a.state.intelligencePremiumReport,null);
 assert.match(a.state.intelligencePremiumError,/Contrato financeiro inválido/);
});
test('R1: navigation uses only whitelisted real handlers',()=>{
 const ctx=context(),a=app();
 for(const [handler,target] of [
  ['navigation:transactions-review','review'],
  ['navigation:budgets','budgets'],
  ['navigation:planning','planning'],
  ['navigation:transactions','transactions'],
  ['navigation:category-editor','categories']]){
  ctx.intelligencePremiumAction(a,null,{handler,permitted:true,label:'Abrir'});
  assert.equal(a.navigations.at(-1),target);
 }
 const n=a.navigations.length;
 ctx.intelligencePremiumAction(a,null,{handler:'untrusted:write-db',permitted:true});
 ctx.intelligencePremiumAction(a,null,{handler:'navigation:budgets',permitted:false});
 assert.equal(a.navigations.length,n);
});
test('R1: visual CTA requires known handler and has no personal synthetic write',()=>{
 const ctx=context(),a=app({mode:'demo'});
 const disabled=ctx.intelligencePremiumButton(a,null,{actionId:'create',label:'Nova categoria',permitted:true,handler:'navigation:category-editor'});
 assert.equal(disabled.props.disabled,true);
 const unknown=ctx.intelligencePremiumButton(a,null,{actionId:'unknown',label:'Confirmar',permitted:true,handler:'write:confirm'});
 assert.equal(unknown.props.disabled,true);
 const synthetic=ctx.intelligencePremiumButton(a,null,{actionId:'rule',label:'Revisar regra',permitted:true,handler:'categoryReviewPrepare',previewRequired:true,operationId:'synthetic-suggestion'});
 assert.equal(synthetic.props.disabled,true);
});
test('R1: source, profile, token and review grant are isolated session signatures',()=>{
 const ctx=context(),a=app(),first=ctx.intelligencePremiumSignature(a);
 for(const update of [{mode:'demo'},{localFinancialMonth:'2026-12'},
   {localFinancialAccess:{token:'secret',source:'bank',profile:'real'}},
   {categoryReviewGrant:{token:'synthetic'}}]){
  Object.assign(a.state,update);
  assert.notEqual(ctx.intelligencePremiumSignature(a),first);
  Object.assign(a.state,{mode:'real',localFinancialMonth:'2026-11',localFinancialAccess:null,categoryReviewGrant:null});
 }
});


function chatContext(api,options={}){
 const sandbox=context(api);
 const localSource=fs.readFileSync(path.join(__dirname,'../src/intelligence-local.ts'),'utf8');
 const localOutput=ts.transpileModule(localSource,{
  compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}
 }).outputText;
 sandbox.intelligenceNowTime=()=>'19:00';
 sandbox.intelligenceSyncThreadMessages=(app,messages)=>{app.setState({intelligenceMessages:messages});};
 vm.runInContext(localOutput,sandbox,{filename:'intelligence-local.compiled.js',timeout:1500});
 return sandbox;
}
test('R2: authorized chat uses operational endpoint and shows source, period and actions',async()=>{
 let request=null;
 const api={intelligenceOperationalAsk:async input=>{
  request=input;
  return {contract:'IC-v1/I-P0.2-read-only',readOnly:true,changesApplied:false,modelCalled:false,
   uiState:'ready',answer:'Comparação local calculada.',source:'bank',profile:'real',coverage:'partial_local',
   card:{title:'Comparação',rows:[],headers:['Fonte','Valor']},
   actions:[{actionId:'navigate:transactions',label:'Ver Movimentações',permitted:true,handler:'navigation:transactions'}]};
 }};
 const ctx=chatContext(api);
 const a=app({page:'intelligence',localFinancialAccess:{token:'private-session-token',source:'bank',profile:'real'},
  intelligenceMessages:[],categories:[]});
 await ctx.localFinancialSubmit(a,'Compare minhas despesas com o mês anterior');
 assert.equal(request.token,'private-session-token');
 assert.equal(request.month,'2026-11');
 assert.equal(request.question,'Compare minhas despesas com o mês anterior');
 assert.equal(a.state.intelligenceMessages.length,2);
 assert.equal(a.state.intelligenceMessages[1].operationalActions[0].handler,'navigation:transactions');
 assert.equal(a.state.intelligenceMessages[1].status,'done');
 assert.equal(JSON.stringify(a.state.intelligenceMessages).includes('private-session-token'),false);
});
test('R2: unsupported operational question never generates an invented financial card',async()=>{
 const ctx=chatContext({intelligenceOperationalAsk:async()=>({
  contract:'IC-v1/I-P0.2-read-only',readOnly:true,changesApplied:false,modelCalled:false,
  uiState:'unsupported',answer:'Não reconheço a solicitação.',actions:[]})});
 const a=app({page:'intelligence',localFinancialAccess:{token:'t',source:'bank',profile:'real'},
  intelligenceMessages:[],categories:[]});
 await ctx.localFinancialSubmit(a,'Pergunta não suportada');
 assert.equal(a.state.intelligenceMessages[1].status,'unsupported');
 assert.equal(a.state.intelligenceMessages[1].structuredCard,null);
 assert.deepEqual(a.state.intelligenceMessages[1].operationalActions,[]);
});
test('R2: pending chat responses are discarded when read profile or month changes',async()=>{
 let resolve;
 const ctx=chatContext({intelligenceOperationalAsk:()=>new Promise(r=>resolve=r)});
 const a=app({page:'intelligence',localFinancialAccess:{token:'private',source:'bank',profile:'real'},
  intelligenceMessages:[],categories:[]});
 const pending=ctx.localFinancialSubmit(a,'Quais os meus gastos?');
 a.state.localFinancialMonth='2026-12';
 resolve({contract:'IC-v1/I-P0.2-read-only',readOnly:true,changesApplied:false,modelCalled:false,
  uiState:'ready',answer:'Dados do mês anterior',source:'bank'});
 await pending;
 assert.equal(a.state.intelligenceMessages.length,0);
 assert.equal(a.state.localFinancialBusy,false);
});
