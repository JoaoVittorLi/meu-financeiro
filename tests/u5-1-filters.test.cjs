'use strict';
// Actual TypeScript filtering function, transpiled in-process with the project toolchain.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const src=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
function cut(begin,end){
 const a=src.indexOf(begin),b=src.indexOf(end,a+begin.length);
 assert(a>=0&&b>a,'Missing production function '+begin);return src.slice(a,b);
}
function evaluate(source,name,bindings={}){
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
 return new Function(...Object.keys(bindings),js+';return '+name+';')(...Object.values(bindings));
}
const fold=evaluate(cut('function fold(value:string)', 'function findCategoryRule('),'fold');
const effectiveNature=evaluate(cut('function effectiveNature(t:BankTx)', 'function transactionViewRows('),'effectiveNature');
const dateSpan=(_mode,start,end)=>({start,end});
const rows=evaluate(cut('function transactionViewRows(state:State)', 'function transactionViewSummary('),
 'transactionViewRows',{fold,effectiveNature,dateSpan});
const a={id:'shared',accountId:'account-A',accountName:'Conta A',date:'2026-11-10',
 description:'Café original',merchant:'Café A',customTitle:'',category:'Alimentação',amount:-1256,status:'POSTED',reviewed:false};
const b={...a,accountId:'account-B',accountName:'Conta B',description:'Posto original',merchant:'Posto B',
 category:'Transporte',amount:-5500,reviewed:true};
const income={...a,id:'salary',date:'2026-11-12',description:'Salário sintético',
 merchant:'Empresa B',category:'Salário',amount:250000,reviewed:false};
const manual={id:'shared',date:'2026-11-11',description:'Supermercado pessoal',
 category:'Alimentação',kind:'expense',amount:2450,origin:'manual'};
const outside={...manual,id:'older',date:'2026-10-03'};
function fixture(patch={}){
 return {mode:'real',data:{transactions:[manual,outside]},bank:{data:{transactions:[a,b,income],accounts:[]}},
 query:'',bankFilter:'',txSource:'all',txReviewOnly:false,txCategoryFilter:'',
 txKindFilter:'all',txReviewFilter:'all',txSort:'date_desc',
 overviewPeriod:'custom',customStart:'2026-11-01',customEnd:'2026-11-30',...patch};
}
test('U5.1 — fontes manual/bancárias e mesmo externalId em duas contas não colidem',()=>{
 const state=fixture(),before=JSON.stringify(state),found=rows(state);
 assert.equal(found.length,4);assert.equal(new Set(found.map(r=>r.key)).size,4);
 assert(found.some(r=>r.key==='account-A|shared'));
 assert(found.some(r=>r.key==='account-B|shared'));
 assert(found.some(r=>r.key==='manual|shared'));
 assert.equal(JSON.stringify(state),before,'Filtering must not write back');
});
test('U5.1 — pesquisa abrange estabelecimento e mantém acentos equivalentes',()=>{
 assert.deepEqual(rows(fixture({query:'cafe a'})).map(r=>r.key),['account-A|shared']);
 assert.deepEqual(rows(fixture({query:'supermercado'})).map(r=>r.key),['manual|shared']);
 assert.deepEqual(rows(fixture({query:'conta b'})).map(r=>r.key),['account-B|shared']);
});
test('U5.1 — filtros combinados categoria, banco, receita/despesa, revisão são interseção',()=>{
 assert.deepEqual(rows(fixture({txCategoryFilter:'Transporte',bankFilter:'account-B',
  txSource:'bank',txKindFilter:'expense',txReviewFilter:'reviewed'})).map(r=>r.key),['account-B|shared']);
 assert.equal(rows(fixture({txCategoryFilter:'Transporte',bankFilter:'account-A',
  txSource:'bank',txKindFilter:'expense'})).length,0);
 assert.deepEqual(rows(fixture({txSource:'manual',txCategoryFilter:'Alimentação',
  txKindFilter:'expense'})).map(r=>r.key),['manual|shared']);
});
test('U5.1 — revisão filtra apenas banco não revisado em qualquer período',()=>{
 const s=fixture({txReviewOnly:true,query:'',txSource:'manual',customStart:'2026-11-20',
   customEnd:'2026-11-30',txReviewFilter:'reviewed'});
 const found=rows(s);
 assert.equal(found.length,2);
 assert(found.every(x=>x.origin==='bank'&&x.raw.reviewed===false));
 assert(!found.some(x=>x.key==='account-B|shared'));
});
test('U5.1 — ordenação por valor absoluto e data preserva estabilidade de identidade',()=>{
 const x=fixture();
 assert.deepEqual(rows({...x,txSort:'amount_desc'}).map(r=>r.key),
  ['account-A|salary','account-B|shared','manual|shared','account-A|shared']);
 assert.deepEqual(rows({...x,txSort:'amount_asc'}).map(r=>r.key),
  ['account-A|shared','manual|shared','account-B|shared','account-A|salary']);
 assert.deepEqual(rows({...x,txSort:'date_asc'}).map(r=>r.key),
  ['account-A|shared','account-B|shared','manual|shared','account-A|salary']);
});
test('U5.1 — nenhuma origem altera a semântica receita/despesa por natureza bancária',()=>{
 const transfer={...a,id:'internal',nature:'transfer',category:'Transferências'};
 const s=fixture({bank:{data:{transactions:[a,transfer],accounts:[]}},data:{transactions:[]}});
 const expense=rows({...s,txKindFilter:'expense'});
 assert.deepEqual(expense.map(r=>r.key),['account-A|shared']);
 assert.equal(rows({...s,txKindFilter:'income'}).length,0);
});
