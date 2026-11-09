/* Meu Financeiro v0.8 — planejamento e projeção diária. Apenas apresentação: cálculos no processo principal. */
function pDate(v:string){return v.split('-').reverse().join('/');}
function pShort(v:string){const [y,m,d]=v.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');}
function pStatus(v:string){return ({paid:'Pago',pending:'Pendente',overdue:'Vencido',cancelled:'Cancelado'} as any)[v]||v;}
function pChip(v:string){return h('span',{className:'p-chip p-chip-'+v},pStatus(v));}
function pFilterTransactions(app:any){
 const s=app.state,month=s.planMonth,t=s.planTerm.trim().toLowerCase(),mode=s.planView;
 const planned=s.planning.items.filter((i:PlanItem)=>i.dueDate.slice(0,7)===month).map((i:PlanItem)=>({key:'plan:'+i.id,type:'planned',kind:i.kind,date:i.dueDate,title:i.title,original:i.links?.find(l=>l.status==='POSTED')?.description||'',category:i.category,amount:i.amount,status:i.effectiveStatus,item:i}));
 const linked=new Set<string>();for(const i of s.planning.items)for(const l of i.links||[])if(l.status==='POSTED')linked.add(l.accountId+'|'+l.externalId);
 const allBank=s.mode==='demo'?[]:s.bank.data.transactions.filter((i:BankTx)=>i.date.slice(0,7)===month);
 // In the consolidated view, show a linked payment under its plan, not as a second purchase.
 const bank=allBank.filter((i:BankTx)=>mode==='bank'||!linked.has(i.accountId+'|'+i.id)).map((i:BankTx)=>({key:'bank:'+i.accountId+'|'+i.id,type:'bank',kind:i.amount>0?'income':'expense',date:i.date,title:i.customTitle||i.merchant||i.description,original:i.description,category:i.category,amount:Math.abs(i.amount),status:i.status==='POSTED'?'paid':'pending',item:i}));
 const manualLinked=new Set<string>(allBank.map((b:BankTx)=>b.linkedManualId).filter(Boolean) as string[]);
 const manual=s.data.transactions.filter((i:Tx)=>i.date.slice(0,7)===month&&!manualLinked.has(i.id)).map((i:Tx)=>({key:'manual:'+i.id,type:'manual',kind:i.kind,date:i.date,title:i.description,original:'',category:i.category,amount:i.amount,status:'paid',item:i}));
 return [...planned,...bank,...manual].filter(x=>(mode==='all'||(mode==='planned'&&x.type==='planned')||(mode==='bank'&&x.type==='bank')||(mode==='pending'&&x.type==='planned'&&(x.status==='pending'||x.status==='overdue'))||(mode==='paid'&&x.status==='paid'))&&(!t||[x.title,x.original,x.category].join(' ').toLowerCase().includes(t))).sort((a,b)=>b.date.localeCompare(a.date)||a.key.localeCompare(b.key)).slice(0,350);
}
// UI-03: upcoming commitments from canonical planning state, without recalculating balances.
function pUpcoming(app:any){
 const today=iso(new Date()),endDate=new Date();endDate.setDate(endDate.getDate()+6);
 const until=iso(endDate);
 const due=app.state.planning.items.filter((x:PlanItem)=>x.status==='planned'&&x.kind==='expense'&&x.remaining>0&&x.dueDate>=today&&x.dueDate<=until).sort((a:PlanItem,b:PlanItem)=>a.dueDate.localeCompare(b.dueDate)||String(a.id).localeCompare(String(b.id)));
 const total=due.reduce((sum:number,item:PlanItem)=>sum+item.remaining,0);
 return h('section',{className:'p-upcoming','aria-label':'Compromissos dos próximos sete dias'},
  h('div',{className:'p-section-heading'},h('div',{},h('h2',{},'Próximos sete dias'),h('p',{},'Valores pendentes cadastrados · '+pDate(today)+' a '+pDate(until))),h('strong',{},due.length?fmt(total):'Nenhum vencimento')),
  due.length?h('div',{className:'p-upcoming-list'},due.slice(0,5).map((item:PlanItem)=>h('button',{type:'button',className:'p-upcoming-row',key:item.id,onClick:()=>app.openPlanDetail(item.id)},
    h('span',{},h('b',{},item.title),h('small',{},pDate(item.dueDate)+' · '+item.category)),h('strong',{},fmt(item.remaining)))),due.length>5?h('p',{className:'muted-desc'},'Mais '+(due.length-5)+' compromisso(s) neste intervalo. Consulte a agenda completa abaixo.'):null):
   h('p',{className:'p-upcoming-empty'},'Nenhuma despesa pendente com vencimento nos próximos sete dias. Consulte a agenda para outros períodos.'));
}
function pSummary(app:any){const s=app.state,p=s.planning,items=p.items,today=iso(new Date()),future=items.filter((x:PlanItem)=>x.status==='planned'&&x.remaining>0);
 const pendingExpense=future.filter((x:PlanItem)=>x.kind==='expense').reduce((sum:number,x:PlanItem)=>sum+x.remaining,0);
 const pendingIncome=future.filter((x:PlanItem)=>x.kind==='income'&&x.certainty==='confirmed').reduce((sum:number,x:PlanItem)=>sum+x.remaining,0);
 const overdue=future.filter((x:PlanItem)=>x.kind==='expense'&&x.dueDate<today).length;
 const end=p.projection.rows?.at(-1);
 const data=[{icon:'wallet',label:'Saldo de referência',value:p.projection.anchor,desc:p.projection.source==='bank'?'Último saldo recebido das contas':'Calculado dos lançamentos manuais'},
 {icon:'trend',label:'Receitas previstas',value:pendingIncome,desc:'Valores confirmados ainda esperados'},
 {icon:'calendar',label:'Compromissos pendentes (todos)',value:pendingExpense,desc:overdue?`${overdue} vencido(s)`: 'Pagamentos que ainda aguardam quitação'},
 {icon:'chart',label:'Saldo ao fim do período',value:end?.closing??p.projection.anchor,desc:end?.date?pDate(end.date):'Sem projeção'}];
 return h('div',{className:'p-summary'},data.map((x,i)=>h('div',{className:'p-summary-card '+(i===3?'is-projected':''),key:x.label},h('span',{className:'p-summary-icon'},h(Icon,{name:x.icon,size:18})),h('small',{},x.label),h('strong',{className:i===3&&x.value<0?'bad-text':''},fmt(x.value)),h('span',{},x.desc))));}
// The graph marker is the slider: pointer/touch and keyboard select days across the full month.
function pTimeline(app:any){
 const s=app.state,today=iso(new Date()),month=s.planMonth,start=month+'-01',last=endOfMonth(month),max=Number(last.slice(-2));
 const timeline=s.planning.timeline||{rows:[],historicalNotice:null};
 const rows=timeline.rows as (PlanDay & {phase?:string})[];
 const byDay=new Map(rows.map(r=>[r.date,r]));
 const selected=byDay.get(s.planDay),previous=byDay.get(advanceDate(s.planDay,-1));
 const delta=selected&&previous?selected.closing-previous.closing:null;
 const positive=delta!==null&&delta>0,negative=delta!==null&&delta<0;
 const deltaLabel=delta===null?'Sem comparação':delta===0?'Sem mudança no saldo':(positive?'▲ +':'▼ −')+fmt(Math.abs(delta));
 const label=selected?.phase==='estimated_history'?'Estimativa histórica':'Projeção ao fim do dia';
 const items=s.planning.items.filter((x:PlanItem)=>x.dueDate===s.planDay||(s.planDay===today&&x.status==='planned'&&x.dueDate<today));
 const bank=s.bank.data.transactions.filter((x:BankTx)=>x.date===s.planDay&&x.status==='POSTED');
 // Chart geometry is deterministic, independent from the currently selected day.
 const left=70,right=980,top=24,bottom=237,width=right-left,height=bottom-top;
 const values=rows.map(r=>r.closing);
 const low=values.length?Math.min(...values):0,high=values.length?Math.max(...values):1;
 const pad=Math.max(5000,Math.round((high-low)*.18));
 const minY=low>=0?Math.max(0,low-pad):low-pad;
 const maxY=high<=0?Math.min(0,high+pad):high+pad;
 const span=Math.max(1,maxY-minY);
 const xFor=(date:string)=>left+(Number(date.slice(-2))-1)*width/Math.max(1,max-1);
 const yFor=(v:number)=>bottom-(v-minY)/span*height;
 const pointPath=rows.map((r,i)=>(i?'L':'M')+xFor(r.date).toFixed(2)+' '+yFor(r.closing).toFixed(2)).join(' ');
 const areaPath=rows.length?pointPath+' L '+xFor(rows[rows.length-1].date).toFixed(2)+' '+bottom+' L '+xFor(rows[0].date).toFixed(2)+' '+bottom+' Z':'';
 const pastRows=rows.filter(r=>r.phase==='estimated_history');
 const historicalPath=pastRows.map((r,i)=>(i?'L':'M')+xFor(r.date).toFixed(2)+' '+yFor(r.closing).toFixed(2)).join(' ');
 const activeX=selected?xFor(selected.date):left,activeY=selected?yFor(selected.closing):bottom;
 const ticks=[0,1,2,3,4].map(n=>({y:top+n*height/4,value:maxY-n*span/4}));
 const xLabels=[1,7,14,21,max].filter((v,i,a)=>v<=max&&a.indexOf(v)===i);
 const selectDay=(day:number)=>{
   const date=month+'-'+String(Math.max(1,Math.min(max,day))).padStart(2,'0');
   if(date!==app.state.planDay)app.setState({planDay:date});
 };
 const selectPointer=(e:any)=>{
   const svg=e.currentTarget as SVGSVGElement;
   const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
   const matrix=svg.getScreenCTM();if(!matrix)return;
   const x=point.matrixTransform(matrix.inverse()).x;
   selectDay(Math.round((Math.max(left,Math.min(right,x))-left)/width*(max-1))+1);
 };
 const keyDay=(e:any)=>{
   const day=Number(app.state.planDay.slice(-2));
   const next=e.key==='ArrowLeft'||e.key==='ArrowDown'?day-1:
    e.key==='ArrowRight'||e.key==='ArrowUp'?day+1:e.key==='PageDown'?day-7:
    e.key==='PageUp'?day+7:e.key==='Home'?1:e.key==='End'?max:null;
   if(next!==null){e.preventDefault();selectDay(next);}
 };
 return h('div',{className:'p-timeline-panel'},
   h('div',{className:'p-timeline-head'},h('div',{},h('span',{className:'micro-label'},'EVOLUÇÃO DO SALDO'),h('h2',{},'Seu dinheiro, dia após dia'),h('p',{},'Arraste o ponto no gráfico para acompanhar o saldo de cada dia.')),
     h('span',{className:'p-chart-month-label'},prettyMonth(month))),
   h('div',{className:'p-chart-metrics'},
     h('div',{className:'p-chart-current'},h('span',{className:'micro-label'},label+' · '+pDate(s.planDay)),h('strong',{},selected?fmt(selected.closing):'—'),
       h('span',{className:'p-chart-delta '+(positive?'up':negative?'down':'neutral')},deltaLabel,h('small',{},' vs. dia anterior'))),
     h('div',{className:'p-chart-guide'},h('span',{},'Dia '+Number(s.planDay.slice(-2))+' de '+max),h('small',{},selected?.phase==='estimated_history'?'Valor histórico estimado, sujeito à disponibilidade dos dados':'Valores futuros são estimativas; não representam saldo garantido'))),
   h('div',{className:'p-chart-canvas'},
     rows.length?h('svg',{viewBox:'0 0 1010 280',className:'p-balance-svg p-draggable-chart',
       role:'slider',tabindex:0,'aria-label':'Dia selecionado no gráfico de saldo · '+prettyMonth(month),
       'aria-valuemin':1,'aria-valuemax':max,'aria-valuenow':Number(s.planDay.slice(-2)),
       'aria-valuetext':pDate(s.planDay)+' · '+(selected?fmt(selected.closing):'sem valor')+' · '+deltaLabel,
       onKeyDown:keyDay,
       onPointerDown:(e:any)=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);selectPointer(e);},
       onPointerMove:(e:any)=>{if(e.buttons&1)selectPointer(e);},
       onMouseMove:(e:any)=>{if(e.buttons&1)selectPointer(e);},
       onTouchStart:(e:any)=>{const touch=e.touches?.[0];if(touch)selectPointer({currentTarget:e.currentTarget,clientX:touch.clientX,clientY:touch.clientY});},
       onTouchMove:(e:any)=>{const touch=e.touches?.[0];if(touch)selectPointer({currentTarget:e.currentTarget,clientX:touch.clientX,clientY:touch.clientY});},
       onPointerUp:(e:any)=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){selectPointer(e);e.currentTarget.releasePointerCapture(e.pointerId);}},
       onPointerCancel:(e:any)=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}},
       h('defs',{},h('linearGradient',{id:'pBalanceArea',x1:'0',y1:'0',x2:'0',y2:'1'},h('stop',{offset:'0%',stopColor:'#8f51ff',stopOpacity:'.30'}),h('stop',{offset:'100%',stopColor:'#8f51ff',stopOpacity:'.01'})),h('linearGradient',{id:'pBalanceStroke',x1:'0',y1:'0',x2:'1',y2:'0'},h('stop',{offset:'0%',stopColor:'#ad7aff'}),h('stop',{offset:'100%',stopColor:'#7b5dff'}))),
       ...ticks.map((t,i)=>h('g',{key:'tick-'+i},h('line',{x1:left,y1:t.y,x2:right,y2:t.y,className:'p-chart-grid-line'}),h('text',{x:left-15,y:t.y+4,className:'p-chart-axis-label',textAnchor:'end'},Math.abs(t.value)>=100000?'R$ '+(t.value/100000).toFixed(1).replace('.',',')+' mil':'R$ '+Math.round(t.value/100)))),
       ...xLabels.map(d=>h('text',{key:'day-'+d,x:left+(d-1)*width/Math.max(1,max-1),y:264,textAnchor:'middle',className:'p-chart-axis-label'},'Dia '+d)),
       h('path',{d:areaPath,fill:'url(#pBalanceArea)'}),
       h('path',{d:pointPath,fill:'none',stroke:'url(#pBalanceStroke)',strokeWidth:3.5,strokeLinecap:'round',strokeLinejoin:'round'}),
       pastRows.length>1?h('path',{d:historicalPath,fill:'none',stroke:'#d5bcff',strokeWidth:3.5,strokeDasharray:'7 7',strokeLinecap:'round'}):null,
       selected?h('g',{},h('line',{x1:activeX,y1:top,x2:activeX,y2:bottom,className:'p-chart-active-line'}),h('circle',{cx:activeX,cy:activeY,r:10,fill:'#9265ff',stroke:'#e6d4ff',strokeWidth:3,className:'p-chart-drag-handle'}),h('circle',{cx:activeX,cy:activeY,r:17,fill:'#9963ff',fillOpacity:.13})):null
     ):h('div',{className:'p-chart-empty'},'Ainda não há dados para mostrar o gráfico.')),
   h('p',{className:'p-chart-instruction'},'Arraste a bolinha no gráfico ou use as setas do teclado. '+(pastRows.length?'Linha pontilhada: histórico estimado.':'')),
   timeline.historicalNotice&&month===today.slice(0,7)?h('p',{className:'p-chart-disclaimer'},timeline.historicalNotice):null,
   h('div',{className:'p-day-details'},h('div',{className:'p-day-balance-card'},h('span',{className:'micro-label'},'DIA '+pDate(s.planDay)),h('strong',{},selected?fmt(selected.closing):'—'),h('small',{},selected?.phase==='estimated_history'?'Saldo histórico reconstruído':'Saldo estimado ao final do dia'),selected?h('div',{className:'p-day-totals'},h('span',{},'Início '+fmt(selected.opening)),h('span',{className:'good-text'},'+'+fmt(selected.incoming)),h('span',{className:'bad-text'},'−'+fmt(selected.outgoing))):null),
     h('div',{className:'p-day-events'},h('h3',{},'Movimentações de '+pDate(s.planDay)),
      items.length||bank.length?[
       ...items.map((i:PlanItem)=>h('button',{className:'p-event-row',key:i.id,onClick:()=>app.openPlanDetail(i.id)},h('span',{className:'p-event-icon'},app.getCategories().find((c:CategoryInfo)=>c.name===i.category)?.emoji||'🧾'),h('span',{className:'p-event-name'},h('b',{},i.title),h('small',{},pStatus(i.effectiveStatus)+(i.certainty==='estimated'?' · estimado':''))),h('strong',{className:i.kind==='income'?'good-text':'bad-text'},(i.kind==='income'?'+':'−')+fmt(i.remaining||i.amount)))),
       ...bank.map((b:BankTx)=>h('button',{className:'p-event-row',key:b.accountId+':'+b.id,onClick:()=>app.openPlanBankDetail(b)},h('span',{className:'p-event-icon'},'🏦'),h('span',{className:'p-event-name'},h('b',{},b.customTitle||b.merchant||b.description),h('small',{},'Realizada · '+b.accountName)),h('strong',{className:b.amount>=0?'good-text':'bad-text'},(b.amount>=0?'+':'−')+fmt(Math.abs(b.amount)))))
      ]:h('p',{className:'muted-desc'},'Nenhuma movimentação registrada para esta data.'))));
}
function pSuggestions(app:any){const s=app.state,suggestions=s.planning.suggestions.filter((x:PlanSuggestion)=>s.planning.items.some((i:PlanItem)=>i.id===x.itemId));
 if(!suggestions.length)return null;
 return h('section',{className:'p-suggestions'},h('div',{className:'p-section-heading'},h('div',{},h('span',{className:'micro-label'},'SUGESTÕES PARA VOCÊ'),h('h2',{},'Possíveis pagamentos encontrados'),h('p',{},'Comparamos valores e datas. Você decide se é o mesmo pagamento.'))),h('div',{className:'p-suggestion-grid'},suggestions.slice(0,4).map((match:PlanSuggestion)=>{
  const item=s.planning.items.find((i:PlanItem)=>i.id===match.itemId),bank=s.bank.data.transactions.find((b:BankTx)=>b.accountId===match.accountId&&b.id===match.externalId);
  return h('div',{className:'p-suggestion-card',key:match.itemId+match.externalId},h('div',{className:'p-score'},(match.score>=80?'Correspondência forte':match.score>=60?'Possível correspondência':'Revisar correspondência')),h('strong',{},item?.title||'Pagamento'),h('span',{},match.description),h('small',{},pDate(match.date)+' · '+fmt(Math.abs(match.amount))+' · '+match.accountName),h('div',{className:'p-suggest-actions'},h('button',{className:'primary-button',disabled:s.planBusy||!bank,onClick:()=>bank&&app.linkPlan(match.itemId,bank)},'Vincular'),h('button',{className:'ghost-button',disabled:s.planBusy,onClick:()=>app.rejectPlanSuggestion(match)},'Ignorar')));
 })));}
