'use strict';
// One real editing contract for Windows and the PWA: revisioned personal
// overlays over the previously VERIFIED snapshot. No bank writes or settlements.
const personalEl=id=>document.getElementById(id);
const personalState={ready:false,busy:false,plans:[],budgets:[],categories:[],
  editing:null,request:null};
const personalMoney=n=>Number.isSafeInteger(n)?(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
function personalNode(tag,content,cls){
  const el=document.createElement(tag);
  if(content!==undefined)el.textContent=String(content);
  if(cls)el.className=cls;
  return el;
}
function personalRow(title,description,amount,label,onEdit){
  const item=personalNode('li',undefined,'finance-item');
  const details=personalNode('div',undefined,'finance-main-text');
  details.append(personalNode('div',title,'finance-main-label'));
  details.append(personalNode('div',description,'finance-meta'));
  const right=personalNode('div',undefined,'finance-edit-row-right');
  right.append(personalNode('strong',personalMoney(amount),'finance-amount'));
  const button=personalNode('button','Editar','finance-edit-trigger');
  button.type='button';button.setAttribute('aria-label','Editar '+label);
  button.disabled=personalState.busy;
  button.addEventListener('click',onEdit);
  right.append(button);
  item.append(details,right);
  return item;
}
function personalRenderPlans(){
  const el=personalEl('planList');
  if(!personalState.ready||!el)return;
  const today=new Date();
  const iso=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),
    String(today.getDate()).padStart(2,'0')].join('-');
  const term=personalEl('planSearch').value.trim().toLocaleLowerCase('pt-BR');
  const filter=personalEl('planFilter').value;
  const rows=personalState.plans.filter(plan=>{
    const paid=['settled','settled_manual'].includes(plan.status);
    const cancelled=plan.status==='cancelled';
    if(filter==='pending'&&(paid||cancelled))return false;
    if(filter==='paid'&&!paid)return false;
    if(filter==='cancelled'&&!cancelled)return false;
    return !term||(plan.title+' '+plan.category).toLocaleLowerCase('pt-BR').includes(term);
  }).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.title.localeCompare(b.title,'pt-BR'));
  el.replaceChildren();
  if(!rows.length)el.append(personalNode('li','Nenhum compromisso encontrado para estes filtros.','finance-muted'));
  for(const plan of rows){
    const status=plan.status==='cancelled'?'Cancelado':
      ['settled','settled_manual'].includes(plan.status)?'Pago':
      plan.dueDate<iso?'Vencido':'Pendente';
    const date=plan.dueDate.slice(8,10)+'/'+plan.dueDate.slice(5,7)+'/'+plan.dueDate.slice(0,4);
    const group=plan.totalOccurrences>1?
      ' · Ocorrência '+plan.occurrence+'/'+plan.totalOccurrences:'';
    el.append(personalRow(plan.title,date+' · '+plan.category+' · '+status+
      ' · '+(plan.certainty==='estimated'?'Estimado':'Confirmado')+group,
      plan.amountCents,plan.title,()=>personalOpen('planned_items',plan)));
  }
  personalEl('planEditStatus').textContent=rows.length+' compromisso(s) exibidos de '+
    personalState.plans.length+'. Edite campos seguros; status e valor não serão alterados.';
}
function personalRenderBudgets(){
  const el=personalEl('budgetList');
  if(!personalState.ready||!el)return;
  el.replaceChildren();
  if(!personalState.budgets.length)
    el.append(personalNode('li','Nenhum orçamento importado.','finance-muted'));
  for(const budget of personalState.budgets){
    el.append(personalRow(budget.category,'Limite mensal · versão '+budget.revision,
      budget.amountCents,'orçamento '+budget.category,()=>personalOpen('budgets',budget)));
  }
  personalEl('budgetEditStatus').textContent='Orçamentos existentes: '+
    personalState.budgets.length+'. Edite o valor em centavos com revisão de conflito.';
}
function personalField(root,name,label,kind,value,options){
  const wrapper=personalNode('label',undefined,'finance-personal-field');
  const text=personalNode('span',label);
  wrapper.append(text);
  let input;
  if(options){
    input=document.createElement('select');
    for(const item of options){
      const option=personalNode('option',item.label);
      option.value=item.value;input.append(option);
    }
    input.value=value;
  }else if(kind==='textarea'){
    input=document.createElement('textarea');
    input.rows=3;input.maxLength=600;input.value=value;
  }else{
    input=document.createElement('input');
    input.type=kind;input.value=value;
    input.autocomplete='off';
    if(name==='title')input.maxLength=140;
    if(name==='amount')input.inputMode='decimal';
  }
  input.name=name;input.id='personalEdit_'+name;input.required=kind!=='textarea';
  wrapper.setAttribute('for',input.id);
  wrapper.append(input);root.append(wrapper);
  return input;
}
function personalAmountText(n){
  if(!Number.isSafeInteger(n)||n<0)return '';
  return String(Math.floor(n/100))+','+String(n%100).padStart(2,'0');
}
function personalParseMoney(s){
  if(typeof s!=='string'||!/^([0-9]{1,9})(?:,([0-9]{1,2}))?$/.test(s.trim()))
    return null;
  const [whole,dec='']=s.trim().split(',');
  const amount=Number(whole)*100+Number(dec.padEnd(2,'0'));
  return Number.isSafeInteger(amount)&&amount<=100000000000?amount:null;
}
function personalOpen(table,item){
  if(personalState.busy)return;
  if(!item||!Number.isSafeInteger(item.revision)||item.revision<0)return;
  personalState.editing={table,id:item.id||null,category:item.category,
    revision:item.revision,original:item};
  personalState.request=null;
  const fields=personalEl('personalEditFields');
  fields.replaceChildren();
  if(table==='planned_items'){
    personalEl('personalEditTitle').textContent='Editar compromisso';
    personalEl('personalEditHint').textContent='Atualiza o mesmo compromisso que já existe no Windows. Não altera valor, status ou pagamento.';
    personalField(fields,'title','Título','text',item.title);
    personalField(fields,'notes','Observações','textarea',item.notes||'');
    // Settled/cancelled entries are label-only edits: never silently reschedule a paid occurrence.
    if(item.status==='planned'){
      personalField(fields,'due_date','Vencimento','date',item.dueDate);
      const choices=personalState.categories
        .filter(c=>['both',item.kind].includes(c.kind)||c.name===item.category)
        .map(c=>({value:c.name,label:(c.emoji||'')+' '+c.name}));
      if(!choices.some(c=>c.value===item.category))
        choices.unshift({value:item.category,label:item.category});
      personalField(fields,'category','Categoria','select',item.category,choices);
      personalField(fields,'certainty','Confiança','select',item.certainty,[
        {value:'confirmed',label:'Confirmada / esperada'},
        {value:'estimated',label:'Estimativa incerta'}
      ]);
    }
  }else if(table==='budgets'){
    personalEl('personalEditTitle').textContent='Editar orçamento: '+item.category;
    personalEl('personalEditHint').textContent='O limite ficará disponível para sincronização com o Windows. O consumo do orçamento ainda é uma prévia.';
    personalField(fields,'amount','Limite mensal (R$), use vírgula para centavos','text',
      personalAmountText(item.amountCents));
  }else return;
  personalEl('personalEditMessage').textContent='';
  personalEl('personalEditSubmit').disabled=false;
  personalEl('personalEditDialog').showModal();
}
function personalValidatePatch(edit,form){
  const values=Object.fromEntries(new FormData(form));
  if(edit.table==='budgets'){
    const amount=personalParseMoney(values.amount);
    if(amount===null)throw new Error('Informe o valor como 1500,00, sem pontos de milhar.');
    return {amount_cents:amount};
  }
  const patch={};
  if(typeof values.title!=='string'||!values.title.trim()||values.title.trim().length>140)
    throw new Error('Título inválido.');
  if(typeof values.notes!=='string'||values.notes.length>600)
    throw new Error('Observações inválidas.');
  patch.title=values.title.trim();patch.notes=values.notes;
  if(edit.original.status==='planned'){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(values.due_date)||Number.isNaN(Date.parse(values.due_date+'T00:00:00Z')))
      throw new Error('Data inválida.');
    if(!personalState.categories.some(c=>c.name===values.category)||
       !['confirmed','estimated'].includes(values.certainty))
      throw new Error('Categoria ou confiança inválida.');
    patch.due_date=values.due_date;patch.category=values.category;patch.certainty=values.certainty;
  }
  return patch;
}
function personalPatchDiff(edit,patch){
  const original=edit.original;
  const pairs=edit.table==='budgets'?{amount_cents:original.amountCents}:{
    title:original.title,notes:original.notes||'',due_date:original.dueDate,
    category:original.category,certainty:original.certainty
  };
  return Object.fromEntries(Object.entries(patch).filter(([key,value])=>pairs[key]!==value));
}
async function personalSubmit(e){
  e.preventDefault();
  if(personalState.busy||!personalState.editing)return;
  const edit=personalState.editing,dialog=personalEl('personalEditDialog');
  const msg=personalEl('personalEditMessage');
  try{
    const patch=personalPatchDiff(edit,personalValidatePatch(edit,e.currentTarget));
    if(!Object.keys(patch).length){dialog.close();return;}
    const identity=edit.table==='planned_items'?{id:edit.id}:{profile:'real',category:edit.category};
    const request=JSON.stringify({table:edit.table,identity,baseRevision:edit.revision,patch});
    if(personalState.request?.body!==request)
      personalState.request={body:request,id:crypto.randomUUID()};
    personalState.busy=true;personalEl('personalEditSubmit').disabled=true;
    msg.textContent='Salvando com revisão na Cloudflare...';
    const response=await fetch('/api/personal/apply',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json','Accept':'application/json',
        'X-MF-Personal-Edit':'optimistic-v1'},
      body:JSON.stringify({...JSON.parse(request),mutationId:personalState.request.id})
    });
    const data=response.headers.get('content-type')?.includes('application/json')?
      await response.json():null;
    if(response.status===409&&data?.conflict===true){
      msg.textContent='Conflito: o mesmo registro foi alterado em outro dispositivo. Cancele, atualize e abra novamente antes de decidir o que manter.';
      document.dispatchEvent(new Event('finance:personal-refresh-requested'));
      return;
    }
    if(!response.ok||data?.ok!==true||data.financialSyncEnabled!==false||
       data.revision!==edit.revision+1)
      throw new Error('A edição não foi confirmada pelo servidor.');
    dialog.close();
    personalEl(edit.table==='planned_items'?'planEditStatus':'budgetEditStatus').textContent=
      'Edição salva na Cloudflare (revisão '+data.revision+'). O Windows aplicará a alteração quando o sincronizador pessoal estiver conectado.';
    document.dispatchEvent(new Event('finance:personal-refresh-requested'));
    document.dispatchEvent(new Event('finance:personal-updated'));
  }catch{
    msg.textContent='Não foi possível confirmar esta edição. Seus dados originais foram preservados. Verifique a conexão antes de tentar novamente.';
  }finally{
    personalState.busy=false;
    personalEl('personalEditSubmit').disabled=false;
  }
}
document.addEventListener('finance:personal-snapshot',event=>{
  const data=event.detail;
  if(data?.stage!=='quarantine_verified'||!Array.isArray(data.plans)||
     !Array.isArray(data.budgets)||!Array.isArray(data.categories))return;
  personalState.plans=data.plans.filter(p=>typeof p.id==='string'&&
    Number.isSafeInteger(p.revision)&&p.revision>=0);
  personalState.budgets=data.budgets.filter(b=>typeof b.category==='string'&&
    Number.isSafeInteger(b.revision)&&b.revision>=0);
  personalState.categories=data.categories;
  personalState.ready=true;
  personalRenderPlans();personalRenderBudgets();
});
personalEl('planFilter').addEventListener('change',personalRenderPlans);
personalEl('planSearch').addEventListener('input',personalRenderPlans);
personalEl('personalEditForm').addEventListener('submit',event=>void personalSubmit(event));
personalEl('personalEditCancel').addEventListener('click',()=>{
  if(!personalState.busy)personalEl('personalEditDialog').close();
});
personalEl('personalEditDialog').addEventListener('close',()=>{
  personalState.editing=null;personalState.request=null;
});
