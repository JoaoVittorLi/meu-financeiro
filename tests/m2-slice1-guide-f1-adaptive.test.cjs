'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');

const lang=require('../shared/copilot-language.cjs');
const {parseIntent,compareSpendingBreakdown,describeInvestigation}=require('../electron/intelligence-investigation.cjs');
const {period}=require('../electron/financial-intelligence.cjs');
const {aggregateFinancePeriod}=require('../shared/finance-period-ledger.mjs');
const {IC2ReadQueryGateway,assertIC2}=require('../electron/intelligence-ic2-adapter.cjs');

const NOW=()=>Date.parse('2026-12-01T12:00:00Z');
const OWNER=17,TOKEN='slice1-secret-token';

function rec(id,date,amount,category,merchant){
 return {id,accountId:'acc-1',date,status:'POSTED',nature:amount<0?'expense':'income',
  amount,category,merchant,description:merchant};
}
function setupF1(){
 const records=[
  rec('o1','2026-10-05',250000,'Receitas','Salário'),
  rec('o2','2026-10-10',-12000,'Alimentação','Supermercado Sol'),
  rec('o3','2026-10-12',-5000,'Transporte','App Corrida'),
  rec('n1','2026-11-05',320000,'Receitas','Salário'),
  rec('n2','2026-11-09',-18000,'Alimentação','Supermercado Sol'),
  rec('n3','2026-11-12',-5000,'Transporte','App Corrida')
 ];
 const db={
  bankOverview(){return {accounts:[{id:'acc-1'}],transactions:records,totalTransactions:records.length,truncated:false,last:{completedAt:'2026-11-30T21:00:00Z'}};},
  load(){return {transactions:[],budgets:{}};},
  save(){throw Error('Proibido gravar no modo consulta');}
 };
 const local={db,query(input,owner){
  if(owner!==OWNER||input.token!==TOKEN)throw Error('Autorização inválida');
  const p=period(input.month);
  const rows=records.map(r=>({date:r.date,status:r.status,nature:r.nature,amountCents:r.amount,category:r.category}));
  const agg=aggregateFinancePeriod(rows,{...p,source:'bank'});
  return {version:1,readOnly:true,changesApplied:false,inferenceCalled:false,
   references:{source:'bank',profile:'real',period:p,partial:false,loaded:records.length,readAt:'2026-12-01T12:00:00Z'},
   facts:{expenseCents:agg.expenseCents,incomeCents:agg.incomeCents}};
 }};
 return {local,gateway:new IC2ReadQueryGateway(local,{clock:NOW}),scope:{owner:OWNER,token:TOKEN,source:'bank',profile:'real',month:'2026-11'}};
}

test('M2-S1/guide: formatação em centavos, remoção de jargão interno e separação epistêmica',()=>{
 assert.equal(lang.COPILOT_GUIDE_VERSION,'M2-GUIDE-V1');
 assert.match(lang.formatMoneyBRL(12345),/R\$\s*123,45/);
 assert.equal(lang.formatMoneyBRL(12.5),'valor não verificável');
 assert.equal(lang.formatMoneyBRL(NaN),'valor não verificável');
 assert.equal(lang.formatPercentOrNull(null),'base zero');
 assert.equal(lang.formatPercentOrNull(14.26),'14,3%');
 assert.equal(lang.stripInternalJargon('Via IC2 e D05 no UI-01'),'Via consulta local e consulta local no consulta local');
 const txt=lang.buildCopilotAnswer({
  headline:'Resumo',
  facts:['Fato A'],
  hypotheses:['Hipótese B'],
  limitations:['Limitação C'],
  guideNote:lang.GUARDRAIL_COPY.NOT_AVAILABLE_BALANCE
 });
 assert(txt.length<=4000);
 assert.match(txt,/Hipóteses a confirmar: Hipótese B/);
 assert.match(txt,/Limitações: Limitação C/);
 assert.match(txt,/não equivale a saldo bancário disponível/);
});