function pMonthNavigation(app:any){const month=app.state.planMonth;
 return h('div',{className:'p-month-arrows','aria-label':'Mês da agenda'},h('button',{type:'button',disabled:month<=nowYM,onClick:()=>app.changePlanMonth(-1),'aria-label':'Mês anterior'},h(Icon,{name:'chevron-left',size:16})),h('strong',{},prettyMonth(month)),h('button',{type:'button',disabled:month>=shiftMonth(nowYM,12),onClick:()=>app.changePlanMonth(1),'aria-label':'Próximo mês'},h(Icon,{name:'chevron-right',size:16})));
}
function renderPlanningView(app:any){const s=app.state;if(s.mode==='demo')return h('section',{className:'p-empty'},h('h2',{},'Planejamento para suas finanças reais'),h('p',{},'Saia da demonstração para cadastrar e acompanhar seus compromissos.'),h('button',{className:'primary-button',onClick:()=>app.toggleMode()},'Ver meus dados'));
 const p=s.planning,today=iso(new Date()),rows=pFilterTransactions(app);
 return h('div',{className:'p-main'},
  h('section',{className:'p-hero'},h('div',{},h('span',{className:'micro-label'},'SUA AGENDA FINANCEIRA'),h('h2',{},'Sua agenda'),h('p',{},'Compromissos pendentes e realizados em uma única agenda.')),h('div',{className:'p-hero-actions'},h('button',{className:'primary-button',onClick:()=>app.openPlan(undefined,'expense')},'＋ Planejar despesa'),h('button',{className:'ghost-button',onClick:()=>app.openPlan(undefined,'income')},'＋ Prever receita'),h('button',{className:'p-sync',disabled:s.bankBusy||s.planBusy,onClick:()=>app.syncBank(false)},h(Icon,{name:'refresh',size:15}),s.bankBusy?'Atualizando…':'Atualizar'))),
  pUpcoming(app),
  pSummary(app),
  p.projection.reference?.quality==='stale'?h('div',{className:'p-warning'},'O último saldo recebido tem mais de 24 horas. Atualize suas contas antes de usar esta previsão.'):p.projection.reference?.quality==='incomplete'?h('div',{className:'p-warning'},'Algumas contas não informaram saldo. O total projetado pode estar incompleto.'):p.projection.reference?.quality==='unverified'?h('div',{className:'p-warning'},'O banco foi consultado recentemente, mas o saldo pode não incluir operações mais novas. Confira antes de assumir compromissos.'):null,
  p.projection.negativeDays.length?h('div',{className:'p-warning'},h(Icon,{name:'alert',size:16}),'Há '+p.projection.negativeDays.length+' dia(s) com saldo projetado negativo. Primeiro: '+pDate(p.projection.negativeDays[0])):null,
  h('div',{className:'p-scenario-toggle'},h('span',{},h('b',{},'Projeção conservadora'),h('small',{},'Receitas incertas ficam fora do saldo previsto por padrão.')),h('label',{},h('input',{type:'checkbox',checked:s.planIncludeEstimated,onChange:(e:any)=>app.setState({planIncludeEstimated:e.target.checked},()=>app.refreshPlanning())}),'Incluir receitas incertas')),
  h('section',{className:'p-ledger'},h('div',{className:'p-section-heading'},h('div',{},h('span',{className:'micro-label'},'AGENDA COMPLETA'),h('h2',{},'Compromissos e movimentações'),h('p',{},'Priorize os vencimentos e consulte o histórico por período.')),
   h('div',{className:'p-ledger-navigation'},pMonthNavigation(app),h('span',{className:'p-count'},rows.length+' registros no mês'))),
   h('div',{className:'p-ledger-tools'},h('input',{className:'form-control',placeholder:'Buscar nome, descrição ou categoria...',value:s.planTerm,onChange:(e:any)=>app.setState({planTerm:e.target.value})}),h(StyledSelect,{value:s.planView,options:[{value:'all',label:'Tudo'},{value:'planned',label:'Planejadas'},{value:'pending',label:'Pendentes e vencidas'},{value:'bank',label:'Movimentações do banco'},{value:'paid',label:'Realizadas'}],onChange:(v:string)=>app.setState({planView:v})})),
   h('div',{className:'p-ledger-list'},rows.length?rows.map((r:any)=>{
    const category=app.getCategories().find((c:CategoryInfo)=>c.name===r.category);
    return h('button',{className:'p-ledger-row',key:r.key,onClick:()=>r.type==='planned'?app.openPlanDetail(r.item.id):r.type==='bank'?app.openPlanBankDetail(r.item):app.openManualDetail(r.item)},
      h('span',{className:'p-ledger-icon',style:{background:category?.color+'25'}},category?.emoji||'🧾'),
      h('span',{className:'p-ledger-name'},h('strong',{},r.title),r.original&&r.original!==r.title?h('small',{},r.original):h('small',{},r.category+' · '+(r.type==='planned'?'Prevista':r.type==='bank'?'Instituição conectada':'Manual'))),
      h('span',{className:'p-ledger-date'},pDate(r.date)),pChip(r.status),h('strong',{className:r.kind==='income'?'good-text':'bad-text'},(r.kind==='income'?'+':'−')+fmt(r.amount)),h('span',{className:'p-row-arrow'},h(Icon,{name:'chevron-right',size:16})));
   }):h('div',{className:'p-empty-list'},'Não há movimentações para estes filtros. Adicione uma previsão ou altere a pesquisa.')),
   s.bank.data.truncated?h('p',{className:'p-warning'},'O histórico de transações do banco é parcial nesta visualização. Consulte sua conta para dados mais antigos.'):null),
   pSuggestions(app),h('details',{className:'mf-planning-projection'},h('summary',{},h(Icon,{name:'chart',size:17}),'Consultar projeção diária'),pTimeline(app)),
   h('p',{className:'p-footnote'},'O saldo de referência vem da última informação disponível da instituição. Lançamentos já pagos e refletidos no banco não são descontados novamente. Previsões futuras são estimativas, não garantias.')
 );
}
function renderPlanEditor(app:any){const s=app.state,f=s.planForm,categories=app.getCategories();return h('div',{className:'modal-backdrop p-editor-backdrop',onMouseDown:(e:any)=>{if(e.target===e.currentTarget)app.setState({planOpen:false});}},h('div',{className:'modal p-plan-modal',role:'dialog','aria-modal':'true','aria-label':'Planejar compromisso'},
 h('div',{className:'modal-head'},h('div',{},h('span',{className:'micro-label'},f.id?'EDITAR OCORRÊNCIA':'NOVO PLANEJAMENTO'),h('h2',{},f.id?'Editar compromisso':'Planejar movimentação')),h('button',{className:'close-button',type:'button','aria-label':'Fechar painel',onClick:()=>app.setState({planOpen:false})},h(Icon,{name:'close',size:18}))),
 h('div',{className:'segmented'},['expense','income'].map(k=>h('button',{key:k,className:f.kind===k?'selected':'',onClick:()=>app.setState({planForm:{...f,kind:k,category:k==='income'?'Salário':'Outros'}})},k==='expense'?'Despesa':'Receita'))),
 app.field('Como deseja chamar esta transação?',h('input',{className:'form-control',maxLength:140,value:f.title,placeholder:'Ex.: Aluguel, salário, notebook',onChange:(e:any)=>app.setState({planForm:{...f,title:e.target.value}})})),
 h('div',{className:'two-inputs'},app.field(f.mode==='installments'?'Valor total da compra (R$)':'Valor previsto (R$)',h('input',{className:'form-control',inputMode:'decimal',value:f.amount,placeholder:'0,00',onChange:(e:any)=>app.setState({planForm:{...f,amount:e.target.value}})})),app.field('Data prevista',h(SingleDatePicker,{value:f.dueDate,onChange:(value:string)=>app.setState({planForm:{...f,dueDate:value}})}))),
 h('div',{className:'two-inputs'},app.field('Categoria',h(StyledSelect,{value:f.category,options:categories.map((c:CategoryInfo)=>({value:c.name,label:c.emoji+' '+c.name})),onChange:(v:string)=>app.setState({planForm:{...f,category:v}})})),app.field('Conta associada (opcional)',h(StyledSelect,{value:f.accountId,options:[{value:'',label:'Qualquer conta'},...s.bank.data.accounts.map((a:BankAccount)=>({value:a.id,label:a.name}))],onChange:(v:string)=>app.setState({planForm:{...f,accountId:v}})}))),
 !f.id?h('div',{className:'two-inputs'},app.field('Repetição',h(StyledSelect,{value:f.mode,options:[{value:'once',label:'Uma vez'},{value:'monthly',label:'Todo mês'},{value:'weekly',label:'Toda semana'},{value:'yearly',label:'Todo ano'},{value:'installments',label:'Parcelar compra'}],onChange:(v:string)=>app.setState({planForm:{...f,mode:v}})})),f.mode!=='once'?app.field('Quantidade (até 36)',h('input',{className:'form-control',type:'number',min:1,max:36,value:f.count,onChange:(e:any)=>app.setState({planForm:{...f,count:e.target.value}})})):null):h('p',{className:'muted-desc'},'A alteração será aplicada somente a esta ocorrência. As demais parcelas e repetições permanecem intactas.'),
 app.field('Confiança na previsão',h(StyledSelect,{value:f.certainty,options:[{value:'confirmed',label:'Confirmada / esperada'},{value:'estimated',label:'Estimativa incerta'}],onChange:(v:string)=>app.setState({planForm:{...f,certainty:v}})}),'Receitas incertas ficam fora da projeção conservadora.'),
 app.field('Observações (opcional)',h('textarea',{className:'form-control',rows:3,value:f.notes,maxLength:600,placeholder:'Detalhes úteis sobre esta movimentação',onChange:(e:any)=>app.setState({planForm:{...f,notes:e.target.value}})})),
 h('div',{className:'modal-actions'},h('button',{className:'ghost-button',disabled:s.planBusy,onClick:()=>app.setState({planOpen:false})},'Cancelar'),h('button',{className:'primary-button',disabled:s.planBusy,onClick:()=>app.savePlan()},s.planBusy?'Salvando…':f.id?'Salvar alterações':'Adicionar ao planejamento'))
 ));}
