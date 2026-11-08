'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {AIPersonalStore}=require('../electron/ai-personal.cjs');
const {ChatGPTDemoClient}=require('../electron/ai-client.cjs');
const {buildDemoRequest,publicCapabilities}=require('../shared/ai-policy.mjs');
const {assembleDemoContext,validateMemoryContent}=require('../shared/ai-context.mjs');

function encryptedMock(){
 return {
   isAsyncEncryptionAvailable:async()=>true,
   encryptStringAsync:async text=>Buffer.from('enc:'+Buffer.from(text).toString('base64')),
   decryptStringAsync:async buf=>{
     const x=Buffer.from(buf).toString('utf8');
     if(!x.startsWith('enc:'))throw new Error('cipher inválido');
     return {result:Buffer.from(x.slice(4),'base64').toString('utf8')};
   }
 };
}
function fixture(){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mf-e3-'));
 const store=new AIPersonalStore(folder,encryptedMock());
 return {folder,store,cleanup:()=>fs.rmSync(folder,{recursive:true,force:true})};
}
function mockStream(){
 const text=[
  {type:'response.output_text.delta',delta:'Exemplo fictício com preferência opcional.'},
  {type:'response.completed',response:{usage:{input_tokens:106,output_tokens:39,output_tokens_details:{reasoning_tokens:8}}}}
 ].map(x=>'data: '+JSON.stringify(x)+'\n\n').join('');
 const bytes=new TextEncoder().encode(text);
 return new ReadableStream({start(c){c.enqueue(bytes);c.close();}});
}
test('memórias devem ser explicitamente aprovadas e limitadas; nunca armazenar segredos',async()=>{
 const {folder,store,cleanup}=fixture(),subject='chatgpt-person-123';
 try{
  const list=await store.add(subject,{kind:'preference',text:'Prefiro explicações curtas e cálculos claros'});
  assert.equal(list.length,1);assert.equal(list[0].approved,true);
  assert.equal(list[0].kind,'preference');
  assert.ok(!fs.readFileSync(path.join(folder,'chatgpt-personal.enc'),'utf8').includes('Prefiro explicações'));
  await assert.rejects(store.add(subject,{kind:'preference',text:'Meu access_token é secreto'}),/Não salve/);
  await assert.rejects(store.add(subject,{kind:'goal',text:'1234567890123456'}),/Não salve/);
  await assert.rejects(store.list('outra-conta'),/outra conta/);
  const another=new AIPersonalStore(folder,encryptedMock());
  assert.deepEqual(await another.list(subject),list);
  await store.remove(subject,list[0].id);
  assert.deepEqual(await store.list(subject),[]);
 } finally {cleanup();}
});
test('cofre se recusa a funcionar sem criptografia, preservando o arquivo',async()=>{
 const {folder,store,cleanup}=fixture();
 try{
  await store.add('owner-a',{kind:'goal',text:'Construir reserva de emergência'});
  const failing=new AIPersonalStore(folder,{isAsyncEncryptionAvailable:async()=>false});
  await assert.rejects(failing.list('owner-a'),/criptografada indisponível/);
  await assert.rejects(failing.add('owner-a',{kind:'goal',text:'Outro objetivo'}),/criptografada indisponível/);
  assert.equal((await store.list('owner-a')).length,1);
 }finally{cleanup();}
});
test('contexto sem consentimento é idêntico à pergunta fictícia base',()=>{
 const base=buildDemoRequest('categorize','low');
 const notes=[{id:'1',approved:true,kind:'preference',text:'Prefiro exemplos breves'}];
 const {request,inspection}=assembleDemoContext(base,notes,false);
 assert.deepEqual(request.input,base.input);
 assert.equal(inspection.memoryCount,0);assert.equal(inspection.bankDataIncluded,false);
 assert.equal(inspection.onlyFictitiousFinancialData,true);
 assert.equal(request.store,false);assert.equal(request.stream,true);
 assert.throws(()=>assembleDemoContext(base,notes,'sim'),/Consentimento/);
});
test('contexto explícito contém somente notas aprovadas e cabe no orçamento',()=>{
 const base=buildDemoRequest('budget','medium');
 const notes=[
  {id:'1',approved:true,kind:'preference',text:'Prefiro listas curtas'},
  {id:'2',approved:false,kind:'constraint',text:'Não deve ser enviada'},
  {id:'3',approved:true,kind:'goal',text:'Quero manter liquidez'}
 ];
 const result=assembleDemoContext(base,notes,true);
 assert.equal(result.inspection.memoryCount,2);
 assert.ok(JSON.stringify(result.request.input).includes('Prefiro listas curtas'));
 assert.ok(!JSON.stringify(result.request.input).includes('Não deve ser enviada'));
 assert.ok(result.inspection.inputCharacters<=2500);
});
test('limite de memórias: 12 locais, no máximo 8 usadas no contexto',async()=>{
 const {store,cleanup}=fixture(),owner='owner-test';
 try{
  for(let i=0;i<12;i++)await store.add(owner,{kind:'preference',text:'Nota aprovada número '+i});
  await assert.rejects(store.add(owner,{kind:'goal',text:'Décima terceira nota'}),/Limite de 12/);
  const notes=await store.list(owner);
  assert.equal(notes.length,12);
  const x=assembleDemoContext(buildDemoRequest('planning'),notes,true);
  assert.equal(x.inspection.memoryCount,8);
  await store.clearMemories(owner);
  assert.equal((await store.list(owner)).length,0);
 }finally{cleanup();}
});
test('resposta de teste tem uso registrado sem guardar conversas',async()=>{
 const {folder,store,cleanup}=fixture(),owner='owner-alpha';
 try{
  await store.add(owner,{kind:'preference',text:'Explique cálculos em tópicos'});
  const history=[],fetchFn=async (url,options)=>{
    history.push({url,body:options.body});
    return {ok:true,body:mockStream()};
  };
  const client=new ChatGPTDemoClient({
    auth:{accessToken:async()=> 'fake-token',vault:{read:async()=>({subject:owner})}},
    personalStore:store,fetchFn
  });
  const preview=await client.contextPreview({caseId:'planning',useSavedMemories:true});
  assert.equal(preview.memoryCount,1);
  assert.equal(history.length,0,'Preview não pode consumir tokens.');
  const result=await client.testDemo({caseId:'planning',creditsDisabledConfirmed:true,useSavedMemories:true});
  assert.equal(result.usageStored,true);
  assert.equal(result.context.memoryCount,1);
  assert.equal(history.length,1);
  assert.equal(history[0].url,'https://api.openai.com/v1/responses');
  assert.ok(history[0].body.includes('Explique cálculos'));
  assert.equal(result.model,'gpt-6.1-sol');
  const summary=await store.summary(owner);
  assert.equal(summary.completedSamples,1);
  assert.equal(summary.inputTokens,106);assert.equal(summary.outputTokens,39);
  assert.equal(summary.reasoningTokens,8);
  const encrypted=fs.readFileSync(path.join(folder,'chatgpt-personal.enc'),'utf8');
  assert.ok(!encrypted.includes('Exemplo fictício'),'Nunca guardar respostas na telemetria.');
  assert.ok(!JSON.stringify(summary).includes('fake-token'));
  const caps=publicCapabilities();
  assert.equal(caps.financialDataEnabled,false);
  assert.equal(caps.pwaInferenceEnabled,false);
  assert.equal(caps.paidApiFallback,false);
 }finally{cleanup();}
});
test('nenhuma nota pessoal é enviada sem opt-in do usuário',async()=>{
 const {store,cleanup}=fixture(),owner='owner-alpha';
 try{
  await store.add(owner,{kind:'goal',text:'Meu objetivo é estudar investimentos'});
  const history=[];
  const client=new ChatGPTDemoClient({
   auth:{accessToken:async()=> 'fake-token',vault:{read:async()=>({subject:owner})}},
   personalStore:store,
   fetchFn:async(url,options)=>{history.push(JSON.parse(options.body));return {ok:true,body:mockStream()};}
  });
  await client.testDemo({caseId:'budget',creditsDisabledConfirmed:true,useSavedMemories:false});
  assert.equal(history.length,1);
  assert.equal(history[0].input.length,1);
  assert.ok(!JSON.stringify(history[0]).includes('Meu objetivo'));
 }finally{cleanup();}
});
