'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const overview=read('app/overview.css');
const intelligence=read('app/intelligence.css').split('/* R0/R1')[0];
const premium=read('app/premium-interactions.css');
const app=read('src/app.ts');
const ai=read('src/intelligence-view.ts');
const html=read('app/index.html');
const rule=(css,selector)=>{
 const start=css.indexOf(selector+' {');
 assert(start>=0,'Selector missing: '+selector);
 const open=css.indexOf('{',start),close=css.indexOf('}',open+1);
 assert(close>open,'CSS block missing: '+selector);
 return css.slice(open+1,close);
};
test('V1.2 — categorias não avançam além do painel e acomodam valores longos',()=>{
 const row=rule(overview,'.u1-category-row');
 assert.match(row,/width:\s*100%/);
 assert.match(row,/margin-inline:\s*0/);
 assert.match(row,/min-width:\s*0/);
 assert.match(row,/grid-template-columns:\s*8px minmax\(0,/);
 assert.doesNotMatch(row,/calc\(100%\s*\+\s*16px\)|minmax\(100px/);
 const amount=rule(overview,'.u1-category-row strong');
 assert.match(amount,/overflow-wrap:\s*anywhere/);
 assert.match(amount,/min-width:\s*0/);
 assert.match(overview,/@media \(max-width: 600px\)\s*\{[\s\S]*?\.u1-category-row\s*\{[\s\S]*?grid-template-columns: 7px minmax\(0, 1fr\)/);
});
test('V1.2 — últimas movimentações preservam textos e valores sem truncamento',()=>{
 const row=rule(overview,'.u1-recent-row');
 assert.match(row,/width:\s*100%/);
 assert.match(row,/margin-inline:\s*0/);
 assert.match(row,/min-width:\s*0/);
 assert.doesNotMatch(row,/calc\(100%|margin-inline:\s*-8px/);
 for(const selector of ['.u1-recent-copy strong','.u1-recent-copy small','.u1-recent-row > strong']){
  const block=rule(overview,selector);
  assert.match(block,/overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(block,/text-overflow:\s*ellipsis|white-space:\s*nowrap/);
 }
});
test('V1.2 — 125% pode redistribuir grids sem zoom artificial ou remover painéis',()=>{
 const scoped=overview.slice(overview.indexOf('/* V1.2 alignment:'));
 assert.match(scoped,/@media \(max-width: 1180px\)\s*\{/);
 assert.match(scoped,/\.u1-main-grid,\s*\.u1-detail-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
 assert.match(scoped,/\.u1-overview > \.stats-grid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
 assert.doesNotMatch(scoped,/display:\s*none|visibility:\s*hidden|overflow:\s*hidden|transform:\s*scale/);
 assert.match(overview,/\.u1-detail-grid > \.u1-panel\s*\{\s*align-self: stretch/);
});
test('V1.2 — fonte, cobertura e orçamento mantêm cabeçalhos/valores legíveis',()=>{
 const scoped=overview.slice(overview.indexOf('/* V1.2 alignment:'));
 assert.match(scoped,/\.u1-overview \.u1-panel-head\s*\{\s*flex-wrap:\s*wrap/);
 assert.match(scoped,/\.u1-budget-summary,[\s\S]*?\.u1-coverage,[\s\S]*?overflow-wrap:\s*anywhere/);
 assert.match(scoped,/\.u1-coverage\s*\{\s*flex-wrap:\s*wrap/);
 for(const phrase of ['Fonte dos seus indicadores','Orçamento em foco','Últimas movimentações','Para onde foi seu dinheiro'])
  assert(app.includes(phrase));
});
test('V1.2 — Hoje separa cards, banner e laboratório mantendo preparar análise',()=>{
 const scoped=intelligence.slice(intelligence.indexOf('/* V1.2 — integrated intelligence alignment'));
 assert.match(scoped,/\.mf-intelligence-page \.mf-ai-today\s*\{\s*display:\s*grid;\s*gap:\s*16px/);
 assert.match(scoped,/\.mf-intelligence-page \.mf-ai-example-copy\s*\{[\s\S]*?min-width:\s*0/);
 assert.match(scoped,/\.mf-intelligence-page \.mf-ai-link\s*\{[\s\S]*?flex-wrap:\s*wrap/);
 assert.match(scoped,/\.mf-intelligence-page \.mf-ai-explainer > div\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
 assert.match(scoped,/\.mf-intelligence-page \.mf-ai-lab-disclosure > summary small\s*\{[\s\S]*?flex:\s*1 1 180px/);
 for(const phrase of ['Preparar análise','renderIntelligencePremiumToday','Laboratório de Inteligência'])
  assert(ai.includes(phrase));
});
test('V1.2 — chat lateral encolhe corretamente; modal mantém scroll interno e botões',()=>{
 const scoped=intelligence.slice(intelligence.indexOf('/* V1.2 — integrated intelligence alignment'));
 assert.match(scoped,/\.mf-ai-drawer\.mf-ai-drawer-compact \.mf-ai-drawer-head\s*\{\s*flex-wrap:\s*wrap/);
 assert.match(scoped,/\.mf-ai-drawer\.mf-ai-drawer-compact \.mf-ai-drawer-head-actions\s*\{[\s\S]*?flex-wrap:\s*wrap/);
 assert.match(scoped,/\.mf-ai-drawer \.mf-ai-drawer-body\s*\{\s*min-height:\s*0/);
 assert.match(scoped,/\.mf-ai-drawer\.mf-ai-drawer-compact \.mf-ai-drawer-composer\s*\{\s*flex:\s*0 0 auto/);
 assert.doesNotMatch(scoped,/display:\s*none|overflow:\s*hidden/);
 assert.match(ai,/className:'mf-ai-backdrop'/);
 assert.match(ai,/className:'mf-ai-drawer mf-ai-drawer-compact'/);
});
test('V1.2 — BUG-02 respeita superfície e contraste do tema claro sem afetar a V1.1',()=>{
 const scoped=premium.slice(premium.indexOf('/* V1.2 / BUG-02'));
 assert.match(scoped,/\.mf-detail-drawer \.mf-detail-section\s*\{[\s\S]*?padding:\s*16px 18px/);
 assert.match(scoped,/background:\s*var\(--surface2\)/);
 assert.match(scoped,/color:\s*var\(--text\)/);
 assert.doesNotMatch(scoped,/background:\s*(?:rgba\(25,22,34|#(?:0[0-9a-f]{5}|1[0-9a-f]{5}))/i);
 const links=[...html.matchAll(/href="([^"]+\.css)"/g)].map(x=>x[1]);
 assert.equal(links.at(-1),'premium-interactions.css');
 assert.match(premium,/--mf-border-sweep:\s*360deg/);
 assert.match(premium,/scale\(1\.022\)/);
});
test('V1.2 — patches são CSS puro, delimitadores balanceados e sem mudanças em dados',()=>{
 for(const [name,css] of [['overview',overview],['intelligence',intelligence],['premium',premium]]){
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,name+' CSS brace balance');
 }
 const scopes=[overview.slice(overview.indexOf('/* V1.2 alignment:')),
  intelligence.slice(intelligence.indexOf('/* V1.2 — integrated intelligence alignment')),
  premium.slice(premium.indexOf('/* V1.2 / BUG-02'))];
 for(const s of scopes){
  assert.doesNotMatch(s,/SELECT\s+|INSERT\s+|localStorage\.|bankCategorize|planSimulate|fetch\(/i);
  assert.doesNotMatch(s,/!important/);
 }
});
