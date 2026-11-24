'use strict';
// Mission 5: 13 Mandatory Real Electron Journeys (P0 Incident Verification).
// Drives real Electron + Chromium CDP + native Windows TaskDialog confirmations
// strictly against isolated synthetic profiles (MF_QA_SYNTHETIC=1) and
// a loopback 127.0.0.1 OpenAI Responses SSE server (zero external network).
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
const FORBIDDEN_LEGACY = ['Aguarda I2-A', 'aguarda I2-A', 'Funcionalidade ainda não implementada', 'ainda não implementado', 'conversação aberta pendente'];

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

function startLoopbackMockAiServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/responses') {
      res.writeHead(404);
      res.end();
      return;
    }
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const parsed = JSON.parse(body);
      requests.push(parsed);
      const userPrompt = String(parsed.input?.[parsed.input.length - 1]?.content || '').toLowerCase();
      let reply = 'Resposta GPT-6.2 Sol em modo geral (loopback QA).';
      if (userPrompt.includes('opa, testando')) {
        reply = 'Oi! Conexão OAuth ativa com GPT-6.2 Sol e chat funcionando normalmente sem acessar suas finanças pessoais.';
      } else if (userPrompt.includes('reserva de emergência')) {
        reply = 'Para construir sua reserva de emergência: 1) Calcule suas despesas essenciais mensais; 2) Mantenha de 3 a 6 meses em liquidez diária; 3) Separe um valor fixo logo ao receber sua renda.';
      } else if (userPrompt.includes('variáveis') || userPrompt.includes('corte')) {
        reply = 'Considerando o contexto anterior da conversa: revise assinaturas recorrentes e estabeleça teto semanal para entregas e lazer.';
      }

      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' });
      const mid = Math.max(1, Math.floor(reply.length / 2));
      const events = [
        { type: 'response.output_text.delta', delta: reply.slice(0, mid) },
        { type: 'response.output_text.delta', delta: reply.slice(mid) },
        { type: 'response.completed', response: { usage: { input_tokens: 72, output_tokens: 28, output_tokens_details: { reasoning_tokens: 4 } } } }
      ];
      for (const ev of events) {
        res.write(`data: ${JSON.stringify(ev)}\n\n`);
      }
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

function seedProfile(profileDir, { withMonthlyOverride = true } = {}) {
  const ym = localIso().slice(0, 7);
  const m1 = shiftMonthLocal(ym, -1);
  const m2 = shiftMonthLocal(ym, -2);
  const m3 = shiftMonthLocal(ym, -3);
  const dbPath = path.join(profileDir, 'meu-financeiro.sqlite');
  const db = new FinanceDB(dbPath);
  try {
    db.save('real', {
      version: 5,
      settings: { opening: 200000, income: 750000, fixed: 180000, existing: 0, reserve: 80000 },
      budgets: { Moradia: 180000, 'Alimentação': 200000, Transporte: 40000, Lazer: 40000 },
      transactions: []
    });
    db.save('demo', { version: 5, settings: { opening: 0, income: 0, fixed: 0, existing: 0, reserve: 0 }, budgets: {}, transactions: [] });
    db.ingestBank(ITEM_ID, {
      item: { status: 'UPDATED' },
      data: [
        {
          account: { id: ACC1_ID, name: 'Conta Corrente P0', balance: 6200, type: 'BANK', subtype: 'CHECKING_ACCOUNT', currencyCode: 'BRL' },
          transactions: [
            { id: 'sal-cur', date: `${ym}-02`, description: 'SALARIO EMPREGADOR P0', amount: 7500, status: 'POSTED', category: 'Salary' },
            { id: 'cur-mkt-1', date: `${ym}-05`, description: 'SUPERMERCADO ALFA P0', amount: -920, status: 'POSTED', category: 'Uncategorized' },
            { id: 'cur-mkt-cat', date: `${ym}-06`, description: 'PADARIA CENTRAL P0', amount: -850, status: 'POSTED', category: 'Groceries' },
            { id: 'cur-trn-1', date: `${ym}-07`, description: 'UBER VIAGEM CENTRO', amount: -45, status: 'POSTED', category: 'Transport' },
            { id: 'm1-mor', date: `${m1}-05`, description: 'ALUGUEL P0', amount: -1800, status: 'POSTED', category: 'Housing' },
            { id: 'm1-ali', date: `${m1}-10`, description: 'MERCADO M1', amount: -900, status: 'POSTED', category: 'Groceries' },
            { id: 'm2-mor', date: `${m2}-05`, description: 'ALUGUEL P0', amount: -1800, status: 'POSTED', category: 'Housing' },
            { id: 'm2-ali', date: `${m2}-10`, description: 'MERCADO M2', amount: -950, status: 'POSTED', category: 'Groceries' },
            { id: 'm3-mor', date: `${m3}-05`, description: 'ALUGUEL P0', amount: -1800, status: 'POSTED', category: 'Housing' },
            { id: 'm3-ali', date: `${m3}-10`, description: 'MERCADO M3', amount: -920, status: 'POSTED', category: 'Groceries' }
          ]
        }
      ]
    });
    new PlanningStore(db);
    if (withMonthlyOverride) {
      db.setMonthlyBudget('real', ym, 'Alimentação', 80000); // Over monthly R$ 800 despite recurring R$ 2.000
    }
  } finally {
    db.close();
  }
  return { ym, dbPath };
}

