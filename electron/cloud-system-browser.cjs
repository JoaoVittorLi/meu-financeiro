'use strict';

// Link the native Windows application using the user's REAL system browser.
// Google OAuth explicitly disallows Electron's embedded user agent. An Access
// authenticated browser page submits the two owner-bound session assertions
// to a single-use loopback endpoint; they NEVER travel via a URL/query string
// or renderer IPC. The app stores them in its isolated Chromium cookie jar
// and verifies the identity with the existing Cloudflare backend.
//
// This temporary Preview-only bridge is not a financial sync activation.
const http=require('node:http');
const {randomBytes}=require('node:crypto');
const {PREVIEW_ORIGIN}=require('./cloud-preview-identity.cjs');

const NONCE=/^[a-f0-9]{64}$/;
const ACCESS_JWT=/^[A-Za-z0-9_-]{10,2000}\.[A-Za-z0-9_-]{10,8000}\.[A-Za-z0-9_-]{20,1500}$/;
const PRIVATE_SESSION=/^\d{10,11}\.[A-Za-z0-9_-]{32,128}$/;
const BODY_LIMIT=13000;
const TIMEOUT_MS=10*60*1000;
let cancelActive=null;

function isPairingSubmission(value,nonce){
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&
    value.nonce===nonce&&
    typeof value.accessAssertion==='string'&&ACCESS_JWT.test(value.accessAssertion)&&
    typeof value.pilotSession==='string'&&PRIVATE_SESSION.test(value.pilotSession);
}

async function pairViaSystemBrowser({openBrowser,acceptSession,timeoutMs=TIMEOUT_MS}={}){
 if(typeof openBrowser!=='function'||typeof acceptSession!=='function')
   throw new TypeError('Navegador de autenticação indisponível.');
 if(cancelActive)throw new Error('Já existe um login externo em andamento.');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>TIMEOUT_MS)
   throw new Error('Tempo máximo de autenticação inválido.');
 const nonce=randomBytes(32).toString('hex');
 let resolveWait,finished=false,port,timeout;
 const promise=new Promise(resolve=>{resolveWait=resolve;});
 const send=(res,code,message)=>{
   if(res.headersSent)return;
   const cors={'Content-Type':'application/json; charset=utf-8',
     'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
     'Access-Control-Allow-Origin':PREVIEW_ORIGIN,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'Content-Type',
     'Access-Control-Allow-Private-Network':'true','Vary':'Origin'};
   res.writeHead(code,cors);res.end(JSON.stringify({ok:code===200,message}));
 };
 const server=http.createServer(async(req,res)=>{
   const host=req.headers.host;
   if(host!=='127.0.0.1:'+port||req.headers.origin!==PREVIEW_ORIGIN||
      req.url!=='/callback'||finished){
     res.writeHead(403,{'Cache-Control':'no-store'});res.end();return;
   }
   if(req.method==='OPTIONS'){send(res,204,'preflight');return;}
   const contentType=req.headers['content-type']||'';
   const isJson=/^text\/plain(?:;|$)/i.test(contentType);
   const isForm=/^application\/x-www-form-urlencoded(?:;|$)/i.test(contentType);
   if(req.method!=='POST'||(!isJson&&!isForm)){
     send(res,405,'Método não permitido.');return;
   }
   let size=0,data='';
   try{
     for await(const chunk of req){
       size+=chunk.length;
       if(size>BODY_LIMIT)throw new Error('Request too large');
       data+=chunk.toString('utf8');
     }
     const payload=isJson?JSON.parse(data):Object.fromEntries(new URLSearchParams(data));
     if(!isPairingSubmission(payload,nonce)){
       send(res,403,'Vínculo não autorizado.');return;
     }
     const result=await acceptSession({
       accessAssertion:payload.accessAssertion,
       pilotSession:payload.pilotSession
     });
     if(!result?.connected){
       send(res,409,'A sessão não passou na validação.');return;
     }
     if(isForm){
       res.writeHead(200,{'Content-Type':'text/html; charset=utf-8',
         'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
         'Referrer-Policy':'no-referrer',
         'Content-Security-Policy':"default-src 'none'; base-uri 'none'"});
       res.end('<!doctype html><meta charset="utf-8"><title>Meu Financeiro conectado</title>'+
         '<h2>Computador conectado com segurança.</h2><p>Volte ao Meu Financeiro. Esta aba pode ser fechada.</p>');
     }else send(res,200,'Computador conectado com segurança.');
     finish(result);
   }catch{
     if(!res.headersSent)send(res,400,'Não foi possível confirmar este login.');
   }
 });
 function finish(result){
   if(finished)return;
   finished=true;
   clearTimeout(timeout);
   cancelActive=null;
   server.close();
   resolveWait(result);
 }
 try{
   await new Promise((resolve,reject)=>{
     server.once('error',reject);
     server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});
   });
   port=server.address().port;
   cancelActive=()=>finish({connected:false,reason:'login_cancelled',
     financialSyncEnabled:false,recordsTransferred:0});
   timeout=setTimeout(()=>finish({connected:false,reason:'login_timeout',
     financialSyncEnabled:false,recordsTransferred:0}),timeoutMs);
   timeout.unref?.();
   const url=PREVIEW_ORIGIN+'/desktop-connect.html?port='+port+'&nonce='+nonce;
   await openBrowser(url);
   return await promise;
 }catch{
   finish({connected:false,reason:'browser_open_failed',
     financialSyncEnabled:false,recordsTransferred:0});
   return promise;
 }
}

function cancelBrowserPairing(){if(cancelActive)cancelActive();}

module.exports={pairViaSystemBrowser,cancelBrowserPairing,isPairingSubmission,
  NONCE,BODY_LIMIT,PRIVATE_SESSION};
