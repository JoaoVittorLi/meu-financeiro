'use strict';
// Real Electron/CDP only. Reuses the official fail-closed profile/SQLite isolation.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {start,evaluate,closeCleanly,createSyntheticProfile,visualMatrix,SMOKE_VIEWS,SMOKE_PRESETS,waitForEmulatedViewport}=require('./d1-electron-smoke.cjs');
const FAMILIES={overview:'.u1-metric',movements:'.u2-metric',bank:'.u1-account',budgetSummary:'.mf-budget-summary > div',budgets:'.mf-budget-card',accountSummary:'.u3-account-summary > .card',accounts:'.u3-account-card',simulator:'.result-metrics > div',settings:'.settings-card',intelligence:'.mf-ai-example-card,.mf-ai-action-card,.mf-work-radar > *',planning:'.p-upcoming-row'};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function sample(cdp,id){return evaluate(cdp,`const e=document.querySelector('[data-mf-product-qa="${id}"]');if(!e)throw Error('Card disappeared');const s=getComputedStyle(e),p=getComputedStyle(e,'::before'),r=e.getBoundingClientRect();return {text:e.textContent.trim().slice(0,140),classes:e.className,hover:e.matches(':hover'),tone:s.getPropertyValue('--mf-border-tone').trim(),color:s.color,background:s.backgroundColor,border:s.borderColor,transform:s.transform,transition:s.transition,animation:s.animation,pseudo:{content:p.content,background:p.background,border:p.border,mask:p.mask,transform:p.transform},rect:{x:r.x,y:r.y,width:r.width,height:r.height}};`);}
async function run(){
 const output=process.env.MF_PRODUCT_QA_OUTPUT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'mf-product-evidence-'));fs.mkdirSync(output,{recursive:true});
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d1-electron-'));
 const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),version:require('../package.json').version,platform:process.platform,node:process.version,profile:'DISPOSABLE_SYNTHETIC_ONLY',startedAt:new Date().toISOString(),runtimeExceptions:[],consoleErrors:[],hovers:[],coverage:[],reviewRequired:['Visual geometry/contrast','Eight-area full functional checklist','B3 animation','Demo allow/deny/stale, history/expansion','Keyboard focus trap and return','Live chat UI flow after integration'],status:'RUNNING'};
 let running;
 try{
  createSyntheticProfile(profile);running=await start(profile);const {cdp}=running;
  cdp.socket.addEventListener('message',event=>{let m;try{m=JSON.parse(event.data)}catch{return;}if(m.method==='Runtime.exceptionThrown')report.runtimeExceptions.push(m.params);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')report.consoleErrors.push(m.params);});
  const info=await evaluate(cdp,'return await window.financeDesktop.info()');assert.equal(path.resolve(info.path),path.join(profile,'meu-financeiro.sqlite'));assert.deepEqual(info.integrity,['ok']);
  process.env.MF_SMOKE_OUTPUT_DIR=path.join(output,'pages');report.matrix=await visualMatrix(cdp);
  for(const cfg of SMOKE_PRESETS){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width:cfg.width,height:cfg.height,deviceScaleFactor:1,mobile:false});
   await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:cfg.motion},{name:'prefers-color-scheme',value:cfg.theme}]});
   await waitForEmulatedViewport(cdp,cfg);await evaluate(cdp,`window.MFAppearance.set(${JSON.stringify(cfg.theme)});return true`);
   for(let pageIndex=0;pageIndex<SMOKE_VIEWS.length;pageIndex++){
    const page=SMOKE_VIEWS[pageIndex];await evaluate(cdp,`[...document.querySelectorAll('button.nav-item')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(page)}).click();return true;`);await delay(350);
    const counts=await evaluate(cdp,`return Object.fromEntries(Object.entries(${JSON.stringify(FAMILIES)}).map(([family,selector])=>[family,[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length>0).map((e,i)=>{const id=family+'-'+i;e.dataset.mfProductQa=id;return id;})]));`);
    report.coverage.push({page,...cfg,counts:Object.fromEntries(Object.entries(counts).map(([f,ids])=>[f,ids.length]))});
    for(const [family,ids] of Object.entries(counts))for(let index=0;index<ids.length;index++){
     const id=ids[index];await evaluate(cdp,`document.querySelector('[data-mf-product-qa="${id}"]').scrollIntoView({block:'center'});return true;`);await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await delay(650);
     const normal=await sample(cdp,id),files={};
     const capture=async state=>{if(index!==0)return;const file=[cfg.width,cfg.height,cfg.theme,cfg.motion,pageIndex,family,state].join('-')+'.png';const png=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});const bytes=Buffer.from(png.data,'base64');assert(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')));fs.writeFileSync(path.join(output,file),bytes);files[state]=file;};
     await capture('normal');const r=normal.rect,x=Math.max(2,Math.min(cfg.width-2,r.x+r.width/2)),y=Math.max(2,Math.min(cfg.height-2,r.y+r.height/2));
     await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await delay(650);const hover=await sample(cdp,id);await capture('hover');
     await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await delay(650);const returned=await sample(cdp,id);await capture('return');
     report.hovers.push({page,...cfg,family,id,normal,hover,returned,files,classification:!hover.hover?'NOT_EXECUTED_POINTER':normal.tone!==hover.tone?'TONE_CHANGED_REVIEW':'REVIEW_SCREENSHOTS_AND_COMPUTED_STYLES'});
    }
    await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    report.coverage[report.coverage.length-1].focus=await evaluate(cdp,'const e=document.activeElement,s=getComputedStyle(e);return {tag:e.tagName,label:e.getAttribute("aria-label")||e.textContent.slice(0,90),outline:s.outline};');
   }
  }
  const live=await evaluate(cdp,'return typeof window.financeDesktop.localFinancialAuthorize==="function"');report.localFinancial=live?'IPC_PRESENT_UI_QA_PENDING':'NOT_IN_THIS_BRANCH';
  await closeCleanly(running);running=null;
  assert.equal(report.runtimeExceptions.length,0,'Unexpected renderer exceptions');assert.equal(report.consoleErrors.length,0,'Unexpected console errors');assert(report.hovers.some(h=>h.hover.hover),'No genuine pointer hover captured');
  report.status='CAPTURED_REQUIRES_HUMAN_VISUAL_REVIEW';console.log('PASS real captures; manual visual/functional review remains mandatory.');
 }catch(e){report.status='FAIL';report.error=e.stack;throw e;}
 finally{if(running){running.child.kill();try{running.cdp.socket.close()}catch{}}fs.writeFileSync(path.join(output,'product-qa.json'),JSON.stringify(report,null,2)+'\n');assert.equal(path.dirname(path.resolve(profile)),path.resolve(os.tmpdir()));assert(path.basename(profile).startsWith('mf-d1-electron-'));fs.rmSync(profile,{recursive:true,force:true});}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={FAMILIES,sample};
