// Cloud-side validation for the EXACT 17 personal SQLite v0.9.4 tables.
//
// IMPORTANT: This is NOT registered as an HTTP route and cannot upload money
// or switch the source of truth. It validates a future authenticated import
// in a pure, side-effect-free manner. Bank/provider rows are excluded and
// bank-related links remain pending Pluggy reconciliation.
export const PERSONAL_FORMAT='mf-personal-snapshot-v1';
export const PERSONAL_COLUMNS=Object.freeze({
  profiles:['profile','initialized_at'],
  transactions:['profile','id','date','description','kind','amount_cents','category','origin'],
  budgets:['profile','category','amount_cents'],
  financial_settings:['profile','name','value_cents'],
  categories:['name','color','built_in','created_at','emoji','kind'],
  category_rules:['id','pattern','match_mode','category','scope','priority','enabled'],
  bank_category_overrides:['account_id','external_id','category'],
  bank_transaction_notes:['account_id','external_id','merchant','note','nature','reviewed_at'],
  bank_transaction_splits:['account_id','external_id','position','category','amount_cents'],
  bank_manual_links:['account_id','external_id','manual_id','linked_at'],
  merchant_aliases:['id','pattern','display_name','created_at'],
  bank_duplicate_dismissals:['pair_key','dismissed_at'],
  planned_items:['id','group_id','group_type','occurrence','total_occurrences','title','kind','amount_cents','due_date','category','account_id','notes','certainty','status','created_at','updated_at','settled_at'],
  planned_bank_links:['item_id','account_id','external_id','linked_at'],
  planned_rejected_matches:['item_id','account_id','external_id'],
  planned_audit:['id','item_id','action','details','at'],
  bank_custom_titles:['account_id','external_id','title']
});
const PRIMARY_KEYS=Object.freeze({
  profiles:['profile'],transactions:['profile','id'],budgets:['profile','category'],
  financial_settings:['profile','name'],categories:['name'],category_rules:['id'],
  bank_category_overrides:['account_id','external_id'],
  bank_transaction_notes:['account_id','external_id'],
  bank_transaction_splits:['account_id','external_id','position'],
  bank_manual_links:['account_id','external_id'],merchant_aliases:['id'],
  bank_duplicate_dismissals:['pair_key'],planned_items:['id'],
  planned_bank_links:['account_id','external_id'],
  planned_rejected_matches:['item_id','account_id','external_id'],
  planned_audit:['id'],bank_custom_titles:['account_id','external_id']
});
const INTEGER_FIELDS=Object.freeze({
  transactions:['amount_cents'],budgets:['amount_cents'],
  financial_settings:['value_cents'],categories:['built_in'],
  category_rules:['id','priority','enabled'],
  bank_transaction_splits:['position','amount_cents'],
  merchant_aliases:['id'],
  planned_items:['occurrence','total_occurrences','amount_cents'],
  planned_audit:['id']
});
const NULLABLE=Object.freeze({
  bank_transaction_notes:['reviewed_at'],
  planned_items:['group_id','account_id','settled_at']
});
const MAX_ROWS=100000,MAX_BYTES=32*1024*1024;
const enc=new TextEncoder();
function fail(reason){throw new Error('Pacote incompatível: '+reason);}
function hex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function sha(text){return hex(await crypto.subtle.digest('SHA-256',enc.encode(text)));}
function assertKeys(object,keys,label){
  if(!object||typeof object!=='object'||Array.isArray(object))fail(label+' não é um objeto.');
  const own=Object.keys(object);
  if(own.length!==keys.length||keys.some(key=>!Object.hasOwn(object,key)) ||
    own.some(key=>!keys.includes(key)))fail(label+' contém colunas inesperadas.');
}
function pk(table,row){
  return JSON.stringify(PRIMARY_KEYS[table].map(k=>{
    const v=row[k];
    if(v===null||v===undefined)fail('Chave primária nula em '+table);
    return v;
  }));
}
function validRow(table,row,columns){
  assertKeys(row,columns,'Linha de '+table);
  const integers=INTEGER_FIELDS[table]||[];
  const nullable=NULLABLE[table]||[];
  for(const col of columns){
    const value=row[col];
    if(value===null){
      if(!nullable.includes(col))fail('Nulo inesperado em '+table+'.'+col);
      continue;
    }
    if(integers.includes(col)){
      if(!Number.isSafeInteger(value))fail('Inteiro inválido em '+table+'.'+col);
      continue;
    }
    if(typeof value!=='string'||enc.encode(value).byteLength>256000)
      fail('Texto inválido em '+table+'.'+col);
  }
  if(table==='profiles'&&!['real','demo'].includes(row.profile))fail('Perfil desconhecido.');
  if(table==='transactions'||table==='planned_items'){
    if(!['income','expense'].includes(row.kind)||row.amount_cents<=0)
      fail('Movimentação com tipo ou centavos inválidos.');
  }
  if(table==='bank_transaction_splits'){
    if(row.amount_cents<=0||row.position<0||row.position>19)fail('Divisão bancária inválida.');
  }
  if(table==='budgets'&&row.amount_cents<0)fail('Orçamento negativo.');
  if(table==='category_rules'&&
    (!['contains','starts','exact'].includes(row.match_mode)||
    !['bank','manual','both'].includes(row.scope)||
    row.priority<1||row.priority>999||
    ![0,1].includes(row.enabled)))fail('Regra inválida.');
  if(table==='categories'&&!['expense','income','both'].includes(row.kind))
    fail('Natureza de categoria inválida.');
  if(table==='bank_transaction_notes'&&
    !['auto','income','expense','transfer','ignore'].includes(row.nature))
    fail('Natureza da revisão bancária inválida.');
  if(table==='planned_items'&&
    (!['confirmed','estimated'].includes(row.certainty)||
    !['planned','cancelled','settled_manual','settled'].includes(row.status)||
    row.occurrence<1||row.total_occurrences<1))
    fail('Planejamento inválido.');
}
function verifyReferences(tables){
  const profiles=new Set(tables.profiles.rows.map(x=>x.profile));
  const category=new Set(tables.categories.rows.map(x=>x.name.toLowerCase()));
  const plans=new Set(tables.planned_items.rows.map(x=>x.id));
  const manualIds=new Set(tables.transactions.rows.map(x=>x.id));
  for(const table of ['transactions','budgets','financial_settings']){
    for(const row of tables[table].rows)
      if(!profiles.has(row.profile))fail('Referência de perfil ausente em '+table);
  }
  for(const table of ['category_rules','bank_category_overrides','bank_transaction_splits']){
    for(const row of tables[table].rows)
      if(!category.has(row.category.toLowerCase()))fail('Referência de categoria ausente em '+table);
  }
  for(const table of ['planned_bank_links','planned_rejected_matches']){
    for(const row of tables[table].rows)
      if(!plans.has(row.item_id))fail('Compromisso vinculado ausente.');
  }
  for(const row of tables.bank_manual_links.rows)
    if(!manualIds.has(row.manual_id))fail('Transação manual vinculada ausente.');
}
export async function validatePersonalMigrationPackage(packageData){
  if(!packageData||packageData.format!==PERSONAL_FORMAT||packageData.schemaVersion!==6)
    fail('Versão do pacote não reconhecida.');
  const names=Object.keys(PERSONAL_COLUMNS);
  assertKeys(packageData.tables,names,'Tabelas');
  const manifest=packageData.manifest;
  if(!manifest||manifest.tables!==17||manifest.cloudTransferred!==false||
    manifest.cutoverReady!==false||manifest.bankHistoryMigrated!==false)
    fail('Indicadores de migração inválidos.');
  assertKeys(manifest.byTable,names,'Resumo');
  let rowsTotal=0,bytes=0;let root='';
  let bankLinkedCount=0;
  for(const table of names){
    const block=packageData.tables[table];
    if(!block||!Array.isArray(block.columns)||!Array.isArray(block.rows))
      fail('Tabela ausente: '+table);
    const cols=PERSONAL_COLUMNS[table];
    if(block.columns.length!==cols.length||cols.some((c,i)=>block.columns[i]!==c))
      fail('Colunas divergentes em '+table);
    const keys=new Set();
    let hashed='';
    for(const row of block.rows){
      rowsTotal++;
      if(rowsTotal>MAX_ROWS)fail('Limite de registros excedido.');
      validRow(table,row,cols);
      const id=pk(table,row);
      if(keys.has(id))fail('Chave duplicada em '+table);
      keys.add(id);
      const serialized=JSON.stringify(row);
      bytes+=enc.encode(serialized).byteLength;
      if(bytes>MAX_BYTES)fail('Limite de bytes excedido.');
      hashed+=serialized+'\n';
    }
    const digest=await sha(hashed);
    if(manifest.byTable[table]?.rows!==block.rows.length||
       manifest.byTable[table]?.digest!==digest)
      fail('Hash ou contagem divergente em '+table);
    root+=table+':'+block.rows.length+':'+digest+'\n';
    if(table==='bank_manual_links'||table==='bank_category_overrides'||
      table==='bank_transaction_notes'||table==='bank_transaction_splits'||
      table==='planned_bank_links'||table==='bank_custom_titles')
      bankLinkedCount+=block.rows.length;
  }
  if(manifest.rows!==rowsTotal||manifest.bytes!==bytes||
    manifest.digest!==await sha(root))fail('Resumo geral divergente.');
  verifyReferences(packageData.tables);
  return {
    valid:true,format:PERSONAL_FORMAT,personalTables:17,
    personalRecords:rowsTotal,
    deferredBankReferences:bankLinkedCount,
    bankIdsRequireReconciliation:true,
    // Validation is pure and cannot activate sync or store any record.
    storedInCloud:false,cutoverAllowed:false
  };
}
