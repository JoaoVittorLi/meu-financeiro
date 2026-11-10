'use strict';
// Encrypted personal AI preferences and token telemetry; not part of SQLite or sync.
// Bound to the verified ChatGPT subject. No OAuth token or bank record is persisted here.
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {validateMemoryContent,AI_MEMORY_KINDS}=require('../shared/ai-context.mjs');
const MAX_LOCAL_MEMORIES=12,MAX_USAGE_ROWS=60;
class AIPersonalStore{
  constructor(root,safeStorage){
    if(typeof root!=='string'||!root)throw new Error('Diretório da memória inválido.');
    this.path=path.join(root,'chatgpt-personal.enc');
    this.safeStorage=safeStorage;
  }
  async available(){return Boolean(this.safeStorage&&await this.safeStorage.isAsyncEncryptionAvailable());}
  validateOwner(subject){
    if(typeof subject!=='string'||subject.length<2||subject.length>512)throw new Error('Identidade ChatGPT não confirmada.');
  }
  async read(subject){
    this.validateOwner(subject);
    if(!await this.available())throw new Error('Memória criptografada indisponível neste dispositivo.');
    if(!fs.existsSync(this.path))return {version:1,owner:subject,memories:[],usage:[]};
    const decrypted=await this.safeStorage.decryptStringAsync(Buffer.from(fs.readFileSync(this.path,'utf8'),'base64'));
    const state=JSON.parse(decrypted.result);
    if(!state||state.version!==1||state.owner!==subject||!Array.isArray(state.memories)||!Array.isArray(state.usage))
      throw new Error('Memórias vinculadas a outra conta ou arquivo incompatível. Não foi alterado.');
    return state;
  }
  async save(state){
    if(!await this.available())throw new Error('Não é seguro salvar memórias sem criptografia do Windows.');
    const encrypted=await this.safeStorage.encryptStringAsync(JSON.stringify(state));
    fs.mkdirSync(path.dirname(this.path),{recursive:true,mode:0o700});
    const tmp=this.path+'.'+randomUUID()+'.tmp';
    try{
      fs.writeFileSync(tmp,Buffer.from(encrypted).toString('base64'),{mode:0o600,flag:'wx'});
      fs.renameSync(tmp,this.path);
    }finally{try{fs.rmSync(tmp,{force:true});}catch{}}
  }
  async list(subject){
    const state=await this.read(subject);
    return state.memories.map(({id,kind,text,approved,createdAt})=>({id,kind,text,approved,createdAt}));
  }
  async add(subject,{kind,text}){
    const value=validateMemoryContent(text,kind);
    const state=await this.read(subject);
    if(state.memories.length>=MAX_LOCAL_MEMORIES)throw new Error('Limite de 12 memórias locais atingido; exclua alguma antes de adicionar.');
    const entry={id:randomUUID(),kind,text:value,approved:true,createdAt:new Date().toISOString()};
    state.memories.push(entry);
    await this.save(state);
    return this.list(subject);
  }
  async remove(subject,id){
    if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Identificador de memória inválido.');
    const state=await this.read(subject);
    if(!state.memories.some(x=>x.id===id))throw new Error('Memória não encontrada.');
    state.memories=state.memories.filter(x=>x.id!==id);
    await this.save(state);
    return this.list(subject);
  }
  async clearMemories(subject){
    const state=await this.read(subject);
    state.memories=[];
    await this.save(state);
    return [];
  }
  async recordUsage(subject,entry){
    const state=await this.read(subject);
    const input=Number(entry?.inputTokens)||0,output=Number(entry?.outputTokens)||0,reasoning=Number(entry?.reasoningTokens)||0;
    if(![input,output,reasoning].every(x=>Number.isSafeInteger(x)&&x>=0&&x<2000000))
      throw new Error('Métrica de tokens inválida.');
    if(!['low','medium'].includes(entry?.effort))throw new Error('Modo de raciocínio inválido.');
    if(!['budget','categorize','planning'].includes(entry?.caseId))throw new Error('Cenário inválido para registro.');
    state.usage.push({
      when:new Date().toISOString(),caseId:entry.caseId,effort:entry.effort,
      inputTokens:input,outputTokens:output,reasoningTokens:reasoning,
      memoryCount:Number(entry?.memoryCount)||0
    });
    state.usage=state.usage.slice(-MAX_USAGE_ROWS);
    await this.save(state);
  }
  async summary(subject){
    const state=await this.read(subject);
    const totals=state.usage.reduce((a,x)=>({
      inputTokens:a.inputTokens+x.inputTokens,
      outputTokens:a.outputTokens+x.outputTokens,
      reasoningTokens:a.reasoningTokens+x.reasoningTokens
    }),{inputTokens:0,outputTokens:0,reasoningTokens:0});
    return {
      completedSamples:state.usage.length,...totals,
      memoryCount:state.memories.length,
      lastCompletedAt:state.usage.at(-1)?.when||null,
      localOnly:true,encrypted:true,
      caveat:'Registros deste dispositivo; não representam saldo, franquia ou cobrança do ChatGPT.'
    };
  }
}
module.exports={AIPersonalStore};
