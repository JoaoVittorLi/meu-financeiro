'use strict';
// Pre-Release Integral Homologation Level B Walkthrough:
// Runs real Electron against an isolated temp profile (MF_QA_SYNTHETIC=1),
// verifies all 8 areas, real mutations, arithmetic & SQLite persistence across restart,
// drawer/modal/streaming/error/M3 undo states, zero raw IPC errors or legacy badges,
// and captures PNGs + coverage matrix JSON across 1366x768, 1440x900, 1484x901, 1920x1080 (light & dark).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { FinanceDB } = require('../electron/db.cjs');
const { PlanningStore } = require('../electron/planning.cjs');
const { start, evaluate, closeCleanly } = require('./d1-electron-smoke.cjs');

const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const ACC1_ID = '22222222-2222-4222-8222-222222222222';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const FORBIDDEN_TEXT = [
  'Aguarda I2-A',
  'aguarda I2-A',
  'Funcionalidade ainda não implementada',
  'Error invoking remote method',
  'Nesta RC',
  'Canal experimental isolado',
  'Consulte a situação da nuvem acima',
  'INTELLIGENCE ALIVE'
];

function localIso(d = new Date()) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}
function shiftMonthLocal(ym, offset) {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(y, m - 1 + offset, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function assertSafeEnvironment() {
  if (process.env.MF_QA_SYNTHETIC !== '1') throw new Error('REFUSED: MF_QA_SYNTHETIC=1 obrigatório.');
  if (process.env.MF_REAL_PROFILE) throw new Error('REFUSED: MF_REAL_PROFILE deve estar vazio.');
  const pluggyKeys = Object.keys(process.env).filter((k) => /^PLUGGY_/i.test(k) && process.env[k]);
  if (pluggyKeys.length) throw new Error('REFUSED: variáveis PLUGGY_* devem estar vazias.');
}

function startLoopbackAiServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/responses') {
      res.writeHead(404);
      res.end();
      return;
    }
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      const parsed = JSON.parse(body);
      requests.push(parsed);
      const q = String(parsed.input?.[parsed.input.length - 1]?.content || '').toLowerCase();
      let reply = 'Resposta GPT-6.2 Sol verificada em modo geral sem acesso aos seus extratos.';
      if (q.includes('opa, testando')) {
        reply = 'Oi! Conexão OAuth ativa com GPT-6.2 Sol em operação normal.';
      } else if (q.includes('detalhada') || q.includes('plano')) {
        reply = [
          '### Plano prático de organização mensal',
          '',
          '- Revise despesas fixas recorrentes e corte assinaturas sem uso nos últimos 30 dias.',
          '- Separe um valor de reserva logo no início do mês antes de liberar gastos livres.',
          '- Acompanhe categorias discricionárias semanalmente para evitar estouros na última semana.',
          '',
          '| Pilar | Foco sugerido | Revisão |',
          '| --- | --- | --- |',
          '| Essenciais | Habitação e saúde | Mensal |',
          '| Livre | Lazer e entregas | Semanal |',
          '| Reserva | Meta mínima protegida | Automática |'
        ].join('\n');
      }

      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' });
      const parts = [reply.slice(0, Math.floor(reply.length / 2)), reply.slice(Math.floor(reply.length / 2))];
      for (const delta of parts) {
        res.write(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta })}\n\n`);
        await delay(30);
      }
      res.write(`data: ${JSON.stringify({ type: 'response.completed', response: { usage: { input_tokens: 68, output_tokens: 42, output_tokens_details: { reasoning_tokens: 6 } } } })}\n\n`);
      res.end();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        url: `http://127.0.0.1:${port}/v1/responses`,
        requests,
        close: () => new Promise((r) => server.close(r))
      });
    });
  });
}

