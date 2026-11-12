'use strict';
// Executes the current summary against an invented split; no disk financial DB.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
async function audit(){
 const root=path.resolve(__dirname,'..');
 const input=fs.readFileSync(path.join(root,'src/intelligence-integration.ts'),'utf8');
 const compiled=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2020}}).outputText;
 const engine=await import('../shared/finance-period-ledger.mjs');
 const summarize=new Function('FinancePeriodLedger',compiled+';return intelligenceBuildStructuredSummaryCard;')(engine);
 const {aggregateFinancePeriod}=engine;
 const split=[{category:'Alimentação',amount:6000},{category:'Transporte',amount:4000}];
 const transaction={id:'synthetic-split',accountId:'synthetic-account',date:'2026-11-10',status:'POSTED',amount:-10000,category:'Compras',nature:'expense',splits:split};
 const card=summarize({state:{mode:'real',dashboardSource:'bank',bank:{data:{transactions:[transaction]}},data:{transactions:[]}}});
 const ledger=aggregateFinancePeriod([{...transaction,amountCents:transaction.amount,splits:split.map(p=>({category:p.category,amountCents:p.amount}))}],{start:'2026-11-01',end:'2026-11-30',source:'bank'});
 const actual=card.rows.map(r=>r.col1),expected=ledger.expenses.map(r=>r.name);
 assert.equal(ledger.expenseCents,10000);assert.equal(card.metrics[1].value.includes('100,00'),true);
 assert.deepEqual(actual,expected,'Summary category distribution differs from canonical ledger');
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
 assert.deepEqual(card.rows.map(r=>r.col3),ledger.expenses.map(r=>money(r.amountCents)),'Split values differ');
 assert.equal(card.metrics[2].value,'1','Split must not multiply transaction count');
 const report={id:'WORK-AUDIT-01',classification:'CONFIRMADO EM TESTE LOCAL',environment:process.platform+' '+process.version+'; TypeScript real; dados inventados',
 finding:'RESOLVED: resumo respeita divisão canônica de despesas',result:'PASS',resolved:true,
 input:{amountCents:-10000,category:'Compras',splits:split},actualCategories:actual,expectedCategories:expected,
 totalsMatch:true,applicationWindowsTested:false,financialDataChanged:false};
 console.log(JSON.stringify(report,null,2));return report;
}
if(require.main===module)audit().then(report=>{if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={audit};
