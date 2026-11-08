'use strict';
// Cloud-only E1 diagnostics. Never receives raw bank records or secrets.
// The Windows E1 command is the ONLY source of local-vs-cloud comparisons.
const e1Node=id=>document.getElementById(id);
let e1Loading=false;
const e1Fmt=n=>Number.isSafeInteger(n)&&n>=0?n.toLocaleString('pt-BR'):'—';
function e1Text(tag,value,cls){
  const el=document.createElement(tag);
  el.textContent=String(value??'');
  if(cls)el.className=cls;
  return el;
}
function e1Card(name,value){
  const box=e1Text('div','','finance-audit-metric');
  box.append(e1Text('span',name,'finance-muted'),e1Text('strong',e1Fmt(value)));
  return box;
}
function e1Row(title,status,note){
  const li=e1Text('li','','finance-item');
  const main=e1Text('div','','finance-main-text');
  main.append(e1Text('strong',title,'finance-main-label'),
    e1Text('div',note,'finance-meta'));
  const badge=e1Text('span',status,'finance-meta');
  li.append(main,badge);
  return li;
}
e1Node('bankE1Button').addEventListener('click',async()=>{
  if(e1Loading)return;
  e1Loading=true;
  const button=e1Node('bankE1Button'),status=e1Node('bankE1Status');
  const metrics=e1Node('bankE1Metrics'),checklist=e1Node('bankE1Checklist');
  button.disabled=true;metrics.hidden=true;checklist.hidden=true;
  status.textContent='Conferindo staging bancário e pacote pessoal na Cloudflare...';
  try{
    const response=await fetch('/api/bank/e1-evidence',{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{Accept:'application/json'}
    });
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))
      throw new Error('Resposta de auditoria indisponível.');
    const report=await response.json();
    if(report?.ok!==true||report.contract!=='mf-e1-audit-v1'||
       report.stage!=='cloud_evidence_only'||
       report.cloudCutoverAllowed!==false||report.financialSyncEnabled!==false||
       report.reconciliationVerified!==false||
       !report.cloud||!report.personal||!report.references||!report.checks||
       !Number.isSafeInteger(report.cloud.bankRows)||
       !Number.isSafeInteger(report.cloud.bankAccounts)||
       !Number.isSafeInteger(report.cloud.missingCategoryMetadata)||
       !Number.isSafeInteger(report.cloud.rawProviderCategoriesPresent)||
       !Number.isSafeInteger(report.cloud.explicitlyUncategorizedByProvider)||
       !Array.isArray(report.cloud.missingCategoryMetadataByMonth)||
       !Number.isSafeInteger(report.personal.storedRows)||
       !Number.isSafeInteger(report.references.missingIdentities))
      throw new Error('Diagnóstico E1 incompleto.');
    metrics.replaceChildren(
      e1Card('Transações Cloudflare',report.cloud.bankRows),
      e1Card('Contas obtidas',report.cloud.bankAccounts),
      e1Card('Registros pessoais',report.personal.storedRows),
      e1Card('Referências não encontradas',report.references.missingIdentities)
    );
    checklist.replaceChildren(
      e1Row('Importação das 17 tabelas',
        report.checks.verifiedPersonalSnapshot===true?'Verificado':'Pendente',
        report.personal.rowCountsMatch?
          'As contagens guardadas conferem com o manifesto original verificado.':
          'A integridade da importação ainda não está confirmada.'),
      e1Row('Referências de contas e vínculos',
        report.references.missingIdentities===0&&
          report.references.missingPlannedAccounts===0?'Sem ausências':'Revisar',
        'Conferência apenas dos identificadores existentes na nuvem.'),
      e1Row('Cobertura de metadados do Pluggy',
        report.cloud.categoryMetadataComplete?'Cobertura completa':'Pendente',
        e1Fmt(report.cloud.providerCategoriesPresent)+' de '+
          e1Fmt(report.cloud.bankRows)+' movimentações possuem linha de metadados. '+
          e1Fmt(report.cloud.missingCategoryMetadata)+' sem linha auxiliar; '+
          e1Fmt(report.cloud.rawProviderCategoriesPresent)+
          ' com categoria enviada pelo banco; '+
          e1Fmt(report.cloud.explicitlyUncategorizedByProvider)+
          ' sem categoria na origem. Ainda falta comparar com o Windows.'),
      e1Row('Diagnóstico da atualização bancária',
        'Somente leitura',
        'Última consulta retornou '+
          e1Fmt(report.cloud.bankFirstLastFetch?.lastFetched)+
          ' transações; staging preserva '+e1Fmt(report.cloud.bankRows)+
          '. Meses com metadados ausentes: '+
          (Array.isArray(report.cloud.missingCategoryMetadataByMonth)&&
           report.cloud.missingCategoryMetadataByMonth.length?
            report.cloud.missingCategoryMetadataByMonth.map(x=>
              x.month.slice(5,7)+'/'+x.month.slice(0,4)+': '+e1Fmt(x.count)).join('; '):
            'nenhum')+'. Metadados ausentes preservados de consultas anteriores: '+
          (report.cloud.missingMetadataOutsideLastFetch===null?'não determinado':
            e1Fmt(report.cloud.missingMetadataOutsideLastFetch))+
          '; ausências entre registros da última consulta: '+
          (report.cloud.missingMetadataInLastFetch===null?'não determinado':
            e1Fmt(report.cloud.missingMetadataInLastFetch))+
          '. Isso não prova perda de histórico.'),
      e1Row('Igualdade Windows × Cloudflare','Pendente',
        'Execute a auditoria E1 em Configurações do Windows para comparar IDs, datas, centavos, categorias e contas.'),
      e1Row('Saldos e cobertura histórica','Pendente',
        'As consultas bancárias não comprovam o horário da posição do saldo nem a completude do histórico.'),
      e1Row('Liberação do banco único','Bloqueada',
        'Nenhum diagnóstico isolado habilita a migração ou a sincronização financeira.')
    );
    metrics.hidden=false;checklist.hidden=false;
    status.textContent='Diagnóstico somente da nuvem concluído. '+
      e1Fmt(report.cloud.bankRows)+' transações e '+
      e1Fmt(report.personal.storedRows)+' registros pessoais em conferência. '+
      'A base Windows ainda precisa ser comparada. Nenhum dado foi alterado.';
  }catch{
    status.textContent='Não foi possível obter um diagnóstico confiável neste Preview. A base financeira permaneceu intacta.';
  }finally{
    button.disabled=false;e1Loading=false;
  }
});
document.addEventListener('finance:bank-updated',()=>{
  e1Node('bankE1Metrics').hidden=true;
  e1Node('bankE1Checklist').hidden=true;
  e1Node('bankE1Status').textContent=
    'O extrato bancário foi atualizado. Execute novamente a auditoria E1 para obter um retrato atual.';
});
