'use strict';
// CAT-02 v1: evidence fusion, deterministic gates and a real local Naive Bayes
// *advisor* (uncalibrated: never used alone for automatic personal writes).
// No external API, inference-generated SQL, or personal mutation.
const taxonomy=require('./d05-taxonomy.json');
const VERSION='CAT02/CLASSIFIER-V1';
const INVISIBLE_FORMAT_RE=/[\p{Cf}\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u2060-\u206F\u2800\u3164\uFE00-\uFE0F\uFFA0\u{E0100}-\u{E01EF}]/gu;
const CONFUSABLE_HOMOGLYPHS={
 '\u0410':'a','\u0430':'a','\u0412':'b','\u0432':'b','\u0421':'c','\u0441':'c',
 '\u0415':'e','\u0435':'e','\u041D':'h','\u043D':'h','\u0406':'i','\u0456':'i',
 '\u04C0':'i','\u04CF':'i',
 '\u0408':'j','\u0458':'j','\u041A':'k','\u043A':'k','\u041C':'m','\u043C':'m',
 '\u041E':'o','\u043E':'o','\u0420':'p','\u0440':'p','\u0405':'s','\u0455':'s',
 '\u0422':'t','\u0442':'t','\u04AE':'u','\u04AF':'u','\u0474':'v','\u0475':'v',
 '\u0423':'y','\u0443':'y','\u0425':'x','\u0445':'x',
 '\u0391':'a','\u03B1':'a','\u0392':'b','\u03B2':'b','\u03F9':'c','\u03F2':'c',
 '\u0395':'e','\u03B5':'e','\u0396':'z','\u03B6':'z','\u0397':'h','\u03B7':'h',
 '\u0399':'i','\u03B9':'i','\u039A':'k','\u03BA':'k','\u039C':'m','\u03BC':'m',
 '\u039D':'n','\u03BD':'v','\u039F':'o','\u03BF':'o','\u03A1':'p','\u03C1':'p',
 '\u03A4':'t','\u03C4':'t','\u03A5':'y','\u03C5':'y','\u03A7':'x','\u03C7':'x',
 '\u0131':'i','\u0196':'i','\u01C0':'i','\u0269':'i','\u024A':'q','\u024B':'q',
 '\uA7AF':'q','\u1D00':'a','\u0299':'b','\u1D04':'c','\u1D05':'d','\u1D07':'e',
 '\u0261':'g','\u0262':'g','\u026A':'i','\u1D0B':'k','\u029F':'l','\u1D0D':'m',
 '\u0274':'n','\u1D0F':'o','\u1D18':'p','\u0280':'r','\uA731':'s','\u1D1B':'t',
 '\u1D1C':'u','\u1D20':'v','\u1D21':'w','\u028F':'y','\u1D22':'z',
 '\u2160':'i','\u2170':'i','\u2164':'v','\u2174':'v','\u2169':'x','\u2179':'x',
 '\u216C':'l','\u217C':'l','\u216D':'c','\u217D':'c','\u216E':'d','\u217E':'d','\u216F':'m','\u217F':'m'
};
function mapAstralAndStripInvisibles(raw){
 let out='';
 for(const ch of String(raw??'').replace(INVISIBLE_FORMAT_RE,'')){
  const cp=ch.codePointAt(0);
  if(cp>=0x1F130&&cp<=0x1F149)out+=String.fromCharCode(97+(cp-0x1F130));
  else if(cp>=0x1F150&&cp<=0x1F169)out+=String.fromCharCode(97+(cp-0x1F150));
  else if(cp>=0x1F170&&cp<=0x1F189)out+=String.fromCharCode(97+(cp-0x1F170));
  else if(cp>=0x1F1E6&&cp<=0x1F1FF)out+=String.fromCharCode(97+(cp-0x1F1E6));
  else out+=ch;
 }
 return out;
}
function canonicalizeRawText(raw){
 const decomposed=mapAstralAndStripInvisibles(raw).normalize('NFKD').replace(/[\p{Mn}\p{Me}]+/gu,'');
 let mapped='';
 for(const ch of decomposed)mapped+=CONFUSABLE_HOMOGLYPHS[ch]||ch;
 return mapped;
}
function hasNonAsciiLetterOrSymbol(raw){
 const s=String(raw??'');
 if(!s)return false;
 const decomposed=mapAstralAndStripInvisibles(s).normalize('NFKD').replace(/[\p{Mn}\p{Me}]+/gu,'');
 if(!/[^\x00-\x7F]/.test(decomposed))return false;
 for(const ch of decomposed){
  const cp=ch.codePointAt(0);
  if(cp<=0x7F)continue;
  if(/[\p{L}\p{Nl}\p{So}]/u.test(ch)&&cp!==0x00A9&&cp!==0x00AE)return true;
 }
 return false;
}
const fold=x=>canonicalizeRawText(x).toLowerCase()
 .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const isPixPaymentMethod=pm=>/\bpix(?!ote)\w*/.test(fold(pm));
