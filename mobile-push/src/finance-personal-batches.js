// Future authenticated personal-data transfer by bounded, idempotent batches.
//
// This module currently has NO HTTP route. Neither app nor Worker sends real
// records to this API. A future owner-bound channel must verify Cloudflare
// Access JWT, private pilot session, Origin, device pairing and user consent.
//
// Rows stay in mf_transfer_* quarantine, not the live financial database.
// Finalization validates every original table digest and relational invariant.
// Aborting removes every row and cannot be silently reversed.
import {PERSONAL_COLUMNS,PERSONAL_FORMAT,validatePersonalMigrationPackage} from './finance-personal-validate.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST=/^[a-f0-9]{64}$/i;
const MAX_ROWS_PER_CHUNK=80;
const MAX_CHUNK_BYTES=192*1024;
const MAX_TOTAL_ROWS=100000;
const MAX_TOTAL_BYTES=32*1024*1024;
const encoder=new TextEncoder();
const names=Object.keys(PERSONAL_COLUMNS);

function fail(message){throw new Error('Transferência bloqueada: '+message);}
function assertId(id){if(typeof id!=='string'||!UUID.test(id))fail('identificador inválido.');}
function get(storage,id){
 return storage.sql.exec('SELECT import_id,state,manifest_json,row_count,byte_count FROM mf_transfer_session WHERE import_id=?',id).toArray()[0]||null;
}
function validateManifest(summary){
 if(!summary||typeof summary!=='object'||Array.isArray(summary))fail('resumo ausente.');
 if(summary.format!==PERSONAL_FORMAT||summary.schemaVersion!==6||summary.tables!==17)
   fail('versão do pacote não reconhecida.');
 if(!Number.isSafeInteger(summary.rows)||summary.rows<0||summary.rows>MAX_TOTAL_ROWS||
    !Number.isSafeInteger(summary.bytes)||summary.bytes<0||summary.bytes>MAX_TOTAL_BYTES||
    typeof summary.digest!=='string'||!DIGEST.test(summary.digest))
   fail('limites ou hash geral inválidos.');
 if(summary.cloudTransferred!==false||summary.cutoverReady!==false||
    summary.bankHistoryMigrated!==false)fail('marcadores de corte inválidos.');
 if(!summary.byTable||typeof summary.byTable!=='object'||Array.isArray(summary.byTable)||
    Object.keys(summary.byTable).length!==names.length||
    names.some(t=>!Object.hasOwn(summary.byTable,t)))
   fail('tabelas não conferem.');
 let total=0;
 for(const table of names){
   const value=summary.byTable[table];
   if(!value||!Number.isSafeInteger(value.rows)||value.rows<0||
      value.rows>MAX_TOTAL_ROWS||typeof value.digest!=='string'||!DIGEST.test(value.digest))
     fail('contagem ou hash de tabela inválido.');
   total+=value.rows;
 }
 if(total!==summary.rows)fail('contagem total inconsistente.');
 // Normalized compile-time table order prevents silent additions/deletions.
 return {format:summary.format,schemaVersion:6,tables:17,
   rows:summary.rows,bytes:summary.bytes,digest:summary.digest.toLowerCase(),
   byTable:Object.fromEntries(names.map(t=>[t,{
     rows:summary.byTable[t].rows,digest:summary.byTable[t].digest.toLowerCase()
   }])),
   cloudTransferred:false,bankHistoryMigrated:false,cutoverReady:false};
}
function safeRow(table,row){
 if(!row||typeof row!=='object'||Array.isArray(row))fail('linha inválida.');
 const columns=PERSONAL_COLUMNS[table];
 if(Object.keys(row).length!==columns.length||
    Object.keys(row).some(col=>!columns.includes(col))||
    columns.some(col=>!Object.hasOwn(row,col)))fail('colunas não conferem.');
 // Full type, FK and SHA validation runs at finalize. Never accept nested
 // objects, floats, blob or oversized strings even during intermediate writes.
 for(const key of columns){
   const value=row[key];
   if(value!==null&&typeof value!=='string'&&!(typeof value==='number'&&Number.isSafeInteger(value)))
     fail('tipo de valor inválido.');
   if(typeof value==='string'&&encoder.encode(value).byteLength>256000)
     fail('campo de texto grande demais.');
 }
 return JSON.stringify(Object.fromEntries(columns.map(key=>[key,row[key]])));
}

