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
/** Compare input snapshots, never the calculated output or saved scenario A. */
function simInputsEqual(a:Sim|null|undefined,b:Sim|null|undefined):boolean{
 if(!a||!b)return false;
 return a.value===b.value&&a.installments===b.installments&&
  a.interest===b.interest&&(a.firstDueDate||'')===(b.firstDueDate||'');
}
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
type CategoryInfo = {name:string;color:string;emoji:string;builtIn:number;kind:'expense'|'income'|'both'};
type RuleInfo = {id:number;pattern:string;matchMode:'contains'|'starts'|'exact';category:string;scope:'both'|'bank'|'manual';priority:number;enabled:number};
type CategoryEditor = {previousName:string;name:string;color:string;emoji:string;kind:'expense'|'income'|'both'};
type RuleEditor = {id:number|null;pattern:string;matchMode:'contains'|'starts'|'exact';category:string;scope:'both'|'bank'|'manual';priority:string};
type BankState = {config:BankConfig;data:{accounts:BankAccount[];transactions:BankTx[];items:{itemId:string;institution:string;status:string;consentExpiresAt:string|null;lastSyncAt:string|null}[];last:{completedAt:string;newCount:number;totalCount:number}|null;totalTransactions?:number;truncated?:boolean;aliases?:{id:number;pattern:string;displayName:string}[];dailyTotals?:{date:string;income:number;expense:number;categories:{name:string;total:number}[];incomeCategories?:{name:string;total:number}[]}[];suspectedDuplicates?:{pairKey:string;accountIdA:string;externalIdA:string;accountIdB:string;externalIdB:string;description:string;amount:number;date:string;accountName:string}[]}};
const EMPTY_BANK:BankState={config:{configured:false,clientId:'',itemIds:[],secure:false},data:{accounts:[],transactions:[],items:[],last:null}};
type E1Report = {ok:boolean;reason?:string;stage?:string;verifiedCount?:number;pendingCount?:number;mismatchCount?:number;checks?:Record<string,{status:'verified'|'mismatch'|'pending';reason:string}>;counts?:{bankWindows:number;bankCloud:number;accountsWindows:number;accountsCloud:number;personalOriginalRows:number;overlayEditsCloud:number;missingBankRefsCloud:number;missingPlanningAccountsCloud:number};e1Completed?:boolean;cloudCutoverAllowed?:boolean;monthDeltas?:{ok:boolean;stage:string;totalDifferenceMonths?:number;limitedResults:boolean;items:{month:string;windowsCount:number;cloudCount:number;difference:number;status:string}[]}};
type QuickCategoryTarget = {origin:'bank'|'manual';id:string;accountId?:string;left:number;top:number;width:number};
type State = {contextCategory?:{target:'entry'|'quick'|'batch';editor:CategoryEditor;mode:string;account:string;query:string};categoryContextBusy?:boolean;txGroupByDate?:boolean; txAdvancedOpen?:boolean;txCategoryFilter?:string;txKindFilter?:'all'|'income'|'expense';txReviewFilter?:'all'|'pending'|'reviewed';txSort?:'date_desc'|'date_asc'|'amount_desc'|'amount_asc';quickCategory:QuickCategoryTarget|null;quickCategoryQuery:string;quickCategoryIndex:number;quickCategoryBusy:boolean;quickCategoryError:string; budgetFocus?:'all'|'attention'|'unlimited';budgetSearch?:string;accountFocus?:'all'|'attention';bankIntegrationsOpen?:boolean;simSaved?:{result:any;input:Sim};simBusy?:boolean;simCalculatedInput?:Sim|null;simResultStale?:boolean;simError?:string; txSummarySource?:'bank'|'manual';planPresentation?:'agenda'|'calendar'|'projection'; overviewHideValues?:boolean;overviewChart?:string; intelligenceContextSnapshot?:any;intelligenceDraftScope?:any;settingsSection?:string; fatal?:string; booting?:boolean; mode:'real'|'demo'; data:Data; page:string; month:string; showEntry:boolean; entry:{date:string;description:string;kind:Kind;category:string;value:string}; sim:Sim; outcome:any; query:string; toast:string; budgetEdit:string; busy:boolean; editModal:null|{type:'budget'|'setting';key:string;title:string;value:string};bank:BankState;bankForm:{clientId:string;clientSecret:string;itemIds:string};bankBusy:boolean;bankMessage:string;bankFilter:string;txSource:'all'|'bank'|'manual';txReviewOnly:boolean;txOrganize:boolean;categoryMoreEmojis:boolean;quickAddOpen:boolean;dashboardSource:'bank'|'manual';sourceDetailsOpen:boolean;budgetTab:'expense'|'income';showAllBudgetCategories:boolean;
 categories:CategoryInfo[];rules:RuleInfo[];categoryEditor:CategoryEditor;ruleEditor:RuleEditor;ruleTest:string;categoryMessage:string;entryCategoryTouched:boolean;bankConfigOpen:boolean;overviewPeriod:PeriodMode;customStart:string;customEnd:string;backupInfo:{copies:number;last:string|null};detail:DetailSelection;detailDraft:DetailDraft;manualDraft:null|{description:string;date:string;value:string;category:string};detailBusy:boolean;categorySaving:string[];txSelected:string[];txBatchCategory:string; planning:PlanOverview;planMonth:string;planDay:string;planSelected:string|null;planOpen:boolean;planForm:PlanForm;planBusy:boolean;planView:string;planTerm:string;planIncludeEstimated:boolean;planBankTitle:string;planMatchQuery:string;planHistory:{action:string;details:string;at:string}[];cloudStage:string;cloudBusy:boolean;cloudMessage:string;cloudIdentityConnected:boolean;cloudQuarantineVerified:boolean;cloudPersonalTransferred:boolean;cloudParityBusy:boolean;cloudParityMessage:string;cloudE1Report:E1Report|null; intelligenceTab:'today'|'chat'|'actions';intelligenceDraft:string;intelligencePreparedQuestion:string;intelligencePanelOpen:boolean;intelligenceContext:string;intelligenceExpandedAction:string|null; aiStatus:{connected:boolean;secure:boolean;email?:string|null;scopeGranted?:boolean};aiBusy:boolean;aiError:string;aiDemoCase:string;aiEffort:'auto'|'low'|'medium';aiCreditsConfirmed:boolean;aiResult:any;aiStreaming:string;aiCapabilities:any;aiMemories:any[];aiMemoryDraft:string;aiMemoryKind:string;aiMemoryBusy:boolean;aiMemoryError:string;aiUseMemories:boolean;aiPreview:any;aiUsageStats:any;aiFinancialDemoSource:'bank'|'manual';aiFinancialDemo:any;aiFinancialDemoBusy:boolean;aiFinancialDemoError:string };
// Bridge com o processo principal Electron. No preview web, mantém o armazenamento legado.
interface DesktopBridge {load:(mode:'real'|'demo')=>Promise<Data|null>;save:(mode:'real'|'demo',data:Data)=>Promise<any>;info:()=>Promise<any>;backupSQLite:()=>Promise<{cancelled?:boolean;ok?:boolean}>;cloudMigrationStatus:()=>Promise<{stage:string;cloudConnected:boolean;financialSyncEnabled:boolean;backupPresent:boolean;latestBackupAt:string|null}>;prepareCloudMigration:()=>Promise<{stage:string;checkedTables:number;checkedRecords:number;recordsSent:number;backupVerified:boolean;personalTablesReady:number;personalRecordsReady:number}>;cloudAccessStatus:()=>Promise<{connected:boolean;stage?:string;reason?:string;financialSyncEnabled:boolean;recordsTransferred:number}>;connectCloudAccess:()=>Promise<{connected:boolean;stage?:string;reason?:string;financialSyncEnabled:boolean;recordsTransferred:number}>;previewQuarantineDemo:()=>Promise<{ok:boolean;stage?:string;reason?:string;personalTables?:number;fictionalRecords?:number;realRecordsSent:number;financialSyncEnabled:boolean}>;transferPersonalCloud:()=>Promise<{cancelled?:boolean;stage?:string;recordsSent?:number;personalTablesReady?:number;personalRecordsReady?:number;backupVerified?:boolean;financialSyncEnabled:boolean}>;cloudPersonalSyncStatus?:()=>Promise<{cursor:number;conflicts:number;financialSyncEnabled:boolean}>;cloudBankParity?:()=>Promise<{ok:boolean;reason?:string;localCount?:number;cloudCount?:number;exactIdentities?:boolean;exactDatesAndCents?:boolean;exactDescriptionsAndStatuses?:boolean;matched?:boolean;financialSyncEnabled:boolean}>;cloudE1Audit?:()=>Promise<E1Report>;onCloudPersonalUpdated?:(callback:(data:{inbound:number;conflicts:number})=>void)=>(()=>void);restoreSQLite:()=>Promise<{cancelled?:boolean;ok?:boolean}>;backupStatus:()=>Promise<{copies:number;last:string|null}>;openBackupsFolder:()=>Promise<string>;openDataFolder:()=>Promise<string>;bankStatus:()=>Promise<BankState>;bankConfigure:(c:any)=>Promise<BankState>;bankSync:()=>Promise<BankState & {newCount:number;totalCount:number}>;bankForget:()=>Promise<BankState>;importCategoryPack?:()=>Promise<any>;categoriesStatus:()=>Promise<{categories:CategoryInfo[];rules:RuleInfo[]}>;
 categorySave:(input:CategoryEditor)=>Promise<any>;categoryDelete:(name:string)=>Promise<any>;
 ruleSave:(input:any)=>Promise<any>;ruleDelete:(id:number)=>Promise<any>;
 bankCategorize:(input:{accountId:string;externalId:string;category:string|null})=>Promise<BankState['data']>;
 bankEditDetail:(input:any)=>Promise<BankState['data']>;bankBatch:(input:any)=>Promise<BankState['data']>;
 bankSplit:(input:any)=>Promise<BankState['data']>;bankLinkManual:(input:any)=>Promise<BankState['data']>;
 bankMerchantAlias:(input:any)=>Promise<BankState['data']>;bankDeleteAlias:(id:number)=>Promise<BankState['data']>;bankDismissDuplicate:(pairKey:string)=>Promise<BankState['data']>;
 planOverview:(options:any)=>Promise<PlanOverview>;planSimulate:(options:any)=>Promise<any>;planCreate:(input:any)=>Promise<any>;planEdit:(input:any)=>Promise<PlanOverview>;planStatus:(id:string,status:string)=>Promise<PlanOverview>;planLink:(input:any)=>Promise<PlanOverview>;planUnlink:(input:any)=>Promise<PlanOverview>;planReject:(input:any)=>Promise<PlanOverview>;planRename:(input:any)=>Promise<{overview:PlanOverview;data:BankState['data']}>;planHistory:(id:string)=>Promise<{action:string;details:string;at:string}[]>; aiStatus?:()=>Promise<any>;aiCapabilities?:()=>Promise<any>;aiConnect?:()=>Promise<any>;aiDisconnect?:()=>Promise<any>;aiModelAvailable?:()=>Promise<boolean>;aiRunDemo?:(input:{caseId:string;effort:'auto'|'low'|'medium';creditsDisabledConfirmed:boolean;useSavedMemories:boolean})=>Promise<any>;aiMemoryList?:()=>Promise<any[]>;aiMemoryAdd?:(input:{kind:string;text:string})=>Promise<any[]>;aiMemoryRemove?:(id:string)=>Promise<any[]>;aiMemoryClear?:()=>Promise<any[]>;aiUsageSummary?:()=>Promise<any>;aiContextPreview?:(input:{caseId:string;effort:'auto'|'low'|'medium';useSavedMemories:boolean})=>Promise<any>;aiFinancialContextDemo?:(source:'bank'|'manual')=>Promise<any>;onAIDelta?:(callback:(delta:string)=>void)=>(()=>void);}

const desktop:DesktopBridge|null = (window as any).financeDesktop || null;
const CATS = ['Moradia','Alimentação','Transporte','Saúde','Lazer','Educação','Assinaturas','Compras','Contas','Outros'];
const COLORS = ['#3e9a85','#d6934b','#4489ba','#cb6d76','#2aa898','#4c7fb2','#718096','#b5874f','#5d86a1','#87929c'];
const BUILTIN_EMOJIS=['🏠','🍽️','🚗','💊','🎮','📚','📺','🛍️','🧾','✨','💰'];
const EMOJI_OPTIONS=['🏠','🏡','🔑','🪴','🍽️','🍔','🍕','🥗','🥑','☕','🍿','🛒','🛍️','🚗','🚕','🚌','🚲','⛽','✈️','🧳','💊','🩺','💅','🧴','🧘','🎮','🎬','🎵','🎧','📚','🎓','💻','📱','📺','📷','🎨','🎟️','⚽','🏋️','🏆','🐶','🐱','🐾','💰','💸','💳','🏦','📈','🪙','🧾','💡','⚡','💧','📦','🎁','❤️','🌸','🌿','⭐','✨','🎯','🔧'];
const COLOR_OPTIONS=['#3e9a85','#d6934b','#4489ba','#cb6d76','#2aa898','#4c7fb2','#718096','#b5874f','#5d86a1','#87929c','#279c72','#538faf','#40ac89','#55a6b0','#e0ae5b','#bd786a'];
const DEFAULT_CATEGORY_INFOS:CategoryInfo[]=[...CATS,'Salário','Transferências','Rendimentos','Reembolsos'].map((name,i)=>({name,color:COLORS[i%COLORS.length],emoji:BUILTIN_EMOJIS[i]||'✨',builtIn:1,kind:['Salário','Rendimentos','Reembolsos'].includes(name)?'income':['Outros','Transferências'].includes(name)?'both':'expense'}));
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
function transactionViewRows(state:State){
 const review=state.txReviewOnly;
 const span=dateSpan(state.overviewPeriod,state.customStart,state.customEnd);
 const banks=(state.mode==='demo'?[]:state.bank.data.transactions||[]);
 const manual=state.data.transactions;
 const term=fold(state.query);
 type Row={key:string;origin:'bank'|'manual';date:string;description:string;merchant:string;category:string;amount:number;account:string;status:string;raw:BankTx|Tx};
 const bankRows:Row[]=banks.filter(t=>!review||!t.reviewed).map(t=>({
  key:t.accountId+'|'+t.id,origin:'bank',date:t.date,description:t.description,
  merchant:t.customTitle||t.merchant||'',category:t.category,amount:t.amount,
  account:t.accountName,status:t.status,raw:t
 }));
 const manualRows:Row[]=review?[]:manual.map(t=>({
  key:'manual|'+t.id,origin:'manual',date:t.date,description:t.description,
  merchant:'',category:t.category,amount:t.kind==='income'?t.amount:-t.amount,
  account:'Adicionado por você',status:'POSTED',raw:t
 }));
 const kindOf=(t:Row):string=>t.origin==='manual'?(t.raw as Tx).kind:effectiveNature(t.raw as BankTx);
 const filtered=bankRows.concat(manualRows).filter(t=>
  (review||(t.date>=span.start&&t.date<=span.end))&&
  (!term||[t.description,t.category,t.account,t.merchant].some(v=>fold(v).includes(term)))&&
  (!state.bankFilter||(t.origin==='bank'&&(t.raw as BankTx).accountId===state.bankFilter))&&
  (review||state.txSource==='all'||!state.txSource||t.origin===state.txSource)&&
  (!state.txCategoryFilter||t.category===state.txCategoryFilter)&&
  (!state.txKindFilter||state.txKindFilter==='all'||kindOf(t)===state.txKindFilter)&&
  (review||!state.txReviewFilter||state.txReviewFilter==='all'||
   (t.origin==='bank'&&((state.txReviewFilter==='reviewed')===!!(t.raw as BankTx).reviewed)))
 );
 const tie=(a:Row,b:Row)=>a.key.localeCompare(b.key);
 const mode=state.txSort||'date_desc';
 filtered.sort((a,b)=>{
  if(mode==='date_asc')return a.date.localeCompare(b.date)||tie(a,b);
  if(mode==='amount_desc')return Math.abs(b.amount)-Math.abs(a.amount)||b.date.localeCompare(a.date)||tie(a,b);
  if(mode==='amount_asc')return Math.abs(a.amount)-Math.abs(b.amount)||b.date.localeCompare(a.date)||tie(a,b);
  return b.date.localeCompare(a.date)||tie(a,b);
 });
 return filtered;
}
function transactionViewSummary(rows:ReturnType<typeof transactionViewRows>,source:string){
 const chosen=rows.filter(t=>t.origin===source);let income=0,expense=0,pending=0,review=0,excluded=0;
 for(const t of chosen){if(source==='bank'){const bank=t.raw as BankTx;if(!bank.reviewed)review++;if(t.status!=='POSTED'){pending++;continue;}const nature=effectiveNature(bank);if(nature==='transfer'||nature==='ignore'){excluded++;continue;}if(nature==='income')income+=Math.abs(t.amount);else expense+=Math.abs(t.amount);}
 else if((t.raw as Tx).kind==='income')income+=Math.abs(t.amount);else expense+=Math.abs(t.amount);}
 return {income,expense,net:income-expense,pending,review,excluded,count:chosen.length};
}
function bankBalanceCoverage(accounts:BankAccount[]){
 const known=accounts.filter(a=>Number.isFinite(a.balance));
 const knownCount=known.length,totalCount=accounts.length,missingCount=totalCount-knownCount;
 const amountKnown=known.reduce((total,a)=>total+(a.balance as number),0);
 return {knownCount,totalCount,missingCount,amountKnown};
}
function bankBalanceLabel(coverage:ReturnType<typeof bankBalanceCoverage>){
 if(!coverage.knownCount)return 'Saldo indisponível';
 return (coverage.missingCount?'Parcial · ':'')+fmt(coverage.amountKnown);
}
function bankReferenceLabel(value:string|null){
 if(!value)return 'não informada';
 if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
  const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d);
  return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date.toLocaleDateString('pt-BR'):'não informada';
 }
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toLocaleString('pt-BR'):'não informada';
}
function bankTotalsInRange(bank:BankState,start:string,end:string){
 // SQLite calculates these daily totals from the full history. The visible transaction list is capped.
 const totals=new Map<string,number>(),incomeCats=new Map<string,number>();let income=0,expense=0;
 const days=bank.data.dailyTotals;
 if(days){
  for(const day of days){if(day.date<start||day.date>end)continue;
    income+=day.income;expense+=day.expense;
    for(const part of day.categories)totals.set(part.name,(totals.get(part.name)||0)+part.total);
    for(const part of day.incomeCategories||[])incomeCats.set(part.name,(incomeCats.get(part.name)||0)+part.total);
  }
 }else{
  // Compatibility with legacy/demo data that has no daily aggregates.
  const tx=(bank.data.transactions||[]).filter(t=>t.status==='POSTED'&&t.date>=start&&t.date<=end);
  for(const t of tx){const nature=effectiveNature(t),amount=Math.abs(t.amount);
   if(nature==='income'){income+=amount;incomeCats.set(t.category,(incomeCats.get(t.category)||0)+amount);}
   if(nature==='expense'){
     expense+=amount;
     const parts=t.splits?.length&&!t.splitOutdated?t.splits:[{category:t.category,amount}];
     for(const part of parts)totals.set(part.category,(totals.get(part.category)||0)+part.amount);
   }
  }
 }
 const balanceCoverage=bankBalanceCoverage(bank.data.accounts||[]);
 const balance=balanceCoverage.amountKnown;
 return {income,expense,net:income-expense,balance,balanceCoverage,categories:[...totals].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total),incomeCategories:[...incomeCats].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total)};
}
function bankSnapshot(bank:BankState,month:string){return bankTotalsInRange(bank,firstOfMonth(month),endOfMonth(month));}
const fmt = (n:number)=> (n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const moneyString = (n:number)=> (n/100).toFixed(2).replace('.',',');
function parseMoney(v:string):number { let s = String(v||'').trim().replace(/R\$|\s/g,''); if (!s) return 0; if (s.includes(',')) s=s.replace(/\./g,'').replace(',','.'); else if ((s.match(/\./g)||[]).length>1) s=s.replace(/\./g,''); const x=Number(s); return Number.isFinite(x)?Math.round(x*100):NaN; }
/** BRL typed by a person: reject ambiguous separators and fractions of a cent.
 * Keep parseMoney() unchanged for legacy CSV, backups, budgets and other flows.
 */
function parsePositiveBRLInput(value:string):number {
 const input=String(value??'').trim().replace(/^R\$\s*/,'');
 // Dot may only group 3 digits; comma is the only decimal separator.
 if(!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(input))return NaN;
 const [integer,fraction='']=input.split(',');
 const whole=Number(integer.replace(/\./g,''));
 if(!Number.isSafeInteger(whole))return NaN;
 const cents=whole*100+Number(fraction.padEnd(2,'0'));
 // Coin-safe, and within FinanceDB.isCents() persistence boundary.
 return Number.isSafeInteger(cents)&&cents>0&&cents<=100_000_000_000?cents:NaN;
}
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
 const totals=new Map<string,number>(),incomeCats=new Map<string,number>();for(const t of ts){if(t.kind==='expense')totals.set(t.category,(totals.get(t.category)||0)+t.amount);else incomeCats.set(t.category,(incomeCats.get(t.category)||0)+t.amount);}
 return {income,expense,net:income-expense,balance:d.settings.opening+sum(d.transactions,'income')-sum(d.transactions,'expense'),categories:[...totals].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total),incomeCategories:[...incomeCats].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total)};
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

function overviewPriorRange(start:string,end:string,mode:string):DateSpan{
 if(mode==='month'||mode==='lastmonth'){
  const ym=shiftMonth(start.slice(0,7),-1),last=endOfMonth(ym);
  return{start:firstOfMonth(ym),end:mode==='lastmonth'?last:ym+'-'+String(Math.min(+end.slice(8),+last.slice(8))).padStart(2,'0')};
 }
 const length=daysInSpan(start,end);return{start:advanceDate(start,-length),end:advanceDate(start,-1)};
}
function overviewCoverage(expense:number,covered:number){return expense>0?Math.max(0,Math.min(100,Math.round(covered/expense*100))):null;}
function overviewComparison(current:number,previous:number,available:boolean){
 if(!available)return{percent:null,label:'Histórico insuficiente para comparar'};
 if(previous<=0)return{percent:null,label:current>0?'Sem gasto no intervalo anterior':'Sem gastos nos dois intervalos'};
 const percent=Math.round((current-previous)/previous*100);return{percent,label:percent===0?(current===previous?'Mesmo gasto do intervalo anterior':'Variação menor que 1% no intervalo'):Math.abs(percent)+'% '+(percent>0?'a mais':'a menos')+' que no intervalo anterior'};
}
function overviewCumulative(start:string,end:string,get:(a:string,b:string)=>{expense:number},prior:DateSpan|null){
 const days=daysInSpan(start,end),count=Math.min(25,days);
 return Array.from({length:count},(_,i)=>{const offset=Math.floor((i+1)*days/count)-1,date=advanceDate(start,offset),previousDate=prior?advanceDate(prior.start,Math.min(offset,daysInSpan(prior.start,prior.end)-1)):null;
  return{date,current:get(start,date).expense,previous:prior&&previousDate?get(prior.start,previousDate).expense:null};});
}
function OverviewSpendingChart(props:any){
 const rows=props.rows as {date:string;current:number;previous:number|null}[],left=52,right=720,top=22,bottom=182;
 const peak=Math.max(100,...rows.flatMap(r=>[r.current,r.previous||0]));
 const point=(n:number,i:number)=>[left+(rows.length===1?1:i/Math.max(1,rows.length-1))*(right-left),bottom-n/peak*(bottom-top)];
 const path=(key:'current'|'previous')=>rows.map((r,i)=>{const [x,y]=point(r[key]||0,i);return(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2);}).join(' ');
 return h('div',{className:'u1-spending-chart'},
  h('svg',{viewBox:'0 0 748 218',role:'img','aria-label':'Gasto acumulado no período. Valores exatos na tabela.'},
   [0,.5,1].map((n,i)=>h('g',{key:i},h('line',{x1:left,x2:right,y1:bottom-n*(bottom-top),y2:bottom-n*(bottom-top),className:'u1-chart-grid'}),h('text',{x:left-10,y:bottom-n*(bottom-top)+4,textAnchor:'end',className:'u1-chart-label'},financialAxisLabel(peak*n,peak)))),
   props.compare?h('path',{d:path('previous'),className:'u1-chart-previous'}):null,
   h('path',{d:path('current')+' L '+right+' '+bottom+' L '+left+' '+bottom+' Z',className:'u1-chart-area'}),h('path',{d:path('current'),className:'u1-chart-current'}),
   rows.length?h('circle',{cx:point(rows[rows.length-1].current,rows.length-1)[0],cy:point(rows[rows.length-1].current,rows.length-1)[1],r:4,className:'u1-chart-point'}):null,
   [0,Math.floor((rows.length-1)/2),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>h('text',{key:i,x:point(0,i)[0],y:208,textAnchor:'middle',className:'u1-chart-label'},rows[i]?.date.slice(8)+'/'+rows[i]?.date.slice(5,7)))),
  h('details',{className:'u1-chart-data'},h('summary',{},'Ver valores do gráfico'),h('div',{className:'u1-table-scroll'},h('table',{},h('caption',{},'Gasto acumulado na fonte selecionada'),h('thead',{},h('tr',{},h('th',{},'Até'),h('th',{},'Período atual'),props.compare?h('th',{},'Intervalo anterior'):null)),h('tbody',{},rows.map(r=>h('tr',{key:r.date},h('td',{},r.date.split('-').reverse().join('/')),h('td',{},fmt(r.current)),props.compare?h('td',{},fmt(r.previous||0)):null)))))));
}

