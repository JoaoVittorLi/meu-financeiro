'use strict';
// CAT-03: historical keyset scan, previews only. NO personal writing.
// MAIN must supply authorizeRead and may separately request native confirmation.
// No use of bankOverview() (it is limited to 2,500 visible rows).
const {randomUUID,createHash}=require('node:crypto');
const {classifyCandidate}=require('./cat02-classifier.cjs');
const {evidenceFor}=require('./cat01-evidence-store.cjs');
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const MAX_ITEMS=100000,MAX_ACCOUNTS=20,PAGE=250;
function accountsOf(input){
 if(!Array.isArray(input)||input.length<1||input.length>MAX_ACCOUNTS||
  input.some(x=>typeof x!=='string'||!x.trim()||x.length>160)||
  new Set(input).size!==input.length)throw Error('CAT-03: contas inválidas');
 return [...input].sort();
}
function readCandidates(db,accountIds,{cursor=null,limit=PAGE}={}){
 const ids=accountsOf(accountIds);
 if(!Number.isInteger(limit)||limit<1||limit>PAGE)throw Error('CAT-03: limite inválido');
 const sql=[
  'SELECT b.account_id AS accountId,b.external_id AS externalId,b.date,b.description,',
  'b.amount_cents AS amountCents,b.status,b.category,',
  'CASE WHEN o.account_id IS NULL THEN 0 ELSE 1 END AS manualOverride,',
  "COALESCE(n.nature,'auto') AS nature,n.reviewed_at AS reviewedAt,",
  'l.manual_id AS linkedManualId,',
  '(SELECT COUNT(*) FROM bank_transaction_splits s WHERE s.account_id=b.account_id',
  'AND s.external_id=b.external_id) AS splitCount',
  'FROM bank_transactions b',
  'LEFT JOIN bank_category_overrides o ON o.account_id=b.account_id AND o.external_id=b.external_id',
  'LEFT JOIN bank_transaction_notes n ON n.account_id=b.account_id AND n.external_id=b.external_id',
  'LEFT JOIN bank_manual_links l ON l.account_id=b.account_id AND l.external_id=b.external_id',
  'WHERE b.account_id IN ('+ids.map(()=>'?').join(',')+')',
  'AND (? IS NULL OR b.account_id > ? OR (b.account_id=? AND b.external_id>?))',
  'ORDER BY b.account_id,b.external_id LIMIT ?'
 ].join(' ');
 const last=cursor?JSON.parse(cursor):null;
 if(last&&(!ids.includes(last.accountId)||typeof last.externalId!=='string'||last.externalId.length>160))
  throw Error('CAT-03: cursor não autorizado');
 return db.prepare(sql).all(...ids,last?.accountId??null,last?.accountId??null,
  last?.accountId??null,last?.externalId??null,limit);
}
function scopeIdentity(scope){
 if(!scope||!Number.isInteger(scope.owner)||!['real','demo'].includes(scope.profile)||
    typeof scope.readGrantId!=='string'||scope.readGrantId.length<8||scope.readGrantId.length>160)
  throw Error('CAT-03: identidade do grant inválida');
 return JSON.stringify([scope.owner,scope.profile,scope.readGrantId]);
}
function rowVersion(row,metadata){
 return sha([row.accountId,row.externalId,row.date,row.description,row.amountCents,
  row.status,row.category,row.nature,row.manualOverride,row.reviewedAt,
  row.linkedManualId,row.splitCount,metadata?.fingerprint||null]);
}
function nextCursor(row){return JSON.stringify({accountId:row.accountId,externalId:row.externalId});}
class Cat03PreviewService{
 constructor({db,authorizeRead,historyFor,approvedRulesFor,
  modelFor=()=>null,clock=Date.now}={}){
  if(typeof historyFor!=='function'||typeof approvedRulesFor!=='function')
   throw Error('CAT-03: adaptadores de precedência humana obrigatórios');
  if(!db||typeof db.prepare!=='function'||typeof authorizeRead!=='function')
   throw Error('CAT-03: DB e autorização do MAIN obrigatórias');
  this.db=db;this.authorizeRead=authorizeRead;this.historyFor=historyFor;
  this.approvedRulesFor=approvedRulesFor;this.modelFor=modelFor;
  this.clock=clock;this.jobs=new Map();
 }
 start({accountIds,scope}){
  const ids=accountsOf(accountIds);
  this.authorizeRead({accountIds:ids,scope});
  const n=this.db.prepare('SELECT COUNT(*) AS n FROM bank_transactions WHERE account_id IN ('+
   ids.map(()=>'?').join(',')+')').get(...ids).n;
  if(!Number.isSafeInteger(n)||n>MAX_ITEMS)throw Error('CAT-03: volume acima do limite; dividir a prévia');
  const id=randomUUID(),job={id,accountIds:ids,scope,created:this.clock(),
   scopeKey:scopeIdentity(scope),expires:this.clock()+30*60*1000,state:'scanning',cursor:null,
   total:n,processed:0,items:[],counts:{apply:0,review:0,protected:0},
   samples:[],digest:null};
  this.jobs.set(id,job);return this.status(id,scope);
 }
 job(id,scope){
  const j=this.jobs.get(id);
  if(!j||j.scopeKey!==scopeIdentity(scope)||j.expires<=this.clock())throw Error('CAT-03: prévia inválida ou expirada');
  this.authorizeRead({accountIds:j.accountIds,scope});return j;
 }
 status(id,scope){
  const j=this.job(id,scope);
  return {contract:'CAT03/PREVIEW-V1',id:j.id,state:j.state,total:j.total,
   processed:j.processed,counts:{...j.counts},samples:j.samples.slice(-50),
   previewVersion:j.digest,expiresAt:new Date(j.expires).toISOString(),
   readOnly:true,changesApplied:false};
 }
 next(id,scope,{limit=PAGE}={}){
  const j=this.job(id,scope);
  if(j.state!=='scanning')throw Error('CAT-03: não é possível avançar uma prévia parada/concluída');
  const rows=readCandidates(this.db,j.accountIds,{cursor:j.cursor,limit});
  for(const r of rows){
   const metadata=evidenceFor(this.db,r.accountId,r.externalId);
   const history=this.historyFor(r,metadata)||[];
   const rules=this.approvedRulesFor(r,metadata)||[];
   const d=classifyCandidate({transaction:{...r,manualOverride:!!r.manualOverride},
    evidence:metadata||{},history,rules,model:this.modelFor(r)});
   const entry={accountId:r.accountId,externalId:r.externalId,
    rowVersion:rowVersion(r,metadata),status:d.status,reason:d.reason,target:d.target??null,
    evidenceTypes:d.evidenceTypes??[],evidenceFingerprint:metadata?.fingerprint||null};
   j.items.push(entry);j.counts[d.status]++;j.processed++;
   if(j.samples.length<50&&d.status!=='protected')j.samples.push({
    accountId:r.accountId,externalId:r.externalId,status:d.status,reason:d.reason,target:d.target??null});
   j.cursor=nextCursor(r);
  }
  if(rows.length<limit||j.processed===j.total){
   if(j.processed!==j.total)throw Error('CAT-03: movimentações alteradas durante a prévia; refazer');
   const count=this.db.prepare('SELECT COUNT(*) AS n FROM bank_transactions WHERE account_id IN ('+
    j.accountIds.map(()=>'?').join(',')+')').get(...j.accountIds).n;
   if(count!==j.total)throw Error('CAT-03: conjunto mudou durante a leitura; refaça a prévia');
   j.state='review_ready';
   j.digest=sha([j.accountIds,j.items.map(x=>[x.accountId,x.externalId,x.rowVersion,x.status,x.target])]);
  }
  return this.status(id,scope);
 }
 pause(id,scope){
  const j=this.job(id,scope);
  if(j.state!=='scanning')throw Error('CAT-03: pausa indisponível');
  j.state='paused';return this.status(id,scope);
 }
 resume(id,scope){
  const j=this.job(id,scope);
  if(j.state!=='paused')throw Error('CAT-03: retomada indisponível');
  j.state='scanning';return this.status(id,scope);
 }
 cancel(id,scope){
  const j=this.job(id,scope);this.jobs.delete(j.id);
  return {cancelled:true,readOnly:true,changesApplied:false};
 }
 manifest(id,scope,version){
  const j=this.job(id,scope);
  if(j.state!=='review_ready'||!j.digest||j.digest!==version)
   throw Error('CAT-03: prévia não finalizada ou versão divergente');
  return {contract:'CAT03/SIGNED-PREVIEW-V1',id:j.id,accountIds:j.accountIds.slice(),
   previewVersion:j.digest,expires:j.expires,
   items:j.items.filter(x=>x.status==='apply').map(x=>({...x})),
   totals:{...j.counts},analyzed:j.processed}; // For trusted CAT-05 service only, never IPC raw.
 }
 close(){this.jobs.clear();}
}
module.exports={PAGE,MAX_ITEMS,accountsOf,readCandidates,rowVersion,Cat03PreviewService};
