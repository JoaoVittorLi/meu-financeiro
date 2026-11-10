'use strict';
// Privileged Windows SQLite adapter for MF2-01/B1. CALLER supplies an already-open
// FinanceDB; this module never opens, initializes or writes a database.
// Never publish returned snapshots through renderer IPC or network.
function readWindowsReconciliationSnapshot(finance){
  const db=finance?.db||finance;
  if(typeof db?.prepare!=='function')throw new TypeError('SQLite Windows indisponível.');
  const rows=sql=>db.prepare(sql).all();
  const accounts=rows('SELECT account_id,item_id,currency,balance_cents,updated_at FROM bank_accounts');
  const transactions=rows('SELECT account_id,external_id,date,description,amount_cents,status,category,updated_at FROM bank_transactions')
    .map(r=>({...r,categoryCovered:true}));
  // Demo records never mix with the real ledger or bank records.
  const manualTransactions=rows("SELECT profile,id,date,description,kind,amount_cents,category,origin FROM transactions WHERE profile='real'");
  const byKey=new Map();
  const key=(a,e)=>JSON.stringify([a,e]);
  const use=(r,field,value)=>{
    const k=key(r.account_id,r.external_id),data=byKey.get(k)||{
      account_id:r.account_id,external_id:r.external_id
    };
    data[field]=value;byKey.set(k,data);
  };
  for(const r of rows('SELECT account_id,external_id,category FROM bank_category_overrides'))use(r,'category',r.category);
  for(const r of rows('SELECT account_id,external_id,nature,reviewed_at FROM bank_transaction_notes')){
    use(r,'nature',r.nature);
    // reviewed_at is context, not a cross-platform revision.
  }
  for(const r of rows('SELECT account_id,external_id,manual_id FROM bank_manual_links'))use(r,'manual_id',r.manual_id);
  for(const r of rows('SELECT account_id,external_id,title FROM bank_custom_titles'))use(r,'title',r.title);
  for(const r of rows('SELECT account_id,external_id,position,category,amount_cents FROM bank_transaction_splits ORDER BY account_id,external_id,position')){
    const k=key(r.account_id,r.external_id);
    const entry=byKey.get(k)||{account_id:r.account_id,external_id:r.external_id};
    if(!entry.splits)entry.splits=[];
    entry.splits.push({position:r.position,category:r.category,amount_cents:r.amount_cents});
    byKey.set(k,entry);
  }
  return {accounts,transactions,manualTransactions,overlays:[...byKey.values()],
    metadata:{snapshotKind:'windows_sqlite',historyComplete:null,
      overlayCoverage:'complete',lastFetched:null}};
}
module.exports={readWindowsReconciliationSnapshot};
