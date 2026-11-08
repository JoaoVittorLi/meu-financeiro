'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'src/app.ts'),'utf8');
const plan=fs.readFileSync(path.join(root,'src/plan-view.ts'),'utf8');
const ai=fs.readFileSync(path.join(root,'src/intelligence-view.ts'),'utf8');
const css=fs.readFileSync(path.join(root,'app/style.css'),'utf8');
const aiCss=fs.readFileSync(path.join(root,'app/intelligence.css'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

const h=(name,props,...children)=>({name,props:props||{},children});
function walk(node,accept,result=[]){
 if(Array.isArray(node)){for(const child of node)walk(child,accept,result);return result;}
 if(node===null||node===undefined||typeof node!=='object')return result;
 if(accept(node))result.push(node);
 if(node.children)walk(node.children,accept,result);
 return result;
}
function extract(text,start,end){
 const first=text.indexOf(start),last=text.indexOf(end,first+start.length);
 assert.ok(first>=0&&last>first,'source boundary missing: '+start);
 return text.slice(first,last);
}
function compile(source,ret,dependencies){
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
 return new Function(...Object.keys(dependencies),code+';return '+ret+';')(...Object.values(dependencies));
}
function fmt(v){return 'R$ '+(v/100).toFixed(2);}
function localIso(d){
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function luminance(hex){
 const channels=(hex.replace('#','').match(/../g)||[]).map(c=>parseInt(c,16)/255);
 assert.equal(channels.length,3);
 const rgb=channels.map(c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4));
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function token(name){
 const m=css.match(new RegExp('--mf-'+name+':(#[0-9A-Fa-f]{6})'));
 assert.ok(m,'token not defined: '+name);
 return m[1];
}
test('UI03 design tokens pass core WCAG 2.2 AA text/background ratios',()=>{
 const base=token('surface'),raised=token('raised');
 for(const [fg,bg]of [
   ['primary',base],['secondary',base],['muted-readable',base],['accent',base],
   ['secondary',raised],['positive',base],['negative',base]
 ])assert.ok(contrast(token(fg),bg)>=4.5,fg+' has insufficient contrast');
 assert.ok(contrast('#FFFFFF',token('accent-solid'))>=4.5,'primary button text contrast');
});

test('UI03 chart renders distinct local-currency ticks and accessible table',()=>{
 const {financialAxisLabel,Chart}=compile(
   extract(app,'function financialAxisLabel(','function Donut('),
   '{financialAxisLabel,Chart}',{h,fmt,monthShort:ym=>ym});
 const amounts=[0,2990,100000,100000000];
 for(const amount of amounts){
  const upper=Math.max(4,amount)*1.14;
  const values=[0,.25,.5,.75,1].map(x=>financialAxisLabel(upper*x,upper));
  assert.equal(new Set(values).size,5,'axis ticks repeated for '+amount);
 }
 const graph=Chart({data:[{month:'2026-10',income:0,expense:0},{month:'2026-11',income:2990,expense:2300}]});
 const ticks=walk(graph,x=>x.name==='text'&&x.props.x===3).map(x=>x.children.join(''));
 assert.equal(new Set(ticks).size,5);
 assert.equal(walk(graph,x=>x.name==='details').length,1);
 assert.equal(walk(graph,x=>x.name==='table').length,1);
 assert.equal(walk(graph,x=>x.name==='tbody')[0].children[0].length,2);
});

test('UI03 donut groups after five categories but exposes all exact amounts',()=>{
 const Donut=compile(extract(app,'function Donut(','type Choice = {value:string;label:string};'),
   'Donut',{h,fmt,COLORS:['#A981FF'],CATS:[]});
 const items=[30000,20000,18000,16000,8000,6000,2000].map((total,i)=>({name:'Categoria '+i,total}));
 const rendered=Donut({items,colors:{}});
 const legend=walk(rendered,n=>n.name==='div'&&n.props.className==='legend-row');
 assert.equal(legend.length,6,'top five plus Outras');
 const details=walk(rendered,n=>n.name==='details'&&n.props.className==='donut-all-categories');
 assert.equal(details.length,1);
 const full=walk(details[0],n=>n.name==='div'&&n.props.className==='donut-all-list');
 assert.equal(full[0].children[0].length,items.length);
 assert.equal(items.reduce((sum,x)=>sum+x.total,0),100000);
});

test('UI03 seven-day agenda is computed only from planned unpaid expenses',()=>{
 const pUpcoming=compile(extract(plan,'function pUpcoming(','function pSummary('),'pUpcoming',
   {h,iso:localIso,fmt,pDate:x=>x});
 const today=localIso(new Date());
 const later=new Date();later.setDate(later.getDate()+2);
 const after=new Date();after.setDate(after.getDate()+10);
 const events=[
   {id:'a',status:'planned',kind:'expense',remaining:100000,dueDate:today,title:'Aluguel',category:'Moradia'},
   {id:'b',status:'planned',kind:'income',remaining:200000,dueDate:today,title:'Receita',category:'Salário'},
   {id:'c',status:'paid',kind:'expense',remaining:10000,dueDate:today,title:'Pago',category:'Outros'},
   {id:'d',status:'planned',kind:'expense',remaining:5000,dueDate:localIso(later),title:'Internet',category:'Contas'},
   {id:'e',status:'planned',kind:'expense',remaining:10000,dueDate:localIso(after),title:'Fora',category:'Outros'}
 ];
 const visited=[];
 const rendered=pUpcoming({state:{planning:{items:events}},openPlanDetail:id=>visited.push(id)});
 const rows=walk(rendered,n=>n.name==='button'&&n.props.className==='p-upcoming-row');
 assert.equal(rows.length,2);
 rows[0].props.onClick();
 assert.deepEqual(visited,['a']);
 const firstHeading=walk(rendered,n=>n.name==='div'&&n.props.className==='p-section-heading')[0];
 assert.ok(JSON.stringify(firstHeading).includes('R$ 1050.00'));
 // Guard both branches of the nested conditional/map that previously broke TS compilation.
 const empty=pUpcoming({state:{planning:{items:[]}},openPlanDetail:()=>{}});
 assert.equal(walk(empty,n=>n.name==='button'&&n.props.className==='p-upcoming-row').length,0);
 assert.match(JSON.stringify(empty),/Nenhuma despesa pendente/);
 const multiple=Array.from({length:7},(_,i)=>({...events[0],id:'extra-'+i,dueDate:today}));
 const overflow=pUpcoming({state:{planning:{items:multiple}},openPlanDetail:()=>{}});
 assert.equal(walk(overflow,n=>n.name==='button'&&n.props.className==='p-upcoming-row').length,5);
 assert.match(JSON.stringify(overflow),/Mais 2 compromisso\(s\)/);
});

test('UI03 planning prioritizes upcoming commitments and agenda before graph',()=>{
 const display=extract(plan,'function renderPlanningView(','function renderPlanEditor(');
 assert.ok(display.indexOf('pUpcoming(app)')<display.indexOf('pSummary(app)'));
 assert.ok(display.indexOf("className:'p-ledger'")<display.indexOf('pTimeline(app)'));
 assert.match(plan,/p\.projection\.reference\?\.quality==='incomplete'/);
 assert.match(plan,/planIncludeEstimated/);
});

test('UI03 daily information hierarchy covers all eight sections',()=>{
 const overview=extract(app,'renderOverview(){','renderTransactions(){');
 assert.ok(overview.indexOf("className:'stats-grid'")<overview.indexOf("className:'mf-plan-shortcut'"));
 const banks=extract(app,'renderBanks(){','renderSettings(){');
 assert.ok(banks.indexOf('mf-accounts-first')<banks.indexOf("className:'bank-grid'"));
 assert.match(app,/className:'[^']*\bmf-compact-banner\b[^']*'/);
 assert.match(app,/className:'[^']*\bmf-budget-section\b[^']*'/);
 assert.match(css,/\.mf-budget-section \.budget-grid\{grid-template-columns:1fr/);
 assert.match(app,/renderAssistant\(includeBanner:boolean=true\)/);
 assert.match(app,/renderSettings\(\)/);
 assert.match(ai,/mf-ai-lab-disclosure/);
 assert.match(aiCss,/\.mf-ai-lab-disclosure>summary:focus-visible/);
 assert.match(app,/renderTransactions\(\)/);
 assert.match(app,/renderSourcePicker\(\)/);
});

test('UI03 retains B02 category button after donut and chart redesign',()=>{
 const Category=compile(extract(app,'function TransactionCategoryButton(','type Choice = {value:string;label:string};'),
   'TransactionCategoryButton',{h});
 let clicks=0;
 const button=Category({category:'Alimentação',emoji:'🍕',
   label:'Editar categoria da conta fictícia A',onClick:()=>clicks++});
 assert.equal(button.name,'button');
 assert.equal(button.props.type,'button');
 assert.match(button.props.className,/mf-category-edit/);
 assert.match(button.props['aria-label'],/conta fictícia A/);
 button.props.onClick();
 assert.equal(clicks,1);
 assert.match(app,/h\(TransactionCategoryButton,\{category:t\.category/);
});

test('UI03 does not introduce new financial engines or changes to data identity',()=>{
 assert.match(app,/bankCategorize\(\{accountId:tx\.accountId,externalId:tx\.id,category:/);
 assert.match(app,/this\.updateData\(\{\.\.\.data,transactions:data\.transactions\.map/);
 assert.match(app,/bankSnapshotBetween\(bank,start,end\)/);
 assert.match(plan,/p\.projection\.negativeDays/); // Any financial warning remains visible in planning source.
 assert.ok(!app.includes('v0.9.5-beta.4'),'old version labels must be absent');
 assert.equal(pkg.version,'0.9.5-beta.5');
 assert.equal((app.match(/v0\.9\.5-beta\.5/g)||[]).length,3);
 assert.match(pkg.scripts['dist:windows'],/provenance:create/);
});
