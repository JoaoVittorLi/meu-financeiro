'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {FinanceDB}=require('../electron/db.cjs');
const {createSyntheticProfile}=require('./d1-electron-smoke.cjs');
const ITEM='11111111-1111-4111-8111-111111111111',ACCOUNT='22222222-2222-4222-8222-222222222222';
function seedCategoryReview(profile){
 createSyntheticProfile(profile);const db=new FinanceDB(path.join(profile,'meu-financeiro.sqlite'));
 try{
  const tx=(id,description,extra={})=>({id,date:'2026-11-10',description,amount:-18.9,status:'POSTED',category:'Outros',...extra});
  db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'Conta de teste · dados fictícios',balance:null},transactions:[
   ...['1','2','3','4','5'].map(i=>tx('cafe-'+i,'CAFETERIA FLORESTA')),
   tx('ambiguous-1','LOJA HORIZONTE'),tx('ambiguous-2','LOJA HORIZONTE'),tx('ambiguous-3','LOJA HORIZONTE'),
   tx('pix-generic','PIX'),tx('bank-pending','COMPRA A CONFIRMAR',{status:'PENDING'})]}]});
  for(const id of ['cafe-1','cafe-2','cafe-3'])db.overrideBankCategory({accountId:ACCOUNT,externalId:id,category:'Alimentação'});
  db.overrideBankCategory({accountId:ACCOUNT,externalId:'ambiguous-1',category:'Lazer'});
  db.overrideBankCategory({accountId:ACCOUNT,externalId:'ambiguous-2',category:'Compras'});
  db.db.prepare("UPDATE bank_transaction_notes SET reviewed_at='2026-11-10T12:00:00Z' WHERE account_id=?").run(ACCOUNT);
 }finally{db.close();}
}
if(require.main===module){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d1-electron-category-'));
 seedCategoryReview(profile);
 const env={...process.env,MF_DESKTOP_SMOKE_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;
 const child=require('node:child_process').spawn(require('electron'),['--user-data-dir='+profile,path.resolve(__dirname,'..')],{env,windowsHide:false,stdio:'inherit'});
 console.log(JSON.stringify({syntheticOnly:true,profile,pid:child.pid}));
 child.on('error',e=>{console.error(e.message);process.exitCode=1;});
 child.on('exit',code=>{process.exitCode=code??1;console.log('Perfil sintético preservado para conferir persistência: '+profile);});
}
module.exports={seedCategoryReview};