test('M2-S1/F1: investigação de variação de receita sem sequestrar Sankey nem total genérico',async()=>{
 assert.equal(parseIntent('Para onde foi minha renda?',{},'2026-11'),null);
 assert.equal(parseIntent('Quanto gastei neste mês?',{},'2026-11'),null);
 const incIntent=parseIntent('Por que minha receita aumentou de outubro para novembro?',{},'2026-11');
 assert(incIntent?.focusIncome===true);

 const env=setupF1();
 const info=compareSpendingBreakdown({local:env.local,scope:env.scope,intention:incIntent,clock:NOW});
 assert.equal(info.guideVersion,'M2-GUIDE-V1');
 assert.equal(info.incomePreviousCents,250000);
 assert.equal(info.incomeCurrentCents,320000);
 assert.equal(info.incomeDeltaCents,70000);
 assert.equal(info.incomePercentChange,28);
 const text=describeInvestigation(info,incIntent,{});
 assert.match(text,/receitas confirmadas/i);
 assert.match(text,/não equivale a saldo bancário disponível/i);

 const req={token:TOKEN,source:'bank',profile:'real',month:'2026-11',question:'Por que meus gastos aumentaram?'};
 const reply=await env.gateway.ask(req,OWNER);
 assertIC2(reply,req);
 assert(reply.followUps.every(f=>typeof f.question==='string'&&f.question.length>5));
 assert(!JSON.stringify(reply).includes(TOKEN));
});

test('M2-S1/adaptive: densidade adaptativa, blocos suplementares, D05 e proteção WeakMap em IC2',async()=>{
 const env=setupF1();
 const req={token:TOKEN,source:'bank',profile:'real',month:'2026-11',question:'Por que meus gastos aumentaram?'};
 const reply=await env.gateway.ask(req,OWNER);

 const src=fs.readFileSync(path.resolve(__dirname,'../src/intelligence-ic2.ts'),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
 const calls=[];
 const h=(tag,props,...children)=>typeof tag==='function'?tag({...(props||{}),children}):{tag,props:props||{},children:children.flat(8).filter(x=>x!==null&&x!==undefined)};
 const fakeGlyph=(p)=>h('span',{className:'qa84-category-glyph','data-cat':p?.identity?.categoryId||'none'});
 const fakeResolve=({categoryId,categoryName})=>({categoryId:categoryId||'cat:outros',iconKey:'utensils',hue:150,label:categoryName||'Categoria'});
 const client=new Function('h','intelligencePremiumSignature','resolveCategoryVisualIdentity','CategoryVisualGlyph','intelligenceSubmitQuestion',js+
  ';return {mfIC2BindMessage,mfIC2MessageLive,mfIC2AdaptiveDensity,mfIC2AdaptiveModel,renderMfIC2Adaptive};')(
  h,()=>'sig-1',fakeResolve,fakeGlyph,(_app,q)=>calls.push(q));

 const grant={token:TOKEN,source:'bank',profile:'real',expiresAt:Date.now()+600000};
 const app={state:{mode:'real',month:'2026-11',localFinancialAccess:grant,intelligencePanelOpen:false,mfV3AnalysisMessageId:null}};
 const msg={id:'ic2-a-10',role:'assistant',text:reply.answer,status:'done',ic2Reply:reply};
 client.mfIC2BindMessage(msg,grant,'sig-1','2026-11');

 assert.equal(client.mfIC2AdaptiveDensity(app,msg),'standard');
 app.state.intelligencePanelOpen=true;
 assert.equal(client.mfIC2AdaptiveDensity(app,msg),'compact');
 app.state.intelligencePanelOpen=false;
 app.state.mfV3AnalysisMessageId='ic2-a-10';
 assert.equal(client.mfIC2AdaptiveDensity(app,msg),'analysis');

 const model=client.mfIC2AdaptiveModel(reply,'analysis');
 assert(model.metrics.length<=4);
 assert(model.blocks.length<=3);
 assert(model.rows.some(r=>r.categoryId==='cat:alimentacao'));
 assert(model.supplementary.some(b=>b.kind==='merchants'));
 assert(model.evidenceSummary.count>=2);

 const rendered=client.renderMfIC2Adaptive(app,msg);
 const serialized=JSON.stringify(rendered);
 assert(serialized.includes('mf-ic2-adaptive'));
 assert(serialized.includes('qa84-category-glyph'));
 assert(serialized.includes('Supermercado Sol'));
 assert(!serialized.includes(TOKEN));

 // Expiry / replaced grant immediately blocks rendering
 app.state.localFinancialAccess={...grant,expiresAt:Date.now()-5};
 assert.equal(client.renderMfIC2Adaptive(app,msg),null);
});
