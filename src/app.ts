/* Meu Financeiro v0.3 — React UI, offline, deterministic calculations.
 * All cash amounts are stored in integer cents. Demo and personal data are isolated.
 */
declare const React: any;
declare const ReactDOM: any;
const h: any = React.createElement;

type Kind = 'income' | 'expense';
type Tx = { id:string; date:string; description:string; kind:Kind; amount:number; category:string; origin?:string };
type Settings = { opening:number; income:number; fixed:number; existing:number; reserve:number };
type Data = { version:number; transactions:Tx[]; budgets:{[category:string]:number}; settings:Settings };
type Sim = { value:string; installments:string; interest:string; firstDueDate?:string };
type BankConfig = {configured:boolean;clientId:string;itemIds:string[];secure:boolean};
type BankAccount = {id:string;itemId:string;name:string;subtype:string;currency:string;balance:number|null;updatedAt:string};
type BankTx = {id:string;accountId:string;accountName:string;date:string;description:string;amount:number;status:string;category:string;categorySource?:string;merchant?:string;note?:string;nature?:'auto'|'income'|'expense'|'transfer'|'ignore';reviewed?:boolean;reviewedAt?:string|null;linkedManualId?:string|null;splits?:{category:string;amount:number}[];splitOutdated?:boolean;customTitle?:string};
type PlanItem = {id:string;groupId:string|null;groupType:string;occurrence:number;totalOccurrences:number;title:string;kind:Kind;amount:number;dueDate:string;category:string;accountId:string|null;notes:string;certainty:'confirmed'|'estimated';status:string;remaining:number;paid:number;overpaid?:number;effectiveStatus:string;links:{accountId:string;externalId:string;date:string;description:string;amount:number;status:string}[]};
type PlanSuggestion = {itemId:string;accountId:string;externalId:string;date:string;description:string;amount:number;accountName:string;score:number};
type PlanDay = {date:string;opening:number;incoming:number;outgoing:number;closing:number;items:{id:string;title:string;kind:Kind;amount:number;overdue:boolean}[]};
type PlanOverview = {items:PlanItem[];suggestions:PlanSuggestion[];timeline?:{month:string;rows:(PlanDay & {phase?:'projection'|'estimated_history'})[];historicalNotice:string|null};projection:{anchor:number;source:string;anchorDate:string;asOf:string|null;reference?:{quality:string;observedAt:string|null;missingBalances:number;totalAccounts:number;observationAgeHours:number|null};includeEstimatedIncome:boolean;rows:PlanDay[];minimum:number;negativeDays:string[];uncertainIncomeExcluded:number};bankTitles:{accountId:string;externalId:string;title:string}[];generatedAt:string};
const EMPTY_PLANNING:PlanOverview={items:[],suggestions:[],projection:{anchor:0,source:'manual',anchorDate:'',asOf:null,includeEstimatedIncome:false,rows:[],minimum:0,negativeDays:[],uncertainIncomeExcluded:0},bankTitles:[],generatedAt:''};
type PlanForm = {id:string;title:string;kind:Kind;amount:string;dueDate:string;category:string;accountId:string;notes:string;certainty:'confirmed'|'estimated';mode:'once'|'monthly'|'weekly'|'yearly'|'installments';count:string};
function freshPlanForm(kind:Kind='expense',day:string=iso(new Date())):PlanForm {return {id:'',title:'',kind,amount:'',dueDate:day,category:kind==='income'?'Salário':'Outros',accountId:'',notes:'',certainty:'confirmed',mode:'once',count:'12'};}
type DetailSelection = {origin:'bank'|'manual';id:string;accountId?:string}|null;
type DetailDraft = {merchant:string;note:string;nature:'auto'|'income'|'expense'|'transfer'|'ignore';reviewed:boolean;aliasPattern:string;splitParts:{category:string;value:string}[]};
type CategoryInfo = {name:string;color:string;emoji:string;builtIn:number};
type RuleInfo = {id:number;pattern:string;matchMode:'contains'|'starts'|'exact';category:string;scope:'both'|'bank'|'manual';priority:number;enabled:number};
type CategoryEditor = {previousName:string;name:string;color:string;emoji:string};
type RuleEditor = {id:number|null;pattern:string;matchMode:'contains'|'starts'|'exact';category:string;scope:'both'|'bank'|'manual';priority:string};
type BankState = {config:BankConfig;data:{accounts:BankAccount[];transactions:BankTx[];items:{itemId:string;institution:string;status:string;consentExpiresAt:string|null;lastSyncAt:string|null}[];last:{completedAt:string;newCount:number;totalCount:number}|null;totalTransactions?:number;truncated?:boolean;aliases?:{id:number;pattern:string;displayName:string}[];dailyTotals?:{date:string;income:number;expense:number;categories:{name:string;total:number}[]}[];suspectedDuplicates?:{pairKey:string;accountIdA:string;externalIdA:string;accountIdB:string;externalIdB:string;description:string;amount:number;date:string;accountName:string}[]}};
const EMPTY_BANK:BankState={config:{configured:false,clientId:'',itemIds:[],secure:false},data:{accounts:[],transactions:[],items:[],last:null}};
type State = { fatal?:string; booting?:boolean; mode:'real'|'demo'; data:Data; page:string; month:string; showEntry:boolean; entry:{date:string;description:string;kind:Kind;category:string;value:string}; sim:Sim; outcome:any; query:string; toast:string; budgetEdit:string; busy:boolean; editModal:null|{type:'budget'|'setting';key:string;title:string;value:string};bank:BankState;bankForm:{clientId:string;clientSecret:string;itemIds:string};bankBusy:boolean;bankMessage:string;bankFilter:string;txSource:'all'|'bank'|'manual';txReviewOnly:boolean;txOrganize:boolean;categoryMoreEmojis:boolean;quickAddOpen:boolean;dashboardSource:'bank'|'manual';
 categories:CategoryInfo[];rules:RuleInfo[];categoryEditor:CategoryEditor;ruleEditor:RuleEditor;ruleTest:string;categoryMessage:string;entryCategoryTouched:boolean;bankConfigOpen:boolean;overviewPeriod:PeriodMode;customStart:string;customEnd:string;backupInfo:{copies:number;last:string|null};detail:DetailSelection;detailDraft:DetailDraft;detailBusy:boolean;txSelected:string[];txBatchCategory:string; planning:PlanOverview;planMonth:string;planDay:string;planSelected:string|null;planOpen:boolean;planForm:PlanForm;planBusy:boolean;planView:string;planTerm:string;planIncludeEstimated:boolean;planBankTitle:string;planMatchQuery:string;planHistory:{action:string;details:string;at:string}[] };
// Bridge com o processo principal Electron. No preview web, mantém o armazenamento legado.
interface DesktopBridge {load:(mode:'real'|'demo')=>Promise<Data|null>;save:(mode:'real'|'demo',data:Data)=>Promise<any>;info:()=>Promise<any>;backupSQLite:()=>Promise<{cancelled?:boolean;ok?:boolean}>;restoreSQLite:()=>Promise<{cancelled?:boolean;ok?:boolean}>;backupStatus:()=>Promise<{copies:number;last:string|null}>;openBackupsFolder:()=>Promise<string>;openDataFolder:()=>Promise<string>;bankStatus:()=>Promise<BankState>;bankConfigure:(c:any)=>Promise<BankState>;bankSync:()=>Promise<BankState & {newCount:number;totalCount:number}>;bankForget:()=>Promise<BankState>;categoriesStatus:()=>Promise<{categories:CategoryInfo[];rules:RuleInfo[]}>;
 categorySave:(input:CategoryEditor)=>Promise<any>;categoryDelete:(name:string)=>Promise<any>;
 ruleSave:(input:any)=>Promise<any>;ruleDelete:(id:number)=>Promise<any>;
 bankCategorize:(input:{accountId:string;externalId:string;category:string|null})=>Promise<BankState['data']>;
 bankEditDetail:(input:any)=>Promise<BankState['data']>;bankBatch:(input:any)=>Promise<BankState['data']>;
 bankSplit:(input:any)=>Promise<BankState['data']>;bankLinkManual:(input:any)=>Promise<BankState['data']>;
 bankMerchantAlias:(input:any)=>Promise<BankState['data']>;bankDeleteAlias:(id:number)=>Promise<BankState['data']>;bankDismissDuplicate:(pairKey:string)=>Promise<BankState['data']>;
 planOverview:(options:any)=>Promise<PlanOverview>;planSimulate:(options:any)=>Promise<any>;planCreate:(input:any)=>Promise<any>;planEdit:(input:any)=>Promise<PlanOverview>;planStatus:(id:string,status:string)=>Promise<PlanOverview>;planLink:(input:any)=>Promise<PlanOverview>;planUnlink:(input:any)=>Promise<PlanOverview>;planReject:(input:any)=>Promise<PlanOverview>;planRename:(input:any)=>Promise<{overview:PlanOverview;data:BankState['data']}>;planHistory:(id:string)=>Promise<{action:string;details:string;at:string}[]>;}

const desktop:DesktopBridge|null = (window as any).financeDesktop || null;
const CATS = ['Moradia','Alimentação','Transporte','Saúde','Lazer','Educação','Assinaturas','Compras','Contas','Outros'];
const COLORS = ['#884bff','#bc80ff','#db6ff5','#7549d8','#a58cf4','#5b4da5','#4a386f','#7555bd','#c090e5','#3f375a'];
const BUILTIN_EMOJIS=['🏠','🍽️','🚗','💊','🎮','📚','📺','🛍️','🧾','✨','💰'];
const EMOJI_OPTIONS=['🏠','🏡','🔑','🪴','🍽️','🍔','🍕','🥗','🥑','☕','🍿','🛒','🛍️','🚗','🚕','🚌','🚲','⛽','✈️','🧳','💊','🩺','💅','🧴','🧘','🎮','🎬','🎵','🎧','📚','🎓','💻','📱','📺','📷','🎨','🎟️','⚽','🏋️','🏆','🐶','🐱','🐾','💰','💸','💳','🏦','📈','🪙','🧾','💡','⚡','💧','📦','🎁','❤️','🌸','🌿','⭐','✨','🎯','🔧'];
const COLOR_OPTIONS=['#884bff','#bc80ff','#d66ef3','#f063a4','#f97373','#f99d5a','#eab653','#80b96a','#38bf95','#3ab9c7','#5b9cf6','#6c79ef','#a48bc8','#be9aa3','#727a98','#d2a178'];
const DEFAULT_CATEGORY_INFOS:CategoryInfo[]=[...CATS,'Salário'].map((name,i)=>({name,color:COLORS[i%COLORS.length],emoji:BUILTIN_EMOJIS[i],builtIn:1}));
const emptyRule=():RuleEditor=>({id:null,pattern:'',matchMode:'contains',category:'Alimentação',scope:'both',priority:'100'});
function fold(value:string){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pt-BR').replace(/\s+/g,' ').trim();}
function findCategoryRule(description:string,scope:'manual'|'bank',rules:RuleInfo[]):string|null {
 const value=fold(description);
 for(const r of [...rules].filter(r=>r.enabled&&(r.scope==='both'||r.scope===scope)).sort((a,b)=>a.priority-b.priority||a.id-b.id)){
  const pattern=fold(r.pattern);
  if(pattern&&((r.matchMode==='exact'&&value===pattern)||(r.matchMode==='starts'&&value.startsWith(pattern))||(r.matchMode==='contains'&&value.includes(pattern))))return r.category;
 }
 return null;
}
function effectiveNature(t:BankTx):'income'|'expense'|'transfer'|'ignore' {
 return t.nature&&t.nature!=='auto'?t.nature:(t.amount>=0?'income':'expense');
}
function bankTotalsInRange(bank:BankState,start:string,end:string){
 // SQLite calculates these daily totals from the full history. The visible transaction list is capped.
 const totals=new Map<string,number>();let income=0,expense=0;
 const days=bank.data.dailyTotals;
 if(days){
  for(const day of days){if(day.date<start||day.date>end)continue;
    income+=day.income;expense+=day.expense;
    for(const part of day.categories)totals.set(part.name,(totals.get(part.name)||0)+part.total);
  }
 }else{
  // Compatibility with legacy/demo data that has no daily aggregates.
  const tx=(bank.data.transactions||[]).filter(t=>t.status==='POSTED'&&t.date>=start&&t.date<=end);
  for(const t of tx){const nature=effectiveNature(t),amount=Math.abs(t.amount);
   if(nature==='income')income+=amount;
   if(nature==='expense'){
     expense+=amount;
     const parts=t.splits?.length&&!t.splitOutdated?t.splits:[{category:t.category,amount}];
     for(const part of parts)totals.set(part.category,(totals.get(part.category)||0)+part.amount);
   }
  }
 }
 const balance=(bank.data.accounts||[]).reduce((v,a)=>v+(a.balance||0),0);
 return {income,expense,net:income-expense,balance,categories:[...totals].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total)};
}
function bankSnapshot(bank:BankState,month:string){return bankTotalsInRange(bank,firstOfMonth(month),endOfMonth(month));}
const fmt = (n:number)=> (n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const moneyString = (n:number)=> (n/100).toFixed(2).replace('.',',');
function parseMoney(v:string):number { let s = String(v||'').trim().replace(/R\$|\s/g,''); if (!s) return 0; if (s.includes(',')) s=s.replace(/\./g,'').replace(',','.'); else if ((s.match(/\./g)||[]).length>1) s=s.replace(/\./g,''); const x=Number(s); return Number.isFinite(x)?Math.round(x*100):NaN; }
function iso(d:Date):string { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function shiftMonth(ym:string,offset:number):string { const d=new Date(Number(ym.slice(0,4)),Number(ym.slice(5,7))-1+offset,1);return iso(d).slice(0,7); }
const nowYM=iso(new Date()).slice(0,7);
type PeriodMode = 'week'|'15d'|'month'|'lastmonth'|'custom';
type DateSpan = {start:string;end:string};
function fromISO(value:string):Date { const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d); }
function advanceDate(value:string,days:number):string { const d=fromISO(value);d.setDate(d.getDate()+days);return iso(d); }
function firstOfMonth(ym:string):string { return ym+'-01'; }
function endOfMonth(ym:string):string { const [y,m]=ym.split('-').map(Number);return iso(new Date(y,m,0)); }
function dateSpan(mode:PeriodMode,customStart:string,customEnd:string,reference:string=iso(new Date())):DateSpan {
 const ym=reference.slice(0,7),start=fromISO(reference);
 if(mode==='week'){const weekday=(start.getDay()+6)%7;return{start:advanceDate(reference,-weekday),end:reference};}
 if(mode==='15d')return {start:advanceDate(reference,-14),end:reference};
 if(mode==='month')return {start:firstOfMonth(ym),end:reference};
 if(mode==='lastmonth'){const prev=shiftMonth(ym,-1);return {start:firstOfMonth(prev),end:endOfMonth(prev)};}
 if(/^\d{4}-\d{2}-\d{2}$/.test(customStart)&&/^\d{4}-\d{2}-\d{2}$/.test(customEnd)&&customStart<=customEnd&&iso(fromISO(customStart))===customStart&&iso(fromISO(customEnd))===customEnd)return {start:customStart,end:customEnd};
 return {start:firstOfMonth(ym),end:reference};
}
function spanLabel(mode:PeriodMode,span:DateSpan):string {
 if(mode==='week')return 'Esta semana';
 if(mode==='15d')return 'Últimos 15 dias';
 if(mode==='month')return 'Mês atual';
 if(mode==='lastmonth')return 'Mês passado';
 const date=(v:string)=>v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4);
 return date(span.start)+' – '+date(span.end);
}
function daysInSpan(a:string,b:string):number { return Math.round((Date.UTC(+b.slice(0,4),+b.slice(5,7)-1,+b.slice(8)) - Date.UTC(+a.slice(0,4),+a.slice(5,7)-1,+a.slice(8)))/86400000)+1; }
function snapshotBetween(d:Data,start:string,end:string){
 const ts=d.transactions.filter(t=>t.date>=start&&t.date<=end);
 const income=sum(ts,'income'),expense=sum(ts,'expense');
 const totals=new Map<string,number>();for(const t of ts)if(t.kind==='expense')totals.set(t.category,(totals.get(t.category)||0)+t.amount);
 return {income,expense,net:income-expense,balance:d.settings.opening+sum(d.transactions,'income')-sum(d.transactions,'expense'),categories:[...totals].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total)};
}
function bankSnapshotBetween(bank:BankState,start:string,end:string){return bankTotalsInRange(bank,start,end);}
function flowSegments(start:string,end:string,get:(start:string,end:string)=>{income:number;expense:number}){
 const length=Math.max(1,daysInSpan(start,end)),count=Math.min(7,length);
 return Array.from({length:count},(_,i)=>{
   const a=advanceDate(start,Math.floor(i*length/count));
   const b=advanceDate(start,Math.floor((i+1)*length/count)-1);
   const totals=get(a,b);
   return {month:a,label:b.slice(8,10)+'/'+b.slice(5,7),income:totals.income,expense:totals.expense};
 });
}

