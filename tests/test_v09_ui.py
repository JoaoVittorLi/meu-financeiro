from pathlib import Path
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 page=browser.new_page(viewport={'width':1550,'height':900})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content('<html><head><meta charset="UTF-8"></head><body><div id="app"></div></body></html>')
 page.add_style_tag(content=(P/'app/style.css').read_text())
 page.evaluate('''() => {
   const bank={config:{configured:false,secure:true,clientId:'',itemIds:[]},data:{accounts:[],transactions:[],items:[],last:null,dailyTotals:[]}};
   const planning={items:[],suggestions:[],bankTitles:[],generatedAt:'',projection:{anchor:250000,source:'manual',anchorDate:'2026-11-06',asOf:null,reference:{quality:'manual',observedAt:null,missingBalances:0,totalAccounts:0,observationAgeHours:null},rows:[],minimum:250000,negativeDays:[],uncertainIncomeExcluded:0}};
   window.financeDesktop={load: async()=>null,save:async()=>({ok:true}),bankStatus:async()=>bank,
   categoriesStatus:async()=>({categories:[],rules:[]}),backupStatus:async()=>({copies:0,last:null}),
   planOverview:async()=>planning,planSimulate:async o=>({engine:'planning',principal:o.amount,monthly:50000,total:300000,interest:0,installments:6,
     reserve:50000,baselineMinimum:250000,minimumAfterPurchase:100000,worstDay:'2026-12-10',risk:'estimate',
     reference:{quality:'unverified'},rows:[{month:'2026-11',withoutPurchase:250000,withPurchase:200000},{month:'2026-12',withoutPurchase:250000,withPurchase:150000}],warning:'Simulação hipotética não é garantia.'})};
 }''')
 for file in ['vendor/react.min.js','vendor/react-dom.min.js','app.js']:
  page.add_script_tag(content=(P/'app'/file).read_text())
 page.get_by_role('heading',name='Visão geral').wait_for(timeout=10000)
 # Unified navigation
 assert page.get_by_role('button',name='Revisar movimentações').count()==0
 assert page.get_by_role('button',name='Simulador de parcelas').count()==0
 page.get_by_role('button',name='Movimentações',exact=True).click()
 page.get_by_role('button',name='A revisar (0)').click()
 assert page.get_by_text('Tudo organizado!',exact=False).count()==1
 page.get_by_role('button',name='Todas as movimentações',exact=True).click()
 page.get_by_role('button',name='Simular compra').click()
 page.locator('input[placeholder="Ex.: 1.499,90"]').fill('3000,00')
 page.get_by_role('button',name='Analisar compra').click()
 page.get_by_text('Cenário projetado').wait_for(timeout=5000)
 assert page.get_by_text('Menor saldo com compra').count()==1
 assert page.locator('.mf-scenario-result .future-list>div').count()==2
 assert not errors,errors
 path=Path('/mnt/data/MeuFinanceiro_v0.9_preview.png');page.screenshot(path=str(path),full_page=True)
 print('PASS: navegação consolidada, revisão, simulação integrada e interface sem erros; preview:',path)
 browser.close()
