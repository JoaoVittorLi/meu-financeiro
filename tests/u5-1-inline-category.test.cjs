'use strict';
// Functional U5.1 UI: transpile actual TypeScript methods, exercise event handlers
// and async persistence with synthetic ledger snapshots. No personal data.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const src=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
const h=(tag,props,...children)=>({tag,props:props||{},children});
const Icon=()=>null,window={innerWidth:1366,innerHeight:768},
 document={body:{}},ReactDOM={createPortal:node=>node};
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pt-BR');
function slice(a,b){const x=src.indexOf(a),y=src.indexOf(b,x+a.length);
 assert(x>=0&&y>x,'Missing source method '+a);return src.slice(x,y);}
const methods=slice(' async setBankCategory(tx:BankTx', ' bankTxSelected(tx:BankTx)')+
 slice(' openCategoryFromRow(origin:', ' async updateBankInfo()')+
 slice(' clearMovementFilters()', ' renderMovements()');
function subject(custom={}){
 let calls=[],messages=[],saving=()=>{};
 const a={id:'shared',accountId:'account-A',accountName:'Conta A',date:'2026-11-10',description:'Compra no banco A',
  category:'Alimentação',amount:-1256,status:'POSTED',reviewed:false};
 const b={...a,accountId:'account-B',accountName:'Conta B',description:'Compra no banco B'};
 const manual={id:'manual-1',description:'Compra local',date:'2026-11-10',amount:1256,kind:'expense',category:'Alimentação',origin:'manual'};
 const account={data:{transactions:[a,b],accounts:[]}},personal={transactions:[manual],settings:{},budgets:{}};
 const desktop={bankCategorize:async(input)=>{
   calls.push(input);
   if(custom.failBank)throw Error('Falha sintética de persistência');
   if(custom.waitBank)await custom.waitBank;
   return {...account.data,transactions:app.state.bank.data.transactions.map(t=>
     t.accountId===input.accountId&&t.id===input.externalId?{...t,category:input.category}:t)};
 }};
 const compiled=ts.transpileModule('class Subject{'+methods+'}',{
   compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
 const Subject=new Function('desktop','window','document','h','ReactDOM','Icon','fold',
   compiled+';return Subject;')(desktop,window,document,h,ReactDOM,Icon,fold);
 const app=new Subject();
 app.state={mode:'real',data:personal,bank:account,query:'',bankFilter:'',txSource:'all',
   txCategoryFilter:'',txKindFilter:'all',txReviewFilter:'all',txSort:'date_desc',
   overviewPeriod:'custom',txSelected:['account-A|shared'],quickCategory:null,
   quickCategoryQuery:'',quickCategoryIndex:0,quickCategoryBusy:false,quickCategoryError:'',
   busy:false,detailBusy:false,categorySaving:[]};
 app.writeInProgress=false;app.quickCategoryWrite=false;app.categorySaveQueue=Promise.resolve();
 app.categorySavingKeys=new Set();app.flash=msg=>messages.push(msg);
 app.getCategories=()=>[
  {name:'Alimentação',kind:'expense',emoji:'🍽️'},
  {name:'Transporte',kind:'expense',emoji:'🚗'},
  {name:'Salário',kind:'income',emoji:'💰'},
  {name:'Outros',kind:'both',emoji:'✨'}];
 app.setState=(update,callback)=>{
   Object.assign(app.state,typeof update==='function'?update(app.state):update);
   if(callback)callback();
 };
 app.updateData=async data=>{
   if(custom.failManual)return false;
   if(custom.waitManual)await custom.waitManual;
   app.state.data=data;return true;
 };
 return {app,calls,messages,a,b,manual};
}
function click(){
 const anchor={isConnected:true,focused:0,
  focus(){this.focused++},contains:()=>false,
  getBoundingClientRect:()=>({left:110,top:235,bottom:273})};
 return {currentTarget:anchor};
}
function walk(node,predicate,out=[]){
 if(Array.isArray(node)){for(const x of node)walk(x,predicate,out);return out}
 if(!node||typeof node!=='object')return out;
 if(predicate(node))out.push(node);
 walk(node.children,predicate,out);return out;
}
test('U5.1 — categoria abre popover para banco A/B com externalId idêntico e para manual',()=>{
 const {app,a,b,manual}=subject(),event=click();
 app.openCategoryFromRow('bank',a,event);
 assert.equal(app.state.quickCategory.accountId,'account-A');
 assert.equal(app.state.quickCategory.id,'shared');
 app.openCategoryFromRow('bank',b,event);
 assert.equal(app.state.quickCategory.accountId,'account-B');
 app.openCategoryFromRow('manual',manual,event);
 assert.equal(app.state.quickCategory.origin,'manual');
 assert.equal(app.state.quickCategory.id,'manual-1');
 assert.equal(app.quickCategoryChoices().some(c=>c.name==='Salário'),false);
 assert.equal(app.quickCategoryChoices().some(c=>c.name==='Transporte'),true);
});
test('U5.1 — manual salva categoria via updateData mantendo id, data, centavos e outros dados',async()=>{
 const {app,manual,messages}=subject();
 app.openCategoryFromRow('manual',manual,click());
 assert.equal(await app.chooseQuickCategory('Transporte'),true);
 assert.deepEqual(app.state.data.transactions[0],{...manual,category:'Transporte'});
 assert.equal(app.state.quickCategory,null);
 assert(messages.includes('Categoria atualizada.'));
});
test('U5.1 — banco grava override pessoal com accountId+externalId, não por ID isolado',async()=>{
 const {app,a,b,calls}=subject(),before={...b};
 app.openCategoryFromRow('bank',a,click());
 assert.equal(await app.chooseQuickCategory('Transporte'),true);
 assert.deepEqual(calls,[{accountId:'account-A',externalId:'shared',category:'Transporte'}]);
 assert.equal(app.state.bank.data.transactions[0].category,'Transporte');
 assert.deepEqual(app.state.bank.data.transactions[1],before);
 assert.equal(app.state.bank.data.transactions[0].amount,-1256);
});
test('U5.1 — falha bancária mantém categoria anterior, popover e erro visível',async()=>{
 const {app,a,messages}=subject({failBank:true});
 app.openCategoryFromRow('bank',a,click());
 assert.equal(await app.chooseQuickCategory('Transporte'),false);
 assert.equal(app.state.bank.data.transactions[0].category,'Alimentação');
 assert.equal(app.state.quickCategory.accountId,'account-A');
 assert.match(app.state.quickCategoryError,/não foi possível salvar/i);
 assert(!messages.includes('Categoria atualizada.'));
});
test('U5.1 — falha de gravação manual preserva seleção e informa erro',async()=>{
 const {app,manual,messages}=subject({failManual:true});
 app.openCategoryFromRow('manual',manual,click());
 assert.equal(await app.chooseQuickCategory('Transporte'),false);
 assert.equal(app.state.data.transactions[0].category,'Alimentação');
 assert(app.state.quickCategory);
 assert.match(app.state.quickCategoryError,/anterior foi mantida/);
 assert(!messages.includes('Categoria atualizada.'));
});
test('U5.1 — cliques repetidos não disparam duas gravações bancárias',async()=>{
 let release;const waitBank=new Promise(resolve=>{release=resolve});
 const {app,a,calls}=subject({waitBank});
 app.openCategoryFromRow('bank',a,click());
 const first=app.chooseQuickCategory('Transporte');
 assert.equal(await app.chooseQuickCategory('Transporte'),false);
 release();
 assert.equal(await first,true);
 assert.equal(calls.length,1);
});
test('U5.1 — Enter confirma seleção ativa, setas navegam, Escape restaura foco',async()=>{
 const {app,manual}=subject(),event=click();
 app.openCategoryFromRow('manual',manual,event);
 const node=app.renderQuickCategoryPopover();
 const panel=walk(node,x=>x.tag==='section'&&x.props.role==='dialog')[0];
 const input=walk(node,x=>x.tag==='input'&&x.props.role==='combobox')[0];
 assert(panel&&input);
 const focus={called:0,focus(){this.called++}};
 input.props.ref(focus);
 const key=(name,target=focus)=>({key:name,target,preventDefault(){},stopPropagation(){}});
 panel.props.onKeyDown(key('ArrowDown'));
 assert.equal(app.state.quickCategoryIndex,1);
 panel.props.onKeyDown(key('Escape'));
 assert.equal(app.state.quickCategory,null);
 assert.equal(event.currentTarget.focused,1);
 app.openCategoryFromRow('manual',manual,event);
 const newNode=app.renderQuickCategoryPopover(),newPanel=walk(newNode,x=>x.tag==='section')[0];
 const newInput=walk(newNode,x=>x.tag==='input'&&x.props.role==='combobox')[0];
 newInput.props.ref(focus);
 newPanel.props.onKeyDown(key('ArrowDown'));
 newPanel.props.onKeyDown(key('Enter'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(app.state.data.transactions[0].category,'Transporte');
});
test('U5.1 — busca sem acento, categorias compatíveis e opção atual',()=>{
 const {app,manual}=subject();app.openCategoryFromRow('manual',manual,click());
 app.state.quickCategoryQuery='transpor';
 assert.deepEqual(app.quickCategoryChoices().map(c=>c.name),['Transporte']);
 app.state.quickCategoryQuery='salario';
 assert.equal(app.quickCategoryChoices().length,0);
 app.state.quickCategoryQuery='';
 const tree=app.renderQuickCategoryPopover();
 const options=walk(tree,x=>x.props?.role==='option');
 assert(options.some(x=>x.props['aria-selected']===true));
 assert(options.every(x=>x.props.type==='button'));
});
test('U5.1 — limpar filtros restaura padrão sem mexer em lançamentos nem regras financeiras',()=>{
 const {app}=subject();const before=JSON.stringify([app.state.data,app.state.bank]);
 Object.assign(app.state,{query:'café',bankFilter:'account-A',txSource:'bank',
   txCategoryFilter:'Alimentação',txKindFilter:'expense',txReviewFilter:'pending',
   txSort:'amount_desc',overviewPeriod:'custom',quickCategory:{id:'shared',origin:'bank'}});
 app.clearMovementFilters();
 assert.deepEqual([app.state.query,app.state.bankFilter,app.state.txSource,
  app.state.txCategoryFilter,app.state.txKindFilter,app.state.txReviewFilter,
  app.state.txSort,app.state.overviewPeriod],
  ['','','all','','all','all','date_desc','month']);
 assert.deepEqual(app.state.txSelected,[]);
 assert.equal(app.state.quickCategory,null);
 assert.equal(JSON.stringify([app.state.data,app.state.bank]),before);
});
