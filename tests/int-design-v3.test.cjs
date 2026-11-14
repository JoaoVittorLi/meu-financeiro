'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const read=f=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8');
const old=read('src/intelligence-visuals.ts');
const core=read('src/intelligence-v3-core.ts');
const ui=read('src/intelligence-v3-ui.ts');
const css=read('app/intelligence.css');
const viewSource=read('src/intelligence-view.ts');
const localSource=read('src/intelligence-local.ts');
const h=(type,props,...children)=>({type,props:{...(props||{}),children}});
const js=ts.transpileModule(old+'\n'+core+'\n'+ui,{
 compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}
}).outputText;
const api=new Function('h','desktop','intelligencePremiumSignature','renderMfD01Proposal',js+
 ';return {mfV3Registry,mfV3Schema,mfV3Requested,mfV3FromOperational,mfV3Heat,mfV3CompareRows,mfV3Pct,mfV3Records,mfV3Render,mfV3NeedsPrevious,mfV3BindGrant,mfV3MatchesGrant};')(
 h,{},a=>a?.state?.fakeSignature||'',()=>h('div',{},'Proposta supervisionada'));
const syntheticGrant={token:'synthetic-read-only',source:'manual',profile:'demo',expiresAt:Date.now()+600000};
const cardFactory=api.mfV3FromOperational;
api.mfV3FromOperational=(op,kind,prior)=>api.mfV3BindGrant(cardFactory(op,kind,prior),syntheticGrant,'');
const categoriesNov=[
 ['Moradia',100000],['Alimentação',76000],['Lazer',38000],
 ['Transporte',24000],['Saúde',22800],['Serviços',11900]
];
const categoriesOct=[
 ['Moradia',100000],['Alimentação',48000],['Lazer',25000],
 ['Transporte',20000],['Saúde',11000],['Serviços',6000]
];
function report(month='2026-11',cats=categoriesNov,overrides={}){
 const sum=cats.reduce((n,c)=>n+c[1],0);
 const base={
 contract:'IC-v1/I-P0.2-read-only',readOnly:true,changesApplied:false,modelCalled:false,
 uiState:'ready',source:'manual',profile:'demo',asOf:month+'-13T10:00:00Z',
 coverage:'unknown',period:{start:month+'-01',end:month+'-30'},
 facts:{visualSource:'finance-period-ledger-v1',incomeCents:300000,expenseCents:sum,
   netCents:300000-sum,
   budgets:[{category:'Moradia',spentCents:100000,limitCents:100000},
    {category:'Serviços',spentCents:11900,limitCents:0}],
   expenseCategories:cats.map(([name,amountCents],i)=>({
    name,amountCents,movementCount:1,detailsPartial:false,
    movements:[{id:month+'-tx-'+i,date:month+'-13',description:'Compra '+name,amountCents}]
   }))
  }
 };
 return {...base,...overrides};
}
function app(){
 return {state:{mode:'demo',month:'2026-11',intelligencePanelOpen:false,localFinancialAccess:syntheticGrant},
 setState(p){Object.assign(this.state,p)},navigate(page){this.route=page}};
}
function flatten(tree){
 const nodes=[];
 const visit=x=>{if(Array.isArray(x)){x.forEach(visit);return}
  if(x&&typeof x==='object'&&x.type){nodes.push(x);visit(x.props?.children)}};
 visit(tree);return nodes;
}
function txt(tree){
 if(tree===null||tree===undefined)return'';
 if(Array.isArray(tree))return tree.map(txt).join('');
 if(typeof tree!=='object')return String(tree);
 return txt(tree.props?.children);
}
const reply=report(),previous=report('2026-10',categoriesOct);
test('D02 — exactly 26 registered kinds; no duplicative calculators',()=>{
 const items=api.mfV3Registry();
 assert.equal(items.length,26);
 assert.equal(new Set(items.map(x=>x.id)).size,26);
 assert.equal(new Set(items.map(x=>x.kind)).size,26);
 assert.equal(api.mfV3Schema().maxPrimary,1);
 assert.equal(api.mfV3Schema().maxSupplementary,2);
});
test('D02 — exact question routing for rank, Sankey, budgets and unsupported requests',()=>{
 assert.equal(api.mfV3Requested('Quem aumentou os gastos?'),'rank');
 assert.equal(api.mfV3Requested('Para onde foi minha renda?'),'sankey');
 assert.equal(api.mfV3Requested('Mostre treemap de despesas'),'treemap');
 assert.equal(api.mfV3Requested('Meu orçamento'),'budget');
 assert.equal(api.mfV3Requested('Olá, como está?'),null);
});
test('D02 — rejects non-signed and write-capable model results',()=>{
 for(const patch of [{changesApplied:true},{readOnly:false},{modelCalled:true},
  {contract:'fake-v1'},{source:'synthetic'},{uiState:'denied'}]){
  assert.equal(api.mfV3FromOperational({...reply,...patch},'summary',null),null);
 }
});
test('D02 — signed cents, partial source and loss of category conservation',()=>{
 assert.equal(api.mfV3FromOperational(reply,'summary',null).expenseCents,272700);
 assert.equal(api.mfV3FromOperational({...reply,coverage:'partial_local'},'summary',null).quality,'partial');
 assert.equal(api.mfV3FromOperational({...reply,facts:{...reply.facts,expenseCents:272701}},'summary',null),null);
 assert.equal(api.mfV3FromOperational({...reply,facts:{...reply.facts,netCents:9}},'summary',null),null);
});
test('D02 — exact monthly ranking deltas from October and November',()=>{
 const r=api.mfV3FromOperational(reply,'rank',previous);
 assert.equal(r.quality,'ready');
 const rows=api.mfV3Heat(api.mfV3CompareRows(r));
 assert.deepEqual(rows.map(x=>x.delta),[28000,13000,11800,5900,4000,0]);
 assert.deepEqual(rows.map(x=>x.heat),
 ['#ff516a','#ff7470','#fa935d','#f4b350','#f4d363',null]);
 assert.equal(rows[0].relative,58.3);
});
test('RC-ALL-01 — V3 comparison sorts validated string category names deterministically',()=>{
 const sample=api.mfV3FromOperational(reply,'rank',previous);
 const proto=sample.categories[0];
 const other={...sample,previous:{...sample.previous,categories:[]},categories:[
  {...proto,name:'Zebra',amountCents:5000},{...proto,name:'Abacaxi',amountCents:5000}
 ]};
 const rows=api.mfV3CompareRows(other);
 assert.deepEqual(rows.map(x=>x.name),['Abacaxi','Zebra']);
 assert.deepEqual(rows.map(x=>x.delta),[5000,5000]);
 assert.deepEqual(api.mfV3Heat(rows).map(x=>x.heat),['#ff516a','#ff516a']);
});
test('RC-ALL-01 — V3 comparison never converts unrepresentable delta into zero',()=>{
 const sample=api.mfV3FromOperational(reply,'rank',previous);
 const proto=sample.categories[0];
 const extreme={...sample,previous:{...sample.previous,categories:[
  {...proto,name:'Indeterminado',amountCents:-Number.MAX_SAFE_INTEGER}
 ]},categories:[
  {...proto,name:'Indeterminado',amountCents:Number.MAX_SAFE_INTEGER},
  {...proto,name:'Disponível',amountCents:1000}
 ]};
 const rows=api.mfV3CompareRows(extreme);
 assert.deepEqual(rows.map(x=>x.name),['Disponível','Indeterminado']);
 assert.equal(rows[1].delta,null);
 assert.equal(api.mfV3Heat(rows)[1].heat,null);
});
test('D02 — percent with zero denominator is unavailable, never 100%',()=>{
 assert.equal(api.mfV3Pct(20000,0),null);
 assert.equal(api.mfV3Pct(0,0),null);
});
test('D02 — previous month must match source, profile and period',()=>{
 const bad={...previous,source:'bank'};
 assert.equal(api.mfV3FromOperational(reply,'rank',bad).quality,'partial');
 assert.equal(api.mfV3FromOperational(reply,'rank',report('2026-08',categoriesOct)).quality,'partial');
 assert.equal(api.mfV3FromOperational(reply,'rank',null).quality,'partial');
});
test('D02 — Sankey blocked for negative net or missing income',()=>{
 const op={...reply,facts:{...reply.facts,incomeCents:200000,netCents:-72700}};
 const v=api.mfV3FromOperational(op,'sankey',null);
 assert.equal(v.quality,'partial');
 assert.equal(v.original.state,'partial');
 const result=flatten(api.mfV3Render(app(),{id:'s1',visualV3:v}));
 assert.equal(result.filter(x=>x.type==='svg').length,0);
});
test('D02 — renderer has one primary section for each of 26 kinds',()=>{
 const a=app();
 for(const kind of api.mfV3Registry().map(x=>x.kind)){
  const v=api.mfV3FromOperational(reply,kind,previous);
  const t=api.mfV3Render(a,{id:'m-'+kind,visualV3:v});
  assert.equal(t.type,'section','missing '+kind);
  assert.match(t.props.className,/mf-v3-card/);
 }
});
test('D02 — expense bars occupy a separate track from labels and values',()=>{
 const v=api.mfV3FromOperational(reply,'bar',null);
 const nodes=flatten(api.mfV3Render(app(),{id:'bars',visualV3:v}));
 assert(nodes.some(x=>x.props.className==='mf-v3-bar-head'));
 assert(nodes.some(x=>x.props.className==='mf-v3-track'));
 assert.match(css,/\.mf-v3-card \.mf-v3-bar-head\s*\{display:grid/);
 assert.match(css,/\.mf-v3-card \.mf-v3-track\s*\{display:block/);
});
test('D02 — VR13 limit zero never causes division by zero or fabricated percentage',()=>{
 const t=api.mfV3Render(app(),{id:'budgets',visualV3:api.mfV3FromOperational(reply,'budget',null)});
 const str=txt(t);
 assert.match(str,/Limite zero definido/);
 assert.doesNotMatch(str,/Infinity%|NaN%/);
});
test('D02 — no false recurrence, debt, portfolio or durable personal receipt',()=>{
 for(const kind of ['recurring','goal','debt','portfolio','approval']){
  const v=api.mfV3FromOperational(reply,kind,null);
  assert.equal(v.quality,'unavailable');
  assert.match(txt(api.mfV3Render(app(),{id:kind,visualV3:v})),/serviços locais|Sem recibo/i);
 }
});
test('D02 — VR15 and VR16 reuse existing simulator, no parallel engine',()=>{
 for(const kind of ['whatif','scenario']){
  const a=app(),t=api.mfV3Render(a,{id:kind,visualV3:api.mfV3FromOperational(reply,kind,null)});
  const b=flatten(t).find(x=>x.type==='button'&&txt(x)==='Abrir Simular Compra');
  assert(b);
  b.props.onClick();
  assert.equal(a.route,'simulator');
 }
});
test('D02 — VR10 preserves category->description->transaction context',()=>{
 const a=app(),m={id:'drill',visualV3:api.mfV3FromOperational(reply,'drilldown',previous)};
 let t=api.mfV3Render(a,m);
 let b=flatten(t).find(x=>x.type==='button'&&txt(x).includes('Moradia ·'));
 assert(b);
 b.props.onClick();
 assert.equal(a.state.mfV3Drill.category,'Moradia');
 t=api.mfV3Render(a,m);
 b=flatten(t).find(x=>x.type==='button'&&txt(x)==='Compra Moradia');
 assert(b);b.props.onClick();
 assert.equal(a.state.mfV3Drill.group,'Compra Moradia');
 assert.match(txt(api.mfV3Render(a,m)),/2026-11-13/);
});
test('D02 — VR11 filter is wired and leaves source data unchanged',()=>{
 const a=app(),m={id:'table',visualV3:api.mfV3FromOperational(reply,'table',null)};
 const before=api.mfV3Records(m.visualV3).length;
 const input=flatten(api.mfV3Render(a,m)).find(x=>x.type==='input'&&x.props.type==='search');
 assert(input);input.props.onChange({target:{value:'Lazer'}});
 assert.equal(a.state.mfV3Search.value,'Lazer');
 assert.equal(api.mfV3Records(m.visualV3).length,before);
});
test('D02 — existing VR07/08 renderer reused, not 2 new graphics',()=>{
 for(const kind of ['treemap','sankey']){
  const t=api.mfV3Render(app(),{id:kind,visualV3:api.mfV3FromOperational(reply,kind,null)});
  assert(flatten(t).some(x=>['mf-vr-treemap','mf-vr-flow-wrap'].includes(x.props?.className)));
 }
});
test('D02 — user-visible routes are not decorative',()=>{
 const a=app();
 const plan=api.mfV3Render(a,{id:'plan',visualV3:api.mfV3FromOperational(reply,'plan',null)});
 const btn=flatten(plan).find(x=>x.type==='button'&&txt(x)==='Abrir Planejamento');
 assert(btn);btn.props.onClick();assert.equal(a.route,'planning');
});
test('D02 — no three permanent tabs in main chat',()=>{
 assert.doesNotMatch(viewSource,/h\('div',\{className:'mf-ai-tabbar'/);
 assert.match(viewSource,/intelligenceHistoryOpen\?renderIntelligenceHistorySidebar/);
 assert.match(viewSource,/mf-ai-v3-tools/);
 assert.match(localSource,/mfV3Requested\(q\)/);
});
test('D02 — no personal financial write or non-approved external AI calls',()=>{
 assert.doesNotMatch(core+ui,/\.bankCategorize\(|\.categorySave\(|\.ruleSave\(|\.planCreate\(|\.categoryReviewConfirm\(/);
 assert.doesNotMatch(core+ui,/fetch\(|eval\(|new Function\(/);
});
test('D02 — responsive four densities, visible focus, no-motion declarations',()=>{
 assert.match(css,/mf-v3-compact/);
 assert.match(css,/mf-v3-analysis/);
 assert.match(css,/@media\(max-width:710px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/:focus-visible/);
});


test('D02 — inventory preserves 3 individual approvals, VR10 baseline and inherited design',()=>{
 const list=api.mfV3Registry();
 assert.equal(list.filter(x=>x.designStatus==='DESIGN_APPROVED').length,3);
 assert.equal(list.filter(x=>x.designStatus==='BASELINE_ACCEPTED_FOR_BATCH').length,1);
 assert.equal(list.filter(x=>x.designStatus==='DESIGN_SPECIFIED_BY_INHERITANCE').length,22);
 assert.equal(list.find(x=>x.id==='VR-23').capability,'AWAITING_BACKEND_OR_OPERATION');
});
test('D02 — ranking controls really change sort state and selected category reveals real values',()=>{
 const a=app(),m={id:'ranking-controls',visualV3:api.mfV3FromOperational(reply,'rank',previous)};
 let nodes=flatten(api.mfV3Render(a,m));
 let relative=nodes.find(x=>x.type==='button'&&txt(x)==='Crescimento %');
 assert(relative);relative.props.onClick();
 assert.equal(a.state.mfV3Sort.mode,'relative');
 nodes=flatten(api.mfV3Render(a,m));
 const row=nodes.find(x=>x.type==='button'&&txt(x).startsWith('Alimentação')&&x.props.className==='mf-v3-bar');
 assert(row);row.props.onClick();
 const after=api.mfV3Render(a,m);
 assert.match(txt(after),/Antes R\$ 480,00|Antes R\$\s*480,00/);
 assert.match(txt(after),/28[0,.]+/);
});
test('D02 — neutral/no-increase filter does not misuse expense-increase heat colors',()=>{
 const a=app(),m={id:'neutral',visualV3:api.mfV3FromOperational(reply,'rank',previous)};
 const more=flatten(api.mfV3Render(a,m)).find(x=>x.type==='button'&&txt(x)==='Mostrar sem aumento');
 assert(more);more.props.onClick();
 const nodes=flatten(api.mfV3Render(a,m));
 assert(nodes.some(x=>x.type==='button'&&txt(x).includes('Moradia')));
 assert.equal(a.state.mfV3ShowNeutral,'neutral');
});
test('D02 — searchable table sort is an actual click handler',()=>{
 const a=app(),m={id:'sort',visualV3:api.mfV3FromOperational(reply,'table',null)};
 const btn=flatten(api.mfV3Render(a,m)).find(x=>x.type==='button'&&txt(x)==='Maior gasto');
 assert(btn);btn.props.onClick();
 assert.equal(a.state.mfV3TableOrder.order,'amount');
});


test('D02 — revoked, expired or replaced grants hide cached personal numbers',()=>{
 const v=api.mfV3FromOperational(reply,'summary',null);
 const invalid=[
  a=>a.state.localFinancialAccess=null,
  a=>a.state.localFinancialAccess={...a.state.localFinancialAccess,expiresAt:Date.now()-1000},
  a=>a.state.localFinancialAccess={...a.state.localFinancialAccess,source:'bank'},
  a=>a.state.localFinancialAccess={...a.state.localFinancialAccess,profile:'real'},
  a=>a.state.localFinancialMonth='2026-10'
 ];
 for(const mutate of invalid){
  const a=app();mutate(a);
  const tree=api.mfV3Render(a,{id:'secret',visualV3:v});
  assert.match(tree.props.className,/state-stale/);
  assert.doesNotMatch(txt(tree),/R\$\s*2\.727,00/);
 }
});
test('D02 — valid current grant still allows cached read-only view until expiry',()=>{
 const a=app(),v=api.mfV3FromOperational(reply,'summary',null);
 const tree=api.mfV3Render(a,{id:'fresh',visualV3:v});
 assert.doesNotMatch(tree.props.className,/state-stale/);
 assert.match(txt(tree),/R\$\s*2\.727,00/);
});

test('QA-GATE-01 — grant B cannot resurrect card from grant A with identical scope',()=>{
 const a=app(),v=api.mfV3FromOperational(reply,'summary',null);
 assert.match(txt(api.mfV3Render(a,{id:'under-a',visualV3:v})),/R\$\s*2\.727,00/);
 const grantB={...syntheticGrant,token:'synthetic-grant-b',expiresAt:Date.now()+600000};
 a.state.localFinancialAccess=grantB; // same source, profile and month
 const old=api.mfV3Render(a,{id:'under-b',visualV3:v});
 assert.match(old.props.className,/state-stale/);
 assert.doesNotMatch(txt(old),/R\$\s*2\.727,00/);
 const bCard=api.mfV3BindGrant(cardFactory(reply,'summary',null),grantB,'');
 assert.match(txt(api.mfV3Render(a,{id:'new-b',visualV3:bCard})),/R\$\s*2\.727,00/);
 // Even an identical token must not make a different grant object the same authorization.
 a.state.localFinancialAccess={...grantB};
 assert.match(api.mfV3Render(a,{id:'replaced-b',visualV3:bCard}).props.className,/state-stale/);
});
test('QA-GATE-01 — unbound, restored and copied cards fail closed without persisting tokens',()=>{
 const a=app(),bound=api.mfV3FromOperational(reply,'summary',null);
 const serialized=JSON.stringify(bound);
 assert.doesNotMatch(serialized,/synthetic-read-only|synthetic-grant-b/);
 const restored=JSON.parse(serialized);
 assert.match(api.mfV3Render(a,{id:'restored',visualV3:restored}).props.className,/state-stale/);
 assert.match(api.mfV3Render(a,{id:'copied',visualV3:{...bound}}).props.className,/state-stale/);
 assert.match(api.mfV3Render(a,{id:'unbound',visualV3:cardFactory(reply,'summary',null)}).props.className,/state-stale/);
});
test('QA-GATE-01 — account/filter and concurrent contexts cannot reuse old snapshots',()=>{
 const a=app(),cardA=api.mfV3FromOperational(reply,'summary',null);
 a.state.fakeSignature='account-b'; // signature represents current account/filter ownership
 assert.match(api.mfV3Render(a,{id:'other-account',visualV3:cardA}).props.className,/state-stale/);
 const accessB={...syntheticGrant,token:'concurrent-b'};
 a.state.localFinancialAccess=accessB;
 const cardB=api.mfV3BindGrant(cardFactory(reply,'summary',null),accessB,'account-b');
 assert.doesNotMatch(api.mfV3Render(a,{id:'current',visualV3:cardB}).props.className,/state-stale/);
 assert.match(api.mfV3Render(a,{id:'old',visualV3:cardA}).props.className,/state-stale/);
 a.state.fakeSignature='account-c';
 assert.match(api.mfV3Render(a,{id:'third-scope',visualV3:cardB}).props.className,/state-stale/);
});
