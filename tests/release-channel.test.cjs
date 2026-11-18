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
  const root = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'mf-rc-iso-'));
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

test('experimentalProfileDirectory rejects Windows trailing-dot/space segments, leading whitespace, and reserved device names', () => withTmp(root => {
  const appData = path.join(root, 'appData');
  const localAppData = path.join(root, 'localAppData');
  const protectedDir = path.join(appData, 'Meu Financeiro');
  fs.mkdirSync(protectedDir, { recursive: true });
  fs.mkdirSync(localAppData, { recursive: true });
  const { DatabaseSync } = require('node:sqlite');
  const protectedDb = new DatabaseSync(path.join(protectedDir, 'meu-financeiro.sqlite'));
  try {
    protectedDb.exec('CREATE TABLE IF NOT EXISTS secret_probe(val TEXT); INSERT INTO secret_probe(val) VALUES (\'REAL_PERSONAL_DATA\');');
  } finally {
    protectedDb.close();
  }

  const app = fakeApp(appData);
  const trailingDotAndSpaceVariants = [
    path.join(appData, 'Meu Financeiro.'),
    path.join(appData, 'meu-financeiro-desktop.'),
    path.join(appData, 'meu-financeiro-desktop..'),
    path.join(appData, 'Meu Financeiro..'),
    path.join(appData, 'Meu Financeiro .'),
    path.join(appData, `${ISOLATED_DIR}.`),
    path.join(appData, 'meu-financeiro-desktop.', 'sub'),
    path.join(appData, 'Meu Financeiro ', 'nested'),
    path.join(localAppData, 'Programs', 'Meu Financeiro.', 'sub'),
    `${appData}.`,
    `${path.join(root, 'safe-dir')} `,
    path.join(root, ' leading-space', 'sub'),
    path.join(root, 'CON'),
    path.join(root, 'PRN', 'sub'),
    path.join(root, 'AUX'),
    path.join(root, 'NUL'),
    path.join(root, 'COM1'),
    path.join(root, 'LPT9'),
    path.join(root, 'nul.sqlite')
  ];

  for (const candidate of trailingDotAndSpaceVariants) {
    assert.throws(() => experimentalProfileDirectory(app, {
      env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: candidate, LOCALAPPDATA: localAppData },
      argv: []
    }), /segmento inválido|extremidades|negada|protegido|instalação/, `Expected rejection for ${JSON.stringify(candidate)}`);
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

test('experimentalProfileDirectory rejects CONIN$/CONOUT$, Windows 8.3 SFN, NTFS ADS and invalid Win32 chars', () => withTmp(root => {
  const appData = path.join(root, 'appData');
  const localAppData = path.join(root, 'localAppData');
  fs.mkdirSync(path.join(appData, 'Meu Financeiro'), { recursive: true });
  fs.mkdirSync(path.join(appData, 'meu-financeiro-desktop'), { recursive: true });
  fs.mkdirSync(path.join(localAppData, 'Programs', 'Meu Financeiro'), { recursive: true });
  const app = fakeApp(appData);

  for (const reserved of ['CONIN$', 'CONOUT$', 'CONIN$.txt', 'conout$.sqlite']) {
    assert.throws(() => experimentalProfileDirectory(app, {
      env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: path.join(root, reserved), LOCALAPPDATA: localAppData },
      argv: []
    }), /segmento inválido|reservado/);
  }

  if (process.platform === 'win32') {
    const win32Blocked = [
      path.join(appData, 'MEUFIN~1'),
      path.join(appData, 'MEUFIN~1', 'sub'),
      path.join(appData, 'MEU-FI~1'),
      path.join(localAppData, 'Programs', 'MEUFIN~1', 'sub'),
      path.join(root, 'PROGRA~1', 'sub'),
      path.join(root, 'MEUFIN~1.V1'),
      path.join(root, 'dir:stream'),
      path.join(root, 'bad<dir'),
      path.join(root, 'bad>dir'),
      path.join(root, 'bad"dir'),
      path.join(root, 'bad|dir'),
      path.join(root, 'bad?dir'),
      path.join(root, 'bad*dir'),
      path.join(root, 'bad\x01dir')
    ];
    for (const candidate of win32Blocked) {
      assert.throws(() => experimentalProfileDirectory(app, {
        env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: candidate, LOCALAPPDATA: localAppData },
        argv: []
      }), /segmento inválido|8\.3|reservado|negada|protegido|instalação|alias/, `Expected rejection for ${JSON.stringify(candidate)}`);
    }

    // Also verify real junction inside appData pointing from a safe-looking folder to Meu Financeiro is blocked
    const aliasInAppData = path.join(appData, 'alias-profile');
    fs.symlinkSync(path.join(appData, 'Meu Financeiro'), aliasInAppData, 'junction');
    assert.throws(() => experimentalProfileDirectory(app, {
      env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: path.join(aliasInAppData, 'sub'), LOCALAPPDATA: localAppData },
      argv: []
    }), /link simbólico|junction|alias|protegido/);
  }
}));

test('experimentalProfileDirectory creates nested non-existent dirs (new1/new2) and rolls back empty dirs on post-mkdirSync failure', () => withTmp(root => {
  const appData = path.join(root, 'appData');
  const existingBase = path.join(root, 'existing-base');
  fs.mkdirSync(appData, { recursive: true });
  fs.mkdirSync(existingBase, { recursive: true });
  const keepFile = path.join(existingBase, 'keep.txt');
  fs.writeFileSync(keepFile, 'preserve-me', 'utf8');

  const validNested = path.join(existingBase, 'new1', 'new2');
  const created = experimentalProfileDirectory(fakeApp(appData), {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: validNested },
    argv: []
  });
  assert.equal(created, fs.realpathSync.native(validNested));
  assert.equal(fs.existsSync(created), true);

  // Simulate post-mkdirSync validation failure (3rd getPath('appData') call returns candidate itself)
  const rollbackTarget = path.join(existingBase, 'rb1', 'rb2');
  let calls = 0;
  const failingPostApp = {
    isPackaged: true,
    getName: () => EXPERIMENTAL_NAME,
    getPath: key => {
      assert.equal(key, 'appData');
      calls++;
      return calls >= 3 ? rollbackTarget : appData;
    }
  };
  assert.throws(() => experimentalProfileDirectory(failingPostApp, {
    env: { MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR: rollbackTarget },
    argv: []
  }), /AppData diretamente/);

  assert.equal(fs.existsSync(path.join(existingBase, 'rb1', 'rb2')), false);
  assert.equal(fs.existsSync(path.join(existingBase, 'rb1')), false);
  assert.equal(fs.existsSync(existingBase), true);
  assert.equal(fs.readFileSync(keepFile, 'utf8'), 'preserve-me');
}));
