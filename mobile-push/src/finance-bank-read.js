// Owner-only, read-only projection of bank staging for the PWA Preview.
// Raw bank records are never modified, categorized or settled by this API.
// The Worker boundary MUST verify private session + signed Access identity.
import {ensureBankStaging} from './finance-bank-ingestion.js';

const MAX_LIMIT=100;
const MAX_OFFSET=100000;
function integer(value,min,max,name){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error('Parâmetro inválido: '+name);
  return n;
}
function queryText(value){
  if(typeof value!=='string'||value.length>100||/[\u0000-\u001f]/.test(value))
    throw new Error('Busca inválida.');
  return value.trim();
}
export function readBankTransactionsPage(storage,{offset=0,limit=30,search='',direction='all'}={}){
  const start=integer(offset,0,MAX_OFFSET,'offset');
  const size=integer(limit,1,MAX_LIMIT,'limit');
  const needle=queryText(search);
  if(!['all','in','out'].includes(direction))throw new Error('Filtro inválido.');
  ensureBankStaging(storage);
  const filters=[],params=[];
  if(needle){
    // ESCAPE prevents user input from turning into LIKE wildcards.
    filters.push("description LIKE ? ESCAPE '\\'");
    params.push('%'+needle.replace(/[\\%_]/g,'\\$&')+'%');
  }
  if(direction!=='all')filters.push('amount_cents '+(direction==='in'?'>':'<')+' 0');
  const where=filters.length?' WHERE '+filters.join(' AND '):'';
  const total=storage.sql.exec('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions'+where,...params).one().n;
  const rows=storage.sql.exec(
    'SELECT date,description,amount_cents,status FROM mf_bank_staging_transactions'+where+
    ' ORDER BY date DESC,account_id,external_id LIMIT ? OFFSET ?',
    ...params,size,start
  ).toArray();
  return {ok:true,stage:'bank_staging_preview',total,offset:start,limit:size,
    nextOffset:start+rows.length<total?start+rows.length:null,
    rows:rows.map(row=>({
      date:row.date,description:row.description,
      amountCents:row.amount_cents,status:row.status
    })),
    financialSyncEnabled:false,reconciliationVerified:false,
    cloudCutoverAllowed:false};
}
