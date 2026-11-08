import {CloudSyncStore} from './cloud-sync.js';
import {authorizeAccess,accessConfigured,diagnoseAccessCerts} from './access-auth.js';
import {runSyntheticMigrationDryRun} from './finance-staging.js';
import {runSyntheticQuarantineDemo} from './finance-synthetic-quarantine.js';
import {runSyntheticBatchDemo} from './finance-synthetic-batches.js';
import {beginPersonalTransfer,applyPersonalChunk,verifyPersonalTransfer,cancelPersonalTransfer,personalTransferStatus} from './finance-personal-batches.js';
import {readVerifiedPersonalOverview} from './finance-personal-overview.js';
import {bankServerEnabled,bankIngestionStatus,ingestPluggyToStaging} from './finance-bank-ingestion.js';
import {readBankTransactionsPage} from './finance-bank-read.js';
import {cloudBankParityManifest} from './finance-bank-parity.js';
import {auditVerifiedBankReferences} from './finance-reference-audit.js';
import {cloudE1Evidence} from './finance-e1-audit.js';
import {readManualTransactionsPage} from './finance-manual-read.js';
import {readFinancePreviewPeriod} from './finance-period-preview.js';
import {installmentQuote} from '../../shared/finance-installment-quote.mjs';
import {publicCapabilities,buildDemoRequest} from '../../shared/ai-policy.mjs';
import {assembleDemoContext} from '../../shared/ai-context.mjs';
import {applyPersonalEdit,personalEditChanges,personalEditBaseline} from './finance-personal-edits.js';
// Meu Financeiro: private proof-of-concept for standards-based Web Push.
// No bank data or credentials are handled by this Worker.

const DEVICE_LIMIT = 5;
const COOKIE = 'mf_push_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const textEncoder = new TextEncoder();

function b64url(bytes) {
  let binary = '';
  for (const c of new Uint8Array(bytes)) binary += String.fromCharCode(c);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unbase64url(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

async function mac(secret, value) {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, textEncoder.encode(value)));
}

function constantEqual(a, b) {
  const left = textEncoder.encode(a), right = textEncoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] || 0) ^ (right[i] || 0);
  return diff === 0;
}

async function checkSession(request, secret) {
  if (!secret) return false;
  const cookie = (request.headers.get('Cookie') || '').split(';').map(c=>c.trim()).find(c=>c.startsWith(COOKIE+'='));
  if (!cookie) return false;
  const [exp, signature] = cookie.slice(COOKIE.length+1).split('.');
  if (!/^\d{10,11}$/.test(exp||'') || !signature || Number(exp) < Math.floor(Date.now()/1000)) return false;
  return constantEqual(await mac(secret, `session:${exp}`),signature);
}

function json(data,status=200,extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
}


// Strictly PREVIEW-only personal quarantine. This never touches live finance
// tables or enables sync. It rejects Production even if other settings change.
function personalQuarantineAllowed(env){
  return env.PERSONAL_QUARANTINE_ENABLED==='true' && accessConfigured(env) &&
    env.FINANCIAL_SCHEMA_ACTIVE!=='true';
}

async function readBoundedJSON(request,maxBytes){
  const length=request.headers.get('Content-Length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))
    throw new Error('PAYLOAD_TOO_LARGE');
  if(!request.body)throw new Error('BODY_REQUIRED');
  const reader=request.body.getReader();
  const chunks=[];let total=0;
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>maxBytes)throw new Error('PAYLOAD_TOO_LARGE');
      chunks.push(value);
    }
  }catch(error){
    await reader.cancel().catch(()=>{});
    throw error;
  }finally{reader.releaseLock();}
  const data=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  const jsonText=new TextDecoder('utf-8',{fatal:true}).decode(data);
  const parsed=JSON.parse(jsonText);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))
    throw new Error('BODY_INVALID');
  return parsed;
}

function postIsSameOrigin(request) {
  const origin = request.headers.get('Origin');
  return !!origin && origin === new URL(request.url).origin && request.headers.get('Content-Type')?.startsWith('application/json');
}

function isApprovedEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:' || u.port || u.username || u.password || u.pathname.length > 3000) return false;
    const name = u.hostname.toLowerCase();
    return name === 'fcm.googleapis.com' || name === 'updates.push.services.mozilla.com' || name === 'web.push.apple.com' ||
      (name.endsWith('.push.apple.com') && name !== 'push.apple.com') || name.endsWith('.notify.windows.com');
  } catch { return false; }
}

function isValidSubscription(sub) {
  if (!sub || typeof sub !== 'object' || !isApprovedEndpoint(sub.endpoint)) return false;
  const a = sub.keys?.auth, p = sub.keys?.p256dh;
  return typeof a === 'string' && /^[A-Za-z0-9_-]{15,32}$/.test(a) && typeof p === 'string' && /^[A-Za-z0-9_-]{80,100}$/.test(p);
}

// All times use the single user's selected timezone; 22:00-08:00 is treated as postponement, not deletion.
function hourMinute(ms, timezone='America/Sao_Paulo') {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
  return [Number(parts.find(p=>p.type==='hour')?.value),Number(parts.find(p=>p.type==='minute')?.value)];
}

function nextAllowedAt(ms, timezone='America/Sao_Paulo') {
  const [hour, minute] = hourMinute(ms,timezone);
  const current=hour*60+minute;
  if(current>=22*60) return ms + (24*60-current+8*60)*60000;
  if(current<8*60) return ms + (8*60-current)*60000;
  return ms;
}

async function makeJWT(publicKey, privateJwk, endpoint, subject) {
  const origin = new URL(endpoint).origin;
  const header=b64url(textEncoder.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const payload=b64url(textEncoder.encode(JSON.stringify({aud:origin,exp:Math.floor(Date.now()/1000)+3600,sub:subject})));
  const body=`${header}.${payload}`;
  const priv=await crypto.subtle.importKey('jwk',privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const signed=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},priv,textEncoder.encode(body));
  return `${body}.${b64url(signed)}`;
}

