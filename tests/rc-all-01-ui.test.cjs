'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const source=read('src/intelligence-today-v2.ts')+'\n'+read('src/intelligence-review-v11.ts');
const css=read('app/intelligence.css')+read('app/intelligence-review.css');
const view=read('src/intelligence-view.ts'),legacy=read('src/intelligence-review.ts');
const h=(type,props,...children)=>({type,props:{...props,children}});
const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const code=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
const liveFuncs=new Function('h','MF_PREMIUM_IDS','intelligencePremiumSignature','intelligencePremiumMoney',
 'Icon','intelligencePremiumEvidence','intelligenceOpenFullChat','categoryReviewOpen',
 'categoryReviewPrepare','renderCategoryReviewPreview','renderCategoryReviewLegacy','document','mfI2CategoryPanel',
 code+';return {mfD03EligibleReport,mfD03Signals,mfD03SignalCard,mfD03OpenDrawer,renderMfD03Today,'+
 'mfD04StableId,mfD04Entries,mfD04DraftFor,mfD04Impact,mfD04Patch,mfD04Discard,mfD04ServiceEligible,'+
 'mfD04SavedDraft,mfD04Render};'
);
const calls=[];
const f=liveFuncs(h,['UI-01','UI-02','UI-03','UI-04','UI-05','UI-06','UI-07','UI-08'],
 ()=> 'sig',money,({name})=>name,()=>h('small',{},'Fonte local'),
 ()=>calls.push('chat'),()=>calls.push('review'),
 (app,action,payload)=>{calls.push(action+':'+JSON.stringify(payload));},
 ()=>h('div',{},'Real service preview'),()=>h('div',{},'Legacy tools'),
 {getElementById:()=>({focus(){}}),activeElement:null},
 ()=>h('section',{className:'mf-i2-rc'},'Laboratório I2-B/C sintético'));
const deep=(tree,predicate)=>{
 const out=[];const go=x=>{
  if(Array.isArray(x)){x.forEach(go);return;}
  if(x&&typeof x==='object'&&x.type){if(predicate(x))out.push(x);go(x.props?.children);}
 };go(tree);return out;
};
function report(overrides={}){
 const cards=[
 {id:'UI-01',source:'bank',profile:'real',capability:'available_read_only',uiState:'ready',count:2},
 {id:'UI-02',source:'synthetic',profile:'synthetic',uiState:'ready',count:1},
 {id:'UI-03',source:'manual',profile:'real',uiState:'ready',count:2},
 {id:'UI-04',source:'manual',profile:'real',capability:'available_read_only',uiState:'ready',
  budgets:[{category:'Alimentação',spentCents:76000,limitCents:70000},
   {category:'Lazer',spentCents:38000,limitCents:40000}]},
 {id:'UI-05',source:'planning',profile:'real',capability:'available_read_only',uiState:'ready',
  count:3,valueCents:44300},
 {id:'UI-06',uiState:'empty'},{id:'UI-07',uiState:'ready'},{id:'UI-08',uiState:'empty'}
 ];
 return {contract:'IC-v1/I-P0.1',privacy:{readOnly:true,changesApplied:false,modelCalled:false,
  personalAIWritingEnabled:false},cards,...overrides};
}
function app(){
 return {state:{mode:'real',month:'2026-11',intelligencePremiumSignature:'sig',
  localFinancialAccess:{token:'read',profile:'real',source:'manual',planning:true,expiresAt:Date.now()+600000},
  intelligencePremiumReport:report(),categoryReviewAvailable:true},
  setState(p,callback){Object.assign(this.state,p);if(callback)callback();},
  navigate(page){this.page=page;}};
}
const proposal={id:'streaming',name:'Streaming',pattern:'Streaming',category:'Streaming',
 compatible:5,examples:[
 {accountId:'a',externalId:'n',date:'2026-11-04',description:'Netflix',amount:-4490},
 {accountId:'a',externalId:'s',date:'2026-11-06',description:'Spotify',amount:-2190},
 {accountId:'a',externalId:'d',date:'2026-11-08',description:'Disney',amount:-4390},
 {accountId:'a',externalId:'aa',date:'2026-11-10',description:'Assinatura A',amount:-3340},
 {accountId:'a',externalId:'bb',date:'2026-11-12',description:'Assinatura B',amount:-3340}
 ]};
