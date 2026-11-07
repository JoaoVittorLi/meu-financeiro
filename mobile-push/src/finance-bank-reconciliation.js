// Strict, read-only reconciliation between locally personalized bank references
// and fresh Pluggy records. NO MONEY is moved, NO rows are rewritten and NO
// scheduled item is settled by matching. This is a prerequisite to cutover.
const KEY_TABLES=Object.freeze([
  'bank_category_overrides','bank_transaction_notes',
  'bank_transaction_splits','bank_manual_links',
  'planned_bank_links','planned_rejected_matches',
  'bank_custom_titles'
]);
function key(accountId,externalId){
  if(typeof accountId!=='string'||!accountId||
     typeof externalId!=='string'||!externalId)
    throw new Error('Identificador bancário ausente.');
  // JSON tuple avoids concatenation collisions.
  return JSON.stringify([accountId,externalId]);
}
function rowsOf(tables,name){
  const block=tables?.[name];
  if(!block||!Array.isArray(block.rows))throw new Error('Tabela pessoal ausente: '+name);
  return block.rows;
}
function validateBankRow(row){
  if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Linha bancária inválida.');
  const id=key(row.account_id,row.external_id);
  if(typeof row.date!=='string'||!/^\d{4}-\d\d-\d\d$/.test(row.date)||
     typeof row.description!=='string'||!Number.isSafeInteger(row.amount_cents))
    throw new Error('Dados bancários incompatíveis.');
  return id;
}
function indexTransactions(rows){
  if(!Array.isArray(rows)||rows.length>100000)throw new Error('Extrato bancário inválido.');
  const index=new Map();
  for(const row of rows){
    const id=validateBankRow(row);
    if(index.has(id))throw new Error('Transação Pluggy duplicada por identidade exata.');
    index.set(id,row);
  }
  return index;
}
function normalizeText(value){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

export function reconcileBankReferences({personalTables,legacyTransactions,newTransactions,pluggyHistoryComplete=false}){
  // legacyTransactions are the original SQLite bank rows, available only
  // locally from the consistent backup. newTransactions are server Pluggy
  // results, converted into same cents/date/description schema.
  const old=indexTransactions(legacyTransactions);
  const latest=indexTransactions(newTransactions);
  const oldAccountIds=new Set(legacyTransactions.map(row=>row.account_id));
  const currentAccountIds=new Set(newTransactions.map(row=>row.account_id));
  const references=new Map();
  const linkedByTable={};
  const pendingByTable={};
  const pendingKeys=new Set();
  const verifiedKeys=new Set();
  for(const table of KEY_TABLES){
    const rows=rowsOf(personalTables,table);
    let linked=0,pending=0;
    for(const row of rows){
      const id=key(row.account_id,row.external_id);
      const prev=references.get(id)||[];
      prev.push(table);references.set(id,prev);
      if(latest.has(id)){linked++;verifiedKeys.add(id);}
      else{pending++;pendingKeys.add(id);}
    }
    linkedByTable[table]=linked;
    pendingByTable[table]=pending;
  }
  // A planned item may name a bank account without being linked to a bank
  // transaction. Do NOT infer payment from account availability.
  let missingPlannedAccountRefs=0;
  for(const row of rowsOf(personalTables,'planned_items')){
    if(row.account_id!==null&&row.account_id!==undefined){
      if(typeof row.account_id!=='string'||!row.account_id)throw new Error('Conta planejada inválida.');
      if(!currentAccountIds.has(row.account_id))missingPlannedAccountRefs++;
    }
  }
  // Dismissed duplicate pairs have opaque application-specific keys. Keep
  // them unchanged: never try to infer/rebuild those identifiers here.
  const opaqueDismissals=rowsOf(personalTables,'bank_duplicate_dismissals').length;
  const suggestions=[];
  // Generate REVIEW-ONLY suggestions. Never use amount/date alone to attach
  // bank records: multiple payments can share the same value and day.
  for(const id of pendingKeys){
    const previous=old.get(id);
    if(!previous)continue;
    const sameAccount=newTransactions.filter(t=>t.account_id===previous.account_id&&
      t.date===previous.date&&t.amount_cents===previous.amount_cents&&
      normalizeText(t.description)===normalizeText(previous.description));
    if(sameAccount.length===1){
      const candidate=sameAccount[0];
      const candidateId=key(candidate.account_id,candidate.external_id);
      if(!references.has(candidateId))
        suggestions.push({from:id,to:candidateId,action:'manual_review_required'});
    }
  }
  const pendingWithoutOldRecord=[...pendingKeys].filter(id=>!old.has(id)).length;
  // User-visible stats never contain transaction text, bank account IDs,
  // personal notes, titles, amounts or provider IDs.
  const verifiedCount=[...verifiedKeys].length,pendingCount=pendingKeys.size;
  // A perfect match over an INCOMPLETE Pluggy result is not enough for cutover.
  // This can only be certified by the controlled provider-import process.
  const ready=pluggyHistoryComplete===true&&pendingCount===0&&
     missingPlannedAccountRefs===0&&pendingWithoutOldRecord===0;
  return {
    summary:{
      personalTablesInspected:KEY_TABLES.length+2,
      referencedBankTransactions:references.size,
      verifiedExact:verifiedCount,pendingReview:pendingCount,
      pendingWithoutOldRecord,manualSuggestions:suggestions.length,
      missingPlannedAccountRefs,opaqueDismissalsPreserved:opaqueDismissals,
      bankTransactionsFetched:newTransactions.length,
      pluggyHistoryComplete:pluggyHistoryComplete===true,
      oldAccounts:oldAccountIds.size,currentAccounts:currentAccountIds.size,
      safeToConsiderCutover:ready,
      bankDataPublished:false,personalEditsApplied:false,
      automaticSettlementEnabled:false
    },
    // Internal only; do not expose these provider IDs in the renderer.
    internal:{verifiedKeys:[...verifiedKeys],pendingKeys:[...pendingKeys],
      suggestions,linkedByTable,pendingByTable}
  };
}
