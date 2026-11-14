/* RC-ALL-01 C2 — D04 V1.1 Central de Revisão.
 * The queue is backed by actual synthetic IC-REVIEW reports and pending records.
 * Draft/exclusion math is local and read-only; service prepares and confirms only
 * its own supported, unmodified actions. Never inject demo fixtures into real data. */
type MfD04Entry={id:string;kind:'category_rule'|'category_change'|'audit';title:string;
 status:'pending'|'history';source:string;category:string;original:any;
 candidates:Array<{id:string;title:string;date:string;amountCents:number}>};
type MfD04Draft={name:string;category:string;terms:string;color:string;
 past:boolean;future:boolean;revision:number;saved:boolean};
const MF_D04_PALETTE=['#53d896','#79a6fa','#f5bc63','#ff7a88','#b49be8'];
function mfD04StableId(r:any):string{return JSON.stringify([r.accountId||'',r.externalId||'']);}
function mfD04Entries(app:any):MfD04Entry[]{
 const s=app.state,grant=s.categoryReviewGrant,report=s.categoryReviewReport,queue=s.categoryReviewQueue;
 if(!grant?.token||!(Number.isFinite(grant.expiresAt)&&grant.expiresAt>Date.now())||!report)return [];
 const entries:MfD04Entry[]=[];
 for(const r of Array.isArray(report.suggestions)?report.suggestions:[]){
  if(!r||typeof r.id!=='string'||!r.id)continue;
  const cands=[];const seen=new Set<string>();
  for(const x of Array.isArray(r.examples)?r.examples:[]){
   if(!x||!Number.isSafeInteger(x.amount)||!x.description)continue;
   const id=mfD04StableId(x);if(seen.has(id)||id==='["",""]')continue;seen.add(id);
   cands.push({id,title:String(x.description).slice(0,120),date:String(x.date||''),
    amountCents:Math.abs(x.amount)});
  }
  entries.push({id:'rule:'+r.id,kind:'category_rule',title:String(r.name||r.pattern||'Sugestão').slice(0,100),
   status:'pending',source:'Sugestão supervisionada',category:String(r.category||''),original:r,candidates:cands});
 }
 for(const r of Array.isArray(queue?.rows)?queue.rows:[]){
  if(!r||!r.externalId||!r.accountId||!Number.isSafeInteger(r.amount))continue;
  const id=mfD04StableId(r);
  entries.push({id:'row:'+id,kind:'category_change',title:String(r.description||'Movimentação').slice(0,100),
   status:'pending',source:String(r.accountName||'Fonte de teste'),
   category:String(r.suggestedCategory||r.category||''),original:r,
   candidates:[{id,title:String(r.description||''),date:String(r.date||''),amountCents:Math.abs(r.amount)}]});
 }
 for(const a of Array.isArray(report.audit)?report.audit:[]){
  if(!a?.id)continue;
  entries.push({id:'audit:'+String(a.id),kind:'audit',title:String(a.action||'Decisão'),
   status:'history',source:'Auditoria do serviço',category:'',original:a,candidates:[]});
 }
 return entries;
}
function mfD04DraftFor(app:any,entry:MfD04Entry):MfD04Draft{
 const existing=app.state.mfD04Drafts?.[entry.id];if(existing)return existing;
 return {name:entry.title,category:entry.category,
  terms:String(entry.original?.pattern||entry.title),color:MF_D04_PALETTE[0],
  past:entry.kind==='category_change',future:entry.kind==='category_rule',revision:0,saved:false};
}
function mfD04Patch(app:any,entry:MfD04Entry,patch:Partial<MfD04Draft>):void{
 const current=mfD04DraftFor(app,entry);
 const next={...current,...patch,revision:current.revision+1,saved:false};
 app.setState({mfD04Drafts:{...app.state.mfD04Drafts,[entry.id]:next},
  categoryReviewPreview:null,categoryReviewConfirmed:false,categoryReviewReceipt:null});
}
function mfD04Discard(app:any,entry:MfD04Entry):void{
 const drafts={...app.state.mfD04Drafts};delete drafts[entry.id];
 const excluded={...app.state.mfD04Excluded};delete excluded[entry.id];
 app.setState({mfD04Drafts:drafts,mfD04Excluded:excluded,
  categoryReviewPreview:null,categoryReviewConfirmed:false,mfD04Edit:false});
}
function mfD04SelectedIds(entry:MfD04Entry,exclusions:string[]):string[]{
 const excluded=new Set(exclusions);
 return entry.candidates.filter(x=>!excluded.has(x.id)).map(x=>x.id);
}
function mfD04Impact(entry:MfD04Entry,draft:MfD04Draft,exclusions:string[]){
 const selected=mfD04SelectedIds(entry,exclusions);
 const unique=new Set(selected);
 let cents=0;
 if(draft.past){
  for(const c of entry.candidates){
   if(!unique.has(c.id))continue;
   if(!Number.isSafeInteger(c.amountCents)||c.amountCents<0)return {count:0,cents:null,eligible:false};
   cents+=c.amountCents;
   if(!Number.isSafeInteger(cents))return {count:0,cents:null,eligible:false};
  }
 }
 const active=draft.past||draft.future;
 const changed=entry.kind==='category_rule'?!!draft.category.trim():entry.kind==='category_change'?
   !!draft.category.trim()&&draft.category!==String(entry.original.category||''):false;
 return {count:draft.past?unique.size:0,cents,
  eligible:active&&changed&&(draft.future||unique.size>0),
  samplePartial:entry.kind==='category_rule'&&
    (entry.original.compatible>entry.candidates.length||
     entry.original.examplesPartial===true)};
}
function mfD04SavedDraft(app:any,entry:MfD04Entry):void{
 const current=mfD04DraftFor(app,entry);
 if(!current.name.trim()||!current.category.trim()||!current.terms.trim()){
  app.setState({mfD04Error:'Informe nome, critério e categoria antes de salvar o rascunho.'});return;
 }
 const next={...current,saved:true,revision:current.revision+1};
 app.setState({mfD04Drafts:{...app.state.mfD04Drafts,[entry.id]:next},
  mfD04Error:'Rascunho local salvo. Somente alterações suportadas pelo serviço podem virar prévia de aplicação.',
  categoryReviewPreview:null,categoryReviewConfirmed:false,mfD04Edit:false});
}
function mfD04ServiceEligible(app:any,entry:MfD04Entry,draft:MfD04Draft,exclusions:string[]):boolean{
 if(!app.state.categoryReviewGrant?.token||
    !(Number.isFinite(app.state.categoryReviewGrant.expiresAt)&&app.state.categoryReviewGrant.expiresAt>Date.now())||
    !app.state.categoryReviewAvailable||!mfD04Impact(entry,draft,exclusions).eligible||
    exclusions.length||draft.color!==MF_D04_PALETTE[0])return false;
 if(entry.kind==='category_rule'){
  return !draft.past&&draft.future&&draft.name===entry.title&&
    draft.terms===String(entry.original.pattern||entry.title)&&
    entry.original?.state!=='denied'&&entry.original?.state!=='deferred';
 }
 if(entry.kind==='category_change'){
  const r=entry.original;
  return draft.past&&!draft.future&&draft.name===entry.title&&
   r.batchEligible===true&&r.status==='POSTED'&&!r.manual&&!r.hasSplits;
 }
 return false;
}
function mfD04Prepare(app:any,entry:MfD04Entry):void{
 const draft=mfD04DraftFor(app,entry),excluded=app.state.mfD04Excluded?.[entry.id]||[];
 if(!mfD04ServiceEligible(app,entry,draft,excluded)){
  app.setState({mfD04Error:'Esta combinação de rascunho, exclusões e escopos não possui aplicação segura neste serviço. Revise os dados manualmente ou mantenha como proposta.'});return;
 }
 app.mfD04ModalFocused=false;
 app.setState({mfD04Error:'',categoryReviewPreview:null,categoryReviewConfirmed:false});
 if(entry.kind==='category_rule'){
  void categoryReviewPrepare(app,'rule',{suggestionId:entry.original.id,category:draft.category});return;
 }
 void categoryReviewPrepare(app,'classify',{items:[entry.original],category:draft.category});
}
function mfD04PreviewModal(app:any):any{
 const p=app.state.categoryReviewPreview;if(!p)return null;
 const dismiss=()=>app.setState({categoryReviewPreview:null,categoryReviewConfirmed:false});
 const key=(e:any)=>{
  if(e.key==='Escape'){e.preventDefault();dismiss();return;}
  if(e.key!=='Tab')return;
  const nodes=Array.from(document.getElementById('mf-d04-modal')?.
   querySelectorAll('button:not(:disabled),input:not(:disabled)')||[]) as HTMLElement[];
  if(!nodes.length)return;
  const i=nodes.indexOf(document.activeElement as HTMLElement);
  if(e.shiftKey&&i<=0){e.preventDefault();nodes[nodes.length-1].focus();}
  else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0].focus();}
 };
 return h('div',{className:'mf-d04-modal-overlay',onClick:dismiss},
  h('div',{id:'mf-d04-modal',className:'mf-d04-modal',role:'dialog','aria-modal':'true',
   'aria-label':'Conferir prévia do serviço sintético',onKeyDown:key,
   onClick:(e:any)=>e.stopPropagation()},
   h('div',{className:'mf-d04-modal-top'},
    h('strong',{},'Conferência obrigatória'),
    h('button',{type:'button',className:'ghost-button',onClick:dismiss,
      ref:(node:any)=>{if(node&&!app.mfD04ModalFocused){app.mfD04ModalFocused=true;node.focus();}}},'Fechar')),
   renderCategoryReviewPreview(app)));
}
function mfD04Queue(app:any,entries:MfD04Entry[],selected:MfD04Entry|null):any{
 const s=app.state,stage=s.mfD04Stage||'pending';
 const q=String(s.mfD04Search||'').toLocaleLowerCase('pt-BR');
 const visible=entries.filter(e=>(stage==='all'||e.status===stage)&&
  (e.title+' '+e.category+' '+e.source).toLocaleLowerCase('pt-BR').includes(q));
 const controls=['pending','history','all'].map(id=>h('button',{key:id,type:'button',
   className:stage===id?'active':'','aria-pressed':stage===id,
   onClick:()=>app.setState({mfD04Stage:id,categoryReviewPreview:null,categoryReviewConfirmed:false})},
  id==='pending'?'Pendentes':id==='history'?'Histórico':'Todas'));
 const items=visible.slice(0,80).map(entry=>h('button',{type:'button',key:entry.id,
   className:'mf-d04-item'+(entry.id===selected?.id?' is-selected':''),
   'aria-pressed':entry.id===selected?.id,
   onClick:()=>app.setState({mfD04Selected:entry.id,mfD04Edit:false,
    categoryReviewPreview:null,categoryReviewConfirmed:false,mfD04Error:''})},
   h('span',{className:'mf-d04-item-head'},h('strong',{},entry.title),
    h('small',{},entry.status==='history'?'Histórico':'Pendente')),
   h('span',{},entry.source+' · '+(entry.kind==='category_rule'?'Regra':entry.kind==='category_change'?'Movimentação':'Decisão')),
   h('small',{},entry.candidates.length+' registro(s) na amostra')));
 return h('section',{className:'mf-d04-queue','aria-label':'Fila de revisão'},
  h('div',{className:'mf-d04-queue-top'},h('h3',{},'Fila de decisões'),
    h('span',{},entries.filter(e=>e.status==='pending').length+' pendentes nesta consulta')),
  h('label',{className:'mf-d04-search'},'Buscar revisões',
    h('input',{type:'search',value:s.mfD04Search||'',placeholder:'Nome, origem ou categoria',
     onChange:(e:any)=>app.setState({mfD04Search:e.target.value,
      categoryReviewPreview:null,categoryReviewConfirmed:false})})),
  h('div',{className:'mf-d04-filters',role:'group','aria-label':'Filtrar revisões'},...controls),
  h('div',{className:'mf-d04-items'},...items,
    !items.length?h('p',{className:'mf-d04-no-results'},'Nenhuma revisão neste filtro.'):null));
}
function mfD04Details(app:any,entry:MfD04Entry|null):any{
 if(!entry)return h('section',{className:'mf-d04-detail'},h('p',{},'Selecione uma revisão para conferir.'));
 const s=app.state,d=mfD04DraftFor(app,entry);
 if(entry.kind==='audit')return h('section',{className:'mf-d04-detail'},
  h('div',{className:'mf-d04-summary'},h('h3',{},'Decisão auditada: '+entry.title),
   h('p',{},'ID '+String(entry.original.id)+' · '+String(entry.original.appliedAt||'')),
   h('p',{},'Desfazer: '+String(entry.original.undoState||'indisponível')),
   entry.original.undoState==='available'?h('button',{type:'button',className:'ghost-button',
    onClick:()=>void categoryReviewPrepare(app,'undo',{commandId:entry.original.id})},'Preparar desfazer pelo serviço'):null));
 const excluded:string[]=s.mfD04Excluded?.[entry.id]||[];
 const impact=mfD04Impact(entry,d,excluded);
 const change=(patch:Partial<MfD04Draft>)=>mfD04Patch(app,entry,patch);
 const canPrepare=mfD04ServiceEligible(app,entry,d,excluded);
 const fields=[['name','Nome da proposta'],['category','Categoria de destino'],['terms','Critério']].map(([key,label])=>
  h('label',{key},label,h('input',{type:'text',value:(d as any)[key],
    onChange:(e:any)=>change({[key]:e.target.value})})));
 const colorButtons=MF_D04_PALETTE.map(color=>h('button',{key:color,type:'button',
  style:{background:color},'aria-pressed':d.color===color,'aria-label':'Cor '+color,
  onClick:()=>change({color})}));
 const editor=s.mfD04Edit?h('section',{className:'mf-d04-editor','aria-label':'Editor isolado'},
  ...fields,h('div',{className:'mf-d04-colors'},...colorButtons),
  h('div',{className:'mf-d04-actions'},
   h('button',{type:'button',className:'primary-button',onClick:()=>mfD04SavedDraft(app,entry)},'Salvar ajustes locais'),
   h('button',{type:'button',className:'ghost-button',onClick:()=>mfD04Discard(app,entry)},'Descartar alterações'))):null;
 const candidates=entry.candidates.map(item=>h('label',{key:item.id},
  h('input',{type:'checkbox',checked:!excluded.includes(item.id),
   onChange:(e:any)=>{
    const old:string[]=app.state.mfD04Excluded?.[entry.id]||[];
    const next=e.target.checked?old.filter(id=>id!==item.id):[...old,item.id];
    app.setState({mfD04Excluded:{...app.state.mfD04Excluded,[entry.id]:next},
     categoryReviewPreview:null,categoryReviewConfirmed:false});
   }}),
  h('span',{},item.title+' · '+item.date),
  h('strong',{},intelligencePremiumMoney(item.amountCents))));
 const actions=[
  h('button',{type:'button',className:'primary-button',disabled:!canPrepare,
    title:canPrepare?'Revalidação real no serviço sintético':'Este rascunho/escopo não possui aplicação segura',
    onClick:()=>mfD04Prepare(app,entry)},'Preparar no serviço')];
 if(entry.kind==='category_rule'&&s.categoryReviewAvailable){
  for(const state of ['denied','deferred']){
   actions.push(h('button',{key:state,type:'button',className:'ghost-button',
    onClick:()=>void categoryReviewPrepare(app,'decision',
     {suggestionId:entry.original.id,state})},state==='denied'?'Recusar':'Adiar'));
  }
 }
 return h('section',{className:'mf-d04-detail','aria-label':'Detalhe da proposta'},
  h('div',{className:'mf-d04-detail-inner'},
   h('div',{className:'mf-d04-detail-head'},
    h('div',{},h('small',{},entry.source),h('h3',{},entry.title)),
    h('button',{type:'button',className:'ghost-button',
     onClick:()=>app.setState({mfD04Edit:!s.mfD04Edit})},
     s.mfD04Edit?'Recolher editor':'Editar rascunho')),
   h('div',{className:'mf-d04-diff'},
    h('div',{},h('small',{},'SITUAÇÃO ATUAL'),h('strong',{},String(entry.original.category||'Sem categoria'))),
    h('span',{'aria-hidden':'true'},'→'),
    h('div',{},h('small',{},'PROPOSTA'),h('strong',{},d.category||'Sem categoria'))),
   editor,
   h('div',{className:'mf-d04-scopes'},
    h('label',{},h('input',{type:'checkbox',checked:d.past,
     onChange:(e:any)=>change({past:e.target.checked})}),'Organizar anteriores'),
    h('label',{},h('input',{type:'checkbox',checked:d.future,
     onChange:(e:any)=>change({future:e.target.checked})}),'Categorizar futuras')),
   h('div',{className:'mf-d04-impact'},
    h('strong',{},impact.count+' registro(s) anteriores nesta amostra'),
    h('strong',{},impact.cents===null?'Valor indisponível':intelligencePremiumMoney(impact.cents)),
    h('small',{},impact.samplePartial?'Amostra parcial, não todo o histórico elegível.':'Soma apenas de IDs selecionados.'),
    !d.past?h('p',{},'Passado desligado: impacto histórico R$ 0,00.'):null,
    d.future?h('p',{},'Futuro não representa quantidade prevista de transações.'):null),
   h('div',{className:'mf-d04-candidates'},h('h4',{},'Registros de referência'),...candidates,
    !candidates.length?h('p',{},'Sem registros elegíveis nesta amostra.'):null),
   h('div',{className:'mf-d04-actions'},...actions),
   h('p',{className:'mf-d04-footnote'},
    'Alterações de termos, cor, escopos ou exclusões que o serviço não consegue revalidar permanecem rascunho, sem escrita pessoal.')));
}
function mfD04Render(app:any):any{
 const s=app.state,grant=s.categoryReviewGrant;
 const grantLive=!!grant?.token&&Number.isFinite(grant.expiresAt)&&grant.expiresAt>Date.now();
 const report=grantLive?s.categoryReviewReport:null;
 const entries=mfD04Entries(app),stage=s.mfD04Stage||'pending';
 const query=String(s.mfD04Search||'').toLocaleLowerCase('pt-BR');
 const visible=entries.filter(e=>(stage==='all'||e.status===stage)&&
  (e.title+' '+e.category+' '+e.source).toLocaleLowerCase('pt-BR').includes(query));
 const selected=visible.find(e=>e.id===s.mfD04Selected)||visible[0]||null;
 const body=grantLive&&report?h('div',{className:'mf-d04-body'},
  mfD04Queue(app,entries,selected),mfD04Details(app,selected),
  h('details',{className:'mf-d04-advanced'},
   h('summary',{},'Outras ferramentas do serviço de revisão'),
   renderCategoryReviewLegacy(app))):null;
 const empty=!grantLive?h('div',{className:'mf-d04-empty',role:'status'},
  h('h3',{},s.categoryReviewAvailable===false?'Revisão sintética indisponível':'Autorize uma revisão supervisionada'),
  h('p',{},'Escrita pela IA no perfil pessoal permanece desativada. A prévia de teste exige perfil sintético validado.'),
  s.categoryReviewAvailable?h('button',{type:'button',className:'primary-button',
   disabled:s.categoryReviewBusy,onClick:()=>void categoryReviewEnable(app)},'Autorizar revisão sintética'):null):null;
 return h('section',{className:'mf-d04-review',role:'region','aria-label':'Central de Revisão V1.1'},
  h('header',{className:'mf-d04-heading'},
   h('div',{},h('small',{},'INTELIGÊNCIA / CENTRAL DE REVISÕES'),
    h('h2',{},'Revise antes de decidir.'),
    h('p',{},'Sugestões e movimentações do serviço autorizado, com decisão supervisionada.')),
   h('div',{className:'mf-d04-heading-actions'},
    h('button',{type:'button',className:'ghost-button',
     onClick:()=>app.setState({categoryReviewOpen:false,intelligenceMainMode:'chat'})},'Voltar à conversa'),
    grant?h('button',{type:'button',className:'ghost-button',
     onClick:()=>void categoryReviewRun(app,()=>categoryReviewRefresh(app))},'Atualizar fila'):null)),
  empty,body,
  s.mfD04Error?h('p',{className:'mf-ai-error',role:'status'},s.mfD04Error):null,
  s.categoryReviewError?h('p',{className:'mf-ai-error',role:'alert'},s.categoryReviewError):null,
  s.categoryReviewBusy?h('p',{role:'status'},'Conferindo o serviço…'):null,
  s.categoryReviewReceipt&&grantLive?h('p',{className:'mf-d04-receipt',role:'status'},
   'Ação confirmada pelo serviço: '+String(s.categoryReviewReceipt.id)):null,
  grantLive?mfD04PreviewModal(app):null);
}
