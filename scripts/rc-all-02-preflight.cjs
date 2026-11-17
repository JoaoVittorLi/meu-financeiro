#!/usr/bin/env node
'use strict';
/* RC-ALL-02.1: LOCAL QA ONLY. No CircleCI, EXE, production data, deployment or personal writes. */
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const repo=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
const full=args.includes('--all'),electron=args.includes('--electron');
const skipInstall=args.includes('--skip-install'),dry=args.includes('--dry-run');
const expectedArg=args.find(x=>x.startsWith('--expected-sha='));
const expectedSha=expectedArg?expectedArg.slice('--expected-sha='.length):null;
const expectedBranch='integration/mf2-rc-all-02-b01-b05-20261116';
const results=[],npm=process.platform==='win32'?'npm.cmd':'npm';
const began=Date.now();
const report={branch:null,sha:null,node:process.version,npm:null,mode:full?'full':'targeted',
 gates:results,verdict:'NOT_RUN',circleCiTriggered:false,releaseApproved:false};
function spawn(program,argv,capture=false){
 const r=cp.spawnSync(program,argv,{cwd:repo,encoding:'utf8',stdio:capture?'pipe':'inherit',
  shell:process.platform==='win32',maxBuffer:8*1024*1024});
 if(r.error)throw r.error;
 return r;
}
function value(program,argv){
 const r=spawn(program,argv,true);
 if(r.status!==0)throw Error(program+' '+argv[0]+' failed: '+String(r.stderr).slice(0,180));
 return String(r.stdout).trim();
}
function gate(name,program,argv){
 if(dry){console.log('[DRY-RUN]',name,program,...argv);results.push({name,result:'NOT_RUN'});return;}
 console.log('\n###',name);
 const time=Date.now(),r=spawn(program,argv);
 const result=r.status===0?'PASS':'FAIL';
 results.push({name,result,exitCode:r.status,durationMs:Date.now()-time});
 if(r.status!==0)throw Error(name+' failed with exit '+r.status);
}
try{
 if(electron&&!full)throw Error('--electron requires --all');
 report.sha=value('git',['rev-parse','HEAD']);
 report.branch=value('git',['branch','--show-current']);
 const dirty=value('git',['status','--porcelain']);
 report.npm=value(npm,['--version']);
 if(report.branch!==expectedBranch)throw Error('Expected branch '+expectedBranch);
 if(!/^[a-f0-9]{40}$/.test(report.sha))throw Error('Invalid git SHA');
 if(expectedSha&&report.sha!==expectedSha)throw Error('SHA mismatch; refuse stale QA');
 if(dirty)throw Error('Git worktree is dirty: do not test unknown changes');
 if(process.version!=='v22.23.4'||report.npm!=='10.9.9')
  throw Error('Requires Node 22.23.4/npm 10.9.9, found '+process.version+'/'+report.npm);
 console.log('RC-ALL-02.1 SHA:',report.sha);
 if(!skipInstall)gate('npm ci',npm,['ci','--no-audit','--no-fund']);
 gate('TypeScript',npm,['run','test:types']);
 gate('QA84 directed tests',process.execPath,['--test',
  'tests/qa84-b01-b02.test.cjs','tests/qa84-b03-b04.test.cjs',
  'tests/qa84-b05.test.cjs','tests/qa84-rc-all-02.integration.test.cjs']);
 if(full){
  gate('SQLite and full Node suite',npm,['run','test:db']);
  gate('Preload',process.execPath,['scripts/build-preload.cjs','check']);
  gate('ASAR',npm,['run','test:asar']);
  gate('F08 provenance create',npm,['run','provenance:create']);
  gate('F08 provenance verify',npm,['run','provenance:verify']);
  if(electron)gate('Electron local smoke',npm,['run','test:electron-smoke']);
 }
 if(!dry)report.verdict='LOCAL_GATES_PASS';
}catch(e){
 console.error('RC-ALL-02.1 STOP:',String(e&&e.message||e));
 report.verdict='NO_GO';
 process.exitCode=1;
}finally{
 report.durationMs=Date.now()-began;
 report.completedAt=new Date().toISOString();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-rc-all-02-'));
 const file=path.join(dir,'gates.json');
 fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log('Gates summary (no financial values/credentials):',file);
 console.log('Verdict:',report.verdict,'; CircleCI, EXE and main merge NOT RUN');
}
