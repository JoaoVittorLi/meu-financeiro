'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const premium=read('app/premium-interactions.css');
const overview=read('app/overview.css');
const source=read('src/app.ts');
const html=read('app/index.html');
const v1=premium.slice(premium.indexOf('/* V1.1 — semantic border reveal'));
const cardSelector='.u1-shell .u1-overview > .stats-grid > :is(.u1-balance,.u1-metric)';

test('V1.1 — o estado base mantém superfície, tipografia, topo colorido e grid estável',()=>{
 assert(v1.length>500,'V1.1 block missing');
 assert.match(overview,/\.u1-overview > \.stats-grid\s*\{[^}]*grid-template-columns:[^}]*gap: 14px/s);
 assert.match(overview,/\.u1-balance,\s*\.u1-metric\s*\{[^}]*background: var\(--surface\)/s);
 assert.match(overview,/\.u1-balance\s*\{[^}]*border-top: 3px solid var\(--u1-accent\)/s);
 assert.match(overview,/\.u1-metric\.income\s*\{\s*border-top: 3px solid var\(--green\)/);
 assert.match(overview,/\.u1-metric\.expense\s*\{\s*border-top: 3px solid var\(--red\)/);
 assert.doesNotMatch(v1,/(?:^|\n)\s*background-color\s*:/);
 assert.doesNotMatch(v1,/(?:^|\n)\s*width\s*:/);
 assert.doesNotMatch(v1,/(?:^|\n)\s*height\s*:/);
});

test('V1.1 — linha do topo se torna moldura completa somente com hover/foco',()=>{
 assert.match(v1,/@property --mf-v1-border-progress\s*\{[^}]*syntax:\s*"<angle>"[^}]*initial-value:\s*0deg/s);
 assert.match(v1,/conic-gradient\(from -90deg,/);
 assert.match(v1,/var\(--mf-v1-border-tone\) 0deg var\(--mf-v1-border-progress\)/);
 assert.match(v1,/-webkit-mask-composite:\s*xor;/);
 assert.match(v1,/mask-composite:\s*exclude;/);
 assert.match(v1,/padding:\s*2px;/);
 assert.match(v1,/pointer-events:\s*none;/);
 assert.match(v1,/--mf-v1-border-progress:\s*0deg;/);
 assert.match(v1,/--mf-v1-border-progress:\s*360deg;/);
 assert.match(v1,/transition:\s*--mf-v1-border-progress\s+235ms/);
 assert(v1.includes(cardSelector+'::after'));
});

test('V1.1 — cores semânticas não herdam verde universal nem cinza arbitrário',()=>{
 assert.match(v1,/\.u1-metric\.income\s*\{\s*--mf-v1-border-tone:\s*var\(--green\)/);
 assert.match(v1,/\.u1-metric\.expense\s*\{\s*--mf-v1-border-tone:\s*var\(--red\)/);
 assert.match(v1,/\.u1-metric\.net\.is-positive\s*\{\s*--mf-v1-border-tone:\s*var\(--green\)/);
 assert.match(v1,/\.u1-metric\.net\.is-negative\s*\{\s*--mf-v1-border-tone:\s*var\(--red\)/);
 assert.match(v1,/--mf-v1-border-tone:\s*var\(--u1-accent\)/);
 assert.match(v1,/border-top-color:\s*var\(--mf-v1-border-tone\)/);
 assert.match(source,/tone==='net'\?\(value>0\?' is-positive':value<0\?' is-negative':' is-neutral'\)/);
});

test('V1.1 — escala contida, sem reflow e mantendo card escuro no tema escuro',()=>{
 assert.match(v1,/@media\s*\(hover:hover\) and \(pointer:fine\)/);
 assert.match(v1,/translate3d\(0,-2px,0\) scale\(1\.022\)/);
 assert.match(v1,/transition:\s*transform\s+230ms/);
 assert.match(v1,/animation-fill-mode:\s*backwards/);
 assert.match(v1,/border-color:\s*var\(--border\)/);
 assert.doesNotMatch(v1,/transform:\s*scale\(1\.0[5-9]/);
 assert.doesNotMatch(v1,/background:\s*var\(--(?:green|red)\)/);
 assert.match(overview,/\[data-theme="dark"\] \.u1-shell/);
});

test('V1.1 — quatro grupos focáveis e movimento reduzido sem perder a moldura',()=>{
 assert.match(source,/className:'u1-balance',role:'group',tabIndex:0/);
 assert.match(source,/className:'u1-metric '\+tone[^;]*role:'group',tabIndex:0/);
 assert.match(v1,/:focus-visible,:focus-within/);
 assert.match(v1,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(v1,/transform:\s*none !important/);
 assert.match(v1,/transition:\s*none !important/);
 assert.match(v1,/outline:\s*2px solid var\(--mf-v1-border-tone\)/);
});

test('V1.1 — CSS de hover é o último carregado; não invade cards da Inteligência',()=>{
 const links=[...html.matchAll(/href="([^"]+\.css)"/g)].map(x=>x[1]);
 assert.equal(links.at(-1),'premium-interactions.css');
 assert.equal(new Set(links).size,links.length);
 assert(v1.includes(cardSelector));
 assert.doesNotMatch(v1,/\.mf-ai-(?:example|action|thread|drawer)/);
});
