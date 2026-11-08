'use strict';
// Sign in with ChatGPT: loopback OAuth PKCE, strict OIDC validation and encrypted tokens.
// Never export OAuth credentials over IPC, the PWA, or Cloudflare.
const http=require('node:http');
const crypto=require('node:crypto');
const ISSUER='https://auth.openai.com';
const RESOURCE='https://api.openai.com/v1';
const PERMISSION='chatgpt.tokens.use.direct';
const SCOPE='openid profile email offline_access resource.invoke '+PERMISSION;
const random=()=>crypto.randomBytes(32).toString('base64url');
function decodeJwtPart(value){
  if(typeof value!=='string'||! /^[A-Za-z0-9_-]{1,12000}$/.test(value))throw new Error('ID token malformado.');
  return JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
}
function safeEqual(a,b){
  const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
  return x.length===y.length && crypto.timingSafeEqual(x,y);
}
class ChatGPTSignIn {
  constructor({vault,openExternal,fetchFn=globalThis.fetch,timeoutMs=180000}){
    if(!vault||typeof openExternal!=='function')throw new Error('Configuração ChatGPT inválida.');
    this.vault=vault; this.openExternal=openExternal; this.fetchFn=fetchFn;
    this.timeoutMs=timeoutMs;this.pending=null;
  }
  async getJSON(url,init={}){
    const res=await this.fetchFn(url,{redirect:'error',signal:AbortSignal.timeout(20000),...init});
    if(!res.ok)throw new Error('Autenticação ChatGPT indisponível (HTTP '+res.status+').');
    return res.json();
  }
  async verifyIDToken(jwt,clientId,nonce){
    const parts=String(jwt||'').split('.');
    if(parts.length!==3)throw new Error('ID token inválido.');
    const head=decodeJwtPart(parts[0]),payload=decodeJwtPart(parts[1]);
    if(!['RS256','ES256'].includes(head.alg)||typeof head.kid!=='string'||head.kid.length>300)throw new Error('Assinatura OIDC não permitida.');
    const metadata=await this.getJSON(ISSUER+'/.well-known/openid-configuration');
    if(metadata.issuer!==ISSUER)throw new Error('Emissor OIDC não reconhecido.');
    const jwksUrl=new URL(metadata.jwks_uri);
    if(jwksUrl.protocol!=='https:'||jwksUrl.hostname!=='auth.openai.com'||jwksUrl.username||jwksUrl.password||jwksUrl.port)throw new Error('Chaves de assinatura não autorizadas.');
    const jwks=await this.getJSON(jwksUrl.toString());
    const jwk=(jwks.keys||[]).find(k=>k.kid===head.kid&&(!k.alg||k.alg===head.alg)&&(!k.use||k.use==='sig'));
    if(!jwk)throw new Error('Chave de assinatura OIDC ausente.');
    let valid=false;
    try {
      valid=crypto.verify('sha256',Buffer.from(parts[0]+'.'+parts[1]),
        {key:crypto.createPublicKey({key:jwk,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(parts[2],'base64url'));
    } catch {valid=false;}
    if(!valid)throw new Error('Assinatura de identidade ChatGPT inválida.');
    const now=Math.floor(Date.now()/1000);
    if(payload.iss!==ISSUER || !(payload.aud===clientId || Array.isArray(payload.aud)&&payload.aud.includes(clientId)) ||
      (payload.azp && payload.azp!==clientId) ||
      !Number.isSafeInteger(payload.exp)||payload.exp<=now ||
      (Number.isSafeInteger(payload.nbf)&&payload.nbf>now+60) ||
      (nonce!==null&&payload.nonce!==nonce) ||
      typeof payload.sub!=='string'||!payload.sub.trim())throw new Error('Identidade ChatGPT não validada.');
    return {subject:payload.sub,email:typeof payload.email==='string'?payload.email:null};
  }
  async tokenExchange(fields){
    return this.getJSON(ISSUER+'/api/accounts/oauth/token',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams(fields).toString()
    });
  }
  async finalizeCallback({url,redirectUri,verifier,nonce,saved}){
    if(url.searchParams.has('error'))throw new Error('Autorização ChatGPT recusada ou indisponível.');
    const code=url.searchParams.get('code');
    const returnedClient=url.searchParams.get('client_id');
    const clientId=saved?.client_id||returnedClient;
    if(!code||!clientId||clientId==='dynamic_agent_client'||!/^oaiapp_[A-Za-z0-9_-]{4,256}$/.test(clientId))throw new Error('Registro OAuth não finalizado.');
    if(saved?.client_id&&returnedClient&&returnedClient!==saved.client_id)throw new Error('Conta ChatGPT incompatível.');
    const data=await this.tokenExchange({grant_type:'authorization_code',client_id:clientId,code,code_verifier:verifier,redirect_uri:redirectUri,resource:RESOURCE});
    const scopes=String(data.scope||'').split(/\s+/).filter(Boolean);
    if(!scopes.includes(PERMISSION)||!scopes.includes('resource.invoke'))throw new Error('Permissão para usar a assinatura ChatGPT não foi concedida.');
    if(typeof data.access_token!=='string'||typeof data.refresh_token!=='string'||typeof data.id_token!=='string')throw new Error('Resposta OAuth incompleta.');
    const identity=await this.verifyIDToken(data.id_token,clientId,nonce);
    if(saved?.subject&&saved.subject!==identity.subject)throw new Error('Não é possível substituir silenciosamente a conta ChatGPT.');
    await this.vault.save({
      client_id:clientId,subject:identity.subject,email:identity.email,issuer:ISSUER,
      access_token:data.access_token,refresh_token:data.refresh_token,id_token:data.id_token,
      token_type:'Bearer',scopes,saved_at:Date.now(),expires_in:Number(data.expires_in)||3600
    });
    return this.vault.status();
  }
  async connect(){
    if(this.pending)throw new Error('Já existe uma autorização ChatGPT em andamento.');
    if(!await this.vault.supported())throw new Error('Armazenamento protegido do Windows indisponível.');
    const saved=await this.vault.read(),host=await this.vault.hostId();
    const state=random(),nonce=random(),verifier=random();
    const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
    let server=null,timer=null,finished=false;
    const pending=new Promise((resolve,reject)=>{
      const end=(error,value)=>{
        if(finished)return;finished=true;
        if(timer)clearTimeout(timer);
        if(server)server.close();
        this.pending=null;
        if(error)reject(error);else resolve(value);
      };
      server=http.createServer(async(req,res)=>{
        const address=server.address();
        if(!address || req.method!=='GET'){res.writeHead(405);res.end();return;}
        const u=new URL(req.url||'/', 'http://127.0.0.1:'+address.port);
        if(u.pathname!=='/auth/callback'){res.writeHead(404);res.end();return;}
        if(!safeEqual(u.searchParams.get('state'),state)){res.writeHead(400);res.end('Estado de autorização inválido.');end(new Error('Retorno OAuth com state inválido.'));return;}
        try {
          const value=await this.finalizeCallback({url:u,redirectUri:'http://127.0.0.1:'+address.port+'/auth/callback',verifier,nonce,saved});
          res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
          res.end('<!doctype html><meta charset="utf-8"><title>Meu Financeiro</title><p>Conta ChatGPT conectada ao Meu Financeiro. Você pode fechar esta janela.</p>');
          end(null,value);
        }catch(e){res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end('Não foi possível concluir a conexão. Volte ao aplicativo.');end(e);}
      });
      server.once('error',e=>end(new Error('Não foi possível iniciar a autenticação local.')));
      server.listen(0,'127.0.0.1',()=>{
        const redirectUri='http://127.0.0.1:'+server.address().port+'/auth/callback';
        const params=new URLSearchParams({
          client_id:saved?.client_id||'dynamic_agent_client',
          ext_agent_host_id:host,response_type:'code',redirect_uri:redirectUri,
          scope:SCOPE,resource:RESOURCE,state,nonce,code_challenge_method:'S256',code_challenge:challenge
        });
        if(saved?.client_id){if(saved.id_token)params.set('id_token_hint',saved.id_token);}
        else params.set('agent_name_hint','Meu Financeiro');
        timer=setTimeout(()=>end(new Error('Tempo de autorização expirado. Tente novamente.')),this.timeoutMs);
        Promise.resolve(this.openExternal(ISSUER+'/api/accounts/authorize?'+params.toString())).catch(()=>end(new Error('Não foi possível abrir o navegador para autenticação.')));
      });
    });
    this.pending=pending;
    return pending;
  }
  async accessToken(){
    let saved=await this.vault.read();
    if(!saved)throw new Error('Conecte sua conta ChatGPT primeiro.');
    if(!(saved.scopes||[]).includes(PERMISSION))throw new Error('Sem permissão para usar a assinatura.');
    if(Date.now()-saved.saved_at < (saved.expires_in-120)*1000)return saved.access_token;
    const token=await this.tokenExchange({grant_type:'refresh_token',client_id:saved.client_id,refresh_token:saved.refresh_token,resource:RESOURCE});
    if(typeof token.access_token!=='string'||typeof token.refresh_token!=='string')throw new Error('Falha ao renovar a sessão ChatGPT.');
    const scopes=token.scope?String(token.scope).split(/\s+/).filter(Boolean):saved.scopes;
    if(!scopes.includes(PERMISSION))throw new Error('Permissão da assinatura foi revogada.');
    saved={...saved,access_token:token.access_token,refresh_token:token.refresh_token,id_token:token.id_token||saved.id_token,scopes,saved_at:Date.now(),expires_in:Number(token.expires_in)||3600};
    await this.vault.save(saved);
    return saved.access_token;
  }
  async status(){return this.vault.status();}
  async disconnect(){await this.vault.clear();return this.vault.status();}
}
module.exports={ChatGPTSignIn,decodeJwtPart,safeEqual};
