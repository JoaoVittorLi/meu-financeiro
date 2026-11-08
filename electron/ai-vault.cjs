'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
class AIAuthVault {
  constructor(root,safeStorage){
    this.safeStorage=safeStorage;
    this.credentialsPath=path.join(root,'chatgpt-session.enc');
    this.hostPath=path.join(root,'chatgpt-host-id');
  }
  async supported(){return Boolean(this.safeStorage&&await this.safeStorage.isAsyncEncryptionAvailable());}
  async hostId(){
    if(fs.existsSync(this.hostPath)){
      const value=fs.readFileSync(this.hostPath,'utf8').trim();
      if(!/^urn:uuid:[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(value))throw new Error('Identificador local do ChatGPT inválido.');
      return value;
    }
    const value='urn:uuid:'+randomUUID();
    fs.mkdirSync(path.dirname(this.hostPath),{recursive:true,mode:0o700});
    fs.writeFileSync(this.hostPath,value,{mode:0o600,flag:'wx'});
    return value;
  }
  async read(){
    if(!fs.existsSync(this.credentialsPath))return null;
    if(!await this.supported())throw new Error('Proteção de credenciais do Windows indisponível.');
    const encrypted=Buffer.from(fs.readFileSync(this.credentialsPath,'utf8'),'base64');
    const result=await this.safeStorage.decryptStringAsync(encrypted);
    const value=JSON.parse(result.result);
    if(!value||typeof value.access_token!=='string'||typeof value.client_id!=='string'||typeof value.subject!=='string')throw new Error('Sessão ChatGPT inválida.');
    return value;
  }
  async save(value){
    if(!await this.supported())throw new Error('Não é seguro salvar credenciais do ChatGPT neste dispositivo.');
    if(!value||typeof value.client_id!=='string'||typeof value.access_token!=='string'||typeof value.refresh_token!=='string'||typeof value.subject!=='string')throw new Error('Credenciais incompletas.');
    const encrypted=await this.safeStorage.encryptStringAsync(JSON.stringify(value));
    fs.mkdirSync(path.dirname(this.credentialsPath),{recursive:true,mode:0o700});
    const temp=this.credentialsPath+'.tmp';
    fs.writeFileSync(temp,encrypted.toString('base64'),{mode:0o600});
    fs.renameSync(temp,this.credentialsPath);
  }
  async clear(){fs.rmSync(this.credentialsPath,{force:true});}
  async status(){
    const secure=await this.supported();
    if(!secure)return {connected:false,secure:false};
    const saved=await this.read();
    return saved?{connected:true,secure:true,email:saved.email||null,model:'gpt-6.1-sol',scopeGranted:(saved.scopes||[]).includes('chatgpt.tokens.use.direct')}:{connected:false,secure:true};
  }
}
module.exports={AIAuthVault};
