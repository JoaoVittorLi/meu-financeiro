// MF2-01/B1: deterministic, side-effect-free comparison of PRIVILEGED snapshots.
// No network, SQL, clock, mutable globals or write operations. Report has no raw IDs,
// descriptions, balances or amounts. Use only inside a trusted process.
const MAX_ROWS=100000, MAX_ITEMS=200;
const OWN=Object.prototype.hasOwnProperty;
const id=v=>typeof v==='string'&&v.length>0&&v.length<=240?v:null;
const text=v=>typeof v==='string'&&v.length<=2000?v:null;
const integer=v=>Number.isSafeInteger(v)?v:null;
const key=parts=>JSON.stringify(parts);
const date=v=>{
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;
  const n=Date.parse(v+'T00:00:00.000Z');
  return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v?v:null;
};
const upper=v=>{const s=text(v);return s&&s.trim()?s.trim().toUpperCase():null;};
const lower=v=>{const s=text(v);return s&&s.trim()?s.trim().toLowerCase():null;};
const sort=(a,b)=>a<b?-1:a>b?1:0;
const order=(a,b)=>sort(a.reference,b.reference)||sort(a.type,b.type)||sort(a.field||'',b.field||'');
const safeCount=v=>Number.isSafeInteger(v)&&v>=0&&v<=MAX_ROWS?v:null;
function items(snapshot,name){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))
    throw new TypeError('Snapshot '+name+' inválido');
  const out={};
  for(const field of ['accounts','transactions','manualTransactions','overlays']){
    const rows=snapshot[field]??[];
    if(!Array.isArray(rows)||rows.length>MAX_ROWS)throw new TypeError('Coleção inválida: '+field);
    if(rows.some(x=>!x||typeof x!=='object'||Array.isArray(x)))
      throw new TypeError('Registro incompatível: '+field);
    out[field]=rows;
  }
  const meta=snapshot.metadata||{};
  if(!meta||typeof meta!=='object'||Array.isArray(meta))throw new TypeError('Metadata inválida');
  out.metadata={
    historyComplete:meta.historyComplete===true?true:meta.historyComplete===false?false:null,
    overlayCoverage:['verified_import','complete'].includes(meta.overlayCoverage)?
      meta.overlayCoverage:'unavailable',
    lastFetched:safeCount(meta.lastFetched),
    snapshotKind:typeof meta.snapshotKind==='string'&&
      ['windows_sqlite','cloud_staging','synthetic'].includes(meta.snapshotKind)?
      meta.snapshotKind:'unspecified'
  };
  return out;
}
function indexed(rows,identity,shape,side,kind,issues){
  const map=new Map(), duplicates=new Set(), invalid=[];
  rows.forEach((raw,i)=>{
    const idParts=identity(raw);
    if(!idParts.every(Boolean)){
      invalid.push({type:'incomplete',field:'identity',side,kind,ordinal:i,
        reason:'missing_or_invalid_identity',action:'manual_review'});
      return;
    }
    const k=key(idParts),v=shape(raw);
    if(map.has(k)){duplicates.add(k);return;}
    map.set(k,v);
  });
  for(const k of duplicates){
    map.delete(k);
    issues.push({type:'duplicate_identity',field:'identity',side,kind,key:k,
      reason:'same_source_repeated_key',action:'manual_review'});
  }
  issues.push(...invalid);
  return {map,duplicates};
}
function bankShape(r){
  const covered=r.categoryCovered!==false;
  return {
    account_id:id(r.account_id),external_id:id(r.external_id),
    date:date(r.date),description:text(r.description),
    amount_cents:integer(r.amount_cents),status:upper(r.status),
    category:covered?(r.category===null?'Outros':text(r.category)):null,
    categoryCovered:covered,
    updated_at:text(r.updated_at),source:'bank',
    revision:r.revision===null||r.revision===undefined?null:integer(r.revision)
  };
}
function accountShape(r){
  return {account_id:id(r.account_id),item_id:id(r.item_id),
    currency:upper(r.currency),balance_cents:r.balance_cents===null?null:integer(r.balance_cents),
    balanceKnown:r.balance_cents!==null&&r.balance_cents!==undefined,
    updated_at:text(r.updated_at)};
}
function manualShape(r){
  return {profile:id(r.profile),id:id(r.id),date:date(r.date),
    description:text(r.description),kind:lower(r.kind),
    amount_cents:integer(r.amount_cents),category:text(r.category),
    origin:lower(r.origin),source:'manual'};
}
function overlayShape(r){
  const fields=['category','nature','manual_id','title'];
  const o={revision:r.revision===undefined||r.revision===null?null:integer(r.revision)};
  for(const f of fields)o[f]=r[f]===undefined||r[f]===null?null:text(r[f]);
  o.splits=r.splits===undefined||r.splits===null?null:
    Array.isArray(r.splits)&&r.splits.length<=20?
      r.splits.map(x=>[integer(x.position),text(x.category),integer(x.amount_cents)])
        .sort((a,b)=>a[0]-b[0]):null;
  return o;
}
function normalizeSnapshot(input,side,issues){
  const raw=items(input,side);
  const a=indexed(raw.accounts,r=>[id(r.account_id)],accountShape,side,'account',issues);
  const t=indexed(raw.transactions,r=>[id(r.account_id),id(r.external_id)],
    bankShape,side,'bank',issues);
  const m=indexed(raw.manualTransactions,r=>[id(r.profile),id(r.id)],
    manualShape,side,'manual',issues);
  const o=indexed(raw.overlays,r=>[id(r.account_id),id(r.external_id)],
    overlayShape,side,'overlay',issues);
  return {accounts:a,transactions:t,manual:m,overlays:o,
    metadata:raw.metadata,counts:{
      accounts:raw.accounts.length,bank:raw.transactions.length,
      manual:raw.manualTransactions.length,overlays:raw.overlays.length
    }};
}
function issue(type,kind,k,field,side,reason,action='manual_review'){
  return {type,kind,key:k,field,side,reason,action};
}
function compareKind(a,b,kind,fields,issues,missingField='required_field_missing'){
  const all=[...new Set([...a.map.keys(),...b.map.keys()])].sort();
  let equivalent=0,compared=0;
  for(const k of all){
    if(a.duplicates.has(k)||b.duplicates.has(k))continue;
    const l=a.map.get(k),r=b.map.get(k);
    if(!l||!r){
      issues.push(issue('only_one_source',kind,k,'identity',l?'windows':'cloud',
        'not_present_in_other_snapshot','check_history_window'));
      continue;
    }
    compared++;
    let unequal=false;
    for(const field of fields){
      if((field==='balance_cents')&&(!l.balanceKnown||!r.balanceKnown)){
        issues.push(issue('incomplete',kind,k,field,'both','balance_unknown_not_zero'));unequal=true;continue;
      }
      if(l[field]===null||r[field]===null||l[field]===undefined||r[field]===undefined){
        issues.push(issue('incomplete',kind,k,field,'both',missingField));unequal=true;continue;
      }
      if(l[field]!==r[field]){
        const kindDiff=field==='date'||field==='amount_cents'?'financial_difference':
          field==='status'||field==='kind'?'status_difference':
          field==='category'?'category_difference':
          field==='item_id'?'account_identity_difference':'attribute_difference';
        issues.push(issue(kindDiff,kind,k,field,'both','same_identity_different_value'));unequal=true;
      }
    }
    if(!unequal)equivalent++;
  }
  return {compared,equivalent};
}
function detectLikelyDuplicates(normal,side,issues){
  // Heuristic only: never collapse rows on matching amounts/date/description.
  const fingerprints=new Map();
  for(const [k,r] of normal.transactions.map){
    if(!r.date||r.amount_cents===null||r.description===null)continue;
    const signature=key([r.account_id,r.date,r.amount_cents,r.description]);
    if(!fingerprints.has(signature))fingerprints.set(signature,[]);
    fingerprints.get(signature).push(k);
  }
  for(const refs of fingerprints.values()){
    if(refs.length<2)continue;
    for(const k of refs.sort()){
      issues.push(issue('possible_duplicate','bank',k,'identity',side,
        'same_account_day_cents_description_different_external_ids'));
    }
  }
}
function attachOverlays(a,b,issues){
  const coverageA=a.metadata.overlayCoverage,coverageB=b.metadata.overlayCoverage;
  if(coverageA==='unavailable'||coverageB==='unavailable')return {checked:false,equivalent:0};
  let equivalent=0;
  for(const k of [...new Set([...a.transactions.map.keys(),...b.transactions.map.keys()])].sort()){
    if(!a.transactions.map.has(k)||!b.transactions.map.has(k))continue;
    const l=a.overlays.map.get(k)||overlayShape({});
    const r=b.overlays.map.get(k)||overlayShape({});
    let same=true;
    for(const f of ['category','nature','manual_id','title','splits']){
      if(JSON.stringify(l[f])!==JSON.stringify(r[f])){
        issues.push(issue('personal_edit_difference','overlay',k,f,'both',
          'different_personal_overlay','manual_review'));
        same=false;
      }
    }
    if(l.revision!==null&&r.revision!==null&&l.revision!==r.revision){
      issues.push(issue('revision_conflict','overlay',k,'revision','both',
        'different_revision','review_cas'));
      same=false;
    }
    if(same)equivalent++;
  }
  return {checked:true,equivalent};
}
function refMap(a,b){
  const refs=new Set();
  for(const x of [a,b]){
    for(const kind of ['accounts','transactions','manual','overlays']){
      for(const k of x[kind].map.keys())refs.add(kind+':'+k);
      for(const k of x[kind].duplicates)refs.add(kind+':'+k);
    }
  }
  return new Map([...refs].sort().map((x,i)=>[x,'R'+String(i+1).padStart(6,'0')]));
}
function flowCounts(snapshot){
  const bank=[...snapshot.transactions.map.values()];
  const manual=[...snapshot.manual.map.values()];
  const edits=[...snapshot.overlays.map.values()];
  return {
    bankIncome:bank.filter(r=>r.amount_cents!==null&&r.amount_cents>0).length,
    bankExpense:bank.filter(r=>r.amount_cents!==null&&r.amount_cents<0).length,
    bankZero:bank.filter(r=>r.amount_cents===0).length,
    manualIncome:manual.filter(r=>r.kind==='income').length,
    manualExpense:manual.filter(r=>r.kind==='expense').length,
    explicitTransfers:edits.filter(r=>r.nature==='transfer').length,
    linkedManualReferences:edits.filter(r=>r.manual_id!==null).length,
    // Classification counts, not additive income/expense totals.
    ledgerTotalsCombined:false
  };
}
function summarize(issues){
  const byType={};
  for(const i of issues)byType[i.type]=(byType[i.type]||0)+1;
  return Object.fromEntries(Object.entries(byType).sort(([a],[b])=>sort(a,b)));
}
/** Rows MUST be read inside trusted storage adapters. No raw IDs in report.
 * Comparison never approves cloud sync, financial migration or cutover.
 */