export function ensureTransferTables(storage){
 storage.sql.exec("CREATE TABLE IF NOT EXISTS mf_transfer_session (import_id TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('receiving','verified','aborted')), manifest_json TEXT NOT NULL, row_count INTEGER NOT NULL DEFAULT 0, byte_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)");
 storage.sql.exec("CREATE TABLE IF NOT EXISTS mf_transfer_rows (import_id TEXT NOT NULL, table_name TEXT NOT NULL, ordinal INTEGER NOT NULL, row_json TEXT NOT NULL, PRIMARY KEY(import_id,table_name,ordinal))");
}

export function beginPersonalTransfer(storage,{importId,manifest}){
 assertId(importId);
 const validated=validateManifest(manifest);
 ensureTransferTables(storage);
 return storage.transactionSync(()=>{
  const existing=get(storage,importId);
  const serialized=JSON.stringify(validated);
  if(existing){
    if(existing.manifest_json!==serialized||existing.state!=='receiving')
      fail('não é possível reutilizar esse identificador.');
    return {ok:true,replayed:true,stage:'receiving',expectedRows:validated.rows,
      financialSyncEnabled:false};
  }
  if(storage.sql.exec("SELECT COUNT(*) AS n FROM mf_transfer_session WHERE state IN ('receiving','verified')").one().n>0)
    fail('já existe uma transferência ativa.');
  storage.sql.exec("INSERT INTO mf_transfer_session(import_id,state,manifest_json,created_at) VALUES (?,'receiving',?,?)",
    importId,serialized,new Date().toISOString());
  return {ok:true,replayed:false,stage:'receiving',expectedRows:validated.rows,
    financialSyncEnabled:false};
 });
}

export function applyPersonalChunk(storage,{importId,table,offset,rows}){
 assertId(importId);
 if(typeof table!=='string'||!Object.hasOwn(PERSONAL_COLUMNS,table))
   fail('tabela desconhecida.');
 if(!Number.isSafeInteger(offset)||offset<0||!Array.isArray(rows)||
    rows.length<1||rows.length>MAX_ROWS_PER_CHUNK)fail('lote fora dos limites.');
 const normalized=rows.map(row=>safeRow(table,row));
 const bytes=normalized.reduce((sum,text)=>sum+encoder.encode(text).byteLength,0);
 if(bytes>MAX_CHUNK_BYTES)fail('lote grande demais.');
 ensureTransferTables(storage);
 return storage.transactionSync(()=>{
  const current=get(storage,importId);
  if(!current||current.state!=='receiving')fail('transferência não está aberta.');
  const summary=JSON.parse(current.manifest_json);
  if(offset+rows.length>summary.byTable[table].rows)fail('lote excede a contagem prevista.');
  let inserted=0,replayed=0;
  for(let i=0;i<normalized.length;i++){
   const n=offset+i;
   const previous=storage.sql.exec('SELECT row_json FROM mf_transfer_rows WHERE import_id=? AND table_name=? AND ordinal=?',
     importId,table,n).toArray()[0];
   if(previous){
     if(previous.row_json!==normalized[i])fail('lote repetido com conteúdo diferente.');
     replayed++;continue;
   }
   storage.sql.exec('INSERT INTO mf_transfer_rows (import_id,table_name,ordinal,row_json) VALUES (?,?,?,?)',
     importId,table,n,normalized[i]);
   inserted++;
  }
  const totals=storage.sql.exec('SELECT COUNT(*) AS n,COALESCE(SUM(LENGTH(CAST(row_json AS BLOB))),0) AS bytes FROM mf_transfer_rows WHERE import_id=?',
    importId).one();
  if(totals.n>MAX_TOTAL_ROWS||totals.bytes>MAX_TOTAL_BYTES||
     totals.n>summary.rows||totals.bytes>summary.bytes)
    fail('transferência ultrapassou os limites do manifesto.');
  storage.sql.exec('UPDATE mf_transfer_session SET row_count=?,byte_count=? WHERE import_id=?',
    totals.n,totals.bytes,importId);
  return {ok:true,stage:'receiving',table,inserted,replayed,receivedRows:totals.n,
    expectedRows:summary.rows,financialSyncEnabled:false};
 });
}

