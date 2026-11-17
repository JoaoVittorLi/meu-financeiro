// D05 V1.3: the REAL transactions renderer, mounted by App.renderMovements().
// Do not import prototype fixtures; all amounts and rows are read from App / MAIN.
// E2 write APIs are capability-gated and never simulated.
class D05Movements extends React.Component<any,any> {
 private slots:any[]=[];
 private refSlots:any[]=[];
 private registered:any[]=[];
 private pending:any[]=[];
 private stateCursor=0;
 private refCursor=0;
 private alive=false;
 constructor(props:any){super(props);this.state={renderVersion:0};}
 componentDidMount(){this.alive=true;this.flushEffects();}
 componentDidUpdate(){this.flushEffects();}
 componentWillUnmount(){
  this.alive=false;
  for(const item of this.registered)if(typeof item?.cleanup==='function')item.cleanup();
 }
 private flushEffects(){
  for(let i=0;i<this.pending.length;i++){
   const next=this.pending[i],before=this.registered[i];
   const changed=!before||!next.deps||!before.deps||next.deps.length!==before.deps.length||
     next.deps.some((v:any,j:number)=>!Object.is(v,before.deps[j]));
   if(!changed)continue;
   if(typeof before?.cleanup==='function')before.cleanup();
   const cleanup=next.callback();
   this.registered[i]={deps:next.deps?next.deps.slice():null,cleanup};
  }
 }
 render(){
  this.stateCursor=0;this.refCursor=0;this.pending=[];
  const props=this.props;
  const useState=(initial:any)=>{
   const index=this.stateCursor++;
   if(!(index in this.slots))this.slots[index]=initial;
   return [this.slots[index],(update:any)=>{
    if(!this.alive)return;
    const prior=this.slots[index];
    const next=typeof update==='function'?update(prior):update;
    if(Object.is(next,prior))return;
    this.slots[index]=next;
    this.setState((s:any)=>({renderVersion:(s.renderVersion||0)+1}));
   }];
  };
  const useRef=(initial:any)=>{
   const index=this.refCursor++;
   if(!(index in this.refSlots))this.refSlots[index]={current:initial};
   return this.refSlots[index];
  };
  const useEffect=(callback:any,deps:any[])=>{this.pending.push({callback,deps});};

 const host=props.host, state=host.state, bridge=(window as any).financeDesktop||null;
 const [catalog,setCatalog]=useState(null as any);
 const [decor,setDecor]=useState({bank:{},manual:{}} as any);
 const [loadState,setLoadState]=useState('loading');
 const [accessMessage,setAccessMessage]=useState('');
 const incomingCategory=state.qa84TransactionsCategory||state.txCategoryFilter||'';
  const incomingIdentity=incomingCategory?resolveCategoryVisualIdentity({categoryName:incomingCategory,
   catalog:state.qa84VisualCatalog||[],aggregate:true}):null;
  const [search,setSearch]=useState(incomingIdentity?.source==='fallback'?incomingCategory:'');
 const [source,setSource]=useState(state.txSource||'all');
 const [metricSource,setMetricSource]=useState('bank');
 const [tab,setTab]=useState(state.txReviewOnly?'pending':'all');
 const [period,setPeriod]=useState(state.qa84TransactionsSpan?'':state.month||iso(new Date()).slice(0,7));
 const [account,setAccount]=useState('');
 const [kind,setKind]=useState('all');
 const [categoryId,setCategoryId]=useState(incomingIdentity&&incomingIdentity.source!=='fallback'?incomingIdentity.categoryId:'');
 const [subcategoryId,setSubcategoryId]=useState('');
 const [sort,setSort]=useState('newest');
 const [group,setGroup]=useState(true);
 const [advanced,setAdvanced]=useState(false);
 const [selected,setSelected]=useState(new Set() as Set<string>);
 const [picker,setPicker]=useState(null as any);
 const [preview,setPreview]=useState(null as any);
 const [review,setReview]=useState(null as any);
 const [manual,setManual]=useState(null as any);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [confirmedIdentity,setConfirmedIdentity]=useState(null as any);
 const [autoInfo,setAutoInfo]=useState(null as any);
 const [autoPreview,setAutoPreview]=useState(null as any);
 const [autoView,setAutoView]=useState('activation');
 const [autoHistoryEnabled,setAutoHistoryEnabled]=useState(true);
 const [autoNewEnabled,setAutoNewEnabled]=useState(true);
 const [autoReceipts,setAutoReceipts]=useState([] as any[]);
 const [autoReceiptCursor,setAutoReceiptCursor]=useState(null as string|null);
 const [autoReceiptTotal,setAutoReceiptTotal]=useState(0);
 const [autoReceiptFilter,setAutoReceiptFilter]=useState('all');
 const [autoReceiptBusy,setAutoReceiptBusy]=useState(false);
 const [autoReceiptDetail,setAutoReceiptDetail]=useState(null as any);
 const [autoProgress,setAutoProgress]=useState(null as any);
 const [autoWriteJob,setAutoWriteJob]=useState(null as any);
 const [autoSelected,setAutoSelected]=useState(new Set<string>());
 const [autoStart,setAutoStart]=useState('2000-01-01');
 const [autoEnd,setAutoEnd]=useState('2099-12-31');
 const [autoPanel,setAutoPanel]=useState(true);
 const [autoBusy,setAutoBusy]=useState(false);
 const [autoMessage,setAutoMessage]=useState('');
 const [autoRules,setAutoRules]=useState([] as any[]);
 const autoScanRef=useRef({jobId:null as string|null,stop:false});
 const autoWriteRef=useRef({jobId:null as string|null,stop:false});
 const activeTrigger=useRef(null as any);
 const modalRef=useRef(null as any);
 const refreshId=useRef(0);
 const approved=D05_APPROVED_PARENTS;
 const parents=catalog?.parents?.length?catalog.parents:approved;
 const byName=(name:string)=>parents.find((p:any)=>p.name===name)||D05ApprovedParent(name);
 const byId=(id:string)=>parents.find((p:any)=>p.id===id)||approved.find((p:any)=>p.id===id);
 const format=(cents:number)=>fmt(cents);
 const inRange=(date:string)=>period?date.slice(0,7)===period:state.qa84TransactionsSpan?
  date>=state.qa84TransactionsSpan.start&&date<=state.qa84TransactionsSpan.end:true;
 const bankData=state.mode==='demo'?[]:state.bank.data.transactions||[];
 const realBank=bankData.map((tx:any)=>{
  const key=JSON.stringify([tx.accountId,tx.id]),data=decor.bank[key]||{};
  const parent=byName(tx.category);
  const nature=tx.nature&&tx.nature!=='auto'?tx.nature:(tx.amount>=0?'income':'expense');
  return {key:'bank|'+key,id:tx.id,source:'bank',raw:tx,date:tx.date,description:tx.description,
   merchant:tx.customTitle||tx.merchant||tx.description,category:tx.category,
   categoryId:data.categoryId||parent?.id||'',subcategoryId:data.subcategoryId||null,
   amount:tx.amount,kind:nature,account:tx.accountName,accountId:tx.accountId,
   status:tx.status,reviewed:!!tx.reviewed};
 });
 const realManual=(state.data.transactions||[]).map((tx:any)=>{
  const data=decor.manual[tx.id]||{},parent=byName(tx.category);
  return {key:'manual|'+tx.id,id:tx.id,source:'manual',raw:tx,date:tx.date,
   description:tx.description,merchant:tx.description,category:tx.category,
   categoryId:tx.categoryId||data.categoryId||parent?.id||'',
   subcategoryId:tx.subcategoryId??data.subcategoryId??null,
   amount:tx.kind==='income'?tx.amount:-tx.amount,kind:tx.kind,
   account:'Adicionado por você',accountId:'',status:'MANUAL',reviewed:false};
 });
 const rows=realBank.concat(realManual);
 const refreshHierarchy=async()=>{
  if(!bridge?.d05Catalog){setLoadState('unavailable');setAccessMessage('A hierarquia D05 ainda não está conectada pelo processo principal. Consultas legadas disponíveis; classificação bancária por subcategoria bloqueada.');return;}
  const req=++refreshId.current;
  try{
   setLoadState('loading');
   if(!bridge.d05SessionAuthorize)throw Error('D05: autorização de sessão não instalada no MAIN');
   const authorization=await bridge.d05SessionAuthorize({profile:state.mode});
   if(authorization?.profile!==state.mode)throw Error('D05: sessão vinculada a outro perfil');
   const parentsResult=await bridge.d05Catalog();
   const bankResult=state.mode==='demo'?{items:[],truncated:false}:
    bridge.d05BankList?await bridge.d05BankList({limit:2500}):{items:[]};
   const manualResult=bridge.d05ManualList?await bridge.d05ManualList({profile:state.mode,limit:2500}):{items:[]};
   if(req!==refreshId.current)return;
   if(!parentsResult||!Array.isArray(parentsResult.parents))throw Error('Catálogo D05 inválido');
   const b:any={},m:any={};
   for(const t of bankResult.items||[])b[JSON.stringify([t.accountId,t.id])]={categoryId:t.categoryId,subcategoryId:t.subcategoryId};
   for(const t of manualResult.items||[])m[t.id]={categoryId:t.categoryId,subcategoryId:t.subcategoryId};
   setCatalog(parentsResult);setDecor({bank:b,manual:m});
   const readComplete=typeof bridge.d05BankList==='function'&&typeof bridge.d05ManualList==='function';
   setLoadState(readComplete?'ready':'partial');
   setAccessMessage(readComplete?'':'Consulta hierárquica parcial: as referências de banco/manual não foram registradas no preload. As linhas legadas permanecem visíveis sem inventar subcategorias.');
  }catch(e:any){
   if(req!==refreshId.current)return;
   setLoadState(/autoriz|negado|denied|permiss/i.test(String(e?.message||e))?'denied':'error');
   setAccessMessage('Catálogo D05 indisponível: '+String(e?.message||e));
  }
 };
 useEffect(()=>{
  if(state.mode==='real'&&bridge?.bankAutoStatus){
   void bridge.bankAutoStatus().then((status:any)=>{
    if(status?.contract==='D05/AUTO-CATEGORY-V1'){
     setAutoInfo(status);
     if(status.applyJob&&autoWriteJob===null)setAutoWriteJob(status.applyJob);
     if(autoInfo===null){
      const enabled=(status.permissions||[]).filter((p:any)=>p.enabled&&p.expiresAt>new Date().toISOString());
      setAutoSelected(new Set(enabled.map((p:any)=>p.accountId)));
      if(enabled.length){
       setAutoHistoryEnabled(enabled[0].historyEnabled!==0);
       setAutoNewEnabled(enabled[0].newEnabled!==0);
       setAutoStart(enabled[0].startDate||'2000-01-01');
       setAutoEnd(enabled[0].endDate||'2099-12-31');
       setAutoView('center');
      }
     }
    }
   }).catch((e:any)=>setAutoMessage(String(e?.message||e)));
  }
 },[state.mode,state.bank.data.accounts,state.bank.data.transactions]);
 const refreshAuto=async()=>{
  if(bridge?.bankAutoStatus&&state.mode==='real'){
   const result=await bridge.bankAutoStatus();setAutoInfo(result);
  }
 };
 // The renderer never receives the whole history: each MAIN call advances
 // at most 250 real SQLite rows, and progress survives process restarts.
 const scanAutoPages=async(jobId:string)=>{
  autoScanRef.current.jobId=jobId;
  autoScanRef.current.stop=false;
  while(!autoScanRef.current.stop){
   let next:any;
   try{next=await bridge.bankAutoPreviewNext(jobId);}
   catch(e:any){
    // A pause/cancel can race with an in-flight page IPC. The owner action
    // wins; do not display a false integrity error after intentional stop.
    if(autoScanRef.current.stop)break;
    throw e;
   }
   if(autoScanRef.current.stop)break;
   setAutoProgress(next);
   if(next.state==='ready'){
    setAutoPreview(next.preview);
    setAutoMessage('Análise de todo o histórico concluída sem categorizar. Revise a prévia antes de confirmar.');
    break;
   }
   if(next.state!=='scanning')break;
   // Yield so the UI can display progress and accept pause/cancel interactions.
   await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
 };
 const pauseAutoScan=async()=>{
  const id=autoScanRef.current.jobId;
  if(!id||!bridge?.bankAutoPreviewPause)return;
  autoScanRef.current.stop=true;
  try{setAutoProgress(await bridge.bankAutoPreviewPause(id));
   setAutoMessage('Análise pausada; nenhuma categoria foi aplicada.');}
  catch(e:any){setAutoMessage(String(e?.message||e));}
 };
 const resumeAutoScan=async()=>{
  const id=autoScanRef.current.jobId;
  if(!id||!bridge?.bankAutoPreviewResume)return;
  setAutoBusy(true);setAutoMessage('');
  try{setAutoProgress(await bridge.bankAutoPreviewResume(id));await scanAutoPages(id);}
  catch(e:any){setAutoMessage(String(e?.message||e));}
  finally{setAutoBusy(false);}
 };
 const cancelAutoScan=async()=>{
  const id=autoScanRef.current.jobId;
  if(!id||!bridge?.bankAutoPreviewCancel)return;
  autoScanRef.current.stop=true;
  try{await bridge.bankAutoPreviewCancel(id);autoScanRef.current.jobId=null;
   setAutoProgress(null);setAutoPreview(null);
   setAutoMessage('Análise cancelada; nenhuma classificação aplicada.');}
  catch(e:any){setAutoMessage(String(e?.message||e));}
 };
 const loadAutoReceipts=async(filter:string='all',cursor:string|null=null)=>{
  if(!bridge?.bankAutoReceipts||state.mode!=='real')return;
  setAutoReceiptBusy(true);
  try{
   const page=await bridge.bankAutoReceipts({action:filter,cursor,limit:20});
   setAutoReceipts((prev:any[])=>cursor?[...prev,...(page.items||[])]:page.items||[]);
   setAutoReceiptCursor(page.nextCursor||null);
   setAutoReceiptTotal(page.total||0);
  }catch(e:any){setAutoMessage('Falha na consulta de recibos: '+String(e?.message||e));}
  finally{setAutoReceiptBusy(false);}
 };
 const openAutoView=(view:string)=>{
  setAutoView(view);
  if(view==='receipts')void loadAutoReceipts(autoReceiptFilter);
 };
 const undoAutoReceipt=async(item:any)=>{
  if(!bridge?.bankAutoUndo||autoBusy||!item?.active)return;
  setAutoBusy(true);setAutoMessage('');
  try{
   const result=await bridge.bankAutoUndo({accountId:item.accountId,externalId:item.externalId});
   if(result?.cancelled){setAutoMessage('Desfazer cancelado; classificação preservada.');return;}
   if(!result?.undone)throw Error('O recibo não está mais associado a um rótulo ativo.');
   await host.refreshBank();await refreshAuto();await loadAutoReceipts(autoReceiptFilter);
   setAutoReceiptDetail(null);
   setAutoMessage('Classificação revertida e protegida contra reaplicação automática.');
  }catch(e:any){setAutoMessage('A reversão não foi confirmada: '+String(e?.message||e));}
  finally{setAutoBusy(false);}
 };
 const runWritePages=async(jobId:string)=>{
  if(!bridge?.bankAutoBatchNext)throw Error('Aplicação paginada indisponível no preload.');
  autoWriteRef.current={jobId,stop:false};
  let last:any=null;
  while(!autoWriteRef.current.stop){
   try{last=await bridge.bankAutoBatchNext(jobId);}
   catch(e:any){if(autoWriteRef.current.stop)break;throw e;}
   setAutoWriteJob(last);
   if(last.state!=='running')break;
   await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  if(last&&!autoWriteRef.current.stop){
   await host.refreshBank();await refreshAuto();
   if(last.state==='completed')
    setAutoMessage('Aplicação concluída: '+String(last.committed)+' classificações com recibo confirmado.');
   else if(last.state==='stale')
    setAutoMessage('Prévia desatualizada. '+String(last.committed)+' categorias gravadas permanecem válidas; não houve nova escrita depois da divergência.');
   else if(last.state==='failed')
    setAutoMessage('Falha protegida. '+String(last.committed)+' categorias já confirmadas permanecem; lote seguinte bloqueado até revisão.');
  }
 };
 const pauseWrite=async()=>{
  const id=autoWriteRef.current.jobId||autoWriteJob?.jobId;
  if(!id||!bridge?.bankAutoBatchPause)return;
  autoWriteRef.current.stop=true;
  try{const job=await bridge.bankAutoBatchPause(id);setAutoWriteJob(job);
   setAutoMessage('Aplicação pausada após '+String(job.committed)+' confirmações. Nenhuma categoria será reprocessada.');}
  catch(e:any){setAutoMessage(String(e?.message||e));}
 };
 const resumeWrite=async()=>{
  const id=autoWriteJob?.jobId;
  if(!id||!bridge?.bankAutoBatchResume)return;
  setAutoBusy(true);setAutoMessage('');
  try{const job=await bridge.bankAutoBatchResume(id);
   setAutoWriteJob(job);await runWritePages(id);}
  catch(e:any){setAutoMessage('Retomada bloqueada: '+String(e?.message||e));}
  finally{setAutoBusy(false);}
 };
 const cancelWrite=async()=>{
  const id=autoWriteJob?.jobId;
  if(!id||!bridge?.bankAutoBatchCancel)return;
  autoWriteRef.current.stop=true;
  try{const job=await bridge.bankAutoBatchCancel(id);setAutoWriteJob(job);
   await host.refreshBank();await refreshAuto();
   setAutoMessage('Lote cancelado. '+String(job.committed)+' classificações confirmadas foram preservadas; nenhuma reversão em massa foi executada.');}
  catch(e:any){setAutoMessage(String(e?.message||e));}
 };
 const runAutoAction=async(action:string,accountId:string|null=null)=>{
  if(!bridge||autoBusy||state.mode!=='real')return;
  setAutoBusy(true);setAutoMessage('');
  try{
   let result:any;
   if(action==='enable'){
    result=await bridge.bankAutoConfigure({accountIds:Array.from(autoSelected),startDate:autoStart,endDate:autoEnd,
     historyEnabled:autoHistoryEnabled,newEnabled:autoNewEnabled,insufficientAction:'review'});
    autoScanRef.current.stop=true;autoScanRef.current.jobId=null;
    setAutoProgress(null);setAutoPreview(null);setAutoView('preview');
   }else if(action==='revoke'){
    result=await bridge.bankAutoRevoke(accountId);autoScanRef.current.stop=true;
    setAutoProgress(null);setAutoPreview(null);
   }else if(action==='pause')result=await bridge.bankAutoPause();
   else if(action==='resume')result=await bridge.bankAutoResume();
   else if(action==='preview'){
    if(!bridge.bankAutoPreviewStart||!bridge.bankAutoPreviewNext)
     throw Error('Serviço de prévia paginada indisponível no preload.');
    const started=await bridge.bankAutoPreviewStart();
    autoScanRef.current.jobId=started.jobId;
    setAutoProgress(started);
    setAutoPreview(null);
    if(started.state==='ready'){
     setAutoPreview(started.preview);
     setAutoMessage('Análise anterior concluída e revalidada; nenhuma categoria aplicada.');
    }else if(started.state==='paused'){
     setAutoMessage('Análise anterior pausada. Use Retomar.');
    }else await scanAutoPages(started.jobId);
    return;
   }else if(action==='confirm'){
    if(!autoPreview?.previewVersion)throw Error('Analise o histórico antes de confirmar.');
    result=await bridge.bankAutoApply({previewVersion:autoPreview.previewVersion,limit:20000});
    if(!result?.cancelled){setAutoPreview(null);setAutoView('center');}
   }else if(action==='run')result=await bridge.bankAutoApply({limit:20000});
   else if(action==='suggest')result=await bridge.bankAutoRuleSuggestions({limit:5});
   if(action==='suggest'){setAutoRules(result?.rules||[]);setAutoMessage('Sugestões somente para prévia; nenhuma regra foi criada.');return;}
   if(result?.cancelled){setAutoMessage('Operação cancelada; nenhuma classificação aplicada.');return;}
   if(result?.batch){
    setAutoWriteJob(result.batch);setAutoView('center');
    await runWritePages(result.batch.jobId);
    return;
   }
   if(['failed','busy','paused','awaiting_explicit_consent_or_first_confirmation'].includes(result?.state))
    throw Error('A aplicação NÃO foi concluída: '+String(result.state)+'. Confira os backups e o estado dos jobs antes de tentar novamente.');
   await host.refreshBank();await refreshHierarchy();await refreshAuto();
   setAutoMessage(action==='enable'?'Contas autorizadas, mas nenhuma classificação aplicada. Confira a prévia inicial.':
    action==='revoke'?'Permissão revogada; recibos e rótulos anteriores preservados.':
    action==='pause'?'Próximas verificações automáticas pausadas. Uma aplicação já em curso não é cancelada.':
    action==='resume'?'Verificações locais reativadas, limitadas às contas já autorizadas.':
    'Verificação concluída. Movimentos incertos permanecem para revisão.');
  }catch(e:any){setAutoMessage(String(e?.message||e));}
  finally{setAutoBusy(false);}
 };
 useEffect(()=>{
  let current=true;
  if(current)void refreshHierarchy();
  return ()=>{current=false;refreshId.current++;};
 },[state.mode,state.bank.data.transactions,state.data.transactions]);
 useEffect(()=>{
  if(!picker&&!review&&!manual)return;
  const onKey=(event:any)=>{
   if(event.key==='Tab'&&modalRef.current){
    const controls=Array.from(modalRef.current.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')) as any[];
    if(controls.length){
     const first=controls[0],last=controls[controls.length-1];
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
   }
   if(event.key==='Escape'&&!busy){
   event.preventDefault();event.stopPropagation();setPicker(null);setReview(null);setManual(null);setPreview(null);
   (activeTrigger.current as any)?.focus?.();
  }};
  // Allow background scroll without silently cancelling this preview.
  window.addEventListener('keydown',onKey,true);
  return ()=>window.removeEventListener('keydown',onKey,true);
 },[picker,review,manual,busy]);
 useEffect(()=>{
  if(!(picker||review||manual)||!modalRef.current)return;
  const searchField=picker&&['parent','child'].includes(picker.phase)?
   modalRef.current.querySelector('.d05-picker-search input'):null;
  (searchField||modalRef.current.querySelector('input,button'))?.focus();
 },[picker?.phase,review?.id,manual!==null]);
 useEffect(()=>{if(!picker&&!review&&!manual)activeTrigger.current?.focus?.();},
  [!!picker,!!review,!!manual]);
 const resetSelected=()=>{setSelected(new Set());setPicker(null);setPreview(null);setError('');};
 const setFilter=(update:()=>void)=>{update();resetSelected();};
 const folded=(text:string)=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const contains=(row:any,q:string)=>{
  if(!q)return true;
  const parent=byId(row.categoryId),child=parent?.subcategories?.find((c:any)=>c.id===row.subcategoryId);
  return [row.merchant,row.description,row.category,child?.name,row.account].some(t=>folded(t).includes(q));
 };
 const filtered=rows.filter((row:any)=>{
  if(source!=='all'&&row.source!==source)return false;
  if(!inRange(row.date))return false;
  if(account&&(row.source!=='bank'||row.accountId!==account))return false;
  if(kind!=='all'&&row.kind!==kind)return false;
  if(categoryId&&row.categoryId!==categoryId)return false;
  if(subcategoryId&&row.subcategoryId!==subcategoryId)return false;
  if(!contains(row,folded(search.trim())))return false;
  if(tab==='pending')return row.source==='bank'&&row.status==='POSTED'&&!row.reviewed&&row.raw.categorySource!=='automatic';
  if(tab==='reviewed')return row.source==='bank'&&row.status==='POSTED'&&row.reviewed;
  return true;
 }).sort((a:any,b:any)=>{
  if(sort==='oldest')return a.date.localeCompare(b.date)||a.key.localeCompare(b.key);
  if(sort==='largest')return Math.abs(b.amount)-Math.abs(a.amount)||a.key.localeCompare(b.key);
  if(sort==='smallest')return Math.abs(a.amount)-Math.abs(b.amount)||a.key.localeCompare(b.key);
  return b.date.localeCompare(a.date)||a.key.localeCompare(b.key);
 });
 const onScreen=filtered.slice(0,500);
 const sources=new Set(filtered.map((r:any)=>r.source));
 const totalsSource=source==='manual'?'manual':source==='bank'?'bank':sources.has(metricSource)?metricSource:(sources.has('bank')?'bank':'manual');
 const metricsRows=filtered.filter((r:any)=>r.source===totalsSource);
 let income=0,expense=0,needs=0,ignored=0,pending=0;
 for(const r of metricsRows){
  if(r.source==='bank'&&r.status==='POSTED'&&!r.reviewed&&r.raw.categorySource!=='automatic')needs++;
  if(r.source==='bank'&&r.status!=='POSTED'){pending++;continue;}
  if(r.kind==='ignore'||r.kind==='transfer'){ignored++;continue;}
  if(r.kind==='income')income+=Math.abs(r.amount);
  else if(r.kind==='expense')expense+=Math.abs(r.amount);
 }
 const partial=state.mode==='real'&&!!state.bank.data.truncated;
 const openPicker=(event:any,row:any=null,kindName:string='row')=>{
  event?.stopPropagation?.();
  const trigger=event?.currentTarget;
  if(!trigger?.getBoundingClientRect)return;
  activeTrigger.current=trigger;
  const geometry=qa84B04Geometry(trigger.getBoundingClientRect(),
   {width:window.innerWidth,height:window.innerHeight});
  const old=row?byId(row.categoryId):null;
  setError('');setNotice('');setConfirmedIdentity(null);setPreview(null);
  setPicker({kind:kindName,row,phase:'parent',query:'',categoryId:old?.id||null,
   subcategoryId:row?.subcategoryId||null,...geometry,
   originalFingerprint:qa84B04Fingerprint(row),
   selectionSignature:kindName==='batch'?JSON.stringify(Array.from(selected).sort()):null});
 };
 // A single selector belongs to D05; the App-owned drawer requests it through
 // a scoped UI event instead of mounting a second classifier or authorizer.
 useEffect(()=>{
  const fromDrawer=(event:any)=>{
   const request=event?.detail;
   if(!request||!['bank','manual'].includes(request.source)||!request.id)return;
   const row=rows.find((r:any)=>r.source===request.source&&r.id===request.id&&
    (r.source==='manual'||r.accountId===request.accountId));
   if(!row){setError('Movimentação não encontrada; atualize o histórico.');return;}
   openPicker({currentTarget:request.trigger,stopPropagation:()=>{}},row,'drawer');
  };
  window.addEventListener('mf2:d05:open-picker',fromDrawer);
  return ()=>window.removeEventListener('mf2:d05:open-picker',fromDrawer);
 },[state.mode,state.data.transactions,state.bank.data.transactions,catalog,decor,selected]);
 const openDetail=(r:any)=>r.source==='bank'?
  host.openBankDetail(r.raw,{categoryId:r.categoryId,subcategoryId:r.subcategoryId}):
  host.openManualDetail(r.raw,{categoryId:r.categoryId,subcategoryId:r.subcategoryId});
 const setParent=(p:any)=>{
  setPreview(null);setError('');
  setPicker((old:any)=>({...old,categoryId:p.id,subcategoryId:null,phase:'child',query:''}));
 };
 const setDestination=(sub:any)=>{
  setPreview(null);setError('');
  setPicker((old:any)=>({...old,subcategoryId:sub?.id||null,phase:'confirm'}));
 };
 const labelTarget=(parentId:string,childId:string|null)=>{
  const p=byId(parentId),child=p?.subcategories?.find((x:any)=>x.id===childId);
  return (p?.name||'Categoria')+(child?' › '+child.name:'');
 };
 const handleClassify=async()=>{
  if(!picker?.categoryId)return;
  const destination={categoryId:picker.categoryId,subcategoryId:picker.subcategoryId||null};
  setBusy(true);setError('');
  try{
   if(picker.kind==='batch'){
    if(!bridge?.d05BankBatchPreview||!bridge?.d05BankBatchApply)
     throw Error('Classificação em lote D05 indisponível: integração segura MAIN/preload pendente');
    const ids=Array.from(selected).map((key:string)=>rows.find((r:any)=>r.key===key)).filter((r:any)=>r?.source==='bank');
    if(ids.length!==selected.size||!ids.length||JSON.stringify(Array.from(selected).sort())!==picker.selectionSignature)
     throw Error('Seleção alterada; inicie outra prévia');
    const items=ids.map((r:any)=>({accountId:r.accountId,externalId:r.id}));
    const data=await bridge.d05BankBatchPreview({items,target:destination});
    if(data?.contract!=='D05/BANK-BATCH-PREVIEW-V1'||!data?.previewVersion||
       data.count!==items.length)throw Error('Prévia de lote inválida');
    if(picker.selectionSignature!==JSON.stringify(Array.from(selected).sort()))
     throw Error('A seleção mudou durante a prévia');
    setPreview({...data,items,rows:ids,destination,
     fingerprints:ids.map((r:any)=>qa84B04Fingerprint(r)),
     selectionSignature:picker.selectionSignature,
     totalCents:ids.reduce((sum:number,r:any)=>sum+Math.abs(r.amount),0)});
    setPicker((old:any)=>({...old,phase:'batch-verify'}));
   }else if(picker.row?.source==='manual'){
    const tx=picker.row,existing=state.data.transactions.find((t:any)=>t.id===tx.id);
    if(!existing||state.mode!==host.state.mode)
     throw Error('Lançamento desatualizado: atualize o histórico');
    const parent=byId(destination.categoryId);
    if(!parent||destination.subcategoryId&&
      !parent.subcategories?.some((s:any)=>s.id===destination.subcategoryId))
     throw Error('Categoria/subcategoria incompatível');
    const current=rows.find((r:any)=>r.key===tx.key);
    if(!current||qa84B04Fingerprint(current)!==picker.originalFingerprint)
     throw Error('Movimentação alterada; nova prévia necessária');
    if(state.mode==='real'){
     if(!bridge?.d05PersonalWritePreview)
      throw Error('Gateway de prévia supervisionada indisponível');
     const proposed=await bridge.d05PersonalWritePreview({action:'manual.categorize',
      profile:'real',id:tx.id,target:destination});
     if(proposed?.contract!=='D05/PERSONAL-SUPERVISED-PREVIEW-V1'||
        proposed?.changesApplied!==false||proposed?.after?.categoryId!==destination.categoryId||
        proposed?.after?.subcategoryId!==destination.subcategoryId)
      throw Error('Prévia supervisionada não validada');
     setPreview(proposed);
     setPicker((old:any)=>({...old,phase:'personal-locked'}));
     setNotice('Prévia financeira validada; confirmação pessoal ainda indisponível.');
    }else{
     setPreview({type:'manual',profile:state.mode,id:tx.id,source:tx.source,
      before:{categoryId:tx.categoryId,subcategoryId:tx.subcategoryId,category:tx.category},
      after:destination,parentName:parent.name,fingerprint:picker.originalFingerprint,
      amount:tx.amount,date:tx.date,changesApplied:false});
     setPicker((old:any)=>({...old,phase:'manual-verify'}));
    }
   }else if(picker.row?.source==='bank'){
    if(!bridge?.d05AssignBank)throw Error('Classificação bancária D05 indisponível: autorização MAIN/preload pendente');
    const tx=picker.row,current=state.bank.data.transactions.find((t:any)=>t.id===tx.id&&t.accountId===tx.accountId);
    if(!current||current.amount!==tx.amount||current.status!==tx.status)
     throw Error('Movimentação alterada; atualize antes de classificar');
    // Only the explicitly authorized per-account automation can accept a
    // personal human correction here; the general IA writer stays blocked.
    if(autoInfo?.enabled&&bridge?.bankAutoCorrect&&state.mode==='real'&&
       (autoInfo.permissions||[]).some((p:any)=>p.accountId===tx.accountId&&p.enabled)){
     const accepted=await bridge.bankAutoCorrect({accountId:tx.accountId,externalId:tx.id,target:destination});
     if(accepted?.corrected){
      await host.refreshBank();await refreshHierarchy();await refreshAuto();
      setNotice('Correção humana protegida e confirmada por recibo SQLite.');
      setPicker(null);setPreview(null);return;
     }
     if(accepted?.cancelled){setNotice('Correção cancelada no MAIN.');return;}
    }
    // A personal category assignment must reach the separate supervised
    // preview contract first. In this experimental SHA the MAIN explicitly
    // denies real-bank commits; never fall back to the legacy direct write.
    if(!bridge?.d05BankAccountAuthorize||!bridge?.d05PersonalWritePreview)
     throw Error('Gateway pessoal supervisionado D05 ainda indisponível');
    await bridge.d05BankAccountAuthorize({accountId:tx.accountId});
    const proposed=await bridge.d05PersonalWritePreview({
     action:'bank.categorize',accountId:tx.accountId,externalId:tx.id,target:destination});
    if(proposed?.contract!=='D05/PERSONAL-SUPERVISED-PREVIEW-V1'||
       proposed?.changesApplied!==false||proposed?.after?.categoryId!==destination.categoryId||
       proposed?.after?.subcategoryId!==destination.subcategoryId)
     throw Error('Prévia supervisionada inválida; nenhuma alteração foi feita');
    setPreview(proposed);
    setPicker((old:any)=>({...old,phase:'personal-locked'}));
    setNotice('Prévia supervisionada conferida. A gravação pessoal permanece bloqueada até homologação.');

   }
  }catch(e:any){setError(String(e?.message||e));}
  finally{setBusy(false);}
 };
 const commitManual=async()=>{
  if(!picker||picker.phase!=='manual-verify'||preview?.type!=='manual'||busy)return;
  if(state.mode!=='demo'||preview.profile!=='demo'){
   setError('Gravação pessoal ainda não homologada. Prévia somente para consulta.');return;
  }
  const tx=state.data.transactions.find((t:any)=>t.id===preview.id);
  const current=rows.find((r:any)=>r.source==='manual'&&r.id===preview.id);
  if(!tx||!current||qa84B04Fingerprint(current)!==preview.fingerprint||
     preview.id!==picker.row?.id||picker.originalFingerprint!==preview.fingerprint){
   setError('Movimentação modificada; prepare outra prévia.');return;
  }
  const parent=byId(preview.after.categoryId);
  if(!parent||preview.after.subcategoryId&&!parent.subcategories?.some((s:any)=>s.id===preview.after.subcategoryId)){
   setError('Categoria/subcategoria não existe mais.');return;
  }
  setBusy(true);setError('');
  try{
   if(!bridge?.save||!bridge?.load)throw Error('SQLite de demonstração indisponível');
   const next={...state.data,transactions:state.data.transactions.map((t:any)=>t.id===preview.id?{
    ...t,category:parent.name,categoryId:preview.after.categoryId,subcategoryId:preview.after.subcategoryId}:t)};
   const saved=await host.updateData(next,'Classificação de demonstração salva.');
   if(!saved)throw Error('Persistência não confirmada');
   const verified=await bridge.load('demo');
   const item=verified?.transactions?.find((t:any)=>t.id===preview.id);
   if(item?.categoryId!==preview.after.categoryId||item?.subcategoryId!==preview.after.subcategoryId)
    throw Error('Recibo não confirmado: releia os dados antes de prosseguir');
   // Render a receipt with the SAME approved ID-based SVG/hue as list and drawer,
   // and only after the canonical SQLite readback confirms persistence.
   setConfirmedIdentity(qa84B03Visual({categoryId:item.categoryId,
    subcategoryId:item.subcategoryId,categoryName:item.category},parents));
   setNotice('Classificação de demonstração confirmada no SQLite.');
   setPreview(null);setPicker(null);await refreshHierarchy();
  }catch(e:any){setError('Gravação não confirmada: '+String(e?.message||e));}
  finally{setBusy(false);}
 };
 const commitBatch=async()=>{
  if(!picker||!preview?.previewVersion||!bridge?.d05BankBatchApply)return;
  // The personal batch writer is intentionally NOT authorized in this RC.
  if(state.mode!=='demo'){setError('Lote pessoal somente em prévia até homologação.');return;}
  setBusy(true);setError('');
  try{
   const ids=Array.from(selected).sort();
   const expected=preview.rows.map((r:any)=>r.key).sort();
   const fresh=preview.rows.map((r:any)=>rows.find((now:any)=>now.key===r.key));
   if(JSON.stringify(ids)!==JSON.stringify(expected)||
      preview.selectionSignature!==JSON.stringify(ids)||
      fresh.some((r:any,i:number)=>!r||qa84B04Fingerprint(r)!==preview.fingerprints[i]))
     throw Error('Seleção ou movimentação alterada; nova prévia necessária');
   const result=await bridge.d05BankBatchApply({items:preview.items,target:preview.destination,previewVersion:preview.previewVersion});
   if(result?.changed!==preview.items.length)throw Error('Recibo incompleto: verifique o histórico');
   await host.refreshBank();await refreshHierarchy();
   setNotice(result.changed+' classificação(ões) persistidas.');setPicker(null);setPreview(null);setSelected(new Set());
  }catch(e:any){setError('Prévia desatualizada ou acesso negado: '+String(e?.message||e));}
  finally{setBusy(false);}
 };
 const reviewNow=async()=>{
  if(!review||review.source!=='bank'||review.status!=='POSTED'||review.reviewed)return;
  const latest=state.bank.data.transactions.find((t:any)=>t.accountId===review.accountId&&t.id===review.id);
  if(!latest||latest.status!=='POSTED'||latest.reviewed||latest.amount!==review.amount){
   setError('Esta movimentação foi atualizada; reabra a revisão.');return;
  }
  setBusy(true);setError('');
  try{
   await host.markBankReviewed(latest);
   const current=await host.refreshBank();
   const updated=current?.data?.transactions?.find((t:any)=>t.accountId===review.accountId&&t.id===review.id);
   if(!updated?.reviewed)throw Error('Sem confirmação persistida da revisão');
   setReview(null);setNotice('Conferência registrada.');
  }catch(e:any){setError(String(e?.message||e));}
  finally{setBusy(false);}
 };
 const saveManual=async()=>{
  if(!manual||!bridge?.save)return;
  const amount=parsePositiveBRLInput(manual.value),parent=byId(manual.categoryId);
  if(!parent||!Number.isSafeInteger(amount)||amount<=0||
    !/^\d{4}-\d{2}-\d{2}$/.test(manual.date)||iso(fromISO(manual.date))!==manual.date||
    !manual.description?.trim()||!['income','expense'].includes(manual.kind)){
   setError('Confira descrição, data, valor e categoria antes de salvar.');return;
  }
  setBusy(true);setError('');
  try{
   const id='d05-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
   const tx={id,date:manual.date,description:manual.description.trim().slice(0,180),
    kind:manual.kind,amount,category:parent.name,categoryId:parent.id,
    subcategoryId:manual.subcategoryId||null,origin:'manual'};
   const data={...state.data,transactions:[...state.data.transactions,tx]};
   const saved=await host.updateData(data,'Movimentação manual registrada.');
   if(!saved)throw Error('A gravação não foi confirmada');
   setManual(null);setNotice('Lançamento registrado no SQLite.');await refreshHierarchy();
  }catch(e:any){setError(String(e?.message||e));}
  finally{setBusy(false);}
 };
 const portal=(body:any,left:number=20,top:number=60,width:number=355)=>{
  const safeTop=Math.max(12,Math.min(top,Math.max(12,window.innerHeight-130)));
  const safeWidth=Math.max(0,Math.min(width,window.innerWidth-24));
  return ReactDOM.createPortal(h('div',{className:'d05-overlay',onMouseDown:(e:any)=>{
    if(e.target===e.currentTarget&&!busy){setPicker(null);setReview(null);setManual(null);setPreview(null);activeTrigger.current?.focus?.();}
   }},
   h('section',{ref:modalRef,className:'d05-floating',role:'dialog','aria-modal':'true',
    style:{left:Math.max(12,Math.min(left,window.innerWidth-safeWidth-12)),top:safeTop,
     width:safeWidth,maxHeight:Math.max(80,window.innerHeight-safeTop-12)}},
    body)),document.body);
 };
 const categoryGrid=(selectedId:string,onSelect:(p:any)=>void,searchText:string)=>h('div',{className:'d05-catalog-grid',role:'group','aria-label':'Categorias principais'},
  parents.filter((p:any)=>folded(p.name).includes(folded(searchText))).map((p:any)=>h('button',{key:p.id,type:'button',
   className:'d05-catalog-choice '+(p.id===selectedId?'is-current':''),
   'aria-pressed':p.id===selectedId,onClick:()=>onSelect(p)},
   h(D05VectorIcon,{iconKey:p.iconKey,hue:p.hue,size:20}),h('span',{},p.name))));
 const chooser=picker?(()=>{
  const parent=byId(picker.categoryId),children=parent?.subcategories||[];
  const matches=qa84B04Search(parents,picker.query||'');
  const searchable=h('label',{className:'d05-picker-search'},h('span',{},'Buscar categoria ou subcategoria'),
   h('input',{className:'d05-search',type:'search',autoFocus:true,value:picker.query,
    placeholder:'Ex.: Streaming, alimentação, transporte',
    onChange:(e:any)=>setPicker({...picker,query:e.target.value})}));
  const resultGrid=h('div',{className:'d05-catalog-grid',role:'group','aria-label':'Categorias principais'},
   matches.map((entry:any)=>h('div',{className:'d05-catalog-result',key:entry.parent.id},
    h('button',{type:'button',className:'d05-catalog-choice '+(entry.parent.id===picker.categoryId?'is-current':''),
     'aria-pressed':entry.parent.id===picker.categoryId,
     onClick:()=>setParent(entry.parent)},
     h(D05VectorIcon,{iconKey:entry.parent.iconKey,hue:entry.parent.hue,size:21}),
     h('span',{},entry.parent.name)),
    entry.children.length?h('div',{className:'d05-catalog-match'},
     entry.children.map((child:any)=>h('button',{type:'button',key:child.id,
       onClick:()=>{setPreview(null);setError('');
        setPicker((prior:any)=>({...prior,categoryId:entry.parent.id,
         subcategoryId:child.id,phase:'confirm',query:''}));}},
       h(D05VectorIcon,{iconKey:child.iconKey,hue:child.hue,size:17}),
       entry.parent.name+' › '+child.name))):null)),
    !matches.length?h('p',{className:'d05-message',role:'status'},'Nenhuma categoria encontrada.'):null);
  return portal(h('div',{className:'d05-picker'},
   h('header',{className:'d05-floating-head'},h('div',{},h('small',{},'CLASSIFICAÇÃO'),h('h3',{},picker.kind==='batch'?'Classificar seleção':'Categoria da movimentação')),
    h('button',{type:'button','aria-label':'Cancelar classificação',onClick:()=>{setPicker(null);setPreview(null);}},'×')),
   ['parent','child'].includes(picker.phase)?searchable:null,
   picker.phase==='parent'?resultGrid:
   picker.phase==='child'?h('div',{},
    h('button',{type:'button',className:'d05-back',onClick:()=>setPicker({...picker,phase:'parent',query:''})},'← Todas as categorias'),
    h('p',{className:'d05-picker-caption'},'Escolha uma subcategoria ou mantenha apenas '+parent?.name),
    h('div',{className:'d05-child-list'},
      h('button',{type:'button',className:'d05-child',onClick:()=>setDestination(null)},
       h(D05VectorIcon,{iconKey:parent?.iconKey,hue:parent?.hue}), 'Somente '+parent?.name),
      children.filter((child:any)=>qa84B04Fold(child.name).includes(qa84B04Fold(picker.query||'')))
       .map((child:any)=>h('button',{type:'button',className:'d05-child',key:child.id,onClick:()=>setDestination(child)},
       h(D05VectorIcon,{iconKey:child.iconKey,hue:child.hue}),child.name)))):
   picker.phase==='batch-verify'?h('div',{},
    h('p',{},'Prévia: ',h('strong',{},preview?.count||0),' movimentações na seleção.'),
    h('p',{className:'d05-picker-caption'},'POSTED: '+String(preview?.posted||0)+
      ' · PENDING: '+String(preview?.pending||0)+' · Valor total: '+format(preview?.totalCents||0)),
    h('p',{className:'d05-picker-caption'},'Destino: '+labelTarget(picker.categoryId,picker.subcategoryId)),
    h('ul',{className:'d05-preview-items'},(preview?.rows||[]).slice(0,20).map((r:any)=>
     h('li',{key:r.key},r.merchant,' · ',format(Math.abs(r.amount))))) ,
    (preview?.rows?.length||0)>20?h('small',{},'Demais itens incluídos na prévia validada.'):null,
    state.mode!=='demo'?h('p',{className:'d05-message',role:'status'},
     'Classificação em lote pessoal ainda não homologada. Prévia somente para consulta.'):null,
    h('button',{type:'button',className:'d05-confirm',disabled:busy||state.mode!=='demo',
     onClick:()=>void commitBatch()},busy?'Gravando…':'Reconfirmar e aplicar lote')):
   picker.phase==='manual-verify'?h('div',{className:'d05-confirm-step'},
    h('p',{},'Antes: ',h('b',{},preview?.before?.category||'Categoria anterior')),
    h('p',{},'Depois: ',h('b',{},labelTarget(preview?.after?.categoryId,preview?.after?.subcategoryId))),
    h('p',{className:'d05-picker-caption'},picker.row?.date+' · '+format(Math.abs(preview?.amount||0))),
    state.mode!=='demo'?h('p',{className:'d05-message',role:'status'},
     'Classificação pessoal indisponível até homologação; nenhuma alteração será gravada.'):null,
    h('button',{type:'button',className:'d05-confirm',disabled:busy||state.mode!=='demo',
     onClick:()=>void commitManual()},busy?'Gravando…':'Reconfirmar e salvar demonstração')):
   picker.phase==='personal-locked'?h('div',{className:'d05-confirm-step'},
    h('p',{},'Antes: ',h('b',{},picker.row?.category||'Categoria atual')),
    h('p',{},'Depois: ',h('b',{},labelTarget(picker.categoryId,picker.subcategoryId))),
    h('p',{className:'d05-message',role:'status'},
     'Prévia supervisionada concluída. Gravação pessoal ainda não autorizada; nenhum dado foi alterado.')):
   h('div',{className:'d05-confirm-step'},
    h('p',{},'Antes: ',h('b',{},picker.row?.category||'Seleção atual')),
    h('p',{},'Depois: ',h('b',{},labelTarget(picker.categoryId,picker.subcategoryId))),
    h('button',{type:'button',className:'d05-confirm',disabled:busy,onClick:()=>void handleClassify()},
     busy?'Conferindo…':'Conferir prévia antes de salvar')),
   error?h('p',{className:'d05-message is-error',role:'alert'},error):null,
   !bridge?.d05AssignBank&&picker.row?.source==='bank'?h('p',{className:'d05-message',role:'status'},'Salvar no banco indisponível até a conexão segura do processo principal.'):null
  ),picker.left,picker.top,picker.width);
 })():null;
 const reviewPanel=review?portal(h('div',{},
  h('header',{className:'d05-floating-head'},h('div',{},h('small',{},'CONFERÊNCIA'),h('h3',{},review.merchant)),
   h('button',{type:'button','aria-label':'Fechar revisão',onClick:()=>setReview(null)},'×')),
  h('p',{},review.date.split('-').reverse().join('/'),' · ',review.account),
  h('strong',{className:review.amount<0?'d05-negative':'d05-positive'},(review.amount<0?'−':'+')+format(Math.abs(review.amount))),
  h('p',{className:'d05-picker-caption'},'Categoria: '+labelTarget(review.categoryId,review.subcategoryId)),
  h('div',{className:'d05-review-actions'},
   h('button',{type:'button',className:'d05-confirm',disabled:busy,onClick:()=>void reviewNow()},busy?'Conferindo…':'Marcar como revisada'),
   h('button',{type:'button',onClick:(e:any)=>{const row=review;setReview(null);openPicker(e,row);}},'Corrigir categoria'),
   h('button',{type:'button',onClick:()=>setReview(null)},'Agora não')),
  error?h('p',{className:'d05-message is-error',role:'alert'},error):null
 ),Math.max(14,Math.floor((window.innerWidth-355)/2)),Math.max(20,Math.floor((window.innerHeight-360)/2)),355):null;
 const manualPanel=manual?portal(h('div',{},
  h('header',{className:'d05-floating-head'},h('div',{},h('small',{},'LANÇAMENTO MANUAL'),h('h3',{},'Nova movimentação')),
   h('button',{type:'button','aria-label':'Cancelar lançamento',onClick:()=>setManual(null)},'×')),
  h('label',{className:'d05-field'},'Descrição',h('input',{value:manual.description,maxLength:180,onChange:(e:any)=>setManual({...manual,description:e.target.value})})),
  h('div',{className:'d05-inline-fields'},
   h('label',{className:'d05-field'},'Data',h('input',{type:'date',value:manual.date,onChange:(e:any)=>setManual({...manual,date:e.target.value})})),
   h('label',{className:'d05-field'},'Valor (R$)',h('input',{inputMode:'decimal',value:manual.value,placeholder:'0,00',onChange:(e:any)=>setManual({...manual,value:e.target.value})}))),
  h('div',{className:'d05-switch-row'},['expense','income'].map((v:string)=>h('button',{type:'button',className:manual.kind===v?'active':'',onClick:()=>setManual({...manual,kind:v})},v==='expense'?'Saída':'Entrada'))),
  h('p',{className:'d05-picker-caption'},'Categoria: '+labelTarget(manual.categoryId,manual.subcategoryId)),
  categoryGrid(manual.categoryId,(p:any)=>setManual({...manual,categoryId:p.id,subcategoryId:null}),'' ),
  h('div',{className:'d05-child-list'},(byId(manual.categoryId)?.subcategories||[]).length?h('div',{},
    h('button',{type:'button',className:!manual.subcategoryId?'d05-child is-current':'d05-child',onClick:()=>setManual({...manual,subcategoryId:null})},'Somente categoria-pai'),
    (byId(manual.categoryId)?.subcategories||[]).map((c:any)=>h('button',{type:'button',key:c.id,className:manual.subcategoryId===c.id?'d05-child is-current':'d05-child',onClick:()=>setManual({...manual,subcategoryId:c.id})},h(D05VectorIcon,{iconKey:c.iconKey,hue:c.hue,size:16}),c.name))):null),
  h('button',{type:'button',className:'d05-confirm',disabled:busy,onClick:()=>void saveManual()},busy?'Salvando…':'Confirmar lançamento'),
  error?h('p',{className:'d05-message is-error',role:'alert'},error):null
 ),Math.max(12,Math.floor((window.innerWidth-540)/2)),22,540):null;
 if(state.booting)return h('section',{className:'d05-screen',id:'d05-movements',role:'status'},
  h('p',{className:'d05-notice'},'Carregando registros financeiros…'));
 return h('section',{className:'d05-screen',id:'d05-movements'},
  h('header',{className:'d05-head'},
   h('div',{},h('h1',{},'Movimentações'),h('p',{},'Seu histórico organizado, com contexto e controle.')),
   h('div',{className:'d05-head-actions'},
    h('button',{type:'button',onClick:()=>host.csvInput?.click()},'Importar CSV'),
    h('button',{type:'button',className:'d05-primary',onClick:(e:any)=>{activeTrigger.current=e.currentTarget;setError('');setManual({description:'',date:iso(new Date()),value:'',kind:'expense',categoryId:'cat:outros',subcategoryId:null});}},'+ Nova movimentação'))),
  state.booting?h('p',{className:'d05-notice',role:'status'},'Carregando dados financeiros…'):null,
  loadState==='loading'&&bridge?.d05Catalog?h('p',{className:'d05-notice',role:'status'},'Conferindo hierarquia D05…'):null,
  loadState!=='ready'&&loadState!=='loading'?h('p',{className:'d05-notice',role:'status'},accessMessage):null,
  notice?h('p',{className:'d05-notice',role:'status'},
   confirmedIdentity?h(D05VectorIcon,{iconKey:confirmedIdentity.iconKey,
    hue:confirmedIdentity.hue,size:17}):null,
   confirmedIdentity?confirmedIdentity.label+' · ':null,notice):null,
  state.mode==='real'&&bridge?.bankAutoStatus?h('section',{
   className:'d05-auto-box mf-cat-shell','aria-label':'Central de categorização automática'},
   h('header',{className:'mf-cat-hero'},
    h('div',{className:'mf-cat-identity'},
     h('span',{className:'mf-cat-eyebrow'},'INTELIGÊNCIA FINANCEIRA  ·  CAT-UX'),
     h('h2',{},'Categorização inteligente'),
     h('p',{},'Evidências locais verificáveis, sempre sob o seu controle.')),
    h('div',{className:'mf-cat-header-actions'},
     h('span',{className:'mf-cat-state','data-state':!autoInfo?.available?'unavailable':
      autoInfo?.jobs?.paused?'paused':autoInfo?.enabled?'active':'inactive'},
      !autoInfo?.available?'Aguardando homologação':autoInfo?.jobs?.paused?'Pausada':
       autoInfo?.enabled?'Contas autorizadas':'Não ativada'),
     h('button',{type:'button',className:'d05-ghost','aria-expanded':autoPanel,
      onClick:()=>setAutoPanel(!autoPanel)},autoPanel?'Recolher':'Abrir central'))),
   h('div',{className:'mf-cat-glance',role:'status','aria-label':'Resumo da automação'},
    h('div',{},h('small',{},'Aplicadas no momento'),h('strong',{},String(autoInfo?.counts?.classified??0))),
    h('div',{},h('small',{},'Precisam de revisão'),h('strong',{},String(autoInfo?.counts?.awaitingReview??0))),
    h('div',{},h('small',{},'Contas autorizadas'),h('strong',{},String((autoInfo?.permissions||[]).filter((p:any)=>p.enabled&&p.expiresAt>new Date().toISOString()).length)))),
   autoPanel?h('div',{className:'mf-cat-content'},
    h('nav',{className:'mf-cat-nav',role:'tablist','aria-label':'Etapas e recursos da categorização'},
     [{id:'activation',name:'Ativação',number:'01'},
      {id:'preview',name:'Análise',number:'02'},
      {id:'center',name:'Central',number:'03'},
      {id:'rules',name:'Regras',number:'04'},
      {id:'receipts',name:'Recibos',number:'05'},
      {id:'security',name:'Segurança',number:'06'}].map((v:any)=>
      h('button',{key:v.id,id:'mf-cat-tab-'+v.id,type:'button',role:'tab',
       'aria-selected':autoView===v.id,'aria-controls':'mf-cat-panel-'+v.id,
       className:autoView===v.id?'is-current':'',
       onClick:()=>openAutoView(v.id)},h('small',{},v.number),v.name))),
    autoWriteJob?h('div',{className:'mf-cat-write-state',role:'status','aria-live':'polite'},
     h('div',{className:'mf-cat-progress-label'},
      h('strong',{},'Aplicação em lotes · '+(autoWriteJob.state==='completed'?'Concluída':
       autoWriteJob.state==='running'?'Gravando recibos':autoWriteJob.state==='paused'?'Pausada':
       autoWriteJob.state==='cancelled'?'Cancelada':autoWriteJob.state==='stale'?'Prévia desatualizada':'Falha protegida')),
      h('span',{},String(autoWriteJob.committed||0)+' / '+String(autoWriteJob.proposedTotal||0)+' commits')),
     h('progress',{max:Math.max(1,autoWriteJob.proposedTotal||0),
      value:Math.min(autoWriteJob.committed||0,Math.max(1,autoWriteJob.proposedTotal||0)),
      'aria-label':'Classificações efetivamente confirmadas no SQLite'}),
     h('p',{className:'mf-cat-footnote'},autoWriteJob.state==='completed'?
      'Todas as propostas válidas foram processadas; confira os recibos.':
      autoWriteJob.state==='stale'?'Dados ou autorizações mudaram. O lote está bloqueado até nova prévia.':
      autoWriteJob.state==='failed'?'Erro de backup ou COMMIT. O que já foi confirmado possui recibo; nenhuma conclusão foi declarada.':
      autoWriteJob.state==='cancelled'?'As classificações confirmadas permanecem. Não foi feito desfazer em massa.':
      'A contagem só avança depois do COMMIT SQLite.'),
     ['running','paused','failed'].includes(autoWriteJob.state)?h('div',{className:'mf-cat-toolbar'},
      autoWriteJob.state==='running'?h('button',{type:'button',onClick:()=>void pauseWrite()},'Pausar aplicação'):
       h('button',{type:'button',onClick:()=>void resumeWrite()},'Retomar com revalidação'),
      h('button',{type:'button',onClick:()=>void cancelWrite()},'Cancelar novas aplicações')):null
    ):null,
    h('div',{id:'mf-cat-panel-'+autoView,role:'tabpanel','aria-labelledby':'mf-cat-tab-'+autoView,
     className:'mf-cat-stage',tabIndex:0},
     autoView==='activation'?h('div',{className:'mf-cat-grid-layout'},
      h('section',{className:'mf-cat-surface'},
       h('div',{className:'mf-cat-section-top'},h('span',{className:'mf-cat-step'},'01 / CONFIGURAÇÃO'),
        h('h3',{},'Escolha onde a automação pode atuar'),
        h('p',{},'Nenhuma conta é escolhida automaticamente. O consentimento será solicitado no aplicativo.')),
       !(state.bank.data.accounts||[]).length?h('p',{className:'mf-cat-empty',role:'status'},
        'Nenhuma conta bancária disponível. Conecte uma conta e sincronize seus dados antes de autorizar.'):null,
       h('div',{className:'mf-cat-account-list'},
        (state.bank.data.accounts||[]).map((account:any)=>{
         const permission=(autoInfo?.permissions||[]).find((p:any)=>p.accountId===account.id);
         const expired=!!permission&&permission.expiresAt<=new Date().toISOString();
         return h('button',{key:account.id,type:'button',
          className:'mf-cat-account '+(autoSelected.has(account.id)?'is-selected':''),
          disabled:autoBusy||!autoInfo?.available,
          'aria-pressed':autoSelected.has(account.id),
          onClick:()=>{const next=new Set(autoSelected);
           if(next.has(account.id))next.delete(account.id);else next.add(account.id);setAutoSelected(next);}},
          h('span',{className:'mf-cat-account-mark','aria-hidden':'true'},autoSelected.has(account.id)?'✓':''),
          h('span',{className:'mf-cat-account-text'},h('strong',{},account.name),
           h('small',{},expired?'Autorização expirada · renove para continuar':
            permission?.enabled?'Autorização existente · alterável':'Não autorizada')),
          h('span',{className:'mf-cat-account-tail','aria-hidden':'true'},autoSelected.has(account.id)?'Selecionada':'Selecionar'));
        })),
       h('div',{className:'d05-auto-period mf-cat-period'},
        h('label',{},'Histórico desde',h('input',{type:'date',value:autoStart,
         disabled:autoBusy||!autoHistoryEnabled,onChange:(e:any)=>setAutoStart(e.target.value)})),
        h('label',{},'Até',h('input',{type:'date',value:autoEnd,disabled:autoBusy,
         onChange:(e:any)=>setAutoEnd(e.target.value)}))),
       h('p',{className:'mf-cat-footnote'},'Alterar contas ou período exige novo consentimento e invalida a prévia anterior.')),
      h('aside',{className:'mf-cat-surface mf-cat-preferences'},
       h('span',{className:'mf-cat-step'},'PREFERÊNCIAS'),
       h('h3',{},'Como a classificação deve funcionar?'),
       h('button',{type:'button',className:'mf-cat-policy '+(autoHistoryEnabled?'is-selected':''),
        disabled:autoBusy||!autoInfo?.available,'aria-pressed':autoHistoryEnabled,
        onClick:()=>setAutoHistoryEnabled(!autoHistoryEnabled)},
        h('span',{},h('strong',{},'Analisar meu histórico disponível'),
         h('small',{},'Prévia de registros anteriores, sem alterar os originais')),
        h('span',{className:'mf-cat-switch','aria-hidden':'true'})),
       h('button',{type:'button',className:'mf-cat-policy '+(autoNewEnabled?'is-selected':''),
        disabled:autoBusy||!autoInfo?.available,'aria-pressed':autoNewEnabled,
        onClick:()=>setAutoNewEnabled(!autoNewEnabled)},
        h('span',{},h('strong',{},'Categorizar novas movimentações'),
         h('small',{},'Verificações locais após sync e durante o uso do app')),
        h('span',{className:'mf-cat-switch','aria-hidden':'true'})),
       h('div',{className:'mf-cat-policy is-fixed'},
        h('span',{},h('strong',{},'Quando não houver evidência suficiente'),
         h('small',{},'Enviar à revisão. Nunca adivinhar categorias.')),
        h('span',{className:'mf-cat-fixed'},'Sempre revisar')),
       h('div',{className:'mf-cat-guarantee'},
        h('strong',{},'O que permanece protegido'),
        h('p',{},'Valores, datas, extratos originais, classificações manuais, splits, transferências e regras aprovadas.')),
       h('button',{type:'button',className:'d05-confirm mf-cat-main-action',
        disabled:autoBusy||!autoInfo?.available||autoSelected.size===0||(!autoHistoryEnabled&&!autoNewEnabled),
        onClick:()=>void runAutoAction('enable')},autoBusy?'Aguardando confirmação…':'Autorizar contas e avançar'),
       h('p',{className:'mf-cat-footnote'},'As opções acima são sugestões. Só a confirmação nativa concede permissão; nenhuma categoria será aplicada nesta etapa.'))
     ):null,
     autoView==='preview'?h('section',{className:'mf-cat-surface'},
      h('div',{className:'mf-cat-section-top'},h('span',{className:'mf-cat-step'},'02 / EVIDENCE FLOW'),
       h('h3',{},'Análise e prévia verificável'),
       h('p',{},'O histórico é lido no SQLite em lotes de até 250; nenhum resultado é gravado antes de sua confirmação.')),
      h('div',{className:'mf-cat-toolbar'},
       h('button',{type:'button',className:'d05-confirm',
        disabled:autoBusy||!autoInfo?.available||!autoInfo?.enabled||autoProgress?.state==='scanning',
        onClick:()=>void runAutoAction('preview')},autoBusy?'Analisando…':'Analisar histórico autorizado'),
       autoProgress?.state==='scanning'?h('button',{type:'button',
        onClick:()=>void pauseAutoScan()},'Pausar'):null,
       autoProgress?.state==='paused'?h('button',{type:'button',
        onClick:()=>void resumeAutoScan()},'Retomar'):null,
       ['scanning','paused'].includes(autoProgress?.state)?h('button',{type:'button',
        onClick:()=>void cancelAutoScan()},'Cancelar leitura'):null),
      autoProgress?h('div',{className:'mf-cat-progress',role:'status','aria-live':'polite'},
       h('div',{className:'mf-cat-progress-label'},h('strong',{},autoProgress.state==='ready'?'Leitura concluída':
         autoProgress.state==='paused'?'Leitura pausada':'Lendo movimentações'),
         h('span',{},String(autoProgress.processed||0)+' / '+String(autoProgress.total||0))),
       h('progress',{value:autoProgress.processed||0,max:Math.max(1,autoProgress.total||0),
        'aria-label':'Movimentações efetivamente lidas'})):null,
      autoInfo?.applyJob?.state==='stale'?h('p',{className:'d05-notice',role:'alert'},
       'O lote anterior ficou desatualizado. Uma nova leitura e confirmação são obrigatórias; os recibos já gravados serão preservados.'):null,
      autoPreview?h('div',{},
       h('div',{className:'mf-cat-metric-grid'},
        [{title:'Aplicáveis',value:autoPreview.candidateCount||0},
         {title:'A revisar',value:autoPreview.reviewCount||0},
         {title:'Protegidas',value:autoPreview.protectedCount||0},
         {title:'Indisponíveis',value:autoPreview.unavailableCount||0}].map((m:any)=>
          h('div',{key:m.title,className:'mf-cat-mini-stat'},h('small',{},m.title),h('strong',{},String(m.value))))),
       h('p',{className:'mf-cat-caption'},'Total analisado no escopo: '+String(autoPreview.analyzedCount??'—')+
        '. As contagens acima não incluem registros fora do consentimento.'),
       h('div',{className:'mf-cat-section-top'},h('h3',{},'Amostras de propostas D05'),
        h('p',{},'Mostrando '+Math.min(12,(autoPreview.candidates||[]).length)+' de '+
          String(autoPreview.candidateCount||0)+' aplicáveis. Nenhuma categoria foi aplicada.')),
       h('div',{className:'mf-cat-proposal-list'},
        (autoPreview.candidates||[]).slice(0,12).map((item:any)=>{
         const parent=byId(item.target?.categoryId);
         const child=(parent?.subcategories||[]).find((c:any)=>c.id===item.target?.subcategoryId);
         return h('article',{className:'mf-cat-proposal',key:item.accountId+'|'+item.externalId},
          h('div',{className:'mf-cat-proposal-icon'},parent?h(D05VectorIcon,{iconKey:parent.iconKey,hue:parent.hue,size:20}):null),
          h('div',{},h('strong',{},item.merchant||'Identificação comercial'),
           h('small',{},item.explanation||'Evidência local')),
          h('span',{className:'mf-cat-proposal-target'},(parent?.name||item.target?.categoryId||'Categoria')+
           (child?' · '+child.name:'')));
        })),
       h('div',{className:'mf-cat-confirm-strip'},
        h('div',{},h('strong',{},'Pronto para confirmar?'),
         h('p',{},'A confirmação nativa revalidará o manifesto e criará backups e recibos antes de gravar.')),
        h('button',{type:'button',className:'d05-confirm',
         disabled:autoBusy||!autoInfo?.available||autoProgress?.state!=='ready'||
          !autoPreview.previewVersion||(autoInfo?.initialConfirmed&&!!autoInfo?.applyJob&&autoInfo?.applyJob?.state!=='stale'),
         onClick:()=>void runAutoAction('confirm')},'Conferi; aplicar propostas elegíveis')),
       autoPreview.candidateCount>20000?h('p',{className:'mf-cat-caption'},
        'Volume elevado: o motor fará commits atômicos de até 250 propostas, com progresso e recuperação persistentes.'):null
      ):h('p',{className:'mf-cat-empty'},'Nenhuma prévia confirmável nesta sessão. Autorize suas contas e execute a análise somente leitura.'),
      !autoInfo?.available?h('p',{className:'d05-notice'},'A RC experimental não possui permissão para escrita pessoal.'):null
     ):null,
     autoView==='center'?h('div',{className:'mf-cat-grid-layout'},
      h('section',{className:'mf-cat-surface'},
       h('span',{className:'mf-cat-step'},'03 / RASTRO VIVO'),
       h('h3',{},'Central da automação'),
       h('p',{className:'mf-cat-caption'},'Eventos reais de sincronização, verificações locais e classificações confirmadas.'),
       h('div',{className:'mf-cat-metric-grid'},
        [{title:'Aplicadas atualmente',value:autoInfo?.counts?.classified||0},
         {title:'Encaminhadas à revisão',value:autoInfo?.counts?.awaitingReview||0},
         {title:'Protegidas',value:autoInfo?.counts?.protected||0}].map((m:any)=>
         h('div',{key:m.title,className:'mf-cat-mini-stat'},h('small',{},m.title),h('strong',{},String(m.value))))),
       h('h4',{},'Atividade recente'),
       (autoInfo?.jobs?.jobs||[]).length?
        h('div',{className:'mf-cat-timeline'},(autoInfo.jobs.jobs||[]).slice(0,8).map((j:any)=>
         h('div',{key:j.jobKey,className:'mf-cat-timeline-row'},
          h('span',{className:'mf-cat-timeline-dot','data-state':j.state,'aria-hidden':'true'}),
          h('div',{},h('strong',{},j.trigger==='sync'?'Após sincronização':
           j.trigger==='daily'?'Verificação diária':'Ação manual'),
           h('small',{},j.startedAt?new Date(j.startedAt).toLocaleString('pt-BR'):'Horário indisponível')),
          h('span',{},j.state==='completed'?String(j.applied||0)+' aplicadas':
           j.state==='running'?'Interrompida / em andamento':'Falha protegida')))):
        h('p',{className:'mf-cat-empty'},'Ainda não há execução registrada.'),
       h('div',{className:'mf-cat-toolbar'},
        h('button',{type:'button',disabled:autoBusy||!autoInfo?.enabled||!autoInfo?.available||autoInfo?.jobs?.paused,
         onClick:()=>void runAutoAction('run')},'Verificar movimentações'),
        h('button',{type:'button',onClick:()=>openAutoView('receipts')},'Ver recibos'),
        h('button',{type:'button',onClick:()=>{setTab('pending');setSource('bank');setAutoPanel(false);}},
         'Abrir A conferir (D05)')),
       h('p',{className:'mf-cat-footnote'},'O histórico financeiro completo permanece em Movimentações; a Central não duplica seus lançamentos.')),
      h('aside',{className:'mf-cat-surface'},
       h('span',{className:'mf-cat-step'},'CONTROLE POR CONTA'),
       h('h3',{},'Permissões e execução'),
       (autoInfo?.permissions||[]).length?h('div',{className:'mf-cat-permissions'},
        (autoInfo.permissions||[]).map((p:any)=>{
         const expired=p.expiresAt<=new Date().toISOString();
         return h('div',{key:p.accountId,className:'mf-cat-permission-row'},
          h('div',{},h('strong',{},p.name),h('small',{},expired?'Expirada':
           p.enabled?autoInfo?.jobs?.paused?'Ativa · automação pausada':'Ativa':'Revogada')),
          p.enabled?h('button',{type:'button',disabled:autoBusy||!autoInfo?.available,
           onClick:()=>void runAutoAction('revoke',p.accountId)},'Revogar'):null);
        })):h('p',{className:'mf-cat-empty'},'Nenhuma conta autorizada.'),
       h('div',{className:'mf-cat-toolbar'},
        autoInfo?.enabled?h('button',{type:'button',disabled:autoBusy||!autoInfo?.available,
         onClick:()=>void runAutoAction(autoInfo?.jobs?.paused?'resume':'pause')},
         autoInfo?.jobs?.paused?'Reativar automação':'Pausar automação'):null,
        h('button',{type:'button',onClick:()=>openAutoView('activation')},'Gerenciar contas')),
       h('p',{className:'mf-cat-footnote'},'Pausar mantém o consentimento; revogar impede novas classificações automáticas.'))
     ):null,
     autoView==='rules'?h('section',{className:'mf-cat-surface'},
      h('span',{className:'mf-cat-step'},'04 / REGRAS E EVIDÊNCIAS'),
      h('h3',{},'Laboratório de padrões'),
      h('p',{},'Sugestões são somente leitura. Aprovar ou editar regras exige o fluxo protegido do catálogo D05.'),
      h('div',{className:'mf-cat-toolbar'},
       h('button',{type:'button',className:'d05-confirm',disabled:autoBusy||!autoInfo?.available||!autoInfo?.enabled,
        onClick:()=>void runAutoAction('suggest')},'Buscar padrões verificáveis'),
       h('button',{type:'button',onClick:()=>host.setState({txOrganize:true})},'Abrir editor D05')),
      autoRules.length?h('div',{className:'mf-cat-rule-grid'},autoRules.map((r:any)=>
       h('article',{key:r.accountId+'|'+r.pattern,className:'mf-cat-rule'},
        h('small',{className:'mf-cat-step'},'SUGESTÃO · NÃO APLICADA'),
        h('h4',{},r.pattern),
        h('p',{},'Conta: '+String((state.bank.data.accounts||[]).find((x:any)=>x.id===r.accountId)?.name||'Conta autorizada')),
        h('div',{className:'mf-cat-rule-facts'},
         h('span',{},String(r.suggestedFor||0)+' ocorrências verificadas'),
         h('span',{},String(r.possibleMatches||0)+' possíveis correspondências'),
         h('span',{},String(r.possiblePrecedenceConflicts||0)+' conflitos de precedência')),
        h('p',{className:'mf-cat-caption'},r.possiblePrecedenceConflicts?
         'Revisar conflitos antes de considerar qualquer regra.':'Nenhuma regra foi criada. Confira o alcance no editor D05.'),
        h('button',{type:'button',onClick:()=>host.setState({txOrganize:true})},'Revisar no D05')))):
       h('p',{className:'mf-cat-empty'},'Nenhuma sugestão consultada ou com evidência suficiente. Isso não significa que uma regra foi aprovada.'),
      h('h4',{},'Regras já ativas no D05'),
      (state.rules||[]).filter((r:any)=>r.enabled&&(r.scope==='bank'||r.scope==='both')).length?
       h('div',{className:'mf-cat-rule-grid'},
        (state.rules||[]).filter((r:any)=>r.enabled&&(r.scope==='bank'||r.scope==='both'))
        .slice(0,8).map((r:any)=>h('article',{key:r.id,className:'mf-cat-rule'},
         h('span',{className:'mf-cat-step'},'REGRA ATIVA DO D05'),
         h('h4',{},r.pattern),
         h('p',{},'Destino: '+r.category+' · Correspondência: '+r.matchMode+
          ' · Prioridade: '+r.priority),
         h('button',{type:'button',onClick:()=>host.setState({txOrganize:true})},
          'Gerenciar no catálogo')))):
       h('p',{className:'mf-cat-empty'},'Nenhuma regra bancária ativa disponível no catálogo D05.'),
      h('p',{className:'mf-cat-footnote'},'Âncoras humanas duplicadas e classificação probabilística não calibrada não autorizam regras.'))
      :null,
     autoView==='receipts'?h('section',{className:'mf-cat-surface'},
      h('span',{className:'mf-cat-step'},'05 / AUDITORIA E REVERSÃO'),
      h('h3',{},'Histórico de recibos confirmados'),
      h('p',{},'Cada recibo é um registro persistido pelo SQLite. Reversões são individuais e exigem confirmação nativa.'),
      h('div',{className:'mf-cat-toolbar',role:'group','aria-label':'Filtrar recibos'},
       [{id:'all',label:'Todas'}, {id:'apply',label:'Aplicações'},
        {id:'correct',label:'Correções'}, {id:'undo',label:'Reversões'}].map((v:any)=>
         h('button',{key:v.id,type:'button','aria-pressed':autoReceiptFilter===v.id,
          className:autoReceiptFilter===v.id?'is-selected':'',
          disabled:autoReceiptBusy,onClick:()=>{
           setAutoReceiptFilter(v.id);setAutoReceiptDetail(null);
           void loadAutoReceipts(v.id);}},v.label))),
      h('p',{className:'mf-cat-caption'},String(autoReceiptTotal)+' recibo(s) neste filtro. '+
       'A listagem não altera movimentações.'),
      autoReceipts.length?h('div',{className:'mf-cat-receipt-list'},
       autoReceipts.map((r:any)=>
        h('article',{key:r.receiptId,className:'mf-cat-receipt'},
         h('div',{className:'mf-cat-receipt-top'},
          h('span',{className:'mf-cat-step'},r.action==='apply'?'CATEGORIZAÇÃO':
           r.action==='undo'?'REVERSÃO':'CORREÇÃO HUMANA'),
          h('small',{},r.at?new Date(r.at).toLocaleString('pt-BR'):'Sem data confirmada')),
         h('strong',{},r.description||'Movimentação bancária'),
         h('p',{},(r.accountName||'Conta do histórico')+' · '+
          String(byId(r.afterCategoryId)?.name||r.afterCategoryId||'Sem categoria após operação')),
         h('div',{className:'mf-cat-toolbar'},
          h('button',{type:'button','aria-expanded':autoReceiptDetail?.receiptId===r.receiptId,
           onClick:()=>setAutoReceiptDetail(autoReceiptDetail?.receiptId===r.receiptId?null:r)},'Detalhes'),
          r.action==='apply'&&r.active&&!r.reversed?h('button',{type:'button',
           disabled:autoBusy||!autoInfo?.available,onClick:()=>void undoAutoReceipt(r)},'Desfazer classificação'):null,
          h('button',{type:'button',onClick:()=>{
           setSearch(r.description||'');setSource('bank');setTab('all');setAutoPanel(false);
          }},'Localizar em Movimentações')),
         autoReceiptDetail?.receiptId===r.receiptId?h('div',{className:'mf-cat-receipt-detail'},
          h('p',{},'ID do recibo: '+r.receiptId),
          h('p',{},'Movimentação: '+r.accountId+' / '+r.externalId),
          h('p',{},'Antes: '+(byId(r.beforeCategoryId)?.name||r.beforeCategoryId||'Sem classificação D05')),
          h('p',{},'Depois: '+(byId(r.afterCategoryId)?.name||r.afterCategoryId||'Sem classificação D05')),
          h('p',{},'Evidência: '+(r.explanation||'Hash registrado no recibo (detalhes não preservados neste registro).')),
          h('p',{},'Commit SQLite confirmado · '+(r.reversed?'Revertida':r.active?'Ativa':'Não ativa'))):null
        ))):h('p',{className:'mf-cat-empty'},autoReceiptBusy?'Consultando recibos…':'Nenhum recibo encontrado neste filtro.'),
      autoReceiptCursor?h('button',{type:'button',disabled:autoReceiptBusy,
       onClick:()=>void loadAutoReceipts(autoReceiptFilter,autoReceiptCursor)},
       autoReceiptBusy?'Carregando…':'Carregar mais recibos'):null
     ):null,
     autoView==='security'?h('div',{className:'mf-cat-grid-layout'},
      h('section',{className:'mf-cat-surface'},
       h('span',{className:'mf-cat-step'},'06 / RESILIÊNCIA'),
       h('h3',{},'Segurança e recuperação'),
       h('p',{},'Esta área informa estados existentes. Não faz reparos destrutivos ou sincronizações adicionais.'),
       h('div',{className:'mf-cat-security-list'},
        [{title:'Disponibilidade',value:autoInfo?.available?'Distribuição estável habilitada':'Somente após homologação'},
         {title:'Autorização',value:autoInfo?.enabled?'Contas no período de validade':'Sem contas válidas autorizadas'},
         {title:'Primeiro lote',value:autoInfo?.initialConfirmed?'Confirmado no MAIN':'Aguardando prévia e confirmação'},
         {title:'Verificações',value:autoInfo?.jobs?.paused?'Pausadas explicitamente':'Automação local não pausada'},
         {title:'Último job',value:(autoInfo?.jobs?.jobs||[])[0]?.state||'Nenhuma execução'}].map((v:any)=>
         h('div',{key:v.title,className:'mf-cat-security-row'},
          h('strong',{},v.title),h('span',{},v.value)))),
       (autoInfo?.jobs?.jobs||[]).some((x:any)=>x.state==='failed'||x.state==='running')?
        h('p',{className:'d05-notice',role:'alert'},'Há job falho ou interrompido. Consulte os recibos; uma nova tentativa só deve ocorrer com consentimento válido e estado íntegro.'):null,
       autoMessage?h('p',{className:'d05-notice',role:'alert'},autoMessage):null),
      h('aside',{className:'mf-cat-surface'},
       h('span',{className:'mf-cat-step'},'GARANTIAS'),
       h('h3',{},'O que nunca muda sem sua decisão'),
       h('p',{},'A categorização utiliza overlay separado. O extrato bancário e os valores originais não são substituídos.'),
       h('p',{},'Um backup verificado é necessário antes da escrita. Falhas de aplicação bloqueiam novas tentativas automáticas.'),
       h('div',{className:'mf-cat-toolbar'},
        h('button',{type:'button',onClick:()=>openAutoView('receipts')},'Consultar recibos'),
        h('button',{type:'button',onClick:()=>openAutoView('activation')},'Revisar autorizações')),
       !autoInfo?.available?h('p',{className:'mf-cat-empty'},'Disponível após homologação Windows. Nenhuma escrita pessoal será habilitada na RC experimental.'):null
      )
     ):null
    ),
    autoView!=='security'&&autoMessage?h('p',{className:'d05-notice',role:'status','aria-live':'polite'},autoMessage):null
   ):null
  ):null,
  h('div',{className:'d05-metrics'},
   [{name:'Entradas confirmadas',value:format(income),tone:'positive',note:'No escopo selecionado'},
    {name:'Saídas confirmadas',value:format(expense),tone:'negative',note:'Sem pendentes'},
    {name:'Resultado dos registros',value:format(income-expense),tone:income-expense>=0?'positive':'negative',note:'Não é saldo disponível'},
    {name:'A conferir',value:String(needs),tone:'review',note:'Banco POSTED não revisado'}
   ].map((m:any,i:number)=>h(i===3?'button':'article',{key:m.name,type:i===3?'button':undefined,
     className:'d05-metric is-'+m.tone,onClick:i===3?()=>setFilter(()=>{setTab('pending');setSource('bank');setMetricSource('bank');}):undefined},
     h('small',{},m.name),h('strong',{},m.value),h('span',{},m.note)))),
  h('section',{className:'d05-history'},
   h('div',{className:'d05-section-head'},
    h('div',{},h('h2',{},'Seu histórico'),h('p',{},'Valores por '+(totalsSource==='bank'?'contas bancárias':'movimentações manuais')+
      (source==='all'&&sources.size>1?' · outras origens visíveis, sem somar duplicatas':''))),
    h('button',{type:'button',className:'d05-ghost',onClick:()=>{host.setState({txOrganize:true});}},'Categorias e regras')),
   h('div',{className:'d05-tabs',role:'group','aria-label':'Situação da conferência'},
    [{id:'all',label:'Todas'},{id:'pending',label:'A conferir'},{id:'reviewed',label:'Revisadas'}].map((x:any)=>
      h('button',{type:'button',key:x.id,'aria-pressed':tab===x.id,className:tab===x.id?'active':'',
       onClick:()=>setFilter(()=>setTab(x.id))},x.label))),
   h('div',{className:'d05-toolbar'},
    h('label',{className:'d05-search-wrap'},h('span',{className:'d05-sr-only'},'Buscar movimentações'),h('input',{
      value:search,placeholder:'Buscar estabelecimento, descrição ou categoria',
      onChange:(e:any)=>setFilter(()=>setSearch(e.target.value))})),
    h('label',{className:'d05-filter'},'Origem',h('select',{value:source,onChange:(e:any)=>setFilter(()=>setSource(e.target.value))},
     h('option',{value:'all'},'Todas'),h('option',{value:'bank'},'Banco'),h('option',{value:'manual'},'Manuais'))),
    h('label',{className:'d05-filter'},'Mês',h('input',{type:'month',value:period,onChange:(e:any)=>setFilter(()=>setPeriod(e.target.value))})),
    h('button',{type:'button',className:'d05-more',onClick:()=>setAdvanced(!advanced),'aria-expanded':advanced},'Filtros '+(advanced?'−':'+'))),
   advanced?h('div',{className:'d05-advanced'},
    h('label',{className:'d05-filter'},'Conta',h('select',{value:account,onChange:(e:any)=>setFilter(()=>setAccount(e.target.value))},
     h('option',{value:''},'Todas as contas'),(state.bank.data.accounts||[]).map((a:any)=>h('option',{key:a.id,value:a.id},a.name)))),
    h('label',{className:'d05-filter'},'Natureza',h('select',{value:kind,onChange:(e:any)=>setFilter(()=>setKind(e.target.value))},
     [['all','Todas'],['income','Entradas'],['expense','Saídas'],['transfer','Transferências'],['ignore','Ignoradas']].map((x:any)=>h('option',{value:x[0],key:x[0]},x[1])))),
    h('label',{className:'d05-filter'},'Ordenação',h('select',{value:sort,onChange:(e:any)=>setFilter(()=>setSort(e.target.value))},
     [['newest','Mais recentes'],['oldest','Mais antigas'],['largest','Maior valor'],['smallest','Menor valor']].map((x:any)=>h('option',{value:x[0],key:x[0]},x[1])))),
    h('label',{className:'d05-filter'},'Resumo financeiro',h('select',{value:metricSource,onChange:(e:any)=>setMetricSource(e.target.value)},
     h('option',{value:'bank'},'Bancário'),h('option',{value:'manual'},'Manual'))),
    h('div',{className:'d05-parent-filters'},h('span',{},'Categorias'),
     h('button',{type:'button',className:!categoryId?'active':'',onClick:()=>setFilter(()=>{setCategoryId('');setSubcategoryId('');})},'Todas'),
     parents.map((p:any)=>h('button',{type:'button',key:p.id,className:categoryId===p.id?'active':'',onClick:()=>setFilter(()=>{setCategoryId(p.id);setSubcategoryId('');})},
      h(D05VectorIcon,{iconKey:p.iconKey,hue:p.hue,size:15}),p.name))),
    categoryId?h('div',{className:'d05-parent-filters'},h('span',{},'Subcategoria'),
      h('button',{type:'button',className:!subcategoryId?'active':'',onClick:()=>setFilter(()=>setSubcategoryId(''))},'Todas'),
      (byId(categoryId)?.subcategories||[]).map((c:any)=>h('button',{type:'button',key:c.id,className:subcategoryId===c.id?'active':'',onClick:()=>setFilter(()=>setSubcategoryId(c.id))},c.name))):null
   ):null,
   h('div',{className:'d05-history-controls'},
    h('button',{type:'button',role:'switch','aria-checked':group,'aria-label':'Agrupar por dia',className:'d05-group-toggle',onClick:()=>setGroup(!group)},
     h('span',{className:'d05-switch-track'},h('span',{className:'d05-switch-thumb'})),'Agrupar por dia'),
    h('span',{},filtered.length+' movimentações no escopo'+(filtered.length>500?' · exibindo 500':''),
     pending?' · '+pending+' em processamento':'',ignored?' · '+ignored+' transferência(s)/ignorada(s) fora dos totais':'')),
   partial?h('p',{className:'d05-notice',role:'status'},'Histórico parcial: '+bankData.length+' de '+String(state.bank.data.totalTransactions||'?')+' movimentações bancárias carregadas. Métricas apenas desta amostra.'):null,
   selected.size?h('div',{className:'d05-bulk-bar',role:'region','aria-label':'Ações em lote'},
    h('b',{},selected.size+' selecionada(s)'),
    h('button',{type:'button',onClick:(e:any)=>openPicker(e,null,'batch')},'Categorizar seleção'),
    h('button',{type:'button',onClick:()=>setSelected(new Set())},'Limpar seleção')):null,
   filtered.length?h('div',{className:'d05-list'},onScreen.map((r:any,i:number)=>{
    const p=byId(r.categoryId)||byName(r.category),child=p?.subcategories?.find((c:any)=>c.id===r.subcategoryId);
    const icon=resolveCategoryVisualIdentity({categoryId:r.categoryId||null,
     subcategoryId:r.subcategoryId||null,categoryName:r.category,catalog:parents});
    const isReview=r.source==='bank'&&r.status==='POSTED'&&!r.reviewed;
    const signed=r.kind==='transfer'||r.kind==='ignore'?'neutral':r.amount>=0?'positive':'negative';
    const isSelected=selected.has(r.key);
    const selectAllowed=r.source==='bank';
    return h('div',{className:'d05-list-item',key:r.key},
     group&&(i===0||onScreen[i-1].date!==r.date)?h('div',{className:'d05-day'},pDate(r.date)):null,
     h('article',{className:'d05-row '+(isSelected?'is-selected':''),
      onClick:()=>openDetail(r)},
      h('button',{type:'button',className:'d05-select '+(isSelected?'selected':''),
       'aria-label':'Selecionar '+r.merchant,'aria-pressed':isSelected,disabled:!selectAllowed,
       onClick:(e:any)=>{e.stopPropagation();const next=new Set(selected);if(next.has(r.key))next.delete(r.key);else next.add(r.key);setSelected(next);setPicker(null);setPreview(null);}},
       h('span',{'aria-hidden':'true'},isSelected?'✓':'')),
      h('button',{type:'button',className:'d05-row-icon','aria-label':'Alterar categoria de '+r.merchant,
       onClick:(e:any)=>openPicker(e,r)},
       h(CategoryVisualGlyph,{identity:icon,size:23})),
      h('div',{className:'d05-row-info'},
       h('div',{className:'d05-merchant-line'},
        h('button',{type:'button',className:'d05-merchant',onClick:(e:any)=>{e.stopPropagation();openDetail(r);}},r.merchant),
        isReview?h('button',{type:'button',className:'d05-review-dot','aria-label':'Conferir movimentação '+r.merchant,
         title:'A conferir',onClick:(e:any)=>{e.stopPropagation();activeTrigger.current=e.currentTarget;setError('');setReview(r);}},h('span',{'aria-hidden':'true'})):null,
        r.source==='bank'&&r.status==='PENDING'?h('span',{className:'d05-pending',title:'Em processamento','aria-label':'Em processamento'},h(D05VectorIcon,{iconKey:'clock-3',hue:37,size:16})):null),
       h('small',{},r.account+' · '+(p?.name||r.category)+(child?' › '+child.name:''),
        r.source==='manual'?' · Manual':r.raw.categorySource==='automatic'?' · Automática (evidência verificada)':''),
       r.merchant!==r.description?h('small',{className:'d05-desc'},r.description):null),
      h('div',{className:'d05-row-end'},
       h('strong',{className:'d05-amount '+signed},(r.amount>=0?'+':'−')+format(Math.abs(r.amount))),
       r.source==='bank'&&r.raw.categorySource==='automatic'?
        h('small',{title:r.raw.automaticEvidence||'Evidência de histórico local'},'Categorização local verificada'):null,
       r.source==='bank'&&r.raw.categorySource==='automatic'&&autoInfo?.available&&bridge?.bankAutoUndo?
        h('button',{type:'button',className:'d05-ghost',disabled:autoBusy,
         onClick:async(e:any)=>{
          e.stopPropagation();setAutoBusy(true);setAutoMessage('');
          try{
           const outcome=await bridge.bankAutoUndo({accountId:r.accountId,externalId:r.id});
           if(outcome?.undone){
            await host.refreshBank();await refreshHierarchy();await refreshAuto();
            setAutoMessage('Classificação revertida. Movimento protegido contra reaplicação automática.');
           }
          }catch(error:any){setAutoMessage(String(error?.message||error));}
          finally{setAutoBusy(false);}
         }},'Desfazer'):null,
       r.kind==='transfer'||r.kind==='ignore'?h('small',{},r.kind==='transfer'?'Transferência':'Desconsiderada'):null)
     ));
   })):h('div',{className:'d05-empty'},h('strong',{},'Nenhuma movimentação encontrada'),h('p',{},'Altere a pesquisa ou os filtros para continuar.'),
      h('button',{type:'button',onClick:()=>{setSearch('');setPeriod('');setAccount('');setCategoryId('');setSubcategoryId('');setKind('all');setTab('all');setSource('all');}},'Limpar filtros'))
  ),
  chooser,reviewPanel,manualPanel);
 }
}
