// D05 V1.3: the REAL transactions renderer, mounted by App.renderMovements().
// Do not import prototype fixtures; all amounts and rows are read from App / MAIN.
// E2 write APIs are capability-gated and never simulated.
function D05Movements(props:{host:any}){
 const host=props.host, state=host.state, bridge=(window as any).financeDesktop||null;
 const [catalog,setCatalog]=React.useState(null as any);
 const [decor,setDecor]=React.useState({bank:{},manual:{}} as any);
 const [loadState,setLoadState]=React.useState('loading');
 const [accessMessage,setAccessMessage]=React.useState('');
 const [search,setSearch]=React.useState('');
 const [source,setSource]=React.useState('all');
 const [metricSource,setMetricSource]=React.useState('bank');
 const [tab,setTab]=React.useState('all');
 const [period,setPeriod]=React.useState(state.month||iso(new Date()).slice(0,7));
 const [account,setAccount]=React.useState('');
 const [kind,setKind]=React.useState('all');
 const [categoryId,setCategoryId]=React.useState('');
 const [subcategoryId,setSubcategoryId]=React.useState('');
 const [sort,setSort]=React.useState('newest');
 const [group,setGroup]=React.useState(true);
 const [advanced,setAdvanced]=React.useState(false);
 const [selected,setSelected]=React.useState(new Set() as Set<string>);
 const [picker,setPicker]=React.useState(null as any);
 const [preview,setPreview]=React.useState(null as any);
 const [review,setReview]=React.useState(null as any);
 const [manual,setManual]=React.useState(null as any);
 const [busy,setBusy]=React.useState(false);
 const [error,setError]=React.useState('');
 const [notice,setNotice]=React.useState('');
 const activeTrigger=React.useRef(null as any);
 const modalRef=React.useRef(null as any);
 const refreshId=React.useRef(0);
 const approved=D05_APPROVED_PARENTS;
 const parents=catalog?.parents?.length?catalog.parents:approved;
 const byName=(name:string)=>parents.find((p:any)=>p.name===name)||D05ApprovedParent(name);
 const byId=(id:string)=>parents.find((p:any)=>p.id===id)||approved.find((p:any)=>p.id===id);
 const format=(cents:number)=>fmt(cents);
 const inRange=(date:string)=>!period||date.slice(0,7)===period;
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
   const parentsResult=await bridge.d05Catalog();
   const bankResult=bridge.d05BankList?await bridge.d05BankList({limit:2500}):{items:[]};
   const manualResult=bridge.d05ManualList?await bridge.d05ManualList({profile:state.mode,limit:2500}):{items:[]};
   if(req!==refreshId.current)return;
   if(!parentsResult||!Array.isArray(parentsResult.parents))throw Error('Catálogo D05 inválido');
   const b:any={},m:any={};
   for(const t of bankResult.items||[])b[JSON.stringify([t.accountId,t.id])]={categoryId:t.categoryId,subcategoryId:t.subcategoryId};
   for(const t of manualResult.items||[])m[t.id]={categoryId:t.categoryId,subcategoryId:t.subcategoryId};
   setCatalog(parentsResult);setDecor({bank:b,manual:m});
   setLoadState('ready');setAccessMessage('');
  }catch(e:any){
   if(req!==refreshId.current)return;
   setLoadState(/autoriz|negado|denied|permiss/i.test(String(e?.message||e))?'denied':'error');
   setAccessMessage('Catálogo D05 indisponível: '+String(e?.message||e));
  }
 };
 React.useEffect(()=>{
  let current=true;
  if(current)void refreshHierarchy();
  return ()=>{current=false;refreshId.current++;};
 },[state.mode,state.bank.data.transactions,state.data.transactions]);
 React.useEffect(()=>{
  if(!picker&&!review&&!manual)return;
  const onKey=(event:any)=>{if(event.key==='Escape'&&!busy){
   event.preventDefault();event.stopPropagation();setPicker(null);setReview(null);setManual(null);setPreview(null);
   (activeTrigger.current as any)?.focus?.();
  }};
  const onScroll=(event:any)=>{if(picker&&event.target!==modalRef.current&&!modalRef.current?.contains(event.target)&&!busy){
    setPicker(null);setPreview(null);(activeTrigger.current as any)?.focus?.();
  }};
  window.addEventListener('keydown',onKey,true);
  window.addEventListener('scroll',onScroll,true);
  return ()=>{window.removeEventListener('keydown',onKey,true);window.removeEventListener('scroll',onScroll,true);};
 },[picker,review,manual,busy]);
 React.useEffect(()=>{if((picker||review||manual)&&modalRef.current)modalRef.current.querySelector('input,button')?.focus();},[picker?.phase,review?.id,manual!==null]);
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
  if(tab==='pending')return row.source==='bank'&&row.status==='POSTED'&&!row.reviewed;
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
  if(r.source==='bank'&&r.status==='POSTED'&&!r.reviewed)needs++;
  if(r.source==='bank'&&r.status!=='POSTED'){pending++;continue;}
  if(r.kind==='ignore'||r.kind==='transfer'){ignored++;continue;}
  if(r.kind==='income')income+=Math.abs(r.amount);
  else if(r.kind==='expense')expense+=Math.abs(r.amount);
 }
 const partial=state.mode==='real'&&!!state.bank.data.truncated;
 const openPicker=(event:any,row:any=null,kindName:string='row')=>{
  activeTrigger.current=event.currentTarget;
  const rect=event.currentTarget.getBoundingClientRect();
  const old=row?byId(row.categoryId):null;
  const popupWidth=Math.min(355,window.innerWidth-24);
  const left=Math.max(12,Math.min(rect.left,window.innerWidth-popupWidth-12));
  const top=Math.max(12,Math.min(rect.bottom+7,window.innerHeight-465));
  setError('');setPreview(null);
  setPicker({kind:kindName,row,phase:'parent',query:'',categoryId:old?.id||null,
   subcategoryId:row?.subcategoryId||null,left,top,width:popupWidth});
 };
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
    if(ids.length!==selected.size||!ids.length)throw Error('Seleção incompatível ou vazia');
    const items=ids.map((r:any)=>({accountId:r.accountId,externalId:r.id}));
    const data=await bridge.d05BankBatchPreview({items,target:destination});
    if(!data?.previewVersion||data.count!==items.length)throw Error('Prévia de lote inválida');
    setPreview({...data,items,rows:ids,destination});
    setPicker((old:any)=>({...old,phase:'batch-verify'}));
   }else if(picker.row?.source==='manual'){
    const tx=picker.row,existing=state.data.transactions.find((t:any)=>t.id===tx.id);
    if(!existing)throw Error('Lançamento desatualizado: atualize o histórico');
    const parent=byId(destination.categoryId);
    if(!parent)throw Error('Categoria não encontrada');
    if(!bridge?.save)throw Error('Persistência manual indisponível neste ambiente');
    const data={...state.data,transactions:state.data.transactions.map((t:any)=>t.id===tx.id?{
      ...t,category:parent.name,categoryId:destination.categoryId,subcategoryId:destination.subcategoryId}:t)};
    const saved=await host.updateData(data,'Classificação manual salva.');
    if(!saved)throw Error('Não foi possível persistir a classificação manual');
    setPicker(null);await refreshHierarchy();
   }else if(picker.row?.source==='bank'){
    if(!bridge?.d05AssignBank)throw Error('Classificação bancária D05 indisponível: autorização MAIN/preload pendente');
    const tx=picker.row,current=state.bank.data.transactions.find((t:any)=>t.id===tx.id&&t.accountId===tx.accountId);
    if(!current||current.amount!==tx.amount||current.status!==tx.status)
     throw Error('Movimentação alterada; atualize antes de classificar');
    const result=await bridge.d05AssignBank({accountId:tx.accountId,externalId:tx.id,target:destination});
    if(result?.categoryId!==destination.categoryId||result?.subcategoryId!==destination.subcategoryId)
     throw Error('Recibo de classificação não corresponde ao destino escolhido');
    await host.refreshBank();await refreshHierarchy();setPicker(null);setNotice('Classificação bancária persistida.');
   }
  }catch(e:any){setError(String(e?.message||e));}
  finally{setBusy(false);}
 };
 const commitBatch=async()=>{
  if(!picker||!preview?.previewVersion||!bridge?.d05BankBatchApply)return;
  setBusy(true);setError('');
  try{
   const ids=Array.from(selected).sort();
   const expected=preview.rows.map((r:any)=>r.key).sort();
   if(JSON.stringify(ids)!==JSON.stringify(expected))throw Error('Seleção alterada; nova prévia necessária');
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
  return ReactDOM.createPortal(h('div',{className:'d05-overlay',onMouseDown:(e:any)=>{
    if(e.target===e.currentTarget&&!busy){setPicker(null);setReview(null);setManual(null);setPreview(null);activeTrigger.current?.focus?.();}
   }},
   h('section',{ref:modalRef,className:'d05-floating',role:'dialog','aria-modal':'true',
    style:{left:Math.max(12,Math.min(left,window.innerWidth-width-12)),top:Math.max(12,Math.min(top,window.innerHeight-130)),width:Math.min(width,window.innerWidth-24)}},
    body)),document.body);
 };
 const categoryGrid=(selectedId:string,onSelect:(p:any)=>void,searchText:string)=>h('div',{className:'d05-catalog-grid',role:'group','aria-label':'Categorias principais'},
  parents.filter((p:any)=>folded(p.name).includes(folded(searchText))).map((p:any)=>h('button',{key:p.id,type:'button',
   className:'d05-catalog-choice '+(p.id===selectedId?'is-current':''),
   'aria-pressed':p.id===selectedId,onClick:()=>onSelect(p)},
   h(D05VectorIcon,{iconKey:p.iconKey,hue:p.hue,size:20}),h('span',{},p.name))));
 const chooser=picker?(()=>{
  const parent=byId(picker.categoryId),children=parent?.subcategories||[];
  return portal(h('div',{className:'d05-picker'},
   h('header',{className:'d05-floating-head'},h('div',{},h('small',{},'CLASSIFICAÇÃO'),h('h3',{},picker.kind==='batch'?'Classificar seleção':'Categoria da movimentação')),
    h('button',{type:'button','aria-label':'Cancelar classificação',onClick:()=>{setPicker(null);setPreview(null);}},'×')),
   picker.phase==='parent'?h('div',{},
    h('input',{className:'d05-search',autoFocus:true,value:picker.query,placeholder:'Buscar categoria',onChange:(e:any)=>setPicker({...picker,query:e.target.value})}),
    categoryGrid(picker.categoryId,setParent,picker.query)):
   picker.phase==='child'?h('div',{},
    h('button',{className:'d05-back',onClick:()=>setPicker({...picker,phase:'parent'})},'← Categorias'),
    h('p',{className:'d05-picker-caption'},'Escolha uma subcategoria, se desejar'),
    h('div',{className:'d05-child-list'},
      h('button',{type:'button',className:'d05-child',onClick:()=>setDestination(null)},
       h(D05VectorIcon,{iconKey:parent?.iconKey,hue:parent?.hue}), 'Somente '+parent?.name),
      children.map((child:any)=>h('button',{type:'button',className:'d05-child',key:child.id,onClick:()=>setDestination(child)},
       h(D05VectorIcon,{iconKey:child.iconKey,hue:child.hue}),child.name)))):
   picker.phase==='batch-verify'?h('div',{},
    h('p',{},'Confirme novamente as ',h('strong',{},preview?.count||0),' movimentações afetadas.'),
    h('p',{className:'d05-picker-caption'},'Destino: '+labelTarget(picker.categoryId,picker.subcategoryId)),
    h('ul',{className:'d05-preview-items'},(preview?.rows||[]).slice(0,20).map((r:any)=>
     h('li',{key:r.key},r.merchant,' · ',format(Math.abs(r.amount)))) ,
    (preview?.rows?.length||0)>20?h('small',{},'Demais itens incluídos na prévia validada.'):null,
    h('button',{type:'button',className:'d05-confirm',disabled:busy,onClick:()=>void commitBatch()},busy?'Gravando…':'Reconfirmar e aplicar lote')):
   h('div',{className:'d05-confirm-step'},
    h('p',{},'Antes: ',h('b',{},picker.row?.category||'Várias categorias')),
    h('p',{},'Depois: ',h('b',{},labelTarget(picker.categoryId,picker.subcategoryId))),
    h('button',{type:'button',className:'d05-confirm',disabled:busy,onClick:()=>void handleClassify()},busy?'Validando…':picker.kind==='batch'?'Ver prévia do lote':'Confirmar classificação')),
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
 return h('section',{className:'d05-screen',id:'d05-movements'},
  h('header',{className:'d05-head'},
   h('div',{},h('h1',{},'Movimentações'),h('p',{},'Seu histórico organizado, com contexto e controle.')),
   h('div',{className:'d05-head-actions'},
    h('button',{type:'button',onClick:()=>host.csvInput?.click()},'Importar CSV'),
    h('button',{type:'button',className:'d05-primary',onClick:(e:any)=>{activeTrigger.current=e.currentTarget;setError('');setManual({description:'',date:iso(new Date()),value:'',kind:'expense',categoryId:'cat:outros',subcategoryId:null});}},'+ Nova movimentação'))),
  state.booting?h('p',{className:'d05-notice',role:'status'},'Carregando dados financeiros…'):null,
  loadState==='loading'&&bridge?.d05Catalog?h('p',{className:'d05-notice',role:'status'},'Conferindo hierarquia D05…'):null,
  loadState!=='ready'&&loadState!=='loading'?h('p',{className:'d05-notice',role:'status'},accessMessage):null,
  notice?h('p',{className:'d05-notice',role:'status'},notice):null,
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
    const icon=child||p||{iconKey:'circle-dot',hue:155};
    const isReview=r.source==='bank'&&r.status==='POSTED'&&!r.reviewed;
    const signed=r.kind==='transfer'||r.kind==='ignore'?'neutral':r.amount>=0?'positive':'negative';
    const isSelected=selected.has(r.key);
    const selectAllowed=r.source==='bank';
    return h(React.Fragment,{key:r.key},
     group&&(i===0||onScreen[i-1].date!==r.date)?h('div',{className:'d05-day'},pDate(r.date)):null,
     h('article',{className:'d05-row '+(isSelected?'is-selected':'')},
      h('button',{type:'button',className:'d05-select '+(isSelected?'selected':''),
       'aria-label':'Selecionar '+r.merchant,'aria-pressed':isSelected,disabled:!selectAllowed,
       onClick:()=>{const next=new Set(selected);if(next.has(r.key))next.delete(r.key);else next.add(r.key);setSelected(next);setPicker(null);setPreview(null);}},
       h('span',{'aria-hidden':'true'},isSelected?'✓':'')),
      h('button',{type:'button',className:'d05-row-icon','aria-label':'Alterar categoria de '+r.merchant,
       onClick:(e:any)=>openPicker(e,r)},
       h(D05VectorIcon,{iconKey:icon.iconKey,hue:icon.hue,size:23})),
      h('div',{className:'d05-row-info'},
       h('div',{className:'d05-merchant-line'},
        h('button',{type:'button',className:'d05-merchant',onClick:()=>r.source==='bank'?host.openBankDetail(r.raw):host.openManualDetail(r.raw)},r.merchant),
        isReview?h('button',{type:'button',className:'d05-review-dot','aria-label':'Conferir movimentação '+r.merchant,
         title:'A conferir',onClick:(e:any)=>{activeTrigger.current=e.currentTarget;setError('');setReview(r);}},h('span',{'aria-hidden':'true'})):null,
        r.source==='bank'&&r.status==='PENDING'?h('span',{className:'d05-pending',title:'Em processamento','aria-label':'Em processamento'},'◷'):null),
       h('small',{},r.account+' · '+(p?.name||r.category)+(child?' › '+child.name:''),
        r.source==='manual'?' · Manual':''),
       r.merchant!==r.description?h('small',{className:'d05-desc'},r.description):null),
      h('div',{className:'d05-row-end'},
       h('strong',{className:'d05-amount '+signed},(r.amount>=0?'+':'−')+format(Math.abs(r.amount))),
       r.kind==='transfer'||r.kind==='ignore'?h('small',{},r.kind==='transfer'?'Transferência':'Desconsiderada'):null)
     ));
   })):h('div',{className:'d05-empty'},h('strong',{},'Nenhuma movimentação encontrada'),h('p',{},'Altere a pesquisa ou os filtros para continuar.'),
      h('button',{type:'button',onClick:()=>{setSearch('');setPeriod('');setAccount('');setCategoryId('');setSubcategoryId('');setKind('all');setTab('all');setSource('all');}},'Limpar filtros')))
  ),
  chooser,reviewPanel,manualPanel);
}
