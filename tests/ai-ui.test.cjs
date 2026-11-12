'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=(p)=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('Inteligência tem rota própria sem substituir Simular compra',()=>{
 const app=source('src/app.ts');
 assert.match(app,/this\.navItem\('intelligence','spark','Inteligência'\)/);
 assert.match(app,/assistant:this\.renderAssistant/);
 assert.match(app,/intelligence:\(\)=>renderIntelligenceView\(this\)/);
 assert.match(app,/page==='simulator'\?'assistant'/);
});

test('Interface nova mantém Hoje, Conversar e Plano de ação como prévia',()=>{
 const view=source('src/intelligence-view.ts');
 for(const label of ["label:'Hoje'","label:'Conversar'","label:'Plano de ação'","Demonstração isolada","NÃO ENVIADA"])
  assert.ok(view.includes(label),'Esperado na interface: '+label);
 assert.match(view,/renderIntelligencePanel\(app:any\)/);
 assert.match(view,/renderIntelligenceSettings\(app:any\)/);
 assert.match(view,/intelligencePanelOpen:false/);
});

test('Prévia não consulta o banco nem chama provedores de IA',()=>{
 const view=source('src/intelligence-view.ts');
 for(const forbidden of ['api.openai.com','fetch(','bankSync(','getTransactions(','clientSecret','accessToken','Authorization:'])
  assert.ok(!view.includes(forbidden),'Prévia contém chamada/segredo proibido: '+forbidden);
 assert.match(source('app/index.html'),/intelligence\.css/);
 assert.match(source('tsconfig.json'),/src\/intelligence-view\.ts/);
});

test('Painel contextual oferece perguntas para todas as seis áreas',()=>{
 const view=source('src/intelligence-view.ts');
 for(const key of ['overview:','transactions:','planning:','budgets:','assistant:','banks:'])
  assert.ok(view.includes(key),'Contexto ausente: '+key);
 const app=source('src/app.ts');
 assert.match(app,/this\.openIntelligenceContext\('transactions'\)/);
 assert.match(app,/renderIntelligencePanel\(this\)/);
});

test('Configurações não coletam segredos no renderer',()=>{
 const view=source('src/intelligence-view.ts');
 assert.match(view,/Não conectada/);
 assert.match(view,/GPT-6\.1 Sol/);
 assert.match(view,/OAuth e memórias aprovadas são protegidos localmente no Windows/);
 assert.match(source('src/intelligence-integration.ts'),/desktop\.aiConnect/);
});


const ts=require('typescript');

function compileIntelligenceRuntime(){
  const mdSrc=source('src/ai-markdown.ts');
  const viewSrc=source('src/intelligence-view.ts');
  const integSrc=source('src/intelligence-integration.ts');
  const combined=[mdSrc,viewSrc,integSrc].join('\n');
  const js=ts.transpileModule(combined,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2020}}).outputText;
  const h=(name,props,...children)=>({name,props:props||{},children:children.flat()});
  const Icon=props=>({name:'Icon',props});
  const Card=(props,...children)=>({name:'Card',props,children:children.flat()});
  const DEFAULT_CATEGORY_INFOS=[
    {name:'Moradia',kind:'expense'},
    {name:'Alimentação',kind:'expense'},
    {name:'Transporte',kind:'expense'},
    {name:'Lazer',kind:'expense'},
    {name:'Outros',kind:'both'},
    {name:'Salário',kind:'income'}
  ];
  const fn=new Function(
    'h','Icon','Card','DEFAULT_CATEGORY_INFOS','desktop','spanLabel','dateSpan','prettyMonth','iso','document','FinancePeriodLedger',
    js+';return {renderIntelligencePanel,renderIntelligenceView,renderIntelligenceActionProposalCard,intelligenceOpenFullChat,intelligenceSubmitQuestion,intelligenceParseCategorizeIntent,intelligenceBuildCategorizeProposal,intelligenceExpandProposalCandidates,intelligenceSelectActionCandidate,intelligenceResolveActionProposal,intelligenceConversationState,intelligenceCreateThread,intelligenceSelectThread,intelligenceDeleteThread,intelligenceClearHistory,intelligenceGroupThreadsByDate,intelligenceSearchThreads,intelligenceSwitchProfileMode,intelligenceSanitizeThreadList,intelligenceBuildStructuredSummaryCard};'
  );
  return {
    h,
    DEFAULT_CATEGORY_INFOS,
    runtime:fn(
      h,Icon,Card,DEFAULT_CATEGORY_INFOS,null,
      ()=> '01/11/2026 a 11/11/2026',
      ()=> ({start:'2026-11-01',end:'2026-11-11'}),
      ym=>ym,
      ()=> '2026-11-11',
      {getElementById:()=>({focus(){}})},require('../shared/finance-period-ledger.mjs')
    )
  };
}

