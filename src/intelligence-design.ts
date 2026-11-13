/* INT-DESIGN-01 / D01 V4.5 — isolated, read-only proposal workbench.
 * These controls are UI state ONLY. The legacy preview validator reads the
 * selected record from the authorized source. Never call categorySave,
 * ruleSave, bankCategorize, categoryReviewConfirm or personal write APIs.
 */
type MfD01Edit = {
 proposalId:string; name:string; color:string; criterion:string;
 history:boolean; future:boolean; selected:boolean;
};
type MfD01Review = {
 proposalId:string; revision:string; consent:boolean; freshness:boolean;
};
const MF_D01_COLORS=['#53d896','#ff7a88','#f5bc63','#79a6fa','#b49be8','#57bbba'];
function mfD01Revision(p:IntelligenceActionProposal,edit:MfD01Edit):string{
 return JSON.stringify([p.id,p.origin,p.txId,p.accountId||'',p.amountCents,p.date,
  p.currentCategory,p.proposedCategory,edit.name,edit.color,edit.criterion,
  edit.history,edit.future,edit.selected]);
}
function mfD01Default(p:IntelligenceActionProposal):MfD01Edit{
 return {proposalId:p.id,name:p.proposedCategory||'',color:MF_D01_COLORS[0],
  criterion:String(p.rawDescription||p.description||'').slice(0,100),
  history:true,future:false,selected:!!p.txId};
}
function mfD01Current(app:any,p:IntelligenceActionProposal):MfD01Edit{
 const value=app.state.mfD01Committed?.[p.id];
 return value&&value.proposalId===p.id?value:mfD01Default(p);
}
function mfD01EditBegin(app:any,p:IntelligenceActionProposal):void{
 const old=mfD01Current(app,p);
 app.setState({mfD01Edit:{...old},mfD01Review:null});
}
function mfD01EditChange(app:any,patch:Partial<MfD01Edit>):void{
 if(!app.state.mfD01Edit)return;
 app.setState({mfD01Edit:{...app.state.mfD01Edit,...patch},mfD01Review:null});
}
function mfD01EditDiscard(app:any):void{
 app.setState({mfD01Edit:null,mfD01Review:null});
}
function mfD01Original(p:IntelligenceActionProposal,edit:MfD01Edit):boolean{
 const original=mfD01Default(p);
 return edit.name===original.name&&edit.criterion===original.criterion&&
  edit.history===original.history&&edit.future===false&&edit.selected===original.selected;
}
function mfD01EditSave(app:any,p:IntelligenceActionProposal):void{
 const edit: MfD01Edit=app.state.mfD01Edit;
 if(!edit||edit.proposalId!==p.id)return;
 if(!String(edit.name||'').trim())return;
 const next={...edit,name:edit.name.trim(),criterion:edit.criterion.trim()};
 app.setState({mfD01Committed:{...(app.state.mfD01Committed||{}),[p.id]:next},
  mfD01Edit:null,mfD01Review:null,mfD01LocalVerified:null});
}
function mfD01EnterReview(app:any,p:IntelligenceActionProposal):void{
 const edit=mfD01Current(app,p);
 if(!edit.history&&!edit.future)return;
 const revision=mfD01Revision(p,edit);
 let freshness=false;
 if(edit.history&&edit.selected&&p.txId&&p.status!=='ambiguous'&&
  typeof intelligenceVerifyProposalRecord==='function'){
   const verified=intelligenceVerifyProposalRecord(app,p);
   freshness=!!verified?.ok;
 }
 // A future rule is NOT an existing write capability, even if an earlier
 // transaction was validated; it can be reviewed, not applied.
 app.setState({mfD01Review:{proposalId:p.id,revision,consent:false,freshness}});
}
function mfD01VerifyReview(app:any,p:IntelligenceActionProposal):boolean{
 const edit=mfD01Current(app,p),review:MfD01Review=app.state.mfD01Review;
 if(!review||review.proposalId!==p.id||review.revision!==mfD01Revision(p,edit))return false;
 if(edit.history&&(!edit.selected||!p.txId))return false;
 if(edit.history&&typeof intelligenceVerifyProposalRecord==='function'&&
   !intelligenceVerifyProposalRecord(app,p)?.ok)return false;
 return true;
}
function mfD01FormatCents(value:number):string{
 return Number.isSafeInteger(value)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Math.abs(value)/100):'—';
}
function renderMfD01Proposal(app:any,p:IntelligenceActionProposal):any{
 const edit=mfD01Current(app,p);
 const review:MfD01Review=app.state.mfD01Review?.proposalId===p.id?app.state.mfD01Review:null;
 const all=Array.isArray(p.candidates)?p.candidates:[];
 const ambiguous=p.status==='ambiguous',eligible=p.status==='pending'||p.status==='preview_confirmed';
 const fresh=review&&mfD01VerifyReview(app,p);
 const money=mfD01FormatCents(p.amountCents);
 const signed=p.txKind==='expense'?'-'+money:money;
 const current=p.currentCategory||'Não categorizada';
 const revision=mfD01Revision(p,edit);
 const priorVerified=app.state.mfD01LocalVerified?.proposalId===p.id&&app.state.mfD01LocalVerified?.revision===revision;
 const unchanged=mfD01Original(p,edit);
 const activeEdit: MfD01Edit=app.state.mfD01Edit?.proposalId===p.id?app.state.mfD01Edit:null;
 return h('section',{className:'mf-d01-proposal status-'+p.status,role:'region','aria-label':'Proposta de categoria supervisionada'},
  h('div',{className:'mf-d01-proposal-lead'},
   h('span',{className:'mf-d01-category-icon',style:{color:edit.color,'--mf-d01-icon-color':edit.color}},'✦'),
   h('div',{className:'mf-d01-proposal-title'},
    h('small',{},'Proposta de organização · somente leitura'),
    h('h3',{},edit.name||'Nova categoria'),
    h('p',{},'Critério: '+(edit.criterion||'A definir'))),
   h('button',{type:'button',className:'ghost-button mf-d01-edit-trigger',onClick:()=>mfD01EditBegin(app,p)},'Personalizar')),
  h('div',{className:'mf-d01-stats'},
   h('div',{},h('small',{},'Selecionadas'),h('strong',{},String(!ambiguous&&edit.selected&&p.txId?1:0))),
   h('div',{},h('small',{},'Valor na prévia'),h('strong',{},!ambiguous&&edit.selected&&p.txId?signed:'—')),
   h('div',{},h('small',{},'A conferir'),h('strong',{},String(ambiguous?Math.max(1,p.candidatesCount||all.length):0)))),
  ambiguous?h('div',{className:'mf-d01-warning',role:'status'},
   h('strong',{},'Encontramos lançamentos parecidos'),
   h('p',{},'Escolha o registro correto antes de continuar. Nenhuma correspondência ambígua será aplicada automaticamente.'),
   ...all.slice(0,p.visibleLimit||8).map((c:IntelligenceActionCandidate)=>h('button',{type:'button',className:'mf-d01-candidate',key:c.candidateKey,
    onClick:()=>intelligenceSelectActionCandidate(app,p.id,c.candidateKey)},
    h('span',{},c.description+' · '+c.date),
    h('strong',{},mfD01FormatCents(c.amountCents)))),
   all.length>(p.visibleLimit||8)?h('button',{type:'button',className:'ghost-button',onClick:()=>intelligenceExpandProposalCandidates(app,p.id)},'Mostrar mais registros'):null):
   h('div',{className:'mf-d01-affected'},
    h('strong',{},'Movimentação identificada'),
    h('label',{className:'mf-d01-transaction'},
     h('input',{type:'checkbox',checked:edit.selected,disabled:!p.txId||!eligible,onChange:(e:any)=>{
      app.setState({mfD01Committed:{...(app.state.mfD01Committed||{}),[p.id]:{...edit,selected:e.target.checked}},mfD01Review:null});
     }}),
     h('span',{},h('b',{},p.description),h('small',{},p.date+' · '+(p.origin==='bank'?'Banco':'Manual')+' · '+current+' → '+edit.name)),
     h('strong',{},signed))),
  h('div',{className:'mf-d01-scopes'},
   h('label',{},h('input',{type:'checkbox',checked:edit.history,disabled:ambiguous,onChange:(e:any)=>{
    app.setState({mfD01Committed:{...(app.state.mfD01Committed||{}),[p.id]:{...edit,history:e.target.checked}},mfD01Review:null});
   }}),'Organizar compras anteriores'),
   h('label',{},h('input',{type:'checkbox',checked:edit.future,onChange:(e:any)=>{
    app.setState({mfD01Committed:{...(app.state.mfD01Committed||{}),[p.id]:{...edit,future:e.target.checked}},mfD01Review:null});
   }}),'Categorizar próximas compras')),
  edit.future?h('p',{className:'mf-d01-warning'},'A regra para compras futuras ainda não possui prévia e serviço transacional autorizados; não será ativada aqui.'):null,
  h('div',{className:'mf-d01-actions'},
   h('button',{type:'button',className:'primary-button',
    disabled:ambiguous||!eligible||(!edit.history&&!edit.future),
    onClick:()=>mfD01EnterReview(app,p)},'Conferir proposta'),
   h('button',{type:'button',className:'ghost-button',disabled:p.status==='denied',
    onClick:()=>{intelligenceResolveActionProposal(app,p.id,'deny');app.setState({mfD01Review:null,mfD01Edit:null});}},'Recusar')),
  review?h('div',{className:'mf-d01-confirm',role:'group','aria-label':'Reconfirmação de prévia sem gravação'},
   h('strong',{},'Confira antes de prosseguir'),
   h('p',{},edit.name+' · '+(edit.history?'Compras anteriores':'Sem histórico')+
     (edit.future?' + próximas compras':'')+' · '+(edit.selected&&p.txId?money:'Nenhum lançamento selecionado')),
   h('small',{},'Prévia local '+(fresh?'conferida':'desatualizada ou sem cobertura')+
    ' · identificador '+p.id.slice(0,22)+' · nenhuma escrita disponível'),
   !fresh?h('p',{role:'alert'},'A identificação mudou ou falta cobertura. Revise a seleção antes de confirmar.'):null,
   h('label',{},h('input',{type:'checkbox',checked:!!review.consent,disabled:!fresh,
    onChange:(e:any)=>app.setState({mfD01Review:{...review,consent:e.target.checked}})}),
    'Confirmo que conferi os dados desta prévia sem gravação.'),
   h('div',{className:'mf-d01-actions'},
    h('button',{type:'button',className:'ghost-button',onClick:()=>app.setState({mfD01Review:null})},'Voltar'),
    h('button',{type:'button',className:'primary-button',disabled:!fresh||!review.consent||!edit.history||!edit.selected||!p.txId,
     onClick:()=>{if(!mfD01VerifyReview(app,p)||!app.state.mfD01Review?.consent)return;
      if(mfD01Original(p,edit))intelligenceResolveActionProposal(app,p.id,'approve');
      app.setState({mfD01Review:null,mfD01LocalVerified:{proposalId:p.id,revision}});}},'Validar prévia sem gravar'))):
    null,
  unchanged&&p.resultMessage?h('p',{className:'mf-d01-result',role:'status'},p.resultMessage):null,
  (priorVerified||(unchanged&&p.status==='preview_confirmed'))?h('p',{className:'mf-d01-readonly',role:'status'},
   'Prévia conferida. Não foi aplicada nenhuma alteração. A aplicação por IA no perfil pessoal permanece indisponível.'):null,
  h('div',{className:'mf-d01-manual'},
   h('p',{},'Para criar uma categoria agora, use o editor manual. Isso é separado desta proposta.'),
   h('button',{type:'button',className:'ghost-button',disabled:app.state.mode==='demo',
    onClick:()=>{app.setState({mfD01Review:null,intelligencePanelOpen:false});app.navigate('categories');}},'Abrir editor manual')),
  activeEdit?h('div',{className:'mf-d01-modal-backdrop',role:'presentation'},
    h('div',{className:'mf-d01-modal',role:'dialog','aria-modal':'true','aria-label':'Personalizar proposta',
     onKeyDown:(e:any)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();mfD01EditDiscard(app);}}},
     h('h3',{},'Personalizar categoria'),
     h('label',{},'Nome',h('input',{autoFocus:true,value:activeEdit.name,maxLength:60,onChange:(e:any)=>mfD01EditChange(app,{name:e.target.value})})),
     h('label',{},'Critério de identificação',h('input',{value:activeEdit.criterion,maxLength:100,onChange:(e:any)=>mfD01EditChange(app,{criterion:e.target.value})})),
     h('fieldset',{},h('legend',{},'Cor da categoria'),...MF_D01_COLORS.map(color=>
      h('button',{type:'button',key:color,className:'mf-d01-color '+(color===activeEdit.color?'is-selected':''),
       style:{backgroundColor:color},'aria-label':'Selecionar cor '+color,'aria-pressed':color===activeEdit.color,
       onClick:()=>mfD01EditChange(app,{color})},' '))),
     h('div',{className:'mf-d01-actions'},
      h('button',{type:'button',className:'ghost-button',onClick:()=>mfD01EditDiscard(app)},'Descartar edição'),
      h('button',{type:'button',className:'primary-button',disabled:!activeEdit.name.trim(),
       onClick:()=>mfD01EditSave(app,p)},'Salvar prévia')))):null);
}
