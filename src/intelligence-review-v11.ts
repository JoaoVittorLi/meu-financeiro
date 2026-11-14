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
 if(!grant?.token||!report)return [];
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
 if(!app.state.categoryReviewGrant?.token||!app.state.categoryReviewAvailable||
    !mfD04Impact(entry,draft,exclusions).eligible||exclusions.length)return false;
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
function mfD04Render(app:any):any{
 const s=app.state,grant=s.categoryReviewGrant,report=s.categoryReviewReport;
 const entries=mfD04Entries(app);
 const stage=s.mfD04Stage||'pending',q=String(s.mfD04Search||'').toLocaleLowerCase('pt-BR');
 const visible=entries.filter(e=>(stage==='all'||e.status===(stage==='history'?'history':'pending'))&&
  (e.title+' '+e.category+' '+e.source+' '+e.kind).toLocaleLowerCase('pt-BR').includes(q));
 const selected=visible.find(e=>e.id===s.mfD04Selected)||visible[0]||null;
 const draft=selected?mfD04DraftFor(app,selected):null;
 const exclusions=selected?s.mfD04Excluded?.[selected.id]||[]:[];
 const impact=selected&&draft?mfD04Impact(selected,draft,exclusions):null;
 const change=(patch:Partial<MfD04Draft>)=>{if(selected)mfD04Patch(app,selected,patch);};
 const focus=(id:string)=>app.setState({mfD04Selected:id,mfD04Edit:false,
    categoryReviewPreview:null,categoryReviewConfirmed:false,mfD04Error:''});
 return h('section',{className:'mf-d04-review',role:'region','aria-label':'Central de Revisão V1.1'},
  h('header',{className:'mf-d04-heading'},
   h('div',{},h('small',{},'INTELIGÊNCIA / CENTRAL DE REVISÕES'),
    h('h2',{},'Revise antes de decidir.'),
    h('p',{},'Cada sugestão usa dados e permissões da fonte autorizada. Nenhuma escrita pessoal é realizada pela IA.')),
   h('div',{className:'mf-d04-heading-actions'},
    h('button',{type:'button',className:'ghost-button',onClick:()=>app.setState({categoryReviewOpen:false,intelligenceMainMode:'chat'})},'Voltar à conversa'),
    grant?h('button',{type:'button',className:'ghost-button',onClick:()=>void categoryReviewRun(app,()=>categoryReviewRefresh(app))},'Atualizar fila'):null)),
  !grant?h('div',{className:'mf-d04-empty',role:'status'},
   h('h3',{},s.categoryReviewAvailable===false?'Revisão sintética indisponível neste perfil':'Inicie uma revisão supervisionada'),
   h('p',{},'O serviço de revisão não oferece escrita pela IA em dados pessoais. Quando existir perfil sintético validado, você poderá inspecionar e preparar operações reais com prévia.'),
   s.categoryReviewAvailable?h('button',{type:'button',className:'primary-button',disabled:s.categoryReviewBusy,
    onClick:()=>void categoryReviewEnable(app)},'Autorizar revisão sintética'):null):null,
  grant&&report?h('div',{className:'mf-d04-body'},
   h('section',{className:'mf-d04-queue','aria-label':'Fila de revisão'},
    h('div',{className:'mf-d04-queue-top'},
     h('h3',{},'Fila de decisões'),
     h('span',{},entries.filter(x=>x.status==='pending').length+' pendentes nesta consulta')),
    h('label',{className:'mf-d04-search'},'Buscar revisões',
     h('input',{type:'search',value:s.mfD04Search||'',placeholder:'Nome, origem ou categoria',
       onChange:(e:any)=>app.setState({mfD04Search:e.target.value,categoryReviewPreview:null,categoryReviewConfirmed:false})})),
    h('div',{className:'mf-d04-filters',role:'group','aria-label':'Filtrar a fila'},
     ...[{id:'pending',label:'Pendentes'},{id:'history',label:'Histórico'},{id:'all',label:'Todas'}].map(t=>
      h('button',{key:t.id,type:'button',className:stage===t.id?'active':'','aria-pressed':stage===t.id,
       onClick:()=>app.setState({mfD04Stage:t.id,categoryReviewPreview:null,categoryReviewConfirmed:false})},t.label))),
    h('div',{className:'mf-d04-items'},...visible.slice(0,80).map(e=>h('button',{type:'button',key:e.id,
      className:'mf-d04-item'+(selected?.id===e.id?' is-selected':''),'aria-pressed':selected?.id===e.id,
      onClick:()=>focus(e.id)},
      h('span',{className:'mf-d04-item-head'},h('strong',{},e.title),h('small',{},e.status==='history'?'Histórico':'Pendente')),
      h('span',{},e.source+' · '+(e.kind==='category_rule'?'Regra':e.kind==='category_change'?'Movimentação':'Decisão')),
      e.candidates.length?h('small',{},e.candidates.length+' registro(s) de amostra'):null))),
    !visible.length?h('p',{className:'mf-d04-no-results'},stage==='history'?'Sem decisões auditadas neste filtro.':'Nenhuma revisão disponível para este filtro.'):null,
    entries.length>80?h('small',{},'Mostrando até 80 registros desta página de origem.'):null),
   h('section',{className:'mf-d04-detail','aria-label':'Detalhe da proposta'},
    selected&&draft? h('div',{className:'mf-d04-detail-inner'},
     h('div',{className:'mf-d04-detail-head'},h('div',{},h('small',{},selected.source),h('h3',{},selected.title)),
      selected.kind!=='audit'?h('button',{type:'button',className:'ghost-button',
       onClick:()=>app.setState({mfD04Edit:!s.mfD04Edit})},s.mfD04Edit?'Recolher editor':'Editar rascunho'):null),
     selected.kind==='audit'? h('div',{className:'mf-d04-summary'},
      h('strong',{},'Registro de auditoria do serviço'),
      h('p',{},'Ação: '+selected.original.action+' · ID '+selected.original.id),
      h('p',{},'Desfazer: '+(selected.original.undoState||'não informado')),
      selected.original.undoState==='available'?h('button',{type:'button',className:'ghost-button',
       onClick:()=>void categoryReviewPrepare(app,'undo',{commandId:selected.original.id})},'Preparar desfazer com o serviço'):null):
      h('div',{className:'mf-d04-stack'},
       h('div',{className:'mf-d04-diff'},h('div',{},h('small',{},'SITUAÇÃO ATUAL'),
        h('strong',{},String(selected.original.category||'Sem categoria'))),
        h('span',{'aria-hidden':'true'},'→'),h('div',{},h('small',{},'PROPOSTA'),
         h('strong',{},draft.category||'Sem categoria'))),
       s.mfD04Edit?h('div',{className:'mf-d04-editor','aria-label':'Editar rascunho'},
        h('label',{},'Nome da proposta',h('input',{type:'text',value:draft.name,onChange:(e:any)=>change({name:e.target.value})})),
        h('label',{},'Categoria de destino',h('input',{type:'text',value:draft.category,onChange:(e:any)=>change({category:e.target.value})})),
        h('label',{},'Critério',h('input',{type:'text',value:draft.terms,onChange:(e:any)=>change({terms:e.target.value})})),
        h('div',{className:'mf-d04-colors','aria-label':'Cor do rascunho'},
         ...MF_D04_PALETTE.map(color=>h('button',{key:color,type:'button',
           style:{background:color},'aria-label':'Cor '+color,'aria-pressed':draft.color===color,
           onClick:()=>change({color})}))),
        h('div',{className:'mf-d04-actions'},
         h('button',{type:'button',className:'primary-button',onClick:()=>mfD04SavedDraft(app,selected)},'Salvar ajustes locais'),
         h('button',{type:'button',className:'ghost-button',onClick:()=>mfD04Discard(app,selected)},'Descartar alterações'))):null,
       h('div',{className:'mf-d04-scopes'},
        h('label',{},h('input',{type:'checkbox',checked:draft.past,onChange:(e:any)=>change({past:e.target.checked})}),'Organizar anteriores'),
        h('label',{},h('input',{type:'checkbox',checked:draft.future,onChange:(e:any)=>change({future:e.target.checked})}),'Categorizar futuras')),
       h('div',{className:'mf-d04-impact'},
        h('strong',{},String(impact?.count||0)+' registro(s) históricos nesta amostra'),
        h('strong',{},impact?.cents!=null?intelligencePremiumMoney(impact.cents):'Valor indisponível'),
        h('small',{},impact?.samplePartial?'Amostra parcial — não representa todo o histórico elegível.':'Valores calculados apenas dos IDs desta seleção.'),
        !draft.past?h('p',{},'Escopo histórico desligado: impacto passado R$ 0,00.'):null,
        draft.future?h('p',{},'Escopo futuro não prevê quantas transações ocorrerão.'):null),
       h('div',{className:'mf-d04-candidates'},
        h('h4',{},'Registros de referência'),
        ...selected.candidates.map(item=>h('label',{key:item.id},
         h('input',{type:'checkbox',checked:!exclusions.includes(item.id),
          onChange:(e:any)=>{
           const old=s.mfD04Excluded?.[selected.id]||[];
           const next=e.target.checked?old.filter((x:string)=>x!==item.id):[...old,item.id];
           app.setState({mfD04Excluded:{...app.state.mfD04Excluded,[selected.id]:next},
            categoryReviewPreview:null,categoryReviewConfirmed:false});
          }}),
         h('span',{},item.title+' · '+item.date),h('strong',{},intelligencePremiumMoney(item.amountCents)))),
        !selected.candidates.length?h('p',{},'Sem registros para quantificar nesta consulta.'):null),
       h('div',{className:'mf-d04-actions'},
        h('button',{type:'button',className:'primary-button',
          disabled:!mfD04ServiceEligible(app,selected,draft,exclusions),
          title:mfD04ServiceEligible(app,selected,draft,exclusions)?'Serviço sintético valida novamente a prévia':
           'Sem contrato operacional para aplicar este rascunho ou escopo',
          onClick:()=>mfD04Prepare(app,selected)},'Preparar no serviço'),
        selected.kind==='category_rule'?h('button',{type:'button',className:'ghost-button',
         disabled:!s.categoryReviewAvailable,onClick:()=>void categoryReviewPrepare(app,'decision',
          {suggestionId:selected.original.id,state:'denied'})},'Recusar'):null,
        selected.kind==='category_rule'?h('button',{type:'button',className:'ghost-button',
         disabled:!s.categoryReviewAvailable,onClick:()=>void categoryReviewPrepare(app,'decision',
          {suggestionId:selected.original.id,state:'deferred'})},'Adiar'):null),
       h('p',{className:'mf-d04-footnote'},'Rascunhos, critérios alterados, exclusões e histórico só podem ser aplicados após um contrato que revalide exatamente os mesmos IDs. A versão atual permite prévia do serviço para ações suportadas, sem escrita pessoal.'))
       ):h('div',{className:'mf-d04-no-results'},'Selecione uma proposta para inspecionar seus dados e permissões.'))),
   h('details',{className:'mf-d04-advanced'},
    h('summary',{},'Outras ferramentas do serviço de revisão'),
    renderCategoryReviewLegacy(app)):null,
  s.mfD04Error?h('p',{className:'mf-ai-error',role:'status'},s.mfD04Error):null,
  s.categoryReviewError?h('p',{role:'alert',className:'mf-ai-error'},s.categoryReviewError):null,
  s.categoryReviewBusy?h('p',{role:'status'},'Conferindo o serviço de revisão…'):null,
  s.categoryReviewReceipt&&grant?h('p',{role:'status',className:'mf-d04-receipt'},
    'O serviço registrou a ação '+String(s.categoryReviewReceipt.id)+'. Confira o histórico para elegibilidade de desfazer.'):null,
  mfD04PreviewModal(app));
}
