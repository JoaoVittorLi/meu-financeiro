'use strict';
// D1.2 premium CSS contract: catches accidental overwrite of Argon layers.
// Static guarantees only; NOT a substitute for actual Electron screenshots.
const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..'),read=name=>readFileSync(join(root,'app',name),'utf8');
const css={
 overview:read('overview.css'),
 operations:read('operations.css'),
 decisions:read('decisions.css')
};
test('D1.2 Premium — A-D1 e A-D2/A-D3 preservam Visão Geral, Movimentações e Planejamento',()=>{
 for(const className of ['u1-overview','u1-chart-grid','u1-budget'])
  assert(css.overview.includes('.'+className),'A-D1 ausente: '+className);
 for(const className of ['u2-transactions','u2-planning','p-upcoming','p-suggestion-card','u2-calendar-grid'])
  assert(css.operations.includes('.'+className),'A-D2/A-D3 ausente: '+className);
});
test('D1.2 Premium — A-D4 preserva Orçamentos, Contas e Simulador para A-D5',()=>{
 for(const className of ['u3-budgets','u3-accounts','u3-simulator','u3-account-toolbar','mf-budget-editor','u3-scenario-chart'])
  assert(css.decisions.includes('.'+className),'A-D4/base ausente: '+className);
});
test('D1.2 Premium — CSS premium é carregado, reduz animações e não aponta para rede',()=>{
 const html=read('index.html');
 for(const name of ['overview.css','operations.css','decisions.css'])
  assert(html.includes('href="'+name+'"'),'CSS ausente do index.html: '+name);
 for(const [name,contents] of Object.entries(css)){
  assert(contents.includes('prefers-reduced-motion'),'reduced-motion ausente: '+name);
  assert(!/url\(\s*['"]?https?:\/\//i.test(contents),'CSS premium referenciou origem HTTP externa: '+name);
 }
});
