'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function transpile(source){
 const result=ts.transpileModule(source,{fileName:'qa84-b03-b04.ts',
  reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2019}});
 assert.deepEqual((result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error),[]);
 return result.outputText;
}
function fixture(){
 const clicks={drawer:0,manual:0};
 const tx={accountId:'bank-1',id:'bank-stream',date:'2026-11-03',
  description:'Streaming mensal',merchant:'Streaming mensal',
  category:'Assinaturas',amount:-2999,status:'POSTED',reviewed:false};
 const manual={id:'manual-1',date:'2026-11-04',description:'Assinatura teste',
  category:'Assinaturas',categoryId:'cat:assinaturas',
  subcategoryId:'sub:assinaturas/streaming',kind:'expense',amount:1700};
 class Component{
  constructor(props){this.props=props;this.state={};}
  setState(patch){this.state={...this.state,...(typeof patch==='function'?patch(this.state):patch)};}
 }
 const React={Component,createElement:(type,props,...children)=>({type,props:props||{},children})};
 const host={state:{mode:'real',txReviewOnly:false,month:'2026-11',booting:false,
  bank:{data:{transactions:[tx],accounts:[],truncated:false}},
  data:{transactions:[manual],budgets:{}}},openBankDetail:()=>{clicks.drawer++;},
  openManualDetail:()=>{clicks.manual++;}};
 const win={financeDesktop:null,innerWidth:1440,innerHeight:900,
  addEventListener(){},removeEventListener(){}};
 const doc={body:{},activeElement:null,addEventListener(){},removeEventListener(){}};
 const globals={React,h:React.createElement,ReactDOM:{createPortal:n=>n},window:win,
  document:doc,iso:()=> '2026-11-04',fromISO:()=>new Date('2026-11-04T00:00:00Z'),
  pDate:s=>s,fmt:n=>'R$ '+(n/100).toFixed(2),
  parsePositiveBRLInput:()=>100,console,Set,Map,Date,Math,Object,Array,String,Number};
 vm.createContext(globals);
 vm.runInContext(transpile(read('src/d05-visual-assets.ts'))+'\n'+
  transpile(read('src/d05-movements.ts'))+
  '\nthis.Renderer=D05Movements;',globals);
 const comp=new globals.Renderer({host});comp.alive=true;
 return {comp,host,tx,manual,clicks,win};
}
function nodes(node,all=[]){
 if(node==null||node===false)return all;
 if(Array.isArray(node)){node.forEach(n=>nodes(n,all));return all;}
 if(typeof node==='object'&&'type'in node){
  all.push(node);node.children.forEach(n=>nodes(n,all));
 }return all;
}
function words(node,all=[]){
 if(node==null||node===false)return all;
 if(Array.isArray(node)){node.forEach(n=>words(n,all));return all;}
 if(typeof node==='object'&&'type'in node){node.children.forEach(n=>words(n,all));return all;}
 if(typeof node==='string'||typeof node==='number')all.push(String(node));
 return all;
}
function one(tree,css){
 const found=nodes(tree).filter(n=>String(n.props.className||'').split(/\s+/).includes(css));
 assert(found.length,'Missing '+css);return found[0];
}
function trigger(){return {stopPropagation(){},currentTarget:{
 getBoundingClientRect:()=>({left:380,top:180,bottom:225,right:415}),
 focus(){},isConnected:true}};}
