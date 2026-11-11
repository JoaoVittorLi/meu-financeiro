'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/plan-view.ts'),'utf8');
const h=(tag,props,...children)=>({tag,props:props||{},children});
const evaluate=(start,end,name,bindings={})=>{
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'missing production function '+start);
 const compiled=ts.transpileModule(source.slice(a,b),{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
 return new Function(...Object.keys(bindings),compiled+';return '+name+';')(...Object.values(bindings));
};
const pDate=x=>x.split('-').reverse().join('/');
const endOfMonth=month=>{const [y,m]=month.split('-').map(Number);return month+'-'+String(new Date(y,m,0).getDate()).padStart(2,'0')};
const fmt=cents=>(cents/100).toFixed(2);
const day=evaluate('function pCalendarDayInfo(rows:any[]','function pCalendar(app:any','pCalendarDayInfo');
const calendar=evaluate('function pCalendar(app:any','// The graph marker is the slider:','pCalendar',{
 pDate,endOfMonth,pCalendarDayInfo:day,h,fmt,
 prettyMonth:x=>x,pAgenda:(app,rows)=>h('agenda',{count:rows.length})
});
const walk=(n,p,out=[])=>{
 if(Array.isArray(n)){for(const x of n)walk(x,p,out)}
 else if(n&&typeof n==='object'){if(p(n))out.push(n);walk(n.children,p,out)}
 return out;
};
const planned=(id,date,kind,amount,certainty='confirmed')=>({
 key:'plan:'+id,type:'planned',date,kind,amount,status:'pending',item:{id,certainty},title:id
});
const bank=(id,date,amount,kind='expense')=>({
 key:'bank:a|'+id,type:'bank',date,kind,amount,status:'paid',item:{accountId:'a',id},title:id
});
test('U5.2 — calendário diferencia realizado, previsto e incerto sem recontar valores',()=>{
 const rows=[bank('paid','2026-12-31',1500),planned('bill','2026-12-31','expense',4200),
  planned('bonus','2026-12-31','income',7500,'estimated')];
 assert.deepEqual(day(rows,'2026-12-31'),{
  count:3,recorded:1,expected:1,estimated:1,incoming:7500,outgoing:5700
 });
 assert.deepEqual(day(rows,'2027-01-01'),{count:0,recorded:0,expected:0,estimated:0,incoming:0,outgoing:0});
 assert.deepEqual(rows.map(x=>x.amount),[1500,4200,7500],'Display-only aggregation must not mutate rows');
});
test('U5.2 — dezembro/janeiro, limites do mês e seleção por teclado',()=>{
 for(const month of ['2026-12','2027-01']){
  const app={state:{planMonth:month,planDay:month+'-31'},setState(patch,cb){Object.assign(this.state,patch);cb?.()}};
  const tree=calendar(app,[]),buttons=walk(tree,x=>x.tag==='button'&&x.props['data-plan-day']);
  assert.equal(buttons.length,31);
  assert.equal(buttons[30].props['data-plan-day'],month+'-31');
  let prevented=0;
  const e={key:'ArrowRight',currentTarget:{parentElement:{querySelector:()=>({focus(){}})}},
   preventDefault(){prevented++},stopPropagation(){}};
  buttons[30].props.onKeyDown(e);
  assert.equal(app.state.planDay,month+'-31');
  e.key='Home';buttons[30].props.onKeyDown(e);assert.equal(app.state.planDay,month+'-01');
  e.key='End';buttons[0].props.onKeyDown(e);assert.equal(app.state.planDay,month+'-31');
  assert.equal(prevented,3);
 }
});
test('U5.2 — categoria do dia e tooltip mostram valores exatos dos registros filtrados',()=>{
 const rows=[planned('income','2026-12-24','income',10000),bank('purchase','2026-12-24',2499)];
 const app={state:{planMonth:'2026-12',planDay:'2026-12-24'},setState(p){Object.assign(this.state,p)}};
 const tree=calendar(app,rows),button=walk(tree,x=>x.props?.['data-plan-day']==='2026-12-24')[0];
 assert.match(button.props['aria-label'],/Entradas 100\.00 \/ Saídas 24\.99/);
 assert.match(button.props['aria-label'],/1 realizados, 1 previstos/);
 assert.equal(button.props['aria-pressed'],true);
 assert(button.children.some(child=>child.tag==='span'&&child.props.className==='u5-plan-day-flow'));
});
test('U5.2 — a projeção diária é uma única aba, não um details duplicado',()=>{
 const pFilterTransactions=()=>[],pTimeline=()=>h('timeline',{}),
 pAgenda=()=>h('agenda',{}),pCalendar=()=>h('calendar',{}),
 pUpcoming=()=>null,pSummary=()=>null,pSuggestions=()=>null,pMonthNavigation=()=>null;
 const render=evaluate('function renderPlanningView(app:any)','function renderPlanEditor(app:any)','renderPlanningView',{
 h,iso:()=> '2026-12-01',pFilterTransactions,pTimeline,pAgenda,pCalendar,pUpcoming,
 pSummary,pSuggestions,pMonthNavigation,prettyMonth:x=>x,pDate,
 Icon:()=>null,StyledSelect:()=>null
 });
 const state={mode:'real',planPresentation:'projection',planMonth:'2026-12',planDay:'2026-12-01',
   planView:'all',planTerm:'',planIncludeEstimated:false,bankBusy:false,planBusy:false,
   bank:{data:{truncated:false}},planning:{items:[],generatedAt:'2026-12-01',
     projection:{reference:{quality:'recent'},negativeDays:[]},suggestions:[]}};
 const app={state,setState(patch){Object.assign(this.state,patch)}};
 const p=render(app);
 assert.equal(walk(p,x=>x.tag==='timeline').length,1);
 assert.equal(walk(p,x=>x.tag==='details'&&x.props.className==='mf-planning-projection').length,0);
 assert.equal(walk(p,x=>x.tag==='agenda').length,0);
 app.state.planPresentation='calendar';const c=render(app);
 assert.equal(walk(c,x=>x.tag==='calendar').length,1);
 assert.equal(walk(c,x=>x.tag==='timeline').length,0);
});
test('U5.2 — contrato sem saldo: projeção sem linha usa travessão, nunca zero inventado',()=>{
 const p=source.slice(source.indexOf('function pTimeline(app:any)'),source.indexOf('function pSuggestions(app:any)'));
 assert.match(p,/selected\?fmt\(selected\.closing\):'—'/);
 assert.match(p,/rows\.length\?h\('svg'/);
 assert.match(p,/Ainda não há dados para mostrar o gráfico/);
});

test('U5.2 — compromissos do mês/ano distinguem receitas confirmadas, incertas e canceladas',()=>{
 const advanceDate=(day,offset)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)};
 const summary=evaluate('function pMonthSummary(items:PlanItem[]','function pSummary(app:any)','pMonthSummary',{advanceDate});
 const make=(id,dueDate,kind,remaining,certainty='confirmed',status='planned')=>
  ({id,dueDate,kind,remaining,certainty,status});
 const items=[
  make('due','2026-12-31','expense',4500),
  make('jan','2027-01-01','expense',10000),
  make('confirmed','2026-12-29','income',7000),
  make('uncertain','2026-12-30','income',50000,'estimated'),
  make('cancel','2026-12-28','expense',9999,'confirmed','cancelled'),
  make('paid','2026-12-25','expense',3000,'confirmed','paid')];
 const dec=summary(items,'2026-12','2026-12-28');
 assert.equal(dec.expense,4500);
 assert.equal(dec.income,7000,'Estimated income must not be counted in conservative forecast');
 assert.equal(dec.overdue,0);
 const jan=summary(items,'2027-01','2026-12-28');
 assert.equal(jan.expense,10000);
 assert.equal(jan.income,0);
 assert.deepEqual(items.map(x=>x.remaining),[4500,10000,7000,50000,9999,3000]);
});
test('U5.2 — calendário/agenda usam IDs compostos e não duplicam pagamentos vinculados',()=>{
 const filter=evaluate('function pFilterTransactions(app:any)','// UI-03:', 'pFilterTransactions');
 const entry=(id,accountId,extra={})=>({
  id,accountId,accountName:'Conta sintética',date:'2026-12-31',amount:-4500,
  status:'POSTED',category:'Outros',description:'Compra sintética '+accountId,...extra
 });
 const original=entry('same','account-A',{linkedManualId:'manual-a'});
 const other=entry('same','account-B');
 const item={id:'plan-a',dueDate:'2026-12-31',title:'Parcela prevista',kind:'expense',category:'Outros',
   amount:4500,effectiveStatus:'paid',links:[{accountId:'account-A',externalId:'same',status:'POSTED',description:'Pago'}]};
 const app={state:{mode:'real',planMonth:'2026-12',planTerm:'',planView:'all',
  planning:{items:[item]},bank:{data:{transactions:[original,other]}},
  data:{transactions:[{id:'manual-a',date:'2026-12-31',description:'Manual vinculado',category:'Outros',
   kind:'expense',amount:4500}]}}};
 const before=JSON.stringify(app.state),rows=filter(app);
 assert.deepEqual(rows.map(x=>x.key),['bank:account-B|same','plan:plan-a']);
 assert.equal(new Set(rows.map(x=>x.key)).size,rows.length);
 assert.equal(JSON.stringify(app.state),before);
});
