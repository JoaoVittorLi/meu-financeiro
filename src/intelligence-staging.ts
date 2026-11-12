/* Work staging: explicit opt-in, synthetic adapter, no financial writes or inference.
 * Uses aiFinancialContextDemo -> shared/ai-financial-context.mjs -> existing ledger.
 * State is session-only and separate from personal chat/history. */
type WorkDemoSource='bank'|'manual';
type WorkDemoSnapshot={
 source:WorkDemoSource;period:{start:string;end:string};engine:string;
 realized:{incomeCents:number;expenseCents:number;netCents:number};
 budgets:{category:string;limitCents:number;spentCents:number;pct:number|null}[];
 future:{pendingConfirmedExpensesCents:number;futureUncertainIncomeCents:number};warnings:string[];
};
type WorkDemoProposal={id:string;revision:number;source:WorkDemoSource;category:string;
 beforeCents:number;afterCents:number;status:'pending'|'approved'|'denied'|'stale'};
type WorkDemoMessage={id:string;role:'user'|'assistant';text:string;question?:string;source:WorkDemoSource};
type WorkDemoThread={id:string;title:string;messages:WorkDemoMessage[]};
type WorkDemoState={enabled:boolean;tab:'today'|'chat'|'actions';source:WorkDemoSource;
 status:'loading'|'ready'|'error';error:string;revision:number;snapshot:WorkDemoSnapshot|null;
 draft:string;threads:WorkDemoThread[];activeId:string;proposal:WorkDemoProposal|null;
 audit:{id:string;decision:string;result:string}[]};
