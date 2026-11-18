'use strict';
// Nível C Real Installed Windows NSIS Application QA Runner.
// Launches the actual packaged & silently installed NSIS binary
// (`Meu Financeiro RC Experimental.exe`), proves ASAR provenance, D05 catalog,
// userData override isolation, host-folder immutability, all 14 interactive
// journeys (PJ-01..09, NJ-01..05), clean close, SQLite integrity, and reopen persistence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { FinanceDB } = require('../electron/db.cjs');
const {
  validateExperimentalOverridePath,
  STABLE_NAME,
  EXPERIMENTAL_NAME,
  EXPERIMENTAL_ID,
  ISOLATED_DIR
} = require('../electron/release-channel.cjs');
const { verifyArchive } = require('./renderer-provenance.cjs');
const { availablePort, awaitTarget, connect, evaluate } = require('./d1-electron-smoke.cjs');
const { runNivelB } = require('./nivel-b-interactive-qa.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_INSTALL_DIR = 'C:\\Dev\\mf-nsis-test-install';
const DEFAULT_USERDATA_DIR = 'C:\\Dev\\mf-nsis-test-userdata';
const DEFAULT_OUTPUT_DIR = 'C:\\Dev\\releases\\M1-BASELINE\\screenshots-nivel-c';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function assertSafeEnvironment() {
  if (process.env.MF_QA_SYNTHETIC !== '1') {
    throw new Error('REFUSED: MF_QA_SYNTHETIC=1 obrigatório para Nível C QA.');
  }
  if (process.env.MF_REAL_PROFILE) {
    throw new Error('REFUSED: MF_REAL_PROFILE deve estar vazio no Nível C QA.');
  }
  const pluggyKeys = Object.keys(process.env).filter(k => /^PLUGGY_/i.test(k) && process.env[k]);
  if (pluggyKeys.length) {
    throw new Error('REFUSED: variáveis PLUGGY_* devem estar vazias: ' + pluggyKeys.join(','));
  }
}

function protectedHostPaths() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  return [
    localAppData ? path.join(localAppData, 'Programs', STABLE_NAME) : null,
    localAppData ? path.join(localAppData, 'Programs', EXPERIMENTAL_NAME) : null,
    appData ? path.join(appData, 'meu-financeiro-desktop') : null,
    appData ? path.join(appData, STABLE_NAME) : null,
    appData ? path.join(appData, ISOLATED_DIR) : null
  ].filter(Boolean);
}

function snapshotHostFolders(pathsList) {
  return pathsList.map(targetPath => {
    if (!fs.existsSync(targetPath)) {
      return { path: targetPath, exists: false, mtimeIso: null, mtimeMs: null, topItems: 0 };
    }
    const stat = fs.statSync(targetPath);
    const items = fs.readdirSync(targetPath);
    return {
      path: targetPath,
      exists: true,
      mtimeIso: stat.mtime.toISOString(),
      mtimeMs: stat.mtimeMs,
      topItems: items.length
    };
  });
}

function verifyIsolationGuards(allowedTarget) {
  const appData = process.env.APPDATA;
  assert.ok(appData, 'APPDATA environment variable is required');
  const fakeApp = { getPath: key => (key === 'appData' ? appData : allowedTarget) };
  const resolved = validateExperimentalOverridePath(fakeApp, allowedTarget);
  assert.equal(path.resolve(resolved).toLowerCase(), path.resolve(allowedTarget).toLowerCase());

  const forbidden = [
    path.join(appData, 'meu-financeiro-desktop'),
    path.join(appData, STABLE_NAME),
    path.join(appData, ISOLATED_DIR)
  ];
  for (const target of forbidden) {
    assert.throws(
      () => validateExperimentalOverridePath(fakeApp, target),
      /negada|protegidos|bloqueado/i,
      `Override must reject protected directory: ${target}`
    );
  }
}

async function verifyInstalledAsarAndCatalog(asarPath) {
  await verifyArchive(REPO_ROOT, asarPath);
  const asar = await import('@electron/asar');
  const d05TaxRaw = Buffer.from(asar.extractFile(asarPath, path.normalize('electron/d05-taxonomy.json'))).toString('utf8');
  const d05Tax = JSON.parse(d05TaxRaw);
  const parents = Array.isArray(d05Tax.parents) ? d05Tax.parents : [];
  const subcategories = parents.reduce((acc, p) => acc + (Array.isArray(p.subcategories) ? p.subcategories.length : 0), 0);
  const svgRegRaw = Buffer.from(asar.extractFile(asarPath, path.normalize('shared/d05-svg-registry.json'))).toString('utf8');
  const svgReg = JSON.parse(svgRegRaw);
  const svgCount = Object.keys(svgReg.glyphs || {}).length;
  const relChanRaw = Buffer.from(asar.extractFile(asarPath, path.normalize('electron/release-channel.cjs'))).toString('utf8');
  const pkg = JSON.parse(Buffer.from(asar.extractFile(asarPath, 'package.json')).toString('utf8'));
  const repoPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  assert.equal(parents.length, 14, 'Installed app.asar must carry 14 D05 parent categories');
  assert.equal(subcategories, 61, 'Installed app.asar must carry 61 D05 subcategories');
  assert.equal(svgCount, 67, `Expected 67 D05 SVG glyphs in shared/d05-svg-registry.json inside ASAR, found ${svgCount}`);
  assert.equal(pkg.name, 'meu-financeiro-desktop');
  assert.equal(pkg.version, '0.9.5-beta.8');
  assert.equal(pkg.mfDistributionChannel, undefined, 'Experimental ASAR must never carry stable mfDistributionChannel marker');
  assert.equal(repoPkg.build?.appId, EXPERIMENTAL_ID);
  assert.ok(relChanRaw.includes(`'${EXPERIMENTAL_ID}'`), 'Installed release-channel.cjs must declare experimental appId');
  return {
    name: pkg.name,
    version: pkg.version,
    appId: EXPERIMENTAL_ID,
    d05Parents: parents.length,
    d05Subcategories: subcategories,
    svgCount
  };
}