function makeFakeApp(overrides={}){
  const {DEFAULT_CATEGORY_INFOS}=compileIntelligenceRuntime();
  const app={
    state:{
      today:'2026-11-11',
      mode:'real',
      page:'transactions',
      overviewPeriod:'month',
      customStart:'2026-11-01',
      customEnd:'2026-11-11',
      month:'2026-11',
      planMonth:'2026-11',
      query:'',
      bankFilter:'',
      txReviewOnly:false,
      txOrganize:false,
      txSelected:[],
      detail:null,
      planSelected:null,
      intelligencePanelOpen:true,
      intelligenceContext:'transactions',
      intelligenceTab:'today',
      intelligenceDraft:'',
      intelligencePreparedQuestion:'',
      intelligenceMessages:[],
      aiStatus:{connected:false,secure:false},
      aiCapabilities:null,
      aiBusy:false,
      aiError:'',
      categories:DEFAULT_CATEGORY_INFOS,
      bank:{
        data:{
          transactions:[
            {id:'tx-ifood',accountId:'acc-1',accountName:'Itaú',date:'2026-11-11',description:'IFOOD *RESTAURANTE',merchant:'iFood',amount:-6500,status:'POSTED',category:'Outros',nature:'expense'},
            {id:'tx-mkt-old',accountId:'acc-1',accountName:'Itaú',date:'2026-11-08',description:'SUPERMERCADO VERDEMAR',merchant:'Supermercado Verdemar',amount:-21000,status:'POSTED',category:'Outros',nature:'expense'},
            {id:'tx-mkt-new',accountId:'acc-1',accountName:'Itaú',date:'2026-11-10',description:'MERCADO CENTRAL',merchant:'Mercado Central',amount:-14500,status:'POSTED',category:'Outros',nature:'expense'}
          ]
        }
      },
      data:{
        transactions:[
          {id:'m-1',date:'2026-11-09',description:'Feira livre manual',kind:'expense',amount:4000,category:'Outros'}
        ]
      },
      ...overrides
    },
    setState(patch,cb){
      const next=typeof patch==='function'?patch(this.state):patch;
      this.state={...this.state,...next};
      if(typeof cb==='function')cb();
    }
  };
  return app;
}

test('I1-A.1 múltiplos lançamentos: nunca seleciona iFood para mercado e exige seleção explícita ordenada na ambiguidade',async()=>{
  const {runtime}=compileIntelligenceRuntime();
  const app=makeFakeApp();
  await runtime.intelligenceSubmitQuestion(app,'Categorize minha compra do mercado como Alimentação');
  const msgs=app.state.intelligenceMessages;
  assert.equal(msgs.length,2);
  const reply=msgs[1];
  assert.ok(reply.proposal,'Deve gerar proposta em estado ambíguo');
  assert.equal(reply.proposal.status,'ambiguous');
  assert.equal(reply.proposal.txId,'','Não deve pré-selecionar txId arbitrariamente');
  assert.equal(reply.proposal.candidates.length,2,'Deve encontrar exatamente os 2 mercados, nunca o iFood');
  assert.equal(reply.proposal.candidates.some(c=>c.description.toLowerCase().includes('ifood')),false);
  assert.deepEqual(reply.proposal.candidates.map(c=>c.txId),['tx-mkt-new','tx-mkt-old']);

  runtime.intelligenceResolveActionProposal(app,reply.proposal.id,'approve');
  assert.equal(app.state.intelligenceMessages[1].proposal.status,'ambiguous');

  runtime.intelligenceSelectActionCandidate(app,reply.proposal.id,'bank|acc-1|tx-mkt-old');
  const selected=app.state.intelligenceMessages[1].proposal;
  assert.equal(selected.status,'pending');
  assert.equal(selected.txId,'tx-mkt-old');
  assert.equal(selected.description,'Supermercado Verdemar');
});

