'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'src/app.ts'),'utf8');
const css=fs.readFileSync(path.join(root,'app/style.css'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const pwa=JSON.parse(fs.readFileSync(path.join(root,'mobile-push/package.json'),'utf8'));
const h=(name,props,...children)=>({name,props:props||{},children});
function cut(start,end){
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,start+' boundary missing');
 return app.slice(a,b);
}
function compile(src,what,extra={}){
 const out=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}});
 return new Function(...Object.keys(extra),out.outputText+';return '+what)(...Object.values(extra));
}
const fmt=n=>'R$ '+(n/100).toFixed(2);
const walk=(n,pred,result=[])=>{
 if(Array.isArray(n)){n.forEach(v=>walk(v,pred,result));return result;}
 if(!n||typeof n!=='object')return result;
 if(pred(n))result.push(n);
 if(n.children)walk(n.children,pred,result);
 return result;
};
class ReactStub{
 constructor(props){this.props=props;this.state={};}
 setState(update,callback){this.state={...this.state,...(typeof update==='function'?update(this.state):update)};callback?.();}
}
const React={Component:ReactStub};
const ReactDOM={createPortal:node=>node};
const win={innerWidth:320,innerHeight:768};
let focusCount=0;
const trigger={getBoundingClientRect:()=>({left:125,right:225,top:380,bottom:421,width:100}),focus:()=>focusCount++};
const panel={querySelector:()=>({focus:()=>focusCount++})};

test('F01 saldo desconhecido, parcial, zero real e total conhecido',()=>{
 const {bankBalanceCoverage,bankBalanceLabel}=compile(
  cut('function bankBalanceCoverage(','function bankTotalsInRange('),
  '{bankBalanceCoverage,bankBalanceLabel}',{fmt});
 const account=balance=>({balance});
 const unknown=bankBalanceCoverage([account(null),account(null)]);
 assert.deepEqual(unknown,{knownCount:0,totalCount:2,missingCount:2,amountKnown:0});
 assert.equal(bankBalanceLabel(unknown),'Saldo indisponível');
 const partial=bankBalanceCoverage([account(15932),account(null)]);
 assert.equal(partial.amountKnown,15932);
 assert.match(bankBalanceLabel(partial),/^Parcial · R\$ 159\.32$/);
 assert.equal(bankBalanceLabel(bankBalanceCoverage([account(0)])),'R$ 0.00');
 assert.equal(bankBalanceLabel(bankBalanceCoverage([account(100),account(-31)])),'R$ 0.69');
 assert.match(app,/displayValue:balanceCoverage\?bankBalanceLabel\(balanceCoverage\)/);
 const Stat=compile(cut('function Stat(p:any)','function prettyMonth('),'Stat',{h,fmt,Icon:()=>null});
 const card=Stat({amount:0,displayValue:'Saldo indisponível',label:'Saldo bancário',hint:'2 ausentes'});
 assert.ok(JSON.stringify(card).includes('Saldo indisponível'));
 assert.ok(!JSON.stringify(card).includes('R$ 0.00'));
});

test('F03 donut preserva somas e legenda legível',()=>{
 assert.match(css,/\.donut-wrap\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.donut-legend \.legend-text\{[^}]*word-break:normal/);
 assert.match(css,/\.donut-legend \.legend-row\{[^}]*flex-direction:column/);
 const Donut=compile(cut('function Donut(p:any)','// B02: accessible category action'),'Donut',
  {h,fmt,COLORS:['#aabbee'],CATS:[]});
 const data=['Moradia','Alimentação','Transporte','Saúde','Lazer','Educação','Outros']
  .map((name,i)=>({name,total:(i+1)*100}));
 const root=Donut({items:data});
 assert.equal(walk(root,v=>v.name==='div'&&v.props.className==='legend-row').length,6);
 assert.equal(walk(root,v=>v.name==='details'&&v.props.className==='donut-all-categories').length,1);
 assert.equal(data.reduce((a,x)=>a+x.total,0),2800);
});

test('F04 botões laterais mantêm nomes acessíveis e localização ativa',()=>{
 const Nav=compile('class Nav{'+cut('navItem(page:string,icon:string,label:string){','renderSide(){')+'}',
  'Nav',{h,Icon:()=>null});
 const nav=new Nav();nav.state={page:'overview'};nav.navigate=()=>{};
 const home=nav.navItem('overview','home','Visão geral');
 const settings=nav.navItem('settings','settings','Configurações');
 assert.equal(home.props['aria-label'],'Visão geral');
 assert.equal(home.props['aria-current'],'page');
 assert.equal(settings.props['aria-label'],'Configurações');
 assert.equal(settings.props.title,'Configurações');
 assert.equal(settings.props['aria-current'],undefined);
});

