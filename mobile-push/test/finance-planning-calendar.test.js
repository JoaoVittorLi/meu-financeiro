import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

class FakeElement {
  constructor(tag='div'){
    this.tagName=tag;this.children=[];this.attributes={};
    this.handlers={};this.className='';this.value='';
    this._text='';
    this.classList={add:token=>{this.className+=' '+token;}};
  }
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this._text='';this.children=[...nodes];}
  setAttribute(name,value){this.attributes[name]=String(value);}
  addEventListener(type,fn){this.handlers[type]=fn;}
}

function calendar(){
  const ids=['planCalendarPrev','planCalendarNext','planCalendarMonth',
    'planCalendarMetrics','planCalendarDays','planCalendarSelection'];
  const elements=new Map(ids.map(id=>[id,new FakeElement()]));
  const listeners={};
  const document={
    getElementById:id=>elements.get(id),
    createElement:tag=>new FakeElement(tag),
    addEventListener:(type,fn)=>{listeners[type]=fn;}
  };
  const code=readFileSync(new URL('../public/finance-planning-calendar.js',import.meta.url),'utf8');
  runInNewContext(code,{document,Intl,Date,Number,String,Array,Object,Map,Set});
  return {elements,listeners};
}
const iso=date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+
  '-'+String(date.getDate()).padStart(2,'0');
const normalized=s=>String(s).replace(/\s/g,'');

test('planning calendar uses verified snapshot to show month forecast without adding paid expenses',()=>{
  const {elements,listeners}=calendar();
  const d=new Date(),dueDate=iso(d);
  const plans=[
    {id:'p1',dueDate,title:'Moradia',category:'Casa',status:'planned',
      kind:'expense',certainty:'confirmed',amountCents:100000},
    {id:'p2',dueDate,title:'Salário futuro',category:'Trabalho',status:'planned',
      kind:'income',certainty:'confirmed',amountCents:200000},
    {id:'p3',dueDate,title:'Receita incerta',category:'Outros',status:'planned',
      kind:'income',certainty:'estimated',amountCents:15000},
    {id:'p4',dueDate,title:'Conta paga',category:'Contas',status:'settled',
      kind:'expense',certainty:'confirmed',amountCents:7000},
    {id:'p5',dueDate,title:'Cancelado',category:'Contas',status:'cancelled',
      kind:'expense',certainty:'confirmed',amountCents:2000}
  ];
  listeners['finance:personal-snapshot']({detail:{stage:'quarantine_verified',plans}});
  const cards=elements.get('planCalendarMetrics').children;
  assert.equal(cards.length,4);
  assert.equal(normalized(cards[0].children[1].textContent),'R$2.000,00');
  assert.equal(normalized(cards[1].children[1].textContent),'R$150,00');
  assert.equal(normalized(cards[2].children[1].textContent),'R$1.000,00');
  assert.equal(cards[3].children[1].textContent,'0');
  const days=elements.get('planCalendarDays').children.filter(node=>node.tagName==='button');
  assert.ok(days.length>=28&&days.length<=31);
  const day=days.find(node=>node.children[0].textContent===String(d.getDate()));
  assert.ok(day);
  assert.match(day.attributes['aria-label'],/5 compromisso/);
  day.handlers.click();
  const selected=elements.get('planCalendarSelection').textContent;
  assert.match(selected,/Moradia/);
  assert.match(selected,/Salário futuro/);
  assert.match(selected,/Conta paga/);
  assert.equal(elements.get('planCalendarDays').children.filter(node=>node.tagName==='button')
    .some(node=>node.attributes['aria-pressed']==='true'),true);
});
test('month navigation works and invalid or unverified snapshots cannot replace records',()=>{
  const {elements,listeners}=calendar();
  const now=new Date(),start=elements.get('planCalendarMonth').textContent;
  elements.get('planCalendarNext').handlers.click();
  assert.notEqual(elements.get('planCalendarMonth').textContent,start);
  elements.get('planCalendarPrev').handlers.click();
  assert.equal(elements.get('planCalendarMonth').textContent,start);
  listeners['finance:personal-snapshot']({detail:{stage:'not_imported',plans:[
    {dueDate:iso(now),title:'Private',category:'Casa',status:'planned',
      kind:'expense',amountCents:300000}
  ]}});
  assert.equal(elements.get('planCalendarMetrics').children[2].children[1].textContent,
    'R$ 0,00');
});
test('planning calendar does not perform bank writes or persist offline financial data',()=>{
  const page=readFileSync(new URL('../public/finance.html',import.meta.url),'utf8');
  const code=readFileSync(new URL('../public/finance-planning-calendar.js',import.meta.url),'utf8');
  for(const id of ['planCalendarPrev','planCalendarNext','planCalendarDays',
    'planCalendarSelection','planCalendarMetrics'])
    assert.match(page,new RegExp('id="'+id+'"'));
  assert.match(page,/finance-planning-calendar\.js/);
  assert.doesNotMatch(code,/fetch\s*\(|localStorage|sessionStorage|indexedDB|innerHTML|bank\/refresh|api\/personal\/apply/);
});
