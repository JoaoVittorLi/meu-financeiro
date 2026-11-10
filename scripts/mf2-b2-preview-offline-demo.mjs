// MF2-B1.0 executable CLI, isolated from Worker routes, Cloudflare, databases and paid APIs.
import {createB2PreviewAdapter,composeB2PreviewWorkerGuards,
  B2_PREVIEW_PATH,B2_PREVIEW_CONTRACT} from '../mobile-push/src/finance-b2-preview-adapter.js';
const ORIGIN='https://synthetic-preview.example.invalid';
const OWNER='synthetic-owner-cli';
export async function runPreviewOfflineDemo(){
  const env={APP_ACCESS_TOKEN:'SYNTHETIC_CLI_NOT_REAL_SECRET',TEAM_DOMAIN:'https://synthetic.cloudflareaccess.com'};
  const guards=composeB2PreviewWorkerGuards({env,ownerId:OWNER,
    // Deliberately synthetic assertions: NEVER import actual Worker sessions into this CLI.
    checkSession:async(_r,secret)=>secret===env.APP_ACCESS_TOKEN,
    accessConfigured:e=>typeof e.TEAM_DOMAIN==='string',
    authorizeAccess:async()=>({ok:true,mode:'access'})});
  const seen=new Set();
  const handler=createB2PreviewAdapter({isEnabled:()=>true,expectedOrigin:ORIGIN,
    expectedOwner:OWNER,...guards,replayStore:{async reserve({ownerId,requestId}){
      const key=ownerId+':'+requestId;if(seen.has(key))return false;seen.add(key);return true;
    }}});
  const request=new Request(ORIGIN+B2_PREVIEW_PATH,{method:'POST',headers:{origin:ORIGIN,
    'content-type':'application/json','sec-fetch-site':'same-origin'},body:JSON.stringify({
    contract:B2_PREVIEW_CONTRACT,version:1,requestId:'syn-preview-cli001',scenario:'one_vs_two'
  })});
  const response=await handler(request);
  if(!response.ok)throw Error('Synthetic CLI denied: HTTP '+response.status);
  const result=await response.json();
  if(result.financialSyncEnabled!==false||result.databaseChanged!==false)throw Error('Unsafe demo flags');
  return {mode:'offline_synthetic_preview_adapter',contract:result.contract,
    diagnostic:result.diagnostic,readOnly:result.readOnly,
    databaseChanged:result.databaseChanged,financialSyncEnabled:result.financialSyncEnabled};
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
  runPreviewOfflineDemo().then(result=>process.stdout.write(JSON.stringify(result,null,2)+'\n'))
    .catch(()=>{process.stderr.write('Offline synthetic Preview demonstration failed\n');process.exitCode=1});
}
