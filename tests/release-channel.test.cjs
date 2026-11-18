'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  releaseChannel,
  stableProfileDirectory,
  experimentalProfileDirectory,
  STABLE_NAME,
  EXPERIMENTAL_NAME,
  ISOLATED_DIR
} = require('../electron/release-channel.cjs');

const fakeApp = (root, name = EXPERIMENTAL_NAME, isPackaged = true) => ({
  isPackaged,
  getName: () => name,
  getPath: key => {
    assert.equal(key, 'appData');
    return root;
  }
});

const withTmp = fn => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-rc-iso-'));
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

test('experimentalProfileDirectory defaults to ISOLATED_DIR when no override is supplied', () => withTmp(root => {
  const appData = path.join(root, 'appData');
  fs.mkdirSync(appData, { recursive: true });
  const chosen = experimentalProfileDirectory(fakeApp(appData), { env: {}, argv: ['app.exe'] });
  assert.equal(chosen, path.join(appData, ISOLATED_DIR));
  assert.equal(fs.existsSync(chosen), true);
}));

test('experimentalProfileDirectory accepts MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR and --user-data-dir for fresh isolated paths', () => withTmp(root => {
  const appData = path.join(root, 'appData');
  fs.mkdirSync(appData, { recursive: true });
  const envDir = path.join(root, 'mf-nsis-test-userdata-env');
  const argDir = path.join(root, 'mf-nsis-test-userdata-arg');
  const spaceArgDir = path.join(root, 'mf-nsis-test-userdata-space');

  const fromEnv = experimentalProfileDirectory(fakeApp(appData), {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: envDir },
    argv: ['app.exe']
  });
  assert.equal(fromEnv, path.resolve(envDir));
  assert.equal(fs.existsSync(fromEnv), true);

  const fromArg = experimentalProfileDirectory(fakeApp(appData), {
    env: {},
    argv: ['app.exe', `--user-data-dir=${argDir}`]
  });
  assert.equal(fromArg, path.resolve(argDir));
  assert.equal(fs.existsSync(fromArg), true);

  const fromSpaceArg = experimentalProfileDirectory(fakeApp(appData), {
    env: {},
    argv: ['app.exe', '--user-data-dir', spaceArgDir]
  });
  assert.equal(fromSpaceArg, path.resolve(spaceArgDir));

  const matchedBoth = experimentalProfileDirectory(fakeApp(appData), {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: envDir },
    argv: ['app.exe', `--user-data-dir=${envDir}`]
  });
  assert.equal(matchedBoth, path.resolve(envDir));
}));

test('experimentalProfileDirectory rejects relative, empty, root, UNC, and conflicting overrides', () => withTmp(root => {
  const appData = path.join(root, 'appData');
  fs.mkdirSync(appData, { recursive: true });
  const app = fakeApp(appData);

  assert.throws(() => experimentalProfileDirectory(app, {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: 'relative/path' },
    argv: []
  }), /absoluto/);

  assert.throws(() => experimentalProfileDirectory(app, {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: '   ' },
    argv: []
  }), /vazio/);

  assert.throws(() => experimentalProfileDirectory(app, {
    env: {},
    argv: ['app.exe', '--user-data-dir=']
  }), /inválido/);

  assert.throws(() => experimentalProfileDirectory(app, {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: path.parse(root).root },
    argv: []
  }), /raiz/);

  assert.throws(() => experimentalProfileDirectory(app, {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: appData },
    argv: []
  }), /AppData/);

  assert.throws(() => experimentalProfileDirectory(app, {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: path.join(root, 'a') },
    argv: ['app.exe', `--user-data-dir=${path.join(root, 'b')}`]
  }), /Conflito/);

  if (process.platform === 'win32') {
    assert.throws(() => experimentalProfileDirectory(app, {
      env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: '\\\\server\\share\\userdata' },
      argv: []
    }), /absolut/);
  }
}));

