import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AI_MODEL,AI_DEMO_CASES,buildDemoRequest,publicCapabilities} from '../../shared/ai-policy.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Worker e desktop usam o mesmo contrato sem fallback pago',()=>{
 const caps=publicCapabilities();
 assert.equal(caps.model,AI_MODEL);
 assert.deepEqual(caps.tabs.map(x=>x.id),['today','chat','actions']);
 assert.ok(AI_DEMO_CASES.every(x=>x.question.includes('fictíc')||x.question.includes('hipotét')));
 assert.equal(caps.pwaInferenceEnabled,false);
 assert.equal(caps.financialDataEnabled,false);
 assert.equal(caps.paidApiFallback,false);
 assert.equal(buildDemoRequest('categorize').reasoning.effort,'low');
 assert.equal(buildDemoRequest('planning').reasoning.effort,'medium');
});

test('PWA tem área Inteligência e não recebe OAuth no navegador',()=>{
 const html=read('mobile-push/public/finance.html');
 const js=read('mobile-push/public/finance-ai.js');
 const worker=read('mobile-push/src/worker.js');
 const caps=publicCapabilities();
 assert.match(html,/data-view="intelligence"/);
 assert.match(html,/id="view-intelligence"/);
 assert.match(html,/finance-ai\.js/);
 assert.match(js,/pwaGet\('\/api\/ai\/capabilities'\)/);
 for(const forbidden of ['client_secret','access_token','refresh_token','api.openai.com/v1/responses'])
   assert.ok(!js.includes(forbidden),'PWA não pode conter '+forbidden);
 assert.match(worker,/import \{publicCapabilities,buildDemoRequest\} from '\.\.\/\.\.\/shared\/ai-policy\.mjs'/);
 assert.match(worker,/url\.pathname==='\/api\/ai\/demo-preview'/);
 assert.match(js,/pwaGet\('\/api\/ai\/demo-preview\?caseId='/);
 assert.ok(caps.contextLimits.maxMemories<=8);
 assert.equal(caps.memoryLocalOnly,true);
 assert.match(worker,/url\.pathname==='\/api\/ai\/capabilities'/);
 assert.match(worker,/authorizeAccess\(request,env\)/);
});

test('prévia compartilhada não altera migração financeira',()=>{
 const worker=read('mobile-push/src/worker.js');
 assert.ok(!worker.includes('POST /api/ai/infer'));
 assert.match(worker,/personalQuarantineAllowed\(env\)/);
});
