/* QA-84 B05 Hoje V6 — Pulso Financeiro.
 * Contract: only explicit verified projection sources may show future cash.
 * IC-v1/I-P0.1 currently lacks available cash and dated projection; in real
 * operation this renderer falls back to factual D03 signals, NEVER fake cash. */
function mfB05DateLabel(date) {
 if(typeof date!=='string')return '—';
 const p=date.split('-');return p.length===3?p[2]+'/'+p[1]:'—';
}
function mfB05TodaySelected(app,projection) {
 if(!projection.available)return null;
 return projection.timeline.find(p=>p.date===app.state.mfB05SelectedDate)||
  projection.timeline[projection.timeline.length-1]||null;
}
function mfB05OpenDrawer(app,kind,opener) {
 app.setState({mfB05DrawerKind:kind,mfB05DrawerOpener:opener},()=>{
  if(typeof document!=='undefined')document.getElementById('mf-b05-drawer-close')?.focus();
 });
}
function mfB05CloseDrawer(app) {
 const opener=app.state.mfB05DrawerOpener;
 app.setState({mfB05DrawerKind:null,mfB05DrawerOpener:null},()=>{
  if(opener&&typeof document!=='undefined')document.getElementById(opener)?.focus();
 });
}
function mfB05Ring(app,projection,point) {
 if(!projection.available||!point||!point.canRenderSegments)
  return h('div',{className:'mf-b05-ring-empty',role:'status'},
   h(Icon,{name:'shield',size:23}),
   h('strong',{},point&&point.projectedCents<0?'Saldo projetado insuficiente':'Projeção ainda indisponível'),
   h('p',{},point&&point.headroomCents<0?'O cenário apresenta falta de cobertura; um anel positivo seria incorreto.':
    'O serviço atual não fornece saldo e compromissos futuros reconciliados com cobertura suficiente.'));
 const parts=[
  {key:'commitments',label:'Compromissos considerados',cents:point.consideredCents,color:'var(--mf-b05-commit)'},
  {key:'margin',label:'Margem protegida',cents:point.protectedCents,color:'var(--mf-b05-margin)'},
  {key:'free',label:'Folga acima da margem',cents:point.freeCents,color:'var(--mf-b05-green)'}
 ];
 let offset=0;const circumference=2*Math.PI*82,denominator=projection.availableBalanceCents;
 const segments=parts.map(p=>{
  const length=denominator>0?p.cents/denominator*circumference:0;
  const element=h('circle',{key:p.key,cx:105,cy:105,r:82,fill:'none',stroke:p.color,strokeWidth:20,
   strokeDasharray:length+' '+circumference,strokeDashoffset:-offset,transform:'rotate(-90 105 105)',
   className:'mf-b05-ring-segment',role:'presentation'});
  offset+=length;return element;
 });
 return h('div',{className:'mf-b05-ring-wrap'},
  h('div',{className:'mf-b05-ring-art'},
   h('svg',{viewBox:'0 0 210 210',role:'img','aria-label':'Decomposição do saldo disponível verificado'},
    h('circle',{cx:105,cy:105,r:82,fill:'none',stroke:'var(--mf-b05-border)',strokeWidth:20}),...segments),
   h('div',{className:'mf-b05-ring-center'},
    h('small',{},'SALDO PROJETADO'),
    h('strong',{},mfB05Money(point.projectedCents)),
    h('span',{},'até '+mfB05DateLabel(point.date)))),
  h('div',{className:'mf-b05-ring-legend'},
   ...parts.map((p,i)=>h('button',{key:p.key,id:'mf-b05-ring-'+p.key,type:'button',className:'mf-b05-legend-row',
    onClick:()=>mfB05OpenDrawer(app,p.key,'mf-b05-ring-'+p.key)},
    h('span',{className:'mf-b05-legend-dot',style:{background:p.color},'aria-hidden':'true'}),
    h('span',{},p.label),h('strong',{},mfB05Money(p.cents))))));
}
function mfB05Timeline(app,projection,selected) {
 if(!projection.available||!selected)return h('section',{className:'mf-b05-route mf-b05-unavailable'},
  h('header',{},h('h3',{},'A rota dos próximos dias'),h('small',{},'Sem calendário de caixa reconciliado')),
  h('p',{},'Os compromissos registrados podem ser consultados no Planejamento. Para traçar saldos futuros, também precisamos do saldo disponível e das fontes reconciliadas.'),
  h('button',{type:'button',className:'ghost-button',onClick:()=>app.navigate('planning')},'Abrir Planejamento'));
 const points=projection.timeline,min=Math.min(0,...points.map(p=>p.projectedCents)),
  max=Math.max(...points.map(p=>p.projectedCents)),span=Math.max(1,max-min);
 const coords=points.map((p,i)=>({x:30+i*(540/Math.max(1,points.length-1)),
  y:140-(p.projectedCents-min)/span*105,point:p}));
 let d='M'+coords[0].x+' '+coords[0].y;
 for(let i=1;i<coords.length;i++)d+=' H'+coords[i].x+' V'+coords[i].y;
 const current=coords.find(x=>x.point.date===selected.date)||coords[coords.length-1];
 return h('section',{className:'mf-b05-route',role:'region','aria-label':'Linha do tempo financeira'},
  h('header',{},h('div',{},h('small',{},'ROTA DO PERÍODO'),h('h3',{},'Os próximos movimentos')),
   h('span',{className:'mf-b05-future-tag'},'Valores projetados, não pagamentos realizados')),
  h('svg',{viewBox:'0 0 600 164',className:'mf-b05-route-chart',role:'img',
    'aria-label':'Saldos projetados por vencimento em degraus'},
    h('path',{d,fill:'none',stroke:'var(--mf-b05-green)',strokeWidth:3,strokeLinejoin:'round'}),
    h('line',{x1:current.x,y1:12,x2:current.x,y2:148,stroke:'var(--mf-b05-green)',strokeDasharray:'4 5',opacity:.75}),
    ...coords.map(p=>h('circle',{key:p.point.date,cx:p.x,cy:p.y,r:p.point.date===selected.date?6:4,
      fill:p.point.date===selected.date?'var(--mf-b05-green)':'var(--mf-b05-surface)',stroke:'var(--mf-b05-green)',strokeWidth:2}))),
  h('div',{className:'mf-b05-route-dates','aria-label':'Marcos financeiros'},
   ...points.map(p=>h('button',{key:p.date,type:'button',className:'mf-b05-date'+(p.date===selected.date?' is-active':''),
    id:'mf-b05-date-'+p.date.replace(/-/g,''),'aria-pressed':p.date===selected.date,
    onClick:()=>app.setState({mfB05SelectedDate:p.date})},
    mfB05DateLabel(p.date)))),
  h('aside',{className:'mf-b05-milestone',role:'status','aria-live':'polite'},
   h('small',{},'MARCO DE '+mfB05DateLabel(selected.date)),
   h('strong',{},mfB05Money(selected.projectedCents)),
   h('span',{},'Saldo projetado após compromissos até esta data'),
   h('p',{},selected.commitmentIds.length+' compromisso(s) considerado(s) · '+mfB05Money(selected.consideredCents)),
   selected.headroomCents!==null?h('p',{className:selected.headroomCents<0?'mf-b05-negative':''},
    (selected.headroomCents<0?'Abaixo da margem: ':'Folga sobre a margem: ')+mfB05Money(Math.abs(selected.headroomCents))):null,
   h('button',{type:'button',className:'mf-b05-link',id:'mf-b05-events',
    onClick:()=>mfB05OpenDrawer(app,'commitments','mf-b05-events')},'Conferir compromissos')));
}
function mfB05ScenarioKey(app,input) {
 // Bind UI overrides to actual underlying facts, not merely the same month/token.
 const records=value=>Array.isArray(value?.value)?
  value.value.map(x=>[x?.id,x?.due,x?.amountCents,x?.status]):value?.value??null;
 return JSON.stringify([intelligencePremiumSignature(app),input?.snapshotVersion||'',
  input?.coverage||'',input?.asOf||'',input?.period?.from||'',input?.period?.to||'',
  input?.availableBalance?.sourceId||'',input?.availableBalance?.value??null,
  input?.safetyBufferCents??null,
  records(input?.unpaidFutureCommitments),records(input?.expectedIncome),
  records(input?.plannedOtherOutflow)]);
}
function mfB05ScenarioInput(app,input) {
 if(!input)return null;
 const st=app.state,valid=st.mfB05ScenarioSignature===mfB05ScenarioKey(app,input);
 if(!valid)return input;
 const cash=Number.isSafeInteger(st.mfB05ScenarioBalanceCents)&&st.mfB05ScenarioBalanceCents>=0?
  st.mfB05ScenarioBalanceCents:null;
 const margin=Number.isSafeInteger(st.mfB05ScenarioBufferCents)&&st.mfB05ScenarioBufferCents>=0?
  st.mfB05ScenarioBufferCents:null;
 return {...input,
  availableBalance:cash===null?input.availableBalance:{...input.availableBalance,value:cash},
  safetyBufferCents:margin===null?input.safetyBufferCents:margin};
}
function mfB05ScenarioSet(app,input,key,cents) {
 if(!Number.isSafeInteger(cents)||cents<0)return;
 app.setState({mfB05ScenarioSignature:mfB05ScenarioKey(app,input),[key]:cents});
}
function mfB05ContextDrawer(app,projection,point,originalInput) {
 const kind=app.state.mfB05DrawerKind;
 if(!kind||!projection.available||!point)return null;
 const titles={commitments:'Compromissos considerados',margin:'Margem de segurança',free:'Folga financeira',scenario:'Ajustar cenário'};
 const values={commitments:point.consideredCents,margin:point.protectedCents,free:point.freeCents};
 const close=()=>mfB05CloseDrawer(app);
 const items=projection.commitments.filter(c=>c.due<=point.date);
 return h('div',{className:'mf-b05-backdrop',onMouseDown:(e)=>{if(e.target===e.currentTarget)close();}},
  h('aside',{className:'mf-b05-drawer',role:'dialog','aria-modal':'true',
   'aria-label':titles[kind]||'Detalhamento da projeção',onKeyDown:(e)=>mfB05DrawerKeyboard(e,close)},
   h('header',{},h('span',{},'EVIDÊNCIAS · '+mfB05DateLabel(point.date)),
    h('button',{id:'mf-b05-drawer-close',type:'button',className:'ghost-button',onClick:close},'Fechar')),
   h('h2',{},titles[kind]||'Cenário'),
   kind!=='scenario'?h('strong',{className:'mf-b05-drawer-total'},mfB05Money(values[kind])):null,
   kind==='scenario'&&originalInput?h('div',{className:'mf-b05-scenario'},
    h('p',{},'Cenário hipotético da projeção verificada. Nenhum ajuste modifica conta, margem cadastrada ou SQLite.'),
    ...[{key:'mfB05ScenarioBalanceCents',label:'Saldo disponível hipotético',
         value:projection.availableBalanceCents,original:originalInput.availableBalance?.value},
        {key:'mfB05ScenarioBufferCents',label:'Margem protegida hipotética',
         value:projection.bufferCents===null?0:projection.bufferCents,
         original:originalInput.safetyBufferCents}].map(item=>h('div',{key:item.key,className:'mf-b05-scenario-field'},
     h('label',{htmlFor:'mf-b05-slider-'+item.key},item.label+' · '+mfB05Money(item.value)),
     h('input',{id:'mf-b05-slider-'+item.key,type:'range',min:0,
      max:Math.min(100000,Math.max(100,Math.ceil((Math.max(0,item.original||0)+100000)/100)*2)),
      value:Math.round(item.value/100),step:1,
      onChange:(e)=>mfB05ScenarioSet(app,originalInput,item.key,Number(e.target.value)*100)}))),
    h('button',{type:'button',className:'ghost-button',
     onClick:()=>app.setState({mfB05ScenarioSignature:null,mfB05ScenarioBalanceCents:null,mfB05ScenarioBufferCents:null})},
     'Restaurar premissas verificadas')):null,
   kind!=='scenario'?h('p',{},kind==='commitments'?'Compromissos futuros únicos com vencimento até o marco selecionado. Ainda não são pagamentos realizados.':
    kind==='margin'?'Valor protegido no cenário verificado; não representa dinheiro transferido.':
    'Valor disponível acima da margem no cenário. Não é uma economia já realizada.'):null,
   kind==='commitments'?h('ul',{className:'mf-b05-evidence-list'},
    ...items.map(c=>h('li',{key:c.id},h('span',{},c.description+' · '+mfB05DateLabel(c.due)),
      h('strong',{},mfB05Money(c.amountCents))))):null,
   h('small',{},'Fonte: '+projection.sourceId+' · cenário em '+projection.asOf),
   h('button',{type:'button',className:'primary-button',onClick:()=>{close();app.navigate('planning');}},'Abrir Planejamento')));
}

