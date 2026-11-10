'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {AIAuthVault}=require('../electron/ai-vault.cjs');
const {ChatGPTSignIn}=require('../electron/ai-auth.cjs');
const {ChatGPTDemoClient,readSSE}=require('../electron/ai-client.cjs');
const {AI_MODEL,buildDemoRequest,publicCapabilities,selectEffort}=require('../shared/ai-policy.mjs');

test('mesma política de Sol Low/Medium para todos os clientes, sem fallback',()=>{
  const caps=publicCapabilities();
  assert.equal(AI_MODEL,'gpt-6.1-sol');
  assert.deepEqual(caps.efforts,['low','medium']);
  assert.equal(caps.pwaInferenceEnabled,false);
  assert.equal(caps.paidApiFallback,false);
  assert.equal(caps.financialDataEnabled,false);
  assert.equal(selectEffort('categorize'),'low');
  assert.equal(selectEffort('planning'),'medium');
  assert.throws(()=>selectEffort('planning','high'),/não permitido/);
  assert.throws(()=>buildDemoRequest('real-bank-balance'),/não permitido/);
  const payload=buildDemoRequest('budget','medium');
  assert.equal(payload.model,'gpt-6.1-sol');
  assert.deepEqual(payload.reasoning,{mode:'standard',effort:'medium'});
  assert.equal(payload.store,false);assert.equal(payload.stream,true);
  for(const forbidden of ['user','metadata','max_output_tokens','temperature','previous_response_id'])
    assert.equal(Object.hasOwn(payload,forbidden),false);
});

