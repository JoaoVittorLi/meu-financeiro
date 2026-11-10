'use strict';
// Static contracts complement, but NEVER replace, scripts/d1-electron-smoke.cjs.
// The Windows GUI build must execute the actual Electron test.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8').replace(/\r\n/g,'\n');

test('D1.2 — one Electron instance lock after isolated profile and no profile override in packaged builds',()=>{
 const main=read('electron/main.cjs');
 const sandbox=read('electron/smoke-profile.cjs');
 assert.equal((main.match(/requestSingleInstanceLock\(/g)||[]).length,1);
 assert.equal((main.match(/app\.on\('second-instance'/g)||[]).length,1);
 assert.match(main,/const smokeProfileActive=isolateSmokeProfile\(app\);[\s\S]*?const isPrimaryInstance=app\.requestSingleInstanceLock\(\)/);
 assert.match(sandbox,/if\(app\.isPackaged\|\|defaultApp!==true\)throw/);
 assert.match(sandbox,/fs\.realpathSync\(os\.tmpdir\(\)\)/);
 assert.match(sandbox,/app\.setPath\('userData',target\)/);
 assert.match(main,/ses\.webRequest\.onBeforeRequest/);
});

test('D1.2 — Windows pipeline executes the real Electron smoke without bypassing existing gates',()=>{
 const pkg=JSON.parse(read('package.json')),win=read('.circleci/build-windows.ps1');
 assert.equal(pkg.scripts['test:electron-smoke'],'node scripts/d1-electron-smoke.cjs');
 const smoke=win.indexOf('run test:electron-smoke'),dist=win.indexOf('run dist:windows');
 assert(smoke>0&&dist>smoke);
 assert.match(win,/Assert-Success 'Smoke Electron D1\.2 real e isolado'/);
 assert.match(win,/Assert-Success 'npm run dist:windows'/);
 assert.match(win,/renderer-provenance\.cjs verify-asar/);
 assert.match(win,/SHA256\.txt/);
});

test('D1.2 — smoke tests DOM navigation and persist/restart through preload IPC, not no-op success',()=>{
 const source=read('scripts/d1-electron-smoke.cjs');
 assert.match(source,/mkdtempSync\(path\.join\(os\.tmpdir\(\),/);
 assert.match(source,/Runtime\.evaluate/);
 assert.match(source,/button\.nav-item/);
 assert.match(source,/mf-workspace-bar strong/);
 assert.match(source,/window\.financeDesktop\.save/);
 assert.match(source,/window\.financeDesktop\.planCreate/);
 assert.match(source,/window\.financeDesktop\.bankLinkManual/);
 assert.match(source,/await closeCleanly\(running\);running=null;[\s\S]*?running=await start\(profile\)/);
 assert.match(source,/validateBackupFile\(/);
 assert.match(source,/process\.exitCode=1/);
});

test('D1.2 — o CI conserva screenshots sintéticos e instaladores em artefatos diferentes',()=>{
 const win=read('.circleci/build-windows.ps1');
 const config=read('.circleci/config.yml');
 const smoke=read('scripts/d1-electron-smoke.cjs');
 assert.match(win,/MF_SMOKE_OUTPUT_DIR/);
 assert.match(win,/visual-matrix\.json/);
 assert.match(win,/Count -ne 16/);
 assert.match(config,/path: circleci-smoke-artifacts\s+destination: MeuFinanceiro-Desktop-Smoke/);
 assert.match(config,/path: circleci-artifacts\s+destination: MeuFinanceiro-Windows/);
 assert.match(smoke,/Page\.captureScreenshot/);
 assert.match(smoke,/prefers-reduced-motion/);
 assert.match(smoke,/1366,height:768/);
 assert.match(smoke,/1920,height:1080/);
 assert.match(smoke,/Overflow horizontal global/);
 assert.match(smoke,/89504e470d0a1a0a/);
});
