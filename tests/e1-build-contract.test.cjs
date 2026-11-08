'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('E1 Windows IPC contract is declared and wired in all three desktop layers',()=>{
  const app=read('src/app.ts');
  const main=read('electron/main.cjs');
  const preload=read('electron/preload.cjs');
  assert.match(app,/cloudE1Audit\?:\(\)=>Promise<E1Report>/);
  assert.match(app,/async auditCloudE1\(\)/);
  assert.match(main,/ipcMain\.handle\('cloud:e1-audit'/);
  assert.match(preload,/cloudE1Audit:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('cloud:e1-audit'\)/);
  assert.match(main,/auditE1Windows\(db,client,app\.getPath\('userData'\)\)/);
});

test('Windows and PWA beta versions are intentionally identical',()=>{
  const win=JSON.parse(read('package.json'));
  const pwa=JSON.parse(read('mobile-push/package.json'));
  assert.equal(win.version,pwa.version);
  assert.match(win.version,/^\d+\.\d+\.\d+-beta\.\d+$/);
});

test('Actions only run on opt-in marker while quota is limited',()=>{
  const workflow=read('.github/workflows/unified-preview-gate.yml');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/push:\n\s+branches:\n\s+- safety\/cloud-migration-preflight-20261107\n\s+paths:\n\s+- \.ci\/request-preview-build\.txt/);
  assert.match(workflow,/permissions:\n\s+contents:\s+read/);
  assert.match(workflow,/preview-windows:\n\s+needs:\s+parity-and-security\n\s+permissions:\n\s+contents:\s+write/);
  assert.match(workflow,/electron-builder --win portable nsis --x64 --publish never/);
  assert.match(workflow,/gh release create \$tag @assets/);
  assert.match(workflow,/--prerelease/);
  assert.doesNotMatch(workflow,/push:\n\s+branches:\s*\[main\]/);
});
