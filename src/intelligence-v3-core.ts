/* INT-DESIGN-02 — visual response registry + evidence gate. No financial writes.
 * All financial amounts are sourced from the existing authorized local ledger.
 * No LLM-generated HTML/numbers. Missing capability is an explicit state. */
type MfV3Kind='summary'|'kpi'|'compare'|'trend'|'bar'|'donut'|'treemap'|'sankey'|
 'rank'|'drilldown'|'table'|'recurring'|'budget'|'cashflow'|'whatif'|'scenario'|
 'goal'|'debt'|'portfolio'|'insight'|'plan'|'proposal'|'approval'|'report'|'quality'|'state';
type MfV3Density='compact'|'standard'|'analysis'|'mobile';
type MfV3Quality='ready'|'empty'|'partial'|'stale'|'denied'|'offline'|'error'|'conflict'|'expired'|'unavailable';
type MfV3Card={
 kind:MfV3Kind;period:string;source:'manual'|'bank';profile:'demo'|'real';
 coverage:'partial_local'|'unknown'|'complete_local';asOf:string|null;
 quality:MfV3Quality;reason:string;incomeCents:number;expenseCents:number;netCents:number;
 categories:MfVisualCategory[];budgets:Array<{category:string;spentCents:number;limitCents:number}>;
 previous?:{period:string;categories:MfVisualCategory[];expenseCents:number;incomeCents:number;coverage:string}|null;
 original:MfVisualSnapshot;
};
/* QA-GATE-01 P1: authorization identity is deliberately outside the serialized
 * MfV3Card. WeakMap data is memory-only: never export a grant/token with a card.
 * Rebuilt/restored cards have no binding and must remain stale. */
