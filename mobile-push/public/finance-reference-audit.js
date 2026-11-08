'use strict';
// Owner-triggered bank-reference precheck, not financial reconciliation.
// Never transmit IDs, names, bank amounts or bank credentials to the browser.
const referenceEl=id=>document.getElementById(id);
const referenceLabels={
  bank_category_overrides:'Categorias ajustadas',
  bank_transaction_notes:'Revisões e observações',
  bank_transaction_splits:'Divisões de despesas',
  bank_manual_links:'Vínculos com lançamentos manuais',
  planned_bank_links:'Pagamentos vinculados a compromissos',
  planned_rejected_matches:'Sugestões de vínculo rejeitadas',
  bank_custom_titles:'Nomes personalizados'
};
let auditBusy=false;
const auditNumber=n=>Number.isSafeInteger(n)&&n>=0?n.toLocaleString('pt-BR'):'—';
function auditCell(title,value){
  const row=document.createElement('div');
  row.className='finance-audit-metric';
  const label=document.createElement('span');
  label.className='finance-muted';label.textContent=title;
  const count=document.createElement('strong');
  count.textContent=auditNumber(value);
  row.append(label,count);
  return row;
}
referenceEl('bankReferenceAuditButton').addEventListener('click',async()=>{
  if(auditBusy)return;
  auditBusy=true;
  const button=referenceEl('bankReferenceAuditButton');
  const status=referenceEl('bankReferenceAuditStatus');
  const wrapper=referenceEl('bankReferenceAuditResults');
  button.disabled=true;wrapper.hidden=true;
  status.textContent='Conferindo somente as identidades bancárias no servidor protegido...';
  try{
    const response=await fetch('/api/bank/reference-audit',{
      method:'GET',cache:'no-store',credentials:'same-origin',
      headers:{Accept:'application/json'}
    });
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))
      throw new Error('Consulta não autorizada ou indisponível.');
    const data=await response.json();
    const required=['bankStagingCount','bankAccountCount','referencedRowCount',
      'distinctReferenceCount','matchedIdentityCount','missingIdentityCount',
      'plannedAccountReferences','missingPlannedAccountReferences',
      'unmappedDuplicateDismissals'];
    if(data?.ok!==true||!['reference_identity_precheck','verified_import_required'].includes(data.stage)||
       required.some(key=>!Number.isSafeInteger(data[key])||data[key]<0)||
       data.financialSyncEnabled!==false||data.automaticLinkingEnabled!==false||
       data.reconciliationVerified!==false||data.cloudCutoverAllowed!==false||
       data.balanceVerified!==false||data.historicalCompletenessVerified!==false||
       !Array.isArray(data.tables)||data.tables.length>7)
      throw new Error('Dados de conferência incompatíveis.');
    if(data.stage==='verified_import_required'||data.importVerified!==true){
      status.textContent='A cópia pessoal verificada do Windows não foi localizada neste ambiente. Nenhuma referência foi conferida.';
      return;
    }
    if(data.matchedIdentityCount+data.missingIdentityCount!==data.distinctReferenceCount)
      throw new Error('Contagem incompatível.');
    const metrics=referenceEl('bankReferenceAuditMetrics');
    metrics.replaceChildren(
      auditCell('Transações no servidor',data.bankStagingCount),
      auditCell('Referências distintas do desktop',data.distinctReferenceCount),
      auditCell('Identidades localizadas',data.matchedIdentityCount),
      auditCell('Identidades não localizadas',data.missingIdentityCount)
    );
    const list=referenceEl('bankReferenceAuditTables');
    list.replaceChildren();
    for(const table of data.tables){
      if(!Object.hasOwn(referenceLabels,table.table)||
         !Number.isSafeInteger(table.rows)||table.rows<0||
         !Number.isSafeInteger(table.matched)||table.matched<0||
         !Number.isSafeInteger(table.missing)||table.missing<0||
         table.matched+table.missing!==table.rows)
        throw new Error('Tabela de conferência inválida.');
      if(!table.rows)continue;
      const item=document.createElement('li');
      item.className='finance-item';
      const label=document.createElement('span');
      label.textContent=referenceLabels[table.table];
      const detail=document.createElement('span');
      detail.className='finance-meta';
      detail.textContent=auditNumber(table.matched)+' encontradas de '+auditNumber(table.rows)+
        (table.missing?' · '+auditNumber(table.missing)+' pendente(s)':'');
      item.append(label,detail);list.append(item);
    }
    if(!list.children.length){
      const empty=document.createElement('li');
      empty.className='finance-muted';
      empty.textContent='A cópia verificada não contém vínculos bancários nessas tabelas.';
      list.append(empty);
    }
    wrapper.hidden=false;
    const cautions=[];
    if(data.missingIdentityCount)
      cautions.push('Existem vínculos com IDs não encontrados no extrato cloud.');
    if(data.missingPlannedAccountReferences)
      cautions.push(auditNumber(data.missingPlannedAccountReferences)+
        ' conta(s) de planejamento não localizada(s).');
    if(data.unmappedDuplicateDismissals)
      cautions.push(auditNumber(data.unmappedDuplicateDismissals)+
        ' descarte(s) de duplicidade aguardam verificação independente.');
    status.textContent=cautions.length?cautions.join(' '):
      'Nenhuma referência ausente foi encontrada neste recorte. Isso ainda NÃO comprova equivalência financeira, de saldos ou de todo o histórico.';
  }catch{
    status.textContent='Não foi possível concluir a auditoria neste ambiente. Nenhuma referência ou movimentação foi alterada.';
  }finally{
    button.disabled=false;auditBusy=false;
  }
});
document.addEventListener('finance:bank-updated',()=>{
  referenceEl('bankReferenceAuditResults').hidden=true;
  referenceEl('bankReferenceAuditStatus').textContent=
    'O extrato foi atualizado. Execute novamente a conferência para verificar os vínculos.';
});
