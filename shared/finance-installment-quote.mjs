// Shared, deterministic installment quote. Uses the SAME rounding and
// calendar-month rules as electron/planning.cjs simulatePurchase(), but
// deliberately does not read or estimate account balances or settle purchases.
const MAX=100_000_000_000;
const ISO=/^\d{4}-\d{2}-\d{2}$/;
function date(value){
  if(typeof value!=='string'||!ISO.test(value))throw new Error('Data inválida.');
  const [year,month,day]=value.split('-').map(Number);
  if(year<2000||year>2100||
     new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)!==value)
    throw new Error('Data inválida.');
  return value;
}
function addDay(value,days){
  const [y,m,d]=value.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);
}
function nextMonth(value,number){
  const [year,month,day]=value.split('-').map(Number);
  const first=new Date(Date.UTC(year,month-1+number,1));
  const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return first.getUTCFullYear()+'-'+String(first.getUTCMonth()+1).padStart(2,'0')+'-'+
    String(Math.min(day,last)).padStart(2,'0');
}
export function installmentQuote({today,amount,installments=1,monthlyRate=0,firstDueDate=null}={}){
  date(today);
  if(!Number.isSafeInteger(amount)||amount<=0||amount>MAX)
    throw new Error('Valor da compra inválido.');
  if(!Number.isSafeInteger(installments)||installments<1||installments>60)
    throw new Error('Escolha entre 1 e 60 parcelas.');
  if(typeof monthlyRate!=='number'||!Number.isFinite(monthlyRate)||monthlyRate<0||monthlyRate>30)
    throw new Error('Taxa mensal inválida.');
  const due=date(firstDueDate||(installments===1?today:nextMonth(today,1)));
  if(due<today||due>addDay(today,365))
    throw new Error('Primeiro vencimento fora do período permitido.');
  const rate=monthlyRate/100;
  const monthly=rate===0?Math.floor(amount/installments):
    Math.round(amount*rate/(1-Math.pow(1+rate,-installments)));
  if(monthly<1)throw new Error('Valor insuficiente para distribuição das parcelas.');
  const schedule=Array.from({length:installments},(_,index)=>({
    date:nextMonth(due,index),
    amount:rate===0?monthly+(index<amount%installments?1:0):monthly
  }));
  for(const entry of schedule)date(entry.date);
  const total=schedule.reduce((sum,row)=>sum+row.amount,0);
  if(!Number.isSafeInteger(total)||total>MAX)throw new Error('Valor total excede o limite.');
  return {ok:true,stage:'installments_only',engine:'desktop_formula_v1',
    principal:amount,installments,monthlyRate,monthly,total,interest:total-amount,
    firstDueDate:due,schedule,
    balanceVerified:false,projectionVerified:false,financialSyncEnabled:false,
    cloudCutoverAllowed:false,
    note:'Somente cálculo de parcelas. Não representa limite disponível ou capacidade de pagamento; nenhuma compra foi criada.'};
}
