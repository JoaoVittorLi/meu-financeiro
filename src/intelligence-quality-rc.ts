/* RC-ALL-FULL I2-D/E quality-gated visual companion to existing D04.
 * All personal results are tied to a live in-memory IC-READ grant, not serialized.
 * No personal write or legacy I2-D proposal bypass is exposed. */
const MF_QUALITY_BINDINGS=new WeakMap<object,{
 access:any;token:string;month:string;signature:string;account:string
}>();
function mfQualityLive(app:any,reply:any):boolean{
 const b=reply&&MF_QUALITY_BINDINGS.get(reply);
 const a=app.state.localFinancialAccess;
 return !!b&&a===b.access&&b.token===a?.token&&b.month===(app.state.localFinancialMonth||app.state.month)&&
  b.signature===intelligencePremiumSignature(app)&&b.account===app.state.mfQualityAccount&&
  Number.isFinite(a.expiresAt)&&a.expiresAt>Date.now()&&
  a.source==='bank'&&a.profile==='real'&&app.state.mode==='real';
}
function mfQualityTarget(app:any):any{
 const parents=app.state.mfQualityCatalog?.parents||[];
 const p=parents.find((x:any)=>x.id===app.state.mfQualityParent);
 if(!p)return null;
 const child=app.state.mfQualityChild||null;
 if(child&&!p.subcategories?.some((s:any)=>s.id===child))return null;
 return {categoryId:p.id,subcategoryId:child};
}
async function mfQualityAuthorize(app:any){
 const s=app.state,api=desktop as any,accountId=s.mfQualityDesiredAccount;
 if(!s.localFinancialAccess?.token||s.localFinancialAccess.source!=='bank'||
    s.mode!=='real'||!accountId){
  app.setState({mfQualityError:'Autorize primeiro a leitura bancária e escolha a conta.'});return;
 }
 if(s.mfQualityBusy)return;
 app.setState({mfQualityBusy:true,mfQualityError:''});
 try{
  if(!api?.d05SessionAuthorize||!api?.d05BankAccountAuthorize||!api?.d05Catalog)
   throw Error('D05 MAIN/preload ainda indisponível');
  await api.d05SessionAuthorize({profile:'real'});
  const grant=await api.d05BankAccountAuthorize({accountId});
  const catalog=await api.d05Catalog();
  if(app.state.mfQualityDesiredAccount!==accountId)return;
  if(grant?.accountId!==accountId||!Array.isArray(catalog?.parents))
   throw Error('Não foi possível comprovar conta e catálogo D05');
  app.setState({mfQualityAccount:accountId,mfQualityCatalog:catalog,
   mfQualityParent:'',mfQualityChild:'',mfQualityId:'',
   mfQualityScan:null,mfQualityResult:null});
 }catch(e:any){app.setState({mfQualityError:String(e?.message||e).slice(0,240)});}
 finally{app.setState({mfQualityBusy:false});}
}
async function mfQualityRequest(app:any,request:any){
 const api=desktop as any,s=app.state,a=s.localFinancialAccess;
 const account=s.mfQualityAccount,month=s.localFinancialMonth||s.month;
 const signature=intelligencePremiumSignature(app);
 if(!api?.intelligenceCategoryPersonal||!a?.token||a.source!=='bank'||
    a.profile!=='real'||a.expiresAt<=Date.now()||!account){
  app.setState({mfQualityError:'Concessão IC-READ/conta bancária ausente ou expirada.'});return;
 }
 if(s.mfQualityBusy)return;
 const serial=(app.__mfQualitySerial||0)+1;app.__mfQualitySerial=serial;
 app.setState({mfQualityBusy:true,mfQualityError:'',mfQualityResult:null});
 try{
  const reply=await api.intelligenceCategoryPersonal({...request,scope:{
   token:a.token,source:a.source,profile:a.profile,month}});
  if(app.__mfQualitySerial!==serial||app.state.localFinancialAccess!==a||
     a.expiresAt<=Date.now()||app.state.mfQualityAccount!==account||
     (app.state.localFinancialMonth||app.state.month)!==month||
     intelligencePremiumSignature(app)!==signature)return;
  if(reply&&typeof reply==='object')
   MF_QUALITY_BINDINGS.set(reply,{access:a,token:a.token,month,signature,account});
  app.setState({mfQualityResult:reply,
   ...(request.method==='qualityScan'?{mfQualityScan:reply,mfQualityId:''}:{})});
 }catch(e:any){
  if(app.__mfQualitySerial===serial)
   app.setState({mfQualityError:String(e?.message||'Análise indisponível').slice(0,240)});
 }finally{if(app.__mfQualitySerial===serial)app.setState({mfQualityBusy:false});}
}
function mfI2QualityPanel(app:any):any{
 const s=app.state,a=s.localFinancialAccess;
 const live=!!a?.token&&a.expiresAt>Date.now()&&a.profile==='real'&&a.source==='bank'&&s.mode==='real';
 const result=mfQualityLive(app,s.mfQualityResult)?s.mfQualityResult:null;
 const scan=mfQualityLive(app,s.mfQualityScan)?s.mfQualityScan:null;
 const qualities=Array.isArray(scan?.data?.quality)?scan.data.quality:[];
 const accounts=s.bank?.data?.accounts||[];
 const parents=s.mfQualityCatalog?.parents||[];
 const selected=qualities.find((q:any)=>q.qualityId===s.mfQualityId);
 const target=mfQualityTarget(app);
 const busy=!!s.mfQualityBusy;
 const btn=(text:string,action:()=>void,disabled=false)=>h('button',{
  type:'button',className:'ghost-button',disabled:busy||disabled,onClick:action},text);
 const dropdown=(title:string,value:string,update:(next:string)=>void,items:any[],empty:string)=>
  h('label',{className:'mf-i2-field'},h('span',{},title),
   h('select',{value,onChange:(e:any)=>update(e.target.value)},
    h('option',{value:''},empty),
    ...items.map((item:any)=>h('option',{key:item.id,value:item.id},item.name||item.id))));
 const reason=(r:any)=>String(r||'').slice(0,200);
 return h('div',{className:'mf-i2-group mf-i2-quality',role:'region',
  'aria-label':'I2-E · recomendações com evidências verificáveis'},
  h('strong',{},'2. I2-D / I2-E · qualidade obrigatória'),
  h('p',{},'Investigações proativas em conta autorizada, com evidências por dia e ID. Sem confirmação pessoal, mesmo com boa qualidade.'),
  dropdown('Conta que será analisada',String(s.mfQualityDesiredAccount||''),
   accountId=>app.setState({mfQualityDesiredAccount:accountId,mfQualityAccount:null,
    mfQualityResult:null,mfQualityScan:null,mfQualityId:''}),
   accounts.map((x:any)=>({id:x.id,name:x.name||x.id})),'Escolha a conta'),
  btn('Autorizar esta conta pelo MAIN',()=>void mfQualityAuthorize(app),
   !live||!s.mfQualityDesiredAccount),
  live&&s.mfQualityAccount?btn('Pesquisar oportunidades I2-E',()=>void mfQualityRequest(app,{
   method:'qualityScan',filters:{accountId:s.mfQualityAccount}})):null,
  qualities.length?dropdown('Evidência encontrada',String(s.mfQualityId||''),
   qualityId=>app.setState({mfQualityId:qualityId}),
   qualities.map((q:any)=>({id:q.qualityId,
    name:(q.pattern||q.qualityId)+' · '+q.qualityStatus+' · '+q.qualityConfidence})),
   'Selecione uma evidência'):null,
  qualities.length?h('div',{className:'mf-i2-evidence'},
   h('strong',{},'Análises: '+qualities.length),
   ...qualities.slice(0,10).map((q:any)=>h('p',{key:q.qualityId},
    String(q.pattern||'')+' · '+String(q.anchorSummary?.independentDates||0)+
    ' dias independentes · '+String(q.candidateSummary?.count||0)+
    ' candidatos · '+(q.reasons||[]).map(reason).join(', ')))):null,
  selected?h('div',{className:'mf-i2-evidence'},
   h('strong',{},String(selected.pattern||'')+' · '+String(selected.qualityStatus)),
   h('p',{},'Origem '+String(selected.coverage||'')+
    ' · hash '+String(selected.evidenceHash||'').slice(0,20)),
   h('p',{},'Possíveis duplicatas: '+String(selected.duplicateWarnings?.length||0)+
    ' · Regras concorrentes: '+String(selected.rulePrecedence?.affectedRules?.length||0)),
   h('p',{},'O destino deve ser escolhido explicitamente; nenhuma subcategoria será inferida.')):null,
  selected&&parents.length?h('div',{className:'mf-i2-fields'},
   dropdown('Categoria-pai D05',String(s.mfQualityParent||''),
    id=>app.setState({mfQualityParent:id,mfQualityChild:''}),parents,'Escolha categoria'),
   dropdown('Subcategoria opcional',String(s.mfQualityChild||''),
    id=>app.setState({mfQualityChild:id}),
    parents.find((p:any)=>p.id===s.mfQualityParent)?.subcategories||[],'Sem subcategoria')):null,
  selected?h('div',{className:'mf-i2-controls'},
   btn('Inspecionar evidência',()=>void mfQualityRequest(app,{
    method:'qualityDetail',qualityId:selected.qualityId})),
   btn('Prévia hierárquica D05',()=>void mfQualityRequest(app,{
    method:'qualityDraft',qualityId:selected.qualityId,action:'historical',target}),!target),
   btn('Compor plano (sem executar)',()=>void mfQualityRequest(app,{
    method:'qualityCompose',items:[{qualityId:selected.qualityId,
     action:'historical',target}]}),!target)
  ):null,
  result?h('div',{className:'mf-i2-evidence',role:'status'},
   h('strong',{},String(result.status||'indisponível')+' · '+String(result.contract||'')),
   result.reason?h('p',{},reason(result.reason)):null,
   result.data?.quality?.qualityId?h('p',{},'Evidência '+result.data.quality.qualityId+
    ' · '+String(result.data.quality.qualityConfidence||'')):null,
   result.data?.previewVersion?h('p',{},'D05 previewVersion: '+result.data.previewVersion+
    ' · '+String(result.data.count)+' lançamentos · escrita pessoal NÃO autorizada'):null,
   result.data?.steps?h('p',{},'Plano: '+String(result.data.steps.length)+
    ' etapas · aplicação bloqueada'):null):null,
  !live?h('p',{},'Ative a leitura bancária nas permissões antes de usar o I2-E.'):null,
  busy?h('p',{role:'status'},'Conferindo as evidências locais…'):null,
  s.mfQualityError?h('p',{role:'alert'},String(s.mfQualityError).slice(0,240)):null);
}
