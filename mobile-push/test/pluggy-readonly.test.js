import test from 'node:test';
import assert from 'node:assert/strict';
import {PluggyReadOnlyProvider} from '../src/pluggy-readonly.js';

const ID='test-client-id',SECRET='TEST-SECRET-NEVER-LOG-OR-UPLOAD-012345';
const APIKEY='test-server-API-KEY-00000001';
const apiResponse=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json'}
});

test('server-only Pluggy provider authenticates, paginates bank data and reuses API key',async()=>{
  const requests=[];
  let clock=1000;
  const fake=async(url,init)=>{
    requests.push({url,method:init.method,redirect:init.redirect,headers:init.headers,
      isAuth:init.method==='POST'});
    if(url==='https://api.pluggy.ai/auth'){
      assert.equal(init.method,'POST');
      assert.deepEqual(JSON.parse(init.body),{clientId:ID,clientSecret:SECRET});
      assert.equal(init.redirect,'manual');
      return apiResponse({apiKey:APIKEY});
    }
    assert.equal(init.method,'GET');
    assert.equal(init.headers['X-API-KEY'],APIKEY);
    const u=new URL(url);
    assert.equal(u.origin,'https://api.pluggy.ai');
    assert.equal(init.redirect,'manual');
    const page=Number(u.searchParams.get('page'));
    if(u.pathname==='/accounts'){
      assert.equal(u.searchParams.get('itemId'),'fictitious-item');
      return apiResponse({results:page===1?[{id:'account-a'}]:[{id:'account-b'}],totalPages:2});
    }
    if(u.pathname==='/transactions'){
      assert.equal(u.searchParams.get('accountId'),'account-a');
      return apiResponse({results:[{id:'transaction-'+page,amount:-25}],totalPages:1});
    }
    throw new Error('Unexpected URL');
  };
  const provider=new PluggyReadOnlyProvider({clientId:ID,clientSecret:SECRET,fetchImpl:fake,clock:()=>clock});
  assert.deepEqual(await provider.listAccounts('fictitious-item'),[{id:'account-a'},{id:'account-b'}]);
  assert.deepEqual(await provider.listTransactions('account-a'),[{id:'transaction-1',amount:-25}]);
  assert.equal(requests.filter(x=>x.isAuth).length,1);
  assert.equal(requests.length,4);
  clock+=111*60*1000;
  await provider.listTransactions('account-a');
  assert.equal(requests.filter(x=>x.isAuth).length,2,'Expire API key before Pluggy two-hour TTL');
  for(const x of requests){
    assert.doesNotMatch(x.url,/TEST-SECRET|test-client-id|test-server-API-KEY/);
  }
  assert.equal(JSON.stringify(provider),'{}','Provider secrets are private fields');
});

test('bank API rejects partial history, HTTP failures, malformed response and redirect',async()=>{
  const fixedAuth=url=>url==='https://api.pluggy.ai/auth';
  const init={clientId:ID,clientSecret:SECRET};
  const provider=new PluggyReadOnlyProvider({...init,fetchImpl:async(url)=>{
    if(fixedAuth(url))return apiResponse({apiKey:APIKEY});
    return apiResponse({results:[{id:'one'}],totalPages:6});
  }});
  await assert.rejects(()=>provider.listTransactions('acct',{maxPages:2}),/não cabe/);

  const other=new PluggyReadOnlyProvider({...init,fetchImpl:async(url)=>{
    if(fixedAuth(url))return apiResponse({apiKey:APIKEY});
    return apiResponse({results:[],totalPages:'invalid'});
  }});
  await assert.rejects(()=>other.listAccounts('item'),/incompleta/);

  const unauthorized=new PluggyReadOnlyProvider({...init,fetchImpl:async()=>apiResponse({error:'private'},401)});
  await assert.rejects(()=>unauthorized.listAccounts('item'),/Autenticação bancária/);

  const redirected=new PluggyReadOnlyProvider({...init,fetchImpl:async()=>new Response(null,{
    status:302,headers:{Location:'https://attacker.invalid/steal'}
  })});
  await assert.rejects(()=>redirected.listAccounts('item'),/Autenticação bancária/);
});

test('bank API never constructs client-controlled origins and rejects invalid IDs',async()=>{
  const provider=new PluggyReadOnlyProvider({clientId:ID,clientSecret:SECRET,
    fetchImpl:async()=>apiResponse({apiKey:APIKEY})});
  await assert.rejects(()=>provider.listAccounts(''),/Identificador/);
  await assert.rejects(()=>provider.listTransactions('bad\nX: evil'),/Identificador/);
  await assert.rejects(()=>provider.listAccounts('item',{maxPages:0}),/Limite/);
});
