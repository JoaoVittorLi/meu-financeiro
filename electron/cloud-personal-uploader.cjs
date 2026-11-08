'use strict';

// Privileged Electron main-process ONLY: owner-approved upload of the
// 17 personal-data tables into the ISOLATED Cloudflare Preview quarantine.
// This does not activate finance or replace the desktop database.
// Cookies remain in Electron's Chromium session, never in the renderer.
// Requires a deliberate desktop consent dialog before this module is called.
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {buildTransferPlan,testTransferWithFakeAdapter}=require('./cloud-transfer-plan.cjs');
const {PREVIEW_ORIGIN}=require('./cloud-preview-identity.cjs');

const CONSENT='preview-quarantine-only';
const MAX_REPLY_BYTES=4096;
const MARKER='mf-personal-quarantine-progress.json';

function markerFile(dataDir){
  if(typeof dataDir!=='string'||!dataDir)throw new Error('Pasta privada indisponível.');
  return path.join(dataDir,MARKER);
}
function loadMarker(dataDir){
  try{
    const data=JSON.parse(fs.readFileSync(markerFile(dataDir),'utf8'));
    if(data?.mode===CONSENT&&/^[0-9a-f-]{36}$/i.test(data.importId)&&
       /^[0-9a-f]{64}$/i.test(data.digest))
      return data;
  }catch(error){if(error?.code!=='ENOENT')throw new Error('Registro de migração local inválido.');}
  return null;
}
function saveMarker(dataDir,marker){
  fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
  fs.writeFileSync(markerFile(dataDir),JSON.stringify(marker),{
    encoding:'utf8',mode:0o600
  });
}

async function readReply(response){
  const type=response?.headers?.get('content-type')||'';
  if(!type.toLowerCase().includes('application/json'))
    throw new Error('A nuvem não retornou uma resposta de validação.');
  const body=await response.text();
  if(Buffer.byteLength(body,'utf8')>MAX_REPLY_BYTES)
    throw new Error('Resposta da nuvem maior que o permitido.');
  try{return JSON.parse(body);}
  catch{throw new Error('Resposta da nuvem inválida.');}
}

function makePreviewTransport(fetchImpl){
  if(typeof fetchImpl!=='function')throw new Error('Sessão de nuvem indisponível.');
  async function post(operation,body){
    const endpoint=PREVIEW_ORIGIN+'/api/migration/personal/'+operation;
    if(!['begin','chunk','verify','cancel','status'].includes(operation))
      throw new Error('Operação de migração inválida.');
    const response=await fetchImpl(endpoint,{
      method:'POST',credentials:'include',redirect:'manual',
      headers:{
        Origin:PREVIEW_ORIGIN,'Content-Type':'application/json',
        'Accept':'application/json','X-MF-Migration-Consent':CONSENT
      },body:JSON.stringify(body),signal:AbortSignal.timeout(30000)
    });
    if(response.status!==200){
      const error=new Error(response.status===401||response.status===403
        ?'Sessão protegida expirou. Entre novamente na nuvem.'
        :'A nuvem não confirmou a operação de migração.');
      // Status 401/403/409, and any other non-5xx response, are not retryable.
      error.nonRetryable=response.status<500;
      throw error;
    }
    const data=await readReply(response);
    if(data?.ok!==true||data.financialSyncEnabled!==false)
      throw new Error('Resposta de migração não autorizada.');
    return data;
  }
  return {
    begin:({importId,manifest})=>post('begin',{importId,manifest,consent:CONSENT}),
    chunk:({importId,table,offset,rows})=>post('chunk',{importId,table,offset,rows}),
    verify:importId=>post('verify',{importId}),
    status:importId=>post('status',{importId}),
    cancel:importId=>post('cancel',{importId})
  };
}

async function uploadPersonalQuarantine(snapshot,fetchImpl,dataDir,{consent}={}){
  if(consent!==CONSENT)
    throw new Error('Autorização explícita de envio à quarentena ausente.');
  const adapter=makePreviewTransport(fetchImpl);
  let old=loadMarker(dataDir);
  const digest=snapshot?.manifest?.digest;
  if(!/^[0-9a-f]{64}$/i.test(digest||''))
    throw new Error('Backup não possui resumo verificável.');
  // Never apply a changed local snapshot to a stale remote session. Cancel
  // that session first; if cancellation fails, stop without sending new rows.
  if(old&&old.digest!==digest){
    const cancelled=await adapter.cancel(old.importId);
    if(!cancelled.ok)throw new Error('A migração antiga não foi descartada.');
    old=null;
  }
  let importId=old?.importId||randomUUID();
  let status=await adapter.status(importId);
  if(status.stage==='aborted'){
    importId=randomUUID();
    status=await adapter.status(importId);
  }
  const plan=buildTransferPlan(snapshot,{importId});
  if(status.stage==='verified'){
    if(status.receivedRows!==plan.summary.rowCount)
      throw new Error('A migração anterior não corresponde ao backup atual.');
    return {ok:true,stage:'quarantine_verified',
      recordsVerified:status.receivedRows,cloudActivated:false,
      financialSyncEnabled:false,alreadyTransferred:true};
  }
  saveMarker(dataDir,{mode:CONSENT,importId,digest});
  // Reuses bounded, idempotent retry logic tested against the real SQLite
  // quarantine API. If a timeout occurs after a commit, replay is safe.
  const result=await testTransferWithFakeAdapter(plan,adapter,{attempts:3});
  if(!result.ok||result.recordsVerified!==plan.summary.rowCount||
     result.cloudActivated!==false||result.financialSyncEnabled!==false)
    throw new Error('A quarentena não confirmou todos os registros.');
  saveMarker(dataDir,{mode:CONSENT,importId,digest});
  return {...result,alreadyTransferred:false};
}

module.exports={CONSENT,MARKER,markerFile,loadMarker,saveMarker,
  makePreviewTransport,uploadPersonalQuarantine};