export class PushHome {
  constructor(state, env) { this.state=state; this.env=env; }
  async getVapid() {
    const existing=await this.state.storage.get('vapid');
    if(existing) return existing;
    const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    const value={publicKey:b64url(await crypto.subtle.exportKey('raw',pair.publicKey)),privateJwk:await crypto.subtle.exportKey('jwk',pair.privateKey)};
    await this.state.storage.put('vapid',value);
    return value;
  }
  async send() {
    const subs=(await this.state.storage.get('subscriptions'))||[];
    if(!subs.length) {
      const outcome={accepted:0,removed:0,failed:0,registered:0,services:[]};
      await this.state.storage.put('last_test',{at:Date.now(),...outcome});
      return outcome;
    }
    const vapid=await this.getVapid();
    const keep=[]; let accepted=0,removed=0,failed=0;const services=[];
    for(const sub of subs) {
      try {
        const jwt=await makeJWT(vapid.publicKey,vapid.privateJwk,sub.endpoint,this.env.VAPID_CONTACT || 'https://github.com/JoaoVittorLi/meu-financeiro');
        const response=await fetch(sub.endpoint,{method:'POST',headers:{Authorization:`vapid t=${jwt}, k=${vapid.publicKey}`,TTL:'3600',Urgency:'high'}});
        const host=new URL(sub.endpoint).hostname;
        const provider=host.includes('apple')?'Apple':host.includes('google')?'Google':host.includes('mozilla')?'Mozilla':'Outro';
        services.push({provider,httpStatus:response.status,result:response.ok?'accepted':(response.status===404||response.status===410)?'subscription_expired':'rejected'});
        if(response.status===404 || response.status===410) removed++;
        else {keep.push(sub); if(response.ok) accepted++; else failed++;}
      } catch { keep.push(sub); failed++; services.push({provider:'Não identificado',httpStatus:null,result:'network_error'}); }
    }
    if(removed) await this.state.storage.put('subscriptions',keep);
    await this.state.storage.put('last_test',{at:Date.now(),accepted,failed,removed,services});
    return {accepted,removed,failed,registered:keep.length,services};
  }
  async scheduleAlarm() {
    // Existing push reminder and independent bank polling share ONE alarm.
    const queued=((await this.state.storage.get('events'))||[]).filter(x=>x.status==='queued');
    const future=queued.map(x=>x.at);
    const bankAt=await this.state.storage.get('bank_next_sync');
    if(bankServerEnabled(this.env)&&Number.isSafeInteger(bankAt)&&bankAt>0)
      future.push(bankAt);
    if(!future.length){await this.state.storage.deleteAlarm();return;}
    await this.state.storage.setAlarm(Math.max(Date.now()+1000,Math.min(...future)));
  }
  async scheduleNextBankSync(success) {
    if(!bankServerEnabled(this.env))return;
    const period=success?3*60*60*1000:30*60*1000;
    await this.state.storage.put('bank_next_sync',Date.now()+period);
    await this.scheduleAlarm();
  }
  async alarm() {
    const events=(await this.state.storage.get('events'))||[];
    const now=Date.now();
    for(const event of events) {
      if(event.status!=='queued'||event.at>now) continue;
      const allowed=nextAllowedAt(now);
      if(allowed>now+1000) { event.at=allowed; event.status='queued'; continue; }
      const outcome=await this.send();
      event.status=outcome.accepted>0?'accepted_by_push_service':'failed';
      event.result=outcome;
      event.processedAt=Date.now();
      if(event.status==='failed') { event.tries=(event.tries||0)+1; if(event.tries<3) {event.status='queued';event.at=Date.now()+Math.pow(2,event.tries)*60000;} }
    }
    await this.state.storage.put('events',events.slice(-40));
    const bankAt=await this.state.storage.get('bank_next_sync');
    if(bankServerEnabled(this.env)&&Number.isSafeInteger(bankAt)&&bankAt<=Date.now()){
      // Only the Durable Object and server secrets can request Pluggy.
      const result=await ingestPluggyToStaging(this.state.storage,this.env);
      await this.scheduleNextBankSync(result.ok);
    }
    await this.scheduleAlarm();
  }
  async fetch(request) {
    const u=new URL(request.url);
    if(u.pathname.startsWith('/sync/')) {
      const cloud=new CloudSyncStore(this.state);
      return cloud.fetch(new Request('https://internal/'+u.pathname.slice('/sync/'.length)+u.search,{
        method:request.method,headers:{'Content-Type':'application/json'},
        body:request.method==='POST'?request.body:null,
        duplex:request.method==='POST'?'half':undefined
      }),this.env.FINANCE_SYNC_ENABLED==='true');
    }
    if(u.pathname==='/personal/baseline'&&request.method==='GET'){
      try{return json(personalEditBaseline(this.state.storage));}
      catch{return json({error:'Dados importados ainda não verificados.'},409);}
    }
    if(u.pathname==='/personal/changes'&&request.method==='GET'){
      try{
        return json(personalEditChanges(this.state.storage,{
          since:Number(u.searchParams.get('since')||0),
          limit:Number(u.searchParams.get('limit')||100)
        }));
      }catch{return json({error:'Mudanças pessoais não disponíveis.'},409);}
    }
    if(u.pathname==='/personal/apply'&&request.method==='POST'){
      const input=await request.json().catch(()=>null);
      try{
        const out=applyPersonalEdit(this.state.storage,input);
        return json(out,out.ok?200:409);
      }catch{return json({error:'Edição pessoal recusada por validação.'},409);}
    }
    if(u.pathname==='/finance/period-summary'&&request.method==='GET'){
      try{return json(readFinancePreviewPeriod(this.state.storage,{
        start:u.searchParams.get('start'),
        end:u.searchParams.get('end'),
        source:u.searchParams.get('source')??'bank'
      }));}
      catch{return json({ok:false,error:'Período financeiro inválido.'},400);}
    }
    if(u.pathname==='/bank/status'&&request.method==='GET'){
      return json(bankIngestionStatus(this.state.storage));
    }
    if(u.pathname==='/bank/e1-evidence'&&request.method==='GET'){
      try{return json(await cloudE1Evidence(this.state.storage));}
      catch{return json({ok:false,error:'Diagnóstico E1 não disponível.'},409);}
    }
    if(u.pathname==='/bank/reference-audit'&&request.method==='GET'){
      try{return json(auditVerifiedBankReferences(this.state.storage));}
      catch{return json({ok:false,error:'Conferência de vínculos indisponível.'},409);}
    }
    if(u.pathname==='/bank/parity'&&request.method==='GET'){
      try{return json(await cloudBankParityManifest(this.state.storage));}
      catch{return json({ok:false,error:'Conferência bancária indisponível.'},409);}
    }
    if(u.pathname==='/bank/transactions'&&request.method==='GET'){
      try{return json(readBankTransactionsPage(this.state.storage,{
        offset:u.searchParams.get('offset')??'0',
        limit:u.searchParams.get('limit')??'30',
        search:u.searchParams.get('search')??'',
        direction:u.searchParams.get('direction')??'all'
      }));}
      catch{return json({ok:false,error:'Consulta bancária inválida.'},400);}
    }
    if(u.pathname==='/bank/refresh'&&request.method==='POST'){
      // The DO holds the trusted Worker env; a public caller cannot pass its
      // own secrets or provider configuration. Only server-side Pluggy calls.
      const result=await ingestPluggyToStaging(this.state.storage,this.env);
      await this.scheduleNextBankSync(result.ok);
      return json(result);
    }
    if(u.pathname==='/migration/manual-transactions'&&request.method==='GET'){
      try{return json(readManualTransactionsPage(this.state.storage,{
        offset:u.searchParams.get('offset')??'0',
        limit:u.searchParams.get('limit')??'30'
      }));}
      catch{return json({ok:false,error:'Consulta manual inválida.'},400);}
    }
    if(u.pathname==='/migration/personal-overview'&&request.method==='GET'){
      return json(readVerifiedPersonalOverview(this.state.storage));
    }
    if(u.pathname.startsWith('/migration/personal/')&&request.method==='POST'){
      // Internal Durable Object route only. Authentication and explicit
      // preview owner consent are both checked at the Worker boundary.
      const op=u.pathname.slice('/migration/personal/'.length);
      if(!['begin','chunk','verify','cancel','status'].includes(op))
        return json({error:'Operação de migração desconhecida.'},404);
      const input=await request.json().catch(()=>null);
      if(!input)return json({error:'Pacote inválido.'},400);
      try{
        const storage=this.state.storage;
        if(op==='begin')return json(beginPersonalTransfer(storage,input));
        if(op==='chunk')return json(applyPersonalChunk(storage,input));
        if(op==='verify')return json(await verifyPersonalTransfer(storage,input.importId));
        if(op==='cancel')return json(cancelPersonalTransfer(storage,input.importId));
        return json(personalTransferStatus(storage,input.importId));
      }catch{
        // Never reflect row values, identifiers, schema errors or secrets.
        return json({ok:false,error:'Operação recusada pela validação da quarentena.'},409);
      }
    }
    if(u.pathname==='/migration/batch-demo'&&request.method==='POST'){
      // Fixed server-side fictional data, no client body accepted. Exercise
      // chunk retries, integrity and automatic full rollback in the DO.
      try{return json(await runSyntheticBatchDemo(this.state.storage));}
      catch{return json({ok:false,error:'Teste de lotes fictícios não aprovado.'},500);}
    }
    if(u.pathname==='/migration/quarantine-demo'&&request.method==='POST'){
      // Run the STRICT real 17-table import validator on a compiled-in fake
      // package, then discard every imported row from quarantine. No client
      // records, no live finance, no background import.
      try{return json(await runSyntheticQuarantineDemo(this.state.storage));}
      catch{return json({ok:false,error:'Quarentena fictícia não passou na conferência.'},500);}
    }
    if(u.pathname==='/migration/dry-run'&&request.method==='POST'){
      // This route accepts NO client records. It writes only hardcoded fake
      // rows into separate mf_stage_* tables in this Durable Object.
      try{return json(runSyntheticMigrationDryRun(this.state.storage));}
      catch{return json({ok:false,error:'Falha na migração fictícia. Não importe dados reais.'},500);}
    }
    if(u.pathname==='/config') {const {publicKey}=await this.getVapid();return json({publicKey});}
    if(u.pathname==='/status') {
      const sub=(await this.state.storage.get('subscriptions'))||[];
      return json({registered:sub.length,lastTest:(await this.state.storage.get('last_test'))||null,events:((await this.state.storage.get('events'))||[]).slice(-8)});
    }
    if(u.pathname==='/subscribe'&&request.method==='POST') {
      const data=await request.json().catch(()=>null);
      if(!isValidSubscription(data)) return json({error:'Assinatura inválida ou serviço não reconhecido.'},400);
      const subs=(await this.state.storage.get('subscriptions'))||[];
      const index=subs.findIndex(s=>s.endpoint===data.endpoint);
      if(index===-1&&subs.length>=DEVICE_LIMIT) return json({error:'Limite de cinco aparelhos neste teste.'},409);
      if(index>=0) subs[index]=data; else subs.push(data);
      await this.state.storage.put('subscriptions',subs);
      return json({ok:true,registered:subs.length});
    }
    if(u.pathname==='/check'&&request.method==='POST') {
      const body=await request.json().catch(()=>null);
      if(typeof body?.endpoint!=='string'||!isApprovedEndpoint(body.endpoint)) return json({error:'Inscrição do aparelho inválida.'},400);
      const subs=(await this.state.storage.get('subscriptions'))||[];
      return json({registered:subs.some(s=>s.endpoint===body.endpoint),total:subs.length});
    }
    if(u.pathname==='/send'&&request.method==='POST') return json(await this.send());
    if(u.pathname==='/schedule'&&request.method==='POST') {
      const events=(await this.state.storage.get('events'))||[];
      const id=crypto.randomUUID();
      events.push({id,at:Date.now()+120000,status:'queued',tries:0});
      await this.state.storage.put('events',events.slice(-40));
      await this.scheduleAlarm();
      return json({ok:true,id,delayMinutes:2});
    }
    return json({error:'Rota indisponível.'},404);
  }
}

