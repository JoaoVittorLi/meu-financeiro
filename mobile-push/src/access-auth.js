// Cloudflare Access authentication for this Worker with Static Assets.
//
// Access's ctx.access identity is NOT reliably forwarded through the Static
// Assets router. Verify the cryptographic Access JWT provided to the Worker.
// This module never trusts unsigned identity headers, client email or JWT payloads.
const CONFIG_KEYS=['TEAM_DOMAIN','POLICY_AUD','ACCESS_ALLOWED_EMAIL'];
const CACHE_MS=5*60*1000;
const certCache=new Map();
const textEncoder=new TextEncoder();

export function accessConfigured(env={}) {
  return CONFIG_KEYS.some(key=>env[key]!==undefined);
}

function accessSettings(env){
  const team=typeof env.TEAM_DOMAIN==='string'?env.TEAM_DOMAIN.trim().replace(/\/+$/,'').trim():'';
  const audience=typeof env.POLICY_AUD==='string'?env.POLICY_AUD.trim():env.POLICY_AUD;
  const email=typeof env.ACCESS_ALLOWED_EMAIL==='string'?env.ACCESS_ALLOWED_EMAIL.trim():env.ACCESS_ALLOWED_EMAIL;
  if(!/^https:\/\/[a-z0-9][a-z0-9-]{0,62}\.cloudflareaccess\.com$/i.test(team) ||
     typeof audience!=='string'||!/^[a-zA-Z0-9_-]{8,160}$/.test(audience) ||
     typeof email!=='string'||email.length>254||!(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)))return null;
  return {team,audience,email:email.toLowerCase()};
}

// Preview-only operational probe. It NEVER accepts a URL or token from the
// browser and NEVER returns identity, signing keys, credentials or response body.
// The route calling this helper requires the pilot's signed session and is
// additionally protected by Access at the edge.
export async function diagnoseAccessCerts(env={},options={}){
  const settings=accessSettings(env);
  if(!settings)return {ok:false,code:'CONFIG_INVALID',credentialsIncluded:false};
  const fetchImpl=options.fetchImpl||fetch;
  const url=settings.team+'/cdn-cgi/access/certs';
  const observations=[];
  // A strict redirect policy can fail differently from a manual policy in
  // Workers. Compare both WITHOUT following any redirect to another origin.
  for(const redirect of ['error','manual']){
    let response;
    try{
      response=await fetchImpl(url,{redirect,headers:{Accept:'application/json'}});
    }catch{
      observations.push({mode:redirect,code:'FETCH_FAILED'});
      continue;
    }
    const status=Number.isInteger(response?.status)?response.status:null;
    if(status===null){
      observations.push({mode:redirect,code:'INVALID_RESPONSE'});
      continue;
    }
    if(status>=300&&status<400){
      observations.push({mode:redirect,code:'REDIRECT',httpStatus:status});
      continue;
    }
    if(!response.ok){
      observations.push({mode:redirect,code:'HTTP_ERROR',httpStatus:status});
      continue;
    }
    let data;
    try{data=await response.json();}
    catch{
      observations.push({mode:redirect,code:'INVALID_JSON',httpStatus:status});
      continue;
    }
    if(!Array.isArray(data?.keys)){
      observations.push({mode:redirect,code:'KEYS_MISSING',httpStatus:status});
      continue;
    }
    const rsaKeys=data.keys.filter(k=>k&&k.kty==='RSA'&&
      typeof k.kid==='string'&&typeof k.n==='string'&&typeof k.e==='string');
    observations.push({
      mode:redirect,code:rsaKeys.length?'CERTS_OK':'NO_RSA_KEYS',
      httpStatus:status,keyCount:rsaKeys.length
    });
  }
  return {ok:observations.some(item=>item.code==='CERTS_OK'),
    code:'CERTS_PROBE_COMPLETE',observations,credentialsIncluded:false};
}

function bytesFromB64url(value){
  if(typeof value!=='string'||!(/^[a-zA-Z0-9_-]+$/.test(value)))throw new Error('Malformed token.');
  const base64=value.replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(base64.padEnd(Math.ceil(base64.length/4)*4,'='));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}

function jsonFromPart(part){
  const bytes=bytesFromB64url(part);
  if(bytes.length>8192)throw new Error('Token field too large.');
  const json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!json||typeof json!=='object'||Array.isArray(json))throw new Error('Malformed JWT.');
  return json;
}

async function certificates(team,fetchImpl,now){
  const previous=certCache.get(team);
  if(previous && previous.until>now)return previous.keys;
// Cloudflare Workers can fail with redirect:'error' even when this
  // same public JWKS endpoint returns HTTP 200 using redirect:'manual'.
  // Never follow redirects: only a direct successful response is trusted.
  const response=await fetchImpl(team+'/cdn-cgi/access/certs',{
    redirect:'manual',headers:{Accept:'application/json'}
  });
  if(response.status!==200)throw new Error('Access certs unavailable.');
  const result=await response.json();
  if(!Array.isArray(result?.keys) || result.keys.length<1 || result.keys.length>20)throw new Error('Access certs invalid.');
  const keys=result.keys.filter(k=>k&&k.kty==='RSA'&&typeof k.kid==='string'&&
      typeof k.n==='string'&&typeof k.e==='string'&&
      (!k.alg || k.alg==='RS256')&&(!k.use || k.use==='sig'));
  if(!keys.length)throw new Error('Access certs missing.');
  certCache.set(team,{keys,until:now+CACHE_MS});
  return keys;
}

