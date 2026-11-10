'use strict';
// Deterministic HTTP-shaped loopback. No real socket, fetch, secrets or database.
const {reconcileSnapshots}=require('../shared/mf2-reconciliation.mjs');
const {makeFixture}=require('./mf2-b2-synthetic-demo.cjs');
const {issueSyntheticSession,createSyntheticServer}=require('../shared/mf2-b2-synthetic-transport.cjs');
const {createSyntheticHttpHandler,createInjectedLoopbackFetch,
  createSyntheticHttpClient}=require('../shared/mf2-b2-http-transport.cjs');
const SECRET='SYNTHETIC_ONLY_NEVER_A_REAL_ACCESS_SECRET';
const OWNER='synthetic-owner-http-demo';
const CLOCK=1762800000000;
async function runHttpDemo(){
 const server=createSyntheticServer({secret:SECRET,owner:OWNER,
   cloudFixture:makeFixture(2),reconcile:reconcileSnapshots,now:()=>CLOCK});
 const session=issueSyntheticSession({secret:SECRET,owner:OWNER,expiresAt:CLOCK+60000});
 const handler=createSyntheticHttpHandler({server,enabled:true});
 const fetchImpl=createInjectedLoopbackFetch(handler);
 const client=createSyntheticHttpClient({fetchImpl,session,enabled:true});
 return client.diagnose({requestId:'syn-b2-http-demo-001',windowsFixture:makeFixture(1)});
}
if(require.main===module)runHttpDemo().then(report=>{
 process.stdout.write(JSON.stringify({demo:'synthetic_http_loopback',contract:report.contract,
   summary:report.summary,sources:report.sources,differences:report.differences,
   flowClassification:report.flowClassification,financialSyncEnabled:report.financialSyncEnabled,
   databaseChanged:report.databaseChanged},null,2)+'\n');
}).catch(e=>{process.stderr.write('Synthetic HTTP demo error: '+(e.code||'unhandled')+'\n');process.exitCode=1});
module.exports={runHttpDemo};