export default {
  async scheduled(_event,env,ctx){
    // Production and unconfigured deployments cannot start a bank sync.
    if(!bankServerEnabled(env)||!accessConfigured(env))return;
    const job=async()=>{
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      const response=await stub.fetch(new Request('https://internal/bank/refresh',{
        method:'POST'
      }));
      // Never print bank records, credentials, errors or response bodies.
      return response.status;
    };
    ctx.waitUntil(job().catch(()=>{}));
  },
  async fetch(request,env) {
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/')) {
      const response=await env.ASSETS.fetch(request);
      const headers=new Headers(response.headers);
      headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');
      headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
      // Only the browser pairing page can POST to loopback. Other public PWA
      // pages retain the strict no-cross-origin CSP.
      if(url.pathname==='/desktop-connect.html')
        headers.set('Content-Security-Policy',
          "default-src 'self'; script-src 'self'; style-src 'self'; "+
          "connect-src 'self' http://127.0.0.1:*; form-action http://127.0.0.1:*; "+
          "img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
      return new Response(response.body,{status:response.status,headers});
    }
    if(!env.APP_ACCESS_TOKEN || env.APP_ACCESS_TOKEN.length<18) return json({error:'O acesso privado ainda não foi configurado na Cloudflare.'},503);
    if(request.method==='POST'&&!postIsSameOrigin(request)) return json({error:'Origem não autorizada.'},403);
    if(url.pathname==='/api/login'&&request.method==='POST') {
      const body=await request.json().catch(()=>({}));
      if(typeof body.code!=='string'||!constantEqual(body.code,env.APP_ACCESS_TOKEN)) return json({error:'Código de acesso inválido.'},401);
      const expiry=String(Math.floor(Date.now()/1000)+SESSION_SECONDS);
      return json({ok:true},200,{'Set-Cookie':`${COOKIE}=${expiry}.${await mac(env.APP_ACCESS_TOKEN,`session:${expiry}`)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`});
    }
    const signedIn=await checkSession(request,env.APP_ACCESS_TOKEN);
    if(url.pathname==='/api/session')return json({authenticated:signedIn});
    if(!signedIn)return json({error:'Faça login para continuar.'},401);
    if(url.pathname==='/api/ai/capabilities'&&request.method==='GET'){
      // Same shared policy as desktop; never authenticate ChatGPT from the PWA.
      if(!personalQuarantineAllowed(env))return json({error:'Prévia de IA não habilitada.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:'Acesso protegido necessário.'},identity.status);
      return json(publicCapabilities());
    }
    if(url.pathname==='/api/ai/demo-preview'&&request.method==='GET'){
      // Deterministic shared context preview only; never calls OpenAI.
      // Same pilot-session + Cloudflare Access gates as /api/ai/capabilities.
      if(!personalQuarantineAllowed(env))return json({error:'Prévia de IA não habilitada.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:'Acesso protegido necessário.'},identity.status);
      try{
        const caseId=url.searchParams.get('caseId');
        const preview=assembleDemoContext(buildDemoRequest(caseId),[],false).inspection;
        return json(preview);
      }catch{return json({error:'Exemplo de demonstração inválido.'},400);}
    }
    if(url.pathname==='/api/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
    if(url.pathname==='/api/access/diagnose-certs'&&request.method==='POST'){
      // Public-certificate connectivity only; returns NO JWT, JWK, email,
      // secret or real financial records. Already requires the pilot session,
      // same-origin POST and Preview-only Access edge policy.
      if(!accessConfigured(env))return json({error:'Diagnóstico indisponível fora do Preview protegido.'},404);
      return json(await diagnoseAccessCerts(env));
    }
    if(url.pathname==='/api/desktop/pair'&&request.method==='POST'){
      // Only the owner in the actual system browser may bootstrap the
      // native Preview. Both independently authenticated sessions are
      // mandatory. Never return bearer assertions in URL redirects or logs.
      if(!personalQuarantineAllowed(env))
        return json({error:'Vinculação não disponível fora do Preview.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:'Identidade Cloudflare não confirmada.'},identity.status);
      let body;
      try{body=await readBoundedJSON(request,1024);}
      catch{return json({error:'Solicitação de vínculo inválida.'},400);}
      if(!Number.isSafeInteger(body.port)||body.port<1024||body.port>65535||
         typeof body.nonce!=='string'||!/^[a-f0-9]{64}$/.test(body.nonce)||
         body.confirm!==true)
        return json({error:'Confirmação de vínculo inválida.'},400);
      const assertion=request.headers.get('Cf-Access-Jwt-Assertion');
      const privateCookie=(request.headers.get('Cookie')||'').split(';')
        .map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
      const sessionValue=privateCookie?.slice(COOKIE.length+1);
      if(!assertion||assertion.length>8192||
         !/^\d{10,11}\.[A-Za-z0-9_-]{32,128}$/.test(sessionValue||''))
        return json({error:'A sessão precisa ser renovada no navegador.'},403);
      // Temporary bridge valid only for this owner-authenticated request.
      // Referrer-Policy:no-referrer and no-store are set on all responses.
      return json({ok:true,port:body.port,nonce:body.nonce,
        accessAssertion:assertion,pilotSession:sessionValue,
        previewOnly:true,financialSyncEnabled:false});
    }
    if((url.pathname==='/api/personal/changes'&&request.method==='GET')||
       (url.pathname==='/api/personal/baseline'&&request.method==='GET')||
       (url.pathname==='/api/personal/apply'&&request.method==='POST')){
      if(!personalQuarantineAllowed(env))
        return json({error:'Sincronização pessoal não habilitada neste ambiente.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      if(url.pathname==='/api/personal/baseline')
        return stub.fetch(new Request('https://internal/personal/baseline'));
      if(request.method==='GET'){
        const since=Number(url.searchParams.get('since')||0),
          limit=Number(url.searchParams.get('limit')||100);
        if(!Number.isSafeInteger(since)||since<0||
           !Number.isSafeInteger(limit)||limit<1||limit>200)
          return json({error:'Parâmetros inválidos.'},400);
        return stub.fetch(new Request('https://internal/personal/changes?since='+since+'&limit='+limit));
      }
      if(request.headers.get('X-MF-Personal-Edit')!=='optimistic-v1')
        return json({error:'Confirmação de edição ausente.'},403);
      let input;
      try{input=await readBoundedJSON(request,16*1024);}
      catch{return json({error:'Edição grande demais ou inválida.'},413);}
      return stub.fetch(new Request('https://internal/personal/apply',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)
      }));
    }
    if(url.pathname==='/api/finance/installment-quote'&&request.method==='POST'){
      if(!personalQuarantineAllowed(env))
        return json({error:'Simulação indisponível fora do Preview privado.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      let input;
      try{input=await readBoundedJSON(request,2048);}
      catch{return json({error:'Parâmetros da simulação inválidos.'},400);}
      try{return json(installmentQuote(input));}
      catch{return json({error:'Valor, parcelas, juros ou datas inválidos.'},400);}
    }
    if(url.pathname==='/api/finance/period-summary'&&request.method==='GET'){
      if(!personalQuarantineAllowed(env))
        return json({error:'Resumo financeiro indisponível fora do Preview privado.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const required=['start','end','source'];
      const allowed=new Set(required);
      for(const key of url.searchParams.keys()){
        if(!allowed.has(key)||url.searchParams.getAll(key).length!==1)
          return json({error:'Parâmetros de período inválidos.'},400);
      }
      if(required.some(key=>!url.searchParams.has(key)))
        return json({error:'Informe período e origem.'},400);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      return stub.fetch(new Request('https://internal/finance/period-summary'+url.search));
    }
    if(url.pathname==='/api/bank/e1-evidence'&&request.method==='GET'){
      if(!personalQuarantineAllowed(env))
        return json({error:'Auditoria indisponível fora do Preview protegido.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      return stub.fetch(new Request('https://internal/bank/e1-evidence'));
    }
    if(url.pathname==='/api/bank/reference-audit'&&request.method==='GET'){
      if(!personalQuarantineAllowed(env))
        return json({error:'Conferência indisponível fora do Preview protegido.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      return stub.fetch(new Request('https://internal/bank/reference-audit'));
    }
    if(url.pathname==='/api/bank/parity'&&request.method==='GET'){
      if(!personalQuarantineAllowed(env))
        return json({error:'Comparação não disponível fora do Preview protegido.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      return stub.fetch(new Request('https://internal/bank/parity'));
    }
    if(url.pathname==='/api/bank/transactions'&&request.method==='GET'){
      if(!personalQuarantineAllowed(env))
        return json({error:'Extrato de prévia indisponível neste ambiente.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const allowed=new Set(['offset','limit','search','direction']);
      for(const key of url.searchParams.keys()){
        if(!allowed.has(key)||url.searchParams.getAll(key).length!==1)
          return json({error:'Filtro de consulta inválido.'},400);
      }
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      return stub.fetch(new Request('https://internal/bank/transactions'+url.search));
    }
    if(url.pathname==='/api/bank/status'&&request.method==='GET'){
      if(!personalQuarantineAllowed(env))
        return json({error:'Histórico bancário indisponível neste ambiente.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      const result=await stub.fetch(new Request('https://internal/bank/status'));
      const payload=await result.json();
      return json({...payload,providerConfigured:bankServerEnabled(env)});
    }
    if(url.pathname==='/api/bank/refresh'&&request.method==='POST'){
      if(!personalQuarantineAllowed(env)||!bankServerEnabled(env))
        return json({error:'Atualização bancária do servidor ainda não configurada.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      if(request.headers.get('X-MF-Bank-Consent')!=='preview-bank-staging-only')
        return json({error:'Confirmação de importação bancária ausente.'},403);
      let requested;
      try{requested=await readBoundedJSON(request,512);}
      catch{return json({error:'Pedido bancário inválido.'},400);}
      if(requested.consent!=='preview-bank-staging-only')
        return json({error:'Autorização bancária explícita necessária.'},403);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      // No user-controlled Item IDs or secrets are accepted from HTTP.
      return stub.fetch(new Request('https://internal/bank/refresh',{method:'POST'}));
    }
    if(url.pathname==='/api/migration/manual-transactions'&&request.method==='GET'){
      if(!personalQuarantineAllowed(env))
        return json({error:'Lançamentos manuais indisponíveis fora do Preview.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const allowed=new Set(['offset','limit']);
      for(const key of url.searchParams.keys()){
        if(!allowed.has(key)||url.searchParams.getAll(key).length!==1)
          return json({error:'Filtro inválido.'},400);
      }
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      return stub.fetch(new Request('https://internal/migration/manual-transactions'+url.search));
    }
    if(url.pathname==='/api/migration/personal-overview'&&request.method==='GET'){
      if(!personalQuarantineAllowed(env))
        return json({error:'Prévia financeira indisponível neste ambiente.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      return stub.fetch(new Request('https://internal/migration/personal-overview',{
        method:'GET'
      }));
    }
    if(url.pathname.startsWith('/api/migration/personal/')&&request.method==='POST'){
      // Only this strictly isolated Preview accepts owner-approved personal
      // data, and ONLY into quarantine. Production stays fail-closed.
      if(!personalQuarantineAllowed(env))
        return json({error:'Importação pessoal não habilitada neste ambiente.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const op=url.pathname.slice('/api/migration/personal/'.length);
      if(!['begin','chunk','verify','cancel','status'].includes(op))
        return json({error:'Operação não disponível.'},404);
      if(request.headers.get('X-MF-Migration-Consent')!=='preview-quarantine-only')
        return json({error:'Confirmação explícita de migração ausente.'},403);
      let input;
      try{input=await readBoundedJSON(request,op==='chunk'?224*1024:12*1024);}
      catch{return json({error:'Conteúdo de migração inválido ou grande demais.'},413);}
      if(op==='begin'&&input.consent!=='preview-quarantine-only')
        return json({error:'Autorização explícita necessária.'},403);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      return stub.fetch(new Request('https://internal/migration/personal/'+op,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(input)
      }));
    }
    if(url.pathname==='/api/migration/batch-demo'&&request.method==='POST'){
      // BOTH independent authentication gates above remain mandatory.
      // No financial rows or credentials from the request reach the DO.
      if(!accessConfigured(env))
        return json({error:'Teste de lotes requer Cloudflare Access configurado.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      return stub.fetch(new Request('https://internal/migration/batch-demo',{
        method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
      }));
    }
    if(url.pathname==='/api/migration/quarantine-demo'&&request.method==='POST'){
      // Must pass BOTH login layers. Missing Cloudflare Access preview config
      // fails closed, even with a valid private pilot session.
      if(!accessConfigured(env))
        return json({error:'Teste de quarentena requer Cloudflare Access configurado.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      // No user body crosses into the DO. Strictly fixed server-side fixture.
      return stub.fetch(new Request('https://internal/migration/quarantine-demo',{
        method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
      }));
    }
    if(url.pathname==='/api/migration/dry-run'&&request.method==='POST'){
      // Run only for an authenticated Access identity and pilot session.
      // Production without Access variables cannot invoke this new route.
      if(!accessConfigured(env))
        return json({error:'Teste de migração requer Cloudflare Access configurado.'},403);
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      return stub.fetch(new Request('https://internal/migration/dry-run',{
        method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
      }));
    }
    if(url.pathname.startsWith('/api/sync/')) {
      // The Static Assets router does not reliably pass ctx.access. Authenticate
      // cryptographically using the signed Access JWT if Access is configured.
      // The existing private session is required above as a second gate.
      const identity=await authorizeAccess(request,env);
      if(!identity.ok)return json({error:identity.error},identity.status);
      const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
      return stub.fetch(new Request('https://internal/sync/'+url.pathname.slice('/api/sync/'.length)+url.search,{
        method:request.method,headers:{'Content-Type':'application/json'},
        body:request.method==='POST'?request.body:null,
        duplex:request.method==='POST'?'half':undefined
      }));
    }
    const routes={'/api/config':'/config','/api/status':'/status','/api/subscribe':'/subscribe','/api/check':'/check','/api/test':'/send','/api/test-later':'/schedule'};
    if(!routes[url.pathname])return json({error:'Rota indisponível.'},404);
    const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
    return stub.fetch(new Request(`https://internal${routes[url.pathname]}`,{method:request.method,headers:{'Content-Type':'application/json'},body:request.method==='POST'?request.body:null,duplex:request.method==='POST'?'half':undefined}));
  }
};

export const _test={nextAllowedAt,isApprovedEndpoint,constantEqual,makeJWT,isValidSubscription};
