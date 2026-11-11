'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
function between(begin,end){
 const a=src.indexOf(begin),b=src.indexOf(end,a+begin.length);
 assert(a>=0&&b>a,'D1.5: required method not found: '+begin);
 return src.slice(a,b);
}
const methods=[
 between(' isManualLinked(id:string):boolean{',' openCategoryFromRow(')
   .replace('isManualLinked(id:string):boolean','isManualLinked(id)')
   .replace('async saveManualDetail(id:string)','async saveManualDetail(id)'),
 between(' async removeEntry(id:string){',' async setBudget(')
   .replace('async removeEntry(id:string)','async removeEntry(id)')
].join('\n');
const parse=between('function parseMoney(v:string):number','function shiftMonth')
 .replace('parseMoney(v:string):number','parseMoney(v)')
 .replace('parsePositiveBRLInput(value:string):number','parsePositiveBRLInput(value)')
 .replace('iso(d:Date):string','iso(d)');
const from=between('function fromISO(value:string):Date','function advanceDate')
 .replace('fromISO(value:string):Date','fromISO(value)');
const build=new Function('confirm',parse+'\n'+from+'\nreturn class D15ManualEditor{'+methods+'}');
function subject({linked=false,fail=false,approved=true}={}){
 const approve={calls:0},C=build(()=>{approve.calls++;return approved;});
 const original={id:'manual-1',date:'2026-11-10',description:'Mercado',kind:'expense',amount:12560,category:'Alimentação',origin:'manual'};
 const other={id:'manual-2',date:'2026-11-09',description:'Salário',kind:'income',amount:200000,category:'Salário',origin:'manual'};
 const s=new C(),writes=[],messages=[];
 s.state={detail:{origin:'manual',id:original.id},busy:false,bank:{data:{transactions:linked?[{accountId:'bank-a',id:'original-1',linkedManualId:original.id,amount:-12560}]:[]}},
  data:{version:1,transactions:[original,other],settings:{},budgets:{}},
  manualDraft:{description:original.description,date:original.date,value:'125,60',category:original.category}};
 s.writeInProgress=false;
 s.flash=m=>messages.push(m);
 s.setState=patch=>Object.assign(s.state,patch);
 s.getCategories=()=>[{name:'Alimentação',kind:'expense'},{name:'Transporte',kind:'expense'},{name:'Salário',kind:'income'}];
 s.updateData=async d=>{writes.push(d);if(fail)return false;s.state.data=d;return true};
 return {s,original,other,writes,messages,approve};
}
test('D1.5 — editar descrição, data, valor em centavos e categoria preserva ID e outros registros',async()=>{
 const {s,original,other,writes}=subject();
 s.state.manualDraft={description:'  Mercado Central  ',date:'2026-11-11',value:'230,75',category:'Transporte'};
 assert.equal(await s.saveManualDetail(original.id),true);
 assert.equal(writes.length,1);
 assert.deepEqual(writes[0].transactions,[{...original,description:'Mercado Central',date:'2026-11-11',amount:23075,category:'Transporte'},other]);
 assert.equal(s.state.detail,null);
});
test('D1.5 — rejeita data impossível com calendário real e não grava',async()=>{
 const {s,writes,messages}=subject();s.state.manualDraft.date='2026-02-30';
 assert.equal(await s.saveManualDetail('manual-1'),false);
 assert.equal(writes.length,0);assert.match(messages[0],/data válida/);
});
test('D1.5 — rejeita valor zero, negativo e não numérico sem persistir',async()=>{
 for(const value of ['0','-30,00','abc','99999999999999999999']){
  const {s,writes}=subject();s.state.manualDraft.value=value;
  assert.equal(await s.saveManualDetail('manual-1'),false);
  assert.equal(writes.length,0);
 }
});
test('D1.5 — rejeita descrição vazia e categoria incompatível',async()=>{
 const a=subject();a.s.state.manualDraft.description=' ';assert.equal(await a.s.saveManualDetail('manual-1'),false);
 const b=subject();b.s.state.manualDraft.category='Salário';assert.equal(await b.s.saveManualDetail('manual-1'),false);
 assert.equal(b.writes.length,0);
});
test('D1.5 — lançamento vinculado não pode alterar valor ou data',async()=>{
 for(const patch of [{value:'130,00'},{date:'2026-11-11'}]){
  const {s,writes,messages}=subject({linked:true});
  Object.assign(s.state.manualDraft,patch);
  assert.equal(await s.saveManualDetail('manual-1'),false);
  assert.equal(writes.length,0);assert.match(messages[0],/Desvincule/);
 }
});
test('D1.5 — vinculado permite mudar descrição/categoria sem tocar extrato',async()=>{
 const {s,original,writes}=subject({linked:true});
 const bankBefore=JSON.stringify(s.state.bank.data.transactions);
 s.state.manualDraft.description='Novo nome';s.state.manualDraft.category='Transporte';
 assert.equal(await s.saveManualDetail(original.id),true);
 assert.equal(writes[0].transactions[0].amount,original.amount);
 assert.equal(JSON.stringify(s.state.bank.data.transactions),bankBefore);
});
test('D1.5 — não grava com seletor de banco, ID trocado ou estado ocupado',async()=>{
 const {s,writes}=subject();
 s.state.detail={origin:'bank',id:'manual-1'};
 assert.equal(await s.saveManualDetail('manual-1'),false);
 s.state.detail={origin:'manual',id:'manual-1'};
 s.writeInProgress=true;assert.equal(await s.saveManualDetail('manual-1'),false);
 s.writeInProgress=false;s.state.busy=true;assert.equal(await s.saveManualDetail('manual-1'),false);
 assert.equal(writes.length,0);
});
test('D1.5 — falha de persistência não fecha drawer nem altera dados',async()=>{
 const {s,writes}=subject({fail:true});
 assert.equal(await s.saveManualDetail('manual-1'),false);
 assert.equal(writes.length,1);assert.notEqual(s.state.detail,null);
});
test('D1.5 — excluir lançamento manual exige confirmação e preserva outras linhas',async()=>{
 const {s,original,other,writes,approve}=subject();
 assert.equal(await s.removeEntry(original.id),true);
 assert.equal(approve.calls,1);
 assert.deepEqual(writes[0].transactions,[other]);assert.equal(s.state.detail,null);
});
test('D1.5 — exclusão vinculada bloqueada antes de qualquer confirmação',async()=>{
 const {s,writes,approve,messages}=subject({linked:true});
 assert.equal(await s.removeEntry('manual-1'),false);
 assert.equal(approve.calls,0);assert.equal(writes.length,0);assert.match(messages[0],/vinculado/);
});
test('D1.5 — cancelar exclusão não modifica banco e não fecha drawer',async()=>{
 const {s,writes}=subject({approved:false});
 assert.equal(await s.removeEntry('manual-1'),false);
 assert.equal(writes.length,0);assert.notEqual(s.state.detail,null);
});
test('D1.5 — erros de persistência não fingem exclusão concluída',async()=>{
 const {s,writes}=subject({fail:true});
 assert.equal(await s.removeEntry('manual-1'),false);
 assert.equal(writes.length,1);assert.notEqual(s.state.detail,null);
});
test('D1.5 — drawer visível oferece edição completa, cancelamento e exclusão, sem alterar banco',()=>{
 assert.match(src,/className:'mf-detail-section mf-manual-editor'/);
 for(const label of ['Descrição','Valor (R$)','Data','Categoria do lançamento','Salvar alterações','Cancelar alterações','Excluir lançamento'])
  assert(src.includes(label),'Missing manual detail field: '+label);
 assert.match(src,/onClick:\(\)=>this\.saveManualDetail\(manual\.id\)/);
 assert.match(src,/onClick:\(\)=>this\.removeEntry\(manual\.id\)/);
 assert.match(src,/className:'mf-transaction-category-select',value:this\.state\.manualDraft\.category/);
 assert.match(src,/this\.isManualLinked\(manual\.id\)/);
 assert.match(src,/this\.field\('Categoria principal',h\(StyledSelect,\{className:'mf-transaction-category-select',value:tx\.category/);
});
