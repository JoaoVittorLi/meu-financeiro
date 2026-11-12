'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),engine=require('../shared/finance-period-ledger.mjs');
function load(source){const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2019}}).outputText;return new Function('FinancePeriodLedger',js+';return intelligenceBuildStructuredSummaryCard;')(engine);}
const base='ce8dd04669a474957dc2d6c1107bc91d862031fc';
const before=load(execFileSync('git',['show',base+':src/intelligence-integration.ts'],{cwd:root,encoding:'utf8'}));
const after=load(fs.readFileSync(path.join(root,'src/intelligence-integration.ts'),'utf8'));
const transaction={date:'2026-11-10',amount:-10000,category:'Compras',status:'POSTED',nature:'expense',splits:[{category:'Alimentação',amount:6000},{category:'Transporte',amount:4000}]};
const app={state:{mode:'real',dashboardSource:'bank',bank:{data:{transactions:[transaction]}},data:{transactions:[]}}};
const oldCard=before(app),card=after(app);
assert.equal(card.rows.length,2);assert.equal(card.rows[0].col1,'Alimentação');assert.equal(card.rows[1].col1,'Transporte');assert.equal(card.metrics[1].value,oldCard.metrics[1].value);
const output=JSON.stringify({case:'WORK-AUDIT-01',base,environment:'Windows local, Node 22.23.4',before:oldCard.rows,after:card.rows,total:card.metrics[1].value,result:'PASS',personalDataAccessed:false},null,2);
if(process.argv[2])fs.writeFileSync(process.argv[2],output+'\n');
console.log(output);
