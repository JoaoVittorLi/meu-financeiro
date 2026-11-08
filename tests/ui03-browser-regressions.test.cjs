'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'src/app.ts'),'utf8');
const style=fs.readFileSync(path.join(root,'app/style.css'),'utf8');
const ai=fs.readFileSync(path.join(root,'app/intelligence.css'),'utf8');
function cut(from,to){const a=app.indexOf(from),b=app.indexOf(to,a+from.length);assert.ok(a>=0&&b>a);return app.slice(a,b);}
function compile(src,name,deps){const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2020}}).outputText;return new Function(...Object.keys(deps),js+';return '+name)(...Object.values(deps));}
class ReactStub{constructor(props){this.props=props;this.state={};}setState(update,callback){this.state={...this.state,...(typeof update==='function'?update(this.state):update)};callback?.();}}
const React={Component:ReactStub};
const doc={documentElement:{},body:{}};
const win={innerWidth:320,innerHeight:768};
const deps={React,document:doc,window:win,iso:()=> '2026-11-08'};
const SingleDatePicker=compile(cut('class SingleDatePicker','class PeriodPicker'),'SingleDatePicker',deps);
const PeriodPicker=compile(cut('class PeriodPicker','class App extends React.Component'),'PeriodPicker',deps);

test('F05 browser regression: viewport scroll repositions SingleDatePicker without dismissing it',()=>{
 const picker=new SingleDatePicker({value:'2026-11-08'});
 picker.state.open=true;
 picker.panel={contains:()=>false};
 picker.trigger={getBoundingClientRect:()=>({left:120,right:250,top:727,bottom:768})};
 picker.onScroll({target:doc});
 assert.equal(picker.state.open,true);
 assert.ok(picker.state.left>=10&&picker.state.left+300<=320);
 assert.ok(picker.state.top>=10&&picker.state.top+380<=768);
 picker.onScroll({target:{}});
 assert.equal(picker.state.open,false,'scrolling an unrelated scroller should close');
});

test('F05 browser regression: viewport scroll repositions PeriodPicker without dismissing it',()=>{
 const picker=new PeriodPicker({span:{start:'2026-11-01',end:'2026-11-08'},mode:'month'});
 picker.state.open=true;picker.panel={contains:()=>false};
 picker.trigger={getBoundingClientRect:()=>({left:100,right:260,top:700,bottom:745})};
 picker.onScroll({target:doc});
 assert.equal(picker.state.open,true);
 assert.ok(picker.state.placement.left>=10);
 assert.ok(picker.state.placement.left+300<=320);
 picker.onScroll({target:{}});
 assert.equal(picker.state.open,false);
});

test('F03/F06 visual styles retain category labels, small-width demo notice and all Intelligence tabs',()=>{
 assert.match(style,/\.donut-legend\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(style,/@media\(max-width:560px\)\{\.donut-legend\{grid-template-columns:minmax\(0,1fr\)\}\}/);
 assert.match(style,/\.demo-strip\{display:block;line-height:1\.55/);
 assert.match(style,/\.mf-single-calendar\{max-height:calc\(100vh - 20px\);overflow-y:auto\}/);
 assert.match(ai,/\.mf-ai-tabbar\{flex-wrap:wrap;overflow-x:visible/);
});
