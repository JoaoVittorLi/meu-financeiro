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
    const queued=((await this.state.storage.get('events'))||[]).filter(x=>x.status==='queued');
    if(!queued.length) { await this.state.storage.deleteAlarm(); return; }
    await this.state.storage.setAlarm(Math.max(Date.now()+1000,Math.min(...queued.map(x=>x.at))));
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
    await this.scheduleAlarm();
  }
  async fetch(request) {
    const u=new URL(request.url);
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
  async fetch(request,env) {
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/')) {
      const response=await env.ASSETS.fetch(request);
      const headers=new Headers(response.headers);
      headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');
      headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
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
    if(url.pathname==='/api/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
    const routes={'/api/config':'/config','/api/status':'/status','/api/subscribe':'/subscribe','/api/check':'/check','/api/test':'/send','/api/test-later':'/schedule'};
    if(!routes[url.pathname])return json({error:'Rota indisponível.'},404);
    const stub=env.PUSH_HOME.get(env.PUSH_HOME.idFromName('one-private-user'));
    return stub.fetch(new Request(`https://internal${routes[url.pathname]}`,{method:request.method,headers:{'Content-Type':'application/json'},body:request.method==='POST'?request.body:null,duplex:request.method==='POST'?'half':undefined}));
  }
};

export const _test={nextAllowedAt,isApprovedEndpoint,constantEqual,makeJWT,isValidSubscription};
