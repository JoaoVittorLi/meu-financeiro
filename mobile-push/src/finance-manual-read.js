// Read-only projection of the real-profile manual transactions in the
// owner's VERIFIED 17-table Windows snapshot. Never double count with Pluggy.
function selectImport(storage){
  const has=storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='mf_transfer_session'").toArray();
  if(!has.length)return null;
  return storage.sql.exec(
    "SELECT import_id FROM mf_transfer_session WHERE state='verified' ORDER BY created_at DESC LIMIT 1"
  ).toArray()[0]?.import_id||null;
}
function int(value,min,max){
  const num=Number(value);
  if(!Number.isSafeInteger(num)||num<min||num>max)throw new Error('Página inválida.');
  return num;
}
export function readManualTransactionsPage(storage,{offset=0,limit=30}={}){
  const start=int(offset,0,100000),size=int(limit,1,100),importId=selectImport(storage);
  if(!importId)return {ok:true,stage:'not_imported',total:0,
    rows:[],nextOffset:null,financialSyncEnabled:false,cloudCutoverAllowed:false};
  const sql=storage.sql;
  const rows=sql.exec(
    "SELECT row_json FROM mf_transfer_rows WHERE import_id=? AND table_name='transactions'",
    importId
  ).toArray().map(row=>JSON.parse(row.row_json))
    .filter(row=>row.profile==='real')
    .sort((a,b)=>b.date.localeCompare(a.date)||String(a.id).localeCompare(String(b.id)));
  const linked=new Set(sql.exec(
    "SELECT row_json FROM mf_transfer_rows WHERE import_id=? AND table_name='bank_manual_links'",
    importId
  ).toArray().map(x=>JSON.parse(x.row_json).manual_id));
  return {ok:true,stage:'quarantine_verified',total:rows.length,
    nextOffset:start+size<rows.length?start+size:null,
    rows:rows.slice(start,start+size).map(row=>({
      date:row.date,description:row.description,kind:row.kind,
      amountCents:row.amount_cents,category:row.category,
      origin:row.origin,linkedToBank:linked.has(row.id)
    })),
    financialSyncEnabled:false,cloudCutoverAllowed:false};
}
