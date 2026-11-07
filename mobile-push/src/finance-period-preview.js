// Source-separated, read-only cashflow summaries for the protected PWA Preview.
// Reuses the same period formula family as the desktop; not a certified cutover.
import {aggregateFinancePeriod,cashflowBuckets,budgetProgress} from '../../shared/finance-period-ledger.mjs';
import {personalizeBankRows} from './finance-bank-personalized.js';
import {mergePersonalOverlays} from './finance-personal-edits.js';
import {ensureBankStaging} from './finance-bank-ingestion.js';

function verifiedId(sql){
 const table=sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='mf_transfer_session'").toArray();
 if(!table.length)return null;
 return sql.exec("SELECT import_id FROM mf_transfer_session WHERE state='verified' ORDER BY created_at DESC LIMIT 1").toArray()[0]?.import_id||null;
}
function imported(sql,id,table){
 if(!id)return [];
 return sql.exec("SELECT row_json FROM mf_transfer_rows WHERE import_id=? AND table_name=? ORDER BY ordinal",id,table)
   .toArray().map(x=>JSON.parse(x.row_json));
}
function monthEnd(month){
 const [y,m]=month.split('-').map(Number);
 if(!Number.isInteger(y)||!Number.isInteger(m)||m<1||m>12)throw new Error('Mês inválido.');
 return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
}
export function readFinancePreviewPeriod(storage,{start,end,source='bank'}={}){
 if(source!=='bank'&&source!=='manual')throw new Error('Fonte inválida.');
 // Validate every date and the maximum range before touching the database.
 aggregateFinancePeriod([],{start,end,source});
 const sql=storage.sql,id=verifiedId(sql);
 let rows;
 if(source==='bank'){
   ensureBankStaging(storage);
   const raw=sql.exec(
     'SELECT account_id,external_id,date,description,amount_cents,status '+
     'FROM mf_bank_staging_transactions ORDER BY date,account_id,external_id'
   ).toArray();
   rows=personalizeBankRows(storage,raw);
 }else{
   rows=imported(sql,id,'transactions')
     .filter(row=>row.profile==='real')
     .map(row=>({date:row.date,kind:row.kind,
       amountCents:row.amount_cents,category:row.category}));
 }
 const period=aggregateFinancePeriod(rows,{start,end,source});
 const month=end.slice(0,7),monthStart=month+'-01',monthFinish=monthEnd(month);
 const monthly=aggregateFinancePeriod(rows,{start:monthStart,end:monthFinish,source});
 const budgetRows=mergePersonalOverlays(storage,'budgets',imported(sql,id,'budgets'))
   .filter(row=>row.profile==='real')
   .map(row=>({category:row.category,amountCents:row.amount_cents}));
 const categories=imported(sql,id,'categories');
 const typeByName=new Map(categories.map(row=>[row.name,row.kind]));
 const expenseBudgets=budgetRows.filter(row=>typeByName.get(row.category)!=='income');
 const budgets=budgetProgress(expenseBudgets,monthly.expenses);
 return {ok:true,stage:'preview_cashflow_readonly',
   source,period:{start,end},budgetMonth:month,
   available:source==='bank'?rows.length>0:!!id,
   verifiedPersonalImport:!!id,
   transactionsIncluded:period.transactionsIncluded,
   excluded:period.excluded,
   incomeCents:period.incomeCents,expenseCents:period.expenseCents,
   netCents:period.netCents,
   unclassifiedCents:period.unclassifiedCents,
   categoryCoverageComplete:period.categoryCoverageComplete,
   flow:cashflowBuckets(period.daily,start,end),
   expenseCategories:period.expenses,
   incomeCategories:period.incomes,
   budgets,
   budgetCategoryCoverageComplete:monthly.categoryCoverageComplete,
   // The institution's raw category and bank balance timestamp aren't
   // staged yet, so never treat these summaries as fully reconciled.
   bankProviderCategoriesVerified:false,balanceVerified:false,
   historicalCompletenessVerified:false,
   forecastVerified:false,
   financialSyncEnabled:false,cloudCutoverAllowed:false};
}
