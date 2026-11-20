// Shared, side-effect-free AI policy. Imported by Electron and Cloudflare Worker.
import {AI_CONTEXT_LIMITS} from './ai-context.mjs';
// The same task contract is used by both clients; no tokens or bank data live here.
export const AI_MODEL = 'gpt-6.2-sol';
export const AI_EFFORTS = Object.freeze(['low', 'medium', 'high']);
export const AI_REJECTED_EFFORTS = Object.freeze(['none', 'minimal', 'xhigh']);
export const AI_INFERENCE_STATES = Object.freeze({
  CONFIGURED: 'CONFIGURADO',
  MOCK_TESTED: 'TESTADO_COM_MOCK',
  LIVE_VERIFIED: 'INFERÊNCIA_REAL_VERIFICADA'
});
export const AI_TABS = Object.freeze([
  {id:'today',label:'Hoje'}, {id:'chat',label:'Conversar'}, {id:'actions',label:'Plano de ação'}
]);
export const AI_TASKS = Object.freeze({
  categorize: {effort:'low',maxInputCharacters:650,description:'Classificação com regras locais antes da IA'},
  explain: {effort:'low',maxInputCharacters:1200,description:'Explicação de totais já calculados'},
  investigate: {effort:'medium',maxInputCharacters:2000,description:'Investigação financeira determinística'},
  budget: {effort:'medium',maxInputCharacters:2200,description:'Limites inteligentes com cenários'},
  salary_budget: {effort:'medium',maxInputCharacters:2400,description:'Personalização de orçamento pelo salário'},
  planning: {effort:'medium',maxInputCharacters:3000,description:'Projeções e compromissos'},
  investments: {effort:'medium',maxInputCharacters:5500,description:'Pesquisa de ativos com fontes verificadas'}
});
export const AI_DEMO_CASES = Object.freeze([
  {
    id:'budget',
    label:'Limite inteligente (dados fictícios)',
    task:'budget',
    question:'Com renda hipotética de R$ 3.000, despesas essenciais de R$ 2.100 e reserva de R$ 200, explique uma estratégia prudente para distribuir R$ 700 sem assumir nenhuma compra real.',
  },
  {
    id:'categorize',
    label:'Categorização (dados fictícios)',
    task:'categorize',
    question:'Classifique uma despesa fictícia de R$ 29,90 com descrição "PIZZARIA EXEMPLO", explique brevemente e informe quando a categoria precisa de revisão.',
  },
  {
    id:'planning',
    label:'Planejamento (dados fictícios)',
    task:'planning',
    question:'Com saldo fictício R$ 1.500, compromisso fictício de R$ 950 em cinco dias e receita incerta de R$ 700, explique por que não devemos considerar a receita incerta como dinheiro disponível.',
  }
]);
export const AI_CORE_INSTRUCTIONS = [
  'Você é o assistente educacional do Meu Financeiro. Responda em português brasileiro de forma objetiva.',
  'Esta fase é APENAS um teste com valores e casos totalmente fictícios. Não peça nem utilize dados bancários reais.',
  'Não invente valores de investimentos, cotações, saldos, rendimentos ou garantias de retorno.',
  'Diferencie dados confirmados de previsões e hipóteses. Preserve liquidez e considere dívidas antes de investir.',
  'Explique premissas e incertezas, usando cálculos simples e verificáveis.',
  'Não execute ações financeiras, não solicite credenciais e não afirme ter alterado dados.'
].join('\n');
export function getDemoCase(caseId){
  const item=AI_DEMO_CASES.find(x=>x.id===caseId);
  if(!item)throw new Error('Exemplo de teste não permitido.');
  return item;
}
export function selectEffort(task,override='auto'){
  if(!Object.hasOwn(AI_TASKS,task))throw new Error('Tipo de tarefa não reconhecido.');
  if(override==='auto')return AI_TASKS[task].effort;
  if(AI_REJECTED_EFFORTS.includes(override))throw new Error('Esforço de raciocínio não permitido no GPT-6.2 Sol.');
  if(!AI_EFFORTS.includes(override))throw new Error('Raciocínio não permitido.');
  return override;
}
export function selectAdaptiveEffort({
  task='explain',
  ambiguity=false,
  categoryCount=1,
  hasRuleConflict=false,
  chainedActions=false,
  multiCategory=false,
  override='auto'
}={}){
  if(override!=='auto')return selectEffort(task,override);
  if(hasRuleConflict||ambiguity||chainedActions||multiCategory||categoryCount>=3)return 'high';
  if(categoryCount===2||['budget','salary_budget','planning','investments','investigate'].includes(task))return 'medium';
  return 'low';
}
export function buildDemoRequest(caseId,override='auto'){
  const item=getDemoCase(caseId);
  const effort=selectEffort(item.task,override);
  if(item.question.length>AI_TASKS[item.task].maxInputCharacters)throw new Error('Exemplo maior que o orçamento permitido.');
  return Object.freeze({
    model:AI_MODEL,
    reasoning:{effort},
    instructions:AI_CORE_INSTRUCTIONS,
    input:[{role:'user',content:item.question}],
    store:false,
    stream:true
  });
}
export function publicCapabilities(){
  return {
    version:4,model:AI_MODEL,efforts:[...AI_EFFORTS],tabs:AI_TABS.map(x=>({...x})),
    contextLimits:AI_CONTEXT_LIMITS,memoryLocalOnly:true,localUsageMetrics:true,
    demoCases:AI_DEMO_CASES.map(({id,label,task})=>({id,label,task})),
    status:'desktop_oauth_required',
    inferenceStatus:AI_INFERENCE_STATES.CONFIGURED,
    pwaInferenceEnabled:false,
    financialDataEnabled:false,
    paidApiFallback:false,
    dataSource:'demonstration_only'
  };
}
