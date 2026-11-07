// Cloud synchronization foundation for a single personal finance account.
// No data is cached on devices. Financial collections remain disabled until
// the operator explicitly enables them after protecting the Worker with Access.
export const COLLECTIONS = Object.freeze([
  'test_notes','profiles','categories','rules','manual_transactions','budgets',
  'accounts','bank_transactions','bank_overrides','planning_items',
  'planning_links','merchant_aliases','settings','review_state'
]);
export const MAX_BATCH = 60;
export function isFinancial(collection){ return collection !== 'test_notes'; }
export function validateMutation(change,financialEnabled=false){
  if(!change || typeof change !== 'object' || Array.isArray(change)) throw new Error('Alteração inválida.');
  if(typeof change.collection!=='string' || !COLLECTIONS.includes(change.collection)) throw new Error('Coleção desconhecida.');
  if(isFinancial(change.collection)&&!financialEnabled) throw new Error('Dados financeiros ainda não foram habilitados na nuvem.');
  if(typeof change.id!=='string'||!/^[-_a-zA-Z0-9:.]{1,150}$/.test(change.id)) throw new Error('Identificador inválido.');
  if(!Number.isSafeInteger(change.baseRevision)||change.baseRevision<0) throw new Error('Informe a revisão anterior.');
  if(typeof change.deleted!=='boolean') throw new Error('O campo deleted precisa ser booleano.');
  if(!change.deleted){
    if(!change.value||typeof change.value!=='object'||Array.isArray(change.value))throw new Error('Documento inválido.');
    if(JSON.stringify(change.value).length>64000)throw new Error('Documento grande demais.');
    if(Object.hasOwn(change.value,'clientSecret')||Object.hasOwn(change.value,'apiKey')||Object.hasOwn(change.value,'accessToken'))throw new Error('Credenciais não podem ser sincronizadas.');
  }
  return {collection:change.collection,id:change.id,baseRevision:change.baseRevision,
    deleted:change.deleted,value:change.deleted?null:change.value};
}
export function validateBatch(data,financialEnabled=false){
  if(!data||!Array.isArray(data.changes)||data.changes.length<1||data.changes.length>MAX_BATCH)throw new Error('Lote inválido.');
  if(typeof data.mutationId!=='string'||!/^[a-zA-Z0-9_-]{12,100}$/.test(data.mutationId))throw new Error('Identificador da operação inválido.');
  const changes=data.changes.map(x=>validateMutation(x,financialEnabled));
  const keys=new Set(changes.map(x=>x.collection+':'+x.id));
  if(keys.size!==changes.length)throw new Error('Operação contém registros duplicados.');
  return {mutationId:data.mutationId,changes};
}
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const toJSON=(x)=>x?JSON.parse(x):null;
export class CloudSyncStore {
  constructor(state){
    this.state=state;
    const sql=state.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS sync_documents (collection TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT, deleted INTEGER NOT NULL DEFAULT 0, changed_at TEXT NOT NULL, PRIMARY KEY (collection,id))');
    sql.exec('CREATE TABLE IF NOT EXISTS sync_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, collection TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT, deleted INTEGER NOT NULL, changed_at TEXT NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS sync_mutations (mutation_id TEXT PRIMARY KEY, response TEXT NOT NULL, created_at TEXT NOT NULL)');
  }
  changes(since,limit,financialEnabled=false) {
    const allowed=financialEnabled?COLLECTIONS:['test_notes'];
    const rows=this.state.storage.sql.exec(
      'SELECT seq,collection,id,revision,payload,deleted,changed_at FROM sync_events WHERE seq>? AND collection IN ('+allowed.map(()=>'?').join(',')+') ORDER BY seq ASC LIMIT ?',
      since,...allowed,limit+1
    ).toArray();
    const changes=rows.slice(0,limit).map(x=>({sequence:x.seq,collection:x.collection,id:x.id,revision:x.revision,value:toJSON(x.payload),deleted:!!x.deleted,changedAt:x.changed_at}));
    return {changes,hasMore:rows.length>limit,next:changes.length?changes.at(-1).sequence:since};
  }
  snapshot(financialEnabled=false) {
    const allowed=financialEnabled?COLLECTIONS:['test_notes'];
    const rows=this.state.storage.sql.exec(
      'SELECT collection,id,revision,payload,deleted,changed_at FROM sync_documents WHERE collection IN ('+allowed.map(()=>'?').join(',')+') ORDER BY collection,id',
      ...allowed
    ).toArray();
    if(rows.length>10000)return {error:'A base exige consultas paginadas.',status:413};
    return {documents:rows.map(x=>({collection:x.collection,id:x.id,revision:x.revision,value:toJSON(x.payload),deleted:!!x.deleted,changedAt:x.changed_at}))};
  }
  apply(data,financialEnabled=false) {
    const input=validateBatch(data,financialEnabled);
    const sql=this.state.storage.sql;
    const stored=sql.exec('SELECT response FROM sync_mutations WHERE mutation_id=?',input.mutationId).toArray()[0];
    if(stored)return {...toJSON(stored.response),replayed:true};
    return this.state.storage.transactionSync(()=>{
      const previous=sql.exec('SELECT response FROM sync_mutations WHERE mutation_id=?',input.mutationId).toArray()[0];
      if(previous)return {...toJSON(previous.response),replayed:true};
      const conflicts=[];
      for(const item of input.changes){
        const record=sql.exec('SELECT revision,payload,deleted FROM sync_documents WHERE collection=? AND id=?',item.collection,item.id).toArray()[0];
        const current=record?.revision||0;
        if(current!==item.baseRevision)conflicts.push({collection:item.collection,id:item.id,expected:item.baseRevision,currentRevision:current,
          currentValue:record&&!record.deleted?toJSON(record.payload):null,deleted:!!record?.deleted});
      }
      if(conflicts.length)return {ok:false,conflicts};
      const now=new Date().toISOString();let lastSequence=0;
      for(const item of input.changes){
        const rev=item.baseRevision+1, payload=item.deleted?null:JSON.stringify(item.value);
        sql.exec('INSERT INTO sync_documents (collection,id,revision,payload,deleted,changed_at) VALUES (?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,deleted=excluded.deleted,changed_at=excluded.changed_at',
          item.collection,item.id,rev,payload,item.deleted?1:0,now);
        sql.exec('INSERT INTO sync_events(collection,id,revision,payload,deleted,changed_at) VALUES (?,?,?,?,?,?)',
          item.collection,item.id,rev,payload,item.deleted?1:0,now);
        lastSequence=sql.exec('SELECT last_insert_rowid() AS id').one().id;
      }
      const response={ok:true,changes:input.changes.map(x=>({collection:x.collection,id:x.id,revision:x.baseRevision+1})),sequence:lastSequence};
      sql.exec('INSERT INTO sync_mutations(mutation_id,response,created_at) VALUES(?,?,?)',input.mutationId,JSON.stringify(response),now);
      return response;
    });
  }
  async fetch(request,financialEnabled=false){
    try{
      const url=new URL(request.url);
      if(url.pathname==='/health')return reply({ok:true,financialEnabled,storage:'Cloudflare SQLite Durable Object',mode:financialEnabled?'finance':'test_only'});
      if(url.pathname==='/snapshot'&&request.method==='GET'){
        const data=this.snapshot(financialEnabled);
        return reply(data,data.error?data.status:200);
      }
      if(url.pathname==='/changes'&&request.method==='GET'){
        const since=Number(url.searchParams.get('since')||0),limit=Number(url.searchParams.get('limit')||100);
        if(!Number.isSafeInteger(since)||since<0||!Number.isSafeInteger(limit)||limit<1||limit>200)return reply({error:'Parâmetros inválidos.'},400);
        return reply(this.changes(since,limit,financialEnabled));
      }
      if(url.pathname==='/apply'&&request.method==='POST'){
        const body=await request.json().catch(()=>null);
        if(JSON.stringify(body).length>1_000_000)return reply({error:'Lote grande demais.'},413);
        const result=this.apply(body,financialEnabled);
        return reply(result,result.ok?200:409);
      }
      return reply({error:'Recurso não encontrado.'},404);
    }catch(e){return reply({error:e instanceof Error?e.message:'Não foi possível sincronizar.'},400);}
  }
}
