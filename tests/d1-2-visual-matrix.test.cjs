'use strict';
// Mocked CDP protocol assertions complement (never replace) the real GUI smoke.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {visualMatrix,SMOKE_VIEWS,SMOKE_PRESETS}=require('../scripts/d1-electron-smoke.cjs');
const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(350,0)]);
function fakeCDP({overflow=false,invalidImage=false,scrollbarWidth=0,
 viewportWidthDelta=0,delayedViewportChecks=0}={}){
 let viewport={width:1366,height:768},motion='no-preference',theme='light';
 const calls={screenshots:0,navigations:0,viewportChecks:0};
 const send=async(method,params={})=>{
  if(method==='Page.enable')return {};
  if(method==='Emulation.setDeviceMetricsOverride'){viewport=params;return {};}
  if(method==='Emulation.setEmulatedMedia'){
   motion=params.features.find(f=>f.name==='prefers-reduced-motion').value;
   theme=params.features.find(f=>f.name==='prefers-color-scheme').value;
   return {};
  }
  if(method==='Runtime.evaluate'){
   const expr=params.expression;
   if(expr.includes('return {width:window.innerWidth')){
    calls.viewportChecks++;
    const lag=calls.viewportChecks<=delayedViewportChecks?100:0;
    return {result:{value:{width:viewport.width+viewportWidthDelta-lag,
     height:viewport.height,clientWidth:viewport.width+viewportWidthDelta-scrollbarWidth-lag}}};
   }
   if(expr.includes('window.MFAppearance.set('))return {result:{value:theme}};
   const token=expr.match(/const label=("(?:[^"\\]|\\.)*");/);
   assert(token,'Expected actual DOM navigation expression');
   const label=JSON.parse(token[1]);
   calls.navigations++;
   return {result:{value:{
    title:label,selected:'page',
    viewportWidth:viewport.width+viewportWidthDelta,viewportHeight:viewport.height,
    contentWidth:viewport.width+viewportWidthDelta-scrollbarWidth,
    scrollWidth:viewport.width+viewportWidthDelta-scrollbarWidth+(overflow?75:0),
    theme,reduced:motion==='reduce'
   }}};
  }
  if(method==='Page.captureScreenshot'){
   calls.screenshots++;
   return {data:(invalidImage?Buffer.alloc(400):png).toString('base64')};
  }
  throw Error('Unexpected CDP command '+method);
 };
 return {send,calls};
}
async function isolated(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d1-visual-test-'));
 const original=process.env.MF_SMOKE_OUTPUT_DIR;
 try{process.env.MF_SMOKE_OUTPUT_DIR=dir;await fn(dir);}
 finally{
  if(original===undefined)delete process.env.MF_SMOKE_OUTPUT_DIR;
  else process.env.MF_SMOKE_OUTPUT_DIR=original;
  fs.rmSync(dir,{recursive:true,force:true});
 }
}
test('D1.3 — 32 capturas válidas cobrem duas resoluções, temas, movimento e 8 áreas',()=>isolated(async dir=>{
 const expectedScreenshots=SMOKE_VIEWS.length*SMOKE_PRESETS.length;
 assert.equal(expectedScreenshots,32,'A matriz Premium exige 8 áreas × 4 configurações');
 const cdp=fakeCDP(),result=await visualMatrix(cdp);
 assert.equal(result.count,expectedScreenshots);
 assert.equal(cdp.calls.navigations,expectedScreenshots);
 assert.equal(cdp.calls.screenshots,expectedScreenshots);
 const shots=fs.readdirSync(dir).filter(f=>f.endsWith('.png'));
 assert.equal(shots.length,expectedScreenshots);
 assert.equal(new Set(shots).size,expectedScreenshots,'Nomes PNG devem ser únicos');
 for(const shot of shots)assert(fs.readFileSync(path.join(dir,shot)).subarray(0,8).equals(png.subarray(0,8)));
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'visual-matrix.json'),'utf8'));
 assert.equal(manifest.length,expectedScreenshots);
 assert.deepEqual(new Set(manifest.map(x=>x.screenshot)),new Set(shots),'Manifesto deve listar todos os PNGs');
 assert.deepEqual(new Set(manifest.map(x=>x.width+'x'+x.height)),new Set(['1366x768','1920x1080']));
 assert.deepEqual(new Set(manifest.map(x=>x.width)),new Set([1366,1920]));
 assert.deepEqual(new Set(manifest.map(x=>x.theme)),new Set(['light','dark']));
 assert(manifest.some(x=>x.reduced===true));
 assert(manifest.some(x=>x.reduced===false));
 assert.deepEqual(new Set(manifest.map(x=>x.page)),new Set(SMOKE_VIEWS));
 assert.deepEqual(new Set(manifest.map(x=>x.theme+'/'+x.reduced)),
  new Set(SMOKE_PRESETS.map(x=>x.theme+'/'+(x.motion==='reduce'))));
}));
test('D1.4 — scrollbar clássica de 17px não reduz artificialmente o viewport emulado',()=>isolated(async dir=>{
 const result=await visualMatrix(fakeCDP({scrollbarWidth:17}));
 assert.equal(result.count,32);
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'visual-matrix.json'),'utf8'));
 assert.equal(rows.length,32);
 for(const row of rows){
  assert.equal(row.viewportWidth,row.width);
  assert.equal(row.viewportHeight,row.height);
  assert.equal(row.contentWidth,row.width-17);
  assert.equal(row.scrollWidth,row.contentWidth);
 }
}));
test('D1.4 — aguarda a aplicação assíncrona das métricas CDP antes de capturar',()=>isolated(async dir=>{
 const cdp=fakeCDP({delayedViewportChecks:3});
 const result=await visualMatrix(cdp);
 assert.equal(result.count,32);
 assert(cdp.calls.viewportChecks>=7,'Aguardou a aplicação inicial e os outros três presets');
}));
test('D1.4 — viewport genuinamente incorreto reprova com diagnóstico e sem manifesto',()=>isolated(async dir=>{
 const cdp=fakeCDP({viewportWidthDelta:-120});
 await assert.rejects(()=>visualMatrix(cdp),/Viewport emulado não aplicado: esperado 1366x768, observado 1246x768/);
 assert.equal(cdp.calls.screenshots,0);
 assert.equal(fs.existsSync(path.join(dir,'visual-matrix.json')),false);
}));
test('D1.2 — overflow horizontal reprova matriz, não publica resultado de sucesso',()=>isolated(async dir=>{
 await assert.rejects(()=>visualMatrix(fakeCDP({overflow:true})),/Overflow horizontal global/);
 assert.equal(fs.existsSync(path.join(dir,'visual-matrix.json')),false);
}));
test('D1.2 — captura corrompida reprova matriz e não gera manifesto',()=>isolated(async dir=>{
 await assert.rejects(()=>visualMatrix(fakeCDP({invalidImage:true})),/imagem PNG íntegra/);
 assert.equal(fs.existsSync(path.join(dir,'visual-matrix.json')),false);
}));
