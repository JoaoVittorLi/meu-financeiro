'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=(p)=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('Inteligência tem rota própria sem substituir Simular compra',()=>{
 const app=source('src/app.ts');
 assert.match(app,/this\.navItem\('intelligence','spark','Inteligência'\)/);
 assert.match(app,/assistant:this\.renderAssistant/);
 assert.match(app,/intelligence:\(\)=>renderIntelligenceView\(this\)/);
 assert.match(app,/page==='simulator'\?'assistant'/);
});

test('Interface nova mantém Hoje, Conversar e Plano de ação como prévia',()=>{
 const view=source('src/intelligence-view.ts');
 for(const label of ["label:'Hoje'","label:'Conversar'","label:'Plano de ação'","Prévia · dados fictícios","NÃO ENVIADA"])
  assert.ok(view.includes(label),'Esperado na interface: '+label);
 assert.match(view,/renderIntelligencePanel\(app:any\)/);
 assert.match(view,/renderIntelligenceSettings\(app:any\)/);
 assert.match(view,/intelligencePanelOpen:false/);
});

test('Prévia não consulta o banco nem chama provedores de IA',()=>{
 const view=source('src/intelligence-view.ts');
 for(const forbidden of ['api.openai.com','fetch(','bankSync(','getTransactions(','clientSecret','accessToken','Authorization:'])
  assert.ok(!view.includes(forbidden),'Prévia contém chamada/segredo proibido: '+forbidden);
 assert.match(source('app/index.html'),/intelligence\.css/);
 assert.match(source('tsconfig.json'),/src\/intelligence-view\.ts/);
});

test('Painel contextual oferece perguntas para todas as seis áreas',()=>{
 const view=source('src/intelligence-view.ts');
 for(const key of ['overview:','transactions:','planning:','budgets:','assistant:','banks:'])
  assert.ok(view.includes(key),'Contexto ausente: '+key);
 const app=source('src/app.ts');
 assert.match(app,/this\.openIntelligenceContext\('transactions'\)/);
 assert.match(app,/renderIntelligencePanel\(this\)/);
});

test('Configurações não coletam segredos no renderer',()=>{
 const view=source('src/intelligence-view.ts');
 assert.match(view,/Não conectada/);
 assert.match(view,/GPT-6\.1 Sol/);
 assert.match(view,/O login com ChatGPT é iniciado no Windows/);
 assert.match(source('src/intelligence-integration.ts'),/desktop\.aiConnect/);
});
