'use strict';
// Protected PWA reads the same AI policy as the Electron app.
// No OpenAI OAuth, no inference, no credentials in the browser.
let pwaAICapabilities=null,pwaAICurrent='today',pwaAIPending=null,pwaAILoading=false;
function aiText(tag,value,cls){
  const node=document.createElement(tag);node.textContent=String(value);
  if(cls)node.className=cls;
  return node;
}
function aiRenderPWA(){
  const root=document.getElementById('financeAiContent');
  if(!root)return;
  root.replaceChildren();
  const caps=pwaAICapabilities;
  if(!caps){root.append(aiText('p','Conecte-se ao Preview protegido para consultar as capacidades compartilhadas.','finance-muted'));return;}
  for(const btn of document.querySelectorAll('[data-ai-tab]'))
    btn.setAttribute('aria-selected',btn.dataset.aiTab===pwaAICurrent?'true':'false');
  if(pwaAICurrent==='today'){
    root.append(aiText('h4','Hoje: recomendações sem consumir tokens'));
    root.append(aiText('p','Neste estágio, alertas de orçamento e projeção continuam sendo produzidos pelo motor determinístico. A IA só será acionada mediante solicitação explícita em uma integração autorizada.','finance-muted'));
    root.append(aiText('p','Modelo fixo: '+caps.model+' · baixo/médio · fallback pago desativado.','finance-muted'));
  }else if(pwaAICurrent==='chat'){
    root.append(aiText('h4','Perguntas de demonstração'));
    root.append(aiText('p','Selecione um teste para ver a pergunta fictícia que o desktop pode executar. Não há envio ao GPT por esta página.','finance-muted'));
    const list=aiText('div','','finance-ai-cases');
    for(const item of caps.demoCases||[]){
      const button=aiText('button',item.label,'finance-secondary');
      button.type='button';button.addEventListener('click',()=>{
        pwaAIPending=item.id;
        const status=document.getElementById('financeAiStatus');
        if(status)status.textContent='Caso '+item.label+' selecionado. Execute somente no Windows após autorizar sua conta ChatGPT.';
      });
      list.append(button);
    }
    root.append(list);
  }else{
    root.append(aiText('h4','Plano de ação: fase de preparação'));
    root.append(aiText('p','As sugestões futuras serão validadas, auditadas e confirmadas antes de alterar qualquer dado. Esta prévia não registra mudanças financeiras.','finance-muted'));
  }
}
async function pwaInitIntelligence(){
  if(pwaAICapabilities){aiRenderPWA();return;}
  if(pwaAILoading)return;
  pwaAILoading=true;
  const status=document.getElementById('financeAiStatus');
  try{
    // pwaGet is the existing authenticated, no-store PWA fetch helper.
    const data=await pwaGet('/api/ai/capabilities');
    if(data?.model!=='gpt-6.1-sol'||data.pwaInferenceEnabled!==false||
       data.paidApiFallback!==false||data.financialDataEnabled!==false||
       !Array.isArray(data.demoCases)||!Array.isArray(data.tabs))throw new Error('Contrato de IA inesperado.');
    pwaAICapabilities=data;
    if(status)status.textContent='Contrato de IA sincronizado · inferência disponível somente no desktop autorizado';
    aiRenderPWA();
  }catch(err){
    if(status)status.textContent='Não foi possível consultar o contrato de IA do Preview protegido.';
  }finally{pwaAILoading=false;}
}
document.querySelectorAll('[data-ai-tab]').forEach(button=>{
  button.addEventListener('click',()=>{
    if(!['today','chat','actions'].includes(button.dataset.aiTab))return;
    pwaAICurrent=button.dataset.aiTab;
    aiRenderPWA();
  });
});