const NON_CARD_RAIL_RE=/\b(?:boleto\w*|ted\w*|doc(?:\d+|\b)|transf\w*|slip\w*|cheque\w*|dinheiro\w*|especie\w*|saque\w*|withdrawal\w*|estorno\w*|cashback\w*|tarifa\w*|fatura\w*|pag(?:amento|to)?\s*(?:de\s*)?(?:fatura|boleto)\w*|pgto\s*(?:de\s*)?(?:fatura|boleto)\w*|deb(?:ito)?\s*automatico\w*|deb(?:ito)?auto\b|deb(?:ito)?\s+auto\b(?!\s+(?:posto|pecas|eletrica|escola|center|servico|socorro|locadora|lavagem|mecanica))|deb(?:ito)?\s*(?:direto|em\s*conta)\w*|auto(?:matic)?\s*deb(?:it|ito)\w*|direct\s*debit\w*|qr\s*code\w*)\b/;
const isNonCardPaymentMethod=pm=>hasNonAsciiLetterOrSymbol(pm)||isPixPaymentMethod(pm)||NON_CARD_RAIL_RE.test(fold(pm));
const tokens=x=>[...new Set(fold(x).split(' ').filter(w=>w.length>=3&&w.length<=28))].slice(0,32);
const FULL_INTERMEDIARY_TOKENS=new Set([
 'mercadopago','mercpago','mercpag','mercadopag','mercadolivre','meli',
 'pagseguro','pagseg','pagbank','pagbanks','stone','stonepagamentos','cielo','paypal','picpay',
 'getnet','redecard','sumup','pagarme','infinitepay','ebanx','adyen',
 'asaas','iugu','vindi','zoop','shipay','bcash','moip','wirecard',
 'cloudwalk','ifood','aiqfome','rappi','ubereats','uber','99food','99pay',
 'mpago','amedigital','recargapay','paghiper','pagbrasil','pagueveloz',
 'nuvempay','cornershop','pix','qrcode',
 'pags','pgs','paygo','safrapay','efipay','gerencianet','c6pay','itaupay','bempaggo','magalupay',
 'sipag','stelo','redepagamentos','redepagamento','stripe','dlocal','payu','cpfreceiver','unverifiedreceiver'
]);
const BIGRAM_INTERMEDIARY_PAIRS=new Set([
 'mercado|pago','merc|pago','mercado|pag','mercado|livre',
 'pag|seguro','pag|seg','pag|bank',
 'pay|pal','pic|pay','get|net','rede|card','rede|pagamentos','rede|pagamento','sum|up',
 'pagar|me','infinite|pay','cloud|walk',
 'i|food','aiq|fome','uber|eats','99|food','99|pay',
 'ame|digital','recarga|pay','pag|hiper','pag|brasil',
 'pague|veloz','nuvem|pay','qr|code',
 'm|pago','pay|go','safra|pay','efi|pay','c6|pay','itau|pay',
 'd|local','pay|u','cpf|receiver','unverified|receiver'
]);
const ABBREV_INTERMEDIARY_TOKENS=new Set(['mp','pag','ton','pg']);
const CONTEXTUAL_INTERMEDIARY_TOKENS=new Set(['vero','bin','cora','pp','ml','qr']);
const ALWAYS_BLOCKED_SHORT_PROCESSORS=new Set(['mp','pg','ton','vero','bin','pp','ml','qr']);
const GLUED_INTERMEDIARY_PREFIXES=[
 'mp','pag','ton','pg','pgs','rede','pix',
 'mercadopag','mercpag','pagbanks','sipag','stelo','vero','bin','cora','pp','ml','qr',
 'aiqfome','stripe','dlocal','payu'
];
const ALL_INTERMEDIARY_BASES=[...new Set([
 ...FULL_INTERMEDIARY_TOKENS,
 ...ABBREV_INTERMEDIARY_TOKENS,
 ...CONTEXTUAL_INTERMEDIARY_TOKENS,
 'rede'
])].filter(t=>!['cpfreceiver','unverifiedreceiver'].includes(t))
   .sort((a,b)=>b.length-a.length);
const FULL_INTERMEDIARY_SORTED=[...FULL_INTERMEDIARY_TOKENS]
 .filter(t=>!['cpfreceiver','unverifiedreceiver'].includes(t))
 .sort((a,b)=>b.length-a.length);
