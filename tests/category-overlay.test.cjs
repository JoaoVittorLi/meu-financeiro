'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'src/app.ts'),'utf8');
const css=fs.readFileSync(path.join(root,'app/style.css'),'utf8');
const aiCss=fs.readFileSync(path.join(root,'app/intelligence.css'),'utf8');
function styledSelect(){
 const start=src.indexOf('type Choice = {value:string;label:string};');
 const end=src.indexOf('class SingleDatePicker extends React.Component',start);
 assert.ok(start>=0&&end>start,'StyledSelect must be locatable in TS source.');
 const code=ts.transpileModule(src.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
 const React={Component:class{constructor(props){this.props=props;this.state={}}setState(next){this.state={...this.state,...(typeof next==='function'?next(this.state):next)}}}};
 const h=(name,props,...children)=>({name,props,children});
 const doc={body:{},addEventListener(){},removeEventListener(){}};
 const win={innerWidth:1440,innerHeight:900,addEventListener(){},removeEventListener(){}};
 const ReactDOM={createPortal:node=>({portal:true,node})};
 return {Class:new Function('React','h','document','window','ReactDOM','Icon',code+';return StyledSelect;')(React,h,doc,win,ReactDOM,props=>h('svg',props))};
}
test('B01 portal selector stays above detail drawer and AI overlay',()=>{
 const layer=Number(css.match(/--mf-z-select-portal:\s*(\d+)/)?.[1]);
 const drawer=Number(css.match(/\.mf-drawer-backdrop\{[^}]*z-index:\s*(\d+)/)?.[1]);
 const ai=Number(aiCss.match(/\.mf-ai-backdrop\{[^}]*z-index:\s*(\d+)/)?.[1]);
 assert.ok(Number.isFinite(layer)&&layer>drawer&&layer>ai,{layer,drawer,ai});
 assert.match(css,/\.mf-select-popover\{z-index:var\(--mf-z-select-portal\)/);
 assert.match(src,/ReactDOM\.createPortal\(/);
});
test('B01 one Escape closes only selector and preserves second Escape for dialog',()=>{
 const {Class}=styledSelect();
 const select=new Class({options:[{value:'food',label:'Alimentação'}],value:'food',onChange(){}});
 let focused=false;
 select.trigger={focus(){focused=true},getBoundingClientRect(){return {left:20,bottom:60,top:20,width:180}}};
 select.open();
 let stopped=false,prevented=false;
 select.onKey({key:'Escape',stopPropagation(){stopped=true},preventDefault(){prevented=true}});
 assert.equal(select.state.open,false);assert.equal(stopped,true);assert.equal(prevented,true);assert.equal(focused,true);
 stopped=false;prevented=false;
 select.onKey({key:'Escape',stopPropagation(){stopped=true},preventDefault(){prevented=true}});
 assert.equal(stopped,false);assert.equal(prevented,false);
});
test('B01 keyboard ArrowDown and Enter select category exactly once',()=>{
 const {Class}=styledSelect();let chosen=[];
 const select=new Class({options:[{value:'food',label:'Alimentação'},{value:'travel',label:'Transporte'}],value:'food',onChange:value=>chosen.push(value)});
 select.trigger={focus(){},getBoundingClientRect(){return {left:20,bottom:60,top:20,width:180}}};
 select.open();select.onKey({key:'ArrowDown',preventDefault(){}});
 assert.equal(select.state.focusIndex,1);
 select.onKey({key:'Enter',preventDefault(){}});
 assert.equal(select.state.open,false);assert.deepEqual(chosen,['travel']);
});
test('B01 menu handles keydown from options in the React portal',()=>{
 const {Class}=styledSelect();
 const select=new Class({options:[{value:'food',label:'Alimentação'}],value:'food',onChange(){}});
 select.trigger={focus(){},getBoundingClientRect(){return {left:10,top:20,bottom:60,width:160}}};
 select.open();const tree=select.render(),portal=tree.children[1];
 assert.equal(portal.portal,true);
 assert.equal(portal.node.props.role,'listbox');
 assert.equal(portal.node.props.onKeyDown,select.onKey);
 assert.equal(portal.node.children[0][0].props.role,'option');
});
test('B01 scroll in owner drawer repositions instead of losing the menu',()=>{
 const {Class}=styledSelect();
 const select=new Class({options:[{value:'food',label:'Alimentação'}],value:'food',onChange(){}});
 select.trigger={focus(){},getBoundingClientRect(){return {left:10,top:20,bottom:60,width:160}}};
 select.open();
 const owner={contains(node){return node===select.trigger;}};
 select.onScroll({target:owner});
 assert.equal(select.state.open,true);
 select.onScroll({target:{contains(){return false;}}});
 assert.equal(select.state.open,false);
});
