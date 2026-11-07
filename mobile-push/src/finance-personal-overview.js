// Read-only, owner-authenticated preview of a VERIFIED migration quarantine.
// It never calls Pluggy and does not claim to be the live finance database.
// Safe to expose only behind Cloudflare Access + the private session.
export function readVerifiedPersonalOverview(storage){
  const sql=storage.sql;
  const tables=sql.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='mf_transfer_session'"
  ).toArray();
  if(!tables.length)return {ok:true,stage:'not_imported',
    personalTables:0,personalRecords:0,
    financialSyncEnabled:false,bankDataReady:false};
  const session=sql.exec(
    "SELECT import_id,row_count FROM mf_transfer_session WHERE state='verified' ORDER BY created_at DESC LIMIT 1"
  ).toArray()[0];
  if(!session)return {ok:true,stage:'not_imported',
    personalTables:0,personalRecords:0,
    financialSyncEnabled:false,bankDataReady:false};
  const get=(table,limit)=>sql.exec(
    'SELECT row_json FROM mf_transfer_rows WHERE import_id=? AND table_name=? ORDER BY ordinal LIMIT ?',
    session.import_id,table,limit
  ).toArray().map(({row_json})=>JSON.parse(row_json));
  const categories=get('categories',150).map(x=>({
    name:x.name,color:x.color,emoji:x.emoji,kind:x.kind
  }));
  const budgets=get('budgets',150).filter(x=>x.profile==='real')
    .map(x=>({category:x.category,amountCents:x.amount_cents}));
  const plans=get('planned_items',250).map(x=>({
    title:x.title,kind:x.kind,amountCents:x.amount_cents,
    dueDate:x.due_date,category:x.category,status:x.status,
    certainty:x.certainty
  })).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  // Explicitly exclude original bank rows and account IDs. A plan with an
  // associated account is not marked paid until Pluggy reconciliation.
  const manualCount=sql.exec(
    'SELECT COUNT(*) AS n FROM mf_transfer_rows WHERE import_id=? AND table_name=?',
    session.import_id,'transactions'
  ).one().n;
  return {ok:true,stage:'quarantine_verified',
    personalTables:17,personalRecords:session.row_count,
    categories,budgets,plans,manualCount,
    financialSyncEnabled:false,bankDataReady:false,
    message:'Dados pessoais em conferência. Extratos do Pluggy ainda não conciliados.'};
}
