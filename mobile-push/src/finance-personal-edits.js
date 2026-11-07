// Owner-only, revisioned personal-edit overlay over a VERIFIED import.
// The imported 17-table snapshot is immutable and remains available to
// compare/roll back. No bank original, link, payment or balance is modified.
const SPECS=Object.freeze({
  planned_items:{pk:['id'],fields:['title','notes','due_date','category','certainty']},
  budgets:{pk:['profile','category'],fields:['amount_cents']},
  categories:{pk:['name'],fields:['color','emoji']},
  bank_custom_titles:{pk:['account_id','external_id'],fields:['title']}
});
const NAME=/^[\p{L}\p{N} _.,/()&+\-]{1,140}$/u;
const UUID=/^[A-Za-z0-9_-]{12,100}$/;
function fail(s){throw new Error('Alteração recusada: '+s);}
function source(storage){
 const tables=storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='mf_transfer_session'").toArray();
 if(!tables.length)fail('migração pessoal ainda não verificada.');
 const current=storage.sql.exec(
  "SELECT import_id FROM mf_transfer_session WHERE state='verified' ORDER BY created_at DESC LIMIT 1"
 ).toArray()[0];
 if(!current)fail('migração pessoal ainda não verificada.');
 return current.import_id;
}
function spec(table){if(!Object.hasOwn(SPECS,table))fail('tipo de alteração não autorizado.');return SPECS[table];}
function recordKey(table,row){
 const fields=spec(table).pk;
 return JSON.stringify(fields.map(k=>{
  const v=row?.[k];
  if(typeof v!=='string'||!v||v.length>180)fail('identidade inválida.');
  return v;
 }));
}
function baseRow(storage,importId,table,key){
 const rows=storage.sql.exec(
  'SELECT row_json FROM mf_transfer_rows WHERE import_id=? AND table_name=?',
  importId,table
 ).toArray();
 const record=rows.map(x=>JSON.parse(x.row_json)).find(x=>recordKey(table,x)===key);
 if(!record)fail('registro não encontrado na importação verificada.');
 return record;
}
function validatePatch(storage,importId,table,patch){
 const fields=spec(table).fields;
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length||
   Object.keys(patch).length>fields.length||Object.keys(patch).some(k=>!fields.includes(k)))
   fail('campos não permitidos.');
 for(const [k,v] of Object.entries(patch)){
   if(k==='amount_cents'){
     if(!Number.isSafeInteger(v)||v<0||v>100000000000)fail('orçamento inválido.');
   }else if(k==='color'){
     if(typeof v!=='string'||!/^#[0-9a-fA-F]{6}$/.test(v))fail('cor inválida.');
   }else if(k==='emoji'){
     if(typeof v!=='string'||v.length<1||v.length>12)fail('ícone inválido.');
   }else if(k==='due_date'){
     if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||
       Number.isNaN(Date.parse(v+'T00:00:00Z')))fail('data inválida.');
   }else if(k==='certainty'){
     if(!['confirmed','estimated'].includes(v))fail('certeza inválida.');
   }else if(k==='category'){
     if(typeof v!=='string'||!NAME.test(v))fail('categoria inválida.');
     const names=storage.sql.exec(
       'SELECT row_json FROM mf_transfer_rows WHERE import_id=? AND table_name=?',
       importId,'categories'
     ).toArray().map(x=>JSON.parse(x.row_json).name);
     if(!names.includes(v))fail('categoria não cadastrada.');
   }else if(typeof v!=='string'||(k!=='notes'&&v.length<1)||
     v.length>(k==='notes'?600:140))fail('texto inválido.');
 }
 return JSON.stringify(Object.fromEntries(Object.entries(patch).sort(([a],[b])=>a.localeCompare(b))));
}
export function ensurePersonalEdits(storage){
 const sql=storage.sql;
 sql.exec('CREATE TABLE IF NOT EXISTS mf_personal_edits(table_name TEXT NOT NULL,record_key TEXT NOT NULL,revision INTEGER NOT NULL,patch_json TEXT NOT NULL,changed_at TEXT NOT NULL,PRIMARY KEY(table_name,record_key))');
 sql.exec('CREATE TABLE IF NOT EXISTS mf_personal_edit_events(seq INTEGER PRIMARY KEY AUTOINCREMENT,table_name TEXT NOT NULL,record_key TEXT NOT NULL,revision INTEGER NOT NULL,patch_json TEXT NOT NULL,changed_at TEXT NOT NULL)');
 sql.exec('CREATE TABLE IF NOT EXISTS mf_personal_edit_mutations(mutation_id TEXT PRIMARY KEY,request_json TEXT NOT NULL,result_json TEXT NOT NULL)');
}
export function applyPersonalEdit(storage,input){
 const importId=source(storage);
 if(!input||typeof input!=='object'||Array.isArray(input)||
    typeof input.mutationId!=='string'||!UUID.test(input.mutationId)||
    !Number.isSafeInteger(input.baseRevision)||input.baseRevision<0)
   fail('operação inválida.');
 const key=recordKey(input.table,input.identity);
 const row=baseRow(storage,importId,input.table,key);
 const payload=validatePatch(storage,importId,input.table,input.patch);
 ensurePersonalEdits(storage);
 const requestJSON=JSON.stringify({table:input.table,key,baseRevision:input.baseRevision,patch:JSON.parse(payload)});
 return storage.transactionSync(()=>{
   const sql=storage.sql;
   const replay=sql.exec('SELECT request_json,result_json FROM mf_personal_edit_mutations WHERE mutation_id=?',
     input.mutationId).toArray()[0];
   if(replay){
     if(replay.request_json!==requestJSON)fail('identificador reutilizado com conteúdo diferente.');
     return {...JSON.parse(replay.result_json),replayed:true};
   }
   const saved=sql.exec('SELECT revision,patch_json FROM mf_personal_edits WHERE table_name=? AND record_key=?',
     input.table,key).toArray()[0];
   const current=saved?.revision||0;
   if(current!==input.baseRevision)return {ok:false,conflict:true,currentRevision:current,
     financialSyncEnabled:false};
   const next=current+1;
   const merged={...(saved?JSON.parse(saved.patch_json):{}),...JSON.parse(payload)};
   const record={...row,...merged};
   // Never permit a patch to override a primary key or settle an item.
   if(recordKey(input.table,record)!==key)fail('identidade foi alterada.');
   const text=JSON.stringify(merged),at=new Date().toISOString();
   sql.exec('INSERT INTO mf_personal_edits(table_name,record_key,revision,patch_json,changed_at) VALUES(?,?,?,?,?) ON CONFLICT(table_name,record_key) DO UPDATE SET revision=excluded.revision,patch_json=excluded.patch_json,changed_at=excluded.changed_at',
      input.table,key,next,text,at);
   sql.exec('INSERT INTO mf_personal_edit_events(table_name,record_key,revision,patch_json,changed_at) VALUES(?,?,?,?,?)',
     input.table,key,next,text,at);
   const seq=sql.exec('SELECT last_insert_rowid() AS id').one().id;
   const result={ok:true,table:input.table,identity:input.identity,
     revision:next,sequence:seq,financialSyncEnabled:false};
   sql.exec('INSERT INTO mf_personal_edit_mutations(mutation_id,request_json,result_json) VALUES(?,?,?)',
     input.mutationId,requestJSON,JSON.stringify(result));
   return result;
 });
}
export function personalEditChanges(storage,{since=0,limit=100}={}){
 source(storage);
 if(!Number.isSafeInteger(since)||since<0||!Number.isSafeInteger(limit)||limit<1||limit>200)
   fail('posição de sincronização inválida.');
 ensurePersonalEdits(storage);
 const rows=storage.sql.exec('SELECT seq,table_name,record_key,revision,patch_json,changed_at FROM mf_personal_edit_events WHERE seq>? ORDER BY seq ASC LIMIT ?',since,limit+1).toArray();
 const selection=rows.slice(0,limit);
 return {ok:true,changes:selection.map(r=>({
   sequence:r.seq,table:r.table_name,identity:Object.fromEntries(
     spec(r.table_name).pk.map((k,i)=>[k,JSON.parse(r.record_key)[i]])),
   revision:r.revision,patch:JSON.parse(r.patch_json),changedAt:r.changed_at
 })),cursor:selection.length?selection.at(-1).seq:since,hasMore:rows.length>limit,
 financialSyncEnabled:false,cloudCutoverAllowed:false};
}
export function mergePersonalOverlays(storage,table,rows){
 if(!Object.hasOwn(SPECS,table)||!rows.length)return rows;
 ensurePersonalEdits(storage);
 const patches=storage.sql.exec('SELECT record_key,revision,patch_json FROM mf_personal_edits WHERE table_name=?',table).toArray();
 const index=new Map(patches.map(p=>[p.record_key,p]));
 return rows.map(row=>{
   const record=index.get(recordKey(table,row));
   return record?{...row,...JSON.parse(record.patch_json),_cloudRevision:record.revision}:
     {...row,_cloudRevision:0};
 });
}
