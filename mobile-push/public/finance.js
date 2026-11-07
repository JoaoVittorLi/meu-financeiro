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
void showPersonalFinance();