function seedHomologProfile(profileDir) {
  const ym = localIso().slice(0, 7);
  const m1 = shiftMonthLocal(ym, -1);
  const m2 = shiftMonthLocal(ym, -2);
  const m3 = shiftMonthLocal(ym, -3);
  const dbPath = path.join(profileDir, 'meu-financeiro.sqlite');
  const db = new FinanceDB(dbPath);
  try {
    db.save('real', {
      version: 5,
      settings: { opening: 150000, income: 800000, fixed: 200000, existing: 0, reserve: 100000 },
      budgets: { Moradia: 180000, 'Alimentação': 200000, Transporte: 40000, Lazer: 50000 },
      transactions: [
        { id: 'man-seed-1', date: `${ym}-04`, description: 'Padaria Bairro Seed', kind: 'expense', amount: 4500, category: 'Alimentação', origin: 'manual' }
      ]
    });
    db.save('demo', {
      version: 5,
      settings: { opening: 50000, income: 300000, fixed: 50000, existing: 0, reserve: 30000 },
      budgets: { Alimentação: 60000 },
      transactions: [
        { id: 'demo-only-1', date: `${ym}-05`, description: 'DEMO ISOLADA ITEM', kind: 'expense', amount: 12000, category: 'Alimentação', origin: 'manual' }
      ]
    });
    db.ingestBank(ITEM_ID, {
      item: { status: 'UPDATED' },
      data: [
        {
          account: { id: ACC1_ID, name: 'Conta Homolog Principal', balance: 7200, type: 'BANK', subtype: 'CHECKING_ACCOUNT', currencyCode: 'BRL' },
          transactions: [
            { id: 'sal-cur', date: `${ym}-02`, description: 'SALARIO MENSAL HOMOLOG', amount: 8000, status: 'POSTED', category: 'Salary' },
            { id: 'cur-mkt-1', date: `${ym}-05`, description: 'SUPERMERCADO BOM PRECO', amount: -320, status: 'POSTED', category: 'Groceries' },
            { id: 'cur-trn-1', date: `${ym}-06`, description: 'UBER VIAGEM CENTRO', amount: -45, status: 'POSTED', category: 'Transport' },
            { id: 'cur-laz-1', date: `${ym}-07`, description: 'CINEMA HOMOLOG', amount: -80, status: 'POSTED', category: 'Leisure' },
            { id: 'm1-mor', date: `${m1}-05`, description: 'ALUGUEL HOMOLOG', amount: -1800, status: 'POSTED', category: 'Housing' },
            { id: 'm1-ali', date: `${m1}-10`, description: 'MERCADO M1', amount: -900, status: 'POSTED', category: 'Groceries' },
            { id: 'm2-mor', date: `${m2}-05`, description: 'ALUGUEL HOMOLOG', amount: -1800, status: 'POSTED', category: 'Housing' },
            { id: 'm2-ali', date: `${m2}-10`, description: 'MERCADO M2', amount: -950, status: 'POSTED', category: 'Groceries' },
            { id: 'm3-mor', date: `${m3}-05`, description: 'ALUGUEL HOMOLOG', amount: -1800, status: 'POSTED', category: 'Housing' },
            { id: 'm3-ali', date: `${m3}-10`, description: 'MERCADO M3', amount: -920, status: 'POSTED', category: 'Groceries' }
          ]
        }
      ]
    });
    const planner = new PlanningStore(db);
    planner.create({
      title: 'Aluguel Previsto Homolog',
      kind: 'expense',
      amount: 180000,
      dueDate: `${ym}-28`,
      category: 'Moradia',
      certainty: 'confirmed'
    });
    db.setMonthlyBudget('real', ym, 'Alimentação', 90000);
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
        public class MFFocusHomolog {
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        }
"@
        $p = Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue
        if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
          [MFFocusHomolog]::ShowWindow($p.MainWindowHandle, 5) | Out-Null
          [MFFocusHomolog]::BringWindowToTop($p.MainWindowHandle) | Out-Null
          [MFFocusHomolog]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
        }
      `], { windowsHide: true, stdio: 'ignore' });
    } catch {}
  }
  await delay(100);
}

function startNativeDialogPump(pid, buttonLabels) {
  const stopFlag = path.join(os.tmpdir(), `mf-hml-dlg-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.flag`);
  const labelsArray = buttonLabels.map((s) => `'${String(s).replace(/'/g, "''")}'`).join(',');
  const ps = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System; using System.Runtime.InteropServices;
