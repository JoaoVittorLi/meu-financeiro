'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {isItemId}=require('./pluggy.cjs');
class PluggyVault {
 constructor(root,safeStorage){this.file=path.join(root,'pluggy-credentials.enc');this.safeStorage=safeStorage;}
 async supported(){return !!(await this.safeStorage.isAsyncEncryptionAvailable());}
 async get(){
   if(!fs.existsSync(this.file))return null;
   if(!await this.supported())throw new Error('A proteção de credenciais do Windows está indisponível.');
   const encrypted=Buffer.from(fs.readFileSync(this.file,'utf8'),'base64');
   const decrypted=await this.safeStorage.decryptStringAsync(encrypted);
   if(typeof decrypted?.result!=='string')throw new Error('Não foi possível descriptografar as credenciais.');
   return JSON.parse(decrypted.result);
 }
 async status(){let saved=await this.get();return {configured:!!saved,clientId:saved?.clientId||'',itemIds:saved?.itemIds||[],secure:await this.supported()};}
 async put({clientId,clientSecret,itemIds}){
   if(!await this.supported())throw new Error('Proteção de credenciais indisponível. Não é permitido salvar em texto simples.');
   if(!Array.isArray(itemIds)||!itemIds.length||itemIds.length>5||itemIds.some(x=>!isItemId(x)))throw new Error('Informe entre 1 e 5 itemIds válidos.');
   const prev=await this.get();
   const id=(String(clientId||'').trim()||prev?.clientId||'').trim();
   const secret=String(clientSecret||'').trim()||prev?.clientSecret||'';
   if(!id||!secret||id.length>300||secret.length>1000)throw new Error('Client ID e Client Secret são obrigatórios.');
   const payload={clientId:id,clientSecret:secret,itemIds:[...new Set(itemIds)]};
   const encrypted=await this.safeStorage.encryptStringAsync(JSON.stringify(payload));
   fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
   const temp=this.file+'.tmp';fs.writeFileSync(temp,encrypted.toString('base64'),{mode:0o600});
   fs.renameSync(temp,this.file);
   return {configured:true,clientId:id,itemIds:payload.itemIds,secure:true};
 }
 async clear(){fs.rmSync(this.file,{force:true});return {configured:false};}
}
module.exports={PluggyVault};
