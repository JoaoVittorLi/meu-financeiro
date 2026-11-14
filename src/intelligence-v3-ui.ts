/* INT-DESIGN-02 — shared D02 response surface: one primary, 26 registry families.
 * No model HTML, numeric inventions or personal write endpoints. */
function mfV3Mode(app:any,msg:IntelligenceChatMessage):MfV3Density{
 return app.state.mfV3AnalysisMessageId===msg.id?'analysis':app.state.intelligencePanelOpen?'compact':'standard';
}
function mfV3Table(headers:string[],rows:string[][]){
 return h('div',{className:'mf-v3-scroll'},h('table',{},
  h('thead',{},h('tr',{},...headers.map(x=>h('th',{key:x},x)))),
  h('tbody',{},...rows.map((row,i)=>h('tr',{key:i},...row.map((cell,j)=>h('td',{key:j},cell)))))));
}
function mfV3Bar(label:string,value:string,pct:number,color:string,onClick:any){
 return h('button',{type:'button',className:'mf-v3-bar',onClick},
  h('div',{className:'mf-v3-bar-head'},h('span',{},label),h('strong',{},value)),
  h('div',{className:'mf-v3-track'},h('span',{style:{width:Math.max(0,Math.min(100,pct||0))+'%',background:color}})));
}
function mfV3Live(app:any,d:MfV3Card):boolean{
 const a:LocalFinancialAccess=app.state.localFinancialAccess;
 const month=app.state.localFinancialMonth||app.state.month;
 return !!a?.token&&mfV3MatchesGrant(d,a,intelligencePremiumSignature(app))&&
   Number.isFinite(a.expiresAt)&&a.expiresAt>Date.now()&&
   a.source===d.source&&a.profile===d.profile&&month===d.period&&
   app.state.mode===d.profile;
}
function mfV3Render(app:any,msg:IntelligenceChatMessage):any{
 const d:MfV3Card=msg.visualV3 as MfV3Card;
 if(!d||!mfV3Allowed(d.kind))return null;
 if(!mfV3Live(app,d))return h('section',{className:'mf-v3-card state-stale',role:'alert',
   'aria-label':'Análise local desatualizada'},
   h('strong',{},'Atualize esta consulta para visualizar os números.'),
   h('p',{},'A autorização, fonte, perfil ou período mudou ou expirou. Abra Permissões de consulta e execute novamente a pergunta.'),
   h('small',{},'Nenhum dado antigo será exibido nem alterado.'));
 const mode=mfV3Mode(app,msg),kind=d.kind,compact=mode==='compact',analysis=mode==='analysis';
 const cap=analysis?100:compact?5:12;
 const money=mfV3Money;
 const action=(label:string,fn:any,disabled=false)=>h('button',{type:'button',className:'mf-v3-action',disabled,onClick:fn},label);
 const expand=()=>app.setState({mfV3AnalysisMessageId:analysis?null:msg.id});
 const info=(text:string)=>h('p',{className:'mf-v3-info',role:'status'},text);
 const missing=(text:string)=>h('div',{className:'mf-v3-missing',role:'status'},h('strong',{},text),info(d.reason));
 const kpi=(label:string,cents:number,tone='')=>h('div',{className:'mf-v3-kpi '+tone},h('small',{},label),h('strong',{},money(cents)));
 const cats=d.categories;
 const choose=(name:string)=>app.setState({mfV3Selected:{messageId:msg.id,name}});
 const selected=app.state.mfV3Selected?.messageId===msg.id?
  cats.find(x=>x.name===app.state.mfV3Selected.name):null;
 const legend=h('div',{className:'mf-v3-legend'},...cats.slice(0,cap).map((c,i)=>
  action(c.name+' · '+money(c.amountCents),()=>choose(c.name))));
 let view:any=null;
 if(kind==='treemap'||kind==='sankey'){
  view=renderMfVisual(app,{...msg,visual:{...d.original,kind}});
 }else if(kind==='summary'){
  view=h('div',{className:'mf-v3-stack'},
   h('div',{className:'mf-v3-kpis'},kpi('Entradas',d.incomeCents,'positive'),
     kpi('Despesas',d.expenseCents,'negative'),kpi('Resultado do mês',d.netCents,d.netCents>=0?'positive':'negative')),
   cats.length?legend:info('Nenhuma categoria de despesa registrada.'),
   action('Explorar categorias',expand));
 }else if(kind==='kpi'){
  const cat=selected||cats[0];
  view=h('div',{className:'mf-v3-highlight'},h('span',{},cat?cat.name:'Despesas efetivas'),
   h('strong',{},money(cat?cat.amountCents:d.expenseCents)),legend);
 }else if(kind==='compare'||kind==='trend'||kind==='rank'){
  if(!d.previous||d.quality==='partial')view=missing('Comparação sem cobertura verificável');
  else {
   const rows=mfV3Heat(mfV3CompareRows(d));
   if(kind==='compare')view=h('div',{className:'mf-v3-stack'},
     h('div',{className:'mf-v3-kpis'},kpi(d.previous.period,d.previous.expenseCents),kpi(d.period,d.expenseCents),
       kpi('Diferença',mfV3Delta(d.expenseCents,d.previous.expenseCents))),
     info(mfV3Pct(d.expenseCents,d.previous.expenseCents)===null?
       'Base zero: taxa percentual omitida; diferença em reais preservada.':
       'Variação '+mfV3Pct(d.expenseCents,d.previous.expenseCents).toFixed(1)+'%'),
     action('Explorar diferenças por categoria',expand),analysis?mfV3DeltaList(app,msg,rows):null);
   else if(kind==='trend')view=h('div',{className:'mf-v3-stack'},
     info('Somente dois meses estão disponíveis: comparação factual, não tendência de longo prazo.'),
     h('div',{className:'mf-v3-kpis'},kpi(d.previous.period,d.previous.expenseCents),kpi(d.period,d.expenseCents)),
     mfV3DeltaList(app,msg,rows.slice(0,cap)));
   else{
    const sort=app.state.mfV3Sort?.messageId===msg.id?app.state.mfV3Sort.mode:'absolute';
    const rowsPositive=rows.filter(r=>r.delta>0).sort((a,b)=>sort==='relative'?
      (b.relative??-Infinity)-(a.relative??-Infinity)||b.delta-a.delta:b.delta-a.delta);
    const max=rowsPositive.reduce((m,r)=>Math.max(m,r.delta),1);
    view=h('div',{className:'mf-v3-stack'},
      h('div',{className:'mf-v3-toolbar'},
       action('Impacto em R$',()=>app.setState({mfV3Sort:{messageId:msg.id,mode:'absolute'}})),
       action('Crescimento %',()=>app.setState({mfV3Sort:{messageId:msg.id,mode:'relative'}}))),
      info('Cores de calor representam a magnitude dos aumentos de despesas, nunca saldos ou receitas.'),
      ...rowsPositive.slice(0,cap).map(r=>mfV3Bar(r.name,money(r.delta)+' · '+
        (r.relative===null?'base zero':r.relative.toFixed(1)+'%'),
        r.delta/max*100,r.heat,()=>choose(r.name))),
      rowsPositive.length===0?info('Nenhum aumento confirmado.'):null,
      rows.filter(r=>r.delta<=0).length? h('div',{className:'mf-v3-neutral'},
       action(app.state.mfV3ShowNeutral===msg.id?'Ocultar sem aumento':'Mostrar sem aumento',
         ()=>app.setState({mfV3ShowNeutral:app.state.mfV3ShowNeutral===msg.id?null:msg.id})),
       app.state.mfV3ShowNeutral===msg.id?rows.filter(r=>r.delta<=0).map(r=>
         mfV3Bar(r.name,money(r.delta),0,'var(--muted)',()=>choose(r.name))):null):null);
   }
  }
 }else if(kind==='bar'){
  const max=Math.max(1,...cats.map(c=>c.amountCents));
  view=h('div',{className:'mf-v3-stack'},...cats.slice(0,cap).map(c=>
   mfV3Bar(c.name,money(c.amountCents),c.amountCents/max*100,'var(--green)',()=>choose(c.name))),
   cats.length>cap?info('Mostrando '+cap+' de '+cats.length+' categorias; explore a análise para ver todas.'):null);
 }else if(kind==='donut'){
  if(!d.expenseCents)view=missing('Distribuição sem despesas confirmadas');
  else{
   let offset=0;
   const slices=cats.map((c,i)=>{const first=offset;offset+=c.amountCents/d.expenseCents*100;
    return MF_VISUAL_COLORS[i%MF_VISUAL_COLORS.length]+' '+first.toFixed(5)+'% '+offset.toFixed(5)+'%';});
   view=h('div',{className:'mf-v3-donut-wrap'},
    h('div',{className:'mf-v3-donut',role:'img','aria-label':'Rosca de distribuição; valores disponíveis na lista',
     style:{background:'conic-gradient('+slices.join(',')+')'}},h('span',{},money(d.expenseCents))),legend);
  }
 }else if(kind==='drilldown'){
  const current=app.state.mfV3Drill?.messageId===msg.id?app.state.mfV3Drill:{};
  const cat=cats.find(c=>c.name===current.category)||cats[0];
  const write=(patch:any)=>app.setState({mfV3Drill:{messageId:msg.id,...current,...patch}});
  const groups=cat?[...new Set(cat.movements.map(m=>m.description))]:[];
  const rows=cat?cat.movements.filter(m=>(!current.group||m.description===current.group)&&
      (!current.search||m.description.toLowerCase().includes(String(current.search).toLowerCase())))
    .sort((a,b)=>current.sort==='amount'?b.amountCents-a.amountCents:b.date.localeCompare(a.date)):[];
  view=h('div',{className:'mf-v3-stack'},
   h('div',{className:'mf-v3-crumb'},
    action('Categorias',()=>write({category:null,group:null,search:''})),
    current.category?info(' / '+current.category):null,current.group?info(' / '+current.group):null),
   !current.category?cats.slice(0,cap).map(c=>action(c.name+' · '+money(c.amountCents),()=>write({category:c.name,group:null}))):null,
   current.category?h('div',{className:'mf-v3-stack'},
    info((cat.detailsPartial?'Amostra parcial. ':'')+'Agrupamento por descrição; não atribui estabelecimento automaticamente.'),
    h('label',{},'Buscar descrição',h('input',{type:'search',value:current.search||'',
      onChange:(e:any)=>write({search:e.target.value})})),
    !current.group?groups.map(g=>action(g,()=>write({group:g}))):action('Voltar aos grupos',()=>write({group:null})),
    h('div',{className:'mf-v3-toolbar'},action('Recentes',()=>write({sort:'date'})),action('Maior valor',()=>write({sort:'amount'}))),
    mfV3Table(['Data','Registro','Valor'],rows.slice(0,cap).map(r=>[r.date,r.description,money(r.amountCents)]))):null);
 }else if(kind==='table'||kind==='report'){
  const rows=mfV3Records(d);
  const query=app.state.mfV3Search?.messageId===msg.id?app.state.mfV3Search.value:'';
  const order=app.state.mfV3TableOrder?.messageId===msg.id?app.state.mfV3TableOrder.order:'date';
  const list=rows.filter(r=>(r.description+' '+r.category).toLowerCase().includes(String(query).toLowerCase()))
   .sort((a,b)=>order==='amount'?b.amountCents-a.amountCents:b.date.localeCompare(a.date));
  view=h('div',{className:'mf-v3-stack'},
    h('label',{},'Pesquisar registros',h('input',{type:'search',value:query,
      onChange:(e:any)=>app.setState({mfV3Search:{messageId:msg.id,value:e.target.value}})})),
    h('div',{className:'mf-v3-toolbar'},
      action('Mais recentes',()=>app.setState({mfV3TableOrder:{messageId:msg.id,order:'date'}})),
      action('Maior gasto',()=>app.setState({mfV3TableOrder:{messageId:msg.id,order:'amount'}}))),
    info((mfV3RecordsPartial(d)?'Amostra parcial; ':'')+'Tabela dos registros locais verificados. Nenhum arquivo foi gerado.'),
    mfV3Table(['Data','Categoria / descrição','Valor'],list.slice(0,cap).map(r=>[r.date,r.category+' · '+r.description,money(r.amountCents)])),
    list.length>cap?action('Mostrar mais registros',expand):null);
 }else if(kind==='budget'){
  view=d.budgets.length?h('div',{className:'mf-v3-stack'},...d.budgets.slice(0,cap).map(b=>
   h('div',{className:'mf-v3-budget',key:b.category},
    h('div',{className:'mf-v3-bar-head'},h('strong',{},b.category),h('span',{},money(b.spentCents)+' / '+money(b.limitCents))),
    b.limitCents>0?h('div',{className:'mf-v3-track'},
      h('span',{style:{width:Math.min(100,b.spentCents/b.limitCents*100)+'%',background:'var(--red)'}})):null,
    h('small',{},b.limitCents===0?'Limite zero definido'+(b.spentCents?' · excedido em '+money(b.spentCents):''):
      b.spentCents>b.limitCents?'Excedido em '+money(b.spentCents-b.limitCents):
      'Restam '+money(b.limitCents-b.spentCents))))):missing('Limites financeiros indisponíveis neste período');
 }else if(kind==='cashflow'){
  view=h('div',{className:'mf-v3-stack'},
   h('div',{className:'mf-v3-kpis'},kpi('Receitas do período',d.incomeCents),
     kpi('Despesas do período',d.expenseCents),kpi('Resultado do período',d.netCents)),
   info('Resultado mensal observado, não saldo bancário, nem projeção futura.'));
 }else if(kind==='insight'){
  const c=cats[0];
  view=c?h('div',{className:'mf-v3-stack'},
    h('strong',{},'Maior participação: '+c.name),
    h('p',{},money(c.amountCents)+' · '+(100*c.amountCents/d.expenseCents).toFixed(1)+'% das despesas locais.'),
    info('Concentração observada não demonstra desperdício ou causalidade.'),
    action('Examinar categorias',expand)):missing('Sem despesas para identificar concentrações');
 }else if(kind==='plan'){
  view=h('div',{className:'mf-v3-stack'},info('Etapas sugeridas para conferência, não ações realizadas.'),
    h('ol',{},h('li',{},'Verificar lançamentos.'),h('li',{},'Rever limites.'),
      h('li',{},'Simular propostas no módulo próprio.')),
    action('Abrir Planejamento',()=>app.navigate('planning')));
 }else if(kind==='quality'){
  view=h('div',{className:'mf-v3-stack'},
   info('Origem '+d.source+' · '+d.period+' · cobertura '+d.coverage+
      ' · data da leitura '+(d.asOf||'não informada')),
   info(mfV3RecordsPartial(d)?'Algumas categorias têm apenas uma amostra de transações.':
    'Registros por categoria localmente conciliados; cobertura bancária integral não certificada.'));
 }else if(kind==='proposal'){
  view=msg.proposal?renderMfD01Proposal(app,msg.proposal):missing('Nenhuma proposta autorizada nesta conversa');
 }else if(kind==='whatif'||kind==='scenario'){
  view=h('div',{className:'mf-v3-stack'},
   info('Simulações precisam do motor original com premissas, compromissos e fluxo diário. Nenhum resultado foi calculado aqui.'),
   action('Abrir Simular Compra',()=>app.navigate('simulator')));
 }else if(kind==='approval'){
  view=missing('Sem recibo durável de operação confirmada');
 }else if(kind==='state'){
  view=missing(d.quality==='ready'?'Consulta somente de leitura disponível':'Consulta indisponível ou incompleta');
 }else{
  view=missing('Dados financeiros verificáveis ainda não disponíveis para esta família');
 }
 const detail=selected&&['bar','donut','rank'].includes(kind)?
  h('div',{className:'mf-v3-selection',role:'region','aria-label':'Detalhes selecionados'},
    h('strong',{},selected.name),
    h('p',{},money(selected.amountCents)+' de '+money(d.expenseCents)+' em '+d.period),
    kind==='rank'&&d.previous?h('p',{},'Antes '+money(d.previous.categories.find(c=>c.name===selected.name)?.amountCents||0)+
      ' · agora '+money(selected.amountCents)+' · variação '+
      money(selected.amountCents-(d.previous.categories.find(c=>c.name===selected.name)?.amountCents||0))):null,
    h('details',{},h('summary',{},'Ver movimentações'+(selected.detailsPartial?' · amostra parcial':'')),
      mfV3Table(['Data','Descrição','Valor'],selected.movements.map(m=>[m.date,m.description,money(m.amountCents)])))):null;
 return h('section',{className:'mf-v3-card mf-v3-'+kind+' mf-v3-'+mode+' state-'+d.quality,role:'region',
  'aria-label':mfV3Title(kind)+' · '+d.period},
  h('header',{className:'mf-v3-head'},
   h('div',{},h('small',{},d.period+' · '+(d.source==='bank'?'Banco':'Manual')),h('h3',{},mfV3Title(kind))),
   !compact?action(analysis?'Recolher análise':'Explorar análise',expand,['unavailable','expired','denied'].includes(d.quality)):null),
  h('p',{className:'mf-v3-evidence',role:d.quality==='partial'?'status':'note'},d.reason),
  view,detail,
  h('details',{className:'mf-v3-evidence-more'},h('summary',{},'Fonte e limitações'),
    h('p',{},'Origem: '+d.source+' · perfil '+d.profile+' · '+d.period+' · cobertura '+d.coverage+
      ' · atualizado '+(d.asOf||'sem horário registrado'))));
}
function mfV3DeltaList(app:any,msg:IntelligenceChatMessage,rows:any[]){
 const max=Math.max(1,...rows.filter(r=>r.delta>0).map(r=>r.delta));
 return h('div',{className:'mf-v3-stack'},...rows.map(r=>mfV3Bar(r.name,
   mfV3Money(r.delta)+(r.relative===null?'':' · '+r.relative.toFixed(1)+'%'),
   r.delta>0?r.delta/max*100:0,r.delta>0?r.heat:'var(--muted)',
   ()=>app.setState({mfV3Selected:{messageId:msg.id,name:r.name}}))));
}