public class WinClickHml {
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
            [WinClickHml]::PostMessage($hwnd, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
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

async function waitFor(cdp, body, label, timeoutMs = 15000) {
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
  const filePath = path.join(dir, `${name}.png`);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

async function setViewport(cdp, width, height, theme) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const ok = await evaluate(cdp, `
      window.MFAppearance?.set?.(${JSON.stringify(theme)});
      return Math.abs(window.innerWidth - ${width}) <= 2 && Math.abs(window.innerHeight - ${height}) <= 2 && document.documentElement.dataset.theme === ${JSON.stringify(theme)};
    `);
    if (ok) break;
    await delay(80);
  }
  await delay(140);
}

async function assertCleanScreen(cdp, label) {
  const check = await evaluate(cdp, `
    const txt = document.body?.innerText || '';
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
    return { txt, overflow, vw: window.innerWidth, sw: document.documentElement.scrollWidth };
  `);
  for (const bad of FORBIDDEN_TEXT) {
    assert.equal(check.txt.includes(bad), false, `Forbidden string "${bad}" found on ${label}`);
  }
  assert.equal(check.overflow, false, `Horizontal overflow on ${label}: scrollWidth=${check.sw} > innerWidth=${check.vw}`);
}

async function withMockEnv(envPatch, fn) {
  const backup = {};
  for (const [k, v] of Object.entries(envPatch)) {
    backup[k] = process.env[k];
    if (v === undefined || v === null) delete process.env[k];
    else process.env[k] = String(v);
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(backup)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function runFullHomologation() {
  assertSafeEnvironment();
  const outputDir = process.env.MF_HOMOLOG_OUTPUT_DIR || path.join(os.tmpdir(), `mf-nivel-b-homolog-${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-d1-electron-homolog-'));
  const { ym, dbPath } = seedHomologProfile(profileDir);
  const mockAi = await startLoopbackAiServer();
  const issues = [];
  const shots = [];
  const viewports = [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1484, height: 901 },
    { width: 1920, height: 1080 }
  ];
  const views = [
    { label: 'Visão geral', slug: 'overview' },
    { label: 'Movimentações', slug: 'transactions' },
    { label: 'Planejamento', slug: 'planning' },
    { label: 'Orçamentos', slug: 'budgets' },
    { label: 'Minhas contas', slug: 'accounts' },
    { label: 'Simular compra', slug: 'simulator' },
    { label: 'Inteligência', slug: 'intelligence' },
    { label: 'Configurações', slug: 'settings' }
  ];

  const dialogCaptions = [
    'Ativar inferência do Copiloto',
    'Ativar ações supervisionadas',
    'Autorizar consulta local',
    'Autorizar esta conta',
    'Confirmar e aplicar',
    'Confirmar novo limite',
    'Confirmar reversão'
  ];

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
    await withMockEnv({ MF_QA_MOCK_AI_URL: mockAi.url, MF_QA_MOCK_OAUTH: '1' }, async () => {
      running = await start(profileDir);
      attachListeners(running.cdp);
      await running.cdp.send('Page.enable');
      await ensureWindowFocus(running.cdp, running.child.pid);
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-workspace-bar'));`, 'shell loaded');
      pump = startNativeDialogPump(running.child.pid, dialogCaptions);

      // 1. Real user walkthrough on Movimentações: single <h1> check + batch review + manual expense create
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Movimentações');`, 'nav Movimentações');
      await waitFor(running.cdp, `return Boolean(document.getElementById('d05-movements'));`, 'D05 loaded');
      const h1Count = await evaluate(running.cdp, `return document.querySelectorAll('h1').length;`);
      assert.equal(h1Count, 1, 'Movimentações must have exactly 1 <h1> header (no duplicate header)');
      await assertCleanScreen(running.cdp, 'Movimentações initial');

      // Batch mark reviewed on first selectable unreviewed bank row
      await click(running.cdp, `return document.querySelector('.d05-row:not(.is-selected) button.d05-select:not([disabled])');`, 'select bank row for batch review');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.d05-bulk-bar'));`, 'bulk bar visible');
      await click(running.cdp, `return [...document.querySelectorAll('.d05-bulk-bar button')].find(b => b.textContent.includes('Marcar revisadas'));`, 'batch mark reviewed');
      await waitFor(running.cdp, `return !document.querySelector('.d05-bulk-bar');`, 'bulk bar closed after review');

      // Manual expense creation via D05 '+ Nova movimentação'
      await click(running.cdp, `return [...document.querySelectorAll('#d05-movements button')].find(b => b.textContent.includes('Nova movimentação'));`, 'open manual entry');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.d05-floating input'));`, 'manual dialog open');
      await fill(running.cdp, `return document.querySelector('.d05-floating label input:not([type="date"])');`, 'Farmácia Homolog Persist', 'manual desc');
      await fill(running.cdp, `return document.querySelector('.d05-floating input[inputmode="decimal"]');`, '150,00', 'manual value');
      await click(running.cdp, `return document.querySelector('.d05-floating button.d05-confirm');`, 'confirm manual');
      await waitFor(running.cdp, `return !document.querySelector('.d05-floating') && document.body.innerText.includes('Farmácia Homolog Persist');`, 'manual created and visible');

      // Verify SQLite recorded manual tx
      {
        const checkDb = new FinanceDB(dbPath);
        try {
          const loaded = checkDb.load('real');
          assert(loaded.transactions.some((t) => t.description === 'Farmácia Homolog Persist' && t.amount === 15000), 'SQLite must persist manual tx');
        } finally { checkDb.close(); }
      }

      // 2. Orçamentos: manual limit edit syncs monthly_budgets override + M3 Salary planner opens without triple scrollbar
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Orçamentos');`, 'nav Orçamentos');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.qa84-budget-card'));`, 'Orçamentos cards loaded');
      await click(running.cdp, `return [...document.querySelectorAll('.qa84-budget-card')].find(c => c.textContent.includes('Alimentação'));`, 'open Alimentação budget detail');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.qa84-budget-detail .qa84-budget-edit-actions button'));`, 'Alimentação budget detail open');
      await click(running.cdp, `return [...document.querySelectorAll('.qa84-budget-detail .qa84-budget-edit-actions button')].find(b => b.textContent.includes('Editar limite') || b.textContent.includes('Definir limite'));`, 'open Alimentação budget edit');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-budget-editor input'));`, 'budget editor modal');
      await fill(running.cdp, `return document.querySelector('.mf-budget-editor input');`, '1.250,00', 'new Alimentação limit');
      await click(running.cdp, `return [...document.querySelectorAll('.mf-budget-editor button')].find(b => b.textContent.includes('Salvar'));`, 'save budget edit');
      await waitFor(running.cdp, `return !document.querySelector('.mf-budget-editor');`, 'budget modal closed');
      {
        const checkDb = new FinanceDB(dbPath);
        try {
          assert.equal(checkDb.effectiveBudgets('real', ym).effective['Alimentação'], 125000, 'Manual Orçamentos edit must sync SQLite monthly_budgets');
        } finally { checkDb.close(); }
      }
      await click(running.cdp, `return [...document.querySelectorAll('.qa84-crumbs button')].find(b => b.textContent.includes('Orçamentos'));`, 'return from budget detail to Orçamentos');
      await waitFor(running.cdp, `return [...document.querySelectorAll('button')].some(b => b.textContent.includes('Reorganizar com salário'));`, 'back on main Orçamentos');

