'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const src=fs.readFileSync(path.resolve(__dirname,'../src/app.ts'),'utf8');
const b3start=src.indexOf('const B3_COLOR_STOPS:');
const b3end=src.indexOf('function u3BudgetSignals(',b3start);
assert(b3start>=0&&b3end>b3start,'B3 production functions not found');
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
const {budgetB3Color,budgetB3Visual}=new Function(compile(src.slice(b3start,b3end))+
 ';return {budgetB3Color,budgetB3Visual};')();
const parseColor=color=>{
 const match=/^rgb\((\d+), (\d+), (\d+)\)$/.exec(color);
 assert(match,'Invalid RGB output '+color);
 return match.slice(1).map(Number);
};
const landmarks=[
 [0,[35,184,112]],[10,[35,184,112]],[25,[161,203,70]],
 [50,[240,204,57]],[70,[241,149,58]],[90,[235,105,80]],
 [99,[224,72,79]],[100,[211,55,70]]
];
test('B3 — each target percentage yields exactly one uniform RGB color',()=>{
 for(const [percent,rgb] of landmarks){
  assert.deepEqual(parseColor(budgetB3Color(percent)),rgb,'Color at '+percent+'%');
 }
 for(const percent of [106,120,150]){
  assert.equal(budgetB3Color(percent),budgetB3Color(100));
 }
});
test('B3 — continuous interpolation without attention-threshold color jumps',()=>{
 for(let p=0;p<100;p+=0.2){
  const a=parseColor(budgetB3Color(p));
  const b=parseColor(budgetB3Color(p+0.02));
  assert(a.every((ch,i)=>Math.abs(ch-b[i])<=2),'Abrupt color jump near '+p+'%');
 }
 assert.notEqual(budgetB3Color(25),budgetB3Color(50));
 assert.notEqual(budgetB3Color(70),budgetB3Color(90));
 assert.notEqual(budgetB3Color(90),budgetB3Color(99));
});
test('B3 — raw percentage grows past 100 while only rendered arc is clamped',()=>{
 for(const p of [0,10,25,50,70,90,99,100,106,150]){
  const result=budgetB3Visual(p*100,10000);
  assert(result);
  assert.equal(result.percent,p);
  assert.equal(result.fill,Math.min(p,100));
  assert.equal(result.color,budgetB3Color(Math.min(p,100)));
 }
 assert.equal(budgetB3Visual(15000,10000).percent,150);
 assert.equal(budgetB3Visual(15000,10000).fill,100);
});
test('B3 — limit zero, missing, infinite or negative produce no invented gauge',()=>{
 for(const n of [0,-1,NaN,Infinity,-Infinity])
  assert.equal(budgetB3Visual(100,n),null);
 assert.equal(budgetB3Visual(NaN,10000),null);
 assert.equal(budgetB3Visual(Infinity,10000),null);
});
test('B3 — accepts integer cents and does not round cents before progress',()=>{
 const v=budgetB3Visual(1234,2000);
 assert.equal(v.percent,62); // 61.7%, display rounded only
 assert.equal(v.fill,61.7);
 assert.equal(v.color,budgetB3Color(61.7));
});
// Render the actual production renderBudgets() method with synthetic state.
// No mocked JSX/template reimplementation: the class method comes from src/app.ts.
const renderStart=src.indexOf(' renderBudgets(){');
const renderEnd=src.indexOf('\n renderAssistant(',renderStart);
assert(renderStart>=0&&renderEnd>renderStart,'Production renderBudgets boundary missing');
const method=src.slice(renderStart,renderEnd);
const h=(type,props,...children)=>({type,props:{...(props||{}),children}});
const Card=()=>null,Icon=()=>null;
const fmt=n=>'R$ '+(n/100).toFixed(2);
const prettyMonth=()=> 'novembro de 2026';
const fold=s=>String(s).toLowerCase();
const shiftMonth=()=> '2026-10';
const snapshot=()=>({categories:[]});
const bankSnapshot=(bank)=>bank._fixtureSnapshot;
const budgetPresentationOrder=(a,b)=>b.total-a.total;
const u3BudgetSignals=(entries,total)=>({
 exceeded:entries.filter(x=>x.hasLimit&&x.total>x.limit).length,
 near:entries.filter(x=>x.hasLimit&&x.limit>0&&x.total/x.limit>=.9&&x.total<=x.limit).length,
 unlimited:entries.filter(x=>!x.hasLimit&&x.total>0).length,
 covered:total?100:null,
 spent:entries.filter(x=>x.hasLimit).reduce((n,x)=>n+x.total,0)
});
const moneyString=x=>String(x/100);
const Harness=new Function('h','Card','Icon','fmt','prettyMonth','fold','shiftMonth','snapshot',
 'bankSnapshot','budgetPresentationOrder','u3BudgetSignals','moneyString','budgetB3Visual',
 compile('class B3Harness {'+method+'}\n')+';return B3Harness;')(
 h,Card,Icon,fmt,prettyMonth,fold,shiftMonth,snapshot,bankSnapshot,budgetPresentationOrder,
 u3BudgetSignals,moneyString,budgetB3Visual);
