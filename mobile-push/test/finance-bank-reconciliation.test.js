import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticPersonalPackage} from '../src/finance-synthetic-quarantine.js';
import {reconcileBankReferences} from '../src/finance-bank-reconciliation.js';
const bank1={account_id:'fictional-acct',external_id:'fictional-bank-1',
  date:'2026-11-07',description:'ALUGUEL FICTÍCIO',amount_cents:-2500};
const bank2={...bank1,external_id:'fictional-bank-2',
  description:'TRANSAÇÃO REJEITADA',amount_cents:-7200};
const setup=async()=>({
  personalTables:(await createSyntheticPersonalPackage()).tables,
  legacyTransactions:[{...bank1},{...bank2}],
  newTransactions:[{...bank1},{...bank2}]
});

test('exact Pluggy keys preserve every customized bank reference and do not alter personal rows',async()=>{
 const input=await setup();
 const before=JSON.stringify(input);
 const result=reconcileBankReferences({...input,pluggyHistoryComplete:true});
 assert.equal(result.summary.referencedBankTransactions,2);
 assert.equal(result.summary.verifiedExact,2);
 assert.equal(result.summary.pendingReview,0);
 assert.equal(result.summary.manualSuggestions,0);
 assert.equal(result.summary.missingPlannedAccountRefs,0);
 assert.equal(result.summary.opaqueDismissalsPreserved,1);
 assert.equal(result.summary.safeToConsiderCutover,true);
 assert.equal(result.summary.pluggyHistoryComplete,true);
 assert.equal(result.summary.bankDataPublished,false);
 assert.equal(result.summary.personalEditsApplied,false);
 assert.equal(result.summary.automaticSettlementEnabled,false);
 assert.equal(result.internal.pendingKeys.length,0);
 assert.equal(JSON.stringify(input),before,'no personal or bank source row mutation');
 assert.doesNotMatch(JSON.stringify(result.summary),/fictional-bank|account_id|original|ALUGUEL FICTÍCIO/);
});

test('even perfect identifier matches cannot authorize cutover without verified Pluggy history coverage',async()=>{
 const input=await setup();
 const result=reconcileBankReferences(input);
 assert.equal(result.summary.verifiedExact,2);
 assert.equal(result.summary.pendingReview,0);
 assert.equal(result.summary.pluggyHistoryComplete,false);
 assert.equal(result.summary.safeToConsiderCutover,false);
});

test('missing Pluggy history blocks cutover without deleting custom titles or marking plans paid',async()=>{
 const input=await setup();
 input.newTransactions=[bank1];
 const before=JSON.stringify(input.personalTables);
 const out=reconcileBankReferences(input);
 assert.equal(out.summary.verifiedExact,1);
 assert.equal(out.summary.pendingReview,1);
 assert.equal(out.summary.manualSuggestions,0);
 assert.equal(out.summary.safeToConsiderCutover,false);
 assert.equal(out.summary.automaticSettlementEnabled,false);
 assert.equal(JSON.stringify(input.personalTables),before);
});

test('provider transaction ID changes produce review suggestion, never automatic relink',async()=>{
 const input=await setup();
 input.newTransactions=[
  {...bank1,external_id:'new-provider-id'},
  bank2
 ];
 const out=reconcileBankReferences(input);
 assert.equal(out.summary.pendingReview,1);
 assert.equal(out.summary.manualSuggestions,1);
 assert.equal(out.summary.safeToConsiderCutover,false);
 assert.equal(out.internal.suggestions.length,1);
 assert.equal(out.internal.suggestions[0].action,'manual_review_required');
 assert.match(out.internal.suggestions[0].from,/fictional-bank-1/);
 assert.match(out.internal.suggestions[0].to,/new-provider-id/);
 assert.equal(input.personalTables.bank_manual_links.rows[0].external_id,'fictional-bank-1');
});

test('multiple equal-valued transactions on same day are ambiguous and never auto-matched',async()=>{
 const input=await setup();
 input.newTransactions=[
  {...bank1,external_id:'other-1'},
  {...bank1,external_id:'other-2'},
  bank2
 ];
 const out=reconcileBankReferences(input);
 assert.equal(out.summary.pendingReview,1);
 assert.equal(out.summary.manualSuggestions,0);
 assert.equal(out.summary.safeToConsiderCutover,false);
});

test('account migration or partially missing legacy history requires verification',async()=>{
 const input=await setup();
 input.newTransactions=[
  {...bank1,account_id:'replacement-account'},
  {...bank2,account_id:'replacement-account'}
 ];
 const out=reconcileBankReferences(input);
 assert.equal(out.summary.pendingReview,2);
 assert.equal(out.summary.missingPlannedAccountRefs,1);
 assert.equal(out.summary.safeToConsiderCutover,false);
 const missing=await setup();
 missing.legacyTransactions=[];
 missing.newTransactions=[bank2];
 const m=reconcileBankReferences(missing);
 assert.ok(m.summary.pendingWithoutOldRecord>=1);
 assert.equal(m.summary.safeToConsiderCutover,false);
});

test('duplicate or malformed transactions are refused rather than silently overriding provider records',async()=>{
 const x=await setup();
 x.newTransactions.push({...bank1});
 assert.throws(()=>reconcileBankReferences(x),/duplicada/);
 const bad=await setup();
 bad.newTransactions[0].amount_cents=2.5;
 assert.throws(()=>reconcileBankReferences(bad),/incompatíveis/);
 const missing=await setup();
 delete missing.personalTables.bank_manual_links;
 assert.throws(()=>reconcileBankReferences(missing),/ausente/);
});
