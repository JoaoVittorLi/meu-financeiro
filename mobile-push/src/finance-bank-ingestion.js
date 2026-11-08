// Server-side read-only Pluggy ingestion into a separate financial staging area.
// Credentials must be Cloudflare SECRETS, never committed or exposed to clients.
// Never delete historical transactions if Pluggy temporarily returns fewer rows.
// Never infer payments or apply personal categorization during ingestion.
import {PluggyReadOnlyProvider} from './pluggy-readonly.js';

const MAX_ACCOUNTS=30;
const MAX_RECORDS=100000;
const UUID=/^[0-9a-f]{8}-[0-9a-f-]{20,65}$/i;
const now=()=>new Date().toISOString();
function assertId(value){if(typeof value!=='string'||!UUID.test(value))throw new Error('Identificador Pluggy inválido.');return value;}
function cents(value){
  if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>9e12)
    throw new Error('Valor bancário inválido.');
  const n=Math.round(value*100);
  if(!Number.isSafeInteger(n)||Math.abs(n/100-value)>0.000001)
    throw new Error('Precisão monetária incompatível.');
  return n;
}
function date(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)||
     Number.isNaN(Date.parse(value.slice(0,10)+'T00:00:00Z')))
    throw new Error('Data do banco inválida.');
  return value.slice(0,10);
}
function trim(value,max=250){
  if(typeof value!=='string')throw new Error('Descrição bancária inválida.');
  return value.slice(0,max);
}
function normalize(account,transaction){
  const accountId=assertId(account.id);
  if(transaction.accountId&&transaction.accountId!==accountId)
    throw new Error('Transação retornada para conta diferente.');
  const externalId=assertId(transaction.id);
  return {accountId,externalId,date:date(transaction.date),
    description:trim(transaction.description||transaction.descriptionRaw||'',1000),
    amountCents:cents(transaction.amount),
    status:trim(transaction.status||'UNKNOWN',40),
    originalCategory:typeof transaction.category==='string'&&transaction.category.trim()?trim(transaction.category,70):null,
    updatedAt:typeof transaction.updatedAt==='string'?transaction.updatedAt:now()};
}
export function bankServerEnabled(env){
  return env?.PLUGGY_SERVER_ENABLED==='true'&&
    env?.PERSONAL_QUARANTINE_ENABLED==='true'&&
    env?.FINANCIAL_SCHEMA_ACTIVE!=='true'&&
    typeof env?.PLUGGY_CLIENT_ID==='string'&&env.PLUGGY_CLIENT_ID.length>5&&
    typeof env?.PLUGGY_CLIENT_SECRET==='string'&&env.PLUGGY_CLIENT_SECRET.length>10&&
    typeof env?.PLUGGY_ITEM_IDS==='string'&&env.PLUGGY_ITEM_IDS.length>10;
}
function itemIds(raw){
  const ids=String(raw||'').split(',').map(x=>x.trim());
  if(ids.length<1||ids.length>5||new Set(ids).size!==ids.length)
    throw new Error('Configuração de itens Pluggy inválida.');
  return ids.map(assertId);
}
export function ensureBankStaging(storage){
  const sql=storage.sql;
  sql.exec("CREATE TABLE IF NOT EXISTS mf_bank_staging_accounts(account_id TEXT PRIMARY KEY,item_id TEXT NOT NULL,name TEXT NOT NULL,currency TEXT NOT NULL,balance_cents INTEGER,updated_at TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS mf_bank_staging_transactions(account_id TEXT NOT NULL,external_id TEXT NOT NULL,date TEXT NOT NULL,description TEXT NOT NULL,amount_cents INTEGER NOT NULL,status TEXT NOT NULL,source_updated_at TEXT NOT NULL,ingested_at TEXT NOT NULL,PRIMARY KEY(account_id,external_id))");
  // Additive sidecar: no ALTER or rewrite of the 630 historical bank rows.
  sql.exec("CREATE TABLE IF NOT EXISTS mf_bank_staging_categories(account_id TEXT NOT NULL,external_id TEXT NOT NULL,category_original TEXT,observed_at TEXT NOT NULL,PRIMARY KEY(account_id,external_id))");
  sql.exec("CREATE TABLE IF NOT EXISTS mf_bank_sync_state(id INTEGER PRIMARY KEY CHECK(id=1),running_until INTEGER NOT NULL DEFAULT 0,last_success TEXT,last_count INTEGER NOT NULL DEFAULT 0,last_error TEXT)");
}
export function bankIngestionStatus(storage){
  ensureBankStaging(storage);
  const st=storage.sql.exec('SELECT last_success,last_count,last_error FROM mf_bank_sync_state WHERE id=1').toArray()[0];
  const accounts=storage.sql.exec('SELECT COUNT(*) AS n FROM mf_bank_staging_accounts').one().n;
  const count=storage.sql.exec('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').one().n;
  return {ok:true,enabledForUser:false,stage:st?.last_success?'staging':'not_started',
    accounts,transactions:count,lastSuccess:st?.last_success||null,
    lastFetched:st?.last_count||0,issue:st?.last_error||null,
    historicalCompletenessVerified:false,financialSyncEnabled:false,
    automaticSettlementEnabled:false,cloudCutoverAllowed:false};
}
export async function ingestPluggyToStaging(storage,env,{
  provider=null,clock=Date.now,leaseMs=180000
}={}){
  if(!bankServerEnabled(env))
    return {ok:false,stage:'not_configured',financialSyncEnabled:false};
  let ids;
  try{ids=itemIds(env.PLUGGY_ITEM_IDS);}
  catch{return {ok:false,stage:'failed',code:'BANK_ITEM_IDS_INVALID',
    financialSyncEnabled:false};}
  ensureBankStaging(storage);
  const lease=Number(clock());
  const reserved=storage.transactionSync(()=>{
    const st=storage.sql.exec('SELECT running_until FROM mf_bank_sync_state WHERE id=1').toArray()[0];
    if(st&&st.running_until>lease)return false;
    storage.sql.exec("INSERT INTO mf_bank_sync_state(id,running_until,last_count) VALUES(1,?,0) ON CONFLICT(id) DO UPDATE SET running_until=excluded.running_until",
      lease+leaseMs);
    return true;
  });
  if(!reserved)return {ok:false,stage:'already_running',financialSyncEnabled:false};
  let phase='AUTH';
  try{
    const client=provider||new PluggyReadOnlyProvider({
      clientId:env.PLUGGY_CLIENT_ID,clientSecret:env.PLUGGY_CLIENT_SECRET
    });
    const seen=new Set(),accounts=[],transactions=[];
    for(const itemId of ids){
      phase='ITEM';
      if(typeof client.getItem==='function'){
        const item=await client.getItem(itemId);
        if(item.status==='LOGIN_ERROR'||item.status==='WAITING_USER_INPUT'||
           item.status==='UPDATING'||
           item.error?.code==='USER_AUTHORIZATION_EXPIRED'||
           (typeof item.consentExpiresAt==='string'&&
             Date.parse(item.consentExpiresAt)<=Date.now()))
          throw new Error('Item Pluggy precisa ser renovado ou atualizado antes da leitura.');
      }
      phase='ACCOUNTS';
      const found=await client.listAccounts(itemId);
      if(!found.length)throw new Error('Nenhuma conta disponível.');
      for(const account of found){
        if(account.type!=='BANK'||account.currencyCode&&account.currencyCode!=='BRL')continue;
        const aid=assertId(account.id);
        if(seen.has(aid))throw new Error('Conta Pluggy repetida.');
        seen.add(aid);
        if(seen.size>MAX_ACCOUNTS)throw new Error('Muitas contas para importar.');
        accounts.push({accountId:aid,itemId,name:trim(account.name||'Conta bancária'),
          currency:'BRL',balanceCents:account.balance===null||account.balance===undefined?null:cents(account.balance)});
        phase='TRANSACTIONS';
        const tx=await client.listTransactions(aid);
        for(const raw of tx){
          transactions.push(normalize(account,raw));
          if(transactions.length>MAX_RECORDS)throw new Error('Histórico excede o limite de segurança.');
        }
        phase='ACCOUNTS';
      }
    }
    phase='VALIDATE';
    if(!accounts.length)throw new Error('Nenhuma conta bancária válida.');
    const keys=new Set();
    for(const row of transactions){
      const id=JSON.stringify([row.accountId,row.externalId]);
      if(keys.has(id))throw new Error('Transações duplicadas no retorno Pluggy.');
      keys.add(id);
    }
    // All pages and accounts validated BEFORE the first bank row is written.
    // Missing old records remain intact. No destructive cleanup or cutover.
    const at=now();
    phase='STORAGE';
    const result=storage.transactionSync(()=>{
      for(const a of accounts){
        storage.sql.exec("INSERT INTO mf_bank_staging_accounts(account_id,item_id,name,currency,balance_cents,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET item_id=excluded.item_id,name=excluded.name,currency=excluded.currency,balance_cents=excluded.balance_cents,updated_at=excluded.updated_at",
          a.accountId,a.itemId,a.name,a.currency,a.balanceCents,at);
      }
      for(const t of transactions){
        storage.sql.exec("INSERT INTO mf_bank_staging_transactions(account_id,external_id,date,description,amount_cents,status,source_updated_at,ingested_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET date=excluded.date,description=excluded.description,amount_cents=excluded.amount_cents,status=excluded.status,source_updated_at=excluded.source_updated_at,ingested_at=excluded.ingested_at",
          t.accountId,t.externalId,t.date,t.description,t.amountCents,t.status,t.updatedAt,at);
      }
      for(const t of transactions){
        storage.sql.exec("INSERT INTO mf_bank_staging_categories(account_id,external_id,category_original,observed_at) VALUES(?,?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET category_original=excluded.category_original,observed_at=excluded.observed_at",
          t.accountId,t.externalId,t.originalCategory,at);
      }
      storage.sql.exec("UPDATE mf_bank_sync_state SET running_until=0,last_success=?,last_count=?,last_error=NULL WHERE id=1",
        at,transactions.length);
      return {ok:true,stage:'staging',accounts:accounts.length,
        fetched:transactions.length,financialSyncEnabled:false,
        automaticSettlementEnabled:false,cloudCutoverAllowed:false};
    });
    return result;
  }catch(error){
    // ONLY predefined, untrusted-data-free classifications may reach the UI.
    // Never return a Pluggy response body, exception message, stack trace,
    // account number, bank balance or credential.
    const providerCode=typeof error?.safeCode==='string'&&
      /^PLUGGY_(AUTH|ITEM|ACCOUNTS|TRANSACTIONS)_(NETWORK|SCHEMA|HTTP_(400|401|403|404|408|409|422|429|500|502|503|504|OTHER))$/.test(error.safeCode)
      ?error.safeCode:null;
    const code=providerCode||'BANK_'+phase+'_INCOMPLETE';
    storage.transactionSync(()=>{
      storage.sql.exec("UPDATE mf_bank_sync_state SET running_until=0,last_error=? WHERE id=1",
        code);
    });
    return {ok:false,stage:'failed',code,
      financialSyncEnabled:false};
  }
}
export function bankReconciliationInput(storage){
  ensureBankStaging(storage);
  // Internal trusted-only access, never exposed on an HTTP endpoint.
  const rows=storage.sql.exec('SELECT account_id,external_id,date,description,amount_cents FROM mf_bank_staging_transactions').toArray();
  return rows;
}
