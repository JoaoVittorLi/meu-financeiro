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
 const [autoProgress,setAutoProgress]=useState(null as any);
 const [autoSelected,setAutoSelected]=useState(new Set<string>());
 const [autoStart,setAutoStart]=useState('2000-01-01');
 const [autoEnd,setAutoEnd]=useState('2099-12-31');
 const [autoPanel,setAutoPanel]=useState(false);
 const [autoBusy,setAutoBusy]=useState(false);
 const [autoMessage,setAutoMessage]=useState('');
 const [autoRules,setAutoRules]=useState([] as any[]);
 const autoScanRef=useRef({jobId:null as string|null,stop:false});
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
     if(autoInfo===null)setAutoSelected(new Set((status.permissions||[]).filter((p:any)=>p.enabled).map((p:any)=>p.accountId)));
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
   const next=await bridge.bankAutoPreviewNext(jobId);
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
 const runAutoAction=async(action:string,accountId:string|null=null)=>{
  if(!bridge||autoBusy||state.mode!=='real')return;
  setAutoBusy(true);setAutoMessage('');
  try{
   let result:any;
   if(action==='enable'){
    result=await bridge.bankAutoConfigure({accountIds:Array.from(autoSelected),startDate:autoStart,endDate:autoEnd});
    autoScanRef.current.stop=true;autoScanRef.current.jobId=null;
    setAutoProgress(null);setAutoPreview(null);
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
    if(!result?.cancelled)setAutoPreview(null);
   }else if(action==='run')result=await bridge.bankAutoApply({limit:20000});
   else if(action==='suggest')result=await bridge.bankAutoRuleSuggestions({limit:5});
   if(action==='suggest'){setAutoRules(result?.rules||[]);setAutoMessage('Sugestões somente para prévia; nenhuma regra foi criada.');return;}
   if(result?.cancelled){setAutoMessage('Operação cancelada; nenhuma classificação aplicada.');return;}
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
  state.mode==='real'&&bridge?.bankAutoStatus?h('section',{className:'d05-auto-box','aria-label':'Categorização automática'},
   h('div',{className:'d05-auto-head'},
    h('div',{},h('strong',{},'Categorização automática'),
     h('p',{},'Somente evidência verificável; suas correções e regras aprovadas prevalecem.')),
    h('button',{type:'button',className:'d05-ghost','aria-expanded':autoPanel,
     onClick:()=>setAutoPanel(!autoPanel)},autoPanel?'Fechar':'Gerenciar')),
   h('div',{className:'d05-auto-stats',role:'status'},
    h('span',{},autoInfo?.jobs?.paused?'Pausada':autoInfo?.enabled?'Ativada em '+String((autoInfo.permissions||[]).filter((p:any)=>p.enabled).length)+' conta(s)':'Desativada'),
    h('span',{},String(autoInfo?.counts?.classified||0)+' categorizada(s) automaticamente'),
    h('span',{},String(autoInfo?.counts?.awaitingReview||0)+' aguardando revisão'),
    h('button',{type:'button',onClick:()=>{setTab('pending');setSource('bank');}},'Abrir A conferir')),
   !autoInfo?.available?h('p',{className:'d05-notice',role:'status'},
    'Autorização pessoal disponível somente na distribuição estável homologada. A RC experimental não altera categorias bancárias.'):null,
   autoPanel?h('div',{className:'d05-auto-settings'},
    h('p',{},'Escolha contas e período. A autorização é persistente, revogável e distinta do token IC-READ.'),
    h('div',{className:'d05-auto-accounts'},(state.bank.data.accounts||[]).map((bank:any)=>
     h('button',{type:'button',key:bank.id,'aria-pressed':autoSelected.has(bank.id),
      className:autoSelected.has(bank.id)?'selected':'',
      disabled:autoBusy||!autoInfo?.available,onClick:()=>{
       const next=new Set(autoSelected);if(next.has(bank.id))next.delete(bank.id);else next.add(bank.id);
       setAutoSelected(next);}},bank.name,
      (autoInfo?.permissions||[]).some((perm:any)=>perm.accountId===bank.id&&perm.enabled)?' · autorizada':''))),
    h('div',{className:'d05-auto-period'},
     h('label',{},'Início',h('input',{type:'date',value:autoStart,onChange:(e:any)=>setAutoStart(e.target.value)})),
     h('label',{},'Fim',h('input',{type:'date',value:autoEnd,onChange:(e:any)=>setAutoEnd(e.target.value)}))),
    h('div',{className:'d05-auto-buttons'},
     h('button',{type:'button',className:'d05-confirm',disabled:autoBusy||!autoInfo?.available||autoSelected.size===0,
      onClick:()=>void runAutoAction('enable')},'Autorizar contas selecionadas'),
     h('button',{type:'button',disabled:autoBusy||!autoInfo?.available||!autoInfo?.enabled,
      onClick:()=>void runAutoAction('preview')},'Analisar histórico (somente leitura)'),
     !autoInfo?.initialConfirmed?h('button',{type:'button',className:'d05-confirm',
      disabled:autoBusy||!autoInfo?.available||!autoInfo?.enabled||!autoPreview?.previewVersion,
      onClick:()=>void runAutoAction('confirm')},'Conferir e confirmar lote seguro'):
     h('button',{type:'button',disabled:autoBusy||!autoInfo?.available||!autoInfo?.enabled||autoInfo?.jobs?.paused,
      onClick:()=>void runAutoAction('run')},'Verificar novas movimentações'),
     autoInfo?.initialConfirmed&&autoInfo?.enabled?
      h('button',{type:'button',disabled:autoBusy||!autoInfo?.available,
       onClick:()=>void runAutoAction(autoInfo?.jobs?.paused?'resume':'pause')},
       autoInfo?.jobs?.paused?'Reativar automação':'Pausar automação'):null,
     h('button',{type:'button',disabled:autoBusy||!autoInfo?.available||!autoInfo?.enabled,
      onClick:()=>void runAutoAction('suggest')},'Sugerir regras para semelhantes'),
     ...(autoInfo?.permissions||[]).filter((perm:any)=>perm.enabled).map((perm:any)=>
      h('button',{type:'button',key:perm.accountId,disabled:autoBusy||!autoInfo?.available,
       onClick:()=>void runAutoAction('revoke',perm.accountId)},'Revogar '+perm.name))),
    autoPreview?h('div',{className:'d05-auto-rule-suggestions',role:'region','aria-label':'Prévia inicial somente leitura'},
     h('strong',{},'Prévia verificada — nada aplicado'),
     h('p',{},String(autoPreview.candidateCount||0)+' classificações elegíveis · '+
      String(autoPreview.reviewCount||0)+' precisam de revisão. Amostras exibidas: '+
      String((autoPreview.candidates||[]).length)+' de '+String(autoPreview.candidateCount||0)+'.'),
     (autoPreview.candidates||[]).slice(0,10).map((item:any)=>h('p',{key:item.accountId+'|'+item.externalId},
      String(item.merchant||'Estabelecimento')+' → '+
      String(byId(item.target?.categoryId)?.name||item.target?.categoryId||'Categoria')+
      (item.target?.subcategoryId?' · '+String(
       (byId(item.target.categoryId)?.subcategories||[]).find((x:any)=>x.id===item.target.subcategoryId)?.name||
       item.target.subcategoryId):'')+' · '+String(item.explanation||''))),
     autoPreview.candidateCount>20000?h('p',{className:'d05-notice'},
      'Lote acima do limite atual de aplicação. A confirmação ficará bloqueada até a paginação de escrita estar concluída.'):null
    ):null,
    autoRules.length?h('div',{className:'d05-auto-rule-suggestions'},
     h('strong',{},'Sugestões não aplicadas — revisão humana obrigatória'),
     autoRules.map((rule:any)=>h('p',{key:rule.accountId+'|'+rule.pattern},
      'Conta: '+String((state.bank.data.accounts||[]).find((a:any)=>a.id===rule.accountId)?.name||'Conta autorizada')+
      ' · '+rule.pattern+' · '+rule.suggestedFor+' ocorrências identificadas · até '+
      rule.possibleMatches+' possíveis correspondências. Conflitos de precedência: '+rule.possiblePrecedenceConflicts+'.')),
     h('button',{type:'button',onClick:()=>host.setState({txOrganize:true})},
      'Abrir Categorias e regras para revisar a criação')):null,
    h('p',{},'Regras amplas e reclassificações em massa exigem aprovação separada. Sem modelo externo nem porcentagens inventadas.')
   ):null,
   autoMessage?h('p',{className:'d05-notice',role:'status'},autoMessage):null
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
