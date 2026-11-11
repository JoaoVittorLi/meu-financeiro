'use strict';

// Windows personal safe-field replication client. Never sends a SQLite file,
// bank original, credentials or unrelated user documents to the cloud.
// Only rows which were already in the verified 17-table migration can be
// modified. New local rows and financial status/amount changes are deliberately
// excluded until complete cloud-first schema support is reviewed.
const {randomUUID}=require('node:crypto');
const {PREVIEW_ORIGIN}=require('./cloud-preview-identity.cjs');

const EDITABLE=Object.freeze({
  planned_items:{pk:['id'],fields:['title','notes','due_date','category','certainty']},
  budgets:{pk:['profile','category'],fields:['amount_cents']},
  categories:{pk:['name'],fields:['color','emoji']},
  bank_custom_titles:{pk:['account_id','external_id'],fields:['title']}
});
function mustBeSqlite(finance){
 if(!finance?.db?.prepare||!finance.db.exec)throw new Error('SQLite indisponível.');
 return finance.db;
}
function tablesExist(sql,table){
 return !!sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
}
function identify(table,row){
 return JSON.stringify(EDITABLE[table].pk.map(name=>row[name]));
}
function recordFields(table,row){
 return Object.fromEntries(EDITABLE[table].fields.map(k=>[k,row[k]]));
}
function ensureMirror(sql){
 sql.exec("CREATE TABLE IF NOT EXISTS mf_personal_client_mirror(table_name TEXT NOT NULL,record_key TEXT NOT NULL,revision INTEGER NOT NULL,fields_json TEXT NOT NULL,PRIMARY KEY(table_name,record_key))");
 sql.exec("CREATE TABLE IF NOT EXISTS mf_personal_client_state(id INTEGER PRIMARY KEY CHECK(id=1),cursor INTEGER NOT NULL DEFAULT 0,seeded INTEGER NOT NULL DEFAULT 0)");
 sql.exec("CREATE TABLE IF NOT EXISTS mf_personal_client_conflicts(table_name TEXT NOT NULL,record_key TEXT NOT NULL,reason TEXT NOT NULL,detected_at TEXT NOT NULL,PRIMARY KEY(table_name,record_key))");
 sql.prepare('INSERT OR IGNORE INTO mf_personal_client_state(id,cursor,seeded) VALUES(1,0,0)').run();
}
function currentRows(sql,table){
 if(!tablesExist(sql,table))return [];
 // All SQL identifiers are from a compiled-in allowlist, never user input.
 const spec=EDITABLE[table];
 const columns=[...spec.pk,...spec.fields.filter(k=>!spec.pk.includes(k))];
 return sql.prepare('SELECT '+columns.join(',')+' FROM '+table).all();
}
function fetchLocal(sql,table,key){
 const pk=EDITABLE[table].pk,values=JSON.parse(key);
 if(!Array.isArray(values)||values.length!==pk.length)throw new Error('Chave inválida.');
 return sql.prepare('SELECT '+[...new Set([...pk,...EDITABLE[table].fields])].join(',')+
  ' FROM '+table+' WHERE '+pk.map(k=>k+'=?').join(' AND ')).get(...values)||null;
}
function updateMirror(sql,table,key,revision,fields){
 sql.prepare("INSERT INTO mf_personal_client_mirror(table_name,record_key,revision,fields_json) VALUES(?,?,?,?) ON CONFLICT(table_name,record_key) DO UPDATE SET revision=excluded.revision,fields_json=excluded.fields_json")
 .run(table,key,revision,JSON.stringify(fields));
}
function rememberConflict(sql,table,key,reason){
 sql.prepare("INSERT INTO mf_personal_client_conflicts(table_name,record_key,reason,detected_at) VALUES(?,?,?,?) ON CONFLICT(table_name,record_key) DO UPDATE SET reason=excluded.reason,detected_at=excluded.detected_at")
 .run(table,key,reason,new Date().toISOString());
}
function seedMirror(sql,baseline){
 if(baseline?.ok!==true||baseline.stage!=='verified_baseline'||
    baseline.financialSyncEnabled!==false||!baseline.tables)
   throw new Error('Baseline autenticado não confirmado.');
 sql.exec('BEGIN IMMEDIATE');
 try{
  for(const table of Object.keys(EDITABLE)){
   const entries=baseline.tables[table];
   if(!Array.isArray(entries)||entries.length>100000)
     throw new Error('Baseline incompleto.');
   for(const entry of entries){
     if(!entry||!entry.identity||!entry.fields)
       throw new Error('Linha de baseline inválida.');
     const spec=EDITABLE[table],key=JSON.stringify(spec.pk.map(k=>entry.identity[k]));
     const local=fetchLocal(sql,table,key);
     if(!local){
       rememberConflict(sql,table,key,'IMPORTED_ROW_MISSING_LOCALLY');
       continue;
     }
     const fields=Object.fromEntries(spec.fields.map(k=>[k,entry.fields[k]]));
     if(Object.values(fields).some(v=>v===undefined))
       throw new Error('Campos do baseline incompletos.');
     // An existing local row may differ from the imported cloud snapshot.
     // Do not treat this preexisting difference as a new outbound edit:
     // require explicit reconciliation rather than silently pushing it.
     if(!equal(recordFields(table,local),fields)){
       rememberConflict(sql,table,key,'PREEXISTING_LOCAL_EDIT');
     }
     updateMirror(sql,table,key,0,fields);
   }
  }
  sql.prepare('UPDATE mf_personal_client_state SET seeded=1 WHERE id=1').run();
  sql.exec('COMMIT');
 }catch(error){sql.exec('ROLLBACK');throw error;}
}
function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function summary(sql,more={}){
 ensureMirror(sql);
 const cursor=sql.prepare('SELECT cursor FROM mf_personal_client_state WHERE id=1').get()?.cursor||0;
 const conflicts=sql.prepare('SELECT COUNT(*) AS n FROM mf_personal_client_conflicts').get()?.n||0;
 return {ok:true,cursor,conflicts,financialSyncEnabled:false,
  bankDataSynchronized:false,automaticSettlementEnabled:false,...more};
}
async function remoteJson(fetchImpl,endpoint,method='GET',body){
 const headers={'Accept':'application/json'};
 if(method==='POST'){
   headers['Content-Type']='application/json';
   headers.Origin=PREVIEW_ORIGIN;
   headers['X-MF-Personal-Edit']='optimistic-v1';
 }
 const response=await fetchImpl(PREVIEW_ORIGIN+endpoint,{
   method,credentials:'include',redirect:'manual',headers,
   ...(body?{body:JSON.stringify(body)}:{})
 });
 if(response?.status!==200&&response?.status!==409)
   throw new Error('Sessão de nuvem indisponível.');
 if(!response.headers.get('content-type')?.includes('application/json'))
   throw new Error('Resposta do servidor inválida.');
 const data=await response.json();
 if(!data||typeof data!=='object')throw new Error('Resposta de sincronização inválida.');
 return data;
}
async function syncPersonalSafeFields(finance,fetchImpl,{maxChanges=200,maxOutbound=30}={}){
 const sql=mustBeSqlite(finance);
 if(typeof fetchImpl!=='function')throw new TypeError('Canal de nuvem inválido.');
 ensureMirror(sql);
 const state=sql.prepare('SELECT cursor,seeded FROM mf_personal_client_state WHERE id=1').get();
 if(!state.seeded){
  const baseline=await remoteJson(fetchImpl,'/api/personal/baseline');
  seedMirror(sql,baseline);
 }
 let cursor=sql.prepare('SELECT cursor FROM mf_personal_client_state WHERE id=1').get().cursor;
 const incoming=await remoteJson(fetchImpl,'/api/personal/changes?since='+cursor+'&limit='+maxChanges);
 if(incoming.ok!==true||!Array.isArray(incoming.changes)||incoming.financialSyncEnabled!==false)
   throw new Error('A lista de alterações não passou na conferência.');
 let applied=0,conflicts=0,outbound=0;
 for(const ev of incoming.changes){
   if(!Object.hasOwn(EDITABLE,ev.table)||!Number.isSafeInteger(ev.revision)||
      !Number.isSafeInteger(ev.sequence)||ev.sequence<=cursor||
      !ev.identity||!ev.patch||typeof ev.patch!=='object')throw new Error('Evento remoto inválido.');
   const spec=EDITABLE[ev.table],key=JSON.stringify(spec.pk.map(k=>ev.identity[k]));
   const mirror=sql.prepare('SELECT revision,fields_json FROM mf_personal_client_mirror WHERE table_name=? AND record_key=?').get(ev.table,key);
   const local=fetchLocal(sql,ev.table,key);
   if(!mirror||!local){
     rememberConflict(sql,ev.table,key,'UNKNOWN_LOCAL_RECORD');
     conflicts++;
   }else if(ev.revision>mirror.revision){
     const original=JSON.parse(mirror.fields_json),current=recordFields(ev.table,local);
     if(!equal(current,original)){
       rememberConflict(sql,ev.table,key,'CONCURRENT_LOCAL_EDIT');
       conflicts++;
     }else{
       const patch=Object.fromEntries(Object.entries(ev.patch).filter(([field])=>spec.fields.includes(field)));
       if(Object.keys(patch).length!==Object.keys(ev.patch).length)
         throw new Error('Campos remotos não reconhecidos.');
       sql.exec('BEGIN IMMEDIATE');
       try{
         if(Object.keys(patch).length){
           sql.prepare('UPDATE '+ev.table+' SET '+Object.keys(patch).map(k=>k+'=?').join(',')+
             ' WHERE '+spec.pk.map(k=>k+'=?').join(' AND '))
             .run(...Object.values(patch),...JSON.parse(key));
         }
         updateMirror(sql,ev.table,key,ev.revision,{...original,...patch});
         sql.prepare('DELETE FROM mf_personal_client_conflicts WHERE table_name=? AND record_key=?').run(ev.table,key);
         sql.exec('COMMIT');
         applied++;
       }catch(e){sql.exec('ROLLBACK');throw e;}
     }
   }
   cursor=ev.sequence;
   sql.prepare('UPDATE mf_personal_client_state SET cursor=? WHERE id=1').run(cursor);
 }
 // Only upload safe-field modifications of rows already mirrored locally.
 // Even after a failed request the original local SQLite remains intact.
 outer:for(const table of Object.keys(EDITABLE)){
   for(const row of currentRows(sql,table)){
     if(outbound>=maxOutbound)break outer;
     const key=identify(table,row);
     const mirror=sql.prepare('SELECT revision,fields_json FROM mf_personal_client_mirror WHERE table_name=? AND record_key=?').get(table,key);
     if(!mirror)continue; // New records need a later create/update contract.
     if(sql.prepare('SELECT 1 FROM mf_personal_client_conflicts WHERE table_name=? AND record_key=?').get(table,key))continue;
     const current=recordFields(table,row),previous=JSON.parse(mirror.fields_json);
     if(equal(current,previous))continue;
     const patch=Object.fromEntries(Object.keys(current).filter(k=>!equal(current[k],previous[k])).map(k=>[k,current[k]]));
     const identity=Object.fromEntries(EDITABLE[table].pk.map(k=>[k,row[k]]));
     const received=await remoteJson(fetchImpl,'/api/personal/apply','POST',{
       mutationId:randomUUID().replace(/-/g,'_'),
       table,identity,baseRevision:mirror.revision,patch
     });
     if(received.conflict===true||received.ok!==true){
       rememberConflict(sql,table,key,'SERVER_REVISION_CONFLICT');conflicts++;
       continue;
     }
     if(!Number.isSafeInteger(received.revision)||received.revision!==mirror.revision+1)
       throw new Error('O servidor não confirmou a revisão correta.');
     updateMirror(sql,table,key,received.revision,current);
     outbound++;
   }
 }
 return summary(sql,{inboundApplied:applied,outboundConfirmed:outbound,
   conflictsDetected:conflicts,hasMore:incoming.hasMore===true});
}
module.exports={EDITABLE,ensureMirror,seedMirror,summary,syncPersonalSafeFields};
