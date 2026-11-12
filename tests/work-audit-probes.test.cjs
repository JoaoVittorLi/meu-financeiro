'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {audit}=require('../scripts/work-audit-probes.cjs');
test('combined #41/#42 probe confirms canonical 60/40 distribution, no double counting',async()=>{
 const report=await audit();assert.equal(report.result,'PASS');assert.equal(report.resolved,true);
 assert.deepEqual(report.actualCategories,['Alimentação','Transporte']);assert.equal(report.totalsMatch,true);
 assert.equal(report.applicationWindowsTested,false);assert.equal(report.financialDataChanged,false);
});
