'use strict';
// CAT-02 v1: evidence fusion, deterministic gates and a real local Naive Bayes
// *advisor* (uncalibrated: never used alone for automatic personal writes).
// No external API, inference-generated SQL, or personal mutation.
const taxonomy=require('./d05-taxonomy.json');
const VERSION='CAT02/CLASSIFIER-V1';
const fold=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const tokens=x=>[...new Set(fold(x).split(' ').filter(w=>w.length>=3&&w.length<=28))].slice(0,32);
function buildCatalog(catalog=taxonomy){
 if(!catalog||!Array.isArray(catalog.parents))throw Error('CAT-02: catálogo D05 indisponível');
 const byId=new Map(),byText=new Map();
 for(const p of catalog.parents){
  byId.set(p.id,{categoryId:p.id,subcategoryId:null,label:p.name,kind:p.kind||'expense'});
  for(const s of p.subcategories||[])
   byId.set(s.id,{categoryId:p.id,subcategoryId:s.id,label:s.name,kind:p.kind||'expense'});
 }
 for(const row of byId.values()){
  const k=fold(row.label),list=byText.get(k)||[];
  list.push(row);byText.set(k,list);
 }
 return {byId,byText};
}
const CATALOG=buildCatalog();
const MCC_TO_D05=Object.freeze({
 '5411':'sub:alimentacao/supermercados',
 '5812':'sub:alimentacao/restaurantes',
 '5814':'sub:alimentacao/restaurantes',
 '4121':'sub:transporte/aplicativos',
 '5541':'sub:transporte/combustivel',
 '5542':'sub:transporte/combustivel',
 '5912':'sub:saude/farmacia',
 '5732':'sub:compras/eletronicos',
 '5942':'sub:educacao/livros'
});
const PROVIDER_TO_D05=Object.freeze({
 'groceries':'sub:alimentacao/supermercados',
 'supermarkets':'sub:alimentacao/supermercados',
 'supermercado':'sub:alimentacao/supermercados',
 'restaurants':'sub:alimentacao/restaurantes',
 'restaurantes':'sub:alimentacao/restaurantes',
 'fuel':'sub:transporte/combustivel',
 'combustivel':'sub:transporte/combustivel',
 'pharmacy':'sub:saude/farmacia',
 'farmacia':'sub:saude/farmacia',
 'streaming':'sub:assinaturas/streaming',
 'books':'sub:educacao/livros'
});
function normalizeTarget(raw,index=CATALOG){
 if(!raw||typeof raw!=='object')return null;
 const categoryId=String(raw.categoryId||''),sub=raw.subcategoryId??null;
 const parent=index.byId.get(categoryId);
 if(!parent||parent.subcategoryId!==null)return null;
 if(sub!==null){
  const child=index.byId.get(sub);
  if(!child||child.categoryId!==categoryId||child.subcategoryId!==sub)return null;
 }
 return {categoryId,subcategoryId:sub};
}
function targetOfId(id,index=CATALOG){
 const row=index.byId.get(id);return row?{categoryId:row.categoryId,subcategoryId:row.subcategoryId}:null;
}
function targetKey(t){return t?JSON.stringify([t.categoryId,t.subcategoryId]):'';}
function teachLocalModel(rows,{minLabels=6}={}){
 // The only training examples allowed are human-approved, never model guesses.
 const approved=Array.isArray(rows)?rows.filter(r=>r?.approvedByHuman===true&&
  typeof r.description==='string'&&normalizeTarget(r.target)): [];
 const docCount=new Map(),wordCount=new Map(),wordsTotal=new Map(),vocabulary=new Set();
 for(const r of approved){
  const key=targetKey(normalizeTarget(r.target));docCount.set(key,(docCount.get(key)||0)+1);
  const counts=wordCount.get(key)||new Map();
  for(const w of tokens(r.description)){counts.set(w,(counts.get(w)||0)+1);vocabulary.add(w);
   wordsTotal.set(key,(wordsTotal.get(key)||0)+1);}
  wordCount.set(key,counts);
 }
 return {version:'CAT02/NB-V1',trained:approved.length>=minLabels&&docCount.size>=2,
  samples:approved.length,classes:docCount.size,docCount,wordCount,wordsTotal,vocabulary};
}
function inferLocalModel(description,model){
 if(!model?.trained)return {status:'unavailable',reason:'INSUFFICIENT_HUMAN_LABELS',candidates:[]};
 const words=tokens(description);if(!words.length)return {status:'unavailable',reason:'NO_TOKENS',candidates:[]};
 const scores=[];
 for(const [key,count] of model.docCount){
  let score=Math.log(count/model.samples);
  const counts=model.wordCount.get(key),denom=(model.wordsTotal.get(key)||0)+model.vocabulary.size;
  for(const w of words)score+=Math.log(((counts.get(w)||0)+1)/Math.max(1,denom));
  const [categoryId,subcategoryId]=JSON.parse(key);
  scores.push({target:{categoryId,subcategoryId},score});
 }
 scores.sort((a,b)=>b.score-a.score);
 // Log scores are relative ranking, NOT a calibrated probability or auto-write authority.
 return {status:'ranked_for_review',model:'local-naive-bayes-v1-uncalibrated',
  candidates:scores.slice(0,3).map((x,i)=>({target:x.target,rank:i+1})),
  reason:'PROBABILISTIC_SIGNAL_REQUIRES_REVIEW'};
}
function verifiedMerchantLabel(evidence,history,index=CATALOG){
 const cnpj=evidence?.merchantCnpj||evidence?.receiverCnpj||null;
 const merchant=fold(evidence?.merchantName||evidence?.receiverName);
 if(!cnpj&&!merchant)return {status:'insufficient'};
 const relevant=(Array.isArray(history)?history:[]).filter(r=>r?.approvedByHuman===true&&
  normalizeTarget(r.target,index)&&
  (cnpj?String(r.cnpj||'')===cnpj:fold(r.merchant)===merchant)&&
  r.nature==='expense');
 const targets=new Map();
 for(const h of relevant){const key=targetKey(normalizeTarget(h.target,index));
  const t=targets.get(key)||{target:normalizeTarget(h.target,index),count:0,dates:new Set()};
  t.count++;t.dates.add(h.date);targets.set(key,t);
 }
 if(targets.size>1)return {status:'conflict',matches:relevant.length};
 const entry=[...targets.values()][0];
 if(!entry||entry.count<3||entry.dates.size<3)return {status:'insufficient',matches:relevant.length};
 return {status:'validated',target:entry.target,matches:entry.count,distinctDates:entry.dates.size,
  source:cnpj?'human_cnpj_history':'human_exact_merchant_history'};
}
function classifyCandidate({transaction,evidence={},history=[],rules=[],catalog=CATALOG,model=null}={}){
 if(!transaction||typeof transaction!=='object')throw Error('CAT-02: transação obrigatória');
 const reference={accountId:String(transaction.accountId||''),externalId:String(transaction.externalId||transaction.id||'')};
 const result=(status,reason,extra={})=>({contract:VERSION,status,reason,
  reference,readOnly:true,changesApplied:false,...extra});
 if(!reference.accountId||!reference.externalId)return result('review','MISSING_TRANSACTION_ID');
 if(transaction.accountType==='CREDIT')return result('review','CREDIT_CARD_BILL_PARITY_NOT_APPROVED');
 if(transaction.status!=='POSTED')return result('protected','NOT_POSTED');
 const amount=transaction.amountCents??transaction.amount;
 if(!Number.isSafeInteger(amount)||amount>=0)return result('protected','NOT_POSTED_EXPENSE');
 const nature=String(transaction.nature||'auto').toLowerCase();
 if(['income','transfer','ignore'].includes(nature))return result('protected','NON_EXPENSE_NATURE');
 if(transaction.manualOverride===true||transaction.splitCount>0||transaction.linkedManualId||
   transaction.confirmedDecision===true)return result('protected','HUMAN_OR_SPLIT_PROTECTION');
 if(evidence.status&&evidence.status!=='POSTED')return result('review','EVIDENCE_STATUS_CONFLICT');
 const operation=fold(evidence.operationType).replace(/ /g,'_');
 if(/^(pagamento_fatura|estorno|cashback|transferencia_mesma_instituicao)$/.test(operation))
  return result('protected','TRANSFER_REFUND_OR_CARD_PAYMENT');
 if(evidence.paymentMethod&&fold(evidence.paymentMethod)==='pix'&&
   !evidence.merchantCnpj&&!evidence.receiverCnpj)
  return result('review','PIX_PAYEE_NOT_VERIFIED');
 const approvedRule=(Array.isArray(rules)?rules:[]).filter(x=>x?.approvedByHuman===true&&
  x.enabled===true&&normalizeTarget(x.target,catalog)&&
  (x.scope==='bank'||x.scope==='both')&&
  (x.matchMode==='exact'?fold(x.pattern)===fold(transaction.description):
   x.matchMode==='starts'?fold(transaction.description).startsWith(fold(x.pattern)):
   x.matchMode==='contains'&&fold(transaction.description).includes(fold(x.pattern))))
 .sort((a,b)=>(a.priority??100)-(b.priority??100));
 if(approvedRule.length){
  const first=normalizeTarget(approvedRule[0].target,catalog);
  if(approvedRule.some(r=>targetKey(normalizeTarget(r.target,catalog))!==targetKey(first)))
   return result('review','CONFLICTING_APPROVED_RULES');
  return result('apply','HUMAN_APPROVED_RULE',{target:first,evidenceTypes:['approved_rule'],quality:'human_approved'});
 }
 const merchant=verifiedMerchantLabel(evidence,history,catalog);
 if(merchant.status==='conflict')return result('review','HUMAN_HISTORY_CONFLICT');
 const mcc=targetOfId(MCC_TO_D05[evidence.mcc],catalog);
 const external=targetOfId(PROVIDER_TO_D05[fold(evidence.providerCategory)],catalog);
 const signals=[...[
  merchant.status==='validated'?{type:merchant.source,target:merchant.target}:null,
  mcc?{type:'merchant_mcc',target:mcc}:null,
  external?{type:'provider_category',target:external}:null
 ].filter(Boolean)];
 // Disagreement is an explicit review; do not turn it into a fake confidence score.
 if(new Set(signals.map(s=>targetKey(s.target))).size>1)
  return result('review','EVIDENCE_CONFLICT',{evidenceTypes:signals.map(s=>s.type)});
 const target=signals[0]?.target||null;
 const hasExternalPair=!!mcc&&!!external&&targetKey(mcc)===targetKey(external);
 const hasHumanCorroboration=merchant.status==='validated'&&signals.length>=2;
 // Strict initial Quality Gate: both independently described external fields
 // OR human-confirmed history + a corroborating source. Otherwise review.
 if(target&&(hasExternalPair||hasHumanCorroboration))
  return result('apply','MULTI_SIGNAL_RECONCILED',{target,
   evidenceTypes:signals.map(s=>s.type),quality:'verified_evidence',
   modelUsed:false});
 // Strong-but-conservative route without Pluggy category/Premium: a
 // narrowly mapped commercial MCC plus direct merchant identity (validated
 // CNPJ, non-processor name matching the bank description) and card debit.
 // Do not infer a child category from MCC alone. Receiver/intermediary CNPJ
 // never counts as merchant identity; Naive Bayes remains review-only.
 const directName=fold(evidence.merchantName);
 const desc=fold(transaction.description||'');
 const unaccent=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2010-\u2015\u2212]/g,'-');
 const rawProcessorPrefix=/\b(mp|pag|pagseg|ton|pg|rede|uber)\s*\*|\b(mp|pag|pagseg|ton|pg|uber)\s+[-–—\u2011\u2212/]\s+|\b(mp|pag|pagseg|ton|pg|uber)\s*[-–—\u2011\u2212/]\s*(?=[a-z0-9])|\b(?:compra|deb|debito|credito|cartao|pgto|pagto)\s+(?:mp|pag|pagseg|ton|pg|uber)\b/i;
 const processor=/\b(pag ?seguro|pag ?seg|pag ?bank|merc(?:ado)? ?pago|stone|cielo|pay ?pal|pic ?pay|get ?net|rede ?card|sum ?up|pagar ?me|infinite ?pay|ebanx|adyen|asaas|iugu|vindi|zoop|shipay|bcash|moip|wirecard|cloud ?walk|i ?food|rappi|uber ?eats|pix|qr ?code|qrcode)\b|\brede\b(?! de\b(?! pagamentos?\b))|^(mp|pag|ton|pg)\b/i;
 const hasIntermediary=raw=>rawProcessorPrefix.test(unaccent(raw))||processor.test(fold(raw));
 const narrowMcc=['5411','5541','5912'].includes(String(evidence.mcc||''));
 const directCommerce=narrowMcc&&mcc&&!external&&
  evidence.transactionType==='DEBIT'&&
  ['CARD_PURCHASE','CARD PAYMENT','CARD_PAYMENT','PURCHASE'].includes(
   String(evidence.operationType||'').trim().toUpperCase())&&
  fold(evidence.paymentMethod)!=='pix'&&
  typeof evidence.merchantCnpj==='string'&&/^\d{14}$/.test(evidence.merchantCnpj)&&
  directName.length>=8&&
  !hasIntermediary(evidence.merchantName)&&
  !hasIntermediary(evidence.merchantBusinessName||'')&&
  !hasIntermediary(transaction.description||'')&&
  !hasIntermediary(evidence.description||'')&&
  !hasIntermediary(evidence.descriptionRaw||'')&&
  desc.includes(directName);
 if(directCommerce){
  return result('apply','VERIFIED_DIRECT_MERCHANT_MCC_PARENT',{
   target:{categoryId:mcc.categoryId,subcategoryId:null},
   evidenceTypes:['merchant_mcc','direct_merchant_identity','verified_commercial_cnpj','card_purchase_type'],
   quality:'restricted_parent_only',modelUsed:false});
 }
 const suggestion=model?inferLocalModel(transaction.description||evidence.description,model):null;
 return result('review',target?'SINGLE_UNCORROBORATED_SIGNAL':'INSUFFICIENT_EVIDENCE',{
  ...(target?{suggestedTarget:target}:{}),
  evidenceTypes:signals.map(s=>s.type),
  localInference:suggestion?.status==='ranked_for_review'?suggestion:null,
  modelUsed:suggestion?.status==='ranked_for_review'
 });
}
module.exports={VERSION,buildCatalog,MCC_TO_D05,PROVIDER_TO_D05,
 normalizeTarget,teachLocalModel,inferLocalModel,verifiedMerchantLabel,classifyCandidate};
