// End-to-end smoke test against a local wrangler dev server.
// Uses only fake data and a throwaway access code; never touches production.
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8787';
const token=process.env.TEST_ACCESS_TOKEN||'local-test-access-code-2026';
const origin=new URL(base).origin;
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
async function request(path,options={}){
 const response=await fetch(base+path,{
  method:options.method||'GET',
  headers:{Origin:origin,'Content-Type':'application/json',...(options.cookie?{Cookie:options.cookie}:{})},
  body:options.data===undefined?undefined:JSON.stringify(options.data)
 });
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
}
const unauth=await request('/api/sync/snapshot');
assert(unauth.status===401,'Sync API must require login');
const login=await request('/api/login',{method:'POST',data:{code:token}});
assert(login.status===200,'Login should work');
const cookie=login.cookie.split(';')[0];
const health=await request('/api/sync/health',{cookie});
assert(health.status===200&&!health.data.financialEnabled,'Financial data must remain disabled');
const forbidden=await request('/api/sync/apply',{cookie,method:'POST',data:{
 mutationId:'forbidden-try-0001',changes:[{collection:'bank_transactions',id:'test',baseRevision:0,deleted:false,value:{amount:100}}]
}});
assert(forbidden.status===400,'Financial writes must be rejected');
const original=await request('/api/sync/snapshot',{cookie});
assert(original.status===200,'Snapshot must work');
const before=original.data.documents.find(x=>x.collection==='test_notes'&&x.id==='ci-sample');
const revision=before?.revision||0;
const first=await request('/api/sync/apply',{cookie,method:'POST',data:{
 mutationId:'first-update-'+Date.now(),changes:[{collection:'test_notes',id:'ci-sample',baseRevision:revision,deleted:false,value:{text:'test one'}}]
}});
assert(first.status===200&&first.data.changes[0].revision===revision+1,'First mutation must commit');
const stale=await request('/api/sync/apply',{cookie,method:'POST',data:{
 mutationId:'second-update-'+Date.now(),changes:[{collection:'test_notes',id:'ci-sample',baseRevision:revision,deleted:false,value:{text:'overwritten'}}]
}});
assert(stale.status===409&&stale.data.conflicts?.length===1,'Stale edit must fail with conflict');
const after=await request('/api/sync/snapshot',{cookie});
const latest=after.data.documents.find(x=>x.collection==='test_notes'&&x.id==='ci-sample');
assert(latest?.revision===revision+1&&latest.value.text==='test one','Committed value must persist');
const page=await request('/api/sync/changes?since=0&limit=10',{cookie});
assert(page.status===200&&page.data.changes.some(x=>x.id==='ci-sample'),'Change stream must be readable');
console.log('Cloud sync e2e PASS: auth, forbidden finance data, snapshot, commit, conflicts and change stream.');