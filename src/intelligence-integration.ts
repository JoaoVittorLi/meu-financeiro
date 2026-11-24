/* Entrega 2: chamada real apenas com dados fictícios autorizados pelo usuário.
 * Shared policy is imported in Electron and Cloudflare; renderer never sees access tokens. */
async function intelligenceRefresh(app:any){
  if(!desktop?.aiStatus)return;
  try{
    const [status,capabilities,aiCopilotCap,m3ActionCap]=await Promise.all([
      desktop.aiStatus(),
      desktop.aiCapabilities?.()||Promise.resolve(null),
      desktop.aiCopilotCapabilityStatus?.().catch(()=>null)||Promise.resolve(null),
      desktop.copilotActionCapabilityStatus?.().catch(()=>null)||Promise.resolve(null)
    ]);
    app.setState({aiStatus:status,aiCapabilities:capabilities,aiCopilotCap,m3ActionCap,aiError:''});
    if(status.connected)void intelligenceLoadPersonal(app);
    else app.setState({aiMemories:[],aiUsageStats:null,aiUseMemories:false,aiPreview:null});
  }
  catch(e:any){app.setState({aiError:'Não foi possível consultar o estado da conexão.'});}
}
async function intelligenceConnect(app:any){
  if(!desktop?.aiConnect||app.state.aiBusy)return;
  app.setState({aiBusy:true,aiError:'',aiResult:null,aiStreaming:''});
  try{const status=await desktop.aiConnect();app.setState({aiStatus:status,aiBusy:false});void intelligenceLoadPersonal(app);}
  catch(e:any){app.setState({aiBusy:false,aiError:String(e?.message||'Autorização não concluída.').slice(0,250)});}
}
async function intelligenceDisconnect(app:any){
  if(!desktop?.aiDisconnect||app.state.aiBusy)return;
  if(!confirm('Sair do ChatGPT neste computador? Para revogar o acesso remoto, use também as configurações de segurança do ChatGPT. Seus dados financeiros não serão afetados.'))return;
  app.setState({aiBusy:true,aiError:'',aiResult:null,aiStreaming:''});
  try{const status=await desktop.aiDisconnect();app.setState({aiStatus:status,aiBusy:false,aiCreditsConfirmed:false,aiMemories:[],aiUsageStats:null,aiUseMemories:false,aiPreview:null});}
  catch(e:any){app.setState({aiBusy:false,aiError:'Não foi possível desconectar.'});}
}
async function intelligenceTest(app:any){
  if(!desktop?.aiRunDemo||!app.state.aiStatus.connected||app.state.aiBusy)return;
  if(!app.state.aiCreditsConfirmed){app.setState({aiError:'Confirme que os créditos adicionais estão desativados no ChatGPT.'});return;}
  app.setState({aiBusy:true,aiError:'',aiResult:null,aiStreaming:''});
  try{
    const result=await desktop.aiRunDemo({caseId:app.state.aiDemoCase,effort:app.state.aiEffort,creditsDisabledConfirmed:true,useSavedMemories:app.state.aiUseMemories===true});
    app.setState({aiBusy:false,aiResult:result,aiPreview:result.context||null});
    void intelligenceLoadPersonal(app);
  }catch(e:any){app.setState({aiBusy:false,aiError:String(e?.message||'Teste não concluído.').slice(0,300)});}
}

async function intelligenceLoadPersonal(app:any){
  if(!desktop?.aiMemoryList||!desktop?.aiUsageSummary||!app.state.aiStatus.connected)return;
  try{
    const [memories,usage]=await Promise.all([desktop.aiMemoryList(),desktop.aiUsageSummary()]);
    app.setState({aiMemories:memories,aiUsageStats:usage,aiMemoryError:''});
  }catch(e:any){app.setState({aiMemoryError:String(e?.message||'Cofre local indisponível.').slice(0,180),aiUseMemories:false});}
}
async function intelligenceAddMemory(app:any){
  if(!desktop?.aiMemoryAdd||app.state.aiMemoryBusy)return;
  app.setState({aiMemoryBusy:true,aiMemoryError:''});
  try{
    const list=await desktop.aiMemoryAdd({kind:app.state.aiMemoryKind,text:app.state.aiMemoryDraft});
    app.setState({aiMemoryBusy:false,aiMemories:list,aiMemoryDraft:'',aiPreview:null});
    void intelligenceLoadPersonal(app);
  }catch(e:any){app.setState({aiMemoryBusy:false,aiMemoryError:String(e?.message||'Não foi possível salvar.').slice(0,210)});}
}
async function intelligenceRemoveMemory(app:any,id:string){
  if(!desktop?.aiMemoryRemove||app.state.aiMemoryBusy)return;
  if(!confirm('Excluir esta memória do cofre local?'))return;
  app.setState({aiMemoryBusy:true,aiMemoryError:''});
  try{
    const list=await desktop.aiMemoryRemove(id);
    app.setState({aiMemoryBusy:false,aiMemories:list,aiPreview:null});
  }catch(e:any){app.setState({aiMemoryBusy:false,aiMemoryError:String(e?.message||'Falha ao excluir.').slice(0,180)});}
}
async function intelligenceClearMemories(app:any){
  if(!desktop?.aiMemoryClear||app.state.aiMemoryBusy)return;
  if(!confirm('Excluir permanentemente TODAS as memórias locais da IA? Isso não altera contas ou transações.'))return;
  app.setState({aiMemoryBusy:true,aiMemoryError:''});
  try{
    const list=await desktop.aiMemoryClear();
    app.setState({aiMemoryBusy:false,aiMemories:list,aiUseMemories:false,aiPreview:null});
  }catch(e:any){app.setState({aiMemoryBusy:false,aiMemoryError:String(e?.message||'Falha ao limpar.').slice(0,180)});}
}
async function intelligencePreviewContext(app:any){
  if(!desktop?.aiContextPreview||app.state.aiMemoryBusy)return;
  try{
    const result=await desktop.aiContextPreview({caseId:app.state.aiDemoCase,effort:app.state.aiEffort,useSavedMemories:app.state.aiUseMemories===true});
    app.setState({aiPreview:result,aiMemoryError:''});
  }catch(e:any){app.setState({aiPreview:null,aiMemoryError:String(e?.message||'Prévia indisponível.').slice(0,200)});}
}

async function intelligenceBuildFinanceDemo(app){
  if(!desktop?.aiFinancialContextDemo||app.state.aiFinancialDemoBusy)return;
  const source=app.state.aiFinancialDemoSource;
  if(source!=='bank'&&source!=='manual')return;
  app.setState({aiFinancialDemoBusy:true,aiFinancialDemo:null,aiFinancialDemoError:''});
  try{
    const report=await desktop.aiFinancialContextDemo(source);
    if(report?.stage!=='synthetic_financial_context_preview'||report.source!==source||
       report.realFinancialDataIncluded!==false||report.inferenceCalled!==false||
       report.changesApplied!==false||report.cloudCutoverAllowed!==false)
      throw new Error('Prévia financeira não autorizada.');
    app.setState({aiFinancialDemoBusy:false,aiFinancialDemo:report});
  }catch(err){
    app.setState({aiFinancialDemoBusy:false,aiFinancialDemo:null,
      aiFinancialDemoError:String(err?.message||'Prévia indisponível.').slice(0,180)});
  }
}
function renderIntelligenceFinancialContext(app){
 const s=app.state,r=s.aiFinancialDemo;
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
 const budgets=r?r.budgets.map(b=>h('p',{key:b.category},b.category+': '+
   money(b.spentCents)+' / '+money(b.limitCents)+' · '+(b.pct===null?'sem limite':b.pct+'%'))):[];
 const warnings=r?r.warnings.map((w,i)=>h('li',{key:i},w)):[];
 return h('section',{className:'mf-ai-financial-demo'},
   h('span',{className:'micro-label'},'ENTREGA 4.1 · MOTOR FINANCEIRO'),
   h('h2',{},'Prévia financeira estruturada'),
   h('p',{},'Demonstração fictícia de novembro/2026. Não consulta suas contas nem envia conteúdo ao GPT.'),
   h('div',{className:'mf-ai-finance-controls'},
     h('label',{},'Fonte fictícia',
       h('select',{value:s.aiFinancialDemoSource,
         onChange:e=>app.setState({aiFinancialDemoSource:e.target.value,
           aiFinancialDemo:null,aiFinancialDemoError:''})},
         h('option',{value:'bank'},'Banco fictício'),
         h('option',{value:'manual'},'Lançamentos manuais fictícios'))),
     h('button',{type:'button',className:'primary-button',
       disabled:s.aiFinancialDemoBusy,onClick:()=>intelligenceBuildFinanceDemo(app)},
       s.aiFinancialDemoBusy?'Calculando...':'Gerar prévia sem tokens')),
   r?h('div',{className:'mf-ai-finance-results'},
     h('p',{className:'mf-ai-finance-privacy'},'Dados fictícios · Nenhuma chamada de IA · Nenhuma alteração'),
     h('div',{className:'mf-ai-finance-metrics'},
       h('div',{},h('small',{},'Receitas lançadas'),h('strong',{},money(r.realized.incomeCents))),
       h('div',{},h('small',{},'Despesas lançadas'),h('strong',{},money(r.realized.expenseCents))),
       h('div',{},h('small',{},'Diferença — não é saldo'),h('strong',{},money(r.realized.netCents)))),
     h('div',{className:'mf-ai-finance-grid'},
       h('div',{},h('h3',{},'Orçamentos fictícios'),...budgets),
       h('div',{},h('h3',{},'Compromissos fictícios'),
         h('p',{},'Despesas futuras confirmadas: '+money(r.future.pendingConfirmedExpensesCents)),
         h('p',{},'Receitas futuras incertas: '+money(r.future.futureUncertainIncomeCents)))),
     h('h3',{},'Avisos sobre dados não verificados'),
     h('ul',{},...warnings),
     h('details',{className:'mf-ai-finance-payload'},
       h('summary',{},'Inspecionar contexto (não enviado)'),
       h('pre',{},r.contextText),
       h('small',{},'Estimativa textual: '+r.estimatedInputTokensApprox+' tokens; não é consumo.'))):
     h('p',{className:'mf-ai-muted'},'Selecione uma fonte e gere o exemplo sem usar IA.'),
   s.aiFinancialDemoError?h('p',{className:'mf-ai-error',role:'alert'},s.aiFinancialDemoError):null);
}