const MF_V3_GRANT_BINDINGS=new WeakMap<MfV3Card,{
 access:LocalFinancialAccess;token:string;signature:string
}>();
function mfV3BindGrant(card:MfV3Card|null,access:LocalFinancialAccess|null,signature:string):MfV3Card|null{
 if(card&&access?.token&&typeof signature==='string'){
  MF_V3_GRANT_BINDINGS.set(card,{access,token:access.token,signature});
 }
 return card;
}
function mfV3MatchesGrant(card:MfV3Card,access:LocalFinancialAccess|null,signature:string):boolean{
 const binding=card&&MF_V3_GRANT_BINDINGS.get(card);
 return !!binding&&binding.access===access&&binding.token===access?.token&&
  binding.signature===signature;
}
const MF_V3_KINDS=[
 ['VR-01','summary','Resumo executivo'],['VR-02','kpi','Indicador financeiro'],
 ['VR-03','compare','Antes e depois'],['VR-04','trend','Tendência temporal'],
 ['VR-05','bar','Barras comparativas'],['VR-06','donut','Distribuição de despesas'],
 ['VR-07','treemap','Treemap de despesas'],['VR-08','sankey','Fluxo de dinheiro'],
 ['VR-09','rank','Ranking de variações'],['VR-10','drilldown','Investigar despesas'],
 ['VR-11','table','Tabela de movimentações'],['VR-12','recurring','Recorrências'],
 ['VR-13','budget','Orçamento'],['VR-14','cashflow','Fluxo de caixa'],
 ['VR-15','whatif','Simulação'],['VR-16','scenario','Cenários'],
 ['VR-17','goal','Metas'],['VR-18','debt','Dívidas'],
 ['VR-19','portfolio','Patrimônio'],['VR-20','insight','Oportunidades'],
 ['VR-21','plan','Plano de ação'],['VR-22','proposal','Propostas'],
 ['VR-23','approval','Aprovações e recibos'],['VR-24','report','Relatório'],
 ['VR-25','quality','Qualidade dos dados'],['VR-26','state','Estados especiais']
];
const MF_V3_HEAT=['#ff516a','#ff7470','#fa935d','#f4b350','#f4d363'];
function mfV3Registry(){
 const approved=new Set(['treemap','sankey','rank']);
 const connected=new Set(['summary','kpi','compare','trend','bar','donut','treemap','sankey',
  'rank','drilldown','table','budget','cashflow','insight','report','quality','state']);
 return MF_V3_KINDS.map(x=>({id:x[0],kind:x[1],title:x[2],
  designStatus:approved.has(x[1])?'DESIGN_APPROVED':
   x[1]==='drilldown'?'BASELINE_ACCEPTED_FOR_BATCH':'DESIGN_SPECIFIED_BY_INHERITANCE',
  capability:connected.has(x[1])?'LOCAL_FACTS_ADAPTER':
   x[1]==='proposal'?'D01_SUPERVISED_PREVIEW':'AWAITING_BACKEND_OR_OPERATION',
  implementation:'RENDERER_IMPLEMENTED_NOT_HOMOLOGATED'}));
}
function mfV3Allowed(kind){return MF_V3_KINDS.some(x=>x[1]===kind);}
function mfV3Title(kind){const hit=MF_V3_KINDS.find(x=>x[1]===kind);return hit?hit[2]:'Resposta financeira';}
function mfV3Money(n){return Number.isSafeInteger(n)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100):'—';}
function mfV3Delta(a,b){return Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&Number.isSafeInteger(a-b)?a-b:null;}
function mfV3Pct(now,before){return Number.isSafeInteger(now)&&Number.isSafeInteger(before)&&before>0?Math.round((now-before)*1000/before)/10:null;}
function mfV3Fold(q){return String(q||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function mfV3Requested(q:string):MfV3Kind|null{
 const s=mfV3Fold(q);
 const patterns:Array<[MfV3Kind,RegExp]>=[
  ['sankey',/para onde foi (minha|a) renda|fluxo de dinheiro|sankey/],
  ['treemap',/treemap|mapa de (gastos|despesas|categorias)/],
  ['rank',/quem aumentou|ranking (de )?(aumentos|variac|despesas)|aumentos por categoria/],
  ['drilldown',/investig(ar|acao)|de onde veio (esse|essa|o) (total|valor|gasto)|detalhar categoria/],
  ['table',/tabela de (transac|moviment)|liste (as )?(transac|moviment)/],
  ['recurring',/recorrenc|assinaturas (recorrentes|que pago)|cobrancas repetidas/],
  ['budget',/orcamento|limites por categoria|meus limites/],
  ['cashflow',/fluxo de caixa|entradas e saidas do mes/],
  ['whatif',/e se (eu )?(comprar|gastar)|simular gasto/],
  ['scenario',/cenario|cenarios financeiros/],
  ['goal',/meta financeira|metas de econom/],
  ['debt',/minhas dividas|emprestimos|dividas cadastradas/],
  ['portfolio',/patrimonio|investimentos/],
  ['insight',/oportunidades de econom|economizar mais/],
  ['plan',/plano de acao|criar plano financeiro/],
  ['proposal',/minhas propostas|proposta de categoria/],
  ['approval',/recibo de (acao|alteracao)|aprovacoes/],
  ['report',/relatorio de despesas|relatorio financeiro/],
  ['quality',/qualidade dos dados|cobertura do extrato|dados faltantes/],
  ['trend',/tendencia temporal|evolucao mensal|linha de tendencia/],
  ['compare',/compare|comparar|mes anterior|antes e depois/],
  ['bar',/barras comparativas|grafico de barras/],
  ['donut',/grafico de rosca|rosca de gastos|distribuicao percentual/],
  ['kpi',/indicador isolado|quanto gastei com |total de despesas/],
  ['summary',/resumo executivo|como foi meu mes|meu mes financeiro|panorama financeiro/],
  ['state',/estado da consulta|porque nao aparece/]
 ];
 const found=patterns.find(([kind,re])=>re.test(s));return found?found[0] as MfV3Kind:null;
}
function mfV3NeedsPrevious(kind){return kind==='compare'||kind==='rank'||kind==='drilldown'||kind==='trend';}
function mfV3FromOperational(op:any,kind:MfV3Kind,prior:any):MfV3Card|null{
 if(!mfV3Allowed(kind)||!op||op.contract!=='IC-v1/I-P0.2-read-only'||op.readOnly!==true||
    op.changesApplied!==false||op.modelCalled!==false||!['ready','empty'].includes(op.uiState))return null;
 const original=mfVisualFromOperational(op,'treemap');
 if(!original)return null;
 const p=op.facts,budgets=[];
 if(Array.isArray(p.budgets)){
  for(const b of p.budgets){
   if(typeof b.category!=='string'||!b.category.trim()||
     !Number.isSafeInteger(b.spentCents)||b.spentCents<0||
     !Number.isSafeInteger(b.limitCents)||b.limitCents<0)return null;
   budgets.push({category:b.category,spentCents:b.spentCents,limitCents:b.limitCents});
  }
 }
 let prev=null;
 if(prior&&prior.contract==='IC-v1/I-P0.2-read-only'&&prior.readOnly===true&&
    prior.changesApplied===false&&prior.modelCalled===false&&
    prior.source===original.source&&prior.profile===original.profile){
  const v=mfVisualFromOperational(prior,'treemap');
  if(v&&v.period===mfVisualMonthBefore(original.period))
   prev={period:v.period,categories:v.categories,expenseCents:v.expenseCents,
     incomeCents:v.incomeCents,coverage:v.coverage};
 }
 const sourcePartial=original.coverage==='partial_local';
 const sankeyNotRepresentable=kind==='sankey'&&(original.incomeCents===0||original.netCents<0);
 const blockedPrev=mfV3NeedsPrevious(kind)&&(!prev||prev.coverage==='partial_local'||sourcePartial);
 const unsupported=['recurring','goal','debt','portfolio','approval','whatif','scenario'].includes(kind);
 const quality:MfV3Quality=unsupported?'unavailable':blockedPrev||sourcePartial||sankeyNotRepresentable?'partial':
   original.expenseCents===0&&original.incomeCents===0?'empty':'ready';
 const reason=sankeyNotRepresentable?'Receita ausente ou resultado negativo: não há fluxo de receitas que represente estes gastos sem criar dinheiro fictício. Consulte a tabela.':
  unsupported?'Os serviços locais ainda não fornecem fatos verificáveis para esta família. Nenhuma operação foi executada.':
  blockedPrev?'Comparação indisponível: a fonte e a cobertura dos dois meses não foram verificadas.':
  sourcePartial?'Histórico parcial: valores limitados aos registros locais carregados.':
  original.coverage==='unknown'?'Totais reconciliados dos registros locais; cobertura integral não certificada.':
   'Totais reconciliados dos registros autorizados neste período.';
 return {kind,period:original.period,source:original.source,profile:original.profile,
   coverage:original.coverage,asOf:typeof op.asOf==='string'?op.asOf:null,quality,reason,
   incomeCents:original.incomeCents,expenseCents:original.expenseCents,netCents:original.netCents,
   categories:original.categories,budgets,previous:prev,
   original:kind==='sankey'?mfVisualFromOperational(op,'sankey'):original};
}
type MfV3CompareRow={
 name:string;before:number;now:number;delta:number|null;relative:number|null
};
function mfV3CompareRows(v:MfV3Card|null):MfV3CompareRow[]{
 if(!v||!v.previous)return[];
 // Explicit tuple/map types retain the verified category names as strings.
 // Inference through an untyped Map used to turn Set keys into unknown.
 const base=new Map<string,number>(v.previous.categories.map(
  (c:MfVisualCategory):[string,number]=>[c.name,c.amountCents]));
 const current=new Map<string,number>(v.categories.map(
  (c:MfVisualCategory):[string,number]=>[c.name,c.amountCents]));
 const names=new Set<string>([...base.keys(),...current.keys()]);
 return [...names].map((name:string):MfV3CompareRow=>{
  const before=base.get(name)??0,now=current.get(name)??0,delta=mfV3Delta(now,before);
  return {name,before,now,delta,relative:mfV3Pct(now,before)};
 }).sort((a,b)=>{
  // Unknown/unsafe deltas belong last, never silently converted to R$0.
  if(a.delta===null)return b.delta===null?a.name.localeCompare(b.name,'pt-BR'):1;
  if(b.delta===null)return -1;
  return b.delta-a.delta||a.name.localeCompare(b.name,'pt-BR');
 });
}
function mfV3Heat(rows:MfV3CompareRow[]){
 const positive=rows.filter(x=>x.delta!==null&&x.delta>0).sort(
  (a,b)=>(b.delta??0)-(a.delta??0)||a.name.localeCompare(b.name,'pt-BR'));
 const unique=[...new Set<number>(positive.map(x=>x.delta as number))];
 return rows.map(r=>({...r,heat:r.delta===null||r.delta<=0?null:
  MF_V3_HEAT[Math.min(4,unique.indexOf(r.delta))]}));
}
function mfV3Records(v){
 const records=[];
 for(const c of v.categories)for(const m of c.movements)
  records.push({category:c.name,id:m.id,date:m.date,description:m.description,amountCents:m.amountCents});
 return records;
}
function mfV3RecordsPartial(v){return v.categories.some(c=>c.detailsPartial);}
function mfV3Schema(){return {schemaVersion:'1',kinds:mfV3Registry().map(x=>x.kind),maxPrimary:1,maxSupplementary:2,
 densities:['compact','standard','analysis','mobile'],source:'authorized local deterministic read'};}
