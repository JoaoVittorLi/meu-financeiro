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

test('cliente consulta catálogo e envia apenas cenário fictício e parâmetros permitidos',async()=>{
 const calls=[];
 const fetchFn=async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith('/models'))return {ok:true,json:async()=>({models:[{slug:'gpt-6.1-sol'}]})};
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
 assert.deepEqual(calls.map(c=>c.url),['https://api.openai.com/v1/models','https://api.openai.com/v1/responses']);
 const payload=JSON.parse(calls[1].opts.body);
 assert.equal(payload.store,false);assert.equal(payload.stream,true);
 assert.match(payload.input[0].content,/hipotética/);
 assert.ok(!JSON.stringify(payload).includes('pluggy'));
});