test('I1-A.1 identificadores iguais em contas diferentes e datas relativas (ontem / hoje)',async()=>{
  const {runtime}=compileIntelligenceRuntime();
  const app=makeFakeApp({
    today:'2026-11-11',
    bank:{
      data:{
        transactions:[
          {id:'dup-id-1',accountId:'acc-itau',accountName:'Itaú',date:'2026-11-10',description:'MERCADO BAIRRO',merchant:'Mercado Bairro',amount:-8900,status:'POSTED',category:'Outros',nature:'expense'},
          {id:'dup-id-1',accountId:'acc-nubank',accountName:'Nubank',date:'2026-11-10',description:'MERCADO BAIRRO',merchant:'Mercado Bairro',amount:-12900,status:'POSTED',category:'Outros',nature:'expense'}
        ]
      }
    }
  });
  await runtime.intelligenceSubmitQuestion(app,'Categorize minha compra do mercado de ontem como Alimentação');
  const prop=app.state.intelligenceMessages[1].proposal;
  assert.equal(prop.status,'ambiguous');
  assert.deepEqual(prop.candidates.map(c=>c.candidateKey),['bank|acc-nubank|dup-id-1','bank|acc-itau|dup-id-1']);

  runtime.intelligenceSelectActionCandidate(app,prop.id,'bank|acc-itau|dup-id-1');
  const afterSelect=app.state.intelligenceMessages[1].proposal;
  assert.equal(afterSelect.status,'pending');
  assert.equal(afterSelect.accountId,'acc-itau');
  assert.equal(afterSelect.accountName,'Itaú');
  assert.equal(afterSelect.amountCents,8900);
});

test('I1-A.1 rejeita categoria inexistente ou incompatível com a natureza do lançamento',async()=>{
  const {runtime}=compileIntelligenceRuntime();
  const app=makeFakeApp();
  await runtime.intelligenceSubmitQuestion(app,'Categorize minha compra do Mercado Central como Criptomoedas');
  const msgInvalidCat=app.state.intelligenceMessages[1];
  assert.equal(msgInvalidCat.proposal,null);
  assert.match(msgInvalidCat.text,/não existe no seu cadastro/i);

  await runtime.intelligenceSubmitQuestion(app,'Categorize minha compra do Mercado Central como Salário');
  const msgIncompat=app.state.intelligenceMessages[3];
  assert.equal(msgIncompat.proposal,null);
  assert.match(msgIncompat.text,/incompatível/i);
});

test('I1-A.1 confirmação de prévia e negação não realizam escrita financeira e detectam estado desatualizado',async()=>{
  const {runtime}=compileIntelligenceRuntime();
  const app=makeFakeApp();
  await runtime.intelligenceSubmitQuestion(app,'Categorize minha compra do Mercado Central de ontem como Alimentação');
  const prop=app.state.intelligenceMessages[1].proposal;
  assert.equal(prop.status,'pending');
  assert.equal(prop.txId,'tx-mkt-new');

  runtime.intelligenceResolveActionProposal(app,prop.id,'approve');
  const confirmed=app.state.intelligenceMessages[1].proposal;
  assert.equal(confirmed.status,'preview_confirmed');
  assert.match(confirmed.resultMessage,/Prévia validada sem gravação/);
  assert.equal(app.state.bank.data.transactions.find(t=>t.id==='tx-mkt-new').category,'Outros');

  await runtime.intelligenceSubmitQuestion(app,'Categorize minha compra do Supermercado Verdemar como Alimentação');
  const prop2=app.state.intelligenceMessages[3].proposal;
  assert.equal(prop2.status,'pending');
  app.state.bank.data.transactions[1].amount=-99900;
  runtime.intelligenceResolveActionProposal(app,prop2.id,'approve');
  const staleProp=app.state.intelligenceMessages[3].proposal;
  assert.equal(staleProp.status,'stale');
  assert.match(staleProp.resultMessage,/Estado desatualizado/);

  await runtime.intelligenceSubmitQuestion(app,'Categorize meu gasto na Feira livre manual como Alimentação');
  const prop3=app.state.intelligenceMessages[5].proposal;
  assert.equal(prop3.status,'pending');
  assert.equal(prop3.origin,'manual');
  runtime.intelligenceResolveActionProposal(app,prop3.id,'deny');
  assert.equal(app.state.intelligenceMessages[5].proposal.status,'denied');
});

