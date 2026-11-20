'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Nível B UI fix 1 — App.toggleMode resets stale Movimentações & Orçamentos filters across mode switches',()=>{
 const appTs=read('src/app.ts');
 const start=appTs.indexOf('async toggleMode(');
 assert.notEqual(start,-1);
 const body=appTs.slice(start,start+1500);
 for(const field of [
  "query:''",
  "bankFilter:''",
  "txSource:'all'",
  "txCategoryFilter:''",
  "txKindFilter:'all'",
  "txReviewFilter:'all'",
  'txReviewOnly:false',
  'txOrganize:false',
  'txSelected:[]',
  'qa84TransactionsSpan:null',
  "qa84TransactionsCategory:''",
  'qa84BudgetDrill:null',
  'budgetFocus:null',
  "budgetSearch:''",
  'detail:null',
  'manualDraft:null',
  'quickCategory:null'
 ]){
  assert.ok(body.includes(field),`toggleMode must reset ${field}`);
 }
});

test('Nível B UI fix 2 — pTimeline SVG slider restores tabindex=0 via ref and guards setPointerCapture',()=>{
 const planTs=read('src/plan-view.ts');
 const sliderIdx=planTs.indexOf("role:'slider'");
 assert.notEqual(sliderIdx,-1);
 const slice=planTs.slice(Math.max(0,sliderIdx-80),sliderIdx+650);
 assert.match(slice,/el\.setAttribute\('tabindex','0'\)/);
 assert.match(slice,/onPointerDown:/);
 assert.match(slice,/e\.currentTarget\.focus\?\.\(\)/);
 assert.match(slice,/try\{e\.currentTarget\.setPointerCapture\(e\.pointerId\);\}catch\{\}/);
});

test('Nível B UI fix 3 — Planning editor modal stacks above Planning detail drawer but below select/calendar portals',()=>{
 const designCss=read('app/design-system.css');
 const styleCss=read('app/style.css');
 const mEditor=designCss.match(/\.p-editor-backdrop\{[^}]*z-index:(\d+)/);
 const mDrawer=styleCss.match(/\.mf-drawer-backdrop\{[^}]*z-index:(\d+)/);
 const mSelect=styleCss.match(/--mf-z-select-portal:(\d+)/);
 const mCal=styleCss.match(/\.mf-single-calendar\{[^}]*z-index:(\d+)/);
 assert.ok(mEditor,'p-editor-backdrop must define explicit z-index');
 assert.ok(mDrawer,'mf-drawer-backdrop z-index expected');
 assert.ok(mSelect,'--mf-z-select-portal expected');
 assert.ok(mCal,'mf-single-calendar z-index expected');
 const zEditor=Number(mEditor[1]),zDrawer=Number(mDrawer[1]),zSelect=Number(mSelect[1]),zCal=Number(mCal[1]);
 assert.ok(zEditor>zDrawer,`p-editor-backdrop (${zEditor}) must sit above mf-drawer-backdrop (${zDrawer})`);
 assert.ok(zEditor<zSelect,`p-editor-backdrop (${zEditor}) must sit below --mf-z-select-portal (${zSelect})`);
 assert.ok(zEditor<zCal,`p-editor-backdrop (${zEditor}) must sit below .mf-single-calendar (${zCal})`);

 const appTs=read('src/app.ts');
 const detailCall=appTs.indexOf('this.renderPlanDetail()');
 const modalCall=appTs.indexOf('this.renderPlanModal()');
 assert.notEqual(detailCall,-1);
 assert.notEqual(modalCall,-1);
 assert.ok(detailCall<modalCall,'renderPlanDetail() must appear before renderPlanModal() in DOM order');
});

test('Nível B UI fix 4 — onGlobalKeydown prioritizes planOpen modal over planSelected drawer for Escape and Tab focus trap',()=>{
 const appTs=read('src/app.ts');
 const start=appTs.indexOf('onGlobalKeydown=');
 assert.notEqual(start,-1);
 const body=appTs.slice(start,start+2200);
 const editorSelectorIdx=body.indexOf(".p-editor-backdrop [role=\"dialog\"]");
 const drawerSelectorIdx=body.indexOf('.mf-detail-drawer');
 assert.notEqual(editorSelectorIdx,-1,'onGlobalKeydown must query .p-editor-backdrop [role="dialog"]');
 assert.notEqual(drawerSelectorIdx,-1);
 assert.ok(editorSelectorIdx<drawerSelectorIdx,'onGlobalKeydown must prioritize .p-editor-backdrop [role="dialog"] before .mf-detail-drawer');

 const escOpenIdx=body.indexOf('if(this.state.planOpen)');
 const escSelectedIdx=body.indexOf('if(this.state.planSelected)');
 assert.notEqual(escOpenIdx,-1);
 assert.notEqual(escSelectedIdx,-1);
 assert.ok(escOpenIdx<escSelectedIdx,'Escape handling must close planOpen before planSelected');
});
