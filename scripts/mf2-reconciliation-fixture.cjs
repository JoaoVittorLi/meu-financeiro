'use strict';
// MF2-01/B1 — reproducible synthetic demo, never opens SQLite or contacts Cloudflare.
const {reconcileSnapshots}=require('../shared/mf2-reconciliation.mjs');
function buildSyntheticB1Report(){
  const account={account_id:'SYNTH-ACC',item_id:'SYNTH-ITEM',currency:'BRL',
    balance_cents:null,updated_at:'2026-11-10'};
  const make=i=>({account_id:'SYNTH-ACC',
    external_id:'SYNTH-'+String(i).padStart(4,'0'),
    date:i<300?'2026-10-05':'2026-11-05',
    description:'only-fake-record',amount_cents:-(1005+i),status:'POSTED',
    category:'Outros',updated_at:'2026-11-10'});
  const windows=Array.from({length:630},(_,i)=>make(i));
  const cloud=Array.from({length:632},(_,i)=>make(i));
  cloud[10].status='PENDING';
  cloud[20].category=null;
  cloud[20].categoryCovered=false;
  return reconcileSnapshots(
    {accounts:[account],transactions:windows,
      metadata:{snapshotKind:'synthetic',historyComplete:null,overlayCoverage:'complete'}},
    {accounts:[account],transactions:cloud,
      metadata:{snapshotKind:'cloud_staging',historyComplete:null,
        lastFetched:630,overlayCoverage:'unavailable'}}
  );
}
if(require.main===module){
  process.stdout.write(JSON.stringify(buildSyntheticB1Report(),null,2)+'\n');
}
module.exports={buildSyntheticB1Report};
