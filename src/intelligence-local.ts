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
 const access=app.state.localFinancialAccess,q=String(question).trim().slice(0,750),scope=intelligencePageScope(app),messages=[...intelligenceHistoryList(app)];
 const user:IntelligenceChatMessage={id:'local-u-'+Date.now(),role:'user',text:q,status:'sent',createdAt:intelligenceNowTime(),scopeLabel:scope.label,periodLabel:app.state.localFinancialMonth||app.state.month};
 app.setState({localFinancialBusy:true,intelligenceDraft:''});
 const parsed=localFinancialParse(q,app.state.categories);let reply:LocalFinancialReply=null,error='';
 try{if(parsed)reply=await localFinancialQuery(app,parsed);else error='Consulta ainda não reconhecida. Pergunte sobre alimentação, assinaturas, maiores despesas, orçamentos, compromissos, comparação ou revisão. Pedidos de alteração não são executados.';}
 catch(e:any){error=String(e.message||'Consulta local indisponível.').slice(0,220);}
 if(app.state.localFinancialAccess?.token!==access?.token)return;
 const answer:IntelligenceChatMessage={id:'local-a-'+Date.now(),role:'assistant',text:reply?.text||error,status:reply?'done':'error',createdAt:intelligenceNowTime(),scopeLabel:scope.label,periodLabel:user.periodLabel,structuredCard:reply?.card||null,details:reply?JSON.stringify(reply.references):'Sem alteração financeira nem envio externo.'};
 intelligenceSyncThreadMessages(app,[...messages,user,answer],scope);app.setState({localFinancialBusy:false});
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
 h('div',{className:'mf-ai-starter-grid'},...['Quanto gastei com alimentação neste mês?','Quais foram minhas maiores despesas?','Quais categorias ultrapassaram o orçamento?','Quanto tenho comprometido para o próximo mês?','Quais despesas aumentaram?','Que movimentações preciso revisar?','Quanto gastei em assinaturas?','Quais dados faltam para avaliar uma compra?'].map(q=>h('button',{type:'button',className:'mf-ai-context-prompt',key:q,onClick:()=>{app.setState({intelligenceTab:'chat'});void localFinancialSubmit(app,q);}},q))));
}
