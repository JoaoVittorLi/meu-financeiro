const $=(id)=>document.getElementById(id);
const state=(text,kind='')=>{$('state').textContent=text;$('state').className='state '+kind;};
let currentRevision=0,lastValue='',submitting=false;
function setAuthenticated(yes){
 $('main').hidden=!yes;$('migration').hidden=!yes;$('login').hidden=!!yes;
}
$('dryRun').addEventListener('click',async()=>{
 const button=$('dryRun'),output=$('dryRunResult');
 button.disabled=true;output.textContent='Conferindo dados fictícios na Cloudflare...';
 try{
   const result=await api('migration/dry-run','POST',{});
   if(!result.ok||result.realFinancialDataAccepted!==false||
      result.financialMigrationActivated!==false||result.tableCount!==22)
      throw new Error('Resultado inesperado. Não envie dados financeiros.');
   output.textContent='Teste aprovado: '+result.tableCount+' tabelas, '+result.bankRecordCount+
    ' movimentações fictícias, valores e vínculos conferidos. Nenhum dado real importado.';
   output.style.color='#91e0c1';
 }catch(error){
   output.textContent='Teste ainda não aprovado: '+(error?.message||'Falha na verificação.');
   output.style.color='#ffb9c4';
 }finally{button.disabled=false;}
});
async function api(endpoint,method='GET',body){
 const response=await fetch('/api/'+endpoint,{method,credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(data.error||'Falha na sincronização.');error.code=response.status;error.data=data;throw error;}return data;
}
// Diagnose a *public* certificate endpoint only when Cloudflare Access auth
// fails; the response contains fixed status codes, no identity or JWT.
let certProbe=null;
async function reportAccessError(error){
 let message=error?.message||'Falha ao autenticar.';
 if(message.includes('CF-CERTS')){
   if(!certProbe){
     certProbe=api('access/diagnose-certs','POST',{}).then(result=>{
       const entries=Array.isArray(result.observations)?result.observations:[];
       return entries.map(item=>item.mode+': '+item.code+
         (Number.isInteger(item.httpStatus)?' HTTP '+item.httpStatus:'')).join('; ')||'sem diagnóstico';
     }).catch(()=> 'indisponível');
   }
   message+=' | Consulta pública: '+await certProbe;
 }
 state(message,'error');
}
async function refresh(){
 const result=await api('sync/snapshot');
 const document=result.documents.find(x=>x.collection==='test_notes'&&x.id==='one-note');
 const nextRevision=document?.revision||0, nextValue=document&&!document.deleted?document.value?.text||'':'';
 if(!submitting && (nextRevision!==currentRevision)){
  const dirty=$('memo').value!==lastValue;
  if(dirty){
   state('Outro dispositivo atualizou este registro. Seu rascunho foi preservado, mas não será sobrescrito. Para usar a última versão, clique em Atualizar agora após limpar o campo.','error');
  }else{
   $('memo').value=nextValue;lastValue=nextValue;currentRevision=nextRevision;
   state('Sincronizado com a nuvem.','ok');
  }
 }
 $('revision').textContent=String(currentRevision);
 $('changed').textContent=document?.changedAt?new Date(document.changedAt).toLocaleString('pt-BR'):'Ainda não';
}
$('save').addEventListener('click',async()=>{
 const value=$('memo').value.trim();if(!value){state('Digite uma frase de teste primeiro.','error');return;}
 submitting=true;$('save').disabled=true;
 try{
  const result=await api('sync/apply','POST',{mutationId:crypto.randomUUID().replace(/-/g,''),changes:[
   {collection:'test_notes',id:'one-note',baseRevision:currentRevision,deleted:false,value:{text:value}}
  ]});
  currentRevision=result.changes[0].revision;lastValue=value;
  state('Alteração salva na base única. Abra o outro dispositivo para conferir.','ok');
 }catch(error){
  if(error.code===409){state('Outro dispositivo salvou uma alteração antes. Seu texto foi mantido; confira antes de tentar novamente.','error');}
  else state(error.message,'error');
 }finally{submitting=false;$('save').disabled=false;await refresh();}
});
$('refresh').addEventListener('click',()=>refresh().catch(e=>state(e.message,'error')));
$('loginForm').addEventListener('submit',async(event)=>{
 event.preventDefault();
 try{await api('login','POST',{code:$('code').value});$('code').value='';setAuthenticated(true);await refresh();state('Conectado à sua base central.','ok');}
 catch(e){await reportAccessError(e);}
});
(async()=>{
 try{
  const session=await api('session');
  setAuthenticated(!!session.authenticated);
  if(session.authenticated){
   try{await refresh();state('Conectado à sua base central.','ok');}
   catch(e){await reportAccessError(e);}
  }
  else state('Faça login para testar a sincronização.');
  setInterval(()=>{if(!$('main').hidden&&document.visibilityState==='visible')refresh().catch(reportAccessError);},5000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!$('main').hidden)refresh().catch(reportAccessError);});
 }catch(e){setAuthenticated(false);state(e.message,'error');}
})();