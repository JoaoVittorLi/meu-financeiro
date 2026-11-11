'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function runtime(bridge){
 const h=(tag,props,...children)=>({tag,props:props||{},children});
 class Component{constructor(props){this.props=props||{};this.state={};}setState(patch,done){Object.assign(this.state,typeof patch==='function'?patch(this.state):patch);if(done)done();}}
 const window={financeDesktop:bridge,addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false}),MFAppearance:{get:()=> 'light'}};
 const context={React:{Component,createElement:h},ReactDOM:{render(){}},window,localStorage:{getItem:()=>null,setItem(){throw Error('Unexpected persistence');}},document:{getElementById:()=>({}),addEventListener(){}},console,Date,Map,Set,Math,Intl,JSON,setTimeout(){},clearTimeout(){}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/app.js'),'utf8'),context);
 const app=vm.runInContext('new App({})',context);app.state={...app.state,busy:false,booting:false,mode:'real',month:'2026-11',dashboardSource:'manual'};
 return {app,get:name=>vm.runInContext(name,context)};
}
function walk(n,accept,out=[]){if(Array.isArray(n))for(const x of n)walk(x,accept,out);else if(n&&typeof n==='object'){if(accept(n))out.push(n);walk(n.children,accept,out);}return out;}
const account=(id,balance,updatedAt)=>({id,name:'Conta '+id,balance,updatedAt,subtype:'Conta corrente'});
const tx=(id,accountId,status='POSTED',reviewed=false)=>({id,accountId,status,reviewed,date:'2026-11-09',amount:-1000,category:'Outros',description:id,accountName:accountId});
const result=(extra={})=>({engine:'planning',principal:300000,monthly:50000,total:300000,interest:0,installments:6,firstDueDate:'2026-12-09',baselineMinimum:250000,minimumAfterPurchase:75000,worstDay:'2026-12-09',reserve:50000,reference:{quality:'unverified'},risk:'estimate',rows:[{month:'2026-11',withoutPurchase:250000,withPurchase:250000},{month:'2026-12',withoutPurchase:250000,withPurchase:200000}],...extra});
test('U3 budget signals distinguish zero limits, no limits and no spending without inflating coverage',()=>{
 const {get}=runtime(),signals=get('u3BudgetSignals');let s=signals([{total:1000,hasLimit:true,limit:0},{total:9000,hasLimit:true,limit:10000},{total:10000,hasLimit:false}],20000);
 assert.equal(s.exceeded,1);assert.equal(s.near,1);assert.equal(s.unlimited,1);assert.equal(s.covered,50);assert.equal(s.limit,10000);
 assert.equal(signals([],0).covered,null);assert.equal(signals([{total:0,hasLimit:true,limit:0}],0).exceeded,0);assert.equal(signals([{total:1,hasLimit:true,limit:0}],1).covered,100);
});
test('U3 budget attention filters and limit actions only change presentation until saving',()=>{
 const {app}=runtime();app.state.data={...app.state.data,budgets:{Alimentação:0,Moradia:10000},transactions:[{id:'a',date:'2026-11-09',description:'Food',category:'Alimentação',kind:'expense',amount:1000},{id:'b',date:'2026-11-09',description:'Rent',category:'Moradia',kind:'expense',amount:9500},{id:'c',date:'2026-11-09',description:'Other',category:'Outros',kind:'expense',amount:5000}]};
 const before=JSON.stringify(app.state.data);let view=app.renderBudgets();const focus=walk(view,n=>n.props?.className==='u3-insight-action')[0];focus.props.onClick();assert.equal(app.state.budgetFocus,'attention');
 view=app.renderBudgets();let cards=walk(view,n=>String(n.props?.className||'').split(' ').includes('mf-budget-card'));assert.equal(cards.length,2);
 const edit=walk(cards[0],n=>n.tag==='button'&&n.children.includes('Editar limite'))[0];edit.props.onClick();assert.equal(app.state.editModal.type,'budget');assert.equal(app.state.editModal.value,'0,00');assert.equal(JSON.stringify(app.state.data),before);
 app.state.budgetFocus='unlimited';cards=walk(app.renderBudgets(),n=>String(n.props?.className||'').split(' ').includes('mf-budget-card'));assert.equal(cards.length,1);assert.match(JSON.stringify(cards[0]),/Outros/);
 app.state.budgetSearch='inexistente';assert.match(JSON.stringify(app.renderBudgets()),/Nenhuma categoria para estes filtros/);
 app.state.budgetTab='income';assert.doesNotMatch(JSON.stringify(app.renderBudgets()),/Gastos com um limite definido/);
});
test('U3 account freshness uses the received timestamp, handles unknown/zero balances and scopes counters by account',()=>{
 const {get}=runtime(),now=Date.parse('2026-11-09T12:00:00Z'),signal=get('u3AccountSignals');
 let s=signal(account('a',0,'2026-11-09T10:00:00Z'),[tx('same','a','PENDING',true),tx('same','b')],now);
 assert.equal(s.attention,false);assert.equal(s.pending,1);assert.equal(s.review,0);assert.equal(s.count,1);
 assert.equal(signal(account('a',null,'2026-11-09T10:00:00Z'),[],now).attention,true);
 assert.equal(signal(account('a',100,'2026-11-08T11:59:59Z'),[],now).reference.status,'stale');
 for(const value of ['', 'invalid','2026-11-09','2026-11-10T12:00:00Z'])assert.equal(signal(account('a',100,value),[],now).reference.status,'unknown');
 assert.equal(signal(account('a',100,'2026-11-08T12:00:00Z'),[],now).reference.status,'recent');
});
test('U3 account actions filter by exact account identity and never expose connection secrets in cards',()=>{
 const {app}=runtime({});const now=new Date().toISOString();app.state.bank={config:{configured:true,secure:true},data:{accounts:[account('a',0,now),account('b',null,now)],transactions:[tx('same','a'),tx('same','b','PENDING')],items:[],last:null}};
 app.state.bankForm.clientSecret='SYNTHETIC_PRIVATE_KEY';const view=app.renderBanks(),cards=walk(view,n=>n.props?.className==='bank-account u3-account-card');assert.equal(cards.length,2);assert.doesNotMatch(JSON.stringify(cards),/SYNTHETIC_PRIVATE_KEY/);assert.match(JSON.stringify(cards[1]),/Saldo não disponível/);assert.match(JSON.stringify(cards[0]),/R\$/);
 let navigated=null;app.navigate=page=>navigated=page;walk(cards[1],n=>n.tag==='button')[0].props.onClick();assert.equal(app.state.bankFilter,'b');assert.equal(app.state.txSource,'bank');assert.equal(app.state.query,'');assert.equal(navigated,'transactions');
 app.state.accountFocus='attention';assert.equal(walk(app.renderBanks(),n=>n.props?.className==='bank-account u3-account-card').length,1);
});
test('U3 comparison freezes A, preserves a visibly stale B on input edits and keeps finance data',()=>{
 const {app}=runtime({}),before=JSON.stringify([app.state.data,app.state.planning,app.state.bank]);
 app.state.sim={value:'3000',installments:'6',interest:'0'};
 app.state.outcome=result();app.state.simCalculatedInput={...app.state.sim};
 app.state.simResultStale=false;app.saveSimulation();
 app.state.outcome.rows[0].withPurchase=1;
 assert.equal(app.state.simSaved.result.rows[0].withPurchase,250000);
 const old=app.state.outcome;
 app.setSimulation({installments:'12'});
 assert.equal(app.state.outcome,old,'Last result stays visible until recalculated');
 assert.equal(app.isSimulationStale(),true);
 assert.equal(app.state.simSaved.result.installments,6);
 assert.match(JSON.stringify(app.renderSimulationComparison()),/recalcule as novas premissas/i);
 app.state.outcome=result({monthly:28000,total:336000,interest:36000,installments:12});
 app.state.simCalculatedInput={...app.state.sim};app.state.simResultStale=false;
 let rendered=JSON.stringify(app.renderSimulationComparison());
 assert.match(rendered,/maior/);assert.match(rendered,/Menor saldo projetado/);
 app.state.outcome={...app.state.outcome,engine:undefined,count:12};
 rendered=JSON.stringify(app.renderSimulationComparison());
 assert.doesNotMatch(rendered,/Menor saldo projetado/);
 assert.match(rendered,/motores diferentes/);
 assert.equal(JSON.stringify([app.state.data,app.state.planning,app.state.bank]),before);
});
test('U3 ignores late simulation responses after edits, navigation or a newer request',async()=>{
 const pending=[];let calls=0;const {app}=runtime({planSimulate:params=>{calls++;return new Promise(resolve=>pending.push({resolve,params}));}});app.state.sim={value:'3000',installments:'6',interest:'0'};
 const first=app.runSim();assert.equal(app.state.simBusy,true);app.setSimulation({value:'4000'});pending[0].resolve(result());await first;assert.equal(app.state.outcome,null);assert.equal(app.state.simBusy,false);
 const second=app.runSim(),third=app.runSim();pending[2].resolve(result({principal:400000}));await third;pending[1].resolve(result({principal:1}));await second;assert.equal(app.state.outcome.principal,400000);
 const fourth=app.runSim();app.navigate('overview');pending[3].resolve(result());await fourth;assert.equal(app.state.outcome,null);assert.equal(app.state.simBusy,false);assert.equal(calls,4);assert.equal(pending[1].params.includeEstimatedIncome,false);
});
test('U3 chart shows canonical month-end values, handles negative balances and exposes every month in data table',()=>{
 const {app,get}=runtime();const rows=Array.from({length:14},(_,i)=>({month:'2026-'+String(i%12+1).padStart(2,'0'),withoutPurchase:250000-i*50000,withPurchase:200000-i*50000}));
 const before=JSON.stringify(rows),chart=get('U3ScenarioChart')({rows}),paths=walk(chart,n=>n.tag==='path');assert.equal(paths.length,2);assert.ok(paths.every(n=>!n.props.d.includes('NaN')));assert.equal(walk(chart,n=>n.tag==='circle').length,12);assert.equal(JSON.stringify(rows),before);
 app.state.outcome=result({rows});const view=app.renderResult(app.state.outcome);assert.equal(walk(view,n=>n.tag==='tbody')[0].children[0].length,14);assert.match(JSON.stringify(view),/não representa o menor saldo diário/);
 assert.equal(get('U3ScenarioChart')({rows:[]}),null);
 for(const value of [0,1]){const tiny=get('U3ScenarioChart')({rows:[{month:'2026-11',withPurchase:value,withoutPurchase:value}]});const labels=walk(tiny,n=>n.tag==='text'&&n.props.x===3).map(n=>n.children.join(''));assert.equal(new Set(labels).size,3);}
});
test('U3 first-due-date is offered only for daily simulations and profile mode remains explicitly simplified',()=>{
 const profile=runtime().app;assert.match(JSON.stringify(profile.renderAssistant()),/cenário simplificado/);assert.doesNotMatch(JSON.stringify(profile.renderAssistant()),/Primeiro vencimento/);
 const daily=runtime({}).app;assert.match(JSON.stringify(daily.renderAssistant()),/Primeiro vencimento/);assert.doesNotMatch(JSON.stringify(daily.renderAssistant()),/começa no próximo mês/);
});
