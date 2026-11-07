import test from 'node:test';
import assert from 'node:assert/strict';
import {PluggyReadOnlyProvider} from '../src/pluggy-readonly.js';

const ID='test-client-id',SECRET='TEST-SECRET-NEVER-LOG-OR-UPLOAD-012345';
const APIKEY='test-server-API-KEY-00000001';
const apiResponse=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json'}
});

test('Pluggy server client authenticates, pages accounts and traverses v2 transactions cursor safely',async()=>{
 const requests=[];let clock=1000;
 const fake=async(url,opts)=>{
  requests.push({url,opts});
  if(url==='https://api.pluggy.ai/auth'){
   assert.equal(opts.method,'POST');
   assert.deepEqual(JSON.parse(opts.body),{clientId:ID,clientSecret:SECRET});
   assert.equal(opts.redirect,'manual');
   return apiResponse({apiKey:APIKEY});
  }
  assert.equal(opts.method,'GET');
  assert.equal(opts.headers['X-API-KEY'],APIKEY);
  assert.equal(opts.redirect,'manual');
  const u=new URL(url);
  assert.equal(u.origin,'https://api.pluggy.ai');
  if(u.pathname==='/accounts'){
   const page=Number(u.searchParams.get('page'));
   assert.equal(u.searchParams.get('itemId'),'fictitious-item');
   return apiResponse({results:page===1?[{id:'account-a'}]:[{id:'account-b'}],totalPages:2});
  }
  if(u.pathname==='/v2/transactions'){
   assert.equal(u.searchParams.get('accountId'),'account-a');
   const after=u.searchParams.get('after');
   if(!after)return apiResponse({
    results:[{id:'transaction-1',amount:-25}],
    next:'?accountId=account-a&after=cursor-token-2'
   });
   assert.equal(after,'cursor-token-2');
   return apiResponse({results:[{id:'transaction-2',amount:-45}],next:null});
  }
  throw new Error('Unexpected Pluggy path');
 };
 const client=new PluggyReadOnlyProvider({clientId:ID,clientSecret:SECRET,fetchImpl:fake,clock:()=>clock});
 assert.deepEqual(await client.listAccounts('fictitious-item'),[{id:'account-a'},{id:'account-b'}]);
 assert.deepEqual(await client.listTransactions('account-a'),[
  {id:'transaction-1',amount:-25},{id:'transaction-2',amount:-45}
 ]);
 assert.equal(requests.filter(x=>x.opts.method==='POST').length,1);
 assert.equal(requests.length,5);
 clock+=111*60*1000;
 await client.listTransactions('account-a');
 assert.equal(requests.filter(x=>x.opts.method==='POST').length,2);
 for(const x of requests)assert.doesNotMatch(x.url,/TEST-SECRET|test-client-id|test-server-API-KEY/);
 assert.equal(JSON.stringify(client),'{}');
});

test('cursor anomalies, incomplete history and redirect attempts are rejected',async()=>{
 const auth=url=>url==='https://api.pluggy.ai/auth';
 const init={clientId:ID,clientSecret:SECRET};
 const partial=new PluggyReadOnlyProvider({...init,fetchImpl:async(url)=>{
  if(auth(url))return apiResponse({apiKey:APIKEY});
  return apiResponse({results:[{id:'one'}],next:'?accountId=acct&after=more'});
 }});
 await assert.rejects(()=>partial.listTransactions('acct',{maxPages:2}),/Histórico excedeu/);
 const unsafe=new PluggyReadOnlyProvider({...init,fetchImpl:async(url)=>{
  if(auth(url))return apiResponse({apiKey:APIKEY});
  return apiResponse({results:[{id:'one'}],next:'?accountId=other-account&after=hijack'});
 }});
 await assert.rejects(()=>unsafe.listTransactions('acct'),/Cursor de transações não confiável/);
 const redirectCursor=new PluggyReadOnlyProvider({...init,fetchImpl:async(url)=>{
  if(auth(url))return apiResponse({apiKey:APIKEY});
  return apiResponse({results:[],next:'https://evil.test/steal'});
 }});
 await assert.rejects(()=>redirectCursor.listTransactions('acct'),/Cursor não permitido/);
 const missing=new PluggyReadOnlyProvider({...init,fetchImpl:async(url)=>{
  if(auth(url))return apiResponse({apiKey:APIKEY});
  return apiResponse({results:[],totalPages:'not-an-int'});
 }});
 await assert.rejects(()=>missing.listAccounts('item'),/incompleta/);
 const unauthorized=new PluggyReadOnlyProvider({...init,fetchImpl:async()=>apiResponse({error:'private'},401)});
 await assert.rejects(()=>unauthorized.listAccounts('item'),/Autenticação bancária/);
 const redirected=new PluggyReadOnlyProvider({...init,fetchImpl:async()=>new Response(null,{
  status:302,headers:{Location:'https://attacker.invalid/steal'}
 })});
 await assert.rejects(()=>redirected.listAccounts('item'),/Autenticação bancária/);
});

test('all Pluggy requests pin HTTPS origin and require valid account identifiers',async()=>{
 const client=new PluggyReadOnlyProvider({clientId:ID,clientSecret:SECRET,
  fetchImpl:async()=>apiResponse({apiKey:APIKEY})});
 await assert.rejects(()=>client.listAccounts(''),/Identificador/);
 await assert.rejects(()=>client.listTransactions('bad\nX: evil'),/Identificador/);
 await assert.rejects(()=>client.listAccounts('item',{maxPages:0}),/Limite/);
 await assert.rejects(()=>client.listTransactions('acct',{maxPages:0}),/Limite/);
});
