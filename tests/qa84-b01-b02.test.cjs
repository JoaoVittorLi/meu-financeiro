'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function compiled(pathName){
 const result=ts.transpileModule(read(pathName),{fileName:pathName,reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2019}});
 const errors=(result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
  .map(x=>ts.flattenDiagnosticMessageText(x.messageText,'\n'));
 assert.deepEqual(errors,[]);
 return result.outputText;
}
function context(){
 class Component {constructor(p){this.props=p;this.state={};}setState(x){this.state={...this.state,...(typeof x==='function'?x(this.state):x)};}}
 const React={Component,createElement:(type,props,...children)=>({type,props:props||{},children})};
 const state={React,h:React.createElement,window:{innerWidth:1366,scrollY:0,financeDesktop:null},
  document:{body:{},scrollingElement:{scrollTo(){}},getElementById:()=>null},console,Map,Set};
 vm.createContext(state);
 vm.runInContext(compiled('src/d05-visual-assets.ts')+'\n'+compiled('src/qa84-overview.ts')+
  '\n'+compiled('src/qa84-budgets.ts')+'\nthis.qa84={resolveCategoryVisualIdentity,CategoryVisualGlyph,'+
  'qa84ExpenseDistribution,qa84BudgetStatus,qa84BudgetLegs,qa84BudgetDetails,qa84Ring,renderQA84BudgetCards};',state);
 return state.qa84;
}
function inspect(tree,all=[]){
 if(!tree||tree===false)return all;
 if(Array.isArray(tree)){tree.forEach(n=>inspect(n,all));return all;}
 if(typeof tree==='object'&&'type'in tree){all.push(tree);inspect(tree.children,all);}
 return all;
}
test('QA84 E1 — canonical 14×61/67 identity, approved Assinaturas hue and glyph',()=>{
 const {resolveCategoryVisualIdentity:resolve}=context();
 const parents=JSON.parse(read('electron/d05-taxonomy.json')).parents;
 const registry=JSON.parse(read('shared/d05-svg-registry.json')).glyphs;
 assert.equal(parents.length,14);
 assert.equal(parents.reduce((sum,p)=>sum+p.subcategories.length,0),61);
 assert.equal(Object.keys(registry).length,67);
 const p=resolve({categoryId:'cat:assinaturas',aggregate:true});
 assert.equal(p.iconKey,'repeat-2');assert.equal(p.hue,282);
 assert.equal(p.subcategoryId,null);
 const child=resolve({categoryId:'cat:assinaturas',subcategoryId:'sub:assinaturas/streaming'});
 assert.equal(child.iconKey,'tv');assert.equal(child.hue,270);
 assert.equal(child.source,'sub');
 const aggregate=resolve({categoryId:'cat:assinaturas',subcategoryId:'sub:assinaturas/streaming',aggregate:true});
 assert.equal(aggregate.iconKey,p.iconKey);
 assert.equal(aggregate.hue,p.hue);
});
test('QA84 E1 — legacy, null child, crossed child and unknown ID cannot invent category',()=>{
 const resolve=context().resolveCategoryVisualIdentity;
 assert.equal(resolve({categoryName:'  Assinaturas  '}).iconKey,'repeat-2');
 assert.equal(resolve({categoryId:'cat:assinaturas',subcategoryId:null}).iconKey,'repeat-2');
 const crossed=resolve({categoryId:'cat:assinaturas',subcategoryId:'sub:moradia/aluguel'});
 assert.equal(crossed.subcategoryId,null);assert.equal(crossed.iconKey,'repeat-2');
 const strange=resolve({categoryId:'cat:unknown',categoryName:'Assinaturas'});
 assert.equal(strange.source,'fallback');assert.equal(strange.iconKey,'shapes');
 assert.equal(strange.label,'Assinaturas');
 const merchant=resolve({categoryId:'cat:assinaturas',categoryName:'Netflix streaming'});
 assert.equal(merchant.iconKey,'repeat-2');
});
test('QA84 E1 — custom persists stable identity by ID; no position or merchant hash',()=>{
 const resolve=context().resolveCategoryVisualIdentity;
 const custom={id:'cat:custom:abcd',name:'Pets',kind:'expense',iconKey:'paw-print',hue:121,
  subcategories:[{id:'sub:custom-pets/medicamento',parentCategoryId:'cat:custom:abcd',name:'Medicamento',iconKey:'pill',hue:156,active:1}]};
 const a=resolve({categoryId:custom.id,catalog:[custom]});
 const b=resolve({categoryId:custom.id,catalog:[custom],categoryName:'Alterado'});
 assert.equal(a.iconKey,'paw-print');assert.equal(a.hue,121);assert.equal(a.source,'custom');
 assert.equal(a.iconKey,b.iconKey);assert.equal(a.hue,b.hue);
 const child=resolve({categoryId:custom.id,subcategoryId:custom.subcategories[0].id,catalog:[custom]});
 assert.equal(child.iconKey,'pill');assert.equal(child.hue,156);
 const noStyle=resolve({categoryId:'cat:custom:z',custom:{id:'cat:custom:z',name:'Legado',iconKey:'inexistente',hue:null}});
 assert.equal(noStyle.iconKey,'shapes');assert.equal(noStyle.hue,215);
});
test('QA84 B01 — complete denominator, unclassified remainder, exact 100.0%, no top-five rescale',()=>{
 const model=context().qa84ExpenseDistribution([
  {name:'Alimentação',total:5100},{name:'Moradia',total:2500},{name:'Transporte',total:1200}],10000);
 assert.equal(model.status,'ok');assert.equal(model.total,10000);
 assert.equal(model.rows.length,4);
 assert.equal(model.rows.find(x=>x.isRemainder).total,1200);
 assert.equal(model.rows.reduce((n,x)=>n+x.total,0),10000);
 assert.equal(model.rows.reduce((n,x)=>n+x.units,0),1000);
 assert.equal(model.rows.reduce((n,x)=>n+x.percent,0),100);
 assert.equal(model.rows[0].percent,51);
 const over=context().qa84ExpenseDistribution([{name:'A',total:11001}],10000);
 assert.equal(over.status,'inconsistent');
 assert.equal(context().qa84ExpenseDistribution([],0).status,'empty');
});
test('QA84 B02 — ring is 360 degrees, zero and unlimited differ, >100% stays real',()=>{
 const {qa84BudgetStatus:model,qa84Ring:ring}=context();
 assert.equal(model(1200,null,false).status,'unlimited');
 const zero=model(1200,0,true);
 assert.equal(zero.status,'zero');assert.equal(zero.usedPercent,null);
 assert.equal(zero.remaining,-1200);assert.equal(zero.arcPercent,0);
 const exceeded=model(18000,10000,true);
 assert.equal(exceeded.status,'exceeded');assert.equal(exceeded.usedPercent,180);
 assert.equal(exceeded.arcPercent,100);assert.equal(exceeded.remaining,-8000);
 assert.equal(model(9000,10000,true).status,'near');
 assert.equal(model(10000,10000,true).status,'near');
 const elements=inspect(ring(100,'exceeded','R$ 80,00','Excedido'));
 assert.equal(elements.filter(x=>x.type==='circle').length,2);
 assert.equal(elements.filter(x=>x.type==='path').length,0);
 assert.equal(elements.filter(x=>x.type==='button').length,0);
});
test('QA84 B02 — bank POSTED-only split allocations, parent equals children + null',()=>{
 const {qa84BudgetLegs:legs,qa84BudgetDetails:details}=context();
 const bank=[
 {accountId:'a1',id:'i1',date:'2026-11-10',description:'Dividida',amount:-8500,
  status:'POSTED',category:'Alimentação',splits:[
   {category:'Alimentação',categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery',amount:4500},
   {category:'Alimentação',categoryId:'cat:alimentacao',subcategoryId:null,amount:4000}]},
 {accountId:'a1',id:'i2',date:'2026-11-09',description:'Sem filho',amount:-500,status:'POSTED',
  category:'Alimentação',categoryId:'cat:alimentacao',subcategoryId:null},
 {accountId:'a1',id:'i3',date:'2026-11-08',description:'Pendente',amount:-1200,status:'PENDING',category:'Alimentação'},
 {accountId:'a1',id:'i4',date:'2026-11-07',description:'Transferência',amount:-600,
  status:'POSTED',nature:'transfer',category:'Alimentação'},
 {accountId:'a1',id:'i5',date:'2026-11-06',description:'Duas categorias',amount:-1000,
  status:'POSTED',category:'Alimentação',splits:[
   {category:'Alimentação',categoryId:'cat:alimentacao',subcategoryId:null,amount:600},
   {category:'Transporte',categoryId:'cat:transporte',subcategoryId:null,amount:400}]}
 ];
 const allocated=legs(bank,'bank','2026-11-01','2026-11-30');
 assert.equal(allocated.length,5);
 const result=details(allocated,'Alimentação',9600);
 assert.equal(result.total,9600);assert.equal(result.complete,true);
 assert.equal(result.groups.reduce((n,x)=>n+x.total,0),9600);
 assert.equal(result.groups.find(x=>x.subcategoryId===null).total,5100);
 assert.equal(result.groups.find(x=>x.subcategoryId==='sub:alimentacao/delivery').total,4500);
 assert.equal(details(allocated,'Alimentação',9700).complete,false);
 assert.equal(details(allocated,'Alimentação',9600,[],true).complete,false);
});
test('QA84 B02 — manual subcategory=null is real, foreign child is not silently reparented',()=>{
 const {qa84BudgetLegs:legs,qa84BudgetDetails:details}=context();
 const manual=[
 {id:'m1',date:'2026-11-01',description:'Sem filho',kind:'expense',amount:6000,category:'Assinaturas',categoryId:'cat:assinaturas',subcategoryId:null},
 {id:'m2',date:'2026-11-02',description:'Streaming',kind:'expense',amount:3000,category:'Assinaturas',categoryId:'cat:assinaturas',subcategoryId:'sub:assinaturas/streaming'},
 {id:'m3',date:'2026-11-03',description:'Receita',kind:'income',amount:300000,category:'Assinaturas'}
 ];
 const parts=legs(manual,'manual','2026-11-01','2026-11-30');
 assert.equal(parts.length,2);
 const result=details(parts,'Assinaturas',9000);
 assert.equal(result.complete,true);
 assert.equal(result.groups.find(x=>x.subcategoryId===null).total,6000);
 const damaged=parts.concat([{...parts[0],key:'m4',amount:1,subcategoryId:'sub:moradia/aluguel'}]);
 const falseParent=details(damaged,'Assinaturas',9001);
 assert.equal(falseParent.complete,false);
 assert.match(falseParent.reason,/não correspondem/);
});
test('QA84 — renderer wiring / source preservation / CSS a11y without financial mutations',()=>{
 const app=read('src/app.ts'),tx=read('src/d05-movements.ts');
 const css=read('app/qa84-b01-b02.css'),html=read('app/index.html');
 const config=JSON.parse(read('tsconfig.json'));
 assert.equal(config.files[0],'src/d05-visual-assets.ts');
 assert.match(app,/renderQA84OverviewCategories\(this,s\.categories,s\.expense,useBank,hidden\)/);
 assert.match(app,/renderQA84BudgetCards\(this,visible,mode,total,useBank,suggestLimit\)/);
 assert.match(app,/renderQA84BudgetDetail\(this,\{\}\)/);
 assert.match(tx,/resolveCategoryVisualIdentity\(\{categoryId:r\.categoryId/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/qa84-category-track/);
 assert.match(html,/qa84-b01-b02\.css/);
 assert.doesNotMatch(read('src/qa84-overview.ts'),/palette\[|index.*hue/i);
 assert.doesNotMatch(read('src/qa84-budgets.ts'),/ipcRenderer\.invoke|finance\.save\(/);
});
