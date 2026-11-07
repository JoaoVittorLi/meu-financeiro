from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':940},locale='pt-BR')
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('dialog',lambda dialog:dialog.accept())
    page.set_content('<html><head><meta charset="UTF-8"></head><body><div id="app"></div></body></html>')
    page.add_style_tag(content=(ROOT/'app/style.css').read_text())
    page.evaluate('''() => {
      const d = new Date(),ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),day=ym+'-06';
      const bank={config:{configured:true,secure:true,clientId:'',itemIds:['item']},data:{accounts:[{id:'acct',itemId:'item',name:'Conta',balance:150000,subtype:'CHECKING',currency:'BRL',updatedAt:new Date().toISOString()}],transactions:[],items:[],last:{completedAt:new Date().toISOString(),newCount:0,totalCount:3},dailyTotals:[{date:day,income:260025,expense:11230,categories:[{name:'Alimentação',total:3595},{name:'Compras',total:7635}],incomeCategories:[{name:'Salário',total:260000},{name:'Rendimentos',total:25}]}]}};
      const base={version:5,transactions:[{id:'m1',date:day,description:'Venda usada',kind:'income',amount:1000,category:'Outros',origin:'manual'}],settings:{opening:0,income:0,fixed:0,existing:0,reserve:0},budgets:{Alimentação:5000,Assinaturas:5000}};
      const plan={items:[],suggestions:[],bankTitles:[],generatedAt:'',projection:{anchor:150000,source:'bank',anchorDate:day,asOf:null,rows:[],minimum:150000,negativeDays:[],uncertainIncomeExcluded:0}};
      window.financeDesktop={load:async()=>base,save:async()=>({ok:true}),bankStatus:async()=>bank,categoriesStatus:async()=>({categories:[],rules:[]}),backupStatus:async()=>({copies:0,last:null}),planOverview:async()=>plan};
    }''')
    for script in ['vendor/react.min.js','vendor/react-dom.min.js','app.js']:
        page.add_script_tag(content=(ROOT/'app'/script).read_text())
    page.get_by_role('button',name='Orçamentos',exact=True).click()
    page.get_by_role('heading',name='Orçamentos',exact=True).first.wait_for(timeout=12000)
    assert page.get_by_role('button',name='Gastos',exact=True).get_attribute('aria-pressed')=='true'
    assert page.locator('.mf-budget-card').count()==3, 'Alimentação, Assinaturas e Compras (sem limite)'
    assert page.locator('.mf-budget-card').filter(has_text='Salário').count()==0
    assert page.locator('.mf-budget-card').filter(has_text='Rendimentos').count()==0
    purchases=page.locator('.mf-budget-card').filter(has_text='Compras')
    assert purchases.locator('.progress-track').count()==0, 'Não há barra de orçamento sem limite'
    assert purchases.get_by_text('Sem limite definido').count()==1
    assert page.locator('.source-picker').count()==0
    assert page.locator('.mf-source-trigger').count()==1
    page.locator('.mf-source-trigger').click()
    assert page.get_by_text('Os dois conjuntos não são somados',exact=False).count()==1
    page.locator('.mf-source-trigger').click()
    page.get_by_role('button',name='Receitas',exact=True).click()
    assert page.locator('.mf-budget-card').filter(has_text='Salário').count()==1
    assert page.locator('.mf-budget-card').filter(has_text='Rendimentos').count()==1
    assert page.locator('.mf-budget-card').filter(has_text='Alimentação').count()==0
    assert page.locator('.mf-income-share').count()==2
    assert page.get_by_text('limite mensal',exact=False).count()==0
    page.screenshot(path='/mnt/data/MeuFinanceiro_v0.9.4_Receitas.png',full_page=False)
    page.get_by_role('button',name='Gastos',exact=True).click()
    page.screenshot(path='/mnt/data/MeuFinanceiro_v0.9.4_Gastos.png',full_page=False)
    page.locator('.mf-no-budget').get_by_role('button',name='Definir limite').click()
    assert page.get_by_role('heading',name='Definir limite · Compras').count()==1
    page.locator('.modal input').fill('0,00')
    page.get_by_role('button',name='Salvar alteração').click()
    page.get_by_text('Limite zero definido').wait_for(timeout=5000)
    page.set_viewport_size({'width':1024,'height':840})
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 2')
    assert not errors,errors
    print('PASS: tela Gastos/Receitas, categorias separadas, barras sem limite omitidas, seletor compacto de fonte, zero explícito, viewport 1024px')
    browser.close()
