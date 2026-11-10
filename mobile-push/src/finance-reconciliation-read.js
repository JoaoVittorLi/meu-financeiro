// MF2-01/B1: internal Cloudflare Durable Object SQLite SELECT-only adapter.
// Never call ensureBankStaging / ensurePersonalEdits here: those CREATE tables.
// Never expose this raw snapshot as an HTTP or PWA response. Protected digest
// endpoints (E1) remain the only current live cross-device API.
export function readCloudReconciliationSnapshot(storage){
  const sql=storage?.sql;
  if(typeof sql?.exec!=='function')throw new TypeError('Cloud SQL indisponível.');
  const select=(query,...args)=>{
    if(!/^\s*SELECT\b/i.test(query))throw new Error('Somente consulta read-only é permitida');
    return sql.exec(query,...args).toArray();
  };
  const exists=table=>select("SELECT name FROM sqlite_master WHERE type='table' AND name=?",table).length>0;
  for(const table of ['mf_bank_staging_accounts','mf_bank_staging_transactions']){
    if(!exists(table))throw new Error('Staging bancário não disponível');
  }
  const accounts=select('SELECT account_id,item_id,currency,balance_cents,updated_at FROM mf_bank_staging_accounts');
  const sidecars=new Map();
  if(exists('mf_bank_staging_categories')){
    for(const row of select('SELECT account_id,external_id,category_original FROM mf_bank_staging_categories')){
      sidecars.set(JSON.stringify([row.account_id,row.external_id]),row.category_original);
    }
  }
  const transactions=select('SELECT account_id,external_id,date,description,amount_cents,status,source_updated_at FROM mf_bank_staging_transactions').map(row=>{
    const k=JSON.stringify([row.account_id,row.external_id]),known=sidecars.has(k);
    return {account_id:row.account_id,external_id:row.external_id,
      date:row.date,description:row.description,amount_cents:row.amount_cents,
      status:row.status,updated_at:row.source_updated_at,
      category:known?(sidecars.get(k)||'Outros'):null,categoryCovered:known};
  });
  let manualTransactions=[],overlays=[],overlayCoverage='unavailable';
  const overlayTables=['bank_category_overrides','bank_transaction_notes',
    'bank_manual_links','bank_custom_titles','bank_transaction_splits'];
  if(exists('mf_transfer_session')&&exists('mf_transfer_rows')){
    const latest=select("SELECT import_id FROM mf_transfer_session WHERE state='verified' ORDER BY created_at DESC LIMIT 1")[0];
    if(latest){
      const raw={};
      for(const table of [...overlayTables,'transactions']){
        raw[table]=select('SELECT row_json FROM mf_transfer_rows WHERE import_id=? AND table_name=?',
          latest.import_id,table).map(x=>JSON.parse(x.row_json));
      }
      manualTransactions=raw.transactions.filter(r=>r.profile==='real');
      const byKey=new Map();
      const set=(r,field,value)=>{
        const k=JSON.stringify([r.account_id,r.external_id]);
        const entry=byKey.get(k)||{account_id:r.account_id,external_id:r.external_id};
        entry[field]=value;byKey.set(k,entry);
      };
      for(const r of raw.bank_category_overrides)set(r,'category',r.category);
      for(const r of raw.bank_transaction_notes)set(r,'nature',r.nature);
      for(const r of raw.bank_manual_links)set(r,'manual_id',r.manual_id);
      for(const r of raw.bank_custom_titles)set(r,'title',r.title);
      for(const r of raw.bank_transaction_splits){
        const k=JSON.stringify([r.account_id,r.external_id]);
        const entry=byKey.get(k)||{account_id:r.account_id,external_id:r.external_id};
        if(!entry.splits)entry.splits=[];
        entry.splits.push({position:r.position,category:r.category,amount_cents:r.amount_cents});
        byKey.set(k,entry);
      }
      // The only currently supported cloud revisioned bank personal edit:
      // bank_custom_titles. Do not infer other tables have live edit parity.
      if(exists('mf_personal_edits')){
        for(const edit of select("SELECT record_key,revision,patch_json FROM mf_personal_edits WHERE table_name='bank_custom_titles'")){
          const key=JSON.parse(edit.record_key);
          if(!Array.isArray(key)||key.length!==2)throw new Error('Identidade cloud incompatível');
          const patch=JSON.parse(edit.patch_json);
          if(typeof patch.title!=='string')throw new Error('Edição cloud incompatível');
          set({account_id:key[0],external_id:key[1]},'title',patch.title);
          set({account_id:key[0],external_id:key[1]},'revision',edit.revision);
        }
      }
      overlays=[...byKey.values()];
      overlayCoverage='verified_import';
    }
  }
  let lastFetched=null;
  if(exists('mf_bank_sync_state')){
    const state=select('SELECT last_count FROM mf_bank_sync_state WHERE id=1')[0];
    if(Number.isSafeInteger(state?.last_count)&&state.last_count>=0)lastFetched=state.last_count;
  }
  return {accounts,transactions,manualTransactions,overlays,
    metadata:{snapshotKind:'cloud_staging',historyComplete:null,
      overlayCoverage,lastFetched}};
}
