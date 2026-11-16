/* QA-84 B05: pure financial projection. No database access, no grant creation.
 * Inputs are explicit trusted/verified snapshots; the current IC-READ endpoint
 * does NOT supply this composite and the renderer MUST NOT infer it from netCents. */
function mfB05Money(cents) {
 return Number.isSafeInteger(cents)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100):'—';
}
function mfB05IsoDate(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const date=new Date(value+'T12:00:00Z');
 // Date.parse normalizes impossible days (e.g. Feb 30) rather than rejecting.
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:null;
}
function mfB05SafeCents(value) {
 return Number.isSafeInteger(value)&&value>=0?value:null;
}
function mfB05Unavailable(reason) {
 return {available:false,reason,timeline:[],ending:null,commitments:[],reserveSuggestionCents:null,
  availableBalanceCents:null,bufferCents:null,sourceId:null,asOf:null,period:null};
}
function mfB05VerifiedNumber(value) {
 return value&&value.coverage==='verified'&&mfB05SafeCents(value.value)!==null?value.value:null;
}
function mfB05Events(value,asOf,end,label) {
 if(!value||value.coverage!=='verified')return {error:label+' sem cobertura verificada.'};
 const v=value.value;
 if(mfB05SafeCents(v)===0)return {events:[]};
 if(!Array.isArray(v))return {error:label+' precisa de registros datados e verificáveis.'};
 const out=[],seen=new Map();
 for(const e of v) {
  if(!e||typeof e.id!=='string'||!e.id||!mfB05IsoDate(e.due)||mfB05SafeCents(e.amountCents)===null)
   return {error:label+' contém registro inválido.'};
  const key=e.id,signature=e.due+'|'+e.amountCents;
  if(seen.has(key)){if(seen.get(key)!==signature)return {error:label+' contém IDs conflitantes.'};continue;}
  seen.set(key,signature);
  if(e.due>asOf&&e.due<=end)out.push({id:key,due:e.due,amountCents:e.amountCents});
 }
 return {events:out};
}
function mfB05Project(input) {
 if(!input||input.coverage!=='verified'||!mfB05IsoDate(input.asOf)||
   !mfB05IsoDate(input.period?.from)||!mfB05IsoDate(input.period?.to)||
   input.period.from>input.asOf||input.period.to<input.asOf)
  return mfB05Unavailable('Fonte, período ou cobertura da projeção não verificados.');
 const baseline=mfB05VerifiedNumber(input.availableBalance);
 if(baseline===null)return mfB05Unavailable('Saldo disponível verificado não fornecido pelo serviço atual.');
 const commitments=input.unpaidFutureCommitments;
 if(!commitments||commitments.coverage!=='verified'||!Array.isArray(commitments.value))
  return mfB05Unavailable('Agenda de compromissos futuros sem cobertura verificável.');
 const seen=new Map(),future=[];
 for(const c of commitments.value) {
  if(!c||typeof c.id!=='string'||!c.id||!mfB05IsoDate(c.due)||
    mfB05SafeCents(c.amountCents)===null)
   return mfB05Unavailable('Compromisso futuro inválido ou sem identificador.');
  if(!['scheduled_unpaid','posted','paid','cancelled'].includes(c.status))
   return mfB05Unavailable('Status de compromisso não verificável para projeção.');
  const signature=c.due+'|'+c.amountCents+'|'+c.status;
  if(seen.has(c.id)){if(seen.get(c.id)!==signature)return mfB05Unavailable('Compromissos com IDs conflitantes.');continue;}
  seen.set(c.id,signature);
  if(c.status==='scheduled_unpaid'&&c.due>input.asOf&&c.due<=input.period.to)
   future.push({id:c.id,due:c.due,amountCents:c.amountCents,description:String(c.description||'Compromisso previsto')});
 }
 const inc=mfB05Events(input.expectedIncome,input.asOf,input.period.to,'Receita futura');
 if(inc.error)return mfB05Unavailable(inc.error);
 const other=mfB05Events(input.plannedOtherOutflow,input.asOf,input.period.to,'Outras saídas');
 if(other.error)return mfB05Unavailable(other.error);
 const dates=[...new Set([input.asOf,input.period.to,
   ...future.map(x=>x.due),...inc.events.map(x=>x.due),...other.events.map(x=>x.due)])].sort();
 const buffer=mfB05SafeCents(input.safetyBufferCents);
 const timeline=[];
 for(const date of dates) {
  const due=future.filter(x=>x.due<=date);
  const sum=list=>list.reduce((total,item)=>total+item.amountCents,0);
  const consideredCents=sum(due),incomeCents=sum(inc.events.filter(x=>x.due<=date)),
   otherCents=sum(other.events.filter(x=>x.due<=date));
  const projectedCents=baseline+incomeCents-consideredCents-otherCents;
  if(!Number.isSafeInteger(projectedCents))return mfB05Unavailable('Cálculo excede a faixa monetária segura.');
  const headroomCents=buffer===null?null:projectedCents-buffer;
  const protectedCents=buffer===null?null:Math.min(buffer,Math.max(0,projectedCents));
  const freeCents=headroomCents===null?null:Math.max(0,headroomCents);
  const simpleReconciled=buffer!==null&&inc.events.length===0&&other.events.length===0&&
    projectedCents>=buffer&&consideredCents+buffer+freeCents===baseline;
  timeline.push({date,consideredCents,incomeCents,otherCents,projectedCents,
   protectedCents,headroomCents,freeCents,commitmentIds:due.map(x=>x.id),
   canRenderSegments:simpleReconciled,isFutureProjection:date>input.asOf});
 }
 const ending=timeline[timeline.length-1];
 return {available:true,reason:null,sourceId:String(input.availableBalance.sourceId||''),
  asOf:input.asOf,period:input.period,availableBalanceCents:baseline,
  bufferCents:buffer,commitments:future,timeline,ending,
  reserveSuggestionCents:ending&&ending.canRenderSegments?Math.floor(ending.freeCents/2):null};
}
function mfB05Budget(spentCents,limitCents) {
 if(mfB05SafeCents(spentCents)===null||mfB05SafeCents(limitCents)===null)return null;
 return {spentCents,limitCents,excessCents:Math.max(0,spentCents-limitCents),
  usagePercent:limitCents===0?null:spentCents*100/limitCents,
  remainingCents:Math.max(0,limitCents-spentCents)};
}
function mfB05Comparison(previousCents,currentCents,equalPeriods) {
 if(equalPeriods!==true||mfB05SafeCents(previousCents)===null||
   mfB05SafeCents(currentCents)===null)return null;
 return {previousCents,currentCents,deltaCents:currentCents-previousCents,
  percent:previousCents===0?null:(currentCents-previousCents)*100/previousCents};
}
