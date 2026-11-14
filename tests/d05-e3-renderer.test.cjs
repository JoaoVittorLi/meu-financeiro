'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const visual=read('src/d05-visual-assets.ts');
const renderer=read('src/d05-movements.ts');
const stylesheet=read('app/d05-movements.css');
const vendor=read('app/vendor/react.min.js');

function transpile(source){
 const result=ts.transpileModule(source,{fileName:'d05-e3.ts',reportDiagnostics:true,
   compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2019}});
 const errors=(result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
 assert.deepEqual(errors.map(x=>ts.flattenDiagnosticMessageText(x.messageText,'\n')),[]);
 return result.outputText;
}
function fixture(){
 const nodes=[];
 class Component{
  constructor(props){this.props=props;this.state={};}
  setState(patch){this.state={...this.state,...(typeof patch==='function'?patch(this.state):patch)};}
 }
 const React={
  Component,createElement:(type,props,...children)=>{const value={type,props:props||{},children};nodes.push(value);return value;}
 };
 const document={body:{},addEventListener(){},removeEventListener(){},activeElement:null};
 const win={financeDesktop:null,innerWidth:1366,innerHeight:768,addEventListener(){},removeEventListener(){}};
 const sandbox={React,ReactDOM:{createPortal:child=>child},window:win,document,
  iso:()=> '2026-11-14',fromISO:()=>new Date('2026-11-14T00:00:00Z'),
  pDate:d=>d,fmt:n=>'R$'+(n/100).toFixed(2),parsePositiveBRLInput:()=>100,
  console,Set,Map,Date,Math,Object,Array,String,Number};
 vm.createContext(sandbox);
 vm.runInContext(transpile(visual)+'\n'+transpile(renderer)+'\nthis.D05Component=D05Movements;',sandbox);
 const host={state:{mode:'real',month:'2026-11',booting:false,bank:{data:{
   truncated:false,totalTransactions:3,accounts:[{id:'account-1',name:'Conta sintética'}],
   transactions:[
    {accountId:'account-1',id:'bank-a',date:'2026-11-01',description:'Café sintético',merchant:'Café sintético',category:'Alimentação',amount:-5999,status:'POSTED',reviewed:false},
    {accountId:'account-1',id:'bank-b',date:'2026-11-02',description:'Entrada sintética',category:'Salário',amount:20000,status:'POSTED',reviewed:true},
    {accountId:'account-1',id:'bank-c',date:'2026-11-03',description:'Uber sintético',category:'Transporte',amount:-1000,status:'PENDING',reviewed:false}
   ]}},data:{transactions:[{id:'man-1',date:'2026-11-04',description:'Manual sintético',category:'Outros',kind:'income',amount:3000}]}}};
 const component=new sandbox.D05Component({host});
 return {component,nodes,host};
}
function flatten(node,result=[]){
 if(node==null||node===false)return result;
 if(Array.isArray(node)){node.forEach(x=>flatten(x,result));return result;}
 if(typeof node==='object'&&'type'in node){result.push(node);flatten(node.children,result);}
 return result;
}
function texts(node,result=[]){
 if(node==null||node===false)return result;
 if(Array.isArray(node)){node.forEach(x=>texts(x,result));return result;}
 if(typeof node==='object'&&'type'in node){texts(node.children,result);return result;}
 if(typeof node==='string'||typeof node==='number')result.push(String(node));
 return result;
}

test('D05 E3 — bundle compila para JS compatível com React 16.0 sem hooks ou Fragment',()=>{
 assert.match(vendor,/React v16\.0\.0/);
 assert.doesNotMatch(renderer,/React\.useState|React\.useEffect|React\.Fragment/);
 assert.match(renderer,/extends React\.Component/);
 assert.match(transpile(visual),/D05_APPROVED_GLYPHS/);
 assert.match(transpile(renderer),/D05Movements/);
});
test('D05 E3 — 14 pais, 61 filhos e 67 glyphs renderizáveis sem emoji como ícone',()=>{
 const parents=JSON.parse(read('electron/d05-taxonomy.json')).parents;
 const registry=JSON.parse(read('shared/d05-svg-registry.json'));
 assert.equal(parents.length,14);
 assert.equal(parents.reduce((n,p)=>n+p.subcategories.length,0),61);
 assert.equal(Object.keys(registry.glyphs).length,67);
 for(const p of parents){
  assert(p.iconKey in registry.glyphs);
  for(const child of p.subcategories){
   assert(child.iconKey in registry.glyphs);
   assert.equal(child.parentId,p.id);
  }
 }
 assert.doesNotMatch(renderer,/type:'checkbox'|React\.Fragment/);
});
test('D05 E3 — quatro KPIs, POSTED e PENDING separados, revisão apenas banco confirmado',()=>{
 const f=fixture();
 const tree=f.component.render();
 const flat=flatten(tree);
 const text=texts(tree).join(' ');
 const metricElements=flat.filter(x=>typeof x.props.className==='string'&&x.props.className.includes('d05-metric'));
 assert.equal(metricElements.length,4);
 assert.match(text,/Entradas confirmadas/);
 assert.match(text,/Saídas confirmadas/);
 assert.match(text,/Resultado dos registros/);
 assert.match(text,/A conferir/);
 assert.match(text,/R\$200\.00/);
 assert.match(text,/R\$59\.99/);
 assert.match(text,/R\$140\.01/);
 const reviewButtons=flat.filter(x=>x.props.className==='d05-review-dot');
 assert.equal(reviewButtons.length,1);
 const pending=flat.filter(x=>x.props.className==='d05-pending');
 assert.equal(pending.length,1);
 assert.equal(flat.filter(x=>String(x.props.className||'').startsWith('d05-row ')).length,4);
});
test('D05 E3 — modo demonstração não consulta nem mistura dados bancários reais',()=>{
 const f=fixture();
 f.host.state.mode='demo';
 const tree=f.component.render();
 const flat=flatten(tree);
 assert.equal(flat.filter(x=>String(x.props.className||'').startsWith('d05-row ')).length,1);
 assert.equal(flat.filter(x=>x.props.className==='d05-review-dot').length,0);
});
test('D05 E3 — CSS dark/light, foco e reduced-motion; integração monta no App real',()=>{
 assert.match(stylesheet,/\[data-theme="light"\]/);
 assert.match(stylesheet,/prefers-reduced-motion:reduce/);
 assert.match(stylesheet,/:focus-visible/);
 assert.match(stylesheet,/d05-review-dot/);
 const app=read('src/app.ts');
 assert.match(app,/return h\(D05Movements,\{host:this\}\)/);
 const config=JSON.parse(read('tsconfig.json'));
 assert(config.files.includes('src/d05-visual-assets.ts'));
 assert(config.files.includes('src/d05-movements.ts'));
 assert.match(read('app/index.html'),/d05-movements\.css/);
});
