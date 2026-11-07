'use strict';

// The ONE-CLICK preparation stage for cloud migration.
//
// This module keeps the installed desktop's SQLite as the source of truth.
// It takes a consistent native SQLite backup, validates every v0.9.4 table
// and calculates a deterministic reconciliation manifest. It never touches
// the Cloudflare API or reads/transports Pluggy credentials.
//
// The cloud upload/cutover is deliberately blocked until authenticated
// pairing, entity validators, lossless import and reconciliation are ready.
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {inspectLocalBackupManifest}=require('./cloud-migration-manifest.cjs');

const STAGE='prepared_locally';
const FILE_PATTERN=/^antes-da-sincronizacao-\d{4}-\d{2}-\d{2}-[0-9a-f-]{36}\.sqlite$/;

function migrationLocalStatus(folder){
  if(typeof folder!=='string')throw new TypeError('Pasta de backups inválida.');
  let filenames=[];
  try{filenames=fs.readdirSync(folder).filter(name=>FILE_PATTERN.test(name));}
  catch(e){if(e?.code!=='ENOENT')throw e;}
  const found=filenames.map(name=>{
    const file=path.join(folder,name);
    const info=fs.statSync(file);
    return info.isFile()?{file,createdAt:info.mtime.toISOString()}:null;
  }).filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  // A present backup is only a history marker. No "synced" claim is made.
  return {stage:found.length?STAGE:'not_started',cloudConnected:false,
    financialSyncEnabled:false,backupPresent:found.length>0,
    latestBackupAt:found[0]?.createdAt||null};
}

async function prepareCloudMigration({finance,backupFolder,now=new Date(),id=randomUUID()}){
  if(!finance?.backupTo||!finance?.db||typeof backupFolder!=='string')
    throw new TypeError('Banco local indisponível para preparar a sincronização.');
  if(!(now instanceof Date)||!Number.isFinite(now.valueOf())||
     !/^[0-9a-f-]{36}$/i.test(id))throw new Error('Identificador do backup inválido.');
  fs.mkdirSync(backupFolder,{recursive:true,mode:0o700});
  const filename='antes-da-sincronizacao-'+now.toISOString().slice(0,10)+'-'+id.toLowerCase()+'.sqlite';
  const file=path.join(backupFolder,filename);
  if(fs.existsSync(file))throw new Error('Backup de sincronização já existe.');
  // FinanceDB.backupTo() uses node:sqlite backup API, safe with WAL enabled.
  await finance.backupTo(file);
  let verified;
  try{verified=inspectLocalBackupManifest(file);}
  catch{
    // Preserve any successfully written backup for disaster recovery; never
    // try to upload or switch cloud source of truth after a failed check.
    throw new Error('Cópia salva, mas não passou na conferência. Sincronização não ativada.');
  }
  if(!verified.ok||verified.tableCount!==22||!verified.integrityOK||
     verified.foreignKeyViolationCount!==0||verified.migrationApproved!==false||
     verified.rowsUploaded!==0){
    throw new Error('A estrutura local não passou na conferência de migração. Nada foi enviado.');
  }
  // Do not return paths, record digests, rows, amounts, or any secrets to UI.
  return {stage:STAGE,backupVerified:true,backupPresent:true,cloudConnected:false,
    financialSyncEnabled:false,recordsSent:0,
    checkedTables:verified.tableCount,checkedRecords:verified.totalRows,
    backupCreatedAt:now.toISOString(),
    next:'secure_cloud_pairing_not_yet_available'};
}
module.exports={STAGE,FILE_PATTERN,migrationLocalStatus,prepareCloudMigration};
