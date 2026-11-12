'use strict';
// Bundle the authoritative ESM as-is; no parallel financial formulas.
const fs=require('node:fs'),path=require('node:path');
function ledgerPrefix(root){
 const ts=require('typescript');
 const source=fs.readFileSync(path.join(root,'shared/finance-period-ledger.mjs'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText;
 return '/* Generated from shared/finance-period-ledger.mjs. */\nvar FinancePeriodLedger=(function(){var exports={};\n'+compiled+'\nreturn exports;})();\n';
}
function bundleLedger(root,renderer){return Buffer.concat([Buffer.from(ledgerPrefix(root),'utf8'),Buffer.from(renderer)]);}
if(require.main===module){const root=path.resolve(__dirname,'..'),target=path.join(root,'app/app.js');fs.writeFileSync(target,bundleLedger(root,fs.readFileSync(target)));}
module.exports={ledgerPrefix,bundleLedger};
