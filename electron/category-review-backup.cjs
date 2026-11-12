'use strict';
// Synthetic-only pre-write recovery gate. Destination is owned by main, never IPC.
const fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const {validateBackupFile}=require('./recovery.cjs');
class CategoryReviewBackupGate{
 constructor(service,folder,{syntheticProfile=false}={}){
  if(syntheticProfile!==true)throw Error('Backup supervisionado exige perfil sintético validado.');
  this.service=service;this.folder=folder;this.pending=new Map();
 }
 async confirm(input,owner){
  const replay=this.service.validateConfirmation(input,owner);if(replay)return replay;
  const key=owner+':'+input.id,existing=this.pending.get(key);if(existing)return existing;
  const promise=this.apply(input,owner);this.pending.set(key,promise);
  try{return await promise;}finally{this.pending.delete(key);}
 }
 async apply(input,owner){
  fs.mkdirSync(this.folder,{recursive:true,mode:0o700});
  const id=randomUUID(),file=path.join(this.folder,'before-review-'+id+'.sqlite'),partial=file+'.partial.sqlite';
  try{
   await this.service.finance.backupTo(partial);
   const {bytes}=validateBackupFile(partial),sha256=createHash('sha256').update(fs.readFileSync(partial)).digest('hex');
   fs.renameSync(partial,file);
   // confirm rechecks permission, expiry, digest and current rows inside SQLite.
   return this.service.confirm(input,owner,{id,sha256,bytes,verified:true});
  }catch(error){throw new Error('Ação não aplicada: '+error.message);}
  finally{for(const suffix of ['','-wal','-shm'])fs.rmSync(partial+suffix,{force:true});}
 }
}
module.exports={CategoryReviewBackupGate};
