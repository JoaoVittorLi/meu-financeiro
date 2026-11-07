const $=id=>document.getElementById(id);
const state=(message,type='')=>{ $('state').textContent=message;$('state').className='state '+type;};
async function api(path, method='GET',data){
  const res=await fetch('/api/'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
  const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json.error||`Erro ${res.status}`);return json;
}
function from64(value){const bin=atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'='));return Uint8Array.from(bin,c=>c.charCodeAt(0));}
let cachedRegistration=null; let cachedPublicKey=null;
let workerReady=null;
if('serviceWorker' in navigator)workerReady=navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).catch(()=>null);
async function showLogged(){
  $('login').hidden=true;$('panel').hidden=false;
  try { const [registration, config] = await Promise.all([workerReady, api('config')]); cachedRegistration=registration;cachedPublicKey=config.publicKey; } catch(e) {state(e.message,'error');}
  await refresh();
}
async function refresh(){
 try{const s=await api('status');$('registered').textContent=s.registered;
 $('last').textContent=s.lastTest?new Date(s.lastTest.at).toLocaleString('pt-BR'):'Nenhum';
 const sub=await workerReady?.then(w=>w?.pushManager.getSubscription()).catch(()=>null);
 const enabled=('Notification' in window)&&Notification.permission==='granted'&&!!sub;
 const check=enabled?await api('check','POST',{endpoint:sub.endpoint}):null;
 const synced=enabled&&check?.registered===true;
 $('badge').textContent=synced?'Pronto':enabled?'Revalidar inscrição':'Não ativado';
 $('deviceStatus').textContent=synced?'Confirmado':enabled?'Não registrado':'Não ativado';
 $('localTest').disabled=!enabled; $('test').disabled=!synced; $('testLater').disabled=!synced;
 state(synced?'Este aparelho está registrado. Primeiro teste uma notificação local.':
       enabled?'Inscrição do navegador não consta no servidor. Toque em Ativar notificações para registrar novamente.':
       'Ative as notificações para começar.',synced?'ok':'');
 }catch(e){state(e.message,'error');}
}
$('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=$('loginForm').querySelector('button');button.disabled=true;
 try{await api('login','POST',{code:$('code').value});$('code').value='';await showLogged();}
 catch(e){state(e.message,'error');}finally{button.disabled=false;}
});
$('enable').addEventListener('click',async ()=>{
 const b=$('enable');b.disabled=true;
 try{
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)) throw new Error('Este navegador não oferece notificações Web Push.');
  // On iPhone notifications are available only after installing on Home Screen.
  if(/iPad|iPhone|iPod/i.test(navigator.userAgent)&&!window.matchMedia('(display-mode: standalone)').matches)
   throw new Error('No iPhone, use Compartilhar → Adicionar à Tela de Início e abra o app pelo ícone.');
  if(!cachedRegistration||!cachedPublicKey) throw new Error('Reabra a página para preparar as notificações.');
  // Subscribe synchronously from the tap/click handler (required by Safari).
  const existing=await cachedRegistration.pushManager.getSubscription();
  const sub=existing||await cachedRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:from64(cachedPublicKey)});
  await api('subscribe','POST',sub.toJSON());
  state('Notificações ativadas neste aparelho!','ok');await refresh();
 }catch(e){state(e.message,'error');}finally{b.disabled=false;}
});
$('localTest').addEventListener('click',async()=>{
 const b=$('localTest');b.disabled=true;
 try{
  if(!cachedRegistration||Notification.permission!=='granted') throw new Error('Autorize primeiro as notificações.');
  await cachedRegistration.showNotification('💜 Meu Financeiro — Teste local',{
   body:'Aviso gerado no próprio celular. Se aparecer, a exibição local está funcionando.',
   icon:'/icon-192.png',badge:'/icon-192.png',tag:'mf-local-'+Date.now()
  });
  state('Teste local solicitado. Confira a central de notificações do celular.','ok');
 }catch(e){state('Falha ao testar no aparelho: '+e.message,'error');}finally{b.disabled=false;}
});
$('test').addEventListener('click',async ()=>{
 $('test').disabled=true;
 try{
 const x=await api('test','POST',{});
 const provider=(x.services||[]).map(v=>`${v.provider}: ${v.httpStatus??'sem resposta'} (${v.result})`).join('; ');
 const message=x.accepted?`Serviço push aceitou ${x.accepted} envio(s). A exibição no celular ainda precisa ser confirmada.`:
   x.registered===0?'Nenhum aparelho cadastrado. Reative as notificações.':
   x.removed>0?`${x.removed} inscrição(ões) expirada(s). Reative as notificações.`:
   `Envio recusado pelo serviço de push. Falhas: ${x.failed}.`;
 state(message+(provider?' Detalhe técnico: '+provider:''),x.accepted?'ok':'error');
 await refresh();
}
 catch(e){state(e.message,'error');}finally{$('test').disabled=false;}
});
$('testLater').addEventListener('click',async ()=>{
 $('testLater').disabled=true;
 try{await api('test-later','POST',{});state('Teste agendado. Feche o aplicativo e confira após 2 minutos. Se estiver no horário silencioso, será enviado após as 8h.','ok');}
 catch(e){state(e.message,'error');}finally{$('testLater').disabled=false;}
});
$('refresh').addEventListener('click',refresh);
$('logout').addEventListener('click',async()=>{await api('logout','POST',{});$('panel').hidden=true;$('login').hidden=false;state('Sessão encerrada.');});
(async()=>{try{const data=await api('session');if(data.authenticated)await showLogged();else {$('login').hidden=false;state('Acesso privado. Entre para configurar seu celular.');}}catch(e){state(e.message,'error');$('login').hidden=false;}})();
