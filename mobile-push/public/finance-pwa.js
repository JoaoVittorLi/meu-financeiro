'use strict';
// Register the existing push-only service worker; it never caches finance data.
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
// Read-only finance PWA shell. No credentials, financial records or session
// assertions are persisted in browser storage.
const pwaEl=id=>document.getElementById(id);
const pwaTitles={
  overview:'Visão geral',transactions:'Movimentações',planning:'Planejamento',
  budgets:'Orçamentos',simulate:'Simular compra',accounts:'Minhas contas'
};
const pwaState={active:'overview',busy:false,loaded:false,nextOffset:null,shown:0,total:0,manualBusy:false,manualLoaded:false,manualOffset:null,manualShown:0};
function pwaMoney(value){
  if(!Number.isSafeInteger(value))return '—';
  return (value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function pwaText(tag,value,cls){
  const node=document.createElement(tag);
  node.textContent=String(value??'');
  if(cls)node.className=cls;
  return node;
}
async function pwaGet(path){
  const res=await fetch(path,{method:'GET',cache:'no-store',credentials:'same-origin',
    headers:{Accept:'application/json'}});
  if(res.status===401||res.status===403)throw new Error('Acesso expirado ou não autorizado. Entre novamente pelo acesso protegido.');
  if(!res.ok||!res.headers.get('content-type')?.includes('application/json'))
    throw new Error('O servidor não concluiu a consulta.');
  return res.json();
}
function pwaSelectView(name){
  if(!(name in pwaTitles))return;
  pwaState.active=name;
  pwaEl('viewTitle').textContent=pwaTitles[name];
  for(const section of document.querySelectorAll('.finance-view')){
    section.hidden=section.id!=='view-'+name;
  }
  for(const button of document.querySelectorAll('[data-view]')){
    if(button.dataset.view===name)button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  }
  if(location.hash!=='#'+name)history.replaceState(null,'','#'+name);
  if(name==='transactions'&&!pwaState.loaded)void pwaLoadTransactions(false);
  if(name==='transactions'&&!pwaState.manualLoaded)void pwaLoadManual(false);
  if(name==='overview'||name==='accounts')void pwaLoadSummary();
}
function pwaBankRow(row){
  if(!row||typeof row.description!=='string'||typeof row.date!=='string'||
     !/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isSafeInteger(row.amountCents))
    return null;
  const item=pwaText('li','','finance-item');
  const left=pwaText('div','','finance-main-text');
  const mainTitle=typeof row.customTitle==='string'&&row.customTitle.trim()?
    row.customTitle:typeof row.merchant==='string'&&row.merchant.trim()?row.merchant:
    row.description||'Movimentação sem descrição';
  left.append(pwaText('div',mainTitle,'finance-main-label'));
  if(mainTitle!==row.description)
    left.append(pwaText('div','Original do Itaú: '+row.description,'finance-meta'));
  const parts=[
    row.date.slice(8,10)+'/'+row.date.slice(5,7)+'/'+row.date.slice(0,4),
    row.category||'Categoria bancária em conferência',
    row.reviewed?'Revisada':'A conferir'
  ];
  if(row.splitRequiresReview)parts.push('Divisão precisa ser revista');
  else if(row.splitCount>0)parts.push(row.splitCount+' divisões cadastradas');
  if(row.hasManualLink||row.hasPlannedLink)
    parts.push('Vínculo preservado; conciliação pendente');
  left.append(pwaText('div',parts.join(' · '),'finance-meta'));
  const amount=pwaText('span',pwaMoney(row.amountCents),'finance-amount '+
    (row.amountCents<0?'out':row.amountCents>0?'in':''));
  item.append(left,amount);
  return item;
}
async function pwaLoadTransactions(append){
  if(pwaState.busy)return;
  const next=append?pwaState.nextOffset:0;
  if(append&&next===null)return;
  pwaState.busy=true;
  const button=pwaEl('bankLoadMore'),label=pwaEl('bankListStatus');
  button.disabled=true;
  label.textContent='Consultando extrato protegido...';
  try{
    const params=new URLSearchParams({
      offset:String(next),limit:'30',
      search:pwaEl('bankSearch').value.trim().slice(0,100),
      direction:pwaEl('bankDirection').value
    });
    const page=await pwaGet('/api/bank/transactions?'+params.toString());
    if(page?.ok!==true||page.stage!=='bank_staging_preview'||
       page.financialSyncEnabled!==false||page.reconciliationVerified!==false||
       page.cloudCutoverAllowed!==false||!Array.isArray(page.rows)||
       !Number.isSafeInteger(page.total)||page.total<0||
       !(page.nextOffset===null||Number.isSafeInteger(page.nextOffset)))
      throw new Error('Resposta bancária incompleta.');
    const list=pwaEl('bankTransactions');
    if(!append){list.replaceChildren();pwaState.shown=0;}
    for(const data of page.rows){
      const item=pwaBankRow(data);
      if(!item)throw new Error('Registro bancário incompatível.');
      list.append(item);pwaState.shown++;
    }
    if(!page.rows.length&&!append)
      list.append(pwaText('li','Nenhuma movimentação encontrada para este filtro.','finance-muted'));
    pwaState.nextOffset=page.nextOffset;
    pwaState.total=page.total;
    pwaState.loaded=true;
    label.textContent='Exibindo '+pwaState.shown.toLocaleString('pt-BR')+
      ' de '+page.total.toLocaleString('pt-BR')+
      ' registros do extrato em conferência.';
    button.hidden=page.nextOffset===null;
  }catch{
    label.textContent='Não foi possível consultar as movimentações nesta prévia. Verifique sua sessão e tente novamente.';
    if(!append)pwaState.loaded=false;
  }finally{button.disabled=false;pwaState.busy=false;}
}
async function pwaLoadSummary(){
  try{
    const info=await pwaGet('/api/bank/status');
    if(info?.ok!==true||info.cloudCutoverAllowed!==false||
       info.financialSyncEnabled!==false)throw new Error('Etapa financeira não validada.');
    pwaEl('overviewTransactions').textContent=Number(info.transactions||0).toLocaleString('pt-BR');
    pwaEl('overviewAccounts').textContent=Number(info.accounts||0).toLocaleString('pt-BR');
    const hasData=info.stage==='staging'&&Number(info.accounts)>0;
    pwaEl('bankOverviewStatus').textContent=hasData?
      'Leitura bancária concluída no servidor: '+info.transactions+
      ' movimentações obtidas. Conciliação com os dados do Windows ainda pendente.':
      'Aguardando o extrato do Pluggy no ambiente protegido.';
  }catch{
    pwaEl('bankOverviewStatus').textContent='Não foi possível consultar o resumo bancário. Verifique sua sessão.';
  }
}
function pwaManualRow(row){
  if(!row||typeof row.description!=='string'||typeof row.date!=='string'||
     !/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isSafeInteger(row.amountCents)||
     !['income','expense'].includes(row.kind))return null;
  const li=pwaText('li','','finance-item');
  const left=pwaText('div','','finance-main-text');
  left.append(pwaText('div',row.description,'finance-main-label'));
  left.append(pwaText('div',[
    row.date.slice(8,10)+'/'+row.date.slice(5,7)+'/'+row.date.slice(0,4),
    row.category||'Sem categoria',
    row.linkedToBank?'Vinculado ao banco · não somar em dobro':'Lançamento manual'
  ].join(' · '),'finance-meta'));
  const sign=row.kind==='expense'?-1:1;
  li.append(left,pwaText('span',pwaMoney(sign*row.amountCents),
    'finance-amount '+(sign<0?'out':'in')));
  return li;
}
async function pwaLoadManual(append){
  if(pwaState.manualBusy)return;
  const offset=append?pwaState.manualOffset:0;
  if(append&&offset===null)return;
  pwaState.manualBusy=true;
  const button=pwaEl('manualLoadMore'),status=pwaEl('manualListStatus');
  button.disabled=true;
  status.textContent='Consultando registros manuais protegidos...';
  try{
    const data=await pwaGet('/api/migration/manual-transactions?'+new URLSearchParams({
      offset:String(offset),limit:'30'
    }).toString());
    if(data?.ok!==true||!['not_imported','quarantine_verified'].includes(data.stage)||
       data.financialSyncEnabled!==false||data.cloudCutoverAllowed!==false||
       !Array.isArray(data.rows)||!Number.isSafeInteger(data.total)||
       !(data.nextOffset===null||Number.isSafeInteger(data.nextOffset)))
      throw new Error('Resposta manual incompatível.');
    const list=pwaEl('manualTransactions');
    if(!append){list.replaceChildren();pwaState.manualShown=0;}
    for(const row of data.rows){
      const node=pwaManualRow(row);
      if(!node)throw new Error('Lançamento manual inválido.');
      list.append(node);pwaState.manualShown++;
    }
    if(!data.total&&!append)list.append(pwaText('li','Nenhum lançamento manual cadastrado.','finance-muted'));
    pwaState.manualOffset=data.nextOffset;
    pwaState.manualLoaded=true;
    status.textContent='Exibindo '+pwaState.manualShown.toLocaleString('pt-BR')+
      ' de '+data.total.toLocaleString('pt-BR')+' lançamentos pessoais preservados.';
    button.hidden=data.nextOffset===null;
  }catch{
    status.textContent='Não foi possível consultar os lançamentos manuais. Verifique seu acesso.';
    if(!append)pwaState.manualLoaded=false;
  }finally{pwaState.manualBusy=false;button.disabled=false;}
}
document.querySelectorAll('[data-view]').forEach(button=>{
  button.addEventListener('click',()=>pwaSelectView(button.dataset.view));
});
pwaEl('bankFilters').addEventListener('submit',event=>{
  event.preventDefault();void pwaLoadTransactions(false);
});
pwaEl('bankLoadMore').addEventListener('click',()=>void pwaLoadTransactions(true));
pwaEl('manualLoadMore').addEventListener('click',()=>void pwaLoadManual(true));
window.addEventListener('hashchange',()=>pwaSelectView(location.hash.slice(1)));
document.addEventListener('finance:bank-updated',()=>{
  void pwaLoadSummary();
  pwaState.loaded=false;
  if(pwaState.active==='transactions')void pwaLoadTransactions(false);
});
pwaSelectView(pwaTitles[location.hash.slice(1)]?location.hash.slice(1):'overview');
