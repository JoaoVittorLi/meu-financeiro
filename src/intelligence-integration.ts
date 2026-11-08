/* Entrega 2: chamada real apenas com dados fictícios autorizados pelo usuário.
 * Shared policy is imported in Electron and Cloudflare; renderer never sees access tokens. */
async function intelligenceRefresh(app:any){
  if(!desktop?.aiStatus)return;
  try{const [status,capabilities]=await Promise.all([desktop.aiStatus(),desktop.aiCapabilities?.()||Promise.resolve(null)]);app.setState({aiStatus:status,aiCapabilities:capabilities,aiError:''});}
  catch(e:any){app.setState({aiError:'Não foi possível consultar o estado da conexão.'});}
}
async function intelligenceConnect(app:any){
  if(!desktop?.aiConnect||app.state.aiBusy)return;
  app.setState({aiBusy:true,aiError:'',aiResult:null,aiStreaming:''});
  try{const status=await desktop.aiConnect();app.setState({aiStatus:status,aiBusy:false});}
  catch(e:any){app.setState({aiBusy:false,aiError:String(e?.message||'Autorização não concluída.').slice(0,250)});}
}
async function intelligenceDisconnect(app:any){
  if(!desktop?.aiDisconnect||app.state.aiBusy)return;
  if(!confirm('Sair do ChatGPT neste computador? Para revogar o acesso remoto, use também as configurações de segurança do ChatGPT. Seus dados financeiros não serão afetados.'))return;
  app.setState({aiBusy:true,aiError:'',aiResult:null,aiStreaming:''});
  try{const status=await desktop.aiDisconnect();app.setState({aiStatus:status,aiBusy:false,aiCreditsConfirmed:false});}
  catch(e:any){app.setState({aiBusy:false,aiError:'Não foi possível desconectar.'});}
}
async function intelligenceTest(app:any){
  if(!desktop?.aiRunDemo||!app.state.aiStatus.connected||app.state.aiBusy)return;
  if(!app.state.aiCreditsConfirmed){app.setState({aiError:'Confirme que os créditos adicionais estão desativados no ChatGPT.'});return;}
  app.setState({aiBusy:true,aiError:'',aiResult:null,aiStreaming:''});
  try{
    const result=await desktop.aiRunDemo({caseId:app.state.aiDemoCase,effort:app.state.aiEffort,creditsDisabledConfirmed:true});
    app.setState({aiBusy:false,aiResult:result});
  }catch(e:any){app.setState({aiBusy:false,aiError:String(e?.message||'Teste não concluído.').slice(0,300)});}
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
     h('p',{},s.aiResult.text||'Nenhum texto retornado.'),
     h('small',{},'Modelo '+s.aiResult.model+' · esforço '+s.aiResult.effort+
       (s.aiResult.usage?' · entrada '+s.aiResult.usage.inputTokens+' tokens · saída '+s.aiResult.usage.outputTokens+' tokens':''))):null,
   s.aiError?h('p',{className:'mf-ai-error',role:'alert'},s.aiError):null);
}
