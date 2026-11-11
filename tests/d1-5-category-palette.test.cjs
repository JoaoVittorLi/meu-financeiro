'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
test('D1.5 — novas categorias padrão usam paleta não roxa sem mudar significado financeiro',()=>{
 const db=new FinanceDB(':memory:');
 const categories=db.listCategories().categories;
 assert.equal(categories.find(x=>x.name==='Moradia').color,'#3e9a85');
 assert.equal(categories.find(x=>x.name==='Alimentação').color,'#d6934b');
 assert.equal(categories.find(x=>x.name==='Outros').color,'#87929c');
 assert.equal(categories.find(x=>x.name==='Salário').kind,'income');
 assert.equal(categories.find(x=>x.name==='Transferências').kind,'both');
 assert.equal(categories.find(x=>x.name==='Moradia').emoji,'🏠');
 db.close();
});
test('D1.5 — alterações de cores já gravadas permanecem após reabrir banco',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d15-palette-')),file=path.join(dir,'finance.sqlite');
 try{
  let db=new FinanceDB(file);
  db.db.prepare('UPDATE categories SET color=? WHERE name=?').run('#884bff','Moradia');
  db.upsertCategory({name:'Pets',color:'#bc80ff',emoji:'🐶'});
  db.close();
  db=new FinanceDB(file);
  const cats=db.listCategories().categories;
  assert.equal(cats.find(x=>x.name==='Moradia').color,'#884bff');
  assert.equal(cats.find(x=>x.name==='Pets').color,'#bc80ff');
  assert.equal(cats.find(x=>x.name==='Pets').emoji,'🐶');
  db.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('D1.5 — o catálogo de categorias não migra dados, altera apenas INSERT OR IGNORE inicial',()=>{
 const text=fs.readFileSync(path.join(__dirname,'../electron/db.cjs'),'utf8');
 const init=text.slice(text.indexOf('const seed=this.db.prepare('),text.indexOf('this.db.prepare("UPDATE categories SET kind=',text.indexOf('const seed=this.db.prepare(')));
 assert.match(init,/INSERT OR IGNORE INTO categories/);
 assert.doesNotMatch(init,/UPDATE categories SET color/);
 assert.match(text,/UPDATE categories SET emoji/);
});

test('D1.5 — novos swatches omitiram roxos, mas o editor continua aceitando HEX personalizado',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
 const options=app.match(/const COLOR_OPTIONS=\[([^\]]+)\]/);
 assert(options,'Seletor de cores ausente');
 assert.equal(options[1].includes('#884bff'),false);
 assert.equal(options[1].includes('#bc80ff'),false);
 assert.match(app,/maxLength:7,spellCheck:false/);
 assert.match(app,/\/\^#\[0-9a-fA-F\]\{6\}\$\/\.test\(color\)/);
});
