'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('app/premium-interactions.css');
const html=read('app/index.html');
const plan=read('src/plan-view.ts');
const app=read('src/app.ts');
const oldCss=read('app/style.css');
const hoverCss=['overview','operations','decisions','refinement','intelligence'].map(x=>read('app/'+x+'.css'));
test('D1.5 — premium interactions CSS is loaded after every existing page stylesheet',()=>{
 const links=[...html.matchAll(/href="([^"]+\.css)"/g)].map(x=>x[1]);
 assert.equal(links.at(-1),'premium-interactions.css');
 assert.equal(new Set(links).size,links.length);
 assert(links.includes('overview.css')&&links.includes('operations.css')&&
  links.includes('decisions.css')&&links.includes('refinement.css')&&links.includes('intelligence.css'));
});
test('D1.5 — hovering a metric uses movement, depth and mint stroke (not gray --subtle)',()=>{
 assert.match(css,/--mf-hover-stroke:rgba\(8,126,73/);
 assert.match(css,/--mf-hover-shadow:/);
 assert.match(css,/\.u1-shell \.u1-metric:hover/);
 assert.match(css,/\.u2-shell \.u2-metric:hover/);
 assert.match(css,/translate3d\(0,-2px,0\) scale\(1\.008\)/);
 assert.match(css,/translate3d\(0,-3px,0\) scale\(1\.01\)/);
});
test('D1.5 — interactions cover all eight areas without blanket .card:hover',()=>{
 for(const selector of ['.u1-shell .u1-account:hover','.u1-shell .u1-recent-row:hover',
  '.u2-planning .p-upcoming-row:hover','.u3-budgets .mf-budget-card',
  '.u3-accounts .u3-account-card:hover','.u3-simulator .result-metrics',
  '.mf-ai-example-card:hover','.mf-settings-content .settings-card:hover'])
  assert(css.includes(selector),'Missing scope '+selector);
 assert.doesNotMatch(css,/(^|\n)\s*\.card:hover/m);
});
test('D1.5 — preserves budget warning strokes and informational card pointer semantics',()=>{
 assert.match(css,/\.mf-budget-card:not\(\.mf-budget-exceeded\):not\(\.mf-budget-near\):hover/);
 assert.match(css,/\.mf-budget-card:is\(\.mf-budget-exceeded,\.mf-budget-near\):hover/);
 assert.doesNotMatch(css,/cursor:\s*pointer/);
});
test('D1.5 — reduced motion stops transforms and transitions while focus remains visible',()=>{
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(css,/transform:none!important/);
 assert.match(css,/transition:none!important/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/:focus-within/);
 assert.match(css,/outline:2px solid var\(--focus\)/);
});
test('D1.5 — hover effects use pointer precision and do not affect touch scrolling',()=>{
 assert.match(css,/@media \(hover:hover\) and \(pointer:fine\)/);
 assert.match(css,/transition:transform 210ms var\(--mf-hover-ease\)/);
 assert.match(css,/cubic-bezier\(\.22,1,\.36,1\)/);
});
test('D1.5 — light and dark detail sections use current theme tokens, not legacy violet RGB',()=>{
 assert.match(oldCss,/\.mf-detail-section\{[^}]*rgba\(25,22,34,/);
 assert.match(css,/\.mf-detail-drawer \.mf-detail-section\{\s*background:var\(--surface2\)/);
 assert.match(css,/\.mf-detail-drawer \.mf-detail-hero\{/);
 assert.match(css,/radial-gradient\(ellipse at 50% 0%,var\(--mf-hover-glow\)/);
 assert.match(css,/scrollbar-color:var\(--surface3\) transparent/);
 assert.match(css,/\[data-theme="dark"\]\{/);
 assert.match(css,/\[data-theme="light"\]\{/);
});
test('D1.5 — expense and income use semantic color tokens, no legacy purple literals in planning SVG',()=>{
 for(const legacy of ['#8f51ff','#ad7aff','#7b5dff','#d5bcff','#9265ff','#e6d4ff','#9963ff'])
  assert(!plan.includes(legacy),'Plan chart still has legacy purple '+legacy);
 assert.match(plan,/stopColor:'var\(--green\)'/);
 assert.match(plan,/stroke:'var\(--muted\)'/);
});
test('D1.5 — manual editor has theme-aware danger and linked warnings',()=>{
 assert.match(css,/\.mf-detail-drawer \.mf-danger-action\{/);
 assert.match(css,/border:1px solid var\(--red\)/);
 assert.match(css,/background:var\(--negative-bg\)/);
 assert.match(css,/\.mf-manual-warning/);
 assert.match(app,/this\.isManualLinked\(manual\.id\)/);
});
test('D1.5 — linked manual calendar cannot be opened, date validation rejects rollover',()=>{
 assert.match(app,/toggle=\(\)=>\{if\(this\.props\.disabled\)return;/);
 assert.match(app,/className:'mf-date-trigger',disabled:this\.props\.disabled/);
 assert.match(app,/iso\(fromISO\(draft\.date\)\)!==draft\.date/);
 assert.match(app,/iso\(fromISO\(f\.date\)\)!==f\.date/);
});
test('D1.5 — CSS selectors retain balanced rule delimiters and no external resources',()=>{
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
 assert.doesNotMatch(css,/url\(\s*['"]?https?:/);
 assert.equal(hoverCss.length,5);
});