test('I1-A.2 continuidade entre drawer e aba principal e distinção dos 4 estados de conversação (Problemas A, B e C)',async()=>{
  const {runtime}=compileIntelligenceRuntime();

  // Problema C: estado inicial da beta.8 {connected:false, secure:false} deve ser oauth_disconnected e não service_unavailable
  const app=makeFakeApp({aiStatus:{connected:false,secure:false},aiError:''});
  assert.equal(runtime.intelligenceConversationState(app).kind,'oauth_disconnected');
  await runtime.intelligenceSubmitQuestion(app,'Qual é a minha projeção para o próximo trimestre?');
  assert.equal(app.state.intelligenceMessages[1].status,'unavailable');
  assert.match(app.state.intelligenceMessages[1].text,/Conta desconectada/);

  // Conta autenticada mas conversação aberta não implementada
  app.setState({aiStatus:{connected:true,secure:true,email:'user@test.local'},aiCapabilities:{conversationalInferenceEnabled:false}});
  assert.equal(runtime.intelligenceConversationState(app).kind,'oauth_connected_unimplemented');
  await runtime.intelligenceSubmitQuestion(app,'Explique minhas despesas deste mês');
  assert.equal(app.state.intelligenceMessages[3].status,'unimplemented');
  assert.match(app.state.intelligenceMessages[3].text,/Funcionalidade ainda não implementada/);

  // Problema B: quando chat_available é retornado, nunca responder "Conta não autenticada"
  app.setState({aiStatus:{connected:true,secure:true,email:'user@test.local'},aiCapabilities:{conversationalInferenceEnabled:true}});
  assert.equal(runtime.intelligenceConversationState(app).kind,'chat_available');
  await runtime.intelligenceSubmitQuestion(app,'Como está meu orçamento deste mês?');
  assert.equal(app.state.intelligenceMessages[5].status,'unimplemented');
  assert.match(app.state.intelligenceMessages[5].text,/Conta autenticada e serviço de conversação disponível/);
  assert.doesNotMatch(app.state.intelligenceMessages[5].text,/Conta não autenticada|Conta desconectada/);

  // Problema A: erro de conexão existente não pode ser apagado antes de intelligenceConversationState()
  app.setState({aiError:'Falha temporária de conexão'});
  assert.equal(runtime.intelligenceConversationState(app).kind,'service_unavailable');
  await runtime.intelligenceSubmitQuestion(app,'Analise meu fluxo');
  assert.equal(app.state.intelligenceMessages[7].status,'error');
  assert.match(app.state.intelligenceMessages[7].text,/Serviço temporariamente indisponível/);
  assert.match(app.state.intelligenceMessages[7].text,/Falha temporária de conexão/);
  assert.equal(app.state.aiError,'Falha temporária de conexão');

  // Continuidade do histórico entre drawer e aba principal
  const countBefore=app.state.intelligenceMessages.length;
  app.state.categoryReviewOpen=true;app.state.categoryReviewPreview={id:'pending-q1'};
  runtime.intelligenceOpenFullChat(app);
  assert.equal(app.state.categoryReviewOpen,false);assert.equal(app.state.categoryReviewPreview.id,'pending-q1');
  assert.equal(app.state.page,'intelligence');
  assert.equal(app.state.intelligenceTab,'chat');
  assert.equal(app.state.intelligencePanelOpen,false);
  assert.equal(app.state.intelligenceMessages.length,countBefore);
});

test('I1-A.2 desambiguação extensa (> 8 candidatos): preserva todos os candidatos, orienta refinamento e permite expandir/selecionar o 10º item',async()=>{
  const {runtime}=compileIntelligenceRuntime();
  const manyTxs=Array.from({length:11},(_,i)=>({
    id:'tx-padaria-'+(i+1),
    accountId:'acc-'+(i%2===0?'itau':'nubank'),
    accountName:i%2===0?'Itaú':'Nubank',
    date:'2026-11-'+String(11-(i%9)).padStart(2,'0'),
    description:'PADARIA BAIRRO #'+(i+1),
    merchant:'Padaria Bairro '+(i+1),
    amount:-(1500+(i*100)),
    status:'POSTED',
    category:'Outros',
    nature:'expense'
  }));
  const app=makeFakeApp({bank:{data:{transactions:manyTxs}}});
  await runtime.intelligenceSubmitQuestion(app,'Categorize minha compra da padaria como Alimentação');
  const prop=app.state.intelligenceMessages[1].proposal;
  assert.equal(prop.status,'ambiguous');
  assert.equal(prop.candidatesCount,11);
  assert.equal(prop.candidates.length,11,'Não deve truncar a lista real de candidatos em 8');
  assert.equal(prop.visibleLimit,8);

  // Expandir candidatos para visualizar todos os 11 na interface
  runtime.intelligenceExpandProposalCandidates(app,prop.id);
  const expandedProp=app.state.intelligenceMessages[1].proposal;
  assert.equal(expandedProp.visibleLimit,11);

  // Selecionar o 10º candidato (índice 9, além dos 8 iniciais) preservando o identificador composto
  const tenthCandidate=expandedProp.candidates[9];
  assert.ok(tenthCandidate.candidateKey.startsWith('bank|acc-'));
  runtime.intelligenceSelectActionCandidate(app,prop.id,tenthCandidate.candidateKey);
  const finalProp=app.state.intelligenceMessages[1].proposal;
  assert.equal(finalProp.status,'pending');
  assert.equal(finalProp.txId,tenthCandidate.txId);
  assert.equal(finalProp.accountId,tenthCandidate.accountId);
});