function renderIntelligencePrivacy(app:any){
  const s=app.state,connected=Boolean(s.aiStatus?.connected);
  const types=[{id:'preference',label:'Preferência'},{id:'goal',label:'Objetivo'},{id:'constraint',label:'Restrição'}];
  return h('section',{className:'mf-ai-personal-panel','aria-label':'Memória aprovada e economia de tokens'},
    h('div',{className:'mf-ai-personal-head'},
      h('div',{},h('span',{className:'micro-label'},'ENTREGA 3 · MEMÓRIA E CONTEXTO'),
        h('h2',{},'Personalização sob seu controle'),
        h('p',{},'Memórias criptografadas apenas neste computador. Nada é enviado ao modelo sem sua autorização por teste. O PWA usa a mesma política de contexto, mas ainda não sincroniza memórias.'))),
    connected?h('div',{className:'mf-ai-personal-form'},
      h('label',{},'Tipo de memória',
        h('select',{value:s.aiMemoryKind,onChange:(e:any)=>app.setState({aiMemoryKind:e.target.value})},
          types.map(x=>h('option',{key:x.id,value:x.id},x.label)))),
      h('label',{},'O que você quer que o assistente considere?',
        h('input',{type:'text',value:s.aiMemoryDraft,maxLength:180,
          placeholder:'Ex.: Prefiro explicações curtas e cálculos claros',
          onChange:(e:any)=>app.setState({aiMemoryDraft:e.target.value})})),
      h('button',{type:'button',className:'ghost-button',disabled:s.aiMemoryBusy||!(s.aiMemoryDraft||'').trim(),
        onClick:()=>intelligenceAddMemory(app)},s.aiMemoryBusy?'Salvando...':'Aprovar e salvar memória')):h('p',{className:'mf-ai-notice'},'Conecte o ChatGPT no Windows para gerenciar memórias locais vinculadas à sua conta.'),
    connected?h('div',{className:'mf-ai-memory-list'},
      h('div',{className:'mf-ai-memory-row mf-ai-memory-title'},
        h('strong',{},'Memórias aprovadas ('+(s.aiMemories||[]).length+'/12)'),
        h('button',{type:'button',className:'mf-ai-link',disabled:!(s.aiMemories||[]).length||s.aiMemoryBusy,
          onClick:()=>intelligenceClearMemories(app)},'Limpar todas')),
      (s.aiMemories||[]).length?
        s.aiMemories.map((note:any)=>h('div',{className:'mf-ai-memory-row',key:note.id},
          h('div',{},h('span',{className:'mf-ai-kind'},types.find(x=>x.id===note.kind)?.label||note.kind),
            h('p',{},note.text)),
          h('button',{type:'button',className:'ghost-button',disabled:s.aiMemoryBusy,
            onClick:()=>intelligenceRemoveMemory(app,note.id)},'Excluir'))):
        h('p',{className:'mf-ai-muted'},'Nenhuma memória salva. O modelo não conhece preferências pessoais por meio deste recurso.')):null,
    connected?h('div',{className:'mf-ai-consent-panel'},
      h('label',{className:'mf-ai-check'},
        h('input',{type:'checkbox',checked:s.aiUseMemories===true&&!!s.aiMemories.length,
          disabled:!(s.aiMemories||[]).length||s.aiBusy,
          onChange:(e:any)=>app.setState({aiUseMemories:Boolean(e.target.checked),aiPreview:null})}),
        h('span',{},'Incluir memórias aprovadas no próximo teste fictício. O texto selecionado será enviado ao Sol apenas se eu executar o teste.')),
      h('button',{type:'button',className:'ghost-button',disabled:s.aiMemoryBusy||s.aiBusy,
        onClick:()=>intelligencePreviewContext(app)},'Ver contexto antes de enviar'),
      s.aiPreview?h('div',{className:'mf-ai-context-preview'},
        h('strong',{},'Prévia local — nenhuma chamada de IA'),
        h('p',{},'Modelo: '+s.aiPreview.model+' · Memórias: '+s.aiPreview.memoryCount+' · Caracteres de entrada: '+s.aiPreview.inputCharacters+' · Estimativa aproximada: '+s.aiPreview.estimatedInputTokensApprox+' tokens.'),
        h('p',{},'Pergunta fictícia: '+s.aiPreview.question),
        s.aiPreview.memoryNotes?.map((note:any,i:number)=>h('p',{key:i},'Memória '+(i+1)+': '+note.text)),
        h('small',{},'Esta estimativa não inclui instruções, saída ou raciocínio; não representa a franquia da conta.')):null):null,
    connected?h('div',{className:'mf-ai-usage-panel'},
      h('strong',{},'Consumo registrado neste dispositivo'),
      s.aiUsageStats?h('p',{},'Testes concluídos registrados: '+s.aiUsageStats.completedSamples+
        ' · Entrada: '+s.aiUsageStats.inputTokens+
        ' tokens · Saída: '+s.aiUsageStats.outputTokens+
        ' tokens · Raciocínio: '+s.aiUsageStats.reasoningTokens+' tokens'):h('p',{},'Nenhum dado local de uso disponível.'),
      h('small',{},'Métricas observadas, não o limite do ChatGPT; apenas as últimas 60 respostas concluídas, sem conteúdo de mensagens.')):null,
    s.aiMemoryError?h('p',{className:'mf-ai-error',role:'alert'},s.aiMemoryError):null);
}

function renderIntelligenceConnection(app:any){
 const s=app.state,connected=Boolean(s.aiStatus?.connected),available=Boolean(desktop?.aiStatus);
 const cases=Array.isArray(s.aiCapabilities?.demoCases)?s.aiCapabilities.demoCases:[];
 return h('div',{className:'mf-ai-live-panel'},
   h('div',{className:'mf-ai-live-head'},
     h('div',{},h('span',{className:'micro-label'},'ENTREGA 2 · TESTE DE AUTORIZAÇÃO'),
       h('h2',{},'Conectar ao ChatGPT'),
       h('p',{},'Os testes abaixo utilizam apenas perguntas fictícias predefinidas. Nenhuma movimentação real é compartilhada.')),
     h('span',{className:'mf-ai-live-state '+(connected?'ready':'')},connected?'Conectado':'Não conectado')),
   h('div',{className:'mf-ai-live-actions'},
     !connected?h('button',{type:'button',className:'primary-button',disabled:!available||s.aiBusy||s.aiStatus?.secure===false&&s.aiStatus?.secure!==undefined,
        onClick:()=>intelligenceConnect(app)},'Continuar com ChatGPT'):h('button',{type:'button',className:'ghost-button',disabled:s.aiBusy,onClick:()=>intelligenceDisconnect(app)},'Sair deste computador'),
     h('button',{type:'button',className:'ghost-button',disabled:!available||s.aiBusy,onClick:()=>intelligenceRefresh(app)},'Atualizar estado')),
   !available?h('p',{className:'mf-ai-notice'},'A conexão exige a versão Electron atualizada. Esta prévia web não suporta autenticação de assinatura.'):null,
   connected?h('div',{className:'mf-ai-live-settings'},
     h('p',{},'Conta autorizada: '+(s.aiStatus.email||'conta ChatGPT validada')+' · Modelo exclusivo: GPT-6.2 Sol'),
     h('label',{},'Teste fictício',h('select',{value:s.aiDemoCase,onChange:(e:any)=>app.setState({aiDemoCase:e.target.value})},
       cases.map(c=>h('option',{key:c.id,value:c.id},c.label)))),
     h('label',{},'Raciocínio',h('select',{value:s.aiEffort,onChange:(e:any)=>app.setState({aiEffort:e.target.value})},
       ['auto','low','medium','high'].map(e=>h('option',{key:e,value:e},e==='auto'?'Automático':e==='low'?'Baixo':e==='medium'?'Médio':'Alto')))),
     h('label',{className:'mf-ai-check'},h('input',{type:'checkbox',checked:s.aiCreditsConfirmed,
       onChange:(e:any)=>app.setState({aiCreditsConfirmed:Boolean(e.target.checked)})}),
       h('span',{},'Conferi em Configurações → Uso: créditos adicionais desativados e limite semanal do aplicativo abaixo de 100%.')),
     h('button',{type:'button',className:'primary-button',disabled:s.aiBusy||!s.aiCreditsConfirmed,
       onClick:()=>intelligenceTest(app)},s.aiBusy?'Executando teste...':'Testar GPT-6.2 Sol com dados fictícios'),
     h('p',{className:'mf-ai-usage-warning'},'As configurações de créditos e o teto semanal são controlados pelo ChatGPT. Limite deste aplicativo abaixo de 100% impede uso de créditos adicionais nessa modalidade. O app não consegue verificar esses ajustes automaticamente. O teste conta com limite preventivo de três solicitações por sessão.')):null,
   s.aiBusy?h('p',{className:'mf-ai-progress',role:'status'},'Aguardando autenticação ou conclusão do teste...'):null,
   s.aiStreaming&&!s.aiResult?h('div',{className:'mf-ai-stream',role:'status'},h('strong',{},'Resposta em andamento'),h('p',{},s.aiStreaming.slice(0,12000))):null,
   s.aiResult?h('div',{className:'mf-ai-test-result'},
     h('span',{className:'micro-label'},'TESTE CONCLUÍDO · APENAS DADOS FICTÍCIOS'),
     h('div',{className:'mf-ai-markdown'},...aiMarkdownNodes(s.aiResult.text||'Nenhum texto retornado.')),
     s.aiResult.usageStored===false?h('small',{},'As métricas desta resposta não puderam ser salvas no histórico local.'):null,
     h('small',{},'Modelo '+s.aiResult.model+' · esforço '+s.aiResult.effort+
       (s.aiResult.usage?' · entrada '+s.aiResult.usage.inputTokens+' tokens · saída '+s.aiResult.usage.outputTokens+' tokens':''))):null,
   s.aiError?h('p',{className:'mf-ai-error',role:'alert'},s.aiError):null);
}


/* ==========================================================================
   I1-A.2: MÁQUINA DE ESTADOS DE CONVERSAÇÃO, DESAMBIGUAÇÃO COMPLETA E PRÉVIA SEM GRAVAÇÃO
   ========================================================================== */
