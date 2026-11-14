'use strict';
// Executes the actual App.importCSV and commitCSVPreview methods via the TS
// compiler, with an actual Node SQLite FinanceDB as the persistence boundary.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const ts=require('typescript'),{webcrypto}=require('node:crypto');
const {FinanceDB}=require('../electron/db.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
const parser=fs.readFileSync(path.join(__dirname,'../src/d05-csv.ts'),'utf8');
const ast=ts.createSourceFile('app.ts',source,ts.ScriptTarget.ES2019,true,ts.ScriptKind.TS);
const app=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='App');
const money=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='parseMoney');
assert(app&&money,'Real App class and money parser must exist');
const method=name=>{
 const m=app.members.find(n=>ts.isMethodDeclaration(n)&&n.name.getText(ast)===name);
 assert(m,'Real App.'+name+' must exist');
 return m.getText(ast);
};
const bundle=ts.transpileModule(parser+'\n'+money.getText(ast)+'\nclass CsvApp {\n'+
 ['importCSV','commitCSVPreview'].map(method).join('\n')+'\n}',{
 compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None},
 reportDiagnostics:true
});
assert.deepEqual((bundle.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error)
 .map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[]);
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf2-csv-sqlite-'));
 const db=new FinanceDB(path.join(dir,'csv-test.sqlite'));
 db.save('demo',{version:5,transactions:[],budgets:{},
  settings:{opening:0,income:0,fixed:0,existing:0,reserve:0}});
 let backups=0,allowed=true,saves=0;
 const desktop={backupSQLite:async()=>{
  backups++;
  if(!allowed)return {ok:false,cancelled:true};
  await db.backupTo(path.join(dir,'backup-'+backups+'.sqlite'));
  return {ok:true};
 }};
 const CsvApp=new Function('crypto','TextEncoder','findCategoryRule','desktop',
  bundle.outputText+';return CsvApp;')(webcrypto,TextEncoder,()=>null,desktop);
 const ui=new CsvApp(),flashes=[];
 ui.state={mode:'demo',data:db.load('demo'),categories:[
  {name:'Alimentação'},{name:'Outros'}],rules:[],csvPreview:null,busy:false};
 ui.getCategories=()=>ui.state.categories;
 ui.setState=patch=>Object.assign(ui.state,patch);
 ui.flash=msg=>flashes.push(msg);
 ui.updateData=async(next)=>{
  db.save('demo',next);saves++;ui.state.data=db.load('demo');return true;
 };
 const file=(csv,name='entrada.csv')=>({name,size:Buffer.byteLength(csv),
  text:async()=>csv});
 return {db,ui,file,flashes,get backups(){return backups},
  get saves(){return saves},denyBackup(){allowed=false},
  close(){db.close();fs.rmSync(dir,{recursive:true,force:true})}};
}
test('D05 CSV — actual import/commit methods preserve exact cents, quoted fields and duplicates in SQLite',async()=>{
 const f=fixture();try{
  const csv='data;descricao;valor;tipo;categoria\r\n'+
   '2026-11-01;"Mercado; do bairro";-1.234,56;despesa;Alimentação\r\n'+
   '2026-11-01;"Mercado; do bairro";-1.234,56;despesa;Alimentação\r\n'+
   '2026-11-02;Reembolso;90,01;receita;Outros\r\n';
  await f.ui.importCSV(f.file(csv));
  const preview=f.ui.state.csvPreview;
  assert(preview,'Full CSV preview must be present before any write');
  assert.equal(preview.rows.length,3);
  assert.equal(preview.add.length,2);
  assert.equal(preview.skipped,1);
  assert.equal(preview.add.find(t=>t.kind==='expense').amount,123456);
  assert.equal(preview.add.find(t=>t.kind==='income').amount,9001);
  assert.equal(f.saves,0);
  await f.ui.commitCSVPreview();
  assert.equal(f.backups,1);assert.equal(f.saves,1);
  assert.equal(f.ui.state.csvPreview,null);
  const persisted=f.db.load('demo').transactions;
  assert.equal(persisted.length,2);
  assert.equal(persisted.find(t=>t.kind==='expense').amount,123456);
  assert.equal(persisted.find(t=>t.kind==='expense').description,'Mercado; do bairro');
  assert.equal(persisted.find(t=>t.kind==='income').amount,9001);
  await f.ui.importCSV(f.file(csv));
  assert.equal(f.ui.state.csvPreview,null);
  assert.equal(f.saves,1);
  assert.equal(f.backups,1);
 }finally{f.close();}
});
test('D05 CSV — cancelled mandatory backup does not modify SQLite cents or manual rows',async()=>{
 const f=fixture();try{
  const csv='data;descricao;valor;tipo;categoria\n2026-11-04;Compra sintética;-29,99;despesa;Outros\n';
  await f.ui.importCSV(f.file(csv));
  assert(f.ui.state.csvPreview);
  f.denyBackup();
  await f.ui.commitCSVPreview();
  assert.equal(f.backups,1);
  assert.equal(f.saves,0);
  assert.equal(f.db.load('demo').transactions.length,0);
  assert(f.flashes.some(m=>/Backup completo não confirmado/.test(m)));
 }finally{f.close();}
});
test('D05 CSV — malicious spreadsheet formula is rejected before preview and without persistence',async()=>{
 const f=fixture();try{
  await f.ui.importCSV(f.file('data;descricao;valor\n2026-11-04;=HYPERLINK("url");5,99\n'));
  assert.equal(f.ui.state.csvPreview,null);
  assert.equal(f.backups,0);assert.equal(f.saves,0);
  assert(f.flashes.some(m=>/fórmula/.test(m)));
 }finally{f.close();}
});