test('experimentalProfileDirectory strictly rejects personal, stable, and default RC profiles and nested subpaths', () => withTmp(root => {
  const appData = path.join(root, 'appData');
  const localAppData = path.join(root, 'localAppData');
  fs.mkdirSync(appData, { recursive: true });
  fs.mkdirSync(localAppData, { recursive: true });
  const app = fakeApp(appData);

  const forbidden = [
    path.join(appData, 'meu-financeiro-desktop'),
    path.join(appData, 'meu-financeiro-desktop', 'sub'),
    path.join(appData, 'Meu Financeiro'),
    path.join(appData, 'Meu Financeiro', 'nested'),
    path.join(appData, ISOLATED_DIR),
    path.join(appData, ISOLATED_DIR, 'nested'),
    path.join(root, 'meu-financeiro-desktop', 'copy'),
    path.join(root, 'MEU FINANCEIRO', 'copy'),
    path.join(localAppData, 'Programs', 'Meu Financeiro', 'userdata')
  ];

  for (const candidate of forbidden) {
    assert.throws(() => experimentalProfileDirectory(app, {
      env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: candidate, LOCALAPPDATA: localAppData },
      argv: []
    }), /negada|protegido|instalação/);
  }
}));

test('experimentalProfileDirectory rejects junction/symlink segments anywhere in override path', () => withTmp(root => {
  const appData = path.join(root, 'appData');
  const target = path.join(root, 'real-target');
  const linkParent = path.join(root, 'junction-parent');
  fs.mkdirSync(appData, { recursive: true });
  fs.mkdirSync(target, { recursive: true });

  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(target, linkParent, linkType);

  assert.throws(() => experimentalProfileDirectory(fakeApp(appData), {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: linkParent },
    argv: []
  }), /link simbólico|junction/);

  assert.throws(() => experimentalProfileDirectory(fakeApp(appData), {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: path.join(linkParent, 'child-dir') },
    argv: []
  }), /link simbólico|junction/);
}));

test('stablePackaged never allows experimentalProfileDirectory and main.cjs ignores overrides in stablePackaged', () => withTmp(root => {
  const appData = path.join(root, 'appData');
  fs.mkdirSync(appData, { recursive: true });
  const stableApp = fakeApp(appData, STABLE_NAME, true);

  assert.equal(releaseChannel(stableApp, { mfDistributionChannel: 'stable' }), 'stable');
  assert.throws(() => experimentalProfileDirectory(stableApp, {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: path.join(root, 'safe-override') },
    argv: []
  }), /Identidade estável/);

  const stableDir = stableProfileDirectory(stableApp);
  assert.equal(stableDir, path.join(appData, STABLE_NAME));

  const mainSource = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf8');
  assert.match(
    mainSource,
    /if\(experimentalPackaged\)\{[\s\S]*?const isolated=experimentalProfileDirectory\(app\);[\s\S]*?app\.setPath\('userData',isolated\);[\s\S]*?\}else if\(stablePackaged\)\{[\s\S]*?const stableDirectory=stableProfileDirectory\(app\);[\s\S]*?app\.setPath\('userData',stableDirectory\);[\s\S]*?\}/
  );
}));

test('NSIS-only packaging configs exclude portable targets', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  const stableBuild = fs.readFileSync(path.join(__dirname, '../scripts/build-stable-windows.cjs'), 'utf8');
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/build-windows.yml'), 'utf8');
  const previewPs1 = fs.readFileSync(path.join(__dirname, '../scripts/preview-windows-local.ps1'), 'utf8');

  assert.doesNotMatch(pkg.scripts['dist:windows'], /portable/i);
  assert.match(pkg.scripts['dist:windows'], /--win nsis --x64/);
  assert.deepEqual(pkg.build.win.target, [{ target: 'nsis', arch: ['x64'] }]);
  assert.equal(pkg.build.portable, undefined);
  assert.doesNotMatch(stableBuild, /portable/i);
  assert.match(stableBuild, /createTarget\(\['nsis'\],Arch\.x64\)/);
  assert.doesNotMatch(workflow, /portátil|portable/i);
  assert.doesNotMatch(previewPs1, /portable/i);
  assert.match(previewPs1, /MeuFinanceiro-Instalador-\$version-x64\.exe/);
});
