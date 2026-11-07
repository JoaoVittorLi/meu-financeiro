'use strict';
const el=id=>document.getElementById(id);
const money=n=>Number.isSafeInteger(n)?(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=String(value??'');if(className)node.className=className;return node;};

function renderEmpty(list,message){
  list.replaceChildren(text('li',message,'finance-muted'));
}
function populateList(list,rows,getTitle,getSecondary,getValue){
  list.replaceChildren();
  if(!rows.length)return renderEmpty(list,'Nenhum item cadastrado.');
  for(const item of rows){
    const li=document.createElement('li');li.className='finance-item';
    const left=document.createElement('div');
    left.append(text('div',getTitle(item),'finance-main'));
    left.append(text('div',getSecondary(item),'finance-meta'));
    li.append(left,text('div',getValue(item),'finance-amount'));
    list.append(li);
  }
}
async function showPersonalFinance(){
  const status=el('financeStatus');
  try{
    const res=await fetch('/api/migration/personal-overview',{
      method:'GET',cache:'no-store',credentials:'same-origin',
      headers:{Accept:'application/json'}
    });
    if(res.status===401){status.textContent='Entre primeiro pelo Meu Financeiro para ver seus dados.';return;}
    if(res.status===403){status.textContent='Acesso protegido não validado. Abra novamente o login da Cloudflare.';return;}
    if(!res.ok||!res.headers.get('content-type')?.includes('application/json'))
      throw new Error('Consulta temporariamente indisponível.');
    const value=await res.json();
    if(value?.ok!==true)throw new Error('Resposta de dados inválida.');
    if(value.stage!=='quarantine_verified'){
      status.textContent='Ainda não há personalizações transferidas. Inicie a migração pelo Windows.';
      return;
    }
    if(value.financialSyncEnabled!==false||value.bankDataReady!==false||
       !Array.isArray(value.plans)||!Array.isArray(value.budgets)||
       !Array.isArray(value.categories))
      throw new Error('Conteúdo da prévia não corresponde ao esperado.');
    status.textContent='Personalizações conferidas · extrato bancário pendente';
    el('planCount').textContent=value.plans.length.toLocaleString('pt-BR');
    el('categoryCount').textContent=value.categories.length.toLocaleString('pt-BR');
    const now=new Date();const today=[
      now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),
      String(now.getDate()).padStart(2,'0')
    ].join('-');
    const next=value.plans.filter(p=>p.status!=='cancelled'&&p.dueDate>=today)
      .slice(0,30);
    populateList(el('planList'),next,
      p=>p.title,p=>p.dueDate+' · '+p.category+' · '+p.status,p=>money(p.amountCents));
    populateList(el('budgetList'),value.budgets,
      b=>b.category,()=> 'Orçamento cadastrado',b=>money(b.amountCents));
    el('financeContent').classList.remove('finance-hidden');
  }catch(error){
    status.textContent='Não foi possível abrir a prévia: '+String(error.message||error);
    status.classList.add('finance-error');
  }
}
async function showBankServerStatus(){
 const node=el('bankServerStatus');
 if(!node)return;
 try{
  const response=await fetch('/api/bank/status',{
   method:'GET',credentials:'same-origin',cache:'no-store',
   headers:{Accept:'application/json'}
  });
  if(!response.ok)throw new Error('Histórico indisponível');
  const state=await response.json();
  if(state?.ok!==true||state.financialSyncEnabled!==false||
     state.historicalCompletenessVerified!==false||
     state.cloudCutoverAllowed!==false)
   throw new Error('A verificação financeira ainda não foi concluída');
  const activation=el('bankRefreshNow');
  if(activation)activation.hidden=!state.providerConfigured;
  if(!state.providerConfigured){
   node.textContent='Aguardando configuração segura do Pluggy na Cloudflare. Nenhuma movimentação bancária foi importada.';
  }else if(state.stage==='staging'){
   node.textContent='Consulta feita pela Cloudflare: '+state.accounts+
     ' conta(s), '+state.transactions+' movimentações em conferência. '+
     'Última atualização: '+new Date(state.lastSuccess).toLocaleString('pt-BR')+
     '. O histórico e os vínculos ainda precisam ser conciliados.';
  }else{
   node.textContent='Servidor Pluggy configurado. Aguardando a primeira consulta e conferência do histórico.';
  }
  if(state.issue)node.textContent+=' A última consulta ficou incompleta; os dados anteriores foram preservados.';
 }catch{
  node.textContent='Atualização bancária ainda não disponível neste ambiente.';
 }
}
let refreshing=false;
async function refreshVisibleFinance(){
 if(document.hidden||refreshing)return;
 refreshing=true;
 try{
  await Promise.all([showPersonalFinance(),showBankServerStatus()]);
 }finally{refreshing=false;}
}
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden)void refreshVisibleFinance();
});
setInterval(()=>{void refreshVisibleFinance();},60000);
const activate=el('bankRefreshNow');
if(activate)activate.addEventListener('click',async()=>{
 const approved=window.confirm(
  'Autoriza consultar suas contas e movimentações do Pluggy diretamente na Cloudflare? '+
  'Os dados serão guardados na quarentena privada do Preview para conferência. '+
  'O banco SQLite original e os pagamentos planejados não serão alterados. '+
  'Após esta consulta, o servidor repetirá as leituras periodicamente até que a conexão seja desativada.'
 );
 if(!approved)return;
 activate.disabled=true;
 el('bankServerStatus').textContent='Consultando Pluggy diretamente do servidor. Nenhum dado do desktop será enviado.';
 try{
  const res=await fetch('/api/bank/refresh',{
   method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'Content-Type':'application/json','Accept':'application/json',
     'X-MF-Bank-Consent':'preview-bank-staging-only'},
   body:JSON.stringify({consent:'preview-bank-staging-only'})
  });
  const output=await res.json();
  if(!res.ok||output.ok!==true)
    throw new Error('Consulta incompleta ou autorização expirada.');
  el('bankServerStatus').textContent='Extrato consultado pelo servidor: '+
    output.accounts+' conta(s) e '+output.fetched+
    ' movimentações obtidas. Ainda é necessário reconciliar o histórico antes de ativar a sincronização bancária.';
 }catch{
  el('bankServerStatus').textContent='Não foi possível concluir a atualização bancária. '+
    'Nenhuma movimentação foi apagada. Verifique o consentimento no Meu Pluggy.';
 }finally{
  activate.disabled=false;
  void showBankServerStatus();
 }
});
void refreshVisibleFinance();
