'use strict';
// Verified Windows plan snapshot shown as a month calendar in the PWA.
// This is a read-only schedule; DO NOT derive bank balance or settlement.
const planCal=id=>document.getElementById(id);
const planNow=new Date();
const planCalendar={year:planNow.getFullYear(),month:planNow.getMonth(),date:null,plans:[],loaded:false};
const planMoney=cents=>Number.isSafeInteger(cents)?
  (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
const planISO=(y,m,d)=>String(y).padStart(4,'0')+'-'+String(m+1).padStart(2,'0')+
  '-'+String(d).padStart(2,'0');
const planLabel=(tag,label,cls)=>{
  const node=document.createElement(tag);
  node.textContent=String(label??'');
  if(cls)node.className=cls;
  return node;
};
function planMonthText(y,m){
  const s=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})
    .format(new Date(Date.UTC(y,m,1)));
  return s.charAt(0).toLocaleUpperCase('pt-BR')+s.slice(1);
}
function planCalendarValid(p){
  return p&&typeof p.dueDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate)&&
    typeof p.title==='string'&&typeof p.category==='string'&&
    Number.isSafeInteger(p.amountCents)&&p.amountCents>0&&
    ['income','expense'].includes(p.kind)&&
    ['planned','settled','settled_manual','cancelled'].includes(p.status);
}
function planCalendarMetric(title,value,hint){
  const card=planLabel('div','','finance-plan-calendar-metric');
  card.append(planLabel('span',title,'finance-muted'));
  card.append(planLabel('strong',value,''));
  card.append(planLabel('small',hint,'finance-muted'));
  return card;
}
function planDailyStatus(p){
  if(p.status==='cancelled')return 'Cancelado';
  if(p.status==='settled'||p.status==='settled_manual')return 'Pago';
  return p.kind==='income'?
    (p.certainty==='estimated'?'Receita incerta':'Receita prevista'):'Despesa pendente';
}
function planCalendarSelection(){
  const target=planCal('planCalendarSelection');
  target.replaceChildren();
  if(!planCalendar.date){
    target.append(planLabel('p','Selecione um dia para consultar seus compromissos.','finance-muted'));
    return;
  }
  const filtered=planCalendar.plans.filter(p=>p.dueDate===planCalendar.date)
    .sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
  const date=planCalendar.date;
  target.append(planLabel('h3','Compromissos de '+date.slice(8,10)+'/'+date.slice(5,7)+'/'+date.slice(0,4)));
  if(!filtered.length){
    target.append(planLabel('p','Nenhum compromisso cadastrado neste dia.','finance-muted'));
    return;
  }
  const list=planLabel('ul','','finance-list');
  for(const p of filtered){
    const li=planLabel('li','','finance-item');
    const info=planLabel('div','','finance-main-text');
    info.append(planLabel('strong',p.title,'finance-main-label'));
    info.append(planLabel('div',p.category+' · '+planDailyStatus(p),'finance-meta'));
    const sign=p.kind==='expense'?'-':'+';
    li.append(info,planLabel('strong',sign+' '+planMoney(p.amountCents),'finance-amount'));
    list.append(li);
  }
  target.append(list);
}
function renderPlanCalendar(){
  const {year,month,plans}=planCalendar;
  planCal('planCalendarMonth').textContent=planMonthText(year,month);
  const start=planISO(year,month,1);
  const end=planISO(year,month,new Date(Date.UTC(year,month+1,0)).getUTCDate());
  const entries=plans.filter(p=>p.dueDate>=start&&p.dueDate<=end);
  const today=planISO(planNow.getFullYear(),planNow.getMonth(),planNow.getDate());
  const pending=entries.filter(p=>p.status==='planned');
  const incomes=pending.filter(p=>p.kind==='income');
  const confirmed=incomes.filter(p=>p.certainty!=='estimated')
    .reduce((sum,p)=>sum+p.amountCents,0);
  const estimated=incomes.filter(p=>p.certainty==='estimated')
    .reduce((sum,p)=>sum+p.amountCents,0);
  const outgoing=pending.filter(p=>p.kind==='expense')
    .reduce((sum,p)=>sum+p.amountCents,0);
  const late=pending.filter(p=>p.kind==='expense'&&p.dueDate<today).length;
  const metrics=planCal('planCalendarMetrics');
  metrics.replaceChildren(
    planCalendarMetric('Receitas esperadas',planMoney(confirmed),'Ainda não recebidas'),
    planCalendarMetric('Receitas incertas',planMoney(estimated),'Fora do cenário conservador'),
    planCalendarMetric('Despesas pendentes',planMoney(outgoing),'Não representam saldo'),
    planCalendarMetric('Contas vencidas',String(late),'Compromissos ainda pendentes')
  );
  const grid=planCal('planCalendarDays');
  grid.replaceChildren();
  for(const day of ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']){
    const head=planLabel('span',day,'finance-plan-calendar-weekday');
    head.setAttribute('aria-hidden','true');
    grid.append(head);
  }
  const initial=(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
  for(let i=0;i<initial;i++){
    const blank=planLabel('span','','finance-plan-calendar-empty');
    blank.setAttribute('aria-hidden','true');
    grid.append(blank);
  }
  const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const grouped=new Map();
  for(const p of entries){
    if(!grouped.has(p.dueDate))grouped.set(p.dueDate,[]);
    grouped.get(p.dueDate).push(p);
  }
  for(let d=1;d<=count;d++){
    const iso=planISO(year,month,d),daily=grouped.get(iso)||[];
    const button=planLabel('button','','finance-plan-calendar-day');
    button.type='button';
    if(iso===today)button.classList.add('is-today');
    if(iso===planCalendar.date)button.classList.add('is-selected');
    button.setAttribute('aria-pressed',String(iso===planCalendar.date));
    button.setAttribute('aria-label',d+' de '+planMonthText(year,month)+
      ': '+daily.length+' compromisso(s)');
    button.append(planLabel('span',String(d),'finance-plan-calendar-date'));
    if(daily.length){
      const open=daily.filter(p=>p.status==='planned');
      const projected=open.filter(p=>p.kind==='expense').reduce((s,p)=>s+p.amountCents,0);
      button.append(planLabel('small',daily.length+' compromisso(s)','finance-plan-calendar-count'));
      if(projected)button.append(planLabel('small','Saídas '+planMoney(projected),'finance-plan-calendar-money'));
    }
    button.addEventListener('click',()=>{
      planCalendar.date=planCalendar.date===iso?null:iso;
      renderPlanCalendar();
    });
    grid.append(button);
  }
  planCalendarSelection();
}
function changePlanMonth(step){
  const next=new Date(Date.UTC(planCalendar.year,planCalendar.month+step,1));
  const year=next.getUTCFullYear();
  if(year<2000||year>2100)return;
  planCalendar.year=year;planCalendar.month=next.getUTCMonth();
  planCalendar.date=null;renderPlanCalendar();
}
planCal('planCalendarPrev').addEventListener('click',()=>changePlanMonth(-1));
planCal('planCalendarNext').addEventListener('click',()=>changePlanMonth(1));
document.addEventListener('finance:personal-snapshot',event=>{
  const data=event.detail;
  if(data?.stage!=='quarantine_verified'||!Array.isArray(data.plans))return;
  planCalendar.plans=data.plans.filter(planCalendarValid);
  planCalendar.loaded=true;
  renderPlanCalendar();
});
renderPlanCalendar();
