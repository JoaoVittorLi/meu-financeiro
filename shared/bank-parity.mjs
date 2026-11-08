// Pure cross-platform bank parity contract v1 (Windows Electron + Cloudflare Worker).
// The comparison never transfers raw local records, keys, descriptions or amounts.
// Digest-only summaries cannot authorize a cloud cutover.
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS=100000;
const VALID_FIELDS=['account_id','external_id','date','description','amount_cents','status'];
function valid(row){
  if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Linha bancária inválida.');
  for(const key of ['account_id','external_id','date','description','status'])
    if(typeof row[key]!=='string'||(key!=='description'&&!row[key])||row[key].length>2000)
      throw new Error('Campo bancário incompatível: '+key);
  if(!DAY.test(row.date)||new Date(row.date+'T00:00:00.000Z').toISOString().slice(0,10)!==row.date)
    throw new Error('Data bancária incompatível.');
  if(!Number.isSafeInteger(row.amount_cents))throw new Error('Valor bancário incompatível.');
  return VALID_FIELDS.map(k=>row[k]);
}
function canonical(rows){
  if(!Array.isArray(rows)||rows.length>MAX_ROWS)throw new Error('Extrato excedeu a janela validável.');
  const items=rows.map(valid);
  items.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0);
  for(let i=1;i<items.length;i++){
    if(items[i][0]===items[i-1][0]&&items[i][1]===items[i-1][1])
      throw new Error('Identidade bancária duplicada.');
  }
  return items;
}
function serialize(rows,fields){
  return rows.map(row=>JSON.stringify(fields.map(i=>row[i]))).join('\n')+'\n';
}
export async function bankParityManifest(rawRows,sha256){
  if(typeof sha256!=='function')throw new Error('Hash SHA-256 obrigatório.');
  const rows=canonical(rawRows);
  const identities=await sha256(serialize(rows,[0,1]));
  const datesAndCents=await sha256(serialize(rows,[0,1,2,4]));
  const descriptionsAndStatuses=await sha256(serialize(rows,[0,1,3,5]));
  for(const hash of [identities,datesAndCents,descriptionsAndStatuses]){
    if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))
      throw new Error('SHA-256 não disponível.');
  }
  let minDate=null,maxDate=null;
  for(const row of rows){
    if(minDate===null||row[2]<minDate)minDate=row[2];
    if(maxDate===null||row[2]>maxDate)maxDate=row[2];
  }
  return {ok:true,contract:'mf-bank-parity-v1',rows:rows.length,
    dates:{first:minDate,last:maxDate},
    hashes:{identities,datesAndCents,descriptionsAndStatuses},
    // A hash comparison cannot establish source freshness, balance parity,
    // categorization parity or historical coverage beyond records present.
    ledgerSemanticsVerified:false,balanceVerified:false,
    reconciliationVerified:false,cloudCutoverAllowed:false};
}
export function compareBankParity(local,remote){
  if(!local||!remote||local.contract!=='mf-bank-parity-v1'||
     remote.contract!=='mf-bank-parity-v1'||local.ok!==true||remote.ok!==true||
     local.cloudCutoverAllowed!==false||remote.cloudCutoverAllowed!==false)
    throw new Error('Contrato de comparação incompatível.');
  const check=k=>typeof local.hashes?.[k]==='string'&&
    /^[0-9a-f]{64}$/.test(local.hashes[k])&&typeof remote.hashes?.[k]==='string'&&
    /^[0-9a-f]{64}$/.test(remote.hashes[k])&&local.hashes[k]===remote.hashes[k];
  const sameCount=local.rows===remote.rows;
  const exactIdentities=sameCount&&check('identities');
  const exactDatesAndCents=exactIdentities&&check('datesAndCents');
  const exactDescriptionsAndStatuses=exactIdentities&&check('descriptionsAndStatuses');
  return {ok:true,stage:'preview_bank_comparison',localCount:local.rows,
    cloudCount:remote.rows,sameCount,exactIdentities,exactDatesAndCents,
    exactDescriptionsAndStatuses,matched:exactDatesAndCents&&exactDescriptionsAndStatuses,
    balancesNotCompared:true,personalizationsNotCompared:true,
    financialSyncEnabled:false,cloudCutoverAllowed:false};
}