function launchInstalledExecutable(exePath, profile, port) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.MF_DESKTOP_SMOKE_DIR;
  delete env.MF_SMOKE_OUTPUT_DIR;
  delete env.MF_REAL_PROFILE;
  for (const key of Object.keys(env)) {
    if (/^PLUGGY_/i.test(key)) delete env[key];
  }
  env.MF_QA_SYNTHETIC = '1';
  env.MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR = profile;

  const args = [
    '--remote-debugging-port=' + port,
    '--remote-debugging-address=127.0.0.1',
    '--remote-allow-origins=*'
  ];
  const child = spawn(exePath, args, {
    cwd: path.dirname(exePath),
    env,
    windowsHide: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const recent = [];
  const remember = v => {
    recent.push(String(v).slice(0, 1000));
    if (recent.length > 30) recent.shift();
  };
  child.on('error', err => remember(err.message));
  child.stdout.on('data', remember);
  child.stderr.on('data', remember);
  return { child, logs: () => recent.slice(-12).join('') };
}

async function startInstalled(exePath, profile) {
  const port = await availablePort();
  const running = launchInstalledExecutable(exePath, profile, port);
  try {
    const endpoint = await awaitTarget(port, running.child);
    const cdp = await connect(endpoint);
    const issues = [];
    const record = val => {
      issues.push(String(val).slice(0, 800));
      if (issues.length > 18) issues.shift();
    };
    cdp.socket.addEventListener('message', event => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.method === 'Runtime.exceptionThrown') {
        record('[JS_ERROR] ' + (msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || 'unidentified'));
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        record('[CONSOLE_ERROR] ' + (msg.params.args || []).map(a => a.value || a.description || '').join(' '));
      }
      if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
        record('[LOG_ERROR] ' + msg.params.entry.text);
      }
    });
    await cdp.send('Runtime.enable');
    try { await cdp.send('Log.enable'); } catch {}

    let last = null;
    let lastError = null;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (running.child.exitCode !== null) {
        throw new Error('Installed binary exited before readiness: ' + running.child.exitCode);
      }
      try {
        last = await evaluate(cdp,
          'return {bridge:!!(window.financeDesktop&&typeof window.financeDesktop.info==="function"),' +
          'nav:[...document.querySelectorAll("button.nav-item")].some(b=>b.getAttribute("aria-label")==="Visão geral"),' +
          'root:document.getElementById("app")?.textContent?.slice(0,120)||""}');
        if (last?.bridge && last?.nav) return { ...running, cdp };
      } catch (err) {
        lastError = String(err?.message || err).slice(0, 300);
      }
      await delay(250);
    }
    throw new Error('Installed renderer/preload not ready in 45s; state=' +
      JSON.stringify(last) + '; cdpErr=' + (lastError || 'none') + '; diag=' + JSON.stringify(issues));
  } catch (err) {
    try { running.child.kill(); } catch {}
    throw new Error(err.message + '; Output: ' + running.logs());
  }
}

function queryProcessExecutablePath(pid) {
  try {
    const out = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId = ${Number(pid)}").ExecutablePath`
    ], { encoding: 'utf8' });
    return out.trim();
  } catch {
    return null;
  }
}

