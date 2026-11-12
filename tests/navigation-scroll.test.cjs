'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('navigation resets the actual scroll container after state commit only when the destination changes',()=>{
 const source=fs.readFileSync('src/app.ts','utf8'),start=source.indexOf(' navigate(page:string){'),end=source.indexOf('\n setSharedPeriod(',start);
 assert(start>0&&end>start);const calls=[];
 const context=vm.createContext({document:{scrollingElement:{scrollTo:options=>calls.push({page:app.state.page,...options})}},dateSpan:()=>({start:'2026-11-01',end:'2026-11-30'}),nowYM:'2026-11',shiftMonth:()=> '2027-11',iso:()=> '2026-11-12',intelligenceRefresh:()=>{},desktop:null});
 vm.runInContext(ts.transpile('class NavigationHarness {'+source.slice(start,end)+'}\nthis.NavigationHarness=NavigationHarness',{target:ts.ScriptTarget.ES2020}),context);
 const app=new context.NavigationHarness();app.state={page:'budgets',overviewPeriod:'month',month:'2026-11'};app.simRequest=0;app.setState=(patch,callback)=>{Object.assign(app.state,patch);callback();};
 app.navigate('simulator');assert.equal(app.state.page,'assistant');assert.equal(calls.length,1);assert.equal(calls[0].page,'assistant');assert.equal(calls[0].top,0);assert.equal(calls[0].behavior,'instant');
 app.navigate('assistant');assert.equal(calls.length,1);
 app.navigate('categories');assert.equal(app.state.page,'transactions');assert.equal(app.state.txOrganize,true);assert.equal(calls.length,2);
});
