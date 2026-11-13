/* Read-only local financial queries. Shared main/drawer chat; no LLM or persisted financial replies. */
type LocalFinancialAccess={token:string;source:'bank'|'manual';profile:'real'|'demo';planning:boolean;expiresAt:number;backup:any};
type LocalFinancialIntent='radar'|'category'|'largest'|'budgets'|'commitments'|'compare'|'review'|'purchase';
type LocalFinancialScope={source:'bank'|'manual';profile:'real'|'demo';planning:boolean;consent:'LOCAL_FINANCIAL_READ_V1'};
type LocalFinancialReferences={engine:'shared/finance-period-ledger.mjs';source:'bank'|'manual';profile:'real'|'demo';period:{start:string;end:string};loaded:number;partial:boolean;readAt:string;planningRead:boolean;planningPeriod?:{start:string;end:string}};
type LocalFinancialReply={version:1;readOnly:true;inferenceCalled:false;changesApplied:false;text:string;references:LocalFinancialReferences;card:IntelligenceStructuredCard};
function localFinancialAPI(){return desktop as typeof desktop & {localFinancialAuthorize?:(v:LocalFinancialScope)=>Promise<Omit<LocalFinancialAccess,'backup'>>;localFinancialQuery?:(v:{token:string;intent:LocalFinancialIntent;category?:string;month:string})=>Promise<LocalFinancialReply>;localFinancialRevoke?:(token:string)=>Promise<any>};}
function localFinancialParse(question:string,categories:any[]=[]):{intent:LocalFinancialIntent;category?:string}|null{
 const q=intelligenceFoldText(question);
 if(/\b(categorize|altere|ajuste|crie|exclua|apague|registre|planeje)\b/.test(q))return null;
 if(/\bcompra|\bcomprar|celular|parcel|disponiv|dados falt/.test(q))return {intent:'purchase'};
 if(/proximo mes|compromet|compromiss/.test(q))return {intent:'commitments'};
 if(/aument|compar|mes anterior/.test(q))return {intent:'compare'};
 if(/revis|conferir/.test(q))return {intent:'review'};
 if(/maiores|mais caras/.test(q))return {intent:'largest'};
 if(/orcament|limites|ultrapass|exced/.test(q))return {intent:'budgets'};
 for(const c of categories)if(q.includes(intelligenceFoldText(c.name)))return {intent:'category',category:c.name};
 if(/alimentacao/.test(q))return {intent:'category',category:'Alimentação'};
 if(/assinatura/.test(q))return {intent:'category',category:'Assinaturas'};
 return null;
}
async function localFinancialEnable(app:any){
 if(app.state.categoryReviewGrant&&typeof categoryReviewDisable==='function')categoryReviewDisable(app);
 const api=localFinancialAPI(),s=app.state;if(s.localFinancialBusy)return;
 if(!api?.localFinancialAuthorize){app.setState({localFinancialError:'Consulta local requer a versão desktop desta candidata.'});return;}
 const source=s.mode==='demo'?'manual':s.localFinancialSource||'bank',profile=s.mode==='demo'?'demo':'real';
 const scope:LocalFinancialScope={source,profile,planning:profile==='real'&&s.localFinancialPlanning===true,consent:'LOCAL_FINANCIAL_READ_V1'};
 const generation=(app.__localReadGeneration||0)+1;app.__localReadGeneration=generation;
 app.setState({localFinancialBusy:true,localFinancialError:''});
 try{
  const grant=await api.localFinancialAuthorize(scope);
  if(app.__localReadGeneration!==generation||app.state.mode!==s.mode){void api.localFinancialRevoke?.(grant.token);return;}
  const backup=s.localFinancialAccess?.backup||{intelligenceThreads:s.intelligenceThreads,intelligenceMessages:s.intelligenceMessages,intelligenceActiveThreadId:s.intelligenceActiveThreadId,intelligenceHydratedMode:s.intelligenceHydratedMode};
  app.setState({localFinancialAccess:{...grant,backup},localFinancialBusy:false,localFinancialRadar:null,intelligenceThreads:[],intelligenceMessages:[],intelligenceActiveThreadId:null,intelligenceDraft:'',intelligencePreparedQuestion:'',workIntelligenceDemo:s.workIntelligenceDemo?{...s.workIntelligenceDemo,enabled:false}:undefined},()=>{void localFinancialRadar(app);if(typeof intelligencePremiumLoad==='function')void intelligencePremiumLoad(app);});
 }catch{app.setState({localFinancialBusy:false,localFinancialError:'Não foi possível autorizar a leitura local. Nenhum dado foi consultado por esta solicitação.'});}
}
function localFinancialDisable(app:any){
 const access:LocalFinancialAccess=app.state.localFinancialAccess;app.__localReadGeneration=(app.__localReadGeneration||0)+1;
 app.setState({...access?.backup,localFinancialAccess:null,localFinancialRadar:null,localFinancialBusy:false,localFinancialError:'',intelligenceDraft:''},()=>{if(typeof intelligencePremiumLoad==='function')void intelligencePremiumLoad(app);});
 if(access?.token)void localFinancialAPI()?.localFinancialRevoke?.(access.token).catch(()=>app.setState({localFinancialError:'A interface encerrou a leitura. A autorização do processo expira em até 15 minutos.'}));
}
async function localFinancialQuery(app:any,intent:{intent:LocalFinancialIntent;category?:string}):Promise<LocalFinancialReply>{
 const access:LocalFinancialAccess=app.state.localFinancialAccess;
 if(!access?.token||access.profile!==(app.state.mode==='demo'?'demo':'real'))throw Error('Autorize a fonte e o perfil atuais.');
 const month=app.state.localFinancialMonth||app.state.month;
 const response=await localFinancialAPI().localFinancialQuery({token:access.token,...intent,month});
 if((app.state.localFinancialMonth||app.state.month)!==month)throw Error('O período mudou durante a consulta. Tente novamente.');
 if(app.state.localFinancialAccess?.token!==access.token)throw Error('A autorização mudou durante a consulta.');
 if(response.version!==1||response.readOnly!==true||response.inferenceCalled!==false||response.changesApplied!==false)throw Error('Resposta de leitura inválida.');
 return response;
}
async function localFinancialRadar(app:any){
 try{const result=await localFinancialQuery(app,{intent:'radar'});app.setState({localFinancialRadar:result,localFinancialError:''});}
 catch(e:any){app.setState({localFinancialError:String(e.message||'Consulta indisponível.').slice(0,180)});}
}
async function localFinancialSubmit(app:any,question:string){
 if(app.state.localFinancialBusy||!String(question||'').trim())return;
 const access:LocalFinancialAccess=app.state.localFinancialAccess;
 const q=String(question).trim().slice(0,700),scope=intelligencePageScope(app),messages=[...intelligenceHistoryList(app)];
 const v3Kind=mfV3Requested(q);
 let previousOperational:any=null;
 const month=app.state.localFinancialMonth||app.state.month,signature=intelligencePremiumSignature(app);
 const request=(app.__localChatRequest||0)+1;app.__localChatRequest=request;
 const user:IntelligenceChatMessage={id:'local-u-'+Date.now(),role:'user',text:q,status:'sent',
  createdAt:intelligenceNowTime(),scopeLabel:scope.label,periodLabel:month};
 app.setState({localFinancialBusy:true,intelligenceDraft:''});
 let reply:LocalFinancialReply=null,operational:any=null,error='';
 try{
  const api=localFinancialAPI() as any;
  if(typeof api?.intelligenceOperationalAsk==='function'){
   operational=await api.intelligenceOperationalAsk({token:access.token,month,
     question:v3Kind?'Radar financeiro':q});
   if(operational?.contract!=='IC-v1/I-P0.2-read-only'||operational.readOnly!==true||
      operational.changesApplied!==false||operational.modelCalled!==false)throw Error('Resposta operacional não verificada.');
   if(v3Kind&&mfV3NeedsPrevious(v3Kind)&&operational?.uiState==='ready'){
     // The same existing local grant is used; missing previous data stays partial.
     const priorMonth=mfVisualMonthBefore(month);
     if(priorMonth){
       try{previousOperational=await api.intelligenceOperationalAsk({token:access.token,month:priorMonth,question:'Radar financeiro'});}
       catch{previousOperational=null;}
     }
   }
  }else{
   // Compatibility during isolated R branch: I-P0.2 becomes active after integration.
   const parsed=localFinancialParse(q,app.state.categories);
   if(parsed)reply=await localFinancialQuery(app,parsed);
   else error='Consulta ainda não reconhecida. Comandos de escrita não são executados por esta consulta local.';
  }
 }catch(e:any){error=String(e?.message||'Consulta local indisponível.').slice(0,220);}
 if(request!==app.__localChatRequest||app.state.localFinancialAccess?.token!==access?.token||
    signature!==intelligencePremiumSignature(app)){
  if(request===app.__localChatRequest)app.setState({localFinancialBusy:false});
  return;
 }
 const state=operational?.uiState;
 let answerText=operational?.answer||reply?.text||error||'Consulta indisponível.';
 const finalStatus:IntelligenceChatMessage['status']=operational?
  (state==='ready'||state==='empty'?'done':state==='unsupported'?'unsupported':state==='denied'||state==='expired'?'unavailable':'error'):
  reply?'done':'error';
 const factsValid=operational&&(state==='ready'||state==='empty');
 const evidence=factsValid?(operational.profile==='synthetic'?'Ambiente sintético':'Fonte '+(operational.source==='bank'?'bancária':'manual'))+
  ' · '+intelligencePremiumCoverage(operational.coverage)+' · '+month:'';
 const visualV3=v3Kind&&factsValid?mfV3FromOperational(operational,v3Kind,previousOperational):null;
 if(v3Kind){
  answerText=!visualV3?'Não há evidência suficiente para apresentar esta análise com segurança. Nenhum valor foi estimado.':
    visualV3.quality==='unavailable'?'Esta família visual não tem serviço financeiro operacional compatível neste momento.':
    visualV3.quality==='partial'?'Os registros são parciais ou não permitem uma comparação completa. Veja as limitações a seguir.':
    'Consulte a visualização calculada a partir dos registros locais autorizados.';
 }
 const visualKind=!v3Kind&&factsValid?mfVisualRequested(q):null;
 const visual=visualKind?mfVisualFromOperational(operational,visualKind):null;
 const answer:IntelligenceChatMessage={
  id:'local-a-'+Date.now(),role:'assistant',text:answerText,status:finalStatus,
  createdAt:intelligenceNowTime(),scopeLabel:scope.label,periodLabel:month,
  structuredCard:factsValid&&operational.card?operational.card:reply?.card||null,
  visual,visualV3,
  operationalActions:factsValid&&!visualV3&&Array.isArray(operational.actions)?operational.actions:[],
  operationalEvidence:evidence,
  details:v3Kind&&!visualV3?'Os fatos autorizados não permitem esta visualização; nenhuma informação foi estimada.':
    visualKind&&!visual?'Não há evidências suficientes para desenhar o gráfico com totais reconciliados. Confira fonte e cobertura.':
    factsValid?'Consulta local determinística, sem IA externa. Não foi executada qualquer alteração.':
    reply?JSON.stringify(reply.references):'Nenhuma alteração financeira nem envio externo.'
 };
 intelligenceSyncThreadMessages(app,[...messages,user,answer],scope);
 app.setState({localFinancialBusy:false});
}
function renderLocalFinancialAccess(app:any){
 const s=app.state,access:LocalFinancialAccess=s.localFinancialAccess,active=access?.token&&access.expiresAt>Date.now();
 if(s.categoryReviewGrant)return h('section',{className:'mf-ai-explainer'},h('div',{},h('strong',{},'Revisão sintética autorizada · conversa temporária'),h('p',{},'Mensagens e prévias ficam apenas nesta sessão. Regras e decisões confirmadas são auditadas no SQLite de teste.'),h('button',{type:'button',className:'ghost-button',onClick:()=>categoryReviewDisable(app)},'Encerrar revisão e limpar respostas da sessão')));
 return h('section',{className:'mf-ai-explainer mf-ai-local-access','aria-label':'Permissão de leitura financeira local'},h('div',{},
  h('strong',{},active?'Leitura local autorizada · sem IA externa':'Consultar seus registros locais'),
  h('p',{},'Ao autorizar, movimentos e limites da fonte escolhida serão lidos neste computador. Respostas ficam apenas na memória desta sessão. Consultas usam o mês e a fonte abaixo, sem herdar filtros da tabela.'),
  access?h('p',{},'Fonte: '+access.source+' · perfil '+access.profile+' · autorização por até 15 minutos.'):null,
  h('div',{className:'mf-ai-access-fields'},
   !access?h('label',{className:'mf-ai-access-field'},'Fonte',h('select',{value:s.mode==='demo'?'manual':s.localFinancialSource||'bank',disabled:s.mode==='demo',onChange:(e:any)=>app.setState({localFinancialSource:e.target.value})},h('option',{value:'bank'},'Contas conectadas'),h('option',{value:'manual'},'Lançamentos manuais'))):null,
   h('label',{className:'mf-ai-access-field'},'Mês da consulta',h('input',{type:'month',value:s.localFinancialMonth||s.month,onChange:(e:any)=>app.setState({localFinancialMonth:e.target.value,localFinancialRadar:null},()=>{if(typeof intelligencePremiumLoad==='function')void intelligencePremiumLoad(app);})})),
   !access&&s.mode!=='demo'?h('label',{className:'mf-ai-access-planning'},h('input',{type:'checkbox',checked:s.localFinancialPlanning===true,onChange:(e:any)=>app.setState({localFinancialPlanning:e.target.checked})}),h('span',{},'Permitir também leitura do Planejamento')):null),
  h('div',{className:'mf-ai-proposal-actions'},h('button',{type:'button',className:'primary-button',disabled:s.localFinancialBusy,onClick:()=>active?(void localFinancialRadar(app),void intelligencePremiumLoad(app)):void localFinancialEnable(app)},active?'Atualizar radar':'Autorizar leitura local'),access?h('button',{type:'button',className:'ghost-button',onClick:()=>localFinancialDisable(app)},'Encerrar leitura e limpar respostas da sessão'):null),
  s.localFinancialError?h('p',{role:'alert'},s.localFinancialError):null));
}
function renderLocalFinancialRadar(app:any){
 const report:LocalFinancialReply=app.state.localFinancialRadar;
 return h('div',{className:'mf-ai-today'},h('h2',{},'O que seus registros mostram hoje'),report?renderIntelligenceStructuredCard(report.card):h('p',{role:'status'},'Atualize o radar para consultar o mês escolhido.'),
 h('div',{className:'mf-ai-starter-grid'},...['Quanto gastei com alimentação neste mês?','Quais foram minhas maiores despesas?','Quais categorias ultrapassaram o orçamento?','Quanto tenho comprometido para o próximo mês?','Quais despesas aumentaram?','Que movimentações preciso revisar?','Quanto gastei em assinaturas?','Quais dados faltam para avaliar uma compra?'].map(q=>h('button',{type:'button',className:'mf-ai-context-prompt',key:q,onClick:()=>{app.setState({intelligenceTab:'chat',intelligenceMainMode:'chat'});void localFinancialSubmit(app,q);}},q))));
}
