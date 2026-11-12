'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const src=fs.readFileSync('src/app.ts','utf8');const a=src.indexOf(" openOverviewTransactions(kind:"),b=src.indexOf(' renderOverview(){',a);
const Subject=new Function(ts.transpileModule('class Subject{'+src.slice(a,b)+'}',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText+';return Subject')();
function app(source='bank',mode='real'){const a=new Subject();a.state={mode,dashboardSource:source,bank:{data:{accounts:[{id:'synthetic'}]}},query:'old',bankFilter:'other',txSelected:['other|id'],txCategoryFilter:'stale',txReviewFilter:'reviewed'};a.setState=p=>Object.assign(a.state,p);a.navigate=p=>a.destination=p;return a;}
test('R5 metric drilldown respects source, clears stale selection/account/category and applies requested nature',()=>{
 const a=app();a.openOverviewTransactions('expense');assert.equal(a.destination,'transactions');assert.equal(a.state.txSource,'bank');assert.equal(a.state.txKindFilter,'expense');assert.equal(a.state.query,'');assert.equal(a.state.bankFilter,'');assert.deepEqual(a.state.txSelected,[]);assert.equal(a.state.txCategoryFilter,'');assert.equal(a.state.txReviewFilter,'all');
});
test('R5 pending drilldown remains bank scoped and demo/manual cannot inherit bank data',()=>{
 const a=app();a.openOverviewTransactions('all',true);assert.equal(a.state.txReviewFilter,'pending');
 for(const [source,mode] of [['manual','real'],['bank','demo']]){const a=app(source,mode);a.openOverviewTransactions();assert.equal(a.state.txSource,'manual');assert.equal(a.state.bankFilter,'');}
});