function seedLegacyBeta9Profile(profileDir) {
  const ym = localIso().slice(0, 7);
  const dbPath = path.join(profileDir, 'meu-financeiro.sqlite');
  const db = new FinanceDB(dbPath);
  try {
    db.save('real', {
      version: 5,
      settings: { opening: 120000, income: 550000, fixed: 150000, existing: 0, reserve: 60000 },
      budgets: { Moradia: 150000, 'Alimentação': 90000 },
      transactions: [
        { id: 'leg-1', date: `${ym}-04`, description: 'COMPRA ANTIGA BETA9', kind: 'expense', amount: 15000, category: 'Alimentação', origin: 'manual' }
      ]
    });
    // Remove modern tables/flags to simulate genuine 0.9.5-beta.9 upgrade
    db.db.exec('DROP TABLE IF EXISTS monthly_budgets;');
    db.db.prepare("DELETE FROM app_meta WHERE key IN ('ai_copilot_inference_enabled','m3_supervised_actions_enabled','gpt62_sol_inference_state')").run();
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
        public class MFFocusP0 {
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        }
"@
        $p = Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue
        if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
          [MFFocusP0]::ShowWindow($p.MainWindowHandle, 5) | Out-Null
          [MFFocusP0]::BringWindowToTop($p.MainWindowHandle) | Out-Null
          [MFFocusP0]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
        }
      `], { windowsHide: true, stdio: 'ignore' });
    } catch {}
  }
  await delay(100);
}

function startNativeDialogPump(pid, buttonLabels) {
  const stopFlag = path.join(os.tmpdir(), `mf-p0-dlg-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.flag`);
  const labelsArray = buttonLabels.map((s) => `'${String(s).replace(/'/g, "''")}'`).join(',');
  const ps = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System; using System.Runtime.InteropServices;
public class WinClickP0 {
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
            [WinClickP0]::PostMessage($hwnd, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
          } else {
            try { $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() } catch {}
          }
          Start-Sleep -Milliseconds 180
          break
        }
      }
    }
  }
  Start-Sleep -Milliseconds 90
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

async function waitFor(cdp, body, label, timeoutMs = 14000) {
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

async function assertNoForbiddenLegacyText(cdp, stepLabel) {
  const txt = await evaluate(cdp, `return document.body?.textContent || '';`);
  for (const s of FORBIDDEN_LEGACY) {
    assert.equal(txt.includes(s), false, `[${stepLabel}] Found forbidden legacy text "${s}" in DOM`);
  }
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

function attachIssueListeners(cdp, issues) {
  cdp.socket.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.method === 'Runtime.exceptionThrown') issues.push('JS_EXCEPTION:' + (msg.params?.exceptionDetails?.text || 'err'));
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      issues.push('CONSOLE_ERROR:' + (msg.params.args || []).map((a) => a.value || a.description || '').join(' '));
    }
  });
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

