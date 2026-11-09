'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
const dates=source.slice(source.indexOf('function iso('),source.indexOf('function snapshotBetween('));
const helpers=source.slice(source.indexOf('function overviewPriorRange('),source.indexOf('function starter()'));
const code=ts.transpileModule(dates+'\n'+helpers,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
const {overviewPriorRange,overviewCoverage,overviewComparison,overviewCumulative}=new Function(code+';return {overviewPriorRange,overviewCoverage,overviewComparison,overviewCumulative};')();
test('U1 month-to-date compares matching calendar days, including shorter and leap months',()=>{
 assert.deepEqual(overviewPriorRange('2026-11-01','2026-11-09','month'),{start:'2026-10-01',end:'2026-10-09'});
 assert.deepEqual(overviewPriorRange('2026-03-01','2026-03-31','month'),{start:'2026-02-01',end:'2026-02-28'});
 assert.deepEqual(overviewPriorRange('2024-03-01','2024-03-30','month'),{start:'2024-02-01',end:'2024-02-29'});
 assert.deepEqual(overviewPriorRange('2026-01-01','2026-01-09','month'),{start:'2025-12-01',end:'2025-12-09'});
});
test('U1 completed months and custom windows name their actual previous interval',()=>{
 assert.deepEqual(overviewPriorRange('2026-10-01','2026-10-31','lastmonth'),{start:'2026-09-01',end:'2026-09-30'});
 assert.deepEqual(overviewPriorRange('2026-11-01','2026-11-15','15d'),{start:'2026-10-17',end:'2026-10-31'});
});
test('U1 coverage distinguishes no spending from uncovered spending, and clamps presentation',()=>{
 assert.equal(overviewCoverage(0,0),null);assert.equal(overviewCoverage(10000,0),0);assert.equal(overviewCoverage(10000,2500),25);assert.equal(overviewCoverage(10000,11000),100);
});
test('U1 comparisons never manufacture percentages without a usable nonzero baseline',()=>{
 assert.match(overviewComparison(10001,10000,true).label,/menor que 1%/);assert.equal(overviewComparison(26200,10000,true).percent,162);assert.equal(overviewComparison(5000,10000,true).percent,-50);assert.equal(overviewComparison(26200,10000,false).percent,null);assert.equal(overviewComparison(100,0,true).percent,null);assert.equal(overviewComparison(0,0,true).percent,null);
});
test('U1 accumulated points are bounded and end at the exact selected interval',()=>{
 const calls=[];const points=overviewCumulative('2026-01-01','2026-12-31',(a,b)=>{calls.push([a,b]);return{expense:Number(b.slice(8))*100};},null);
 assert.equal(points.length,25);assert.equal(points.at(-1).date,'2026-12-31');assert.equal(points.at(-1).current,3100);assert.equal(points.at(-1).previous,null);assert.ok(calls.every(([a,b])=>a<=b&&b<='2026-12-31'));
});
test('U1 shorter previous months are clamped, never reading past their explicit end',()=>{
 const calls=[];const points=overviewCumulative('2026-03-01','2026-03-31',(a,b)=>{calls.push([a,b]);return{expense:1};},{start:'2026-02-01',end:'2026-02-28'});
 assert.equal(points.at(-1).previous,1);assert.ok(calls.filter(([a])=>a==='2026-02-01').every(([,b])=>b<='2026-02-28'));
});
