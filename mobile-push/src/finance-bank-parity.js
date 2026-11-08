// Read-only parity digest on the isolated Preview staging records.
// The route returns only counts, date boundaries and SHA-256 hashes.
import {bankParityManifest} from '../../shared/bank-parity.mjs';
import {ensureBankStaging} from './finance-bank-ingestion.js';
const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const sha256=async text=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
export async function cloudBankParityManifest(storage){
  ensureBankStaging(storage);
  const rows=storage.sql.exec(
    'SELECT account_id,external_id,date,description,amount_cents,status '+
    'FROM mf_bank_staging_transactions ORDER BY account_id,external_id'
  ).toArray();
  return bankParityManifest(rows,sha256);
}