function intelligenceNowTime():string{
  const d=new Date();
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function intelligenceFoldText(value:string):string{
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
}
function intelligenceConversationState(app:any):{kind:'service_unavailable'|'chat_available'|'oauth_connected_needs_optin'|'oauth_disconnected';pill:string;badge:string;css:string}{
  if(app.state.categoryReviewGrant)return {kind:'chat_available',pill:app.state.categoryReviewGrant.expiresAt>Date.now()?'Revisão sintética · sem IA externa':'Revisão sintética expirada',badge:'Revisão sintética',css:'is-local'};
  const s=app?.state||{};
  const solEnabled=Boolean(s.aiCopilotCap?.enabled);
  if(app.state.localFinancialAccess?.token){
    const active=app.state.localFinancialAccess.expiresAt>Date.now();
    return {
      kind:'chat_available',
      pill:active?(s.aiStatus?.connected&&solEnabled?'Leitura local + GPT-6.2 Sol ativos':'Leitura local autorizada · sem IA externa'):'Leitura local expirada',
      badge:'Leitura local',
      css:'is-local'
    };
  }
  const activeError=String(s.aiError||s.aiStatus?.error||'').trim();
  const explicitUnavailable=Boolean(
    activeError||
    s.aiStatus?.unavailable===true||
    s.aiStatus?.serviceAvailable===false||
    s.aiCapabilities?.serviceAvailable===false||
    (s.aiStatus?.connected===true&&s.aiStatus?.secure===false)
  );
  if(explicitUnavailable){
    return {kind:'service_unavailable',pill:'Serviço temporariamente indisponível',badge:'Indisponível',css:'is-error'};
  }
  if(s.aiStatus?.connected===true){
    if(solEnabled){
      return {kind:'chat_available',pill:'ChatGPT conectado · GPT-6.2 Sol ativo (modo geral)',badge:'GPT-6.2 Sol ativo',css:'is-ready'};
    }
    return {kind:'oauth_connected_needs_optin',pill:'ChatGPT conectado · ative o GPT-6.2 Sol para conversar',badge:'Ativação pendente',css:'is-auth-only'};
  }
  return {kind:'oauth_disconnected',pill:'ChatGPT não conectado · leitura local sob autorização',badge:'Sem OAuth',css:'is-offline'};
}
function intelligenceReferenceToday(app:any):string|null{
  const custom=app?.state?.today;
  if(typeof custom==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(custom))return custom;
  const now=new Date();
  return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}
function intelligenceShiftIsoDate(baseIso:string,deltaDays:number):string|null{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(baseIso))return null;
  const [y,m,d]=baseIso.split('-').map(Number);
  const dt=new Date(Date.UTC(y,m-1,d+deltaDays));
  if(!Number.isFinite(dt.getTime()))return null;
  return dt.toISOString().slice(0,10);
}
function intelligenceValidateIsoDate(y:number,m:number,d:number):string|null{
  if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d)||y<2000||y>2100||m<1||m>12||d<1||d>31)return null;
  const dt=new Date(Date.UTC(y,m-1,d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==m||dt.getUTCDate()!==d)return null;
  return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
function intelligenceParseCategorizeIntent(question:string,categories:any[],referenceToday?:string|null):{
  term:string;
  targetCategory:string;
  categoryInfo:{name:string;kind:'expense'|'income'|'both'}|null;
  dateFilter:string|null;
  invalidDate:string|null;
  amountCentsFilter:number|null;
  originFilter:'all'|'bank'|'manual';
}|null{
  const clean=String(question||'').trim();
  const m=/(?:categoriz(?:e|ar)|classifiqu(?:e|ar)|mud(?:e|ar)\s+a?\s*categoria(?:\s+d[aeo])?)\s+(.+?)\s+(?:como|para)\s+([A-Za-zÀ-ÿ0-9\s_-]+?)[.?!]*$/i.exec(clean);
  if(!m)return null;
  let body=m[1].trim();
  const rawCat=m[2].trim().replace(/^["'“”]|["'“”]$/g,'').trim();
  if(!body||!rawCat)return null;

  let originFilter:'all'|'bank'|'manual'='all';
  if(/\b(?:lan[çc]amento\s+manual|registro\s+manual|manualmente|manual)\b/i.test(body)){
    originFilter='manual';
    body=body.replace(/\b(?:no\s+lan[çc]amento\s+manual|lan[çc]amento\s+manual|registro\s+manual|manualmente|manual)\b/gi,' ');
  }else if(/\b(?:no\s+banco|do\s+banco|banc[áa]ri[ao]s?)\b/i.test(body)){
    originFilter='bank';
    body=body.replace(/\b(?:no\s+banco|do\s+banco|na\s+conta\s+banc[áa]ria|banc[áa]ri[ao]s?)\b/gi,' ');
  }

  let dateFilter:string|null=null;
  let invalidDate:string|null=null;
  const refIso=referenceToday&&/^\d{4}-\d{2}-\d{2}$/.test(referenceToday)?referenceToday:intelligenceReferenceToday(null);

  const isoMatch=/\b(\d{4})-(\d{2})-(\d{2})\b/.exec(body);
  const brFullMatch=/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(body);
  const brShortMatch=!brFullMatch?/\b(\d{1,2})\/(\d{1,2})\b/.exec(body):null;

  if(isoMatch){
    const valid=intelligenceValidateIsoDate(Number(isoMatch[1]),Number(isoMatch[2]),Number(isoMatch[3]));
    if(valid)dateFilter=valid;else invalidDate=isoMatch[0];
    body=body.replace(isoMatch[0],' ');
  }else if(brFullMatch){
    const valid=intelligenceValidateIsoDate(Number(brFullMatch[3]),Number(brFullMatch[2]),Number(brFullMatch[1]));
    if(valid)dateFilter=valid;else invalidDate=brFullMatch[0];
    body=body.replace(brFullMatch[0],' ');
  }else if(brShortMatch&&refIso){
    const refYear=Number(refIso.slice(0,4));
    const valid=intelligenceValidateIsoDate(refYear,Number(brShortMatch[2]),Number(brShortMatch[1]));
    if(valid)dateFilter=valid;else invalidDate=brShortMatch[0];
    body=body.replace(brShortMatch[0],' ');
  }else if(/\banteontem\b/i.test(body)){
    if(refIso)dateFilter=intelligenceShiftIsoDate(refIso,-2);else invalidDate='anteontem';
    body=body.replace(/\b(?:de\s+)?anteontem\b/gi,' ');
  }else if(/\bontem\b/i.test(body)){
    if(refIso)dateFilter=intelligenceShiftIsoDate(refIso,-1);else invalidDate='ontem';
    body=body.replace(/\b(?:de\s+)?ontem\b/gi,' ');
  }else if(/\bhoje\b/i.test(body)){
    if(refIso)dateFilter=refIso;else invalidDate='hoje';
    body=body.replace(/\b(?:de\s+)?hoje\b/gi,' ');
  }

  let amountCentsFilter:number|null=null;
  const amtMatch=/(?:no\s+valor\s+de\s+|de\s+|por\s+)?R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?\b|(?:no\s+valor\s+de\s+|de\s+)(\d{1,6}),(\d{2})\b/i.exec(body);
  if(amtMatch){
    const wholeRaw=(amtMatch[1]||amtMatch[3]||'').replace(/\./g,'');
    const decRaw=(amtMatch[2]||amtMatch[4]||'0').padEnd(2,'0');
    const cents=Number(wholeRaw)*100+Number(decRaw);
    if(Number.isSafeInteger(cents)&&cents>0)amountCentsFilter=cents;
    body=body.replace(amtMatch[0],' ');
  }

  body=body
    .replace(/^(?:a\s+|o\s+|minha\s+|meu\s+)?(?:compra|despesa|gasto|lan[çc]amento|pagamento|transa[çc][ãa]o|recebimento|receita)?\s*(?:d[aeo]s?\s+|no\s+|na\s+|em\s+)?/i,'')
    .replace(/\b(?:feita|feito|realizada|realizado|no\s+dia|em|de|do|da)\s*$/i,'')
    .replace(/^["'“”]|["'“”]$/g,'')
    .replace(/\s+/g,' ')
    .trim();

  const catFold=intelligenceFoldText(rawCat);
  const catList=Array.isArray(categories)&&categories.length?categories:(typeof DEFAULT_CATEGORY_INFOS!=='undefined'?DEFAULT_CATEGORY_INFOS:[]);
  const foundCat=catList.find((c:any)=>intelligenceFoldText(c.name)===catFold)||null;
  return {
    term:body,
    targetCategory:foundCat?String(foundCat.name):rawCat,
    categoryInfo:foundCat?{name:String(foundCat.name),kind:(foundCat.kind||'expense') as 'expense'|'income'|'both'}:null,
    dateFilter,
    invalidDate,
    amountCentsFilter,
    originFilter
  };
}
function intelligenceMatchesEstablishment(labelFold:string,termFold:string):boolean{
  if(!termFold||!labelFold)return false;
  if(labelFold.includes(termFold))return true;
  const tokens=termFold.split(' ').filter(t=>t.length>=3);
  if(tokens.length>1&&tokens.every(t=>labelFold.includes(t)))return true;
  return false;
}
function intelligenceBuildCategorizeProposal(app:any,intent:NonNullable<ReturnType<typeof intelligenceParseCategorizeIntent>>):{
  text:string;
  proposal:IntelligenceActionProposal|null;
  details?:string;
}{
  const s=app.state||{};
  if(intent.invalidDate){
    return {
      text:'Não foi possível determinar a data **'+intent.invalidDate+'** informada no pedido. Informe uma data válida (ex.: `06/11/2026`, `hoje` ou `ontem`) antes de preparar a prévia.',
      proposal:null,
      details:'Validação determinística de data rejeitou o parâmetro de data.'
    };
  }
  const catList=Array.isArray(s.categories)&&s.categories.length?s.categories:(typeof DEFAULT_CATEGORY_INFOS!=='undefined'?DEFAULT_CATEGORY_INFOS:[]);
  if(!intent.categoryInfo){
    const validNames=catList.map((c:any)=>c.name).slice(0,14).join(', ');
    return {
      text:'A categoria **'+intent.targetCategory+'** não existe no seu cadastro atual. Escolha uma categoria válida ('+validNames+') antes de preparar a prévia.',
      proposal:null,
      details:'Categorias inexistentes são bloqueadas antes de construir propostas.'
    };
  }
  if(!intent.term){
    return {
      text:'Informe o nome do estabelecimento ou descrição do lançamento que deseja classificar como **'+intent.categoryInfo.name+'**.',
      proposal:null,
      details:'Nenhum termo de estabelecimento foi identificado na solicitação.'
    };
  }

  const termFold=intelligenceFoldText(intent.term);
  const bankTxs:any[]=(s.mode==='demo'||intent.originFilter==='manual')?[]:(Array.isArray(s.bank?.data?.transactions)?s.bank.data.transactions:[]);
  const manualTxs:any[]=intent.originFilter==='bank'?[]:(Array.isArray(s.data?.transactions)?s.data.transactions:[]);
  const rawMatches:(IntelligenceActionCandidate & {natureRaw:string})[]=[];

  for(const b of bankTxs){
    const displayTitle=String(b.customTitle||b.merchant||b.description||'Movimentação bancária');
    const rawDesc=String(b.description||displayTitle);
    const searchable=intelligenceFoldText(displayTitle+' '+rawDesc+' '+(b.accountName||''));
    if(!intelligenceMatchesEstablishment(searchable,termFold))continue;
    if(intent.dateFilter&&String(b.date)!==intent.dateFilter)continue;
    const absAmount=Math.abs(Number(b.amount||0));
    if(intent.amountCentsFilter!==null&&absAmount!==intent.amountCentsFilter)continue;
    const nature=b.nature&&b.nature!=='auto'?String(b.nature):(Number(b.amount)>=0?'income':'expense');
    const txKind:'expense'|'income'=nature==='income'?'income':'expense';
    const accId=String(b.accountId||'');
    const accName=String(b.accountName||accId||'Conta bancária');
    rawMatches.push({
      candidateKey:'bank|'+accId+'|'+String(b.id),
      origin:'bank',
      txId:String(b.id),
      accountId:accId,
      accountName:accName,
      description:displayTitle,
      rawDescription:rawDesc,
      date:String(b.date||''),
      amountCents:absAmount,
      txKind,
      currentCategory:String(b.category||'Outros'),
      natureRaw:nature
    });
  }

  for(const m of manualTxs){
    const desc=String(m.description||'Lançamento manual');
    const searchable=intelligenceFoldText(desc);
    if(!intelligenceMatchesEstablishment(searchable,termFold))continue;
    if(intent.dateFilter&&String(m.date)!==intent.dateFilter)continue;
    const absAmount=Math.abs(Number(m.amount||0));
    if(intent.amountCentsFilter!==null&&absAmount!==intent.amountCentsFilter)continue;
    const txKind:'expense'|'income'=m.kind==='income'?'income':'expense';
    rawMatches.push({
      candidateKey:'manual|manual|'+String(m.id),
      origin:'manual',
      txId:String(m.id),
      accountId:'manual',
      accountName:'Manual',
      description:desc,
      rawDescription:desc,
      date:String(m.date||''),
      amountCents:absAmount,
      txKind,
      currentCategory:String(m.category||'Outros'),
      natureRaw:txKind
    });
  }

  if(rawMatches.length===0){
    const filterNotes=[
      intent.dateFilter?'data '+intent.dateFilter:null,
      intent.amountCentsFilter!==null?'valor R$ '+(intent.amountCentsFilter/100).toFixed(2).replace('.',','):null,
      intent.originFilter!=='all'?'origem '+(intent.originFilter==='bank'?'bancária':'manual'):null
    ].filter(Boolean).join(', ');
    return {
      text:'Não encontrei nenhuma movimentação correspondente a **'+intent.term+'**'+(filterNotes?' ('+filterNotes+')':'')+' para classificar como **'+intent.categoryInfo.name+'**.',
      proposal:null,
      details:'Busca determinística verificou '+bankTxs.length+' registro(s) bancário(s) e '+manualTxs.length+' manual(is).'
    };
  }

  const nonTransfer=rawMatches.filter(r=>r.natureRaw!=='transfer'&&r.natureRaw!=='ignore');
  if(nonTransfer.length===0){
    return {
      text:'O lançamento localizado para **'+intent.term+'** está marcado como transferência ou ignorado e não pode receber a categoria **'+intent.categoryInfo.name+'**.',
      proposal:null,
      details:'Transferências próprias e lançamentos ignorados não aceitam reclassificação de receita/despesa.'
    };
  }

  const compatible=nonTransfer.filter(r=>intent.categoryInfo!.kind==='both'||intent.categoryInfo!.kind===r.txKind);
  if(compatible.length===0){
    const expectedKind=intent.categoryInfo.kind==='income'?'receita (entrada)':'despesa (saída)';
    return {
      text:'A categoria **'+intent.categoryInfo.name+'** é exclusiva para **'+expectedKind+'**, mas o lançamento localizado (**'+nonTransfer[0].description+'**) possui natureza incompatível.',
      proposal:null,
      details:'Incompatibilidade entre a direção do movimento e o tipo da categoria cadastrada.'
    };
  }

  compatible.sort((a,b)=>
    b.date.localeCompare(a.date)||
    b.amountCents-a.amountCents||
    a.description.localeCompare(b.description,'pt-BR')||
    a.candidateKey.localeCompare(b.candidateKey)
  );

  const cleanCandidates:IntelligenceActionCandidate[]=compatible.map(({natureRaw:_n,...rest})=>rest);

  if(cleanCandidates.length>1){
    const dates=new Set(cleanCandidates.map(c=>c.date));
    const dateNote=dates.size>1
      ?'Ordenados por data verificada (de '+cleanCandidates[0].date+' a '+cleanCandidates[cleanCandidates.length-1].date+').'
      :'Todos registrados na mesma data ('+cleanCandidates[0].date+').';
    const extraNote=cleanCandidates.length>8
      ?' Exibindo inicialmente 8 de '+cleanCandidates.length+' resultados; você pode refinar a busca (por data, valor exato ou origem) ou expandir a lista completa abaixo.'
      :'';
    return {
      text:'Foram encontrados **'+cleanCandidates.length+' lançamentos** compatíveis com **'+intent.term+'**. '+dateNote+extraNote+' Para evitar seleção arbitrária, escolha explicitamente abaixo qual lançamento deseja preparar na prévia para **'+intent.categoryInfo.name+'**:',
      proposal:{
        id:'prop-'+Date.now(),
        kind:'categorize',
        origin:cleanCandidates[0].origin,
        txId:'',
        accountId:'',
        accountName:'',
        description:'Seleção pendente ('+cleanCandidates.length+' opções)',
        date:cleanCandidates[0].date,
        amountCents:0,
        txKind:cleanCandidates[0].txKind,
        currentCategory:'',
        proposedCategory:intent.categoryInfo.name,
        status:'ambiguous',
        candidates:cleanCandidates,
        candidatesCount:cleanCandidates.length,
        visibleLimit:8
      },
      details:'Ambiguidade detectada entre '+cleanCandidates.length+' registros ordenados por data/valor/identidade. Todos os candidatos foram preservados sem truncamento.'
    };
  }

  const chosen=cleanCandidates[0];
  return {
    text:'Localizei exatamente 1 movimentação compatível: **'+chosen.description+'** ('+(chosen.origin==='bank'?'Banco · '+chosen.accountName:'Manual')+' em '+chosen.date+'). Confira abaixo a prévia sem gravação para **'+intent.categoryInfo.name+'**.',
    proposal:{
      id:'prop-'+Date.now(),
      kind:'categorize',
      origin:chosen.origin,
      txId:chosen.txId,
      accountId:chosen.accountId,
      accountName:chosen.accountName,
      description:chosen.description,
      rawDescription:chosen.rawDescription,
      date:chosen.date,
      amountCents:chosen.amountCents,
      txKind:chosen.txKind,
      currentCategory:chosen.currentCategory,
      proposedCategory:intent.categoryInfo.name,
      status:'pending',
      candidatesCount:1,
      visibleLimit:1
    },
    details:'Correspondência única verificada por estabelecimento, origem, data, valor e compatibilidade de categoria.'
  };
}
function intelligenceExpandProposalCandidates(app:any,proposalId:string,step?:number){
  const list:IntelligenceChatMessage[]=Array.isArray(app.state.intelligenceMessages)?app.state.intelligenceMessages:[];
  const updated=list.map((msg:IntelligenceChatMessage)=>{
    if(!msg.proposal||msg.proposal.id!==proposalId||!Array.isArray(msg.proposal.candidates))return msg;
    const total=msg.proposal.candidates.length;
    const currentLimit=typeof msg.proposal.visibleLimit==='number'&&msg.proposal.visibleLimit>0?msg.proposal.visibleLimit:8;
    const nextLimit=typeof step==='number'&&step>0?Math.min(total,currentLimit+step):total;
    return {
      ...msg,
      proposal:{
        ...msg.proposal,
        visibleLimit:nextLimit
      }
    };
  });
  intelligenceSyncThreadMessages(app,updated);
}
function intelligenceVerifyProposalRecord(app:any,p:IntelligenceActionProposal):{ok:boolean;reason?:string}{
  const s=app?.state||{};
  const catList=Array.isArray(s.categories)&&s.categories.length?s.categories:(typeof DEFAULT_CATEGORY_INFOS!=='undefined'?DEFAULT_CATEGORY_INFOS:[]);
  const catInfo=catList.find((c:any)=>c.name===p.proposedCategory);
  if(!catInfo)return {ok:false,reason:'A categoria proposta “'+p.proposedCategory+'” não existe mais no cadastro.'};
  if(catInfo.kind!=='both'&&catInfo.kind!==p.txKind)return {ok:false,reason:'A categoria “'+p.proposedCategory+'” tornou-se incompatível com a natureza do lançamento.'};

  if(p.origin==='bank'){
    if(s.mode==='demo')return {ok:false,reason:'O aplicativo entrou em modo demonstração; registros bancários reais não estão ativos.'};
    const txs:any[]=Array.isArray(s.bank?.data?.transactions)?s.bank.data.transactions:[];
    const rec=txs.find((t:any)=>String(t.id)===p.txId&&String(t.accountId||'')===String(p.accountId||''));
    if(!rec)return {ok:false,reason:'A movimentação bancária (conta '+(p.accountName||p.accountId)+') não foi localizada no estado atual.'};
    const nature=rec.nature&&rec.nature!=='auto'?String(rec.nature):(Number(rec.amount)>=0?'income':'expense');
    if(nature==='transfer'||nature==='ignore')return {ok:false,reason:'A natureza da movimentação mudou para transferência/ignorado.'};
    const recKind=nature==='income'?'income':'expense';
    if(recKind!==p.txKind)return {ok:false,reason:'A direção contábil da movimentação foi alterada.'};
    if(String(rec.date||'')!==p.date)return {ok:false,reason:'A data da movimentação mudou de '+p.date+' para '+String(rec.date||'')+'.'};
    if(Math.abs(Number(rec.amount||0))!==p.amountCents)return {ok:false,reason:'O valor da movimentação foi alterado desde a criação da proposta.'};
    if(String(rec.category||'Outros')!==p.currentCategory)return {ok:false,reason:'A categoria atual mudou de “'+p.currentCategory+'” para “'+String(rec.category||'Outros')+'”.'};
    return {ok:true};
  }

  const manualTxs:any[]=Array.isArray(s.data?.transactions)?s.data.transactions:[];
  const rec=manualTxs.find((t:any)=>String(t.id)===p.txId);
  if(!rec)return {ok:false,reason:'O lançamento manual não foi localizado no estado atual.'};
  const recKind=rec.kind==='income'?'income':'expense';
  if(recKind!==p.txKind)return {ok:false,reason:'O tipo do lançamento manual foi alterado.'};
  if(String(rec.date||'')!==p.date)return {ok:false,reason:'A data do lançamento manual mudou de '+p.date+' para '+String(rec.date||'')+'.'};
  if(Math.abs(Number(rec.amount||0))!==p.amountCents)return {ok:false,reason:'O valor do lançamento manual foi alterado.'};
  if(String(rec.category||'Outros')!==p.currentCategory)return {ok:false,reason:'A categoria atual mudou de “'+p.currentCategory+'” para “'+String(rec.category||'Outros')+'”.'};
  return {ok:true};
}
function intelligenceSelectActionCandidate(app:any,proposalId:string,candidateKey:string){
  const list:IntelligenceChatMessage[]=Array.isArray(app.state.intelligenceMessages)?app.state.intelligenceMessages:[];
  const updated=list.map((msg:IntelligenceChatMessage)=>{
    if(!msg.proposal||msg.proposal.id!==proposalId||msg.proposal.status!=='ambiguous')return msg;
    const cand=(msg.proposal.candidates||[]).find(c=>c.candidateKey===candidateKey);
    if(!cand)return msg;
    const nextProposal:IntelligenceActionProposal={
      ...msg.proposal,
      origin:cand.origin,
      txId:cand.txId,
      accountId:cand.accountId,
      accountName:cand.accountName,
      description:cand.description,
      rawDescription:cand.rawDescription,
      date:cand.date,
      amountCents:cand.amountCents,
      txKind:cand.txKind,
      currentCategory:cand.currentCategory,
      status:'pending',
      resultMessage:'Lançamento selecionado. Confira os dados abaixo para validar a prévia sem gravação.'
    };
    const check=intelligenceVerifyProposalRecord(app,nextProposal);
    if(!check.ok){
      return {
        ...msg,
        proposal:{
          ...nextProposal,
          status:'stale' as const,
          resultMessage:'Estado desatualizado ao selecionar: '+check.reason
        }
      };
    }
    return {...msg,proposal:nextProposal};
  });
  intelligenceSyncThreadMessages(app,updated);
}
function intelligenceResolveActionProposal(app:any,proposalId:string,decision:'approve'|'deny'){
  const list:IntelligenceChatMessage[]=Array.isArray(app.state.intelligenceMessages)?app.state.intelligenceMessages:[];
  const updated=list.map((msg:IntelligenceChatMessage)=>{
    if(!msg.proposal||msg.proposal.id!==proposalId)return msg;
    if(decision==='deny'){
      return {
        ...msg,
        proposal:{
          ...msg.proposal,
          status:'denied' as const,
          resultMessage:'Proposta negada pelo usuário. Nenhuma alteração foi realizada.'
        }
      };
    }
    if(msg.proposal.status==='ambiguous'||!msg.proposal.txId){
      return {
        ...msg,
        proposal:{
          ...msg.proposal,
          resultMessage:'Selecione explicitamente um dos lançamentos listados antes de confirmar a prévia.'
        }
      };
    }
    const p=msg.proposal;
    const check=intelligenceVerifyProposalRecord(app,p);
    if(!check.ok){
      return {
        ...msg,
        proposal:{
          ...p,
          status:'stale' as const,
          resultMessage:'Estado desatualizado: '+check.reason+' Nenhuma alteração foi validada.'
        }
      };
    }
    return {
      ...msg,
      proposal:{
        ...p,
        status:'preview_confirmed' as const,
        resultMessage:'Prévia validada sem gravação: identidade ('+(p.origin==='bank'?'Banco · '+(p.accountName||p.accountId):'Manual')+'), data ('+p.date+'), valor e categoria ('+p.currentCategory+' → '+p.proposedCategory+') conferidos. Nenhuma alteração é gravada sem sua confirmação supervisionada.'
      }
    };
  });
  intelligenceSyncThreadMessages(app,updated);
}
function intelligenceIsM3ActionIntent(foldedQuestion:string):boolean{
  const q=String(foldedQuestion||'');
  return /\b(coloque|coloquem|categoriz|recategoriz|classifiqu|reclassifiqu|mova|mover|alter[ea]r?\s+(?:a\s+)?categoria|mud[ea]r?\s+(?:a\s+)?categoria)\b/.test(q)||
    /(salario|salarios|renda|remuneracao|holerite|recebi|ganho).*(orcament|limite|reorganiz|organiz|distribu|redistribu|ajust|guardar|poupar|reservar)|(?:reorganiz|redistribu|recalcul|equilibr)\w*\s+(?:os?\s+|meus?\s+)?orcament/.test(q)||
    /^(?:por favor,?\s*)?(?:sempre que|toda vez que)\b/.test(q)||
    /\b(?:regra(?:\s+futura|\s+automatica)?\s+(?:para|quando)|(?:desativ|paus|desabilit|ativ|reabilit|habilit)\w*\s+(?:a\s+)?regra)\b/.test(q)||
    /\b(?:crie|criar|adicione|adicionar|inclua|incluir|nova|renomei\w*|mud\w*\s+o\s+nome|alter\w*\s+o\s+nome)\s+(?:a\s+)?(?:subcategoria|categoria)\b/.test(q)||
    /^(?:por favor,?\s*)?(?:deixe|defin\w*|ajust\w*|mud\w*|alter\w*|coloque|fique com)\s+(?:o\s+|meu\s+)?(?:limite|orcamento|teto)\b/.test(q)||
    /\b(?:despesa prevista|receita prevista|conta prevista|compromisso|parcela prevista|planejamento)\b.*\b(?:registr|adicion|crie|criar|agend|cancel|reativ|acabamos de simular|simul)\b|\b(?:registr|adicion|crie|criar|agend|cancel|reativ)\w*.*\b(?:despesa prevista|receita prevista|conta prevista|compromisso|parcela prevista|planejamento)\b/.test(q)||
    /^(?:por favor,?\s*)?(?:alter|mud|atualiz|ajust|remarqu)\w*\s+(?:o\s+|a\s+)?(?:vencimento|data|valor)\b/.test(q)||
    /\b(?:gostei.*mais|guardar.*a mais|poupar.*a mais|aument\w*.*reserva|trave |fixe |destrave|desbloque|reduza mais|use o valor que voce sugeriu|economia sugerida|reducao sugerida)\b/.test(q);
}
function intelligenceClassifyQuestion(question:string):'m3_action'|'personal_financial'|'general'{
  const f=intelligenceFoldText(question);
  if(intelligenceIsM3ActionIntent(f))return 'm3_action';
  const educationalHowTo=/\bcomo\s+(?:organizar|controlar|montar|construir|administrar|planejar|estruturar|equilibrar|dividir|criar)\b/.test(f)&&
    !/\b(extrato|saldo|fatura|neste\s+mes|este\s+mes|mes\s+passado|ultim[oa]s?\s+\d*\s*(?:mes|dias)|gastei|recebi|paguei|lancament|movimentac|minhas\s+contas|projecao|orcamento\s+de)\b/.test(f);
  if(educationalHowTo)return 'general';
  if(/\b(meu\s+(?:extrato|saldo|orcamento|fluxo)|minha\s+(?:conta|fatura|projecao|renda)|minhas\s+(?:contas|despesas|receitas|financas|movimentacoes|compras|parcelas)|meus\s+(?:gastos|orcamentos|compromissos|lancamentos|limites)|orcamento\s+de\b|quanto\s+sobrou|gastei(?:\s+mais)?|onde\s+(?:mais\s+gastei|gastei\s+mais|posso\s+economizar)|quais\s+(?:os\s+|meus\s+)?gastos|faturas?|parcelas?|a\s+pagar|assinaturas?|recorrentes?|economizei|recebi\s+(?:este|no)\s+mes|paguei|ultrapass|estourou|compar[ea]\s+minhas|movimentacoes\s+a\s+revisar|proximo\s+(?:mes|trimestre))\b/.test(f))return 'personal_financial';
  if(/\b(quanto\s+(?:gastei|paguei|recebi|tenho\s+comprometido)|quais\s+foram\s+(?:os?\s+)?(?:maiores|meus|minhas)|estabelecimentos\s+onde\s+mais|por\s+que\s+(?:gastei|minhas?\s+despesas)|analise\s+(?:meu\s+fluxo|meus\s+gastos))\b/.test(f))return 'personal_financial';
  if(/\bse\s+eu\s+comprar\b|\bposso\s+comprar\b/.test(f))return 'personal_financial';
  return 'general';
}
function intelligenceRecentPlainHistory(messages:IntelligenceChatMessage[],limit=6,opts?:{excludeFinancial?:boolean}):Array<{role:'user'|'assistant';text:string}>{
  const out:Array<{role:'user'|'assistant';text:string}>=[];
  const list=Array.isArray(messages)?messages:[];
  const excludeFinancial=opts?.excludeFinancial!==false;
  for(const m of list.slice(-14)){
    if(!m||!m.text)continue;
    if(m.role!=='user'&&m.role!=='assistant')continue;
    if(m.role==='assistant'&&m.status!=='done')continue;
    if(excludeFinancial){
      if(/^(?:local-|ic2-|m3a-|review-)/.test(String(m.id||'')))continue;
      if((m as any).structuredCard||(m as any).ic2Reply||(m as any).visual||(m as any).visualV3||(m as any).m3ActionDraft||m.proposal)continue;
      if(/R\$\s*-?\d|Consulta local ·|Prévia supervisionada|O que aconteceu:|Total de entradas|Saldo nas contas/i.test(String(m.text)))continue;
    }
    const text=String(m.text).replace(/\s+/g,' ').trim().slice(0,450);
    if(text)out.push({role:m.role,text});
  }
  return out.slice(-limit);
}
async function intelligenceSubmitQuestion(app:any,rawQuestion:string){
  if(typeof categoryReviewHandleQuestion==='function'&&categoryReviewHandleQuestion(app,rawQuestion))return;
  const grant=app.state.localFinancialAccess;
  const grantValid=!!grant?.token&&(!Number.isFinite(grant.expiresAt)||grant.expiresAt>Date.now());
  if(grantValid&&typeof localFinancialSubmit==='function')return localFinancialSubmit(app,rawQuestion);
  const q=String(rawQuestion||'').trim().slice(0,750);
  if(!q||app.state.aiBusy||app.state.intelligenceDrawerBusy||app.state.aiCopilotBusy)return;
  const priorError=String(app.state.aiError||app.state.aiStatus?.error||'').trim();
  const convState=intelligenceConversationState(app);
  const scope=app.state.intelligencePanelOpen&&app.state.intelligenceContextSnapshot
    ?app.state.intelligenceContextSnapshot
    :intelligencePageScope(app,app.state.page);
  const now=intelligenceNowTime();
  const userMsg:IntelligenceChatMessage={
    id:'usr-'+Date.now(),
    role:'user',
    text:q,
    createdAt:now,
    scopeLabel:scope.label,
    periodLabel:scope.period,
    status:'sent'
  };
  intelligenceEnsureHydrated(app);
  const todayIso=intelligenceReferenceToday(app)||'2026-11-11';
  userMsg.createdAtIso=todayIso;
  const currentMessages:IntelligenceChatMessage[]=Array.isArray(app.state.intelligenceMessages)?app.state.intelligenceMessages:[];
  app.setState({
    intelligenceMessages:[...currentMessages,userMsg],
    intelligenceDraft:'',
    intelligencePreparedQuestion:'',
    intelligenceDraftScope:scope
  },()=>intelligenceScrollChatToBottom());

  const desktopConsentRequired=typeof (desktop as any)?.localFinancialAuthorize==='function'&&app.state.mode!=='demo'&&!grantValid;
  const catIntent=intelligenceParseCategorizeIntent(q,app.state.categories,todayIso);
  if(catIntent){
    const built=intelligenceBuildCategorizeProposal(app,catIntent);
    const reply:IntelligenceChatMessage={
      id:'ast-'+(Date.now()+1),
      role:'assistant',
      text:built.text,
      createdAt:intelligenceNowTime(),
      createdAtIso:todayIso,
      scopeLabel:scope.label,
      periodLabel:scope.period,
      status:'done',
      details:built.details,
      proposal:built.proposal
    };
    intelligenceSyncThreadMessages(app,[...currentMessages,userMsg,reply],scope);
    return;
  }

  const wantsLocalSummary=/\b(?:resumo\s+estruturado|tabela\s+de\s+categorias|resumo\s+das\s+minhas\s+movimenta[çc][õo]es)\b/i.test(q);
  const structuredCard=wantsLocalSummary&&!desktopConsentRequired?intelligenceBuildStructuredSummaryCard(app):null;
  const intent=intelligenceClassifyQuestion(q);

  const appendAssistant=(partial:Partial<IntelligenceChatMessage>)=>{
    const reply:IntelligenceChatMessage={
      id:'ast-'+(Date.now()+1),
      role:'assistant',
      text:'',
      createdAt:intelligenceNowTime(),
      createdAtIso:todayIso,
      scopeLabel:scope.label,
      periodLabel:scope.period,
      status:'done',
      structuredCard,
      ...partial
    };
    intelligenceSyncThreadMessages(app,[...currentMessages,userMsg,reply],scope);
  };

  if((wantsLocalSummary&&desktopConsentRequired)||(!wantsLocalSummary&&(intent==='m3_action'||intent==='personal_financial'))){
    appendAssistant({
      status:'permission_needed',
      structuredCard:null,
      text:intent==='m3_action'
        ?'**Autorização financeira necessária para preparar esta ação:** para examinar seus lançamentos, categorias ou orçamento antes de gerar uma prévia confirmável, autorize a leitura financeira desta sessão. Nenhuma escrita ocorre sem prévia, confirmação nativa e recibo reversível.'
        :'**Autorização de leitura financeira necessária:** por segurança, seus gastos, orçamento, faturas e compromissos locais só são consultados após você autorizar a leitura financeira desta sessão. Nenhuma resposta pessoal foi estimada ou simulada.',
      permissionActions:[
        {id:'authorize_local_read',label:'Autorizar leitura financeira agora',primary:true,retryQuestion:q}
      ],
      details:'Escopo: '+scope.label+' ('+scope.period+') · Aguardando permissão de leitura financeira nesta sessão.'
    });
    return;
  }

  const api=desktop as any;
  if(convState.kind==='service_unavailable'){
    const errReason=priorError||(app.state.aiStatus?.connected&&app.state.aiStatus?.secure===false?'cofre de criptografia local indisponível':'falha temporária de comunicação com o serviço de IA');
    appendAssistant({
      status:'error',
      text:'**Serviço temporariamente indisponível:** Não foi possível acessar o serviço de IA neste momento ('+errReason+'). Nenhuma resposta foi simulada.',
      permissionActions:[{id:'open_ai_settings',label:'Verificar em Configurações de IA'}],
      details:'Estado: '+convState.pill+' · '+errReason
    });
    return;
  }

  if(!wantsLocalSummary&&app.state.aiStatus?.connected&&app.state.aiCopilotCap?.enabled&&typeof api?.aiCopilotAsk==='function'){
    const startMode:'real'|'demo'=app.state.mode==='demo'?'demo':'real';
    const startThreadId=app.state.intelligenceActiveThreadId||null;
    const requestId='sol-gen-'+Date.now()+'-'+Math.floor(Math.random()*10000);
    const isStillCurrent=()=>
      (app.state.mode==='demo'?'demo':'real')===startMode&&
      (app.state.intelligenceActiveThreadId||null)===startThreadId&&
      app.state.aiCopilotRequestId===requestId;
    app.setState({aiCopilotBusy:true,aiCopilotStreaming:'',aiCopilotRequestId:requestId,aiError:''},()=>intelligenceScrollChatToBottom());
    try{
      const history=intelligenceRecentPlainHistory(currentMessages);
      const sol=await api.aiCopilotAsk({token:null,question:q,history,effortOverride:'auto',requestId});
      if(!isStillCurrent())return;
      if(sol?.inferenceStatus&&app.state.aiCopilotCap){
        app.setState({aiCopilotCap:{...app.state.aiCopilotCap,inferenceStatus:sol.inferenceStatus}});
      }
      const effortLabel=sol?.effort==='high'?'Alto':sol?.effort==='medium'?'Médio':'Baixo';
      appendAssistant({
        status:'done',
        text:String(sol?.text||'').trim()||'O GPT-6.2 Sol concluiu a solicitação sem conteúdo de resposta.',
        operationalEvidence:'GPT-6.2 Sol · Modo geral (sem dados financeiros) · Esforço '+effortLabel,
        details:'Conversa geral via OAuth com GPT-6.2 Sol · zero acesso ao SQLite ou extratos pessoais · zero fallback pago.'
      });
    }catch(solErr:any){
      if(!isStillCurrent())return;
      const errMsg=String(solErr?.message||'Não foi possível consultar o GPT-6.2 Sol neste momento.').slice(0,260);
      if(/^USER_CANCELLED$|cancelad[ao]\s+por\s+solicita[çc][ãa]o/i.test(errMsg)){
        appendAssistant({
          status:'done',
          text:'Solicitação cancelada. Nenhuma resposta ou alteração financeira foi registrada.',
          details:'Cancelamento manual pelo usuário antes da conclusão.'
        });
      }else{
        appendAssistant({
          status:'error',
          text:'**Não foi possível obter resposta do GPT-6.2 Sol:** '+errMsg+' Nenhuma resposta foi simulada.',
          permissionActions:[{id:'open_ai_settings',label:'Abrir Configurações de IA'}],
          details:'Erro real retornado pelo serviço GPT-6.2 Sol (OAuth): '+errMsg
        });
      }
    }finally{
      if(app.state.aiCopilotRequestId===requestId){
        app.setState({aiCopilotBusy:false,aiCopilotStreaming:'',aiCopilotRequestId:null});
      }
    }
    return;
  }

  if(wantsLocalSummary){
    appendAssistant({
      status:'done',
      text:'**Resumo estruturado local pronto (somente registros carregados na sessão):** consulte os totais reconciliados abaixo sem acionar IA externa.',
      details:'Escopo: '+scope.label+' ('+scope.period+') · Resumo local determinístico sem escrita financeira.'
    });
    return;
  }

  if(app.state.aiStatus?.connected===true){
    appendAssistant({
      status:'permission_needed',
      text:'Sua conta **ChatGPT está conectada via OAuth**, mas a inferência do modelo **GPT-6.2 Sol** ainda precisa ser ativada neste dispositivo. Ative abaixo para responder a saudações e perguntas gerais sem compartilhar seus registros financeiros pessoais.',
      permissionActions:[
        {id:'enable_ai_copilot',label:'Ativar GPT-6.2 Sol e responder',primary:true,retryQuestion:q},
        {id:'open_ai_settings',label:'Configurações de IA'}
      ],
      details:'Estado: OAuth conectado · opt-in GPT-6.2 Sol desativado · nenhum registro financeiro acessado.'
    });
    return;
  }

  appendAssistant({
    status:'unavailable',
    text:'**ChatGPT desconectado neste computador:** conecte sua conta ChatGPT para conversar com o **GPT-6.2 Sol** sobre dúvidas gerais, ou autorize a leitura financeira local para consultar gastos, orçamentos e ações supervisionadas sem IA externa. Nenhuma resposta foi simulada.',
    permissionActions:[
      {id:'connect_chatgpt',label:'Conectar ChatGPT',primary:true},
      {id:'authorize_local_read',label:'Autorizar leitura local'}
    ],
    details:'Estado: '+convState.pill+' · Escopo: '+scope.label+' ('+scope.period+').'
  });
}


/* ==========================================================================
   I1-B: HISTÓRICO PERSISTENTE COMPARTILHADO, ISOLAMENTO POR PERFIL, BUSCA,
   AGRUPAMENTO POR DATA E TABELAS/CARDS FINANCEIROS ESTRUTURADOS SEGUROS
   ========================================================================== */
const INTELLIGENCE_STORAGE_PREFIX='mf_ai_threads_v1_';
const INTELLIGENCE_MAX_THREADS=24;
const INTELLIGENCE_MAX_MESSAGES_PER_THREAD=50;

function intelligenceStorageKey(mode:string):string{
  return INTELLIGENCE_STORAGE_PREFIX+(mode==='demo'?'demo':'real');
}
function intelligenceGetStorage(app:any):{getItem:(k:string)=>string|null;setItem:(k:string,v:string)=>void;removeItem?:(k:string)=>void}|null{
  if(app?.chatStorage)return app.chatStorage;
  try{
    if(typeof window!=='undefined'&&window.localStorage)return window.localStorage;
  }catch(_e){}
  return null;
}
function intelligenceSanitizeStoredText(input:string):string{
  let text=String(input||'').slice(0,4000);
  text=text.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g,'[TOKEN_REMOVIDO]');
  text=text.replace(/\bBearer\s+[A-Za-z0-9._\-]{12,}\b/gi,'Bearer [TOKEN_REMOVIDO]');
  text=text.replace(/\b(?:access_token|refresh_token|client_secret|id_token)\s*[:=]\s*[^\s,"']+/gi,'[SEGREDO_REMOVIDO]');
  return text;
}
/** Persist only bounded, recursively sanitized view data; arbitrary nested metadata
 * must never bypass the secret filter via proposals or structured financial cards. */
function intelligenceSanitizeStoredMetadata(input:any,depth:number=0):any{
  if(depth>6)return null;
  if(typeof input==='string')return intelligenceSanitizeStoredText(input);
  if(typeof input==='number')return Number.isFinite(input)?input:null;
  if(typeof input==='boolean')return input;
  if(Array.isArray(input))return input.slice(0,100).map(value=>intelligenceSanitizeStoredMetadata(value,depth+1));
  if(input&&typeof input==='object'){
    const safe:Record<string,any>={};
    for(const [key,value] of Object.entries(input).slice(0,60)){
      if(/^(?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|private[_-]?key|password|authorization|cookie|session[_-]?secret)$/i.test(key))continue;
      if(!/^[A-Za-z][A-Za-z0-9_-]{0,64}$/.test(key))continue;
      safe[key]=intelligenceSanitizeStoredMetadata(value,depth+1);
    }
    return safe;
  }
  return null;
}
function intelligenceSanitizeThreadList(rawList:any,mode:'real'|'demo'):IntelligenceThread[]{
  if(!Array.isArray(rawList))return [];
  const out:IntelligenceThread[]=[];
  for(const item of rawList.slice(0,INTELLIGENCE_MAX_THREADS)){
    if(!item||typeof item!=='object'||typeof item.id!=='string')continue;
    const itemMode=item.mode==='demo'?'demo':'real';
    if(itemMode!==mode)continue;
    const rawMsgs=Array.isArray(item.messages)?item.messages.slice(-INTELLIGENCE_MAX_MESSAGES_PER_THREAD):[];
    const msgs:IntelligenceChatMessage[]=rawMsgs.filter((m:any)=>m&&typeof m.id==='string'&&typeof m.text==='string').map((m:any)=>({
      id:String(m.id).slice(0,80),
      role:(m.role==='user'||m.role==='system'?m.role:'assistant') as 'user'|'assistant'|'system',
      text:intelligenceSanitizeStoredText(m.text),
      createdAt:String(m.createdAt||'00:00').slice(0,16),
      createdAtIso:typeof m.createdAtIso==='string'?m.createdAtIso.slice(0,10):undefined,
      scopeLabel:intelligenceSanitizeStoredText(String(m.scopeLabel||'Geral')).slice(0,60),
      periodLabel:intelligenceSanitizeStoredText(String(m.periodLabel||'')).slice(0,80),
      status:(['sent','streaming','done','unavailable','unimplemented','error'].includes(m.status)?m.status:'done') as any,
      details:m.details?intelligenceSanitizeStoredText(m.details):undefined,
      proposal:m.proposal&&typeof m.proposal==='object'?intelligenceSanitizeStoredMetadata(m.proposal):null,
      structuredCard:m.structuredCard&&typeof m.structuredCard==='object'?intelligenceSanitizeStoredMetadata(m.structuredCard):null
    }));
    out.push({
      id:String(item.id).slice(0,80),
      title:intelligenceSanitizeStoredText(String(item.title||'Conversa financeira')).slice(0,90)||'Conversa financeira',
      createdAtIso:typeof item.createdAtIso==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(item.createdAtIso)?item.createdAtIso:'2026-11-11',
      updatedAtIso:typeof item.updatedAtIso==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(item.updatedAtIso)?item.updatedAtIso:'2026-11-11',
      updatedTime:String(item.updatedTime||'00:00').slice(0,16),
      scopeLabel:intelligenceSanitizeStoredText(String(item.scopeLabel||'Visão geral')).slice(0,60),
      periodLabel:intelligenceSanitizeStoredText(String(item.periodLabel||'')).slice(0,80),
      mode,
      messages:msgs
    });
  }
  return out;
}
function intelligenceLoadStoredThreads(app:any,mode:'real'|'demo'=(app?.state?.mode==='demo'?'demo':'real')):{threads:IntelligenceThread[];error:string}{
  const store=intelligenceGetStorage(app);
  if(!store)return {threads:[],error:''};
  try{
    const raw=store.getItem(intelligenceStorageKey(mode));
    if(!raw)return {threads:[],error:''};
    const parsed=JSON.parse(raw);
    const list=intelligenceSanitizeThreadList(parsed?.threads||parsed,mode);
    return {threads:list,error:''};
  }catch(_e:any){
    return {threads:[],error:'Não foi possível ler o histórico salvo localmente (dados corrompidos ou armazenamento bloqueado).'};
  }
}
function intelligencePersistThreads(app:any,threads:IntelligenceThread[],mode:'real'|'demo'=(app?.state?.mode==='demo'?'demo':'real')):string{
  if(app.state.localFinancialAccess?.token||app.state.categoryReviewGrant?.token)return ''; // Financial replies and pending actions are session-only.
  const store=intelligenceGetStorage(app);
  if(!store)return 'Armazenamento local indisponível. Esta conversa não foi salva.';
  try{
    const sanitized=intelligenceSanitizeThreadList(threads,mode);
    const payload=JSON.stringify({version:1,mode,threads:sanitized});
    store.setItem(intelligenceStorageKey(mode),payload);
    return '';
  }catch(_e:any){
    return 'Não foi possível salvar o histórico de conversas no armazenamento local (limite atingido ou acesso negado).';
  }
}
function intelligenceEnsureHydrated(app:any){
  if(app.state.localFinancialAccess?.token||app.state.categoryReviewGrant?.token)return;
  if(!app||!app.state)return;
  const mode:'real'|'demo'=app.state.mode==='demo'?'demo':'real';
  if(app.state.intelligenceHydratedMode===mode&&Array.isArray(app.state.intelligenceThreads))return;
  const loaded=intelligenceLoadStoredThreads(app,mode);
  const existingMsgs:IntelligenceChatMessage[]=Array.isArray(app.state.intelligenceMessages)&&app.state.intelligenceHydratedMode===undefined?app.state.intelligenceMessages:[];
  let threads=loaded.threads;
  let activeId=threads[0]?.id||null;
  let activeMsgs=threads[0]?.messages||[];
  if(existingMsgs.length>0&&threads.length===0){
    const todayIso=intelligenceReferenceToday(app)||'2026-11-11';
    const firstUser=existingMsgs.find(m=>m.role==='user');
    const initialThread:IntelligenceThread={
      id:'th-init-'+Date.now(),
      title:firstUser?firstUser.text.slice(0,60):'Conversa da sessão',
      createdAtIso:todayIso,
      updatedAtIso:todayIso,
      updatedTime:existingMsgs[existingMsgs.length-1]?.createdAt||intelligenceNowTime(),
      scopeLabel:existingMsgs[0]?.scopeLabel||'Visão geral',
      periodLabel:existingMsgs[0]?.periodLabel||'',
      mode,
      messages:existingMsgs
    };
    threads=[initialThread];
    activeId=initialThread.id;
    activeMsgs=existingMsgs;
  }
  app.state.intelligenceHydratedMode=mode;
  app.state.intelligenceThreads=threads;
  app.state.intelligenceActiveThreadId=activeId;
  app.state.intelligenceMessages=activeMsgs;
  if(loaded.error)app.state.intelligenceStorageError=loaded.error;
}
function intelligenceSyncThreadMessages(app:any,messages:IntelligenceChatMessage[],scopeOverride?:{label:string;period:string}){
  intelligenceEnsureHydrated(app);
  const mode:'real'|'demo'=app.state.mode==='demo'?'demo':'real';
  const todayIso=intelligenceReferenceToday(app)||'2026-11-11';
  const nowTime=intelligenceNowTime();
  let threads:IntelligenceThread[]=Array.isArray(app.state.intelligenceThreads)?[...app.state.intelligenceThreads]:[];
  let activeId:string|null=app.state.intelligenceActiveThreadId||null;
  const trimmedMsgs=messages.slice(-INTELLIGENCE_MAX_MESSAGES_PER_THREAD);
  const firstUser=trimmedMsgs.find(m=>m.role==='user');
  const computedTitle=firstUser?intelligenceSanitizeStoredText(firstUser.text).slice(0,58):'Nova conversa';
  const scopeLabel=scopeOverride?.label||trimmedMsgs[trimmedMsgs.length-1]?.scopeLabel||intelligencePageScope(app).label;
  const periodLabel=scopeOverride?.period||trimmedMsgs[trimmedMsgs.length-1]?.periodLabel||intelligencePageScope(app).period;

  const idx=threads.findIndex(t=>t.id===activeId);
  if(idx>=0){
    const current=threads[idx];
    const updatedThread:IntelligenceThread={
      ...current,
      title:current.title==='Nova conversa'&&firstUser?computedTitle:current.title,
      updatedAtIso:todayIso,
      updatedTime:nowTime,
      scopeLabel,
      periodLabel,
      messages:trimmedMsgs
    };
    threads.splice(idx,1);
    threads=[updatedThread,...threads];
  }else if(trimmedMsgs.length>0){
    const newThread:IntelligenceThread={
      id:'th-'+Date.now()+'-'+Math.floor(Math.random()*1000),
      title:computedTitle,
      createdAtIso:todayIso,
      updatedAtIso:todayIso,
      updatedTime:nowTime,
      scopeLabel,
      periodLabel,
      mode,
      messages:trimmedMsgs
    };
    activeId=newThread.id;
    threads=[newThread,...threads].slice(0,INTELLIGENCE_MAX_THREADS);
  }
  const storageErr=intelligencePersistThreads(app,threads,mode);
  app.setState({
    intelligenceHydratedMode:mode,
    intelligenceThreads:threads,
    intelligenceActiveThreadId:activeId,
    intelligenceMessages:trimmedMsgs,
    intelligenceStorageError:storageErr
  },()=>intelligenceScrollChatToBottom());
}
function intelligenceScrollChatToBottom(){
  if(typeof document==='undefined'||typeof document.querySelectorAll!=='function')return;
  const scroll=()=>{
    for(const el of Array.from(document.querySelectorAll('.mf-b05-chat-thread, .mf-ai-drawer-body')))
      (el as HTMLElement).scrollTop=(el as HTMLElement).scrollHeight;
  };
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(scroll);else scroll();
}
function intelligenceResetStreamingState(app:any){
  if(app?.state?.aiCopilotBusy&&typeof (desktop as any)?.aiCopilotCancel==='function'){
    void (desktop as any).aiCopilotCancel().catch(()=>{});
  }
  return {aiCopilotBusy:false,aiCopilotStreaming:'',aiCopilotRequestId:null as string|null};
}
function intelligenceCreateThread(app:any,initialTitle:string='Nova conversa'){
  const streamingReset=intelligenceResetStreamingState(app);
  intelligenceEnsureHydrated(app);
  const mode:'real'|'demo'=app.state.mode==='demo'?'demo':'real';
  const todayIso=intelligenceReferenceToday(app)||'2026-11-11';
  const scope=app.state.intelligencePanelOpen&&app.state.intelligenceContextSnapshot
    ?app.state.intelligenceContextSnapshot
    :intelligencePageScope(app,app.state.page);
  const newThread:IntelligenceThread={
    id:'th-'+Date.now()+'-'+Math.floor(Math.random()*1000),
    title:initialTitle.slice(0,60)||'Nova conversa',
    createdAtIso:todayIso,
    updatedAtIso:todayIso,
    updatedTime:intelligenceNowTime(),
    scopeLabel:scope.label,
    periodLabel:scope.period,
    mode,
    messages:[]
  };
  const currentThreads:IntelligenceThread[]=Array.isArray(app.state.intelligenceThreads)?app.state.intelligenceThreads:[];
  const nextThreads=[newThread,...currentThreads].slice(0,INTELLIGENCE_MAX_THREADS);
  const storageErr=intelligencePersistThreads(app,nextThreads,mode);
  app.setState({
    intelligenceHydratedMode:mode,
    intelligenceThreads:nextThreads,
    intelligenceActiveThreadId:newThread.id,
    intelligenceMessages:[],
    intelligenceDraft:'',
    intelligencePreparedQuestion:'',
    intelligenceDraftScope:null,
    ...streamingReset,
    intelligenceStorageError:storageErr
  });
  return newThread.id;
}
function intelligenceSelectThread(app:any,threadId:string){
  intelligenceEnsureHydrated(app);
  const threads:IntelligenceThread[]=Array.isArray(app.state.intelligenceThreads)?app.state.intelligenceThreads:[];
  const found=threads.find(t=>t.id===threadId);
  if(!found)return;
  const switching=found.id!==app.state.intelligenceActiveThreadId;
  const streamingReset=switching?intelligenceResetStreamingState(app):{};
  app.setState({
    intelligenceActiveThreadId:found.id,
    intelligenceMessages:found.messages,
    intelligenceDraftScope:{label:found.scopeLabel,period:found.periodLabel,mode:found.mode==='demo'?'Demonstração':'Pessoal'},
    ...(switching?{intelligencePreparedQuestion:''}:{}),
    ...streamingReset
  });
}
function intelligenceDeleteThread(app:any,threadId:string,confirmFn?:(msg:string)=>boolean){
  intelligenceEnsureHydrated(app);
  const threads:IntelligenceThread[]=Array.isArray(app.state.intelligenceThreads)?app.state.intelligenceThreads:[];
  const target=threads.find(t=>t.id===threadId);
  if(!target)return false;
  const ask=confirmFn||(typeof confirm==='function'?confirm:()=>false);
  if(!ask('Excluir permanentemente a conversa “'+target.title+'” deste perfil?'))return false;
  const deletingActive=app.state.intelligenceActiveThreadId===threadId;
  const streamingReset=deletingActive?intelligenceResetStreamingState(app):{};
  const mode:'real'|'demo'=app.state.mode==='demo'?'demo':'real';
  const remaining=threads.filter(t=>t.id!==threadId);
  const nextActive=deletingActive?(remaining[0]||null):(remaining.find(t=>t.id===app.state.intelligenceActiveThreadId)||remaining[0]||null);
  const storageErr=intelligencePersistThreads(app,remaining,mode);
  if(storageErr){app.setState({intelligenceStorageError:storageErr});return false;}
  app.setState({
    intelligenceThreads:remaining,
    intelligenceActiveThreadId:nextActive?nextActive.id:null,
    intelligenceMessages:nextActive?nextActive.messages:[],
    ...streamingReset,
    intelligenceStorageError:storageErr
  });
  return true;
}
function intelligenceClearHistory(app:any,confirmFn?:(msg:string)=>boolean){
  if(app.state.localFinancialAccess?.token||app.state.categoryReviewGrant?.token){
    const streamingReset=intelligenceResetStreamingState(app);
    app.setState({intelligenceThreads:[],intelligenceMessages:[],intelligenceActiveThreadId:null,intelligencePreparedQuestion:'',...streamingReset});
    return;
  }
  intelligenceEnsureHydrated(app);
  const threads:IntelligenceThread[]=Array.isArray(app.state.intelligenceThreads)?app.state.intelligenceThreads:[];
  if(!threads.length)return false;
  const ask=confirmFn||(typeof confirm==='function'?confirm:()=>false);
  if(!ask('Excluir todas as '+threads.length+' conversa(s) salvas neste perfil?'))return false;
  const streamingReset=intelligenceResetStreamingState(app);
  const mode:'real'|'demo'=app.state.mode==='demo'?'demo':'real';
  const storageErr=intelligencePersistThreads(app,[],mode);
  if(storageErr){app.setState({intelligenceStorageError:storageErr});return false;}
  app.setState({
    intelligenceThreads:[],
    intelligenceActiveThreadId:null,
    intelligenceMessages:[],
    intelligencePreparedQuestion:'',
    ...streamingReset,
    intelligenceStorageError:storageErr
  });
  return true;
}
function intelligenceSwitchProfileMode(app:any,newMode:'real'|'demo'){
  const streamingReset=intelligenceResetStreamingState(app);
  if(app.state.categoryReviewGrant&&typeof categoryReviewDisable==='function')categoryReviewDisable(app);
  if(app.state.localFinancialAccess?.token&&typeof localFinancialDisable==='function')localFinancialDisable(app);
  const loaded=intelligenceLoadStoredThreads(app,newMode);
  const first=loaded.threads[0]||null;
  app.setState({
    mode:newMode,
    intelligenceHydratedMode:newMode,
    intelligenceThreads:loaded.threads,
    intelligenceActiveThreadId:first?first.id:null,
    intelligenceMessages:first?first.messages:[],
    intelligenceDraftScope:null,
    intelligencePreparedQuestion:'',
    ...streamingReset,
    intelligenceStorageError:loaded.error
  });
}
function intelligenceSearchThreads(app:any,query:string=app.state.intelligenceHistoryQuery||''):IntelligenceThread[]{
  intelligenceEnsureHydrated(app);
  const threads:IntelligenceThread[]=Array.isArray(app.state.intelligenceThreads)?app.state.intelligenceThreads:[];
  const qFold=intelligenceFoldText(query);
  const sorted=[...threads].sort((a,b)=>b.updatedAtIso.localeCompare(a.updatedAtIso)||b.updatedTime.localeCompare(a.updatedTime));
  if(!qFold)return sorted;
  return sorted.filter(t=>{
    const hay=intelligenceFoldText([t.title,t.scopeLabel,t.periodLabel,...t.messages.map(m=>m.text)].join(' '));
    return hay.includes(qFold);
  });
}
function intelligenceGroupThreadsByDate(app:any,query:string=app.state.intelligenceHistoryQuery||''):{label:string;items:IntelligenceThread[]}[]{
  const filtered=intelligenceSearchThreads(app,query);
  if(!filtered.length)return [];
  const todayIso=intelligenceReferenceToday(app)||'2026-11-11';
  const yesterdayIso=intelligenceShiftIsoDate(todayIso,-1)||'';
  const groupsMap:{[key:string]:IntelligenceThread[]}={'Hoje':[],'Ontem':[],'Anteriores':[]};
  for(const th of filtered){
    if(th.updatedAtIso===todayIso)groupsMap['Hoje'].push(th);
    else if(yesterdayIso&&th.updatedAtIso===yesterdayIso)groupsMap['Ontem'].push(th);
    else groupsMap['Anteriores'].push(th);
  }
  return ['Hoje','Ontem','Anteriores'].filter(k=>groupsMap[k].length>0).map(k=>({label:k,items:groupsMap[k]}));
}
function intelligenceAllProposals(app:any):IntelligenceActionProposal[]{
  intelligenceEnsureHydrated(app);
  const activeMsgs:IntelligenceChatMessage[]=Array.isArray(app.state.intelligenceMessages)?app.state.intelligenceMessages:[];
  const fromActive=activeMsgs.map(m=>m.proposal).filter(Boolean) as IntelligenceActionProposal[];
  if(fromActive.length>0)return fromActive;
  const threads:IntelligenceThread[]=Array.isArray(app.state.intelligenceThreads)?app.state.intelligenceThreads:[];
  const all:IntelligenceActionProposal[]=[];
  for(const t of threads){
    for(const m of t.messages){
      if(m.proposal)all.push(m.proposal);
    }
  }
  return all;
}
declare const FinancePeriodLedger:{aggregateFinancePeriod:(rows:any[],options:any)=>any};
function intelligenceBuildStructuredSummaryCard(app:any):IntelligenceStructuredCard|null{
  const s=app?.state||{};
  const moneyFmt=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
  const bankTxs:any[]=s.mode==='demo'?[]:(Array.isArray(s.bank?.data?.transactions)?s.bank.data.transactions:[]);
  const manualTxs:any[]=Array.isArray(s.data?.transactions)?s.data.transactions:[];
  if(!bankTxs.length&&!manualTxs.length)return null;
  // Bank and manual ledgers are independent sources, never additive totals.
  // Prefer the source selected by the user, falling back when it is unavailable.
  const useBank=s.mode!=='demo'&&bankTxs.length>0&&
    (s.dashboardSource!=='manual'||manualTxs.length===0);
  const records=useBank?bankTxs:manualTxs;
  const sourceLabel=useBank?'contas conectadas':'lançamentos manuais';
  let totalExpense=0,totalIncome=0,postedCount=0,excluded=0;
  const byCat=new Map<string,{expense:number;count:number}>();
  if(typeof FinancePeriodLedger==='undefined')return {title:'Resumo indisponível',footnote:'Motor financeiro indisponível. Nenhum total foi calculado.'};
  for(const rec of records){
    if(!rec||typeof rec!=='object'){excluded++;continue;}
    // Adapt fields only: shared ledger validates cents, nature and split sums.
    const row=useBank?{
      date:rec.date,status:rec.status,amountCents:rec.amount,nature:rec.nature,
      category:rec.category||'Outros',
      splits:!rec.splitOutdated&&Array.isArray(rec.splits)?rec.splits.map((p:any)=>({category:p?.category,amountCents:p?.amount})):undefined
    }:{date:rec.date,kind:rec.kind,amountCents:rec.amount,category:rec.category||'Outros'};
    try{
      // Per-record periods preserve the loaded multi-year cache scope without
      // imposing the engine's 730-day limit or using full-history aggregates.
      const result=FinancePeriodLedger.aggregateFinancePeriod([row],{
        start:rec.date,end:rec.date,source:useBank?'bank':'manual'
      });
      excluded+=result.excluded;postedCount+=result.transactionsIncluded;
      totalIncome+=result.incomeCents;totalExpense+=result.expenseCents;
      for(const part of result.expenses){
        const prior=byCat.get(part.name)||{expense:0,count:0};
        byCat.set(part.name,{expense:prior.expense+part.amountCents,count:prior.count+1});
      }
    }catch{excluded++;} // Malformed data is excluded, never rounded or rewritten.

  }
  const rows=[...byCat.entries()].sort((a,b)=>b[1].expense-a[1].expense).slice(0,5).map(([cat,info])=>({
    col1:cat,col2:String(info.count)+' reg.',col3:moneyFmt(info.expense)
  }));
  const partial=useBank&&!!s.bank?.data?.truncated;
  return {
    title:'Resumo determinístico local (sem uso de IA)',
    subtitle:(s.mode==='demo'?'Perfil Demonstração':'Perfil Pessoal')+' · origem: '+sourceLabel+' · '+records.length+' linhas carregadas',
    metrics:[
      {label:'Entradas confirmadas carregadas',value:moneyFmt(totalIncome),tone:'positive'},
      {label:'Saídas confirmadas carregadas',value:moneyFmt(totalExpense),tone:'warning'},
      {label:'Registros válidos',value:String(postedCount),tone:'neutral'}
    ],
    headers:['Categoria','Qtd.','Despesas carregadas'],rows,
    footnote:(partial?'Histórico bancário parcial: estes valores não representam todos os registros. ':'')+
      'Soma de uma única origem ('+sourceLabel+'), nunca banco + manual; '+excluded+
      ' registros pendentes/desconsiderados fora dos totais. Valores apenas dos registros carregados, não saldo auditado.'
  };
}