const UNAMBIGUOUS_OPEN_PREFIXES=new Set([
 ...FULL_INTERMEDIARY_TOKENS,
 'mp','pag','ton','pg','pgs','pp','ml','qr','pix','vero','bin','cora','rede'
]);
const UNAMBIGUOUS_OPEN_SUFFIXES=new Set([
 ...[...FULL_INTERMEDIARY_TOKENS].filter(t=>!['stone','uber'].includes(t)),
 'mp','pag','pg','pgs','pags','pp','ml','qr','pix'
]);
const LONG_UNAMBIGUOUS_PSP_INFIXES=new Set(
 FULL_INTERMEDIARY_SORTED.filter(t=>t.length>=5&&t!=='stone')
);
const BR_ALL_UFS='ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to';
const SAFE_OPEN_MP_UF_SUFFIX_RE=new RegExp(`^(?:(?:mp|pg|pgs|pag|pix|qr|pp|ml)(?:${BR_ALL_UFS})|(?:${FULL_INTERMEDIARY_SORTED.join('|')})(?:${BR_ALL_UFS}))$`);
const POS_CONTROL_WORDS=[
 'ec','pos','pdv','tef','caixa','cx','filial','fl','lj','loja','aut','term',
 'terminal','balcao','totem','quiosque','venda','vendas','cob','cobranca',
 'gtw','gateway','checkout','chk','sub','ag','agencia','box','maq','maquina',
 'maquineta','ponto','pto','centro','unid','unidade','matriz','banca','stand','estande'
];
const POS_CONTROL_TOKENS=new Set(POS_CONTROL_WORDS);
const POS_CONTROL_LEFT_RE=new RegExp(`^(?:${POS_CONTROL_WORDS.join('|')})\\d*$`);
const POS_WRAP_LEFT=`(?:${POS_CONTROL_WORDS.join('|')}|app|link|web|net|qr|pix|br|\\d+)`;
const POS_WRAP_BASE=ALL_INTERMEDIARY_BASES.join('|');
const POS_WRAP_RIGHT=`(?:br|${BR_ALL_UFS}|sul|app|link|pay|pos|pdv|tef|ec|qr|pix|net|web|online|x|\\d+)`;
const POS_WRAPPED_INTERMEDIARY_RE=new RegExp(`^(?:${POS_WRAP_LEFT}+(${POS_WRAP_BASE})${POS_WRAP_RIGHT}*|(${POS_WRAP_BASE})${POS_WRAP_RIGHT}+)$`);
const UNAMBIGUOUS_WRAPPED_SUFFIX_RE=new RegExp(`^(?:${POS_WRAP_BASE})(?:${POS_WRAP_RIGHT}+|\\d+[a-z0-9]*|(?:${BR_ALL_UFS})\\d+[a-z0-9]*)$`);
const TRAILING_DIGITS_RE=/^([a-z0-9]*[a-z])\d+$/;
const LEADING_DIGITS_RE=/^\d+([a-z]+)$/;
const ALNUM_POS_RE=/^(?:\d+)?([a-z]+)\d+[a-z0-9]*$/;
const ALNUM_DIGIT_LEAD_POS_RE=/^(\d+[a-z]+)\d+[a-z0-9]*$/;
const ALNUM_PREFIX_POS_RE=new RegExp(`^(?:\\d*[a-z]+\\d+)+([a-z]+?)(?:br|x|${BR_ALL_UFS})?(?:\\d+[a-z0-9]*)?$`);
const DIGIT_BEARING_INTERMEDIARY_RE=/^(?:[a-z0-9]*?(99pay|99food|c6pay)(?:br|x|[0-9][a-z0-9]*)?)$/;
const SUFFIXED_INTERMEDIARY_RE=new RegExp(`^(?:${POS_WRAP_BASE})(?:br|x|pay|pos|qr|pix|net|ec|tef|pdv|app|link|online|web|${BR_ALL_UFS})$`);
const SAFE_PORTUGUESE_PREFIX_WORDS=/^(?:pag(?:amento|amentos|to|tos|ue|uei|uemos|ou|bem|ar|arem|ava|avam|ando|aria|asse|a|o|as|os|am|ina|inas|inar|ode|odes|odinho|ao|aos|ador|adora|adores|adoras|avel|aveis)|pgto|pgtos|ton(?:elada|eladas|el|eis|in|inho|inha|ico|ica|icos|icas|to|ta|tos|tas|s|al|ais|alidade)|uber(?:landia|aba|landense)|pix(?:ote|otes|inguinha|el|els|elad[oa]s?)|cora(?:cao|coes|lina|lino|l|is|gem|nte|ntes|do|da|dos|das)|rede(?:s|iro|ira|ntor|ntora|ncao)?|vero(?:nica|nesa|nese|na|ssimil)?|bin(?:ario|aria|arios|arias|oculo|oculos|go|gos)|stone(?:henge)?|meli(?:ssa|ndre|ndroso|ndrosa|fero|fera|or|ores))$/;
const COMMON_MERCHANT_STEMS=[
 'padaria','panificadora','supermercado','mercado','mercadinho','mercearia',
 'drogaria','farmacia','posto','autoposto','auto','bar','restaurante','lanchonete',
 'central','sul','norte','brasil','nacional','popular','express','extra',
 'ipiranga','raia','panvel','pao','acucar','alimentos','saude','vida',
 'estrada','avenida','joao','sao','paulo','maria','ltda','eireli','me','epp',
 'drogasil','carrefour','assai','atacadao','guanabara','zaffari','angeloni',
 'bistek','condor','muffato','savegnago','coop','dia','big','walmart','sams',
 'makro','tenda','roldao','ultrafarma','pacheco','araujo','venancio','nissei',
 'catarinense','shell','petrobras','ale','texaco','esso','loja','lojas',
 'magazine','shopping','centro','comercio','comercial','distribuidora',
 'conveniencia','emporio','hortifruti','sacolao','acougue','peixaria',
 'sorveteria','cafeteria','cafe','pizzaria','churrascaria','hamburgueria',
 'doceria','confeitaria','banca','quiosque','boteco'
];
const STOPWORD_MERCHANT_TOKENS=new Set(['de','do','da','dos','das','em','no','na','nos','nas','ao','aos','com','por','pra','pro','sem','via','the']);
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
 return canonicalizeRawText(raw)
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
 return ABBREV_INTERMEDIARY_TOKENS.has(base)||FULL_INTERMEDIARY_TOKENS.has(base)||
  CONTEXTUAL_INTERMEDIARY_TOKENS.has(base)||base==='rede';
}
function isNumberedIntermediaryToken(tok,currSpan=null,idx=1,spans=null,merchantTokens=null){
 if(/^\d{1,4}ml$/.test(tok)){
  const hasPunctSep=Boolean(currSpan&&(NON_SPACE_SEP.test(currSpan.sepBefore)||NON_SPACE_SEP.test(currSpan.sepAfter)));
  const prevTok=Array.isArray(spans)&&idx>0?spans[idx-1]?.token:null;
  const precededByControlOrDigit=Boolean(prevTok&&(BANK_TX_VERB_TOKENS.has(prevTok)||STATEMENT_CHANNEL_TOKENS.has(prevTok)||POS_CONTROL_TOKENS.has(prevTok)||/^\d+$/.test(prevTok)));
  const declaredInMerchant=!Array.isArray(merchantTokens)||merchantTokens.includes(tok);
  const legitimateMetric=idx>0&&!hasPunctSep&&!precededByControlOrDigit&&declaredInMerchant;
  return !legitimateMetric;
 }
 const safeWhole=SAFE_PORTUGUESE_PREFIX_WORDS.test(tok);
 const posWrapMatch=!safeWhole?POS_WRAPPED_INTERMEDIARY_RE.exec(tok):null;
 const posWrapSafeSuffix=Boolean(posWrapMatch&&posWrapMatch[1]&&
  SAFE_PORTUGUESE_PREFIX_WORDS.test(tok.slice(tok.lastIndexOf(posWrapMatch[1]))));
 if(!safeWhole&&(SUFFIXED_INTERMEDIARY_RE.test(tok)||(posWrapMatch&&!posWrapSafeSuffix)))return true;
 if(DIGIT_BEARING_INTERMEDIARY_RE.test(tok))return true;
 const trailing=TRAILING_DIGITS_RE.exec(tok);
 if(trailing&&isIntermediaryBase(trailing[1]))return true;
 const leading=LEADING_DIGITS_RE.exec(tok);
 if(leading&&isIntermediaryBase(leading[1]))return true;
 const alnum=ALNUM_POS_RE.exec(tok);
 if(alnum&&isIntermediaryBase(alnum[1]))return true;
 const digitLeadAlnum=ALNUM_DIGIT_LEAD_POS_RE.exec(tok);
 if(digitLeadAlnum&&isIntermediaryBase(digitLeadAlnum[1]))return true;
 const afterDigits=tok.replace(/^(?:\d*[a-z]+\d+)+/,'');
 const prefixAlnum=ALNUM_PREFIX_POS_RE.exec(tok);
 if(prefixAlnum&&!SAFE_PORTUGUESE_PREFIX_WORDS.test(afterDigits)&&isIntermediaryBase(prefixAlnum[1]))return true;
 return false;
}
function hasTokenPairInTokens(tokensList,a,b){
 if(!Array.isArray(tokensList))return false;
 for(let j=0;j+1<tokensList.length;j++){
  if(tokensList[j]===a&&tokensList[j+1]===b)return true;
 }
 return false;
}
function matchTruncatedMerchantAt(descSpans,start,merchantTokens,k,minLastLen){
 if(start+k>descSpans.length)return false;
 for(let j=0;j<k-1;j++){
  if(descSpans[start+j].token!==merchantTokens[j])return false;
 }
 const lastSpanTok=descSpans[start+k-1].token;
 const targetTok=merchantTokens[k-1];
 if(lastSpanTok===targetTok)return true;
 return lastSpanTok.length>=minLastLen&&targetTok.startsWith(lastSpanTok);
}
function isInsideMerchantPrefixOrSubsequence(spans,i,merchantTokens){
 if(!Array.isArray(merchantTokens)||!merchantTokens.length)return false;
 for(let k=merchantTokens.length;k>=2;k--){
  for(let start=0;start<=spans.length-k;start++){
   if(i<start||i>=start+k)continue;
   if(matchTruncatedMerchantAt(spans,start,merchantTokens,k,2))return true;
  }
 }
 if(merchantTokens.length===1){
  const minSingleLen=Math.min(4,merchantTokens[0].length);
  for(let start=0;start<spans.length;start++){
   if(i===start&&matchTruncatedMerchantAt(spans,start,merchantTokens,1,minSingleLen))return true;
  }
 }
 return false;
}
function hasSplitIntermediaryWindow(spans,i,merchantTokens=null,inDescriptorResidual=false){
 if(spans[i]?.token==='cora'&&isLegitCoraPhrase(spans,i,merchantTokens,inDescriptorResidual))return false;
 if(spans[i]?.token==='pag'&&isPagMenosPhrase(spans,i,merchantTokens,inDescriptorResidual))return false;
 const maxW=Math.min(24,spans.length-i);
 for(let w=2;w<=maxW;w++){
  let joined='';
  let hasShortFragment=false;
  let blockedBySlashOrMetric=false;
  for(let k=0;k<w;k++){
   const sp=spans[i+k];
   if(k>0&&/\//.test(spans[i+k-1].sepAfter)){blockedBySlashOrMetric=true;break;}
   if(/^\d{1,4}ml$/.test(sp.token)&&!isNumberedIntermediaryToken(sp.token,sp,i+k,spans,merchantTokens)){
    blockedBySlashOrMetric=true;break;
   }
   if(sp.token.length<=3)hasShortFragment=true;
   joined+=sp.token;
  }
  if(blockedBySlashOrMetric)break;
  const directSplit=FULL_INTERMEDIARY_TOKENS.has(joined)||ALWAYS_BLOCKED_SHORT_PROCESSORS.has(joined)||
   joined==='pag'||joined==='cora'||joined==='rede';
  const wrappedSplit=hasShortFragment&&!SAFE_PORTUGUESE_PREFIX_WORDS.test(joined)&&!/^\d{1,4}ml$/.test(joined)&&
   isNumberedIntermediaryToken(joined,spans[i],i,spans,merchantTokens);
  if(!directSplit&&!wrappedSplit)continue;
  if(joined==='pag'){
   if(!inDescriptorResidual&&spans[i+w]?.token==='menos'&&hasTokenPairInTokens(merchantTokens,'pag','menos'))continue;
   return true;
  }
  if(joined==='cora'){
   if(!inDescriptorResidual&&((i>0&&['dona','tia','santa'].includes(spans[i-1]?.token))||spans[i+w]?.token==='coralina'))continue;
   return true;
  }
  return true;
 }
 return false;
}
const LEGIT_REDE_DE_CHAIN_NOUNS=/^(?:postos?|farmacias?|drogarias?|supermercados?|mercados?|lojas?|hoteis|restaurantes?|clinicas?|laboratorios?)$/;
function isRedeProcessorAt(spans,i,{inDescriptorResidual=false,merchantTokens=null}={}){
 const curr=spans[i];
 if(curr.token!=='rede')return false;
 if(inDescriptorResidual)return true;
 if(Array.isArray(merchantTokens)&&
  (!hasTokenPairInTokens(merchantTokens,'rede','de')||!isInsideMerchantPrefixOrSubsequence(spans,i,merchantTokens))){
  return true;
 }
 const next=spans[i+1],afterNext=spans[i+2];
 const validAfterNext=afterNext&&!/^pagamentos?$/.test(afterNext.token)&&
  (Array.isArray(merchantTokens)?true:LEGIT_REDE_DE_CHAIN_NOUNS.test(afterNext.token));
 const isLegitRedeDe=Boolean(
  next&&next.token==='de'&&/^\s+$/.test(curr.sepAfter)&&
  !NON_SPACE_SEP.test(curr.sepBefore)&&
  !NON_SPACE_SEP.test(next.sepAfter)&&
  validAfterNext
 );
 return !isLegitRedeDe;
}
function isPagMenosPhrase(spans,i,merchantTokens=null,inDescriptorResidual=false){
 if(inDescriptorResidual)return false;
 const curr=spans[i],next=spans[i+1];
 if(!curr||curr.token!=='pag'||!next||next.token!=='menos')return false;
 if(!/^[\s-]+$/.test(curr.sepAfter))return false;
 if(NON_SPACE_SEP.test(curr.sepBefore))return false;
 if(i+2<spans.length&&!/^\s+(?:-\s+)?$/.test(next.sepAfter))return false;
 if(Array.isArray(merchantTokens)){
  return hasTokenPairInTokens(merchantTokens,'pag','menos')&&
   isInsideMerchantPrefixOrSubsequence(spans,i,merchantTokens);
 }
 if(i===0)return true;
 const prev=spans[i-1].token;
 return !BANK_TX_VERB_TOKENS.has(prev)&&!STATEMENT_CHANNEL_TOKENS.has(prev)&&!/^\d+$/.test(prev);
}
function isLegitCoraPhrase(spans,i,merchantTokens=null,inDescriptorResidual=false){
 if(inDescriptorResidual)return false;
 const curr=spans[i];
 if(!curr||curr.token!=='cora')return false;
 if(NON_SPACE_SEP.test(curr.sepBefore)||!/^(?:$|\s+(?:-\s+)?$)/.test(curr.sepAfter))return false;
 const prevTok=spans[i-1]?.token,nextTok=spans[i+1]?.token;
 const hasCoraContext=(i>0&&['dona','tia','santa'].includes(prevTok))||nextTok==='coralina';
 if(!hasCoraContext)return false;
 if(Array.isArray(merchantTokens)){
  return merchantTokens.includes('cora')&&isInsideMerchantPrefixOrSubsequence(spans,i,merchantTokens);
 }
 return true;
}
function scanIntermediarySpans(spans,{inDescriptorResidual=false,merchantTokens=null}={}){
 for(let i=0;i<spans.length;i++){
  const curr=spans[i],tok=curr.token;
  if(FULL_INTERMEDIARY_TOKENS.has(tok)||isNumberedIntermediaryToken(tok,curr,i,spans,merchantTokens))return true;
  if(i+1<spans.length&&BIGRAM_INTERMEDIARY_PAIRS.has(tok+'|'+spans[i+1].token))return true;
  if(hasSplitIntermediaryWindow(spans,i,merchantTokens,inDescriptorResidual))return true;
  if(isRedeProcessorAt(spans,i,{inDescriptorResidual,merchantTokens}))return true;
  if(ALWAYS_BLOCKED_SHORT_PROCESSORS.has(tok))return true;
  if(tok==='cora'&&!isLegitCoraPhrase(spans,i,merchantTokens,inDescriptorResidual))return true;
  if(tok==='pag'&&!isPagMenosPhrase(spans,i,merchantTokens,inDescriptorResidual))return true;
 }
 return false;
}
function hasIntermediarySignal(raw){
 return hasDescriptorIntermediarySignal(raw,[]);
}
function isSingleLeadingMerchantIdentifiable(tok){
 if(!tok||tok.length<3)return false;
 if(STOPWORD_MERCHANT_TOKENS.has(tok))return false;
 if(ABBREV_INTERMEDIARY_TOKENS.has(tok)||FULL_INTERMEDIARY_TOKENS.has(tok)||
  CONTEXTUAL_INTERMEDIARY_TOKENS.has(tok)||tok==='rede')return false;
 return true;
}
function extractResidualOutsideMerchant(descSpans,merchantTokens){
 if(!merchantTokens.length)return null;
 if(descSpans.length>=merchantTokens.length){
  const residual=[];
  let matchedAny=false;
  const minLastLen=merchantTokens.length>=2?2:4;
  for(let i=0;i<descSpans.length;){
   if(matchTruncatedMerchantAt(descSpans,i,merchantTokens,merchantTokens.length,minLastLen)){
    matchedAny=true;
    i+=merchantTokens.length;
   }else{
    residual.push(descSpans[i]);
    i++;
   }
  }
  if(matchedAny)return residual;
 }
 const maxK=Math.min(descSpans.length,merchantTokens.length-1);
 for(let k=maxK;k>=1;k--){
  if(k===1&&!isSingleLeadingMerchantIdentifiable(merchantTokens[0]))continue;
  const minLastLen=k>=2?2:4;
  for(let start=0;start<=descSpans.length-k;start++){
   if(matchTruncatedMerchantAt(descSpans,start,merchantTokens,k,minLastLen)){
    return descSpans.slice(0,start).concat(descSpans.slice(start+k));
   }
  }
 }
 if(merchantTokens.length===1&&isSingleLeadingMerchantIdentifiable(merchantTokens[0])){
  const minSingleLen=Math.min(4,merchantTokens[0].length);
  for(let start=0;start<descSpans.length;start++){
   if(matchTruncatedMerchantAt(descSpans,start,merchantTokens,1,minSingleLen)){
    return descSpans.slice(0,start).concat(descSpans.slice(start+1));
   }
  }
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
function isKnownIntermediaryTokenOrGlued(p,span,idx,spans,merchantTokens){
 return GLUED_INTERMEDIARY_PREFIXES.includes(p)||
  ABBREV_INTERMEDIARY_TOKENS.has(p)||
  FULL_INTERMEDIARY_TOKENS.has(p)||
  isNumberedIntermediaryToken(p,span,idx,spans,merchantTokens);
}
const UF_OR_DIGITS_RE=new RegExp(`^(?:br|${BR_ALL_UFS}|\\d+)$`);
const ALPHA_WORD_RE=/^[a-z]+$/;
const ALPHA_WORD_OR_NUM_TAIL_RE=/^[a-z]{3,}(?:\d+[a-z]*)?$/;
const STEM_ALPHA_DIGITS_RE=/^[a-z]{3,}\d+$/;
function hasDescriptorIntermediarySignal(raw,merchantTokens){
 if(hasNonAsciiLetterOrSymbol(raw))return true;
 const norm=normalizeForIntermediaryScan(raw);
 if(!norm)return false;
 if(norm.includes('*'))return true;
 const spans=tokenizeWithSeparators(norm);
 const mTokens=Array.isArray(merchantTokens)?merchantTokens:[];
 const mTokensOrNull=mTokens.length?mTokens:null;
 if(scanIntermediarySpans(spans,{merchantTokens:mTokensOrNull}))return true;
 const merchantSet=new Set(mTokens);
 const joinedMerchant=mTokens.join('');
 const joinedMerchantNoStop=mTokens.filter(t=>!STOPWORD_MERCHANT_TOKENS.has(t)).join('');
 for(let idx=0;idx<spans.length;idx++){
  const rawTok=spans[idx].token;
  const candTokens=/^\d+[a-z]{4,}$/.test(rawTok)?[rawTok,rawTok.replace(/^\d+/,'')]:[rawTok];
  const inMerchantSet=merchantSet.has(rawTok);
  for(const tok of candTokens){
   if(tok.length<3||BANK_TX_VERB_TOKENS.has(tok)||STATEMENT_CHANNEL_TOKENS.has(tok)||
      /^\d+$/.test(tok)||SAFE_PORTUGUESE_PREFIX_WORDS.test(tok))continue;
   const otherMerch=mTokens.filter(m=>m!==rawTok&&m!==tok&&m.length>=2);
   for(let pLen=2;pLen<tok.length;pLen++){
    const prefix=tok.slice(0,pLen),rest=tok.slice(pLen);
    if(!isKnownIntermediaryTokenOrGlued(prefix,spans[idx],idx,spans,mTokensOrNull))continue;
    if(rest.length>=3&&ALPHA_WORD_OR_NUM_TAIL_RE.test(rest)&&(UNAMBIGUOUS_OPEN_PREFIXES.has(prefix)||
       (!SAFE_PORTUGUESE_PREFIX_WORDS.test(prefix)&&(SUFFIXED_INTERMEDIARY_RE.test(prefix)||
        POS_WRAPPED_INTERMEDIARY_RE.test(prefix)||isNumberedIntermediaryToken(prefix,spans[idx],idx,spans,mTokensOrNull)))))return true;
    if(!inMerchantSet){
     if(rest.length>=1&&mTokens.some(m=>m.startsWith(rest)||rest.startsWith(m)))return true;
     if(rest.length>=3&&((joinedMerchant&&joinedMerchant.includes(rest))||
        (joinedMerchantNoStop&&(joinedMerchantNoStop.includes(rest)||rest.startsWith(joinedMerchantNoStop)))))return true;
    }
    if(rest.length>=3&&COMMON_MERCHANT_STEMS.some(s=>rest.startsWith(s)||s.startsWith(rest)))return true;
   }
   for(let sLen=2;sLen<=tok.length-2;sLen++){
    const stem=tok.slice(0,tok.length-sLen),suffix=tok.slice(tok.length-sLen);
    if(!isKnownIntermediaryTokenOrGlued(suffix,spans[idx],idx,spans,mTokensOrNull))continue;
    const validGluedStem=(stem.length>=3&&ALPHA_WORD_RE.test(stem)&&stem!=='whatsa'&&stem!=='supera')||STEM_ALPHA_DIGITS_RE.test(stem);
    if(validGluedStem&&!SAFE_PORTUGUESE_PREFIX_WORDS.test(suffix)&&
       (UNAMBIGUOUS_OPEN_SUFFIXES.has(suffix)||UNAMBIGUOUS_WRAPPED_SUFFIX_RE.test(suffix)||
        ((stem.length>=4||STEM_ALPHA_DIGITS_RE.test(stem)||FULL_INTERMEDIARY_TOKENS.has(suffix.slice(0,-2)))&&SAFE_OPEN_MP_UF_SUFFIX_RE.test(suffix))))return true;
    if(!inMerchantSet){
     if((stem.length>=3&&mTokens.some(m=>m.startsWith(stem)||stem.startsWith(m)))||
        (stem.length>=2&&mTokens.includes(stem))||
        (stem.length>=3&&((joinedMerchant&&joinedMerchant.includes(stem))||
          (joinedMerchantNoStop&&joinedMerchantNoStop.includes(stem)))))return true;
    }
    if(stem.length>=3&&COMMON_MERCHANT_STEMS.some(s=>stem.startsWith(s)||s.startsWith(stem)))return true;
    if(otherMerch.some(m=>stem.length>=3&&(m.startsWith(stem)||stem.startsWith(m))))return true;
   }
   for(let pos=2;pos<=tok.length-4;pos++){
    const left=tok.slice(0,pos);
    const leftPosControl=POS_CONTROL_LEFT_RE.test(left);
    const leftAlphaStrong=pos>=4&&ALPHA_WORD_RE.test(left);
    const leftAlpha3=pos>=3&&ALPHA_WORD_RE.test(left);
    const leftKnown=otherMerch.some(m=>m.startsWith(left)||left.startsWith(m))||
     COMMON_MERCHANT_STEMS.some(s=>left.startsWith(s));
    if(!leftPosControl&&!leftAlphaStrong&&!leftAlpha3&&!leftKnown)continue;
    for(let midLen=2;midLen<=tok.length-pos-2;midLen++){
     const mid=tok.slice(pos,pos+midLen),right=tok.slice(pos+midLen);
     if(!isKnownIntermediaryTokenOrGlued(mid,spans[idx],idx,spans,mTokensOrNull))continue;
     if(SAFE_PORTUGUESE_PREFIX_WORDS.test(mid+right))continue;
     if(leftPosControl&&(UNAMBIGUOUS_OPEN_PREFIXES.has(mid)||FULL_INTERMEDIARY_TOKENS.has(mid))&&/^[a-z0-9]{2,}$/.test(right))return true;
     if(leftAlpha3&&LONG_UNAMBIGUOUS_PSP_INFIXES.has(mid)&&/^[a-z0-9]{2,}$/.test(right))return true;
     if(leftAlphaStrong&&UNAMBIGUOUS_OPEN_SUFFIXES.has(mid)&&UF_OR_DIGITS_RE.test(right))return true;
     if(leftKnown&&(otherMerch.some(m=>m.startsWith(right)||right.startsWith(m))||
        COMMON_MERCHANT_STEMS.some(s=>right.startsWith(s))||
        UF_OR_DIGITS_RE.test(right)))return true;
    }
   }
  }
 }
 if(!mTokens.length)return false;
 const residual=extractResidualOutsideMerchant(spans,mTokens);
 if(!residual)return false;
 return scanIntermediarySpans(residual,{inDescriptorResidual:true,merchantTokens:mTokens});
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
 const merchant=fold(evidence?.merchantName||(evidence?.receiverCnpj?evidence?.receiverName:null));
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
 if(evidence.transactionType&&evidence.transactionType!=='DEBIT')
  return result('review','NON_DEBIT_TRANSACTION_TYPE');
 const nature=String(transaction.nature||'auto').toLowerCase();
 if(['income','transfer','ignore'].includes(nature))return result('protected','NON_EXPENSE_NATURE');
 if(transaction.manualOverride===true||transaction.splitCount>0||transaction.linkedManualId||
   transaction.confirmedDecision===true)return result('protected','HUMAN_OR_SPLIT_PROTECTION');
 if(evidence.status&&evidence.status!=='POSTED')return result('review','EVIDENCE_STATUS_CONFLICT');
 const operation=fold(evidence.operationType).replace(/ /g,'_');
 if(/^(pagamento_fatura|estorno|cashback|transferencia_mesma_instituicao)$/.test(operation))
  return result('protected','TRANSFER_REFUND_OR_CARD_PAYMENT');
 if((isPixPaymentMethod(evidence.paymentMethod)||isPixPaymentMethod(evidence.operationType))&&
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
 const merchantTokens=tokenizeWithSeparators(normalizeForIntermediaryScan(evidence.merchantName||'')).map(s=>s.token);
 const allowedCardOp=!evidence.operationType||['card purchase','card payment','purchase'].includes(fold(evidence.operationType));
 const intermediaryFree=
  allowedCardOp&&
  !isNonCardPaymentMethod(evidence.paymentMethod)&&
  !isNonCardPaymentMethod(evidence.operationType)&&
  !isNonCardPaymentMethod(evidence.providerCategory)&&
  !isNonCardPaymentMethod(transaction.description||'')&&
  !isNonCardPaymentMethod(evidence.description||'')&&
  !isNonCardPaymentMethod(evidence.descriptionRaw||'')&&
  !hasIntermediarySignal(evidence.paymentMethod||'')&&
  !hasIntermediarySignal(evidence.operationType||'')&&
  !hasIntermediarySignal(evidence.providerCategory||'')&&
  !hasDescriptorIntermediarySignal(evidence.merchantName||'',merchantTokens)&&
  !hasDescriptorIntermediarySignal(evidence.merchantBusinessName||'',merchantTokens)&&
  !hasDescriptorIntermediarySignal(evidence.receiverName||'',merchantTokens)&&
  !hasDescriptorIntermediarySignal(transaction.description||'',merchantTokens)&&
  !hasDescriptorIntermediarySignal(evidence.description||'',merchantTokens)&&
  !hasDescriptorIntermediarySignal(evidence.descriptionRaw||'',merchantTokens);
 const hasExternalPair=!!mcc&&!!external&&targetKey(mcc)===targetKey(external)&&intermediaryFree;
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
 const descSpans=tokenizeWithSeparators(normalizeForIntermediaryScan(transaction.description||''));
 const narrowMcc=['5411','5541','5912'].includes(String(evidence.mcc||''));
 const directCommerce=narrowMcc&&mcc&&!external&&
  evidence.transactionType==='DEBIT'&&
  ['CARD_PURCHASE','CARD PAYMENT','CARD_PAYMENT','PURCHASE'].includes(
   String(evidence.operationType||'').trim().toUpperCase())&&
  typeof evidence.merchantCnpj==='string'&&/^\d{14}$/.test(evidence.merchantCnpj)&&
  directName.length>=8&&
  intermediaryFree&&
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