async function runNivelC() {
  assertSafeEnvironment();
  const installDir = path.resolve(process.env.MF_NIVEL_C_INSTALL_DIR || DEFAULT_INSTALL_DIR);
  const userDataDir = path.resolve(process.env.MF_NIVEL_C_USER_DATA_DIR || DEFAULT_USERDATA_DIR);
  const outputDir = path.resolve(process.env.MF_NIVEL_C_OUTPUT_DIR || DEFAULT_OUTPUT_DIR);
  const exePath = path.join(installDir, `${EXPERIMENTAL_NAME}.exe`);
  const uninstallPath = path.join(installDir, `Uninstall ${EXPERIMENTAL_NAME}.exe`);
  const asarPath = path.join(installDir, 'resources', 'app.asar');

  assert.ok(fs.existsSync(exePath), `Installed executable missing: ${exePath}`);
  assert.ok(fs.existsSync(uninstallPath), `NSIS uninstaller missing: ${uninstallPath}`);
  assert.ok(fs.existsSync(asarPath), `Installed ASAR missing: ${asarPath}`);

  const hostBefore = snapshotHostFolders(protectedHostPaths());
  const asarSummary = await verifyInstalledAsarAndCatalog(asarPath);

  fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  verifyIsolationGuards(userDataDir);

  let runtimeMeta = null;
  const journeyReport = await runNivelB({
    profileDir: userDataDir,
    outputDir,
    keepProfile: true,
    label: 'NÍVEL C REAL INSTALLED NSIS QA SUMMARY',
    reportFileName: 'report-nivel-c-journeys.json',
    startFn: profile => startInstalled(exePath, profile),
    onSessionReady: async (running) => {
      const liveExePath = queryProcessExecutablePath(running.child.pid);
      const state = await evaluate(running.cdp, `
        const info = await window.financeDesktop.info();
        const bank = await window.financeDesktop.bankStatus();
        return { info, connection: bank.connection };
      `);
      assert.equal(
        path.resolve(state.info.path).toLowerCase(),
        path.resolve(userDataDir, 'meu-financeiro.sqlite').toLowerCase(),
        'Installed app opened wrong userData SQLite path!'
      );
      assert.deepEqual(state.info.integrity, ['ok']);
      assert.equal(state.connection.channel, 'experimental');
      assert.equal(state.connection.isolated, true);
      assert.equal(state.connection.connectionEnabled, false);
      assert.equal(state.connection.profileState, 'isolated');
      if (liveExePath) {
        assert.equal(path.resolve(liveExePath).toLowerCase(), path.resolve(exePath).toLowerCase());
      }
      runtimeMeta = {
        pid: running.child.pid,
        liveExePath,
        sqlitePath: state.info.path,
        connection: state.connection
      };
    }
  });

  const hostAfter = snapshotHostFolders(protectedHostPaths());
  const hostDiffs = hostBefore.map((b, idx) => {
    const a = hostAfter[idx];
    const unchanged = b.exists === a.exists && b.mtimeMs === a.mtimeMs && b.topItems === a.topItems;
    return { path: b.path, unchanged, before: b, after: a };
  });
  for (const diff of hostDiffs) {
    assert.equal(diff.unchanged, true, `Host folder was modified during Nível C QA: ${diff.path}`);
  }

  // Final on-disk SQLite check on installed userData
  const diskDbFile = path.join(userDataDir, 'meu-financeiro.sqlite');
  const finalDb = new FinanceDB(diskDbFile);
  let dbSummary;
  try {
    assert.deepEqual(finalDb.integrity(), ['ok']);
    const txSample = finalDb.db.prepare('SELECT COUNT(*) AS cnt, MIN(amount_cents) AS minCents, MAX(amount_cents) AS maxCents FROM transactions').get();
    dbSummary = {
      integrity: 'ok',
      transactionsCount: txSample.cnt,
      minAmountCents: txSample.minCents,
      maxAmountCents: txSample.maxCents,
      integerCentsOnly: Number.isInteger(txSample.minCents) && Number.isInteger(txSample.maxCents)
    };
    assert.equal(dbSummary.integerCentsOnly, true);
  } finally {
    finalDb.close();
  }

  const finalReport = {
    executedAt: new Date().toISOString(),
    installDir,
    exePath,
    uninstallPath,
    asarPath,
    userDataDir,
    outputDir,
    asarSummary,
    runtimeMeta,
    dbSummary,
    hostProtection: hostDiffs,
    totalJourneys: journeyReport.journeys.length,
    passedJourneys: journeyReport.journeys.filter(j => j.status === 'PASS').length,
    failedJourneys: journeyReport.journeys.filter(j => j.status !== 'PASS').length,
    runtimeIssues: journeyReport.runtimeIssues
  };

  fs.writeFileSync(path.join(outputDir, 'report-nivel-c.json'), JSON.stringify(finalReport, null, 2) + '\n');
  console.log('\n=== NÍVEL C HOST PROTECTION & ASAR VERIFICATION ===');
  console.log('EXE:', exePath);
  console.log('USER_DATA:', userDataDir);
  console.log('ASAR:', JSON.stringify(asarSummary));
  console.log('DB:', JSON.stringify(dbSummary));
  console.log('HOST_FOLDERS_UNTOUCHED:', hostDiffs.every(d => d.unchanged));
  if (finalReport.failedJourneys > 0 || finalReport.runtimeIssues.length > 0) {
    process.exitCode = 1;
  }
  return finalReport;
}

if (require.main === module) {
  runNivelC().catch(err => {
    console.error('FAIL NIVEL C QA:', err);
    process.exitCode = 1;
  });
}

module.exports = { runNivelC, verifyInstalledAsarAndCatalog, protectedHostPaths };
