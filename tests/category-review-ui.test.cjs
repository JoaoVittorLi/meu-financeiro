'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {FinanceDB}=require('../electron/db.cjs'),{CategoryReviewService}=require('../electron/category-review.cjs');
const {seedCategoryReview}=require('../scripts/category-review-fixture.cjs');
function fixture(){
 const os=require('node:os'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'mf-review-ui-'));seedCategoryReview(directory);
 const db=new FinanceDB(path.join(directory,'meu-financeiro.sqlite')),service=new CategoryReviewService(db,{syntheticProfile:true});
 const api={categoryReviewStatus:async()=>({available:true})};
 for(const [name,method] of [['Authorize','authorize'],['List','list'],['Queue','queue'],['Prepare','prepare'],['Confirm','confirm'],['Revoke','revoke']])api['categoryReview'+name]=async input=>service[method](input,1);
 const app={state:{mode:'real',month:'2026-11',intelligenceThreads:[{id:'legacy'}],intelligenceMessages:[]},setState(value,callback){Object.assign(this.state,value);callback?.();},refreshBank:async()=>{}};
 const context=vm.createContext({desktop:api,console,Date,Promise,document:{querySelector:()=>null},h:(tag,props,...children)=>({tag,props:props||{},children:children.flat(Infinity).filter(x=>x!=null)}),fmt:n=>(n/100).toFixed(2),intelligenceFoldText:s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),intelligencePageScope:()=>({label:'Teste',period:'2026-11'}),intelligenceNowTime:()=> '02:00',intelligenceHistoryList:a=>a.state.intelligenceMessages,intelligenceSyncThreadMessages:(a,m)=>a.setState({intelligenceMessages:m}),localFinancialDisable:()=>{}});
 const code=ts.transpile(fs.readFileSync(path.join(__dirname,'../src/intelligence-review.ts'),'utf8'),{target:ts.ScriptTarget.ES2020});vm.runInContext(code,context);
 return {db,service,context,app,directory,close(){db.close();fs.rmSync(directory,{recursive:true,force:true});}};
}
function nodes(tree,match,out=[]){if(tree&&typeof tree==='object'){if(match(tree))out.push(tree);for(const c of tree.children||[])nodes(c,match,out);}return out;}
const text=n=>typeof n==='string'?n:(n?.children||[]).map(text).join('');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('R3 inspection and page search preserve protected rows, and filter changes close the inspector',async()=>{
 const f=fixture();try{
  await authorize(f);await click(f,'Detalhes');assert(f.app.state.categoryReviewDetail);
  f.context.categoryReviewSetFilter(f.app,'accountId','other');assert.equal(f.app.state.categoryReviewDetail,null);
  const sections=nodes(f.context.renderCategoryReview(f.app),n=>n.props.id==='mf-review-section-0');assert.equal(sections[0].props.hidden,true);
 }finally{f.close();}
});
test('R3 prepared response from an earlier account context is discarded',async()=>{
 const f=fixture();try{
  await authorize(f);let resolve;const original=f.context.desktop.categoryReviewPrepare;
  f.context.desktop.categoryReviewPrepare=input=>new Promise(r=>resolve=async()=>r(await original(input)));
  const pending=f.context.categoryReviewPrepare(f.app,'rule',{suggestionId:f.app.state.categoryReviewReport.suggestions[0].id});
  f.context.categoryReviewSetFilter(f.app,'accountId','other');await resolve();await pending;
  assert.equal(f.app.state.categoryReviewPreview,null);
 }finally{f.close();}
});
test('history handoff applies the approved account and exact pattern then focuses the review queue',async()=>{
 const f=fixture();try{
  await authorize(f);const calls=[];f.context.document.getElementById=id=>({scrollIntoView:()=>calls.push(id),focus:()=>calls.push('focus')});
  await click(f,'Aceitar / simular regra');await confirm(f);await click(f,'Revisar histórico compatível');
  assert.equal(f.app.state.categoryReviewFilters.pattern,'CAFETERIA FLORESTA');assert(f.app.state.categoryReviewQueue.rows.every(r=>r.description==='CAFETERIA FLORESTA'));assert(calls.includes('mf-review-section-1'));assert(calls.includes('focus'));
 }finally{f.close();}
});
async function click(f,label,index=0){const tree=f.context.renderCategoryReview(f.app),button=nodes(tree,n=>n.tag==='button'&&text(n)===label)[index];assert(button,'Botão ausente: '+label);assert(!button.props.disabled,'Botão desativado: '+label);button.props.onClick();await settle();await settle();}
async function authorize(f){await f.context.categoryReviewOpen(f.app);await click(f,'Autorizar revisão dos dados sintéticos');}
async function confirm(f){const checkbox=nodes(f.context.renderCategoryReview(f.app),n=>n.tag==='input'&&n.props.type==='checkbox'&&String(n.props.onChange).includes('categoryReviewConfirmed'))[0];assert(checkbox);checkbox.props.onChange({target:{checked:true}});await click(f,'Confirmar esta ação');}
test('component callbacks run real FinanceDB: suggest, simulate, approve, future import, select history, apply and undo',async()=>{
 const f=fixture();try{
  await authorize(f);assert.equal(f.app.state.categoryReviewReport.suggestionsTotal,2);
  await click(f,'Aceitar / simular regra');assert.equal(f.app.state.categoryReviewPreview.historicalEligible,2);assert.equal(f.db.listCategories().rules.length,0);
  await confirm(f);assert.equal(f.db.listCategories().rules.length,1);assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='cafe-4').category,'Outros');
  const account='22222222-2222-4222-8222-222222222222';
  f.db.ingestBank('11111111-1111-4111-8111-111111111111',{item:{status:'UPDATED'},data:[{account:{id:account,name:'SYNTHETIC',balance:null},transactions:[{id:'future-ui',date:'2026-11-12',description:'CAFETERIA FLORESTA',amount:-10,status:'POSTED',category:'Outros'}]}]});
  assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='future-ui').category,'Alimentação');
  f.app.state.categoryReviewSelected=f.app.state.categoryReviewQueue.rows.filter(r=>r.externalId==='cafe-4'||r.externalId==='cafe-5');
  await click(f,'Preparar classificação da seleção');assert.match(f.app.state.categoryReviewError,/desatualizada/);
  await f.context.categoryReviewRefresh(f.app);f.app.state.categoryReviewSelected=f.app.state.categoryReviewQueue.rows.filter(r=>r.externalId==='cafe-4'||r.externalId==='cafe-5');
  await click(f,'Preparar classificação da seleção');assert.equal(f.app.state.categoryReviewPreview.totalCents,3780);await confirm(f);
  const applied=f.app.state.categoryReviewReceipt.id;assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='cafe-4').category,'Alimentação');
  await f.context.categoryReviewPrepare(f.app,'undo',{commandId:applied});await confirm(f);assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='cafe-4').category,'Outros');
 }finally{f.close();}
});
test('denial and defer buttons persist decisions, and session closure restores legacy history',async()=>{
 const f=fixture();try{
  await authorize(f);await click(f,'Adiar');await confirm(f);assert.equal(f.app.state.categoryReviewReport.suggestions[0].state,'deferred');
  await click(f,'Negar');await confirm(f);assert.equal(f.app.state.categoryReviewReport.suggestionsTotal,1);
  await click(f,'Encerrar revisão');assert.equal(f.app.state.categoryReviewGrant,null);assert.equal(f.app.state.intelligenceThreads[0].id,'legacy');
  assert.equal(f.db.listCategories().rules.length,0);
 }finally{f.close();}
});
test('main and drawer chat reuse the same pending operation and do not execute natural-language writes',async()=>{
 const f=fixture();try{
  await authorize(f);await click(f,'Aceitar / simular regra');const p=f.app.state.categoryReviewPreview;
  assert.equal(f.context.categoryReviewHandleQuestion(f.app,'Revise tudo que está pendente.'),true);
  assert.equal(f.app.state.intelligenceMessages[1].id.startsWith('review-answer-'),true);
  await f.context.categoryReviewOpen(f.app);assert.equal(f.app.state.categoryReviewPreview.id,p.id);assert.equal(f.db.listCategories().rules.length,0);
  assert.equal(f.context.categoryReviewHandleQuestion(f.app,'Transfira meu dinheiro'),false);
  f.app.state.categoryReviewAvailable=false;f.context.categoryReviewDisable(f.app);
  const rendered=text(f.context.renderCategoryReview(f.app));assert.match(rendered,/Aguardando homologação/);
 }finally{f.close();}
});
test('existing history persistence short-circuits during a review grant, even if storage is inaccessible',()=>{
 const f=fixture();try{
  const source=fs.readFileSync(path.join(__dirname,'../src/intelligence-integration.ts'),'utf8');
  const start=source.indexOf('function intelligencePersistThreads('),end=source.indexOf('\nfunction ',start+1);
  vm.runInContext(ts.transpile(source.slice(start,end),{target:ts.ScriptTarget.ES2020}),f.context);
  f.app.state.categoryReviewGrant={token:'session-only'};
  assert.equal(f.context.intelligencePersistThreads(f.app,[{secret:'must not persist'}]),'');
 }finally{f.close();}
});

