'use strict';

// Desktop main-process transport plan for an eventual approved owner migration.
// NO REAL FINANCIAL NETWORK UPLOAD IS EXPOSED: no IPC bridge calls
// sendPersonalTransferPlan(), no remote endpoint exists, and the public helper
// blocks deployment until its explicit reviewed activation.
// Tests inject a fake transport for synthetic rows only.
const {randomUUID}=require('node:crypto');
const {PERSONAL_TABLES}=require('./cloud-data-routing.cjs');
const {FORMAT}=require('./cloud-personal-snapshot.cjs');

const MAX_CHUNK_ROWS=80;
const MAX_CHUNK_BYTES=192*1024;
const FINANCIAL_TRANSFER_ACTIVE=false;
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertPackage(snap){
  if(!snap||snap.format!==FORMAT||snap.schemaVersion!==6||
     snap.manifest?.tables!==17||!Number.isSafeInteger(snap.manifest.rows)||
     snap.manifest.rows<0||!snap.tables||Object.keys(snap.tables).length!==17)
    throw new Error('Pacote de migração incompleto.');
  if(PERSONAL_TABLES.some(table=>!Object.hasOwn(snap.tables,table)||
     !Array.isArray(snap.tables[table].rows)))throw new Error('Tabela pessoal ausente.');
  if(snap.manifest.cloudTransferred!==false||snap.manifest.cutoverReady!==false||
     snap.manifest.bankHistoryMigrated!==false)
    throw new Error('Pacote não autorizado para corte de fonte de dados.');
}

function buildTransferPlan(snapshot,{importId=randomUUID()}={}){
  assertPackage(snapshot);
  if(typeof importId!=='string'||!ID.test(importId))
    throw new Error('Identificador da migração inválido.');
  const chunks=[];
  let total=0;
  for(const table of PERSONAL_TABLES){
    const rows=snapshot.tables[table].rows;
    let start=0;
    while(start<rows.length){
      let bytes=0,end=start;
      while(end<rows.length&&end-start<MAX_CHUNK_ROWS){
        const row=rows[end];
        if(!row||typeof row!=='object'||Array.isArray(row))
          throw new Error('Linha local não pode ser transferida.');
        const size=Buffer.byteLength(JSON.stringify(row),'utf8');
        if(size>MAX_CHUNK_BYTES)
          throw new Error('Um registro é grande demais para transporte seguro.');
        if(bytes+size>MAX_CHUNK_BYTES)break;
        bytes+=size;end++;
      }
      if(end<=start)throw new Error('Não foi possível separar o lote.');
      chunks.push({table,offset:start,count:end-start,bytes,rows:rows.slice(start,end)});
      start=end;
    }
    total+=rows.length;
  }
  if(total!==snapshot.manifest.rows)throw new Error('Quantidade de registros divergente.');
  const manifest={format:snapshot.format,schemaVersion:6,
    ...snapshot.manifest};
  return {importId,manifest,chunks,
    summary:{tableCount:17,rowCount:total,chunkCount:chunks.length,
      realRecordsUploaded:0,cloudActivated:false}};
}

function publicTransferSummary(plan){
  if(!plan?.summary||!ID.test(plan.importId))
    throw new Error('Plano de transferência inválido.');
  // The UI is never allowed to see descriptions, IDs, hashes or raw records.
  return {personalTables:17,
    personalRecords:plan.summary.rowCount,
    chunks:plan.summary.chunkCount,realRecordsUploaded:0,
    financialSyncEnabled:false};
}

async function testTransferWithFakeAdapter(plan,adapter,{attempts=3}={}){
  // This entry point is for automated tests with a local fake adapter only.
  // The actual production sender below is ALWAYS locked in this build.
  if(!plan||!Array.isArray(plan.chunks)||!adapter||
     typeof adapter.begin!=='function'||typeof adapter.chunk!=='function'||
     typeof adapter.verify!=='function'||!Number.isInteger(attempts)||
     attempts<1||attempts>5)
    throw new Error('Configuração de transporte inválida.');
  async function attempt(fn){
    let last;
    for(let i=0;i<attempts;i++){
      try{return await fn();}
      catch(error){
        last=error;
        // Validation and authorization errors are not retryable.
        if(error?.nonRetryable===true)throw error;
      }
    }
    throw new Error('A conexão de teste não concluiu a transferência.',{cause:last});
  }
  const started=await attempt(()=>adapter.begin({
    importId:plan.importId,manifest:plan.manifest
  }));
  if(started?.ok!==true||started?.financialSyncEnabled!==false)
    throw new Error('Não foi possível iniciar a quarentena.');
  let total=0;
  for(const chunk of plan.chunks){
    const result=await attempt(()=>adapter.chunk({
      importId:plan.importId,table:chunk.table,offset:chunk.offset,rows:chunk.rows
    }));
    if(result?.ok!==true||result.financialSyncEnabled!==false||
       result.inserted+result.replayed!==chunk.count)
      throw new Error('O lote não foi confirmado integralmente.');
    total+=chunk.count;
  }
  const verified=await attempt(()=>adapter.verify(plan.importId));
  if(verified?.ok!==true||verified?.personalTables!==17||
     verified?.personalRecords!==total||verified?.financialSyncEnabled!==false||
     verified?.cutoverAllowed!==false||verified?.realDataPublished!==false)
    throw new Error('A nuvem não confirmou os totais e a integridade.');
  return {ok:true,stage:'quarantine_verified',
    personalTables:17,recordsVerified:total,
    cloudActivated:false,financialSyncEnabled:false};
}

async function sendPersonalTransferPlan(){
  if(!FINANCIAL_TRANSFER_ACTIVE)
    throw new Error('Transferência financeira real bloqueada nesta versão.');
  // Intentionally no network adapter until full owner approval and pairing.
  throw new Error('Adaptador autenticado de produção ainda indisponível.');
}

module.exports={MAX_CHUNK_ROWS,MAX_CHUNK_BYTES,FINANCIAL_TRANSFER_ACTIVE,
  buildTransferPlan,publicTransferSummary,testTransferWithFakeAdapter,
  sendPersonalTransferPlan};
