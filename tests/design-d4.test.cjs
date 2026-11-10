'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/intelligence-view.ts'),'utf8');
const start=source.indexOf('const INTELLIGENCE_CONTEXTS'),end=source.indexOf('function intelligencePrepare(',start);
const js=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const api=new Function('prettyMonth','dateSpan','spanLabel',js+';return {intelligencePageScope,intelligenceNextTab,intelligenceContextFor};')(month=>month,(_m,start,end)=>({start,end}),(_m,span)=>span.start+' a '+span.end);
test('context uses the current planning/budget month instead of the unrelated bank period',()=>{
 const state={page:'planning',planMonth:'2027-01',month:'2026-12',mode:'real',customStart:'2026-11-01',customEnd:'2026-11-30'};
 assert.equal(api.intelligencePageScope({state},'planning').period,'2027-01');assert.equal(api.intelligencePageScope({state},'budgets').period,'2026-12');assert.equal(api.intelligencePageScope({state},'settings').period,'Sem filtro de período');assert.equal(api.intelligenceContextFor('settings').label,'Configurações');
});
test('context captures filter descriptions by value and excludes unrelated financial data and secrets',()=>{
 const state={page:'transactions',mode:'real',query:'Mercado',bankFilter:'account',txSelected:['a','b'],txReviewOnly:true,bankForm:{clientSecret:'do-not-include'},data:{transactions:[{description:'private-ledger'}]}};
 const scope=api.intelligencePageScope({state});state.query='Outro';state.txSelected.push('c');assert.deepEqual(scope.filters,['Busca: Mercado','Conta filtrada','A revisar','2 selecionada(s)']);assert.equal(scope.period,'Todos os períodos');assert.ok(!JSON.stringify(scope).includes('do-not-include'));assert.ok(!JSON.stringify(scope).includes('private-ledger'));
});
test('intelligence keyboard tabs wrap and support Home/End without intercepting unrelated keys',()=>{
 assert.equal(api.intelligenceNextTab('today','ArrowLeft'),'actions');assert.equal(api.intelligenceNextTab('actions','ArrowRight'),'today');assert.equal(api.intelligenceNextTab('chat','Home'),'today');assert.equal(api.intelligenceNextTab('chat','End'),'actions');assert.equal(api.intelligenceNextTab('chat','Enter'),null);
});
