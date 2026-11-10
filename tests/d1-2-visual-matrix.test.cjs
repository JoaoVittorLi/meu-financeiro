'use strict';
// Mocked CDP protocol assertions complement (never replace) the real GUI smoke.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {visualMatrix,SMOKE_VIEWS,SMOKE_PRESETS}=require('../scripts/d1-electron-smoke.cjs');
const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(350,0)]);
function fakeCDP({overflow=false,invalidImage=false}={}){
 let viewport={width:1366,height:768},motion='no-preference',theme='light';
 const calls={screenshots:0,navigations:0};
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
   if(expr.includes('window.MFAppearance.set('))return {result:{value:theme}};
   const token=expr.match(/const label=("(?:[^"\\]|\\.)*");/);
   assert(token,'Expected actual DOM navigation expression');
   const label=JSON.parse(token[1]);
   calls.navigations++;
   return {result:{value:{
    title:label,selected:'page',width:viewport.width,
    scrollWidth:viewport.width+(overflow?75:0),theme,reduced:motion==='reduce'
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
test('D1.2 — overflow horizontal reprova matriz, não publica resultado de sucesso',()=>isolated(async dir=>{
 await assert.rejects(()=>visualMatrix(fakeCDP({overflow:true})),/Overflow horizontal global/);
 assert.equal(fs.existsSync(path.join(dir,'visual-matrix.json')),false);
}));
test('D1.2 — captura corrompida reprova matriz e não gera manifesto',()=>isolated(async dir=>{
 await assert.rejects(()=>visualMatrix(fakeCDP({invalidImage:true})),/imagem PNG íntegra/);
 assert.equal(fs.existsSync(path.join(dir,'visual-matrix.json')),false);
}));
