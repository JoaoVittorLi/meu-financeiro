'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Missing production method: '+start);return source.slice(a,b)}
const helper=part('function simInputsEqual(a:Sim','type BankConfig =');
const js=ts.transpileModule(helper,{compilerOptions:{target:ts.ScriptTarget.ES2019}}).outputText;
const simInputsEqual=new Function(js+';return simInputsEqual;')();
const methods=part(' setSimulation(patch:Partial<Sim>)',' field(label:string,el:any');
const planMethods=part(' canPlanSimulatedPurchase(out:any',' async changePlanStatus(id:string');
const renderComparison=part(' renderSimulationComparison(){',' renderResult(out:any)');
function fixture({invoke,local=false,confirmPlan=true}={}){
 const confirmations=[],messages=[];
 const calls=[],out=(input,amount)=>({principal:amount,monthly:Math.round(amount/Number(input.installments)),
   total:Math.round(amount/Number(input.installments))*Number(input.installments),
   installments:Number(input.installments),firstDueDate:input.firstDueDate,engine:'planning',interest:0});
 const desktop=local?null:{planSimulate:async args=>{
   calls.push(args);
   return invoke?await invoke(args):out({installments:String(args.installments),firstDueDate:args.firstDueDate},args.amount);
 }};
 const parseMoney=x=>Math.round(Number(String(x).replace(/\./g,'').replace(',','.'))*100);
 const u3SimulationCost=result=>result&&!result.error&&
   [result.principal,result.monthly,result.total].every(Number.isSafeInteger)?
     {principal:result.principal,monthly:result.monthly,total:result.total,
       interest:result.total-result.principal,daily:result.engine==='planning',minimum:null}:null;
 const compiled=ts.transpileModule('class Subject{'+methods+planMethods+renderComparison+'}',{
   compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
 const h=(tag,props,...children)=>({tag,props:props||{},children});
 const Subject=new Function('desktop','simulate','parseMoney','u3SimulationCost','simInputsEqual',
    'h','fmt','bankReferenceLabel','iso','nowYM','shiftMonth','freshPlanForm','moneyString','confirm',
    compiled+';return Subject;')(
      desktop,(_d,input)=>out(input,parseMoney(input.value)),parseMoney,u3SimulationCost,simInputsEqual,
      h,c=>(c/100).toFixed(2),x=>String(x||''),
      ()=> '2026-11-11','2026-11',(month,offset)=>{
        const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+offset,1);
        return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      },
      (_kind,dueDate)=>({title:'',amount:'',dueDate,kind:'expense',category:'Outros',mode:'once',count:'1'}),
      c=>(c/100).toFixed(2).replace('.',','),
      message=>{confirmations.push(message);return confirmPlan;}
    );
 const app=new Subject();
 app.state={mode:local?'demo':'real',data:{settings:{reserve:0}},sim:{
   value:'1.200,00',installments:'6',interest:'0',firstDueDate:'2026-12-20'},
   outcome:null,simCalculatedInput:null,simResultStale:false,simError:'',
   simSaved:undefined,simBusy:false};
 app.simRequest=0;app.flash=message=>messages.push(message);
 app.refreshPlanning=async()=>{};
 app.setState=(patch,callback)=>{
  Object.assign(app.state,typeof patch==='function'?patch(app.state):patch);callback?.();
 };
 return {app,calls,confirmations,messages};
}
test('U5.2 — resultado permanece visível e marcado como desatualizado após editar valor',async()=>{
 const {app}=fixture();await app.runSim();
 const before=app.state.outcome;
 assert.equal(app.isSimulationStale(),false);
 app.setSimulation({value:'2.400,00'});
 assert.equal(app.state.outcome,before);
 assert.equal(app.isSimulationStale(),true);
 assert.equal(app.state.simBusy,false);
 assert.equal(app.state.simCalculatedInput.value,'1.200,00');
});
test('U5.2 — recalcular atualiza B, mantém referência A e preserva entradas em centavos',async()=>{
 const {app,calls}=fixture();
 await app.runSim();app.saveSimulation();
 assert.equal(app.state.simSaved.input.value,'1.200,00');
 app.setSimulation({value:'2.400,00',installments:'12'});
 app.saveSimulation();assert.equal(app.state.simSaved.input.value,'1.200,00','Stale result cannot replace A');
 await app.runSim();
 assert.equal(app.isSimulationStale(),false);
 assert.equal(app.state.outcome.principal,240000);
 assert.equal(app.state.simSaved.result.principal,120000);
 assert.deepEqual(calls.map(x=>x.amount),[120000,240000]);
});
test('U5.2 — comparação mostra B somente quando cenário calculado está atual',async()=>{
 const {app}=fixture();await app.runSim();app.saveSimulation();
 app.setSimulation({value:'2.100,00'});
 const stale=JSON.stringify(app.renderSimulationComparison());
 assert.match(stale,/recalcule as novas premissas/i);
 assert.match(stale,/—/);
 await app.runSim();
 const current=JSON.stringify(app.renderSimulationComparison());
 assert.match(current,/Comparação de dois cálculos atualizados/);
 assert.match(current,/2100\.00/);
});
test('U5.2 — erro de validação não descarta última simulação confirmada',async()=>{
 const {app}=fixture();await app.runSim();const original=app.state.outcome;
 app.setSimulation({installments:'0'});await app.runSim();
 assert.equal(app.state.outcome,original);
 assert.equal(app.isSimulationStale(),true);
 assert.match(app.state.simError,/parcelas e a taxa/);
 app.setSimulation({installments:'6',value:'0'});
 await app.runSim();
 assert.equal(app.state.outcome,original);
 assert.match(app.state.simError,/valor válido/);
});
test('U5.2 — falha de backend conserva resultado anterior e impede sucesso falso',async()=>{
 let shouldFail=false;
 const {app}=fixture({invoke:async args=>{
  if(shouldFail)throw Error('falha sintética');
  return {principal:args.amount,monthly:args.amount,total:args.amount,installments:1};
 }});
 await app.runSim();const previous=app.state.outcome;
 shouldFail=true;app.setSimulation({value:'500,00'});await app.runSim();
 assert.equal(app.state.outcome,previous);
 assert.equal(app.isSimulationStale(),true);
 assert.match(app.state.simError,/falha sintética/);
});
test('U5.2 — resposta da requisição antiga não substitui resultado novo',async()=>{
 const pending=[];
 const {app}=fixture({invoke:args=>new Promise((resolve,reject)=>pending.push({args,resolve,reject}))});
 const old=app.runSim();
 app.setSimulation({value:'2.400,00'});
 const fresh=app.runSim();
 assert.equal(pending.length,2);
 pending[1].resolve({principal:240000,monthly:20000,total:240000,installments:12});
 await fresh;
 pending[0].resolve({principal:120000,monthly:20000,total:120000,installments:6});
 await old;
 assert.equal(app.state.outcome.principal,240000);
 assert.equal(app.state.simCalculatedInput.value,'2.400,00');
 assert.equal(app.isSimulationStale(),false);
});
test('U5.2 — editar durante requisição cancela aplicação da resposta pendente',async()=>{
 let resolve;const {app}=fixture({invoke:()=>new Promise(r=>resolve=r)});
 const old=app.runSim();
 app.setSimulation({interest:'3,0'});
 assert.equal(app.state.simBusy,false);
 resolve({principal:120000,monthly:30000,total:180000});
 await old;
 assert.equal(app.state.outcome,null);
 assert.equal(app.state.simCalculatedInput,null);
});
test('U5.2 — vencimento inicial e taxa seguem parâmetros originais sem mutar motor',async()=>{
 const {app,calls}=fixture();
 app.setSimulation({firstDueDate:'2027-01-31',interest:'1,5'});
 await app.runSim();
 assert.equal(calls[0].firstDueDate,'2027-01-31');
 assert.equal(calls[0].monthlyRate,1.5);
 assert.equal(calls[0].installments,6);
 assert.equal(calls[0].amount,120000);
 assert.equal(app.state.simCalculatedInput.firstDueDate,'2027-01-31');
});
test('U5.2 — modo local mantém o mesmo contrato de preservação',async()=>{
 const {app}=fixture({local:true});
 await app.runSim();assert.equal(app.state.outcome.principal,120000);
 app.setSimulation({interest:'2'});
 assert.equal(app.state.outcome.principal,120000);
 assert.equal(app.isSimulationStale(),true);
 await app.runSim();assert.equal(app.isSimulationStale(),false);
});
test('U5.2 — interface distingue resultado antigo, erro, ação Recalcular e cenário salvo',()=>{
 const view=part(' renderAssistant(includeBanner:boolean=true)',' renderSimulationComparison()');
 assert.match(view,/Recalcular cenário/);
 assert.match(view,/u5-sim-stale/);
 assert.match(view,/Resultado anterior — desatualizado/);
 assert.match(view,/simError/);
 assert.match(view,/u3SimulationCost\(out\)&&!stale/);
 assert.match(methods,/simCalculatedInput:input/);
 assert.match(methods,/token!==this\.simRequest/);
});

test('U5.2.1 — tentativa direta com resultado stale não prepara compromisso nem mostra confirmação',async()=>{
 const {app,confirmations,messages}=fixture();
 await app.runSim();
 const original=app.state.outcome;
 app.setSimulation({value:'2.400,00'});
 assert.equal(app.isSimulationStale(),true);
 assert.equal(app.canPlanSimulatedPurchase(original),false);
 app.planSimulatedPurchase(); // bypass disabled button
 assert.equal(app.state.outcome,original,'Old result stays visible as a reference');
 assert.notEqual(app.state.planOpen,true);
 assert.deepEqual(confirmations,[]);
 assert.match(messages.join(' '),/Recalcule a simulação/);
});
test('U5.2.1 — erro de cálculo bloqueia conversão mesmo com resultado antigo preservado',async()=>{
 const {app,confirmations}=fixture();
 await app.runSim();
 app.setSimulation({installments:'0'});await app.runSim();
 assert.match(app.state.simError,/parcelas/);
 assert.equal(app.canPlanSimulatedPurchase(),false);
 app.planSimulatedPurchase();
 assert.deepEqual(confirmations,[]);
 assert.notEqual(app.state.planOpen,true);
});
test('U5.2.1 — enquanto nova requisição está pendente, não permite converter resultado antigo',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve});
 let responseCount=0;
 const {app,confirmations}=fixture({invoke:async args=>{
   if(++responseCount===2)await pending;
   return {engine:'planning',principal:args.amount,monthly:20000,total:args.amount,
     interest:0,installments:args.installments,firstDueDate:args.firstDueDate};
 }});
 await app.runSim();const previous=app.state.outcome;
 const next=app.runSim();
 assert.equal(app.state.simBusy,true);
 assert.equal(app.canPlanSimulatedPurchase(previous),false);
 app.planSimulatedPurchase();
 assert.deepEqual(confirmations,[]);
 release();await next;
 assert.equal(app.isSimulationStale(),false);
 assert.equal(app.canPlanSimulatedPurchase(),true);
});
test('U5.2.1 — premissas alteradas exigem recálculo antes da conversão válida',async()=>{
 const {app,confirmations}=fixture();
 await app.runSim();
 app.setSimulation({value:'2.400,00',installments:'12',firstDueDate:'2027-01-31'});
 assert.equal(app.canPlanSimulatedPurchase(),false);
 app.planSimulatedPurchase();
 assert.equal(confirmations.length,0);
 await app.runSim();
 assert.equal(app.isSimulationStale(),false);
 assert.equal(app.canPlanSimulatedPurchase(),true);
 const calculated=app.state.outcome;
 app.planSimulatedPurchase();
 assert.equal(confirmations.length,1);
 assert.equal(app.state.page,'planning');
 assert.equal(app.state.planOpen,true);
 assert.equal(app.state.planForm.dueDate,'2027-01-31');
 assert.equal(app.state.planForm.count,'12');
 assert.equal(app.state.planForm.mode,'installments');
 assert.equal(app.state.planForm.amount,(calculated.total/100).toFixed(2).replace('.',','));
 assert.equal(app.state.planForm.notes.includes('Simulação:'),true);
 assert.equal(app.state.outcome,null);
});
test('U5.2.1 — confirmação recusada mantém resultado e não abre planejamento',async()=>{
 const {app,confirmations}=fixture({confirmPlan:false});
 await app.runSim();
 const before=app.state.outcome;
 app.planSimulatedPurchase();
 assert.equal(confirmations.length,1);
 assert.equal(app.state.outcome,before);
 assert.notEqual(app.state.planOpen,true);
});
test('U5.2.1 — sem snapshot calculado correspondente não existe conversão possível',async()=>{
 const {app,confirmations}=fixture();
 await app.runSim();
 app.state.simCalculatedInput=null;
 app.state.simResultStale=false;
 assert.equal(app.canPlanSimulatedPurchase(),false);
 app.planSimulatedPurchase();
 assert.equal(confirmations.length,0);
});
test('U5.2.1 — botão de planejamento compartilha guarda com método',()=>{
 const view=part(' renderResult(out:any)',' renderBankQuick()');
 assert.match(view,/disabled:out\.installments>36\|\|!this\.canPlanSimulatedPurchase\(out\)/);
 assert.match(planMethods,/if\(!this\.canPlanSimulatedPurchase\(out\)\)/);
 assert.match(planMethods,/simInputsEqual\(this\.state\.sim,this\.state\.simCalculatedInput\)/);
});
