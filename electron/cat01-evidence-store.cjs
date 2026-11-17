'use strict';
// CAT-01 SQLite sidecar: no modification of source bank_transactions.
const {normalizePluggyEvidence,VERSION}=require('./cat01-pluggy-evidence.cjs');
const SCHEMA_KEY='cat01_metadata_schema';
const MIGRATION='1';
const COLUMNS=['account_id','external_id','account_type','status','transaction_type','description','description_raw',
 'operation_type','payment_method','receiver_name','receiver_cnpj','mcc','merchant_name',
 'merchant_business_name','merchant_cnpj','merchant_cnae','provider_category','provider_category_id',
 'provider_updated_at','observed_at','fingerprint','presence_json'];
const KEYS=['accountId','externalId','accountType','status','transactionType','description','descriptionRaw',
 'operationType','paymentMethod','receiverName','receiverCnpj','mcc','merchantName','merchantBusinessName',
 'merchantCnpj','merchantCnae','providerCategory','providerCategoryId',
 'providerUpdatedAt','observedAt','fingerprint','presence'];
function migrateCat01(db){
 if(!db||typeof db.exec!=='function'||typeof db.prepare!=='function')throw Error('CAT-01: SQLite obrigatório');
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec([
   'CREATE TABLE IF NOT EXISTS cat01_metadata(',
   'account_id TEXT NOT NULL, external_id TEXT NOT NULL,',
   "account_type TEXT NOT NULL CHECK(account_type IN ('BANK','CREDIT')),",
   "status TEXT NOT NULL CHECK(status IN ('POSTED','PENDING','UNKNOWN')),",
   'transaction_type TEXT, description TEXT,description_raw TEXT,operation_type TEXT,payment_method TEXT,',
   'receiver_name TEXT,receiver_cnpj TEXT,mcc TEXT,merchant_name TEXT,merchant_business_name TEXT,',
   'merchant_cnpj TEXT,merchant_cnae TEXT,provider_category TEXT,provider_category_id TEXT,',
   'provider_updated_at TEXT,observed_at TEXT NOT NULL,fingerprint TEXT NOT NULL,',
   'presence_json TEXT NOT NULL, PRIMARY KEY(account_id,external_id),',
   'FOREIGN KEY(account_id,external_id) REFERENCES bank_transactions(account_id,external_id) ON DELETE CASCADE);',
   'CREATE INDEX IF NOT EXISTS idx_cat01_mcc ON cat01_metadata(mcc);',
   'CREATE INDEX IF NOT EXISTS idx_cat01_merchant_cnpj ON cat01_metadata(merchant_cnpj);',
   'CREATE INDEX IF NOT EXISTS idx_cat01_account_type ON cat01_metadata(account_type,account_id);'
  ].join('\n'));
  const has=db.prepare('SELECT value FROM app_meta WHERE key=?').get(SCHEMA_KEY);
  if(has&&has.value!==MIGRATION)throw Error('CAT-01: versão desconhecida; preservar dados');
  db.prepare('INSERT OR IGNORE INTO app_meta(key,value) VALUES(?,?)').run(SCHEMA_KEY,MIGRATION);
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 return {schema:VERSION,migration:MIGRATION};
}
function revertEmptyCat01(db){
 if(db.prepare('SELECT COUNT(*) AS n FROM cat01_metadata').get().n!==0)
  throw Error('CAT-01: migração com dados exige restauração de backup SQLite');
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec('DROP TABLE IF EXISTS cat01_metadata');
  db.prepare('DELETE FROM app_meta WHERE key=?').run(SCHEMA_KEY);
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 return {reverted:true};
}
const INSERT='INSERT INTO cat01_metadata('+COLUMNS.join(',')+') VALUES('+COLUMNS.map(()=>'?').join(',')+')'+
 ' ON CONFLICT(account_id,external_id) DO UPDATE SET '+COLUMNS.slice(2).map(k=>k+'=excluded.'+k).join(',');
function persistEvidenceBatch(db,entries,{withinTransaction=false,observedAt=new Date().toISOString()}={}){
 if(!Array.isArray(entries)||entries.length>40000)throw Error('CAT-01: lote de evidências inválido');
 const clean=entries.map(x=>normalizePluggyEvidence(x.transaction,{
  accountId:x.accountId,accountType:x.accountType||'BANK',observedAt
 }));
 const uniq=new Set();
 for(const e of clean){
  const key=JSON.stringify([e.accountId,e.externalId]);
  if(uniq.has(key))throw Error('CAT-01: ID repetido no lote');
  uniq.add(key);
 }
 if(!withinTransaction)db.exec('BEGIN IMMEDIATE');
 try{
  const stmt=db.prepare(INSERT),old=db.prepare('SELECT fingerprint FROM cat01_metadata WHERE account_id=? AND external_id=?');
  let stored=0,unchanged=0;
  for(const e of clean){
   if(old.get(e.accountId,e.externalId)?.fingerprint===e.fingerprint){unchanged++;continue;}
   stmt.run(...KEYS.map(k=>k==='presence'?JSON.stringify(e.presence):e[k]));stored++;
  }
  if(!withinTransaction)db.exec('COMMIT');
  return {contract:VERSION,received:clean.length,stored,unchanged};
 }catch(e){if(!withinTransaction)db.exec('ROLLBACK');throw e;}
}
function evidenceFor(db,accountId,externalId){
 if(typeof accountId!=='string'||typeof externalId!=='string')throw Error('CAT-01: chave inválida');
 const row=db.prepare('SELECT * FROM cat01_metadata WHERE account_id=? AND external_id=?').get(accountId,externalId);
 if(!row)return null;
 return {version:VERSION,...Object.fromEntries(KEYS.map((key,i)=>[key,key==='presence'?JSON.parse(row.presence_json):row[COLUMNS[i]]]))};
}
function coverageDiagnostic(db){
 const sql=[
  'SELECT a.item_id AS itemId,a.account_id AS accountId,i.institution,a.subtype,m.account_type AS accountType,COUNT(*) AS count,',
  'SUM(CASE WHEN m.operation_type IS NOT NULL THEN 1 ELSE 0 END) AS hasOperation,',
  'SUM(CASE WHEN m.mcc IS NOT NULL THEN 1 ELSE 0 END) AS hasMcc,',
  'SUM(CASE WHEN m.receiver_cnpj IS NOT NULL THEN 1 ELSE 0 END) AS hasReceiverCnpj,',
  'SUM(CASE WHEN m.merchant_name IS NOT NULL THEN 1 ELSE 0 END) AS hasMerchant,',
  'SUM(CASE WHEN m.provider_category IS NOT NULL THEN 1 ELSE 0 END) AS hasProviderCategory',
  'FROM cat01_metadata m JOIN bank_accounts a ON a.account_id=m.account_id',
  'JOIN bank_items i ON i.item_id=a.item_id',
  'GROUP BY a.item_id,a.account_id,i.institution,a.subtype,m.account_type',
  'ORDER BY i.institution,a.account_id'
 ].join(' ');
 return db.prepare(sql).all();
}
module.exports={SCHEMA_KEY,MIGRATION,COLUMNS,migrateCat01,revertEmptyCat01,
 persistEvidenceBatch,evidenceFor,coverageDiagnostic};
