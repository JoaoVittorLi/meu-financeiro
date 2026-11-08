'use strict';
// Protected PWA reads the same AI policy as the Electron app.
// No OpenAI OAuth, no inference, no credentials in the browser.
let pwaAICapabilities=null,pwaAICurrent='today',pwaAIPending=null,pwaAILoading=false,pwaAIContextPreview=null,pwaAIFinancialPreview=null;
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
    root.append(aiText('p','Motor de contexto compartilhado · até '+(caps.contextLimits?.maxMemories||0)+' memórias aprovadas por análise no Windows. No PWA, memórias e inferência permanecem desativadas.','finance-muted'));

    root.append(aiText('h4','Entrega 4.1 · Contexto financeiro fictício'));
    root.append(aiText('p','Teste os mesmos cálculos do Windows sem consultar contas nem usar o GPT.','finance-muted'));
    const actions=aiText('div','','finance-ai-financial-actions');
    for(const option of [{source:'bank',label:'Banco fictício'},{source:'manual',label:'Lançamentos manuais fictícios'}]){
      const button=aiText('button',option.label,'finance-secondary');
      button.type='button';
      button.addEventListener('click',async()=>{
        const status=document.getElementById('financeAiStatus');
        pwaAIFinancialPreview=null;
        if(status)status.textContent='Preparando resumo fictício sem executar IA...';
        try{
          const data=await pwaGet('/api/ai/financial-context-demo?source='+encodeURIComponent(option.source));
          if(data?.stage!=='synthetic_financial_context_preview'||data.source!==option.source||
             data.onlyFictitiousFinancialData!==true||data.realFinancialDataIncluded!==false||
             data.bankDataIncluded!==false||data.inferenceCalled!==false||
             data.cloudCutoverAllowed!==false||data.financialSyncEnabled!==false)
            throw new Error('Prévia não verificada.');
          pwaAIFinancialPreview=data;
          if(status)status.textContent='Resumo fictício preparado. Nenhum token consumido.';
        }catch{
          if(status)status.textContent='Resumo fictício indisponível. Nenhuma IA foi acionada.';
        }
        aiRenderPWA();
      });
      actions.append(button);
    }
    root.append(actions);
    if(pwaAIFinancialPreview){
      const report=pwaAIFinancialPreview;
      const format=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
      const panel=aiText('div','','finance-ai-context-preview');
      panel.append(aiText('strong','Prévia fictícia — '+(report.source==='bank'?'Banco':'Manual')));
      panel.append(aiText('p','Receitas: '+format(report.realized.incomeCents)+
        ' · Despesas: '+format(report.realized.expenseCents)+
        ' · Diferença: '+format(report.realized.netCents)+' (não é saldo).','finance-muted'));
      panel.append(aiText('p','Compromissos futuros: '+format(report.future.pendingConfirmedExpensesCents)+
        ' · Receita futura incerta: '+format(report.future.futureUncertainIncomeCents)+
        ' (não contabilizada).','finance-muted'));
      for(const line of report.warnings||[])panel.append(aiText('p',line,'finance-muted'));
      const more=aiText('details');
      more.append(aiText('summary','Mostrar contexto detalhado, não enviado'));
      more.append(aiText('pre',report.contextText));
      panel.append(more);
      root.append(panel);
    }

  }else if(pwaAICurrent==='chat'){
    root.append(aiText('h4','Perguntas de demonstração'));
    root.append(aiText('p','Selecione um teste para ver a pergunta fictícia que o desktop pode executar. Não há envio ao GPT por esta página.','finance-muted'));
    const list=aiText('div','','finance-ai-cases');
    for(const item of caps.demoCases||[]){
      const button=aiText('button',item.label,'finance-secondary');
      button.type='button';button.addEventListener('click',async()=>{
        pwaAIPending=item.id;
        pwaAIContextPreview=null;
        const status=document.getElementById('financeAiStatus');
        if(status)status.textContent='Preparando o contexto fictício sem utilizar IA...';
        try{
          const preview=await pwaGet('/api/ai/demo-preview?caseId='+encodeURIComponent(item.id));
          if(preview?.model!=='gpt-6.1-sol'||preview.bankDataIncluded!==false||
             preview.memoryCount!==0||preview.onlyFictitiousFinancialData!==true)throw new Error('Contrato inválido.');
          if(pwaAIPending!==item.id)return;
          pwaAIContextPreview=preview;
          if(status)status.textContent='Prévia do contexto preparada sem chamadas ao GPT.';
        }catch{
          if(status)status.textContent='Prévia indisponível. Nenhuma chamada de IA foi executada.';
        }
        aiRenderPWA();
      });
      list.append(button);
    }
    root.append(list);
    if(pwaAIContextPreview){
      const preview=aiText('div','','finance-ai-context-preview');
      preview.append(aiText('strong','Contexto fictício — prévia, não enviado'));
      preview.append(aiText('p',pwaAIContextPreview.question,'finance-muted'));
      preview.append(aiText('small','Caracteres: '+pwaAIContextPreview.inputCharacters+
        ' · Estimativa aproximada de entrada: '+pwaAIContextPreview.estimatedInputTokensApprox+
        ' tokens · Banco: não incluído · Memórias: 0'));
      root.append(preview);
    }
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