export async function verifyPersonalTransfer(storage,importId){
 assertId(importId);
 ensureTransferTables(storage);
 const current=get(storage,importId);
 if(!current||current.state==='aborted')fail('transferência inexistente ou cancelada.');
 const manifest=JSON.parse(current.manifest_json);
 if(current.row_count!==manifest.rows||current.byte_count!==manifest.bytes)
   fail('transferência incompleta: envie os lotes faltantes antes de verificar.');
 // Entire package is rebuilt from quarantined SQLite rows only. No user
 // supplier is trusted during verification.
 const tables={};
 for(const table of names){
   const found=storage.sql.exec(
     'SELECT ordinal,row_json FROM mf_transfer_rows WHERE import_id=? AND table_name=? ORDER BY ordinal ASC',
     importId,table
   ).toArray();
   if(found.length!==manifest.byTable[table].rows)
     fail('tabela não foi recebida completamente.');
   const rows=found.map((item,i)=>{
     if(item.ordinal!==i)fail('a ordem da tabela está incompleta.');
     return JSON.parse(item.row_json);
   });
   tables[table]={columns:[...PERSONAL_COLUMNS[table]],rows};
 }
 const valid=await validatePersonalMigrationPackage({format:PERSONAL_FORMAT,
   schemaVersion:6,tables,manifest});
 if(!valid.valid||valid.personalRecords!==manifest.rows)
   fail('validação cruzada não passou.');
 return storage.transactionSync(()=>{
   const latest=get(storage,importId);
   if(!latest||latest.state==='aborted')fail('transferência cancelada.');
   if(latest.row_count!==manifest.rows||latest.byte_count!==manifest.bytes||
      latest.manifest_json!==current.manifest_json)fail('manifesto alterado durante validação.');
   storage.sql.exec("UPDATE mf_transfer_session SET state='verified' WHERE import_id=?",importId);
   return {ok:true,stage:'quarantine_verified',personalTables:17,
     personalRecords:valid.personalRecords,
     bankLinksPending:valid.deferredBankReferences,
     financialSyncEnabled:false,cutoverAllowed:false,
     realDataPublished:false};
 });
}

export function cancelPersonalTransfer(storage,importId){
 assertId(importId);
 ensureTransferTables(storage);
 return storage.transactionSync(()=>{
   const current=get(storage,importId);
   if(!current)return {ok:true,discarded:false};
   storage.sql.exec('DELETE FROM mf_transfer_rows WHERE import_id=?',importId);
   storage.sql.exec("UPDATE mf_transfer_session SET state='aborted',row_count=0,byte_count=0 WHERE import_id=?",importId);
   return {ok:true,discarded:true,financialSyncEnabled:false};
 });
}

export function personalTransferStatus(storage,importId){
 assertId(importId);
 ensureTransferTables(storage);
 const current=get(storage,importId);
 if(!current)return {ok:true,stage:'not_started',receivedRows:0,
   financialSyncEnabled:false,realDataPublished:false};
 const summary=JSON.parse(current.manifest_json);
 return {ok:true,stage:current.state,receivedRows:current.row_count,
   expectedRows:summary.rows,personalTables:17,
   financialSyncEnabled:false,realDataPublished:false};
}
