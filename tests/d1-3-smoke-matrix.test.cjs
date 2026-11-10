'use strict';
// D1.3 verifies coverage contract, not a substitute for Electron GUI execution.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {SMOKE_VIEWS,SMOKE_PRESETS}=require('../scripts/d1-electron-smoke.cjs');

test('D1.3 — smoke cobre todas as oito áreas Windows sem duplicação',()=>{
 const expected=['Visão geral','Movimentações','Planejamento','Orçamentos',
  'Minhas contas','Simular compra','Inteligência','Configurações'];
 assert.deepEqual(SMOKE_VIEWS,expected);
 assert.equal(new Set(SMOKE_VIEWS).size,8);
});
test('D1.3 — matriz visual cobre dois tamanhos, temas claro/escuro e movimento reduzido',()=>{
 assert.equal(SMOKE_PRESETS.length,4);
 assert.equal(SMOKE_VIEWS.length*SMOKE_PRESETS.length,32);
 assert.deepEqual([...new Set(SMOKE_PRESETS.map(x=>x.width+'x'+x.height))].sort(),
  ['1366x768','1920x1080']);
 assert.deepEqual([...new Set(SMOKE_PRESETS.map(x=>x.theme))].sort(),['dark','light']);
 assert.deepEqual([...new Set(SMOKE_PRESETS.map(x=>x.motion))].sort(),
  ['no-preference','reduce']);
});
test('D1.4 — smoke completo exige todas as 32 imagens após os testes IPC',()=>{
 const smoke=fs.readFileSync(path.join(__dirname,'../scripts/d1-electron-smoke.cjs'),'utf8');
 assert.match(smoke,/assert\.equal\(visuals\.count,SMOKE_VIEWS\.length\*SMOKE_PRESETS\.length/);
 assert.match(smoke,/window\.innerWidth/);
 assert.match(smoke,/window\.innerHeight/);
 assert.match(smoke,/waitForEmulatedViewport\(cdp,cfg\)/);
});
test('D1.3 — Windows valida presença das 32 capturas e seu manifesto',()=>{
 const ps1=fs.readFileSync(path.join(__dirname,'../.circleci/build-windows.ps1'),'utf8');
 assert.match(ps1,/test:electron-smoke/);
 assert.match(ps1,/visual-matrix\.json/);
 assert.match(ps1,/\$expectedScreenshots\s*=\s*32/);
 assert.match(ps1,/\$uniqueScreenshots\.Count -ne \$expectedScreenshots/);
 assert.match(ps1,/Test-Path -LiteralPath \(Join-Path \$env:MF_SMOKE_OUTPUT_DIR \$entry\.screenshot\)/);
});