// Only explain claim mismatches AFTER verifying the JWT signature. Untrusted
// token payloads must never be used for access-control diagnostics.
function verifiedClaimError(payload,settings,now) {
  const epoch=Math.floor(now/1000);
  const audience=Array.isArray(payload.aud)?payload.aud:[payload.aud];
  if(payload.iss!==settings.team)
    return 'O login Cloudflare foi confirmado, mas TEAM_DOMAIN não corresponde ao domínio de autenticação. Confira esse campo no Preview.';
  // Validate time and allowlisted owner BEFORE returning any diagnostics
  // derived from the token claims. Never bypass strict audience matching.
  if(!Number.isSafeInteger(payload.exp)||payload.exp<=epoch||
     (payload.nbf!==undefined&&(!Number.isSafeInteger(payload.nbf)||payload.nbf>epoch))||
     (payload.iat!==undefined&&(!Number.isSafeInteger(payload.iat)||payload.iat>epoch+60)))
    return 'A sessão Cloudflare expirou ou ainda não é válida. Abra novamente o Preview em janela anônima e faça login.';
  if(typeof payload.email!=='string'||payload.email.trim().toLowerCase()!==settings.email)
    return 'Seu login Cloudflare foi verificado, mas o e-mail não corresponde ao ACCESS_ALLOWED_EMAIL do Preview. Confira esse campo.';
  if(!audience.includes(settings.audience)){
    // Application audience tags are public configuration identifiers (not
    // passwords); show only a 64-hex tag from the verified, owner-bound JWT.
    // No token header, signature, email or other claims are exposed.
    const observed=audience.find(x=>typeof x==='string'&&/^[0-9a-f]{64}$/i.test(x));
    return 'POLICY_AUD não corresponde ao aplicativo Access que assinou o login. '
      +(observed?'AUD assinado neste login: '+observed+'. '
        :'Nenhum AUD no formato esperado foi encontrado. ')
      +'Nenhuma permissão foi liberada. Não compartilhe o token JWT.';
  }
  return null;
}

// When no Access variables are present, ONLY the legacy text-note pilot remains
// available using its existing session. Financial collections are code-locked.
// Once any Access variable is set, incomplete configuration fails closed.
export async function authorizeAccess(request,env={},options={}){
  if(!accessConfigured(env))return {ok:true,mode:'pilot_only'};
  const settings=accessSettings(env);
  if(!settings)return {ok:false,status:503,error:'Configuração do acesso reforçado incompleta.'};
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token||token.length>8192)return {ok:false,status:403,error:'Cloudflare Access obrigatório.'};
  // Diagnostics intentionally contain ONLY fixed codes. Never echo tokens,
  // signing-key IDs, emails or unverified claims to the browser or logs.
  let stage='FORMAT';
  try{
    const parts=token.split('.');
    if(parts.length!==3 || parts.some(x=>!x))throw new Error('Malformed token.');
    const header=jsonFromPart(parts[0]);
    const payload=jsonFromPart(parts[1]);
    if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200)throw new Error('Disallowed algorithm.');
    const now=options.now===undefined?Date.now():options.now;

    stage='CERTS';
    const keys=await certificates(settings.team,options.fetchImpl||fetch,now);

    stage='SIGNING_KEY';
    const jwk=keys.find(k=>k.kid===header.kid);
    if(!jwk)throw new Error('Unknown signing key.');

    stage='IMPORT_KEY';
    const publicKey=await crypto.subtle.importKey('jwk',
      {kty:'RSA',n:jwk.n,e:jwk.e,alg:'RS256',ext:true},
      {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);

    stage='SIGNATURE';
    const signature=bytesFromB64url(parts[2]);
    const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',
      publicKey,signature,textEncoder.encode(parts[0]+'.'+parts[1]));
    if(!valid)throw new Error('Invalid signature.');

    stage='CLAIMS';
    const claimError=verifiedClaimError(payload,settings,now);
    if(claimError)return {ok:false,status:403,error:claimError};
    return {ok:true,mode:'access'};
  }catch{
    const messages={
      FORMAT:'CF-FORMAT',
      CERTS:'CF-CERTS',
      SIGNING_KEY:'CF-KEY',
      IMPORT_KEY:'CF-CRYPTO',
      SIGNATURE:'CF-SIGNATURE',
      CLAIMS:'CF-CLAIMS'
    };
    const code=messages[stage]||'CF-UNKNOWN';
    const status=stage==='CERTS'||stage==='IMPORT_KEY'?503:403;
    return {ok:false,status,
      error:'Não foi possível validar o login Cloudflare (código '+code+'). Envie somente esse código ao suporte do projeto; não envie o token.',
      code};
  }
}