      // Open Salary planner & verify compute works cleanly
      await click(running.cdp, `return [...document.querySelectorAll('button')].find(b => b.textContent.includes('Reorganizar com salário'));`, 'open salary planner');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-m3-salary-panel'));`, 'salary panel open');
      await click(running.cdp, `return [...document.querySelectorAll('.mf-m3-salary-panel button')].find(b => b.textContent.includes('Simular reorganização'));`, 'run salary proposal');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-m3-salary-card'));`, 'salary proposal rendered');
      shots.push(await shot(running.cdp, outputDir, 'homolog-budgets-salary-panel-light'));

      // 3. Simular compra: above-fold CTA check at 1366x768 & compute simulation
      await setViewport(running.cdp, 1366, 768, 'light');
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Simular compra');`, 'nav Simular compra');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.u3-simulator .action-large'));`, 'simulator ready');
      const simFold = await evaluate(running.cdp, `
        const b = document.querySelector('.u3-simulator .action-large');
        const r = b.getBoundingClientRect();
        return { bottom: r.bottom, vh: window.innerHeight };
      `);
      assert.ok(simFold.bottom <= simFold.vh + 4, `Analisar compra must sit above 1366x768 fold (${simFold.bottom}/${simFold.vh})`);
      await fill(running.cdp, `return document.querySelector('.u3-simulator input[inputmode="decimal"]');`, '900,00', 'sim amount');
      await click(running.cdp, `return document.querySelector('.u3-simulator .action-large');`, 'run simulation');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.u3-simulator .result-card'));`, 'sim result card');
      shots.push(await shot(running.cdp, outputDir, 'homolog-simulator-1366x768-light'));

      // 4. Configurações: clickable theme cards + Inteligência capabilities enable
      await setViewport(running.cdp, 1440, 900, 'light');
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Configurações');`, 'nav Configurações');
      await waitFor(running.cdp, `return Boolean(document.querySelector('button.mf-theme-preview.theme-dark'));`, 'theme preview buttons');
      await click(running.cdp, `return document.querySelector('button.mf-theme-preview.theme-dark');`, 'click Escuro preview button');
      await waitFor(running.cdp, `return document.documentElement.dataset.theme === 'dark';`, 'theme switched dark');
      await click(running.cdp, `return document.querySelector('button.mf-theme-preview.theme-light');`, 'click Claro preview button');
      await waitFor(running.cdp, `return document.documentElement.dataset.theme === 'light';`, 'theme switched back light');
      await assertCleanScreen(running.cdp, 'Configurações > Aparência');

      await click(running.cdp, `return [...document.querySelectorAll('.mf-settings-nav button')].find(b => b.textContent.includes('Inteligência'));`, 'Configurações > Inteligência');
      await waitFor(running.cdp, `return document.body.innerText.includes('Configurado (aguarda 1ª consulta)');`, 'humanized inference state in Settings');
      await click(running.cdp, `return [...document.querySelectorAll('.mf-ai-settings-toggle')].find(x => x.textContent.includes('Ações supervisionadas'))?.querySelector('button');`, 'enable M3 actions');
      await waitFor(running.cdp, `return [...document.querySelectorAll('.mf-ai-settings-toggle')].find(x => x.textContent.includes('Ações supervisionadas'))?.textContent?.includes('Ativadas');`, 'M3 actions active');
      await click(running.cdp, `return [...document.querySelectorAll('.mf-ai-settings-toggle')].find(x => x.textContent.includes('Inferência GPT-6.2 Sol'))?.querySelector('button');`, 'enable GPT-6.2 Sol');
      await waitFor(running.cdp, `return [...document.querySelectorAll('.mf-ai-settings-toggle')].find(x => x.textContent.includes('Inferência GPT-6.2 Sol'))?.textContent?.includes('Ativada');`, 'GPT-6.2 Sol active');

      // 5. Inteligência: FAB hidden, General chat Markdown/stream, M3 budget edit + confirm + undo, Contextual Drawer
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Inteligência');`, 'nav Inteligência');
      await click(running.cdp, `return document.getElementById('mf-b05-tab-chat');`, 'tab Conversar');
      const fabOnInt = await evaluate(running.cdp, `return Boolean(document.querySelector('.mf-ai-fab'));`);
      assert.equal(fabOnInt, false, 'Floating AI button must be hidden on Inteligência screen');

      await fill(running.cdp, `return document.getElementById('mf-ai-draft');`, 'Como fazer um plano detalhada de finanças?', 'long markdown prompt');
      await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-chat-composer button')].find(b => !b.disabled && b.textContent.includes('Enviar'));`, 'send general prompt');
      await waitFor(running.cdp, `return [...document.querySelectorAll('.mf-ai-msg.is-assistant')].some(el => el.textContent.includes('Plano prático de organização mensal') && el.textContent.includes('Reserva'));`, 'GPT-6.2 Sol formatted reply', 15000);

      // Authorize financial read + execute & undo M3 single budget update
      if (!(await evaluate(running.cdp, `return !!document.querySelector('.mf-b05-permissions')?.open;`))) {
        await click(running.cdp, `return document.querySelector('.mf-b05-permissions summary');`, 'open permissions');
      }
      await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-permissions button')].find(b => b.textContent.includes('Autorizar leitura local'));`, 'authorize local read');
      await waitFor(running.cdp, `return document.querySelector('.mf-b05-status')?.textContent?.includes('Leitura local autorizada');`, 'local read active');

      await fill(running.cdp, `return document.getElementById('mf-ai-draft');`, 'Deixe meu limite de Moradia em R$ 1.900.', 'M3 budget prompt');
      await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-chat-composer button')].find(b => !b.disabled && b.textContent.includes('Enviar'));`, 'send M3 budget prompt');
      await waitFor(running.cdp, `return [...document.querySelectorAll('.mf-m3-action-card')].some(el => el.textContent.includes('Confirmar novo limite'));`, 'M3 budget draft ready', 15000);
      await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Confirmar novo limite'));`, 'confirm M3 Moradia limit');
      await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('atualizado');`, 'M3 receipt confirmed', 15000);
      await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Desfazer'));`, 'undo M3 Moradia limit');
      await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('restaurado');`, 'M3 undo confirmed', 15000);

      // 6. Demo toggle isolation + close & full Electron restart persistence check
      await click(running.cdp, `return document.querySelector('.demo-btn');`, 'switch to demo');
      await waitFor(running.cdp, `return document.body.innerText.includes('Demonstração') && document.body.innerText.includes('dados fictícios');`, 'demo active');
      await click(running.cdp, `return [...document.querySelectorAll('.demo-strip button')].find(b => b.textContent.includes('Sair da demonstração'));`, 'return to personal');
      await waitFor(running.cdp, `return !document.querySelector('.demo-strip');`, 'personal restored');

      await pump.stop();
      pump = null;
      await running.cdp.send('Emulation.clearDeviceMetricsOverride');
      await closeCleanly(running);
      running = null;
      await delay(500);

      // Restart Electron on same profileDir -> check persisted edits & run 4-resolution light/dark visual matrix
      running = await start(profileDir);
      attachListeners(running.cdp);
      await running.cdp.send('Page.enable');
      await ensureWindowFocus(running.cdp, running.child.pid);
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-workspace-bar'));`, 'restarted shell loaded');

      // Check persisted manual tx in Movimentações + persisted Alimentação R$ 1.250 in Orçamentos
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Movimentações');`, 'restarted nav Movimentações');
      await waitFor(running.cdp, `return document.body.innerText.includes('Farmácia Homolog Persist');`, 'manual tx survived restart');
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Orçamentos');`, 'restarted nav Orçamentos');
      await waitFor(running.cdp, `return document.body.innerText.includes('1.250,00');`, 'Alimentação R$ 1.250,00 survived restart');

      // Open contextual drawer on Visão geral for screenshot capture
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Visão geral');`, 'restarted nav overview');
      await click(running.cdp, `return document.querySelector('.mf-ai-fab');`, 'open D01 drawer');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-ai-drawer.mf-d01'));`, 'D01 drawer open');
      shots.push(await shot(running.cdp, outputDir, 'homolog-d01-drawer-light'));
      await click(running.cdp, `return document.querySelector('.mf-ai-drawer .close-button');`, 'close D01 drawer');

      const coverageMatrix = [];
      for (const vp of viewports) {
        for (const theme of ['light', 'dark']) {
          await setViewport(running.cdp, vp.width, vp.height, theme);
          for (const v of views) {
            await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(v.label)});`, `sweep ${vp.width}x${vp.height} ${theme} ${v.label}`);
            await waitFor(running.cdp, `return document.querySelector('.mf-workspace-bar strong')?.textContent === ${JSON.stringify(v.label)};`, `active breadcrumb ${v.label}`);
            await delay(140);
            await assertCleanScreen(running.cdp, `${vp.width}x${vp.height}-${theme}-${v.slug}`);
            let pngPath = null;
            if (vp.width === 1366 || vp.width === 1484 || vp.width === 1920 || (vp.width === 1440 && ['overview', 'transactions', 'intelligence', 'budgets'].includes(v.slug))) {
              pngPath = await shot(running.cdp, outputDir, `homolog-${vp.width}x${vp.height}-${theme}-${v.slug}`);
              shots.push(pngPath);
            }
            coverageMatrix.push({ viewport: `${vp.width}x${vp.height}`, theme, screen: v.label, slug: v.slug, overflow: false, screenshot: pngPath ? path.basename(pngPath) : null });
          }
        }
      }

      fs.writeFileSync(path.join(outputDir, 'homologation-coverage.json'), JSON.stringify({
        ok: true,
        viewports,
        themes: ['light', 'dark'],
        viewsCount: views.length,
        entriesCount: coverageMatrix.length,
        screenshotsCount: shots.length,
        coverageMatrix
      }, null, 2));

      assert.deepEqual(issues, [], 'Zero JS exceptions or console errors expected: ' + issues.join(' | '));
      await running.cdp.send('Emulation.clearDeviceMetricsOverride');
      await closeCleanly(running);
      running = null;
      console.log(JSON.stringify({ ok: true, outputDir, screenshotsCount: shots.length, matrixEntries: coverageMatrix.length }));
    });
  } finally {
    if (pump) { try { await pump.stop(); } catch {} }
    if (running) {
      try { await running.cdp.send('Emulation.clearDeviceMetricsOverride'); } catch {}
      try { await closeCleanly(running); } catch { try { running.child.kill(); } catch {} }
    }
    try { await mockAi.close(); } catch {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }
}

runFullHomologation().catch((err) => {
  console.error(err);
  process.exit(1);
});