function reviewApp(){
 const a=app();a.state.categoryReviewGrant={token:'review-synthetic',expiresAt:Date.now()+600000};
 a.state.categoryReviewReport={suggestions:[proposal],audit:[],rules:[],decisions:[],categories:[],
  suggestionsTotal:1,scanned:5};
 a.state.categoryReviewQueue={rows:[],nextCursor:null};
 return a;
}
test('C1 — D03 renders 0 to 3 signals from IC signed facts, no static amounts',()=>{
 const a=app(),signals=f.mfD03Signals(report(),a);
 assert.equal(signals.length,2);
 assert.equal(signals[0].id,'budget-excess');
 assert.equal(signals[0].amountCents,6000);
 assert.equal(signals[1].id,'commitments');
 assert.equal(signals[1].amountCents,44300);
 assert(signals.every(x=>x.sourceCard));
 assert.equal(f.mfD03Signals(report({privacy:{readOnly:true,changesApplied:true,personalAIWritingEnabled:false}}),a).length,0);
});
test('C1 — stale/expired grant and changed signature deny cached financial signals',()=>{
 const a=app();
 a.state.localFinancialAccess.expiresAt=Date.now()-1000;
 assert.equal(f.mfD03Signals(report(),a).length,0);
 a.state.localFinancialAccess.expiresAt=Date.now()+600000;
 a.state.intelligencePremiumSignature='mismatch';
 assert.equal(f.mfD03Signals(report(),a).length,0);
});
test('C1 — budget severity derived, near-limit instead of false overflow',()=>{
 const a=app(),r=report();
 r.cards[3].budgets=[{category:'Alimentação',spentCents:65000,limitCents:70000}];
 const signals=f.mfD03Signals(r,a);
 assert.equal(signals[0].id,'commitments');
 const near=signals.find(x=>x.id==='budget-near');
 assert(near);assert.equal(near.amountCents,5000);
});
test('C1 — zero budget supported and no division by zero',()=>{
 const a=app(),r=report();
 r.cards[3].budgets=[{category:'Serviços',spentCents:1000,limitCents:0}];
 const x=f.mfD03Signals(r,a).find(y=>y.id==='budget-excess');
 assert(x);assert.equal(x.amountCents,1000);
});
test('C1 — no invented forward projection from monthly result',()=>{
 const a=app(),r=report();r.cards[3].budgets=[];
 r.cards[4].uiState='denied';
 assert.equal(f.mfD03Signals(r,a).length,0);
 const tree=f.renderMfD03Today(a);
 assert(deep(tree,x=>x.type==='h3').length>=1);
 const signalCards=deep(tree,x=>x.props?.className==='mf-d03-signal');
 assert.equal(signalCards.length,2);
 assert.match(css,/\.mf-d03-signal\{display:flex/);
 assert.match(css,/linear-gradient\(115deg,color-mix/);
});
test('C1 — unified SignalCard has functional drawer action',()=>{
 const a=app(),sig=f.mfD03Signals(report(),a)[0];
 const node=f.mfD03SignalCard(a,sig);
 const button=deep(node,x=>x.type==='button')[0];
 assert(button);button.props.onClick();
 assert.equal(a.state.mfD03Drawer.id,'budget-excess');
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('C1 — planning consent required for commitment signal',()=>{
 const a=app();a.state.localFinancialAccess.planning=false;
 assert.equal(f.mfD03Signals(report(),a).some(x=>x.id==='commitments'),false);
});
test('C2 — stable IDs, deduplication and 5-item subtotal in whole cents',()=>{
 const a=reviewApp(),entries=f.mfD04Entries(a);
 assert.equal(entries.length,1);assert.equal(entries[0].candidates.length,5);
 const d={...f.mfD04DraftFor(a,entries[0]),past:true,future:true};
 const total=f.mfD04Impact(entries[0],d,[]);
 assert.equal(total.count,5);assert.equal(total.cents,17750);
});
test('C2 — exclude Spotify by ID and recompute 15560 cents',()=>{
 const a=reviewApp(),e=f.mfD04Entries(a)[0],d={...f.mfD04DraftFor(a,e),past:true};
 const excluded=[f.mfD04StableId(proposal.examples[1])];
 const impact=f.mfD04Impact(e,d,excluded);
 assert.equal(impact.count,4);assert.equal(impact.cents,15560);
 assert.equal(f.mfD04ServiceEligible(a,e,d,excluded),false);
});
test('C2 — future-only changes neither counts nor spends historical cents',()=>{
 const a=reviewApp(),e=f.mfD04Entries(a)[0];
 const d={...f.mfD04DraftFor(a,e),past:false,future:true};
 const x=f.mfD04Impact(e,d,[]);
 assert.equal(x.count,0);assert.equal(x.cents,0);assert.equal(x.eligible,true);
 assert.equal(f.mfD04ServiceEligible(a,e,d,[]),true);
});
test('C2 — both scopes disabled fail closed',()=>{
 const a=reviewApp(),e=f.mfD04Entries(a)[0],d={...f.mfD04DraftFor(a,e),past:false,future:false};
 assert.equal(f.mfD04Impact(e,d,[]).eligible,false);
 assert.equal(f.mfD04ServiceEligible(a,e,d,[]),false);
});
test('C2 — unsupported changed criteria/color or historic-scope cannot reach service',()=>{
 const a=reviewApp(),e=f.mfD04Entries(a)[0],d=f.mfD04DraftFor(a,e);
 for(const update of [{terms:'Spotify'},{name:'Other'},{color:'#ff7a88'},{past:true}]){
  assert.equal(f.mfD04ServiceEligible(a,e,{...d,...update},[]),false);
 }
});
test('C2 — editing draft invalidates backend preview and clears confirmation',()=>{
 const a=reviewApp(),e=f.mfD04Entries(a)[0];
 a.state.categoryReviewPreview={id:'old'};a.state.categoryReviewConfirmed=true;
 f.mfD04Patch(a,e,{category:'Alimentação'});
 assert.equal(a.state.categoryReviewPreview,null);
 assert.equal(a.state.categoryReviewConfirmed,false);
 assert.equal(a.state.mfD04Drafts[e.id].category,'Alimentação');
 f.mfD04Discard(a,e);
 assert.equal(a.state.mfD04Drafts[e.id],undefined);
});
test('C2 — expired review grant returns no queue nor service eligibility',()=>{
 const a=reviewApp(),e=f.mfD04Entries(a)[0],d=f.mfD04DraftFor(a,e);
 a.state.categoryReviewGrant.expiresAt=Date.now()-1;
 assert.equal(f.mfD04Entries(a).length,0);
 assert.equal(f.mfD04ServiceEligible(a,e,d,[]),false);
});
test('C2 — approval preview only delegates to real synthetic existing backend',()=>{
 const a=reviewApp(),e=f.mfD04Entries(a)[0],d=f.mfD04DraftFor(a,e);
 const tree=f.mfD04Render(a);
 assert.equal(tree.type,'section');
 assert(deep(tree,x=>x.props?.className==='mf-d04-queue').length>0);
 assert.match(css,/\.mf-d04-body\{display:grid/);
 assert.match(css,/\.mf-d04-diff\{display:grid/);
 assert.doesNotMatch(source,/bankCategorize\(|ruleSave\(|categorySave\(|\.db\.|fetch\(/);
});
test('C2 — queue filters and history are wired to buttons',()=>{
 const a=reviewApp(),e=f.mfD04Entries(a)[0];
 const tree=f.mfD04Render(a);
 const controls=deep(tree,x=>x.type==='button');
 const history=controls.find(x=>x.props?.className===''&&x.props?.['aria-pressed']===false);
 assert(history);history.props.onClick();
 assert.equal(a.state.mfD04Stage,'history');
 const next=f.mfD04Render(a);
 assert.equal(deep(next,x=>x.props?.className==='mf-d04-item').length,0);
});
test('C2 — source integration preserved legacy review APIs without implementing IPC',()=>{
 assert.match(legacy,/function renderCategoryReviewLegacy\(app:any\)/);
 assert.match(legacy,/return mfD04Render\(app\)/);
 assert.match(view,/return renderMfD03Today\(app\)/);
 assert.match(legacy,/categoryReviewConfirm\(\{token:g.token,id:p.id,digest:p.digest/);
});


test('C2 — expired grant hides old review details and receipt from UI',()=>{
 const a=reviewApp();a.state.categoryReviewReceipt={id:'old-receipt'};
 a.state.categoryReviewGrant.expiresAt=Date.now()-1000;
 const tree=f.mfD04Render(a);
 assert.equal(deep(tree,x=>x.props?.className==='mf-d04-body').length,0);
 assert.equal(deep(tree,x=>x.props?.className==='mf-d04-receipt').length,0);
 assert.match(JSON.stringify(tree),/Autorize uma revisão supervisionada/);
});
test('C2 — renewal must reset cached queue, preview, receipt, confirmation and drafts',()=>{
 assert.match(legacy,/categoryReviewReport:null,categoryReviewQueue:null,categoryReviewPreview:null/);
 assert.match(legacy,/categoryReviewConfirmed:false,categoryReviewReceipt:null,categoryReviewSelected:\[\]/);
 assert.match(legacy,/mfD04Drafts:\{\},mfD04Excluded:\{\},mfD04Selected:null/);
});

test('C2 — real disable clears former grant drafts, confirmation, receipt and queued requests',async()=>{
 const js=ts.transpileModule(legacy,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
 const revoked=[];
 const fn=new Function('desktop',js+';return {categoryReviewDisable,categoryReviewConfirm};')({
  categoryReviewRevoke:async v=>{revoked.push(v.token);return {revoked:true};},
  categoryReviewConfirm:async()=>{throw Error('Expired approval must not reach service.');}
 });
 const a=reviewApp();
 Object.assign(a.state,{categoryReviewPreview:{id:'old-preview'},categoryReviewConfirmed:true,
  categoryReviewReceipt:{id:'old-receipt'},categoryReviewDetail:{id:'old-detail'},
  categoryReviewFilters:{accountId:'old'},categoryReviewFilterRevision:3,
  categoryReviewSelected:['old'],mfD04Drafts:{old:{category:'old'}},
  mfD04Excluded:{old:['tx-1']},mfD04Selected:'old',
  mfD04Error:'old',mfD04Stage:'history',mfD04Search:'old'});
 a.categoryReviewRequest=8;
 fn.categoryReviewDisable(a);
 assert.equal(a.state.categoryReviewGrant,null);
 for(const key of ['categoryReviewReport','categoryReviewQueue','categoryReviewPreview',
  'categoryReviewDetail','categoryReviewReceipt','mfD04Selected'])assert.equal(a.state[key],null);
 assert.equal(a.state.categoryReviewConfirmed,false);
 assert.deepEqual(a.state.mfD04Drafts,{});
 assert.deepEqual(a.state.mfD04Excluded,{});
 assert.deepEqual(a.state.categoryReviewFilters,{});
 assert.deepEqual(a.state.categoryReviewSelected,[]);
 assert.equal(a.state.categoryReviewFilterRevision,4);
 assert.equal(a.categoryReviewRequest,9);
 assert.equal(a.state.mfD04Stage,'pending');
 assert.equal(a.state.mfD04Search,'');
 await Promise.resolve();
 assert.deepEqual(revoked,['review-synthetic']);
 const expired=reviewApp();
 expired.state.categoryReviewPreview={id:'old',digest:'old'};
 expired.state.categoryReviewConfirmed=true;
 expired.state.categoryReviewGrant.expiresAt=Date.now()-1000;
 await fn.categoryReviewConfirm(expired);
});
test('C2 — real reauthorization replaces session state before fetching new queue',async()=>{
 const js=ts.transpileModule(legacy,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
 const calls=[];
 const fn=new Function('desktop',js+';return {categoryReviewEnable};')({
  categoryReviewAuthorize:async()=>({token:'review-fresh',expiresAt:Date.now()+600000}),
  categoryReviewList:async({token})=>{calls.push('list:'+token);return {suggestions:[],audit:[]};},
  categoryReviewQueue:async({token})=>{calls.push('queue:'+token);return {rows:[],nextCursor:null};}
 });
 const a=reviewApp();
 Object.assign(a.state,{categoryReviewReceipt:{id:'old'},categoryReviewPreview:{id:'old'},
  categoryReviewConfirmed:true,categoryReviewDetail:{id:'old'},categoryReviewFilters:{accountId:'old'},
  mfD04Drafts:{old:{category:'old'}},mfD04Excluded:{old:['old']},mfD04Selected:'old',
  mfD04Stage:'history',mfD04Search:'old'});
 await fn.categoryReviewEnable(a);
 assert.equal(a.state.categoryReviewGrant.token,'review-fresh');
 assert.equal(a.state.categoryReviewReceipt,null);
 assert.equal(a.state.categoryReviewDetail,null);
 assert.equal(a.state.categoryReviewPreview,null);
 assert.equal(a.state.categoryReviewConfirmed,false);
 assert.deepEqual(a.state.mfD04Drafts,{});
 assert.deepEqual(a.state.mfD04Excluded,{});
 assert.equal(a.state.mfD04Selected,null);
 assert.deepEqual(a.state.categoryReviewFilters,{});
 assert.equal(a.state.mfD04Stage,'pending');
 assert.deepEqual(calls,['list:review-fresh','queue:review-fresh']);
});
