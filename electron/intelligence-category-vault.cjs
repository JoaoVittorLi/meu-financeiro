'use strict';
// I2-C C1. Synthetic SQLite vault. Never opens or migrates the user's financial DB.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {FinanceDB}=require('./db.cjs');
const VAULTS=new WeakSet();
const FILENAME='synthetic-finance.sqlite';
function createSyntheticFinanceVault(){
 const base=fs.realpathSync(os.tmpdir());
 const directory=fs.mkdtempSync(path.join(base,'mf-i2c-test-'));
 fs.chmodSync(directory,0o700);
 const marker=path.join(directory,'.synthetic-i2c');
 const secret=randomUUID();
 fs.writeFileSync(marker,secret,{mode:0o600,flag:'wx'});
 const filename=path.join(directory,FILENAME);
 let db=new FinanceDB(filename),destroyed=false;
 fs.chmodSync(filename,0o600);
 function assertStore(expectedDb){
  if(destroyed||!db||expectedDb!==db||expectedDb.filename!==filename)
   throw Error('Banco sintético não pertence ao vault autorizado.');
  const root=fs.realpathSync(directory);
  if(root!==directory||!root.startsWith(base+path.sep)||
     path.basename(root).indexOf('mf-i2c-test-')!==0||path.dirname(root)!==base)
   throw Error('Diretório sintético inválido.');
  if(fs.lstatSync(marker).isSymbolicLink()||fs.readFileSync(marker,'utf8')!==secret)
   throw Error('Identidade do vault sintético inválida.');
  if(fs.lstatSync(filename).isSymbolicLink()||!fs.statSync(filename).isFile()||
     fs.realpathSync(filename)!==filename)
   throw Error('Arquivo SQLite sintético inválido.');
  return true;
 }
 const vault=Object.freeze({
  get db(){return db;},
  get filename(){return filename;},
  assertStore,
  close(){
   if(db){assertStore(db);db.close();db=null;}
  },
  reopen(){
   if(destroyed||db)throw Error('Feche o vault antes de reabrir.');
   const root=fs.realpathSync(directory);
   if(root!==directory||fs.lstatSync(marker).isSymbolicLink()||
      fs.readFileSync(marker,'utf8')!==secret||
      fs.lstatSync(filename).isSymbolicLink()||fs.realpathSync(filename)!==filename)
    throw Error('Vault alterado externamente.');
   db=new FinanceDB(filename);
   assertStore(db);
   return db;
  },
  destroy(){
   if(db){assertStore(db);db.close();db=null;}
   if(!destroyed){destroyed=true;fs.rmSync(directory,{recursive:true,force:true});}
  }
 });
 VAULTS.add(vault);
 return vault;
}
function assertSyntheticVault(vault,db){
 if(!VAULTS.has(vault)||vault.assertStore(db)!==true)
  throw Error('Ações I2-C permitidas apenas no SQLite sintético criado pelo próprio serviço.');
 return true;
}
// Adapt canonical FinanceDB APIs that already own a transaction to a nested
// savepoint under the I2-C caller's outer BEGIN IMMEDIATE, without modifying db.cjs.
// The view is an Object.create shadow: no connection/property monkey-patching.
function canonicalSavepointView(finance){
 const sql=finance.db,stack=[];let sequence=0;
 if(!sql.isTransaction)throw Error('Transação SQLite externa obrigatória.');
 const proxy=new Proxy(sql,{get(target,key){
  if(key==='exec')return statement=>{
   const command=typeof statement==='string'?statement.trim().replace(/;$/,'').trim().toUpperCase():'';
   if(command==='BEGIN IMMEDIATE'||command==='BEGIN'){
    const savepoint='i2c_nested_'+(++sequence);
    target.exec('SAVEPOINT '+savepoint);stack.push(savepoint);return;
   }
   if(command==='COMMIT'){
    const savepoint=stack.pop();if(!savepoint)throw Error('COMMIT interno inesperado.');
    target.exec('RELEASE SAVEPOINT '+savepoint);return;
   }
   if(command==='ROLLBACK'){
    const savepoint=stack.pop();if(!savepoint)throw Error('ROLLBACK interno inesperado.');
    target.exec('ROLLBACK TO SAVEPOINT '+savepoint);
    target.exec('RELEASE SAVEPOINT '+savepoint);return;
   }
   return target.exec(statement);
  };
  const v=Reflect.get(target,key,target);
  return typeof v==='function'?v.bind(target):v;
 }});
 const view=Object.create(finance);
 Object.defineProperty(view,'db',{value:proxy});
 return {view,assertBalanced(){
  if(stack.length)throw Error('Método canônico deixou SAVEPOINT sem fechar.');
  if(!sql.isTransaction)throw Error('Método canônico encerrou a transação do recibo.');
 }};
}
module.exports={createSyntheticFinanceVault,assertSyntheticVault,canonicalSavepointView};