function renderPlanDrawer(app:any){const s=app.state,sel=s.planSelected||'',planned=sel.startsWith('plan:'),item:PlanItem|undefined=planned?s.planning.items.find((i:PlanItem)=>i.id===sel.slice(5)):undefined;
 const bank:BankTx|undefined=!planned?s.bank.data.transactions.find((b:BankTx)=>'bank:'+b.accountId+'|'+b.id===sel):undefined;
 if(!item&&!bank)return null;
 const candidates=item?s.bank.data.transactions.filter((b:BankTx)=>b.status==='POSTED'&&(b.amount>0?'income':'expense')===item.kind&&Math.abs(b.amount)<=item.remaining&&(item.accountId?b.accountId===item.accountId:true)&&!s.planning.items.some((i:PlanItem)=>i.links.some(l=>l.accountId===b.accountId&&l.externalId===b.id))&&Math.abs((Date.parse(b.date+'T00:00:00Z')-Date.parse(item.dueDate+'T00:00:00Z'))/86400000)<=40&&[b.description,b.customTitle||''].join(' ').toLowerCase().includes(s.planMatchQuery.toLowerCase())).slice(0,20):[];
 return h('div',{className:'mf-drawer-backdrop',onMouseDown:(e:any)=>{if(e.target===e.currentTarget)app.setState({planSelected:null});}},h('aside',{className:'mf-detail-drawer p-plan-drawer',role:'dialog','aria-modal':'true','aria-label':planned?'Detalhes do planejamento':'Detalhes da movimentação'},h('div',{className:'mf-drawer-head'},h('div',{},h('span',{className:'micro-label'},planned?'COMPROMISSO PLANEJADO':'MOVIMENTAÇÃO REAL'),h('h2',{},planned?'Detalhes do planejamento':'Detalhes da movimentação')),h('button',{className:'close-button',type:'button','aria-label':'Fechar painel',onClick:()=>app.setState({planSelected:null})},h(Icon,{name:'close',size:18}))),
 h('div',{className:'mf-detail-scroll'},
 h('div',{className:'mf-detail-hero'},h('span',{className:'mf-hero-emoji'},planned?(app.getCategories().find((c:CategoryInfo)=>c.name===item!.category)?.emoji||'🧾'):'🏦'),h('h3',{},planned?item!.title:bank!.customTitle||bank!.merchant||bank!.description),h('strong',{className:(planned?item!.kind:bank!.amount>=0?'income':'expense')==='income'?'good-text':'bad-text'},(planned?item!.kind==='income':bank!.amount>=0?true:false)?'+':'−',fmt(planned?item!.amount:Math.abs(bank!.amount))),h('small',{},planned?'Previsto para '+pDate(item!.dueDate)+' · '+pStatus(item!.effectiveStatus):pDate(bank!.date)+' · '+bank!.accountName)),
 planned?[
   h('div',{className:'mf-detail-section',key:'about'},h('b',{},'Sobre este compromisso'),h('p',{},'Categoria: '+item!.category),h('p',{},'Falta quitar: '+fmt(item!.remaining)),item!.overpaid?h('p',{className:'p-warning'},'Pagamento importado superior ao planejado: revise a diferença de '+fmt(item!.overpaid)):null,h('p',{},'Origem: '+(item!.groupType==='installments'?'Parcela '+item!.occurrence+'/'+item!.totalOccurrences:item!.groupType==='single'?'Lançamento único':'Recorrência '+item!.occurrence+'/'+item!.totalOccurrences)),item!.notes?h('p',{},item!.notes):null,
    h('div',{className:'p-drawer-actions'},h('button',{className:'ghost-button',onClick:()=>app.openPlan(item)},'Editar'),item!.status==='planned'?h('button',{className:'ghost-button',onClick:()=>app.changePlanStatus(item!.id,'cancelled')},'Cancelar previsão'):h('button',{className:'ghost-button',onClick:()=>app.changePlanStatus(item!.id,'planned')},'Reativar')),
    item!.status==='planned'&&!item!.links.length?h('button',{className:'ghost-button',onClick:()=>app.changePlanStatus(item!.id,'settled_manual')},item!.kind==='expense'?'Marcar como pago (já refletido no saldo)':'Marcar como recebido (já refletido no saldo)'):null),
   h('div',{className:'mf-detail-section',key:'linked'},h('b',{},'Pagamentos associados'),item!.links.length?item!.links.map(l=>h('div',{className:'p-linked-row',key:l.externalId},h('span',{},pDate(l.date)+' · '+l.description+' · '+fmt(Math.abs(l.amount))),h('button',{className:'mf-small-link',onClick:()=>app.unlinkPlan(item!.id,l)},'Desvincular'))):h('p',{className:'muted-desc'},'Nenhum pagamento bancário associado ainda.')),
   item!.status==='planned'&&item!.remaining>0?h('div',{className:'mf-detail-section',key:'search'},h('b',{},'Procurar pagamento no banco'),h('p',{className:'muted-desc'},'Selecione uma movimentação confirmada. Valores maiores que o planejado exigem ajustar o compromisso primeiro.'),h('input',{className:'form-control',value:s.planMatchQuery,placeholder:'Filtrar por descrição',onChange:(e:any)=>app.setState({planMatchQuery:e.target.value})}),candidates.length?candidates.map(b=>h('div',{className:'p-suggestion-compact',key:b.id},h('div',{},h('b',{},b.customTitle||b.description),h('small',{},pDate(b.date)+' · '+fmt(Math.abs(b.amount)))),h('button',{className:'ghost-button',onClick:()=>app.linkPlan(item!.id,b)},'Vincular'))):h('p',{className:'muted-desc'},'Nenhuma correspondência disponível nesta lista.')):null,
   h('div',{className:'mf-detail-section',key:'audit'},h('b',{},'Histórico do compromisso'),s.planHistory.length?s.planHistory.map((h:any,i:number)=>hFn(h,i)):h('p',{className:'muted-desc'},'Sem alterações adicionais.'))
 ]:[
   h('div',{className:'mf-detail-section',key:'title'},h('b',{},'Nome personalizado'),h('p',{className:'muted-desc'},'Esse nome aparece em destaque. A descrição original do banco é preservada.'),h('input',{className:'form-control',value:s.planBankTitle,maxLength:140,placeholder:'Ex.: Aluguel, mercado, viagem',onChange:(e:any)=>app.setState({planBankTitle:e.target.value})}),h('button',{className:'primary-button',disabled:s.planBusy,onClick:()=>app.renameBankInPlanning(bank)},'Salvar nome')),
   h('div',{className:'mf-detail-section',key:'original'},h('b',{},'Descrição original'),h('p',{},bank!.description),h('small',{className:'muted-desc'},'Situação: '+(bank!.status==='POSTED'?'Confirmada':'Pendente')+' · '+bank!.category)),
   h('div',{className:'mf-detail-section',key:'link'},h('b',{},'Vincular a um planejamento'),bank!.status==='POSTED'?s.planning.items.filter((i:PlanItem)=>i.status==='planned'&&i.remaining>=Math.abs(bank!.amount)&&(bank!.amount>=0?'income':'expense')===i.kind&&(!i.accountId||i.accountId===bank!.accountId)&&!s.planning.items.some((x:PlanItem)=>x.links.some(l=>l.accountId===bank!.accountId&&l.externalId===bank!.id))).slice(0,8).map((i:PlanItem)=>h('div',{className:'p-suggestion-compact',key:i.id},h('span',{},i.title+' · '+fmt(i.remaining)),h('button',{className:'ghost-button',onClick:()=>app.linkPlan(i.id,bank)},'Vincular'))):h('p',{className:'muted-desc'},'Aguarde a confirmação do banco para conciliar.')),
   h('button',{className:'ghost-button',onClick:()=>{app.setState({planSelected:null});app.openBankDetail(bank);}},'Mais detalhes e categorias')
 ])));
}
function hFn(item:any,index:number){return h('div',{key:index,className:'p-audit-row'},h('strong',{},({created:'Criado',edited:'Editado',linked:'Vinculado ao banco',unlinked:'Vínculo desfeito',cancelled:'Cancelado',settled_manual:'Quitado manualmente',planned:'Reativado',ignored:'Sugestão ignorada'} as any)[item.action]||item.action),h('small',{},new Date(item.at).toLocaleString('pt-BR')+(item.details?' · '+item.details:'')));}
