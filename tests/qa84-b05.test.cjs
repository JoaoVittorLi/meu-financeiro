'use strict';
/* QA-84 B05 deterministic tests. Only synthetic fixture, no personal database or LLM. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fixture=JSON.parse(read('docs/design/handoffs/B05_INTELLIGENCE_FIXTURES_V6.json'));
const verified={...fixture.primary,asOf:fixture.asOf,period:fixture.period};
const names=['finance','motion','today','chat','actions'];
const joined=names.map(n=>read('src/intelligence-b05-'+n+'.ts')).join('\n');
const js=ts.transpileModule(joined,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2019}}).outputText;
function h(tag,props,...children){return {tag,props:props||{},children:children.flat(12).filter(x=>x!==null&&x!==undefined)};}
function nodes(root,out=[]){if(root&&typeof root==='object'){if(root.tag)out.push(root);for(const child of root.children||[])nodes(child,out);}return out;}
function runtime(){
 const calls=[];
 const ctx={h,Icon:function Icon(){},console,Date,Intl,Math,Number,JSON,Array,Set,Map,
  window:{matchMedia:()=>({matches:false})},
  document:{getElementById:()=>({focus(){}}),activeElement:null},
  mfD03EligibleReport:(report,app)=>!!report&&!!app.state.localFinancialAccess?.token&&
   app.state.localFinancialAccess.expiresAt>Date.now()&&
   app.state.intelligencePremiumSignature==='sig',
  mfD03Signals:(report,app)=>app.state.mockSignals||[],
  mfD03SignalCard:(app,signal)=>h('article',{className:'mf-d03-signal'},signal.title),
  mfD03ContextDrawer:()=>null,
  intelligencePremiumSignature:()=> 'sig',
  intelligencePremiumEvidence:()=>h('small',{},'Fonte local'),
  intelligencePremiumLoad:()=>{},
  intelligenceHistoryList:app=>app.state.intelligenceMessages||[],
  intelligenceEnsureHydrated:()=>{},
  intelligenceAllProposals:()=>[],
  intelligenceConversationState:()=>({css:'is-offline',pill:'Sem conexão autorizada'}),
  intelligencePageScope:()=>({label:'Inteligência',period:'2026-11'}),
  intelligenceNextTab:(tab,key)=>key==='ArrowRight'?'chat':'today',
  renderIntelligenceAccess:()=>h('section',{},'Permissões'),
  renderIntelligenceHistorySidebar:()=>h('aside',{},'Histórico real'),
  renderIntelligenceMessageItem:(app,msg)=>h('article',{},msg.text),
  renderIntelligenceFollowups:()=>null,
  renderIntelligenceComposer:()=>h('form',{},'Composer real'),
  intelligenceChatSession:()=>({expired:false,busy:false}),
  intelligenceCreateThread:()=>calls.push('thread'),
  intelligencePrepare:(app,q)=>app.setState({intelligenceDraft:q}),
  intelligenceOpenFullChat:()=>{},
  intelligencePremiumMoney:c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100),
  categoryReviewOpen:()=>calls.push('review'),
  renderIntelligenceActionProposalCard:(app,p)=>h('article',{},p.id||'proposal'),
  renderCategoryReview:()=>null};
 vm.createContext(ctx);vm.runInContext(js,ctx,{filename:'qa84-b05.transpiled.js',timeout:1800});
 return {ctx,calls};
}
function app(state={}){
 return {state:{mode:'real',month:'2026-11',localFinancialMonth:'2026-11',
  intelligenceMainMode:'today',intelligenceMessages:[],intelligencePremiumSignature:'sig',
  ...state},navigation:[],setState(update,cb){Object.assign(this.state,update);cb?.();},
  navigate(page){this.navigation.push(page);}};
}
test('B05-03..07: fixture verified milestones and ending reserve in integer cents',()=>{
 const {ctx}=runtime(),p=ctx.mfB05Project(verified);
 assert.equal(p.available,true);assert.equal(p.timeline.length,5);
 assert.deepEqual(Array.from(p.timeline,x=>x.projectedCents),[170000,158100,143600,125700,125700]);
 assert.deepEqual(Array.from(p.timeline,x=>x.consideredCents),[0,11900,26400,44300,44300]);
 assert.equal(p.reserveSuggestionCents,12850);
 assert(p.timeline.every(x=>x.canRenderSegments));
});
test('B05-08/36: repeated last date wins and ring/route/selected card share one value',()=>{
 const {ctx}=runtime(),a=app();
 for(const date of ['2026-11-16','2026-11-30','2026-11-21','2026-11-28']){
  const page=ctx.renderMfB05Today(a,verified);
  const target=nodes(page).find(n=>n.props.id==='mf-b05-date-'+date.replace(/-/g,''));
  assert(target);target.props.onClick();
 }
 const page=ctx.renderMfB05Today(a,verified),text=JSON.stringify(page);
 assert.equal(a.state.mfB05SelectedDate,'2026-11-28');
 assert(text.includes('1.257,00'));
 assert(text.includes('443,00'));
 assert(nodes(page).some(n=>n.props['aria-pressed']===true&&n.props.id==='mf-b05-date-20261128'));
});
test('B05-09/10: scenario drawer edits only local overrides and recomputes all values',()=>{
 const {ctx}=runtime(),a=app({mfB05SelectedDate:'2026-11-30'});
 let page=ctx.renderMfB05Today(a,verified);
 const open=nodes(page).find(n=>n.props.id==='mf-b05-adjust');
 assert(open);open.props.onClick();
 page=ctx.renderMfB05Today(a,verified);
 assert(nodes(page).some(n=>n.props.role==='dialog'));
 const slider=nodes(page).find(n=>n.props.id==='mf-b05-slider-mfB05ScenarioBalanceCents');
 assert(slider);slider.props.onChange({target:{value:'1800'}});
 assert.equal(a.state.mfB05ScenarioBalanceCents,180000);
 page=ctx.renderMfB05Today(a,verified);
 assert(JSON.stringify(page).includes('1.357,00'));
 const reset=nodes(page).find(n=>n.tag==='button'&&n.children.includes('Restaurar premissas verificadas'));
 assert(reset);reset.props.onClick();
 assert.equal(a.state.mfB05ScenarioSignature,null);
 assert(JSON.stringify(ctx.renderMfB05Today(a,verified)).includes('1.257,00'));
 assert.equal(a.navigation.length,0);
});
test('B05-11: insufficient balance and negative future balance do not fake positive ring',()=>{
 const {ctx}=runtime();
 const p=ctx.mfB05Project({...verified,availableBalance:{...verified.availableBalance,value:30000}});
 assert.equal(p.ending.projectedCents,-14300);
 assert.equal(p.ending.canRenderSegments,false);
 assert.equal(p.reserveSuggestionCents,null);
 const text=JSON.stringify(ctx.renderMfB05Today(app(),{...verified,availableBalance:{...verified.availableBalance,value:30000}}));
 assert(text.includes('Saldo projetado insuficiente'));
});
test('B05-12: undefined buffer forbids closed ring and reserve proposal',()=>{
 const {ctx}=runtime(),p=ctx.mfB05Project({...verified,safetyBufferCents:null});
 assert.equal(p.available,true);
 assert.equal(p.ending.canRenderSegments,false);
 assert.equal(p.reserveSuggestionCents,null);
});
test('B05-13: duplicate commitments are counted once; conflicting IDs rejected',()=>{
 const {ctx}=runtime(),item=verified.unpaidFutureCommitments.value[0],
  duplicate={...verified,unpaidFutureCommitments:{...verified.unpaidFutureCommitments,
   value:[...verified.unpaidFutureCommitments.value,{...item}]}};
 assert.equal(ctx.mfB05Project(duplicate).ending.consideredCents,44300);
 const conflicting={...duplicate,unpaidFutureCommitments:{...duplicate.unpaidFutureCommitments,
  value:[...duplicate.unpaidFutureCommitments.value,{...item,amountCents:5999}]}};
 assert.equal(ctx.mfB05Project(conflicting).available,false);
});
test('B05-14: posted commitments never deducted again',()=>{
 const {ctx}=runtime(),list=[...verified.unpaidFutureCommitments.value,
  {id:'already-posted',due:'2026-11-20',amountCents:7500,status:'posted'}];
 assert.equal(ctx.mfB05Project({...verified,unpaidFutureCommitments:{...verified.unpaidFutureCommitments,value:list}}).ending.consideredCents,44300);
});
test('B05-15: future income needs dated evidence and prevents invalid three-part ring',()=>{
 const {ctx}=runtime();
 const bad=ctx.mfB05Project({...verified,expectedIncome:{value:30000,coverage:'verified'}});
 assert.equal(bad.available,false);
 const valid=ctx.mfB05Project({...verified,expectedIncome:{value:[{id:'income',due:'2026-11-25',amountCents:30000}],coverage:'verified'}});
 assert.equal(valid.available,true);assert.equal(valid.ending.projectedCents,155700);
 assert.equal(valid.ending.canRenderSegments,false);
});
test('B05-16/17: budget excess and zero limit do not divide by zero',()=>{
 const {ctx}=runtime(),r=ctx.mfB05Budget(76000,70000),z=ctx.mfB05Budget(76000,0);
 assert.equal(r.excessCents,6000);assert.equal(Math.round(r.usagePercent),109);
 assert.equal(z.usagePercent,null);assert.equal(z.excessCents,76000);
});
test('B05-18/19: comparable periods 340 - 230; zero and unequal periods protected',()=>{
 const {ctx}=runtime(),x=ctx.mfB05Comparison(23000,34000,true);
 assert.equal(x.deltaCents,11000);assert.equal(Math.round(x.percent*10)/10,47.8);
 assert.equal(ctx.mfB05Comparison(0,34000,true).percent,null);
 assert.equal(ctx.mfB05Comparison(23000,34000,false),null);
});
test('B05-20/21: denied, partial, stale projections never show cash amounts',()=>{
 const {ctx}=runtime();
 for(const coverage of ['denied','partial','stale','expired','none']){
  assert.equal(ctx.mfB05Project({...verified,coverage}).available,false);
 }
 const page=JSON.stringify(ctx.renderMfB05Today(app()));
 assert(page.includes('sem saldos inventados'));
 assert(!page.includes('1.700,00'));
});
test('B05-01/31: three real tabs use existing today/chat/actions modes',()=>{
 const {ctx}=runtime(),a=app();
 const tree=ctx.mfB05Tabs(a,'today'),tabs=nodes(tree).filter(n=>n.props.role==='tab');
 assert.deepEqual(Array.from(tabs,x=>x.props.id),['mf-b05-tab-today','mf-b05-tab-chat','mf-b05-tab-actions']);
 tabs[1].props.onClick();assert.equal(a.state.intelligenceMainMode,'chat');
 tabs[2].props.onClick();assert.equal(a.state.intelligenceMainMode,'actions');
});
test('B05-22/23: chat is primary, history closed by default and existing composer used',()=>{
 const {ctx}=runtime(),a=app(),tree=ctx.renderMfB05Chat(a,[],{css:'is-offline',pill:'Local'},{label:'Inteligência',period:'Novembro'});
 const flat=nodes(tree),str=JSON.stringify(tree);
 assert(flat.some(n=>n.props.className==='mf-b05-chat-thread'));
 assert(!flat.some(n=>n.props.className?.includes('mf-b05-history-drawer')));
 assert(str.includes('Composer real'));
 const trigger=flat.find(n=>n.props.id==='mf-b05-history-trigger');
 trigger.props.onClick();
 assert(nodes(ctx.renderMfB05Chat(a,[],{},{})).some(n=>n.props.role==='dialog'));
});
test('B05-26..29: action stages and hypothetical limit do not invoke persistence',()=>{
 const {ctx,calls}=runtime(),signal={id:'budget-excess',kind:'budget',title:'Revise o orçamento de Alimentação',
  detail:'Excesso observado',meaning:'Gasto maior que limite',sourceId:'UI-04',action:'budgets',
  sourceCard:{budgets:[{category:'Alimentação',spentCents:76000,limitCents:70000}]}};
 const a=app({localFinancialAccess:{token:'synthetic',expiresAt:Date.now()+60000},mockSignals:[signal],intelligencePremiumReport:{cards:[]}});
 const understand=ctx.renderMfB05Actions(a,[]);
 assert(JSON.stringify(understand).includes('Entender'));
 ctx.mfB05ActionStage(a,'simulate');
 const sim=ctx.renderMfB05Actions(a,[]);
 const slider=nodes(sim).find(n=>n.props.id==='mf-b05-budget-slider');
 assert(slider);
 slider.props.onChange({target:{value:'850'}});
 assert.equal(a.state.mfB05ActionPreviewCents,85000);
 ctx.mfB05ActionStage(a,'review');
 assert(JSON.stringify(ctx.renderMfB05Actions(a,[])).includes('850,00'));
 assert.equal(calls.length,0);assert.equal(a.navigation.length,0);
});
test('B05-35/40: CSS hooks for reduced motion, dark/light and responsive are loaded',()=>{
 const css=read('app/intelligence-b05.css'),html=read('app/index.html'),
  tsconfig=JSON.parse(read('tsconfig.json'));
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\[data-theme="dark"\]/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(html,/intelligence-b05\.css/);
 for(const name of names)assert(tsconfig.files.includes('src/intelligence-b05-'+name+'.ts'));
});
test('B05 security: B05 source files contain no direct personal financial writes',()=>{
 for(const name of names){
  const source=read('src/intelligence-b05-'+name+'.ts');
  assert(!/\b(bankCategorize|bankBatch|bankSplit|planCreate|planEdit|categoryReviewConfirm|db\.save)\s*\(/.test(source),name);
 }
});

test('RC2/B05-17: an explicit zero budget is labeled zero, never undefined',()=>{
 const {ctx}=runtime(),a=app({localFinancialAccess:{token:'test',expiresAt:Date.now()+60000},
  intelligencePremiumReport:{cards:[]},mockSignals:[{id:'budget-excess',kind:'budget',
   title:'Revise o orçamento de Alimentação',detail:'Excesso observado',
   meaning:'Excesso',sourceId:'UI-04',action:'budgets',
   sourceCard:{budgets:[{category:'Alimentação',spentCents:76000,limitCents:0}]}}]});
 const tree=ctx.renderMfB05Actions(a,[]),serialized=JSON.stringify(tree);
 assert(serialized.includes('Limite explícito: R$ 0,00'));
 assert(!serialized.includes('Limite não definido'));
});
test('RC2/B05-30: budget scenario invalidated when source facts change within same grant',()=>{
 const {ctx}=runtime(),build=(limit,spent)=>({id:'budget-excess',kind:'budget',
   title:'Revise o orçamento de Alimentação',detail:'Excesso observado',
   meaning:'Excesso',sourceId:'UI-04',action:'budgets',
   sourceCard:{budgets:[{category:'Alimentação',spentCents:spent,limitCents:limit}]}});
 const a=app({localFinancialAccess:{token:'test',expiresAt:Date.now()+60000},
   intelligencePremiumReport:{cards:[]},mockSignals:[build(70000,76000)],
   mfB05ActionStage:'simulate'});
 const slider=nodes(ctx.renderMfB05Actions(a,[])).find(n=>n.props.id==='mf-b05-budget-slider');
 assert(slider);slider.props.onChange({target:{value:'850'}});
 assert(JSON.stringify(ctx.renderMfB05Actions(a,[])).includes('850,00'));
 a.state.mockSignals=[build(10000,99999)];
 const updated=JSON.stringify(ctx.renderMfB05Actions(a,[]));
 assert(!updated.includes('850,00'));
 assert(updated.includes('prévia foi invalidada'));
});
test('RC2/B05-19: delivery comparison rejects unequal source expense window',()=>{
 const {ctx}=runtime(),input=JSON.parse(JSON.stringify(verified));
 assert.equal(ctx.mfB05DeliveryEvidence(input).deltaCents,11000);
 const item=input.currentExpenses.value.find(x=>x.categoryId==='sub:alimentacao/delivery');
 item.periodStart='2026-11-04';
 assert.equal(ctx.mfB05DeliveryEvidence(input),null);
});
test('RC2/B05-30: changing future bills invalidates Today scenario override',()=>{
 const {ctx}=runtime(),a=app({mfB05SelectedDate:'2026-11-30'});
 const original=ctx.renderMfB05Today(a,verified);
 nodes(original).find(n=>n.props.id==='mf-b05-adjust').props.onClick();
 const slider=nodes(ctx.renderMfB05Today(a,verified))
  .find(n=>n.props.id==='mf-b05-slider-mfB05ScenarioBalanceCents');
 slider.props.onChange({target:{value:'1800'}});
 assert(JSON.stringify(ctx.renderMfB05Today(a,verified)).includes('1.357,00'));
 const changed=JSON.parse(JSON.stringify(verified));
 changed.unpaidFutureCommitments.value[0].amountCents=12000;
 assert(JSON.stringify(ctx.renderMfB05Today(a,changed)).includes('1.256,00'));
});
test('RC2/B05-36: twenty milestone selections preserve only last state',()=>{
 const {ctx}=runtime(),a=app(),dates=ctx.mfB05Project(verified).timeline.map(x=>x.date);
 for(let i=0;i<20;i++){
   const date=dates[i%dates.length],tree=ctx.renderMfB05Today(a,verified);
   const button=nodes(tree).find(n=>n.props.id==='mf-b05-date-'+date.replace(/-/g,''));
   assert(button);button.props.onClick();
 }
 assert.equal(a.state.mfB05SelectedDate,dates[19%dates.length]);
});
test('RC2.1/B05-24: cached local reply binds to exact grant and cannot revive on renewal',()=>{
 const source=read('src/intelligence-view.ts')+'\n'+read('src/intelligence-local.ts');
 const compiled=ts.transpileModule(source,{compilerOptions:{
   target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None
 }}).outputText;
 const sandbox={h,Date,Intl,Math,Number,JSON,Array,Set,Map,WeakMap,console,
  intelligencePremiumSignature:()=> 'sig',
  aiMarkdownNodes:(content)=>[content]};
 vm.createContext(sandbox);vm.runInContext(compiled,sandbox,{timeout:1500});
 const msg={id:'local-a-old',role:'assistant',text:'Dado financeiro sensível de sessão',
  status:'done',scopeLabel:'Inteligência',periodLabel:'2026-11',createdAt:'18:00'};
 const grant={token:'old',source:'manual',profile:'real',
  expiresAt:Date.now()+60000,planning:false,backup:null};
 sandbox.mfLocalBindMessage(msg,grant,'sig','2026-11');
 const render=(active,month='2026-11',m=msg)=>JSON.stringify(sandbox.renderIntelligenceMessageItem(
  app({mode:'real',localFinancialMonth:month,localFinancialAccess:active}),m));
 assert(render(grant).includes('Dado financeiro sensível'), 'original live grant');
 const expired={...grant,expiresAt:Date.now()-1000};
 assert(!render(expired).includes('Dado financeiro sensível'), 'new expired object');
 assert(!render(null).includes('Dado financeiro sensível'), 'revoked grant');
 const renewed={...grant,token:'new'};
 assert(!render(renewed).includes('Dado financeiro sensível'), 'new token same period');
 assert(!render({...grant}).includes('Dado financeiro sensível'), 'new grant object same token');
 assert(!render(grant,'2026-12').includes('Dado financeiro sensível'), 'period changed');
 assert(!render(grant,'2026-11',JSON.parse(JSON.stringify(msg))).includes('Dado financeiro sensível'), 'restored message has no grant binding');
});

test('RC2/B05 dates: rejects impossible due dates, permits valid leap day',()=>{
 const {ctx}=runtime();
 assert.equal(ctx.mfB05IsoDate('2026-02-30'),null);
 assert.equal(ctx.mfB05IsoDate('2028-02-29'),'2028-02-29');
 const invalid={...verified,unpaidFutureCommitments:{...verified.unpaidFutureCommitments,
  value:[{...verified.unpaidFutureCommitments.value[0],due:'2026-02-30'}]}};
 assert.equal(ctx.mfB05Project(invalid).available,false);
});
test('RC2/B05 statuses: unknown bill statuses and missing period origin block projection',()=>{
 const {ctx}=runtime();
 assert.equal(ctx.mfB05Project({...verified,period:{to:verified.period.to}}).available,false);
 const invalid={...verified,unpaidFutureCommitments:{...verified.unpaidFutureCommitments,
  value:[{...verified.unpaidFutureCommitments.value[0],status:'unknown'}]}};
 assert.equal(ctx.mfB05Project(invalid).available,false);
 assert.equal(ctx.mfB05Project(verified).ending.projectedCents,125700);
});
