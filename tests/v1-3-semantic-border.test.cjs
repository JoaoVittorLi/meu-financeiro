'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const premium=read('app/premium-interactions.css');
const source=read('src/app.ts');
const overview=read('app/overview.css');
const movements=read('app/operations.css');
const budgets=read('app/decisions.css');
const start=premium.indexOf('/* V1.3 — shared semantic outline');
const end=premium.indexOf('/* V1.2 / BUG-02',start);
const layer=premium.slice(start,end);

test('V1.3 — a mesma borda renderiza topo e laterais; remove anel anterior',()=>{
 assert(start>=0&&end>start,'Camada V1.3 não encontrada');
 assert.match(layer,/border-top-color:transparent/);
 assert.match(layer,/\.mf-border-reveal::after\s*\{[\s\S]*?border:3px solid var\(--mf-border-tone\);border-radius:inherit/);
 assert.match(layer,/inset:-1px;box-sizing:border-box/);
 assert.match(layer,/linear-gradient\(to bottom,#000 0 3px,transparent 3px\)/);
 assert.match(layer,/conic-gradient\(from 45deg/);
 assert.match(layer,/--mf-border-sweep:0deg/);
 assert.match(layer,/--mf-border-sweep:360deg/);
 assert.doesNotMatch(premium,/--mf-v1-border-progress|--mf-v1-border-tone|-webkit-mask-composite:\s*xor|mask-composite:\s*exclude/);
 assert.doesNotMatch(layer,/background:\s*conic-gradient|padding:\s*2px/);
});
test('V1.3 — fallback semântico não supera classes com especificidade mais baixa',()=>{
 assert.match(layer,/\.mf-border-reveal\s*\{--mf-border-tone:var\(--subtle\)\}/);
 assert.doesNotMatch(layer,/> \.mf-border-reveal\s*\{\s*--mf-border-tone:/);
 for(const [name,color]of [['income','--green'],['expense','--red'],['warning','--warning'],['neutral','--subtle']]){
  assert.match(layer,new RegExp('mf-tone-'+name.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')));
  assert(layer.includes('var('+color+')'),'Missing semantic color '+name);
 }
 assert.match(layer,/\.mf-border-reveal\.mf-tone-net\.is-positive\s*\{--mf-border-tone:var\(--green\)\}/);
 assert.match(layer,/\.mf-border-reveal\.mf-tone-net\.is-negative\s*\{--mf-border-tone:var\(--red\)\}/);
});
test('V1.3 — Movimentações: Saídas confirmadas preserva a mesma cor de despesa',()=>{
 assert.match(source,/label:'Saídas confirmadas'[^}]*kind:'expense'/);
 assert.match(source,/className:'u2-metric mf-border-reveal mf-tone-'\+\(x\.tone\|\|x\.kind\|\|'neutral'\)/);
 assert.match(movements,/\.u2-metric\.expense\s*\{\s*border-top-color:\s*var\(--red\)/);
 assert.match(premium,/\.u2-shell \.u2-metric:hover:not\(\.mf-border-reveal\)/);
 assert.doesNotMatch(layer,/--mf-hover-stroke/);
});
test('V1.3 — Visão Geral: saldo, receitas, despesas e resultado por sinal',()=>{
 assert.match(source,/className:'u1-balance mf-border-reveal mf-tone-balance'/);
 assert.match(source,/className:'u1-metric mf-border-reveal mf-tone-'/);
 assert.match(source,/tone==='net'\?\(value>0\?' is-positive':value<0\?' is-negative':' is-neutral'\)/);
 assert.match(overview,/\.u1-metric\.income\s*\{\s*border-top: 3px solid var\(--green\)/);
 assert.match(overview,/\.u1-metric\.expense\s*\{\s*border-top: 3px solid var\(--red\)/);
 assert.match(layer,/\.mf-border-reveal\.mf-tone-balance/);
 assert.match(layer,/\.mf-border-reveal\.mf-tone-net\.is-neutral/);
});
test('V1.3 — Orçamentos: gasto vermelho, limites teal, margem dinâmica, alerta warning',()=>{
 for(const token of ['mf-tone-expense','mf-tone-balance','mf-tone-net','mf-tone-warning']){
  assert(source.includes(token),'Expected budget tone '+token);
 }
 assert.match(source,/limited\.length\?\(margin<0\?'is-negative':'is-positive'\):'is-neutral'/);
 assert.match(budgets,/\.u3-budgets \.mf-budget-summary > div\s*\{[^}]*border-top:\s*3px solid/s);
});
test('V1.3 — Contas: saldo teal, contador neutro, referência recente verde, conferência warning',()=>{
 assert.match(source,/mf-account-total mf-border-reveal mf-tone-balance/);
 assert.match(source,/mf-account-count mf-border-reveal mf-tone-neutral/);
 assert.match(source,/u3-account-signal mf-border-reveal mf-tone-income/);
 assert.match(source,/u3-clickable-card mf-border-reveal mf-tone-warning/);
 assert.match(budgets,/\.u3-accounts \.u3-account-summary > :nth-child\(3\)\s*\{\s*border-top-color:\s*var\(--green\)/);
});
test('V1.3 — foco, hover restrito ao mouse e movimento reduzido preservados',()=>{
 assert.match(layer,/@media \(hover:hover\) and \(pointer:fine\)/);
 assert.match(layer,/translate3d\(0,-2px,0\) scale\(1\.022\)/);
 assert.match(layer,/240ms var\(--mf-hover-ease\)/);
 assert.match(layer,/:is\(:focus-visible,:focus-within\)::after/);
 assert.match(layer,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(layer,/transform:none!important/);
 assert.match(layer,/transition:none!important/);
 assert.doesNotMatch(layer,/cursor:pointer|overflow:hidden/);
});
test('V1.3 — não amplia o efeito indiscriminadamente a formulários e IA',()=>{
 for(const selector of ['.u1-shell .u1-overview > .stats-grid','.u2-shell .u2-metrics',
    '.u3-budgets .mf-budget-summary','.u3-accounts .u3-account-summary']){
   assert(layer.includes(selector),'Missing scope '+selector);
 }
 assert.doesNotMatch(layer,/\.mf-ai-card|\.u3-simulator \.sim-form-card|\.mf-detail-drawer/);
 const excluded=premium.slice(0,start);
 for(const cls of ['.u1-shell .u1-metric:hover:not(.mf-border-reveal)',
   '.u2-shell .u2-metric:hover:not(.mf-border-reveal)',
   '.u3-budgets .mf-budget-summary > div:hover:not(.mf-border-reveal)',
   '.u3-accounts .u3-account-summary > .card:hover:not(.mf-border-reveal)'])
   assert(excluded.includes(cls),'Generic hover still overrides '+cls);
});