test('I1-B histórico compartilhado: persistência segura após reinicialização, agrupamento por data, busca, seleção e exclusão confirmada',async()=>{
  const {runtime}=compileIntelligenceRuntime();
  const storageMap=new Map();
  const fakeStorage={
    getItem:k=>storageMap.has(k)?storageMap.get(k):null,
    setItem:(k,v)=>storageMap.set(k,String(v)),
    removeItem:k=>storageMap.delete(k)
  };
  const app1=makeFakeApp({today:'2026-11-10'});
  app1.chatStorage=fakeStorage;

  await runtime.intelligenceSubmitQuestion(app1,'Categorize minha compra do Mercado Central de hoje como Alimentação');
  const firstThreadId=app1.state.intelligenceActiveThreadId;
  assert.ok(firstThreadId,'Deve criar thread ativa');
  assert.equal(app1.state.intelligenceThreads.length,1);

  app1.setState({today:'2026-11-11'});
  runtime.intelligenceCreateThread(app1);
  await runtime.intelligenceSubmitQuestion(app1,'Mostre um resumo estruturado das minhas movimentações carregadas sk-proj1234567890abcdef');
  const secondThreadId=app1.state.intelligenceActiveThreadId;
  assert.notEqual(secondThreadId,firstThreadId);
  assert.equal(app1.state.intelligenceThreads.length,2);
  assert.ok(app1.state.intelligenceMessages[1].structuredCard,'Deve incluir card estruturado seguro');

  const rawSaved=storageMap.get('mf_ai_threads_v1_real');
  assert.ok(rawSaved,'Deve persistir JSON no storage do perfil real');
  assert.ok(!rawSaved.includes('sk-proj1234567890abcdef'),'Nunca deve persistir tokens ou segredos no histórico');
  assert.ok(rawSaved.includes('[TOKEN_REMOVIDO]'));

  const app2=makeFakeApp({today:'2026-11-11',intelligenceMessages:[]});
  app2.chatStorage=fakeStorage;
  const viewNode=runtime.renderIntelligenceView(app2);
  assert.ok(viewNode);
  assert.equal(app2.state.intelligenceThreads.length,2,'Deve restaurar as 2 conversas após reinicialização');

  const groups=runtime.intelligenceGroupThreadsByDate(app2,'');
  assert.deepEqual(groups.map(g=>g.label),['Hoje','Ontem']);
  const searchFiltered=runtime.intelligenceGroupThreadsByDate(app2,'Mercado Central');
  assert.equal(searchFiltered.length,1);
  assert.equal(searchFiltered[0].items[0].id,firstThreadId);

  runtime.intelligenceSelectThread(app2,firstThreadId);
  assert.equal(app2.state.intelligenceActiveThreadId,firstThreadId);
  assert.match(app2.state.intelligenceMessages[0].text,/Mercado Central/);

  const deletedFalse=runtime.intelligenceDeleteThread(app2,firstThreadId,()=>false);
  assert.equal(deletedFalse,false);
  assert.equal(app2.state.intelligenceThreads.length,2);

  const deletedTrue=runtime.intelligenceDeleteThread(app2,firstThreadId,()=>true);
  assert.equal(deletedTrue,true);
  assert.equal(app2.state.intelligenceThreads.length,1);
  assert.equal(app2.state.intelligenceActiveThreadId,secondThreadId);
});

