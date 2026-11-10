'use strict';
// Executable synthetic-only B2 demonstration with the real B1 comparator.
// Not an HTTP server; never connects to Cloudflare, Pluggy or local databases.
const {reconcileSnapshots}=require('../shared/mf2-reconciliation.mjs');
const {issueSyntheticSession,createSyntheticServer,createSyntheticClient}
  =require('../shared/mf2-b2-synthetic-transport.cjs');
const OWNER='synthetic-owner-demo';
const SECRET='ONLY_FAKE_B2_OFFLINE_SECRET_NOT_A_REAL_CREDENTIAL';
function makeFixture(count){
  const transactions=[
    {account_id:'SYNTH-ACCOUNT',external_id:'SYNTH-TX001',
      date:'2026-11-10',amount_cents:-1051,status:'POSTED',
      description:'SYNTHETIC: breakfast',category:'Outros'},
    {account_id:'SYNTH-ACCOUNT',external_id:'SYNTH-TX002',
      date:'2026-11-10',amount_cents:-501,status:'PENDING',
      description:'SYNTHETIC: scheduled',category:'Outros'}
  ];
  return {
    accounts:[{account_id:'SYNTH-ACCOUNT',item_id:'SYNTH-ITEM',
      currency:'BRL',balance_cents:0}],
    transactions:transactions.slice(0,count),manualTransactions:[],overlays:[],
    metadata:{snapshotKind:'synthetic',historyComplete:true,overlayCoverage:'complete'}
  };
}
async function runSyntheticDemo(){
  const clock=()=>1762800000000;
  const cloudFixture=makeFixture(2),windowsFixture=makeFixture(1);
  const server=createSyntheticServer({secret:SECRET,owner:OWNER,
    cloudFixture,reconcile:reconcileSnapshots,now:clock});
  const session=issueSyntheticSession({secret:SECRET,owner:OWNER,
    expiresAt:clock()+60000});
  const client=createSyntheticClient({send:server.dispatch,session});
  return client.diagnose({requestId:'syn-b2-demo-001',windowsFixture});
}
if(require.main===module){
  runSyntheticDemo().then(report=>process.stdout.write(
    JSON.stringify({stage:'synthetic_only',summary:report.summary,
      sources:report.sources,flowClassification:report.flowClassification,
      differences:report.differences,financialSyncEnabled:report.financialSyncEnabled},null,2)+'\n'
  )).catch(err=>{
    process.stderr.write('B2 demo failed: '+(err.code||'synthetic_demo_failed')+'\n');
    process.exitCode=1;
  });
}
module.exports={makeFixture,runSyntheticDemo};
