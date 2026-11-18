'use strict';
// Nível B Real Interactive Electron UI QA Runner (PJ-01..PJ-09, NJ-01..NJ-05).
// Drives the REAL Electron window via CDP (mouse/keyboard/insertText + Page dialogs)
// and Windows UIAutomation for MAIN native dialog.showMessageBox prompts.
// Strictly synthetic data under MF_QA_SYNTHETIC=1 and isolated temp userData.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { FinanceDB } = require('../electron/db.cjs');
const { PlanningStore } = require('../electron/planning.cjs');
const { validateBackupFile, restoreBackup } = require('../electron/recovery.cjs');
const { start, evaluate, closeCleanly } = require('./d1-electron-smoke.cjs');

const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const ACC1_ID = '22222222-2222-4222-8222-222222222222';
const ACC2_ID = '33333333-3333-4333-8333-333333333333';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function localIso(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

function shiftMonthLocal(ym, offset) {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(y, m - 1 + offset, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function advanceDateLocal(isoStr, days) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return localIso(dt);
}

function safeDayInMonth(ym, preferredDay) {
  const [y, m] = ym.split('-').map(Number);
  const maxDay = new Date(y, m, 0).getDate();
  const today = localIso();
  const currentYm = today.slice(0, 7);
  const cap = ym === currentYm ? Math.max(1, Number(today.slice(8, 10))) : maxDay;
  const day = Math.min(preferredDay, cap, maxDay);
  return `${ym}-${String(day).padStart(2, '0')}`;
}

function assertSafeEnvironment() {
  if (process.env.MF_QA_SYNTHETIC !== '1') {
    throw new Error('REFUSED: MF_QA_SYNTHETIC=1 obrigatório para Nível B QA.');
  }
  if (process.env.MF_REAL_PROFILE) {
    throw new Error('REFUSED: MF_REAL_PROFILE deve estar vazio no QA sintético.');
  }
  const pluggyKeys = Object.keys(process.env).filter(k => /^PLUGGY_/i.test(k) && process.env[k]);
  if (pluggyKeys.length) {
    throw new Error('REFUSED: variáveis PLUGGY_* devem estar vazias: ' + pluggyKeys.join(','));
  }
}

function createRichSyntheticProfile(profile) {
  const today = localIso();
  const ym = today.slice(0, 7);
  const prevYm = shiftMonthLocal(ym, -1);
  const dbPath = path.join(profile, 'meu-financeiro.sqlite');
  const db = new FinanceDB(dbPath);
  const dates = {
    today,
    ym,
    prevYm,
    d02: safeDayInMonth(ym, 2),
    d03: safeDayInMonth(ym, 3),
    d04: safeDayInMonth(ym, 4),
    d05: safeDayInMonth(ym, 5),
    d06: safeDayInMonth(ym, 6),
    d07: safeDayInMonth(ym, 7),
    d08: safeDayInMonth(ym, 8),
    d09: safeDayInMonth(ym, 9),
    d10: safeDayInMonth(ym, 10),
    d11: safeDayInMonth(ym, 11),
    d12: safeDayInMonth(ym, 12),
    d14: safeDayInMonth(ym, 14),
    prev10: `${prevYm}-10`,
    prev12: `${prevYm}-12`,
    dueSoon: advanceDateLocal(today, 3),
    dueEst: advanceDateLocal(today, 5)
  };
  try {
    db.save('real', {
      version: 5,
      transactions: [
        {
          id: 'man-alimentacao-1',
          date: dates.d05,
          description: 'Padaria Central QA',
          kind: 'expense',
          amount: 15000,
          category: 'Alimentação',
          categoryId: 'cat:alimentacao',
          subcategoryId: 'sub:alimentacao/supermercados',
          origin: 'manual'
        },
        {
          id: 'man-alimentacao-2',
          date: dates.d08,
          description: 'Restaurante Sabor QA',
          kind: 'expense',
          amount: 42000,
          category: 'Alimentação',
          categoryId: 'cat:alimentacao',
          subcategoryId: 'sub:alimentacao/restaurantes',
          origin: 'manual'
        },
        {
          id: 'man-link-candidate',
          date: dates.d10,
          description: 'Recibo Mercado Manual QA',
          kind: 'expense',
          amount: 8500,
          category: 'Alimentação',
          categoryId: 'cat:alimentacao',
          subcategoryId: 'sub:alimentacao/supermercados',
          origin: 'manual'
        },
        {
          id: 'man-salario-1',
          date: dates.d02,
          description: 'Salário Sintético QA',
          kind: 'income',
          amount: 850000,
          category: 'Salário',
          origin: 'manual'
        },
        {
          id: 'man-prev-1',
          date: dates.prev10,
          description: 'Mercado Mês Anterior QA',
          kind: 'expense',
          amount: 30000,
          category: 'Alimentação',
          origin: 'manual'
        }
      ],
      budgets: {
        'Alimentação': 50000,
        'Transporte': 30000,
        'Lazer': 10000
      },
      settings: {
        opening: 500000,
        income: 850000,
        fixed: 220000,
        existing: 50000,
        reserve: 100000
      }
    });

    db.save('demo', {
      version: 5,
      transactions: [
        {
          id: 'demo-tx-1',
          date: dates.d05,
          description: 'Café Demo Sintético',
          kind: 'expense',
          amount: 2450,
          category: 'Outros',
          origin: 'manual'
        }
      ],
      budgets: { 'Alimentação': 30000 },
      settings: { opening: 145000, income: 520000, fixed: 220000, existing: 35000, reserve: 100000 }
    });

    db.ingestBank(ITEM_ID, {
      item: { status: 'UPDATED' },
      data: [
        {
          account: {
            id: ACC1_ID,
            name: 'Banco Sintético Alfa',
            balance: 4200,
            type: 'BANK',
            subtype: 'CHECKING_ACCOUNT',
            currencyCode: 'BRL'
          },
          transactions: [
            {
              id: 'bnk-review-1',
              date: dates.d06,
              description: 'SUPERMERCADO ALFA QA',
              amount: -180.0,
              status: 'POSTED',
              category: 'Groceries'
            },
            {
              id: 'bnk-detail-1',
              date: dates.d07,
              description: 'CAFETERIA EXPRESSO QA',
              amount: -45.5,
              status: 'POSTED',
              category: 'Restaurants'
            },
            {
              id: 'bnk-link-target',
              date: dates.d10,
              description: 'MERCADO UNICO LINK QA',
              amount: -85.0,
              status: 'POSTED',
              category: 'Groceries'
            },
            {
              id: 'bnk-rule-match',
              date: dates.d09,
              description: 'PETSHOP AMIGO QA',
              amount: -95.0,
              status: 'POSTED',
              category: 'Shopping'
            },
            {
              id: 'bnk-ambig-1',
              date: dates.d04,
              description: 'MERCADO BAIRRO NORTE',
              amount: -62.0,
              status: 'POSTED',
              category: 'Shopping'
            },
            {
              id: 'bnk-ambig-2',
              date: dates.d03,
              description: 'MERCADO BAIRRO SUL',
              amount: -74.0,
              status: 'POSTED',
              category: 'Shopping'
            },
            {
              id: 'bnk-d01-unique',
              date: dates.d11,
              description: 'LIVRARIA CULTURA UNICA QA',
              amount: -110.0,
              status: 'POSTED',
              category: 'Shopping'
            },
            {
              id: 'bnk-food-exceed',
              date: dates.d12,
              description: 'SUPERMERCADO BOM PRECO',
              amount: -520.0,
              status: 'POSTED',
              category: 'Groceries'
            },
            {
              id: 'bnk-prev-1',
              date: dates.prev12,
              description: 'SUPERMERCADO MES ANTERIOR',
              amount: -250.0,
              status: 'POSTED',
              category: 'Groceries'
            },
            {
              id: 'bnk-salary',
              date: dates.d02,
              description: 'FOLHA SINTETICA EMPREGADOR',
              amount: 7500.0,
              status: 'POSTED',
              category: 'Salary'
            },
            {
              id: 'bnk-pending',
              date: dates.d14,
              description: 'COMPRA PENDENTE PROCESSANDO',
              amount: -33.0,
              status: 'PENDING',
              category: 'Shopping'
            }
          ]
        },
        {
          account: {
            id: ACC2_ID,
            name: 'Banco Sintético Beta',
            balance: 1500,
            type: 'BANK',
            subtype: 'CHECKING_ACCOUNT',
            currencyCode: 'BRL'
          },
          transactions: [
            {
              id: 'bnk-xfer-out',
              date: dates.d11,
              description: 'PIX TRANSF PROPRIA SAIDA',
              amount: -300.0,
              status: 'POSTED',
              category: 'Transfers'
            },
            {
              id: 'bnk-xfer-in',
              date: dates.d11,
              description: 'PIX TRANSF PROPRIA ENTRADA',
              amount: 300.0,
              status: 'POSTED',
              category: 'Transfers'
            }
          ]
        }
      ]
    });

    const planner = new PlanningStore(db);
    planner.create({
      title: 'Conta de Luz QA',
      kind: 'expense',
      amount: 21000,
      dueDate: dates.dueSoon,
      category: 'Contas',
      certainty: 'confirmed'
    });
    planner.create({
      title: 'Freelance Incerto QA',
      kind: 'income',
      amount: 120000,
      dueDate: dates.dueEst,
      category: 'Outros',
      certainty: 'estimated'
    });
  } finally {
    db.close();
  }
  return dates;
}

async function ensureWindowFocus(cdp, _pid) {
  try { await cdp.send('Page.bringToFront'); } catch {}
  await delay(80);
  try { return await evaluate(cdp, 'return document.hasFocus();'); } catch { return true; }
}

function startNativeDialogClicker(pid, buttonLabels, timeoutMs = 15000) {
  const labelsArray = (Array.isArray(buttonLabels) ? buttonLabels : [buttonLabels])
    .map(s => `'${String(s).replace(/'/g, "''")}'`)
    .join(',');
  const ps = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinClick {
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$root = [System.Windows.Automation.AutomationElement]::RootElement
$targets = @(${labelsArray})
$deadline = [DateTime]::UtcNow.AddMilliseconds(${Number(timeoutMs)})
$pidFilter = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, ${Number(pid)})
while ([DateTime]::UtcNow -lt $deadline) {
  $wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $pidFilter)
  foreach ($w in $wins) {
    if ($w.Current.ClassName -ne '#32770') { continue }
    $all = $w.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($b in $all) {
      $name = ([string]$b.Current.Name).Replace('&','')
      foreach ($t in $targets) {
        if ($name -eq $t) {
          $hwnd = [IntPtr]$b.Current.NativeWindowHandle
          if ($hwnd -ne [IntPtr]::Zero) {
            [WinClick]::PostMessage($hwnd, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
            Write-Output "CLICKED:$name"
            exit 0
          }
          try {
            $inv = $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
            $inv.Invoke()
            Write-Output "CLICKED:$name"
            exit 0
          } catch {}
        }
      }
    }
  }
  Start-Sleep -Milliseconds 100
}
Write-Error "TIMEOUT_NATIVE_DIALOG"
exit 1
`;
  const proc = spawn('powershell.exe', ['-NoProfile', '-Command', ps], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  let err = '';
  proc.stdout.on('data', d => { out += String(d); });
  proc.stderr.on('data', d => { err += String(d); });
  const done = new Promise((resolve, reject) => {
    proc.on('exit', code => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`Native dialog helper failed (${code}): ${err.trim() || out.trim()}`));
    });
    proc.on('error', reject);
  });
  return { proc, done };
}

class CDPUIDriver {
  constructor(running, outputDir) {
    this.running = running;
    this.cdp = running.cdp;
    this.outputDir = outputDir;
    this.confirmQueue = [];
    this.dialogsSeen = [];
    this.runtimeIssues = [];
    this._attached = false;
  }

  async init() {
    if (this._attached) return;
    this._attached = true;
    await this.cdp.send('Page.enable');
    this.cdp.socket.addEventListener('message', event => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.method === 'Page.javascriptDialogOpening') {
        const accept = this.confirmQueue.length ? this.confirmQueue.shift() : true;
        this.dialogsSeen.push({
          type: msg.params?.type,
          message: msg.params?.message,
          accepted: accept
        });
        this.cdp.send('Page.handleJavaScriptDialog', { accept }).catch(() => {});
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.runtimeIssues.push('[JS_EXCEPTION] ' + (msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || 'unknown'));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        this.runtimeIssues.push('[CONSOLE_ERROR] ' + (msg.params.args || []).map(a => a.value || a.description || '').join(' '));
      }
    });
  }

  pushNextConfirm(accept) {
    this.confirmQueue.push(Boolean(accept));
  }

  async eval(body) {
    return evaluate(this.cdp, body);
  }

  async waitFor(fnBody, label, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    let lastErr = null;
    const wrapped = `
      const __res = await (async () => { ${fnBody} })();
      if (__res instanceof Node) return true;
      return __res;
    `;
    while (Date.now() < deadline) {
      try {
        const res = await this.eval(wrapped);
        if (res) return res;
      } catch (e) {
        lastErr = e;
      }
      await delay(80);
    }
    throw new Error(`Timeout waiting for ${label}` + (lastErr ? ` (${lastErr.message})` : ''));
  }

  async clickCoords(x, y) {
    await this.cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x, y, button: 'none', clickCount: 0
    });
    await this.cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', clickCount: 1
    });
    await this.cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', clickCount: 1
    });
    await delay(80);
  }

  async clickElement(finderBody, label = 'element') {
    const rect = await this.waitFor(`
      const el = (() => { ${finderBody} })();
      if (!el || el.disabled) return null;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    `, label);
    await this.clickCoords(rect.x, rect.y);
  }

  async clickButtonText(text, rootSelector = 'document') {
    await this.clickElement(`
      const root = ${rootSelector};
      const target = ${JSON.stringify(text)};
      return [...root.querySelectorAll('button')].find(b => !b.disabled && b.textContent.replace(/\\s+/g,' ').trim() === target)
        || [...root.querySelectorAll('button')].find(b => !b.disabled && b.textContent.replace(/\\s+/g,' ').includes(target));
    `, `button "${text}"`);
  }

  async fillText(finderBody, text, label = 'input') {
    const info = await this.waitFor(`
      const el = (() => { ${finderBody} })();
      if (!el || el.disabled) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), type: el.type || 'text', tag: el.tagName };
    `, label);
    await this.clickCoords(info.x, info.y);
    if (info.type === 'date' || info.type === 'month') {
      await this.eval(`
        const el = (() => { ${finderBody} })();
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, ${JSON.stringify(String(text))});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      `);
      await delay(80);
      return;
    }
    await this.eval(`
      const el = (() => { ${finderBody} })();
      el.focus();
      el.select?.();
    `);
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    if (String(text).length > 0) {
      await this.cdp.send('Input.insertText', { text: String(text) });
    }
    await delay(80);
  }

  async pressKey(key, code, vk) {
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk });
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
    await delay(70);
  }

  async selectNative(finderBody, value, label = 'select') {
    await this.waitFor(`
      const el = (() => { ${finderBody} })();
      if (!el || el.disabled) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    `, label);
    await delay(80);
  }

  async pickStyledSelect(triggerFinderBody, optionText, label = 'StyledSelect') {
    await this.clickElement(triggerFinderBody, label + ' trigger');
    await this.clickElement(`
      const target = ${JSON.stringify(optionText)};
      return [...document.querySelectorAll('.mf-select-popover button[role="option"]')]
        .find(b => b.textContent.replace(/\\s+/g,' ').includes(target));
    `, label + ' option "' + optionText + '"');
  }

  async navigate(navLabel) {
    await this.clickElement(`
      return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(navLabel)});
    `, `nav "${navLabel}"`);
    await this.waitFor(`
      return document.querySelector('.mf-workspace-bar strong')?.textContent === ${JSON.stringify(navLabel)};
    `, `workspace title "${navLabel}"`);
    await delay(120);
  }

  async screenshot(name) {
    const res = await this.cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      fromSurface: true
    });
    const buf = Buffer.from(res.data, 'base64');
    assert(buf.length > 100 && buf.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'Invalid PNG');
    const file = path.join(this.outputDir, `${name}.png`);
    fs.writeFileSync(file, buf);
    return file;
  }
}

async function runNivelB(options = {}) {
  assertSafeEnvironment();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = options.outputDir || process.env.MF_NIVEL_B_OUTPUT_DIR || path.join(os.tmpdir(), `mf-nivel-b-qa-${stamp}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const profile = options.profileDir
    ? path.resolve(options.profileDir)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'mf-d1-electron-nivelb-'));
  fs.mkdirSync(profile, { recursive: true });
  const startElectron = typeof options.startFn === 'function' ? options.startFn : start;
  const dbFile = path.join(profile, 'meu-financeiro.sqlite');
  const dates = createRichSyntheticProfile(profile);

  const journeys = [];
  let running = null;
  let allIssues = [];
  let savedBackupPath = null;

  const recordJourney = async (id, title, fn) => {
    const started = Date.now();
    try {
      const details = await fn();
      journeys.push({ id, title, status: 'PASS', durationMs: Date.now() - started, details });
      console.log(`[PASS] ${id} — ${title}`);
    } catch (err) {
      const msg = String(err?.stack || err?.message || err);
      journeys.push({ id, title, status: 'FAIL', durationMs: Date.now() - started, error: msg });
      console.error(`[FAIL] ${id} — ${title}: ${err?.message || err}`);
    }
  };

  try {
    // ------------------------------------------------------------------
    // SESSION 1: PJ-01 .. PJ-09 (part 1) + NJ-01 .. NJ-04
    // ------------------------------------------------------------------
    running = await startElectron(profile);
    const ui = new CDPUIDriver(running, outputDir);
    await ui.init();
    await ensureWindowFocus(running.cdp, running.child.pid);
    if (typeof options.onSessionReady === 'function') {
      await options.onSessionReady(running, ui, profile);
    }

    // PJ-01: Overview navigation, masking, source & period switching, charts, drilldown
    await recordJourney('PJ-01', 'Visão geral: startup, mascaramento, fonte, período, gráficos e drilldown B01', async () => {
      const init = await ui.eval(`
        return {
          modeTag: document.querySelector('.mode-tag')?.textContent?.trim(),
          title: document.querySelector('.mf-workspace-bar strong')?.textContent?.trim(),
          balance: document.querySelector('.u1-balance-value')?.textContent?.trim()
        };
      `);
      assert.equal(init.modeTag, 'PRIVADO');
      assert.equal(init.title, 'Visão geral');
      assert.match(init.balance, /R\$/);

      // Mask values
      await ui.clickElement(`return document.querySelector('button[aria-label="Ocultar valores"]');`, 'Ocultar valores');
      const masked = await ui.eval(`return document.querySelector('.u1-balance-value')?.textContent?.trim();`);
      assert.equal(masked, '••••');
      await ui.clickElement(`return document.querySelector('button[aria-label="Mostrar valores"]');`, 'Mostrar valores');
      const unmasked = await ui.eval(`return document.querySelector('.u1-balance-value')?.textContent?.trim();`);
      assert.match(unmasked, /R\$/);

      // Source switching: bank -> manual -> bank
      await ui.clickElement(`return document.querySelector('.mf-source-trigger');`, 'Source trigger');
      await ui.clickButtonText('Adicionado por você', 'document.querySelector(".mf-source-panel")');
      await ui.waitFor(`return document.querySelector('.u1-context')?.textContent?.includes('Registros manuais');`, 'Manual source active');
      await ui.clickElement(`return document.querySelector('.mf-source-trigger');`, 'Source trigger 2');
      await ui.clickButtonText('Contas conectadas', 'document.querySelector(".mf-source-panel")');
      await ui.waitFor(`return document.querySelector('.u1-context')?.textContent?.includes('Movimentos confirmados');`, 'Bank source active');

      // PeriodPicker switching: 15d -> lastmonth -> month
      await ui.clickElement(`return document.querySelector('.mf-period-trigger');`, 'PeriodPicker trigger');
      await ui.clickButtonText('Últimos 15 dias', 'document.querySelector(".mf-period-popover")');
      await ui.clickElement(`return document.querySelector('.mf-period-trigger');`, 'PeriodPicker trigger 2');
      await ui.clickButtonText('Mês passado', 'document.querySelector(".mf-period-popover")');
      await ui.clickElement(`return document.querySelector('.mf-period-trigger');`, 'PeriodPicker trigger 3');
      await ui.clickButtonText('Mês atual', 'document.querySelector(".mf-period-popover")');

      // Chart toggle + <details> data table
      await ui.clickButtonText('Entradas e saídas', 'document.querySelector(".u1-chart-tabs")');
      await ui.waitFor(`return document.querySelector('.u1-chart-tabs button[aria-pressed="true"]')?.textContent?.includes('Entradas e saídas');`, 'Flow chart active');
      await ui.clickButtonText('Acumulado', 'document.querySelector(".u1-chart-tabs")');
      await ui.clickElement(`return document.querySelector('.u1-chart-data summary');`, 'Chart details summary');

      // B01 category distribution -> select Alimentação -> Ver movimentações (triggers D05 real session auth dialog!)
      await ui.clickElement(`
        return [...document.querySelectorAll('.qa84-category-row')].find(b => b.textContent.includes('Alimentação'));
      `, 'B01 Alimentação row');
      await ui.waitFor(`return document.querySelector('.qa84-breakdown-selection')?.textContent?.includes('Alimentação');`, 'B01 selection');

      await ensureWindowFocus(running.cdp, running.child.pid);
      const authClicker = startNativeDialogClicker(running.child.pid, ['Autorizar consulta local']);
      await ui.clickButtonText('Ver movimentações', 'document.querySelector(".qa84-breakdown-selection")');
      await authClicker.done;
      await ui.waitFor(`return document.getElementById('d05-movements') && !document.body.textContent.includes('Conferindo hierarquia D05');`, 'D05 loaded after drilldown');
      await ui.screenshot('pj01-overview-to-d05');
      // Clear category & source filters on D05 after B01 drilldown
      await ui.clickElement(`return document.querySelector('.d05-more');`, 'Filtros +');
      await ui.clickElement(`return document.querySelector('.d05-parent-filters button');`, 'Todas categorias');
      await ui.selectNative(`return [...document.querySelectorAll('.d05-filter')].find(l => l.textContent.includes('Origem'))?.querySelector('select');`, 'all', 'Origem all');
      await ui.clickElement(`return document.querySelector('.d05-more');`, 'Filtros -');
      return 'Overview masking, source/period switch, chart toggle, and B01 drilldown verified';
    });

    // PJ-02 (part 1: real CRUD/search/filters/edit) + PJ-03 + NJ-02 (before any window.confirm or demo switch)
    let pj02RealSummary = '';
    await recordJourney('PJ-02', 'Movimentações D05: criar manual, busca/filtros/agrupamento, editar (real) + demo D05 inline picker', async () => {
      // Create manual transaction via + Nova movimentação
      await ui.clickButtonText('+ Nova movimentação', 'document.getElementById("d05-movements")');
      await ui.fillText(`return [...document.querySelectorAll('.d05-floating label.d05-field')].find(l => l.textContent.includes('Descrição'))?.querySelector('input');`, 'Padaria Nova QA', 'Manual desc');
      await ui.fillText(`return [...document.querySelectorAll('.d05-floating label.d05-field')].find(l => l.textContent.includes('Data'))?.querySelector('input');`, dates.d12, 'Manual date');
      await ui.fillText(`return [...document.querySelectorAll('.d05-floating label.d05-field')].find(l => l.textContent.includes('Valor'))?.querySelector('input');`, '123,45', 'Manual value');
      await ui.clickElement(`return [...document.querySelectorAll('.d05-floating .d05-catalog-choice')].find(b => b.textContent.includes('Alimentação'));`, 'Manual parent Alimentação');
      await ui.clickElement(`return [...document.querySelectorAll('.d05-floating .d05-child')].find(b => b.textContent.includes('Delivery'));`, 'Manual child Delivery');
      await ui.clickButtonText('Confirmar lançamento', 'document.querySelector(".d05-floating")');
      await ui.waitFor(`return [...document.querySelectorAll('.d05-merchant')].some(b => b.textContent.includes('Padaria Nova QA'));`, 'Created row visible');

      // Search + Filtros + -> Origem Manuais, Ordenação Maior valor, Agrupar por dia switch
      await ui.fillText(`return document.querySelector('.d05-search-wrap input');`, 'Padaria Nova', 'Search Padaria Nova');
      await ui.waitFor(`return document.querySelectorAll('.d05-row').length === 1;`, 'Filtered to 1 row');
      await ui.clickElement(`return document.querySelector('.d05-more');`, 'Expand Filtros +');
      await ui.selectNative(`return [...document.querySelectorAll('.d05-filter')].find(l => l.textContent.includes('Origem'))?.querySelector('select');`, 'manual', 'Origem manual');
      await ui.selectNative(`return [...document.querySelectorAll('.d05-filter')].find(l => l.textContent.includes('Ordenação'))?.querySelector('select');`, 'largest', 'Sort largest');
      await ui.clickElement(`return document.querySelector('.d05-group-toggle');`, 'Toggle Agrupar por dia off');
      assert.equal(await ui.eval(`return document.querySelector('.d05-group-toggle')?.getAttribute('aria-checked');`), 'false');
      await ui.clickElement(`return document.querySelector('.d05-group-toggle');`, 'Toggle Agrupar por dia on');

      // Open Detail Drawer on Padaria Nova QA -> edit description & value (150,00) -> Salvar alterações
      await ui.clickElement(`return [...document.querySelectorAll('.d05-merchant')].find(b => b.textContent.includes('Padaria Nova QA'));`, 'Open Padaria Nova QA');
      await ui.fillText(`return [...document.querySelectorAll('.mf-manual-editor label.field')].find(l => l.textContent.includes('Descrição'))?.querySelector('input');`, 'Padaria Nova Editada QA', 'Edit desc');
      await ui.fillText(`return [...document.querySelectorAll('.mf-manual-editor label.field')].find(l => l.textContent.includes('Valor'))?.querySelector('input');`, '150,00', 'Edit value');
      await ui.clickButtonText('Salvar alterações', 'document.querySelector(".mf-manual-editor")');
      await ui.waitFor(`return !document.querySelector('.mf-detail-drawer') && [...document.querySelectorAll('.d05-merchant')].some(b => b.textContent.includes('Padaria Nova Editada QA'));`, 'Updated row visible');

      // Clear search/filters
      await ui.fillText(`return document.querySelector('.d05-search-wrap input');`, '', 'Clear search');
      await ui.selectNative(`return [...document.querySelectorAll('.d05-filter')].find(l => l.textContent.includes('Origem'))?.querySelector('select');`, 'all', 'Origem all');
      await ui.clickElement(`return document.querySelector('.d05-more');`, 'Collapse Filtros');
      pj02RealSummary = 'Manual CRUD, search/filters/group, and drawer edit verified';
      return pj02RealSummary;
    });

    // PJ-03: Bank review, detail drawer metadata, merchant alias, manual reconciliation
    await recordJourney('PJ-03', 'Revisão bancária, detalhes, alias de estabelecimento e vínculo manual', async () => {
      await ui.waitFor(`return document.getElementById('d05-movements');`, 'D05 ready');
      await ui.clickButtonText('A conferir', 'document.querySelector(".d05-tabs")');
      await ui.waitFor(`return [...document.querySelectorAll('.d05-row')].some(r => r.textContent.includes('SUPERMERCADO ALFA QA'));`, 'Unreviewed bank row listed');

      // Review SUPERMERCADO ALFA QA via review dot -> Marcar como revisada
      await ui.clickElement(`return document.querySelector('button[aria-label="Conferir movimentação SUPERMERCADO ALFA QA"]');`, 'Review dot SUPERMERCADO ALFA QA');
      await ui.waitFor(`return document.querySelector('.d05-floating .d05-confirm')?.textContent?.includes('Marcar como revisada');`, 'Review panel open');
      await ui.clickButtonText('Marcar como revisada', 'document.querySelector(".d05-floating")');
      await ui.waitFor(`return !document.querySelector('.d05-floating') && document.body.textContent.includes('Conferência registrada');`, 'Review saved');

      // Verify moved to Revisadas
      await ui.clickButtonText('Revisadas', 'document.querySelector(".d05-tabs")');
      await ui.waitFor(`return [...document.querySelectorAll('.d05-row')].some(r => r.textContent.includes('SUPERMERCADO ALFA QA'));`, 'Moved to Revisadas');
      await ui.clickButtonText('Todas', 'document.querySelector(".d05-tabs")');

      // Open CAFETERIA EXPRESSO QA detail drawer -> merchant, note, reviewed, alias
      await ui.clickElement(`return [...document.querySelectorAll('.d05-merchant')].find(b => b.textContent.includes('CAFETERIA EXPRESSO QA'));`, 'Open CAFETERIA EXPRESSO QA');
      await ui.waitFor(`return document.querySelector('.mf-detail-drawer');`, 'Bank detail drawer open');
      await ui.fillText(`return [...document.querySelectorAll('.mf-detail-drawer label.field')].find(l => l.textContent.includes('Nome do estabelecimento'))?.querySelector('input');`, 'Cafeteria Expresso VIP', 'Merchant input');
      await ui.fillText(`return document.querySelector('.mf-note-input');`, 'Reunião sintética QA', 'Note input');
      await ui.clickElement(`return document.querySelector('.mf-review-checkbox input[type="checkbox"]');`, 'Reviewed checkbox');
      await ui.clickButtonText('Salvar detalhes', 'document.querySelector(".mf-detail-drawer")');
      await ui.waitFor(`return document.querySelector('.mf-reviewed')?.textContent?.includes('Revisada');`, 'Bank detail saved');
      await ui.clickButtonText('Usar este nome nas movimentações semelhantes', 'document.querySelector(".mf-detail-drawer")');
      await ui.waitFor(`return document.querySelector('.mf-detail-drawer')?.textContent?.includes('Regra:');`, 'Alias rule created');
      await ui.clickElement(`return document.querySelector('.mf-detail-drawer .close-button');`, 'Close drawer');

      // Open MERCADO UNICO LINK QA -> link Recibo Mercado Manual QA
      await ui.clickElement(`return [...document.querySelectorAll('.d05-merchant')].find(b => b.textContent.includes('MERCADO UNICO LINK QA'));`, 'Open MERCADO UNICO LINK QA');
      await ui.waitFor(`return document.querySelector('.mf-detail-drawer')?.textContent?.includes('Recibo Mercado Manual QA');`, 'Match suggestion visible');
      await ui.clickElement(`
        const sug = [...document.querySelectorAll('.mf-detail-drawer .mf-suggestion')].find(s => s.textContent.includes('Recibo Mercado Manual QA'));
        return sug?.querySelector('button');
      `, 'Vincular manual');
      await ui.waitFor(`return document.querySelector('.mf-detail-drawer')?.textContent?.includes('Vinculado a um lançamento que você adicionou');`, 'Linked badge shown');
      await ui.screenshot('pj03-bank-detail-link');
      await ui.clickElement(`return document.querySelector('.mf-detail-drawer .close-button');`, 'Close drawer');
      return 'Bank review, merchant/note/reviewed save, merchant alias, and manual link verified';
    });

    // NJ-02: Denied personal AI write + blocked experimental network (runs BEFORE any window.confirm!)
    await recordJourney('NJ-02', 'Bloqueio de escrita pessoal pela IA e rede experimental bloqueada', async () => {
      // Attempt D05 inline categorization on real bank row -> personal-locked
      await ui.clickElement(`
        const row = [...document.querySelectorAll('.d05-row')].find(r => r.textContent.includes('SUPERMERCADO BOM PRECO'));
        return row?.querySelector('.d05-row-icon');
      `, 'Bank row icon');
      await ui.waitFor(`return document.querySelector('.d05-picker');`, 'Picker open');
      await ui.clickElement(`return [...document.querySelectorAll('.d05-picker .d05-catalog-choice')].find(b => b.textContent.includes('Transporte'));`, 'Parent Transporte');
      await ui.clickElement(`return [...document.querySelectorAll('.d05-picker .d05-child')].find(b => b.textContent.includes('Somente Transporte'));`, 'Somente Transporte');
      await ui.clickButtonText('Conferir prévia antes de salvar', 'document.querySelector(".d05-picker")');
      await delay(250);
      const acctClicker = startNativeDialogClicker(running.child.pid, ['Autorizar esta conta']);
      await acctClicker.done;
      await ui.waitFor(`return document.querySelector('.d05-picker')?.textContent?.includes('Gravação pessoal ainda não autorizada; nenhum dado foi alterado');`, 'personal-locked message');
      await ui.screenshot('nj02-personal-locked');
      await ui.pressKey('Escape', 'Escape', 27);

      // Verify d05PersonalWriteConfirm denies execution even with valid proposalId + nonce
      const personalDenied = await ui.eval(`
        const auth = await window.financeDesktop.d05SessionAuthorize({ profile: 'real' });
        const preview = await window.financeDesktop.d05PersonalWritePreview({
          sessionToken: auth.token, action: 'bank.categorize',
          accountId: ${JSON.stringify(ACC1_ID)}, externalId: 'bnk-food-exceed',
          target: { categoryId: 'cat:transporte', subcategoryId: null }
        });
        try {
          const confirmRes = await window.financeDesktop.d05PersonalWriteConfirm({
            sessionToken: auth.token, proposalId: preview.proposalId, nonce: preview.nonce
          });
          return {
            denied: confirmRes?.status === 'denied' && confirmRes?.changesApplied === false && confirmRes?.personalWriteAuthorized === false,
            confirmRes
          };
        } catch (e) {
          return { denied: true, message: String(e?.message || e) };
        }
      `);
      assert.equal(personalDenied.denied, true);

      // Navigate to Minhas contas -> verify isolated experimental alert & disabled sync + blocked AI/cloud network
      await ui.navigate('Minhas contas');
      const bankPage = await ui.eval(`
        return {
          alertText: document.querySelector('.u3-connection-alert')?.textContent?.trim() || '',
          syncDisabled: [...document.querySelectorAll('button')].find(b => b.textContent.includes('Atualizar contas'))?.disabled === true
        };
      `);
      assert.match(bankPage.alertText, /Pluggy e sincronização estão desativadas neste canal/);
      assert.equal(bankPage.syncDisabled, true);

      const netBlocked = await ui.eval(`
        let aiErr = '', cloudErr = '';
        try { await window.financeDesktop.aiConnect(); } catch (e) { aiErr = String(e?.message || e); }
        try { await window.financeDesktop.previewQuarantineDemo(); } catch (e) { cloudErr = String(e?.message || e); }
        return { aiErr, cloudErr };
      `);
      assert.match(netBlocked.aiErr, /desativadas|isolado/i);
      assert.match(netBlocked.cloudErr, /desativadas|isolado/i);
      return 'personal-locked UI, MAIN d05PersonalWriteConfirm denial, and blocked experimental network verified';
    });

    // PJ-04: Categories & Rules Editor
    await recordJourney('PJ-04', 'Categorias personalizadas e editor/teste de regras automáticas', async () => {
      await ui.navigate('Movimentações');
      await ui.clickButtonText('Categorias e regras', 'document.getElementById("d05-movements")');
      await ui.waitFor(`return document.querySelector('.categories-page');`, 'Categories page');

      // Create custom category Pets QA
      await ui.fillText(`return [...document.querySelectorAll('.mf-category-editor label.field')].find(l => l.textContent.includes('Nome'))?.querySelector('input');`, 'Pets QA', 'New category name');
      await ui.clickElement(`return [...document.querySelectorAll('.mf-category-editor .color-choice')][2];`, 'Pick color 3');
      await ui.clickButtonText('Adicionar categoria', 'document.querySelector(".mf-category-editor")');
      await ui.waitFor(`return [...document.querySelectorAll('.category-list-row b')].some(b => b.textContent === 'Pets QA');`, 'Pets QA created');

      // Edit Pets QA color
      await ui.clickElement(`
        const row = [...document.querySelectorAll('.category-list-row')].find(r => r.textContent.includes('Pets QA'));
        return row?.querySelector('button.small-link');
      `, 'Edit Pets QA');
      await ui.clickElement(`return [...document.querySelectorAll('.mf-category-editor .color-choice')][5];`, 'Pick color 6');
      await ui.clickButtonText('Salvar alterações', 'document.querySelector(".mf-category-editor")');
      await ui.waitFor(`return document.querySelector('.bank-feedback')?.textContent?.includes('Categoria salva');`, 'Pets QA edited');

      // Create rule PETSHOP AMIGO -> Pets QA
      await ui.fillText(`return [...document.querySelectorAll('.categories-page label.field')].find(l => l.textContent.includes('Texto da movimentação'))?.querySelector('input');`, 'PETSHOP AMIGO', 'Rule pattern');
      await ui.pickStyledSelect(`
        const card = [...document.querySelectorAll('.categories-page .settings-card')].find(c => c.textContent.includes('Regras automáticas'));
        return [...card.querySelectorAll('label.field')].find(l => l.textContent.includes('Categoria'))?.querySelector('.mf-select-trigger');
      `, 'Pets QA', 'Rule category');
      await ui.fillText(`return [...document.querySelectorAll('.categories-page label.field')].find(l => l.textContent.includes('Prioridade'))?.querySelector('input');`, '50', 'Rule priority');
      await ui.clickButtonText('Salvar regra', 'document.querySelector(".categories-page")');
      await ui.waitFor(`return document.querySelector('.rule-list')?.textContent?.includes('PETSHOP AMIGO');`, 'Rule listed');

      // Live test classification
      await ui.fillText(`return document.querySelector('.rule-preview input');`, 'PETSHOP AMIGO QA', 'Rule test input');
      const ruleOut = await ui.eval(`return document.querySelector('.rule-preview p strong')?.textContent?.trim();`);
      assert.equal(ruleOut, 'Pets QA');
      await ui.screenshot('pj04-categories-rules');
      await ui.clickButtonText('← Voltar ao histórico', 'document.querySelector(".movement-shell")');
      await ui.waitFor(`return document.getElementById('d05-movements');`, 'Back to D05 history');
      return 'Custom category Pets QA, rule PETSHOP AMIGO -> Pets QA, and live rule test verified';
    });

    // PJ-05: Budgets drilldown, subcategory history & edit limit (while real D05 session is active!)
    await recordJourney('PJ-05', 'Orçamentos: filtros, drilldown por categoria/subcategoria, edição de limite e Receitas', async () => {
      await ui.navigate('Orçamentos');
      await ui.waitFor(`return document.querySelector('.u3-budgets');`, 'Budgets page');
      await ui.clickButtonText('Pedem atenção', 'document.querySelector(".u3-budget-actions")');
      await ui.waitFor(`return [...document.querySelectorAll('.qa84-budget-card')].some(c => c.textContent.includes('Alimentação'));`, 'Attention shows Alimentação');
      await ui.clickButtonText('Todas', 'document.querySelector(".u3-budget-toolbar")');

      // Search & drill into Alimentação
      await ui.fillText(`return document.querySelector('.u3-budget-toolbar input');`, 'Aliment', 'Budget search');
      await ui.clickElement(`return document.getElementById('qa84-card-' + encodeURIComponent('Alimentação'));`, 'Alimentação card');
      await ui.waitFor(`return document.querySelector('.qa84-budget-detail') && !document.querySelector('.qa84-budget-loading');`, 'Budget detail ready');

      // Subcategory drilldown
      const hasSubcard = await ui.eval(`return !!document.querySelector('.qa84-subcategory-card');`);
      assert.equal(hasSubcard, true);
      await ui.clickElement(`return document.querySelector('.qa84-subcategory-card');`, 'Subcategory card');
      await ui.waitFor(`return document.querySelector('.qa84-subcategory-history .qa84-history-row');`, 'Subcategory history rows');
      await ui.clickButtonText('Alimentação', 'document.querySelector(".qa84-crumbs")');

      // Edit limit -> 800,00
      await ui.clickButtonText('Editar limite', 'document.querySelector(".qa84-budget-edit-actions")');
      await ui.waitFor(`return document.querySelector('.mf-budget-editor');`, 'Budget edit modal');
      await ui.fillText(`return document.querySelector('.mf-budget-editor input');`, '800,00', 'Budget limit 800,00');
      await ui.clickButtonText('Salvar alteração', 'document.querySelector(".mf-budget-editor")');
      await ui.waitFor(`return !document.querySelector('.mf-budget-editor') && document.querySelector('.qa84-budget-hero-financial')?.textContent?.includes('800,00');`, 'Updated limit R$ 800,00');
      await ui.screenshot('pj05-budget-drilldown-edited');

      // Return & switch to Receitas
      await ui.clickButtonText('Orçamentos', 'document.querySelector(".qa84-crumbs")');
      await ui.clickButtonText('Receitas', 'document.querySelector(".mf-budget-switch")');
      await ui.waitFor(`return document.querySelector('.mf-budget-summary')?.textContent?.includes('Total recebido no período');`, 'Income tab');
      return 'Budgets filters, subcategory drilldown, limit edit to R$ 800,00, and Receitas tab verified';
    });

    // NJ-03: Invalid BRL/dates, linked manual guard, bank split mismatch, in-use category delete
    await recordJourney('NJ-03', 'Validação de entradas inválidas, proteção de vínculo, categoria em uso e divisão divergente', async () => {
      await ui.navigate('Movimentações');
      await ui.waitFor(`return document.getElementById('d05-movements');`, 'D05 ready for NJ-03');
      // Ensure Origem filter is back to 'all' (in case drilldown from PJ-01 set host.state.txSource='bank')
      await ui.clickElement(`return document.querySelector('.d05-more');`, 'Expand Filtros + for NJ-03');
      await ui.clickElement(`return document.querySelector('.d05-parent-filters button');`, 'Todas categorias NJ-03');
      await ui.selectNative(`return [...document.querySelectorAll('.d05-filter')].find(l => l.textContent.includes('Origem'))?.querySelector('select');`, 'all', 'Origem all NJ-03');
      await ui.clickElement(`return document.querySelector('.d05-more');`, 'Collapse Filtros - NJ-03');
      // Invalid BRL & date inputs in D05 + Nova movimentação
      await ui.clickButtonText('+ Nova movimentação', 'document.getElementById("d05-movements")');
      await ui.fillText(`return [...document.querySelectorAll('.d05-floating label.d05-field')].find(l => l.textContent.includes('Descrição'))?.querySelector('input');`, 'Invalido QA', 'Invalid desc');
      for (const badVal of ['10,999', '-50', 'abc', '0,00']) {
        await ui.fillText(`return [...document.querySelectorAll('.d05-floating label.d05-field')].find(l => l.textContent.includes('Data'))?.querySelector('input');`, dates.d10, 'Valid date');
        await ui.fillText(`return [...document.querySelectorAll('.d05-floating label.d05-field')].find(l => l.textContent.includes('Valor'))?.querySelector('input');`, badVal, `Bad value ${badVal}`);
        await ui.clickButtonText('Confirmar lançamento', 'document.querySelector(".d05-floating")');
        await ui.waitFor(`return document.querySelector('.d05-floating .d05-message.is-error');`, `Error shown for ${badVal}`);
      }
      await ui.pressKey('Escape', 'Escape', 27);

      const badDateResult = await ui.eval(`
        return {
          bad3dec: parsePositiveBRLInput('10,999'),
          badNeg: parsePositiveBRLInput('-50'),
          badAlpha: parsePositiveBRLInput('abc'),
          badZero: parsePositiveBRLInput('0,00')
        };
      `);
      assert.equal(Number.isNaN(badDateResult.bad3dec) || badDateResult.bad3dec === null, true);

      // Linked manual transaction guard on man-link-candidate ('Recibo Mercado Manual QA')
      await ui.clickElement(`return [...document.querySelectorAll('.d05-merchant')].find(b => b.textContent.includes('Recibo Mercado Manual QA'));`, 'Open linked manual');
      const linkedState = await ui.waitFor(`
        const ed = document.querySelector('.mf-manual-editor');
        if (!ed) return null;
        const valInput = [...ed.querySelectorAll('label.field')].find(l => l.textContent.includes('Valor'))?.querySelector('input');
        const dateBtn = [...ed.querySelectorAll('label.field')].find(l => l.textContent.includes('Data'))?.querySelector('button');
        const delBtn = [...ed.querySelectorAll('button')].find(b => b.textContent.includes('Excluir lançamento'));
        return {
          valDisabled: valInput?.disabled,
          dateDisabled: dateBtn?.disabled,
          delDisabled: delBtn?.disabled,
          warning: ed.querySelector('.mf-manual-warning')?.textContent?.trim() || ''
        };
      `, 'Linked manual drawer');
      assert.equal(linkedState.valDisabled, true);
      assert.equal(linkedState.dateDisabled, true);
      assert.equal(linkedState.delDisabled, true);
      assert.match(linkedState.warning, /desvincule antes de alterar data, valor ou excluir/i);
      await ui.clickElement(`return document.querySelector('.mf-detail-drawer .close-button');`, 'Close linked drawer');

      // Bank split sum mismatch in drawer -> Salvar divisão disabled
      await ui.clickElement(`return [...document.querySelectorAll('.d05-merchant')].find(b => b.textContent.includes('SUPERMERCADO ALFA QA'));`, 'Open bank drawer for split');
      await ui.fillText(`return document.querySelector('.mf-split-row input');`, '1,00', 'Mismatch split part 1');
      const splitCheck = await ui.eval(`
        const btn = [...document.querySelectorAll('.mf-detail-drawer button')].find(b => b.textContent.includes('Salvar divisão'));
        const bad = document.querySelector('.mf-detail-split-footer strong.bad-text')?.textContent?.trim() || '';
        return { disabled: btn?.disabled, bad };
      `);
      assert.equal(splitCheck.disabled, true);
      assert.ok(splitCheck.bad.length > 0);
      await ui.clickElement(`return document.querySelector('.mf-detail-drawer .close-button');`, 'Close bank drawer');

      // Try deleting in-use category Pets QA (referenced by PETSHOP AMIGO rule)
      await ui.clickButtonText('Categorias e regras', 'document.getElementById("d05-movements")');
      await ui.waitFor(`return document.querySelector('.categories-page');`, 'Categories page');
      ui.pushNextConfirm(true);
      await ui.clickElement(`
        const row = [...document.querySelectorAll('.category-list-row')].find(r => r.textContent.includes('Pets QA'));
        return row?.querySelector('button.trash-button');
      `, 'Trash Pets QA');
      await ui.waitFor(`return document.querySelector('.bank-feedback')?.textContent?.match(/uso|regra|exclu/i);`, 'In-use category error');
      assert.equal(await ui.eval(`return [...document.querySelectorAll('.category-list-row b')].some(b => b.textContent === 'Pets QA');`), true);
      await ui.screenshot('nj03-guards-and-validation');
      await ui.clickButtonText('← Voltar ao histórico', 'document.querySelector(".movement-shell")');
      return 'Invalid BRL rejected, linked manual inputs disabled, split mismatch disabled, and in-use category preserved';
    });

    // NJ-01: Escape in modal/picker + Cancel in window.confirm + Demo D05 inline picker verification
    await recordJourney('NJ-01', 'Cancelamentos seguros: Escape em modal/picker e Cancelar em window.confirm', async () => {
      await ui.waitFor(`return document.getElementById('d05-movements');`, 'D05 ready for NJ-01');
      // Part 1: Open + Nova movimentação, type partial, press Escape
      await ui.clickButtonText('+ Nova movimentação', 'document.getElementById("d05-movements")');
      await ui.waitFor(`return document.querySelector('.d05-floating h3')?.textContent?.includes('Nova movimentação');`, 'D05 manual modal');
      await ui.fillText(`return [...document.querySelectorAll('.d05-floating label.d05-field')].find(l => l.textContent.includes('Descrição'))?.querySelector('input');`, 'Cancelada Escape QA', 'Manual desc');
      await ui.pressKey('Escape', 'Escape', 27);
      await ui.waitFor(`return !document.querySelector('.d05-floating');`, 'Manual modal closed by Escape');
      assert.equal(await ui.eval(`return document.body.textContent.includes('Cancelada Escape QA');`), false);

      // Part 2: Open D05 inline picker -> navigate to confirm step -> press Escape -> focus restored & unchanged
      await ui.clickElement(`return document.querySelector('.d05-row-icon');`, 'Row category icon');
      await ui.waitFor(`return document.querySelector('.d05-picker');`, 'D05 picker open');
      await ui.clickElement(`return [...document.querySelectorAll('.d05-picker .d05-catalog-choice')].find(b => b.textContent.includes('Alimentação'));`, 'Parent Alimentação');
      await ui.clickElement(`return [...document.querySelectorAll('.d05-picker .d05-child')].find(b => b.textContent.includes('Delivery'));`, 'Child Delivery');
      await ui.waitFor(`return document.querySelector('.d05-picker .d05-confirm-step');`, 'Confirm step');
      await ui.pressKey('Escape', 'Escape', 27);
      await ui.waitFor(`return !document.querySelector('.d05-picker');`, 'Picker closed on Escape');

      // Part 3: Open manual entry Detail Drawer -> click Excluir lançamento -> cancel confirm()
      await ui.selectNative(`return [...document.querySelectorAll('.d05-filter')].find(l => l.textContent.includes('Origem'))?.querySelector('select');`, 'manual', 'Origem manual');
      await ui.clickElement(`return [...document.querySelectorAll('.d05-merchant')].find(b => b.textContent.includes('Padaria Central QA'));`, 'Open Padaria Central QA');
      await ui.waitFor(`return document.querySelector('.mf-manual-editor');`, 'Manual drawer open');
      ui.pushNextConfirm(false);
      await ui.clickButtonText('Excluir lançamento', 'document.querySelector(".mf-manual-editor")');
      await delay(150);
      assert.equal(ui.dialogsSeen.at(-1)?.accepted, false);
      await ui.clickElement(`return document.querySelector('.mf-detail-drawer .close-button');`, 'Close drawer');
      await ui.waitFor(`return [...document.querySelectorAll('.d05-merchant')].some(b => b.textContent.includes('Padaria Central QA'));`, 'Manual entry preserved after cancel');
      await ui.selectNative(`return [...document.querySelectorAll('.d05-filter')].find(l => l.textContent.includes('Origem'))?.querySelector('select');`, 'all', 'Origem all');
      await ui.screenshot('nj01-cancel-flows');

      // Complete PJ-02 demo D05 inline picker check now (switching demo -> real cleanly)
      await ui.clickElement(`return document.querySelector('button.demo-btn');`, 'Explorar demonstração');
      await ui.waitFor(`return document.querySelector('.mode-tag')?.textContent?.trim() === 'DEMONSTRAÇÃO';`, 'Demo badge active');
      await ui.navigate('Movimentações');
      await ui.waitFor(`return [...document.querySelectorAll('.d05-merchant')].some(b => b.textContent.includes('Café Demo Sintético'));`, 'Demo row visible');
      await ui.clickElement(`
        const row = [...document.querySelectorAll('.d05-row')].find(r => r.textContent.includes('Café Demo Sintético'));
        return row?.querySelector('.d05-row-icon');
      `, 'Demo row icon');
      await ui.clickElement(`return [...document.querySelectorAll('.d05-picker .d05-catalog-choice')].find(b => b.textContent.includes('Alimentação'));`, 'Demo parent Alimentação');
      await ui.clickElement(`return [...document.querySelectorAll('.d05-picker .d05-child')].find(b => b.textContent.includes('Cafeterias'));`, 'Demo child Cafeterias');
      await ui.clickButtonText('Conferir prévia antes de salvar', 'document.querySelector(".d05-picker")');
      await ui.waitFor(`return document.querySelector('.d05-picker .d05-confirm')?.textContent?.includes('Reconfirmar e salvar demonstração');`, 'Demo manual-verify phase');
      await ui.clickButtonText('Reconfirmar e salvar demonstração', 'document.querySelector(".d05-picker")');
      await ui.waitFor(`return !document.querySelector('.d05-picker') && document.body.textContent.includes('Classificação de demonstração confirmada no SQLite');`, 'Demo SQLite readback confirmed');
      await ui.screenshot('pj02-d05-manual-demo');
      await ui.clickElement(`return document.querySelector('button.demo-btn');`, 'Voltar aos meus dados');
      await ui.waitFor(`return document.querySelector('.mode-tag')?.textContent?.trim() === 'PRIVADO';`, 'Real mode restored');

      return 'Escape on manual modal, Escape on D05 confirm step, Cancel on delete confirm, and demo D05 inline picker verified';
    });

    // PJ-06: Financial Planning (3x installments, Calendar keyboard nav, Daily Projection slider, edit/audit history)
    await recordJourney('PJ-06', 'Planejamento: parcelamento 3x, Calendário teclado, Projeção diária slider, edição e auditoria', async () => {
      await ui.navigate('Planejamento');
      await ui.waitFor(`return document.querySelector('.p-main');`, 'Planning page');
      await ui.clickButtonText('＋ Planejar despesa', 'document.querySelector(".p-hero-actions")');
      await ui.waitFor(`return document.querySelector('.p-plan-modal');`, 'Plan modal open');

      await ui.fillText(`return [...document.querySelectorAll('.p-plan-modal label.field')].find(l => l.textContent.includes('Como deseja chamar'))?.querySelector('input');`, 'Notebook QA', 'Plan title');
      await ui.fillText(`return [...document.querySelectorAll('.p-plan-modal label.field')].find(l => l.textContent.includes('Valor'))?.querySelector('input');`, '3000,00', 'Plan amount');
      await ui.pickStyledSelect(`return [...document.querySelectorAll('.p-plan-modal label.field')].find(l => l.textContent.includes('Categoria'))?.querySelector('.mf-select-trigger');`, 'Compras', 'Plan category');
      await ui.pickStyledSelect(`return [...document.querySelectorAll('.p-plan-modal label.field')].find(l => l.textContent.includes('Repetição'))?.querySelector('.mf-select-trigger');`, 'Parcelar compra', 'Plan mode');
      await ui.fillText(`return [...document.querySelectorAll('.p-plan-modal label.field')].find(l => l.textContent.includes('Quantidade'))?.querySelector('input');`, '3', 'Installment count');
      await ui.clickButtonText('Adicionar ao planejamento', 'document.querySelector(".p-plan-modal")');
      await ui.waitFor(`return !document.querySelector('.p-plan-modal') && document.body.textContent.includes('Notebook QA');`, 'Notebook QA (1/3) in Agenda');

      // Calendário keyboard navigation
      await ui.clickButtonText('Calendário', 'document.querySelector(".u2-view-tabs")');
      await ui.waitFor(`return document.querySelector('.u5-plan-calendar');`, 'Calendar visible');
      const dayBefore = await ui.eval(`return document.querySelector('.u5-plan-calendar-day.is-selected')?.getAttribute('data-plan-day');`);
      await ui.eval(`document.querySelector('.u5-plan-calendar-day.is-selected')?.focus();`);
      await ui.pressKey('ArrowRight', 'ArrowRight', 39);
      await ui.pressKey('End', 'End', 35);
      const dayEnd = await ui.eval(`return document.querySelector('.u5-plan-calendar-day.is-selected')?.getAttribute('data-plan-day');`);
      assert.notEqual(dayEnd, dayBefore);
      await ui.pressKey('Home', 'Home', 36);
      const dayHome = await ui.eval(`return document.querySelector('.u5-plan-calendar-day.is-selected')?.getAttribute('data-plan-day');`);
      assert.equal(dayHome.slice(-2), '01');

      // Projeção diária: move slider to end of month, then toggle Incluir receitas incertas
      await ui.clickButtonText('Projeção diária', 'document.querySelector(".u2-view-tabs")');
      await ui.waitFor(`return document.querySelector('.u5-single-projection svg[role="slider"]');`, 'Projection slider ready');
      const sliderRect = await ui.eval(`
        const el = document.querySelector('.u5-single-projection svg[role="slider"]');
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.right - 24), y: Math.round(r.top + r.height / 2) };
      `);
      await ui.clickCoords(sliderRect.x, sliderRect.y);
      await ui.eval(`document.querySelector('.u5-single-projection svg[role="slider"]')?.focus();`);
      await ui.pressKey('End', 'End', 35);
      await ui.waitFor(`
        const el = document.querySelector('.u5-single-projection svg[role="slider"]');
        return el && Number(el.getAttribute('aria-valuenow')) >= Number(el.getAttribute('aria-valuemax')) - 2;
      `, 'Slider near end of month');
      const closingWithoutEst = await ui.eval(`return document.querySelector('.p-chart-current strong')?.textContent?.trim();`);
      await ui.clickElement(`return document.querySelector('.p-scenario-toggle input[type="checkbox"]');`, 'Toggle Incluir receitas incertas');
      await ui.waitFor(`return document.querySelector('.p-chart-current strong')?.textContent?.trim() !== ${JSON.stringify(closingWithoutEst)};`, 'Closing balance updated with estimated income');

      // Agenda -> open Notebook QA drawer -> Editar -> verify audit history
      await ui.clickButtonText('Agenda', 'document.querySelector(".u2-view-tabs")');
      await ui.clickElement(`return [...document.querySelectorAll('.p-ledger-row')].find(r => r.textContent.includes('Notebook QA'));`, 'Open Notebook QA drawer');
      await ui.waitFor(`return document.querySelector('.p-plan-drawer');`, 'Plan drawer open');
      await ui.clickButtonText('Editar', 'document.querySelector(".p-plan-drawer")');
      await ui.waitFor(`return document.querySelector('.p-plan-modal');`, 'Edit plan modal');
      await ui.fillText(`return [...document.querySelectorAll('.p-plan-modal label.field')].find(l => l.textContent.includes('Como deseja chamar'))?.querySelector('input');`, 'Notebook QA Editado', 'Edited plan title');
      await ui.clickButtonText('Salvar alterações', 'document.querySelector(".p-plan-modal")');
      await ui.waitFor(`return !document.querySelector('.p-plan-modal') && document.body.textContent.includes('Notebook QA Editado');`, 'Edited plan visible');
      if (await ui.eval(`return !!document.querySelector('.p-plan-drawer');`)) {
        await ui.clickElement(`return document.querySelector('.p-plan-drawer .close-button');`, 'Close stale plan drawer');
        await ui.waitFor(`return !document.querySelector('.p-plan-drawer');`, 'Plan drawer closed');
      }
      await ui.clickElement(`return [...document.querySelectorAll('.p-ledger-row')].find(r => r.textContent.includes('Notebook QA Editado'));`, 'Reopen edited plan drawer');
      await ui.waitFor(`return document.querySelector('.p-plan-drawer')?.textContent?.includes('Editado');`, 'Audit trail shows Editado');
      await ui.screenshot('pj06-planning-audit');
      await ui.clickElement(`return document.querySelector('.p-plan-drawer .close-button');`, 'Close plan drawer');
      return '3x installments, Calendar keyboard nav, Projection slider/estimated toggle, and edit audit history verified';
    });

    // PJ-07: Purchase Simulator + Stale Guard + A/B Compare
    await recordJourney('PJ-07', 'Simulador de compra: motor diário, guarda de desatualização e comparação A vs B', async () => {
      await ui.navigate('Simular compra');
      await ui.waitFor(`return document.querySelector('.u3-simulator');`, 'Simulator page');
      await ui.fillText(`return [...document.querySelectorAll('.sim-form-card label.field')].find(l => l.textContent.includes('Valor do produto'))?.querySelector('input');`, '1500,00', 'Sim value');
      await ui.pickStyledSelect(`return [...document.querySelectorAll('.sim-form-card label.field')].find(l => l.textContent.includes('Número de parcelas'))?.querySelector('.mf-select-trigger');`, '6x', 'Sim 6x');
      await ui.fillText(`return [...document.querySelectorAll('.sim-form-card label.field')].find(l => l.textContent.includes('Juros'))?.querySelector('input');`, '2,5', 'Sim interest');
      await ui.clickButtonText('Analisar compra', 'document.querySelector(".sim-form-card")');
      await ui.waitFor(`return document.querySelector('.mf-scenario-result') && document.querySelector('.u5-sim-current');`, 'Scenario A computed');

      await ui.clickButtonText('Guardar como referência A', 'document.querySelector(".result-column")');
      await ui.waitFor(`return document.querySelector('.u3-comparison');`, 'Reference A saved');

      // Mutate installments -> 12x -> verify stale guard & disabled Planejar esta compra
      await ui.pickStyledSelect(`return [...document.querySelectorAll('.sim-form-card label.field')].find(l => l.textContent.includes('Número de parcelas'))?.querySelector('.mf-select-trigger');`, '12x', 'Sim 12x');
      const staleState = await ui.waitFor(`
        const staleBox = document.querySelector('.u5-sim-stale');
        const recalcBtn = [...document.querySelectorAll('.sim-form-card button')].find(b => b.textContent.includes('Recalcular cenário'));
        const planBtn = document.querySelector('button.mf-plan-from-sim');
        if (!staleBox || !recalcBtn) return null;
        return { staleText: staleBox.textContent, planDisabled: planBtn?.disabled };
      `, 'Stale guard active');
      assert.match(staleState.staleText, /desatualizado/);
      assert.equal(staleState.planDisabled, true);

      // Recalculate -> A vs B side-by-side
      await ui.clickButtonText('Recalcular cenário', 'document.querySelector(".sim-form-card")');
      await ui.waitFor(`return document.querySelector('.u5-sim-current') && document.querySelector('.u3-comparison')?.textContent?.includes('12x') && document.querySelector('button.mf-plan-from-sim')?.disabled === false;`, 'Comparison B updated');
      await ui.screenshot('pj07-simulator-ab-compare');
      return 'Planning simulator, stale guard, and A/B comparison verified';
    });

    // PJ-08 + NJ-04: Intelligence B05 (Hoje D03 drawer/Escape, Conversar IC2, Plano de Ação, D01 preview & ambiguity, unauth)
    await recordJourney('NJ-04', 'Inteligência sem autorização / dados insuficientes e evidência ambígua em D01', async () => {
      await ui.navigate('Inteligência');
      await ui.waitFor(`return document.querySelector('.mf-b05-page');`, 'B05 Intelligence page');

      // 1. Unauthenticated Hoje state: no fabricated balance
      await ui.clickElement(`return document.getElementById('mf-b05-tab-today');`, 'Tab Hoje unauth');
      await ui.waitFor(`return document.querySelector('.mf-b05-today');`, 'Hoje mounted');
      const todayUnauth = await ui.eval(`return document.querySelector('.mf-b05-today')?.textContent || '';`);
      assert.match(todayUnauth, /sem saldos inventados|Ainda não há sinais disponíveis/i);

      // 2. Unauthenticated Conversar state -> query personal question -> disconnected state
      await ui.clickElement(`return document.getElementById('mf-b05-tab-chat');`, 'Tab Conversar');
      await ui.fillText(`return document.getElementById('mf-ai-draft');`, 'Quais foram minhas maiores despesas?', 'Unauth query');
      await ui.clickButtonText('Enviar', 'document.querySelector(".mf-b05-chat-composer")');
      await ui.waitFor(`return document.querySelector('.mf-b05-chat-thread')?.textContent?.includes('Conta desconectada (não autenticada)');`, 'Unauthenticated reply');

      // 3. Ambiguous D01 prompt ("Categorize Mercado como Alimentação") -> 2+ matches -> Conferir proposta disabled
      await ui.fillText(`return document.getElementById('mf-ai-draft');`, 'Categorize Mercado como Alimentação', 'Ambiguous D01 prompt');
      await ui.clickButtonText('Enviar', 'document.querySelector(".mf-b05-chat-composer")');
      const ambig = await ui.waitFor(`
        const p = document.querySelector('.mf-d01-proposal.status-ambiguous');
        if (!p) return null;
        const btn = [...p.querySelectorAll('button')].find(b => b.textContent.trim() === 'Conferir proposta');
        return { text: p.textContent, disabled: btn?.disabled, candidates: p.querySelectorAll('.mf-d01-candidate').length };
      `, 'Ambiguous D01 proposal');
      assert.match(ambig.text, /Encontramos lançamentos parecidos/);
      assert.equal(ambig.disabled, true);
      assert(ambig.candidates >= 2);
      await ui.screenshot('nj04-ambiguous-d01-and-unauth');
      return 'Unauthenticated no-fake-cash state and ambiguous D01 disambiguation guard verified';
    });

    await recordJourney('PJ-08', 'Inteligência B05 + D01/D02/D03: autorização local, Hoje drawer/Escape, IC2, Plano de Ação e D01 prévia sem escrita', async () => {
      // Unique D01 preview-without-write before enabling local read
      await ui.fillText(`return document.getElementById('mf-ai-draft');`, 'Categorize LIVRARIA CULTURA UNICA QA como Educação', 'Unique D01 prompt');
      await ui.clickButtonText('Enviar', 'document.querySelector(".mf-b05-chat-composer")');
      await ui.waitFor(`return [...document.querySelectorAll('.mf-d01-proposal')].some(p => p.textContent.includes('LIVRARIA CULTURA UNICA QA') && !p.classList.contains('status-ambiguous'));`, 'Unique D01 proposal');
      await ui.clickElement(`
        const prop = [...document.querySelectorAll('.mf-d01-proposal')].find(p => p.textContent.includes('LIVRARIA CULTURA UNICA QA'));
        return [...prop.querySelectorAll('button')].find(b => b.textContent.trim() === 'Conferir proposta');
      `, 'Conferir proposta');
      await ui.clickElement(`
        const prop = [...document.querySelectorAll('.mf-d01-proposal')].find(p => p.textContent.includes('LIVRARIA CULTURA UNICA QA'));
        return prop.querySelector('.mf-d01-confirm input[type="checkbox"]');
      `, 'D01 consent checkbox');
      await ui.clickElement(`
        const prop = [...document.querySelectorAll('.mf-d01-proposal')].find(p => p.textContent.includes('LIVRARIA CULTURA UNICA QA'));
        return [...prop.querySelectorAll('button')].find(b => b.textContent.trim() === 'Validar prévia sem gravar');
      `, 'Validar prévia sem gravar');
      await ui.waitFor(`return document.body.textContent.includes('Prévia conferida. Não foi aplicada nenhuma alteração.');`, 'D01 readonly preview confirmed');

      // Authorize local financial read (Contas conectadas + Permitir também leitura do Planejamento)
      await ui.clickElement(`return document.querySelector('.mf-b05-permissions summary');`, 'Open Autorizar consulta financeira');
      await ui.selectNative(`return [...document.querySelectorAll('.mf-ai-access-field')].find(l => l.textContent.includes('Fonte'))?.querySelector('select');`, 'bank', 'Source bank');
      await ui.clickElement(`return document.querySelector('.mf-ai-access-planning input[type="checkbox"]');`, 'Enable planning read');
      await ui.clickButtonText('Autorizar leitura local', 'document.querySelector(".mf-b05-permissions")');
      await ui.waitFor(`return document.querySelector('.mf-b05-status')?.textContent?.includes('Leitura local autorizada');`, 'Local read authorized');

      // Tab Hoje: D03 signals -> open drawer -> Escape -> focus returns to opener
      await ui.clickElement(`return document.getElementById('mf-b05-tab-today');`, 'Tab Hoje');
      const openerId = await ui.waitFor(`
        const btn = document.querySelector('.mf-d03-signal-action');
        return btn ? btn.id : null;
      `, 'D03 signal card button');
      await ui.clickElement(`return document.getElementById(${JSON.stringify(openerId)});`, 'Open D03 drawer');
      await ui.waitFor(`return document.getElementById('mf-d03-drawer');`, 'D03 drawer open');
      await ui.pressKey('Escape', 'Escape', 27);
      const focusReturned = await ui.waitFor(`return !document.getElementById('mf-d03-drawer') && document.activeElement?.id === ${JSON.stringify(openerId)};`, 'D03 drawer Escape focus return');
      assert.equal(focusReturned, true);

      // Tab Conversar: real IC2 queries with exact synthetic amounts
      await ui.clickElement(`return document.getElementById('mf-b05-tab-chat');`, 'Tab Conversar');
      await ui.fillText(`return document.getElementById('mf-ai-draft');`, 'Quais foram minhas maiores despesas?', 'IC2 summary');
      await ui.clickButtonText('Enviar', 'document.querySelector(".mf-b05-chat-composer")');
      await ui.waitFor(`return document.querySelector('.mf-b05-chat-thread')?.textContent?.includes('7.500,00') || document.querySelector('.mf-b05-chat-thread')?.textContent?.includes('Despesas');`, 'IC2 summary synthetic total');

      await ui.fillText(`return document.getElementById('mf-ai-draft');`, 'Quais estabelecimentos tiveram gastos?', 'IC2 merchants');
      await ui.clickButtonText('Enviar', 'document.querySelector(".mf-b05-chat-composer")');
      await ui.waitFor(`return document.querySelector('.mf-b05-chat-thread')?.textContent?.includes('SUPERMERCADO BOM PRECO') || document.querySelector('.mf-b05-chat-thread')?.textContent?.includes('520,00');`, 'IC2 merchants synthetic total');

      await ui.fillText(`return document.getElementById('mf-ai-draft');`, 'Compare minhas despesas com o mês anterior.', 'IC2 compare');
      await ui.clickButtonText('Enviar', 'document.querySelector(".mf-b05-chat-composer")');
      await ui.waitFor(`return [...document.querySelectorAll('.mf-ai-msg.is-assistant')].length >= 3 && !document.querySelector('.mf-b05-chat-thinking');`, 'IC2 compare done');

      await ui.fillText(`return document.getElementById('mf-ai-draft');`, 'Quanto tenho comprometido para o próximo mês?', 'IC2 commitments');
      await ui.clickButtonText('Enviar', 'document.querySelector(".mf-b05-chat-composer")');
      await ui.waitFor(`return [...document.querySelectorAll('.mf-ai-msg.is-assistant')].length >= 4 && !document.querySelector('.mf-b05-chat-thinking');`, 'IC2 commitments done');

      // Tab Plano de Ação: Entender -> Simular -> Revisar
      await ui.clickElement(`return document.getElementById('mf-b05-tab-actions');`, 'Tab Plano de Ação');
      await ui.waitFor(`return document.querySelector('.mf-b05-plan-feature');`, 'Plano de Ação feature visible');
      await ui.clickButtonText('Explorar cenário', 'document.querySelector(".mf-b05-stage")');
      await ui.waitFor(`return document.querySelector('.mf-b05-stage')?.textContent?.includes('Experimente sem alterar seus dados');`, 'Simular stage');
      await ui.clickButtonText('Revisar cenário', 'document.querySelector(".mf-b05-stage")');
      await ui.waitFor(`return document.querySelector('.mf-b05-stage')?.textContent?.includes('O SQLite permanece inalterado');`, 'Revisar stage');
      await ui.screenshot('pj08-intelligence-b05-actions');

      // Clear session (renderIntelligenceAccess wraps controls in nested .mf-chat-access details)
      if (!(await ui.eval(`return !!document.querySelector('.mf-b05-permissions')?.open;`))) {
        await ui.clickElement(`return document.querySelector('.mf-b05-permissions summary');`, 'Reopen permissions');
      }
      if (await ui.eval(`return !!document.querySelector('.mf-chat-access') && !document.querySelector('.mf-chat-access').open;`)) {
        await ui.clickElement(`return document.querySelector('.mf-chat-access summary');`, 'Open nested chat access details');
      }
      await ui.eval(`
        const root = document.querySelector('.mf-b05-permissions');
        const btn = [...root.querySelectorAll('button')].find(b => !b.disabled && b.textContent.includes('Encerrar leitura'));
        btn?.scrollIntoView({ block: 'center' });
      `);
      await delay(100);
      await ui.clickElement(`
        const root = document.querySelector('.mf-b05-permissions');
        return [...root.querySelectorAll('button')].find(b => !b.disabled && b.textContent.includes('Encerrar leitura'));
      `, 'Encerrar leitura');
      await ui.waitFor(`return document.querySelector('.mf-b05-status')?.textContent?.includes('Sem leitura pessoal autorizada');`, 'Session cleared');
      await ui.clickElement(`return document.getElementById('mf-b05-tab-chat');`, 'Back to Conversar');
      const cleared = await ui.eval(`
        const t = document.querySelector('.mf-b05-chat-thread')?.textContent || '';
        return t.includes('Quais estabelecimentos tiveram gastos?') || !!document.querySelector('.mf-b05-chat-thread .mf-ai-structured-card');
      `);
      assert.equal(cleared, false);
      return 'D01 preview, B05 local read auth, D03 Escape focus return, IC2 queries, Plano de Ação, and session clear verified';
    });

    // PJ-09 (part 1): Settings (reserve, Light/Dark theme, auto-backup) -> Close cleanly -> Restart -> UI DOM persistence
    await recordJourney('PJ-09', 'Configurações e persistência integral pós-fechar/reabrir na UI DOM e SQLite', async () => {
      await ui.navigate('Configurações');
      await ui.waitFor(`return document.querySelector('.mf-settings-layout');`, 'Settings layout');

      // Edit Reserva mínima protegida -> 1200,00
      await ui.clickButtonText('Perfil financeiro', 'document.querySelector(".mf-settings-nav")');
      await ui.clickElement(`
        const row = [...document.querySelectorAll('.setting-row')].find(r => r.textContent.includes('Reserva mínima protegida'));
        return row?.querySelector('button.setting-edit');
      `, 'Edit Reserva mínima');
      await ui.waitFor(`return document.querySelector('.small-modal');`, 'Reserve modal');
      await ui.fillText(`return document.querySelector('.small-modal input');`, '1200,00', 'Reserve 1200,00');
      await ui.clickButtonText('Salvar alteração', 'document.querySelector(".small-modal")');
      await ui.waitFor(`return !document.querySelector('.small-modal') && [...document.querySelectorAll('.setting-row')].find(r => r.textContent.includes('Reserva mínima protegida'))?.textContent?.includes('1.200,00');`, 'Reserve updated');

      // Toggle Light -> Dark -> Light via Aparência
      await ui.clickButtonText('Aparência', 'document.querySelector(".mf-settings-nav")');
      await ui.selectNative(`return document.querySelector('.mf-appearance-card select[data-appearance="select"]');`, 'dark', 'Theme dark');
      assert.equal(await ui.eval(`return document.documentElement.dataset.theme;`), 'dark');
      await ui.selectNative(`return document.querySelector('.mf-appearance-card select[data-appearance="select"]');`, 'light', 'Theme light');
      assert.equal(await ui.eval(`return document.documentElement.dataset.theme;`), 'light');

      // Check auto-backup status in Dados e recuperação
      await ui.clickButtonText('Dados e recuperação', 'document.querySelector(".mf-settings-nav")');
      const backupsInfo = await ui.waitFor(`
        const el = document.querySelector('.backups-info');
        return el && el.textContent.includes('Última cópia') ? el.textContent : null;
      `, 'Auto-backup info');
      assert.match(backupsInfo, /Última cópia/);
      await ui.screenshot('pj09-settings-before-restart');

      allIssues.push(...ui.runtimeIssues);

      // Cleanly close Electron #1
      await closeCleanly(running);
      running = null;
      await delay(1200);

      // Verify on-disk SQLite PRAGMA integrity_check === ok & D01/NJ-02 untouched
      const diskDb = new FinanceDB(dbFile);
      try {
        assert.deepEqual(diskDb.integrity(), ['ok']);
        const bnkD01 = diskDb.db.prepare("SELECT category FROM bank_transactions WHERE account_id=? AND external_id='bnk-d01-unique'").get(ACC1_ID);
        assert.notEqual(bnkD01.category, 'Educação', 'D01 preview must not have written to SQLite');
        const ovrD01 = diskDb.db.prepare("SELECT * FROM bank_category_overrides WHERE account_id=? AND external_id='bnk-d01-unique'").get(ACC1_ID);
        assert.equal(ovrD01, undefined, 'D01 preview must not have written override');
        const ovrFood = diskDb.db.prepare("SELECT * FROM bank_category_overrides WHERE account_id=? AND external_id='bnk-food-exceed'").get(ACC1_ID);
        assert.equal(ovrFood, undefined, 'NJ-02 personal-locked must not have written override');
        savedBackupPath = fs.readdirSync(path.join(profile, 'copias-de-seguranca')).find(n => n.endsWith('.sqlite'));
        assert(savedBackupPath, 'Physical auto-backup file must exist');
        savedBackupPath = path.join(profile, 'copias-de-seguranca', savedBackupPath);
      } finally {
        diskDb.close();
      }

      // Reopen Electron #2 on the SAME temp userData and verify via UI DOM!
      running = await startElectron(profile);
      try {
        const ui2 = new CDPUIDriver(running, outputDir);
        await ui2.init();
        await ensureWindowFocus(running.cdp, running.child.pid);

        // Verify theme persisted in UI DOM
        assert.equal(await ui2.eval(`return document.documentElement.dataset.theme;`), 'light');

        // Verify Settings Reserva mínima persisted in UI DOM
        await ui2.navigate('Configurações');
        await ui2.clickButtonText('Perfil financeiro', 'document.querySelector(".mf-settings-nav")');
        const persistedReserve = await ui2.eval(`
          return [...document.querySelectorAll('.setting-row')].find(r => r.textContent.includes('Reserva mínima protegida'))?.textContent;
        `);
        assert.match(persistedReserve, /1\.200,00/);

        // Verify Budgets Alimentos limit R$ 800,00 persisted in UI DOM
        await ui2.navigate('Orçamentos');
        const persistedBudget = await ui2.eval(`
          return document.getElementById('qa84-card-' + encodeURIComponent('Alimentação'))?.textContent;
        `);
        assert.match(persistedBudget, /800,00/);

        // Verify Planning Notebook QA Editado persisted in UI DOM
        await ui2.navigate('Planejamento');
        await ui2.waitFor(`return document.body.textContent.includes('Notebook QA Editado');`, 'Notebook QA Editado in Planning DOM');

        // Verify Movimentações D05 UI DOM: Padaria Nova Editada QA (150,00), Revisadas, alias Cafeteria Expresso VIP, linked MERCADO UNICO LINK QA, rule Pets QA on PETSHOP AMIGO QA
        await ensureWindowFocus(running.cdp, running.child.pid);
        const authClicker2 = startNativeDialogClicker(running.child.pid, ['Autorizar consulta local']);
        await ui2.navigate('Movimentações');
        await authClicker2.done;
        await ui2.waitFor(`return document.getElementById('d05-movements') && !document.body.textContent.includes('Conferindo hierarquia D05');`, 'D05 loaded after restart');

        const d05Text = await ui2.eval(`return document.querySelector('.d05-list')?.textContent || '';`);
        assert.match(d05Text, /Padaria Nova Editada QA/);
        assert.match(d05Text, /150,00/);
        assert.match(d05Text, /Cafeteria Expresso VIP/);
        assert.match(d05Text, /Pets QA/);

        await ui2.clickButtonText('Revisadas', 'document.querySelector(".d05-tabs")');
        await ui2.waitFor(`return [...document.querySelectorAll('.d05-row')].some(r => r.textContent.includes('SUPERMERCADO ALFA QA'));`, 'SUPERMERCADO ALFA QA still in Revisadas');
        await ui2.screenshot('pj09-reopened-ui-persistence');

        allIssues.push(...ui2.runtimeIssues);
      } finally {
        if (running) {
          try { await closeCleanly(running); } catch { try { running.child.kill(); } catch {} }
          running = null;
          await delay(1200);
        }
      }
      return 'Clean close, disk PRAGMA integrity_check=ok, and full UI DOM persistence verified after reopen';
    });

    // NJ-05: Corrupt backup rejection + interrupted mf_auto_apply_jobs / mf_auto_jobs restart recovery
    await recordJourney('NJ-05', 'Rejeição de backup corrompido e recuperação de jobs interrompidos no restart (INTERRUPTED_ON_RESTART)', async () => {
      // Part 1: Corrupt backup rejection via validateBackupFile & restoreBackup
      const corruptDir = path.join(profile, 'corrupt-tests');
      fs.mkdirSync(corruptDir, { recursive: true });
      const badText = path.join(corruptDir, 'not-sqlite.sqlite');
      fs.writeFileSync(badText, 'NOT_A_SQLITE_FILE_PAD'.repeat(10));
      assert.throws(() => validateBackupFile(badText), /não é uma cópia válida/);

      const { DatabaseSync } = require('node:sqlite');
      const noMeta = path.join(corruptDir, 'no-meta.sqlite');
      const d1 = new DatabaseSync(noMeta);
      d1.exec('CREATE TABLE profiles(id TEXT); CREATE TABLE transactions(id TEXT); CREATE TABLE budgets(id TEXT); CREATE TABLE financial_settings(id TEXT);');
      d1.close();
      assert.throws(() => validateBackupFile(noMeta), /Formato de cópia não reconhecido/);

      const futureVer = path.join(corruptDir, 'future-ver.sqlite');
      const d2 = new DatabaseSync(futureVer);
      d2.exec('CREATE TABLE app_meta(key TEXT PRIMARY KEY, value TEXT); CREATE TABLE profiles(id TEXT); CREATE TABLE transactions(id TEXT); CREATE TABLE budgets(id TEXT); CREATE TABLE financial_settings(id TEXT);');
      d2.prepare("INSERT INTO app_meta(key,value) VALUES('schema_version','99')").run();
      d2.close();
      assert.throws(() => validateBackupFile(futureVer), /versão mais recente/);

      // Verify restoreBackup also rejects corrupt file without modifying active DB
      const probeDb = new FinanceDB(dbFile);
      try {
        await assert.rejects(
          () => restoreBackup(probeDb, badText, dbFile, path.join(profile, 'copias-de-seguranca')),
          /não é uma cópia válida/
        );
      } finally {
        probeDb.close();
      }

      // Part 2: Seed interrupted running jobs in mf_auto_apply_jobs and mf_auto_jobs, then restart Electron #3
      const seedJobsDb = new FinanceDB(dbFile);
      try {
        const nowIso = new Date().toISOString();
        seedJobsDb.db.prepare(`
          INSERT INTO mf_auto_apply_jobs(
            job_id, preview_version, source_version, state, proposed_total, review_total, future_only, started_at
          ) VALUES(?,?,?,?,?,?,?,?)
        `).run(
          'batch-interrupted-qa', 'pv-qa', 'sv-qa', 'running', 10, 2, 0, nowIso
        );
        seedJobsDb.db.prepare(`
          INSERT INTO mf_auto_jobs(
            job_key, trigger, state, attempts, started_at, finished_at, applied, review_count, error_code
          ) VALUES(?,?,?,?,?,?,?,?,?)
        `).run('job-interrupted-qa', 'daily', 'running', 1, nowIso, null, 0, 0, null);
      } finally {
        seedJobsDb.close();
      }

      running = await startElectron(profile);
      const ui3 = new CDPUIDriver(running, outputDir);
      await ui3.init();
      await ensureWindowFocus(running.cdp, running.child.pid);
      const authClicker3 = startNativeDialogClicker(running.child.pid, ['Autorizar consulta local']);
      await ui3.navigate('Movimentações');
      await authClicker3.done;
      await ui3.waitFor(`return document.getElementById('d05-movements') && document.getElementById('mf-cat-tab-security');`, 'CAT-UX 06 Segurança tab');
      await ui3.clickElement(`return document.getElementById('mf-cat-tab-security');`, '06 Segurança tab');

      const secState = await ui3.waitFor(`
        const txt = document.querySelector('.d05-auto-box')?.textContent || '';
        if (!txt.includes('Pausadas explicitamente') || !txt.includes('failed')) return null;
        return txt;
      `, 'Interrupted job alert in 06 Segurança');
      assert.match(secState, /Há job falho ou interrompido/);
      await ui3.screenshot('nj05-interrupted-recovery');

      allIssues.push(...ui3.runtimeIssues);
      await closeCleanly(running);
      running = null;

      // Verify on disk: INTERRUPTED_ON_RESTART + PRAGMA integrity_check === ok
      const verifyDb = new FinanceDB(dbFile);
      try {
        assert.deepEqual(verifyDb.integrity(), ['ok']);
        const applyJob = verifyDb.db.prepare("SELECT state, error_code FROM mf_auto_apply_jobs WHERE job_id='batch-interrupted-qa'").get();
        const schedJob = verifyDb.db.prepare("SELECT state, error_code FROM mf_auto_jobs WHERE job_key='job-interrupted-qa'").get();
        const ctrl = verifyDb.db.prepare('SELECT paused FROM mf_auto_controls WHERE id=1').get();
        assert.equal(applyJob.state, 'paused');
        assert.equal(applyJob.error_code, 'INTERRUPTED_ON_RESTART');
        assert.equal(schedJob.state, 'failed');
        assert.equal(schedJob.error_code, 'INTERRUPTED_ON_RESTART');
        assert.equal(ctrl.paused, 1);
      } finally {
        verifyDb.close();
      }
      return 'Corrupt backup rejection (3 formats) and INTERRUPTED_ON_RESTART recovery in UI + SQLite verified';
    });
  } finally {
    if (running) {
      try { running.child.kill(); } catch {}
      await delay(500);
    }
    if (!options.keepProfile) {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
    }
  }

  // Print clean summary table
  const summaryHeading = options.label || 'NÍVEL B REAL INTERACTIVE ELECTRON QA SUMMARY';
  console.log(`\n=== ${summaryHeading} ===`);
  for (const j of journeys) {
    console.log(`${j.id.padEnd(6)} | ${j.status.padEnd(8)} | ${String(j.durationMs).padStart(6)}ms | ${j.title}`);
  }
  const failed = journeys.filter(j => j.status !== 'PASS');
  console.log(`Total: ${journeys.length} | PASS: ${journeys.length - failed.length} | FAIL: ${failed.length} | RuntimeIssues: ${allIssues.length}`);
  console.log(`Artifacts: ${outputDir}`);

  const report = {
    executedAt: new Date().toISOString(),
    outputDir,
    profileDir: options.keepProfile ? profile : undefined,
    journeys,
    runtimeIssues: allIssues
  };
  const reportName = options.reportFileName || 'report.json';
  const reportPath = path.join(outputDir, reportName);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

  if (failed.length > 0 || allIssues.length > 0) {
    if (allIssues.length) console.error('Runtime issues:', allIssues);
    process.exitCode = 1;
  }
  return report;
}

if (require.main === module) {
  runNivelB().catch(err => {
    console.error('FAIL NIVEL B QA:', err);
    process.exitCode = 1;
  });
}

module.exports = { runNivelB, createRichSyntheticProfile };