function starter():Data { return { version:3,transactions:[],budgets:Object.fromEntries(CATS.map(c=>[c,0])),settings:{opening:0,income:0,fixed:0,existing:0,reserve:0} }; }
function demoData():Data {
 const t:Tx[]=[]; const add=(offset:number,day:number,description:string,kind:Kind,amount:number,category:string)=>{
  const m=shiftMonth(nowYM,offset); t.push({id:'demo-'+t.length,date:m+'-'+String(day).padStart(2,'0'),description,kind,amount:Math.round(amount*100),category,origin:'demo'});
 };
 for(let i=-5;i<=0;i++){
   add(i,4,'Pagamento mensal','income',i%2===0?5300:5200,'Salário');
   add(i,5,'Aluguel','expense',1000,'Moradia');
   add(i,9,'Supermercado','expense',600+(i+6)*29,'Alimentação');
   add(i,11,'Transporte','expense',180+(i+6)*10,'Transporte');
   add(i,14,'Internet e telefone','expense',150,'Contas');
   add(i,16,'Assinaturas','expense',95,'Assinaturas');
   add(i,21,'Esportes','expense',135,'Lazer');
   add(i,25,'Restaurante','expense',160+(i+6)*8,'Alimentação');
 }
 return {version:3, transactions:t,budgets:{Moradia:120000,Alimentação:100000,Transporte:35000,Saúde:20000,Lazer:38000,Educação:30000,Assinaturas:20000,Compras:60000,Contas:40000,Outros:20000},settings:{opening:145000,income:520000,fixed:220000,existing:35000,reserve:100000}};
}
function safeData(v:any):Data {
 if(!v||typeof v!=='object'||!Array.isArray(v.transactions)) throw new Error('Arquivo inválido.');
 const d=starter();
 d.transactions=v.transactions.slice(0,30000).map((r:any)=>{
  const amount=Number(r.amount); if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!['income','expense'].includes(r.kind)||!Number.isSafeInteger(amount)||amount<=0||amount>100000000000||typeof r.description!=='string') throw new Error('Transação inválida.');
  return {id:String(r.id||Math.random()),date:r.date,kind:r.kind,description:r.description.slice(0,180),amount,category:String(r.category||'Outros').slice(0,70),origin:'restored'};
 });
 for(const [c,raw] of Object.entries(v.budgets||{})){let b=Number(raw);if(c.length<=50)d.budgets[c]=Number.isSafeInteger(b)&&b>=0?b:0;}
 for(const key of ['opening','income','fixed','existing','reserve'] as (keyof Settings)[]){const n=Number(v.settings?.[key]||0); (d.settings as any)[key]=(Number.isSafeInteger(n)&&Math.abs(n)<100000000000)?n:0;}
 return d;
}
function load(mode:'real'|'demo'):Data { try { const raw=localStorage.getItem('meu-financeiro-v03-'+mode);if(raw)return safeData(JSON.parse(raw)); } catch(_) {} return mode==='demo'?demoData():starter(); }
function save(mode:'real'|'demo',data:Data){localStorage.setItem('meu-financeiro-v03-'+mode,JSON.stringify(data));}
function sum(t:Tx[],kind:Kind){return t.filter(x=>x.kind===kind).reduce((a,x)=>a+x.amount,0);}
function snapshot(d:Data,month:string){ const ts=d.transactions.filter(t=>t.date.slice(0,7)===month); const income=sum(ts,'income'), expense=sum(ts,'expense'); const bal=d.settings.opening+sum(d.transactions,'income')-sum(d.transactions,'expense'); const names=[...new Set([...CATS,...Object.keys(d.budgets),...ts.map(t=>t.category)])];const categories=names.map(cat=>({name:cat,total:sum(ts.filter(t=>t.category===cat),'expense')})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total); return {income,expense,balance:bal,net:income-expense,categories}; }
function simulate(d:Data,sim:Sim){
 const principal=parseMoney(sim.value),count=Math.trunc(Number(sim.installments)),rate=Number(String(sim.interest).replace(',','.'))/100;
 if(!Number.isFinite(principal)||principal<=0||principal>10000000000) return {error:'Informe um valor válido maior que zero.'};
 if(!Number.isInteger(count)||count<1||count>60||!Number.isFinite(rate)||rate<0||rate>1) return {error:'Confira o número de parcelas e os juros.'};
 const r = rate; const monthly = count===1?principal:Math.round(r===0?principal/count:principal*r/(1-Math.pow(1+r,-count)));
 const total=monthly*count; const base=d.settings; const current=snapshot(d,nowYM).balance;
 const hasProfile=base.income>0&&base.fixed>0;
 let balance=current; const rows=[];
 for(let i=1;i<=Math.min(count,12);i++){
   const previous=balance; balance+=base.income-base.fixed-base.existing-monthly;
   rows.push({month:shiftMonth(nowYM,i),before:previous,after:balance,available:balance-base.reserve});
 }
 let risk:'safe'|'caution'|'risk'|'unknown'='unknown';
 if(hasProfile){
   const minAvail=Math.min(...rows.map(x=>x.available));
   const ratio=monthly/base.income;
   risk = (minAvail<0 || ratio>0.3 || base.income-base.fixed-base.existing-monthly<0)?'risk':(minAvail<base.income*0.3||ratio>0.12)?'caution':'safe';
 }
 return {principal,count,monthly,total,rate,rows,risk,current,hasProfile};
}
function Icon(p:{name:string,size?:number}){
 const paths:{[s:string]:string}={home:'M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z',wallet:'M3 7h17a2 2 0 0 1 2 2v11H3a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h15v3H3m11 7h8',trend:'M3 17l6-6 4 4 8-8 M15 7h6v6',down:'M3 7l6 6 4-4 8 8 M15 17h6v-6',calendar:'M3 6h18v15H3z M7 3v6 M17 3v6 M3 11h18',refresh:'M21 4v6h-6 M3 20v-6h6 M5 10a8 8 0 0 1 14-4l2 4 M3 14l2 4a8 8 0 0 0 14-4',layers:'M12 3 2 9l10 6 10-6-10-6z M2 13l10 6 10-6',cart:'M3 4h2l3 12h11l3-9H6 M9 21h1 M18 21h1',pie:'M12 2v10h10 M12 2a10 10 0 1 0 10 10',settings:'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.2 2.2 M16.2 16.2l2.2 2.2 M18.4 5.6l-2.2 2.2 M7.8 16.2l-2.2 2.2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',plus:'M12 5v14 M5 12h14',search:'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16 M17 17l5 5',check:'M4 12l5 5L20 6',shield:'M12 2l9 4v6c0 6-4.2 9.2-9 11-4.8-1.8-9-5-9-11V6z M8 12l3 3 5-6',chart:'M4 20V12 M10 20V4 M16 20v-8 M22 20V8',download:'M12 3v13 M7 11l5 5 5-5 M3 18v3h18v-3',upload:'M12 21V8 M7 13l5-5 5 5 M3 5V3h18v2',trash:'M4 6h16 M9 6V3h6v3 M7 8l1 13h8l1-13',arrow:'M5 12h14 M13 6l6 6-6 6',alert:'M12 3 2 21h20L12 3z M12 10v4 M12 18v0',edit:'M3 21l5-.8L21 7 17 3 4 16z',filter:'M3 4h18l-7 8v7l-4 2v-9z',clock:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v6l4 2',spark:'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',bank:'M2 10l10-7 10 7z M4 11v9 M10 11v9 M16 11v9 M22 21H2',folder:'M3 5h7l2 2h9v13H3z'};
 return h('svg',{width:p.size||19,height:p.size||19,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':'true'},h('path',{d:paths[p.name]||paths.chart}));
}
function Logo(){return h('span',{className:'logo-glyph'},h('span',{className:'bar b1'}),h('span',{className:'bar b2'}),h('span',{className:'bar b3'}));}
function Card(p:any){return h('div',{className:'card '+(p.className||'')},p.children);}
function Stat(p:any){return h('div',{className:'stat '+(p.featured?'stat-featured':'')},h('div',{className:'stat-head'},h('span',{className:'stat-icon '+(p.color||'')},h(Icon,{name:p.icon})),h('span',{className:'stat-label'},p.label)),h('div',{className:'stat-value'},fmt(p.amount)),h('div',{className:'stat-foot'},p.hint));}
function prettyMonth(ym:string){const [year,month]=ym.split('-');return new Date(Number(year),Number(month)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});}
function monthShort(ym:string){return new Date(Number(ym.slice(0,4)),Number(ym.slice(5,7))-1,1).toLocaleDateString('pt-BR',{month:'short'}).replace('.','');}
function Chart(p:any){const vals=p.data as {month:string;label?:string;income:number;expense:number}[];const max=Math.max(1,...vals.flatMap(x=>[x.income,x.expense]))*1.14;const W=580,H=200,l=30,r=12,t=16,b=30;const xx=(i:number)=>l+i*(W-l-r)/Math.max(1,vals.length-1);const yy=(v:number)=>t+(H-b-t)*(1-v/max);const getPath=(k:'income'|'expense')=>vals.map((x,i)=>(i?'L':'M')+xx(i).toFixed(1)+','+yy(x[k]).toFixed(1)).join(' ');const getArea=(k:'income'|'expense')=>getPath(k)+` L${xx(vals.length-1)},${H-b} L${xx(0)},${H-b} Z`;
 return h('svg',{className:'chart-svg',viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none','aria-label':'Evolução mensal de receitas e despesas'},
  h('defs',{},h('linearGradient',{id:'incFill',x1:'0',y1:'0',x2:'0',y2:'1'},h('stop',{offset:'0%',stopColor:'#8349ff',stopOpacity:'.28'}),h('stop',{offset:'100%',stopColor:'#8349ff',stopOpacity:'0'})),h('linearGradient',{id:'expFill',x1:'0',y1:'0',x2:'0',y2:'1'},h('stop',{offset:'0%',stopColor:'#dc70ee',stopOpacity:'.2'}),h('stop',{offset:'100%',stopColor:'#dc70ee',stopOpacity:'0'}))),
  [0,.25,.5,.75,1].map((a,i)=>h('g',{key:'g'+i},h('line',{x1:l,y1:yy(max*a),x2:W-r,y2:yy(max*a),stroke:'#2c2c3c',strokeWidth:1}),h('text',{x:0,y:yy(max*a)+4,fill:'#76758d',fontSize:11},(max*a/100000).toFixed(0)+'k'))),
  h('path',{d:getArea('income'),fill:'url(#incFill)'}),h('path',{d:getArea('expense'),fill:'url(#expFill)'}),h('path',{d:getPath('income'),fill:'none',stroke:'#864aff',strokeWidth:3.2,strokeLinecap:'round',strokeLinejoin:'round'}),h('path',{d:getPath('expense'),fill:'none',stroke:'#d968ef',strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round'}),
  vals.map((x,i)=>h('g',{key:x.month},h('text',{x:xx(i),y:H-9,fill:'#9492ad',fontSize:13,textAnchor:'middle'},(x.label||monthShort(x.month))),h('circle',{cx:xx(i),cy:yy(x.income),r:3,fill:'#a778ff'}))));}
function Donut(p:any){const vals=p.items as {name:string;total:number}[];const total=vals.reduce((a,x)=>a+x.total,0);let deg=0;const colorOf=(name:string)=>p.colors?.[name]||COLORS[Math.max(0,CATS.indexOf(name))%COLORS.length]; const seg=vals.map((x,i)=>{const start=deg;deg+=x.total/Math.max(total,1)*360;return `${colorOf(x.name)} ${start}deg ${deg}deg`;});
 return h('div',{className:'donut-wrap'},h('div',{className:'donut',style:{background:total?`conic-gradient(${seg.join(',')})`:'conic-gradient(#2c2938 0 360deg)'}},h('div',{className:'donut-inner'},h('b',{},fmt(total)),h('small',{},'em despesas'))),h('div',{className:'donut-legend'},(total?vals.slice(0,5):CATS.slice(0,5).map(name=>({name,total:0}))).map((v,i)=>h('div',{className:'legend-row',key:v.name},h('span',{className:'legend-text'},h('i',{style:{background:colorOf(v.name)}}),p.emojis?.[v.name]?h('span',{className:'legend-emoji'},p.emojis[v.name]):null,v.name),h('strong',{},total?Math.round(v.total*100/total)+'%':'0%')))));
}

type Choice = {value:string;label:string};
class StyledSelect extends React.Component<any,any>{
 private trigger:any=null;private menu:any=null;
 constructor(props:any){super(props);this.state={open:false,focusIndex:0,placement:{left:0,top:0,width:220,maxHeight:250}};}
 componentDidMount(){document.addEventListener('pointerdown',this.onOutside,true);window.addEventListener('resize',this.close);window.addEventListener('scroll',this.onScroll,true);}
 componentWillUnmount(){document.removeEventListener('pointerdown',this.onOutside,true);window.removeEventListener('resize',this.close);window.removeEventListener('scroll',this.onScroll,true);}
 close=()=>{if(this.state.open)this.setState({open:false});};
 onScroll=(e:any)=>{if(!this.menu?.contains(e.target))this.close();};
 onOutside=(e:any)=>{if(this.state.open&&!this.trigger?.contains(e.target)&&!this.menu?.contains(e.target))this.close();};
 geometry(){const r=this.trigger?.getBoundingClientRect();if(!r)return this.state.placement;const height=Math.min(300,window.innerHeight-30),below=window.innerHeight-r.bottom-14;const width=Math.max(r.width,Math.min(250,window.innerWidth-24));return{left:Math.max(12,Math.min(r.left,window.innerWidth-width-12)),top:below>160?r.bottom+6:Math.max(10,r.top-height-6),width,maxHeight:below>160?Math.min(height,below):height};}
 open=()=>{if(this.props.disabled)return;const idx=(this.props.options||[]).findIndex((x:Choice)=>x.value===this.props.value);this.setState({open:!this.state.open,focusIndex:Math.max(0,idx),placement:this.geometry()});};
 pick=(v:string)=>{this.setState({open:false});this.props.onChange(v);this.trigger?.focus();};
 onKey=(e:any)=>{
  const options=this.props.options||[];if(!options.length)return;
  if(e.key==='Escape'){this.close();return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const dir=e.key==='ArrowDown'?1:-1;this.setState((s:any)=>({open:true,placement:this.geometry(),focusIndex:s.open?(s.focusIndex+dir+options.length)%options.length:Math.max(0,options.findIndex((x:Choice)=>x.value===this.props.value))}));return;}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();if(this.state.open)this.pick(options[this.state.focusIndex]?.value||options[0].value);else this.open();}
 };
 render(){const options:Choice[]=this.props.options||[],current=options.find(x=>x.value===this.props.value),p=this.state.placement;
  return h('div',{className:'mf-select-wrap '+(this.props.wrapperClass||'')},
    h('button',{type:'button',ref:(e:any)=>this.trigger=e,disabled:this.props.disabled,role:'combobox','aria-expanded':this.state.open,'aria-haspopup':'listbox','aria-label':this.props.ariaLabel||'Selecionar opção',className:'mf-select-trigger '+(this.props.className||''),onClick:this.open,onKeyDown:this.onKey},h('span',{},current?.label||this.props.value||'Selecione'),h('span',{className:'mf-caret','aria-hidden':'true'},'⌄')),
    this.state.open?ReactDOM.createPortal(h('div',{ref:(e:any)=>this.menu=e,className:'mf-select-popover',role:'listbox',style:{position:'fixed',left:p.left,top:p.top,width:p.width,maxHeight:p.maxHeight}},
      options.map((item,i)=>h('button',{key:item.value,type:'button',role:'option','aria-selected':item.value===this.props.value,className:'mf-option '+(item.value===this.props.value?'is-selected ':'')+(i===this.state.focusIndex?'is-focused':''),onMouseEnter:()=>this.setState({focusIndex:i}),onClick:()=>this.pick(item.value)},h('span',{},item.label),item.value===this.props.value?h('b',{},'✓'):null))),document.body):null);
 }
}

class SingleDatePicker extends React.Component<any,any>{
 private trigger:any=null;private panel:any=null;
 constructor(props:any){super(props);this.state={open:false,view:(props.value||iso(new Date())).slice(0,7),left:0,top:0};}
 componentDidMount(){document.addEventListener('pointerdown',this.outside,true);window.addEventListener('resize',this.close);window.addEventListener('scroll',this.onScroll,true);}
 componentWillUnmount(){document.removeEventListener('pointerdown',this.outside,true);window.removeEventListener('resize',this.close);window.removeEventListener('scroll',this.onScroll,true);}
 close=()=>this.setState({open:false});
 onScroll=(e:any)=>{if(!this.panel?.contains(e.target))this.close();};
 outside=(e:any)=>{if(this.state.open&&!this.trigger?.contains(e.target)&&!this.panel?.contains(e.target))this.close();};
 toggle=()=>{const r=this.trigger?.getBoundingClientRect();if(!r)return;const width=326,left=Math.max(12,Math.min(r.left,window.innerWidth-width-12));this.setState({open:!this.state.open,view:(this.props.value||iso(new Date())).slice(0,7),left,top:r.bottom+310>window.innerHeight?Math.max(10,r.top-313):r.bottom+6});};
 render(){const ym=this.state.view,[y,m]=ym.split('-').map(Number),first=new Date(y,m-1,1),offset=(first.getDay()+6)%7,count=new Date(y,m,0).getDate();
  return h('div',{className:'mf-single-date'},h('button',{ref:(e:any)=>this.trigger=e,type:'button',className:'mf-date-trigger',onClick:this.toggle,'aria-haspopup':'dialog','aria-expanded':this.state.open},h(Icon,{name:'calendar',size:16}),this.props.value?.split('-').reverse().join('/')||'Selecionar data',h('span',{className:'mf-caret'},'⌄')),
   this.state.open?ReactDOM.createPortal(h('div',{ref:(e:any)=>this.panel=e,className:'mf-single-calendar',role:'dialog','aria-label':'Selecionar data',style:{position:'fixed',left:this.state.left,top:this.state.top}},
     h('div',{className:'mf-calendar-nav'},h('button',{type:'button',onClick:()=>this.setState({view:shiftMonth(ym,-1)})},'‹'),h('strong',{},prettyMonth(ym)),h('button',{type:'button',onClick:()=>this.setState({view:shiftMonth(ym,1)})},'›')),
     h('div',{className:'mf-calendar-grid'},['S','T','Q','Q','S','S','D'].map((label,i)=>h('span',{key:'h'+i,className:'mf-weekday'},label)),Array.from({length:offset},(_,i)=>h('span',{key:'e'+i})),Array.from({length:count},(_,i)=>{const day=ym+'-'+String(i+1).padStart(2,'0');return h('button',{key:day,type:'button','aria-label':day,'aria-pressed':this.props.value===day,className:'mf-day '+(this.props.value===day?'selected':''),onClick:()=>{this.props.onChange(day);this.close();}},i+1);})),
     h('button',{type:'button',className:'mf-today-link',onClick:()=>{this.props.onChange(iso(new Date()));this.close();}},'Hoje')),
    document.body):null);
 }
}

class PeriodPicker extends React.Component<any,any>{
 private trigger:any=null;private panel:any=null;
 constructor(props:any){super(props);this.state={open:false,custom:false,start:props.span.start,end:props.span.end,step:'start',view:props.span.end.slice(0,7),placement:{left:0,top:0}};}
 componentDidMount(){document.addEventListener('pointerdown',this.onOutside,true);window.addEventListener('resize',this.close);window.addEventListener('scroll',this.onScroll,true);}
 componentWillUnmount(){document.removeEventListener('pointerdown',this.onOutside,true);window.removeEventListener('resize',this.close);window.removeEventListener('scroll',this.onScroll,true);}
 close=()=>{if(this.state.open)this.setState({open:false});};
 onScroll=(e:any)=>{if(!this.panel?.contains(e.target))this.close();};
 onOutside=(e:any)=>{if(this.state.open&&!this.trigger?.contains(e.target)&&!this.panel?.contains(e.target))this.close();};
 toggle=()=>{const r=this.trigger?.getBoundingClientRect();if(!r)return;const width=Math.min(366,window.innerWidth-20);const left=Math.max(10,Math.min(r.right-width,window.innerWidth-width-10));const top=r.bottom+8;this.setState({open:!this.state.open,custom:this.props.mode==='custom',start:this.props.span.start,end:this.props.span.end,step:'start',view:this.props.span.end.slice(0,7),placement:{left,top:top+440>window.innerHeight?Math.max(10,r.top-446):top}});};
 pickPreset=(mode:PeriodMode)=>{this.close();this.props.onChange(mode);};
 pickDate=(day:string)=>{if(this.state.step==='start'||day<this.state.start){this.setState({start:day,end:'',step:'end'});}else this.setState({end:day,step:'start'});};
 renderCalendar(){const ym=this.state.view,[year,mon]=ym.split('-').map(Number),first=new Date(year,mon-1,1),offset=(first.getDay()+6)%7,num=new Date(year,mon,0).getDate(),dates:Array<string|null>=Array.from({length:offset},()=>null).concat(Array.from({length:num},(_,i)=>ym+'-'+String(i+1).padStart(2,'0')));
  return h('div',{className:'mf-calendar'},h('div',{className:'mf-calendar-nav'},h('button',{type:'button',onClick:()=>this.setState({view:shiftMonth(ym,-1)})},'‹'),h('strong',{},prettyMonth(ym)),h('button',{type:'button',onClick:()=>this.setState({view:shiftMonth(ym,1)})},'›')),
   h('div',{className:'mf-calendar-grid'},['S','T','Q','Q','S','S','D'].map((d,i)=>h('span',{key:'weekday'+i,className:'mf-weekday'},d)),dates.map((day,i)=>day?h('button',{type:'button',key:day, 'aria-label':day, 'aria-pressed':day===this.state.start||day===this.state.end,className:'mf-day '+(day===this.state.start||day===this.state.end?'selected ':'')+(this.state.end&&day>this.state.start&&day<this.state.end?'in-range':''),onClick:()=>this.pickDate(day)},String(+day.slice(8))):h('span',{key:'empty'+i}))) );
 }
 render(){const presets:Choice[]=[{value:'week',label:'Esta semana'},{value:'15d',label:'Últimos 15 dias'},{value:'month',label:'Mês atual'},{value:'lastmonth',label:'Mês passado'}],span=this.props.span,p=this.state.placement;
  return h('div',{className:'mf-period-holder'},h('button',{type:'button',className:'mf-period-trigger',ref:(e:any)=>this.trigger=e,'aria-expanded':this.state.open,'aria-haspopup':'dialog',onClick:this.toggle},h(Icon,{name:'calendar',size:17}),h('span',{},spanLabel(this.props.mode,span)),h('span',{className:'mf-caret'},'⌄')),
   this.state.open?ReactDOM.createPortal(h('div',{className:'mf-period-popover',role:'dialog','aria-label':'Selecionar período',ref:(e:any)=>this.panel=e,style:{position:'fixed',left:p.left,top:p.top,width:Math.min(366,window.innerWidth-20)}},
     h('strong',{className:'mf-popup-title'},'Período de análise'),
     h('div',{className:'mf-period-presets'},presets.map(a=>h('button',{key:a.value,type:'button',className:this.props.mode===a.value&&!this.state.custom?'selected':'',onClick:()=>this.pickPreset(a.value as PeriodMode)},a.label))),
     h('button',{type:'button',className:'mf-custom-toggle '+(this.state.custom?'selected':''),onClick:()=>this.setState({custom:!this.state.custom,step:'start'})},'Selecionar datas personalizadas',h('span',{},'⌄')),
     this.state.custom?h('div',{className:'mf-custom-calendar'},h('p',{},this.state.step==='start'?'Selecione a data inicial':'Agora selecione a data final'),
        h('div',{className:'mf-range-values'},h('span',{},'Início: ',h('b',{},this.state.start?.split('-').reverse().join('/')||'—')),h('span',{},'Fim: ',h('b',{},this.state.end?.split('-').reverse().join('/')||'—'))),
        this.renderCalendar(),h('div',{className:'mf-range-actions'},h('button',{type:'button',onClick:this.close},'Cancelar'),h('button',{type:'button',disabled:!this.state.start||!this.state.end||this.state.end<this.state.start,onClick:()=>{this.props.onChange('custom',this.state.start,this.state.end);this.close();}},'Aplicar período'))):null),document.body):null);
 }
}

class App extends React.Component<any,State>{
 private fileInput:any; private csvInput:any; private timeout:any; private writeInProgress=false; private autoSyncTimer:any=null; private lastSyncAttempt=0; private focusReturn:any=null;
 constructor(props:any){super(props);const mode:'real'|'demo'='real';this.state={mode,data:desktop?starter():load(mode),page:'overview',month:nowYM,showEntry:false,entry:{date:iso(new Date()),description:'',kind:'expense',category:'Outros',value:''},sim:{value:'',installments:'6',interest:'0'},outcome:null,query:'',toast:'',budgetEdit:'',busy:!!desktop,booting:!!desktop,editModal:null,bank:EMPTY_BANK,bankForm:{clientId:'',clientSecret:'',itemIds:''},bankBusy:false,bankMessage:'',bankFilter:'',txSource:'all',txReviewOnly:false,txOrganize:false,categoryMoreEmojis:false,quickAddOpen:false,dashboardSource:'bank',categories:DEFAULT_CATEGORY_INFOS,rules:[],categoryEditor:{previousName:'',name:'',color:'#884bff',emoji:'✨'},ruleEditor:emptyRule(),ruleTest:'IFOOD',categoryMessage:'',entryCategoryTouched:false,bankConfigOpen:false,overviewPeriod:'month',customStart:iso(new Date()),customEnd:iso(new Date()),backupInfo:{copies:0,last:null},detail:null,detailDraft:{merchant:'',note:'',nature:'auto',reviewed:false,aliasPattern:'',splitParts:[]},detailBusy:false,txSelected:[],txBatchCategory:'Alimentação',planning:EMPTY_PLANNING,planMonth:nowYM,planDay:iso(new Date()),planSelected:null,planOpen:false,planForm:freshPlanForm(),planBusy:false,planView:'all',planTerm:'',planIncludeEstimated:false,planBankTitle:'',planMatchQuery:'',planHistory:[]};}
 async componentDidMount(){
   window.addEventListener('keydown',this.onGlobalKeydown);
   if(!desktop)return;
   try {
     const persisted=await desktop.load('real');
     this.setState({data:persisted?safeData(persisted):starter(),busy:false,booting:false});
     await this.refreshCategories();
     const currentBank=await this.refreshBank();
     await this.refreshPlanning();
     try{const backupInfo=await desktop.backupStatus?.();if(backupInfo)this.setState({backupInfo});}catch(_){}
     this.autoSyncTimer=window.setInterval(()=>this.maybeAutoSync(),30*60*1000);
     if(currentBank)this.maybeAutoSync(currentBank);
   } catch(e:any){this.setState({fatal:'Não foi possível abrir seus dados pessoais: '+String(e?.message||e),busy:false,booting:false});}
 }
 componentDidUpdate(_prevProps:any,previous:State){
   const before=!!(previous.showEntry||previous.editModal||previous.detail||previous.planOpen||previous.planSelected);
   const now=!!(this.state.showEntry||this.state.editModal||this.state.detail||this.state.planOpen||this.state.planSelected);
   if(!before&&now){
     this.focusReturn=document.activeElement;
     const dialog=document.querySelector('.modal-backdrop [role="dialog"],.mf-detail-drawer');
     const control=dialog?.querySelector('input:not([disabled]),button:not([disabled])') as HTMLElement|null;
     control?.focus();
   }else if(before&&!now){
     if(this.focusReturn&&document.contains(this.focusReturn))this.focusReturn.focus?.();
     this.focusReturn=null;
   }
 }
 async refreshBank(){
   if(!desktop?.bankStatus)return;
   try{const bank=await desktop.bankStatus();this.setState({bank,bankForm:{clientId:bank.config.clientId||'',clientSecret:'',itemIds:(bank.config.itemIds||[]).join(', ')}});return bank;}
   catch(e:any){this.setState({bankMessage:'Não foi possível consultar a integração: '+String(e?.message||e)});}
 }
 componentWillUnmount(){window.removeEventListener('keydown',this.onGlobalKeydown);if(this.autoSyncTimer)clearInterval(this.autoSyncTimer);if(this.timeout)clearTimeout(this.timeout);}
 onGlobalKeydown=(event:KeyboardEvent)=>{
   const dialog=document.querySelector('.modal-backdrop [role="dialog"],.mf-detail-drawer');
   if(event.key==='Tab'&&dialog&&!document.querySelector('[role="listbox"],.mf-period-popover,.mf-single-calendar')){
     const controls=Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]')) as HTMLElement[];
     if(controls.length){
       const first=controls[0],last=controls[controls.length-1];
       if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}
       else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
     }
     return;
   }
   if(event.key!=='Escape')return;
   // Popup menus consume Escape without closing the underlying dialog.
   if(document.querySelector('[role="listbox"],.mf-period-popover,.mf-single-calendar'))return;
   if(this.state.quickAddOpen){this.setState({quickAddOpen:false});return;}
   if(this.state.planSelected){this.setState({planSelected:null});return;}
   if(this.state.detail){this.setState({detail:null});return;}
   if(this.state.planOpen){this.setState({planOpen:false});return;}
   if(this.state.editModal){this.setState({editModal:null});return;}
   if(this.state.showEntry)this.setState({showEntry:false});
 };
 maybeAutoSync(bank:BankState=this.state.bank){
  const delay=6*60*60*1000,now=Date.now();
  if(!desktop||this.state.mode!=='real'||!bank.config.configured||this.state.bankBusy||this.state.busy)return;
  const last=bank.data.last?.completedAt?Date.parse(bank.data.last.completedAt):0;
  if(last&&now-last<delay)return;
  if(this.lastSyncAttempt&&now-this.lastSyncAttempt<delay)return;
  this.syncBank(true);
 }
 async refreshCategories(){
   if(!desktop?.categoriesStatus)return;
   try{const state=await desktop.categoriesStatus();this.setState({categories:state.categories,rules:state.rules});}
   catch(e:any){this.setState({categoryMessage:String(e?.message||e)});}
 }
 getCategories(){return this.state.categories.length?this.state.categories:DEFAULT_CATEGORY_INFOS;}
 async saveCategory(){
   if(!desktop||this.state.mode==='demo')return;
   const value=this.state.categoryEditor;
   try{
     const state=await desktop.categorySave(value);
     const persisted=await desktop.load(this.state.mode);
     this.setState({categories:state.categories,rules:state.rules,categoryEditor:{previousName:'',name:'',color:'#884bff',emoji:'✨'},categoryMessage:'Categoria salva.',data:persisted?safeData(persisted):this.state.data});
     await this.refreshBank();
   }catch(e:any){this.setState({categoryMessage:String(e?.message||e)});}
 }
 async deleteCategory(name:string){
   if(!desktop||this.state.mode==='demo'||!confirm('Excluir a categoria '+name+'? A exclusão será impedida se ela estiver em uso.'))return;
   try{const state=await desktop.categoryDelete(name);const persisted=await desktop.load(this.state.mode);this.setState({categories:state.categories,rules:state.rules,data:persisted?safeData(persisted):this.state.data,categoryMessage:'Categoria excluída.'});}
   catch(e:any){this.setState({categoryMessage:String(e?.message||e)});}
 }
 async saveRule(){
   if(!desktop||this.state.mode==='demo')return;
   try{
     const rule=this.state.ruleEditor;
     const state=await desktop.ruleSave({...rule,priority:Number(rule.priority)});
     this.setState({categories:state.categories,rules:state.rules,ruleEditor:emptyRule(),categoryMessage:'Regra salva. Os extratos bancários já importados foram reclassificados na visualização.'});
     await this.refreshBank();
   }catch(e:any){this.setState({categoryMessage:String(e?.message||e)});}
 }
 async deleteRule(id:number){
   if(!desktop||this.state.mode==='demo'||!confirm('Excluir esta regra?'))return;
   try{const state=await desktop.ruleDelete(id);this.setState({categories:state.categories,rules:state.rules,categoryMessage:'Regra excluída.'});await this.refreshBank();}
   catch(e:any){this.setState({categoryMessage:String(e?.message||e)});}
 }
 async setBankCategory(tx:BankTx,category:string){
   if(!desktop||this.state.mode==='demo')return;
   try{
     const data=await desktop.bankCategorize({accountId:tx.accountId,externalId:tx.id,category:category||null});
     this.setState({bank:{...this.state.bank,data},categoryMessage:'Classificação bancária salva.'});
   }catch(e:any){this.flash('Falha ao classificar: '+String(e?.message||e));}
 }
 changeManualCategory(id:string,category:string){
   const data=this.state.data;
   this.updateData({...data,transactions:data.transactions.map(t=>t.id===id?{...t,category}:t)},'Categoria atualizada.');
 }
 bankTxSelected(tx:BankTx){return this.state.txSelected.includes(tx.accountId+'|'+tx.id);}
 toggleSelected(tx:BankTx){const key=tx.accountId+'|'+tx.id;this.setState({txSelected:this.bankTxSelected(tx)?this.state.txSelected.filter(x=>x!==key):this.state.txSelected.length>=100?this.state.txSelected:[...this.state.txSelected,key]});}
 openBankDetail(tx:BankTx){
   this.setState({detail:{origin:'bank',id:tx.id,accountId:tx.accountId},detailDraft:{merchant:tx.merchant||'',note:tx.note||'',nature:tx.nature||'auto',reviewed:!!tx.reviewed,aliasPattern:tx.description.slice(0,60),splitParts:(tx.splits?.length?tx.splits:[{category:tx.category,amount:Math.floor(Math.abs(tx.amount)/2)},{category:tx.category,amount:Math.abs(tx.amount)-Math.floor(Math.abs(tx.amount)/2)}]).map(p=>({category:p.category,value:moneyString(p.amount)}))}});
 }
 openManualDetail(tx:Tx){this.setState({detail:{origin:'manual',id:tx.id}});}
 async updateBankInfo(){
  const sel=this.state.detail;if(!desktop||!sel||sel.origin!=='bank'||this.state.detailBusy)return;
  const f=this.state.detailDraft;this.setState({detailBusy:true});
  try{const data=await desktop.bankEditDetail({accountId:sel.accountId,externalId:sel.id,merchant:f.merchant,note:f.note,nature:f.nature,reviewed:f.reviewed});this.setState({bank:{...this.state.bank,data},detailBusy:false});this.flash('Detalhes salvos.');}
  catch(e:any){this.setState({detailBusy:false});this.flash('Não foi possível salvar: '+String(e?.message||e));}
 }
 async runBankOperation(method:'bankBatch'|'bankSplit'|'bankLinkManual'|'bankMerchantAlias',input:any,feedback:string,closeDetail:boolean=false){
  if(!desktop||this.state.mode==='demo'||this.state.detailBusy)return;
  this.setState({detailBusy:true});
  try{const data=await (desktop as any)[method](input);this.setState({bank:{...this.state.bank,data},detailBusy:false,txSelected:method==='bankBatch'?[]:this.state.txSelected,detail:closeDetail?null:this.state.detail});this.flash(feedback);}
  catch(e:any){this.setState({detailBusy:false});this.flash('Não foi possível concluir: '+String(e?.message||e));}
 }
 async applyBankBatch(changes:{reviewed?:boolean;category?:string;nature?:string}){
  const items=this.state.txSelected.map(key=>{const x=this.state.bank.data.transactions.find(t=>t.accountId+'|'+t.id===key);return x?{accountId:x.accountId,externalId:x.id}:null;}).filter(Boolean);
  if(!items.length)return this.flash('Selecione movimentações bancárias.');
  await this.runBankOperation('bankBatch',{items,...changes},'Alterações aplicadas a '+items.length+' movimentações.');
 }
 async saveSplit(){
  const sel=this.state.detail;if(!sel||sel.origin!=='bank')return;
  const parts=this.state.detailDraft.splitParts.map(x=>({category:x.category,amount:parseMoney(x.value)}));
  if(parts.some(x=>!Number.isSafeInteger(x.amount)||x.amount<=0))return this.flash('Confira os valores da divisão.');
  await this.runBankOperation('bankSplit',{accountId:sel.accountId,externalId:sel.id,parts},parts.length?'Divisão salva.':'Divisão removida.');
 }
 async createCategoryRuleFromDetail(){
  const sel=this.state.detail,tx=this.state.bank.data.transactions.find(x=>x.accountId===sel?.accountId&&x.id===sel?.id);
  if(!desktop||!tx||!sel||sel.origin!=='bank'||this.state.detailBusy)return;
  const pattern=this.state.detailDraft.aliasPattern.trim();
  if(pattern.length<3)return this.flash('Use um trecho específico com pelo menos 3 caracteres.');
  const matches=this.state.bank.data.transactions.filter(x=>fold(x.description).includes(fold(pattern))).length;
  if(!confirm('Usar a categoria '+tx.category+' para '+matches+' movimentação(ões) com o texto '+pattern+'? Confira se não é um termo genérico.'))return;
  this.setState({detailBusy:true});
  try{
    const result=await desktop.ruleSave({pattern,category:tx.category,matchMode:'contains',scope:'bank',priority:100});
    const data=await desktop.bankStatus();
    this.setState({rules:result.rules,categories:result.categories,bank:data,detailBusy:false});
    this.flash('Regra de categoria criada.');
  }catch(e:any){this.setState({detailBusy:false});this.flash('Não foi possível criar regra: '+String(e?.message||e));}
 }
 async createMerchantAlias(){
  const f=this.state.detailDraft;if(!f.merchant.trim()||f.aliasPattern.trim().length<3)return this.flash('Informe o nome e um trecho da descrição.');
  await this.runBankOperation('bankMerchantAlias',{pattern:f.aliasPattern,displayName:f.merchant},'Nome do estabelecimento aplicado às movimentações semelhantes.');
 }
 async setManualLink(manualId:string|null){
  const sel=this.state.detail;if(!sel||sel.origin!=='bank')return;
  await this.runBankOperation('bankLinkManual',{accountId:sel.accountId,externalId:sel.id,manualId},manualId?'Movimentações vinculadas.':'Vínculo removido.');
 }
 async configureBank(){
   if(!desktop||this.state.mode==='demo'||this.state.bankBusy)return;
   const f=this.state.bankForm,itemIds=[...new Set(f.itemIds.split(/[;,\n]+/).map(v=>v.trim()).filter(Boolean))];
   if(!itemIds.length)return this.flash('Informe o código da sua conexão bancária.');
   this.setState({bankBusy:true,bankMessage:''});
   try{const bank=await desktop.bankConfigure({clientId:f.clientId.trim(),clientSecret:f.clientSecret,itemIds});
     this.setState({bank,bankBusy:false,bankForm:{...f,clientSecret:'',clientId:bank.config.clientId,itemIds:bank.config.itemIds.join(', ')},bankMessage:'Conexão salva com segurança. Agora você pode atualizar suas contas.'});
   }catch(e:any){this.setState({bankBusy:false,bankMessage:String(e?.message||e)});}
 }
 async dismissBankDuplicate(pairKey:string){if(!desktop?.bankDismissDuplicate||!confirm('Ocultar este aviso? Os lançamentos originais serão preservados.'))return;
   try{const data=await desktop.bankDismissDuplicate(pairKey);this.setState({bank:{...this.state.bank,data}});this.flash('Aviso ocultado. Nenhum lançamento foi excluído.');}
   catch(e:any){this.flash('Não foi possível ocultar: '+String(e?.message||e));}}
 async syncBank(automatic:boolean=false){
   if(!desktop||this.state.mode==='demo'||this.state.bankBusy)return;
   this.lastSyncAttempt=Date.now();
   this.setState({bankBusy:true,bankMessage:'Atualizando suas contas. Isso pode levar alguns instantes.'});
   try{const result=await desktop.bankSync();this.setState({bank:result,bankBusy:false,bankMessage:'Contas atualizadas: '+result.newCount+' novas e '+result.totalCount+' consultadas. Os lançamentos manuais foram preservados.'});await this.refreshPlanning();if(!automatic)this.flash('Contas atualizadas: '+result.newCount+' novas movimentações.');}
   catch(e:any){this.setState({bankBusy:false,bankMessage:'Sincronização não concluída: '+String(e?.message||e)+'. O histórico anterior foi preservado.'});if(!automatic)this.flash('Não foi possível atualizar. Veja os detalhes em Minhas contas.');}
 }
 async forgetBank(){
   if(!desktop||this.state.mode==='demo'||this.state.bankBusy||!confirm('Desconectar esta conta? Suas movimentações já salvas continuarão disponíveis neste computador.'))return;
   this.setState({bankBusy:true});
   try{const bank=await desktop.bankForget();this.setState({bank,bankBusy:false,bankForm:{clientId:'',clientSecret:'',itemIds:''},bankMessage:'Conta desconectada. Suas movimentações anteriores foram preservadas.'});}
   catch(e:any){this.setState({bankBusy:false,bankMessage:String(e?.message||e)});}
 }
 flash(msg:string){this.setState({toast:msg});clearTimeout(this.timeout);this.timeout=setTimeout(()=>this.setState({toast:''}),4500);}
 async updateData(data:Data,msg?:string):Promise<boolean>{
   if(this.writeInProgress||this.state.busy){this.flash('Aguarde a gravação anterior.');return false;}
   this.writeInProgress=true;
   const mode=this.state.mode;
   this.setState({busy:true});
   try{
     if(desktop)await desktop.save(mode,data);else save(mode,data);
     this.setState({data,busy:false});
     if(msg)this.flash(msg);
     return true;
   }catch(e:any){
     this.setState({busy:false});
     this.flash('Não foi possível salvar sua alteração: '+String(e?.message||e));
     return false;
   }finally{this.writeInProgress=false;}
 }
 async toggleMode(){
   if(this.state.busy){this.flash('Aguarde a operação atual.');return;}
   const mode=this.state.mode==='real'?'demo':'real';
   if(!desktop){this.setState({mode,data:load(mode),outcome:null,page:'overview',showEntry:false});return;}
   this.setState({busy:true});
   try{
     let loaded=await desktop.load(mode);
     if(!loaded){loaded=mode==='demo'?demoData():starter();if(mode==='demo')await desktop.save('demo',loaded);}
     this.setState({mode,data:safeData(loaded),busy:false,outcome:null,page:'overview',showEntry:false});
   } catch(e:any){this.setState({busy:false});this.flash('Não foi possível acessar o perfil: '+String(e?.message||e));}
 }
 async backupDB(){
   if(!desktop)return;
   try{const r=await desktop.backupSQLite();if(!r?.cancelled)this.flash('Sua cópia de segurança foi salva.');}
   catch(e:any){this.flash('Não foi possível salvar a cópia de segurança: '+String(e?.message||e));}
 }
 async restoreDB(){
   if(!desktop?.restoreSQLite||this.state.busy||this.state.bankBusy)return;
   try{
     const result=await desktop.restoreSQLite();
     if(result?.ok)this.flash('Seus dados foram restaurados. Confira seus saldos e categorias.');
   }catch(e:any){this.flash('Não foi possível restaurar: '+String(e?.message||e));}
 }
 async openBackupsFolder(){if(!desktop?.openBackupsFolder)return;try{const err=await desktop.openBackupsFolder();if(err)this.flash('Não foi possível abrir as cópias: '+err);}catch(e:any){this.flash('Não foi possível abrir a pasta de cópias.');}}
 async openDataDir(){if(!desktop)return;try{const err=await desktop.openDataFolder();if(err)this.flash('Não foi possível abrir a pasta: '+err);}catch(e:any){this.flash('Não foi possível abrir a pasta de dados.');}}

 async refreshPlanning(){if(!desktop?.planOverview)return;try{const planning=await desktop.planOverview({month:this.state.planMonth,start:iso(new Date()),end:endOfMonth(this.state.planMonth),includeEstimatedIncome:this.state.planIncludeEstimated});this.setState({planning});}catch(e:any){this.flash('Não foi possível atualizar o planejamento: '+String(e?.message||e));}}
 async executePlan(action:()=>Promise<any>,message:string){if(!desktop||this.state.mode==='demo'||this.state.planBusy)return;this.setState({planBusy:true});try{await action();await this.refreshPlanning();this.setState({planBusy:false,planOpen:false});if(message)this.flash(message);}catch(e:any){this.setState({planBusy:false});this.flash('Não foi possível concluir: '+String(e?.message||e));}}
 openPlan(item?:PlanItem,kind:Kind='expense'){if(this.state.mode==='demo')return this.flash('O planejamento fica disponível nos seus dados pessoais.');const f=item?{id:item.id,title:item.title,kind:item.kind,amount:moneyString(item.amount),dueDate:item.dueDate,category:item.category,accountId:item.accountId||'',notes:item.notes||'',certainty:item.certainty,mode:'once' as const,count:'1'}:freshPlanForm(kind,this.state.planDay);this.setState({planForm:f,planOpen:true});}
 async savePlan(){const f=this.state.planForm;const v=parseMoney(f.amount);if(!Number.isSafeInteger(v)||v<=0)return this.flash('Informe um valor maior que zero.');if(!f.title.trim())return this.flash('Dê um nome ao lançamento.');const data={...f,amount:v,accountId:f.accountId||null,count:Number(f.count)};await this.executePlan(()=>f.id?desktop!.planEdit(data):desktop!.planCreate(data),f.id?'Planejamento atualizado.':'Compromisso adicionado.');}
 planSimulatedPurchase(){
   const out=this.state.outcome;
   if(!out||out.error||out.engine!=='planning'||this.state.mode!=='real'||!desktop)return;
   const count=Number(out.installments);
   if(!Number.isInteger(count)||count<1||count>36){this.flash('O planejamento aceita até 36 parcelas. Ajuste a simulação antes de registrar.');return;}
   const first=out.firstDueDate;
   if(!first||first<iso(new Date())){this.flash('O primeiro vencimento precisa ser hoje ou uma data futura.');return;}
   const total=out.total;
   if(!Number.isSafeInteger(total)||total<=0)return;
   if(!confirm('Criar '+(count===1?'uma compra prevista de ':'um compromisso com '+count+' parcelas totalizando ')+fmt(total)+'? Nenhum pagamento será realizado.'))return;
   const month=first.slice(0,7);
   this.setState({page:'planning',txOrganize:false,txReviewOnly:false,outcome:null,
      planMonth:month>=nowYM&&month<=shiftMonth(nowYM,12)?month:this.state.planMonth,
      planDay:first,planForm:{...freshPlanForm('expense',first),title:'Compra planejada',amount:moneyString(total),
      mode:count===1?'once':'installments',count:String(count),category:'Compras',
      notes:'Simulação: valor original '+fmt(out.principal)+'; juros estimados '+fmt(out.interest)+'. Confirme os valores antes de salvar.'},planOpen:true},()=>void this.refreshPlanning());
 }
 async changePlanStatus(id:string,status:string){const question=status==='cancelled'?'Cancelar este compromisso?':status==='settled_manual'?'Marcar como pago/recebido sem vínculo? Confirme apenas se o valor já está refletido no saldo atual.':status==='planned'?'Voltar este compromisso para pendente?':'Confirmar alteração?';if(!confirm(question))return;await this.executePlan(()=>desktop!.planStatus(id,status),'Situação atualizada.');}
 async linkPlan(itemId:string,bank:BankTx){if(!confirm('Vincular esta movimentação confirmada ao compromisso planejado? O pagamento não será contabilizado duas vezes.'))return;await this.executePlan(()=>desktop!.planLink({itemId,accountId:bank.accountId,externalId:bank.id}),'Pagamento vinculado.');}
 async unlinkPlan(itemId:string,link:{accountId:string;externalId:string}){if(!confirm('Desfazer este vínculo?'))return;await this.executePlan(()=>desktop!.planUnlink({itemId,...link}),'Vínculo desfeito.');}
 async rejectPlanSuggestion(s:PlanSuggestion){await this.executePlan(()=>desktop!.planReject(s),'Sugestão ignorada.');}
 async renameBankInPlanning(bank:BankTx){await this.executePlan(async()=>{const result=await desktop!.planRename({accountId:bank.accountId,externalId:bank.id,title:this.state.planBankTitle});this.setState({bank:{...this.state.bank,data:result.data}});},'Nome personalizado salvo.');}
 openPlanDetail(id:string){const item=this.state.planning.items.find(i=>i.id===id);if(!item)return;this.setState({planSelected:'plan:'+id,planHistory:[]});if(desktop?.planHistory)desktop.planHistory(id).then(history=>this.setState({planHistory:history})).catch(()=>{});}
 openPlanBankDetail(bank:BankTx){this.setState({planSelected:'bank:'+bank.accountId+'|'+bank.id,planBankTitle:bank.customTitle||bank.merchant||'',planMatchQuery:''});}
 changePlanMonth(offset:number){const candidate=shiftMonth(this.state.planMonth,offset);if(candidate<nowYM||candidate>shiftMonth(nowYM,12))return;const date=candidate===nowYM?iso(new Date()):candidate+'-01';this.setState({planMonth:candidate,planDay:date},()=>void this.refreshPlanning());}
 renderPlanning(){return renderPlanningView(this);}
 renderPlanModal(){return renderPlanEditor(this);}
 renderPlanDetail(){return renderPlanDrawer(this);}
 navigate(page:string){
   const target=page==='review'||page==='categories'?'transactions':page==='simulator'?'assistant':page;
   const span=dateSpan(this.state.overviewPeriod,this.state.customStart,this.state.customEnd);
   const newMonth=span.end.slice(0,7),useMonth=newMonth>=nowYM&&newMonth<=shiftMonth(nowYM,12);
   const enteringPlan=target==='planning'&&this.state.page!=='planning'&&useMonth;
   this.setState({page:target,txReviewOnly:page==='review',txOrganize:page==='categories',quickAddOpen:false,
      month:newMonth, ...(enteringPlan?{planMonth:newMonth,planDay:newMonth===nowYM?iso(new Date()):newMonth+'-01'}:{}),
      showEntry:false,outcome:null},()=>{if(enteringPlan)void this.refreshPlanning();});
   if(page==='settings'&&desktop?.backupStatus)void desktop.backupStatus().then(backupInfo=>this.setState({backupInfo})).catch(()=>{});
 }
 setSharedPeriod(mode:PeriodMode,start?:string,end?:string){
   const customStart=start||this.state.customStart,customEnd=end||this.state.customEnd;
   const range=dateSpan(mode,customStart,customEnd);
   this.setState({overviewPeriod:mode,customStart,customEnd,month:range.end.slice(0,7)});
 }
 setSharedMonth(month:string){
   this.setState({overviewPeriod:'custom',customStart:firstOfMonth(month),customEnd:endOfMonth(month),month});
 }
 openQuickEntry(kind:Kind){this.setState({showEntry:true,quickAddOpen:false,entryCategoryTouched:false,
   entry:{...this.state.entry,kind,category:kind==='income'?'Salário':'Outros',date:iso(new Date())}});}
 async markBankReviewed(tx:BankTx){
   if(tx.reviewed||this.state.detailBusy)return;
   await this.runBankOperation('bankBatch',{items:[{accountId:tx.accountId,externalId:tx.id}],reviewed:true},'Movimentação revisada.');
 }
 renderMovements(){
   const count=this.state.bank.data.transactions.filter(t=>!t.reviewed).length;
   const review=this.state.txReviewOnly,organized=this.state.txOrganize;
   return h('div',{className:'movement-shell'},
     h('div',{className:'mf-tx-tabs mf-unified-tabs',role:'group','aria-label':'Seções de movimentações'},
       h('button',{type:'button',className:!review&&!organized?'active':'',onClick:()=>this.setState({txReviewOnly:false,txOrganize:false,txSelected:[]})},'Histórico'),
       h('button',{type:'button',className:review?'active':'',onClick:()=>this.setState({txReviewOnly:true,txOrganize:false,txSelected:[]})},'A revisar ('+count+')'),
       h('button',{type:'button',className:organized?'active':'',onClick:()=>this.setState({txOrganize:true,txReviewOnly:false,txSelected:[]})},'Categorias e regras')),
     organized?this.renderCategories():this.renderTransactions());
 }

 monthData(){return snapshot(this.state.data,this.state.month);}
 async saveEntry(){const f=this.state.entry,v=parseMoney(f.value);if(!f.description.trim())return this.flash('Informe uma descrição.');if(!/^\d{4}-\d{2}-\d{2}$/.test(f.date))return this.flash('Informe uma data válida.');if(!Number.isFinite(v)||v<=0)return this.flash('Informe um valor maior que zero.');const t:Tx={id:'tx-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),date:f.date,description:f.description.trim().slice(0,150),category:f.category,kind:f.kind,amount:v,origin:'manual'};if(await this.updateData({...this.state.data,transactions:[...this.state.data.transactions,t]},'Lançamento registrado.'))this.setState({showEntry:false,entryCategoryTouched:false,entry:{...f,description:'',value:''}});}
 removeEntry(id:string){if(!confirm('Excluir este lançamento?'))return;this.updateData({...this.state.data,transactions:this.state.data.transactions.filter(t=>t.id!==id)},'Lançamento removido.');}
 async setBudget(cat:string,s:string){const v=parseMoney(s);if(!Number.isFinite(v)||v<0){this.flash('Orçamento inválido.');return false;}const saved=await this.updateData({...this.state.data,budgets:{...this.state.data.budgets,[cat]:v}},'Orçamento atualizado.');if(saved)this.setState({budgetEdit:''});return saved;}
 async setSetting(k:keyof Settings,s:string){const v=parseMoney(s);if(!Number.isFinite(v)||Math.abs(v)>100000000000||((k!=='opening')&&v<0)){this.flash('Valor inválido.');return false;}return this.updateData({...this.state.data,settings:{...this.state.data.settings,[k]:v}},'Configuração salva.');}
 exportJSON(){const blob=new Blob([JSON.stringify({...this.state.data,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});download(blob,'meu-financeiro-backup-'+this.state.mode+'-'+iso(new Date())+'.json');this.flash('Backup exportado. Guarde o arquivo em local seguro.');}
 exportCSV(){const s=['data;descricao;tipo;valor;categoria',...this.state.data.transactions.map(t=>[t.date,'"'+t.description.replace(/"/g,'""')+'"',t.kind,moneyString(t.amount),t.category].join(';'))].join('\r\n');download(new Blob(['\ufeff'+s],{type:'text/csv;charset=utf-8'}),'meu-financeiro-extrato.csv');}
 async importJSON(file:File){try{const d=safeData(JSON.parse(await file.text()));if(!confirm('Substituir todos os dados do modo '+(this.state.mode==='real'?'pessoal':'demonstração')+' pelo backup selecionado?'))return;this.updateData(d,'Backup restaurado.');}catch(e:any){this.flash('Não foi possível importar o backup: '+e.message);}}
 async importCSV(file:File){try{const bytes=await file.text();let lines=bytes.replace(/^\ufeff/,'').trim().split(/\r?\n/);if(lines.length<2)throw new Error('Arquivo vazio.');const separator=lines[0].includes(';')?';':',';const header=splitCSV(lines.shift()||'',separator).map(x=>x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim());const find=(...aliases:string[])=>header.findIndex(x=>aliases.includes(x));const di=find('data','date'),de=find('descricao','historico','description'),va=find('valor','amount'),ca=find('categoria','category'),ki=find('tipo','kind');if(di<0||de<0||va<0)throw new Error('Use colunas data, descricao e valor.');const found=new Set(this.state.data.transactions.map(x=>[x.date,x.description,x.kind,x.amount].join('|')));const add:Tx[]=[];for(const [i,line] of lines.entries()){if(!line.trim())continue;const row=splitCSV(line,separator);let date=(row[di]||'').trim();if(/^\d{2}\/\d{2}\/\d{4}$/.test(date)){let [d,m,y]=date.split('/');date=y+'-'+m+'-'+d;}let value=parseMoney(row[va]||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(value)||value===0)throw new Error('Linha '+(i+2)+' com data ou valor inválido.');const description=(row[de]||'').trim();if(!description)throw new Error('Linha '+(i+2)+' sem descrição.');const csvKind=(row[ki]||'').trim().toLowerCase();const kind:Kind=['expense','despesa','saida','saída'].includes(csvKind)?'expense':(['income','receita','entrada'].includes(csvKind)?'income':(value>=0?'income':'expense'));const tr={id:'csv-'+Date.now()+'-'+i,date,description,kind,amount:Math.abs(value),category:(this.getCategories().some(c=>c.name===(row[ca]||'').trim())?(row[ca]||'').trim():(findCategoryRule(description,'manual',this.state.rules)||'Outros')),origin:'csv'};const key=[tr.date,tr.description,tr.kind,tr.amount].join('|');if(!found.has(key)){found.add(key);add.push(tr);}}
 this.updateData({...this.state.data,transactions:[...this.state.data.transactions,...add]},add.length+' novos lançamentos importados.');}catch(e:any){this.flash('CSV: '+e.message);}}
 async runSim(){
  const amount=parseMoney(this.state.sim.value),n=Number(this.state.sim.installments);
  const rate=Number(this.state.sim.interest.trim().replace(',','.'));
  if(!Number.isSafeInteger(amount)||amount<=0)return this.setState({outcome:{error:'Informe um valor válido para a compra.'}});
  if(!Number.isInteger(n)||n<1||n>60||!Number.isFinite(rate)||rate<0||rate>30)return this.setState({outcome:{error:'Confira as parcelas e a taxa de juros (0 a 30% ao mês).'}});
  if(!desktop||this.state.mode==='demo')return this.setState({outcome:simulate(this.state.data,this.state.sim)});
  this.setState({outcome:null});
  try {const result=await desktop.planSimulate({amount,installments:n,monthlyRate:rate,firstDueDate:this.state.sim.firstDueDate||null,includeEstimatedIncome:false});this.setState({outcome:result});}
  catch(e:any){this.setState({outcome:{error:'Não foi possível simular: '+String(e?.message||e)}});}
 }
 field(label:string,el:any,hint?:string){return h('label',{className:'field'},h('span',{},label),el,hint?h('small',{},hint):null);}
 navItem(page:string,icon:string,label:string){return h('button',{key:page,className:'nav-item '+(this.state.page===page?'active':''),onClick:()=>this.navigate(page)},h(Icon,{name:icon,size:19}),h('span',{},label));}
 renderSide(){return h('aside',{className:'sidebar'},
   h('div',{className:'brand'},h(Logo),h('div',{className:'brand-text'},h('strong',{},'Meu Financeiro'),h('small',{},'SEU DINHEIRO. MAIS INTELIGENTE.'))),
   h('div',{className:'side-label'},'SEU ESPAÇO'),
   h('nav',{},this.navItem('overview','home','Visão geral'),this.navItem('transactions','wallet','Movimentações'),
     this.navItem('planning','calendar','Planejamento'),this.navItem('budgets','pie','Orçamentos'),
     this.navItem('assistant','cart','Simular compra'),this.navItem('banks','bank','Minhas contas')),
   h('div',{className:'side-bottom'},
     this.navItem('settings','settings','Configurações'),
     h('div',{className:'privacy-note'},h(Icon,{name:'shield',size:19}),h('div',{},h('b',{},'Privado e local'),h('small',{},'Seus dados ficam neste computador'))),
     h('button',{className:'demo-btn',onClick:()=>this.toggleMode()},h(Icon,{name:this.state.mode==='real'?'spark':'home',size:18}),this.state.mode==='real'?'Explorar demonstração':'Voltar aos meus dados'),
     h('small',{className:'app-version'},'Meu Financeiro · v0.9.2')));
 }

 renderTop(){
 const labels:{[s:string]:string}={overview:'Visão geral',planning:'Planejamento',transactions:'Movimentações',
  budgets:'Orçamentos',assistant:'Simular compra',settings:'Configurações',banks:'Minhas contas'};
 const period=dateSpan(this.state.overviewPeriod,this.state.customStart,this.state.customEnd);
 const months=Array.from({length:45},(_,i)=>shiftMonth(nowYM,3-i)).map(m=>({value:m,label:prettyMonth(m)}));
 const configured=this.state.mode==='real'&&this.state.bank.config.configured;
 const last=this.state.bank.data.last?.completedAt;
 const periodControl=(this.state.page==='overview'||this.state.page==='transactions'&&!this.state.txReviewOnly&&!this.state.txOrganize);
 return h('header',{className:'topbar'},
   h('div',{className:'top-left'},h('div',{className:'page-kicker'},'FINANÇAS PESSOAIS / '+(labels[this.state.page]||'').toUpperCase()),
     h('h1',{},labels[this.state.page]),h('p',{},this.state.page==='overview'?'Entenda seus períodos e tome decisões com mais clareza.':
     this.state.page==='assistant'?'Antes de comprar, entenda o impacto nos seus compromissos.':'Seu dinheiro organizado, do jeito que faz sentido para você.')),
   h('div',{className:'header-actions'},
     h('div',{className:'mf-quick-add'},h('button',{className:'primary-button mf-quick-trigger','aria-expanded':this.state.quickAddOpen,
       onClick:()=>this.setState({quickAddOpen:!this.state.quickAddOpen})},h(Icon,{name:'plus',size:16}),'Adicionar'),
       this.state.quickAddOpen?h('div',{className:'mf-quick-menu'},
         h('button',{onClick:()=>this.openQuickEntry('expense')},'Nova despesa'),
         h('button',{onClick:()=>this.openQuickEntry('income')},'Nova receita'),
         h('button',{onClick:()=>{this.setState({quickAddOpen:false});this.openPlan(undefined,'expense');}},'Compromisso futuro')):null),
     periodControl?h('div',{className:'overview-period-controls'},
       h(PeriodPicker,{mode:this.state.overviewPeriod,span:period,onChange:(m:PeriodMode,a?:string,b?:string)=>this.setSharedPeriod(m,a,b)}),
       this.state.page==='overview'&&configured?h('button',{type:'button',className:'mf-refresh-button',disabled:this.state.bankBusy,onClick:()=>this.syncBank(false),
         title:last?'Última consulta: '+new Date(last).toLocaleString('pt-BR'):'Ainda não sincronizado'},h(Icon,{name:'refresh',size:16}),this.state.bankBusy?'Atualizando…':'Atualizar'):null):
       this.state.page==='budgets'?h(StyledSelect,{wrapperClass:'month-dropdown',className:'mf-month-trigger',value:this.state.month,
         options:months,ariaLabel:'Mês do orçamento',onChange:(v:string)=>this.setSharedMonth(v)}):
       this.state.page==='planning'?h('span',{className:'p-top-hint'},'Planejamento mensal'):null,
     h('span',{className:'mode-tag '+(this.state.mode==='demo'?'mode-demo':'')},h('i',{}),this.state.mode==='demo'?'DEMONSTRAÇÃO':'DADOS LOCAIS')));
 }

 renderSourcePicker(){
   const bankAvailable=this.state.mode==='real'&&this.state.bank.data.accounts.length>0;
   if(!bankAvailable)return h('p',{className:'mf-source-note'},'Fonte: lançamentos adicionados por você. Nenhuma conta bancária conectada.');
   return h('div',{className:'source-picker'},h('strong',{},'Fonte dos indicadores:'),
      h('button',{className:this.state.dashboardSource==='bank'?'selected':'',onClick:()=>this.setState({dashboardSource:'bank'})},'Contas conectadas'),
      h('button',{className:this.state.dashboardSource==='manual'?'selected':'',onClick:()=>this.setState({dashboardSource:'manual'})},'Registros manuais'),
      h('span',{},'Fontes não são somadas automaticamente.'));
 }
 renderOverview(){const d=this.state.data,period=dateSpan(this.state.overviewPeriod,this.state.customStart,this.state.customEnd);
 const {start,end}=period,bank=this.state.bank;
 const useBank=this.state.mode==='real'&&this.state.dashboardSource==='bank'&&bank.data.accounts.length>0;
 const s=useBank?bankSnapshotBetween(bank,start,end):snapshotBetween(d,start,end);
 const snapshotRange=(a:string,b:string)=>useBank?bankSnapshotBetween(bank,a,b):snapshotBetween(d,a,b);
 const mdata=flowSegments(start,end,snapshotRange);
 const recent=useBank?bank.data.transactions.filter(x=>x.date>=start&&x.date<=end&&x.status==='POSTED'&&effectiveNature(x)!=='ignore'&&effectiveNature(x)!=='transfer').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(x=>({id:'bank-'+x.accountId+'-'+x.id,date:x.date,description:x.merchant||x.description,kind:effectiveNature(x) as Kind,amount:Math.abs(x.amount),category:x.category})):d.transactions.filter(x=>x.date>=start&&x.date<=end).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 const budgetMonth=end.slice(0,7),budgetRangeStart=firstOfMonth(budgetMonth),budgetRangeEnd=endOfMonth(budgetMonth);
 const budgetSnap=snapshotRange(budgetRangeStart,budgetRangeEnd);
 const spent=budgetSnap.expense,totalBudget=this.getCategories().reduce((a:number,k:CategoryInfo)=>a+Number(d.budgets[k.name]||0),0),percent=totalBudget?Math.round(spent/totalBudget*100):0;
 const last=bank.data.last?.completedAt;
 return h('div',{className:'overview-content'},h('div',{className:'mf-plan-callout'},h('div',{},h('span',{className:'micro-label'},'OLHE PARA FRENTE'),h('strong',{},'Seu dinheiro de hoje e os próximos compromissos.'),h('small',{},'Planeje vencimentos, receitas e parcelas em uma linha do tempo.')),h('button',{className:'outlined-action',onClick:()=>this.navigate('planning')},'Abrir planejamento →')),this.renderBankQuick(),
 this.renderSourcePicker(),
 h('div',{className:'period-context'},h(Icon,{name:'calendar',size:15}),h('span',{},'Período: '+period.start.split('-').reverse().join('/')+' a '+period.end.split('-').reverse().join('/')),
    bank.config.configured?h('span',{},this.state.bankBusy?'Buscando atualizações…':'Última consulta: '+(last?new Date(last).toLocaleString('pt-BR'):'não realizada')+' · verificação automática a cada 6h com o app aberto'):null),
 this.state.bankMessage&&bank.config.configured?h('div',{className:'sync-feedback',role:'status'},this.state.bankMessage):null,
 bank.data.truncated?h('div',{className:'sync-feedback',role:'status'},'Atenção: parte das movimentações antigas não está incluída nos indicadores. Consulte o histórico completo nas próximas atualizações.'):null,
 h('div',{className:'stats-grid'},h(Stat,{label:useBank?'Saldo bancário atual':'Saldo manual atual',amount:s.balance,icon:'wallet',hint:useBank?'Saldo informado pela instituição (hoje)':'Saldo inicial + todas as movimentações',featured:true}),h(Stat,{label:'Receitas no período',amount:s.income,icon:'trend',hint:'Entradas confirmadas no intervalo',color:'green'}),h(Stat,{label:'Despesas no período',amount:s.expense,icon:'down',hint:'Saídas confirmadas no intervalo',color:'pink'}),h(Stat,{label:'Resultado no período',amount:s.net,icon:'chart',hint:'Receitas menos despesas no intervalo',color:'purple'})),
 h('div',{className:'mid-grid'},h(Card,{className:'flow-card'},h('div',{className:'card-heading'},h('div',{},h('h2',{},'Fluxo de caixa'),h('p',{},'Evolução dentro do período · '+(useBank?'Banco confirmado':'Registros adicionados por você'))),h('div',{className:'chart-legend'},h('span',{},h('i',{className:'dot-purple'}),'Receitas'),h('span',{},h('i',{className:'dot-pink'}),'Despesas'))),h(Chart,{data:mdata})),h(Card,{className:'donut-card'},h('div',{className:'card-heading'},h('div',{},h('h2',{},'Gastos por categoria'),h('p',{},'Despesas do período selecionado'))),h(Donut,{items:s.categories,colors:Object.fromEntries(this.getCategories().map(c=>[c.name,c.color])),emojis:Object.fromEntries(this.getCategories().map(c=>[c.name,c.emoji]))}))),
 h('div',{className:'bottom-grid'},h(Card,{className:'recent-card'},h('div',{className:'card-heading'},h('div',{},h('h2',{},'Últimas movimentações'),h('p',{},'Histórico recente deste período')),h('button',{className:'text-button',onClick:()=>this.navigate('transactions')},'Ver tudo ',h(Icon,{name:'arrow',size:16}))),recent.length?h('div',{className:'mini-table'},recent.map(t=>h('div',{className:'mini-row',key:t.id},h('div',{className:'mini-icon '+(t.kind==='income'?'good':'')},h(Icon,{name:t.kind==='income'?'trend':'cart'})),h('div',{className:'mini-copy'},h('b',{},t.description),h('small',{},t.category+' · '+t.date.split('-').reverse().join('/'))),h('strong',{className:t.kind==='income'?'good-text':'bad-text'},(t.kind==='income'?'+':'−')+fmt(t.amount))))):h('div',{className:'empty-mini'},h(Icon,{name:'wallet',size:29}),h('b',{},'Ainda sem movimentações'),h('span',{},'Nenhuma movimentação no período selecionado.'))),
 h(Card,{className:'budget-card'},h('div',{className:'card-heading'},h('div',{},h('h2',{},'Seu orçamento'),h('p',{},'Acompanhamento mensal · '+prettyMonth(budgetMonth))),h('span',{className:'muted-label'},totalBudget?'Limite mensal definido':'Sem limites')),h('div',{className:'budget-headline'},h('div',{},h('small',{},'Utilizado no mês de '+prettyMonth(budgetMonth)),h('strong',{},fmt(spent))),h('div',{className:'budget-percent'},totalBudget?percent+'%':'—')),h('div',{className:'progress-track'},h('div',{className:'progress-bar',style:{width:Math.min(100,percent)+'%'}})),h('div',{className:'progress-foot'},h('span',{},totalBudget?fmt(Math.max(0,totalBudget-spent))+' restantes':'Defina limites nas categorias'),h('span',{},totalBudget?fmt(totalBudget)+' total':'')),h('button',{className:'outlined-action',onClick:()=>{this.setState({month:budgetMonth});this.navigate('budgets');}},'Gerenciar orçamento',h(Icon,{name:'arrow',size:16})))));
 }
 renderTransactions(){
   const review=this.state.txReviewOnly;
   const rows=(this.state.mode==='demo'?[]:this.state.bank.data.transactions||[]);
   const manual=this.state.data.transactions;
   const term=fold(this.state.query);
   const filters=(t:{date:string;description:string;category:string;account:string;merchant?:string})=>
     (review||(t.date>=dateSpan(this.state.overviewPeriod,this.state.customStart,this.state.customEnd).start&&t.date<=dateSpan(this.state.overviewPeriod,this.state.customStart,this.state.customEnd).end))&&
     (!term||[t.description,t.category,t.account,t.merchant||''].some(v=>fold(v).includes(term)));
   type Row={key:string;origin:'bank'|'manual';date:string;description:string;merchant:string;category:string;amount:number;account:string;status:string;raw:BankTx|Tx};
   const bankRows:Row[]=rows.filter(t=>!review||!t.reviewed).map(t=>({key:t.accountId+'|'+t.id,origin:'bank',date:t.date,description:t.description,merchant:t.customTitle||t.merchant||'',category:t.category,amount:t.amount,account:t.accountName,status:t.status,raw:t}));
   const manualRows:Row[]=review?[]:manual.map(t=>({key:'manual|'+t.id,origin:'manual',date:t.date,description:t.description,merchant:'',category:t.category,amount:t.kind==='income'?t.amount:-t.amount,account:'Adicionado por você',status:'POSTED',raw:t}));
   const filtered=bankRows.concat(manualRows).filter(t=>(!this.state.bankFilter||(t.origin==='bank'&&(t.raw as BankTx).accountId===this.state.bankFilter))&&(review||this.state.txSource==='all'||t.origin===this.state.txSource)&&filters(t)).sort((a,b)=>b.date.localeCompare(a.date)||a.key.localeCompare(b.key));
   const shown=filtered.slice(0,500),count=rows.filter(t=>!t.reviewed).length;
   const cats=this.getCategories();
   const selected=this.state.txSelected;
   return h('div',{className:'section mf-tx-section'},
     !review&&this.state.bank.data.suspectedDuplicates?.length?h(Card,{className:'mf-duplicate-banner'},
       h('div',{},h('b',{},'Possíveis movimentações repetidas ('+this.state.bank.data.suspectedDuplicates.length+')'),
         h('p',{},'Encontramos registros semelhantes em conexões diferentes. Confira antes de revisar: os valores não foram removidos ou mesclados.')),
       this.state.bank.data.suspectedDuplicates.slice(0,3).map(d=>h('div',{className:'mf-duplicate-row',key:d.pairKey},
         h('span',{},d.date.split('-').reverse().join('/')+' · '+d.description+' · '+fmt(Math.abs(d.amount))),
         h('button',{className:'ghost-button',onClick:()=>this.dismissBankDuplicate(d.pairKey)},'Ignorar aviso')))):null,
     review?h(Card,{className:'mf-review-banner'},h('div',{},h('span',{className:'micro-label'},'SUA CAIXA DE REVISÃO'),h('h2',{},count?count+' movimentações para conferir':'Tudo organizado! 🎉'),h('p',{},count?'Verifique categorias, transferências e estabelecimentos. Nada será alterado sem sua confirmação.':'Novas movimentações aparecerão aqui depois da próxima atualização.')),h('button',{className:'outlined-action',onClick:()=>this.navigate('transactions')},'Ver todas as movimentações')):null,
     h('div',{className:'panel-toolbar'},
       h('div',{className:'search-box'},h(Icon,{name:'search',size:18}),h('input',{value:this.state.query,placeholder:'Buscar por nome, categoria ou conta...',onChange:(e:any)=>this.setState({query:e.target.value})})),
       h('div',{className:'toolbar-actions'},
         !review?h(StyledSelect,{className:'form-control bank-filter',value:this.state.txSource,options:[{value:'all',label:'Todas as origens'},{value:'bank',label:'Contas conectadas'},{value:'manual',label:'Adicionadas por você'}],onChange:(v:string)=>this.setState({txSource:v})}):null,
         this.state.bank.data.accounts.length>1||this.state.bankFilter?h(StyledSelect,{className:'form-control bank-filter',value:this.state.bankFilter,
           options:[{value:'',label:'Todas as contas'},...this.state.bank.data.accounts.map(a=>({value:a.id,label:a.name}))],
           onChange:(v:string)=>this.setState({bankFilter:v})}):null,
         !review?h('button',{className:'ghost-button',onClick:()=>this.csvInput?.click()},h(Icon,{name:'upload',size:17}),'Importar CSV'):null,
         !review?h('button',{className:'primary-button',onClick:()=>this.setState({showEntry:true,entryCategoryTouched:false})},h(Icon,{name:'plus',size:18}),'Novo lançamento'):null)),
     selected.length?h(Card,{className:'mf-bulk-toolbar'},
       h('b',{},selected.length+' selecionada(s)'),
       h(StyledSelect,{value:this.state.txBatchCategory,options:cats.map(c=>({value:c.name,label:c.emoji+' '+c.name})),onChange:(value:string)=>this.setState({txBatchCategory:value})}),
       h('button',{className:'ghost-button',disabled:this.state.detailBusy,onClick:()=>this.applyBankBatch({category:this.state.txBatchCategory})},'Aplicar categoria'),
       h('button',{className:'primary-button',disabled:this.state.detailBusy,onClick:()=>this.applyBankBatch({reviewed:true})},'Marcar revisadas'),
       h('button',{className:'mf-small-link',onClick:()=>this.setState({txSelected:[]})},'Limpar seleção')):null,
     h(Card,{className:'table-card'},
       h('div',{className:'list-intro'},h('div',{},h('h2',{},review?'Para revisar':'Suas movimentações'),h('p',{},filtered.length+' resultados'+(review?' em todos os períodos':' · '+spanLabel(this.state.overviewPeriod,dateSpan(this.state.overviewPeriod,this.state.customStart,this.state.customEnd))))),h('span',{className:'caption-pill'},review?'Caixa de revisão':'Histórico')),
       !review?h('p',{className:'muted-desc',style:{padding:'0 20px 14px'}},'Clique em uma movimentação para ver detalhes, dividir uma compra ou vincular um lançamento.'):null,
       h('div',{className:'table-scroller'},h('table',{},
         h('thead',{},h('tr',{},['','DATA','MOVIMENTAÇÃO','CATEGORIA','ORIGEM','SITUAÇÃO','VALOR','AÇÃO'].map((n,i)=>h('th',{key:i},n)))),
         h('tbody',{},shown.length?shown.map(t=>{
           const bank=t.origin==='bank',v=t.raw as BankTx,category=cats.find(c=>c.name===t.category);
           return h('tr',{key:t.key},
             h('td',{},bank?h('input',{type:'checkbox',className:'mf-check',checked:this.bankTxSelected(v),title:'Selecionar para ação em lote',onChange:()=>this.toggleSelected(v)}):null),
             h('td',{className:'muted'},t.date.split('-').reverse().join('/')),
             h('td',{},h('button',{className:'mf-row-detail',title:'Abrir detalhes',onClick:()=>bank?this.openBankDetail(v):this.openManualDetail(t.raw as Tx)},
               h('span',{className:'mf-row-emoji'},category?.emoji||'✨'),h('span',{},h('b',{},t.merchant||t.description),t.merchant&&t.merchant!==t.description?h('small',{},t.description):null,
                bank&&v.linkedManualId?h('small',{className:'mf-linked'},'✓ Conferido com lançamento manual'):null))),
             h('td',{},h('span',{className:'category-tag'},(category?.emoji||'✨')+' '+t.category),bank&&v.splits?.length?h('small',{className:'mf-muted-block'},'Dividida em '+v.splits.length+' partes'):null),
             h('td',{},t.account),
             h('td',{},bank?h('span',{className:'mf-status-group'},h('span',{className:'kind-pill '+(t.amount>=0?'income':'expense')},t.status==='PENDING'?'Pendente':v.reviewed?'Revisada':'A conferir'),effectiveNature(v)==='transfer'?h('small',{},'Transferência'):effectiveNature(v)==='ignore'?h('small',{},'Desconsiderada'):null):h('span',{className:'kind-pill'},'Manual')),
             h('td',{className:t.amount>=0?'good-text amount-cell':'amount-cell'},(t.amount>=0?'+':'−')+fmt(Math.abs(t.amount))),
             h('td',{},bank&&!v.reviewed?h('button',{className:'mf-quick-review',disabled:this.state.detailBusy,onClick:()=>this.markBankReviewed(v),title:'Conferir esta movimentação sem abrir detalhes'},'✓ Revisar'):null)
           );
         }):h('tr',{},h('td',{colSpan:8,className:'empty-table'},review?'Não há movimentações para revisar.':'Não há movimentações neste período.')))))));
 }
 renderCategories(){
   const categories=this.getCategories(),rules=this.state.rules,e=this.state.categoryEditor,r=this.state.ruleEditor;
   const preview=findCategoryRule(this.state.ruleTest,'bank',rules);
   return h('div',{className:'section categories-page'},
     h('div',{className:'intro-banner'},h('div',{},h('span',{className:'micro-label'},'ORGANIZAÇÃO AUTOMÁTICA'),h('h2',{},'Seu dinheiro, suas categorias.'),h('p',{},'Personalize os nomes e cores, crie regras por descrição e ajuste lançamentos individualmente. Tudo funciona localmente, sem IA paga.')),h('div',{className:'banner-orb'},h(Icon,{name:'filter',size:46}))),
     this.state.mode==='demo'?h(Card,{className:'settings-card'},h('h2',{},'Modo demonstração'),h('p',{},'A edição de regras e categorias está disponível somente nos seus dados pessoais.'),h('button',{className:'primary-button',onClick:()=>this.toggleMode()},'Voltar aos meus dados')):
     h('div',{className:'categories-layout'},
       h(Card,{className:'settings-card'},
         h('div',{className:'card-heading'},h('div',{},h('h2',{},'Categorias personalizadas'),h('p',{},'As categorias padrão podem mudar de cor. Categorias criadas por você podem ser renomeadas.'))),
         h('div',{className:'category-list'},categories.map(cat=>h('div',{className:'category-list-row',key:cat.name},
           h('span',{className:'category-emoji-icon',style:{background:cat.color+'20',borderColor:cat.color+'70'}},cat.emoji||'✨'),h('b',{},cat.name),cat.builtIn?h('small',{className:'muted'},'Padrão'):null,
           h('button',{className:'small-link',onClick:()=>this.setState({categoryEditor:{previousName:cat.name,name:cat.name,color:cat.color,emoji:cat.emoji||'✨'}})},'Editar'),
           !cat.builtIn?h('button',{className:'trash-button',title:'Excluir categoria sem uso',onClick:()=>this.deleteCategory(cat.name)},h(Icon,{name:'trash',size:16})):null))),
         h('h3',{},e.previousName?'Editar categoria':'Criar categoria'),
         this.field('Nome',h('input',{className:'form-control',value:e.name,maxLength:50,placeholder:'Ex.: Pets, Delivery, Estudos',disabled:!!(e.previousName&&categories.find(c=>c.name===e.previousName)?.builtIn),onChange:(v:any)=>this.setState({categoryEditor:{...e,name:v.target.value}})})),
         h('div',{className:'category-appearance'},
           h('div',{className:'category-preview',style:{borderColor:e.color+'75'}},
             h('span',{className:'category-preview-icon',style:{background:e.color+'26',boxShadow:'0 0 24px '+e.color+'25'}},e.emoji||'✨'),
             h('div',{},h('small',{},'PRÉVIA DA CATEGORIA'),h('strong',{},e.name.trim()||'Minha categoria'),h('span',{},'Você escolhe como organizar cada gasto.'))),
           h('div',{className:'appearance-label'},h('b',{},'Escolha um emoji'),h('span',{},'Um símbolo para reconhecer rapidamente seus gastos')),
           h('div',{className:'emoji-grid',role:'group','aria-label':'Escolha um emoji'},(this.state.categoryMoreEmojis?EMOJI_OPTIONS:Array.from(new Set([...EMOJI_OPTIONS.slice(0,18),e.emoji]))).map(emoji=>h('button',{type:'button',key:emoji,
             className:'emoji-choice '+(e.emoji===emoji?'selected':''),'aria-label':'Usar emoji '+emoji,'aria-pressed':e.emoji===emoji,
             onClick:()=>this.setState({categoryEditor:{...e,emoji}})},emoji))),
           h('button',{className:'mf-small-link',type:'button',onClick:()=>this.setState({categoryMoreEmojis:!this.state.categoryMoreEmojis})},this.state.categoryMoreEmojis?'Mostrar menos emojis':'Explorar todos os emojis'),
           h('div',{className:'appearance-label'},h('b',{},'Sua paleta de cores'),h('span',{},'Cores que combinam com o tema escuro')),
           h('div',{className:'color-grid',role:'group','aria-label':'Escolha uma cor'},COLOR_OPTIONS.map(color=>h('button',{key:color,type:'button',
             className:'color-choice '+(e.color===color?'selected':''),style:{background:color},'aria-label':'Cor '+color,'aria-pressed':e.color===color,
             onClick:()=>this.setState({categoryEditor:{...e,color}})},e.color===color?'✓':null))),
           h('label',{className:'custom-color-label'},'Cor personalizada (opcional)',h('input',{key:e.previousName+'-'+e.color,className:'color-hex-input',defaultValue:e.color,
             maxLength:7,spellCheck:false,placeholder:'#884bff',onBlur:(v:any)=>{const color=String(v.target.value).trim();if(/^#[0-9a-fA-F]{6}$/.test(color))this.setState({categoryEditor:{...e,color:color.toLowerCase()}});else v.target.value=e.color;},onKeyDown:(v:any)=>{if(v.key==='Enter')v.currentTarget.blur();}}))
         ),
         h('div',{className:'toolbar-actions'},h('button',{className:'primary-button',onClick:()=>this.saveCategory()},e.previousName?'Salvar alterações':'Adicionar categoria'),e.previousName?h('button',{className:'ghost-button',onClick:()=>this.setState({categoryEditor:{previousName:'',name:'',color:'#884bff',emoji:'✨'}})},'Cancelar edição'):null)),
       h(Card,{className:'settings-card'},
         h('div',{className:'card-heading'},h('div',{},h('h2',{},'Regras automáticas'),h('p',{},'Ex.: descrição contém IFOOD → Alimentação. Menor prioridade vence; empate segue a regra mais antiga.'))),
         h('div',{className:'rule-list'},rules.length?rules.map(rule=>h('div',{className:'rule-list-row',key:rule.id},
           h('div',{},h('strong',{},rule.pattern),h('small',{},(rule.matchMode==='exact'?'Texto exato':rule.matchMode==='starts'?'Começa com':'Contém')+' · '+(rule.scope==='both'?'Banco e manuais':rule.scope==='bank'?'Banco':'Manuais')+' · Prioridade '+rule.priority)),
           h('span',{className:'category-tag'},rule.category),
           h('button',{className:'small-link',onClick:()=>this.setState({ruleEditor:{id:rule.id,pattern:rule.pattern,matchMode:rule.matchMode,category:rule.category,scope:rule.scope,priority:String(rule.priority)}})},'Editar'),
           h('button',{className:'trash-button',title:'Excluir regra',onClick:()=>this.deleteRule(rule.id)},h(Icon,{name:'trash',size:16})))):h('p',{className:'muted-desc'},'Nenhuma regra criada. Cadastre a primeira abaixo.')),
         h('div',{className:'rule-suggestions'},h('small',{},'Modelos rápidos:'),[
             {pattern:'IFOOD',category:'Alimentação'},
             {pattern:'UBER',category:'Transporte'},
             {pattern:'NETFLIX',category:'Assinaturas'},
             {pattern:'SPOTIFY',category:'Assinaturas'}
           ].map(x=>h('button',{className:'ghost-button',key:x.pattern,onClick:()=>this.setState({ruleEditor:{...emptyRule(),pattern:x.pattern,category:x.category}})},x.pattern))),
         h('h3',{},r.id?'Editar regra':'Nova regra'),
         this.field('Texto da movimentação',h('input',{className:'form-control',placeholder:'Ex.: IFOOD, UBER, NETFLIX',maxLength:120,value:r.pattern,onChange:(v:any)=>this.setState({ruleEditor:{...r,pattern:v.target.value}})})),
         h('div',{className:'two-inputs'},
           this.field('Correspondência',h(StyledSelect,{className:'form-control',value:r.matchMode,options:[{value:'contains',label:'Contém'},{value:'starts',label:'Começa com'},{value:'exact',label:'Texto exato'}],onChange:(value:string)=>this.setState({ruleEditor:{...r,matchMode:value as RuleEditor['matchMode']}})})),
           this.field('Aplicar em',h(StyledSelect,{className:'form-control',value:r.scope,options:[{value:'both',label:'Bancos e novos manuais'},{value:'bank',label:'Só banco'},{value:'manual',label:'Só novos manuais'}],onChange:(value:string)=>this.setState({ruleEditor:{...r,scope:value as RuleEditor['scope']}})}))),
         h('div',{className:'two-inputs'},
           this.field('Categoria',h(StyledSelect,{className:'form-control',value:r.category,options:categories.map(c=>({value:c.name,label:(c.emoji||'✨')+'  '+c.name})),onChange:(value:string)=>this.setState({ruleEditor:{...r,category:value}})})),
           this.field('Prioridade (1 = mais alta)',h('input',{className:'form-control',type:'number',min:1,max:999,value:r.priority,onChange:(v:any)=>this.setState({ruleEditor:{...r,priority:v.target.value}})}))),
         h('div',{className:'toolbar-actions'},h('button',{className:'primary-button',onClick:()=>this.saveRule()},r.id?'Atualizar regra':'Salvar regra'),r.id?h('button',{className:'ghost-button',onClick:()=>this.setState({ruleEditor:emptyRule()})},'Cancelar edição'):null),
         h('div',{className:'rule-preview'},h('b',{},'Testar classificação'),h('input',{className:'form-control',value:this.state.ruleTest,placeholder:'Digite uma descrição do extrato',onChange:(v:any)=>this.setState({ruleTest:v.target.value})}),h('p',{},'Resultado: ',h('strong',{},preview||'Sem regra correspondente (Outros)'))))),
     this.state.categoryMessage?h('p',{className:'bank-feedback',role:'status'},this.state.categoryMessage):null,
     h('p',{className:'muted-desc'},'Regras reclassificam imediatamente o extrato bancário na visualização, inclusive dados já sincronizados. Correções individuais do banco sempre prevalecem. Lançamentos manuais antigos preservam sua categoria; regras automáticas ajudam em novos lançamentos e importações sem categoria.'));
 }
 renderBudgets(){const s=this.state.mode==='real'&&this.state.dashboardSource==='bank'&&this.state.bank.data.accounts.length?bankSnapshot(this.state.bank,this.state.month):this.monthData(),d=this.state.data;return h('div',{className:'section'},h('div',{className:'intro-banner'},h('div',{},h('span',{className:'micro-label'},'PLANEJAMENTO'),h('h2',{},'Cada categoria no seu controle.'),h('p',{},'Defina um limite por categoria. Esses valores não movimentam seu saldo; servem apenas para acompanhar gastos.')),h('div',{className:'banner-orb'},h(Icon,{name:'pie',size:46}))),this.renderSourcePicker(),h('p',{className:'mf-budget-context'},'Período de comparação: '+prettyMonth(this.state.month)+' · limites mensais por categoria.'),h('div',{className:'budget-grid'},this.getCategories().map((info,i)=>{const cat=info.name;const spent=s.categories.find(x=>x.name===cat)?.total||0,limit=d.budgets[cat]||0,pct=limit?Math.round(spent/limit*100):0;return h(Card,{className:'budget-item',key:cat},h('div',{className:'budget-item-top'},h('span',{className:'cat-symbol',style:{background:info.color+'28',color:info.color}},info.emoji||'✨'),h('div',{},h('h3',{},cat),h('small',{},'Gasto atual: '+fmt(spent)))),h('div',{className:'budget-item-value'},h('strong',{},fmt(limit)),h('span',{},'limite mensal')),h('div',{className:'progress-track'},h('div',{className:'progress-bar',style:{background:info.color,width:Math.min(pct,100)+'%'}})),h('div',{className:'budget-item-bottom'},h('span',{className:pct>100?'bad-text':''},limit?pct+'% utilizado':'Sem limite definido'),h('button',{className:'small-link',onClick:()=>this.setState({editModal:{type:'budget',key:cat,title:'Limite mensal · '+cat,value:moneyString(limit)}})},'Editar')));})));
 }
 renderAssistant(includeBanner:boolean=true){const d=this.state.data;const out=this.state.outcome;const examples=[{name:'Notebook',price:'3200',icon:'wallet'},{name:'Celular',price:'2400',icon:'cart'},{name:'Compra pequena',price:'350',icon:'spark'}];return h('div',{className:'section assistant-page'},includeBanner?h('div',{className:'intro-banner assistant-banner'},h('div',{},h('span',{className:'micro-label'},'DECISÕES MAIS CONSCIENTES'),h('h2',{},'Posso comprar isso agora?'),h('p',{},'Compare seu saldo estimado com e sem a compra, incluindo os compromissos cadastrados e a reserva.')),h('div',{className:'banner-orb'},h(Icon,{name:'cart',size:46}))):null,h('div',{className:'assistant-grid'},h(Card,{className:'sim-form-card'},h('div',{className:'card-heading'},h('div',{},h('h2',{},'Sua próxima compra'),h('p',{},'Preencha os dados para analisar')),h('span',{className:'round-purple'},h(Icon,{name:'spark',size:19}))),this.field('Valor do produto (R$)',h('input',{className:'form-control',type:'text',inputMode:'decimal',value:this.state.sim.value,placeholder:'Ex.: 1.499,90',onChange:(e:any)=>this.setState({sim:{...this.state.sim,value:e.target.value}})})),h('div',{className:'two-inputs'},this.field('Número de parcelas',h(StyledSelect,{className:'form-control',value:this.state.sim.installments,options:[1,2,3,4,5,6,8,10,12,18,24,36].map(n=>({value:String(n),label:n===1?'À vista':n+'x'})),onChange:(value:string)=>this.setState({sim:{...this.state.sim,installments:value}})})),this.field('Juros ao mês (%)',h('input',{className:'form-control',type:'text',inputMode:'decimal',value:this.state.sim.interest,onChange:(e:any)=>this.setState({sim:{...this.state.sim,interest:e.target.value}})}))),this.field('Primeiro vencimento',h(SingleDatePicker,{value:this.state.sim.firstDueDate||(()=>{const today=iso(new Date()),[y,m,d]=today.split('-').map(Number);const first=Number(this.state.sim.installments)===1?today:iso(new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate())));return first;})(),onChange:(value:string)=>this.setState({sim:{...this.state.sim,firstDueDate:value}})}),'Pode ser alterado sem criar nenhuma dívida.'),h('button',{className:'primary-button full action-large',onClick:()=>this.runSim()},h(Icon,{name:'spark',size:18}),'Analisar compra'),h('div',{className:'sim-example-title'},'Experimentar com um exemplo'),h('div',{className:'quick-examples'},examples.map(x=>h('button',{className:'quick-choice',onClick:()=>this.setState({sim:{...this.state.sim,value:x.price},outcome:null}),key:x.name},h(Icon,{name:x.icon,size:17}),x.name)))),
 h('div',{className:'result-column'},out?this.renderResult(out):h(Card,{className:'empty-result'},h('span',{className:'empty-result-icon'},h(Icon,{name:'shield',size:40})),h('h2',{},'Uma análise antes da decisão.'),h('p',{},'Descubra o peso da parcela, o custo total e como a compra pode afetar sua reserva financeira nos próximos meses.'),h('div',{className:'result-steps'},h('span',{},'01  Simule'),h('span',{},'02  Compare'),h('span',{},'03  Decida'))),h('div',{className:'info-box'},h(Icon,{name:'shield',size:18}),h('p',{},'A análise funciona por regras matemáticas, sem IA. Quando faltam dados, o aplicativo não afirma que uma compra é segura.')))));
 }
 renderResult(out:any){if(out.error)return h(Card,{className:'result-error'},h(Icon,{name:'alert'}),out.error);
  if(out.engine==='planning'){
    const info:any={risk:['Saldo negativo previsto','As parcelas podem levar o saldo abaixo de zero.','danger'],caution:['Sua reserva fica comprometida','A projeção cai abaixo da reserva definida.','caution'],unknown:['Dados insuficientes ou antigos','Confira suas contas e compromissos antes de decidir.','unknown'],estimate:['Cenário projetado','Os compromissos cadastrados cabem na projeção, mas isso não garante a compra.','caution']};
    const [title,subtitle,cls]=info[out.risk]||info.unknown;
    const quality=out.reference?.quality||'unknown';
    return h(Card,{className:'result-card mf-scenario-result'},
      h('div',{className:'result-badge '+cls},h(Icon,{name:'alert',size:22}),h('div',{},h('h2',{},title),h('p',{},subtitle))),
      h('div',{className:'result-metrics'},
        h('div',{},h('span',{},'Parcela'),h('strong',{},fmt(out.monthly))),
        h('div',{},h('span',{},'Total com juros'),h('strong',{},fmt(out.total))),
        h('div',{},h('span',{},'Menor saldo sem compra'),h('strong',{},fmt(out.baselineMinimum))),
        h('div',{},h('span',{},'Menor saldo com compra'),h('strong',{className:out.minimumAfterPurchase<0?'bad-text':''},fmt(out.minimumAfterPurchase)))),
      h('p',{className:'mf-scenario-alert'},'Dia mais apertado: '+out.worstDay.split('-').reverse().join('/')+' · Reserva considerada: '+fmt(out.reserve)),
      h('div',{className:'future-title'},'Comparação mês a mês'),
      h('div',{className:'future-list'},out.rows.slice(0,12).map((v:any)=>h('div',{key:v.month},h('span',{},prettyMonth(v.month)),h('b',{className:v.withPurchase<0?'bad-text':''},fmt(v.withPurchase)),h('small',{className:'muted'},'Sem compra: '+fmt(v.withoutPurchase))))),
      h('button',{className:'primary-button mf-plan-from-sim',disabled:out.installments>36,onClick:()=>this.planSimulatedPurchase()},'Planejar esta compra'),
      out.installments>36?h('p',{className:'muted-desc'},'Para registrar o compromisso, simule até 36 parcelas.'):null,
      h('p',{className:'disclaimer'},quality==='stale'?'A última leitura do banco está antiga. Atualize as contas antes de tomar decisões. ':quality==='incomplete'?'Há contas sem saldo disponível. A projeção está incompleta. ':quality==='unverified'?'O saldo recebido pode não refletir as movimentações mais recentes. ':'',out.warning));
  }const r=out.risk;const info:any={safe:['Compra confortável','Seu perfil informado indica margem para acomodar a parcela.','safe'],caution:['Atenção ao orçamento','A compra reduz sua margem ou compromete uma parte relevante da renda.','caution'],risk:['Compra arriscada','A projeção pode ultrapassar a margem informada ou comprometer sua reserva.','danger'],unknown:['Dados insuficientes','Defina renda e despesas fixas em Configurações para avaliar o risco.','unknown']};const [title,subtitle,cls]=info[r];const ratios=out.hasProfile?Math.round(out.monthly/this.state.data.settings.income*100):null;return h(Card,{className:'result-card'},h('div',{className:'result-badge '+cls},h(Icon,{name:r==='safe'?'check':'alert',size:22}),h('div',{},h('h2',{},title),h('p',{},subtitle))),h('div',{className:'result-metrics'},h('div',{},h('span',{},'Parcela'),h('strong',{},fmt(out.monthly))),h('div',{},h('span',{},'Custo total'),h('strong',{},fmt(out.total))),h('div',{},h('span',{},'Juros totais'),h('strong',{},fmt(out.total-out.principal))),h('div',{},h('span',{},'Peso na renda'),h('strong',{},ratios===null?'—':ratios+'%'))),h('div',{className:'future-title'},'Projeção dos próximos meses'),h('div',{className:'future-list'},out.rows.slice(0,6).map((v:any)=>h('div',{key:v.month},h('span',{},prettyMonth(v.month)),h('b',{className:v.available<0?'bad-text':''},fmt(v.available))))),h('p',{className:'disclaimer'},'Projeção simplificada: começa no próximo mês e pressupõe os mesmos valores recorrentes informados. Não considera vencimentos diários, renda variável ou pagamentos já lançados. Não é garantia de capacidade de pagamento.'));
 }
 renderBankQuick(){
   if(this.state.mode==='demo')return null;
   const b=this.state.bank,a=b.data.accounts||[],last=b.data.last;
   if(!a.length && !b.config.configured)return null;
   const balance=a.filter(x=>x.balance!==null).reduce((sum,x)=>sum+(x.balance||0),0);
   return h('div',{className:'bank-quick'},h('div',{},h('small',{},'SUAS CONTAS · SALDOS DISPONÍVEIS'),h('strong',{},a.length?fmt(balance):'Conexão configurada'),h('span',{},a.length?a.length+' conta(s) · atualização: '+(last?.completedAt?new Date(last.completedAt).toLocaleString('pt-BR'):'pendente'):'Sincronize para obter suas contas')),
   h('button',{className:'outlined-action',onClick:()=>this.navigate('banks')},'Ver contas bancárias',h(Icon,{name:'arrow',size:16})),
   h('p',{},'Saldos e extratos bancários não são somados aos lançamentos manuais para evitar duplicidades.'),
   b.data.truncated?h('p',{className:'bank-warning'},'Alguns registros antigos não estão incluídos nos totais exibidos. Uma atualização futura ampliará a consulta histórica.'):null);
 }
 renderBanks(){
   if(this.state.mode==='demo')return h('div',{className:'section'},h(Card,{className:'settings-card'},h('h2',{},'Suas contas estão disponíveis nos dados pessoais'),h('p',{className:'muted-desc'},'O modo demonstração é isolado e nunca consulta suas contas bancárias.'),h('button',{className:'primary-button',onClick:()=>this.toggleMode()},'Voltar aos meus dados')));
   if(!desktop)return h('div',{className:'section'},h(Card,{className:'settings-card'},h('h2',{},'Abra o Meu Financeiro'),h('p',{},'Abra a versão instalada para consultar suas contas com segurança.')));
   const b=this.state.bank,c=b.config||EMPTY_BANK.config,accounts=b.data.accounts||[],tx=b.data.transactions||[],f=this.state.bankForm;
   return h('div',{className:'section bank-page'},
     h('div',{className:'intro-banner'},h('div',{},h('span',{className:'micro-label'},'BANCO CONECTADO · LEITURA SOMENTE'),h('h2',{},'Seu extrato direto no Meu Financeiro.'),h('p',{},'Acompanhe saldos e movimentações em um só lugar. Você não precisa informar a senha do seu banco aqui.')),
      h('div',{className:'banner-orb'},h(Icon,{name:'bank',size:46}))),
     h('div',{className:'bank-grid'},
       h(Card,{className:'settings-card'},h('div',{className:'card-heading'},h('div',{},h('h2',{},'Sua conexão bancária'),h('p',{},c.configured?'Acesso conectado e protegido':'Conecte suas contas para acompanhar tudo aqui')),
        h('span',{className:'bank-status '+(c.configured?'enabled':'')},c.configured?'Configurada':'Não configurada')),
        !c.secure?h('p',{className:'bank-warning'},'Não foi possível proteger sua chave neste computador. Evite configurar a conexão agora.'):null,
        c.configured?h('button',{type:'button',className:'bank-details-toggle','aria-expanded':this.state.bankConfigOpen,onClick:()=>this.setState({bankConfigOpen:!this.state.bankConfigOpen})},
          h(Icon,{name:'settings',size:16}),this.state.bankConfigOpen?'Ocultar detalhes da conexão':'Alterar dados da conexão'):null,
        (!c.configured||this.state.bankConfigOpen)?h('div',{className:'bank-settings-details'},
        this.field('Código da aplicação',h('input',{className:'form-control',value:f.clientId,placeholder:'Cole o código de identificação',maxLength:300,autoComplete:'off',onChange:(e:any)=>this.setState({bankForm:{...f,clientId:e.target.value}})})),
        this.field('Chave privada',h('input',{className:'form-control',type:'password',value:f.clientSecret,placeholder:c.configured?'Já protegido — deixe vazio para manter':'Cole sua chave de acesso',maxLength:1000,autoComplete:'new-password',onChange:(e:any)=>this.setState({bankForm:{...f,clientSecret:e.target.value}})})),
        this.field('Código da conexão (separe por vírgula, se houver mais de uma)',h('textarea',{className:'form-control bank-item-field',value:f.itemIds,rows:2,placeholder:'Cole o código da conta autorizada',onChange:(e:any)=>this.setState({bankForm:{...f,itemIds:e.target.value}})}), 'Use os códigos fornecidos ao autorizar a conexão. Nunca informe sua senha bancária.'),
        h('div',{className:'bank-actions'},h('button',{className:'primary-button',disabled:!c.secure||this.state.bankBusy,onClick:()=>this.configureBank()},h(Icon,{name:'shield',size:17}),'Salvar conexão'))
        ):null,
        h('div',{className:'bank-actions'},h('button',{className:'outlined-action full',disabled:!c.configured||this.state.bankBusy,onClick:()=>this.syncBank()},h(Icon,{name:'refresh',size:17}),this.state.bankBusy?'Atualizando…':'Atualizar minhas contas')),
        h('div',{className:'privacy-small'},h(Icon,{name:'shield',size:17}),'Sua chave é protegida neste computador e não faz parte das cópias de segurança.'),
        c.configured?h('button',{className:'bank-forget',onClick:()=>this.forgetBank(),disabled:this.state.bankBusy},'Desconectar conta deste computador'):null,
        this.state.bankMessage?h('p',{className:'bank-feedback',role:'status'},this.state.bankMessage):null),
       h(Card,{className:'settings-card'},h('h2',{},'Resumo da sincronização'),
         h('div',{className:'bank-metric-list'},h('div',{},h('span',{},'Contas bancárias'),h('strong',{},String(accounts.length))),h('div',{},h('span',{},'Movimentações no histórico local'),h('strong',{},String(b.data.totalTransactions??tx.length))),h('div',{},h('span',{},'Última sincronização'),h('strong',{},b.data.last?.completedAt?new Date(b.data.last.completedAt).toLocaleString('pt-BR'):'Nunca')),
           h('div',{},h('span',{},'Novas na última consulta'),h('strong',{},String(b.data.last?.newCount??'—')))),
         h('p',{className:'muted-desc'},'As instituições podem demorar para enviar novas movimentações. Atualizar busca as informações mais recentes disponíveis.'),
         h('div',{className:'info-box'},h(Icon,{name:'alert',size:19}),h('p',{},'As movimentações do banco não são misturadas automaticamente aos lançamentos adicionados por você. Isso evita despesas em duplicidade.')),
         (b.data.items||[]).map(x=>h('div',{className:'bank-item-info',key:x.itemId},h('b',{},(!x.institution||x.institution==='Meu Pluggy'?'Conta conectada':x.institution)),h('small',{},'Situação: '+(x.status==='UPDATED'?'Atualizada':x.status==='UPDATING'?'Atualizando':x.status==='LOGIN_ERROR'?'Precisa reconectar':'Verifique sua conexão')),h('small',{},'Consentimento: '+(x.consentExpiresAt?new Date(x.consentExpiresAt).toLocaleDateString('pt-BR'):'conforme seu banco')))))),
     accounts.length?h('div',{className:'bank-account-grid'},accounts.map(a=>h(Card,{className:'bank-account',key:a.id},h('div',{className:'bank-account-icon'},h(Icon,{name:'bank',size:22})),h('small',{},a.name+' · '+(a.subtype||'Conta')),h('strong',{},a.balance===null?'Saldo não disponível':fmt(a.balance)),h('span',{},'Saldo informado pela instituição · não somado ao saldo manual'),h('button',{className:'mf-small-link',onClick:()=>{this.setState({bankFilter:a.id,txSource:'bank'});this.navigate('transactions');}},'Ver movimentações desta conta →')))):null,
     h(Card,{className:'mf-bank-route'},h('div',{},h('h2',{},'Histórico financeiro em um só lugar'),
       h('p',{className:'muted-desc'},'Consulte as transações, revise categorias e veja detalhes em Movimentações. Aqui você gerencia apenas suas conexões e saldos.')),
       h('button',{className:'primary-button',onClick:()=>{this.setState({bankFilter:'',txSource:'bank'});this.navigate('transactions');}},
          'Ver movimentações',h(Icon,{name:'arrow',size:16}))));

 }
 renderSettings(){const d=this.state.data;const entries:[keyof Settings,string,string][]=[['opening','Saldo inicial da conta','Saldo no início do acompanhamento.'],['income','Renda mensal prevista','Use um valor conservador, sem depender de ganhos variáveis.'],['fixed','Despesas fixas mensais','Contas recorrentes previstas, sem incluir parcelas abaixo.'],['existing','Parcelas atuais por mês','Somatório de parcelas ainda em aberto.'],['reserve','Reserva mínima protegida','Valor que deve permanecer disponível.']];return h('div',{className:'section'},h('div',{className:'settings-grid'},h(Card,{className:'settings-card'},h('div',{className:'card-heading'},h('div',{},h('h2',{},'Seu perfil financeiro'),h('p',{},'Base utilizada nas projeções e recomendações'))),entries.map(([key,title,hint])=>h('div',{className:'setting-row',key},h('div',{},h('b',{},title),h('small',{},hint)),h('button',{className:'setting-edit',onClick:()=>this.setState({editModal:{type:'setting',key,title,value:moneyString(d.settings[key])}})},fmt(d.settings[key]),h(Icon,{name:'edit',size:16}))))),h('div',{className:'settings-right'},h(Card,{className:'settings-card'},h('h2',{},'Seus dados e segurança'),h('p',{className:'muted-desc'},desktop?'Seus dados ficam neste computador. A cópia completa inclui contas, categorias e movimentações; as chaves da conexão bancária são protegidas separadamente. Criamos também cópias automáticas locais.':'Seus dados são mantidos neste computador. Salve cópias de segurança regularmente.'),h('button',{className:'outlined-action full',onClick:()=>this.exportJSON()},h(Icon,{name:'download',size:17}),'Exportar lançamentos manuais'),h('button',{className:'outlined-action full',onClick:()=>this.fileInput?.click()},h(Icon,{name:'upload',size:17}),'Importar lançamentos manuais'),desktop?h('button',{className:'outlined-action full',onClick:()=>this.backupDB()},h(Icon,{name:'download',size:17}),'Salvar cópia completa'):null,desktop?h('button',{className:'outlined-action full',onClick:()=>this.restoreDB()},h(Icon,{name:'upload',size:17}),'Restaurar cópia completa'):null,desktop?h('div',{className:'backups-info'},h(Icon,{name:'shield',size:18}),h('div',{},h('b',{},'Cópias automáticas locais'),h('small',{},this.state.backupInfo.last?'Última cópia: '+new Date(this.state.backupInfo.last).toLocaleString('pt-BR')+' · Até 7 datas preservadas':'Uma cópia por dia em que o app estiver aberto.'))):null,desktop?h('button',{className:'outlined-action full',onClick:()=>this.openBackupsFolder()},h(Icon,{name:'folder',size:17}),'Ver minhas cópias automáticas'):null,desktop?h('button',{className:'outlined-action full',onClick:()=>this.openDataDir()},h(Icon,{name:'bank',size:17}),'Abrir pasta dos meus dados'):null,h('div',{className:'privacy-small'},h(Icon,{name:'shield',size:17}),'Seu histórico pessoal permanece no seu computador. A conexão com o banco usa uma chave protegida.')),h(Card,{className:'settings-card'},h('h2',{},'Modo de demonstração'),h('p',{className:'muted-desc'},'O modo de demonstração tem transações fictícias e armazenamento separado dos seus dados pessoais.'),h('button',{className:'outlined-action full',onClick:()=>this.toggleMode()},this.state.mode==='real'?'Entrar na demonstração':'Voltar aos dados pessoais',h(Icon,{name:'arrow',size:16}))))));
 }
 renderDetailDrawer(){
   const selected=this.state.detail;if(!selected)return null;
   const bank=selected.origin==='bank';
   const tx=bank?this.state.bank.data.transactions.find(t=>t.accountId===selected.accountId&&t.id===selected.id):null;
   const manual=!bank?this.state.data.transactions.find(t=>t.id===selected.id):null;
   if(!tx&&!manual)return null;
   const name=tx?.merchant||tx?.description||manual?.description||'';
   const amount=tx?tx.amount:manual?(manual.kind==='income'?manual.amount:-manual.amount):0;
   const category=tx?.category||manual?.category||'Outros';
   const cats=this.getCategories();const cat=cats.find(c=>c.name===category);
   const f=this.state.detailDraft;
   const matchSuggestions=tx&&tx.status==='POSTED'?this.state.data.transactions.filter(m=>m.kind===(tx.amount>=0?'income':'expense')&&m.amount===Math.abs(tx.amount)&&Math.abs((Date.parse(m.date+'T00:00:00Z')-Date.parse(tx.date+'T00:00:00Z'))/86400000)<=3&&!this.state.bank.data.transactions.some(other=>other.linkedManualId===m.id&&(other.id!==tx.id||other.accountId!==tx.accountId))).slice(0,6):[];
   const opposite=tx?this.state.bank.data.transactions.filter(other=>other.accountId!==tx.accountId&&other.amount===-tx.amount&&Math.abs((Date.parse(other.date+'T00:00:00Z')-Date.parse(tx.date+'T00:00:00Z'))/86400000)<=2&&other.status==='POSTED').slice(0,3):[];
   const splitTotal=f.splitParts.reduce((a,p)=>a+parseMoney(p.value),0);
   return h('div',{className:'mf-drawer-backdrop',role:'presentation',onMouseDown:(e:any)=>{if(e.currentTarget===e.target)this.setState({detail:null});}},
     h('aside',{className:'mf-detail-drawer',role:'dialog','aria-modal':'true','aria-label':'Detalhes da movimentação'},
       h('div',{className:'mf-drawer-head'},h('div',{},h('small',{className:'micro-label'},'DETALHES'),h('h2',{},'Movimentação')),h('button',{className:'close-button',title:'Fechar',onClick:()=>this.setState({detail:null})},'×')),
       h('div',{className:'mf-detail-scroll'},
         h('div',{className:'mf-detail-hero'},h('span',{className:'mf-hero-emoji'},cat?.emoji||'✨'),h('h3',{},name),h('strong',{className:amount>=0?'good-text':'bad-text'},(amount>=0?'+':'−')+fmt(Math.abs(amount))),h('span',{},(tx?.date||manual?.date||'').split('-').reverse().join('/')+' · '+(tx?.accountName||'Adicionado por você'))),
         tx?h('div',{className:'mf-detail-section'},h('div',{className:'mf-detail-section-title'},h('b',{},'Organização'),h('span',{className:tx.reviewed?'mf-reviewed':'mf-to-review'},tx.reviewed?'✓ Revisada':'A conferir')),
           h('div',{className:'mf-detail-grid'},
             this.field('Categoria principal',h(StyledSelect,{value:tx.category,options:cats.map(c=>({value:c.name,label:c.emoji+' '+c.name})),onChange:(v:string)=>this.setBankCategory(tx,v)})),
             this.field('Tipo de movimentação',h(StyledSelect,{value:f.nature,options:[{value:'auto',label:'Padrão'},{value:'income',label:'Receita'},{value:'expense',label:'Despesa'},{value:'transfer',label:'Transferência própria'},{value:'ignore',label:'Não contar nas análises'}],onChange:(nature:any)=>this.setState({detailDraft:{...f,nature}})}))),
           this.field('Nome do estabelecimento',h('input',{className:'form-control',value:f.merchant,maxLength:100,placeholder:'Ex.: iFood, Mercado, Academia',onChange:(e:any)=>this.setState({detailDraft:{...f,merchant:e.target.value}})})),
           this.field('Anotações pessoais',h('textarea',{className:'form-control mf-note-input',rows:3,value:f.note,maxLength:600,placeholder:'Opcional: detalhes para lembrar desta compra',onChange:(e:any)=>this.setState({detailDraft:{...f,note:e.target.value}})})),
           h('label',{className:'mf-review-checkbox'},h('input',{type:'checkbox',checked:f.reviewed,onChange:(e:any)=>this.setState({detailDraft:{...f,reviewed:e.target.checked}})}),'Conferi esta movimentação'),
           h('button',{className:'primary-button mf-full-action',disabled:this.state.detailBusy,onClick:()=>this.updateBankInfo()},'Salvar detalhes')):null,
         tx?h('div',{className:'mf-detail-section'},h('b',{},'Reconhecer estabelecimento'),h('p',{className:'muted-desc'},'Aplique o nome escolhido às próximas movimentações com o mesmo trecho de descrição.'),this.field('Trecho que identifica esse estabelecimento',h('input',{className:'form-control',value:f.aliasPattern,maxLength:120,onChange:(e:any)=>this.setState({detailDraft:{...f,aliasPattern:e.target.value}})})),h('button',{className:'outlined-action full',disabled:this.state.detailBusy,onClick:()=>this.createMerchantAlias()},'Usar este nome nas movimentações semelhantes'),
           h('button',{className:'ghost-button',disabled:this.state.detailBusy,onClick:()=>this.createCategoryRuleFromDetail()},'Usar categoria nas movimentações semelhantes'),
           (this.state.bank.data.aliases||[]).filter(a=>fold(tx.description).includes(fold(a.pattern))).map(a=>h('div',{className:'mf-suggestion',key:a.id},h('small',{},'Regra: '+a.pattern+' → '+a.displayName),h('button',{className:'mf-small-link',disabled:this.state.detailBusy,onClick:async()=>{if(!confirm('Remover esta regra de nome?'))return;try{const data=await desktop!.bankDeleteAlias(a.id);this.setState({bank:{...this.state.bank,data}});this.flash('Regra removida.');}catch(e:any){this.flash('Não foi possível remover: '+String(e?.message||e));}}},'Excluir')))):null,
         tx&&tx.amount<0?h('div',{className:'mf-detail-section'},h('b',{},'Dividir compra'),h('p',{className:'muted-desc'},'Distribua o valor entre categorias sem alterar o total da compra original.'),
           tx.splitOutdated?h('p',{className:'mf-inline-warning'},'O banco atualizou o valor desta compra. Revise a divisão antes de aplicá-la novamente.'):null,
           f.splitParts.map((part,i)=>h('div',{className:'mf-split-row',key:i},h(StyledSelect,{value:part.category,options:cats.map(c=>({value:c.name,label:c.emoji+' '+c.name})),onChange:(category:string)=>this.setState({detailDraft:{...f,splitParts:f.splitParts.map((v,j)=>i===j?{...v,category}:v)}})}),h('input',{className:'form-control',value:part.value,inputMode:'decimal',placeholder:'0,00',onChange:(e:any)=>this.setState({detailDraft:{...f,splitParts:f.splitParts.map((v,j)=>i===j?{...v,value:e.target.value}:v)}})}),h('button',{className:'mf-small-link',title:'Remover parte',disabled:f.splitParts.length<=2,onClick:()=>this.setState({detailDraft:{...f,splitParts:f.splitParts.filter((_,j)=>j!==i)}})},'×'))),
           h('div',{className:'mf-detail-split-footer'},h('button',{className:'mf-small-link',disabled:f.splitParts.length>=20,onClick:()=>this.setState({detailDraft:{...f,splitParts:[...f.splitParts,{category:category,value:'0,00'}]}})},'+ Adicionar parte'),h('strong',{className:splitTotal===Math.abs(tx.amount)?'good-text':'bad-text'},fmt(Number.isFinite(splitTotal)?splitTotal:0)+' / '+fmt(Math.abs(tx.amount)))),
           h('div',{className:'mf-action-row'},h('button',{className:'primary-button',disabled:this.state.detailBusy||splitTotal!==Math.abs(tx.amount)||f.splitParts.some(p=>parseMoney(p.value)<=0),onClick:()=>this.saveSplit()},'Salvar divisão'),h('button',{className:'ghost-button',disabled:this.state.detailBusy||!tx.splits?.length,onClick:()=>this.runBankOperation('bankSplit',{accountId:tx.accountId,externalId:tx.id,parts:[]},'Divisão removida.')},'Remover divisão'))):null,
         tx?h('div',{className:'mf-detail-section'},h('b',{},'Conferir com um lançamento seu'),
           tx.linkedManualId?h('div',{className:'mf-suggestion'},h('span',{},'✓ Vinculado a um lançamento que você adicionou'),h('button',{className:'mf-small-link',disabled:this.state.detailBusy,onClick:()=>this.setManualLink(null)},'Desvincular')):
           matchSuggestions.length?matchSuggestions.map(m=>h('div',{className:'mf-suggestion',key:m.id},h('div',{},h('b',{},m.description),h('small',{},m.date.split('-').reverse().join('/')+' · '+fmt(m.amount))),h('button',{className:'ghost-button',disabled:this.state.detailBusy,onClick:()=>this.setManualLink(m.id)},'Vincular'))):h('p',{className:'muted-desc'},'Nenhum lançamento manual com mesmo valor, tipo e data próxima.')):null,
         tx&&opposite.length?h('div',{className:'mf-detail-section'},h('b',{},'Possível transferência entre suas contas'),h('p',{className:'muted-desc'},'Encontramos um valor oposto em outra conta. Confira antes de classificar.'),opposite.map(other=>h('div',{className:'mf-suggestion',key:other.id},h('span',{},other.accountName+' · '+fmt(Math.abs(other.amount))),h('button',{className:'ghost-button',disabled:this.state.detailBusy,onClick:()=>{if(confirm('Marcar ambas como transferência própria?'))this.runBankOperation('bankBatch',{items:[{accountId:tx.accountId,externalId:tx.id},{accountId:other.accountId,externalId:other.id}],nature:'transfer',reviewed:true},'Movimentações marcadas como transferência interna.');}},'Marcar ambas')))):null,
         manual?h('div',{className:'mf-detail-section'},h('b',{},'Categoria do lançamento'),h(StyledSelect,{value:manual.category,options:cats.map(c=>({value:c.name,label:c.emoji+' '+c.name})),onChange:(v:string)=>this.changeManualCategory(manual.id,v)}),h('p',{className:'muted-desc'},'Este lançamento é independente dos dados recebidos das instituições conectadas.')):null,
         tx?h('div',{className:'mf-detail-section mf-raw-details'},h('b',{},'Detalhes originais'),h('p',{},tx.description),h('small',{},'Identificador de referência disponível apenas neste computador.')):null
       )));
 }
 renderEditModal(){const item=this.state.editModal;if(!item)return null;return h('div',{className:'modal-backdrop',onMouseDown:(e:any)=>{if(e.target===e.currentTarget)this.setState({editModal:null});}},h('div',{className:'modal small-modal',role:'dialog','aria-modal':'true','aria-label':'Editar valor'},h('div',{className:'modal-head'},h('div',{},h('small',{className:'micro-label'},'PERSONALIZAÇÃO'),h('h2',{},item.title)),h('button',{className:'close-button',onClick:()=>this.setState({editModal:null})},'×')),this.field('Valor (R$)',h('input',{className:'form-control',value:item.value,inputMode:'decimal',autoFocus:true,onChange:(e:any)=>this.setState({editModal:{...item,value:e.target.value}})})),h('div',{className:'modal-actions'},h('button',{className:'ghost-button',onClick:()=>this.setState({editModal:null})},'Cancelar'),h('button',{className:'primary-button',onClick:async()=>{const saved=item.type==='budget'?await this.setBudget(item.key,item.value):await this.setSetting(item.key as keyof Settings,item.value);if(saved)this.setState({editModal:null});}},h(Icon,{name:'check',size:18}),'Salvar alteração'))));}
 renderEntryModal(){const f=this.state.entry;return h('div',{className:'modal-backdrop',onMouseDown:(e:any)=>{if(e.target===e.currentTarget)this.setState({showEntry:false});}},h('div',{className:'modal',role:'dialog','aria-modal':'true','aria-label':'Registrar movimentação'},h('div',{className:'modal-head'},h('div',{},h('small',{className:'micro-label'},'NOVO LANÇAMENTO'),h('h2',{},'Registrar movimentação')),h('button',{className:'close-button',onClick:()=>this.setState({showEntry:false})},'×')),h('div',{className:'segmented'},['expense','income'].map(k=>h('button',{key:k,className:f.kind===k?'selected':'',onClick:()=>this.setState({entry:{...f,kind:k as Kind,category:this.state.entryCategoryTouched?f.category:k==='income'?'Salário':'Outros'}})},k==='expense'?'Despesa':'Receita'))),this.field('Descrição',h('input',{className:'form-control',placeholder:'Ex.: supermercado',value:f.description,maxLength:150,onChange:(e:any)=>{const description=e.target.value;const category=this.state.entryCategoryTouched?f.category:(findCategoryRule(description,'manual',this.state.rules)||'Outros');this.setState({entry:{...f,description,category}});}})),h('div',{className:'two-inputs'},this.field('Valor (R$)',h('input',{className:'form-control',placeholder:'0,00',inputMode:'decimal',value:f.value,onChange:(e:any)=>this.setState({entry:{...f,value:e.target.value}})})),this.field('Data',h(SingleDatePicker,{value:f.date,onChange:(value:string)=>this.setState({entry:{...f,date:value}})}))),this.field('Categoria',h(StyledSelect,{className:'form-control',value:f.category,options:this.getCategories().map(c=>({value:c.name,label:(c.emoji||'✨')+'  '+c.name})),onChange:(value:string)=>this.setState({entry:{...f,category:value},entryCategoryTouched:true})})),h('div',{className:'modal-actions'},h('button',{className:'ghost-button',onClick:()=>this.setState({showEntry:false})},'Cancelar'),h('button',{className:'primary-button',onClick:()=>this.saveEntry()},h(Icon,{name:'check',size:18}),'Salvar lançamento'))));}
 render(){if(this.state.fatal)return h('main',{className:'startup-error'},h('h1',{},'Não foi possível abrir seus dados'),h('p',{},this.state.fatal),h('p',{},'Se houver arquivos importantes, não desinstale a versão anterior nem apague a pasta de dados.'));if(this.state.booting&&desktop)return h('main',{className:'startup-error'},h('h1',{},'Meu Financeiro'),h('p',{},'Preparando seus dados…'));return h('div',{className:'shell'},this.renderSide(),h('main',{className:'main-area'},this.renderTop(),this.state.mode==='demo'?h('div',{className:'demo-strip'},h(Icon,{name:'spark',size:17}),'Você está explorando dados fictícios. Nada aqui altera suas finanças pessoais.',h('button',{onClick:()=>this.toggleMode()},'Sair da demonstração')):null,({overview:this.renderOverview,planning:this.renderPlanning,transactions:this.renderMovements,budgets:this.renderBudgets,banks:this.renderBanks,categories:this.renderCategories,assistant:this.renderAssistant,settings:this.renderSettings}[this.state.page]||this.renderOverview).call(this),h('footer',{className:'footer'},h('span',{},desktop?'Meu Financeiro v0.9.2 · Feito para você':'Meu Financeiro v0.9.2 · Feito para você'),h('span',{},'Seus dados permanecem neste computador'))),this.state.toast?h('div',{className:'toast'},h(Icon,{name:'check',size:17}),this.state.toast):null,this.state.showEntry?this.renderEntryModal():null,this.state.editModal?this.renderEditModal():null,this.state.detail?this.renderDetailDrawer():null,this.state.planOpen?this.renderPlanModal():null,this.state.planSelected?this.renderPlanDetail():null,h('input',{type:'file',accept:'.json,application/json',style:{display:'none'},ref:(e:any)=>this.fileInput=e,onChange:(e:any)=>{if(e.target.files?.[0])this.importJSON(e.target.files[0]);e.target.value='';}}),h('input',{type:'file',accept:'.csv,text/csv',style:{display:'none'},ref:(e:any)=>this.csvInput=e,onChange:(e:any)=>{if(e.target.files?.[0])this.importCSV(e.target.files[0]);e.target.value='';}}));}
}
function splitCSV(line:string,separator:string){const result:string[]=[];let current='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){current+='"';i++;}else quoted=!quoted;}else if(ch===separator&&!quoted){result.push(current);current='';}else current+=ch;}result.push(current);return result;}
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
ReactDOM.render(h(App,{}),document.getElementById('app'));