function reconcileSnapshots(windows,cloud){
  const events=[];
  const a=normalizeSnapshot(windows,'windows',events);
  const b=normalizeSnapshot(cloud,'cloud',events);
  const account=compareKind(a.accounts,b.accounts,'account',['item_id','currency','balance_cents'],events);
  const bank=compareKind(a.transactions,b.transactions,'bank',
    ['date','amount_cents','description','status','category'],events);
  const manual=compareKind(a.manual,b.manual,'manual',
    ['date','amount_cents','kind','category','origin'],events);
  const overlay=attachOverlays(a,b,events);
  detectLikelyDuplicates(a,'windows',events);
  detectLikelyDuplicates(b,'cloud',events);
  const refs=refMap(a,b);
  const reportIssues=events.map(e=>{
    const k=e.key===undefined?null:e.kind+':'+e.key;
    return {type:e.type,entity:e.kind,reference:k===null?'INVALID-'+e.side+'-'+e.ordinal:(refs.get(k)||'UNRESOLVED'),
      field:e.field,side:e.side,reason:e.reason,action:e.action||'manual_review'};
  }).sort(order);
  const differences=summarize(reportIssues);
  const metadata={windows:a.metadata,cloud:b.metadata};
  // A 630/632 delta cannot imply loss: staging retains old fetches by design.
  const historicalHypotheses=[];
  if(a.counts.bank!==b.counts.bank){
    historicalHypotheses.push('different_time_window_or_provider_refresh');
    if(b.metadata.lastFetched!==null&&b.metadata.lastFetched<b.counts.bank)
      historicalHypotheses.push('cloud_staging_preserved_prior_fetches');
    historicalHypotheses.push('identity_or_status_difference_not_yet_proven');
  }
  const state=reportIssues.length?'requires_manual_review':
    !overlay.checked||a.metadata.historyComplete!==true||b.metadata.historyComplete!==true?
      'consistent_observed_scope_only':'consistent_observed_scope';
  return {
    ok:true,contract:'mf2-reconciliation-b1-v1',stage:'read_only_dry_run',
    sources:{windows:a.counts,cloud:b.counts},
    comparable:{accounts:account,bank,manual,overlay},
    coverage:metadata,
    flowClassification:{windows:flowCounts(a),cloud:flowCounts(b)},
    summary:{state,issues:reportIssues.length,byType:differences,
      omittedIssues:Math.max(0,reportIssues.length-MAX_ITEMS),
      bankCountDelta:b.counts.bank-a.counts.bank,
      historicalHypotheses},
    differences:reportIssues.slice(0,MAX_ITEMS),
    financialSyncEnabled:false,cloudCutoverAllowed:false,
    databaseChanged:false,automaticSettlementEnabled:false,
    personalDataIncluded:false
  };
}
export {normalizeSnapshot,reconcileSnapshots};
