// QA-84 / B01 V3 — the real Overview category distribution; source totals come from existing snapshot.
type QA84ExpenseCategory={name:string;total:number};
type QA84DistributionRow={name:string;total:number;units:number;percent:number;isRemainder:boolean};
type QA84Distribution={status:'ok'|'empty'|'inconsistent';total:number;rows:QA84DistributionRow[];classified:number};
function qa84ExpenseDistribution(categories:QA84ExpenseCategory[],expenseCents:number):QA84Distribution{
 const total=Number.isSafeInteger(expenseCents)&&expenseCents>=0?expenseCents:0;
 const rows=(categories||[]).filter(x=>x&&typeof x.name==='string'&&
  Number.isSafeInteger(x.total)&&x.total>0).map(x=>({name:x.name,total:x.total,isRemainder:false}));
 const sum=rows.reduce((n,x)=>n+x.total,0);
 if(!total)return {status:sum?'inconsistent':'empty',total,rows:[],classified:sum};
 if(sum>total)return {status:'inconsistent',total,rows:[],classified:sum};
 if(sum<total)rows.push({name:'Sem categoria identificada',total:total-sum,isRemainder:true});
 // Largest remainder allocation produces EXACTLY 1000 tenths of a percentage point.
 const fractional=rows.map((row,i)=>({...row,i,raw:1000*row.total/total,units:Math.floor(1000*row.total/total)}));
 let remaining=1000-fractional.reduce((n,r)=>n+r.units,0);
 const ranked=fractional.slice().sort((a,b)=>(b.raw-b.units)-(a.raw-a.units)||a.i-b.i);
 for(let i=0;i<remaining;i++)ranked[i%ranked.length].units++;
 const out=fractional.map(({name,total:amount,isRemainder,units})=>({name,total:amount,isRemainder,units,percent:units/10}));
 return {status:'ok',total,rows:out,classified:sum};
}
function renderQA84OverviewCategories(host:any,categories:QA84ExpenseCategory[],totalCents:number,bankSource:boolean,hidden:boolean){
 const state=host.state,model=qa84ExpenseDistribution(categories,totalCents);
 if(model.status==='empty')return h('p',{className:'u1-empty'},'Nenhuma despesa nesta fonte e período.');
 if(model.status==='inconsistent')return h('p',{className:'qa84-data-warning',role:'alert'},
   'Os totais de categorias não coincidem com o total de despesas. Distribuição suspensa até atualização dos dados.');
 const ranked=model.rows.slice().sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'pt-BR'));
 const all=!!state.qa84OverviewExpanded,shown=all?ranked:ranked.slice(0,5);
 const max=Math.max(1,...ranked.map(x=>x.total));
 const catalog=state.qa84VisualCatalog||[];
 const visual=(row:QA84DistributionRow)=>row.isRemainder?
   resolveCategoryVisualIdentity({categoryName:row.name}):
   resolveCategoryVisualIdentity({categoryName:row.name,catalog,aggregate:true});
 const selected=state.qa84OverviewSelected||null;
 const pick=(row:QA84DistributionRow)=>host.setState({qa84OverviewSelected:selected===row.name?null:row.name});
 const toTransactions=(name:string)=>{
   if(name==='Sem categoria identificada')return;
   const span=dateSpan(state.overviewPeriod,state.customStart,state.customEnd);
   host.setState({query:'',bankFilter:'',txSource:bankSource?'bank':'manual',txReviewOnly:false,
    txOrganize:false,txCategoryFilter:name,qa84TransactionsSpan:span,qa84TransactionsCategory:name});
   host.navigate('transactions');
 };
 return h('div',{className:'qa84-overview-breakdown',role:'region','aria-label':'Distribuição real dos gastos'},
  hidden?h('div',{className:'qa84-dist-masked',role:'status'},'Distribuição oculta para proteger seus valores'):
  h('div',{className:'qa84-distribution','aria-label':'Faixa de distribuição por categoria'},
   ranked.map(row=>{
    const identity=visual(row);
    return h('button',{key:row.name,type:'button',className:'qa84-distribution-segment'+(selected===row.name?' is-selected':''),
     style:{width:row.percent+'%','--qa-cat-hue':identity.hue} as any,
     'aria-label':row.name+' · '+row.percent.toFixed(1)+'% · '+fmt(row.total),
     'aria-pressed':selected===row.name,title:row.name+' · '+row.percent.toFixed(1)+'%',
     onClick:()=>pick(row)},
     h('span',{className:'qa84-sr-only'},row.name));
  })),
  h('div',{className:'qa84-distribution-list'},
   shown.map(row=>{
    const identity=visual(row),active=selected===row.name;
    return h('button',{type:'button',key:row.name,
     className:'qa84-category-row'+(active?' is-selected':''),
     style:{'--qa-cat-hue':identity.hue} as any,
     'aria-pressed':active,'aria-label':row.name+(hidden?' · valores ocultos':' · '+fmt(row.total)+' · '+row.percent.toFixed(1)+'%'),
     onClick:()=>pick(row)},
     h('span',{className:'qa84-category-name-cell'},
      h(CategoryVisualGlyph,{identity,size:19}),h('span',{className:'qa84-category-name'},row.name)),
     h('span',{className:'qa84-category-track','aria-hidden':'true'},
      h('i',{style:{width:hidden?'0%':(row.total/max*100)+'%'}})),
     h('strong',{className:'qa84-category-money'},hidden?'••••':fmt(row.total)),
     h('small',{className:'qa84-category-percent'},hidden?'••••':row.percent.toFixed(1)+'%'));
   })
  ),
  selected?h('div',{className:'qa84-breakdown-selection',role:'status'},
    h('span',{},'Selecionada: '+selected),
    selected!=='Sem categoria identificada'?h('button',{type:'button',
     onClick:()=>toTransactions(selected)},'Ver movimentações',h(Icon,{name:'arrow',size:13})):null):null,
  ranked.length>5?h('button',{type:'button',className:'qa84-breakdown-toggle',
    'aria-expanded':all,onClick:()=>host.setState({qa84OverviewExpanded:!all})},
    all?'Mostrar menos categorias':'Mostrar todas as '+ranked.length+' categorias',
    h(Icon,{name:all?'chevron-up':'chevron-down',size:14})):null,
  model.classified<totalCents?h('p',{className:'qa84-breakdown-note',role:'status'},
    'Existe valor sem categoria identificada. Ele está incluído na distribuição, sem criar classificação nova.'):null);
}
