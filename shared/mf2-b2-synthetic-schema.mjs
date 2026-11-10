// Strictly synthetic-only schemas shared by Node B2-A and future Worker adapter.
// No secrets, network, persistence, financial staging or JSON schema dependencies.
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x) &&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const id=x=>typeof x==='string'&&/^SYNTH-[A-Za-z0-9_-]{1,100}$/.test(x);
const text=x=>typeof x==='string'&&x.startsWith('SYNTHETIC:')&&x.length<=256;
const amount=x=>Number.isSafeInteger(x)&&Math.abs(x)<=1e12;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
  new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
function error(code){const e=new Error(code);e.code=code;return e}
function fields(o,allowed,required=[]){
  return isRecord(o)&&Object.keys(o).every(x=>allowed.includes(x))&&required.every(x=>Object.hasOwn(o,x));
}
const scalar=(v,max=128)=>v===null||(typeof v==='string'&&v.length<=max);
function checkSnapshot(snapshot){
  let content;
  try{content=JSON.stringify(snapshot)}catch{throw error('invalid_json')}
  if(typeof content!=='string'||BufferByteLength(content)>256*1024)throw error('payload_too_large');
  if(isRecord(snapshot)&&isRecord(snapshot.metadata)&&snapshot.metadata.snapshotKind==='synthetic'&&
     (!Array.isArray(snapshot.accounts)||!Array.isArray(snapshot.transactions)))
    throw error('missing_fixture_collection');
  if(!isRecord(snapshot)||!fields(snapshot,['accounts','transactions','manualTransactions','overlays','metadata'],['accounts','transactions','metadata'])||
     !fields(snapshot.metadata,['snapshotKind','historyComplete','overlayCoverage','lastFetched'],['snapshotKind'])||
     snapshot.metadata.snapshotKind!=='synthetic')throw error('non_synthetic_snapshot');
  const meta=snapshot.metadata;
  if((Object.hasOwn(meta,'historyComplete')&&meta.historyComplete!==true&&meta.historyComplete!==false&&meta.historyComplete!==null)||
     (Object.hasOwn(meta,'overlayCoverage')&&!['complete','verified_import','unavailable'].includes(meta.overlayCoverage))||
     (Object.hasOwn(meta,'lastFetched')&&meta.lastFetched!==null&&(!Number.isSafeInteger(meta.lastFetched)||meta.lastFetched<0)))
    throw error('non_synthetic_snapshot');
  const collections=['accounts','transactions','manualTransactions','overlays'];
  for(const type of collections){
    const rows=snapshot[type]??[];
    if(!Array.isArray(rows)||rows.length>2000)throw error('invalid_synthetic_rows');
    for(const r of rows){
      let valid=false;
      if(type==='accounts'){
        valid=fields(r,['account_id','item_id','currency','balance_cents','updated_at'],['account_id','item_id'])&&
          id(r.account_id)&&id(r.item_id)&&
          (r.currency===undefined||r.currency==='BRL')&&
          (r.balance_cents===undefined||r.balance_cents===null||amount(r.balance_cents))&&
          (r.updated_at===undefined||scalar(r.updated_at));
      }else if(type==='transactions'){
        valid=fields(r,['account_id','external_id','date','description','amount_cents','status','category','categoryCovered','updated_at','revision'],
          ['account_id','external_id','date','description','amount_cents','status'])&&
          id(r.account_id)&&id(r.external_id)&&date(r.date)&&text(r.description)&&amount(r.amount_cents)&&
          ['POSTED','PENDING','PROCESSING'].includes(r.status)&&
          (r.category===undefined||scalar(r.category))&&
          (r.categoryCovered===undefined||typeof r.categoryCovered==='boolean')&&
          (r.updated_at===undefined||scalar(r.updated_at))&&
          (r.revision===undefined||r.revision===null||(Number.isSafeInteger(r.revision)&&r.revision>=0));
      }else if(type==='manualTransactions'){
        valid=fields(r,['profile','id','date','description','kind','amount_cents','category','origin'],
            ['profile','id','date','description','kind','amount_cents'])&&
          r.profile==='real'&&id(r.id)&&date(r.date)&&text(r.description)&&amount(r.amount_cents)&&
          ['income','expense','transfer'].includes(r.kind)&&
          (r.category===undefined||scalar(r.category))&&
          (r.origin===undefined||scalar(r.origin));
      }else if(type==='overlays'){
        valid=fields(r,['account_id','external_id','category','nature','manual_id','title','revision','splits'],
          ['account_id','external_id'])&&id(r.account_id)&&id(r.external_id)&&
          (r.category===undefined||scalar(r.category))&&
          (r.nature===undefined||[null,'transfer','ignore','income','expense'].includes(r.nature))&&
          (r.manual_id===undefined||r.manual_id===null||id(r.manual_id))&&
          (r.title===undefined||r.title===null||text(r.title))&&
          (r.revision===undefined||r.revision===null||(Number.isSafeInteger(r.revision)&&r.revision>=0))&&
          (r.splits===undefined||r.splits===null||(Array.isArray(r.splits)&&r.splits.length<=20&&r.splits.every(s=>
            fields(s,['position','category','amount_cents'],['position','category','amount_cents'])&&
            Number.isSafeInteger(s.position)&&s.position>=0&&scalar(s.category)&&amount(s.amount_cents))));
      }
      if(!valid)throw error('non_synthetic_record');
    }
  }
  return true;
}
// Browser-compatible UTF-8 byte length, without Node Buffer.
function BufferByteLength(s){return new TextEncoder().encode(s).byteLength}
export {checkSnapshot};