test('B03: list icon opens B04 without drawer; merchant and body open drawer without picker',()=>{
 const f=fixture(),initial=f.comp.render(),icon=one(initial,'d05-row-icon');
 assert.equal(typeof icon.props.onClick,'function');
 icon.props.onClick(trigger());
 let screen=f.comp.render();
 assert.equal(f.clicks.drawer,0);
 assert.match(words(screen).join(' '),/Categoria da movimentação/);
 const merchant=one(screen,'d05-merchant');
 merchant.props.onClick(trigger());
 assert.equal(f.clicks.drawer,1);
 const body=one(screen,'d05-row-body');
 body.props.onClick(trigger());
 assert.equal(f.clicks.drawer,2);
});
test('B03: drawer invokes SAME D05 picker by source+account+ID and preserves live child identity',()=>{
 const f=fixture();f.comp.render();
 const identity=f.comp.identityForDetail('manual',f.manual);
 assert.equal(identity.categoryId,'cat:assinaturas');
 assert.equal(identity.subcategoryId,'sub:assinaturas/streaming');
 assert.equal(f.comp.openFromDetail('bank',f.tx,trigger().currentTarget),true);
 const picker=f.comp.render();
 assert.match(words(picker).join(' '),/Categoria da movimentação/);
 assert.equal(f.clicks.drawer,0);
 assert.equal(f.comp.openFromDetail('bank',{...f.tx,accountId:'foreign'},trigger().currentTarget),false);
 assert.equal(f.comp.identityForDetail('bank',{...f.tx,accountId:'foreign'}),null);
});
test('B04: accent-insensitive subcategory search shows parent and reaches real before/after preview',()=>{
 const f=fixture();let t=f.comp.render();
 one(t,'d05-row-icon').props.onClick(trigger());t=f.comp.render();
 const input=one(t,'d05-search');
 input.props.onChange({target:{value:'streaming'}});
 t=f.comp.render();
 assert.match(words(t).join(' '),/Assinaturas ›/);
 const choices=nodes(t).filter(n=>String(n.props.className||'').includes('d05-found-child'));
 assert.equal(choices.length,1);
 assert.match(words(choices[0]).join(' '),/Streaming de vídeo/);
 choices[0].props.onClick();t=f.comp.render();
 assert.match(words(t).join(' '),/Antes:/);
 assert.match(words(t).join(' '),/Depois:/);
 assert.match(words(t).join(' '),/Streaming de vídeo/);
 assert.equal(f.clicks.drawer,0);
});
test('B03/B04: right drawer delegates without legacy bank category bypass; CSS adapts 4/3/2',()=>{
 const app=read('src/app.ts'),css=read('app/d05-movements.css');
 assert.match(app,/renderDetailDrawer\(\)/);
 assert.match(app,/mf-drawer-backdrop/);
 assert.match(app,/mf-detail-drawer/);
 assert.match(app,/openDetailD05Picker\(/);
 assert.match(app,/d05Movements=instance/);
 assert.match(app,/if\(document\.querySelector\('\.d05-overlay'\)\)return/);
 assert.match(app,/identityForDetail/);
 assert.doesNotMatch(app,/onChange:\(v:string\)=>this\.setBankCategory\(tx,v\)/);
 assert.match(css,/repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/repeat\(2,minmax\(0,1fr\)\)/);
});

test('B04: outside cancellation does not persist or open drawer',()=>{
 const f=fixture();let t=f.comp.render();
 one(t,'d05-row-icon').props.onClick(trigger());t=f.comp.render();
 const overlay=one(t,'d05-overlay'),target={};
 overlay.props.onMouseDown({target,currentTarget:target});
 assert.match(words(f.comp.render()).join(' '),/Categoria da movimentação/);
 overlay.props.onMouseDown({target,currentTarget:target});
 assert.equal(f.clicks.drawer,0);
 // A true backdrop hit closes the picker without invoking financial methods.
 overlay.props.onMouseDown({target,currentTarget:target});
 const actually={};
 overlay.props.onMouseDown({target:actually,currentTarget:actually});
 assert.doesNotMatch(words(f.comp.render()).join(' '),/Categoria da movimentação/);
});
test('B04: personal bank assignment is preview-only and never calls a write IPC',async()=>{
 const f=fixture();let confirmed=0,previewed=0;
 f.win.financeDesktop={
  d05BankAccountAuthorize:async()=>({accountId:'bank-1'}),
  d05PersonalWritePreview:async input=>{
   previewed++;return {contract:'D05/PERSONAL-SUPERVISED-PREVIEW-V1',
    changesApplied:false,after:input.target,before:[{row:{category:'Assinaturas'}}]};
  },d05PersonalWriteConfirm:async()=>{confirmed++;return {status:'applied'};}
 };
 let t=f.comp.render();one(t,'d05-row-icon').props.onClick(trigger());
 t=f.comp.render();
 const parent=nodes(t).find(n=>n.props.className?.includes?.('d05-catalog-choice')&&
  words(n).includes('Assinaturas'));
 assert(parent);parent.props.onClick();
 t=f.comp.render();
 const only=nodes(t).find(n=>n.props.className==='d05-child'&&
  words(n).join(' ').includes('Somente Assinaturas'));
 assert(only);only.props.onClick();
 t=f.comp.render();
 const confirm=one(t,'d05-confirm');await confirm.props.onClick();
 await Promise.resolve();await Promise.resolve();
 t=f.comp.render();
 assert.equal(previewed,1);
 assert.equal(confirmed,0);
 assert.match(words(t).join(' '),/Nenhum dado foi alterado/);
 assert.equal(f.clicks.drawer,0);
});