/* Lower diagnostics are never synthesized from unverified amounts.
 * Icon/hue always use the canonical D05 resolver when loaded. */
function mfB05CategoryBadge(categoryId,subcategoryId,categoryName) {
 if(typeof resolveCategoryVisualIdentity!=='function'||typeof CategoryVisualGlyph!=='function')
  return h(Icon,{name:'pie',size:18});
 const identity=resolveCategoryVisualIdentity({categoryId,subcategoryId,categoryName,
  aggregate:!subcategoryId});
 return h(CategoryVisualGlyph,{identity,size:22});
}
function mfB05BudgetDiagnostic(app,categoryId,categoryName,spent,limit,source) {
 const b=mfB05Budget(spent,limit);
 if(!b)return null;
 return h('article',{className:'mf-b05-diagnostic',role:'group','aria-label':'Orçamento de '+categoryName},
  h('header',{},mfB05CategoryBadge(categoryId,null,categoryName),
   h('div',{},h('small',{},'ORÇAMENTO'),h('h3',{},categoryName))),
  h('div',{className:'mf-b05-diagnostic-body'},
   h('div',{className:'mf-b05-mini-orbit',
    style:{'--mf-b05-mini-progress':Math.min(100,b.usagePercent||0)+'%'}},
    h('strong',{},b.usagePercent===null?'—':Math.round(b.usagePercent)+'%')),
   h('div',{},h('strong',{},mfB05Money(spent)),
    h('p',{},'de '+mfB05Money(limit)+(b.limitCents===0?' · limite explicitamente zero':'')),
    b.excessCents>0?h('p',{className:'mf-b05-negative'},'Acima do limite: '+mfB05Money(b.excessCents)):null)),
  h('small',{},'Fonte: '+String(source||'consulta autorizada')),
  h('button',{type:'button',className:'mf-b05-link',onClick:()=>app.navigate('budgets')},
   'Ver orçamento completo'));
}
function mfB05DeliveryEvidence(input) {
 if(!input||input.coverage!=='verified'||input.comparisons?.equalDays!==true||
   input.currentExpenses?.coverage!=='verified')return null;
 const c=input.comparisons,p=c.periodA,q=c.periodB;
 if(!p||!q||!mfB05IsoDate(p.from)||!mfB05IsoDate(p.to)||
   !mfB05IsoDate(q.from)||!mfB05IsoDate(q.to))return null;
 const days1=(Date.parse(p.to+'T12:00:00Z')-Date.parse(p.from+'T12:00:00Z'))/86400000,
  days2=(Date.parse(q.to+'T12:00:00Z')-Date.parse(q.from+'T12:00:00Z'))/86400000;
 if(days1<0||days1!==days2)return null;
 const found=Array.isArray(input.currentExpenses.value)&&input.currentExpenses.value.some(
  x=>x.categoryId==='sub:alimentacao/delivery'&&
   x.postedCents===c.deliveryCurrentCents&&x.periodStart===q.from&&x.periodEnd===q.to);
 if(!found)return null; // Equal comparison windows alone do not prove matching expense coverage.
 return mfB05Comparison(c.deliveryPreviousCents,c.deliveryCurrentCents,true);
}
function mfB05DeliveryDiagnostic(app,comparison) {
 if(!comparison)return null;
 const max=Math.max(1,comparison.previousCents,comparison.currentCents);
 return h('article',{className:'mf-b05-diagnostic',role:'group','aria-label':'Delivery — comparação equivalente'},
  h('header',{},mfB05CategoryBadge('cat:alimentacao','sub:alimentacao/delivery','Delivery'),
   h('div',{},h('small',{},'PERÍODOS EQUIVALENTES'),h('h3',{},'Delivery'))),
  h('div',{className:'mf-b05-delivery-bars'},
   ...[{label:'Anterior',cents:comparison.previousCents},
       {label:'Atual',cents:comparison.currentCents}].map(x=>
    h('div',{key:x.label,className:'mf-b05-delivery-row'},
     h('span',{},x.label),
     h('div',{className:'mf-b05-delivery-track'},
      h('i',{style:{width:(x.cents/max*100)+'%'}})),
     h('strong',{},mfB05Money(x.cents))))),
  h('p',{className:comparison.deltaCents>0?'mf-b05-amber':''},
   (comparison.deltaCents>0?'Aumento: ':'Variação: ')+mfB05Money(comparison.deltaCents)+
    (comparison.percent===null?'':' · '+comparison.percent.toFixed(1).replace('.',',')+'%')),
  h('button',{type:'button',className:'mf-b05-link',onClick:()=>mfB05ChangeMode(app,'actions')},
   'Examinar Plano de Ação'));
}
function renderMfB05Today(app,explicitVerifiedInput) {
 const s=app.state,signature=intelligencePremiumSignature(app),
  report=s.intelligencePremiumSignature===signature?s.intelligencePremiumReport:null,
  live=mfD03EligibleReport(report,app),
  signals=live?mfD03Signals(report,app):[],
  simulatedInput=mfB05ScenarioInput(app,explicitVerifiedInput),
  projection=simulatedInput?mfB05Project(simulatedInput):
   mfB05Unavailable('O contrato IC-READ atual não entrega saldo disponível e agenda reconciliada.');
 const selected=mfB05TodaySelected(app,projection);
 return h('section',{className:'mf-b05-today',role:'region','aria-label':'Pulso Financeiro'},
  h('div',{className:'mf-b05-editorial'},
   h('span',{className:'mf-b05-kicker'},'SEU PANORAMA · '+(s.localFinancialMonth||s.month||'PERÍODO ATUAL')),
   h('h2',{},'O mês ainda está em movimento.'),
   h('p',{},live?'Aqui estão sinais observados nos seus registros autorizados. Projeções futuras exigem informações adicionais verificadas.':
    'Conecte uma fonte autorizada para transformar registros em decisões com evidência.')),
  h('article',{className:'mf-b05-hero'},
   h('div',{className:'mf-b05-hero-copy'},
    h('small',{},projection.available?'PULSO FINANCEIRO · PROJEÇÃO VERIFICADA':'PULSO FINANCEIRO · DADOS A CONCILIAR'),
    h('h3',{},projection.available?'Seu dinheiro, com espaço para respirar.':'Um panorama claro, sem saldos inventados.'),
    h('p',{},projection.available?'Selecione os marcos para acompanhar compromissos, margem e folga no mesmo cenário.':
     'Temos prioridades e orçamento quando autorizados. A projeção de saldo depende de uma fonte que ainda não está disponível no serviço atual.'),
    projection.available&&projection.reserveSuggestionCents!==null?
     h('div',{className:'mf-b05-reserve-note'},h('span',{},'Reserva sugerida neste cenário'),
      h('strong',{},mfB05Money(projection.reserveSuggestionCents)),h('small',{},'Simulação · nada foi transferido')):null,
    h('div',{className:'mf-b05-hero-actions'},
     h('button',{type:'button',className:'primary-button',onClick:()=>mfB05ChangeMode(app,'chat')},'Conversar sobre meu cenário'),
     projection.available?h('button',{id:'mf-b05-adjust',type:'button',className:'ghost-button',
      onClick:()=>mfB05OpenDrawer(app,'scenario','mf-b05-adjust')},'Ajustar cenário'):null,
     h('button',{type:'button',className:'ghost-button',onClick:()=>void intelligencePremiumLoad(app),
      disabled:!!s.intelligencePremiumLoading},s.intelligencePremiumLoading?'Atualizando…':'Atualizar sinais'))),
   mfB05Ring(app,projection,selected)),
  mfB05Timeline(app,projection,selected),
  s.intelligencePremiumError?h('p',{role:'alert',className:'mf-ai-error'},s.intelligencePremiumError):null,
  h('div',{className:'mf-b05-signals-head'},h('h3',{},'Sinais que merecem atenção'),
   h('small',{},live?'Somente fatos da fonte autorizada':'Aguardando consulta e autorização')),
  h('div',{className:'mf-b05-signals'},
   ...(function(){
    const shown=[];
    if(explicitVerifiedInput?.coverage==='verified'&&
       explicitVerifiedInput.currentExpenses?.coverage==='verified'&&
       explicitVerifiedInput.budgets?.coverage==='verified'){
      const food=explicitVerifiedInput.currentExpenses.value?.find(
       x=>x.categoryId==='cat:alimentacao');
      const limit=explicitVerifiedInput.budgets.value?.find(
       x=>x.categoryId==='cat:alimentacao');
      if(food&&limit)shown.push(mfB05BudgetDiagnostic(app,'cat:alimentacao','Alimentação',
       food.postedCents,limit.limitCents,explicitVerifiedInput.budgets.sourceId));
    }
    const delivery=mfB05DeliveryEvidence(explicitVerifiedInput);
    if(delivery)shown.push(mfB05DeliveryDiagnostic(app,delivery));
    if(!shown.length)return signals.slice(0,2).map(signal=>mfD03SignalCard(app,signal));
    return shown;
   })(),
   !signals.length&&!mfB05DeliveryEvidence(explicitVerifiedInput)&&
    !(explicitVerifiedInput?.currentExpenses?.coverage==='verified'&&
      explicitVerifiedInput?.budgets?.coverage==='verified')?h('div',{className:'mf-b05-empty'},
    h('strong',{},live?'Nenhum alerta confirmado neste recorte.':'Ainda não há sinais disponíveis.'),
    h('p',{},live?'Ausência de alerta não garante ausência de despesas futuras.':
     'Use Permissões de consulta acima e atualize os dados para começar.'),
    h('button',{type:'button',className:'ghost-button',onClick:()=>app.navigate('budgets')},'Ver Orçamentos')):null),
  h('footer',{className:'mf-b05-footer'},
   h('span',{},'Da informação à decisão — sempre sob seu controle.'),
   h('button',{type:'button',className:'mf-b05-link',onClick:()=>mfB05ChangeMode(app,'actions')},'Explorar Plano de Ação')),
  mfB05ContextDrawer(app,projection,selected,explicitVerifiedInput),mfD03ContextDrawer(app));
}
