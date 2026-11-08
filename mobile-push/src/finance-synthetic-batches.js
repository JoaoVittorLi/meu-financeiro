// Cloudflare Preview only: replay and resume a 207-row fictional personal
// snapshot through the SAME bounded transfer code as a future desktop flow.
// No user body or desktop records are read. All test rows and their manifest
// are deleted even if a test step throws. No live financial table is touched.
import {createSyntheticPersonalPackage} from './finance-synthetic-quarantine.js';
import {PERSONAL_COLUMNS} from './finance-personal-validate.js';
import {beginPersonalTransfer,applyPersonalChunk,verifyPersonalTransfer,
  cancelPersonalTransfer} from './finance-personal-batches.js';

const TOTAL_TRANSACTIONS=191;
const CHUNK_SIZE=80;
const enc=new TextEncoder();
async function hash(value){
  const raw=await crypto.subtle.digest('SHA-256',enc.encode(value));
  return [...new Uint8Array(raw)].map(n=>n.toString(16).padStart(2,'0')).join('');
}

export async function createLargeSyntheticPersonalPackage(){
  const pack=await createSyntheticPersonalPackage();
  const block=pack.tables.transactions;
  const base=block.rows[0];
  // Keep the linked fictional-manual row as the first sorted PK. Append only
  // deterministic test-only records, preserving source column ordering.
  for(let i=1;i<TOTAL_TRANSACTIONS;i++){
    block.rows.push({
      ...base,id:'fictional-manual-'+String(i).padStart(3,'0'),
      description:'Despesa fictícia de lote '+i,
      amount_cents:2500+i
    });
  }
  let bytes=0,rows=0,root='';
  for(const table of Object.keys(PERSONAL_COLUMNS)){
    const records=pack.tables[table].rows;
    let lines='';
    for(const row of records){
      const serialized=JSON.stringify(row);
      bytes+=enc.encode(serialized).byteLength;
      lines+=serialized+'\n';
      rows++;
    }
    const digest=await hash(lines);
    pack.manifest.byTable[table]={rows:records.length,digest};
    root+=table+':'+records.length+':'+digest+'\n';
  }
  pack.manifest.rows=rows;
  pack.manifest.bytes=bytes;
  pack.manifest.digest=await hash(root);
  return pack;
}

export async function runSyntheticBatchDemo(storage,{id=crypto.randomUUID()}={}){
  const pack=await createLargeSyntheticPersonalPackage();
  const manifest={...pack.manifest,format:pack.format,
    schemaVersion:pack.schemaVersion};
  let created=false;
  let replayed=0,chunkCount=0,resumed=false;
  try{
    const opened=beginPersonalTransfer(storage,{importId:id,manifest});
    if(!opened.ok||opened.replayed)throw new Error('A transferência fictícia já existe.');
    created=true;
    for(const table of Object.keys(PERSONAL_COLUMNS)){
      const values=pack.tables[table].rows;
      for(let offset=0;offset<values.length;offset+=CHUNK_SIZE){
        const chunk={importId:id,table,offset,
          rows:values.slice(offset,offset+CHUNK_SIZE)};
        const sent=applyPersonalChunk(storage,chunk);
        if(sent.inserted!==chunk.rows.length||sent.replayed!==0)
          throw new Error('O lote fictício não foi registrado integralmente.');
        chunkCount++;
        if(table==='transactions'&&offset===0){
          // Simulate a dropped acknowledgment: the exact same block is sent
          // again, and restarting begin() resumes the existing transfer.
          const duplicate=applyPersonalChunk(storage,chunk);
          if(duplicate.inserted!==0||duplicate.replayed!==chunk.rows.length)
            throw new Error('Reenvio duplicou transações fictícias.');
          replayed+=duplicate.replayed;
          const resume=beginPersonalTransfer(storage,{importId:id,manifest});
          if(!resume.replayed)throw new Error('Não foi possível retomar o envio.');
          resumed=true;
        }
      }
    }
    const checked=await verifyPersonalTransfer(storage,id);
    if(!checked.ok||checked.personalRecords!==pack.manifest.rows||
       checked.personalTables!==17||checked.financialSyncEnabled!==false||
       checked.cutoverAllowed!==false||checked.realDataPublished!==false)
      throw new Error('Conferência final do histórico fictício falhou.');
    const reverted=cancelPersonalTransfer(storage,id);
    if(!reverted.discarded)throw new Error('Quarentena fictícia não foi descartada.');
    // The previous small demo preserves harmless "aborted" audit metadata;
    // this larger exercise intentionally removes even that metadata.
    storage.sql.exec("DELETE FROM mf_transfer_session WHERE import_id=? AND state='aborted'",id);
    created=false;
    const remaining=storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_rows WHERE import_id=?',id).one().n;
    const sessions=storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_session WHERE import_id=?',id).one().n;
    if(remaining!==0||sessions!==0||!resumed||replayed!==CHUNK_SIZE)
      throw new Error('Descarte ou retomada fictícia incompletos.');
    return {
      ok:true,mode:'synthetic_batched_quarantine',
      personalTables:17,fictionalRecords:pack.manifest.rows,
      fictionalTransactions:TOTAL_TRANSACTIONS,chunkCount,
      replayedWithoutDuplicates:replayed,
      interruptedTransferResumed:resumed,
      allTableHashesValidated:true,rollbackVerified:true,
      quarantineRowsRemaining:0,realRecordsReceived:0,
      financialMigrationActivated:false,syncedToDevices:false
    };
  }finally{
    if(created){
      // Fail closed: any unexpected exception triggers a full rollback,
      // including removal of the synthetic transfer session record.
      cancelPersonalTransfer(storage,id);
      storage.sql.exec("DELETE FROM mf_transfer_session WHERE import_id=? AND state='aborted'",id);
    }
  }
}
