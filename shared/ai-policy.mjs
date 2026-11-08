// Shared, side-effect-free AI policy. Imported by Electron and Cloudflare Worker.
// The same task contract is used by both clients; no tokens or bank data live here.
export const AI_MODEL = 'gpt-6.1-sol';
export const AI_EFFORTS = Object.freeze(['low','medium']);
export const AI_TABS = Object.freeze([
  {id:'today',label:'Hoje'}, {id:'chat',label:'Conversar'}, {id:'actions',label:'Plano de ação'}
]);
export const AI_TASKS = Object.freeze({
  categorize: {effort:'low',maxInputCharacters:650,description:'Classificação com regras locais antes da IA'},
  explain: {effort:'low',maxInputCharacters:1200,description:'Explicação de totais já calculados'},
  budget: {effort:'medium',maxInputCharacters:2200,description:'Limites inteligentes com cenários'},
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
  if(!AI_EFFORTS.includes(override))throw new Error('Raciocínio não permitido.');
  return override;
}
export function buildDemoRequest(caseId,override='auto'){
  const item=getDemoCase(caseId);
  const effort=selectEffort(item.task,override);
  if(item.question.length>AI_TASKS[item.task].maxInputCharacters)throw new Error('Exemplo maior que o orçamento permitido.');
  return Object.freeze({
    model:AI_MODEL,
    reasoning:{mode:'standard',effort},
    instructions:AI_CORE_INSTRUCTIONS,
    input:[{role:'user',content:item.question}],
    store:false,
    stream:true
  });
}
export function publicCapabilities(){
  return {
    version:2,model:AI_MODEL,efforts:[...AI_EFFORTS],tabs:AI_TABS.map(x=>({...x})),
    demoCases:AI_DEMO_CASES.map(({id,label,task})=>({id,label,task})),
    status:'desktop_oauth_required',
    pwaInferenceEnabled:false,
    financialDataEnabled:false,
    paidApiFallback:false,
    dataSource:'demonstration_only'
  };
}