async function runP013Journeys() {
  assertSafeEnvironment();
  const outputDir = path.join(os.tmpdir(), `mf-p0-13-journeys-${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const issues = [];
  const mockAi = await startLoopbackMockAiServer();

  const p1 = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-d1-electron-p0-first-'));
  const p2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-d1-electron-p0-main-'));
  const p3 = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-d1-electron-p0-upg-'));

  let running = null;
  let pump = null;

  const dialogCaptions = [
    'Ativar inferência do Copiloto',
    'Ativar ações supervisionadas',
    'Autorizar consulta local',
    'Autorizar esta conta',
    'Confirmar e aplicar',
    'Confirmar somente no teste',
    'Confirmar novo limite',
    'Confirmar reversão'
  ];

  try {
    // =========================================================================
    // JOURNEY 1: Clean First Access to Inteligência (1366x768 & 1920x1080)
    // =========================================================================
    seedProfile(p1, { withMonthlyOverride: true });
    await withMockEnv({ MF_QA_MOCK_AI_URL: null, MF_QA_MOCK_OAUTH: null }, async () => {
      running = await start(p1);
      attachIssueListeners(running.cdp, issues);
      await ensureWindowFocus(running.cdp, running.child.pid);
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-workspace-bar'));`, 'J1 shell');
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Inteligência');`, 'J1 nav Inteligência');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-b05-page')) && Boolean(document.getElementById('mf-ai-draft'));`, 'J1 B05 rendered');

      await running.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
      await delay(120);
      const j1Layout = await evaluate(running.cdp, `
        const c = document.querySelector('.mf-b05-chat-composer');
        const r = c ? c.getBoundingClientRect() : null;
        return { overflow: document.documentElement.scrollWidth > window.innerWidth, bottom: r ? r.bottom : 9999, vh: window.innerHeight };
      `);
      assert.equal(j1Layout.overflow, false, 'J1 1366x768 zero horizontal overflow');
      assert.ok(j1Layout.bottom <= j1Layout.vh + 4, `J1 composer bottom (${j1Layout.bottom}) must be visible above 1366x768 fold (${j1Layout.vh})`);
      await assertNoForbiddenLegacyText(running.cdp, 'J1-first-access');
      await shot(running.cdp, outputDir, 'j01-first-access-1366x768-light');

      await running.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
      await delay(140);
      const j1Layout1080 = await evaluate(running.cdp, `
        const c = document.querySelector('.mf-b05-chat-composer');
        const b = [...document.querySelectorAll('.mf-b05-chat-composer button')].find(x => x.textContent.includes('Enviar'));
        const cr = c ? c.getBoundingClientRect() : null;
        const br = b ? b.getBoundingClientRect() : null;
        return { overflow: document.documentElement.scrollWidth > window.innerWidth, bottom: cr ? cr.bottom : 9999, sendBottom: br ? br.bottom : 9999, vh: window.innerHeight };
      `);
      assert.equal(j1Layout1080.overflow, false, 'J1 1920x1080 zero horizontal overflow');
      assert.ok(j1Layout1080.bottom <= j1Layout1080.vh + 4 && j1Layout1080.sendBottom <= j1Layout1080.vh + 4, `J1 1920x1080 full composer & Enviar (${j1Layout1080.bottom}/${j1Layout1080.sendBottom}) must be above fold (${j1Layout1080.vh})`);
      await shot(running.cdp, outputDir, 'j01-first-access-1920x1080-light');

      await running.cdp.send('Emulation.clearDeviceMetricsOverride');
      await closeCleanly(running);
      running = null;
      await delay(500);
    });

    // =========================================================================
    // JOURNEYS 2..12: Authenticated OAuth (no financial read & no opt-in initially)
    // =========================================================================
    const { ym } = seedProfile(p2, { withMonthlyOverride: true });
    await withMockEnv({ MF_QA_MOCK_AI_URL: mockAi.url, MF_QA_MOCK_OAUTH: '1' }, async () => {
      running = await start(p2);
      attachIssueListeners(running.cdp, issues);
      await ensureWindowFocus(running.cdp, running.child.pid);
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-workspace-bar'));`, 'J2 shell');
      pump = startNativeDialogPump(running.child.pid, dialogCaptions);

      const askAndWait = async (promptText, predicateBody, label) => {
        await fill(running.cdp, `return document.getElementById('mf-ai-draft');`, promptText, label + ' input');
        await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-chat-composer button')].find(b => !b.disabled && b.textContent.includes('Enviar'));`, label + ' send');
        return await waitFor(running.cdp, predicateBody, label + ' wait', 15000);
      };

      // J2: Authenticated OAuth without financial authorization
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Inteligência');`, 'J2 nav Inteligência');
      await waitFor(running.cdp, `return document.querySelector('.mf-b05-cap-bar')?.textContent?.includes('OAuth ChatGPT: Conectado');`, 'J2 OAuth badge');
      const capTextJ2 = await evaluate(running.cdp, `return document.querySelector('.mf-b05-cap-bar')?.textContent || '';`);
      assert.match(capTextJ2, /OAuth ChatGPT: Conectado/);
      assert.match(capTextJ2, /GPT-6\.2 Sol: Inativo/);
      assert.match(capTextJ2, /Ações M3: Desativadas/);
      await assertNoForbiddenLegacyText(running.cdp, 'J2-oauth-no-fin');
      const j2Layout = await evaluate(running.cdp, `
        const c = document.querySelector('.mf-b05-chat-composer');
        const b = [...document.querySelectorAll('.mf-b05-chat-composer button')].find(x => x.textContent.includes('Enviar'));
        const cr = c ? c.getBoundingClientRect() : null;
        const br = b ? b.getBoundingClientRect() : null;
        return { overflow: document.documentElement.scrollWidth > window.innerWidth, bottom: cr ? cr.bottom : 9999, sendBottom: br ? br.bottom : 9999, vw: window.innerWidth, vh: window.innerHeight };
      `);
      assert.equal(j2Layout.overflow, false, 'J2 default window zero horizontal overflow');
      assert.ok(j2Layout.bottom <= j2Layout.vh + 4 && j2Layout.sendBottom <= j2Layout.vh + 4, `J2 default (${j2Layout.vw}x${j2Layout.vh}) full composer & Enviar (${j2Layout.bottom}/${j2Layout.sendBottom}) must be above fold`);
      await shot(running.cdp, outputDir, 'j02-oauth-no-fin-1920x1080');

      // J3 (part A): "Opa, testando!" BEFORE inference opt-in -> NEVER "Aguarda I2-A", shows actionable CTA!
      await askAndWait(
        'Opa, testando!',
        `return [...document.querySelectorAll('.mf-ai-msg.is-assistant')].some(el => el.textContent.includes('Ativar GPT-6.2 Sol e responder'));`,
        'J3 Opa CTA'
      );
      await assertNoForbiddenLegacyText(running.cdp, 'J3-before-optin');
      await shot(running.cdp, outputDir, 'j03-opa-testando-cta');

      // Also ask a personal question before local read auth -> prompts contextual financial authorization CTA
      await askAndWait(
        'Quais foram minhas maiores despesas?',
        `return [...document.querySelectorAll('.mf-ai-msg.is-assistant')].some(el => el.textContent.includes('Autorizar leitura financeira agora'));`,
        'J5 personal CTA'
      );
      await assertNoForbiddenLegacyText(running.cdp, 'J5-personal-cta');

      // J5 + J6: Authorize financial read from the UI CTA -> auto-executes J6 contextual financial query!
      await click(running.cdp, `return [...document.querySelectorAll('.mf-ai-perm-actions button')].find(b => b.textContent.includes('Autorizar leitura financeira agora'));`, 'J5 click authorize CTA');
      await waitFor(running.cdp, `
        const t = document.querySelector('.mf-b05-chat-thread')?.textContent || '';
        return document.querySelector('.mf-b05-status')?.textContent?.includes('Leitura local autorizada') && t.includes('1.815,00');
      `, 'J6 contextual financial reply', 15000);
      await shot(running.cdp, outputDir, 'j05-j06-local-authorized-ic2');

      // Verify Mission 5 monthly_budgets consistency in Hoje Radar Proativo!
      await click(running.cdp, `return document.getElementById('mf-b05-tab-today');`, 'Hoje Radar monthly_budgets check');
      await waitFor(running.cdp, `
        const p = document.querySelector('.mf-copilot-proactive')?.textContent || '';
        return p.includes('Alimentação acima do limite') && p.includes('800,00');
      `, 'Radar proativo respects monthly_budgets override', 15000);
      await shot(running.cdp, outputDir, 'j06b-today-monthly-budgets-radar');

      // J7: Consented activation of GPT-6.2 Sol inference (native OS confirmation dialog)
      await ensureWindowFocus(running.cdp, running.child.pid);
      await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-cap-bar button')].find(b => b.textContent.trim() === 'Ativar' && b.closest('.mf-b05-cap-chip')?.textContent?.includes('GPT-6.2 Sol'));`, 'J7 click Ativar GPT-6.2 Sol');
      await waitFor(running.cdp, `return document.querySelector('.mf-b05-cap-bar')?.textContent?.includes('GPT-6.2 Sol: Ativo');`, 'J7 GPT-6.2 Sol active');

      // Temporarily revoke local financial read & return to Conversar tab so J3+J4+J8 prove pure general mode works with ZERO financial data!
      if (!(await evaluate(running.cdp, `return !!document.querySelector('.mf-b05-permissions')?.open;`))) {
        await click(running.cdp, `return document.querySelector('.mf-b05-permissions summary');`, 'open perms to test general mode');
      }
      await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-permissions button')].find(b => b.textContent.includes('Encerrar leitura'));`, 'revoke financial read for general mode');
      await waitFor(running.cdp, `return document.querySelector('.mf-b05-status')?.textContent?.includes('ChatGPT conectado');`, 'general mode active without local read');
      await click(running.cdp, `return document.getElementById('mf-b05-tab-chat');`, 'return to Conversar tab for J3/J4/J8');
      await waitFor(running.cdp, `return Boolean(document.getElementById('mf-ai-draft'));`, 'Conversar composer ready');

      // J3 (part B): "Opa, testando!" with consent active -> real loopback GPT-6.2 Sol reply without financial DB access
      const beforeCountJ3 = mockAi.requests.length;
      await askAndWait(
        'Opa, testando!',
        `return [...document.querySelectorAll('.mf-ai-msg.is-assistant')].some(el => el.textContent.includes('chat funcionando normalmente sem acessar suas finanças'));`,
        'J3 Opa Sol live loopback'
      );
      assert.equal(mockAi.requests.length, beforeCountJ3 + 1);
      assert.equal(mockAi.requests.at(-1).model, 'gpt-6.2-sol');

      // J4: "Como construir uma reserva de emergência?" without financial read
      await askAndWait(
        'Como construir uma reserva de emergência?',
        `return [...document.querySelectorAll('.mf-ai-msg.is-assistant')].some(el => el.textContent.includes('3 a 6 meses em liquidez diária'));`,
        'J4 emergency reserve'
      );
      await assertNoForbiddenLegacyText(running.cdp, 'J4-emergency-reserve');

      // J8: Multi-turn conversation (follow-up carries prior history)
      await askAndWait(
        'E como organizar meus gastos variáveis sem perder o controle?',
        `return [...document.querySelectorAll('.mf-ai-msg.is-assistant')].some(el => el.textContent.includes('Considerando o contexto anterior da conversa'));`,
        'J8 multi-turn'
      );
      assert.ok(mockAi.requests.at(-1).input.length >= 3, 'J8 must send multi-turn history to GPT-6.2 Sol');
      await waitFor(running.cdp, `
        const t = document.querySelector('.mf-b05-chat-thread');
        const msgs = [...document.querySelectorAll('.mf-ai-msg.is-assistant')];
        const last = msgs.find(el => el.textContent.includes('Considerando o contexto anterior da conversa'));
        if (!t || !last) return false;
        const tr = t.getBoundingClientRect();
        const mr = last.getBoundingClientRect();
        return mr.top < tr.bottom - 12 && mr.bottom <= tr.bottom + 14;
      `, 'J8 reply auto-scrolled visibly into .mf-b05-chat-thread', 4000);
      await shot(running.cdp, outputDir, 'j04-j08-general-multiturn');

      // Re-authorize local read + enable M3 actions for J9 & J10!
      if (!(await evaluate(running.cdp, `return !!document.querySelector('.mf-b05-permissions')?.open;`))) {
        await click(running.cdp, `return document.querySelector('.mf-b05-permissions summary');`, 'open perms for M3');
      }
      await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-permissions button')].find(b => b.textContent.includes('Autorizar leitura local'));`, 're-auth local read');
      await waitFor(running.cdp, `return document.querySelector('.mf-b05-status')?.textContent?.includes('Leitura local autorizada');`, 'local read restored');
      await ensureWindowFocus(running.cdp, running.child.pid);
      await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-cap-bar button')].find(b => b.textContent.trim() === 'Ativar' && b.closest('.mf-b05-cap-chip')?.textContent?.includes('Ações M3'));`, 'enable M3 actions chip');
      await waitFor(running.cdp, `return document.querySelector('.mf-b05-cap-bar')?.textContent?.includes('Ações M3: Ativas');`, 'M3 active');

      // J9: Supervised categorization -> Confirm -> Receipt -> Undo
      await askAndWait(
        'Coloque minhas compras do Supermercado Alfa em Alimentação > Supermercados',
        `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs.length >= 1 && cs[cs.length - 1].textContent.includes('Confirmar e aplicar');`,
        'J9 categorize preview'
      );
      await ensureWindowFocus(running.cdp, running.child.pid);
      await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Confirmar e aplicar'));`, 'J9 confirm');
      await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('Alteração aplicada');`, 'J9 receipt');
      await shot(running.cdp, outputDir, 'j09-supervised-categorize');
      await ensureWindowFocus(running.cdp, running.child.pid);
      await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Desfazer'));`, 'J9 undo');
      await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-action-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('Desfeito');`, 'J9 undone');

      // J10: Salary-based budget proposal -> Dark 1366x768 check -> Confirm monthly_budgets
      await askAndWait(
        'Meu salário este mês é R$ 7.500, reorganize meus orçamentos.',
        `const cs = document.querySelectorAll('.mf-m3-salary-card'); return cs.length >= 1 && cs[cs.length - 1].textContent.includes('Confirmar e aplicar');`,
        'J10 salary budget'
      );
      await running.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
      await evaluate(running.cdp, `document.documentElement.dataset.theme = 'dark'; const cs = document.querySelectorAll('.mf-m3-salary-card'); cs[cs.length - 1]?.scrollIntoView({ block: 'center' });`);
      await delay(120);
      assert.equal(await evaluate(running.cdp, `return document.documentElement.scrollWidth <= window.innerWidth;`), true, 'J10 zero overflow dark 1366x768');
      await shot(running.cdp, outputDir, 'j10-salary-budget-dark-1366x768');
      await running.cdp.send('Emulation.clearDeviceMetricsOverride');
      await evaluate(running.cdp, `document.documentElement.dataset.theme = 'light';`);
      await ensureWindowFocus(running.cdp, running.child.pid);
      await click(running.cdp, `const cs = document.querySelectorAll('.mf-m3-salary-card'); return [...cs[cs.length - 1].querySelectorAll('button')].find(b => b.textContent.includes('Confirmar e aplicar'));`, 'J10 confirm salary budget');
      await waitFor(running.cdp, `const cs = document.querySelectorAll('.mf-m3-salary-card'); return cs[cs.length - 1]?.querySelector('.mf-m3-action-receipt')?.textContent?.includes('Orçamentos atualizados');`, 'J10 receipt');

      // J11: Revoke all permissions (local read + Settings AI & M3 revocations)
      if (!(await evaluate(running.cdp, `return !!document.querySelector('.mf-b05-permissions')?.open;`))) {
        await click(running.cdp, `return document.querySelector('.mf-b05-permissions summary');`, 'open perms revoke');
      }
      await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-permissions button')].find(b => b.textContent.includes('Encerrar leitura'));`, 'J11 revoke local read');
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Configurações');`, 'J11 nav Settings');
      await click(running.cdp, `return [...document.querySelectorAll('.mf-settings-nav button')].find(b => b.textContent.includes('Inteligência'));`, 'J11 tab Settings Inteligência');
      await click(running.cdp, `const line = [...document.querySelectorAll('.mf-ai-settings-toggle')].find(x => x.textContent.includes('Inferência GPT-6.2 Sol')); return line?.querySelector('button');`, 'J11 revoke Sol');
      await waitFor(running.cdp, `const line = [...document.querySelectorAll('.mf-ai-settings-toggle')].find(x => x.textContent.includes('Inferência GPT-6.2 Sol')); return line?.textContent?.includes('Desativada');`, 'J11 Sol revoked');
      await click(running.cdp, `const line = [...document.querySelectorAll('.mf-ai-settings-toggle')].find(x => x.textContent.includes('Ações supervisionadas')); return line?.querySelector('button');`, 'J11 revoke M3');
      await waitFor(running.cdp, `const line = [...document.querySelectorAll('.mf-ai-settings-toggle')].find(x => x.textContent.includes('Ações supervisionadas')); return line?.textContent?.includes('Desativadas');`, 'J11 M3 revoked');

      await pump.stop();
      pump = null;
      await closeCleanly(running);
      running = null;
      await delay(700);

      // J12: Reopen application & confirm persisted SQLite data AND revoked permissions stayed revoked!
      running = await start(p2);
      attachIssueListeners(running.cdp, issues);
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-workspace-bar'));`, 'J12 reopen shell');
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Inteligência');`, 'J12 nav Inteligência');
      await waitFor(running.cdp, `return document.querySelector('.mf-b05-cap-bar')?.textContent?.includes('GPT-6.2 Sol: Inativo') && document.querySelector('.mf-b05-cap-bar')?.textContent?.includes('Ações M3: Desativadas');`, 'J12 revocations persisted');
      await assertNoForbiddenLegacyText(running.cdp, 'J12-reopened');
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Orçamentos');`, 'J12 nav Orçamentos');
      await waitFor(running.cdp, `return document.body.textContent.includes('Moradia') && document.body.textContent.includes('Alimentação');`, 'J12 budgets persisted');
      await shot(running.cdp, outputDir, 'j12-reopened-budgets-persisted');

      await closeCleanly(running);
      running = null;
      await delay(500);
    });

    // =========================================================================
    // JOURNEY 13: Synthetic Upgrade from prior 0.9.5-beta.9 SQLite profile
    // =========================================================================
    const { dbPath: upgDbPath } = seedLegacyBeta9Profile(p3);
    await withMockEnv({ MF_QA_MOCK_AI_URL: mockAi.url, MF_QA_MOCK_OAUTH: '1' }, async () => {
      running = await start(p3);
      attachIssueListeners(running.cdp, issues);
      await ensureWindowFocus(running.cdp, running.child.pid);
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-workspace-bar'));`, 'J13 upgrade shell');
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Movimentações');`, 'J13 check legacy tx');
      await waitFor(running.cdp, `return document.body.textContent.includes('COMPRA ANTIGA BETA9');`, 'J13 legacy data preserved');
      await click(running.cdp, `return [...document.querySelectorAll('button.nav-item')].find(b => b.getAttribute('aria-label') === 'Inteligência');`, 'J13 Inteligência post-upgrade');
      await waitFor(running.cdp, `return Boolean(document.querySelector('.mf-b05-page')) && document.querySelector('.mf-b05-cap-bar')?.textContent?.includes('GPT-6.2 Sol: Inativo');`, 'J13 Intelligence UI ready post-upgrade');
      await fill(running.cdp, `return document.getElementById('mf-ai-draft');`, 'Opa, testando!', 'J13 ask');
      await click(running.cdp, `return [...document.querySelectorAll('.mf-b05-chat-composer button')].find(b => !b.disabled && b.textContent.includes('Enviar'));`, 'J13 send');
      await waitFor(running.cdp, `return [...document.querySelectorAll('.mf-ai-msg.is-assistant')].some(el => el.textContent.includes('Ativar GPT-6.2 Sol e responder'));`, 'J13 upgrade CTA reply', 15000);
      await assertNoForbiddenLegacyText(running.cdp, 'J13-upgrade');
      await shot(running.cdp, outputDir, 'j13-upgrade-beta9-to-1-0-0');

      await closeCleanly(running);
      running = null;
    });

    const verifyDb = new FinanceDB(upgDbPath);
    try {
      assert.deepEqual(verifyDb.integrity(), ['ok']);
      const hasMonthlyTbl = verifyDb.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='monthly_budgets'").get();
      assert.ok(hasMonthlyTbl, 'J13 upgrade must migrate monthly_budgets cleanly');
    } finally {
      verifyDb.close();
    }

    assert.equal(issues.length, 0, 'Unexpected runtime console/page errors: ' + issues.join(' | '));
    console.log('PASS MISSION 5 P0 13-JOURNEYS: 13/13 PASS (0 runtime issues, 0 legacy I2-A strings)');
    console.log('Artifacts:', outputDir);
  } finally {
    if (pump) await pump.stop().catch(() => {});
    if (running) {
      try { running.child.kill(); } catch {}
      await delay(400);
    }
    await mockAi.close().catch(() => {});
    for (const dir of [p1, p2, p3]) {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    }
  }
}

if (require.main === module) {
  runP013Journeys().catch((err) => {
    console.error('FAIL P0 13-JOURNEYS:', err);
    process.exitCode = 1;
  });
}
module.exports = { runP013Journeys };
