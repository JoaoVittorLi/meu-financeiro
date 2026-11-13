/* INT-DESIGN-01 C2 — approved VR-07 Treemap and VR-08 Money Flow.
 * Only signed, read-only, reconciled, single-source facts can render graphics.
 * The visual contract is additive to the existing IC-READ/radar query;
 * if the adapter has no provenance/coverage, show a table/partial state.
 */
type MfVisualMovement={id:string;date:string;description:string;amountCents:number};
type MfVisualCategory={
 name:string;amountCents:number;movementCount:number;
 movements:MfVisualMovement[];detailsPartial:boolean
};
type MfVisualSnapshot={
 kind:'treemap'|'sankey';source:'bank'|'manual';profile:'real'|'demo';
 period:string;coverage:'partial_local'|'unknown'|'complete_local';
 incomeCents:number;expenseCents:number;netCents:number;
 categories:MfVisualCategory[];state:'ready'|'empty'|'partial';reason:string;
};
type MfVisualRect={name:string;x:number;y:number;w:number;h:number;amountCents:number};
const MF_VISUAL_COLORS=['#60b8a6','#f4b560','#7ca3e9','#b48ee7','#ed8995','#9bc86e','#c6a470','#80b6ce'];
function mfVisualMoney(cents:number):string{
 return Number.isSafeInteger(cents)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100):'—';
}
function mfVisualRequested(question:string):'treemap'|'sankey'|null{
 const q=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/para onde (?:foi|vai) (?:minha |meu |a )?(?:renda|dinheiro)|fluxo de (?:dinheiro|renda)|sankey|distribuicao da renda/.test(q))return 'sankey';
 if(/treemap|mapa de (?:gastos|despesas|categorias)|distribuicao (?:dos |de )?gastos|despesas por categoria/.test(q))return 'treemap';
 return null;
}
function mfVisualFromOperational(o:any,kind:'treemap'|'sankey'):MfVisualSnapshot|null{
 if(!o||o.contract!=='IC-v1/I-P0.2-read-only'||o.readOnly!==true||
  o.changesApplied!==false||o.modelCalled!==false||
  !['bank','manual'].includes(o.source)||!['real','demo'].includes(o.profile))return null;
 const f=o.facts,p=o.period?.start;
 if(!f||f.visualSource!=='finance-period-ledger-v1'||typeof p!=='string'||
  !/^\d{4}-\d{2}-\d{2}$/.test(p))return null;
 if(![f.incomeCents,f.expenseCents,f.netCents].every(Number.isSafeInteger)||
  f.incomeCents<0||f.expenseCents<0||f.netCents!==f.incomeCents-f.expenseCents)return null;
 if(!Array.isArray(f.expenseCategories)||f.expenseCategories.length>10000)return null;
 const seen=new Set<string>();let sum=0;
 const categories:MfVisualCategory[]=[];
 for(const item of f.expenseCategories){
  if(!item||typeof item.name!=='string'||!item.name.trim()||seen.has(item.name)||
   !Number.isSafeInteger(item.amountCents)||item.amountCents<=0||
   !Number.isSafeInteger(item.movementCount)||item.movementCount<1||
   !Array.isArray(item.movements)||item.movements.length>20)return null;
  seen.add(item.name);
  sum+=item.amountCents;
  if(!Number.isSafeInteger(sum))return null;
  const movements:MfVisualMovement[]=[];
  for(const m of item.movements){
   if(!m||typeof m.id!=='string'||typeof m.date!=='string'||
    !/^\d{4}-\d{2}-\d{2}$/.test(m.date)||typeof m.description!=='string'||
    !Number.isSafeInteger(m.amountCents)||m.amountCents<=0)return null;
   movements.push({id:m.id.slice(0,100),date:m.date,description:m.description.slice(0,120),amountCents:m.amountCents});
  }
  if(movements.length>item.movementCount)return null;
  const partial=!!item.detailsPartial||movements.length<item.movementCount;
  if(!partial&&movements.reduce((n,m)=>n+m.amountCents,0)!==item.amountCents)return null;
  categories.push({name:item.name,amountCents:item.amountCents,movementCount:item.movementCount,
   movements,detailsPartial:partial});
 }
 if(sum!==f.expenseCents)return null;
 categories.sort((a,b)=>b.amountCents-a.amountCents||a.name.localeCompare(b.name,'pt-BR'));
 const coverage=o.coverage==='partial_local'?'partial_local':o.coverage==='complete_local'?'complete_local':'unknown';
 const cannotShowSankey=kind==='sankey'&&(f.incomeCents===0||f.netCents<0);
 const state: MfVisualSnapshot['state']=f.expenseCents===0?'empty':cannotShowSankey?'partial':'ready';
 const reason=cannotShowSankey?
  'Neste período as despesas excederam as entradas, ou não houve receita. Não é possível desenhar um fluxo de saída de renda sem criar números fictícios.':
  coverage==='partial_local'?'Histórico parcial: números proporcionais apenas aos registros locais carregados.':
  coverage==='unknown'?'A origem local foi reconciliada no período, mas a cobertura do extrato completo não está certificada.':'Valores reconciliados no período.';
 return {kind,source:o.source,profile:o.profile,period:p.slice(0,7),coverage,
   incomeCents:f.incomeCents,expenseCents:f.expenseCents,netCents:f.netCents,
   categories,state,reason};
}
function mfVisualRects(cats:MfVisualCategory[],x=0,y=0,w=100,h=100):MfVisualRect[]{
 if(!cats.length)return[];
 if(cats.length===1)return [{name:cats[0].name,x,y,w,h,amountCents:cats[0].amountCents}];
 const total=cats.reduce((sum,c)=>sum+c.amountCents,0);
 let split=1,part=cats[0].amountCents;
 while(split<cats.length-1&&part<total/2){part+=cats[split].amountCents;split++;}
 const frac=part/total;
 if(w>=h)return [...mfVisualRects(cats.slice(0,split),x,y,w*frac,h),
  ...mfVisualRects(cats.slice(split),x+w*frac,y,w*(1-frac),h)];
 return [...mfVisualRects(cats.slice(0,split),x,y,w,h*frac),
  ...mfVisualRects(cats.slice(split),x,y+h*frac,w,h*(1-frac))];
}
function mfVisualSelected(app:any,messageId:string,data:MfVisualSnapshot):string{
 const active=app.state.mfVisualSelection;
 return active?.messageId===messageId&&(data.categories.some(c=>c.name===active.name)||
  (data.kind==='sankey'&&data.netCents>0&&active.name==='__result__'))?active.name:(data.categories[0]?.name||'');
}
function mfVisualChoose(app:any,messageId:string,name:string):void{
 app.setState({mfVisualSelection:{messageId,name}});
}
function mfVisualOpenTransactions(app:any,name:string,month:string,source:'bank'|'manual'):void{
 app.navigate('transactions');
 if(typeof app.setSharedMonth==='function')app.setSharedMonth(month);
 app.setState({txSource:source,txCategoryFilter:name,txKindFilter:'expense',txReviewOnly:false,
  txSelected:[],query:''});
}
function mfVisualMonthBefore(month:string):string{
 const m=/^(20\d{2})-(0[1-9]|1[0-2])$/.exec(month);
 if(!m)return '';
 const year=Number(m[1]),mo=Number(m[2]);return (mo===1?year-1:year)+'-'+String(mo===1?12:mo-1).padStart(2,'0');
}
async function mfVisualComparePrevious(app:any,messageId:string,current:MfVisualSnapshot,name:string):Promise<void>{
 const token=app.state.localFinancialAccess?.token;
 const prev=mfVisualMonthBefore(current.period);
 const api=desktop as any;
 if(!token||!prev||!api?.intelligenceOperationalAsk)return;
 const signature=intelligencePremiumSignature(app),request=(app.__mfVisualRequest||0)+1;
 app.__mfVisualRequest=request;
 app.setState({mfVisualCompare:{messageId,name,status:'loading'}});
 try{
  const r=await api.intelligenceOperationalAsk({month:prev,token,question:'Radar financeiro'});
  const prior=mfVisualFromOperational(r,'treemap');
  if(request!==app.__mfVisualRequest||signature!==intelligencePremiumSignature(app)||
    app.state.localFinancialAccess?.token!==token)return;
  if(!prior||prior.source!==current.source||prior.profile!==current.profile||
   prior.period!==prev||prior.coverage==='partial_local'){
   app.setState({mfVisualCompare:{messageId,name,status:'partial'}});return;
  }
  const before=prior.categories.find(c=>c.name===name)?.amountCents||0;
  const now=current.categories.find(c=>c.name===name)?.amountCents||0;
  app.setState({mfVisualCompare:{messageId,name,status:'ready',before,now,prev}});
 }catch{
  if(request===app.__mfVisualRequest)app.setState({mfVisualCompare:{messageId,name,status:'error'}});
 }
}
function mfVisualRibbon(x1:number,x2:number,top1:number,top2:number,height:number):string{
 const bend=(x2-x1)*.46;
 return 'M'+x1+' '+top1+' C'+(x1+bend)+' '+top1+' '+(x2-bend)+' '+top2+' '+x2+' '+top2+
   ' L'+x2+' '+(top2+height)+' C'+(x2-bend)+' '+(top2+height)+' '+(x1+bend)+' '+(top1+height)+' '+x1+' '+(top1+height)+' Z';
}
function renderMfVisual(app:any,msg:IntelligenceChatMessage):any{
 const data: MfVisualSnapshot=msg.visual as any;
 if(!data)return null;
 const selected=mfVisualSelected(app,msg.id,data),active=data.categories.find(c=>c.name===selected);
 const total=data.expenseCents;
 const resultSelected=selected==='__result__';
 const detailOpen=app.state.mfVisualDetailsOpen?.messageId===msg.id&&app.state.mfVisualDetailsOpen?.name===selected;
 const compact=app.state.intelligencePanelOpen===true;
 const compare=app.state.mfVisualCompare?.messageId===msg.id&&app.state.mfVisualCompare?.name===selected?app.state.mfVisualCompare:null;
 const tone=(index:number)=>MF_VISUAL_COLORS[index%MF_VISUAL_COLORS.length];
 const open=(name:string)=>mfVisualChoose(app,msg.id,name);
 const legend=h('div',{className:'mf-vr-legend',role:'list','aria-label':'Categorias incluídas no período'},
  ...data.categories.map((c,i)=>h('button',{type:'button',role:'listitem',className:'mf-vr-legend-item '+(c.name===selected?'is-selected':''),
    key:c.name,'aria-pressed':c.name===selected,onClick:()=>open(c.name)},
   h('span',{className:'mf-vr-dot',style:{backgroundColor:tone(i)},'aria-hidden':'true'}),
   h('span',{className:'mf-vr-legend-title'},c.name),
   h('strong',{},mfVisualMoney(c.amountCents)+' · '+(total?((c.amountCents/total)*100).toFixed(1):'0')+'%'))));
 let graphic:any=null;
 if(data.state==='ready'&&data.kind==='treemap'){
  const rects=mfVisualRects(data.categories);
  graphic=h('div',{className:'mf-vr-treemap',role:'group','aria-label':'Treemap com área proporcional aos gastos'},
   ...rects.map(rect=>{
    const i=data.categories.findIndex(c=>c.name===rect.name);
    return h('button',{type:'button',key:rect.name,className:'mf-vr-tile '+(rect.name===selected?'is-selected':''),
     title:rect.name+' · '+mfVisualMoney(rect.amountCents),onClick:()=>open(rect.name),
     'aria-label':rect.name+' · '+mfVisualMoney(rect.amountCents),
     style:{left:rect.x+'%',top:rect.y+'%',width:rect.w+'%',height:rect.h+'%',
      '--mf-vr-color':tone(i)}},
     rect.w>=17&&rect.h>=19?h('span',{},rect.name):null,
     rect.w>=20&&rect.h>=25?h('strong',{},mfVisualMoney(rect.amountCents)):null);
   }));
 }
 if(data.state==='ready'&&data.kind==='sankey'){
  const hTotal=190,scale=hTotal/data.incomeCents;
  const eHeight=data.expenseCents*scale,nHeight=data.netCents*scale;
  let current=25;
  graphic=h('div',{className:'mf-vr-flow-wrap'},
   h('svg',{className:'mf-vr-flow',viewBox:'0 0 900 258',role:'img','aria-label':'Receitas distribuídas em despesas por categoria e resultado do período'},
    h('rect',{x:20,y:25,width:26,height:hTotal,rx:6,fill:'#6b8fa9'}),
    h('path',{d:mfVisualRibbon(46,320,25,25,eHeight),fill:'#d98b7e',opacity:.55}),
    nHeight>0?h('g',{role:'button',tabIndex:0,'aria-label':'Resultado do período '+mfVisualMoney(data.netCents),
      onClick:()=>open('__result__'),onKeyDown:(e:any)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open('__result__');}}},
      h('path',{d:mfVisualRibbon(46,710,25+eHeight,25+eHeight,nHeight),fill:'#53d896',opacity:resultSelected?1:.67})):null,
    h('rect',{x:320,y:25,width:24,height:eHeight,rx:5,fill:'#d98b7e'}),
    ...data.categories.map((c,i)=>{
     const height=c.amountCents*scale,top=current;current+=height;
     return h('g',{key:c.name,role:'button',tabIndex:0,'aria-label':c.name+' '+mfVisualMoney(c.amountCents),
      onClick:()=>open(c.name),onKeyDown:(e:any)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(c.name);}}},
      h('path',{className:'mf-vr-flow-ribbon '+(c.name===selected?'is-selected':''),
       d:mfVisualRibbon(344,710,top,top,height),fill:tone(i),opacity:c.name===selected?.9:.55}),
      h('rect',{x:710,y:top,width:24,height:height,fill:tone(i)}));
    }),
    nHeight>0?h('rect',{x:710,y:25+eHeight,width:24,height:nHeight,fill:'#53d896'}):null,
    h('text',{x:20,y:15,fill:'currentColor'},'Receitas'),
    h('text',{x:320,y:15,fill:'currentColor'},'Despesas'),
    h('text',{x:710,y:15,fill:'currentColor'},'Categorias / resultado')));
 }
 return h('section',{className:'mf-vr-card mf-vr-'+data.kind+(compact?' is-compact':''),role:'region',
  'aria-label':data.kind==='treemap'?'Distribuição dos gastos por categoria':'Fluxo de dinheiro reconciliado'},
  h('header',{className:'mf-vr-head'},h('div',{},
   h('small',{},data.period+' · '+(data.source==='bank'?'Banco':'Manual')+' · '+(data.coverage==='partial_local'?'Histórico parcial':'Registros locais')),
   h('h3',{},data.kind==='treemap'?'Para onde foram os gastos':'Para onde foi a renda?')),
   h('strong',{},mfVisualMoney(data.kind==='treemap'?data.expenseCents:data.incomeCents))),
  data.kind==='sankey'?h('div',{className:'mf-vr-totals'},
   h('span',{},'Receitas '+mfVisualMoney(data.incomeCents)),
   h('span',{},'Despesas '+mfVisualMoney(data.expenseCents)),
   h('button',{type:'button',className:'mf-vr-result-action',disabled:data.netCents<=0,
     'aria-pressed':resultSelected,onClick:()=>open('__result__')},'Resultado do período '+mfVisualMoney(data.netCents))):null,
  h('p',{className:'mf-vr-cover',role:data.state==='partial'?'alert':'note'},data.reason),
  data.state==='empty'?h('p',{className:'mf-vr-empty'},'Não existem despesas reconciliadas para esse período.'):null,
  graphic,
  data.categories.length?legend:null,
  active?h('div',{className:'mf-vr-inspector'},
   h('strong',{},active.name),
   h('p',{},mfVisualMoney(active.amountCents)+' · '+((active.amountCents/data.expenseCents)*100).toFixed(1)+'% das despesas · '+active.movementCount+' movimentação(ões) considerada(s)'),
   detailOpen?h('div',{className:'mf-vr-details',role:'region','aria-label':'Movimentações de '+active.name},
     h('strong',{},'Movimentações de '+active.name),
     h('ul',{},...active.movements.map(m=>h('li',{key:m.id+'-'+m.date},m.date+' · '+m.description+' · '+mfVisualMoney(m.amountCents)))),
     active.detailsPartial?h('p',{role:'status'},'Amostra parcial: '+active.movements.length+' de '+active.movementCount+' registros.'):null,
     active.detailsPartial?h('button',{type:'button',onClick:()=>mfVisualOpenTransactions(app,active.name,data.period,data.source)},'Abrir histórico completo'):null):null,
   h('div',{className:'mf-vr-actions'},
    h('button',{type:'button','aria-expanded':!!detailOpen,
      onClick:()=>app.setState({mfVisualDetailsOpen:detailOpen?null:{messageId:msg.id,name:active.name}})},
      detailOpen?'Ocultar movimentações':'Ver movimentações'),
    h('button',{type:'button',disabled:!app.state.localFinancialAccess?.token,
      onClick:()=>void mfVisualComparePrevious(app,msg.id,data,active.name)},'Comparar mês anterior')),
   compare?h('p',{role:'status'},compare.status==='ready'?
    'Anterior '+mfVisualMoney(compare.before)+' · atual '+mfVisualMoney(compare.now)+' · diferença '+mfVisualMoney(compare.now-compare.before):
     compare.status==='loading'?'Consultando mês anterior…':
      'Não há uma comparação completa e autorizada disponível.'):null):null,
  resultSelected?h('p',{className:'mf-vr-result-note',role:'status'},
   'Resultado do período: '+mfVisualMoney(data.netCents)+'. Isso representa receitas menos despesas efetivas do período; não é o saldo disponível da conta.'):null,
  h('details',{className:'mf-vr-table'},h('summary',{},'Tabela acessível · '+data.categories.length+' categorias'),
   h('table',{},h('thead',{},h('tr',{},h('th',{},'Categoria'),h('th',{},'Despesas'),h('th',{},'Participação'))),
    h('tbody',{},...data.categories.map(c=>h('tr',{key:c.name},
     h('td',{},c.name),h('td',{},mfVisualMoney(c.amountCents)),
     h('td',{},((c.amountCents/(data.expenseCents||1))*100).toFixed(1)+'%')))))));
}
