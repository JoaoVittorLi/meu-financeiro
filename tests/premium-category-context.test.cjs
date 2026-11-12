'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {FinanceDB}=require('../electron/db.cjs');const src=fs.readFileSync('src/app.ts','utf8');
function part(a,b){return src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)+a.length));}
function harness(){
 const db=new FinanceDB(':memory:');db.save('real',{transactions:[],budgets:{},settings:{opening:0,income:0,fixed:0,existing:0,reserve:0}});
 const methods=part(' async saveCategory(){',' async deleteCategory(')+part(" openContextCategory(target:",' renderContextCategory()');
 const api={categorySave:async x=>db.upsertCategory(x),load:async m=>db.load(m)};
 const js=ts.transpileModule('class Subject{'+methods+'}',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 const Subject=new Function('desktop','safeData',js+';return Subject')(api,x=>x);const app=new Subject();
 app.state={mode:'real',bankFilter:'account-A',query:'mercado',txSelected:['account-A|same'],categoryEditor:{name:'Rascunho anterior',previousName:'',color:'#123456',emoji:'✨',kind:'expense'},entry:{description:'Compra fictícia',value:'42,15',date:'2026-11-12',kind:'expense',category:'Outros'},quickCategoryQuery:'',data:db.load('real')};
 app.setState=(p,cb)=>{Object.assign(app.state,p);cb?.()};app.quickCategoryContext=()=>({kind:'expense'});app.refreshBank=async()=>{};app.flash=()=>{};
 return {db,app,api};
}
test('R4 creates a category through the existing SQLite service, retains draft/filters/selection, and resumes entry',async()=>{const f=harness();try{
 const before={...f.app.state.entry};f.app.openContextCategory('entry');f.app.state.categoryEditor.name='Pets sintético';await f.app.saveCategory();
 assert(f.db.listCategories().categories.some(c=>c.name==='Pets sintético'));assert.deepEqual(f.app.state.entry,{...before,category:'Pets sintético'});assert.equal(f.app.state.query,'mercado');assert.deepEqual(f.app.state.txSelected,['account-A|same']);assert.equal(f.app.state.categoryEditor.name,'Rascunho anterior');assert.equal(f.db.load('real').transactions.length,0);
 }finally{f.db.close();}});
test('R4 category creation does not apply an override and cannot carry classification to a changed account',async()=>{const f=harness();try{
 f.app.openContextCategory('quick');f.app.state.categoryEditor.name='Saúde sintética';let release;const save=f.api.categorySave;f.api.categorySave=x=>new Promise(r=>release=()=>r(save(x)));const pending=f.app.saveCategory();f.app.state.bankFilter='account-B';await release();await pending;
 assert.equal(f.app.state.quickCategoryQuery,'');assert.equal(f.app.state.bankFilter,'account-B');assert.equal(f.app.state.contextCategory,undefined);assert.equal(f.db.load('real').transactions.length,0);
 }finally{f.db.close();}});
test('R4 failed save keeps contextual draft open; cancel restores previous editor and preserves the entry',async()=>{const f=harness();try{
 f.app.openContextCategory('entry');f.app.state.categoryEditor.name='';await f.app.saveCategory();assert(f.app.state.contextCategory);assert(f.app.state.categoryMessage);assert.equal(f.app.state.entry.description,'Compra fictícia');f.app.closeContextCategory();assert.equal(f.app.state.categoryEditor.name,'Rascunho anterior');assert.equal(f.app.state.contextCategory,undefined);
 }finally{f.db.close();}});
