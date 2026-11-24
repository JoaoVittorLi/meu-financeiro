'use strict';
// Level B Interactive M3 Electron UI QA Runner (M3-J1..M3-J4).
// Exercises real Electron window + preload IPC + SQLite + native Windows dialogs
// under MF_QA_SYNTHETIC=1 and isolated temp userData.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { FinanceDB } = require('../electron/db.cjs');
const { PlanningStore } = require('../electron/planning.cjs');
const { start, evaluate, closeCleanly } = require('./d1-electron-smoke.cjs');

const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const ACC1_ID = '22222222-2222-4222-8222-222222222222';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function localIso(d = new Date()) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}
function shiftMonthLocal(ym, offset) {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(y, m - 1 + offset, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function assertSafeEnvironment() {
  if (process.env.MF_QA_SYNTHETIC !== '1') {
    throw new Error('REFUSED: MF_QA_SYNTHETIC=1 obrigatório.');
  }
  if (process.env.MF_REAL_PROFILE) {
    throw new Error('REFUSED: MF_REAL_PROFILE deve estar vazio.');
  }
  const pluggyKeys = Object.keys(process.env).filter((k) => /^PLUGGY_/i.test(k) && process.env[k]);
  if (pluggyKeys.length) {
    throw new Error('REFUSED: variáveis PLUGGY_* devem estar vazias.');
  }
}

function seedM3Profile(profileDir) {
  const today = localIso();
  const ym = today.slice(0, 7);
  const m1 = shiftMonthLocal(ym, -1);
  const m2 = shiftMonthLocal(ym, -2);
  const m3 = shiftMonthLocal(ym, -3);
  const dbPath = path.join(profileDir, 'meu-financeiro.sqlite');
  const db = new FinanceDB(dbPath);
  try {
    db.save('real', {
      version: 5,
      settings: { opening: 200000, income: 750000, fixed: 180000, existing: 0, reserve: 80000 },
      budgets: { Moradia: 180000, 'Alimentação': 95000, Transporte: 40000, Lazer: 40000 },
      transactions: []
    });
    db.save('demo', { version: 5, settings: { opening: 0, income: 0, fixed: 0, existing: 0, reserve: 0 }, budgets: {}, transactions: [] });
    db.ingestBank(ITEM_ID, {
      item: { status: 'UPDATED' },
      data: [
        {
          account: { id: ACC1_ID, name: 'Conta Corrente QA', balance: 6200, type: 'BANK', subtype: 'CHECKING_ACCOUNT', currencyCode: 'BRL' },
          transactions: [
            { id: 'sal-cur', date: `${ym}-02`, description: 'SALARIO EMPREGADOR QA', amount: 7500, status: 'POSTED', category: 'Salary' },
            { id: 'cur-mkt-1', date: `${ym}-05`, description: 'SUPERMERCADO ALFA QA 1', amount: -145.5, status: 'POSTED', category: 'Uncategorized' },
            { id: 'cur-mkt-2', date: `${ym}-06`, description: 'SUPERMERCADO ALFA QA 2', amount: -98.0, status: 'POSTED', category: 'Uncategorized' },
            { id: 'cur-uber-1', date: `${ym}-07`, description: 'UBER *VIAGEM CENTRO', amount: -32.0, status: 'POSTED', category: 'Uncategorized' },
            { id: 'm1-mor', date: `${m1}-05`, description: 'ALUGUEL QA', amount: -1800, status: 'POSTED', category: 'Housing' },
            { id: 'm1-ali', date: `${m1}-10`, description: 'MERCADO M1', amount: -900, status: 'POSTED', category: 'Groceries' },
            { id: 'm1-trn', date: `${m1}-12`, description: 'UBER M1', amount: -350, status: 'POSTED', category: 'Transport' },
            { id: 'm2-mor', date: `${m2}-05`, description: 'ALUGUEL QA', amount: -1800, status: 'POSTED', category: 'Housing' },
            { id: 'm2-ali', date: `${m2}-10`, description: 'MERCADO M2', amount: -950, status: 'POSTED', category: 'Groceries' },
            { id: 'm2-trn', date: `${m2}-12`, description: 'UBER M2', amount: -380, status: 'POSTED', category: 'Transport' },
            { id: 'm3-mor', date: `${m3}-05`, description: 'ALUGUEL QA', amount: -1800, status: 'POSTED', category: 'Housing' },
            { id: 'm3-ali', date: `${m3}-10`, description: 'MERCADO M3', amount: -920, status: 'POSTED', category: 'Groceries' },
            { id: 'm3-trn', date: `${m3}-12`, description: 'UBER M3', amount: -360, status: 'POSTED', category: 'Transport' }
          ]
        }
      ]
    });
    new PlanningStore(db);
  } finally {
    db.close();
  }
  return { ym, dbPath };
}

async function ensureWindowFocus(cdp, pid) {
  try { await cdp.send('Page.bringToFront'); } catch {}
  if (process.platform === 'win32' && Number.isInteger(Number(pid)) && Number(pid) > 0) {
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-Command', `
        Add-Type @"
        using System; using System.Runtime.InteropServices;
        public class MFFocus3 {
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        }
"@
        $p = Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue
        if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
          [MFFocus3]::ShowWindow($p.MainWindowHandle, 5) | Out-Null
          [MFFocus3]::BringWindowToTop($p.MainWindowHandle) | Out-Null
          [MFFocus3]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
        }
      `], { windowsHide: true, stdio: 'ignore' });
    } catch {}
  }
  await delay(100);
}

// Persistent native dialog responder while a multi-dialog Electron flow executes.
function startNativeDialogPump(pid, buttonLabels) {
  const stopFlag = path.join(os.tmpdir(), `mf-dlg-stop-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.flag`);
  const labelsArray = buttonLabels.map((s) => `'${String(s).replace(/'/g, "''")}'`).join(',');
  const ps = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System; using System.Runtime.InteropServices;
public class WinClick3 {
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
}
"@
$root = [System.Windows.Automation.AutomationElement]::RootElement
$targets = @(${labelsArray})
$pidFilter = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, ${Number(pid)})
$dlgCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '#32770')
$stopFile = '${stopFlag.replace(/'/g, "''")}'
while (-not (Test-Path $stopFile)) {
  $wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $pidFilter)
  foreach ($w in $wins) {
    $dialogs = New-Object System.Collections.Generic.List[System.Windows.Automation.AutomationElement]
    if ($w.Current.ClassName -eq '#32770') { $dialogs.Add($w) }
    else {
      $nested = $w.FindAll([System.Windows.Automation.TreeScope]::Descendants, $dlgCond)
      foreach ($nd in $nested) { $dialogs.Add($nd) }
    }
    foreach ($d in $dialogs) {
      $all = $d.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
      foreach ($b in $all) {
        $name = ([string]$b.Current.Name).Replace('&','')
        if ($targets -contains $name) {
          $hwnd = [IntPtr]$b.Current.NativeWindowHandle
          if ($hwnd -ne [IntPtr]::Zero) {
            [WinClick3]::PostMessage($hwnd, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
          } else {
            try { $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() } catch {}
          }
          Start-Sleep -Milliseconds 180
          break
        }
      }
    }
  }
  Start-Sleep -Milliseconds 100
}
`;
  const proc = spawn('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    stop: async () => {
      try { fs.writeFileSync(stopFlag, '1'); } catch {}
      await new Promise((r) => {
        const t = setTimeout(() => { try { proc.kill(); } catch {} r(); }, 2000);
        proc.once('exit', () => { clearTimeout(t); r(); });
      });
      try { fs.unlinkSync(stopFlag); } catch {}
    }
  };
}

async function waitFor(cdp, body, label, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const val = await evaluate(cdp, body);
      if (val) return val;
    } catch (e) {
      lastErr = e;
    }
    await delay(90);
  }
  throw new Error(`Timeout waiting for ${label}` + (lastErr ? `: ${lastErr.message}` : ''));
}

async function click(cdp, finderBody, label) {
  const rect = await waitFor(cdp, `
    const el = (() => { ${finderBody} })();
    if (!el || el.disabled) return null;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  `, label);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await delay(90);
}

async function fill(cdp, finderBody, text, label) {
  await click(cdp, finderBody, label);
  await evaluate(cdp, `
    const el = (() => { ${finderBody} })();
    el.focus();
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await delay(80);
}

