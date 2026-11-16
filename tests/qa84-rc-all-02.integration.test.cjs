'use strict';
/* RC-ALL-02 targeted contracts supplement, never substitute, the real Electron/SQLite gate. */
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function jsonLiteral(source,prefix,suffix){
 const start=source.indexOf(prefix);
 assert(start>=0,'source declaration missing: '+prefix);
 const a=start+prefix.length,b=source.indexOf(suffix,a);
 assert(b>a,'source terminator missing: '+prefix);
 return JSON.parse(source.slice(a,b));
}
test('RC2/D05: 14 approved parents, 61 distinct subcategories and 67 local glyphs',()=>{
 const source=read('src/d05-visual-assets.ts'),
  parents=jsonLiteral(source,'const D05_APPROVED_PARENTS:any[]=',';'),
  glyphs=jsonLiteral(source,'const D05_APPROVED_GLYPHS:{[key:string]:string}=',';');
 assert.equal(parents.length,14);
 const children=parents.flatMap(p=>p.subcategories||[]);
 assert.equal(children.length,61);
 assert.equal(Object.keys(glyphs).length,67);
 assert.equal(new Set(parents.map(p=>p.id)).size,14);
 assert.equal(new Set(children.map(p=>p.id)).size,61);
 assert(children.every(p=>parents.some(parent=>parent.id===p.parentId)));
 for(const c of [...parents,...children])assert.equal(typeof glyphs[c.iconKey],'string',c.id);
});
test('RC2/D05: the same canonical resolver returns stable parent/child identity',()=>{
 const source=read('src/d05-visual-assets.ts'),js=ts.transpileModule(source,{
  compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}
 }).outputText;
 const ctx={h:()=>null,Icon:()=>null,console};
 vm.createContext(ctx);vm.runInContext(js,ctx,{timeout:1500});
 const parent=ctx.resolveCategoryVisualIdentity({categoryId:'cat:assinaturas',aggregate:true});
 const child=ctx.resolveCategoryVisualIdentity({categoryId:'cat:assinaturas',
  subcategoryId:'sub:assinaturas/streaming'});
 assert.equal(parent.iconKey,'repeat-2');assert.equal(parent.hue,282);
 assert.equal(child.iconKey,'tv');assert.equal(child.hue,270);
 assert.equal(child.categoryId,parent.categoryId);
 assert.equal(child.subcategoryId,'sub:assinaturas/streaming');
});
test('RC2/loader: TS module-none includes B01-B05 with unique paths and CSS hooks',()=>{
 const conf=JSON.parse(read('tsconfig.json')),html=read('app/index.html'),
  paths=['src/qa84-overview.ts','src/qa84-budgets.ts','src/d05-movements.ts',
   'src/qa84-b03-b04-bridge.ts','src/intelligence-b05-finance.ts',
   'src/intelligence-b05-motion.ts','src/intelligence-b05-today.ts',
   'src/intelligence-b05-chat.ts','src/intelligence-b05-actions.ts'];
 assert.equal(conf.compilerOptions.module,'none');
 assert.equal(new Set(conf.files).size,conf.files.length);
 for(const p of paths)assert(conf.files.includes(p),p);
 for(const css of ['qa84-b01-b02.css','d05-movements.css','intelligence-b05.css'])
  assert(html.includes(css),css);
 const bridge=read('src/qa84-b03-b04-bridge.ts');
 assert(bridge.includes('resolveCategoryVisualIdentity'));
 const overview=read('src/qa84-overview.ts');
 const budgets=read('src/qa84-budgets.ts');
 assert(overview.includes('resolveCategoryVisualIdentity'));
 assert(budgets.includes('resolveCategoryVisualIdentity'));
});
test('RC2/security: Electron 45 uses bundled preload with sandbox and isolation',()=>{
 const main=read('electron/main.cjs'),preload=read('electron/preload.cjs');
 assert(/preload-bundled\.cjs/.test(main));
 assert(/sandbox\s*:\s*true/.test(main));
 assert(/contextIsolation\s*:\s*true/.test(main));
 assert(/nodeIntegration\s*:\s*false/.test(main));
 assert(preload.length>0);
});
test('RC2/no-write: B05 UI never calls personal IPC mutation methods directly',()=>{
 const names=['finance','motion','today','chat','actions'];
 for(const name of names){
  const source=read('src/intelligence-b05-'+name+'.ts');
  assert(!/\b(bankCategorize|bankBatch|bankSplit|planCreate|planEdit|categoryReviewConfirm|db\.save)\s*\(/.test(source),name);
 }
});
