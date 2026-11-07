'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const file=fs.readFileSync(path.join(__dirname,'../app/app.js'),'utf8');
const code=file.replace(/ReactDOM\.render\(h\(App, \{\}\), document\.getElementById\('app'\)\);?\s*$/,'');
const context={window:{financeDesktop:null},React:{Component:class{},createElement:()=>({})},ReactDOM:{},localStorage:{getItem:()=>null},console,Date,Intl,Map,Set,Math,Number,String,Array,Object,RegExp};
vm.runInNewContext(code+'\n;globalThis.__helpers={dateSpan,spanLabel,daysInSpan,advanceDate,snapshotBetween,bankSnapshotBetween,flowSegments};',context);
const {dateSpan,spanLabel,daysInSpan,advanceDate,snapshotBetween,bankSnapshotBetween,flowSegments}=context.__helpers;
const reference='2026-11-06';
test('períodos rápidos sempre incluem a data de hoje e usam calendário local',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(dateSpan('week','','',reference))),{start:'2026-11-02',end:'2026-11-06'});
 assert.deepEqual(JSON.parse(JSON.stringify(dateSpan('15d','','',reference))),{start:'2026-10-23',end:'2026-11-06'});
 assert.deepEqual(JSON.parse(JSON.stringify(dateSpan('month','','',reference))),{start:'2026-11-01',end:'2026-11-06'});
 assert.deepEqual(JSON.parse(JSON.stringify(dateSpan('lastmonth','','',reference))),{start:'2026-10-01',end:'2026-10-31'});
});
test('intervalos personalizados inclusivos e inválidos retornam fallback seguro',()=>{
 const valid=dateSpan('custom','2026-09-30','2026-11-03',reference);
 assert.equal(valid.start,'2026-09-30');assert.equal(valid.end,'2026-11-03');
 assert.match(spanLabel('custom',valid),/30\/09\/2026/);
 assert.equal(daysInSpan('2026-10-31','2026-11-02'),3);
 assert.equal(advanceDate('2026-10-31',1),'2026-11-01');
 assert.equal(dateSpan('custom','2026-11-09','2026-11-05',reference).start,'2026-11-01');
 assert.equal(dateSpan('custom','2026-02-30','2026-03-01',reference).start,'2026-11-01');
});
test('totais por intervalo não misturam origens e excluem pendências bancárias',()=>{
 const manual={transactions:[{date:'2026-11-01',kind:'expense',amount:1500,category:'Alimentação'},{date:'2026-11-06',kind:'income',amount:5000,category:'Outros'},{date:'2026-10-31',kind:'expense',amount:1000,category:'Alimentação'}],settings:{opening:0}};
 const bank={data:{accounts:[{balance:50000}],transactions:[{date:'2026-11-05',status:'POSTED',amount:-3500,category:'Delivery'},{date:'2026-11-06',status:'PENDING',amount:-1500,category:'Delivery'},{date:'2026-11-02',status:'POSTED',amount:7000,category:'Salário'},{date:'2026-10-25',status:'POSTED',amount:-4000,category:'Delivery'}]}};
 const m=snapshotBetween(manual,'2026-11-01','2026-11-06');
 const b=bankSnapshotBetween(bank,'2026-11-01','2026-11-06');
 assert.equal(m.income,5000);assert.equal(m.expense,1500);assert.equal(m.balance,2500);
 assert.equal(b.income,7000);assert.equal(b.expense,3500);assert.equal(b.balance,50000);assert.equal(b.categories[0].name,'Delivery');
 const chart=flowSegments('2026-11-01','2026-11-06',(a,b)=>bankSnapshotBetween(bank,a,b));
 assert.equal(chart.reduce((v,x)=>v+x.expense,0),3500);
 assert.equal(chart.reduce((v,x)=>v+x.income,0),7000);
 assert.equal(chart.length,6);
});
test('UI não usa seletores ou calendário nativos Windows',()=>{
 assert(!file.includes('document.createElement(\'select\')'));
 assert(!file.includes('type: "month"'));
 assert(file.includes('class PeriodPicker'));
 assert(file.includes('class StyledSelect'));
});
test('transferências e valores desconsiderados não entram nas receitas ou despesas; divisão preserva totais',()=>{
 const sample={data:{accounts:[{balance:50000}],transactions:[
  {date:'2026-11-06',amount:-18000,status:'POSTED',category:'Alimentação',splits:[{category:'Alimentação',amount:14000},{category:'Contas',amount:4000}],nature:'auto'},
  {date:'2026-11-06',amount:18000,status:'POSTED',category:'Outros',nature:'transfer'},
  {date:'2026-11-06',amount:-1000,status:'POSTED',category:'Outros',nature:'ignore'},
  {date:'2026-11-06',amount:262500,status:'POSTED',category:'Salário',nature:'income'},
  {date:'2026-11-06',amount:-7000,status:'PENDING',category:'Alimentação',nature:'auto'}
 ]}};
 const result=bankSnapshotBetween(sample,'2026-11-01','2026-11-30');
 assert.equal(result.income,262500);assert.equal(result.expense,18000);
 assert.equal(result.categories.find(x=>x.name==='Alimentação').total,14000);
 assert.equal(result.categories.find(x=>x.name==='Contas').total,4000);
 assert.equal(result.balance,50000);
});
