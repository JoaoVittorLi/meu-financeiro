// Shared bank monthly fingerprints for E1 diagnostics (Windows + Cloudflare).
// No raw records, account IDs, names, amounts or per-transaction hashes are returned.
// Buckets expose month and counts only. Cutover approval is ALWAYS false.
import {bankParityManifest} from './bank-parity.mjs';

const DAY=/^\d{4}-\d{2}-\d{2}$/;
const MAX_BUCKETS=48;
export async function bankMonthlyEvidence(rows,sha256){
  if(!Array.isArray(rows)||rows.length>100000||typeof sha256!=='function')
    throw new Error('Histórico mensal inválido.');
  const buckets=new Map();
  for(const row of rows){
    if(!row||typeof row.date!=='string'||!DAY.test(row.date)||
      new Date(row.date+'T00:00:00Z').toISOString().slice(0,10)!==row.date)
      throw new Error('Data bancária inválida.');
    const month=row.date.slice(0,7);
    if(!buckets.has(month))buckets.set(month,[]);
    buckets.get(month).push(row);
  }
  const sorted=[...buckets.keys()].sort().reverse();
  const months=[];
  for(const month of sorted.slice(0,MAX_BUCKETS)){
    const summary=await bankParityManifest(buckets.get(month),sha256);
    months.push({month,count:summary.rows,hashes:summary.hashes});
  }
  return {ok:true,contract:'mf-e1-months-v1',stage:'read_only_comparison',
    months,totalMonths:sorted.length,monthlyCoverageComplete:sorted.length<=MAX_BUCKETS,
    cutoverAllowed:false};
}
const hex=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
function validate(data){
  if(!data||data.ok!==true||data.contract!=='mf-e1-months-v1'||
     data.stage!=='read_only_comparison'||data.cutoverAllowed!==false||
     !Array.isArray(data.months)||data.months.length>MAX_BUCKETS||
     !Number.isSafeInteger(data.totalMonths)||data.totalMonths<data.months.length||
     data.monthlyCoverageComplete!==(data.totalMonths===data.months.length))
    throw new Error('Contrato mensal incompatível.');
  let previous='9999-12';
  for(const x of data.months){
    if(!x||typeof x.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(x.month)||
       x.month>=previous||!Number.isSafeInteger(x.count)||x.count<1||
       !hex(x.hashes?.identities)||!hex(x.hashes?.datesAndCents)||
       !hex(x.hashes?.descriptionsAndStatuses))
      throw new Error('Digest mensal inválido.');
    previous=x.month;
  }
}
export function compareBankMonthlyEvidence(local,cloud){
  validate(local);validate(cloud);
  const localMonths=new Map(local.months.map(x=>[x.month,x]));
  const cloudMonths=new Map(cloud.months.map(x=>[x.month,x]));
  const months=[...new Set([...localMonths.keys(),...cloudMonths.keys()])].sort().reverse();
  const differences=[];
  for(const month of months){
    const a=localMonths.get(month),b=cloudMonths.get(month);
    const sameCount=a&&b&&a.count===b.count;
    const sameIds=sameCount&&a.hashes.identities===b.hashes.identities;
    const sameAmounts=sameIds&&a.hashes.datesAndCents===b.hashes.datesAndCents;
    const sameDescriptions=sameIds&&a.hashes.descriptionsAndStatuses===b.hashes.descriptionsAndStatuses;
    if(sameIds&&sameAmounts&&sameDescriptions)continue;
    differences.push({
      month,windowsCount:a?.count??0,cloudCount:b?.count??0,
      difference:(b?.count??0)-(a?.count??0),
      status:!a||!b||!sameCount?'count_difference':
        !sameIds?'identity_difference':
        !sameAmounts?'amount_or_date_difference':'text_or_status_difference'
    });
  }
  return {ok:true,contract:'mf-e1-month-delta-v1',stage:'local_only',
    totalDifferenceMonths:differences.length,
    items:differences.slice(0,12),
    limitedResults:differences.length>12||!local.monthlyCoverageComplete||
      !cloud.monthlyCoverageComplete,
    cutoverAllowed:false};
}
