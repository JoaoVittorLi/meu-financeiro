'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const src=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../app/style.css'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8'));

function cut(start,end){
 const from=src.indexOf(start),to=src.indexOf(end,from+start.length);
 assert.ok(from>=0&&to>from,'missing source contract: '+start);
 return src.slice(from,to);
}
function evaluated(source,returnName,bindings={}){
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
 return new Function(...Object.keys(bindings),js+';return '+returnName+';')(...Object.values(bindings));
}

test('B02 category is a native accessible button with explicit category and handler',()=>{
 const h=(name,props,...children)=>({name,props,children});
 const Button=evaluated(cut('function TransactionCategoryButton(','type Choice = {value:string;label:string};'),'TransactionCategoryButton',{h});
 let opened=0;
 const node=Button({category:'Alimentação',emoji:'🍽️',label:'Editar categoria de Mercado · 08/11/2026 · Conta A · −R$ 100,00',onClick:()=>opened++});
 assert.equal(node.name,'button');
 assert.equal(node.props.type,'button');
 assert.match(node.props.className,/mf-category-edit/);
 assert.match(node.props['aria-label'],/Mercado.*Conta A/);
 node.props.onClick();
 assert.equal(opened,1);
 assert.match(css,/\.mf-category-edit:focus-visible/);
});

test('B02 bank and manual route to existing identity-aware drawer without writing in row',()=>{
 const method=cut('openCategoryFromRow(origin:', 'async updateBankInfo()');
 const Subject=evaluated('class Subject{'+method+'}','Subject');
 const app=new Subject(),opened=[];
 app.openBankDetail=tx=>opened.push({origin:'bank',tx});
 app.openManualDetail=tx=>opened.push({origin:'manual',tx});
 const first={accountId:'account-A',id:'external-1',description:'Pagamento'};
 const second={accountId:'account-B',id:'external-1',description:'Pagamento'};
 const manual={id:'local-1',description:'Pagamento'};
 app.openCategoryFromRow('bank',first);
 app.openCategoryFromRow('bank',second);
 app.openCategoryFromRow('manual',manual);
 assert.deepEqual(opened,[{origin:'bank',tx:first},{origin:'bank',tx:second},{origin:'manual',tx:manual}]);
 assert.equal(app.focusCategoryOnDetailOpen,true);
 assert.doesNotMatch(method,/bankCategorize\(|updateData\(|bankBatch\(/);
 assert.match(src,/onClick:\(\)=>this\.openCategoryFromRow\(t\.origin,t\.raw as BankTx\|Tx\)/);
});

test('B02 opening from category focuses its editor; standard detail retains normal focus',()=>{
 const focus=[];
 const category={focus:()=>focus.push('category')};
 const generic={focus:()=>focus.push('generic')};
 const row={focus:()=>focus.push('row')};
 const dialog={querySelector:query=>query==='.mf-transaction-category-select'?category:generic};
 const document={activeElement:row,querySelector:()=>dialog,contains:()=>true};
 const Subject=evaluated('class Subject{'+cut('componentDidUpdate(_prevProps:any,previous:State)','async refreshCloudPersonalUI()')+'}','Subject',{document});
 const app=new Subject(),closed={detail:null};
 app.state={detail:{origin:'bank',id:'external-1'}};
 app.focusCategoryOnDetailOpen=true;
 app.componentDidUpdate({},closed);
 assert.deepEqual(focus,['category']);
 assert.equal(app.focusReturn,row);
 assert.equal(app.focusCategoryOnDetailOpen,false);
 app.state={detail:null};
 app.componentDidUpdate({},{detail:{origin:'bank',id:'external-1'}});
 assert.deepEqual(focus,['category','row']);
 app.state={detail:{origin:'manual',id:'local-1'}};
 app.componentDidUpdate({},closed);
 assert.deepEqual(focus,['category','row','generic']);
});

test('B02 category editor is marked for both origins and remains separate from split editing',()=>{
 assert.match(src,/this\.field\('Categoria principal',h\(StyledSelect,\{className:'mf-transaction-category-select',value:tx\.category/);
 assert.match(src,/h\('b',\{\},'Categoria do lançamento'\),h\(StyledSelect,\{className:'mf-transaction-category-select',value:manual\.category/);
 assert.match(src,/onChange:\(v:string\)=>this\.setBankCategory\(tx,v\)/);
 assert.match(src,/onChange:\(v:string\)=>this\.changeManualCategory\(manual\.id,v\)/);
 assert.match(src,/f\.splitParts\.map\(\(part,i\)=>/);
 assert.match(src,/onChange:\(\)=>this\.toggleSelected\(v\)/);
});

test('B02 renderer labels match the current candidate version and exclude prior releases',()=>{
 assert.match(pkg.version,/^\d+\.\d+\.\d+-beta\.\d+$/);
 const labels=src.match(/\bv\d+\.\d+\.\d+-beta\.\d+\b/g)||[];
 assert.equal(labels.length,3);
 assert.deepEqual([...new Set(labels)],['v'+pkg.version]);
 assert.match(pkg.scripts['dist:windows'],/provenance:verify/);
});
