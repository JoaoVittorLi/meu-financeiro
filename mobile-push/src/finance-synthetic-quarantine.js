// Synthetic personal-data transfer that exercises the SAME strict validator
// and atomic quarantine code intended for future desktop migration.
// Only compile-time fake rows are generated here. No request body is read.
// No financial app table is changed and import is always discarded afterward.
import {PERSONAL_COLUMNS} from './finance-personal-validate.js';
import {stagePersonalSnapshot,discardPersonalQuarantine} from './finance-personal-quarantine.js';

const F='2026-11-07T12:00:00.000Z',AC='fictional-acct',BK='fictional-bank-1';
const rows=Object.freeze({
  profiles:[{profile:'real',initialized_at:F}],
  transactions:[{profile:'real',id:'fictional-manual',date:'2026-11-07',description:'Despesa fictícia',kind:'expense',amount_cents:2500,category:'Moradia',origin:'manual'}],
  budgets:[{profile:'real',category:'Moradia',amount_cents:80000}],
  financial_settings:[{profile:'real',name:'reserve',value_cents:30000}],
  categories:[{name:'Moradia',color:'#884bff',built_in:0,created_at:F,emoji:'🏠',kind:'expense'}],
  category_rules:[{id:1,pattern:'ALUGUEL',match_mode:'contains',category:'Moradia',scope:'bank',priority:10,enabled:1}],
  bank_category_overrides:[{account_id:AC,external_id:BK,category:'Moradia'}],
  bank_transaction_notes:[{account_id:AC,external_id:BK,merchant:'Locador fictício',note:'Somente teste',nature:'expense',reviewed_at:F}],
  bank_transaction_splits:[{account_id:AC,external_id:BK,position:0,category:'Moradia',amount_cents:2500}],
  bank_manual_links:[{account_id:AC,external_id:BK,manual_id:'fictional-manual',linked_at:F}],
  merchant_aliases:[{id:1,pattern:'ALUGUEL',display_name:'Aluguel fictício',created_at:F}],
  bank_duplicate_dismissals:[{pair_key:'fictional-duplicate',dismissed_at:F}],
  planned_items:[{id:'fictional-plan',group_id:null,group_type:'single',occurrence:1,total_occurrences:1,title:'Aluguel fictício',kind:'expense',amount_cents:2500,due_date:'2026-11-07',category:'Moradia',account_id:AC,notes:'Plano fictício',certainty:'confirmed',status:'settled',created_at:F,updated_at:F,settled_at:F}],
  planned_bank_links:[{item_id:'fictional-plan',account_id:AC,external_id:BK,linked_at:F}],
  planned_rejected_matches:[{item_id:'fictional-plan',account_id:AC,external_id:'fictional-bank-2'}],
  planned_audit:[{id:1,item_id:'fictional-plan',action:'link',details:'synthetic-only',at:F}],
  bank_custom_titles:[{account_id:AC,external_id:BK,title:'Título editado fictício'}]
});

function sha256hex(bytes){
 return crypto.subtle.digest('SHA-256',new TextEncoder().encode(bytes))
   .then(buffer=>[...new Uint8Array(buffer)].map(v=>v.toString(16).padStart(2,'0')).join(''));
}

export async function createSyntheticPersonalPackage(){
 const tables={},byTable={};
 let totalRows=0,totalBytes=0,root='';
 const encoder=new TextEncoder();
 for(const [table,columns] of Object.entries(PERSONAL_COLUMNS)){
   if(!Object.hasOwn(rows,table))throw new Error('Missing synthetic personal fixture.');
   const normalized=rows[table].map(record=>{
     const result=Object.create(null);
     for(const col of columns){
       if(!Object.hasOwn(record,col))throw new Error('Incomplete synthetic row.');
       result[col]=record[col];
     }
     return result;
   });
   let all='';
   for(const record of normalized){
     const json=JSON.stringify(record);
     totalRows++;totalBytes+=encoder.encode(json).byteLength;
     all+=json+'\n';
   }
   const digest=await sha256hex(all);
   tables[table]={columns:[...columns],rows:normalized};
   byTable[table]={rows:normalized.length,digest};
   root+=table+':'+normalized.length+':'+digest+'\n';
 }
 return {format:'mf-personal-snapshot-v1',schemaVersion:6,tables,
   manifest:{tables:17,rows:totalRows,bytes:totalBytes,digest:await sha256hex(root),
     byTable,cloudTransferred:false,bankHistoryMigrated:false,cutoverReady:false}
 };
}

export async function runSyntheticQuarantineDemo(storage,{id=crypto.randomUUID()}={}){
 const pack=await createSyntheticPersonalPackage();
 // This route MUST never accept records supplied by the requester.
 let started=false,first,replay,discarded;
 try{
   first=await stagePersonalSnapshot(storage,id,pack);
   started=true;
   replay=await stagePersonalSnapshot(storage,id,pack);
   discarded=discardPersonalQuarantine(storage,id);
   started=false;
   if(first.replayed||!replay.replayed||!discarded.discarded||
      first.rows!==pack.manifest.rows||first.tables!==17)
     throw new Error('Quarantine rehearsal did not reconcile correctly.');
   return {ok:true,mode:'synthetic_personal_quarantine',
     personalTables:17,fictionalRecords:first.rows,
     payloadValidated:true,duplicateReplayPrevented:true,rollbackVerified:true,
     realRecordsReceived:0,financialMigrationActivated:false,
     syncedToDevices:false};
 }finally{
   // Discard even if an intermediate validation step fails.
   if(started)discardPersonalQuarantine(storage,id);
 }
}
