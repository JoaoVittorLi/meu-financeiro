'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const ROOT=path.resolve(__dirname,'..');
const read=path=>fs.readFileSync(require('node:path').join(ROOT,path),'utf8');
const transpile=(src,name)=>ts.transpileModule(src,{fileName:name,
 compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
const visual=read('src/d05-visual-assets.ts'),adapter=read('src/qa84-b03-b04-bridge.ts');
const renderer=read('src/d05-movements.ts');
const compiled=transpile(visual,'d05-visual-assets.ts')+'\n'+transpile(adapter,'qa84-b03-b04-bridge.ts')+
 '\n'+transpile(renderer,'d05-movements.ts')+'\nthis.Component=D05Movements;'+
 'this.D05_APPROVED_PARENTS=D05_APPROVED_PARENTS;'+
 'this.search=qa84B04Search;this.geometry=qa84B04Geometry;this.identity=qa84B03Visual;';
function flat(node,out=[]){
 if(node==null||node===false)return out;
 if(Array.isArray(node)){node.forEach(x=>flat(x,out));return out;}
 if(typeof node==='object'&&'type'in node){out.push(node);flat(node.children,out);}
 return out;
}
function textOf(node){
 if(node==null||node===false)return '';
 if(Array.isArray(node))return node.map(textOf).join(' ');
 if(typeof node==='object'&&'type'in node)return textOf(node.children);
 return String(node);
}
function fixture(mode='real',bridge=null){
 const calls=[],handlers=new Map();
 class Component{
  constructor(props){this.props=props;this.state={};}
  setState(patch){this.state={...this.state,...(typeof patch==='function'?patch(this.state):patch)};}
 }
 const React={Component,createElement:(type,props,...children)=>({type,props:props||{},children})};
 const win={financeDesktop:bridge,innerWidth:1366,innerHeight:768,
  addEventListener:(n,fn)=>handlers.set(n,fn),
  removeEventListener:(n,fn)=>{if(handlers.get(n)===fn)handlers.delete(n);},
  dispatchEvent:e=>{handlers.get(e.type)?.(e);return true;}};
 const manual={id:'manual-1',description:'Assinatura sintética',date:'2026-11-10',
  kind:'expense',amount:6000,category:'Assinaturas',categoryId:'cat:assinaturas',
  subcategoryId:null,origin:'manual'};
 const bank={id:'bank-1',accountId:'account-1',accountName:'Conta sintética',date:'2026-11-10',
  description:'Compra sintética',merchant:'Compra sintética',amount:-10000,
  category:'Assinaturas',status:'POSTED',reviewed:false};
 const host={state:{mode,booting:false,month:'2026-11',txReviewOnly:false,
  data:{version:5,transactions:[manual],budgets:{},settings:{}},
  bank:{data:{transactions:[bank],accounts:[{id:'account-1',name:'Conta sintética'}],
   totalTransactions:1,truncated:false}}},
  openManualDetail:(tx,context)=>calls.push({action:'drawer',source:'manual',tx,context}),
  openBankDetail:(tx,context)=>calls.push({action:'drawer',source:'bank',tx,context}),
  updateData:async(data)=>{calls.push({action:'save',data});host.state.data=data;return true;},
  refreshBank:async()=>({data:host.state.bank.data}),
  setState:()=>{},
  csvInput:null};
 const ctx={React,h:React.createElement,ReactDOM:{createPortal:node=>node},
  window:win,document:{body:{},activeElement:null},
  CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
  iso:()=> '2026-11-10',fromISO:x=>new Date(x+'T00:00:00Z'),
  pDate:x=>x,fmt:n=>'R$'+(n/100).toFixed(2),parsePositiveBRLInput:()=>100,
  console,Date,Map,Set,Math,Object,Array,Number,String};
 vm.createContext(ctx);vm.runInContext(compiled,ctx);
 const instance=new ctx.Component({host});
 instance.render();instance.componentDidMount();
 const render=()=>flat(instance.render());
 const find=(part)=>render().find(n=>String(n.props.className||'').split(' ').includes(part));
 const trigger={focus(){calls.push({action:'focus'});},
  getBoundingClientRect:()=>({left:115,top:100,bottom:143,width:42,height:43})};
 const click=(node)=>{assert(node);let stopped=false;
  const e={currentTarget:trigger,target:trigger,stopPropagation:()=>{stopped=true;}};
  node.props.onClick(e);return stopped;};
 return {ctx,host,win,instance,render,find,click,calls,trigger,manual,bank};
}
test('B03 V2: icon opens only B04; body opens original right drawer; selection/review never double-fire',()=>{
 const f=fixture('real');
 const icon=f.find('d05-row-icon'),merchant=f.find('d05-merchant');
 assert(icon&&merchant);
 assert.equal(f.click(icon),true);
 assert(f.find('d05-picker'),'Direct icon click must open one B04');
 assert.equal(f.calls.filter(x=>x.action==='drawer').length,0);
 assert.equal(f.click(merchant),true);
 assert.equal(f.calls.filter(x=>x.action==='drawer').length,1);
 assert.equal(f.calls.at(-1).source,'bank');
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1).context)),
  {categoryId:'cat:assinaturas',subcategoryId:null});
 const select=f.find('d05-select');assert.equal(f.click(select),true);
 assert.equal(f.calls.filter(x=>x.action==='drawer').length,1);
 const review=f.find('d05-review-dot');assert.equal(f.click(review),true);
 assert.equal(f.calls.filter(x=>x.action==='drawer').length,1);
 const body=f.find('d05-row');
 f.click(body);
 assert.equal(f.calls.filter(x=>x.action==='drawer').length,2);
});
test('B03 V2: App drawer requests the same single selector without creating another classifier',()=>{
 const f=fixture('real');
 const e={type:'mf2:d05:open-picker',detail:{source:'bank',id:'bank-1',accountId:'account-1',trigger:f.trigger}};
 f.win.dispatchEvent(e);
 assert(f.find('d05-picker'));
 assert.equal(f.calls.some(x=>x.action==='drawer'),false);
 const before=textOf(f.render());
 f.win.dispatchEvent({type:'mf2:d05:open-picker',detail:{source:'bank',id:'wrong',accountId:'account-1',trigger:f.trigger}});
 assert.equal(f.calls.some(x=>x.action==='save'),false);
 assert.match(before,/Categoria da movimentação/);
});
test('B04 V2: accent-insensitive global search resolves child under its true parent',()=>{
 const f=fixture();
 const matches=f.ctx.search(f.ctx.D05_APPROVED_PARENTS,'Stréaming');
 assert.equal(matches.length,1);
 assert.equal(matches[0].parent.id,'cat:assinaturas');
 assert(matches[0].children.some(c=>c.id==='sub:assinaturas/streaming'));
 assert.equal(f.ctx.search(f.ctx.D05_APPROVED_PARENTS,'Assinaturas')[0].children.length,0);
 const icon=f.find('d05-row-icon');f.click(icon);
 const search=f.render().find(n=>n.props.placeholder?.includes('Streaming'));
 assert(search);
 search.props.onChange({target:{value:'Streaming'}});
 const tree=f.render();
 assert.match(textOf(tree),/Assinaturas › Streaming de vídeo/);
 const child=tree.find(n=>n.type==='button'&&textOf(n).includes('Assinaturas › Streaming de vídeo'));
 f.click(child);
 assert.match(textOf(f.render()),/Conferir prévia antes de salvar/);
 assert.equal(f.calls.some(c=>c.action==='save'),false);
});
test('B04 V2: read-only real manual selection never mutates personal SQLite just by choosing',async()=>{
 const bridge={
  d05SessionAuthorize:async()=>({profile:'real'}),
  d05Catalog:async()=>({parents:[]}),
  d05BankList:async()=>({items:[]}),
  d05ManualList:async()=>({items:[]}),
  d05PersonalWritePreview:async()=>({
   contract:'D05/PERSONAL-SUPERVISED-PREVIEW-V1',changesApplied:false,
   before:{category:'Assinaturas'},after:{categoryId:'cat:assinaturas',
    subcategoryId:'sub:assinaturas/streaming'}
  })
 };
 const f=fixture('real',bridge);
 // There are two records: choose manual by the second icon.
 const icons=f.render().filter(n=>String(n.props.className||'').includes('d05-row-icon'));
 assert.equal(icons.length,2);
 f.click(icons[1]);
 const parent=f.render().find(n=>n.props.className?.includes('d05-catalog-choice')&&textOf(n).includes('Assinaturas'));
 f.click(parent);
 const child=f.render().find(n=>n.props.className==='d05-child'&&textOf(n).includes('Streaming'));
 f.click(child);
 const confirm=f.render().find(n=>n.props.className==='d05-confirm');
 f.click(confirm);
 await new Promise(resolve=>setImmediate(resolve));
 const tree=f.render();
 assert.match(textOf(tree),/Gravação pessoal ainda não autorizada/);
 assert.equal(f.render().filter(n=>n.props.className==='d05-confirm').length,0);
 assert.equal(f.calls.filter(c=>c.action==='save').length,0);
});
test('B04 V2: a demo-only manual change needs two separate confirmations and readback',async()=>{
 let f;
 const bridge={
  d05SessionAuthorize:async()=>({profile:'demo'}),
  d05Catalog:async()=>({parents:[]}),
  d05ManualList:async()=>({items:[]}),
  save:async()=>({ok:true}),
  load:async()=>f.host.state.data
 };
 f=fixture('demo',bridge);
 const icons=f.render().filter(n=>String(n.props.className||'').includes('d05-row-icon'));
 assert.equal(icons.length,1);
 f.click(icons[0]);
 const parent=f.render().find(n=>n.props.className?.includes('d05-catalog-choice')&&textOf(n).includes('Assinaturas'));
 f.click(parent);
 const child=f.render().find(n=>n.props.className==='d05-child'&&textOf(n).includes('Streaming'));
 f.click(child);
 assert.equal(f.calls.filter(x=>x.action==='save').length,0);
 const previewButton=f.render().find(n=>n.props.className==='d05-confirm');
 assert.match(textOf(previewButton),/Conferir prévia/);
 f.click(previewButton);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.calls.filter(x=>x.action==='save').length,0,'Selecting is not saving');
 const applyButton=f.render().find(n=>n.props.className==='d05-confirm');
 assert.match(textOf(applyButton),/Reconfirmar e salvar demonstração/);
 assert.equal(applyButton.props.disabled,false);
 f.click(applyButton);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.calls.filter(x=>x.action==='save').length,1);
 assert.equal(f.host.state.data.transactions[0].amount,6000);
 assert.equal(f.host.state.data.transactions[0].subcategoryId,'sub:assinaturas/streaming');
 assert.equal(f.calls.some(x=>x.action==='drawer'),false);
});
test('B04 V2: Escape cancels only picker and restores its origin trigger',()=>{
 const f=fixture('real');
 f.click(f.find('d05-row-icon'));
 f.instance.render();f.instance.componentDidUpdate();
 let cancelled=0,stopped=0;
 f.win.dispatchEvent({type:'keydown',key:'Escape',
  preventDefault(){cancelled++;},stopPropagation(){stopped++;}});
 assert.equal(cancelled,1);assert.equal(stopped,1);
 assert.equal(f.find('d05-picker'),undefined);
 assert(f.calls.some(x=>x.action==='focus'));
});
test('B04 V2: bank batch shows verified counts and never enables personal commit',async()=>{
 let applied=0;
 const bridge={
  d05SessionAuthorize:async()=>({profile:'real'}),
  d05Catalog:async()=>({parents:[]}),
  d05BankList:async()=>({items:[]}),
  d05ManualList:async()=>({items:[]}),
  d05BankBatchPreview:async()=>({contract:'D05/BANK-BATCH-PREVIEW-V1',
   previewVersion:'a'.repeat(64),count:1,posted:1,pending:0,changesApplied:false}),
  d05BankBatchApply:async()=>{applied++;throw Error('Real personal write disabled');}
 };
 const f=fixture('real',bridge);
 const selected=f.find('d05-select');f.click(selected);
 const bulk=f.render().find(n=>n.type==='button'&&textOf(n).includes('Categorizar seleção'));
 f.click(bulk);
 const parent=f.render().find(n=>n.props.className?.includes('d05-catalog-choice')&&textOf(n).includes('Assinaturas'));
 f.click(parent);
 const child=f.render().find(n=>n.props.className==='d05-child'&&textOf(n).includes('Streaming'));
 f.click(child);
 const prepare=f.render().find(n=>n.props.className==='d05-confirm');
 f.click(prepare);
 await new Promise(resolve=>setImmediate(resolve));
 const tree=f.render();
 assert.match(textOf(tree),/POSTED: 1/);
 assert.match(textOf(tree),/Classificação em lote pessoal ainda não homologada/);
 const button=tree.find(n=>n.props.className==='d05-confirm');
 assert.equal(button.props.disabled,true);
 assert.equal(applied,0);
});
test('B04 V2: official B01/B02 global identity takes precedence without second palette',()=>{
 const f=fixture();
 const original=f.ctx.identity({categoryId:'cat:assinaturas',subcategoryId:'sub:assinaturas/streaming'});
 assert.equal(original.iconKey,'tv');
 assert.equal(original.hue,270);
 f.win.resolveCategoryVisualIdentity=()=>({iconKey:'headphones',hue:277,label:'Música e áudio',source:'sub'});
 const delegated=f.ctx.identity({categoryId:'cat:assinaturas',subcategoryId:'sub:assinaturas/musica'});
 assert.equal(delegated.iconKey,'headphones');
 assert.equal(delegated.hue,277);
 f.win.resolveCategoryVisualIdentity=null;
 const unknown=f.ctx.identity({categoryId:'cat:missing',categoryName:'Nome legado'});
 assert.equal(unknown.iconKey,'shapes');
 assert.equal(unknown.label,'Nome legado');
});
test('B04 V2: responsive geometry never clips and batch flow retains previewVersion with honest gate',()=>{
 const f=fixture();
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:390,height:844}]){
  const pos=f.ctx.geometry({left:viewport.width-38,bottom:viewport.height-80,top:viewport.height-122},viewport);
  assert(pos.left>=12&&pos.left+pos.width<=viewport.width-11);
  assert(pos.width<=730);
 }
 const css=read('app/d05-movements.css');
 assert.match(css,/repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/repeat\(2,minmax\(0,1fr\)\)/);
 const source=read('src/d05-movements.ts');
 assert.match(source,/previewVersion:preview.previewVersion/);
 assert.match(source,/selectionSignature/);
 assert.match(source,/if\(state.mode!=='demo'\)/);
 assert.match(source,/setPicker\(\(old:any\)=>\(\{\.\.\.old,phase:'personal-locked'/);
});
test('B03 V2: drawer is an overlay, bank legacy category write is absent and order of Escape remains enforced',()=>{
 const app=read('src/app.ts'),d05=read('src/d05-movements.ts');
 assert.match(app,/renderDetailDrawer\(\)/);
 assert.match(app,/mf-drawer-backdrop/);
 assert.match(app,/mf-detail-drawer/);
 assert.match(app,/qa84B03RequestDrawerPicker/);
 assert.doesNotMatch(app.slice(app.indexOf('renderDetailDrawer(){'),app.indexOf('renderEditModal(){')),
  /onChange:\(v:string\)=>this\.setBankCategory\(tx,v\)/);
 assert.match(d05,/window\.addEventListener\('keydown',onKey,true\)/);
 assert.match(d05,/event\.stopPropagation\(\);setPicker\(null\)/);
 assert.match(read('app/style.css'),/\.mf-drawer-backdrop\{position:fixed/);
});
