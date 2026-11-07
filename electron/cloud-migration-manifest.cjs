'use strict';

// OFFLINE, READ-ONLY preflight of a desktop-created SQLite backup.
// Never imports data into the active desktop database or uploads any records.
// This manifest is NOT a migration approval. Encryption and server-side
// import validation still need implementation.
const {DatabaseSync}=require('node:sqlite');
const {createHash}=require('node:crypto');
const {validateBackupFile}=require('./recovery.cjs');
const {inspectMigrationContract,TABLE_KEYS}=require('./cloud-migration-contract.cjs');

const MONETARY_FIELDS=Object.freeze({
  transactions:['amount_cents'],
  budgets:['amount_cents'],
  financial_settings:['value_cents'],
  bank_accounts:['balance_cents'],
  bank_transactions:['amount_cents'],
  bank_transaction_splits:['amount_cents'],
  planned_items:['amount_cents']
});

function canonicalCell(cell){
  if(cell===null)return null;
  if(typeof cell==='string'||typeof cell==='boolean')return cell;
  if(typeof cell==='bigint')return {integer:cell.toString()};
  if(typeof cell==='number'){
    if(!Number.isSafeInteger(cell))throw new Error('Valor numérico do backup fora do intervalo seguro.');
    return cell;
  }
  if(Buffer.isBuffer(cell)||cell instanceof Uint8Array)return {binary:Buffer.from(cell).toString('base64')};
  throw new Error('Tipo inesperado na cópia. Nenhum dado foi importado.');
}

function inspectLocalBackupManifest(filename){
  // Validate full SQLite format/integrity before opening in read-only mode.
  validateBackupFile(filename);
  const db=new DatabaseSync(filename,{readOnly:true});
  try{
    const schema=inspectMigrationContract(db);
    if(!schema.structuralContractOK)
      return {ok:false,kind:'schema_preflight',tableCount:schema.tableCount,
        missingTables:schema.missingTables,missingColumns:schema.missingColumns,
        wrongPrimaryKeys:schema.wrongPrimaryKeys,
        integrityOK:schema.integrityOK,
        foreignKeyViolationCount:schema.foreignKeyViolationCount,
        rowsUploaded:0,migrationApproved:false};

    const tableReports={};
    const root=createHash('sha256');
    let totalRows=0;
    for(const [table,keys] of Object.entries(TABLE_KEYS)){
      // Table and key names are exclusively compile-time constants.
      const order=keys.map(k=>'"'+k+'"').join(',');
      const statement=db.prepare('SELECT * FROM "'+table+'" ORDER BY '+order);
      const cols=db.prepare('PRAGMA table_info("'+table+'")').all().map(x=>x.name);
      const digest=createHash('sha256');
      const totals=Object.fromEntries((MONETARY_FIELDS[table]||[]).map(k=>[k,0]));
      let count=0;
      for(const row of statement.iterate()){
        const values=cols.map(col=>canonicalCell(row[col]));
        // Stable row digest allows reconciliation without disclosing a row.
        digest.update(JSON.stringify(values)+'\n','utf8');
        for(const key of Object.keys(totals)){
          const n=row[key];
          if(n!==null){
            if(!Number.isSafeInteger(n))throw new Error('Valor monetário inválido no backup.');
            const sum=totals[key]+n;
            if(!Number.isSafeInteger(sum))throw new Error('Soma monetária fora do intervalo seguro.');
            totals[key]=sum;
          }
        }
        count++;
        if(!Number.isSafeInteger(count))throw new Error('Número excessivo de registros.');
      }
      const sha256=digest.digest('hex');
      const report={rows:count,sha256};
      if(Object.keys(totals).length)report.sumCents=totals;
      tableReports[table]=report;
      root.update(table+':'+count+':'+sha256+'\n','utf8');
      totalRows+=count;
    }
    return {ok:true,kind:'sqlite_readonly_manifest',schemaVersion:6,
      tableCount:Object.keys(TABLE_KEYS).length,totalRows,
      integrityOK:schema.integrityOK,
      foreignKeyViolationCount:schema.foreignKeyViolationCount,
      tables:tableReports,manifestSha256:root.digest('hex'),
      rowsUploaded:0,containsRawRecords:false,migrationApproved:false};
  }finally{db.close();}
}

module.exports={inspectLocalBackupManifest};