function makeApp(spent,limit,{mode='expense',source='manual',zeroLimit=false,unlimited=false}={}){
 const cat='Alimentação com nome extenso de categoria';
 const categories=[{name:cat,kind:mode==='income'?'income':'expense',emoji:'🍽',color:'#4287b2'}];
 const budgets=unlimited?{}:{[cat]:zeroLimit?0:limit};
 const data={budgets};
 const snap={expense:spent,income:spent,categories:[{name:cat,total:spent}],incomeCategories:[{name:cat,total:spent}]};
 const bank={data:{accounts:source==='bank'?[{id:'mock'}]:[],transactions:[],truncated:source==='bank',dailyTotals:null},_fixtureSnapshot:snap};
 const app=new Harness();
 app.state={mode:source==='bank'?'real':'demo',dashboardSource:source,month:'2026-11',
  budgetTab:mode,budgetFocus:'all',budgetSearch:'',bank,data,planning:{items:[]},showAllBudgetCategories:false};
 app.monthData=()=>snap;
 app.getCategories=()=>categories;
 app.renderSourcePicker=()=>null;
 app.setState=update=>{app.lastSetState=update;Object.assign(app.state,update)};
 return {app,cat,budgets,tree:app.renderBudgets()};
}
function allNodes(root){
 const out=[];
 const visit=x=>{if(Array.isArray(x)){x.forEach(visit);return}
  if(!x||typeof x!=='object')return;
  if('props'in x){out.push(x);visit(x.props.children);}
 };
 visit(root);return out;
}
const hasClass=(node,cls)=>String(node.props.className||'').split(/\s+/).includes(cls);
function lookup(tree,cls){return allNodes(tree).filter(n=>hasClass(n,cls))}
function textContent(node){
 if(node===null||node===undefined)return '';
 if(Array.isArray(node))return node.map(textContent).join('');
 if(typeof node!=='object')return String(node);
 return textContent(node.props?.children);
}
for(const percent of [0,10,25,50,70,90,99,100,106,150]){
 test('B3 — real renderBudgets at '+percent+'% has one arc and true label',()=>{
  const {tree}=makeApp(percent*100,10000);
  assert.equal(lookup(tree,'mf-budget-b3').length,1);
  assert.equal(lookup(tree,'mf-budget-b3-track').length,1);
  assert.equal(lookup(tree,'mf-budget-b3-fill').length,percent===0?0:1);
  assert.equal(lookup(tree,'mf-budget-b3-percent').length,1);
  assert.equal(textContent(lookup(tree,'mf-budget-b3-percent')[0]),percent+'%');
  assert.equal(lookup(tree,'progress-bar').length,0,'B3 adds no second bar');
  const dial=lookup(tree,'mf-budget-b3-dial')[0];
  assert.equal(dial.props.style['--mf-budget-b3-color'],budgetB3Color(Math.min(percent,100)));
  if(percent>0)assert.equal(lookup(tree,'mf-budget-b3-fill')[0].props.strokeDasharray,Math.min(percent,100)+' 100');
  if(percent>100)assert.match(textContent(lookup(tree,'mf-budget-b3-remaining')[0]),/Limite ultrapassado/);
 });
}
test('B3 — exact cents remain accessible and real over-limit amount is shown',()=>{
 const {tree}=makeApp(10601,10000);
 const body=textContent(lookup(tree,'mf-budget-b3')[0]);
 assert.match(body,/106%/);
 assert.match(body,/R\$ 106\.01/);
 assert.match(body,/R\$ 100\.00/);
 assert.match(body,/R\$ 6\.01/);
});
test('B3 — explicit zero limit has neither invented percent nor progress arc',()=>{
 for(const spent of [0,500]){
  const {tree}=makeApp(spent,0,{zeroLimit:true});
  assert.equal(lookup(tree,'mf-budget-b3').length,0);
  assert.equal(lookup(tree,'progress-bar').length,0);
  const t=textContent(tree);
  assert(t.includes(spent?'Acima do limite':'Limite zero definido'));
  assert.doesNotMatch(t,/100% utilizado|0% utilizado/);
 }
});
test('B3 — expenses without a registered limit keep the original define-limit action',()=>{
 const {tree}=makeApp(2000,10000,{unlimited:true});
 assert.equal(lookup(tree,'mf-budget-b3').length,0);
 assert.equal(lookup(tree,'mf-no-budget').length,1);
 assert.match(textContent(tree),/Definir limite/);
});
test('B3 — income categories continue using their original horizontal share bar',()=>{
 const {tree}=makeApp(5000,10000,{mode:'income'});
 assert.equal(lookup(tree,'mf-budget-b3').length,0);
 assert.equal(lookup(tree,'mf-income-share').length,1);
 assert.equal(lookup(tree,'progress-bar').length,1);
});
test('B3 — the selected bank snapshot renders exactly like a manual snapshot',()=>{
 const manual=makeApp(7000,10000,{source:'manual'});
 const bank=makeApp(7000,10000,{source:'bank'});
 assert.equal(textContent(lookup(manual.tree,'mf-budget-b3-percent')[0]),
  textContent(lookup(bank.tree,'mf-budget-b3-percent')[0]));
 assert.match(textContent(bank.tree),/Histórico carregado parcialmente/);
});
test('B3 — edit limit button still opens existing editor without writing budget data',()=>{
 const {app,tree,cat,budgets}=makeApp(9900,10000);
 const buttons=allNodes(tree).filter(n=>n.type==='button'&&textContent(n)==='Editar limite');
 assert.equal(buttons.length,1);
 assert.equal(typeof buttons[0].props.onClick,'function');
 buttons[0].props.onClick();
 assert.deepEqual(app.lastSetState,{editModal:{type:'budget',key:cat,title:'Editar limite · '+cat,value:'100'}});
 assert.equal(budgets[cat],10000);
});
test('B3 — stylesheet keeps one semicircle fill and reduced motion support',()=>{
 const css=fs.readFileSync(path.resolve(__dirname,'../app/decisions.css'),'utf8');
 const b3=css.slice(css.indexOf('/* B3 — velocímetro semicircular'));
 assert.match(b3,/\.mf-budget-b3-fill\s*\{[^}]*stroke:\s*var\(--mf-budget-b3-color\)/s);
 assert.match(b3,/\.mf-budget-b3-track\s*\{[^}]*stroke:\s*var\(--surface3\)/s);
 assert.match(b3,/@media \(prefers-reduced-motion: reduce\)/);
 assert.doesNotMatch(b3,/conic-gradient|radial-gradient|linear-gradient|\.progress-bar/);
});