let workDemoSequence=0;
function workDemoId(){return 'work-demo-'+(++workDemoSequence);}
function workDemoInitial():WorkDemoState{
 const id=workDemoId();return {enabled:true,tab:'today',source:'bank',status:'loading',error:'',revision:0,snapshot:null,
 draft:'',threads:[{id,title:'Nova conversa',messages:[]}],activeId:id,proposal:null,audit:[]};
}
function workDemoMoney(n:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);}
function workDemoSnapshot(raw:any,source:WorkDemoSource):WorkDemoSnapshot{
 if(!raw||raw.source!==source||raw.stage!=='synthetic_financial_context_preview'||
 raw.onlyFictitiousFinancialData!==true||raw.realFinancialDataIncluded!==false||
 raw.inferenceCalled!==false||raw.changesApplied!==false||raw.cloudCutoverAllowed!==false||
 raw.engine!=='shared/finance-period-ledger.mjs')throw Error('O adaptador não confirmou a origem fictícia.');
 const money=(v:any)=>{if(!Number.isSafeInteger(v))throw Error('Valor fictício inválido.');return v;};
 const text=(v:any)=>{if(typeof v!=='string'||v.length>300)throw Error('Texto fictício inválido.');return v;};
 if(!Array.isArray(raw.budgets)||!Array.isArray(raw.warnings))throw Error('Contexto fictício incompleto.');
 return {source,engine:raw.engine,period:{start:text(raw.period?.start),end:text(raw.period?.end)},
 realized:{incomeCents:money(raw.realized?.incomeCents),expenseCents:money(raw.realized?.expenseCents),netCents:money(raw.realized?.netCents)},
 budgets:raw.budgets.map((b:any)=>({category:text(b.category),limitCents:money(b.limitCents),spentCents:money(b.spentCents),pct:b.pct===null?null:money(b.pct)})),
 future:{pendingConfirmedExpensesCents:money(raw.future?.pendingConfirmedExpensesCents),futureUncertainIncomeCents:money(raw.future?.futureUncertainIncomeCents)},
 warnings:raw.warnings.map(text)};
}
async function workDemoLoad(app:any,source:WorkDemoSource='bank',adapter?:(source:WorkDemoSource)=>Promise<any>){
 const previous:WorkDemoState=app.state.workIntelligenceDemo||workDemoInitial();
 const revision=previous.revision+1;
 app.setState({workIntelligenceDemo:{...previous,enabled:true,source,revision,status:'loading',error:'',snapshot:null,
 proposal:previous.proposal?.status==='pending'?{...previous.proposal,status:'stale'}:previous.proposal}});
 try{
  const read=adapter||(typeof desktop!=='undefined'&&desktop?.aiFinancialContextDemo?
   (s:WorkDemoSource)=>desktop.aiFinancialContextDemo(s):null);
  if(!read)throw Error('O adaptador de demonstração está indisponível neste ambiente.');
  const snapshot=workDemoSnapshot(await read(source),source);
  app.setState((state:any)=>{
   const current:WorkDemoState=state.workIntelligenceDemo;
   return current?.enabled&&current.revision===revision?{workIntelligenceDemo:{...current,snapshot,status:'ready'}}:{};
  });
 }catch(error:any){
  app.setState((state:any)=>{
   const current:WorkDemoState=state.workIntelligenceDemo;
   return current?.enabled&&current.revision===revision?{workIntelligenceDemo:{...current,status:'error',snapshot:null,error:String(error?.message||'Falha ao carregar demonstração.').slice(0,180)}}:{};
  });
 }
}
function workDemoUpdate(app:any,patch:Partial<WorkDemoState>){
 app.setState((state:any)=>({workIntelligenceDemo:{...state.workIntelligenceDemo,...patch}}));
}
function workDemoExit(app:any){
 app.setState((state:any)=>({workIntelligenceDemo:{...state.workIntelligenceDemo,enabled:false,revision:state.workIntelligenceDemo.revision+1},intelligencePanelOpen:false}));
}
function workDemoNewThread(app:any){
 const d:WorkDemoState=app.state.workIntelligenceDemo,id=workDemoId();
 workDemoUpdate(app,{threads:[{id,title:'Nova conversa',messages:[]},...d.threads].slice(0,12),activeId:id,draft:'',tab:'chat'});
}
function workDemoPrepare(app:any){
 const d:WorkDemoState=app.state.workIntelligenceDemo;
 if(d?.status!=='ready'||!d.snapshot)return;
 const b=d.snapshot.budgets.find(b=>b.spentCents>b.limitCents);
 if(!b)return;
 workDemoUpdate(app,{tab:'actions',proposal:{id:workDemoId(),revision:d.revision,source:d.source,category:b.category,
 beforeCents:b.limitCents,afterCents:b.spentCents,status:'pending'}});
}
function workDemoResolve(app:any,id:string,decision:'allow'|'deny'){
 const d:WorkDemoState=app.state.workIntelligenceDemo,p=d?.proposal;
 if(!d?.enabled||!p||p.id!==id||p.status!=='pending')return;
 const current=d.snapshot?.budgets.find(b=>b.category===p.category);
 const valid=d.status==='ready'&&p.revision===d.revision&&p.source===d.source&&
 current?.limitCents===p.beforeCents&&current?.spentCents===p.afterCents;
 const status=decision==='deny'?'denied':valid?'approved':'stale';
 workDemoUpdate(app,{proposal:{...p,status},audit:[...d.audit,{id:p.id,decision,result:status}].slice(-30)});
}
const WORK_DEMO_QUESTIONS=['Quanto gastei com alimentação?','Quais orçamentos estão em risco?','Quanto tenho comprometido?','Posso comprar um celular parcelado?'];
function workDemoAnswer(snapshot:WorkDemoSnapshot,question:string):string{
 const q=intelligenceFoldText(question);
 if(q.includes('alimentacao')){
  const b=snapshot.budgets.find(b=>b.category==='Alimentação');
  return b?'Alimentação: '+workDemoMoney(b.spentCents)+'. Valor confirmado no exemplo para '+snapshot.period.start+' a '+snapshot.period.end+'.':'Não há dados suficientes de alimentação neste exemplo.';
 }
 if(q.includes('orcamento')||q.includes('limite')){
  const risk=snapshot.budgets.filter(b=>b.spentCents>b.limitCents);
  return risk.length?risk.map(b=>b.category+': '+workDemoMoney(b.spentCents)+' gastos, limite '+workDemoMoney(b.limitCents)+'.').join(' '):'Nenhum orçamento do exemplo está excedido. Isso não prevê o restante do mês.';
 }
 if(q.includes('comprometido')||q.includes('compromisso'))return 'Compromissos futuros confirmados do exemplo: '+workDemoMoney(snapshot.future.pendingConfirmedExpensesCents)+'. Receitas incertas: '+workDemoMoney(snapshot.future.futureUncertainIncomeCents)+', fora do realizado.';
 if(q.includes('celular')||q.includes('comprar')||q.includes('parcel'))return 'Dados insuficientes: não há saldo bancário verificado nem projeção certificada. Use Simular compra para informar as premissas; este exemplo não conclui se a compra cabe no seu caixa.';
 if(q.includes('categoria')||q.includes('categorize')||q.includes('planej'))return 'Esta demonstração prepara somente ajustes de limite fictício. Categorização e compromissos supervisionados permanecem como próximas fatias; nenhum registro será alterado.';
 return 'Receitas do exemplo: '+workDemoMoney(snapshot.realized.incomeCents)+'; despesas: '+workDemoMoney(snapshot.realized.expenseCents)+'. Diferença: '+workDemoMoney(snapshot.realized.netCents)+', que não representa saldo disponível. Resposta determinística, sem modelo de IA.';
}
function workDemoSend(app:any,question:string){
 const d:WorkDemoState=app.state.workIntelligenceDemo,q=String(question||'').trim().slice(0,750);
 if(!q||d?.status!=='ready'||!d.snapshot)return;
 const thread=d.threads.find(t=>t.id===d.activeId);if(!thread)return;
 const messages:WorkDemoMessage[]=[...thread.messages,
 {id:workDemoId(),role:'user',text:q,source:d.source},
 {id:workDemoId(),role:'assistant',text:workDemoAnswer(d.snapshot,q),question:q,source:d.source}];
 workDemoUpdate(app,{draft:'',threads:d.threads.map(t=>t.id===thread.id?{...t,title:t.messages.length?t.title:q.slice(0,42),messages:messages.slice(-50)}:t)});
}
function renderWorkDemoProposal(app:any,d:WorkDemoState){
 const p=d.proposal;
 if(!p)return h('div',{className:'mf-work-empty'},h('h3',{},'Nenhuma alteração preparada'),h('p',{},'Escolha um alerta no radar para preparar uma prévia fictícia.'));
 const labels={pending:'Aguardando sua decisão',approved:'Simulação concluída · nada gravado',denied:'Proposta negada · nada gravado',stale:'Prévia desatualizada · prepare novamente'};
 return h('section',{className:'mf-work-proposal','aria-label':'Prévia fictícia de ajuste de limite'},
  h('span',{className:'mf-work-badge'},'Recomendação · demonstração'),h('h3',{},'Revisar limite de '+p.category),
  h('p',{},'Exemplo de ajuste ao gasto já lançado. Não é uma recomendação para o seu orçamento pessoal.'),
  h('div',{className:'mf-work-diff'},h('div',{},h('small',{},'Limite atual fictício'),h('strong',{},workDemoMoney(p.beforeCents))),h('span',{'aria-hidden':'true'},'→'),h('div',{},h('small',{},'Prévia fictícia'),h('strong',{},workDemoMoney(p.afterCents)))),
  h('p',{},'Validação: fonte, revisão, categoria e valores devem continuar iguais.'),
  h('p',{role:'status','data-work-proposal-status':p.status},labels[p.status]),
  p.status==='pending'?h('div',{className:'mf-work-actions'},
   h('button',{type:'button',className:'primary-button',onClick:()=>workDemoResolve(app,p.id,'allow')},'Permitir simulação'),
   h('button',{type:'button',className:'ghost-button',onClick:()=>workDemoResolve(app,p.id,'deny')},'Negar')):null,
  h('small',{},'Sem escrita no SQLite. Decisão registrada apenas nesta sessão demonstrativa.'));
}
function renderWorkDemoChat(app:any,d:WorkDemoState,compact=false){
 const thread=d.threads.find(t=>t.id===d.activeId);
 return h('div',{className:'mf-work-conversation'},
  h('div',{className:'mf-work-actions'},h('button',{type:'button',className:'ghost-button',onClick:()=>workDemoNewThread(app)},'Nova conversa fictícia'),
   h('select',{'aria-label':'Conversas fictícias',value:d.activeId,onChange:(e:any)=>workDemoUpdate(app,{activeId:e.target.value})},...d.threads.map(t=>h('option',{key:t.id,value:t.id},t.title)))),
  h('div',{className:'mf-work-messages',role:'log','aria-live':'polite','aria-label':'Mensagens da demonstração'},
   !(thread?.messages.length)?h('div',{className:'mf-work-empty'},h('h3',{},'Converse com os números do exemplo'),h('p',{},'Respostas locais explicáveis. Sem envio para IA.')):null,
   ...(thread?.messages||[]).map(m=>h('article',{key:m.id,className:'mf-work-message is-'+m.role},
    h('small',{},m.role==='user'?'Você · demonstração':'Assistente · resposta determinística'),h('p',{},m.text),
    m.role==='assistant'?h('details',{},h('summary',{},'Dados e cálculo consultados'),h('p',{},'Fonte fictícia: '+m.source+'. Motor: shared/finance-period-ledger.mjs. Novembro/2026. Banco e manual separados; pendências e transferências fora do realizado. Sem saldo verificado.')):null))),
  h('div',{className:'mf-work-prompts'},...WORK_DEMO_QUESTIONS.slice(0,compact?2:4).map(q=>h('button',{type:'button',key:q,className:'ghost-button',disabled:d.status!=='ready',onClick:()=>workDemoSend(app,q)},q))),
  h('form',{className:'mf-work-composer',onSubmit:(e:any)=>{e.preventDefault();workDemoSend(app,d.draft);}},
   h('label',{},'Pergunta sobre os dados fictícios',h('textarea',{rows:2,maxLength:750,value:d.draft,disabled:d.status!=='ready',onChange:(e:any)=>workDemoUpdate(app,{draft:e.target.value})})),
   h('button',{className:'primary-button',type:'submit',disabled:d.status!=='ready'||!d.draft.trim()},'Enviar demonstração')));
}
function renderWorkIntelligenceDemo(app:any){
 const d:WorkDemoState=app.state.workIntelligenceDemo,r=d.snapshot;
 return h('section',{className:'section mf-work-demo','aria-label':'Demonstração da nova Inteligência'},
  h('header',{className:'mf-work-hero'},h('div',{},h('span',{className:'micro-label'},'INTELIGÊNCIA · DEMONSTRAÇÃO ISOLADA'),h('h2',{},'Suas próximas decisões, com contexto.'),h('p',{},'Dados fictícios de novembro de 2026 · sem IA externa · sem gravação financeira.')),
   h('button',{type:'button',className:'ghost-button',onClick:()=>workDemoExit(app)},'Sair da demonstração')),
  h('div',{className:'mf-work-toolbar'},h('label',{},'Fonte do exemplo',h('select',{value:d.source,onChange:(e:any)=>void workDemoLoad(app,e.target.value)},h('option',{value:'bank'},'Banco fictício'),h('option',{value:'manual'},'Manual fictício'))),h('span',{className:'mf-work-badge'},'Histórico temporário · somente nesta sessão')),
  h('div',{role:'tablist','aria-label':'Áreas da demonstração',className:'mf-ai-tabbar'},...(['today','chat','actions'] as const).map((tab,i)=>h('button',{key:tab,id:'mf-work-tab-'+tab,role:'tab',type:'button','aria-selected':d.tab===tab,'aria-controls':'mf-work-panel',tabIndex:d.tab===tab?0:-1,className:d.tab===tab?'active':'',onClick:()=>workDemoUpdate(app,{tab}),onKeyDown:(e:any)=>{const next=intelligenceNextTab(tab,e.key);if(next){e.preventDefault();workDemoUpdate(app,{tab:next as WorkDemoState['tab']});setTimeout(()=>document.getElementById('mf-work-tab-'+next)?.focus(),0);}}},['Hoje','Conversar','Ações'][i]))),
  h('div',{id:'mf-work-panel',role:'tabpanel','aria-labelledby':'mf-work-tab-'+d.tab},
   d.status==='loading'?h('p',{role:'status'},'Preparando contexto fictício…'):d.status==='error'?h('div',{role:'alert'},h('p',{},d.error),h('button',{type:'button',className:'ghost-button',onClick:()=>void workDemoLoad(app,d.source)},'Tentar novamente')):
   d.tab==='chat'?renderWorkDemoChat(app,d):d.tab==='actions'?h('div',{},renderWorkDemoProposal(app,d),h('details',{},h('summary',{},'Decisões desta sessão ('+d.audit.length+')'),...d.audit.map((a,i)=>h('p',{key:i},a.id+' · '+a.decision+' · '+a.result+' · sem gravação')))):
   r?h('div',{className:'mf-work-radar'},
    h('div',{className:'mf-work-primary'},h('span',{className:'mf-work-badge'},'Alerta · confirmado no exemplo'),h('h3',{},'Comece pelos limites que já foram ultrapassados'),
     ...r.budgets.filter(b=>b.spentCents>b.limitCents).map(b=>h('div',{key:b.category,className:'mf-work-budget'},h('strong',{},b.category),h('span',{},workDemoMoney(b.spentCents)+' / '+workDemoMoney(b.limitCents)),
      h('small',{},b.pct===null?'Limite zero · percentual indefinido':b.pct+'% do limite fictício'),h('progress',{max:100,value:Math.min(b.pct||0,100),'aria-label':'Uso fictício de '+b.category}))),
     h('button',{type:'button',className:'primary-button',disabled:!r.budgets.some(b=>b.spentCents>b.limitCents),onClick:()=>workDemoPrepare(app)},'Preparar ajuste fictício')),
    h('div',{className:'mf-work-secondary'},h('span',{className:'mf-work-badge'},'Confirmado no exemplo'),h('h3',{},'Compromissos à frente'),h('strong',{className:'mf-work-number'},workDemoMoney(r.future.pendingConfirmedExpensesCents)),h('p',{},'Pagamentos futuros confirmados do exemplo. Receitas incertas de '+workDemoMoney(r.future.futureUncertainIncomeCents)+' ficam fora do realizado.'),
     h('button',{type:'button',className:'ghost-button',onClick:()=>{workDemoUpdate(app,{tab:'chat'});workDemoSend(app,'Quanto tenho comprometido?');}},'Entender os compromissos')),
    h('aside',{className:'mf-work-quality'},h('span',{className:'mf-work-badge'},'Dados insuficientes'),h('h3',{},'Quanto posso gastar? Ainda não sabemos.'),h('p',{},'Saldo e cobertura histórica não foram verificados. A diferença entre receitas e despesas não é dinheiro livre.'),h('details',{},h('summary',{},'Ver origem e limitações'),h('p',{},r.engine+' · '+r.period.start+' a '+r.period.end),h('ul',{},...r.warnings.map((w,i)=>h('li',{key:i},w)))))):null));
}
function workDemoPanelKey(app:any,e:any){
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();app.setState({intelligencePanelOpen:false});return;}
 if(e.key!=='Tab')return;
 const controls=Array.from(e.currentTarget.querySelectorAll('button:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]')) as HTMLElement[];
 const first=controls[0],last=controls[controls.length-1];
 if(!first)return;
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
}
const workDemoPanelRefs=new WeakMap<object,(element:HTMLElement|null)=>void>();
function workDemoPanelRef(app:any){
 if(!workDemoPanelRefs.has(app)){
  let origin:HTMLElement|null=null;
  workDemoPanelRefs.set(app,(element:HTMLElement|null)=>{
   if(element){origin=document.activeElement as HTMLElement; element.querySelector<HTMLButtonElement>('button')?.focus();}
   else if(origin?.isConnected)origin.focus();
  });
 }
 return workDemoPanelRefs.get(app);
}
function renderWorkIntelligencePanel(app:any){
 const d:WorkDemoState=app.state.workIntelligenceDemo,context=intelligenceContextFor(app.state.intelligenceContext).label;
 return h('div',{className:'mf-ai-backdrop',onMouseDown:(e:any)=>{if(e.target===e.currentTarget)app.setState({intelligencePanelOpen:false});}},
  h('aside',{className:'mf-ai-drawer mf-work-demo mf-work-drawer',role:'dialog','aria-modal':'true','aria-label':'Demonstração contextual de '+context,ref:workDemoPanelRef(app),onKeyDown:(e:any)=>workDemoPanelKey(app,e)},
   h('header',{className:'mf-work-hero'},h('div',{},h('span',{className:'micro-label'},'DEMONSTRAÇÃO · CONTEXTO AUTORIZADO'),h('h2',{},context),h('p',{},'Apenas o nome da seção; os números são fictícios.')),
    h('div',{className:'mf-work-actions'},h('button',{type:'button',className:'ghost-button',onClick:()=>app.setState({page:'intelligence',intelligencePanelOpen:false,workIntelligenceDemo:{...d,tab:'chat'}})},'Expandir demonstração'),h('button',{type:'button',className:'close-button','aria-label':'Fechar demonstração contextual',onClick:()=>app.setState({intelligencePanelOpen:false})},'×'))),renderWorkDemoChat(app,d,true)));
}
