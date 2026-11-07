import {mergePersonalOverlays} from './finance-personal-edits.js';
// Read-only personal overlays for the verified bank stage.
// Uses the immutable imported 17-table snapshot; never rewrites bank rows.
// There is deliberately NO guessed provider category until that raw field
// has been preserved in Cloudflare and revalidated against the desktop.
function folded(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleUpperCase('pt-BR').replace(/\s+/g,' ').trim();
}
const bankKey=(accountId,externalId)=>JSON.stringify([accountId,externalId]);
function importId(storage){
  const tables=storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='mf_transfer_session'").toArray();
  if(!tables.length)return null;
  return storage.sql.exec(
    "SELECT import_id FROM mf_transfer_session WHERE state='verified' ORDER BY created_at DESC LIMIT 1"
  ).toArray()[0]?.import_id||null;
}
function importedRows(storage,id,table){
  if(!id)return [];
  return storage.sql.exec(
    'SELECT row_json FROM mf_transfer_rows WHERE import_id=? AND table_name=? ORDER BY ordinal',
    id,table
  ).toArray().map(x=>JSON.parse(x.row_json));
}
function indexBank(rows){return new Map(rows.map(x=>[bankKey(x.account_id,x.external_id),x]));}
export function personalizeBankRows(storage,rows){
  const id=importId(storage);
  if(!id)return rows.map(row=>({
    date:row.date,description:row.description,amountCents:row.amount_cents,
    status:row.status,customTitle:'',merchant:'',reviewed:false,nature:'auto',
    category:null,categorySource:'pending_provider_category',
    splitCount:0,splitRequiresReview:false,
    hasManualLink:false,hasPlannedLink:false
  }));
  const titles=indexBank(mergePersonalOverlays(storage,'bank_custom_titles',
    importedRows(storage,id,'bank_custom_titles')));
  const overrides=indexBank(importedRows(storage,id,'bank_category_overrides'));
  const notes=indexBank(importedRows(storage,id,'bank_transaction_notes'));
  const manualLinks=indexBank(importedRows(storage,id,'bank_manual_links'));
  const plannedLinks=indexBank(importedRows(storage,id,'planned_bank_links'));
  const splits=new Map();
  for(const part of importedRows(storage,id,'bank_transaction_splits')){
    const key=bankKey(part.account_id,part.external_id);
    if(!splits.has(key))splits.set(key,[]);
    splits.get(key).push(part);
  }
  const rules=importedRows(storage,id,'category_rules')
    .filter(r=>r.enabled===1&&(r.scope==='bank'||r.scope==='both'))
    .sort((a,b)=>a.priority-b.priority||a.id-b.id);
  const aliases=importedRows(storage,id,'merchant_aliases')
    .sort((a,b)=>b.pattern.length-a.pattern.length||a.id-b.id);
  return rows.map(row=>{
    const key=bankKey(row.account_id,row.external_id);
    const note=notes.get(key),override=overrides.get(key);
    const hay=folded(row.description);
    const rule=rules.find(r=>{
      const needle=folded(r.pattern);
      return needle&&(
        (r.match_mode==='exact'&&hay===needle)||
        (r.match_mode==='starts'&&hay.startsWith(needle))||
        (r.match_mode==='contains'&&hay.includes(needle)));
    });
    const merchant=note?.merchant||
      aliases.find(a=>hay.includes(folded(a.pattern)))?.display_name||'';
    const parts=splits.get(key)||[];
    const splitTotal=parts.reduce((sum,p)=>sum+p.amount_cents,0);
    const outdated=parts.length>0&&splitTotal!==Math.abs(row.amount_cents);
    return {
      date:row.date,description:row.description,amountCents:row.amount_cents,
      status:row.status,customTitle:titles.get(key)?.title||'',
      merchant,reviewed:!!note?.reviewed_at,nature:note?.nature||'auto',
      // The bank category returned by Pluggy is not currently staged. Show
      // only explicit manual override or deterministic local rule.
      category:override?.category||rule?.category||null,
      categorySource:override?'manual':rule?'rule':'pending_provider_category',
      splits:outdated?[]:parts.map(part=>({category:part.category,amountCents:part.amount_cents})),
      splitCount:outdated?0:parts.length,splitRequiresReview:outdated,
      hasManualLink:manualLinks.has(key),hasPlannedLink:plannedLinks.has(key)
    };
  });
}
