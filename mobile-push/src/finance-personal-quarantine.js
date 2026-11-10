// Financial-data quarantine for a future authenticated one-click migration.
//
// NOT EXPOSED AS AN HTTP ENDPOINT. A trusted server caller will eventually
// validate a personal snapshot using Cloudflare Access and user-bound device
// pairing. Here, validation and SQL writes can be exercised with fake data.
//
// Quarantine is never used as a live financial data source. Importing does
// not enable financial sync and cannot update any sync_documents or mf_stage_*.
import {validatePersonalMigrationPackage,PERSONAL_COLUMNS} from './finance-personal-validate.js';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAX_ATOMIC_ROWS=2500;

export function ensureImportQuarantine(storage){
  const sql=storage.sql;
  sql.exec("CREATE TABLE IF NOT EXISTS mf_import_manifest (import_id TEXT PRIMARY KEY, digest TEXT NOT NULL, record_count INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('quarantine','aborted')), created_at TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS mf_import_records (import_id TEXT NOT NULL, table_name TEXT NOT NULL, record_key TEXT NOT NULL, row_json TEXT NOT NULL, PRIMARY KEY(import_id,table_name,record_key))");
}

const PK=Object.freeze({
  profiles:['profile'],transactions:['profile','id'],budgets:['profile','category'],
  financial_settings:['profile','name'],categories:['name'],category_rules:['id'],
  bank_category_overrides:['account_id','external_id'],
  bank_transaction_notes:['account_id','external_id'],
  bank_transaction_splits:['account_id','external_id','position'],
  bank_manual_links:['account_id','external_id'],merchant_aliases:['id'],
  bank_duplicate_dismissals:['pair_key'],planned_items:['id'],
  planned_bank_links:['account_id','external_id'],
  planned_rejected_matches:['item_id','account_id','external_id'],
  planned_audit:['id'],bank_custom_titles:['account_id','external_id']
});

function getManifest(storage,id){
  return storage.sql.exec('SELECT import_id,digest,record_count,state FROM mf_import_manifest WHERE import_id=?',id).toArray()[0]||null;
}

export async function stagePersonalSnapshot(storage,importId,snapshot){
  if(!UUID.test(importId))throw new Error('Identificador da migração inválido.');
  const validated=await validatePersonalMigrationPackage(snapshot);
  if(!validated.valid||validated.personalRecords>MAX_ATOMIC_ROWS)
    throw new Error('O pacote requer importação paginada; não foi armazenado.');
  // Validate WHOLE package before writing a single row. Any fault in the
  // transaction must rollback all inserts, including the manifest.
  ensureImportQuarantine(storage);
  const digest=snapshot.manifest.digest;
  return storage.transactionSync(()=>{
    const current=getManifest(storage,importId);
    if(current){
      if(current.digest!==digest||current.record_count!==validated.personalRecords||
        current.state!=='quarantine')
        throw new Error('O identificador pertence a outro pacote. Nenhum dado alterado.');
      const found=storage.sql.exec(
        'SELECT COUNT(*) AS n FROM mf_import_records WHERE import_id=?',importId
      ).one().n;
      if(found!==validated.personalRecords)
        throw new Error('Pacote anterior incompleto. Recuse repetir e investigue.');
      return {ok:true,replayed:true,stage:'quarantine',
        tables:validated.personalTables,rows:found,
        cutoverEnabled:false,financialSyncEnabled:false};
    }
    const collision=storage.sql.exec(
      "SELECT import_id FROM mf_import_manifest WHERE state='quarantine' LIMIT 1"
    ).toArray();
    if(collision.length)throw new Error('Já existe uma migração em quarentena. Não sobrepor.');
    const now=new Date().toISOString();
    storage.sql.exec(
      "INSERT INTO mf_import_manifest (import_id,digest,record_count,state,created_at) VALUES (?,?,?,'quarantine',?)",
      importId,digest,validated.personalRecords,now
    );
    for(const [table,block] of Object.entries(snapshot.tables)){
      if(!Object.hasOwn(PERSONAL_COLUMNS,table))throw new Error('Tabela de importação desconhecida.');
      const pk=PK[table];
      for(const row of block.rows){
        const key=JSON.stringify(pk.map(k=>row[k]));
        storage.sql.exec(
          'INSERT INTO mf_import_records (import_id,table_name,record_key,row_json) VALUES (?,?,?,?)',
          importId,table,key,JSON.stringify(row)
        );
      }
    }
    const count=storage.sql.exec(
      'SELECT COUNT(*) AS n FROM mf_import_records WHERE import_id=?',importId
    ).one().n;
    if(count!==validated.personalRecords)
      throw new Error('A contagem de quarentena divergiu. Transação revertida.');
    return {ok:true,replayed:false,stage:'quarantine',
      tables:validated.personalTables,rows:count,
      cutoverEnabled:false,financialSyncEnabled:false};
  });
}

export function discardPersonalQuarantine(storage,importId){
  if(!UUID.test(importId))throw new Error('Identificador inválido.');
  ensureImportQuarantine(storage);
  return storage.transactionSync(()=>{
    const current=getManifest(storage,importId);
    if(!current)return {ok:true,discarded:false};
    storage.sql.exec('DELETE FROM mf_import_records WHERE import_id=?',importId);
    storage.sql.exec("UPDATE mf_import_manifest SET state='aborted' WHERE import_id=?",importId);
    return {ok:true,discarded:true};
  });
}
