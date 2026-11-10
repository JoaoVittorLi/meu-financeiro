// Pure bank snapshot reconciliation. Future server-side Pluggy adapter
// normalizes its results to the SQLite v0.9.4 record structure before calling
// this function. This module does NOT call Pluggy, accept credentials or save
// financial rows. Use only when protected backend import is implemented.
//
// Stable identity prevents double counting when the same bank transaction
// arrives in subsequent syncs. Historical rows are preserved if Pluggy only
// returns a shorter date range.
function valid(row) {
  if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Transação inválida.');
  for(const [name,max] of [['account_id',180],['external_id',240],['date',10],['description',1000],['status',80],['category',100],['updated_at',80]]){
    if(typeof row[name]!=='string'||row[name].length<1||row[name].length>max)throw new Error('Campo bancário inválido.');
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date))throw new Error('Data bancária inválida.');
  if(!Number.isSafeInteger(row.amount_cents))throw new Error('Centavos bancários inválidos.');
  const parsed=Date.parse(row.date+'T00:00:00.000Z');
  if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==row.date)
    throw new Error('Data bancária impossível.');
  return {
    account_id:row.account_id,external_id:row.external_id,
    date:row.date,description:row.description,amount_cents:row.amount_cents,
    status:row.status,category:row.category,updated_at:row.updated_at
  };
}
const bankKey=row=>JSON.stringify([row.account_id,row.external_id]);
function stableJSON(row){return JSON.stringify([
  row.account_id,row.external_id,row.date,row.description,row.amount_cents,
  row.status,row.category,row.updated_at
]);}

export function reconcileBankSnapshot(existingRows,incomingRows){
  if(!Array.isArray(existingRows)||!Array.isArray(incomingRows))
    throw new Error('Extrato bancário inválido.');
  if(existingRows.length>300000||incomingRows.length>300000)
    throw new Error('Extrato bancário grande demais para este lote.');
  const byKey=new Map();
  for(const source of existingRows){
    const row=valid(source),key=bankKey(row);
    if(byKey.has(key))throw new Error('Banco central já contém identificador bancário duplicado.');
    byKey.set(key,row);
  }
  const seen=new Set();
  let inserted=0,updated=0,unchanged=0;
  for(const source of incomingRows){
    const row=valid(source),key=bankKey(row);
    if(seen.has(key))throw new Error('Resposta Pluggy contém identificador duplicado.');
    seen.add(key);
    const current=byKey.get(key);
    if(!current){
      byKey.set(key,row);inserted++;continue;
    }
    // Newest provider snapshot wins for its original bank fields. Manual user
    // overrides, splits, custom titles and planning links live in OTHER tables
    // and MUST NOT be recomputed/cleared by this routine.
    if(stableJSON(current)!==stableJSON(row)){
      byKey.set(key,row);updated++;
    }else unchanged++;
  }
  const historicalPreserved=existingRows.length-(seen.size-inserted);
  const records=[...byKey.values()].sort((a,b)=>
    b.date.localeCompare(a.date)||a.account_id.localeCompare(b.account_id)||
    a.external_id.localeCompare(b.external_id));
  return {
    records,
    summary:{
      inserted,updated,unchanged,
      historicalPreserved,
      total:records.length,
      duplicateInserted:0,
      deleted:0,
      // This is a computational preview, not a cloud write or activation.
      databaseChanged:false
    }
  };
}
