/* QA-84 B05: presentational navigation and motion; no financial side effects. */
function mfB05ChangeMode(app,mode) {
 if(!['today','chat','actions'].includes(mode))return;
 const previous=app.state.intelligenceMainMode;
 app.setState({intelligenceMainMode:mode,intelligenceTab:mode,categoryReviewOpen:false,
  intelligenceHistoryOpen:false,mfB05DrawerKind:null},()=>{
  if(mode==='today'&&previous!==mode&&typeof intelligencePremiumLoad==='function'&&
    !app.state.intelligencePremiumLoading&&(!app.state.intelligencePremiumReport||
    app.state.intelligencePremiumSignature!==intelligencePremiumSignature(app)))
   void intelligencePremiumLoad(app);
 });
}
function mfB05Tabs(app,selected) {
 const tabs=[{id:'today',label:'Hoje'},{id:'chat',label:'Conversar'},{id:'actions',label:'Plano de Ação'}];
 return h('nav',{className:'mf-b05-tabs',role:'tablist','aria-label':'Áreas da Inteligência'},
  ...tabs.map((tab,i)=>h('button',{key:tab.id,id:'mf-b05-tab-'+tab.id,type:'button',
   role:'tab','aria-selected':selected===tab.id,'aria-controls':'mf-b05-panel',
   tabIndex:selected===tab.id?0:-1,
   className:'mf-b05-tab'+(selected===tab.id?' is-active':''),
   onClick:()=>mfB05ChangeMode(app,tab.id),
   onKeyDown:(event)=>{
    if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
    const next=typeof intelligenceNextTab==='function'?intelligenceNextTab(tab.id,event.key):null;
    if(next){event.preventDefault();mfB05ChangeMode(app,next);
     if(typeof document!=='undefined')document.getElementById('mf-b05-tab-'+next)?.focus();}
   }},tab.label)));
}
function mfB05DrawerKeyboard(event,close) {
 if(event.key==='Escape'){event.preventDefault();close();return;}
 if(event.key!=='Tab'||typeof document==='undefined')return;
 const root=event.currentTarget;
 if(!root||typeof root.querySelectorAll!=='function')return;
 const targets=Array.from(root.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')) as HTMLElement[];
 if(!targets.length)return;
 const index=targets.indexOf(document.activeElement as HTMLElement);
 if(event.shiftKey&&index<=0){event.preventDefault();targets[targets.length-1].focus();}
 else if(!event.shiftKey&&index===targets.length-1){event.preventDefault();targets[0].focus();}
}
function mfB05ReducedMotion() {
 return typeof window!=='undefined'&&typeof window.matchMedia==='function'&&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
