'use strict';
// Stateless installment preview: no bank balance, no new planned item.
// All calculations are made by the owner-protected shared Windows formula API.
const simEl=id=>document.getElementById(id);
const simBRL=value=>Number.isSafeInteger(value)?
  (value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
function simToday(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+
    String(d.getDate()).padStart(2,'0');
}
function simCents(input){
  if(typeof input!=='string')return null;
  const m=/^\s*(\d{1,9})(?:,(\d{1,2}))?\s*$/.exec(input);
  if(!m)return null;
  const cents=Number(m[1])*100+Number((m[2]||'').padEnd(2,'0'));
  return Number.isSafeInteger(cents)&&cents>0&&cents<=100000000000?cents:null;
}
function simRate(input){
  const m=/^\s*(\d{1,2})(?:,(\d{1,4}))?\s*$/.exec(input);
  if(!m)return null;
  const rate=Number(m[1])+Number('0.'+(m[2]||'0'));
  return Number.isFinite(rate)&&rate<=30?rate:null;
}
const simState={busy:false};
function simError(text){
  simEl('purchaseSimulationResult').hidden=true;
  simEl('purchaseSimulationStatus').textContent=text;
}
simEl('purchaseSimulator').addEventListener('submit',async event=>{
  event.preventDefault();
  if(simState.busy)return;
  const amount=simCents(simEl('purchaseAmount').value);
  const installments=Number(simEl('purchaseInstallments').value);
  const monthlyRate=simRate(simEl('purchaseRate').value);
  const firstDueDate=simEl('purchaseFirstDue').value||null;
  if(amount===null||!Number.isSafeInteger(installments)||
     installments<1||installments>60||monthlyRate===null){
    simError('Confira valor, número de parcelas e juros (separe centavos com vírgula).');
    return;
  }
  simState.busy=true;
  const button=simEl('purchaseSimulator').querySelector('button[type="submit"]');
  button.disabled=true;simError('Calculando a simulação protegida...');
  try{
    const response=await fetch('/api/finance/installment-quote',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({today:simToday(),amount,installments,monthlyRate,firstDueDate})
    });
    if(!response.ok||!response.headers.get('Content-Type')?.includes('application/json'))
      throw new Error('Formato inválido.');
    const q=await response.json();
    if(q?.ok!==true||q.stage!=='installments_only'||
       q.financialSyncEnabled!==false||q.cloudCutoverAllowed!==false||
       q.balanceVerified!==false||q.projectionVerified!==false||
       q.principal!==amount||q.installments!==installments||
       !Number.isSafeInteger(q.monthly)||!Number.isSafeInteger(q.total)||
       !Number.isSafeInteger(q.interest)||q.interest!==q.total-q.principal||
       !Array.isArray(q.schedule)||q.schedule.length!==installments||
       q.schedule.some(p=>typeof p.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||
         !Number.isSafeInteger(p.amount)||p.amount<=0)||
       q.schedule.reduce((sum,p)=>sum+p.amount,0)!==q.total)
      throw new Error('Resposta inconsistente.');
    const list=simEl('purchaseSchedule');
    list.replaceChildren();
    q.schedule.forEach((p,i)=>{
      const row=document.createElement('li');row.className='finance-item';
      const label=document.createElement('div');
      const date=p.date.slice(8,10)+'/'+p.date.slice(5,7)+'/'+p.date.slice(0,4);
      label.textContent='Parcela '+(i+1)+'/'+installments+' · '+date;
      const value=document.createElement('strong');
      value.textContent=simBRL(p.amount);value.className='finance-amount';
      row.append(label,value);list.append(row);
    });
    simEl('purchaseMonthly').textContent=simBRL(q.monthly);
    simEl('purchaseTotal').textContent=simBRL(q.total);
    simEl('purchaseInterest').textContent=simBRL(q.interest);
    simEl('purchaseSimulationResult').hidden=false;
    simEl('purchaseSimulationStatus').textContent=
      'Simulação calculada. O calendário é informativo; nenhuma parcela foi cadastrada ou quitada.';
  }catch{
    simError('A simulação não pôde ser concluída. Confira as datas e sua sessão protegida. Nenhuma informação foi alterada.');
  }finally{button.disabled=false;simState.busy=false;}
});