test('I1-B isolamento de perfis (Pessoal vs Demonstração) e tratamento de erro de armazenamento',async()=>{
  const {runtime}=compileIntelligenceRuntime();
  const storageMap=new Map();
  let failWrites=false;
  const fakeStorage={
    getItem:k=>storageMap.has(k)?storageMap.get(k):null,
    setItem:(k,v)=>{if(failWrites)throw new Error('QuotaExceededError');storageMap.set(k,String(v));}
  };
  const app=makeFakeApp({mode:'real',today:'2026-11-11'});
  app.chatStorage=fakeStorage;

  await runtime.intelligenceSubmitQuestion(app,'Pergunta no perfil pessoal');
  assert.equal(app.state.intelligenceThreads.length,1);

  runtime.intelligenceSwitchProfileMode(app,'demo');
  assert.equal(app.state.intelligenceThreads.length,0);
  assert.equal(app.state.intelligenceMessages.length,0);

  await runtime.intelligenceSubmitQuestion(app,'Pergunta no perfil demonstração');
  assert.equal(app.state.intelligenceThreads.length,1);

  runtime.intelligenceSwitchProfileMode(app,'real');
  assert.equal(app.state.intelligenceThreads.length,1);
  assert.match(app.state.intelligenceMessages[0].text,/perfil pessoal/);

  failWrites=true;
  await runtime.intelligenceSubmitQuestion(app,'Pergunta quando disco cheio');
  assert.match(app.state.intelligenceStorageError,/Não foi possível salvar o histórico/);
});

test('I1-B.1 recusa exclusão quando storage falha: não confirma falso sucesso',async()=>{
  const {runtime}=compileIntelligenceRuntime();const saved=new Map();let fail=false;
  const store={getItem:k=>saved.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('StorageBlocked');saved.set(k,v)}};
  const app=makeFakeApp({today:'2026-11-11'});app.chatStorage=store;
  await runtime.intelligenceSubmitQuestion(app,'Uma pergunta de diagnóstico');
  const id=app.state.intelligenceActiveThreadId;
  fail=true;
  const ok=runtime.intelligenceDeleteThread(app,id,()=>true);
  assert.equal(ok,false,'A função deve recusar a exclusão se não puder persistir');
  assert.equal(app.state.intelligenceThreads.length,1);
  assert.match(app.state.intelligenceStorageError,/Não foi possível salvar/);
  const restarted=makeFakeApp({today:'2026-11-11',intelligenceMessages:[]}); restarted.chatStorage=store;
  runtime.renderIntelligenceView(restarted);
  assert.equal(restarted.state.intelligenceThreads.length,1,'A conversa foi preservada porque o sistema recusou exclusão sem persistência');
});


test('I1-B.1 sanitização alcança metadados aninhados de proposta e tabela',()=>{
  const {runtime}=compileIntelligenceRuntime();
  const row={id:'thread',mode:'real',title:'exemplo',createdAtIso:'2026-11-11',
    updatedAtIso:'2026-11-11',messages:[{id:'msg',role:'assistant',text:'texto seguro',
      proposal:{accountName:'Banco teste',access_token:'SENSITIVE_ABC',description:'sk-proj1234567890123456'},
      structuredCard:{rows:[{col1:'client_secret: OPEN123456789',col2:'valor'}],apiKey:'SENSITIVE_KEY'}}]};
  const saved=JSON.stringify(runtime.intelligenceSanitizeThreadList([row],'real'));
  assert(!saved.includes('SENSITIVE_ABC'));
  assert(!saved.includes('SENSITIVE_KEY'));
  assert(!saved.includes('sk-proj1234567890123456'));
  assert(!saved.includes('OPEN123456789'));
  assert.match(saved,/TOKEN_REMOVIDO/);
});

test('I1-B.1 resumo local evita dupla contagem banco + manual e exclui pendentes',()=>{
  const {runtime}=compileIntelligenceRuntime();
  const card=runtime.intelligenceBuildStructuredSummaryCard({state:{
    mode:'real',dashboardSource:'bank',bank:{data:{truncated:true,transactions:[
      {id:'confirmed',date:'2026-11-10',accountId:'A',status:'POSTED',amount:-10000,category:'Alimentação'},
      {id:'pending',date:'2026-11-10',accountId:'A',status:'PENDING',amount:-3000,category:'Outros'},
      {id:'transfer',date:'2026-11-10',accountId:'A',status:'POSTED',amount:-5000,nature:'transfer',category:'Transferências'}
    ]}},data:{transactions:[{id:'manual-duplicate',kind:'expense',amount:10000,category:'Alimentação'}]}}});
  assert(card);
  const expense=card.metrics.find(x=>x.label==='Saídas confirmadas carregadas');
  assert.match(expense.value,/100,00/);
  assert(!expense.value.includes('230,00'));
  assert.match(card.footnote,/Histórico bancário parcial/);
  assert.match(card.footnote,/nunca banco \+ manual/);
});
