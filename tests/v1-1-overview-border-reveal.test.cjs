'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const premium=read('app/premium-interactions.css');
const overview=read('app/overview.css');
const source=read('src/app.ts');
const html=read('app/index.html');
const v3=premium.slice(premium.indexOf('/* V1.3 — shared semantic outline'));

test('V1.1 regressão — superfície e topo não mudam de altura com V1.3',()=>{
 assert.match(overview,/\.u1-overview > \.stats-grid\s*\{[^}]*grid-template-columns:[^}]*gap: 14px/s);
 assert.match(overview,/\.u1-balance,\s*\.u1-metric\s*\{[^}]*background: var\(--surface\)/s);
 assert.match(overview,/\.u1-balance\s*\{[^}]*border-top: 3px solid var\(--u1-accent\)/s);
 assert.match(overview,/\.u1-metric\.income\s*\{\s*border-top: 3px solid var\(--green\)/);
 assert.match(overview,/\.u1-metric\.expense\s*\{\s*border-top: 3px solid var\(--red\)/);
 assert.match(v3,/border-top-color:transparent/);
 assert.match(v3,/border:3px solid var\(--mf-border-tone\)/);
 assert.doesNotMatch(v3,/background:\s*(?:var\(--green\)|var\(--red\))/);
});
test('V1.1 regressão — uma única borda no mesmo perímetro, sem anel interno',()=>{
 assert.match(v3,/@property --mf-border-sweep\s*\{syntax:"<angle>";inherits:false;initial-value:0deg\}/);
 assert.match(v3,/position:absolute;inset:-1px;box-sizing:border-box/);
 assert.match(v3,/border:3px solid var\(--mf-border-tone\);border-radius:inherit/);
 assert.match(v3,/linear-gradient\(to bottom,#000 0 3px,transparent 3px\)/);
 assert.match(v3,/conic-gradient\(from 45deg/);
 assert.match(v3,/--mf-border-sweep:0deg/);
 assert.match(v3,/--mf-border-sweep:360deg/);
 assert.match(v3,/pointer-events:none/);
 assert.doesNotMatch(premium,/--mf-v1-border-progress|--mf-v1-border-tone|mask-composite:\s*exclude|padding:\s*2px;\s*pointer-events/);
});
test('V1.1 regressão — variáveis semânticas e resultado dependente do sinal',()=>{
 for(const [tone,token] of [['income','--green'],['expense','--red'],['balance','--u1-accent'],['warning','--warning']]){
   assert(premium.includes('mf-tone-'+tone),'Missing tone '+tone);
   assert(premium.includes('var('+token),'Missing semantic token '+token);
 }
 assert.match(v3,/\.mf-border-reveal\.mf-tone-net\.is-positive/);
 assert.match(v3,/\.mf-border-reveal\.mf-tone-net\.is-negative/);
 assert.match(v3,/\.mf-border-reveal\.mf-tone-net\.is-neutral/);
 assert.match(source,/tone==='net'\?\(value>0\?' is-positive':value<0\?' is-negative':' is-neutral'\)/);
});
test('V1.1 regressão — hover Premium mantido sem reflow',()=>{
 assert.match(v3,/@media \(hover:hover\) and \(pointer:fine\)/);
 assert.match(v3,/translate3d\(0,-2px,0\) scale\(1\.022\)/);
 assert.match(v3,/transform 230ms var\(--mf-hover-ease\)/);
 assert.match(v3,/animation-fill-mode:backwards/);
 assert.doesNotMatch(v3,/\bwidth:\s*calc|\bheight:\s*calc/);
 assert.match(overview,/\[data-theme="dark"\] \.u1-shell/);
});
test('V1.1 regressão — foco integrado e reduced-motion',()=>{
 assert.match(source,/className:'u1-balance mf-border-reveal mf-tone-balance',role:'group',tabIndex:0/);
 assert.match(source,/className:'u1-metric mf-border-reveal mf-tone-'/);
 assert.match(v3,/:is\(:focus-visible,:focus-within\)::after/);
 assert.match(v3,/outline:none/);
 assert.match(v3,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(v3,/transform:none!important/);
 assert.match(v3,/transition:none!important/);
});
test('V1.1 regressão — stylesheet final e classe limitada a resumos financeiros',()=>{
 const links=[...html.matchAll(/href="([^"]+\.css)"/g)].map(x=>x[1]);
 assert.equal(links.at(-1),'premium-interactions.css');
 assert.equal(new Set(links).size,links.length);
 for(const scope of ['.u1-shell .u1-overview > .stats-grid','.u2-shell .u2-metrics','.u3-budgets .mf-budget-summary','.u3-accounts .u3-account-summary'])
   assert(premium.includes(scope),'Missing scope '+scope);
 assert.doesNotMatch(v3,/\.mf-ai-(?:example|action|thread|drawer)/);
});
