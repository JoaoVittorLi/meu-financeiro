'use strict';

// Lossless *in-memory only* snapshot of the 17 personal SQLite v0.9.4 tables.
// This is not a public export: no UI bridge or network route exposes rows.
// It reads a consistent, already verified backup in read-only mode. The
// retained Pluggy transaction/account identifiers must be reconciled before
// the cloud importer can use any bank-related personal links.
const {DatabaseSync}=require('node:sqlite');
const {createHash}=require('node:crypto');
const {validateBackupFile}=require('./recovery.cjs');
const {inspectMigrationContract,TABLE_KEYS}=require('./cloud-migration-contract.cjs');
const {PERSONAL_TABLES}=require('./cloud-data-routing.cjs');

const FORMAT='mf-personal-snapshot-v1';
const MAX_TOTAL_ROWS=100000;
const MAX_JSON_BYTES=32*1024*1024;
const SYSTEM_ONLY_KEYS=new Set(['api_key','apiKey','client_secret','clientSecret','access_token','accessToken','password','api-key']);
const EMPTY=Object.freeze([]);

function assertSafeValue(value,table,column){
  if(value===null)return null;
  if(typeof value==='string'){
    if(Buffer.byteLength(value,'utf8')>256000)
      throw new Error('Campo SQLite ultrapassa tamanho permitido: '+table+'.'+column);
    return value;
  }
  if(typeof value==='number'&&Number.isSafeInteger(value))return value;
  // No blobs, floats, undefined, functions, or other types can be forwarded.
  throw new Error('Tipo SQLite incompatível com importação: '+table+'.'+column);
}

function digestRows(rows){
  const h=createHash('sha256');
  for(const row of rows)h.update(JSON.stringify(row)+'\n','utf8');
  return h.digest('hex');
}

function createPersonalSnapshotFromBackup(backupPath,options={}){
  if(typeof backupPath!=='string'||!backupPath||options===null||typeof options!=='object')
    throw new TypeError('Backup local obrigatório.');
  validateBackupFile(backupPath);
  const db=new DatabaseSync(backupPath,{readOnly:true});
  try{
    const contract=inspectMigrationContract(db);
    if(!contract.structuralContractOK||!contract.integrityOK||
      contract.foreignKeyViolationCount!==0)
      throw new Error('Backup incompatível com a migração; nenhum dado foi enviado.');

    const tables={};
    const summary={};
    let totalRows=0,totalBytes=0;
    for(const table of PERSONAL_TABLES){
      const columns=db.prepare('PRAGMA table_info("'+table+'")').all().map(c=>c.name);
      if(!columns.length||columns.length>50||columns.some(c=>!/^[a-z_][a-z0-9_]{0,63}$/.test(c)))
        throw new Error('Colunas incompatíveis: '+table);
      if(columns.some(c=>SYSTEM_ONLY_KEYS.has(c)))
        throw new Error('Campo de credencial não pode integrar snapshot: '+table);
      const keys=TABLE_KEYS[table];
      if(keys.some(key=>!columns.includes(key)))
        throw new Error('Chave primária ausente no backup: '+table);
      const order=keys.map(k=>'"'+k+'"').join(',');
      const rows=[];
      // Iterator avoids loading all input rows at once and enforces a hard cap.
      for(const raw of db.prepare('SELECT * FROM "'+table+'" ORDER BY '+order).iterate()){
        const record=Object.create(null);
        for(const c of columns){
          if(!Object.hasOwn(raw,c))throw new Error('Coluna não retornada pelo SQLite: '+table+'.'+c);
          record[c]=assertSafeValue(raw[c],table,c);
        }
        const size=Buffer.byteLength(JSON.stringify(record),'utf8');
        totalBytes+=size;
        totalRows++;
        if(totalRows>MAX_TOTAL_ROWS||totalBytes>MAX_JSON_BYTES)
          throw new Error('Snapshot grande demais. Nada foi transmitido.');
        rows.push(record);
      }
      tables[table]={columns,rows};
      summary[table]={rows:rows.length,digest:digestRows(rows)};
    }
    const digest=createHash('sha256');
    for(const table of PERSONAL_TABLES){
      const stat=summary[table];
      digest.update(table+':'+stat.rows+':'+stat.digest+'\n','utf8');
    }
    return {
      format:FORMAT,
      schemaVersion:6,
      tables,
      manifest:{
        tables:PERSONAL_TABLES.length,
        rows:totalRows,
        digest:digest.digest('hex'),
        byTable:summary,
        bytes:totalBytes,
        // A package in local main-process memory is NOT evidence of upload.
        cloudTransferred:false,
        bankHistoryMigrated:false,
        cutoverReady:false
      }
    };
  }finally{db.close();}
}

function personalSnapshotSummary(snapshot){
  if(snapshot?.format!==FORMAT||snapshot?.schemaVersion!==6||
    snapshot?.manifest?.tables!==PERSONAL_TABLES.length)
    throw new Error('Snapshot pessoal incompatível.');
  // Only summary may cross into the UI; never include rows, identifiers,
  // item names, amounts, notes or contact details.
  return {personalTables:snapshot.manifest.tables,
    personalRecords:snapshot.manifest.rows,
    packageVerified:true,
    sentToCloud:false,
    financialSyncEnabled:false};
}

module.exports={FORMAT,MAX_TOTAL_ROWS,MAX_JSON_BYTES,createPersonalSnapshotFromBackup,personalSnapshotSummary};
