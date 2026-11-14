/* RC-ALL-01: reuse D04 surface for existing I2-B/I2-C capabilities.
 * No new taxonomy, migration, model call, financial writes or hidden confirmation.
 * All synthetic confirmations require a separate native MAIN dialog. */
const MF_I2_PERSONAL_BINDINGS=new WeakMap<object,{access:any;token:string;month:string;signature:string}>();
function mfI2Month(app:any):string{return app.state.localFinancialMonth||app.state.month;}
function mfI2PersonalVisible(app:any):boolean{
 const r=app.state.mfI2PersonalResult;
 const b=r&&MF_I2_PERSONAL_BINDINGS.get(r);
 const a=app.state.localFinancialAccess;
 return !!b&&b.access===a&&b.token===a?.token&&b.month===mfI2Month(app)&&
  b.signature===intelligencePremiumSignature(app)&&
  Number.isFinite(a?.expiresAt)&&a.expiresAt>Date.now()&&
  a.profile===app.state.mode;
}
function mfI2SandboxLive(app:any):boolean{
 const s=app.state.mfI2Sandbox;
 return !!s&&typeof s.sessionId==='string'&&s.month===mfI2Month(app)&&
  Number.isFinite(s.expiresAt)&&s.expiresAt>Date.now();
}
async function mfI2PersonalRequest(app:any,request:any){
 const a=app.state.localFinancialAccess,month=mfI2Month(app);
 const api=desktop as any,signature=intelligencePremiumSignature(app);
 if(!api?.intelligenceCategoryPersonal||!a?.token||
    !Number.isFinite(a.expiresAt)||a.expiresAt<=Date.now()){
  app.setState({mfI2Error:'Autorize a leitura local antes de investigar suas categorias.'});return;
 }
 if(app.state.mfI2Busy)return;
 const serial=(app.__mfI2PersonalSerial||0)+1;app.__mfI2PersonalSerial=serial;
 app.setState({mfI2Busy:true,mfI2Error:'',mfI2PersonalResult:null});
 try{
  const reply=await api.intelligenceCategoryPersonal({...request,scope:{
   token:a.token,source:a.source,profile:a.profile,month}});
  if(serial!==app.__mfI2PersonalSerial||app.state.localFinancialAccess!==a||
     a.expiresAt<=Date.now()||mfI2Month(app)!==month||
     signature!==intelligencePremiumSignature(app))return;
  if(reply&&typeof reply==='object')
   MF_I2_PERSONAL_BINDINGS.set(reply,{access:a,token:a.token,month,signature});
  app.setState({mfI2PersonalResult:reply});
 }catch(err:any){
  if(serial===app.__mfI2PersonalSerial)app.setState({
   mfI2Error:String(err?.message||'Consulta indisponível.').slice(0,240)});
 }finally{if(serial===app.__mfI2PersonalSerial)app.setState({mfI2Busy:false});}
}
async function mfI2SandboxStart(app:any){
 const api=desktop as any;if(app.state.mfI2Busy)return;
 if(!api?.intelligenceCategorySandboxStart){
  app.setState({mfI2Error:'Laboratório indisponível nesta versão do Electron.'});return;
 }
 const month=mfI2Month(app);app.setState({mfI2Busy:true,mfI2Error:''});
 try{
  const session=await api.intelligenceCategorySandboxStart(month);
  if(!session||session.mode!=='SYNTHETIC_PREVIEW'||session.month!==month||
     typeof session.sessionId!=='string'||session.expiresAt<=Date.now())
   throw Error('Sessão de laboratório inválida.');
  if(mfI2Month(app)!==month){void api.intelligenceCategorySandboxStop(session.sessionId);return;}
  app.setState({mfI2Sandbox:session,mfI2SandboxResult:null,mfI2Proposal:null,
   mfI2Action:'category.create',mfI2Name:'Pets',mfI2NewName:'',
   mfI2Ids:'demo-market',mfI2RuleId:'',mfI2Question:'Quais categorias estão sem uso?'});
 }catch(err:any){app.setState({mfI2Error:String(err?.message||'Laboratório indisponível.').slice(0,240)});}
 finally{app.setState({mfI2Busy:false});}
}
async function mfI2SandboxStop(app:any){
 const s=app.state.mfI2Sandbox,api=desktop as any;
 app.setState({mfI2Sandbox:null,mfI2SandboxResult:null,mfI2Proposal:null,mfI2Error:''});
 if(s?.sessionId)try{await api?.intelligenceCategorySandboxStop?.(s.sessionId);}catch{}
}
async function mfI2SandboxCommand(app:any,method:string,additional:any={}){
 const api=desktop as any,s=app.state.mfI2Sandbox;
 if(!mfI2SandboxLive(app)){
  app.setState({mfI2SandboxResult:null,mfI2Proposal:null,
   mfI2Error:'Sessão sintética encerrada ou expirada. Inicie outra.'});return;
 }
 if(app.state.mfI2Busy)return;
 app.setState({mfI2Busy:true,mfI2Error:''});
 try{
  const response=await api.intelligenceCategorySandboxCommand({
   sessionId:s.sessionId,method,...additional});
  if(app.state.mfI2Sandbox!==s||!mfI2SandboxLive(app))return;
  const data=response?.data;
  const p=data?.proposalId?data:Array.isArray(data?.proposals)?
   data.proposals.find((x:any)=>x?.proposalId):null;
  const selected=method==='propose'||method==='ask'||method==='edit'?
   p||null:method==='reject'||response?.status==='applied'?null:app.state.mfI2Proposal;
  app.setState({mfI2SandboxResult:response,mfI2Proposal:selected});
 }catch(err:any){
  if(app.state.mfI2Sandbox===s)app.setState({
   mfI2Error:String(err?.message||'Operação de laboratório indisponível.').slice(0,240)});
 }finally{app.setState({mfI2Busy:false});}
}
function mfI2Params(app:any,action:string,source:'manual'|'bank'='manual'):any{
 const name=String(app.state.mfI2Name||'').trim();
 const next=String(app.state.mfI2NewName||'').trim();
 if(action==='category.create')return {name,color:'#2aa898',kind:'expense',emoji:'✨'};
 if(action==='category.update')return {name,newName:next};
 if(action==='category.delete')return {name};
 if(action==='transaction.categorize'){
  const ids=[...new Set(String(app.state.mfI2Ids||'').split(',').map(x=>x.trim()).filter(Boolean))];
  return {category:next||name,items:ids.map(id=>{
   if(source==='bank'){
    const sep=id.indexOf('|');return {accountId:sep>=0?id.slice(0,sep):'',
     externalId:sep>=0?id.slice(sep+1):''};
   }
   return {id};
  })};
 }
 return {};
}
function mfI2Evidence(result:any):any{
 if(!result)return null;
 const v=result.data||{},p=v?.proposalId?v:Array.isArray(v?.proposals)?v.proposals[0]:null;
 const catalog=v.catalog||(!p&&v.categories?v:null);
 const reasons=[...(Array.isArray(p?.conflicts)?p.conflicts:[]),
  ...(Array.isArray(p?.notes)?p.notes:[])].slice(0,5);
 const money=(n:any)=>Number.isSafeInteger(n)?
  new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100):'Valor não verificável';
 return h('div',{className:'mf-i2-evidence',role:'status'},
  h('p',{},h('strong',{},String(result.status||'indisponível')),
   ' · '+String(result.mode||'')+' · '+String(result.contract||'')),
  v.answer?h('p',{},String(v.answer).slice(0,1000)):null,
  result.reason?h('p',{},String(result.reason).slice(0,400)):null,
  catalog?h('div',{},
   h('strong',{},'Catálogo verificado · '+String(catalog.categories?.length||0)+' categorias'),
   h('p',{},'Possíveis duplicidades: '+String(catalog.possibleDuplicates?.length||0)+
    ' · Sem referência explícita: '+String(catalog.categories?.filter((x:any)=>x.probablyUnused).length||0)),
   h('p',{},(catalog.categories||[]).slice(0,14).map((x:any)=>String(x.name)).join(' · ')),
   h('small',{},String(catalog.caveat||'Amostra local; cobertura total não garantida.'))):null,
  p?h('div',{},
   h('strong',{},'Prévia '+String(p.actionType||'')+' · '+String(p.status)),
   h('p',{},'Referências verificadas: '+String(p.impact?.count??0)+
    ' · Impacto amostral: '+money(p.impact?.amountCents)),
   h('p',{},'Antes: '+JSON.stringify(p.before??null).slice(0,300)),
   h('p',{},'Depois: '+JSON.stringify(p.after??null).slice(0,300)),
   ...reasons.map((line:any)=>h('p',{},String(line).slice(0,240)))):null,
  v?.receipt?h('div',{},h('strong',{},'Recibo somente sintético · '+String(v.status||result.status)),
   h('p',{},'ID: '+String(v.receipt.proposalId||'')+' · '+String(v.receipt.confirmedAt||''))):null,
  v?.ruleImpact?h('p',{},'Abrangência de regra: '+String(v.ruleImpact.matchesLoaded||0)+
    ' lançamentos carregados; '+String(v.ruleImpact.wouldChangeLoaded||0)+' alterações potenciais'):null,
  !p&&!catalog&&!v?.receipt&&v?.status?h('p',{},String(v.reason||v.status)):null);
}
function mfI2CategoryPanel(app:any):any{
 const s=app.state,active=mfI2SandboxLive(app),access=s.localFinancialAccess;
 const personalLive=!!access?.token&&access.expiresAt>Date.now()&&
  access.profile===s.mode;
 const p=s.mfI2Proposal;
 const confirmable=active&&p?.status==='ready'&&p?.mayExecuteSynthetic===true&&
  typeof p?.confirmationNonce==='string'&&p.confirmationNonce.length>=20&&
  Number.isFinite(p.expiresAt)&&p.expiresAt>Date.now()&&
  Array.isArray(p.conflicts)&&p.conflicts.length===0;
 const busy=!!s.mfI2Busy;
 const button=(title:string,fn:()=>void,disabled=false)=>h('button',{
  type:'button',className:'ghost-button',disabled:busy||disabled,onClick:fn},title);
 const field=(label:string,key:string,placeholder:string)=>h('label',{className:'mf-i2-field'},
  h('span',{},label),h('input',{type:'text',value:String(s[key]||''),
   placeholder,onChange:(e:any)=>app.setState({[key]:e.target.value})}));
 return h('section',{className:'mf-i2-rc mf-d04-advanced','aria-label':'Laboratório de categorias I2-B e I2-C'},
  h('small',{},'I2-B / I2-C · RECURSOS JÁ DESENVOLVIDOS'),
  h('h3',{},'Categorias, regras e propostas verificáveis'),
  h('p',{},'Perfil pessoal: investigação e prévia sem gravação. Confirmação disponível exclusivamente no banco sintético TEMP, por diálogo nativo. D05 não implementada.'),
  h('div',{className:'mf-i2-group'},
   h('strong',{},'1. Investigar categorias autorizadas (somente leitura)'),
   personalLive?h('div',{className:'mf-i2-controls'},
    button('Sem uso ou semelhantes',()=>void mfI2PersonalRequest(app,{method:'analyze'})),
    button('Listar categorias e regras',()=>void mfI2PersonalRequest(app,{method:'list'})),
    button('Prévia pessoal de criação',()=>void mfI2PersonalRequest(app,{method:'propose',
     action:'category.create',params:mfI2Params(app,'category.create')})),
    button('Prévia pessoal de edição',()=>void mfI2PersonalRequest(app,{method:'propose',
     action:'category.update',params:mfI2Params(app,'category.update')})),
    button('Prévia pessoal de reclassificação por ID',()=>void mfI2PersonalRequest(app,{method:'propose',
     action:'transaction.categorize',params:mfI2Params(app,'transaction.categorize',access.source)})),
    button('Investigar regra por ID',()=>void mfI2PersonalRequest(app,{method:'inspectRule',
     ruleId:Number(s.mfI2RuleId)}),!Number.isInteger(Number(s.mfI2RuleId))||Number(s.mfI2RuleId)<=0)
   ):h('p',{},'Autorize a leitura local no painel de permissões da Inteligência para habilitar dados pessoais.'),
   mfI2PersonalVisible(app)?mfI2Evidence(s.mfI2PersonalResult):null),
  h('div',{className:'mf-i2-group'},
   h('strong',{},'2. Experimentar no banco sintético isolado'),
   active?h('p',{},'Sessão TEMP · '+String(s.mfI2Sandbox.month)+
    ' · três registros inventados · gravação exclusivamente sintética'):
    h('p',{},'Nenhum dado pessoal será copiado. Uma nova sessão cria um SQLite TEMP independente.'),
   h('div',{className:'mf-i2-controls'},
    s.mfI2Sandbox?button('Encerrar e destruir teste',()=>void mfI2SandboxStop(app)):
     button('Iniciar laboratório sintético',()=>void mfI2SandboxStart(app)),
    active?button('Analisar categorias de teste',()=>void mfI2SandboxCommand(app,'analyze')):null,
    active?button('Listar categorias e regras de teste',()=>void mfI2SandboxCommand(app,'list')):null),
   h('div',{className:'mf-i2-fields'},
    field('Categoria atual ou nova','mfI2Name','Ex.: Pets'),
    field('Novo nome ou categoria destino','mfI2NewName','Ex.: Alimentação'),
    field('IDs por vírgula (banco: conta|ID; teste: demo-market)','mfI2Ids','demo-market, demo-delivery'),
    field('ID numérico de regra','mfI2RuleId','Ex.: 1'),
    field('Pergunta de categorias ou regras','mfI2Question','Quais categorias estão sem uso?')),
   active?h('div',{className:'mf-i2-controls'},
    button('Propor criação',()=>void mfI2SandboxCommand(app,'propose',{
     action:'category.create',params:mfI2Params(app,'category.create')})),
    button('Propor edição',()=>void mfI2SandboxCommand(app,'propose',{
     action:'category.update',params:mfI2Params(app,'category.update')})),
    button('Propor exclusão',()=>void mfI2SandboxCommand(app,'propose',{
     action:'category.delete',params:mfI2Params(app,'category.delete')})),
    button('Prévia reclassificar por ID',()=>void mfI2SandboxCommand(app,'propose',{
     action:'transaction.categorize',params:mfI2Params(app,'transaction.categorize')})),
    button('Perguntar',()=>void mfI2SandboxCommand(app,'ask',{
     question:String(s.mfI2Question||'').slice(0,700)})),
    button('Investigar regra por ID',()=>void mfI2SandboxCommand(app,'inspectRule',
     {ruleId:Number(s.mfI2RuleId)}),!Number.isInteger(Number(s.mfI2RuleId))||Number(s.mfI2RuleId)<=0)
   ):null,
   active&&p?h('div',{className:'mf-i2-controls'},
    button('Editar prévia',()=>void mfI2SandboxCommand(app,'edit',{
     proposalId:p.proposalId,patch:p.actionType==='category.create'?
      {name:String(s.mfI2NewName||'').trim()}:
      p.actionType==='transaction.categorize'?{category:String(s.mfI2NewName||'').trim()}:
      {newName:String(s.mfI2NewName||'').trim()}}),!String(s.mfI2NewName||'').trim()),
    button('Rejeitar proposta',()=>void mfI2SandboxCommand(app,'reject',{proposalId:p.proposalId})),
    button('Confirmar APENAS no teste',()=>void mfI2SandboxCommand(app,'confirm',{
     proposalId:p.proposalId,confirmationNonce:p.confirmationNonce}),!confirmable)
   ):null,
   active?mfI2Evidence(s.mfI2SandboxResult):null,
   active&&s.mfI2SandboxResult?.status==='recovery_required'&&p?
    button('Consultar recibo, sem reexecutar',()=>void mfI2SandboxCommand(app,'recovery',
     {proposalId:p.proposalId})):null,
   !active&&s.mfI2Sandbox?h('p',{},'Sessão encerrada, expirada ou de outro mês. Encerre-a antes de iniciar outra.'):null,
   h('small',{},'Regras bancárias futuras e importação bancária não fazem parte desta amostra manual. Escritas pessoais pela IA permanecem desativadas.')),
  busy?h('p',{role:'status'},'Verificando serviço local…'):null,
  s.mfI2Error?h('p',{role:'alert'},String(s.mfI2Error).slice(0,240)):null);
}
