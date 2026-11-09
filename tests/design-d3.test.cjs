'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
const start=source.indexOf('function collectSettingsPanels('),end=source.indexOf('function pendingDashboardItems(',start);
const collectSettingsPanels=new Function(ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText+';return collectSettingsPanels;')();
test('settings regrouping preserves the original panels and their action handlers',()=>{
 let invoked=false;const profile={props:{'data-settings-group':'profile',onClick:()=>invoked=true}},data={props:{'data-settings-group':'data',children:'Backup completo'}};
 const tree={props:{children:[profile,{props:{children:[null,false,[data]]}}]}};
 const grouped=collectSettingsPanels(tree);assert.equal(grouped.profile,profile);assert.equal(grouped.data,data);grouped.profile.props.onClick();assert.equal(invoked,true);
});
test('settings tolerate unavailable desktop sections without exposing unrelated children as panels',()=>{
 const tree={props:{children:[null,false,{props:{children:'somente navegador'}},{props:{'data-settings-group':'intelligence',children:{props:{'data-settings-group':'nested'}}}}]}};
 const grouped=collectSettingsPanels(tree);assert.deepEqual(Object.keys(grouped),['intelligence']);assert.equal(grouped.integrations,undefined);
});
