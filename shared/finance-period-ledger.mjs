// Deterministic period ledger shared by the Windows / Cloudflare codebase.
// Preview read models use it without altering local bank records or balances.
// IMPORTANT: one source at a time. Never sum bank + manual histories by default.
const iso=/^\d{4}-\d{2}-\d{2}$/;
function validDate(d) {
  if(typeof d!=='string'||!iso.test(d))throw new Error('Data do período inválida.');
  const t=Date.parse(d+'T00:00:00.000Z');
  if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==d)throw new Error('Data impossível.');
  return t;
}
function cents(v) {
  if(!Number.isSafeInteger(v)||Math.abs(v)>100_000_000_000)throw new Error('Centavos inválidos.');
  return v;
}
function add(map,key,amount){map.set(key,(map.get(key)||0)+amount);}
function category(value){return typeof value==='string'&&value.trim()?value:'A classificar';}
function sortCategories(map){return [...map].map(([name,amountCents])=>({name,amountCents})).sort((a,b)=>b.amountCents-a.amountCents||a.name.localeCompare(b.name,'pt-BR'));}
export function aggregateFinancePeriod(rows,{start,end,source}){
  if(!Array.isArray(rows)||rows.length>100000||!['bank','manual'].includes(source))
    throw new Error('Fonte financeira inválida.');
  const first=validDate(start),last=validDate(end);
  if(last<first||(last-first)/86400000>730)throw new Error('Intervalo financeiro inválido.');
  let incomeCents=0,expenseCents=0,count=0,excluded=0,unclassifiedCents=0;
  const daily=new Map(),outCategories=new Map(),inCategories=new Map();
  for(const row of rows){
    if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Registro financeiro inválido.');
    const dt=validDate(row.date);
    if(dt<first||dt>last)continue;
    let nature,amount;
    if(source==='bank'){
      if(row.status!=='POSTED'){excluded++;continue;}
      amount=Math.abs(cents(row.amountCents));
      nature=row.nature==='auto'||row.nature==null?
        (row.amountCents>=0?'income':'expense'):row.nature;
      if(!['income','expense','transfer','ignore'].includes(nature))throw new Error('Natureza inválida.');
      if(nature==='transfer'||nature==='ignore'){excluded++;continue;}
    }else{
      if(!['income','expense'].includes(row.kind))throw new Error('Tipo manual inválido.');
      amount=cents(row.amountCents);
      if(amount<=0)throw new Error('Lançamento manual inválido.');
      nature=row.kind;
    }
    if(!amount){excluded++;continue;}
    let today=daily.get(row.date);
    if(!today){today={date:row.date,incomeCents:0,expenseCents:0};daily.set(row.date,today);}
    count++;
    if(nature==='income'){
      incomeCents+=amount;today.incomeCents+=amount;
      add(inCategories,category(row.category),amount);
      if(!row.category)unclassifiedCents+=amount;
    }else{
      expenseCents+=amount;today.expenseCents+=amount;
      const chunks=source==='bank'&&Array.isArray(row.splits)&&row.splits.length?
        row.splits:null;
      const validSplit=chunks&&chunks.every(p=>
        typeof p.category==='string'&&p.category&&Number.isSafeInteger(p.amountCents)&&p.amountCents>0)&&
        chunks.reduce((acc,p)=>acc+p.amountCents,0)===amount;
      if(validSplit){
        for(const p of chunks)add(outCategories,p.category,p.amountCents);
      }else{
        add(outCategories,category(row.category),amount);
        if(!row.category)unclassifiedCents+=amount;
      }
    }
  }
  return {
    source,start,end,transactionsIncluded:count,excluded,
    incomeCents,expenseCents,netCents:incomeCents-expenseCents,
    unclassifiedCents,categoryCoverageComplete:unclassifiedCents===0,
    daily:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),
    expenses:sortCategories(outCategories),incomes:sortCategories(inCategories)
  };
}
export function cashflowBuckets(daily,start,end,bins=7){
  const first=validDate(start),last=validDate(end);
  const days=Math.round((last-first)/86400000)+1;
  if(days<1||days>731||!Number.isInteger(bins)||bins<1||bins>31)
    throw new Error('Período de gráfico inválido.');
  const count=Math.min(bins,days);
  const map=new Map(daily.map(d=>[d.date,d]));
  const stamp=i=>new Date(first+i*86400000).toISOString().slice(0,10);
  return Array.from({length:count},(_,i)=>{
    const a=Math.floor(i*days/count),b=Math.floor((i+1)*days/count)-1;
    let incomeCents=0,expenseCents=0;
    for(let j=a;j<=b;j++){
      const d=map.get(stamp(j));
      incomeCents+=d?.incomeCents||0;expenseCents+=d?.expenseCents||0;
    }
    return {start:stamp(a),end:stamp(b),incomeCents,expenseCents};
  });
}
export function budgetProgress(budgets,expenses){
  if(!Array.isArray(budgets)||!Array.isArray(expenses))throw new Error('Orçamento inválido.');
  const spent=new Map(expenses.map(x=>[x.name,x.amountCents]));
  return budgets.map(item=>{
    const limitCents=cents(item.amountCents);
    if(limitCents<0||typeof item.category!=='string'||!item.category)throw new Error('Limite inválido.');
    const spentCents=spent.get(item.category)||0;
    return {category:item.category,limitCents,spentCents,
      pct:limitCents>0?Math.round(100*spentCents/limitCents):null};
  });
}
