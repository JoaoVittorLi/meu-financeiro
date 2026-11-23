// QA-84 / B02 V7. Pure cents math + Electron React16 renderer. No financial writes on inspect.
type QA84BudgetMode='within'|'near'|'exceeded'|'zero'|'unlimited';
type QA84BudgetStatus={status:QA84BudgetMode;hasLimit:boolean;spent:number;limit:number|null;
 remaining:number|null;usedPercent:number|null;arcPercent:number};
type QA84BudgetPart={key:string;id:string;accountId:string|null;date:string;description:string;
 amount:number;category:string;categoryId:string|null;subcategoryId:string|null};
type QA84BudgetGroup={subcategoryId:string|null;total:number;count:number;rows:QA84BudgetPart[]};
type QA84BudgetDetails={groups:QA84BudgetGroup[];total:number;complete:boolean;gap:number;reason:string};
function qa84BudgetStatus(spent:number,limit:number|null,hasLimit:boolean):QA84BudgetStatus{
 const valid=Number.isSafeInteger(spent)&&spent>=0?spent:0;
 if(!hasLimit)return {status:'unlimited',hasLimit:false,spent:valid,limit:null,remaining:null,usedPercent:null,arcPercent:0};
 if(!Number.isSafeInteger(limit)||limit===null||limit<0)throw Error('Limite inválido');
 if(limit===0)return {status:'zero',hasLimit:true,spent:valid,limit:0,remaining:-valid,usedPercent:null,arcPercent:0};
 const ratio=valid/limit,percent=100*ratio;
 return {status:ratio>1?'exceeded':ratio>=.9?'near':'within',hasLimit:true,
  spent:valid,limit,remaining:limit-valid,usedPercent:percent,arcPercent:Math.min(100,percent)};
}
function qa84BudgetLegs(raw:any[],source:'bank'|'manual',start:string,end:string):QA84BudgetPart[]{
 const legs:QA84BudgetPart[]=[];
 for(const t of raw||[]){
  if(!t||typeof t.date!=='string'||t.date<start||t.date>end)continue;
  if(source==='bank'){
   if(t.status!=='POSTED')continue;
   const nature=t.nature&&t.nature!=='auto'?t.nature:t.amount<0?'expense':'income';
   if(nature!=='expense')continue;
   const amount=Math.abs(t.amount);
   if(!Number.isSafeInteger(amount)||amount<=0)continue;
   const splits=Array.isArray(t.splits)&&t.splits.length&&!t.splitOutdated?t.splits:null;
   const parts=splits||[{category:t.category,categoryId:t.categoryId||null,subcategoryId:t.subcategoryId||null,amount}];
   for(const [index,part] of parts.entries()){
    if(!Number.isSafeInteger(part.amount)||part.amount<=0)continue;
    legs.push({key:JSON.stringify([t.accountId,t.id,index]),id:String(t.id),
     accountId:String(t.accountId),date:t.date,
     description:String(t.customTitle||t.merchant||t.description||'Movimentação bancária'),amount:part.amount,
     category:String(part.category||t.category||''),categoryId:part.categoryId||null,
     subcategoryId:part.subcategoryId||null});
   }
  }else{
   if(t.kind!=='expense'||!Number.isSafeInteger(t.amount)||t.amount<=0)continue;
   legs.push({key:'manual|'+t.id,id:String(t.id),accountId:null,date:t.date,
    description:String(t.description||'Lançamento manual'),amount:t.amount,
    category:String(t.category||''),categoryId:t.categoryId||null,
    subcategoryId:t.subcategoryId||null});
  }
 }
 return legs;
}
/** Returns complete=false whenever the visible approved source cannot reconcile with authoritative parent cents. */
function qa84BudgetDetails(legs:QA84BudgetPart[],parentName:string,authoritativeCents:number,
 catalog:any[]=[],truncated:boolean=false):QA84BudgetDetails{
 const parent=resolveCategoryVisualIdentity({categoryName:parentName,catalog,aggregate:true});
 const grouped=new Map<string,QA84BudgetGroup>();
 let invalid=0;
 for(const leg of legs){
  const identity=resolveCategoryVisualIdentity({categoryId:leg.categoryId,
   subcategoryId:leg.subcategoryId,categoryName:leg.category,catalog,aggregate:true});
  if(identity.categoryId!==parent.categoryId||identity.parentLabel!==parent.parentLabel)continue;
  const validChild=leg.subcategoryId===null?null:
   resolveCategoryVisualIdentity({categoryId:leg.categoryId||parent.categoryId,
    subcategoryId:leg.subcategoryId,catalog});
  if(leg.subcategoryId&&!validChild?.subcategoryId){invalid++;continue;}
  const id=leg.subcategoryId||null,key=id||'__null__';
  const group=grouped.get(key)||{subcategoryId:id,total:0,count:0,rows:[]};
  group.total+=leg.amount;group.count++;group.rows.push(leg);grouped.set(key,group);
 }
 const groups=[...grouped.values()].sort((a,b)=>b.total-a.total||String(a.subcategoryId).localeCompare(String(b.subcategoryId)));
 const displayed=groups.reduce((n,g)=>n+g.total,0);
 const complete=!truncated&&!invalid&&Number.isSafeInteger(authoritativeCents)&&displayed===authoritativeCents;
 const reason=invalid?'Algumas classificações de subcategoria não correspondem à categoria principal.':
  truncated?'O histórico detalhado está incompleto.':
  displayed!==authoritativeCents?'O histórico detalhado não coincide com o total consolidado.':'';
 return {groups,total:displayed,complete,gap:authoritativeCents-displayed,reason};
}
function qa84Ring(value:number,tone:string,center:string,caption:string,size:'large'|'mini'='large'){
 const clamped=Math.max(0,Math.min(100,Number.isFinite(value)?value:0));
 return h('div',{className:'qa84-orbit qa84-orbit-'+size+' tone-'+tone,role:'img',
  'aria-label':caption,style:{'--qa84-arc':String(clamped)} as any},
  h('svg',{viewBox:'0 0 120 120',className:'qa84-orbit-svg','aria-hidden':'true',focusable:'false'},
   h('circle',{cx:60,cy:60,r:49,className:'qa84-orbit-track'}),
   h('circle',{cx:60,cy:60,r:49,className:'qa84-orbit-fill',pathLength:100,
    strokeDasharray:clamped+' 100',transform:'rotate(-90 60 60)'})),
  h('div',{className:'qa84-orbit-center'},
   h('strong',{},center),h('small',{},caption)));
}
function qa84BudgetOpen(host:any,categoryName:string,mode:string,useBank:boolean){
 const scroll=window.scrollY||0,month=host.state.month;
 host.setState({qa84BudgetDrill:{categoryName,mode,bank:useBank,month,subcategoryId:null,showChild:false,
  returnScroll:scroll},qa84BudgetLoading:true,qa84BudgetReadError:'',qa84BudgetPage:0,
  qa84BudgetShowAll:false,qa84BudgetRows:[],qa84BudgetPartial:true},()=>void qa84BudgetRefresh(host));
 document.scrollingElement?.scrollTo({top:0,left:0,behavior:'instant' as ScrollBehavior});
}
async function qa84BudgetRefresh(host:any){
 const drill=host.state.qa84BudgetDrill;
 if(!drill)return;
 const bridge=(window as any).financeDesktop||null;
 const currentKey=JSON.stringify([drill.categoryName,drill.month,drill.bank,host.state.mode]);
 const source=drill.bank?'bank':'manual';
 try{
  let result:any;
  if(drill.bank){
   if(!bridge?.d05BankList)throw Error('Consulta bancária hierárquica indisponível no processo principal.');
   result=await bridge.d05BankList({limit:2500});
  }else if(bridge?.d05ManualList){
   result=await bridge.d05ManualList({profile:host.state.mode,limit:2500});
  }else if(host.state.mode==='demo'){
   result={items:host.state.data.transactions,truncated:false};
  }else{
   throw Error('Consulta manual hierárquica indisponível no processo principal.');
  }
  if(!result||!Array.isArray(result.items))throw Error('Resposta de histórico inválida.');
  if(JSON.stringify([host.state.qa84BudgetDrill?.categoryName,host.state.qa84BudgetDrill?.month,
   host.state.qa84BudgetDrill?.bank,host.state.mode])!==currentKey)return;
  const legs=qa84BudgetLegs(result.items,source,firstOfMonth(drill.month),endOfMonth(drill.month));
  host.setState({qa84BudgetRows:legs,qa84BudgetPartial:!!result.truncated||result.status==='partial',
   qa84BudgetReadError:'',qa84BudgetLoading:false});
 }catch(e:any){
  if(JSON.stringify([host.state.qa84BudgetDrill?.categoryName,host.state.qa84BudgetDrill?.month,
   host.state.qa84BudgetDrill?.bank,host.state.mode])!==currentKey)return;
  host.setState({qa84BudgetRows:[],qa84BudgetPartial:true,
   qa84BudgetReadError:String(e?.message||e),qa84BudgetLoading:false});
 }
}
function qa84BudgetReturn(host:any,toCategory:boolean){
 const drill=host.state.qa84BudgetDrill;
 if(!drill)return;
 if(toCategory){host.setState({qa84BudgetDrill:{...drill,showChild:false,subcategoryId:null},qa84BudgetPage:0});
  document.scrollingElement?.scrollTo({top:0,left:0,behavior:'instant' as ScrollBehavior});}
 else{
  host.setState({qa84BudgetDrill:null,qa84BudgetRows:[],qa84BudgetPage:0},()=>{
   document.scrollingElement?.scrollTo({top:drill.returnScroll||0,left:0,behavior:'instant' as ScrollBehavior});
   const button=document.getElementById('qa84-card-'+encodeURIComponent(drill.categoryName));
   button?.focus({preventScroll:true});
  });
 }
}
function renderQA84BudgetCards(host:any,visible:any[],mode:string,total:number,bank:boolean,suggest:(name:string)=>number|null){
 return h('div',{className:'qa84-budgets-grid',role:'list', 'aria-label':'Orçamentos por categoria'},
  visible.map(({info,total:spent,hasLimit,limit,isMonthly}:any)=>{
   const identity=resolveCategoryVisualIdentity({categoryName:info.name,catalog:host.state.qa84VisualCatalog||[],aggregate:true});
   const model=qa84BudgetStatus(spent,limit??null,mode==='expense'&&hasLimit);
   const tone=model.status==='exceeded'?'exceeded':model.status==='near'?'near':
    model.status==='within'?'within':'neutral';
   const center=mode==='income'?'Receita':model.status==='unlimited'?'Sem limite':
    model.status==='zero'?fmt(spent):
    (model.remaining as number)<0?fmt(-(model.remaining as number)):fmt(model.remaining as number);
   const caption=mode==='income'?'Recebido':model.status==='exceeded'||model.status==='zero'&&spent>0?'Excedido':
    model.status==='unlimited'?'Não definido':model.status==='zero'?'Definido':'Restante';
   const pctLabel=model.usedPercent===null?model.status==='zero'?'Limite R$ 0':model.status==='unlimited'?'Sem limite':
    'Sem orçamento':model.usedPercent.toLocaleString('pt-BR',{maximumFractionDigits:1})+'% utilizado'+(isMonthly?' · mês':'');
   return h('button',{type:'button',role:'listitem',key:info.name,id:'qa84-card-'+encodeURIComponent(info.name),
    className:'qa84-budget-card tone-'+tone,'aria-label':info.name+' · '+pctLabel+
      ' · gasto '+fmt(spent)+(hasLimit?' · limite '+fmt(limit):' · sem limite'),
    onClick:()=>mode==='income'?(host.setState({txSource:bank?'bank':'manual',txKindFilter:'income',txCategoryFilter:info.name}),host.navigate('transactions')):
     qa84BudgetOpen(host,info.name,mode,bank)},
    h('div',{className:'qa84-budget-card-head'},
      h(CategoryVisualGlyph,{identity,size:22}),
      h('div',{},h('h3',{},info.name),h('small',{},pctLabel)),
      h('span',{className:'qa84-budget-chevron','aria-hidden':'true'},h(Icon,{name:'chevron-right',size:18}))),
    qa84Ring(model.arcPercent,tone,center,caption),
    h('div',{className:'qa84-budget-card-values'},
     h('div',{},h('small',{},mode==='income'?'Recebido':'Gasto'),h('strong',{},fmt(spent))),
     h('div',{},h('small',{},'Limite'),h('strong',{},hasLimit?fmt(limit):'Sem limite'))),
    hasLimit&&limit===0?h('p',{className:'qa84-budget-zero'},'Limite de R$ 0 definido'):null
   );
  }));
}
function renderQA84BudgetDetail(host:any,context:any){
 const drill=host.state.qa84BudgetDrill;
 if(!drill)return null;
 const rows=host.state.qa84BudgetRows||[],catalog=host.state.qa84VisualCatalog||[];
 const info=host.getCategories().find((c:any)=>c.name===drill.categoryName);
 const identity=resolveCategoryVisualIdentity({categoryName:drill.categoryName,catalog,aggregate:true});
 const authoritative=drill.bank?bankSnapshot(host.state.bank,drill.month):snapshot(host.state.data,drill.month);
 const total=drill.mode==='income'?authoritative.incomeCategories.find((c:any)=>c.name===drill.categoryName)?.total||0:
  authoritative.categories.find((c:any)=>c.name===drill.categoryName)?.total||0;
 const monthOverride=host.state.data?.monthlyBudgets?.[drill.month]||{};
 const hasLimit=Object.prototype.hasOwnProperty.call(monthOverride,drill.categoryName)||Object.prototype.hasOwnProperty.call(host.state.data.budgets,drill.categoryName);
 const limit=Object.prototype.hasOwnProperty.call(monthOverride,drill.categoryName)?monthOverride[drill.categoryName]:host.state.data.budgets[drill.categoryName];
 const isMonthlyOverride=Object.prototype.hasOwnProperty.call(monthOverride,drill.categoryName);
 const model=qa84BudgetStatus(total,limit??null,drill.mode==='expense'&&hasLimit);
 const tone=model.status==='exceeded'?'exceeded':model.status==='near'?'near':
  model.status==='within'?'within':'neutral';
 const details=qa84BudgetDetails(rows,drill.categoryName,total,catalog,!!host.state.qa84BudgetPartial);
 const page=Math.max(0,host.state.qa84BudgetPage||0);
 const selected=drill.subcategoryId===null?details.groups.find(g=>g.subcategoryId===null):
  details.groups.find(g=>g.subcategoryId===drill.subcategoryId);
 const childIdentity=drill.showChild&&drill.subcategoryId?
   resolveCategoryVisualIdentity({categoryId:identity.categoryId,subcategoryId:drill.subcategoryId,catalog}):null;
 const parent=drill.categoryName,hasChild=!!drill.showChild;
 const groupLabel=drill.subcategoryId===null?'Sem subcategoria':childIdentity?.label||'Subcategoria';
 const center=model.status==='unlimited'?'Sem limite':model.status==='zero'?fmt(total):
    (model.remaining as number)<0?fmt(-(model.remaining as number)):fmt(model.remaining as number);
 const contentTotal=hasChild?(selected?.total||0):total;
 const share=total>0?100*contentTotal/total:0;
 const openChild=(id:string|null)=>{
  host.setState({qa84BudgetDrill:{...drill,subcategoryId:id,showChild:true},qa84BudgetPage:0});
  document.scrollingElement?.scrollTo({top:0,left:0,behavior:'instant' as ScrollBehavior});
 };
 const pastSpending=Array.from({length:3},(_,i)=>{
  const priorMonth=shiftMonth(drill.month,-i-1);
  const prior=drill.bank?bankSnapshot(host.state.bank,priorMonth):snapshot(host.state.data,priorMonth);
  return prior.categories.find((c:any)=>c.name===parent)?.total||0;
 });
 const suggestedLimit=pastSpending.filter(v=>v>0).length>=2?
  Math.max(2000,Math.ceil(pastSpending.reduce((a,b)=>a+b,0)/3*1.1/1000)*1000):null;
 const openEdit=(suggested=false)=>{
  if(suggested&&suggestedLimit===null)return;
  host.setState({editModal:{type:'budget',key:parent,title:suggested?'Limite sugerido · '+parent:hasLimit?'Editar limite · '+parent:'Definir limite · '+parent,
   value:suggested?moneyString(suggestedLimit as number):hasLimit?moneyString(limit):''}});
 };

 const partial=host.state.qa84BudgetLoading||host.state.qa84BudgetReadError||!details.complete;
 return h('div',{className:'qa84-budget-detail section'},
  h('nav',{className:'qa84-crumbs','aria-label':'Caminho de orçamento'},
   h('button',{type:'button',onClick:()=>qa84BudgetReturn(host,false)},'Orçamentos'),
   h(Icon,{name:'chevron-right',size:13}),
   hasChild?h('button',{type:'button',onClick:()=>qa84BudgetReturn(host,true)},parent):h('strong',{},parent),
   hasChild?h(Icon,{name:'chevron-right',size:13}):null,
   hasChild?h('strong',{},groupLabel):null),
  h('section',{className:'qa84-budget-hero'},
   h('div',{className:'qa84-budget-hero-head'},h(CategoryVisualGlyph,{identity:hasChild&&childIdentity?childIdentity:identity,size:23,variant:'iconLabel'}),
    h('span',{},prettyMonth(drill.month)+' · '+(drill.bank?'Contas conectadas':'Adicionado por você'))),
   h('div',{className:'qa84-budget-hero-body'},
    hasChild?qa84Ring(share,'participation',share.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%','do gasto da categoria'):
     qa84Ring(model.arcPercent,tone,center,model.status==='exceeded'||model.status==='zero'&&total>0?'Excedido':model.status==='unlimited'?'Não definido':'Restante'),
    h('div',{className:'qa84-budget-hero-copy'},
     h('h1',{},hasChild?groupLabel:parent),
     h('strong',{},fmt(contentTotal)),
     h('p',{},hasChild?'Participação no gasto da categoria principal. Não é um orçamento separado.':
      model.status==='unlimited'?'Esta categoria ainda não possui limite.':
      model.status==='zero'?'Limite zero definido explicitamente.':
      model.usedPercent!.toLocaleString('pt-BR',{maximumFractionDigits:1})+'% do limite utilizado.'),
     !hasChild?h('div',{className:'qa84-budget-hero-financial'},
      h('div',{},h('small',{},'Gasto'),h('b',{},fmt(total))),
      h('div',{},h('small',{},'Limite'),h('b',{},hasLimit?fmt(limit):'Sem limite')),
      h('div',{},h('small',{},model.remaining!==null&&model.remaining<0?'Excedido':'Restante'),
        h('b',{},model.remaining===null?'—':fmt(Math.abs(model.remaining))))):null,
     !hasChild?h('div',{className:'qa84-budget-edit-actions'},
      h('button',{type:'button',onClick:()=>openEdit(false)},hasLimit?'Editar limite':'Definir limite'),
      h('button',{type:'button',disabled:suggestedLimit===null,
       title:suggestedLimit===null?'Sugestão exige gastos em pelo menos dois dos três meses anteriores':'Sugestão não é aplicada sem sua confirmação',
       onClick:()=>openEdit(true)},'Sugerir limite')):null))),
  host.state.qa84BudgetLoading?h('div',{className:'qa84-budget-loading',role:'status'},
   'Carregando detalhamento autorizado…',h('div',{className:'qa84-skeleton','aria-hidden':'true'},
    h('i',{}),h('i',{}),h('i',{}))):null,
  host.state.qa84BudgetReadError?h('div',{className:'qa84-budget-error',role:'alert'},
   h('p',{},host.state.qa84BudgetReadError),
   h('button',{type:'button',onClick:()=>void qa84BudgetRefresh(host)},'Tentar novamente')):null,
  !host.state.qa84BudgetLoading&&!host.state.qa84BudgetReadError&&!details.complete?h('p',{className:'qa84-budget-partial',role:'status'},
   details.reason+' Total do orçamento: '+fmt(total)+'. Movimentações detalhadas disponíveis: '+fmt(details.total)+
   '. Não apresentamos percentuais como completos até a conciliação.'):null,
  !hasChild?h('section',{className:'qa84-subcategories'},
   h('div',{className:'qa84-budget-section-heading'},h('div',{},h('h2',{},'Onde você gastou'),
    h('p',{},'Participação por subcategoria. Os mini-anéis não representam limites próprios.')),
    h('button',{type:'button',onClick:()=>host.setState({qa84BudgetShowAll:!host.state.qa84BudgetShowAll})},
     host.state.qa84BudgetShowAll?'Mostrar só com gasto':'Mostrar todas')),
   details.complete?h('div',{className:'qa84-category-share-strip','aria-label':'Distribuição real por subcategoria'},
    details.groups.filter(g=>g.total>0).map(g=>{
     const id=g.subcategoryId;
     const visual=id?resolveCategoryVisualIdentity({categoryId:identity.categoryId,subcategoryId:id,catalog}):
       resolveCategoryVisualIdentity({categoryId:identity.categoryId,catalog});
     return h('button',{type:'button',key:id||'__none__',
      style:{width:(total>0?g.total/total*100:0)+'%','--qa-cat-hue':visual.hue} as any,
      'aria-label':(id?visual.label:'Sem subcategoria')+' · '+fmt(g.total),
      onClick:()=>openChild(id)});
    })):null,
   h('div',{className:'qa84-subcategory-grid'},
    (()=>{
     const approved=D05_APPROVED_PARENTS.find((p:any)=>p.id===identity.categoryId);
     const candidates=(catalog.find((p:any)=>p.id===identity.categoryId)||approved)?.subcategories||[];
     const listed=details.groups.slice();
     if(host.state.qa84BudgetShowAll&&details.complete){
      for(const child of candidates)if(!listed.some(g=>g.subcategoryId===child.id))
       listed.push({subcategoryId:child.id,total:0,count:0,rows:[]});
     }
     if(details.complete&&total===0&&!listed.length&&host.state.qa84BudgetShowAll) {
      for(const child of candidates)listed.push({subcategoryId:child.id,total:0,count:0,rows:[]});
     }
     return listed.filter(g=>host.state.qa84BudgetShowAll||g.total>0).map(g=>{
      const visual=g.subcategoryId?resolveCategoryVisualIdentity({categoryId:identity.categoryId,
       subcategoryId:g.subcategoryId,catalog}):resolveCategoryVisualIdentity({categoryId:identity.categoryId,catalog});
      const name=g.subcategoryId?visual.label:'Sem subcategoria',percent=total>0?100*g.total/total:0;
      return h('button',{type:'button',key:g.subcategoryId||'__none__',className:'qa84-subcategory-card',
       onClick:()=>openChild(g.subcategoryId)},
       h(CategoryVisualGlyph,{identity:visual,size:20}),
       h('div',{className:'qa84-subcategory-card-copy'},
        h('strong',{},name),h('small',{},g.count+' movimentação(ões)'),h('b',{},fmt(g.total))),
       details.complete?qa84Ring(percent,'participation',percent.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%','dos gastos','mini'):
        qa84Ring(0,'neutral','—','dados parciais','mini'));
     });
    })()
   ),
   details.complete&&details.groups.length===0?h('p',{},'Nenhuma despesa nesta categoria e período.'):null
  ):h('section',{className:'qa84-subcategory-history'},
   h('h2',{},'Histórico da subcategoria'),
   !details.complete?h('p',{className:'qa84-budget-partial'},'Histórico parcial: a conciliação com a categoria principal ainda não foi concluída.'):null,
   h('div',{className:'qa84-history-list'},
    (selected?.rows||[]).slice(page*25,(page+1)*25).map(t=>h('div',{className:'qa84-history-row',key:t.key},
     h('div',{},h('strong',{},t.description),h('small',{},t.date.split('-').reverse().join('/')+
       ' · ID '+t.id+(t.accountId?' · Conta '+t.accountId:''))),
     h('strong',{},fmt(t.amount))))),
   !selected?.rows?.length?h('p',{className:'qa84-budget-empty'},'Nenhuma movimentação registrada nesta subcategoria no período.'):null,
   (selected?.rows?.length||0)>25?h('div',{className:'qa84-history-pagination'},
     h('button',{type:'button',disabled:page===0,onClick:()=>host.setState({qa84BudgetPage:page-1})},'Anterior'),
     h('span',{},'Página '+(page+1)+' de '+Math.ceil((selected?.rows.length||0)/25)),
     h('button',{type:'button',disabled:(page+1)*25>=selected.rows.length,
       onClick:()=>host.setState({qa84BudgetPage:page+1})},'Próxima')):null
  ),
  drill.bank&&(!host.state.bank.data.last?.completedAt||Date.now()-Date.parse(host.state.bank.data.last.completedAt)>48*3600000)?
   h('p',{className:'qa84-budget-partial',role:'status'},'A última atualização bancária pode estar desatualizada. Data informada: '+
    (host.state.bank.data.last?.completedAt?new Date(host.state.bank.data.last.completedAt).toLocaleString('pt-BR'):'não disponível')):null,
  host.state.qa84BudgetPartial?h('p',{className:'qa84-budget-partial'},
   'Alguns registros bancários antigos podem não constar da janela carregada.'):null);
}
