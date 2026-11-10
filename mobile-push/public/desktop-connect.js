'use strict';
const button=document.getElementById('connect');
const status=document.getElementById('status');
const params=new URLSearchParams(location.search);
const port=Number(params.get('port'));
const nonce=params.get('nonce');
const valid=Number.isSafeInteger(port)&&port>=1024&&port<=65535&&
  /^[a-f0-9]{64}$/.test(nonce||'');
if(!valid){
 button.disabled=true;
 status.textContent='Vínculo inválido. Inicie a conexão pelo aplicativo Windows.';
}
button.addEventListener('click',async()=>{
 if(!valid)return;
 button.disabled=true;
 status.textContent='Confirmando sua identidade e conectando o Windows...';
 try{
  const res=await fetch('/api/desktop/pair',{
   method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({port,nonce,confirm:true})
  });
  if(!res.ok){
   status.textContent=res.status===401?
     'Abra o Meu Financeiro web na outra aba, entre e tente novamente.':
     'O login Cloudflare ainda não foi confirmado. Entre e tente novamente.';
   return;
  }
  const verified=await res.json();
  if(verified?.ok!==true||verified.previewOnly!==true||
     verified.financialSyncEnabled!==false||verified.nonce!==nonce||
     verified.port!==port||typeof verified.accessAssertion!=='string'||
     typeof verified.pilotSession!=='string')
   throw new Error('Resposta de identidade inesperada.');
  const body=JSON.stringify({
   nonce,accessAssertion:verified.accessAssertion,
   pilotSession:verified.pilotSession
  });
  // Same-device loopback only: never send credentials to an internet host.
  const url='http://127.0.0.1:'+port+'/callback';
  try{
   const done=await fetch(url,{
    method:'POST',mode:'cors',credentials:'omit',redirect:'error',
    headers:{'Content-Type':'text/plain;charset=UTF-8'},
    body
   });
   if(!done.ok)throw new Error('Confirmação local recusada.');
   const result=await done.json();
   if(result?.ok!==true)throw new Error('Vínculo não confirmado.');
   status.textContent='Computador conectado! Volte ao Meu Financeiro no Windows. Pode fechar esta aba.';
  }catch{
   // Fallback for browsers that block cross-origin fetch to localhost:
   // normal form navigation works without CORS and keeps tokens out of URLs.
   status.textContent='Concluindo a confirmação local...';
   const form=document.createElement('form');
   form.method='POST';form.action=url;
   for(const [key,value] of Object.entries({nonce,
      accessAssertion:verified.accessAssertion,pilotSession:verified.pilotSession})){
     const input=document.createElement('input');
     input.type='hidden';input.name=key;input.value=value;
     form.append(input);
   }
   document.body.append(form);
   form.submit();
  }
 }catch{
  status.textContent='Não foi possível concluir a conexão. Confirme o login da Cloudflare e tente novamente.';
 }finally{button.disabled=false;}
});