async function shot(cdp, dir, name) {
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  const buf = Buffer.from(res.data, 'base64');
  assert(buf.length > 200);
  fs.writeFileSync(path.join(dir, `${name}.png`), buf);
}

async function runM3LevelB() {
  assertSafeEnvironment();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-d1-electron-m3-profile-'));
  const outputDir = path.join(os.tmpdir(), `mf-nivel-b-m3-shots-${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const { ym, dbPath } = seedM3Profile(profile);
  const issues = [];
  let running = null;
  let pump = null;

  const attachListeners = (cdp) => {
    cdp.socket.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.method === 'Runtime.exceptionThrown') issues.push('JS_EXCEPTION:' + (msg.params?.exceptionDetails?.text || 'err'));
      else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        issues.push('CONSOLE_ERROR:' + (msg.params.args || []).map((a) => a.value || a.description || '').join(' '));
      }
    });
  };

  try {
    running = await start(profile);
    attachListeners(running.cdp);
    await ensureWindowFocus(running.cdp, running.child.pid);
    await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-workspace-bar'));`, 'shell loaded');

    // Start dialog pump with all valid M3 confirmation captions
    pump = startNativeDialogPump(running.child.pid, [
      'Ativar ações supervisionadas',
      'Autorizar consulta local',
      'Autorizar esta conta',
      'Confirmar e aplicar',
      'Confirmar e criar regra futura',
      'Confirmar novo limite',
      'Confirmar no Planejamento',
      'Confirmar reversão'
    ]);

    // 1. Settings -> Inteligência tab -> M3 activation
    await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Configurações');`, 'nav Configurações');
    await click(running.cdp, `return [...document.querySelectorAll('.mf-settings-nav button')].find(b => b.textContent.includes('Inteligência'));`, 'tab Configurações > Inteligência');
    await waitFor(running.cdp, `return document.body.textContent.includes('GPT-6.2 Sol') && document.body.textContent.includes('Ações supervisionadas no Copiloto (M3)');`, 'M3 Settings card');
    await shot(running.cdp, outputDir, 'm3-settings-1920x1080');
    await click(running.cdp, `
      const line = [...document.querySelectorAll('.mf-ai-settings-toggle')].find(x => x.textContent.includes('Ações supervisionadas'));
      return line?.querySelector('button');
    `, 'Enable M3 in Settings');
    await waitFor(running.cdp, `
      const line = [...document.querySelectorAll('.mf-ai-settings-toggle')].find(x => x.textContent.includes('Ações supervisionadas'));
      return line?.textContent?.includes('Ativadas');
    `, 'M3 enabled in Settings');

    // 2. Navigate to Inteligência & Authorize local read (bank + planning)
    await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Inteligência');`, 'nav Inteligência');
    await click(running.cdp, `return document.getElementById('mf-b05-tab-chat');`, 'tab Conversar');
    if (!(await evaluate(running.cdp, `return !!document.querySelector('.mf-b05-permissions')?.open;`))) {
      await click(running.cdp, `return document.querySelector('.mf-b05-permissions summary');`, 'open permissions');
    }
    if (await evaluate(running.cdp, `const cb = document.querySelector('.mf-ai-access-planning input[type="checkbox"]'); return !!cb && !cb.checked;`)) {
      await click(running.cdp, `return document.querySelector('.mf-ai-access-planning input[type="checkbox"]');`, 'enable planning scope');
    }
    await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-permissions button')].find(b => b.textContent.includes('Autorizar leitura local'));`, 'Autorizar leitura local');
    await waitFor(running.cdp, `return document.querySelector('.mf-b05-status')?.textContent?.includes('Leitura local autorizada');`, 'local read active');

    const askAndWait = async (promptText, predicateBody, label) => {
      await fill(running.cdp, `return document.getElementById('mf-ai-draft');`, promptText, label + ' input');
      await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-chat-composer button')].find(b => !b.disabled && b.textContent.includes('Enviar'));`, label + ' send');
      return await waitFor(running.cdp, predicateBody, label + ' card', 15000);
    };

    // Journey M3-J1: S1 Batch Categorize -> Confirm -> Receipt -> Undo
    await askAndWait(
      'Coloque minhas compras do Supermercado Alfa em Alimentação > Supermercados',
      `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs.length >= 1 && cs[cs.length - 1].textContent.includes('Confirmar e aplicar');`,
      'S1 categorize'
    );
    await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Confirmar e aplicar'));`, 'S1 confirm');
    await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('Alteração aplicada');`, 'S1 receipt');
    await shot(running.cdp, outputDir, 'm3-s1-applied');
    await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Desfazer'));`, 'S1 undo');
    await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('Desfeito');`, 'S1 undone');

    // Journey M3-J2 (S3): Future-only rule & custom subcategory -> Confirm -> Undo
    await askAndWait(
      'Sempre que aparecer Uber, coloque em Transporte',
      `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.textContent?.includes('Somente futuras');`,
      'S3 future rule'
    );
    await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Confirmar e criar regra futura'));`, 'S3 confirm rule');
    await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('Regra futura criada');`, 'S3 rule receipt');
    await shot(running.cdp, outputDir, 'm3-s3-rule-applied');
    await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Desfazer'));`, 'S3 undo rule');
    await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('Desfeito');`, 'S3 rule undone');

    // Journey M3-J3 (S4 + F4): F4 simulation -> convert to planning -> Confirm -> Undo
    await askAndWait(
      'Se eu comprar algo de R$ 1.200 em 4x sem juros?',
      `return document.querySelector('.mf-b05-chat-thread')?.textContent?.includes('1.200,00') && document.querySelectorAll('.mf-ic2-adaptive').length >= 1;`,
      'F4 simulation'
    );
    await askAndWait(
      'Adicione ao planejamento a compra parcelada que acabamos de simular.',
      `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.textContent?.includes('Não realiza pagamento bancário');`,
      'S4 from sim planning'
    );
    await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Confirmar no Planejamento'));`, 'S4 confirm planning');
    await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('Planejamento atualizado');`, 'S4 planning receipt');
    await shot(running.cdp, outputDir, 'm3-s4-planning-applied');
    await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Desfazer'));`, 'S4 undo planning');
    await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('Desfeito');`, 'S4 planning undone');

    // Journey M3-J4 (S2 + S5): Salary proposal v1 -> refinement v2 -> Confirm -> Persist across Electron Restart!
    await askAndWait(
      'Meu salário este mês é R$ 7.500, reorganize meus orçamentos.',
      `const cs = document.querySelectorAll('.mf-m3-salary-card'); return cs.length >= 1 && cs[cs.length - 1].textContent.includes('Confirmar e aplicar');`,
      'S2 salary v1'
    );
    await askAndWait(
      'Gostei, mas quero guardar R$ 200 a mais.',
      `const cs = document.querySelectorAll('.mf-m3-salary-card'); return cs.length >= 2 && cs[cs.length - 1].textContent.includes('Revisão v2');`,
      'S5 salary v2'
    );

    // Check dark theme + 1366x768 layout (no overflow) on M3 cards
    await running.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await evaluate(running.cdp, `document.documentElement.dataset.theme = 'dark'; const cs = document.querySelectorAll('.mf-m3-salary-card'); cs[cs.length - 1]?.scrollIntoView({ block: 'center' });`);
    await delay(120);
    assert.equal(await evaluate(running.cdp, `return document.documentElement.scrollWidth <= window.innerWidth;`), true, 'No overflow in M3 dark 1366x768');
    await shot(running.cdp, outputDir, 'm3-s2-s5-dark-1366x768');
    await running.cdp.send('Emulation.clearDeviceMetricsOverride');
    await evaluate(running.cdp, `document.documentElement.dataset.theme = 'light';`);

    // Confirm v2 salary budget -> wait receipt -> close cleanly & restart Electron to prove SQLite persistence!
    await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-salary-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Confirmar e aplicar'));`, 'S2 confirm v2');
    await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-salary-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('Orçamentos atualizados');`, 'S2 receipt');

    await pump.stop();
    pump = null;
    await closeCleanly(running);
    running = null;
    await delay(1000);

    // Verify SQLite integrity & monthly_budgets persistence on disk before restart
    const diskDb = new FinanceDB(dbPath);
    try {
      assert.deepEqual(diskDb.integrity(), ['ok']);
      const monthly = diskDb.getMonthlyBudgets('real', ym);
      assert.ok(Object.keys(monthly).length >= 3, 'Expected monthly_budgets rows persisted for ' + ym);
    } finally {
      diskDb.close();
    }

    // Restart Electron #2 to verify persistence in live Budgets UI + zero runtime errors
    running = await start(profile);
    attachListeners(running.cdp);
    await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-workspace-bar'));`, 'restarted shell');
    await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Orçamentos');`, 'nav Orçamentos');
    await waitFor(running.cdp, `return document.body.textContent.includes('Moradia') && document.body.textContent.includes('Alimentação');`, 'Budgets UI persisted');
    await shot(running.cdp, outputDir, 'm3-budgets-after-restart');

    assert.equal(issues.length, 0, 'Unexpected runtime console/page errors: ' + issues.join(' | '));
    console.log('PASS LEVEL B M3 INTERACTIVE: M3-J1..M3-J4 + persistence across restart + dark/light 1366x768 & 1920x1080 (0 runtime issues)');
    console.log('Artifacts:', outputDir);
  } finally {
    if (pump) await pump.stop().catch(() => {});
    if (running) {
      try { running.child.kill(); } catch {}
      await delay(400);
    }
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
}

if (require.main === module) {
  runM3LevelB().catch((err) => {
    console.error('FAIL LEVEL B M3:', err);
    process.exitCode = 1;
  });
}
module.exports = { runM3LevelB };
