// E4.1 — shared, deterministic, *synthetic only* context for the AI preview.
// Reuses the established period engine: NO new accounting rules and NO SQL.
// Do not pass real bank, Pluggy or local SQLite records through this preview.
import {aggregateFinancePeriod,budgetProgress} from './finance-period-ledger.mjs';

const START='2026-11-01',END='2026-11-30';
const BANK_EXAMPLE=Object.freeze([
  {date:'2026-11-05',status:'POSTED',amountCents:300000,category:'Salário'},
  {date:'2026-11-06',status:'POSTED',amountCents:-110000,category:'Moradia'},
  {date:'2026-11-07',status:'POSTED',amountCents:-60000,category:'Alimentação'},
  {date:'2026-11-07',status:'POSTED',amountCents:-15000,category:'Transporte'},
  {date:'2026-11-08',status:'POSTED',amountCents:-40000,nature:'transfer',category:'Transferências'},
  {date:'2026-11-09',status:'PENDING',amountCents:-12000,category:'Compras'}
]);
const MANUAL_EXAMPLE=Object.freeze([
  {date:'2026-11-05',kind:'income',amountCents:270000,category:'Salário'},
  {date:'2026-11-06',kind:'expense',amountCents:110000,category:'Moradia'},
  {date:'2026-11-07',kind:'expense',amountCents:40000,category:'Alimentação'}
]);
const BUDGET_EXAMPLE=Object.freeze([
  {category:'Moradia',amountCents:100000},
  {category:'Alimentação',amountCents:50000},
  {category:'Transporte',amountCents:30000}
]);
const PLANNED_EXAMPLE=Object.freeze([
  {dueDate:'2026-11-17',kind:'expense',amountCents:95000,certainty:'confirmed',status:'planned'},
  {dueDate:'2026-11-19',kind:'income',amountCents:28000,certainty:'confirmed',status:'planned'},
  {dueDate:'2026-11-20',kind:'income',amountCents:70000,certainty:'estimated',status:'planned'},
  {dueDate:'2026-11-21',kind:'expense',amountCents:25000,certainty:'confirmed',status:'cancelled'},
  {dueDate:'2026-11-22',kind:'expense',amountCents:20000,certainty:'confirmed',status:'settled'}
]);
const fmt=n=>'R$ '+(n/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
function planTotals(rows,start,end){
  const totals={
    pendingConfirmedExpensesCents:0,
    pendingEstimatedExpensesCents:0,
    futureConfirmedIncomeCents:0,
    futureUncertainIncomeCents:0,
    includedPending:0,
    excludedSettledOrCancelled:0
  };
  for(const item of rows){
    if(item.dueDate<start||item.dueDate>end)continue;
    if(item.status!=='planned'){totals.excludedSettledOrCancelled++;continue;}
    if(!Number.isSafeInteger(item.amountCents)||item.amountCents<=0)
      throw new Error('Compromisso fictício inválido.');
    totals.includedPending++;
    if(item.kind==='expense'){
      if(item.certainty==='confirmed')totals.pendingConfirmedExpensesCents+=item.amountCents;
      else totals.pendingEstimatedExpensesCents+=item.amountCents;
    }else if(item.kind==='income'){
      if(item.certainty==='confirmed')totals.futureConfirmedIncomeCents+=item.amountCents;
      else totals.futureUncertainIncomeCents+=item.amountCents;
    }else throw new Error('Natureza do compromisso inválida.');
  }
  return totals;
}
// Only known demo sources are accepted. This intentionally has NO parameter
// for external financial records or IDs until the cloud migration is certified.
export function buildSyntheticFinancialContext(source='bank'){
  if(source!=='bank'&&source!=='manual')throw new Error('Selecione uma fonte fictícia separada.');
  const rows=source==='bank'?BANK_EXAMPLE:MANUAL_EXAMPLE;
  const period=aggregateFinancePeriod(rows,{start:START,end:END,source});
  const budgets=budgetProgress(BUDGET_EXAMPLE,period.expenses);
  const planned=planTotals(PLANNED_EXAMPLE,START,END);
  const exceeded=budgets.filter(x=>x.pct!==null&&x.pct>100);
  const warnings=[
    'DEMONSTRAÇÃO: os valores não vêm das suas contas.',
    'Banco e lançamentos manuais não são somados; selecione uma fonte por vez.',
    'Saldo inicial, saldo bancário e cobertura histórica não foram verificados.',
    'Nenhum valor de receita futura deve ser tratado como dinheiro já disponível.'
  ];
  if(exceeded.length)warnings.push('Existem categorias fictícias acima do limite configurado.');
  if(planned.futureUncertainIncomeCents>0)warnings.push('Receita futura incerta excluída da disponibilidade.');
  const expenseCategories=period.expenses.map(x=>({name:x.name,amountCents:x.amountCents}));
  const incomeCategories=period.incomes.map(x=>({name:x.name,amountCents:x.amountCents}));
  const lines=[
    'PRÉVIA FICTÍCIA; NÃO É UMA CONSULTA DAS FINANÇAS DO USUÁRIO.',
    'Fonte isolada: '+(source==='bank'?'transações bancárias simuladas':'lançamentos manuais simulados')+'.',
    'Período: '+START+' até '+END+'.',
    'Receitas já lançadas: '+fmt(period.incomeCents)+'.',
    'Despesas já lançadas: '+fmt(period.expenseCents)+'.',
    'Diferença de entradas e saídas: '+fmt(period.netCents)+' (NÃO é saldo disponível).',
    'Transações consideradas: '+period.transactionsIncluded+'; ignoradas: '+period.excluded+'.',
    'Categorias de despesas: '+(expenseCategories.map(x=>x.name+' '+fmt(x.amountCents)).join('; ')||'nenhuma')+'.',
    'Orçamentos acima de 100%: '+(exceeded.map(x=>x.category).join(', ')||'nenhum')+'.',
    'Compromissos futuros confirmados a pagar: '+fmt(planned.pendingConfirmedExpensesCents)+'.',
    'Receitas futuras incertas: '+fmt(planned.futureUncertainIncomeCents)+' (NÃO somadas ao realizado).',
    'Sem saldo confirmado, cobertura histórica ou projeção certificada; não inferir quanto posso gastar.'
  ];
  return {
    version:1,stage:'synthetic_financial_context_preview',source,
    period:{start:START,end:END},engine:'shared/finance-period-ledger.mjs',
    onlyFictitiousFinancialData:true,realFinancialDataIncluded:false,
    rawTransactionsIncluded:false,bankDataIncluded:false,
    previewOnly:true,inferenceCalled:false,changesApplied:false,
    financialSyncEnabled:false,cloudCutoverAllowed:false,
    balanceVerified:false,historicalCompletenessVerified:false,forecastVerified:false,
    realized:{
      incomeCents:period.incomeCents,expenseCents:period.expenseCents,
      netCents:period.netCents,transactionsIncluded:period.transactionsIncluded,
      excluded:period.excluded,unclassifiedCents:period.unclassifiedCents,
      categoryCoverageComplete:period.categoryCoverageComplete,
      expenseCategories,incomeCategories
    },
    budgets:budgets.map(x=>({category:x.category,limitCents:x.limitCents,spentCents:x.spentCents,pct:x.pct})),
    future:{...planned},warnings,contextText:lines.join('\n'),
    estimatedInputTokensApprox:Math.ceil(lines.join('\n').length/4)
  };
}
