'use strict';
// Review-only browser host. Exact React components, synthetic ledger context.
// This is NOT Electron, does not expose SQLite and cannot contact a paid model.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
async function createPreviewServer(){
 const {buildSyntheticFinancialContext}=await import('../shared/ai-financial-context.mjs');
 const source=['intelligence-view.ts','intelligence-integration.ts','intelligence-staging.ts'].map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2020}}).outputText;
 const bootstrap=`
const h=React.createElement;
const desktop={aiFinancialContextDemo:async(source)=>{const r=await fetch('/synthetic-context?source='+source);if(!r.ok)throw Error('Contexto indisponível');return r.json();}};
class WorkPreview extends React.Component {
 constructor(props){super(props);this.state={page:'intelligence',intelligenceContext:'budgets',intelligencePanelOpen:false,workIntelligenceDemo:workDemoInitial()};}
 componentDidMount(){workDemoLoad(this);}
 render(){const d=this.state.workIntelligenceDemo;return h('main',{className:'mf-work-preview-shell'},
 h('div',{className:'mf-work-preview-notice',role:'note'},'PROTÓTIPO EM NAVEGADOR · dados sintéticos · não é o aplicativo Windows'),
 h('nav',{'aria-label':'Contextos demonstrativos'},['overview','transactions','planning','budgets','assistant','banks','settings','intelligence'].map(page=>h('button',{type:'button',key:page,onClick:()=>this.setState({page,intelligenceContext:page,intelligencePanelOpen:true})},intelligenceContextFor(page).label))),
 d.enabled?renderWorkIntelligenceDemo(this):h('button',{type:'button',onClick:()=>workDemoLoad(this)},'Iniciar demonstração'),
 this.state.intelligencePanelOpen&&d.enabled?renderWorkIntelligencePanel(this):null);}
}
ReactDOM.createRoot(document.getElementById('app')).render(h(WorkPreview));`;
 const styles=['style.css','intelligence.css','design-system.css','refinement.css','intelligence-staging.css'];
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meu Financeiro · protótipo Work</title><script src="/app/appearance.js"></script>${styles.map(f=>`<link rel="stylesheet" href="/app/${f}">`).join('')}<link rel="stylesheet" href="/preview.css"></head><body><div id="app"></div><script src="/app/vendor/react.min.js"></script><script src="/app/vendor/react-dom.min.js"></script><script src="/preview.js"></script></body></html>`;
 return http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const send=(status,type,data)=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'"});res.end(data);};
  if(req.method!=='GET')return send(405,'text/plain','Read-only preview');
  if(url.pathname==='/')return send(200,'text/html; charset=utf-8',html);
  if(url.pathname==='/preview.js')return send(200,'text/javascript; charset=utf-8',compiled+'\n'+bootstrap);
  if(url.pathname==='/preview.css')return send(200,'text/css','.mf-work-preview-shell{max-width:1220px;margin:auto;padding:24px}.mf-work-preview-notice{padding:12px;border:1px dashed #7a8b8a;border-radius:8px;margin-bottom:20px;font-size:12px}.mf-work-preview-shell>nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}.mf-work-preview-shell>nav button{padding:8px;border-radius:8px;background:transparent;color:inherit;border:1px solid #7a8b8a}');
  if(url.pathname==='/synthetic-context'){
   const selected=url.searchParams.get('source');
   if(selected!=='bank'&&selected!=='manual')return send(400,'text/plain','Invalid demo source');
   return send(200,'application/json',JSON.stringify(buildSyntheticFinancialContext(selected)));
  }
  if(url.pathname.startsWith('/app/')){
   let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{return send(400,'text/plain','Invalid path');}
   const target=path.resolve(root,'.'+decoded);
   if(!target.startsWith(path.join(root,'app')+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile())return send(404,'text/plain','Not found');
   const type={'.css':'text/css','.js':'text/javascript','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(target)]||'application/octet-stream';
   return send(200,type+'; charset=utf-8',fs.readFileSync(target));
  }
  return send(404,'text/plain','Not found');
 });
}
if(require.main===module)createPreviewServer().then(server=>server.listen(4180,'127.0.0.1',()=>console.log('SYNTHETIC BROWSER PROTOTYPE http://localhost:4180 — not Electron')));
module.exports={createPreviewServer};
