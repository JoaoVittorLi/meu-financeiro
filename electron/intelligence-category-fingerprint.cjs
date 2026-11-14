'use strict';
// I2-C C1: hash actual SQLite content at proposal creation and confirmation.
// Only a digest lives in memory; raw personal data is not logged, persisted or sent.
const {createHash}=require('node:crypto');
const TABLES=Object.freeze([
 'categories','category_rules','category_rule_constraints',
 'transactions','budgets','financial_settings','planned_items',
 'bank_items','bank_accounts','bank_transactions','bank_transaction_notes',
 'bank_category_overrides','bank_transaction_splits','bank_manual_links',
 'category_review_applied_labels','category_review_decisions',
 'category_review_commands','merchant_aliases','i2c_atomic_receipts'
]);
function fingerprintSQLite(finance,{maxRows=100000,maxBytes=32*1024*1024}={}){
 const sql=finance?.db;
 if(!sql?.prepare||!sql?.exec)throw Error('SQLite indisponível.');
 const digest=createHash('sha256');
 let rows=0,bytes=0,started=false;
 const update=value=>{
  const data=typeof value==='string'?value:JSON.stringify(value);
  bytes+=Buffer.byteLength(data,'utf8');
  if(bytes>maxBytes)throw Error('Snapshot de confirmação excede limite de bytes.');
  digest.update(data);digest.update('\n');
 };
 if(!sql.isTransaction){sql.exec('BEGIN');started=true;}
 try{
  const schema=sql.prepare("SELECT name,type,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') ORDER BY type,name").all();
  update(schema);
  const available=new Set(schema.filter(x=>x.type==='table').map(x=>x.name));
  for(const name of TABLES){
   update(name);
   if(!available.has(name)){update(null);continue;}
   // Fixed allowlist above: no user-provided table names reach SQL.
   const items=sql.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all();
   rows+=items.length;
   if(rows>maxRows)throw Error('Snapshot de confirmação excede limite de registros.');
   for(const row of items)update(row);
  }
  if(started){sql.exec('COMMIT');started=false;}
  return {digest:digest.digest('hex'),rows,bytes};
 }catch(err){if(started)sql.exec('ROLLBACK');throw err;}
}
module.exports={fingerprintSQLite,TABLES};