'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ChatGPTDemoClient } = require('../electron/ai-client.cjs');
const { AIPersonalStore } = require('../electron/ai-personal.cjs');
const { AIAuthVault } = require('../electron/ai-vault.cjs');

test('M3-SOL-01: GPT-6.2 Sol policy defines adaptive low/medium/high efforts and rejects none/minimal/xhigh', async () => {
  const {
    AI_MODEL,
    AI_EFFORTS,
    AI_REJECTED_EFFORTS,
    AI_INFERENCE_STATES,
    selectEffort,
    selectAdaptiveEffort,
    buildDemoRequest,
    publicCapabilities
  } = await import('../shared/ai-policy.mjs');

  assert.equal(AI_MODEL, 'gpt-6.2-sol');
  assert.deepEqual(AI_EFFORTS, ['low', 'medium', 'high']);
  assert.deepEqual(AI_REJECTED_EFFORTS, ['none', 'minimal', 'xhigh']);
  assert.equal(AI_INFERENCE_STATES.CONFIGURED, 'CONFIGURADO');
  assert.equal(AI_INFERENCE_STATES.MOCK_TESTED, 'TESTADO_COM_MOCK');
  assert.equal(AI_INFERENCE_STATES.LIVE_VERIFIED, 'INFERÊNCIA_REAL_VERIFICADA');

  assert.equal(selectAdaptiveEffort({ task: 'categorize', categoryCount: 1 }), 'low');
  assert.equal(selectAdaptiveEffort({ task: 'budget', categoryCount: 1 }), 'medium');
  assert.equal(selectAdaptiveEffort({ task: 'salary_budget', categoryCount: 2 }), 'medium');
  assert.equal(selectAdaptiveEffort({ task: 'categorize', ambiguity: true }), 'high');
  assert.equal(selectAdaptiveEffort({ task: 'categorize', hasRuleConflict: true }), 'high');
  assert.equal(selectAdaptiveEffort({ task: 'budget', chainedActions: true }), 'high');
  assert.equal(selectAdaptiveEffort({ task: 'salary_budget', multiCategory: true, categoryCount: 5 }), 'high');
  assert.equal(selectAdaptiveEffort({ task: 'categorize', override: 'high' }), 'high');

  for (const invalid of ['none', 'minimal', 'xhigh', 'max', 'bogus']) {
    assert.throws(() => selectEffort('categorize', invalid), /não permitido/);
    assert.throws(() => selectAdaptiveEffort({ task: 'categorize', override: invalid }), /não permitido/);
  }

  const req = buildDemoRequest('budget', 'high');
  assert.equal(req.model, 'gpt-6.2-sol');
  assert.deepEqual(req.reasoning, { effort: 'high' });

  const caps = publicCapabilities();
  assert.equal(caps.model, 'gpt-6.2-sol');
  assert.equal(caps.inferenceStatus, 'CONFIGURADO');
  assert.equal(caps.financialDataEnabled, false);
  assert.equal(caps.paidApiFallback, false);
});

test('M3-SOL-02: AIAuthVault reports gpt-6.2-sol and AIPersonalStore records high-effort usage cleanly', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-m3-sol-'));
  const fakeSafe = {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (t) => Buffer.from('enc:' + Buffer.from(t).toString('base64')),
    decryptStringAsync: async (b) => ({ result: Buffer.from(Buffer.from(b).toString('utf8').slice(4), 'base64').toString('utf8') })
  };
  try {
    const vault = new AIAuthVault(dir, fakeSafe);
    await vault.save({
      client_id: 'oaiapp_m3_test',
      subject: 'sub-m3',
      access_token: 'tok-m3',
      refresh_token: 'ref-m3',
      scopes: ['chatgpt.tokens.use.direct']
    });
    const st = await vault.status();
    assert.equal(st.model, 'gpt-6.2-sol');
    assert.equal(st.scopeGranted, true);

    const personal = new AIPersonalStore(dir, fakeSafe);
    await personal.recordUsage('sub-m3', {
      caseId: 'copilot',
      effort: 'high',
      inputTokens: 320,
      outputTokens: 140,
      reasoningTokens: 64
    });
    const summary = await personal.summary('sub-m3');
    assert.equal(summary.completedSamples, 1);
    assert.equal(summary.reasoningTokens, 64);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('M3-SOL-03: ChatGPTDemoClient sends gpt-6.2-sol Responses payload with high effort, supports cancellation and zero retry', async () => {
  let requests = 0;
  const seen = [];
  const sse = [
    { type: 'response.output_text.delta', delta: 'OK ' },
    { type: 'response.completed', response: { usage: { input_tokens: 50, output_tokens: 12, output_tokens_details: { reasoning_tokens: 4 } } } }
  ].map((x) => 'data: ' + JSON.stringify(x) + '\n\n').join('');
  const client = new ChatGPTDemoClient({
    auth: { accessToken: async () => 'tok-ok' },
    fetchFn: async (_url, opts) => {
      requests++;
      seen.push(JSON.parse(opts.body));
      const bytes = new TextEncoder().encode(sse);
      return {
        ok: true,
        body: new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } })
      };
    }
  });
  const res = await client.testDemo({ caseId: 'budget', effort: 'high', creditsDisabledConfirmed: true });
  assert.equal(requests, 1);
  assert.equal(res.model, 'gpt-6.2-sol');
  assert.equal(res.effort, 'high');
  assert.equal(res.inferenceStatus, 'INFERÊNCIA_REAL_VERIFICADA');
  assert.deepEqual(seen[0].reasoning, { effort: 'high' });

  // Verify cancelActive() aborts an in-flight call cleanly without retry
  let abortSeen = 0;
  const abortClient = new ChatGPTDemoClient({
    auth: { accessToken: async () => 'tok-ok' },
    fetchFn: (_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        abortSeen++;
        const err = new Error('USER_CANCELLED');
        err.cause = 'USER_CANCELLED';
        reject(err);
      });
    })
  });
  const pending = abortClient.testDemo({ caseId: 'categorize', effort: 'low', creditsDisabledConfirmed: true });
  await new Promise((r) => setTimeout(r, 20));
  const cancelRes = abortClient.cancelActive();
  assert.equal(cancelRes.cancelled, true);
  await assert.rejects(pending, /cancelada por solicitação sua/i);
  assert.equal(abortSeen, 1);
  assert.equal(abortClient.busy, false);
});
