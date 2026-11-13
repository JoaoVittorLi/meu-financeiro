'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const src=fs.readFileSync(path.resolve(__dirname,'../src/intelligence-visuals.ts'),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
const h=(type,props,...children)=>({type,props:{...(props||{}),children}});
let request=null;
const facade=new Function('h','desktop','intelligencePremiumSignature',
 js+';return {mfVisualRequested,mfVisualFromOperational,mfVisualRects,mfVisualRibbon,mfVisualMonthBefore,mfVisualOpenTransactions,mfVisualComparePrevious,renderMfVisual};');
const lib=facade(h,{intelligenceOperationalAsk:async r=>{request=r;return report('treemap')}},()=>'stable');
const CAT=[['Moradia',100000],['Alimentação',76000],['Lazer',38000],['Transporte',24000],['Saúde',22800],['Serviços',11900]];
function report(kind='treemap',override={}){
 return {contract:'IC-v1/I-P0.2-read-only',readOnly:true,changesApplied:false,modelCalled:false,
  source:'manual',profile:'demo',coverage:'unknown',period:{start:'2026-11-01',end:'2026-11-30'},
  facts:{visualSource:'finance-period-ledger-v1',incomeCents:300000,expenseCents:272700,netCents:27300,
   expenseCategories:CAT.map(([name,amountCents],i)=>({name,amountCents,movementCount:1,
     movements:[{id:'tx-'+i,date:'2026-11-13',description:name,amountCents}],detailsPartial:false}))},
  ...override};
}
const app=()=>({state:{intelligencePanelOpen:false,localFinancialAccess:{token:'synthetic-read-only'}},
 navigate(x){this.lastPage=x},setSharedMonth(x){this.lastMonth=x},setState(x){Object.assign(this.state,x)}});
