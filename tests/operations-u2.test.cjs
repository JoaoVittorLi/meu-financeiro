'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function runtime(){
 const h=(tag,props,...children)=>({tag,props:props||{},children});
 class Component{constructor(props){this.props=props||{};this.state={};}setState(patch,done){Object.assign(this.state,typeof patch==='function'?patch(this.state):patch);if(done)done();}}
 const storage={getItem:()=>null,setItem(){throw Error('Rendering must not write');}};
 const window={addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false}),MFAppearance:{get:()=> 'light'}};
 const c={React:{Component,createElement:h},ReactDOM:{render(){}},window,localStorage:storage,document:{getElementById:()=>({}),addEventListener(){}},console,Date,Map,Set,Math,Intl,JSON,setTimeout(){},clearTimeout(){}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'app/app.js'),'utf8'),c);
 const app=vm.runInContext('new App({})',c);app.state={...app.state,mode:'real',booting:false,overviewPeriod:'custom',customStart:'2026-11-01',customEnd:'2026-11-30',planMonth:'2026-11',planDay:'2026-11-09'};
 return {app,get:name=>vm.runInContext(name,c)};
}
function walk(n,test,out=[]){if(Array.isArray(n))for(const x of n)walk(x,test,out);else if(n&&typeof n==='object'){if(test(n))out.push(n);walk(n.children,test,out);}return out;}
const bank=(id,amount,extra={})=>({id,amount,date:'2026-11-09',description:'Original '+id,category:'Outros',status:'POSTED',accountId:'a',accountName:'Conta A',...extra});
const plan=(id,extra={})=>({id,title:id,kind:'expense',amount:10000,remaining:7000,paid:3000,status:'planned',effectiveStatus:'pending',dueDate:'2026-11-09',category:'Outros',certainty:'confirmed',links:[],...extra});
test('U2 filtered summaries separate origins, settlement, review, nature and linked manual records',()=>{
 const {app,get}=runtime();app.state.bank={...app.state.bank,data:{...app.state.bank.data,transactions:[bank('income',50000,{reviewed:true}),bank('expense',-12000,{linkedManualId:'manual'}),bank('pending',-9000,{status:'PENDING',reviewed:true}),bank('transfer',-30000,{nature:'transfer'}),bank('ignore',-2000,{nature:'ignore'}),bank('old',-5000,{date:'2026-10-31'}),bank('same',-1000,{accountId:'b',accountName:'Conta B'})]}};
 app.state.data={...app.state.data,transactions:[{id:'manual',date:'2026-11-09',description:'Manual',kind:'expense',amount:12000,category:'Outros'}]};
 const before=JSON.stringify(app.state),rows=get('transactionViewRows')(app.state),summary=get('transactionViewSummary')(rows,'bank');
 assert.equal(rows.length,7);assert.equal(summary.income,50000);assert.equal(summary.expense,13000);assert.equal(summary.net,37000);assert.equal(summary.pending,1);assert.equal(summary.review,4);assert.equal(summary.excluded,2);
 assert.equal(get('transactionViewSummary')(rows,'manual').expense,12000);assert.equal(JSON.stringify(app.state),before);
 app.state.bankFilter='b';assert.equal(get('transactionViewRows')(app.state).length,1);
 app.state.bankFilter='';app.state.query='conta b';assert.equal(get('transactionViewRows')(app.state).length,1);
 app.state.query='';app.state.txReviewOnly=true;const review=get('transactionViewRows')(app.state);assert.equal(review.length,5);assert.ok(review.some(r=>r.raw.id==='old'));assert.ok(review.every(r=>r.origin==='bank'&&!r.raw.reviewed));
});
test('U2 totals include every filtered record beyond the table limit and show payment/review independently',()=>{
 const {app,get}=runtime();app.state.bank={...app.state.bank,data:{...app.state.bank.data,transactions:Array.from({length:503},(_,i)=>bank('row'+i,-100,{reviewed:i===0}))}};
 const rows=get('transactionViewRows')(app.state);assert.equal(rows.length,503);assert.equal(get('transactionViewSummary')(rows,'bank').expense,50300);
 const rendered=app.renderTransactions(),text=JSON.stringify(rendered);assert.match(text,/primeiros 500/);assert.match(text,/Confirmada/);assert.match(text,/✓ Revisada/);assert.match(text,/A conferir/);assert.equal(walk(rendered,n=>n.tag==='tbody')[0].children[0].length,500);
});
test('U2 monthly commitments use remaining amounts, exclude paid/cancelled/uncertain income and cross-month dates',()=>{
 const {get}=runtime(),items=[plan('overdue',{dueDate:'2026-11-08'}),plan('today'),plan('soon',{dueDate:'2026-11-15'}),plan('after',{dueDate:'2026-11-16'}),plan('old',{dueDate:'2026-10-31'}),plan('next',{dueDate:'2026-12-01'}),plan('paid',{status:'paid'}),plan('cancelled',{status:'cancelled'}),plan('income',{kind:'income',remaining:25000}),plan('uncertain',{kind:'income',certainty:'estimated',remaining:99999})];
 const before=JSON.stringify(items),s=get('pMonthSummary')(items,'2026-11','2026-11-09');
 assert.equal(s.expense,28000);assert.equal(s.overdue,7000);assert.equal(s.overdueCount,1);assert.equal(s.soon,14000);assert.equal(s.soonCount,2);assert.equal(s.income,25000);assert.equal(JSON.stringify(items),before);
 assert.equal(get('pMonthSummary')(items,'2026-12','2026-11-30').soon,7000);
});
test('U2 unified agenda deduplicates settled bank links by account and retains manual until settlement',()=>{
 const {app,get}=runtime();app.state.planning={...app.state.planning,items:[plan('p',{links:[{accountId:'a',externalId:'same',status:'POSTED',description:'Original'}]})]};
 app.state.bank={...app.state.bank,data:{...app.state.bank.data,transactions:[bank('same',-10000),bank('same',-10000,{accountId:'b'}),bank('pending',-9000,{status:'PENDING',linkedManualId:'m'})]}};
 app.state.data={...app.state.data,transactions:[{id:'m',date:'2026-11-09',description:'Manual',kind:'expense',amount:9000,category:'Outros'}]};
 let rows=get('pFilterTransactions')(app);assert.equal(rows.length,4);assert.ok(rows.some(r=>r.key==='bank:b|same'));assert.ok(!rows.some(r=>r.key==='bank:a|same'));assert.ok(rows.some(r=>r.key==='manual:m'));
 app.state.bank.data.transactions[2].status='POSTED';assert.ok(!get('pFilterTransactions')(app).some(r=>r.key==='manual:m'));
 app.state.planView='bank';rows=get('pFilterTransactions')(app);assert.equal(rows.length,3);
});
test('U2 calendar and view controls preserve identities and do not mutate financial data',()=>{
 const {app,get}=runtime();app.state.planning={...app.state.planning,generatedAt:'2026-11-09T12:00:00Z',items:[plan('demo')]};
 app.state.planPresentation='calendar';const before=JSON.stringify([app.state.data,app.state.bank,app.state.planning]);
 const rendered=get('renderPlanningView')(app),calendar=walk(rendered,n=>n.props?.className==='u2-calendar-grid')[0],days=walk(calendar,n=>n.tag==='button');assert.equal(days.length,30);
 const selected=days.find(n=>n.props['aria-label'].startsWith('09/11/2026'));selected.props.onClick();assert.equal(app.state.planDay,'2026-11-09');
 let opened=null;app.openPlanDetail=id=>opened=id;const row=get('pLedgerRow')(app,get('pFilterTransactions')(app)[0]);row.props.onClick();assert.equal(opened,'demo');
 const tabs=walk(rendered,n=>n.props?.className==='u2-view-tabs')[0],projection=walk(tabs,n=>n.tag==='button').find(n=>n.children.includes('Projeção diária'));projection.props.onClick();assert.equal(app.state.planPresentation,'projection');assert.equal(walk(get('renderPlanningView')(app),n=>n.tag==='details'&&n.props.className==='mf-planning-projection')[0].props.open,true);
 assert.equal(JSON.stringify([app.state.data,app.state.bank,app.state.planning]),before);
});
test('U2 unloaded planning is distinct from a loaded empty agenda',()=>{
 const {app,get}=runtime();assert.match(JSON.stringify(get('pSummary')(app)),/Agenda ainda não carregada/);
 app.state.planning={...app.state.planning,generatedAt:'2026-11-09T12:00:00Z'};assert.doesNotMatch(JSON.stringify(get('pSummary')(app)),/Agenda ainda não carregada/);
});
