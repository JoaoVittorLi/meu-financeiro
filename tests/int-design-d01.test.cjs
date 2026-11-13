'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const path=require('node:path');
const text=fs.readFileSync(path.resolve(__dirname,'../src/intelligence-design.ts'),'utf8');
const js=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
const nodes=(type,props,...children)=>({type,props:{...(props||{}),children}});
let proof=true,original=0;
const make=new Function('h','intelligenceVerifyProposalRecord','intelligenceResolveActionProposal','intelligenceSelectActionCandidate','intelligenceExpandProposalCandidates',
 js+';return {mfD01Default,mfD01Current,mfD01EditBegin,mfD01EditChange,mfD01EditDiscard,mfD01EditSave,mfD01EnterReview,mfD01VerifyReview,renderMfD01Proposal,mfD01FormatCents,mfD01Revision};');
const f=make(nodes,()=>({ok:proof}),()=>{original++;},()=>{},()=>{});
const proposal=()=>({id:'prop-1',status:'pending',origin:'manual',txId:'tx-1',date:'2026-11-13',amountCents:17750,txKind:'expense',
 description:'Assinatura de teste',rawDescription:'Assinatura de teste',currentCategory:'Outros',proposedCategory:'Assinaturas'});
const app=()=>({state:{mode:'real',mfD01Edit:null,mfD01Committed:{},mfD01Review:null},setState(x){Object.assign(this.state,x)},navigate(x){this.lastRoute=x}});
const flatten=root=>{const out=[];const walk=x=>{if(Array.isArray(x)){x.forEach(walk);return}if(!x||typeof x!=='object')return;if('type'in x){out.push(x);walk(x.props?.children)}};walk(root);return out;};
const find=(tree,label)=>flatten(tree).filter(n=>n.type==='button'&&flatten([n]).some(x=>x.props?.children?.some?.(c=>c===label)));
const copy=node=>typeof node==='string'?node:Array.isArray(node)?node.map(copy).join(''):node&&node.props?copy(node.props.children):'';
test('D01 editing color does not erase name, scope or selection',()=>{
 const a=app(),p=proposal();f.mfD01EditBegin(a,p);
 f.mfD01EditChange(a,{name:'Novas assinaturas'});f.mfD01EditChange(a,{color:'#ff7a88'});
 assert.equal(a.state.mfD01Edit.name,'Novas assinaturas');
 assert.equal(a.state.mfD01Edit.selected,true);
 f.mfD01EditSave(a,p);assert.equal(f.mfD01Current(a,p).name,'Novas assinaturas');
 assert.equal(f.mfD01Current(a,p).color,'#ff7a88');
 assert.equal(a.state.mfD01Review,null);
});
test('D01 discard keeps committed draft untouched',()=>{
 const a=app(),p=proposal();
 f.mfD01EditBegin(a,p);f.mfD01EditChange(a,{name:'Descartável'});
 f.mfD01EditDiscard(a);assert.equal(f.mfD01Current(a,p).name,'Assinaturas');
});
test('D01 confirmation starts unchecked, invalidates after edit',()=>{
 const a=app(),p=proposal();
 proof=true;f.mfD01EnterReview(a,p);assert.equal(a.state.mfD01Review.consent,false);
 assert.equal(f.mfD01VerifyReview(a,p),true);
 a.state.mfD01Review.consent=true;
 f.mfD01EnterReview(a,p);assert.equal(a.state.mfD01Review.consent,false);
 f.mfD01EditBegin(a,p);assert.equal(a.state.mfD01Review,null);
});
test('D01 stale record cannot be confirmed',()=>{
 const a=app(),p=proposal();
 proof=true;f.mfD01EnterReview(a,p);proof=false;
 assert.equal(f.mfD01VerifyReview(a,p),false);
 proof=true;
});
test('D01 changing source, amount, category or selection revokes approval',()=>{
 const a=app(),p=proposal();
 f.mfD01EnterReview(a,p);const original=f.mfD01Revision(p,f.mfD01Current(a,p));
 for(const changed of [{amountCents:17751},{origin:'bank'},{proposedCategory:'Outras'}]){
  assert.notEqual(f.mfD01Revision({...p,...changed},f.mfD01Current(a,p)),original);
 }
 a.state.mfD01Committed[p.id]={...f.mfD01Default(p),selected:false};
 assert.equal(f.mfD01VerifyReview(a,p),false);
});
test('D01 no artificial receipt or personal database writing in module',()=>{
 assert.doesNotMatch(text,/\.categorySave\(|\.ruleSave\(|\.bankCategorize\(|\.categoryReviewConfirm\(|\.db\.|categoryReviewConfirm\(/);
 assert.doesNotMatch(text,/changesApplied\s*:\s*true/);
 assert.match(text,/Nenhuma escrita disponível|nenhuma escrita disponível|nenhuma escrita/i);
});
test('D01 display selects verified record and BRL values from cents',()=>{
 const a=app(),p=proposal(),view=f.renderMfD01Proposal(a,p);
 assert.match(copy(view),/R\$\s*177,50/);
 assert.match(copy(view),/Assinaturas/);
 assert.match(copy(view),/Organizar compras anteriores/);
 assert.match(copy(view),/Categorizar próximas compras/);
 assert.equal(flatten(view).filter(n=>n.type==='input'&&n.props.type==='checkbox').length>=3,true);
});
test('D01 ambiguous proposals never enable review without explicit identity',()=>{
 const a=app(),p={...proposal(),status:'ambiguous',txId:'',candidates:[]};
 const view=f.renderMfD01Proposal(a,p);
 const buttons=flatten(view).filter(n=>n.type==='button');
 const review=buttons.find(n=>copy(n)==='Conferir proposta');
 assert(review);assert.equal(review.props.disabled,true);
});
test('D01 manual category editor has real navigation and is disabled in demo',()=>{
 const a=app(),p=proposal(),view=f.renderMfD01Proposal(a,p);
 let b=flatten(view).find(n=>n.type==='button'&&copy(n)==='Abrir editor manual');
 assert(b&&!b.props.disabled);b.props.onClick();assert.equal(a.lastRoute,'categories');
 a.state.mode='demo';b=flatten(f.renderMfD01Proposal(a,p)).find(n=>n.type==='button'&&copy(n)==='Abrir editor manual');
 assert(b.props.disabled);
});