test('cofre isolado exige proteção de credenciais e não grava tokens em claro',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-ai-test-'));
 const safeStorage={
  isAsyncEncryptionAvailable:async()=>true,
  encryptStringAsync:async s=>Buffer.from(s.split('').reverse().join(''),'utf8'),
  decryptStringAsync:async b=>({result:Buffer.from(b).toString('utf8').split('').reverse().join('')})
 };
 try{
  const vault=new AIAuthVault(root,safeStorage);
  const host=await vault.hostId();assert.equal(await vault.hostId(),host);
  await vault.save({client_id:'oaiapp_test_1234',subject:'test-user',access_token:'very-private-token',refresh_token:'private-refresh'});
  assert.ok(!fs.readFileSync(path.join(root,'chatgpt-session.enc'),'utf8').includes('very-private-token'));
  assert.equal((await vault.read()).access_token,'very-private-token');
  assert.equal((await vault.status()).connected,true);
  await vault.clear();assert.equal((await vault.status()).connected,false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('OIDC exige assinatura válida, issuer, audience, validade e nonce corretos',async()=>{
 const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const jwk=publicKey.export({format:'jwk'});jwk.kid='unit-key';jwk.alg='RS256';jwk.use='sig';
 const fetchFn=async url=>({ok:true,json:async()=>url.endsWith('openid-configuration')?
  {issuer:'https://auth.openai.com',jwks_uri:'https://auth.openai.com/test-jwks'}:{keys:[jwk]}});
 const auth=new ChatGPTSignIn({vault:{},openExternal:()=>{},fetchFn});
 const idToken=(nonce,aud='oaiapp_test_1234')=>{
  const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'unit-key'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({iss:'https://auth.openai.com',aud,sub:'test-sub',exp:Math.floor(Date.now()/1000)+3600,nonce})).toString('base64url');
  const body=header+'.'+payload,signature=crypto.sign('sha256',Buffer.from(body),privateKey).toString('base64url');
  return body+'.'+signature;
 };
 assert.equal((await auth.verifyIDToken(idToken('correct'),'oaiapp_test_1234','correct')).subject,'test-sub');
 await assert.rejects(auth.verifyIDToken(idToken('wrong'),'oaiapp_test_1234','correct'),/não validada/);
 await assert.rejects(auth.verifyIDToken(idToken('correct','someone-else'),'oaiapp_test_1234','correct'),/não validada/);
 const tampered=idToken('correct').slice(0,-3)+'aaa';
 await assert.rejects(auth.verifyIDToken(tampered,'oaiapp_test_1234','correct'),/Assinatura/);
});

function fakeSSE(events){
 const bytes=new TextEncoder().encode(events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''));
 return new ReadableStream({start(controller){controller.enqueue(bytes.slice(0,31));controller.enqueue(bytes.slice(31));controller.close();}});
}
test('streaming só aprova resposta.completed e rejeita limite da assinatura',async()=>{
 const result=await readSSE(fakeSSE([
  {type:'response.output_text.delta',delta:'Olá '},
  {type:'response.output_text.delta',delta:'mundo!'},
  {type:'response.completed',response:{usage:{input_tokens:123,output_tokens:15,output_tokens_details:{reasoning_tokens:7}}}}
 ]));
 assert.equal(result.text,'Olá mundo!');
 assert.equal(result.usage.reasoningTokens,7);
 await assert.rejects(readSSE(fakeSSE([{type:'response.output_text.delta',delta:'parcial'}])),/interrompida/);
 await assert.rejects(readSSE(fakeSSE([{type:'response.failed',response:{error:{code:'subscription_sharing_usage_limit_exceeded'}}}])),/Limite de uso/);
});

test('cliente envia apenas cenário fictício sem consulta obrigatória ao catálogo',async()=>{
 const calls=[];
 const fetchFn=async(url,opts)=>{
  calls.push({url,opts});
  assert.equal(url,'https://api.openai.com/v1/responses','Modelo fixo não deve consultar o catálogo.');
  return {ok:true,body:fakeSSE([{type:'response.output_text.delta',delta:'Análise fictícia.'},{type:'response.completed',response:{usage:{input_tokens:100,output_tokens:25}}}])};
 };
 const client=new ChatGPTDemoClient({auth:{accessToken:async()=> 'access_mock'},fetchFn});
 // A proteção rejeita antes de qualquer tentativa de autenticação ou rede.
 // A expressão regular é insensível a caixa: a mensagem pode dizer "confirme".
 await assert.rejects(client.testDemo({caseId:'budget',creditsDisabledConfirmed:false}),/confirme/i);
 assert.equal(calls.length,0,'Confirmação ausente não pode consultar nem o catálogo simulado.');
 assert.equal(client.tests,0,'Confirmação ausente não pode consumir a cota de testes.');
 assert.equal(client.busy,false,'O cliente deve permanecer livre após a recusa.');
 const result=await client.testDemo({caseId:'budget',effort:'medium',creditsDisabledConfirmed:true});
 assert.equal(result.model,'gpt-6.1-sol');assert.equal(result.text,'Análise fictícia.');
 assert.deepEqual(calls.map(c=>c.url),['https://api.openai.com/v1/responses']);
 const payload=JSON.parse(calls[0].opts.body);
 assert.equal(payload.store,false);assert.equal(payload.stream,true);
 assert.match(payload.input[0].content,/hipotética/);
 assert.ok(!JSON.stringify(payload).includes('pluggy'));
});


test('verificação opcional do catálogo informa falha de rede sem bloquear a análise direta',async()=>{
 const calls=[];
 const network=Object.assign(new TypeError('fetch failed'),{cause:{code:'ENOTFOUND'}});
 const client=new ChatGPTDemoClient({
   auth:{accessToken:async()=> 'fake-local-token'},
   fetchFn:async url=>{calls.push(url);throw network;}
 });
 await assert.rejects(
   client.modelAvailable(),
   /etapa de consulta ao catálogo de modelos.*ENOTFOUND.*A análise ainda não foi enviada/i
 );
 assert.deepEqual(calls,['https://api.openai.com/v1/models']);
 assert.equal(client.tests,0,'Consulta opcional ao catálogo não deve consumir tentativa.');
 assert.equal(client.busy,false);
});

test('falha de rede durante envio ao modelo não repete POST e registra uma tentativa',async()=>{
 const calls=[];
 const client=new ChatGPTDemoClient({
   auth:{accessToken:async()=> 'fake-local-token'},
   fetchFn:async(url,options)=>{
     calls.push({url,method:options.method||'GET'});
     throw Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNRESET'}});
   }
 });
 await assert.rejects(
   client.testDemo({caseId:'categorize',effort:'low',creditsDisabledConfirmed:true}),
   /etapa de envio da análise.*ECONNRESET.*Não foi possível confirmar se o servidor recebeu/i
 );
 assert.deepEqual(calls,[
   {url:'https://api.openai.com/v1/responses',method:'POST'}
 ]);
 assert.equal(client.tests,1,'POST possivelmente recebido deve contar como tentativa por segurança.');
 assert.equal(client.busy,false);
});

test('falha de rede ao acessar sessão não consulta APIs nem consome tentativa',async()=>{
 let calls=0;
 const client=new ChatGPTDemoClient({
   auth:{accessToken:async()=>{throw new TypeError('fetch failed');}},
   fetchFn:async()=>{calls++;throw new Error('Não deveria consultar a rede.');}
 });
 await assert.rejects(
   client.testDemo({caseId:'categorize',effort:'low',creditsDisabledConfirmed:true}),
   /etapa de acesso à sessão ChatGPT.*A análise ainda não foi enviada/i
 );
 assert.equal(calls,0);
 assert.equal(client.tests,0);
 assert.equal(client.busy,false);
});


test('todos os três casos fictícios usam somente um POST ao modelo fixo',async()=>{
 for(const caseId of ['categorize','planning','budget']){
   const calls=[];
   const client=new ChatGPTDemoClient({
     auth:{accessToken:async()=> 'mock-token'},
     fetchFn:async(url,options)=>{
       calls.push({url,method:options.method});
       return {ok:true,body:fakeSSE([
         {type:'response.output_text.delta',delta:'Resposta simulada.'},
         {type:'response.completed',response:{usage:{input_tokens:90,output_tokens:18}}}
       ])};
     }
   });
   const result=await client.testDemo({caseId,effort:'auto',creditsDisabledConfirmed:true});
   assert.deepEqual(calls,[{url:'https://api.openai.com/v1/responses',method:'POST'}]);
   assert.equal(result.text,'Resposta simulada.');
   assert.equal(result.caseId,caseId);
   assert.equal(result.onlyFictitiousData,true);
   assert.equal(client.tests,1);
 }
});

test('modelo indisponível no POST não provoca fallback nem repetição',async()=>{
 const calls=[];
 const client=new ChatGPTDemoClient({
   auth:{accessToken:async()=> 'mock-token'},
   fetchFn:async(url,options)=>{
     calls.push({url,method:options.method,model:JSON.parse(options.body).model});
     return {ok:false,status:404};
   }
 });
 await assert.rejects(
   client.testDemo({caseId:'categorize',effort:'low',creditsDisabledConfirmed:true}),
   /HTTP 404/
 );
 assert.deepEqual(calls,[{
   url:'https://api.openai.com/v1/responses',method:'POST',model:AI_MODEL
 }]);
 assert.equal(client.tests,1);
 assert.equal(client.busy,false);
});