function starter():Data { return { version:5,transactions:[],budgets:{},settings:{opening:0,income:0,fixed:0,existing:0,reserve:0} }; }
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
 return {version:5, transactions:t,budgets:{Moradia:120000,Alimentação:100000,Transporte:35000,Saúde:20000,Lazer:38000,Educação:30000,Assinaturas:20000,Compras:60000,Contas:40000,Outros:20000},settings:{opening:145000,income:520000,fixed:220000,existing:35000,reserve:100000}};
}
function safeData(v:any):Data {
 if(!v||typeof v!=='object'||!Array.isArray(v.transactions)) throw new Error('Arquivo inválido.');
 const d=starter();
 d.transactions=v.transactions.slice(0,30000).map((r:any)=>{
  const amount=Number(r.amount); if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!['income','expense'].includes(r.kind)||!Number.isSafeInteger(amount)||amount<=0||amount>100000000000||typeof r.description!=='string') throw new Error('Transação inválida.');
  return {id:String(r.id||Math.random()),date:r.date,kind:r.kind,description:r.description.slice(0,180),amount,category:String(r.category||'Outros').slice(0,70),origin:'restored'};
 });
 for(const [c,raw] of Object.entries(v.budgets||{})){const b=Number(raw);if(c.length<=50&&Number.isSafeInteger(b)&&b>=0&&(b>0||Number(v.version)>=5))d.budgets[c]=b;}
 for(const key of ['opening','income','fixed','existing','reserve'] as (keyof Settings)[]){const n=Number(v.settings?.[key]||0); (d.settings as any)[key]=(Number.isSafeInteger(n)&&Math.abs(n)<100000000000)?n:0;}
 return d;
}
function load(mode:'real'|'demo'):Data { try { const raw=localStorage.getItem('meu-financeiro-v03-'+mode);if(raw)return safeData(JSON.parse(raw)); } catch(_) {} return mode==='demo'?demoData():starter(); }
function save(mode:'real'|'demo',data:Data){localStorage.setItem('meu-financeiro-v03-'+mode,JSON.stringify(data));}
function sum(t:Tx[],kind:Kind){return t.filter(x=>x.kind===kind).reduce((a,x)=>a+x.amount,0);}
function snapshot(d:Data,month:string){ const ts=d.transactions.filter(t=>t.date.slice(0,7)===month); const income=sum(ts,'income'), expense=sum(ts,'expense'); const bal=d.settings.opening+sum(d.transactions,'income')-sum(d.transactions,'expense'); const names=[...new Set([...CATS,...Object.keys(d.budgets),...ts.map(t=>t.category)])];const categories=names.map(cat=>({name:cat,total:sum(ts.filter(t=>t.category===cat),'expense')})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total); const incomeCategories=names.map(cat=>({name:cat,total:sum(ts.filter(t=>t.category===cat),'income')})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);return {income,expense,balance:bal,net:income-expense,categories,incomeCategories}; }
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
 const paths:{[s:string]:string}={home:'M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z',wallet:'M3 7h17a2 2 0 0 1 2 2v11H3a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h15v3H3m11 7h8',trend:'M3 17l6-6 4 4 8-8 M15 7h6v6',down:'M3 7l6 6 4-4 8 8 M15 17h6v-6',calendar:'M3 6h18v15H3z M7 3v6 M17 3v6 M3 11h18',refresh:'M21 4v6h-6 M3 20v-6h6 M5 10a8 8 0 0 1 14-4l2 4 M3 14l2 4a8 8 0 0 0 14-4',layers:'M12 3 2 9l10 6 10-6-10-6z M2 13l10 6 10-6',cart:'M3 4h2l3 12h11l3-9H6 M9 21h1 M18 21h1',pie:'M12 2v10h10 M12 2a10 10 0 1 0 10 10',settings:'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.2 2.2 M16.2 16.2l2.2 2.2 M18.4 5.6l-2.2 2.2 M7.8 16.2l-2.2 2.2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',plus:'M12 5v14 M5 12h14',search:'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16 M17 17l5 5',check:'M4 12l5 5L20 6',shield:'M12 2l9 4v6c0 6-4.2 9.2-9 11-4.8-1.8-9-5-9-11V6z M8 12l3 3 5-6',chart:'M4 20V12 M10 20V4 M16 20v-8 M22 20V8',download:'M12 3v13 M7 11l5 5 5-5 M3 18v3h18v-3',upload:'M12 21V8 M7 13l5-5 5 5 M3 5V3h18v2',trash:'M4 6h16 M9 6V3h6v3 M7 8l1 13h8l1-13',arrow:'M5 12h14 M13 6l6 6-6 6',alert:'M12 3 2 21h20L12 3z M12 10v4 M12 18v0',edit:'M3 21l5-.8L21 7 17 3 4 16z',filter:'M3 4h18l-7 8v7l-4 2v-9z',clock:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v6l4 2',spark:'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',bank:'M2 10l10-7 10 7z M4 11v9 M10 11v9 M16 11v9 M22 21H2',folder:'M3 5h7l2 2h9v13H3z', 'chevron-down':'M6 9l6 6 6-6','chevron-up':'M6 15l6-6 6 6','chevron-left':'M15 6l-6 6 6 6','chevron-right':'M9 6l6 6-6 6',close:'M6 6l12 12 M18 6 6 18',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0','eye-off':'M3 3l18 18 M10 5C5 6 2 12 2 12s4 7 10 7c2 0 4-.7 5-2 M14 5c5 1 8 7 8 7l-2 3'};
 return h('svg',{width:p.size||19,height:p.size||19,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':'true'},h('path',{d:paths[p.name]||paths.chart}));
}
function Logo(){return h('span',{className:'logo-glyph'},h('span',{className:'bar b1'}),h('span',{className:'bar b2'}),h('span',{className:'bar b3'}));}
function Card(p:any){return h('div',{className:'card '+(p.className||'')},p.children);}
function Stat(p:any){return h('div',{className:'stat '+(p.featured?'stat-featured':'')},h('div',{className:'stat-head'},h('span',{className:'stat-icon '+(p.color||'')},h(Icon,{name:p.icon})),h('span',{className:'stat-label'},p.label)),h('div',{className:'stat-value'},p.displayValue??fmt(p.amount)),h('div',{className:'stat-foot'},p.hint));}
function prettyMonth(ym:string){const [year,month]=ym.split('-');return new Date(Number(year),Number(month)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});}
function monthShort(ym:string){return new Date(Number(ym.slice(0,4)),Number(ym.slice(5,7))-1,1).toLocaleDateString('pt-BR',{month:'short'}).replace('.','');}
// Axis values use integer centavos from the canonical ledger; formatting never changes totals.
function financialAxisLabel(cents:number,upper:number){
 const reais=cents/100;
 if(upper>=100000000)return 'R$ '+(reais/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mi';
 if(upper>=100000)return 'R$ '+(reais/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil';
 return 'R$ '+reais.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function collectSettingsPanels(node:any,result:{[key:string]:any}={}){
 if(Array.isArray(node)){node.forEach(child=>collectSettingsPanels(child,result));return result;}
 if(!node||!node.props)return result;
 const group=node.props['data-settings-group'];
 if(group){result[group]=node;return result;}
 collectSettingsPanels(node.props.children,result);return result;
}
function pendingDashboardItems(items:PlanItem[]){
 return items.filter(x=>x.status==='planned'&&x.kind==='expense'&&x.remaining>0&&Number.isSafeInteger(x.remaining))
  .slice().sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.id.localeCompare(b.id));
}
function budgetPresentationOrder(a:any,b:any){
 const band=(x:any)=>!x.hasLimit?3:x.total>x.limit?0:x.limit>0&&x.total/x.limit>=.9?1:2;
 const ratio=(x:any)=>x.hasLimit?(x.limit>0?x.total/x.limit:x.total>0?Infinity:0):0;
 return band(a)-band(b)||(ratio(b)-ratio(a))||b.total-a.total||a.info.name.localeCompare(b.info.name,'pt-BR');
}
// U3 presentation: derive signals from canonical snapshots without writing financial records.
/* B3 visual-only: financial amounts still come from the selected month's snapshot.
   Each consumption percentage interpolates to ONE uniform color (not a rainbow arc). */
const B3_COLOR_STOPS: readonly (readonly [number,number,number,number])[]=[
 [0,35,184,112],[10,35,184,112],[25,161,203,70],[50,240,204,57],
 [70,241,149,58],[90,235,105,80],[99,224,72,79],[100,211,55,70]
];
function budgetB3Color(percentage:number):string{
 const p=Math.max(0,Math.min(100,Number.isFinite(percentage)?percentage:100));
 let upper=1;
 while(upper<B3_COLOR_STOPS.length-1&&p>B3_COLOR_STOPS[upper][0])upper++;
 const a=B3_COLOR_STOPS[upper-1],b=B3_COLOR_STOPS[upper];
 const t=b[0]===a[0]?0:(p-a[0])/(b[0]-a[0]);
 const channel=(i:number)=>Math.round(a[i]+(b[i]-a[i])*t);
 return 'rgb('+channel(1)+', '+channel(2)+', '+channel(3)+')';
}
function budgetB3Visual(spentCents:number,limitCents:number){
 if(!Number.isFinite(spentCents)||!Number.isFinite(limitCents)||limitCents<=0)return null;
 const raw=Math.max(0,spentCents/limitCents*100),fill=Math.min(100,raw);
 return {percent:Math.round(raw),fill,color:budgetB3Color(fill)};
}
function u3BudgetSignals(entries:{total:number;hasLimit:boolean;limit:number}[],total:number){
 const limited=entries.filter(x=>x.hasLimit),spent=limited.reduce((n,x)=>n+x.total,0);
 return {exceeded:limited.filter(x=>x.total>x.limit).length,near:limited.filter(x=>x.limit>0&&x.total<=x.limit&&x.total/x.limit>=.9).length,unlimited:entries.filter(x=>!x.hasLimit&&x.total>0).length,covered:total>0?Math.round(Math.min(1,spent/total)*100):null,spent,limit:limited.reduce((n,x)=>n+x.limit,0)};
}
function u3AccountType(value:string){return ({CHECKING_ACCOUNT:'Conta corrente',SAVINGS_ACCOUNT:'Poupança',PAYMENT_ACCOUNT:'Conta de pagamento',CREDIT_CARD:'Cartão de crédito'} as any)[value]||(/^[A-Z_]+$/.test(value||'')?'Conta conectada':value||'Conta conectada');}
function u3AccountReference(value:string,now:number){
 if(!value||/^\d{4}-\d{2}-\d{2}$/.test(value))return {status:'unknown',label:'Horário não informado'};
 const stamp=Date.parse(value),age=now-stamp;
 if(!Number.isFinite(stamp)||age< -300000)return {status:'unknown',label:'Referência não verificada'};
 return age>86400000?{status:'stale',label:'Referência há mais de 24h'}:{status:'recent',label:'Referência de até 24h'};
}
function u3AccountSignals(account:BankAccount,transactions:BankTx[],now:number){
 const reference=u3AccountReference(account.updatedAt,now),rows=transactions.filter(t=>t.accountId===account.id);
 return {reference,attention:!Number.isFinite(account.balance)||reference.status!=='recent',pending:rows.filter(t=>t.status==='PENDING').length,review:rows.filter(t=>!t.reviewed).length,count:rows.length};
}
function u3SimulationCost(out:any){
 if(!out||out.error||![out.principal,out.monthly,out.total].every(Number.isSafeInteger))return null;
 return {principal:out.principal,monthly:out.monthly,total:out.total,interest:out.total-out.principal,daily:out.engine==='planning',minimum:out.engine==='planning'&&Number.isFinite(out.minimumAfterPurchase)?out.minimumAfterPurchase:null};
}
function U3ScenarioChart(p:{rows:any[]}){
 const rows=p.rows.slice(0,12).filter(r=>Number.isFinite(r.withPurchase)&&Number.isFinite(r.withoutPurchase));
 if(!rows.length)return null;
 const values=rows.flatMap(r=>[r.withPurchase,r.withoutPurchase]),min=Math.min(0,...values),max=Math.max(4,...values),span=Math.max(4,max-min),x=(i:number)=>70+i*640/Math.max(1,rows.length-1),y=(v:number)=>150-(v-min)/span*125;
 const line=(key:string)=>rows.map((r,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(r[key]).toFixed(1)).join(' ');
 return h('figure',{className:'u3-scenario-chart'},h('figcaption',{},'Fechamentos mensais · primeiros '+rows.length+' meses'),h('svg',{viewBox:'0 0 740 185',role:'img','aria-label':'Comparação dos fechamentos mensais; valores exatos na tabela abaixo'},[0,.5,1].map(t=>h('g',{key:t},h('line',{x1:70,x2:710,y1:y(min+span*t),y2:y(min+span*t),className:'u3-chart-grid'}),h('text',{x:3,y:y(min+span*t)+4,className:'u3-chart-label'},financialAxisLabel(min+span*t,span)))),h('path',{d:line('withoutPurchase'),className:'u3-chart-base'}),h('path',{d:line('withPurchase'),className:'u3-chart-purchase'}),rows.map((r,i)=>h('circle',{key:r.month,cx:x(i),cy:y(r.withPurchase),r:3,className:'u3-chart-dot'})),h('text',{x:70,y:176,className:'u3-chart-label'},monthShort(rows[0].month)+'/'+rows[0].month.slice(2,4)),h('text',{x:710,y:176,textAnchor:'end',className:'u3-chart-label'},monthShort(rows[rows.length-1].month)+'/'+rows[rows.length-1].month.slice(2,4))),h('div',{className:'u3-chart-legend'},h('span',{},h('i',{className:'is-baseline'}),'Sem compra'),h('span',{},h('i'), 'Com compra'),h('small',{},'Fechamentos não representam o menor saldo diário.')));
}
function Chart(p:any){
 const vals=p.data as {month:string;label?:string;income:number;expense:number}[];
 const upper=Math.max(4,...vals.flatMap(x=>[Math.max(0,x.income),Math.max(0,x.expense)]))*1.14;
 const W=620,H=214,l=90,r=16,t=18,b=32;
 const xx=(i:number)=>l+i*(W-l-r)/Math.max(1,vals.length-1);
 const yy=(v:number)=>t+(H-b-t)*(1-v/upper);
 const getPath=(k:'income'|'expense')=>vals.map((x,i)=>(i?'L':'M')+xx(i).toFixed(1)+','+yy(x[k]).toFixed(1)).join(' ');
 const getArea=(k:'income'|'expense')=>vals.length?getPath(k)+` L${xx(vals.length-1)},${H-b} L${xx(0)},${H-b} Z`:'';
 return h('div',{className:'mf-chart-block'},
  h('svg',{className:'chart-svg',viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'xMidYMid meet',role:'img','aria-label':'Evolução de receitas e despesas; valores disponíveis em tabela abaixo'},
   h('defs',{},h('linearGradient',{id:'incFill',x1:'0',y1:'0',x2:'0',y2:'1'},h('stop',{offset:'0%',stopColor:'var(--green)',stopOpacity:'.28'}),h('stop',{offset:'100%',stopColor:'var(--green)',stopOpacity:'0'})),h('linearGradient',{id:'expFill',x1:'0',y1:'0',x2:'0',y2:'1'},h('stop',{offset:'0%',stopColor:'var(--red)',stopOpacity:'.2'}),h('stop',{offset:'100%',stopColor:'var(--red)',stopOpacity:'0'}))),
   [0,.25,.5,.75,1].map((a,i)=>h('g',{key:'g'+i},h('line',{x1:l,y1:yy(upper*a),x2:W-r,y2:yy(upper*a),stroke:'var(--border)',strokeWidth:1}),h('text',{x:3,y:yy(upper*a)+4,fill:'var(--muted)',fontSize:11},financialAxisLabel(upper*a,upper)))),
   h('path',{d:getArea('income'),fill:'url(#incFill)'}),h('path',{d:getArea('expense'),fill:'url(#expFill)'}),h('path',{d:getPath('income'),fill:'none',stroke:'var(--green)',strokeWidth:3,strokeLinecap:'round',strokeLinejoin:'round'}),h('path',{d:getPath('expense'),fill:'none',stroke:'var(--red)',strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round'}),
   vals.map((x,i)=>h('g',{key:x.month},h('text',{x:xx(i),y:H-8,fill:'var(--muted)',fontSize:12,textAnchor:'middle'},x.label||monthShort(x.month)),h('circle',{cx:xx(i),cy:yy(x.income),r:3,fill:'var(--green)'}))),
  h('details',{className:'mf-chart-data'},h('summary',{},'Consultar valores do gráfico'),
   h('div',{className:'mf-chart-table-wrap'},h('table',{},h('thead',{},h('tr',{},['Período','Receitas','Despesas'].map(a=>h('th',{key:a,scope:'col'},a)))),
    h('tbody',{},vals.map((x,i)=>h('tr',{key:x.month+'-'+i},h('th',{scope:'row'},x.label||monthShort(x.month)),h('td',{},fmt(x.income)),h('td',{},fmt(x.expense))))))))));
}
function Donut(p:any){
 const all=(p.items as {name:string;total:number}[]).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
 const total=all.reduce((a,x)=>a+x.total,0);
 const remaining=all.slice(5).reduce((a,x)=>a+x.total,0);
 const vals=remaining?[...all.slice(0,5),{name:'Outras',total:remaining}]:all.slice(0,5);
 const colorOf=(name:string)=>name==='Outras'?'#9A90AA':p.colors?.[name]||COLORS[Math.max(0,CATS.indexOf(name))%COLORS.length];
 let deg=0;
 const seg=vals.map(x=>{const start=deg;deg+=x.total/Math.max(total,1)*360;return `${colorOf(x.name)} ${start}deg ${deg}deg`;});
 return h('div',{className:'donut-wrap'},
  h('div',{className:'donut',role:'img','aria-label':'Distribuição de '+fmt(total)+' em despesas',style:{background:total?`conic-gradient(${seg.join(',')})`:'conic-gradient(#2c2938 0 360deg)'}},
   h('div',{className:'donut-inner'},h('b',{},fmt(total)),h('small',{},'em despesas'))),
  h('div',{className:'donut-legend'},total?vals.map(v=>h('div',{className:'legend-row',key:v.name},
    h('span',{className:'legend-text'},h('i',{style:{background:colorOf(v.name)}}),p.emojis?.[v.name]?h('span',{className:'legend-emoji'},p.emojis[v.name]):null,v.name),
    h('strong',{},fmt(v.total),' · '+(v.total/total*100).toFixed(1).replace('.',',')+'%'))):h('p',{className:'muted-desc'},'Sem despesas no período')),
  total&&all.length>5?h('details',{className:'donut-all-categories'},h('summary',{},'Ver todas as categorias ('+all.length+')'),
   h('div',{className:'donut-all-list'},all.map(v=>h('div',{key:v.name},h('span',{},v.name),h('strong',{},fmt(v.total),' · '+(v.total/total*100).toFixed(1).replace('.',',')+'%')))),
   h('small',{},'Percentuais arredondados; valores em reais preservam o total.')):null);
}

// B02: accessible category action per row, opening the already existing editor.
function TransactionCategoryButton(p:{category:string;emoji?:string;label:string;expanded?:boolean;disabled?:boolean;onClick:(event:any)=>void}){
 return h('button',{type:'button',className:'category-tag mf-category-edit',title:'Alterar categoria sem abrir detalhes','aria-label':p.label,'aria-haspopup':'dialog','aria-expanded':!!p.expanded,disabled:p.disabled,onClick:p.onClick},
  h('span',{},(p.emoji||'✨')+' '+p.category),h('span',{className:'mf-category-edit-mark','aria-hidden':'true'},'✎'));
}
type Choice = {value:string;label:string};
class StyledSelect extends React.Component<any,any>{
 private trigger:any=null;private menu:any=null;
 constructor(props:any){super(props);this.state={open:false,focusIndex:0,placement:{left:0,top:0,width:220,maxHeight:250}};}
 componentDidMount(){document.addEventListener('pointerdown',this.onOutside,true);window.addEventListener('resize',this.close);window.addEventListener('scroll',this.onScroll,true);}
 componentWillUnmount(){document.removeEventListener('pointerdown',this.onOutside,true);window.removeEventListener('resize',this.close);window.removeEventListener('scroll',this.onScroll,true);}
 close=()=>{if(this.state.open)this.setState({open:false});};
 onScroll=(e:any)=>{
  if(!this.state.open||this.menu?.contains(e.target))return;
  // Keep an open portal aligned when its own drawer scrolls.
  if(e.target?.contains?.(this.trigger)){this.setState({placement:this.geometry()});return;}
  this.close();
 };
 onOutside=(e:any)=>{if(this.state.open&&!this.trigger?.contains(e.target)&&!this.menu?.contains(e.target))this.close();};
 geometry(){const r=this.trigger?.getBoundingClientRect();if(!r)return this.state.placement;const height=Math.min(300,window.innerHeight-30),below=window.innerHeight-r.bottom-14;const width=Math.max(r.width,Math.min(250,window.innerWidth-24));return{left:Math.max(12,Math.min(r.left,window.innerWidth-width-12)),top:below>160?r.bottom+6:Math.max(10,r.top-height-6),width,maxHeight:below>160?Math.min(height,below):height};}
 open=()=>{if(this.props.disabled)return;const idx=(this.props.options||[]).findIndex((x:Choice)=>x.value===this.props.value);this.setState({open:!this.state.open,focusIndex:Math.max(0,idx),placement:this.geometry()});};
 pick=(v:string)=>{this.setState({open:false});this.props.onChange(v);this.trigger?.focus();};
 onKey=(e:any)=>{
  const options=this.props.options||[];
  if(e.key==='Escape'){
   if(!this.state.open)return;
   e.preventDefault();
   e.stopPropagation(); // Escape closes the selector, never its parent drawer.
   this.close();
   this.trigger?.focus();
   return;
  }
  if(!options.length)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const dir=e.key==='ArrowDown'?1:-1;this.setState((s:any)=>({open:true,placement:this.geometry(),focusIndex:s.open?(s.focusIndex+dir+options.length)%options.length:Math.max(0,options.findIndex((x:Choice)=>x.value===this.props.value))}));return;}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();if(this.state.open)this.pick(options[this.state.focusIndex]?.value||options[0].value);else this.open();}
 };
 render(){const options:Choice[]=this.props.options||[],current=options.find(x=>x.value===this.props.value),p=this.state.placement;
  return h('div',{className:'mf-select-wrap '+(this.props.wrapperClass||'')},
    h('button',{type:'button',ref:(e:any)=>this.trigger=e,disabled:this.props.disabled,role:'combobox','aria-expanded':this.state.open,'aria-haspopup':'listbox','aria-label':this.props.ariaLabel||'Selecionar opção',className:'mf-select-trigger '+(this.props.className||''),onClick:this.open,onKeyDown:this.onKey},h('span',{},current?.label||this.props.value||'Selecione'),h('span',{className:'mf-caret','aria-hidden':'true'},h(Icon,{name:'chevron-down',size:16}))),
    this.state.open?ReactDOM.createPortal(h('div',{ref:(e:any)=>this.menu=e,className:'mf-select-popover',role:'listbox',onKeyDown:this.onKey,style:{position:'fixed',left:p.left,top:p.top,width:p.width,maxHeight:p.maxHeight}},
      options.map((item,i)=>h('button',{key:item.value,type:'button',role:'option','aria-selected':item.value===this.props.value,className:'mf-option '+(item.value===this.props.value?'is-selected ':'')+(i===this.state.focusIndex?'is-focused':''),onMouseEnter:()=>{if(this.state.focusIndex!==i)this.setState({focusIndex:i});},onClick:()=>this.pick(item.value)},h('span',{},item.label),item.value===this.props.value?h('span',{className:'mf-option-check','aria-hidden':'true'},h(Icon,{name:'check',size:15})):null))),document.body):null);
 }
}

class SingleDatePicker extends React.Component<any,any>{
 private trigger:any=null;private panel:any=null;
 constructor(props:any){super(props);this.state={open:false,view:(props.value||iso(new Date())).slice(0,7),left:0,top:0};}
 componentDidMount(){document.addEventListener('pointerdown',this.outside,true);window.addEventListener('resize',this.close);window.addEventListener('scroll',this.onScroll,true);}
 componentWillUnmount(){document.removeEventListener('pointerdown',this.outside,true);window.removeEventListener('resize',this.close);window.removeEventListener('scroll',this.onScroll,true);}
 close=()=>this.setState({open:false});
 closeAndFocus=()=>{if(this.state.open)this.setState({open:false},()=>this.trigger?.focus());};
 onKeyDown=(e:any)=>{
  if(e.key==='Escape'&&this.state.open){e.preventDefault();e.stopPropagation();this.closeAndFocus();return;}
  const day=e.target?.getAttribute?.('data-date');
  if(!day||!this.state.open)return;
  const delta:{[key:string]:number}={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  if(delta[e.key]===undefined&&e.key!=='Home'&&e.key!=='End')return;
  e.preventDefault();e.stopPropagation();
  const next=e.key==='Home'?advanceDate(day,-((fromISO(day).getDay()+6)%7)):
   e.key==='End'?advanceDate(day,6-((fromISO(day).getDay()+6)%7)):advanceDate(day,delta[e.key]);
  const focusDay=()=>this.panel?.querySelector('[data-date="'+next+'"]')?.focus({preventScroll:true});
  if(next.slice(0,7)!==this.state.view)this.setState({view:next.slice(0,7)},focusDay);else focusDay();
 };
 onScroll=(e:any)=>{
  if(!this.state.open||this.panel?.contains(e.target))return;
  if(e.target===document||e.target===document.documentElement||e.target===document.body){
   const r=this.trigger?.getBoundingClientRect();if(!r)return;
   const width=Math.min(326,window.innerWidth-20);
   const left=Math.max(10,Math.min(r.left,window.innerWidth-width-10));
   const height=Math.min(380,window.innerHeight-20);
   this.setState({left,top:r.bottom+height+6>window.innerHeight?Math.max(10,r.top-height-6):r.bottom+6});
  }else this.close();
 };
 outside=(e:any)=>{if(this.state.open&&!this.trigger?.contains(e.target)&&!this.panel?.contains(e.target))this.close();};
 toggle=()=>{if(this.props.disabled)return;const r=this.trigger?.getBoundingClientRect();if(!r)return;const width=Math.max(0,Math.min(326,window.innerWidth-20)),left=Math.max(10,Math.min(r.left,window.innerWidth-width-10));this.setState({open:!this.state.open,view:(this.props.value||iso(new Date())).slice(0,7),left,top:r.bottom+Math.min(380,window.innerHeight-20)+6>window.innerHeight?Math.max(10,r.top-Math.min(380,window.innerHeight-20)-6):r.bottom+6},()=>{if(this.state.open)this.panel?.querySelector('.mf-day.selected,.mf-day')?.focus({preventScroll:true});});};
 render(){const ym=this.state.view,[y,m]=ym.split('-').map(Number),first=new Date(y,m-1,1),offset=(first.getDay()+6)%7,count=new Date(y,m,0).getDate();
  return h('div',{className:'mf-single-date'},h('button',{ref:(e:any)=>this.trigger=e,type:'button',className:'mf-date-trigger',disabled:this.props.disabled,onClick:this.toggle,onKeyDown:this.onKeyDown,'aria-haspopup':'dialog','aria-expanded':this.state.open},h(Icon,{name:'calendar',size:16}),this.props.value?.split('-').reverse().join('/')||'Selecionar data',h('span',{className:'mf-caret','aria-hidden':'true'},h(Icon,{name:'chevron-down',size:16}))),
   this.state.open?ReactDOM.createPortal(h('div',{ref:(e:any)=>this.panel=e,className:'mf-single-calendar',role:'dialog','aria-label':'Selecionar data',onKeyDown:this.onKeyDown,style:{position:'fixed',left:this.state.left,top:this.state.top,width:Math.min(326,window.innerWidth-20)}},
     h('div',{className:'mf-calendar-nav'},h('button',{type:'button',onClick:()=>this.setState({view:shiftMonth(ym,-1)})},'‹'),h('strong',{},prettyMonth(ym)),h('button',{type:'button',onClick:()=>this.setState({view:shiftMonth(ym,1)})},'›')),
     h('div',{className:'mf-calendar-grid'},['S','T','Q','Q','S','S','D'].map((label,i)=>h('span',{key:'h'+i,className:'mf-weekday'},label)),Array.from({length:offset},(_,i)=>h('span',{key:'e'+i})),Array.from({length:count},(_,i)=>{const day=ym+'-'+String(i+1).padStart(2,'0');return h('button',{key:day,type:'button','aria-label':day,'data-date':day,'aria-pressed':this.props.value===day,className:'mf-day '+(this.props.value===day?'selected':''),onClick:()=>{this.props.onChange(day);this.closeAndFocus();}},i+1);})),
     h('button',{type:'button',className:'mf-today-link',onClick:()=>{this.props.onChange(iso(new Date()));this.closeAndFocus();}},'Hoje')),
    document.body):null);
 }
}

class PeriodPicker extends React.Component<any,any>{
 private trigger:any=null;private panel:any=null;
 constructor(props:any){super(props);this.state={open:false,custom:false,start:props.span.start,end:props.span.end,step:'start',view:props.span.end.slice(0,7),placement:{left:0,top:0}};}
 componentDidMount(){document.addEventListener('pointerdown',this.onOutside,true);window.addEventListener('resize',this.close);window.addEventListener('scroll',this.onScroll,true);}
 componentWillUnmount(){document.removeEventListener('pointerdown',this.onOutside,true);window.removeEventListener('resize',this.close);window.removeEventListener('scroll',this.onScroll,true);}
 close=()=>{if(this.state.open)this.setState({open:false});};
 closeAndFocus=()=>{if(this.state.open)this.setState({open:false},()=>this.trigger?.focus());};
 onKeyDown=(e:any)=>{
  if(e.key==='Escape'&&this.state.open){e.preventDefault();e.stopPropagation();this.closeAndFocus();return;}
  const day=e.target?.getAttribute?.('data-date');
  if(!day||!this.state.open)return;
  const delta:{[key:string]:number}={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  if(delta[e.key]===undefined&&e.key!=='Home'&&e.key!=='End')return;
  e.preventDefault();e.stopPropagation();
  const next=e.key==='Home'?advanceDate(day,-((fromISO(day).getDay()+6)%7)):
   e.key==='End'?advanceDate(day,6-((fromISO(day).getDay()+6)%7)):advanceDate(day,delta[e.key]);
  const focusDay=()=>this.panel?.querySelector('[data-date="'+next+'"]')?.focus({preventScroll:true});
  if(next.slice(0,7)!==this.state.view)this.setState({view:next.slice(0,7)},focusDay);else focusDay();
 };
 onScroll=(e:any)=>{
  if(!this.state.open||this.panel?.contains(e.target))return;
  if(e.target===document||e.target===document.documentElement||e.target===document.body){
   const r=this.trigger?.getBoundingClientRect();if(!r)return;
   const width=Math.min(366,window.innerWidth-20);
   const left=Math.max(10,Math.min(r.right-width,window.innerWidth-width-10));
   const top=r.bottom+8;
   this.setState({placement:{left,top:top+440>window.innerHeight?Math.max(10,r.top-446):top}});
  }else this.close();
 };
 onOutside=(e:any)=>{if(this.state.open&&!this.trigger?.contains(e.target)&&!this.panel?.contains(e.target))this.close();};
 toggle=()=>{const r=this.trigger?.getBoundingClientRect();if(!r)return;const width=Math.min(366,window.innerWidth-20);const left=Math.max(10,Math.min(r.right-width,window.innerWidth-width-10));const top=r.bottom+8;this.setState({open:!this.state.open,custom:this.props.mode==='custom',start:this.props.span.start,end:this.props.span.end,step:'start',view:this.props.span.end.slice(0,7),placement:{left,top:top+440>window.innerHeight?Math.max(10,r.top-446):top}},()=>{if(this.state.open)this.panel?.querySelector('button')?.focus();});};
 pickPreset=(mode:PeriodMode)=>{this.closeAndFocus();this.props.onChange(mode);};
 pickDate=(day:string)=>{if(this.state.step==='start'||day<this.state.start){this.setState({start:day,end:'',step:'end'});}else this.setState({end:day,step:'start'});};
 renderCalendar(){const ym=this.state.view,[year,mon]=ym.split('-').map(Number),first=new Date(year,mon-1,1),offset=(first.getDay()+6)%7,num=new Date(year,mon,0).getDate(),dates:Array<string|null>=Array.from({length:offset},()=>null).concat(Array.from({length:num},(_,i)=>ym+'-'+String(i+1).padStart(2,'0')));
  return h('div',{className:'mf-calendar'},h('div',{className:'mf-calendar-nav'},h('button',{type:'button',onClick:()=>this.setState({view:shiftMonth(ym,-1)})},'‹'),h('strong',{},prettyMonth(ym)),h('button',{type:'button',onClick:()=>this.setState({view:shiftMonth(ym,1)})},'›')),
   h('div',{className:'mf-calendar-grid'},['S','T','Q','Q','S','S','D'].map((d,i)=>h('span',{key:'weekday'+i,className:'mf-weekday'},d)),dates.map((day,i)=>day?h('button',{type:'button',key:day, 'aria-label':day,'data-date':day, 'aria-pressed':day===this.state.start||day===this.state.end,className:'mf-day '+(day===this.state.start||day===this.state.end?'selected ':'')+(this.state.end&&day>this.state.start&&day<this.state.end?'in-range':''),onClick:()=>this.pickDate(day)},String(+day.slice(8))):h('span',{key:'empty'+i}))) );
 }
 render(){const presets:Choice[]=[{value:'week',label:'Esta semana'},{value:'15d',label:'Últimos 15 dias'},{value:'month',label:'Mês atual'},{value:'lastmonth',label:'Mês passado'}],span=this.props.span,p=this.state.placement;
  return h('div',{className:'mf-period-holder'},h('button',{type:'button',className:'mf-period-trigger',ref:(e:any)=>this.trigger=e,'aria-expanded':this.state.open,'aria-haspopup':'dialog',onClick:this.toggle,onKeyDown:this.onKeyDown},h(Icon,{name:'calendar',size:17}),h('span',{},spanLabel(this.props.mode,span)),h('span',{className:'mf-caret','aria-hidden':'true'},h(Icon,{name:'chevron-down',size:16}))),
   this.state.open?ReactDOM.createPortal(h('div',{className:'mf-period-popover',role:'dialog','aria-label':'Selecionar período',ref:(e:any)=>this.panel=e,onKeyDown:this.onKeyDown,style:{position:'fixed',left:p.left,top:p.top,width:Math.min(366,window.innerWidth-20)}},
     h('strong',{className:'mf-popup-title'},'Período de análise'),
     h('div',{className:'mf-period-presets'},presets.map(a=>h('button',{key:a.value,type:'button',className:this.props.mode===a.value&&!this.state.custom?'selected':'',onClick:()=>this.pickPreset(a.value as PeriodMode)},a.label))),
     h('button',{type:'button',className:'mf-custom-toggle '+(this.state.custom?'selected':''),onClick:()=>this.setState({custom:!this.state.custom,step:'start'})},'Selecionar datas personalizadas',h(Icon,{name:this.state.custom?'chevron-up':'chevron-down',size:16})),
     this.state.custom?h('div',{className:'mf-custom-calendar'},h('p',{},this.state.step==='start'?'Selecione a data inicial':'Agora selecione a data final'),
        h('div',{className:'mf-range-values'},h('span',{},'Início: ',h('b',{},this.state.start?.split('-').reverse().join('/')||'—')),h('span',{},'Fim: ',h('b',{},this.state.end?.split('-').reverse().join('/')||'—'))),
        this.renderCalendar(),h('div',{className:'mf-range-actions'},h('button',{type:'button',onClick:this.close},'Cancelar'),h('button',{type:'button',disabled:!this.state.start||!this.state.end||this.state.end<this.state.start,onClick:()=>{this.props.onChange('custom',this.state.start,this.state.end);this.closeAndFocus();}},'Aplicar período'))):null),document.body):null);
 }
}

class App extends React.Component<any,State>{
 private fileInput:any; private csvInput:any; private timeout:any; private writeInProgress=false; private autoSyncTimer:any=null; private unsubscribePersonalCloud:(()=>void)|null=null; private unsubscribeAI:(()=>void)|null=null; private lastSyncAttempt=0; private focusReturn:any=null; private focusCategoryOnDetailOpen=false; private quickCategoryAnchor:HTMLElement|null=null; private quickCategorySearchInput:HTMLElement|null=null; private quickCategoryWrite=false; private reviewSavingKeys=new Set<string>(); private categorySavingKeys=new Set<string>(); private categorySaveQueue:Promise<any>=Promise.resolve();
 private simRequest=0;
 constructor(props:any){super(props);const mode:'real'|'demo'='real';this.state={mode,data:desktop?starter():load(mode),page:'overview',month:nowYM,showEntry:false,entry:{date:iso(new Date()),description:'',kind:'expense',category:'Outros',value:''},sim:{value:'',installments:'6',interest:'0'},outcome:null,simCalculatedInput:null,simResultStale:false,simError:'',query:'',toast:'',budgetEdit:'',busy:!!desktop,booting:!!desktop,editModal:null,bank:EMPTY_BANK,bankForm:{clientId:'',clientSecret:'',itemIds:''},bankBusy:false,bankMessage:'',bankFilter:'',txSource:'all',txReviewOnly:false,txOrganize:false,txAdvancedOpen:false,txCategoryFilter:'',txKindFilter:'all',txReviewFilter:'all',txSort:'date_desc',quickCategory:null,quickCategoryQuery:'',quickCategoryIndex:0,quickCategoryBusy:false,quickCategoryError:'',categoryMoreEmojis:false,quickAddOpen:false,dashboardSource:'bank',sourceDetailsOpen:false,budgetTab:'expense',showAllBudgetCategories:false,categories:DEFAULT_CATEGORY_INFOS,rules:[],categoryEditor:{previousName:'',name:'',color:'#3e9a85',emoji:'✨',kind:'expense'},ruleEditor:emptyRule(),ruleTest:'IFOOD',categoryMessage:'',entryCategoryTouched:false,bankConfigOpen:false,overviewPeriod:'month',customStart:iso(new Date()),customEnd:iso(new Date()),backupInfo:{copies:0,last:null},detail:null,detailDraft:{merchant:'',note:'',nature:'auto',reviewed:false,aliasPattern:'',splitParts:[]},manualDraft:null,detailBusy:false,categorySaving:[],txSelected:[],txBatchCategory:'Alimentação',planning:EMPTY_PLANNING,planMonth:nowYM,planDay:iso(new Date()),planSelected:null,planOpen:false,planForm:freshPlanForm(),planBusy:false,planView:'all',planTerm:'',planIncludeEstimated:false,planBankTitle:'',planMatchQuery:'',planHistory:[],cloudStage:'not_started',cloudBusy:false,cloudMessage:'',cloudIdentityConnected:false,cloudQuarantineVerified:false,cloudPersonalTransferred:false,cloudParityBusy:false,cloudParityMessage:'',cloudE1Report:null,intelligenceTab:'today',intelligenceDraft:'',intelligencePreparedQuestion:'',intelligencePanelOpen:false,intelligenceContext:'overview',intelligenceExpandedAction:null,aiStatus:{connected:false,secure:false},aiBusy:false,aiError:'',aiDemoCase:'budget',aiEffort:'auto',aiCreditsConfirmed:false,aiResult:null,aiStreaming:'',aiCapabilities:null,aiMemories:[],aiMemoryDraft:'',aiMemoryKind:'preference',aiMemoryBusy:false,aiMemoryError:'',aiUseMemories:false,aiPreview:null,aiUsageStats:null,aiFinancialDemoSource:'bank',aiFinancialDemo:null,aiFinancialDemoBusy:false,aiFinancialDemoError:''};}
 async componentDidMount(){
   window.addEventListener('keydown',this.onGlobalKeydown);
    window.addEventListener('resize',this.onQuickCategoryViewportChange);
    window.addEventListener('scroll',this.onQuickCategoryViewportChange,true);
    document.addEventListener('pointerdown',this.onQuickCategoryOutside,true);
   if(!desktop)return;
   this.unsubscribeAI=desktop.onAIDelta?.((delta:string)=>this.setState((previous:State)=>({aiStreaming:(previous.aiStreaming+delta).slice(0,12000)})))||null;
   void intelligenceRefresh(this);
   try {
     const persisted=await desktop.load('real');
     this.setState({data:persisted?safeData(persisted):starter(),busy:false,booting:false});
     await this.refreshCategories();
     const currentBank=await this.refreshBank();
     await this.refreshPlanning();
     this.unsubscribePersonalCloud=desktop.onCloudPersonalUpdated?.((event)=>{
       if(event?.inbound>0&&this.state.mode==='real')void this.refreshCloudPersonalUI();
     })||null;
     try{const backupInfo=await desktop.backupStatus?.();if(backupInfo)this.setState({backupInfo});}catch(_){}
     try{const cloud=await desktop.cloudMigrationStatus?.();if(cloud)this.setState({cloudStage:cloud.stage});}catch(_){}
     try{const identity=await desktop.cloudAccessStatus?.();if(identity)this.setState({cloudIdentityConnected:!!identity.connected});}catch(_){}
     this.autoSyncTimer=window.setInterval(()=>this.maybeAutoSync(),30*60*1000);
     if(currentBank)this.maybeAutoSync(currentBank);
   } catch(e:any){this.setState({fatal:'Não foi possível abrir seus dados pessoais: '+String(e?.message||e),busy:false,booting:false});}
 }
 componentDidUpdate(_prevProps:any,previous:State){
   if(!previous.contextCategory&&this.state.contextCategory)(document.querySelector('.mf-context-category input') as HTMLElement|null)?.focus();
   if(previous.contextCategory&&!this.state.contextCategory)(document.querySelector(this.state.showEntry?'.modal input':'.u5-category-search input') as HTMLElement|null)?.focus();
   const before=!!(previous.contextCategory||previous.showEntry||previous.editModal||previous.detail||previous.planOpen||previous.planSelected||previous.intelligencePanelOpen);
   const now=!!(this.state.contextCategory||this.state.showEntry||this.state.editModal||this.state.detail||this.state.planOpen||this.state.planSelected||this.state.intelligencePanelOpen);
   if(!before&&now){
     this.focusReturn=document.activeElement;
     const dialog=document.querySelector('.modal-backdrop [role="dialog"],.mf-detail-drawer,.mf-ai-drawer');
     const control=dialog?.querySelector('input:not([disabled]),button:not([disabled])') as HTMLElement|null;
     // B02: focus the category input only for category-cell entry.
     const categoryControl=this.focusCategoryOnDetailOpen&&this.state.detail
       ?dialog?.querySelector('.mf-transaction-category-select') as HTMLElement|null:null;
     (categoryControl||control)?.focus();
     this.focusCategoryOnDetailOpen=false;
   }else if(before&&!now){
     if(previous.intelligencePanelOpen)(document.querySelector('.mf-ai-fab') as HTMLElement|null)?.focus();
     else if(this.focusReturn&&document.contains(this.focusReturn))this.focusReturn.focus?.();
     this.focusReturn=null;
   }
 }
 async refreshCloudPersonalUI(){
   if(!desktop||this.state.mode!=='real')return;
   try{
     const latest=await desktop.load('real');
     if(latest)this.setState({data:safeData(latest)});
     await this.refreshCategories();
     await this.refreshPlanning();
   }catch(_){
     // Keep existing forms and local data if cloud refresh is interrupted.
   }
 }
 async refreshBank(){
   if(!desktop?.bankStatus)return;
   try{const bank=await desktop.bankStatus();this.setState({bank,bankForm:{clientId:bank.config.clientId||'',clientSecret:'',itemIds:(bank.config.itemIds||[]).join(', ')}});return bank;}
   catch(e:any){this.setState({bankMessage:'Não foi possível consultar a integração: '+String(e?.message||e)});}
 }
 componentWillUnmount(){window.removeEventListener('keydown',this.onGlobalKeydown);window.removeEventListener('resize',this.onQuickCategoryViewportChange);window.removeEventListener('scroll',this.onQuickCategoryViewportChange,true);document.removeEventListener('pointerdown',this.onQuickCategoryOutside,true);this.unsubscribePersonalCloud?.();this.unsubscribeAI?.();if(this.autoSyncTimer)clearInterval(this.autoSyncTimer);if(this.timeout)clearTimeout(this.timeout);}
 onGlobalKeydown=(event:KeyboardEvent)=>{
    if(event.key==='Escape'&&this.state.contextCategory){event.preventDefault();this.closeContextCategory();return;}
    if(event.key==='Escape'&&this.state.quickCategory){event.preventDefault();this.closeQuickCategory();return;}
    const dialog=document.querySelector('.modal-backdrop [role="dialog"],.mf-detail-drawer,.mf-ai-drawer');
   if(event.key==='Tab'&&dialog&&!document.querySelector('[role="listbox"],.mf-period-popover,.mf-single-calendar')){
     const controls=Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]')) as HTMLElement[];
     if(controls.length){
       const first=controls[0],last=controls[controls.length-1];
       if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}
       else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
     }
     return;
   }
   if(event.key==='Escape'&&this.state.contextCategory){event.preventDefault();this.closeContextCategory();return;}
   if(event.key!=='Escape')return;
   // Popup menus consume Escape without closing the underlying dialog.
   if(document.querySelector('[role="listbox"],.mf-period-popover,.mf-single-calendar'))return;
   if(this.state.quickAddOpen){this.setState({quickAddOpen:false});return;}
   if(this.state.intelligencePanelOpen){this.setState({intelligencePanelOpen:false});return;}
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
 async importCategoryPack(){
   if(!desktop?.importCategoryPack||this.state.mode==='demo')return;
   try{
     const result=await desktop.importCategoryPack();
     if(result?.cancelled)return;
     this.setState({categories:result.categories.categories,rules:result.categories.rules,bank:{...this.state.bank,data:result.data},
       categoryMessage:`Sugestões aplicadas: ${result.rulesAdded} regras, ${result.overridesAdded} classificações. Outras movimentações continuam disponíveis para revisão.`});
     await this.refreshPlanning();
   }catch(e:any){this.setState({categoryMessage:'Não foi possível importar as sugestões: '+String(e?.message||e)});}
 }
 async refreshCategories(){
   if(!desktop?.categoriesStatus)return;
   try{const state=await desktop.categoriesStatus();this.setState({categories:state.categories,rules:state.rules});}
   catch(e:any){this.setState({categoryMessage:String(e?.message||e)});}
 }
 getCategories(){return this.state.categories.length?this.state.categories:DEFAULT_CATEGORY_INFOS;}
 async saveCategory(){
   if(!desktop||this.state.mode==='demo')return;
   const value={...this.state.categoryEditor},context=this.state.contextCategory;
   if(this.state.categoryContextBusy)return;this.setState({categoryContextBusy:true});
   try{
     const state=await desktop.categorySave(value);
     const persisted=await desktop.load(this.state.mode);
     this.setState({categories:state.categories,rules:state.rules,categoryEditor:{previousName:'',name:'',color:'#3e9a85',emoji:'✨',kind:'expense'},categoryMessage:'Categoria salva.',data:persisted?safeData(persisted):this.state.data});
     await this.refreshBank();
     if(context&&this.state.contextCategory===context){
      const same=this.state.mode===context.mode&&this.state.bankFilter===context.account&&this.state.query===context.query;
      this.setState({contextCategory:undefined,categoryEditor:context.editor,...(same?(context.target==='entry'?{entry:{...this.state.entry,category:value.name.trim()},entryCategoryTouched:true}:context.target==='quick'?{quickCategoryQuery:value.name.trim(),quickCategoryIndex:0}:{txBatchCategory:value.name.trim()}):{} )});
      this.flash('Categoria criada. Confira e aplique na classificação.');
     }
   }catch(e:any){this.setState({categoryMessage:String(e?.message||e)});}
   finally{this.setState({categoryContextBusy:false});}
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
 async setBankCategory(tx:BankTx,category:string):Promise<boolean>{
  if(!desktop||this.state.mode==='demo')return false;
  const key=tx.accountId+'|'+tx.id;
  if(this.categorySavingKeys.has(key))return false;
  this.categorySavingKeys.add(key);
  this.setState((prev:State)=>({categorySaving:[...prev.categorySaving,key],categoryMessage:'Salvando categoria…'}));
  // Full snapshots returned by IPC must be serialized to avoid stale overwrite.
  const job=this.categorySaveQueue.then(()=>desktop!.bankCategorize({accountId:tx.accountId,externalId:tx.id,category:category||null}))
    .then(data=>{
      if(!data||!Array.isArray(data.transactions))throw new Error('Resposta bancária inválida.');
      this.setState({bank:{...this.state.bank,data},categoryMessage:'Classificação bancária salva.'});
      return true;
    })
    .catch((e:any)=>{this.flash('Falha ao classificar: '+String(e?.message||e));return false;})
    .finally(()=>{this.categorySavingKeys.delete(key);this.setState((prev:State)=>({categorySaving:prev.categorySaving.filter(k=>k!==key)}));});
  this.categorySaveQueue=job;
  return await job;
 }
 async changeManualCategory(id:string,category:string):Promise<boolean>{
  const data=this.state.data,current=data.transactions.find(t=>t.id===id);
  if(!current)return false;
  if(current.category===category)return true;
  if(!this.getCategories().some(c=>c.name===category&&(c.kind==='both'||c.kind===current.kind))){
    this.flash('Categoria incompatível com esta movimentação.');return false;
  }
  return await this.updateData({...data,transactions:data.transactions.map(t=>t.id===id?{...t,category}:t)});
 }
 bankTxSelected(tx:BankTx){return this.state.txSelected.includes(tx.accountId+'|'+tx.id);}
 toggleSelected(tx:BankTx){const key=tx.accountId+'|'+tx.id;this.setState({txSelected:this.bankTxSelected(tx)?this.state.txSelected.filter(x=>x!==key):this.state.txSelected.length>=100?this.state.txSelected:[...this.state.txSelected,key]});}
 openBankDetail(tx:BankTx){
   this.setState({detail:{origin:'bank',id:tx.id,accountId:tx.accountId},detailDraft:{merchant:tx.merchant||'',note:tx.note||'',nature:tx.nature||'auto',reviewed:!!tx.reviewed,aliasPattern:tx.description.slice(0,60),splitParts:(tx.splits?.length?tx.splits:[{category:tx.category,amount:Math.floor(Math.abs(tx.amount)/2)},{category:tx.category,amount:Math.abs(tx.amount)-Math.floor(Math.abs(tx.amount)/2)}]).map(p=>({category:p.category,value:moneyString(p.amount)}))}});
 }
 openManualDetail(tx:Tx){
  this.setState({detail:{origin:'manual',id:tx.id},
   manualDraft:{description:tx.description,date:tx.date,value:moneyString(tx.amount),category:tx.category}});
 }
 isManualLinked(id:string):boolean{
  return this.state.bank.data.transactions.some(tx=>tx.linkedManualId===id);
 }
 async saveManualDetail(id:string){
  const sel=this.state.detail;
  if(!sel||sel.origin!=='manual'||sel.id!==id||this.state.busy||this.writeInProgress)return false;
  const original=this.state.data.transactions.find(t=>t.id===id);
  const draft=this.state.manualDraft;
  if(!original||!draft)return false;
  const description=draft.description.trim(),amount=parsePositiveBRLInput(draft.value);
  if(!description||description.length>150){this.flash('Informe uma descrição de até 150 caracteres.');return false;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)||iso(fromISO(draft.date))!==draft.date){
   this.flash('Informe uma data válida, inclusive dia e mês.');return false;
  }
  if(!Number.isSafeInteger(amount)||amount<=0){this.flash('Valor inválido. Use reais e no máximo duas casas decimais (ex.: 1.234,56).');return false;}
  const allowed=this.getCategories().some(c=>c.name===draft.category&&
   (original.kind==='income'?c.kind!=='expense':c.kind!=='income'));
  if(!allowed&&draft.category!==original.category){this.flash('Selecione uma categoria compatível.');return false;}
  if(this.isManualLinked(id)&&(draft.date!==original.date||amount!==original.amount)){
   this.flash('Desvincule este lançamento da movimentação bancária antes de mudar data ou valor.');
   return false;
  }
  const result=await this.updateData({...this.state.data,transactions:this.state.data.transactions.map(t=>
   t.id===id?{...t,description,date:draft.date,amount,category:draft.category}:t)},
   'Lançamento atualizado.');
  if(result)this.setState({detail:null,manualDraft:null});
  return result;
 }

 openCategoryFromRow(origin:'bank'|'manual',tx:BankTx|Tx,event:any){
  if(this.quickCategoryWrite||this.state.busy||this.state.detailBusy)return;
  const trigger=event?.currentTarget as HTMLElement;
  const r=trigger?.getBoundingClientRect?.();
  if(!r)return;
  if(this.state.quickCategory?.origin===origin&&this.state.quickCategory.id===tx.id&&
     (origin==='manual'||this.state.quickCategory.accountId===(tx as BankTx).accountId)){
    this.closeQuickCategory();return;
  }
  const width=Math.max(220,Math.min(328,window.innerWidth-24));
  const height=Math.min(342,window.innerHeight-24);
  const below=window.innerHeight-r.bottom;
  this.quickCategoryAnchor=trigger;
  this.setState({quickCategory:{origin,id:tx.id,
    accountId:origin==='bank'?(tx as BankTx).accountId:undefined,
    left:Math.max(12,Math.min(r.left,window.innerWidth-width-12)),
    top:below>height+8?r.bottom+6:Math.max(12,r.top-height-6),width},
    quickCategoryQuery:'',quickCategoryIndex:0,quickCategoryError:''},
    ()=>this.quickCategorySearchInput?.focus());
 }
 closeQuickCategory(restoreFocus:boolean=true){
  if(this.quickCategoryWrite)return;
  const anchor=this.quickCategoryAnchor;
  this.setState({quickCategory:null,quickCategoryQuery:'',quickCategoryIndex:0,quickCategoryError:''},
    ()=>{if(restoreFocus&&anchor?.isConnected)anchor.focus();});
 }
 onQuickCategoryOutside=(event:any)=>{
  if(!this.state.quickCategory||this.quickCategoryWrite)return;
  if(event.target?.closest?.('.u5-category-popover')||this.quickCategoryAnchor?.contains(event.target))return;
  this.closeQuickCategory(false);
 };
 onQuickCategoryViewportChange=(event:any)=>{
  if(!this.state.quickCategory||this.quickCategoryWrite)return;
  if(event?.type==='scroll'&&event.target?.closest?.('.u5-category-popover'))return;
  this.closeQuickCategory(false);
 };
 quickCategoryContext(){
  const target=this.state.quickCategory;
  if(!target)return null;
  if(target.origin==='manual'){
    const tx=this.state.data.transactions.find(t=>t.id===target.id);
    return tx?{category:tx.category,kind:tx.kind,description:tx.description,raw:tx}:null;
  }
  const tx=this.state.bank.data.transactions.find(t=>t.accountId===target.accountId&&t.id===target.id);
  if(!tx)return null;
  const nature=effectiveNature(tx);
  // Category never mutates banking nature. Transfer/ignore require explicit
  // nature review in advanced details, rather than inferred sign.
  return {category:tx.category,kind:(nature==='income'||nature==='expense'?nature:null),
    nature,description:tx.customTitle||tx.merchant||tx.description,raw:tx};
 }
 quickCategoryChoices():CategoryInfo[]{
  const context=this.quickCategoryContext(),term=fold(this.state.quickCategoryQuery);
  if(!context||!context.kind)return [];
  return this.getCategories().filter(c=>(c.kind==='both'||c.kind===context.kind)&&(!term||fold(c.name).includes(term)));
 }
 async chooseQuickCategory(category:string):Promise<boolean>{
  if(this.quickCategoryWrite||!this.state.quickCategory)return false;
  const target=this.state.quickCategory,context=this.quickCategoryContext();
  if(!context){this.setState({quickCategoryError:'Movimentação não encontrada. Atualize a lista.'});return false;}
  if(!context.kind){this.setState({quickCategoryError:'Transferências e movimentações desconsideradas exigem revisar a natureza nos detalhes antes de categorizar.'});return false;}
  const valid=this.getCategories().some(c=>c.name===category&&(c.kind==='both'||c.kind===context.kind));
  if(!valid){this.setState({quickCategoryError:'Categoria incompatível com a movimentação.'});return false;}
  if(category===context.category){this.closeQuickCategory();return true;}
  this.quickCategoryWrite=true;
  this.setState({quickCategoryBusy:true,quickCategoryError:''});
  let saved=false;
  try{
    saved=target.origin==='bank'?
      await this.setBankCategory(context.raw as BankTx,category):
      await this.changeManualCategory(target.id,category);
  }catch(e:any){
    this.setState({quickCategoryError:'Não foi possível salvar: '+String(e?.message||e)});
  }finally{
    this.quickCategoryWrite=false;
    this.setState({quickCategoryBusy:false});
  }
  if(!saved){
    this.setState((state:State)=>({quickCategoryError:state.quickCategoryError||'Não foi possível salvar. A categoria anterior foi mantida.'}));
    return false;
  }
  this.closeQuickCategory();
  this.flash('Categoria atualizada.');
  return true;
 }
 renderQuickCategoryPopover(){
  const target=this.state.quickCategory,context=this.quickCategoryContext();
  if(!target)return null;
  const choices=this.quickCategoryChoices();
  const index=Math.min(this.state.quickCategoryIndex,Math.max(0,choices.length-1));
  const onKey=(e:any)=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.closeQuickCategory();return;}
    if((e.key==='ArrowDown'||e.key==='ArrowUp')&&choices.length){
      e.preventDefault();e.stopPropagation();
      const delta=e.key==='ArrowDown'?1:-1;
      this.setState((prev:State)=>({quickCategoryIndex:(prev.quickCategoryIndex+delta+choices.length)%choices.length}));
      this.quickCategorySearchInput?.focus();return;
    }
    const selected=choices[Math.min(this.state.quickCategoryIndex,choices.length-1)];
    if(e.key==='Enter'&&e.target===this.quickCategorySearchInput&&selected){
      e.preventDefault();e.stopPropagation();void this.chooseQuickCategory(selected.name);
    }
  };
  return ReactDOM.createPortal(h('div',{className:'u5-category-layer'},
    h('section',{className:'u5-category-popover',role:'dialog',
      'aria-label':'Alterar categoria da movimentação',onKeyDown:onKey,
      style:{position:'fixed',left:target.left,top:target.top,width:target.width,
        maxHeight:'min(360px, calc(100vh - 24px))'}},
      h('div',{className:'u5-category-top'},
        h('span',{className:'micro-label'},target.origin==='bank'?'CLASSIFICAÇÃO PESSOAL · BANCO':'LANÇAMENTO MANUAL'),
        h('button',{type:'button',className:'u5-category-close','aria-label':'Fechar categorias',
          disabled:this.state.quickCategoryBusy,onClick:()=>this.closeQuickCategory()},
          h(Icon,{name:'close',size:16}))),
      h('p',{className:'u5-category-current'},'Categoria atual: ',h('strong',{},context?.category||'Indisponível')),
      h('label',{className:'u5-category-search'},h(Icon,{name:'search',size:16}),
        h('input',{ref:(el:any)=>this.quickCategorySearchInput=el,type:'search',
          role:'combobox','aria-label':'Buscar categoria','aria-autocomplete':'list',
          'aria-expanded':true,'aria-controls':'u5-category-options',
          'aria-activedescendant':choices.length?'u5-category-option-'+index:undefined,
          placeholder:'Pesquisar categorias',value:this.state.quickCategoryQuery,
          disabled:this.state.quickCategoryBusy,
          onChange:(e:any)=>this.setState({quickCategoryQuery:e.target.value,quickCategoryIndex:0})})),
      h('div',{id:'u5-category-options',role:'listbox',className:'u5-category-options',
        'aria-label':'Categorias compatíveis'},
        choices.length?choices.map((cat,i)=>h('button',{type:'button',
          id:'u5-category-option-'+i,key:cat.name,role:'option',
          'aria-selected':cat.name===context?.category,
          className:'u5-category-choice '+(i===index?'active ':'')+
            (cat.name===context?.category?'current':''),
          disabled:this.state.quickCategoryBusy,
          onMouseEnter:()=>{if(!this.state.quickCategoryBusy&&this.state.quickCategoryIndex!==i)
            this.setState({quickCategoryIndex:i});},
          onClick:()=>void this.chooseQuickCategory(cat.name)},
          h('span',{},cat.name),cat.name===context?.category?
            h(Icon,{name:'check',size:16}):null)):
        h('p',{className:'u5-category-empty'},context&&!context.kind?'Natureza de transferência ou desconsiderada: altere nos detalhes antes de categorizar.':'Nenhuma categoria compatível encontrada.')),
      this.state.mode==='real'?h('button',{type:'button',className:'mf-new-category',disabled:this.state.quickCategoryBusy,onClick:()=>this.openContextCategory('quick')},h(Icon,{name:'plus',size:15}),'Nova categoria'):null,
      this.state.quickCategoryError?
        h('p',{className:'u5-category-error',role:'alert'},this.state.quickCategoryError):null,
      h('small',{className:'u5-category-hint',role:'status'},
        this.state.quickCategoryBusy?'Salvando categoria…':
          '↑ ↓ para navegar · Enter para salvar · Esc para fechar')
    )),document.body);
 }
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
 async toggleMode(){this.simRequest++;this.setState({simSaved:undefined,simBusy:false});
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
 async prepareCloudOnboarding(){
   if(!desktop?.transferPersonalCloud||!desktop?.connectCloudAccess||this.state.cloudBusy||
      this.state.busy||this.state.bankBusy||this.state.mode!=='real')return;
   this.setState({cloudBusy:true,
     cloudMessage:'Conectando ao login protegido. O envio precisará da sua confirmação explícita...'});
   try{
     const identity=await desktop.connectCloudAccess();
     if(!identity?.connected){
       this.setState({cloudBusy:false,cloudIdentityConnected:false,
         cloudMessage:'Login ainda não concluído. Nenhum dado enviado. Clique para tentar novamente.'});
       return;
     }
     this.setState({cloudIdentityConnected:true,
       cloudMessage:'Login confirmado. O Windows solicitará autorização antes de copiar suas personalizações.'});
     const result=await desktop.transferPersonalCloud();
     if(result?.cancelled){
       this.setState({cloudBusy:false,cloudMessage:'Transferência cancelada por você. Nenhum registro novo enviado.'});
       return;
     }
     if(result?.stage!=='quarantine_verified'||!result.backupVerified||
        result.personalTablesReady!==17||result.recordsSent!==result.personalRecordsReady||
        result.financialSyncEnabled!==false)
       throw new Error('A nuvem não confirmou o pacote completo.');
     this.setState({cloudBusy:false,cloudPersonalTransferred:true,
       cloudStage:'quarantine_verified',
       cloudMessage:'Personalizações copiadas e conferidas na área protegida da Cloudflare: '+
         result.recordsSent+' registros em 17 tabelas. Backup automático preservado. '+
         'Sincronização financeira ainda não ativada; falta conciliar o histórico bancário com o Pluggy.'});
   }catch(error:any){
     this.setState({cloudBusy:false,
       cloudMessage:'Não foi possível concluir a conferência na nuvem: '+
         String(error?.message||error)+
         '. O SQLite original permanece disponível e a sincronização financeira continua desativada.'});
   }
 }
 async auditCloudE1(){
   if(!desktop?.cloudE1Audit||this.state.cloudParityBusy||
      this.state.busy||this.state.bankBusy||this.state.mode!=='real')return;
   this.setState({cloudParityBusy:true,cloudE1Report:null,
     cloudParityMessage:'Conferindo histórico, contas, categorias e referências do Windows com a nuvem...'});
   try{
     const result=await desktop.cloudE1Audit();
     if(result?.ok!==true||result.stage!=='e1_consolidated_comparison'||
        result.e1Completed!==false||result.cloudCutoverAllowed!==false||!result.checks){
       this.setState({cloudParityBusy:false,cloudE1Report:null,
         cloudParityMessage:result?.reason==='cloud_login_required'?
           'Entre na sessão protegida da Cloudflare no Windows e tente novamente.':
           'Auditoria indisponível neste ambiente. Nenhuma informação financeira foi alterada.'});
       return;
     }
     this.setState({cloudParityBusy:false,cloudE1Report:result,
       cloudParityMessage:'E1: '+result.verifiedCount+' verificações confirmadas, '+
         result.mismatchCount+' divergências e '+result.pendingCount+
         ' pendências. Windows '+result.counts?.bankWindows+
         ' × Cloudflare '+result.counts?.bankCloud+
         ' transações. A base única continua bloqueada até a conclusão da conferência.'});
   }catch{
     this.setState({cloudParityBusy:false,cloudE1Report:null,
       cloudParityMessage:'A auditoria não pôde ser finalizada. Seus registros locais permanecem intactos.'});
   }
 }
 async compareCloudBank(){
   if(!desktop?.cloudBankParity||this.state.cloudParityBusy||
      this.state.busy||this.state.bankBusy||this.state.mode!=='real')return;
   this.setState({cloudParityBusy:true,cloudParityMessage:'Comparando somente resumos criptográficos do histórico bancário...'});
   try{
     const comparison=await desktop.cloudBankParity();
     if(comparison?.ok!==true){
       const message=comparison?.reason==='cloud_login_required'?'Entre no Preview da Cloudflare antes da conferência.':
         comparison?.reason==='network_unavailable'?'A Cloudflare não respondeu à consulta.':
         'A conferência não pôde ser concluída. Nenhum dado local foi modificado.';
       this.setState({cloudParityBusy:false,cloudParityMessage:message});
       return;
     }
     const yes=(n:boolean|undefined)=>n===true?'coincide':'diverge';
     this.setState({cloudParityBusy:false,cloudParityMessage:
       'Windows: '+comparison.localCount+' · Cloudflare: '+comparison.cloudCount+
       ' movimentações. Identificadores: '+yes(comparison.exactIdentities)+
       '. Datas e valores: '+yes(comparison.exactDatesAndCents)+
       '. Descrições e status: '+yes(comparison.exactDescriptionsAndStatuses)+
       '. '+(comparison.matched?'Histórico comparado sem divergências nesses campos. ':
           'Diferenças identificadas; não ativar a base única. ')+
       'Categorias, vínculos, saldos e atualização bancária ainda exigem conferência independente.'});
   }catch{
     this.setState({cloudParityBusy:false,
       cloudParityMessage:'Não foi possível comparar os históricos. O SQLite original permanece intacto.'});
   }
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
 canPlanSimulatedPurchase(out:any=this.state.outcome):boolean{
   // Same gate for button and operation. Previous results remain read-only.
   return !!desktop&&this.state.mode==='real'&&out===this.state.outcome&&
     !!out&&!out.error&&out.engine==='planning'&&
     !this.state.simBusy&&!this.state.simError&&!this.isSimulationStale()&&
     !!this.state.simCalculatedInput&&
     simInputsEqual(this.state.sim,this.state.simCalculatedInput);
 }
 planSimulatedPurchase(){
   const out=this.state.outcome;
   if(!out||out.error||out.engine!=='planning'||this.state.mode!=='real'||!desktop)return;
   if(!this.canPlanSimulatedPurchase(out)){
     this.flash('O resultado anterior é apenas uma referência. Recalcule a simulação antes de planejar esta compra.');
     return;
   }
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
 openIntelligenceContext(page:string=this.state.page){this.setState({intelligencePanelOpen:true,intelligenceContext:page,intelligenceContextSnapshot:intelligencePageScope(this,page),detail:null,planSelected:null});}
 navigate(page:string){
   this.simRequest++;
   const target=page==='review'||page==='categories'?'transactions':page==='simulator'?'assistant':page;
   const pageChanged=target!==this.state.page;
   const span=dateSpan(this.state.overviewPeriod,this.state.customStart,this.state.customEnd);
   const newMonth=span.end.slice(0,7),useMonth=newMonth>=nowYM&&newMonth<=shiftMonth(nowYM,12);
   const enteringPlan=target==='planning'&&this.state.page!=='planning'&&useMonth;
   this.setState({page:target,txReviewOnly:page==='review',txOrganize:page==='categories',quickAddOpen:false,quickCategory:null,
      month:newMonth, ...(enteringPlan?{planMonth:newMonth,planDay:newMonth===nowYM?iso(new Date()):newMonth+'-01'}:{}),
      showEntry:false,outcome:null,simBusy:false},()=>{
       if(pageChanged)document.scrollingElement?.scrollTo({top:0,left:0,behavior:'instant' as ScrollBehavior});
       if(enteringPlan)void this.refreshPlanning();
       if(target==='intelligence'&&typeof intelligencePremiumLoad==='function')void intelligencePremiumLoad(this);
      });
   if(target==='intelligence'||target==='settings')void intelligenceRefresh(this);
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
  const key=tx.accountId+'|'+tx.id;
  if(tx.reviewed||this.state.detailBusy||this.reviewSavingKeys.has(key))return;
  this.reviewSavingKeys.add(key);
  try{
   await this.runBankOperation('bankBatch',{items:[{accountId:tx.accountId,externalId:tx.id}],reviewed:true},'Movimentação revisada.');
  }finally{this.reviewSavingKeys.delete(key);}
 }
 clearMovementFilters(){
  this.setState({query:'',bankFilter:'',txSource:'all',txCategoryFilter:'',
   txKindFilter:'all',txReviewFilter:'all',txSort:'date_desc',overviewPeriod:'month',
   txSelected:[],quickCategory:null});
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
 async saveEntry(){const f=this.state.entry,v=parsePositiveBRLInput(f.value);if(!f.description.trim())return this.flash('Informe uma descrição.');if(!/^\d{4}-\d{2}-\d{2}$/.test(f.date)||iso(fromISO(f.date))!==f.date)return this.flash('Informe uma data válida.');if(!Number.isSafeInteger(v)||v<=0)return this.flash('Valor inválido. Use reais e no máximo duas casas decimais (ex.: 1.234,56).');const t:Tx={id:'tx-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),date:f.date,description:f.description.trim().slice(0,150),category:f.category,kind:f.kind,amount:v,origin:'manual'};if(await this.updateData({...this.state.data,transactions:[...this.state.data.transactions,t]},'Lançamento registrado.'))this.setState({showEntry:false,entryCategoryTouched:false,entry:{...f,description:'',value:''}});}
 async removeEntry(id:string){
  const found=this.state.data.transactions.find(t=>t.id===id);
  if(!found||this.state.busy||this.writeInProgress)return false;
  if(this.isManualLinked(id)){
   this.flash('Este lançamento está vinculado a um extrato bancário. Desvincule antes de excluir.');
   return false;
  }
  if(!confirm('Excluir permanentemente este lançamento manual? A movimentação bancária não será modificada.'))return false;
  const result=await this.updateData({...this.state.data,transactions:this.state.data.transactions.filter(t=>t.id!==id)},
   'Lançamento removido.');
  if(result)this.setState({detail:null,manualDraft:null});
  return result;
 }
 async setBudget(cat:string,s:string){
  const value=String(s||'').trim();const v=value===''?null:parseMoney(value);
  if(v!==null&&(!Number.isSafeInteger(v)||v<0)){this.flash('Informe um limite válido.');return false;}
  const budgets={...this.state.data.budgets};
  if(v===null)delete budgets[cat];else budgets[cat]=v;
  const saved=await this.updateData({...this.state.data,budgets},v===null?'Limite removido.':'Limite atualizado.');
  if(saved)this.setState({budgetEdit:''});return saved;
 }
 async setSetting(k:keyof Settings,s:string){const v=parseMoney(s);if(!Number.isFinite(v)||Math.abs(v)>100000000000||((k!=='opening')&&v<0)){this.flash('Valor inválido.');return false;}return this.updateData({...this.state.data,settings:{...this.state.data.settings,[k]:v}},'Configuração salva.');}
 exportJSON(){const blob=new Blob([JSON.stringify({...this.state.data,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});download(blob,'meu-financeiro-backup-'+this.state.mode+'-'+iso(new Date())+'.json');this.flash('Backup exportado. Guarde o arquivo em local seguro.');}
 exportCSV(){const s=['data;descricao;tipo;valor;categoria',...this.state.data.transactions.map(t=>[t.date,'"'+t.description.replace(/"/g,'""')+'"',t.kind,moneyString(t.amount),t.category].join(';'))].join('\r\n');download(new Blob(['\ufeff'+s],{type:'text/csv;charset=utf-8'}),'meu-financeiro-extrato.csv');}
 async importJSON(file:File){try{const d=safeData(JSON.parse(await file.text()));if(!confirm('Substituir todos os dados do modo '+(this.state.mode==='real'?'pessoal':'demonstração')+' pelo backup selecionado?'))return;this.updateData(d,'Backup restaurado.');}catch(e:any){this.flash('Não foi possível importar o backup: '+e.message);}}
 async importCSV(file:File){try{const bytes=await file.text();let lines=bytes.replace(/^\ufeff/,'').trim().split(/\r?\n/);if(lines.length<2)throw new Error('Arquivo vazio.');const separator=lines[0].includes(';')?';':',';const header=splitCSV(lines.shift()||'',separator).map(x=>x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim());const find=(...aliases:string[])=>header.findIndex(x=>aliases.includes(x));const di=find('data','date'),de=find('descricao','historico','description'),va=find('valor','amount'),ca=find('categoria','category'),ki=find('tipo','kind');if(di<0||de<0||va<0)throw new Error('Use colunas data, descricao e valor.');const found=new Set(this.state.data.transactions.map(x=>[x.date,x.description,x.kind,x.amount].join('|')));const add:Tx[]=[];for(const [i,line] of lines.entries()){if(!line.trim())continue;const row=splitCSV(line,separator);let date=(row[di]||'').trim();if(/^\d{2}\/\d{2}\/\d{4}$/.test(date)){let [d,m,y]=date.split('/');date=y+'-'+m+'-'+d;}let value=parseMoney(row[va]||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(value)||value===0)throw new Error('Linha '+(i+2)+' com data ou valor inválido.');const description=(row[de]||'').trim();if(!description)throw new Error('Linha '+(i+2)+' sem descrição.');const csvKind=(row[ki]||'').trim().toLowerCase();const kind:Kind=['expense','despesa','saida','saída'].includes(csvKind)?'expense':(['income','receita','entrada'].includes(csvKind)?'income':(value>=0?'income':'expense'));const tr={id:'csv-'+Date.now()+'-'+i,date,description,kind,amount:Math.abs(value),category:(this.getCategories().some(c=>c.name===(row[ca]||'').trim())?(row[ca]||'').trim():(findCategoryRule(description,'manual',this.state.rules)||'Outros')),origin:'csv'};const key=[tr.date,tr.description,tr.kind,tr.amount].join('|');if(!found.has(key)){found.add(key);add.push(tr);}}
 this.updateData({...this.state.data,transactions:[...this.state.data.transactions,...add]},add.length+' novos lançamentos importados.');}catch(e:any){this.flash('CSV: '+e.message);}}
 setSimulation(patch:Partial<Sim>){
  const next={...this.state.sim,...patch};
  if(simInputsEqual(this.state.sim,next))return;
  // Invalidate an in-flight response before updating input. The last result
  // stays visible, but must never be presented as the newly requested scenario.
  this.simRequest++;
  this.setState({sim:next,simBusy:false,simError:'',
    simResultStale:!!this.state.outcome});
 }
 isSimulationStale():boolean{
  return !!this.state.outcome&&
   (!!this.state.simResultStale||!simInputsEqual(this.state.sim,this.state.simCalculatedInput));
 }
 saveSimulation(){
  const out=this.state.outcome;
  if(!u3SimulationCost(out)||this.isSimulationStale()||this.state.simBusy||this.state.simError)return;
  const calculated=this.state.simCalculatedInput;
  if(!calculated)return;
  this.setState({simSaved:{result:JSON.parse(JSON.stringify(out)),input:{...calculated}}});
 }
 async runSim(){
  const token=++this.simRequest,input={...this.state.sim};
  const amount=parseMoney(input.value),n=Number(input.installments),
    rate=Number(input.interest.trim().replace(',','.'));
  const invalid=(message:string)=>{
    if(token!==this.simRequest)return;
    this.setState({simBusy:false,simError:message,simResultStale:!!this.state.outcome});
  };
  if(!Number.isSafeInteger(amount)||amount<=0){
    invalid('Informe um valor válido para a compra.');return;
  }
  if(!Number.isInteger(n)||n<1||n>60||!Number.isFinite(rate)||rate<0||rate>30){
    invalid('Confira as parcelas e a taxa de juros (0 a 30% ao mês).');return;
  }
  this.setState({simBusy:true,simError:'',simResultStale:!!this.state.outcome});
  try{
    const result=(!desktop||this.state.mode==='demo')?
      simulate(this.state.data,input):
      await desktop.planSimulate({amount,installments:n,monthlyRate:rate,
        firstDueDate:input.firstDueDate||null,includeEstimatedIncome:false});
    if(token!==this.simRequest||!simInputsEqual(this.state.sim,input))return;
    if(result?.error){invalid(String(result.error));return;}
    this.setState({outcome:result,simCalculatedInput:input,simResultStale:false,
      simBusy:false,simError:''});
  }catch(e:any){
    invalid('Não foi possível simular: '+String(e?.message||e));
  }
 }
 field(label:string,el:any,hint?:string){return h('label',{className:'field'},h('span',{},label),el,hint?h('small',{},hint):null);}
 navItem(page:string,icon:string,label:string){return h('button',{key:page,type:'button','aria-label':label,'aria-current':this.state.page===page?'page':undefined,title:label,className:'nav-item '+(this.state.page===page?'active':''),onClick:()=>this.navigate(page)},h(Icon,{name:icon,size:19}),h('span',{},label));}
 renderSide(){return h('aside',{className:'sidebar'},
   h('div',{className:'brand'},h(Logo),h('div',{className:'brand-text'},h('strong',{},'Meu Financeiro'),h('small',{},'CONTROLE DO SEU DINHEIRO'))),
   h('div',{className:'side-label'},'CONTROLE'),
   h('nav',{},this.navItem('overview','home','Visão geral'),this.navItem('transactions','wallet','Movimentações'),
     this.navItem('planning','calendar','Planejamento'),this.navItem('banks','bank','Minhas contas'),
     h('div',{className:'side-label mf-ai-side-label'},'ORGANIZAÇÃO'),this.navItem('budgets','pie','Orçamentos'),
     h('div',{className:'side-label mf-ai-side-label'},'FERRAMENTAS'),this.navItem('assistant','cart','Simular compra'),this.navItem('intelligence','spark','Inteligência')),
   h('div',{className:'side-bottom'},
     this.navItem('settings','settings','Configurações'),
     h('label',{className:'mf-appearance'},h('span',{},'Aparência'),h('select',{'aria-label':'Tema do aplicativo','data-appearance':'select',defaultValue:(window as any).MFAppearance?.get()||'system',onChange:(e:any)=>(window as any).MFAppearance?.set(e.target.value)},h('option',{value:'light'},'Claro'),h('option',{value:'dark'},'Escuro'),h('option',{value:'system'},'Sistema'))),
     h('div',{className:'privacy-note'},h(Icon,{name:'shield',size:19}),h('div',{},h('b',{},'Privado e local'),h('small',{},'Dados sob seu controle'))),
     h('button',{className:'demo-btn',onClick:()=>this.toggleMode()},h(Icon,{name:this.state.mode==='real'?'spark':'home',size:18}),this.state.mode==='real'?'Explorar demonstração':'Voltar aos meus dados'),
     h('small',{className:'app-version'},'Meu Financeiro · v0.9.5-beta.8')));
 }

 renderWorkspaceBar(){const labels:{[page:string]:string}={overview:'Visão geral',transactions:'Movimentações',planning:'Planejamento',budgets:'Orçamentos',assistant:'Simular compra',banks:'Minhas contas',settings:'Configurações',intelligence:'Inteligência'};
 return h('div',{className:'mf-workspace-bar'},h('nav',{'aria-label':'Localização'},h('span',{},'Meu Financeiro'),h('span',{'aria-hidden':'true'},'/'),h('strong',{},labels[this.state.page]||'Visão geral')),h('span',{className:'mode-tag '+(this.state.mode==='demo'?'mode-demo':'')},h('i',{}),this.state.mode==='demo'?'DEMONSTRAÇÃO':'PRIVADO'));
 }
 renderTop(){
 const labels:{[s:string]:string}={overview:'Visão geral',planning:'Planejamento',transactions:'Movimentações',
  budgets:'Orçamentos',assistant:'Simular compra',settings:'Configurações',banks:'Minhas contas',intelligence:'Inteligência'};
 const period=dateSpan(this.state.overviewPeriod,this.state.customStart,this.state.customEnd);
 const months=Array.from({length:45},(_,i)=>shiftMonth(nowYM,3-i)).map(m=>({value:m,label:prettyMonth(m)}));
 const configured=this.state.mode==='real'&&this.state.bank.config.configured;
 const last=this.state.bank.data.last?.completedAt;
 const periodControl=(this.state.page==='overview'||this.state.page==='transactions'&&!this.state.txReviewOnly&&!this.state.txOrganize);
 return h('header',{className:'topbar'},
   h('div',{className:'top-left'},h('div',{className:'page-kicker'},'FINANÇAS PESSOAIS / '+(labels[this.state.page]||'').toUpperCase()),
     h('h1',{},labels[this.state.page]),h('p',{},this.state.page==='overview'?'Saldo, receitas e despesas do período selecionado.':
     this.state.page==='assistant'?'Compare o custo e o impacto das parcelas.':this.state.page==='intelligence'?'Prévia de insights e ferramentas de análise.':this.state.page==='transactions'?'Visualize e organize suas movimentações.':this.state.page==='banks'?'Saldos e referências das suas contas.':this.state.page==='settings'?'Preferências e dados do aplicativo.':'Acompanhe seus registros.')),
   h('div',{className:'header-actions'},

     this.state.page==='overview'?h('div',{className:'mf-quick-add'},h('button',{className:'primary-button mf-quick-trigger','aria-expanded':this.state.quickAddOpen,
       onClick:()=>this.setState({quickAddOpen:!this.state.quickAddOpen})},h(Icon,{name:'plus',size:16}),'Adicionar'),
       this.state.quickAddOpen?h('div',{className:'mf-quick-menu'},
         h('button',{onClick:()=>this.openQuickEntry('expense')},'Nova despesa'),
         h('button',{onClick:()=>this.openQuickEntry('income')},'Nova receita'),
         h('button',{onClick:()=>{this.setState({quickAddOpen:false});this.openPlan(undefined,'expense');}},'Compromisso futuro')):null):this.state.page==='transactions'?h('button',{type:'button',className:'primary-button',onClick:()=>this.openQuickEntry('expense')},h(Icon,{name:'plus',size:16}),'Novo lançamento'):null,
     periodControl?h('div',{className:'overview-period-controls'},
       h(PeriodPicker,{mode:this.state.overviewPeriod,span:period,onChange:(m:PeriodMode,a?:string,b?:string)=>this.setSharedPeriod(m,a,b)}),
       this.state.page==='overview'&&configured?h('button',{type:'button',className:'mf-refresh-button',disabled:this.state.bankBusy,onClick:()=>this.syncBank(false),
         title:last?'Última consulta: '+new Date(last).toLocaleString('pt-BR'):'Ainda não sincronizado'},h(Icon,{name:'refresh',size:16}),this.state.bankBusy?'Atualizando…':'Atualizar'):null):
       this.state.page==='budgets'?h(StyledSelect,{wrapperClass:'month-dropdown',className:'mf-month-trigger',value:this.state.month,
         options:months,ariaLabel:'Mês do orçamento',onChange:(v:string)=>this.setSharedMonth(v)}):
       null,
     null));
 }

 renderSourcePicker(){
   const bankAvailable=this.state.mode==='real'&&this.state.bank.data.accounts.length>0;
   const selected=bankAvailable&&this.state.dashboardSource==='bank'?'bank':'manual';
   const last=this.state.bank.data.last?.completedAt;
   const age=last?Date.now()-new Date(last).getTime():null;
   const stale=bankAvailable&&selected==='bank'&&(age===null||age>48*3600000);
   const label=selected==='bank'?'Contas conectadas':'Adicionado por você';
   return h('div',{className:'mf-source-compact'},
     h('button',{type:'button',className:'mf-source-trigger','aria-expanded':this.state.sourceDetailsOpen,
       onClick:()=>this.setState({sourceDetailsOpen:!this.state.sourceDetailsOpen})},
       h('span',{className:'mf-source-dot '+(stale?'stale':'')}),
       h('span',{},label+(selected==='bank'&&last?' · consultado '+new Date(last).toLocaleDateString('pt-BR') : '')),
       h(Icon,{name:'chevron-down',size:15})),
     this.state.sourceDetailsOpen?h('div',{className:'mf-source-panel'},
       h('b',{},'Dados dos indicadores'),
       h('p',{},'Escolha qual histórico consultar. Os dois conjuntos não são somados para evitar lançamentos duplicados.'),
       h('div',{className:'mf-source-choice'},
         bankAvailable?h('button',{className:selected==='bank'?'active':'',onClick:()=>this.setState({dashboardSource:'bank',sourceDetailsOpen:false})},'Contas conectadas'):null,
         h('button',{className:selected==='manual'?'active':'',onClick:()=>this.setState({dashboardSource:'manual',sourceDetailsOpen:false})},'Adicionado por você')),
       selected==='bank'&&last?h('small',{},'Última consulta realizada em '+new Date(last).toLocaleString('pt-BR')+'. O banco pode atualizar as movimentações com atraso.'):null,
       selected==='bank'&&stale?h('small',{className:'bad-text'},'Atenção: dados bancários antigos ou ainda não sincronizados.'):null):null);
 }

 renderOverview(){
 const state=this.state,d=state.data,bank=state.bank,period=dateSpan(state.overviewPeriod,state.customStart,state.customEnd),{start,end}=period;
 const useBank=state.mode==='real'&&state.dashboardSource==='bank'&&bank.data.accounts.length>0;
 const range=(start:string,end:string)=>useBank?bankSnapshotBetween(bank,start,end):snapshotBetween(d,start,end),s=range(start,end),coverage=useBank?bankBalanceCoverage(bank.data.accounts):null;
 const hidden=!!state.overviewHideValues,money=(v:number)=>hidden?'••••':fmt(v),date=(v:string)=>v.slice(8)+'/'+v.slice(5,7),today=iso(new Date());
 const previous=overviewPriorRange(start,end,state.overviewPeriod),prior=range(previous.start,previous.end);
 const dates=(useBank?(bank.data.dailyTotals?.length?bank.data.dailyTotals:bank.data.transactions):d.transactions).map(x=>x.date).filter(Boolean).sort();
 const compareAvailable=!!dates.length&&dates[0]<=previous.start&&(!useBank||!bank.data.truncated)&&end<=today;
 const comparison=overviewComparison(s.expense,prior.expense,compareAvailable),points=overviewCumulative(start,end,range,compareAvailable?previous:null);
 const due=pendingDashboardItems(state.planning.items),upcoming=due.filter(x=>x.dueDate<=advanceDate(today,6)),overdue=due.filter(x=>x.dueDate<today);
 const generated=!!state.planning.generatedAt,month=end.slice(0,7),budget=range(firstOfMonth(month),endOfMonth(month));
 const limits=this.getCategories().filter(c=>c.kind!=='income'&&Object.prototype.hasOwnProperty.call(d.budgets,c.name)).map(info=>({info,limit:d.budgets[info.name],hasLimit:true,total:budget.categories.find(c=>c.name===info.name)?.total||0})).sort(budgetPresentationOrder);
 const totalLimit=limits.reduce((n,c)=>n+c.limit,0),spentLimited=limits.reduce((n,c)=>n+c.total,0),budgetCoverage=overviewCoverage(budget.expense,spentLimited),used=totalLimit>0?Math.round(spentLimited/totalLimit*100):spentLimited>0?100:0;
 const recent=useBank?bank.data.transactions.filter(x=>x.date>=start&&x.date<=end&&x.status==='POSTED'&&['income','expense'].includes(effectiveNature(x))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(x=>({key:x.accountId+'|'+x.id,title:x.customTitle||x.merchant||x.description,original:x.description,date:x.date,category:x.category,amount:Math.abs(x.amount),kind:effectiveNature(x),raw:x})):d.transactions.filter(x=>x.date>=start&&x.date<=end).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(x=>({key:x.id,title:x.description,original:'',date:x.date,category:x.category,amount:x.amount,kind:x.kind,raw:x}));
 const openBudget=()=>{this.setState({month});this.navigate('budgets');};
 const palette=['#8066d5','#329b89','#d29844','#5a8fc9','#c7759c'];
 const categoryColor=(name:string,index:number)=>{const info=this.getCategories().find(c=>c.name===name);return info&&(!info.builtIn||info.color.toLowerCase()!=='#3e9a85')?info.color:palette[index];};
 const metric=(label:string,value:number,icon:string,hint:string,tone:string)=>h('section',{className:'u1-metric mf-border-reveal mf-tone-'+(tone==='net'?'net':tone)+' '+tone+(tone==='net'?(value>0?' is-positive':value<0?' is-negative':' is-neutral'):''),role:'group',tabIndex:0,'aria-label':label+' · '+money(value)},h('div',{className:'u1-metric-label'},h(Icon,{name:icon,size:16}),label),h('strong',{},money(value)),h('small',{},hint));
 return h('div',{className:'overview-content u1-overview '+(hidden?'u1-values-hidden':'')},
  h('div',{className:'u1-context'},this.renderSourcePicker(),h('span',{},date(start)+' — '+date(end)+' · '+(useBank?'Movimentos confirmados'+(bank.data.truncated?' · histórico parcial':''):'Registros manuais'))),
  state.bankMessage&&bank.config.configured?h('div',{className:'sync-feedback',role:'status'},state.bankMessage):null,
  h('div',{className:'stats-grid'},
   h('section',{className:'u1-balance mf-border-reveal mf-tone-balance',role:'group',tabIndex:0,'aria-label':useBank?'Saldo nas contas':'Saldo manual'},h('div',{className:'u1-balance-label'},h('span',{},useBank?'Saldo nas contas':'Saldo manual'),h('button',{type:'button',className:'u1-icon-button','aria-label':hidden?'Mostrar valores':'Ocultar valores','aria-pressed':hidden,onClick:()=>this.setState({overviewHideValues:!hidden})},h(Icon,{name:hidden?'eye-off':'eye',size:18}))),
    h('strong',{className:'u1-balance-value'},hidden?'••••':coverage?bankBalanceLabel(coverage):money(s.balance)),
    h('details',{className:'u1-balance-info'},h('summary',{},h('span',{className:'u1-status-dot '+(coverage?.missingCount?'is-partial':'')}),coverage?.missingCount?'Saldo parcial · conferir':useBank?'Referência das instituições':'Como é calculado'),h('p',{},coverage?'Saldos disponíveis de '+coverage.knownCount+' de '+coverage.totalCount+' conta(s). Não representa dinheiro livre. A consulta pode ser mais recente que o saldo informado.':'Saldo inicial mais receitas menos despesas manuais. Não somado ao banco.'))),
   metric('Receitas',s.income,'trend','No período selecionado','income'),metric('Despesas',s.expense,'down','No período selecionado','expense'),metric('Resultado',s.net,'chart','Receitas menos despesas','net')),
  h('div',{className:'u1-main-grid'},
   h('div',{className:'u1-left-stack'},h('section',{className:'u1-panel u1-rhythm'},h('div',{className:'u1-panel-head'},h('div',{},h('h2',{},'Seu ritmo de gastos'),h('p',{},'Entenda como suas despesas evoluíram.')),h('div',{className:'u1-chart-tabs',role:'group','aria-label':'Visualização do período'},['spending','flow'].map(tab=>h('button',{type:'button',key:tab,'aria-pressed':(state.overviewChart||'spending')===tab,onClick:()=>this.setState({overviewChart:tab})},tab==='spending'?'Acumulado':'Entradas e saídas')))),
    h('div',{className:'u1-rhythm-summary'},h('div',{},h('strong',{},money(s.expense)),h('span',{},'gastos no período')),h('div',{className:'u1-comparison '+(comparison.percent!==null&&comparison.percent<=0?'is-lower':'')},hidden?'Valores ocultos':comparison.label,h('small',{},compareAvailable?date(previous.start)+' a '+date(previous.end)+' · mesma fonte':'Comparação exige histórico disponível nos dois intervalos'))),
    hidden?h('div',{className:'u1-chart-hidden'},h(Icon,{name:'eye-off',size:26}),h('p',{},'Mostre os valores para visualizar o gráfico.')):(state.overviewChart||'spending')==='flow'?h(Chart,{data:flowSegments(start,end,range)}):h(OverviewSpendingChart,{rows:points,compare:compareAvailable}),
    h('div',{className:'u1-chart-footer'},h('span',{},h('i',{className:'u1-current-dot'}),'Período selecionado'),compareAvailable?h('span',{},h('i',{className:'u1-previous-dot'}),'Intervalo anterior'):null,h('span',{className:'u1-daily-average'},'Média diária ',h('b',{},money(Math.round(s.expense/daysInSpan(start,end))))))),h('section',{className:'u1-panel u1-categories'},h('div',{className:'u1-panel-head'},h('div',{},h('h2',{},'Para onde foi seu dinheiro'),h('p',{},'Categorias do período selecionado')),h('span',{className:'u1-count'},s.categories.length+' categorias')),
    s.categories.length?h('div',{className:'u1-category-list'},s.categories.slice(0,5).map((cat,i)=>h('button',{type:'button',className:'u1-category-row',key:cat.name,onClick:()=>{this.setState({query:cat.name,txSource:useBank?'bank':'manual',txReviewOnly:false,txOrganize:false,bankFilter:''});this.navigate('transactions');}},h('span',{className:'u1-category-dot',style:{background:categoryColor(cat.name,i)}}),h('span',{className:'u1-category-name'},cat.name),h('span',{className:'u1-category-bar'},h('i',{style:{width:hidden?'0%':Math.round(cat.total/Math.max(1,s.expense)*100)+'%',background:categoryColor(cat.name,i)}})),h('strong',{},money(cat.total)),h('small',{},hidden?'••••':Math.round(cat.total/Math.max(1,s.expense)*100)+'%')))):h('p',{className:'u1-empty'},'Nenhuma despesa nesta fonte e período.'),
    s.categories.length>5?h('p',{className:'u1-microcopy'},'Mostrando as 5 maiores categorias. Consulte todas em Movimentações.'):null)),
   h('aside',{className:'u1-side-stack'},
    h('section',{className:'mf-plan-shortcut'},h('div',{className:'u1-panel-head'},h('div',{},h('h2',{},'Na sua agenda'),h('p',{},'Hoje e próximos 7 dias · compromissos cadastrados')),h('button',{type:'button',className:'u1-icon-button','aria-label':'Abrir Planejamento',onClick:()=>this.navigate('planning')},h(Icon,{name:'arrow',size:17}))),
     generated?h('div',{className:'u1-agenda-stats'},h('div',{},h('strong',{},overdue.length),h('span',{},'vencidos')),h('div',{},h('strong',{},money(upcoming.reduce((n,x)=>n+x.remaining,0))),h('span',{},'a pagar · inclui vencidos'))):null,
     upcoming.length?h('div',{className:'mf-agenda-list'},upcoming.slice(0,3).map(item=>h('button',{type:'button',className:'mf-agenda-row',key:item.id,onClick:()=>this.openPlanDetail(item.id)},h('span',{className:'u1-agenda-date'},date(item.dueDate)),h('span',{className:'mf-agenda-copy'},h('strong',{},item.title),h('small',{},item.dueDate<today?'Vencido':item.dueDate===today?'Hoje':item.certainty==='estimated'?'Estimado':'A vencer')),h('strong',{className:'mf-agenda-amount'},money(item.remaining))))):h('div',{className:'u1-empty-agenda'},h(Icon,{name:'calendar',size:22}),h('div',{},h('b',{},generated?'Sem vencimentos cadastrados neste intervalo':'Agenda ainda não carregada'),h('p',{},generated?'Isso não confirma a ausência de contas a pagar.':'Abra o Planejamento para conferir seus compromissos.'))),
     h('button',{type:'button',className:'u1-subtle-link',onClick:()=>this.navigate('planning')},'Ver agenda',h(Icon,{name:'arrow',size:14}))),
    h('section',{className:'u1-panel u1-budget'},h('div',{className:'u1-panel-head'},h('div',{},h('h2',{},'Orçamento em foco'),h('p',{},prettyMonth(month))),h('button',{type:'button',className:'u1-icon-button','aria-label':'Abrir Orçamentos',onClick:openBudget},h(Icon,{name:'arrow',size:17}))),
     h('div',{className:'u1-budget-summary'},h('strong',{},money(spentLimited)),h('span',{},'de '+money(totalLimit)+' em limites')),
     limits.length?h('div',{className:'u1-budget-meter '+(spentLimited>totalLimit?'is-over':''),role:'img','aria-label':hidden?'Valores ocultos':used+'% dos limites utilizados'},h('i',{style:{width:hidden?'0%':Math.min(100,used)+'%'}})):null,
     h('p',{className:'u1-budget-caption'},!limits.length?'Você ainda não definiu limites.':hidden?'Valores ocultos':(spentLimited>totalLimit?money(spentLimited-totalLimit)+' acima dos limites':money(totalLimit-spentLimited)+' de margem nos limites')),
     h('div',{className:'u1-coverage'},h('span',{},'Cobertura dos gastos'),h('b',{},hidden?'••••':budgetCoverage===null?'Sem gastos':budgetCoverage+'%')),h('p',{className:'u1-microcopy'},'Considera apenas categorias com limite. Margem não é saldo disponível.'),
     h('button',{type:'button',className:'u1-subtle-link',onClick:openBudget},'Gerenciar orçamento',h(Icon,{name:'arrow',size:14}))))),
  h('div',{className:'u1-detail-grid'},
   
   h('section',{className:'u1-panel u1-recent'},h('div',{className:'u1-panel-head'},h('div',{},h('h2',{},'Últimas movimentações'),h('p',{},'Confirmadas no período')),h('button',{type:'button',className:'u1-subtle-link',onClick:()=>{this.setState({query:'',bankFilter:'',txSource:useBank?'bank':'manual',txReviewOnly:false,txOrganize:false});this.navigate('transactions');}},'Ver tudo',h(Icon,{name:'arrow',size:14}))),
    recent.length?h('div',{className:'u1-recent-list'},recent.map(t=>h('button',{type:'button',className:'u1-recent-row',key:t.key,onClick:()=>useBank?this.openBankDetail(t.raw as BankTx):this.openManualDetail(t.raw as Tx)},h('span',{className:'u1-transaction-icon '+t.kind},h(Icon,{name:t.kind==='income'?'trend':'down',size:17})),h('span',{className:'u1-recent-copy'},h('strong',{},t.title),h('small',{},t.original&&t.original!==t.title?t.original:t.category+' · '+date(t.date))),h('strong',{className:t.kind==='income'?'good-text':'bad-text'},hidden?'••••':(t.kind==='income'?'+':'−')+money(t.amount))))):h('p',{className:'u1-empty'},'Nenhuma movimentação confirmada neste período.')),h('section',{className:'u1-panel u1-accounts'},h('div',{className:'u1-panel-head'},h('div',{},h('h2',{},useBank?'Suas contas':'Fonte dos seus indicadores'),h('p',{},useBank?'Saldo de referência por instituição · não depende do período acima':'Acompanhamento com registros adicionados por você')),h('button',{type:'button',className:'u1-subtle-link',onClick:()=>this.navigate('banks')},'Ver contas',h(Icon,{name:'arrow',size:14}))),
   useBank?h('div',{className:'u1-accounts-grid'},bank.data.accounts.map(account=>h('button',{type:'button',className:'u1-account',key:account.id,onClick:()=>{this.setState({bankFilter:account.id,query:'',txSource:'bank',txReviewOnly:false,txOrganize:false});this.navigate('transactions');}},h('span',{className:'u1-account-icon'},h(Icon,{name:'bank',size:19})),h('span',{className:'u1-account-copy'},h('b',{},account.name),h('small',{},'Referência: '+bankReferenceLabel(account.updatedAt))),h('strong',{},Number.isFinite(account.balance)?money(account.balance as number):'Indisponível')))):h('p',{className:'u1-microcopy'},'Os registros manuais e o extrato bancário são consultados separadamente para evitar duplicidades.'))),
  null);
 }
 renderTransactions(){
   const review=this.state.txReviewOnly,rows=this.state.mode==='demo'?[]:this.state.bank.data.transactions;
   const filtered=transactionViewRows(this.state),shown=filtered.slice(0,500),count=rows.filter(t=>!t.reviewed).length;
   const hasBank=filtered.some(t=>t.origin==='bank'),hasManual=filtered.some(t=>t.origin==='manual');
   const source=hasBank&&hasManual?(this.state.txSummarySource||'bank'):hasManual?'manual':'bank';
   const summary=transactionViewSummary(filtered,source),span=dateSpan(this.state.overviewPeriod,this.state.customStart,this.state.customEnd);
   const partialBank=this.state.mode!=='demo'&&!!this.state.bank.data.truncated;
   const cats=this.getCategories();
   const selected=this.state.txSelected;
   const active:{key:string;label:string;clear:()=>void}[]=[];
   const add=(key:string,label:string,patch:Partial<State>)=>
     active.push({key,label,clear:()=>this.setState({...patch,txSelected:[],quickCategory:null})});
   if(this.state.query.trim())add('query','Busca: '+this.state.query.trim().slice(0,32),{query:''});
   if(this.state.txSource!=='all'&&!review)add('origin',this.state.txSource==='bank'?'Origem: banco':'Origem: manual',{txSource:'all'});
   if(this.state.bankFilter){
     const account=this.state.bank.data.accounts.find(a=>a.id===this.state.bankFilter);
     add('account','Conta: '+(account?.name||'Selecionada'),{bankFilter:''});
   }
   if(this.state.txCategoryFilter)add('category','Categoria: '+this.state.txCategoryFilter,{txCategoryFilter:''});
   if(this.state.txKindFilter&&this.state.txKindFilter!=='all')
     add('kind',this.state.txKindFilter==='income'?'Receitas':'Despesas',{txKindFilter:'all'});
   if(!review&&this.state.txReviewFilter&&this.state.txReviewFilter!=='all')
     add('review',this.state.txReviewFilter==='pending'?'A conferir':'Revisadas',{txReviewFilter:'all'});
   if(this.state.txSort&&this.state.txSort!=='date_desc')
     add('sort',this.state.txSort==='date_asc'?'Data mais antiga':
       this.state.txSort==='amount_desc'?'Maior valor':'Menor valor',{txSort:'date_desc'});
   if(!review&&this.state.overviewPeriod!=='month')
     add('period','Período: '+pDate(span.start)+' a '+pDate(span.end),{overviewPeriod:'month'});
   return h('div',{className:'section mf-tx-section u2-transactions mf-premium-transactions'},
     h('div',{className:'mf-tx-views','aria-label':'Visões rápidas'},...([{label:'Todas',value:'all'},{label:'A conferir',value:'pending'},{label:'Revisadas',value:'reviewed'}] as const).map(v=>h('button',{type:'button','aria-pressed':(this.state.txReviewFilter||'all')===v.value,disabled:review,onClick:()=>this.setState({txReviewFilter:v.value,txSelected:[],quickCategory:null})},v.label)),h('label',{},h('input',{type:'checkbox',checked:!!this.state.txGroupByDate,onChange:(e:any)=>this.setState({txGroupByDate:e.target.checked})}),'Agrupar por data'),h('button',{type:'button',className:'mf-tx-review-link',onClick:()=>void categoryReviewOpen(this)},h(Icon,{name:'spark',size:15}),'Central de revisão')),

     !review&&this.state.bank.data.suspectedDuplicates?.length?h(Card,{className:'mf-duplicate-banner'},
       h('div',{},h('b',{},'Possíveis movimentações repetidas ('+this.state.bank.data.suspectedDuplicates.length+')'),
         h('p',{},'Encontramos registros semelhantes em conexões diferentes. Confira antes de revisar: os valores não foram removidos ou mesclados.')),
       this.state.bank.data.suspectedDuplicates.slice(0,3).map(d=>h('div',{className:'mf-duplicate-row',key:d.pairKey},
         h('span',{},d.date.split('-').reverse().join('/')+' · '+d.description+' · '+fmt(Math.abs(d.amount))),
         h('button',{className:'ghost-button',onClick:()=>this.dismissBankDuplicate(d.pairKey)},'Ignorar aviso')))):null,
     review?h(Card,{className:'mf-review-banner'},h('div',{},h('span',{className:'micro-label'},'SUA CAIXA DE REVISÃO'),h('h2',{},count?count+' movimentações carregadas para conferir':partialBank?'Nenhuma revisão pendente entre os registros carregados':'Tudo organizado! 🎉'),h('p',{},count?'Revisão calculada sobre os registros bancários carregados, independentemente do período.':'Outros registros podem existir fora da janela carregada quando o histórico é parcial.')),h('button',{className:'outlined-action',onClick:()=>this.navigate('transactions')},'Ver todas as movimentações')):null,
     h('div',{className:'u2-summary-heading'},h('div',{},h('h2',{},'Seu histórico, com contexto'),h('p',{},review?'Caixa de revisão · registros bancários carregados':pDate(span.start)+' a '+pDate(span.end)+' · filtros aplicados ao resumo')),
       hasBank&&hasManual?h('div',{className:'u2-view-tabs','aria-label':'Origem dos valores do resumo'},['bank','manual'].map(v=>h('button',{type:'button','aria-pressed':source===v,onClick:()=>this.setState({txSummarySource:v})},v==='bank'?'Banco':'Manual'))):null),
     h('div',{className:'u2-metrics'},[
       {label:'Entradas confirmadas',value:fmt(summary.income),detail:'Receitas · '+(source==='bank'?(partialBank?'banco · linhas carregadas':'banco'):'manual'),kind:'income'},
       {label:'Saídas confirmadas',value:fmt(summary.expense),detail:'Despesas · '+(source==='bank'?(partialBank?'banco · linhas carregadas':'banco'):'manual'),kind:'expense'},
       {label:'Resultado dos registros',value:fmt(summary.net),detail:'Entradas menos saídas · não é saldo disponível'+(source==='bank'&&partialBank?' · histórico parcial':''),kind:'',tone:'net',semantic:summary.net>0?'is-positive':summary.net<0?'is-negative':'is-neutral'},
       {label:source==='bank'?'Pendentes no banco':'Registros manuais',value:String(source==='bank'?summary.pending:summary.count),detail:source==='bank'?summary.review+' a conferir · revisão independente do pagamento':'Valores separados das contas conectadas',kind:'',tone:source==='bank'?'warning':'balance'}
     ].map(x=>h('article',{className:'u2-metric mf-border-reveal mf-tone-'+(x.tone||x.kind||'neutral')+' '+x.kind+(x.semantic?' '+x.semantic:''),role:'group',tabIndex:0,key:x.label},h('span',{},x.label),h('strong',{},x.value),h('small',{},x.detail)))),
     partialBank?h('p',{className:'u5-history-limited',role:'status'},
        'Histórico bancário parcial: '+this.state.bank.data.transactions.length+' de '+
        this.state.bank.data.totalTransactions+
        ' movimentações carregadas. Os resumos bancários e a revisão nesta tela abrangem somente as linhas carregadas; não representam o histórico completo.'):null,
     h('div',{className:'u2-scope'},
       h('span',{},'Resumo: '+(source==='bank'?'contas conectadas':'lançamentos manuais')+
         ' · '+summary.count+' registros'+(summary.excluded?' · '+summary.excluded+' transferência(s)/desconsiderada(s) fora dos valores':'')),
       active.length?h('button',{type:'button',className:'mf-small-link',
         onClick:()=>this.clearMovementFilters()},'Limpar todos os filtros'):null),
     h('div',{className:'panel-toolbar u5-filter-toolbar'},
       h('div',{className:'search-box'},h(Icon,{name:'search',size:18}),
         h('input',{value:this.state.query,'aria-label':'Buscar movimentações',
           placeholder:'Buscar descrição, estabelecimento ou categoria',
           onChange:(e:any)=>this.setState({query:e.target.value,txSelected:[],quickCategory:null})})),
       h('div',{className:'toolbar-actions'},
         !review?h(StyledSelect,{className:'form-control bank-filter',value:this.state.txSource,
           ariaLabel:'Filtrar origem',options:[{value:'all',label:'Todas as origens'},
             {value:'bank',label:'Contas conectadas'},{value:'manual',label:'Adicionadas por você'}],
           onChange:(v:string)=>this.setState({txSource:v,bankFilter:v==='manual'?'':this.state.bankFilter,
             txSelected:[],quickCategory:null})}):null,
         this.state.bank.data.accounts.length>1||this.state.bankFilter?h(StyledSelect,{
           className:'form-control bank-filter',value:this.state.bankFilter,ariaLabel:'Filtrar conta',
           options:[{value:'',label:'Todas as contas'},...this.state.bank.data.accounts.map(a=>({value:a.id,label:a.name}))],
           onChange:(v:string)=>this.setState({bankFilter:v,txSource:v?'bank':this.state.txSource,
             txSelected:[],quickCategory:null})}):null,
         h('button',{type:'button',className:'ghost-button u5-more-filters',
           'aria-expanded':!!this.state.txAdvancedOpen,'aria-controls':'u5-advanced-filters',
           onClick:()=>this.setState({txAdvancedOpen:!this.state.txAdvancedOpen})},
           h(Icon,{name:'filter',size:16}),'Filtros'+(active.length?' · '+active.length:'')),
         !review?h('button',{type:'button',className:'ghost-button',
           onClick:()=>this.csvInput?.click()},h(Icon,{name:'upload',size:17}),'Importar CSV'):null)),
     this.state.txAdvancedOpen?h('div',{id:'u5-advanced-filters',className:'u5-advanced-filters',
       'aria-label':'Filtros avançados'},
       h(StyledSelect,{value:this.state.txCategoryFilter||'',ariaLabel:'Filtrar categoria',
         options:[{value:'',label:'Todas as categorias'},...cats.map(c=>({value:c.name,label:c.name}))],
         onChange:(v:string)=>this.setState({txCategoryFilter:v,txSelected:[],quickCategory:null})}),
       h(StyledSelect,{value:this.state.txKindFilter||'all',ariaLabel:'Filtrar receitas e despesas',
         options:[{value:'all',label:'Receitas e despesas'},{value:'income',label:'Somente receitas'},
           {value:'expense',label:'Somente despesas'}],
         onChange:(v:'all'|'income'|'expense')=>this.setState({txKindFilter:v,txSelected:[],quickCategory:null})}),
       !review?h(StyledSelect,{value:this.state.txReviewFilter||'all',ariaLabel:'Filtrar situação de revisão',
         options:[{value:'all',label:'Qualquer revisão'},{value:'pending',label:'A conferir (banco)'},
           {value:'reviewed',label:'Revisadas (banco)'}],
         onChange:(v:'all'|'pending'|'reviewed')=>this.setState({txReviewFilter:v,txSelected:[],quickCategory:null})}):null,
       h(StyledSelect,{value:this.state.txSort||'date_desc',ariaLabel:'Ordenar movimentações',
         options:[{value:'date_desc',label:'Data mais recente'},
           {value:'date_asc',label:'Data mais antiga'},
           {value:'amount_desc',label:'Maior valor absoluto'},
           {value:'amount_asc',label:'Menor valor absoluto'}],
         onChange:(v:'date_desc'|'date_asc'|'amount_desc'|'amount_asc')=>
           this.setState({txSort:v,txSelected:[],quickCategory:null})})
       ):null,
     active.length?h('div',{className:'u5-filter-chips',role:'group','aria-label':'Filtros ativos'},
       active.map(chip=>h('button',{type:'button',key:chip.key,className:'u5-filter-chip',
         'aria-label':'Remover filtro '+chip.label,onClick:chip.clear},
         chip.label,h(Icon,{name:'close',size:13})))):null,
     selected.length?h(Card,{className:'mf-bulk-toolbar'},
       h('b',{},selected.length+' selecionada(s)'),h('button',{type:'button',className:'mf-new-category',onClick:()=>this.openContextCategory('batch')},'+ Nova categoria'),
       h(StyledSelect,{value:this.state.txBatchCategory,options:cats.map(c=>({value:c.name,label:c.emoji+' '+c.name})),onChange:(value:string)=>this.setState({txBatchCategory:value})}),
       h('button',{className:'ghost-button',disabled:this.state.detailBusy,onClick:()=>this.applyBankBatch({category:this.state.txBatchCategory})},'Aplicar categoria'),
       h('button',{className:'primary-button',disabled:this.state.detailBusy,onClick:()=>this.applyBankBatch({reviewed:true})},'Marcar revisadas'),
       h('button',{className:'mf-small-link',onClick:()=>this.setState({txSelected:[]})},'Limpar seleção')):null,
     h(Card,{className:'table-card'},
       h('div',{className:'mf-table-summary'},h('button',{type:'button',className:'mf-small-link',onClick:()=>this.setState({txSelected:shown.filter(t=>t.origin==='bank').map(t=>(t.raw as BankTx).accountId+'|'+t.raw.id)})},'Selecionar banco visível'),h('span',{role:'status'},filtered.length+' resultados nos dados carregados'+(filtered.length>500?' · exibindo os primeiros 500; resumo inclui as demais linhas filtradas e carregadas':'')),review?h('span',{},'A revisar · todos os períodos carregados'):null,partialBank?h('span',{},'Histórico bancário parcial'):null),
       !review?h('details',{className:'mf-table-help'},h('summary',{},'Como editar'),h('p',{},'No nome: detalhes. Na categoria: edição. Divisões e vínculos ficam no detalhe.')):null,
       h('div',{className:'table-scroller'},h('table',{},
         h('thead',{},h('tr',{},['','Data','Movimentação','Categoria','Origem','Situação','Valor','Ação'].map((n,i)=>h('th',{key:i},n)))),
         h('tbody',{},shown.length?shown.map((t,index)=>{
           const bank=t.origin==='bank',v=t.raw as BankTx,category=cats.find(c=>c.name===t.category);
           return [this.state.txGroupByDate&&(!index||shown[index-1].date!==t.date)?h('tr',{className:'mf-tx-day',key:'day-'+t.key},h('th',{colSpan:8,scope:'rowgroup'},pDate(t.date))):null,h('tr',{key:t.key,className:selected.includes((t.raw as BankTx).accountId+'|'+t.raw.id)?'is-selected':''},
             h('td',{},bank?h('input',{type:'checkbox',className:'mf-check',checked:this.bankTxSelected(v),title:'Selecionar para ação em lote',onChange:()=>this.toggleSelected(v)}):null),
             h('td',{className:'muted'},t.date.split('-').reverse().join('/')),
             h('td',{},h('button',{className:'mf-row-detail',title:'Abrir detalhes',onClick:()=>bank?this.openBankDetail(v):this.openManualDetail(t.raw as Tx)},
               h('span',{className:'mf-row-emoji'},category?.emoji||'✨'),h('span',{},h('b',{},t.merchant||t.description),t.merchant&&t.merchant!==t.description?h('small',{},t.description):null,
                bank&&v.linkedManualId?h('small',{className:'mf-linked'},'✓ Conferido com lançamento manual'):null))),
             h('td',{},h(TransactionCategoryButton,{category:t.category,emoji:category?.emoji,
               label:'Editar categoria de '+(t.merchant||t.description)+' · '+t.date.split('-').reverse().join('/')+' · '+t.account+' · '+(t.amount>=0?'+':'−')+fmt(Math.abs(t.amount)),
               expanded:!!this.state.quickCategory&&this.state.quickCategory.origin===t.origin&&this.state.quickCategory.id===t.raw.id&&(t.origin==='manual'||this.state.quickCategory.accountId===(t.raw as BankTx).accountId),
               disabled:this.state.quickCategoryBusy||this.state.busy,
               onClick:(e:any)=>this.openCategoryFromRow(t.origin,t.raw as BankTx|Tx,e)}),bank&&v.splits?.length?h('small',{className:'mf-muted-block'},'Dividida em '+v.splits.length+' partes'):null),
             h('td',{},t.account),
             h('td',{},bank?h('span',{className:'mf-status-group'},h('span',{className:'kind-pill'},t.status==='POSTED'?'Confirmada':t.status==='PENDING'?'Pendente no banco':t.status),h('small',{className:v.reviewed?'u2-reviewed':'u2-to-review'},v.reviewed?'✓ Revisada':'A conferir'),effectiveNature(v)==='transfer'?h('small',{},'Transferência'):effectiveNature(v)==='ignore'?h('small',{},'Desconsiderada'):null):h('span',{className:'kind-pill'},'Manual')),
             h('td',{className:t.amount>=0?'good-text amount-cell':'amount-cell'},(t.amount>=0?'+':'−')+fmt(Math.abs(t.amount))),
             h('td',{},bank&&!v.reviewed?h('button',{className:'mf-quick-review',disabled:this.state.detailBusy||this.reviewSavingKeys.has(v.accountId+'|'+v.id),onClick:()=>this.markBankReviewed(v),title:'Conferir esta movimentação sem abrir detalhes'},'✓ Revisar'):null)
           )];
         }):h('tr',{},h('td',{colSpan:8,className:'empty-table'},review?'Não há movimentações para revisar.':'Não há movimentações neste período.')))))));
 }
 renderCategoryEditor(){
  const e=this.state.categoryEditor,categories=this.getCategories();
  return h('div',{className:'mf-category-editor'},h('h3',{id:'mf-category-editor-heading',tabIndex:-1},e.previousName?'Editar categoria':'Criar categoria'),
         this.field('Nome',h('input',{className:'form-control',value:e.name,maxLength:50,placeholder:'Ex.: Pets, Delivery, Estudos',disabled:!!(e.previousName&&categories.find(c=>c.name===e.previousName)?.builtIn),onChange:(v:any)=>this.setState({categoryEditor:{...e,name:v.target.value}})})),
         this.field('Tipo de categoria',h(StyledSelect,{value:e.kind,disabled:!!(e.previousName&&categories.find(c=>c.name===e.previousName)?.builtIn),options:[{value:'expense',label:'Gasto'},{value:'income',label:'Receita'},{value:'both',label:'Entrada ou saída'}],onChange:(kind:CategoryInfo['kind'])=>this.setState({categoryEditor:{...e,kind}})})),
         h('div',{className:'category-appearance'},
           h('div',{className:'category-preview',style:{borderColor:e.color+'75'}},
             h('span',{className:'category-preview-icon',style:{background:e.color+'26',boxShadow:'0 0 24px '+e.color+'25'}},e.emoji||'✨'),
             h('div',{},h('small',{},'PRÉVIA DA CATEGORIA'),h('strong',{},e.name.trim()||'Minha categoria'),h('span',{},'Você escolhe como organizar cada movimentação.'))),
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
             maxLength:7,spellCheck:false,placeholder:'#3e9a85',onBlur:(v:any)=>{const color=String(v.target.value).trim();if(/^#[0-9a-fA-F]{6}$/.test(color))this.setState({categoryEditor:{...e,color:color.toLowerCase()}});else v.target.value=e.color;},onKeyDown:(v:any)=>{if(v.key==='Enter')v.currentTarget.blur();}}))
         ),
         h('div',{className:'toolbar-actions'},h('button',{className:'primary-button',disabled:this.state.categoryContextBusy,onClick:()=>this.saveCategory()},this.state.categoryContextBusy?'Salvando…':e.previousName?'Salvar alterações':'Adicionar categoria'),e.previousName?h('button',{className:'ghost-button',onClick:()=>this.setState({categoryEditor:{previousName:'',name:'',color:'#3e9a85',emoji:'✨',kind:'expense'}})},'Cancelar edição'):null));
 }
 openContextCategory(target:'entry'|'quick'|'batch'){
  if(this.state.mode==='demo'||!desktop||this.state.quickCategoryBusy)return;
  this.setState({contextCategory:{target,editor:{...this.state.categoryEditor},mode:this.state.mode,account:this.state.bankFilter,query:this.state.query},categoryEditor:{previousName:'',name:target==='quick'?this.state.quickCategoryQuery:'',color:'#3e9a85',emoji:'✨',kind:target==='entry'?this.state.entry.kind:this.quickCategoryContext()?.kind||'expense'},categoryMessage:''});
 }
 closeContextCategory(){if(this.state.categoryContextBusy)return;const c=this.state.contextCategory;this.setState({contextCategory:undefined,categoryEditor:c?.editor||this.state.categoryEditor});}
 renderContextCategory(){return h('div',{className:'modal-backdrop mf-context-category',onMouseDown:(e:any)=>{if(e.target===e.currentTarget)this.closeContextCategory();}},h('section',{className:'modal',role:'dialog','aria-modal':'true','aria-label':'Nova categoria sem sair da classificação'},h('div',{className:'modal-head'},h('div',{},h('small',{className:'micro-label'},'ORGANIZAR SEM INTERROMPER'),h('h2',{},'Nova categoria')),h('button',{className:'close-button',disabled:this.state.categoryContextBusy,'aria-label':'Voltar à classificação',onClick:()=>this.closeContextCategory()},'×')),h('p',{className:'muted-desc'},'Seu lançamento, filtros e seleção continuam aqui. Salvar cria a categoria; a classificação ainda exige sua ação.'),this.state.categoryMessage?h('p',{role:'status'},this.state.categoryMessage):null,this.renderCategoryEditor()));}
 renderCategories(){
   const categories=this.getCategories(),rules=this.state.rules,e=this.state.categoryEditor,r=this.state.ruleEditor;
   const preview=findCategoryRule(this.state.ruleTest,'bank',rules);
   return h('div',{className:'section categories-page'},
     h('div',{className:'intro-banner'},h('div',{},h('span',{className:'micro-label'},'ORGANIZAÇÃO AUTOMÁTICA'),h('h2',{},'Seu dinheiro, suas categorias.'),h('p',{},'Personalize os nomes e cores, crie regras por descrição e ajuste lançamentos individualmente. Tudo funciona localmente, sem IA paga.')),h('div',{className:'banner-orb'},h(Icon,{name:'filter',size:46}))),
     desktop&&this.state.mode==='real'?h(Card,{className:'mf-category-import'},
       h('div',{},h('b',{},'Classificação inteligente preparada para você'),
         h('p',{},'Aplique um arquivo de sugestões revisadas. O aplicativo preserva suas correções, cria uma cópia de segurança e mantém movimentações duvidosas para você analisar.')),
       h('button',{className:'primary-button',onClick:()=>this.importCategoryPack()},h(Icon,{name:'upload',size:17}),'Importar sugestões')):null,
     this.state.mode==='demo'?h(Card,{className:'settings-card'},h('h2',{},'Modo demonstração'),h('p',{},'A edição de regras e categorias está disponível somente nos seus dados pessoais.'),h('button',{className:'primary-button',onClick:()=>this.toggleMode()},'Voltar aos meus dados')):
     h('div',{className:'categories-layout'},
       h(Card,{className:'settings-card'},
         h('div',{className:'card-heading'},h('div',{},h('h2',{},'Categorias personalizadas'),h('p',{},'As categorias padrão podem mudar de cor. Categorias criadas por você podem ser renomeadas.'))),
         h('div',{className:'category-list'},categories.map(cat=>h('div',{className:'category-list-row',key:cat.name},
           h('span',{className:'category-emoji-icon',style:{background:cat.color+'20',borderColor:cat.color+'70'}},cat.emoji||'✨'),h('b',{},cat.name),h('small',{className:'mf-category-kind-tag'},cat.kind==='income'?'Receita':cat.kind==='expense'?'Gasto':'Entrada ou saída'),cat.builtIn?h('small',{className:'muted'},'Padrão'):null,
           h('button',{className:'small-link',onClick:()=>this.setState({categoryEditor:{previousName:cat.name,name:cat.name,color:cat.color,emoji:cat.emoji||'✨',kind:cat.kind}})},'Editar'),
           !cat.builtIn?h('button',{className:'trash-button',title:'Excluir categoria sem uso',onClick:()=>this.deleteCategory(cat.name)},h(Icon,{name:'trash',size:16})):null))),
         this.renderCategoryEditor()),
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
 renderBudgets(){
   const useBank=this.state.mode==='real'&&this.state.dashboardSource==='bank'&&this.state.bank.data.accounts.length>0;
   const s=useBank?bankSnapshot(this.state.bank,this.state.month):this.monthData();
   const d=this.state.data,mode=this.state.budgetTab,focus=this.state.budgetFocus||'all',search=this.state.budgetSearch||'';
   const all=this.getCategories();
   const allowed=all.filter(c=>mode==='income'?c.kind!=='expense':c.kind!=='income');
   const amounts=mode==='income'?s.incomeCategories:s.categories;
   const getAmount=(name:string)=>amounts.find(x=>x.name===name)?.total||0;
   // Categorias erradas para o tipo da movimentação não devem desaparecer dos totais.
   const assigned=allowed.reduce((sum,c)=>sum+getAmount(c.name),0);
   const total=mode==='income'?s.income:s.expense;
   const unclassified=Math.max(0,total-assigned);
   const entries=allowed.map(c=>({info:c,total:getAmount(c.name),hasLimit:Object.prototype.hasOwnProperty.call(d.budgets,c.name),limit:d.budgets[c.name]}))
      .filter(x=>x.total>0||(mode==='expense'&&x.hasLimit));
   const quiet=allowed.filter(c=>!entries.some(x=>x.info.name===c.name));
   const limited=entries.filter(x=>mode==='expense'&&x.hasLimit);
   const spentLimited=limited.reduce((sum,x)=>sum+x.total,0);
   const limitTotal=limited.reduce((sum,x)=>sum+(x.limit||0),0);
   const margin=limitTotal-spentLimited;
   const sortedEntries=entries.slice().sort(mode==='expense'?budgetPresentationOrder:(a,b)=>b.total-a.total);
   const signals=u3BudgetSignals(entries,total);
   const visible=sortedEntries.filter(x=>(mode==='income'||focus==='all'||focus==='attention'&&x.hasLimit&&(x.total>x.limit||x.limit>0&&x.total/x.limit>=.9)||focus==='unlimited'&&!x.hasLimit)&&(!search||fold(x.info.name).includes(fold(search))));
   const suggestLimit=(name:string)=>{
     const values=Array.from({length:3},(_,i)=>{
       const ym=shiftMonth(this.state.month,-1-i);
       const snap=useBank?bankSnapshot(this.state.bank,ym):snapshot(this.state.data,ym);
       return snap.categories.find(x=>x.name===name)?.total||0;
     });
     if(values.filter(v=>v>0).length<2)return null;
     const average=values.reduce((a,b)=>a+b,0)/3;
     // +10% de folga, arredondado para R$ 10. Não cria orçamento sem confirmação.
     return Math.max(2000,Math.ceil(average*1.1/1000)*1000);
   };
   return h('div',{className:'section mf-budget-section u3-budgets'},
     h('div',{className:'mf-budget-heading'},
       h('div',{},h('p',{},mode==='expense'?'Acompanhe seus limites por categoria.':'Veja a composição das receitas recebidas.')),
       h('div',{className:'mf-budget-switch',role:'group','aria-label':'Visualização financeira'},
         h('button',{type:'button',className:mode==='expense'?'active':'','aria-pressed':mode==='expense',onClick:()=>this.setState({budgetTab:'expense',showAllBudgetCategories:false,budgetFocus:'all',budgetSearch:''})},'Gastos'),
         h('button',{type:'button',className:mode==='income'?'active':'','aria-pressed':mode==='income',onClick:()=>this.setState({budgetTab:'income',showAllBudgetCategories:false,budgetFocus:'all',budgetSearch:''})},'Receitas'))),
     this.renderSourcePicker(),
     h('p',{className:'mf-budget-context'},prettyMonth(this.state.month)+' · '+(mode==='expense'?'Gastos do mês e limites cadastrados por categoria':'Composição das receitas recebidas, sem incluir transferências próprias confirmadas')),
     mode==='expense'?h('div',{className:'mf-budget-summary mf-budget-summary-four'},
       h('div',{className:'mf-border-reveal mf-tone-expense',role:'group',tabIndex:0},h('small',{},'Gasto nas categorias com limite'),h('strong',{},fmt(spentLimited))),
       h('div',{className:'mf-border-reveal mf-tone-balance',role:'group',tabIndex:0},h('small',{},'Limites cadastrados'),h('strong',{},limited.length?fmt(limitTotal):'Sem limites')),
       h('div',{className:'mf-border-reveal mf-tone-net '+(limited.length?(margin<0?'is-negative':'is-positive'):'is-neutral'),role:'group',tabIndex:0},h('small',{},margin<0?'Excesso nos limites':'Margem nos limites'),h('strong',{className:margin<0?'bad-text':''},limited.length?fmt(Math.abs(margin)):'Sem limites'),h('small',{},'Não representa saldo disponível')),
       h('div',{className:'mf-border-reveal mf-tone-warning',role:'group',tabIndex:0},h('small',{},'Gasto fora dos limites'),h('strong',{},fmt(Math.max(0,total-spentLimited))))):
     h('div',{className:'mf-budget-summary'},
       h('div',{},h('small',{},'Total recebido no período'),h('strong',{},fmt(total))),
       h('div',{},h('small',{},'Origens com recebimentos'),h('strong',{},String(entries.filter(x=>x.total>0).length))),
       h('div',{},h('small',{},'Maior fonte de receita'),h('strong',{},entries.length?entries.slice().sort((a,b)=>b.total-a.total)[0].info.name:'Nenhuma ainda'))),
     mode==='expense'?h('section',{className:'u3-budget-insight'},
       h('div',{className:'u3-coverage'},h('div',{className:'u3-coverage-ring','aria-hidden':'true',style:{background:'conic-gradient(var(--u3-accent) '+(signals.covered||0)+'%, var(--surface3) 0)'}},h('strong',{},signals.covered===null?'—':signals.covered+'%')),h('div',{},h('h2',{},'Gastos com um limite definido'),h('p',{},signals.covered===null?'Sem gastos nesta fonte e mês.':signals.covered+'% dos gastos do mês estão em categorias com limite.'),h('small',{},'Cobertura do orçamento · não é dinheiro reservado'))),
       h('div',{className:'u3-budget-actions'},[
        {key:'attention',count:signals.exceeded+signals.near,title:'Pedem atenção',description:signals.exceeded+' acima · '+signals.near+' perto do limite',icon:'alert'},
        {key:'unlimited',count:signals.unlimited,title:'Sem limite',description:'Categorias com gastos para organizar',icon:'layers'}
       ].map(x=>h('button',{type:'button',className:'u3-insight-action','aria-pressed':focus===x.key,onClick:()=>this.setState({budgetFocus:focus===x.key?'all':x.key,budgetSearch:''})},h(Icon,{name:x.icon,size:18}),h('span',{},h('b',{},x.title),h('small',{},x.description)),h('strong',{},x.count),h(Icon,{name:'chevron-right',size:15}))))):null,
     useBank&&this.state.bank.data.truncated&&!this.state.bank.data.dailyTotals?h('p',{className:'mf-budget-warning'},'Histórico carregado parcialmente. Valores e cobertura refletem somente os registros disponíveis.'):null,
     mode==='expense'?h('p',{className:'mf-budget-contract'},'O mês filtra os gastos. Os limites cadastrados são recorrentes e valem para todos os meses.') :null,
     mode==='income'&&this.state.planning.items.some(x=>x.kind==='income'&&x.dueDate.slice(0,7)===this.state.month&&x.remaining>0&&x.status!=='cancelled')?
       h('p',{className:'mf-budget-expected'},'Recebimentos ainda previstos no Planejamento: '+fmt(this.state.planning.items.filter(x=>x.kind==='income'&&x.dueDate.slice(0,7)===this.state.month&&x.remaining>0&&x.status!=='cancelled').reduce((sum,x)=>sum+x.remaining,0))+'. Não somados às receitas já recebidas.'):null,
     unclassified>0?h('div',{className:'mf-budget-warning',role:'status'},
       'Há '+fmt(unclassified)+' em '+(mode==='expense'?'despesas':'receitas')+' com categorias incompatíveis ou ainda não identificadas. Confira em Movimentações.'):null,
     h('div',{className:'u3-budget-toolbar'},h('div',{className:'u2-view-tabs','aria-label':'Filtro de categorias'},(mode==='income'?[{value:'all',label:'Recebimentos'}]:[{value:'all',label:'Todas'},{value:'attention',label:'Atenção'},{value:'unlimited',label:'Sem limite'}]).map(x=>h('button',{type:'button','aria-pressed':focus===x.value,onClick:()=>this.setState({budgetFocus:x.value})},x.label))),h('div',{className:'search-box'},h(Icon,{name:'search',size:16}),h('input',{'aria-label':'Buscar categoria no orçamento',placeholder:'Buscar categoria',value:search,onChange:(e:any)=>this.setState({budgetSearch:e.target.value})}))),
     h('div',{className:'u3-budget-list-heading'},h('h2',{},mode==='expense'?'Limites por categoria':'Origens da sua renda'),h('span',{role:'status'},visible.length+' categoria(s)')),
     visible.length?h('div',{className:'budget-grid'},
       visible.map(({info,total:spent,hasLimit,limit},index)=>{
         const pct=hasLimit&&limit>0?Math.round(spent/limit*100):hasLimit?(spent>0?100:0):0;
         const share=total>0?Math.round(spent/total*100):0;
         const status=!hasLimit?'unlimited':spent>limit?'exceeded':limit>0&&spent/limit>=.9?'near':'within';
         const gauge=mode==='expense'&&hasLimit&&limit>0?budgetB3Visual(spent,limit):null;
         const remaining=limit-spent;
         const row=h(Card,{className:'budget-item mf-budget-card mf-budget-'+status+(gauge?' mf-budget-card-b3':''),key:info.name},
           h('div',{className:'budget-item-top'},h('span',{className:'cat-symbol',style:{background:info.color+'28',color:info.color}},info.emoji||'✨'),
             h('div',{},h('h3',{},info.name),h('small',{className:'u3-budget-state'},mode==='income'?'Recebimentos do mês':status==='exceeded'?'Acima do limite':status==='near'?'Próximo do limite':status==='unlimited'?'Sem limite':'Dentro do limite'))),
           gauge?h('div',{className:'mf-budget-b3',role:'group','aria-label':'Orçamento de '+info.name+': '+gauge.percent+'% utilizado; gasto '+fmt(spent)+' de '+fmt(limit)+(remaining<0?'; excedido em '+fmt(-remaining):'; restante '+fmt(remaining))},
             h('div',{className:'mf-budget-b3-dial',style:{'--mf-budget-b3-color':gauge.color}},
               h('svg',{className:'mf-budget-b3-svg',viewBox:'0 0 200 110','aria-hidden':true,focusable:'false'},
                 h('path',{className:'mf-budget-b3-track',d:'M 14 96 A 86 86 0 0 1 186 96',pathLength:100}),
                 gauge.fill>0?h('path',{className:'mf-budget-b3-fill',d:'M 14 96 A 86 86 0 0 1 186 96',pathLength:100,strokeDasharray:gauge.fill+' 100'}):null),
               h('strong',{className:'mf-budget-b3-percent'},gauge.percent+'%'),
               h('span',{className:'mf-budget-b3-caption'},'do limite utilizado')),
             h('div',{className:'mf-budget-b3-values'},
               h('div',{},h('small',{},'Gasto atual'),h('strong',{},fmt(spent))),
               h('div',{},h('small',{},'Limite configurado'),h('strong',{},fmt(limit)))),
             h('p',{className:'mf-budget-b3-remaining'+(remaining<0?' is-exceeded':'')},remaining<0?'Limite ultrapassado · excesso de '+fmt(-remaining):'Restam '+fmt(remaining))):
           h('div',{className:'mf-budget-money'},h('strong',{},fmt(spent)),
             h('span',{},mode==='expense'?'gasto até agora':'recebido no período')),
           mode==='income'?h('div',{className:'mf-income-share'},
             h('div',{className:'progress-track'},h('div',{className:'progress-bar',style:{background:info.color,width:(spent>0?Math.max(2,Math.min(share,100)):0)+'%'}})),
             h('small',{},share===0&&spent>0?'Menos de 1% das receitas':share+'% das receitas')):
           gauge?null:hasLimit?h('div',{className:'mf-budget-limit'},
             h('div',{className:'mf-budget-limit-head'},
               h('span',{},'Limite '+fmt(limit)),h('strong',{className:spent>limit?'bad-text':''},limit===0?(spent>0?'Acima do limite':'Limite zero definido'):pct+'% utilizado')),
             limit>0?h('div',{className:'progress-track'},h('div',{className:'progress-bar',style:{width:Math.min(pct,100)+'%'}})):null,
             h('small',{},spent>limit?'Ultrapassou em '+fmt(spent-limit):status==='near'?'Próximo do limite · restam '+fmt(limit-spent):limit===0?'Limite zero definido':'Restam '+fmt(limit-spent))):
           h('div',{className:'mf-no-budget'},h('span',{},'Sem limite definido'),
             h('div',{className:'mf-budget-limit-actions'},suggestLimit(info.name)?h('button',{type:'button',className:'small-link',title:'Sugestão: média dos últimos três meses com 10% de margem, arredondada para R$ 10. Você confirma antes de salvar.',onClick:()=>this.setState({editModal:{type:'budget',key:info.name,title:'Limite sugerido · '+info.name,value:moneyString(suggestLimit(info.name)!)}})},'Sugerir '+fmt(suggestLimit(info.name)!)):null,
             h('button',{type:'button',className:'small-link',onClick:()=>this.setState({editModal:{type:'budget',key:info.name,title:'Definir limite · '+info.name,value:''}})},'Definir limite'))),
           mode==='expense'&&hasLimit?h('div',{className:'budget-item-bottom'},h('button',{className:'small-link',onClick:()=>this.setState({editModal:{type:'budget',key:info.name,title:'Editar limite · '+info.name,value:moneyString(limit)}})},'Editar limite')):null);
         const group=mode==='expense'&&(index===0||hasLimit!==visible[index-1].hasLimit);
         return group?[h('h3',{className:'mf-budget-group-title',key:'group-'+info.name},hasLimit?'Categorias com limite':'Gastos sem limite'),row]:row;
       })):h(Card,{className:'mf-budget-empty'},
         h('h3',{},entries.length?'Nenhuma categoria para estes filtros':mode==='income'?'Nenhuma receita neste período':'Nenhum gasto neste período'),
         h('p',{},entries.length?'Altere o filtro ou a busca para ver outras categorias.':mode==='income'?'As receitas aparecerão aqui depois de serem registradas ou sincronizadas.':'Suas despesas aparecerão aqui quando houver movimentações.')),
     quiet.length?h('div',{className:'mf-budget-quiet'},
       h('button',{className:'mf-budget-quiet-trigger',type:'button','aria-expanded':this.state.showAllBudgetCategories,
         onClick:()=>this.setState({showAllBudgetCategories:!this.state.showAllBudgetCategories})},
         this.state.showAllBudgetCategories?'Ocultar outras categorias':'Ver outras categorias ('+quiet.length+')',h(Icon,{name:this.state.showAllBudgetCategories?'chevron-up':'chevron-down',size:16})),
       this.state.showAllBudgetCategories?h('div',{className:'mf-budget-quiet-grid'},quiet.map(c=>h('div',{className:'mf-budget-quiet-row',key:c.name},
          h('span',{},c.emoji||'✨','  ',c.name),mode==='expense'?h('button',{className:'small-link',onClick:()=>this.setState({editModal:{type:'budget',key:c.name,title:'Definir limite · '+c.name,value:''}})},'Definir limite'):h('span',{className:'muted'},'Sem receitas neste mês')))):null):null,
     h('p',{className:'mf-budget-disclaimer'},'Pix para terceiros continuam como entradas ou saídas até que sejam identificados como transferências próprias. Reembolsos sem vínculo são mostrados como entradas, não abatimentos automáticos de gastos.'));
 }

 renderAssistant(includeBanner:boolean=true){
  const d=this.state.data,out=this.state.outcome,daily=!!desktop&&this.state.mode==='real',stale=this.isSimulationStale();
  const examples=[{name:'Notebook',price:'3200',icon:'wallet'},{name:'Celular',price:'2400',icon:'cart'},{name:'Compra pequena',price:'350',icon:'spark'}];
  return h('div',{className:'section assistant-page u3-simulator'},
   includeBanner?h('div',{className:'intro-banner assistant-banner mf-compact-banner mf-sim-intro u3-sim-heading'},h('div',{},h('h2',{},'Decida com o cenário completo.'),h('p',{},'Compare parcelas, juros e o efeito da compra no seu planejamento.')),h('span',{className:'u3-source-badge'},daily?'Fluxo de caixa diário':'Perfil manual · cenário simplificado')):null,
   h('div',{className:'assistant-grid'},h(Card,{className:'sim-form-card'},h('div',{className:'card-heading'},h('div',{},h('span',{className:'micro-label'},'MONTE SEU CENÁRIO'),h('h2',{},'Sua próxima compra'),h('p',{},'Simular não cria uma dívida.'))),
    this.field('Valor do produto (R$)',h('input',{className:'form-control',type:'text',inputMode:'decimal',value:this.state.sim.value,placeholder:'Ex.: 1.499,90',onChange:(e:any)=>this.setSimulation({value:e.target.value})})),
    h('div',{className:'two-inputs'},this.field('Número de parcelas',h(StyledSelect,{className:'form-control',value:this.state.sim.installments,options:[1,2,3,4,5,6,8,10,12,18,24,36].map(n=>({value:String(n),label:n===1?'À vista':n+'x'})),onChange:(value:string)=>this.setSimulation({installments:value})})),this.field('Juros ao mês (%)',h('input',{className:'form-control',type:'text',inputMode:'decimal',value:this.state.sim.interest,onChange:(e:any)=>this.setSimulation({interest:e.target.value})}))),
    daily?this.field('Primeiro vencimento',h(SingleDatePicker,{value:this.state.sim.firstDueDate||(()=>{const today=iso(new Date()),[y,m,d]=today.split('-').map(Number);return Number(this.state.sim.installments)===1?today:iso(new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate())));})(),onChange:(value:string)=>this.setSimulation({firstDueDate:value})}),'A data é usada na projeção diária.'):h('p',{className:'u3-sim-note'},'Este cenário simplificado começa no próximo mês e usa os valores recorrentes do perfil.'),
    h('div',{className:'u3-reserve-note'},h(Icon,{name:'shield',size:17}),h('div',{},h('small',{},'Reserva mínima cadastrada'),h('strong',{},fmt(d.settings.reserve))),h('button',{type:'button',className:'mf-small-link',onClick:()=>{this.setState({settingsSection:'profile'});this.navigate('settings');}},'Ajustar')),
    h('button',{type:'button',className:'primary-button full action-large',disabled:this.state.simBusy,onClick:()=>this.runSim()},h(Icon,{name:this.state.simBusy?'refresh':'spark',size:18}),this.state.simBusy?'Calculando cenário…':stale?'Recalcular cenário':'Analisar compra'),
    h('details',{className:'mf-sim-premises'},h('summary',{},'O que entra nesta simulação?'),h('p',{},daily?'Saldos de referência e compromissos cadastrados. Receitas incertas ficam fora do cenário.':'Renda, despesas fixas, parcelas e reserva informadas no perfil.'),h('p',{},'A fonte e os alertas dos dados aparecem no resultado. Nenhum valor é reservado automaticamente.')),
    h('div',{className:'sim-example-title'},'Experimentar um valor'),h('div',{className:'quick-examples'},examples.map(x=>h('button',{type:'button',className:'quick-choice',onClick:()=>this.setSimulation({value:x.price}),key:x.name},h(Icon,{name:x.icon,size:16}),x.name)))),
    h('div',{className:'result-column'},
     this.state.simSaved?this.renderSimulationComparison():null,
     this.state.simError?h('p',{className:'u5-sim-error',role:'alert'},this.state.simError):null,
     out?h('div',{className:stale?'u5-sim-stale':'u5-sim-current'},
       h('p',{className:'u5-sim-state',role:'status'},
         stale?'Resultado anterior — desatualizado. Recalcule para atualizar os valores.':
           'Resultado calculado com as premissas atuais.'),
       this.renderResult(out)):
       h(Card,{className:'empty-result'},h('span',{className:'empty-result-icon'},h(Icon,{name:'chart',size:34})),
         h('h2',{},this.state.simBusy?'Calculando o impacto da compra…':'Compare antes de decidir.'),
         h('p',{},'Analise uma opção, guarde como referência e experimente outra quantidade de parcelas ou taxa.'),
         h('div',{className:'u3-result-guide'},
           h('span',{},h('b',{},'01'),'Veja o custo total'),
           h('span',{},h('b',{},'02'),'Confira a reserva'),
           h('span',{},h('b',{},'03'),'Compare duas opções'))),
     u3SimulationCost(out)&&!stale&&!this.state.simBusy&&!this.state.simError?
       h('div',{className:'u3-save-scenario'},
         h('button',{type:'button',className:'outlined-action',onClick:()=>this.saveSimulation()},
           h(Icon,{name:'layers',size:16}),
           this.state.simSaved?'Substituir referência A':'Guardar como referência A'),
         h('small',{},'Disponível nesta sessão · não cria compromisso')):null,
     h('div',{className:'info-box'},h(Icon,{name:'shield',size:17}),h('p',{},'Análise matemática. Dados incompletos ou antigos podem limitar a projeção; o resultado não garante capacidade de pagamento.')))));
 }
 renderSimulationComparison(){
  const saved=this.state.simSaved;if(!saved)return null;
  const a=u3SimulationCost(saved.result),b=this.isSimulationStale()?null:u3SimulationCost(this.state.outcome);if(!a)return null;
  const delta=b?b.total-a.total:null,sameEngine=b&&a.daily===b.daily;
  const count=(out:any)=>out.installments||out.count;
  const rows=[['Valor original',fmt(a.principal),b?fmt(b.principal):'—'],['Parcelas',String(count(saved.result))+'x',b?String(count(this.state.outcome))+'x':'—'],['Parcela de referência',fmt(a.monthly),b?fmt(b.monthly):'—'],['Taxa ao mês',saved.input.interest+'%',b?(this.state.simCalculatedInput?.interest||'')+'%':'—'],['Juros totais',fmt(a.interest),b?fmt(b.interest):'—'],['Custo total',fmt(a.total),b?fmt(b.total):'—']];
  if(sameEngine&&a.daily)rows.push(['Menor saldo projetado',a.minimum===null?'—':fmt(a.minimum),b!.minimum===null?'—':fmt(b!.minimum)]);
  return h('section',{className:'u3-comparison'},h('div',{className:'u3-panel-heading'},h('div',{},h('h2',{},'Duas opções, lado a lado'),h('p',{},b?'Comparação de dois cálculos atualizados':this.isSimulationStale()?'A referência A permanece salva; recalcule as novas premissas para atualizar B.':'Referência guardada. Altere os dados e analise a opção B.')),h('button',{type:'button',className:'mf-small-link',onClick:()=>this.setState({simSaved:undefined})},'Limpar referência')),
   h('div',{className:'u3-comparison-scroll'},h('table',{},h('caption',{className:'sr-only'},'Comparação entre a referência A e o resultado atual B'),h('thead',{},h('tr',{},h('th',{scope:'col'},'Cenário'),h('th',{scope:'col'},'Referência A'),h('th',{scope:'col'},'Atual B'))),h('tbody',{},rows.map(row=>h('tr',{key:row[0]},h('th',{scope:'row'},row[0]),h('td',{},row[1]),h('td',{},row[2])))))),
   h('div',{className:'u3-comparison-context'},h('span',{},'A: '+(a.daily?'projeção diária · início '+bankReferenceLabel(saved.result.firstDueDate):'perfil manual')),b?h('span',{},'B: '+(b.daily?'projeção diária · início '+bankReferenceLabel(this.state.outcome.firstDueDate):'perfil manual')):null),
   delta===null?null:h('p',{className:'u3-comparison-delta'},delta===0?'Mesmo custo total.':'O custo total da opção B é '+fmt(Math.abs(delta))+(delta>0?' maior.':' menor.')),
   b&&a.principal!==b.principal?h('p',{className:'u3-sim-note'},'Os valores originais são diferentes. A diferença no total não representa economia de juros.'):null,
   b&&!sameEngine?h('p',{className:'u3-sim-note'},'As opções usam motores diferentes. Compare apenas os custos; os saldos não são equivalentes.'):null,
   h('small',{className:'u3-sim-note'},'Cada projeção usa os dados disponíveis no momento da análise. A parcela pode variar por centavos; confira o cronograma.'));
 }
 renderResult(out:any){if(!out)return null;
  if(out.error)return h(Card,{className:'result-error'},h(Icon,{name:'alert'}),out.error);
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
      h('div',{className:'u3-cost-strip'},h('span',{},'Valor original ',h('b',{},fmt(out.principal))),h('span',{},'Juros totais ',h('b',{},fmt(out.interest))),h('span',{},'Total ',h('b',{},fmt(out.total)))),
      h(U3ScenarioChart,{rows:out.rows}),
      h('details',{className:'u3-monthly-data'},h('summary',{},'Ver valores por mês · '+out.rows.length+' meses'),h('div',{className:'u3-comparison-scroll'},h('table',{},h('caption',{},'Fechamento mensal estimado · não representa o menor saldo diário'),h('thead',{},h('tr',{},h('th',{scope:'col'},'Mês'),h('th',{scope:'col'},'Sem compra'),h('th',{scope:'col'},'Com compra'))),h('tbody',{},out.rows.map((v:any)=>h('tr',{key:v.month},h('th',{scope:'row'},prettyMonth(v.month)),h('td',{},fmt(v.withoutPurchase)),h('td',{className:v.withPurchase<0?'bad-text':''},fmt(v.withPurchase)))))))),
      h('button',{type:'button',className:'primary-button mf-plan-from-sim',
       disabled:out.installments>36||!this.canPlanSimulatedPurchase(out),
       title:!this.canPlanSimulatedPurchase(out)?'Recalcule as premissas antes de planejar esta compra.':undefined,
       onClick:()=>this.planSimulatedPurchase()},'Planejar esta compra'),
      out.installments>36?h('p',{className:'muted-desc'},'Para registrar o compromisso, simule até 36 parcelas.'):null,
      h('p',{className:'disclaimer'},quality==='stale'?'A última leitura do banco está antiga. Atualize as contas antes de tomar decisões. ':quality==='incomplete'?'Há contas sem saldo disponível. A projeção está incompleta. ':quality==='unverified'?'O saldo recebido pode não refletir as movimentações mais recentes. ':'',out.warning));
  }const r=out.risk;const info:any={safe:['Cenário favorável, não garantia','Seu perfil informado indica margem para acomodar a parcela.','safe'],caution:['Atenção ao orçamento','A compra reduz sua margem ou compromete uma parte relevante da renda.','caution'],risk:['Compra arriscada','A projeção pode ultrapassar a margem informada ou comprometer sua reserva.','danger'],unknown:['Dados insuficientes','Defina renda e despesas fixas em Configurações para avaliar o risco.','unknown']};const [title,subtitle,cls]=info[r];const ratios=out.hasProfile?Math.round(out.monthly/this.state.data.settings.income*100):null;return h(Card,{className:'result-card'},h('div',{className:'result-badge '+cls},h(Icon,{name:r==='safe'?'check':'alert',size:22}),h('div',{},h('h2',{},title),h('p',{},subtitle))),h('div',{className:'result-metrics'},h('div',{},h('span',{},'Parcela'),h('strong',{},fmt(out.monthly))),h('div',{},h('span',{},'Custo total'),h('strong',{},fmt(out.total))),h('div',{},h('span',{},'Juros totais'),h('strong',{},fmt(out.total-out.principal))),h('div',{},h('span',{},'Peso na renda'),h('strong',{},ratios===null?'—':ratios+'%'))),h('div',{className:'future-title'},'Projeção dos próximos meses'),h('div',{className:'future-list'},out.rows.slice(0,6).map((v:any)=>h('div',{key:v.month},h('span',{},prettyMonth(v.month)),h('b',{className:v.available<0?'bad-text':''},fmt(v.available))))),h('p',{className:'disclaimer'},'Projeção simplificada: começa no próximo mês e pressupõe os mesmos valores recorrentes informados. Não considera vencimentos diários, renda variável ou pagamentos já lançados. Não é garantia de capacidade de pagamento.'));
 }
 renderBankQuick(){
   if(this.state.mode==='demo')return null;
   const b=this.state.bank,a=b.data.accounts||[],last=b.data.last;
   if(!a.length && !b.config.configured)return null;
   const coverage=bankBalanceCoverage(a);
   return h('div',{className:'bank-quick'},h('div',{},h('small',{},'SALDOS INFORMADOS PELAS INSTITUIÇÕES'),h('strong',{},a.length?bankBalanceLabel(coverage):'Configuração bancária salva'),h('span',{},a.length?a.length+' conta(s) · atualização: '+(last?.completedAt?new Date(last.completedAt).toLocaleString('pt-BR'):'pendente'):'Sincronize para obter suas contas')),
   h('button',{className:'outlined-action',onClick:()=>this.navigate('banks')},'Ver contas bancárias',h(Icon,{name:'arrow',size:16})),
   h('p',{},'Saldos e extratos bancários não são somados aos lançamentos manuais para evitar duplicidades.'),
   b.data.truncated?h('p',{className:'bank-warning'},'Alguns registros antigos não estão incluídos nos totais exibidos. Uma atualização futura ampliará a consulta histórica.'):null);
 }
 renderBanks(){
   if(this.state.mode==='demo')return h('div',{className:'section'},h(Card,{className:'settings-card'},h('h2',{},'Suas contas estão disponíveis nos dados pessoais'),h('p',{className:'muted-desc'},'O modo demonstração é isolado e nunca consulta suas contas bancárias.'),h('button',{className:'primary-button',onClick:()=>this.toggleMode()},'Voltar aos meus dados')));
   if(!desktop)return h('div',{className:'section'},h(Card,{className:'settings-card'},h('h2',{},'Abra o Meu Financeiro'),h('p',{},'Abra a versão instalada para consultar suas contas com segurança.')));
   const b=this.state.bank,c=b.config||EMPTY_BANK.config,accounts=b.data.accounts||[],tx=b.data.transactions||[],f=this.state.bankForm;
   const coverage=bankBalanceCoverage(accounts),now=Date.now(),signals=accounts.map(account=>({account,...u3AccountSignals(account,tx,now)})),attention=signals.filter(x=>x.attention),shown=this.state.accountFocus==='attention'?signals.filter(x=>x.attention):signals;
   const issues=(b.data.items||[]).filter(x=>!['UPDATED','UPDATING'].includes(x.status));
   return h('div',{className:'section bank-page u3-accounts'},
     h('div',{className:'u3-section-heading'},h('div',{},h('h2',{},'Seu dinheiro, conta por conta.'),h('p',{},'Saldos recebidos e qualidade da referência em um só lugar.')),h('button',{type:'button',className:'primary-button',disabled:!c.configured||this.state.bankBusy,onClick:()=>this.syncBank()},h(Icon,{name:'refresh',size:16}),this.state.bankBusy?'Atualizando…':'Atualizar contas')),
     h('div',{className:'mf-accounts-summary u3-account-summary'},
       h(Card,{className:'mf-account-total mf-border-reveal mf-tone-balance'},h('small',{},'Saldo bancário de referência'),h('strong',{},bankBalanceLabel(coverage)),h('p',{},'Não somado aos registros manuais')),
       h(Card,{className:'mf-account-count mf-border-reveal mf-tone-neutral'},h('small',{},'Contas com saldo informado'),h('strong',{},coverage.knownCount+' de '+accounts.length),h('p',{},coverage.missingCount?coverage.missingCount+' saldo(s) indisponível(is)':'Zero informado é diferente de saldo ausente')),
       h(Card,{className:'u3-account-signal mf-border-reveal mf-tone-income'},h('small',{},'Referência de até 24h'),h('strong',{},signals.filter(x=>x.reference.status==='recent').length+' conta(s)'),h('p',{},'O horário não garante saldo em tempo real')),
       h('button',{type:'button',className:'u3-account-signal u3-clickable-card mf-border-reveal mf-tone-warning','aria-pressed':this.state.accountFocus==='attention',onClick:()=>this.setState({accountFocus:this.state.accountFocus==='attention'?'all':'attention'})},h('small',{},'Conferir referência'),h('strong',{},attention.length+' conta(s)'),h('p',{},'Saldo ausente, antigo ou sem horário'))),
     issues.length?h('div',{className:'u3-connection-alert',role:'status'},h(Icon,{name:'alert',size:18}),h('span',{},issues.length+' conexão(ões) precisam de conferência. Os valores abaixo podem estar desatualizados.'),h('button',{type:'button',className:'mf-small-link',onClick:()=>this.setState({bankIntegrationsOpen:true})},'Ver conexão')):null,
     accounts.length?h('section',{className:'mf-accounts-first'},h('div',{className:'mf-bank-account-heading'},h('h2',{},'Saldos por conta'),h('small',{},'Atualização: '+(b.data.last?.completedAt?new Date(b.data.last.completedAt).toLocaleString('pt-BR'):'não informada'))),
      h('div',{className:'u3-account-toolbar'},h('div',{className:'u2-view-tabs','aria-label':'Filtro de contas'},[{value:'all',label:'Todas as contas'},{value:'attention',label:'Conferir referência'}].map(x=>h('button',{type:'button','aria-pressed':(this.state.accountFocus||'all')===x.value,onClick:()=>this.setState({accountFocus:x.value})},x.label))),h('span',{},'Contadores do histórico carregado · todos os períodos')),
      shown.length?h('div',{className:'bank-account-grid'},shown.map(({account:a,reference,pending,review,count})=>h(Card,{className:'bank-account u3-account-card',key:a.id},
       h('div',{className:'u3-account-card-head'},h('span',{className:'bank-account-icon'},h(Icon,{name:'bank',size:20})),h('div',{},h('h3',{},a.name),h('small',{},u3AccountType(a.subtype))),h('span',{className:'u3-reference-badge is-'+reference.status},reference.label)),
       h('small',{className:'u3-balance-label'},'Saldo informado'),h('strong',{},Number.isFinite(a.balance)?fmt(a.balance):'Saldo não disponível'),h('span',{className:'u3-reference-date'},'Referência recebida: '+bankReferenceLabel(a.updatedAt)),
       h('div',{className:'u3-account-counts'},h('div',{},h('b',{},count),h('small',{},'registros')),h('div',{},h('b',{},pending),h('small',{},'pendentes no banco')),h('div',{},h('b',{},review),h('small',{},'a conferir'))),
       h('button',{type:'button',className:'u3-account-open',onClick:()=>{this.setState({bankFilter:a.id,txSource:'bank',query:'',txSelected:[]});this.navigate('transactions');}},'Abrir movimentações',h(Icon,{name:'arrow',size:15}))))):h('p',{className:'u3-empty'},'Nenhuma conta precisa de conferência de referência.')):
      h(Card,{className:'u3-empty-accounts'},h(Icon,{name:'bank',size:28}),h('h2',{},c.configured?'Sua conexão está configurada':'Vamos conectar suas contas?'),h('p',{},c.configured?'Atualize para receber as contas e seus saldos.':'Configure sua conexão abaixo. Nenhuma senha bancária é solicitada aqui.')),
      h('details',{className:'mf-bank-integrations',open:this.state.bankIntegrationsOpen||!accounts.length,onToggle:(e:any)=>{if(this.state.bankIntegrationsOpen!==e.currentTarget.open)this.setState({bankIntegrationsOpen:e.currentTarget.open});}},h('summary',{},h(Icon,{name:'settings',size:17}),'Conexão e sincronização'),h('div',{className:'bank-grid'},
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
         (b.data.items||[]).map(x=>h('div',{className:'bank-item-info',key:x.itemId},h('b',{},(!x.institution||x.institution==='Meu Pluggy'?'Conta conectada':x.institution)),h('small',{},'Situação: '+(x.status==='UPDATED'?'Atualizada':x.status==='UPDATING'?'Atualizando':x.status==='LOGIN_ERROR'?'Precisa reconectar':'Verifique sua conexão')),h('small',{},'Consentimento: '+(x.consentExpiresAt?new Date(x.consentExpiresAt).toLocaleDateString('pt-BR'):'conforme seu banco'))))))),
     h(Card,{className:'mf-bank-route'},h('div',{},h('h2',{},'Histórico financeiro em um só lugar'),
       h('p',{className:'muted-desc'},'Consulte as transações, revise categorias e veja detalhes em Movimentações. Aqui você gerencia apenas suas conexões e saldos.')),
       h('button',{className:'primary-button',onClick:()=>{this.setState({bankFilter:'',txSource:'bank'});this.navigate('transactions');}},
          'Ver movimentações',h(Icon,{name:'arrow',size:16}))));

 }
 renderSettings(){
 const panels=collectSettingsPanels(this.renderSettingsContent());
 const options=[{id:'appearance',label:'Aparência',icon:'settings'},{id:'profile',label:'Perfil financeiro',icon:'wallet'},
  {id:'data',label:'Dados e recuperação',icon:'folder'},{id:'integrations',label:'Integrações',icon:'bank'},
  {id:'intelligence',label:'Inteligência',icon:'spark'},{id:'demo',label:'Demonstração',icon:'home'}];
 const selected=options.some(x=>x.id===this.state.settingsSection)?this.state.settingsSection:'appearance';
 const appearance=h(Card,{className:'settings-card mf-appearance-card'},h('h2',{},'Aparência'),h('p',{className:'muted-desc'},'Escolha como o Meu Financeiro aparece neste dispositivo.'),
  h('div',{className:'mf-theme-previews','aria-hidden':'true'},h('div',{className:'mf-theme-preview theme-light'},h('i'),h('span'),h('b',{},'Claro')),h('div',{className:'mf-theme-preview theme-dark'},h('i'),h('span'),h('b',{},'Escuro'))),
  this.field('Tema em Configurações',h('select',{className:'form-control','aria-label':'Tema em Configurações','data-appearance':'select',defaultValue:(window as any).MFAppearance?.get()||'system',onChange:(e:any)=>(window as any).MFAppearance?.set(e.target.value)},h('option',{value:'light'},'Claro'),h('option',{value:'dark'},'Escuro'),h('option',{value:'system'},'Acompanhar o sistema'))),
  h('p',{className:'muted-desc'},'A preferência é salva neste dispositivo. No modo automático, acompanha o tema do sistema.'));
 return h('section',{className:'mf-settings-layout'},h('nav',{className:'mf-settings-nav','aria-label':'Assuntos das configurações'},options.map(option=>h('button',{type:'button',key:option.id,'aria-current':selected===option.id?'page':undefined,onClick:()=>this.setState({settingsSection:option.id})},h(Icon,{name:option.icon,size:17}),option.label))),
  h('div',{className:'mf-settings-content',key:selected},selected==='appearance'?appearance:panels[selected]||h(Card,{className:'settings-card'},h('h2',{},'Integrações'),h('p',{className:'muted-desc'},'Abra a versão instalada para gerenciar as integrações disponíveis neste computador.'))));
 }
 renderSettingsContent(){const d=this.state.data;const entries:[keyof Settings,string,string][]=[['opening','Saldo inicial da conta','Saldo no início do acompanhamento.'],['income','Renda mensal prevista','Use um valor conservador, sem depender de ganhos variáveis.'],['fixed','Despesas fixas mensais','Contas recorrentes previstas, sem incluir parcelas abaixo.'],['existing','Parcelas atuais por mês','Somatório de parcelas ainda em aberto.'],['reserve','Reserva mínima protegida','Valor que deve permanecer disponível.']];return h('div',{className:'section'},h('div',{className:'settings-grid'},h(Card,{className:'settings-card','data-settings-group':'profile'},h('div',{className:'card-heading'},h('div',{},h('h2',{},'Seu perfil financeiro'),h('p',{},'Base utilizada nas projeções e recomendações'))),entries.map(([key,title,hint])=>h('div',{className:'setting-row',key},h('div',{},h('b',{},title),h('small',{},hint)),h('button',{className:'setting-edit',onClick:()=>this.setState({editModal:{type:'setting',key,title,value:moneyString(d.settings[key])}})},fmt(d.settings[key]),h(Icon,{name:'edit',size:16}))))),h('div',{className:'settings-right'},
 desktop?h(Card,{className:'settings-card','data-settings-group':'integrations'},
   h('h2',{},'Sincronização na nuvem'),
   h('p',{className:'muted-desc'},
     this.state.cloudPersonalTransferred
       ?'Suas personalizações estão na quarentena protegida da Cloudflare. A etapa bancária e a sincronização automática ainda não estão ativas.'
       :'Clique para iniciar o backup automático e a transferência protegida de suas personalizações. Você confirmará o envio em uma janela do Windows.'),
   h('div',{className:'backups-info'},h(Icon,{name:'shield',size:18}),
     h('div',{},h('b',{},this.state.cloudPersonalTransferred?'Personalizações verificadas na nuvem':'Dados protegidos no Windows'),
       h('small',{},this.state.cloudIdentityConnected?'Login Cloudflare verificado · Sincronização financeira não ativada':'Nuvem financeira: ainda não ativada · Nenhum registro enviado'))),
   h('button',{
     className:'outlined-action full',type:'button',
     disabled:this.state.cloudBusy||this.state.busy||this.state.bankBusy||this.state.mode!=='real'||this.state.cloudPersonalTransferred,
     onClick:()=>void this.prepareCloudOnboarding()
   },h(Icon,{name:'cloud',size:17}),
     this.state.cloudBusy?'Conferindo dados...':this.state.cloudPersonalTransferred?'Personalizações na quarentena':
     'Iniciar migração protegida'),
   this.state.cloudMessage?h('p',{className:'muted-desc',role:'status'},this.state.cloudMessage):null,
   h('div',{className:'privacy-small'},h(Icon,{name:'shield',size:17}),
     'A comparação bancária envia somente requisições de leitura; o extrato local não é enviado.'),
   h('button',{className:'outlined-action full',type:'button',
     disabled:this.state.cloudParityBusy||this.state.busy||this.state.bankBusy||this.state.mode!=='real',
     onClick:()=>void this.auditCloudE1()},
     h(Icon,{name:'shield',size:17}),
     this.state.cloudParityBusy?'Executando E1...':'Executar auditoria E1 · Windows × Cloudflare'),
   this.state.cloudParityMessage?h('p',{className:'muted-desc',role:'status'},
     this.state.cloudParityMessage):null,
   this.state.cloudE1Report?.checks?h('div',{className:'mf-e1-results',role:'status'},
     ...Object.entries(this.state.cloudE1Report.checks).map(([code,check])=>{
       // A resposta da auditoria é externa; verificar o formato antes de ler status.
       const status=check!==null&&typeof check==='object'&&'status' in check?check.status:null;
       return h('div',{className:'mf-e1-result',key:code},
         h('b',{},({'bankIdentities':'IDs bancários','bankDatesAndMoney':'Datas e centavos',
           'bankDescriptionsAndStatuses':'Descrições e status','accountIdentities':'Contas',
           'categoryOriginals':'Categorias originais','snapshotOriginal':'Pacote pessoal original',
           'personalRowCounts':'Contagens pessoais atuais','bankReferences':'Vínculos bancários',
           'stagedAccountIntegrity':'Referências de contas','nominalAccountBalances':'Saldos numéricos',
           'duplicateDismissals':'Duplicatas revisadas','providerHistoryCoverage':'Cobertura histórica',
           'balanceTimestamp':'Data do saldo','effectivePersonalEdits':'Edições sincronizadas',
           'businessRules':'Regras financeiras'} as Record<string,string>)[code]||code),
         h('span',{className:'muted-desc'},status==='verified'?'Verificado':
           status==='mismatch'?'Divergente':'Pendente'));
     })):null,
   this.state.cloudE1Report?.monthDeltas?.ok===true?h('div',{className:'mf-e1-results',role:'status'},
     h('b',{},'Comparação por mês: '+(this.state.cloudE1Report.monthDeltas.totalDifferenceMonths||0)+' mês(es) com diferenças'),
     ...this.state.cloudE1Report.monthDeltas.items.map(month=>
       h('div',{className:'mf-e1-result',key:month.month},
         h('b',{},month.month.slice(5,7)+'/'+month.month.slice(0,4)),
         h('span',{className:'muted-desc'},
           'Windows: '+month.windowsCount+' · Cloudflare: '+month.cloudCount+' · '+
           (month.status==='count_difference'?'quantidades diferentes':
             month.status==='identity_difference'?'IDs diferentes':
             month.status==='amount_or_date_difference'?'datas ou valores diferentes':
             'descrições ou status diferentes')))),
     this.state.cloudE1Report.monthDeltas.limitedResults?
       h('p',{className:'muted-desc'},'Análise mensal limitada; detalhes restantes precisam ser conferidos.') :null
   ):null
 ):null,
 h(Card,{className:'settings-card','data-settings-group':'data'},h('h2',{},'Dados e cópias de segurança'),h('p',{className:'muted-desc'},desktop?(this.state.cloudPersonalTransferred?'Existem personalizações em quarentena protegida na nuvem; a sincronização financeira ainda não foi ativada. A cópia local completa é independente da exportação manual.':'A cópia SQLite completa e a exportação de lançamentos manuais são diferentes. Credenciais bancárias são guardadas separadamente.'):'A exportação de lançamentos manuais não é um backup completo do banco SQLite.'),h('button',{className:'outlined-action full',onClick:()=>this.exportJSON()},h(Icon,{name:'download',size:17}),'Exportar lançamentos manuais'),h('button',{className:'outlined-action full',onClick:()=>this.fileInput?.click()},h(Icon,{name:'upload',size:17}),'Importar lançamentos manuais'),desktop?h('button',{className:'outlined-action full',onClick:()=>this.backupDB()},h(Icon,{name:'download',size:17}),'Salvar cópia completa'):null,desktop?h('button',{className:'outlined-action full',onClick:()=>this.restoreDB()},h(Icon,{name:'upload',size:17}),'Restaurar cópia completa'):null,desktop?h('div',{className:'backups-info'},h(Icon,{name:'shield',size:18}),h('div',{},h('b',{},'Cópias automáticas locais'),h('small',{},this.state.backupInfo.last?'Última cópia: '+new Date(this.state.backupInfo.last).toLocaleString('pt-BR')+' · Até 7 datas preservadas':'Uma cópia por dia em que o app estiver aberto.'))):null,desktop?h('button',{className:'outlined-action full',onClick:()=>this.openBackupsFolder()},h(Icon,{name:'folder',size:17}),'Ver minhas cópias automáticas'):null,desktop?h('button',{className:'outlined-action full',onClick:()=>this.openDataDir()},h(Icon,{name:'bank',size:17}),'Abrir pasta dos meus dados'):null,h('div',{className:'privacy-small'},h(Icon,{name:'shield',size:17}),'Exportar lançamentos manuais não substitui uma cópia completa. Consulte a situação da nuvem acima.')),h('div',{'data-settings-group':'intelligence'},renderIntelligenceSettings(this)),h(Card,{className:'settings-card','data-settings-group':'demo'},h('h2',{},'Modo de demonstração'),h('p',{className:'muted-desc'},'O modo de demonstração tem transações fictícias e armazenamento separado dos seus dados pessoais.'),h('button',{className:'outlined-action full',onClick:()=>this.toggleMode()},this.state.mode==='real'?'Entrar na demonstração':'Voltar aos dados pessoais',h(Icon,{name:'arrow',size:16}))))));
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
       h('div',{className:'mf-drawer-head'},h('div',{},h('small',{className:'micro-label'},'DETALHES'),h('h2',{},'Movimentação')),h('button',{className:'close-button',type:'button','aria-label':'Fechar painel',title:'Fechar',onClick:()=>this.setState({detail:null})},h(Icon,{name:'close',size:18}))),
       h('div',{className:'mf-detail-scroll'},
         h('div',{className:'mf-detail-hero'},h('span',{className:'mf-hero-emoji'},cat?.emoji||'✨'),h('h3',{},name),h('strong',{className:amount>=0?'good-text':'bad-text'},(amount>=0?'+':'−')+fmt(Math.abs(amount))),h('span',{},(tx?.date||manual?.date||'').split('-').reverse().join('/')+' · '+(tx?.accountName||'Adicionado por você'))),
         h('button',{type:'button',className:'mf-ai-detail-trigger',onClick:()=>this.openIntelligenceContext('transactions')},h(Icon,{name:'spark',size:17}),'Analisar com Inteligência',h('span',{},'Prévia')),
         tx?h('div',{className:'mf-detail-section'},h('div',{className:'mf-detail-section-title'},h('b',{},'Organização'),h('span',{className:tx.reviewed?'mf-reviewed':'mf-to-review'},tx.reviewed?'✓ Revisada':'A conferir')),
           h('div',{className:'mf-detail-grid'},
             this.field('Categoria principal',h(StyledSelect,{className:'mf-transaction-category-select',value:tx.category,disabled:this.state.categorySaving.includes(tx.accountId+'|'+tx.id),options:cats.map(c=>({value:c.name,label:c.emoji+' '+c.name})),onChange:(v:string)=>this.setBankCategory(tx,v)})),
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
           f.splitParts.map((part,i)=>h('div',{className:'mf-split-row',key:i},h(StyledSelect,{value:part.category,options:cats.map(c=>({value:c.name,label:c.emoji+' '+c.name})),onChange:(category:string)=>this.setState({detailDraft:{...f,splitParts:f.splitParts.map((v,j)=>i===j?{...v,category}:v)}})}),h('input',{className:'form-control',value:part.value,inputMode:'decimal',placeholder:'0,00',onChange:(e:any)=>this.setState({detailDraft:{...f,splitParts:f.splitParts.map((v,j)=>i===j?{...v,value:e.target.value}:v)}})}),h('button',{className:'mf-small-link',title:'Remover parte',disabled:f.splitParts.length<=2,onClick:()=>this.setState({detailDraft:{...f,splitParts:f.splitParts.filter((_,j)=>j!==i)}})},h(Icon,{name:'close',size:18})))),
           h('div',{className:'mf-detail-split-footer'},h('button',{className:'mf-small-link',disabled:f.splitParts.length>=20,onClick:()=>this.setState({detailDraft:{...f,splitParts:[...f.splitParts,{category:category,value:'0,00'}]}})},'+ Adicionar parte'),h('strong',{className:splitTotal===Math.abs(tx.amount)?'good-text':'bad-text'},fmt(Number.isFinite(splitTotal)?splitTotal:0)+' / '+fmt(Math.abs(tx.amount)))),
           h('div',{className:'mf-action-row'},h('button',{className:'primary-button',disabled:this.state.detailBusy||splitTotal!==Math.abs(tx.amount)||f.splitParts.some(p=>parseMoney(p.value)<=0),onClick:()=>this.saveSplit()},'Salvar divisão'),h('button',{className:'ghost-button',disabled:this.state.detailBusy||!tx.splits?.length,onClick:()=>this.runBankOperation('bankSplit',{accountId:tx.accountId,externalId:tx.id,parts:[]},'Divisão removida.')},'Remover divisão'))):null,
         tx?h('div',{className:'mf-detail-section'},h('b',{},'Conferir com um lançamento seu'),
           tx.linkedManualId?h('div',{className:'mf-suggestion'},h('span',{},'✓ Vinculado a um lançamento que você adicionou'),h('button',{className:'mf-small-link',disabled:this.state.detailBusy,onClick:()=>this.setManualLink(null)},'Desvincular')):
           matchSuggestions.length?matchSuggestions.map(m=>h('div',{className:'mf-suggestion',key:m.id},h('div',{},h('b',{},m.description),h('small',{},m.date.split('-').reverse().join('/')+' · '+fmt(m.amount))),h('button',{className:'ghost-button',disabled:this.state.detailBusy,onClick:()=>this.setManualLink(m.id)},'Vincular'))):h('p',{className:'muted-desc'},'Nenhum lançamento manual com mesmo valor, tipo e data próxima.')):null,
         tx&&opposite.length?h('div',{className:'mf-detail-section'},h('b',{},'Possível transferência entre suas contas'),h('p',{className:'muted-desc'},'Encontramos um valor oposto em outra conta. Confira antes de classificar.'),opposite.map(other=>h('div',{className:'mf-suggestion',key:other.id},h('span',{},other.accountName+' · '+fmt(Math.abs(other.amount))),h('button',{className:'ghost-button',disabled:this.state.detailBusy,onClick:()=>{if(confirm('Marcar ambas como transferência própria?'))this.runBankOperation('bankBatch',{items:[{accountId:tx.accountId,externalId:tx.id},{accountId:other.accountId,externalId:other.id}],nature:'transfer',reviewed:true},'Movimentações marcadas como transferência interna.');}},'Marcar ambas')))):null,
         manual&&this.state.manualDraft?h('div',{className:'mf-detail-section mf-manual-editor'},
           h('b',{},'Editar lançamento manual'),
           h('p',{className:'muted-desc'},'Altere os dados deste lançamento sem modificar os extratos das instituições conectadas.'),
           this.field('Descrição',h('input',{className:'form-control',maxLength:150,value:this.state.manualDraft.description,
             onChange:(e:any)=>this.setState({manualDraft:{...this.state.manualDraft!,description:e.target.value}})})),
           h('div',{className:'mf-detail-grid'},
             this.field('Valor (R$)',h('input',{className:'form-control',inputMode:'decimal',
               value:this.state.manualDraft.value,disabled:this.isManualLinked(manual.id),
               onChange:(e:any)=>this.setState({manualDraft:{...this.state.manualDraft!,value:e.target.value}})})),
             this.field('Data',h(SingleDatePicker,{value:this.state.manualDraft.date,
               disabled:this.isManualLinked(manual.id),
               onChange:(value:string)=>this.setState({manualDraft:{...this.state.manualDraft!,date:value}})}))),
           this.field('Categoria do lançamento',h(StyledSelect,{
             className:'mf-transaction-category-select',value:this.state.manualDraft.category,
             options:cats.filter(c=>manual.kind==='income'?c.kind!=='expense':c.kind!=='income')
               .map(c=>({value:c.name,label:c.emoji+' '+c.name})),
             onChange:(v:string)=>this.setState({manualDraft:{...this.state.manualDraft!,category:v}})})),
           this.isManualLinked(manual.id)?h('p',{className:'mf-manual-warning'},
             'Lançamento vinculado a uma movimentação bancária: desvincule antes de alterar data, valor ou excluir.'):null,
           h('div',{className:'mf-manual-actions'},
             h('button',{type:'button',className:'primary-button',disabled:this.state.busy,
               onClick:()=>this.saveManualDetail(manual.id)},h(Icon,{name:'check',size:16}),'Salvar alterações'),
             h('button',{type:'button',className:'ghost-button',disabled:this.state.busy,
               onClick:()=>this.setState({manualDraft:{description:manual.description,date:manual.date,
                value:moneyString(manual.amount),category:manual.category}})},'Cancelar alterações'),
             h('button',{type:'button',className:'ghost-button mf-danger-action',
               disabled:this.state.busy||this.isManualLinked(manual.id),
               onClick:()=>this.removeEntry(manual.id)},'Excluir lançamento'))):null,
         tx?h('div',{className:'mf-detail-section mf-raw-details'},h('b',{},'Detalhes originais'),h('p',{},tx.description),h('small',{},'Identificador de referência disponível apenas neste computador.')):null
       )));
 }
 renderEditModal(){const item=this.state.editModal;if(!item)return null;return h('div',{className:'modal-backdrop '+(item.type==='budget'?'mf-budget-edit-backdrop':''),onMouseDown:(e:any)=>{if(e.target===e.currentTarget)this.setState({editModal:null});}},h('div',{className:'modal small-modal '+(item.type==='budget'?'mf-budget-editor':''),role:'dialog','aria-modal':'true','aria-label':item.type==='budget'?'Editar limite da categoria':'Editar valor'},h('div',{className:'modal-head'},h('div',{},h('small',{className:'micro-label'},'PERSONALIZAÇÃO'),h('h2',{},item.title)),h('button',{className:'close-button',type:'button','aria-label':'Fechar painel',onClick:()=>this.setState({editModal:null})},h(Icon,{name:'close',size:18}))),this.field(item.type==='budget'?'Limite da categoria (R$)':'Valor (R$)',h('input',{className:'form-control',value:item.value,inputMode:'decimal',autoFocus:true,placeholder:item.type==='budget'?'Ex.: 150,00':'0,00',onChange:(e:any)=>this.setState({editModal:{...item,value:e.target.value}})}),item.type==='budget'?'Limite vinculado à categoria, não exclusivo do mês exibido. Em branco remove o limite; R$ 0,00 mantém zero explícito.':undefined),h('div',{className:'modal-actions'},h('button',{className:'ghost-button',onClick:()=>this.setState({editModal:null})},'Cancelar'),h('button',{className:'primary-button',disabled:this.state.busy,onClick:async()=>{const saved=item.type==='budget'?await this.setBudget(item.key,item.value):await this.setSetting(item.key as keyof Settings,item.value);if(saved)this.setState({editModal:null});}},h(Icon,{name:'check',size:18}),'Salvar alteração'))));}
 renderEntryModal(){const f=this.state.entry;return h('div',{className:'modal-backdrop',onMouseDown:(e:any)=>{if(e.target===e.currentTarget)this.setState({showEntry:false});}},h('div',{className:'modal',role:'dialog','aria-modal':'true','aria-label':'Registrar movimentação'},h('div',{className:'modal-head'},h('div',{},h('small',{className:'micro-label'},'NOVO LANÇAMENTO'),h('h2',{},'Registrar movimentação')),h('button',{className:'close-button',type:'button','aria-label':'Fechar painel',onClick:()=>this.setState({showEntry:false})},h(Icon,{name:'close',size:18}))),h('div',{className:'segmented'},['expense','income'].map(k=>h('button',{key:k,className:f.kind===k?'selected':'',onClick:()=>this.setState({entry:{...f,kind:k as Kind,category:this.state.entryCategoryTouched&&this.getCategories().some(c=>c.name===f.category&&(k==='income'?c.kind!=='expense':c.kind!=='income'))?f.category:k==='income'?'Salário':'Outros'}})},k==='expense'?'Despesa':'Receita'))),this.field('Descrição',h('input',{className:'form-control',placeholder:'Ex.: supermercado',value:f.description,maxLength:150,onChange:(e:any)=>{const description=e.target.value;const category=this.state.entryCategoryTouched?f.category:(findCategoryRule(description,'manual',this.state.rules)||'Outros');this.setState({entry:{...f,description,category}});}})),h('div',{className:'two-inputs'},this.field('Valor (R$)',h('input',{className:'form-control',placeholder:'0,00',inputMode:'decimal',value:f.value,onChange:(e:any)=>this.setState({entry:{...f,value:e.target.value}})})),this.field('Data',h(SingleDatePicker,{value:f.date,onChange:(value:string)=>this.setState({entry:{...f,date:value}})}))),this.field('Categoria',h(StyledSelect,{className:'form-control',value:f.category,options:this.getCategories().filter(c=>f.kind==='income'?c.kind!=='expense':c.kind!=='income').map(c=>({value:c.name,label:(c.emoji||'✨')+'  '+c.name})),onChange:(value:string)=>this.setState({entry:{...f,category:value},entryCategoryTouched:true})})),this.state.mode==='real'?h('button',{type:'button',className:'mf-new-category',onClick:()=>this.openContextCategory('entry')},'+ Nova categoria'):null,h('div',{className:'modal-actions'},h('button',{className:'ghost-button',onClick:()=>this.setState({showEntry:false})},'Cancelar'),h('button',{className:'primary-button',onClick:()=>this.saveEntry()},h(Icon,{name:'check',size:18}),'Salvar lançamento'))));}
 render(){if(this.state.fatal)return h('main',{className:'startup-error'},h('h1',{},'Não foi possível abrir seus dados'),h('p',{},this.state.fatal),h('p',{},'Se houver arquivos importantes, não desinstale a versão anterior nem apague a pasta de dados.'));if(this.state.booting&&desktop)return h('main',{className:'startup-error'},h('h1',{},'Meu Financeiro'),h('p',{},'Preparando seus dados…'));return h('div',{className:'shell'},this.renderSide(),h('main',{className:'main-area '+(this.state.page==='overview'?'u1-shell':['transactions','planning'].includes(this.state.page)?'u2-shell':['budgets','banks','assistant'].includes(this.state.page)?'u3-shell':'')},this.renderWorkspaceBar(),this.renderTop(),this.state.mode==='demo'?h('div',{className:'demo-strip'},h(Icon,{name:'spark',size:17}),'Você está explorando dados fictícios. Nada aqui altera suas finanças pessoais.',h('button',{onClick:()=>this.toggleMode()},'Sair da demonstração')):null,({overview:this.renderOverview,planning:this.renderPlanning,transactions:this.renderMovements,budgets:this.renderBudgets,banks:this.renderBanks,categories:this.renderCategories,assistant:this.renderAssistant,settings:this.renderSettings,intelligence:()=>renderIntelligenceView(this)}[this.state.page]||this.renderOverview).call(this),h('footer',{className:'footer'},h('span',{},desktop?'Meu Financeiro v0.9.5-beta.8 · Interface U3 · Feito para você':'Meu Financeiro v0.9.5-beta.8 · Interface U3 · Feito para você'),h('span',{},this.state.cloudPersonalTransferred?'Personalizações em revisão na nuvem':'Fonte local · integração sob autorização'))),this.state.toast?h('div',{className:'toast'},h(Icon,{name:'check',size:17}),this.state.toast):null,this.state.showEntry&&!this.state.contextCategory?this.renderEntryModal():null,this.state.editModal?this.renderEditModal():null,this.state.detail?this.renderDetailDrawer():null,this.state.quickCategory&&!this.state.contextCategory?this.renderQuickCategoryPopover():null,this.state.contextCategory?this.renderContextCategory():null,this.state.planOpen?this.renderPlanModal():null,this.state.planSelected?this.renderPlanDetail():null,renderIntelligencePanel(this),!this.state.intelligencePanelOpen&&!this.state.showEntry&&!this.state.editModal&&!this.state.detail&&!this.state.planOpen&&!this.state.planSelected?h('button',{type:'button',className:'mf-ai-fab','aria-label':'Perguntar à IA sobre esta página',title:'Perguntar à IA sobre esta página',onClick:()=>this.openIntelligenceContext()},h(Icon,{name:'spark',size:24})):null,h('input',{type:'file',accept:'.json,application/json',style:{display:'none'},ref:(e:any)=>this.fileInput=e,onChange:(e:any)=>{if(e.target.files?.[0])this.importJSON(e.target.files[0]);e.target.value='';}}),h('input',{type:'file',accept:'.csv,text/csv',style:{display:'none'},ref:(e:any)=>this.csvInput=e,onChange:(e:any)=>{if(e.target.files?.[0])this.importCSV(e.target.files[0]);e.target.value='';}}));}
}
function splitCSV(line:string,separator:string){const result:string[]=[];let current='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){current+='"';i++;}else quoted=!quoted;}else if(ch===separator&&!quoted){result.push(current);current='';}else current+=ch;}result.push(current);return result;}
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
ReactDOM.render(h(App,{}),document.getElementById('app'));
