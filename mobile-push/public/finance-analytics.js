'use strict';
// Preview analytics deliberately keeps data in memory only.
// Its numbers are NOT certified balances, projections or cutover evidence.
const analyticsEl=id=>document.getElementById(id);
const analyticsMoney=cents=>Number.isSafeInteger(cents)?
  (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
const analyticsLabel=(tag,value,cls)=>{
  const node=document.createElement(tag);
  node.textContent=String(value??'');
  if(cls)node.className=cls;
  return node;
};
function analyticsDate(date){
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+
    '-'+String(date.getDate()).padStart(2,'0');
}
function analyticsRange(mode,reference=new Date()){
  const today=new Date(reference.getFullYear(),reference.getMonth(),reference.getDate());
  const first=analyticsDate(today),copy=new Date(today);
  if(mode==='month')return {start:first.slice(0,7)+'-01',end:first};
  if(mode==='lastmonth'){
    const start=new Date(today.getFullYear(),today.getMonth()-1,1);
    const end=new Date(today.getFullYear(),today.getMonth(),0);
    return {start:analyticsDate(start),end:analyticsDate(end)};
  }
  if(mode==='week'){
    copy.setDate(copy.getDate()-(copy.getDay()+6)%7);
  }else if(mode==='15d')copy.setDate(copy.getDate()-14);
  else if(mode==='90d')copy.setDate(copy.getDate()-89);
  else throw new Error('Intervalo não reconhecido.');
  return {start:analyticsDate(copy),end:first};
}
function analyticsClearValues(){
  for(const id of ['cashIncome','cashExpense','cashNet'])analyticsEl(id).textContent='—';
  analyticsEl('financeFlow').replaceChildren();
  analyticsEl('financeCategoryList').replaceChildren();
  analyticsEl('budgetProgressList').replaceChildren();
}
function analyticsFlow(rows,source){
  const target=analyticsEl('financeFlow');
  target.replaceChildren();
  const valid=rows.every(r=>r&&typeof r.end==='string'&&
    Number.isSafeInteger(r.incomeCents)&&r.incomeCents>=0&&
    Number.isSafeInteger(r.expenseCents)&&r.expenseCents>=0);
  if(!valid)throw new Error('Fluxo inválido.');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 560 185');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Fluxo provisório de '+source+': receitas e despesas em '+rows.length+' intervalos');
  const peak=Math.max(1,...rows.flatMap(r=>[r.incomeCents,r.expenseCents]));
  const width=560/Math.max(1,rows.length),base=148,scale=125/peak;
  const addSvg=(tag,attr,value)=>{
    const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [k,v] of Object.entries(attr))node.setAttribute(k,String(v));
    if(value!==undefined)node.textContent=String(value);
    svg.append(node);
  };
  rows.forEach((row,index)=>{
    const center=(index+.5)*width,iw=Math.min(19,width*.22);
    const ih=Math.max(0,row.incomeCents*scale),eh=Math.max(0,row.expenseCents*scale);
    addSvg('rect',{x:center-iw-2,y:base-ih,width:iw,height:ih,rx:3,class:'finance-chart-income'});
    addSvg('rect',{x:center+2,y:base-eh,width:iw,height:eh,rx:3,class:'finance-chart-expense'});
    addSvg('text',{x:center,y:170,'text-anchor':'middle',class:'finance-chart-date'},
      row.end.slice(8,10)+'/'+row.end.slice(5,7));
  });
  target.append(svg);
  const legend=analyticsLabel('div','● Receitas    ● Despesas','finance-chart-legend');
  legend.setAttribute('aria-label','Barras verdes representam receitas. Barras roxas representam despesas.');
  target.append(legend);
}
function analyticsCategories(items){
  const target=analyticsEl('financeCategoryList');
  target.replaceChildren();
  if(!items.length){
    target.append(analyticsLabel('p','Nenhuma despesa nesta fonte e período.','finance-muted'));
    return;
  }
  const total=items.reduce((a,r)=>a+r.amountCents,0);
  for(const item of items){
    if(typeof item.name!=='string'||!Number.isSafeInteger(item.amountCents)||item.amountCents<0)
      throw new Error('Categoria inválida.');
    const section=analyticsLabel('div','','finance-category-row');
    const head=analyticsLabel('div','','finance-category-head');
    head.append(analyticsLabel('span',item.name),analyticsLabel('strong',analyticsMoney(item.amountCents)));
    const progress=document.createElement('progress');
    progress.max=Math.max(1,total);progress.value=item.amountCents;
    progress.setAttribute('aria-label','Proporção dos gastos em '+item.name);
    section.append(head,progress);target.append(section);
  }
}
function analyticsBudgets(items,month,complete){
  const target=analyticsEl('budgetProgressList');
  target.replaceChildren();
  analyticsEl('budgetPreviewStatus').textContent='Referência '+month.split('-').reverse().join('/')+
    '. Consumo provisório pela fonte selecionada'+
    (complete?'.':'; existem valores sem categoria confirmada. Não use como saldo restante.');
  if(!items.length){
    target.append(analyticsLabel('p','Nenhum limite de gastos cadastrado.','finance-muted'));
    return;
  }
  for(const item of items){
    if(typeof item.category!=='string'||!Number.isSafeInteger(item.limitCents)||
       !Number.isSafeInteger(item.spentCents)||item.limitCents<0||item.spentCents<0)
      throw new Error('Orçamento inválido.');
    const section=analyticsLabel('div','','finance-budget-row');
    const head=analyticsLabel('div','','finance-category-head');
    head.append(analyticsLabel('strong',item.category),
      analyticsLabel('span',analyticsMoney(item.spentCents)+' / '+analyticsMoney(item.limitCents)));
    section.append(head);
    if(item.limitCents>0){
      const bar=document.createElement('progress');
      bar.max=item.limitCents;bar.value=Math.min(item.limitCents,item.spentCents);
      bar.setAttribute('aria-label','Consumo prévio do orçamento '+item.category);
      section.append(bar,
        analyticsLabel('small',String(item.pct)+'% do limite cadastrado (prévia)','finance-muted'));
    }else section.append(analyticsLabel('small',
      'Limite zero; gasto identificado: '+analyticsMoney(item.spentCents),'finance-muted'));
    target.append(section);
  }
}
let analyticsBusy=false;
async function analyticsRefresh(){
  if(analyticsBusy)return;
  analyticsBusy=true;
  const state=analyticsEl('analyticsStatus');
  state.textContent='Consultando indicadores em modo de conferência...';
  const source=analyticsEl('analyticsSource').value;
  const period=analyticsRange(analyticsEl('analyticsPeriod').value);
  try{
    const query=new URLSearchParams({...period,source});
    const response=await fetch('/api/finance/period-summary?'+query.toString(),{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{Accept:'application/json'}
    });
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))
      throw new Error('Consulta indisponível.');
    const data=await response.json();
    if(data?.ok!==true||data.stage!=='preview_cashflow_readonly'||
       data.source!==source||data.financialSyncEnabled!==false||
       data.cloudCutoverAllowed!==false||data.balanceVerified!==false||
       data.forecastVerified!==false||!Array.isArray(data.flow)||
       !Array.isArray(data.expenseCategories)||!Array.isArray(data.budgets)||
       !Number.isSafeInteger(data.incomeCents)||!Number.isSafeInteger(data.expenseCents)||
       !Number.isSafeInteger(data.netCents))
      throw new Error('Resposta de prévia inválida.');
    if(!data.available){
      analyticsClearValues();
      state.textContent=source==='bank'?'Extrato ainda não disponível no servidor.':
        'Lançamentos manuais ainda não foram verificados na nuvem.';
      return;
    }
    analyticsEl('cashIncome').textContent=analyticsMoney(data.incomeCents);
    analyticsEl('cashExpense').textContent=analyticsMoney(data.expenseCents);
    analyticsEl('cashNet').textContent=analyticsMoney(data.netCents);
    analyticsFlow(data.flow,source==='bank'?'contas conectadas':'registros manuais');
    analyticsCategories(data.expenseCategories);
    analyticsBudgets(data.budgets,data.budgetMonth,data.budgetCategoryCoverageComplete);
    state.textContent='Indicadores parciais para '+period.start.split('-').reverse().join('/')+
      ' a '+period.end.split('-').reverse().join('/')+'. Fonte: '+
      (source==='bank'?'contas conectadas':'registros manuais')+'. '+
      data.transactionsIncluded+' movimentos considerados; '+data.excluded+
      ' ignorados por status ou natureza. '+
      (data.categoryCoverageComplete?
        'Classificação disponível para os movimentos incluídos; ainda sem homologação.':
        'Há '+analyticsMoney(data.unclassifiedCents)+' sem categoria confirmada.')+
      ' Os valores não representam saldo bancário disponível.';
  }catch{
    analyticsClearValues();
    state.textContent='Não foi possível validar os indicadores. Seus registros anteriores não foram modificados.';
  }finally{analyticsBusy=false;}
}
analyticsEl('analyticsFilters').addEventListener('submit',event=>{
  event.preventDefault();void analyticsRefresh();
});
document.addEventListener('finance:bank-updated',()=>void analyticsRefresh());
void analyticsRefresh();