test('changing an account invalidates visible rows, selection and preview before applying filters',async()=>{
 const f=fixture();try{
  await authorize(f);const old=f.app.state.categoryReviewQueue.rows;
  f.app.state.categoryReviewSelected=old.slice(0,1);f.app.state.categoryReviewPreview={id:'old'};
  f.context.categoryReviewSetFilter(f.app,'accountId','33333333-3333-4333-8333-333333333333');
  assert.equal(f.app.state.categoryReviewQueue,null);assert.equal(f.app.state.categoryReviewSelected.length,0);assert.equal(f.app.state.categoryReviewPreview,null);
  assert.match(text(f.context.renderCategoryReview(f.app)),/Filtros alterados/);
  await click(f,'Aplicar filtros');assert.equal(f.app.state.categoryReviewFiltersDirty,false);
  assert(f.app.state.categoryReviewQueue.rows.every(r=>r.accountId==='33333333-3333-4333-8333-333333333333'));
 }finally{f.close();}
});

test('an in-flight old filter response cannot repopulate the queue or replace a newer result',async()=>{
 const f=fixture();try{
  await authorize(f);const api=f.context.desktop,original=api.categoryReviewQueue,pending=[];
  api.categoryReviewQueue=input=>new Promise(resolve=>pending.push({input,resolve}));
  const first=f.context.categoryReviewRefresh(f.app);
  f.context.categoryReviewSetFilter(f.app,'confidence','low');
  pending[0].resolve(await original(pending[0].input));await first;assert.equal(f.app.state.categoryReviewQueue,null);
  const older=f.context.categoryReviewRefresh(f.app),newer=f.context.categoryReviewRefresh(f.app);
  pending[2].resolve({...await original(pending[2].input),marker:'new'});await newer;
  pending[1].resolve({...await original(pending[1].input),marker:'old'});await older;
  assert.equal(f.app.state.categoryReviewQueue.marker,'new');
 }finally{f.close();}
});

test('page selection excludes manual classifications, splits, low confidence and pending rows; pagination clears it',async()=>{
 const f=fixture();try{
  await authorize(f);const rows=f.app.state.categoryReviewQueue.rows;
  await click(f,'Selecionar elegíveis desta página');
  assert.deepEqual(Array.from(f.app.state.categoryReviewSelected,r=>r.externalId),rows.filter(r=>r.batchEligible).map(r=>r.externalId));
  assert(f.app.state.categoryReviewSelected.every(r=>!r.manual&&!r.hasSplits&&r.status==='POSTED'&&r.confidence!=='low'));
  await f.context.categoryReviewRefresh(f.app);assert.equal(f.app.state.categoryReviewSelected.length,0);
 }finally{f.close();}
});
