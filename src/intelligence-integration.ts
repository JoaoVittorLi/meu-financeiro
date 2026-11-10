/* Entrega 2: chamada real apenas com dados fictícios autorizados pelo usuário.
 * Shared policy is imported in Electron and Cloudflare; renderer never sees access tokens. */
async function intelligenceRefresh(app:any){
  if(!desktop?.aiStatus)return;
  try{
    const [status,capabilities]=await Promise.all([desktop.aiStatus(),desktop.aiCapabilities?.()||Promise.resolve(null)]);
    app.setState({aiStatus:status,aiCapabilities:capabilities,aiError:''});
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
     h('p',{},'Conta autorizada: '+(s.aiStatus.email||'conta ChatGPT validada')+' · Modelo exclusivo: GPT-6.1 Sol'),
     h('label',{},'Teste fictício',h('select',{value:s.aiDemoCase,onChange:(e:any)=>app.setState({aiDemoCase:e.target.value})},
       cases.map(c=>h('option',{key:c.id,value:c.id},c.label)))),
     h('label',{},'Raciocínio',h('select',{value:s.aiEffort,onChange:(e:any)=>app.setState({aiEffort:e.target.value})},
       ['auto','low','medium'].map(e=>h('option',{key:e,value:e},e==='auto'?'Automático':e==='low'?'Baixo':'Médio')))),
     h('label',{className:'mf-ai-check'},h('input',{type:'checkbox',checked:s.aiCreditsConfirmed,
       onChange:(e:any)=>app.setState({aiCreditsConfirmed:Boolean(e.target.checked)})}),
       h('span',{},'Conferi em Configurações → Uso: créditos adicionais desativados e limite semanal do aplicativo abaixo de 100%.')),
     h('button',{type:'button',className:'primary-button',disabled:s.aiBusy||!s.aiCreditsConfirmed,
       onClick:()=>intelligenceTest(app)},s.aiBusy?'Executando teste...':'Testar GPT-6.1 Sol com dados fictícios'),
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
