'use strict';
// CAT-02 v1: evidence fusion, deterministic gates and a real local Naive Bayes
// *advisor* (uncalibrated: never used alone for automatic personal writes).
// No external API, inference-generated SQL, or personal mutation.
const taxonomy=require('./d05-taxonomy.json');
const VERSION='CAT02/CLASSIFIER-V1';
const INVISIBLE_FORMAT_RE=/[\p{Cf}\u034F\u115F\u1160\u17B4\u17B5\u180E\u3164\uFFA0]/gu;
const fold=x=>String(x??'').replace(INVISIBLE_FORMAT_RE,'').normalize('NFKD')
 .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ')
 .replace(/\s+/g,' ').trim();
const tokens=x=>[...new Set(fold(x).split(' ').filter(w=>w.length>=3&&w.length<=28))].slice(0,32);
const FULL_INTERMEDIARY_TOKENS=new Set([
 'mercadopago','mercpago','mercadolivre','meli',
 'pagseguro','pagseg','pagbank','stone','cielo','paypal','picpay',
 'getnet','redecard','sumup','pagarme','infinitepay','ebanx','adyen',
 'asaas','iugu','vindi','zoop','shipay','bcash','moip','wirecard',
 'cloudwalk','ifood','rappi','ubereats','uber','99food','99pay',
 'mpago','amedigital','recargapay','paghiper','pagbrasil','pagueveloz',
 'nuvempay','cornershop','pix','qrcode',
 'pags','pgs','paygo','safrapay','efipay','gerencianet','c6pay','itaupay','bempaggo','magalupay'
]);
const BIGRAM_INTERMEDIARY_PAIRS=new Set([
 'mercado|pago','merc|pago','mercado|livre',
 'pag|seguro','pag|seg','pag|bank',
 'pay|pal','pic|pay','get|net','rede|card','sum|up',
 'pagar|me','infinite|pay','cloud|walk',
 'i|food','uber|eats','99|food','99|pay',
 'ame|digital','recarga|pay','pag|hiper','pag|brasil',
 'pague|veloz','nuvem|pay','qr|code',
 'm|pago','pay|go','safra|pay','efi|pay','c6|pay','itau|pay'
]);
const ABBREV_INTERMEDIARY_TOKENS=new Set(['mp','pag','ton','pg']);
const GLUED_INTERMEDIARY_PREFIXES=['mp','pag','ton','pg','pgs','rede','pix'];
const TRAILING_DIGITS_RE=/^([a-z0-9]*[a-z])\d+$/;
const LEADING_DIGITS_RE=/^\d+([a-z]+)$/;
const ALNUM_POS_RE=/^(?:\d+)?([a-z]+)\d+[a-z0-9]{0,4}$/;
const ALNUM_DIGIT_LEAD_POS_RE=/^(\d+[a-z]+)\d+[a-z0-9]{0,4}$/;
const BANK_TX_VERB_TOKENS=new Set([
 'compra','compras','deb','debito','cred','credito','cartao',
 'pgto','pagto','pagamento','pagamentos','transacao','lancamento',
 'autorizacao','saque','recarga','fatura','transferencia','transf',
 'visa','elo','master','mastercard','hiper','hipercard','amex','maestro','electron'
]);
const STATEMENT_CHANNEL_TOKENS=new Set([
 'online','eletronico','eletronica','digital','app','aplicativo',
 'internet','web','site','ecommerce','conta','corrente','poupanca',
 'automatico','automatica','nacional','internacional','vista','parcelado','parcelada',
 'pos','pdv','tef','link','wallet','carteira',
 'parc','parcela','parcelas','loja','loj','br',
 'no','na','nos','nas','em','do','da','dos','das','de','via','por','com','pelo','pela','para','ao'
]);
const NON_SPACE_SEP=/\S/;
function normalizeForIntermediaryScan(raw){
 return String(raw??'')
  .replace(INVISIBLE_FORMAT_RE,'')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/[\u2010-\u2015\u2212]/g,'-')
  .replace(/\s+/g,' ')
  .trim()
  .toLowerCase();
}
function tokenizeWithSeparators(norm){
 if(!norm)return [];
 const spans=[];
 const re=/[a-z0-9]+/g;
 let match,prevEnd=0;
 while((match=re.exec(norm))!==null){
  spans.push({
   token:match[0],
   sepBefore:norm.slice(prevEnd,match.index),
   sepAfter:''
  });
  if(spans.length>1)spans[spans.length-2].sepAfter=spans[spans.length-1].sepBefore;
  prevEnd=match.index+match[0].length;
 }
 if(spans.length)spans[spans.length-1].sepAfter=norm.slice(prevEnd);
 return spans;
}
function isIntermediaryBase(base){
 return ABBREV_INTERMEDIARY_TOKENS.has(base)||FULL_INTERMEDIARY_TOKENS.has(base)||base==='rede';
}
function isNumberedIntermediaryToken(tok){
 const trailing=TRAILING_DIGITS_RE.exec(tok);
 if(trailing&&isIntermediaryBase(trailing[1]))return true;
 const leading=LEADING_DIGITS_RE.exec(tok);
 if(leading&&isIntermediaryBase(leading[1]))return true;
 const alnum=ALNUM_POS_RE.exec(tok);
 if(alnum&&isIntermediaryBase(alnum[1]))return true;
 const digitLeadAlnum=ALNUM_DIGIT_LEAD_POS_RE.exec(tok);
 if(digitLeadAlnum&&isIntermediaryBase(digitLeadAlnum[1]))return true;
 return false;
}
function hasSplitMpBigram(spans,i){
 return spans[i].token==='m'&&spans[i+1]?.token==='p';
}
function isRedeProcessorAt(spans,i){
 const curr=spans[i];
 if(curr.token!=='rede')return false;
 const next=spans[i+1],afterNext=spans[i+2];
 const isLegitRedeDe=Boolean(
  next&&next.token==='de'&&/^\s+$/.test(curr.sepAfter)&&
  !NON_SPACE_SEP.test(curr.sepBefore)&&
  !NON_SPACE_SEP.test(next.sepAfter)&&
  (!afterNext||!/^pagamentos?$/.test(afterNext.token))
 );
 return !isLegitRedeDe;
}
function hasPagMenosInTokens(merchantTokens){
 if(!Array.isArray(merchantTokens))return false;
 for(let j=0;j+1<merchantTokens.length;j++){
  if(merchantTokens[j]==='pag'&&merchantTokens[j+1]==='menos')return true;
 }
 return false;
}
function isInsideTokenSubsequence(spans,i,merchantTokens){
 if(!Array.isArray(merchantTokens)||!merchantTokens.length||spans.length<merchantTokens.length)return false;
 for(let start=0;start<=spans.length-merchantTokens.length;start++){
  if(i<start||i>=start+merchantTokens.length)continue;
  let ok=true;
  for(let j=0;j<merchantTokens.length;j++){
   if(spans[start+j].token!==merchantTokens[j]){ok=false;break;}
  }
  if(ok)return true;
 }
 return false;
}
function isPagMenosPhrase(spans,i,merchantTokens=null){
 const curr=spans[i];
 const next=spans[i+1];
 if(!curr||curr.token!=='pag'||!next||next.token!=='menos')return false;
 if(!/^[\s-]+$/.test(curr.sepAfter))return false;
 if(NON_SPACE_SEP.test(curr.sepBefore))return false;
 if(i===0)return true;
 const prev=spans[i-1].token;
 if(!BANK_TX_VERB_TOKENS.has(prev)&&!STATEMENT_CHANNEL_TOKENS.has(prev))return true;
 if(hasPagMenosInTokens(merchantTokens)&&isInsideTokenSubsequence(spans,i,merchantTokens))return true;
 return false;
}
function scanIntermediarySpans(spans,{inDescriptorResidual=false,merchantTokens=null}={}){
 let seenTxVerb=false;
 for(let i=0;i<spans.length;i++){
  const curr=spans[i],tok=curr.token;
  if(FULL_INTERMEDIARY_TOKENS.has(tok)||isNumberedIntermediaryToken(tok))return true;
  if(i+1<spans.length&&BIGRAM_INTERMEDIARY_PAIRS.has(tok+'|'+spans[i+1].token))return true;
  if(hasSplitMpBigram(spans,i))return true;
  if(isRedeProcessorAt(spans,i))return true;
  if(ABBREV_INTERMEDIARY_TOKENS.has(tok)){
   if(inDescriptorResidual)return true;
   if(tok==='mp'||tok==='pg')return true;
   if(!isPagMenosPhrase(spans,i,merchantTokens)){
    if(i===0)return true;
    if(NON_SPACE_SEP.test(curr.sepBefore)||NON_SPACE_SEP.test(curr.sepAfter))return true;
    if(spans.slice(i+1).every(s=>/^\d+$/.test(s.token)))return true;
    const prev=spans[i-1].token;
    if(seenTxVerb||STATEMENT_CHANNEL_TOKENS.has(prev))return true;
   }
  }
  if(BANK_TX_VERB_TOKENS.has(tok))seenTxVerb=true;
 }
 return false;
}
function hasIntermediarySignal(raw){
 const norm=normalizeForIntermediaryScan(raw);
 if(!norm)return false;
 return scanIntermediarySpans(tokenizeWithSeparators(norm));
}
function extractResidualOutsideMerchant(descSpans,merchantTokens){
 if(!merchantTokens.length)return null;
 if(descSpans.length>=merchantTokens.length){
  const residual=[];
  let matchedAny=false;
  for(let i=0;i<descSpans.length;){
   let match=i+merchantTokens.length<=descSpans.length;
   if(match){
    const exactPrefixCount=merchantTokens.length>=2?merchantTokens.length-1:merchantTokens.length;
    for(let j=0;j<exactPrefixCount;j++){
     if(descSpans[i+j].token!==merchantTokens[j]){match=false;break;}
    }
    if(match&&merchantTokens.length>=2){
     const lastSpanTok=descSpans[i+merchantTokens.length-1].token;
     const lastMerchTok=merchantTokens[merchantTokens.length-1];
     if(lastSpanTok!==lastMerchTok&&!(lastSpanTok.length>=3&&lastMerchTok.startsWith(lastSpanTok))){
      match=false;
     }
    }
   }
   if(match){matchedAny=true;i+=merchantTokens.length;}
   else{residual.push(descSpans[i]);i++;}
  }
  if(matchedAny)return residual;
 }
 for(let start=1;start<descSpans.length;start++){
  const k=descSpans.length-start;
  if(k>=merchantTokens.length)continue;
  if(k===1&&merchantTokens[0].length<4)continue;
  let ok=true;
  for(let j=0;j<k-1;j++){
   if(descSpans[start+j].token!==merchantTokens[j]){ok=false;break;}
  }
  if(ok){
   const lastSpanTok=descSpans[descSpans.length-1].token;
   const targetTok=merchantTokens[k-1];
   if(lastSpanTok!==targetTok&&!(lastSpanTok.length>=3&&targetTok.startsWith(lastSpanTok))){
    ok=false;
   }
  }
  if(ok)return descSpans.slice(0,start);
 }
 return null;
}
function hasTokenSubsequence(descSpans,merchantTokens){
 if(!merchantTokens.length||descSpans.length<merchantTokens.length)return false;
 for(let i=0;i<=descSpans.length-merchantTokens.length;i++){
  let ok=true;
  for(let j=0;j<merchantTokens.length;j++){
   if(descSpans[i+j].token!==merchantTokens[j]){ok=false;break;}
  }
  if(ok)return true;
 }
 return false;
}
function hasDescriptorIntermediarySignal(raw,merchantTokens){
 const norm=normalizeForIntermediaryScan(raw);
 if(!norm)return false;
 const spans=tokenizeWithSeparators(norm);
 if(scanIntermediarySpans(spans,{merchantTokens}))return true;
 const firstMerchantTok=merchantTokens[0];
 if(firstMerchantTok&&firstMerchantTok.length>=3){
  for(let idx=0;idx<spans.length;idx++){
   const tok=spans[idx].token;
   if(tok.length<=firstMerchantTok.length||!tok.endsWith(firstMerchantTok))continue;
   const prefix=tok.slice(0,tok.length-firstMerchantTok.length);
   const isIntermediaryPrefix=GLUED_INTERMEDIARY_PREFIXES.includes(prefix)||
    ABBREV_INTERMEDIARY_TOKENS.has(prefix)||
    FULL_INTERMEDIARY_TOKENS.has(prefix)||
    isNumberedIntermediaryToken(prefix);
   if(isIntermediaryPrefix&&(firstMerchantTok.length>=4||merchantTokens.length===1||spans[idx+1]?.token===merchantTokens[1])){
    return true;
   }
  }
 }
 const residual=extractResidualOutsideMerchant(spans,merchantTokens);
 if(!residual)return false;
 for(let i=0;i<spans.length;i++){
  const curr=spans[i],tok=curr.token;
  if(FULL_INTERMEDIARY_TOKENS.has(tok)||isNumberedIntermediaryToken(tok))return true;
  if(i+1<spans.length&&BIGRAM_INTERMEDIARY_PAIRS.has(tok+'|'+spans[i+1].token))return true;
  if(hasSplitMpBigram(spans,i))return true;
  if(isRedeProcessorAt(spans,i))return true;
  if(ABBREV_INTERMEDIARY_TOKENS.has(tok)&&!isPagMenosPhrase(spans,i,merchantTokens)&&
     (NON_SPACE_SEP.test(curr.sepBefore)||NON_SPACE_SEP.test(curr.sepAfter)))return true;
 }
 return scanIntermediarySpans(residual,{inDescriptorResidual:true,merchantTokens});
}
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
 const merchantTokens=tokenizeWithSeparators(normalizeForIntermediaryScan(evidence.merchantName||'')).map(s=>s.token);
 const descSpans=tokenizeWithSeparators(normalizeForIntermediaryScan(transaction.description||''));
 const narrowMcc=['5411','5541','5912'].includes(String(evidence.mcc||''));
 const directCommerce=narrowMcc&&mcc&&!external&&
  evidence.transactionType==='DEBIT'&&
  ['CARD_PURCHASE','CARD PAYMENT','CARD_PAYMENT','PURCHASE'].includes(
   String(evidence.operationType||'').trim().toUpperCase())&&
  fold(evidence.paymentMethod)!=='pix'&&
  typeof evidence.merchantCnpj==='string'&&/^\d{14}$/.test(evidence.merchantCnpj)&&
  directName.length>=8&&
  !hasIntermediarySignal(evidence.merchantName)&&
  !hasIntermediarySignal(evidence.merchantBusinessName||'')&&
  !hasIntermediarySignal(evidence.receiverName||'')&&
  !hasDescriptorIntermediarySignal(transaction.description||'',merchantTokens)&&
  !hasDescriptorIntermediarySignal(evidence.description||'',merchantTokens)&&
  !hasDescriptorIntermediarySignal(evidence.descriptionRaw||'',merchantTokens)&&
  desc.includes(directName)&&
  hasTokenSubsequence(descSpans,merchantTokens);
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