const flatten=root=>{const out=[];const walk=x=>{if(Array.isArray(x)){x.forEach(walk);return}if(x&&typeof x==='object'&&x.type){out.push(x);walk(x.props?.children)}};walk(root);return out;};
const txt=root=>typeof root==='string'?root:Array.isArray(root)?root.map(txt).join(''):root&&root.props?txt(root.props.children):typeof root==='number'?String(root):'';
test('VR-07 — six rectangles preserve exact area for the approved cents',()=>{
 const snap=lib.mfVisualFromOperational(report(),'treemap');
 assert.equal(snap.categories.length,6);
 assert.equal(snap.categories.reduce((n,c)=>n+c.amountCents,0),272700);
 const rects=lib.mfVisualRects(snap.categories);
 assert.equal(rects.length,6);
 for(const r of rects)assert(Math.abs(r.w*r.h/(100*100)-r.amountCents/272700)<1e-10,r.name);
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
  const a=rects[i],b=rects[j],ix=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
  const iy=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  assert(ix*iy<1e-8,'Rectangles overlap');
 }
});
test('VR-07 — no category silently omitted or hidden in table',()=>{
 const snap=lib.mfVisualFromOperational(report(),'treemap');
 const nodes=flatten(lib.renderMfVisual(app(),{id:'msg-1',visual:snap}));
 assert.equal(nodes.filter(n=>String(n.props?.className||'').includes('mf-vr-tile ')).length,6);
 const rows=nodes.filter(n=>n.type==='tr');
 assert.equal(rows.length,7);
 for(const [name]of CAT)assert(txt(nodes).includes(name));
});
test('VR-08 — reconciled period totals, not bank balance',()=>{
 const s=lib.mfVisualFromOperational(report(),'sankey');
 assert(s);
 assert.equal(s.incomeCents,s.expenseCents+s.netCents);
 assert.equal(s.netCents,27300);
 assert.match(txt(lib.renderMfVisual(app(),{id:'flow-1',visual:s})),/Resultado do período/);
});
test('VR-08 — chart disappears on negative result or absent income',()=>{
 for(const f of [{incomeCents:200000,expenseCents:272700,netCents:-72700},{incomeCents:0,expenseCents:272700,netCents:-272700}]){
  const snapshot=lib.mfVisualFromOperational(report('sankey',{facts:{...report().facts,...f}}),'sankey');
  assert.equal(snapshot.state,'partial');
  const view=flatten(lib.renderMfVisual(app(),{id:'flow-2',visual:snapshot}));
  assert.equal(view.filter(n=>n.type==='svg').length,0);
  assert(view.filter(n=>n.type==='table').length>0);
 }
});
test('VR-07/08 — rejects unreconciled categories, forged contract and duplicate grouping',()=>{
 const original=report();
 for(const reply of [
  {...original,changesApplied:true},
  {...original,readOnly:false},
  {...original,facts:{...original.facts,expenseCents:272701}},
  {...original,facts:{...original.facts,visualSource:null}},
  {...original,facts:{...original.facts,expenseCategories:[...original.facts.expenseCategories,original.facts.expenseCategories[0]]}},
  {...original,facts:{...original.facts,netCents:999}}
 ])assert.equal(lib.mfVisualFromOperational(reply,'treemap'),null);
});
test('VR-07/08 — preserves partial-bank coverage, no complete-ledger claims',()=>{
 const snap=lib.mfVisualFromOperational(report('treemap',{source:'bank',profile:'real',coverage:'partial_local'}),'treemap');
 assert.equal(snap.coverage,'partial_local');
 assert.match(snap.reason,/Histórico parcial/);
});
test('VR-07 — zero values return explicit empty view',()=>{
 const obj=report('treemap',{facts:{visualSource:'finance-period-ledger-v1',incomeCents:0,expenseCents:0,netCents:0,expenseCategories:[]}});
 const snap=lib.mfVisualFromOperational(obj,'treemap');
 assert.equal(snap.state,'empty');
 assert.match(txt(lib.renderMfVisual(app(),{id:'empty',visual:snap})),/Não existem despesas/);
});
test('VR-08 — ribbon conserves the given height throughout the path',()=>{
 const path=lib.mfVisualRibbon(46,320,25,55,190);
 assert.match(path,/M46 25/);
 assert.match(path,/L320 245/);
 assert.match(path,/Z$/);
});
test('VR-07/08 — explicit question routing is limited to approved requests',()=>{
 assert.equal(lib.mfVisualRequested('Para onde foi minha renda?'),'sankey');
 assert.equal(lib.mfVisualRequested('Para onde foi meu dinheiro?'),'sankey');
 assert.equal(lib.mfVisualRequested('Mostre treemap de despesas'),'treemap');
 assert.equal(lib.mfVisualRequested('Qual meu saldo disponível?'),null);
});
test('VR-07 — navigate to transactions with original source and month',()=>{
 const a=app();lib.mfVisualOpenTransactions(a,'Moradia','2026-11','manual');
 assert.equal(a.lastPage,'transactions');assert.equal(a.lastMonth,'2026-11');
 assert.equal(a.state.txSource,'manual');assert.equal(a.state.txCategoryFilter,'Moradia');
});
test('VR-07 — previous-month comparison requests a real authorized query only',async()=>{
 const a=app(),s=lib.mfVisualFromOperational(report(),'treemap');
 await lib.mfVisualComparePrevious(a,'msg-1',s,'Moradia');
 assert.equal(request.month,'2026-10');
 assert.equal(request.token,'synthetic-read-only');
 assert.equal(a.state.mfVisualCompare.status,'partial'); // stub returns Nov, must fail month validation.
});
test('VR-07/08 — accessibility: category buttons and tabular alternative exist',()=>{
 const s=lib.mfVisualFromOperational(report(),'treemap');
 const nodes=flatten(lib.renderMfVisual(app(),{id:'a11y',visual:s}));
 assert(nodes.some(n=>n.type==='table'));
 assert.equal(nodes.filter(n=>n.type==='button'&&n.props?.['aria-label']?.startsWith('Moradia')).length,1);
 assert(nodes.some(n=>n.type==='button'&&n.props?.['aria-pressed']===true));
});
test('VR-07/08 — personal write paths absent from charts',()=>{
 assert.doesNotMatch(src,/\.bankCategorize\(|\.categorySave\(|\.ruleSave\(|\.planCreate\(|\.categoryReviewConfirm\(/);
});