test('F05/F06 calendários fecham por Escape, devolvem foco e cabem em 320px',()=>{
 const extra={h,React,ReactDOM,Icon:()=>null,document:{body:{}},window:win,
  iso:()=> '2026-11-08',shiftMonth:x=>x,prettyMonth:x=>x,
  fromISO:x=>new Date(x+'T12:00:00'),advanceDate:(x,n)=>{
   const d=new Date(x+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);
  },spanLabel:()=> 'Mês atual'};
 const Single=compile(cut('class SingleDatePicker','class PeriodPicker'),'SingleDatePicker',extra);
 const single=new Single({value:'2026-11-08',onChange:()=>{}});
 single.trigger=trigger;single.panel=panel;single.toggle();
 assert.equal(single.state.open,true);
 assert.ok(single.state.left>=10&&single.state.left+300<=320);
 const node=single.render();
 const calendar=walk(node,v=>v.name==='div'&&v.props.className==='mf-single-calendar')[0];
 assert.ok(calendar.props.style.width<=300);
 let handled=0;
 single.onKeyDown({key:'Escape',preventDefault:()=>handled++,stopPropagation:()=>handled++});
 assert.equal(handled,2);assert.equal(single.state.open,false);assert.ok(focusCount>=1);
 const Period=compile(cut('class PeriodPicker','class App extends React.Component'),'PeriodPicker',extra);
 const period=new Period({mode:'month',span:{start:'2026-11-01',end:'2026-11-08'},onChange:()=>{}});
 period.trigger=trigger;period.panel=panel;period.toggle();
 assert.equal(period.state.open,true);assert.ok(period.state.placement.left>=10);
 handled=0;
 period.onKeyDown({key:'Escape',preventDefault:()=>handled++,stopPropagation:()=>handled++});
 assert.equal(handled,2);assert.equal(period.state.open,false);assert.ok(focusCount>=2);
 assert.match(css,/\.mf-single-calendar\{box-sizing:border-box;width:min\(326px,calc\(100vw - 20px\)\)/);
 assert.match(css,/\.mf-period-popover,\.mf-single-calendar\{z-index:610/);
 assert.match(css,/@media\(max-width:560px\)\{[\s\S]*?\.settings-grid\{grid-template-columns:minmax\(0,1fr\)/);
});

test('F07 impede duplo clique e serializa respostas de IPC entre contas',async()=>{
 const deferred=[];
 const desktop={bankCategorize:args=>new Promise((resolve,reject)=>deferred.push({args,resolve,reject}))};
 const Subject=compile('class Subject{'+cut('async setBankCategory(tx:BankTx,category:string){','changeManualCategory(id:string,category:string){')+'}',
  'Subject',{desktop});
 const instance=new Subject();instance.categorySavingKeys=new Set();
 instance.categorySaveQueue=Promise.resolve();instance.state={mode:'real',bank:{data:{transactions:[]}},categorySaving:[]};
 let errors=0;instance.flash=()=>errors++;
 instance.setState=function(update){this.state={...this.state,...(typeof update==='function'?update(this.state):update)};};
 const a={id:'same',accountId:'A'},b={id:'same',accountId:'B'};
 const first=instance.setBankCategory(a,'Transporte');
 const duplicate=instance.setBankCategory(a,'Lazer');
 const second=instance.setBankCategory(b,'Saúde');
 await Promise.resolve();await Promise.resolve();
 assert.equal(deferred.length,1);
 assert.equal(deferred[0].args.category,'Transporte');
 assert.deepEqual(new Set(instance.state.categorySaving),new Set(['A|same','B|same']));
 deferred[0].resolve({transactions:[{accountId:'A',id:'same',category:'Transporte'}]});
 await first;await duplicate;await Promise.resolve();await Promise.resolve();
 assert.equal(deferred.length,2);assert.equal(deferred[1].args.accountId,'B');
 deferred[1].resolve({transactions:[{accountId:'A',id:'same',category:'Transporte'},
  {accountId:'B',id:'same',category:'Saúde'}]});
 await second;assert.equal(instance.state.categorySaving.length,0);
 assert.equal(instance.state.bank.data.transactions[1].category,'Saúde');
 assert.equal(deferred.length,2);
 const rejected=instance.setBankCategory(a,'Lazer');await Promise.resolve();await Promise.resolve();
 deferred[2].reject(new Error('Falha simulada'));await rejected;
 assert.equal(errors,1);assert.equal(instance.state.categorySaving.length,0);
});

test('F02 versões do Windows, PWA e renderer coincidem dinamicamente',()=>{
 assert.equal(pkg.version,pwa.version);
 assert.match(pkg.version,/^\d+\.\d+\.\d+-beta\.\d+$/);
 const labels=app.match(/\bv\d+\.\d+\.\d+-beta\.\d+\b/g)||[];
 assert.equal(labels.length,3);
 assert.deepEqual([...new Set(labels)],['v'+pkg.version]);
});
