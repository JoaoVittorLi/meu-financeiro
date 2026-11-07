from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1450,'height':900},locale='pt-BR')
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog',lambda dialog: dialog.accept())
    page.set_content('<html><head><meta charset="UTF-8"></head><body><div id="app"></div></body></html>')
    page.add_style_tag(content=(ROOT/'app/style.css').read_text())
    page.evaluate('''() => {
      const today = new Date(); const date = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
      window.MF_TEST_DATE=date;
      const account={id:'acct',itemId:'item',name:'Itaú',balance:238750,subtype:'CHECKING',currency:'BRL',updatedAt:new Date().toISOString()};
      const expense={id:'tx-food',accountId:'acct',accountName:'Itaú',date,description:'Compra IFOOD',merchant:'iFood',amount:-3290,status:'POSTED',category:'Alimentação',reviewed:false,nature:'expense',splits:[]};
      const bank={config:{configured:true,secure:true,clientId:'',itemIds:['item']},data:{accounts:[account],transactions:[expense],items:[],last:{completedAt:new Date().toISOString(),newCount:1,totalCount:1},dailyTotals:[]}};
      window.MF_TEST_BANK=bank;
      window.MF_TEST_TRACK={reviewed:0,savedPlans:0,simulations:0};
      const settings={opening:0,income:200000,fixed:100000,existing:0,reserve:50000};
      const base={version:3,transactions:[],settings,budgets:{Alimentação:50000,Moradia:100000}};
      const planning={items:[],suggestions:[],bankTitles:[],generatedAt:'',projection:{anchor:238750,source:'bank',anchorDate:date,asOf:new Date().toISOString(),reference:{quality:'unverified',observedAt:new Date().toISOString(),missingBalances:0,totalAccounts:1,observationAgeHours:0},rows:[],minimum:238750,negativeDays:[],uncertainIncomeExcluded:0}};
      window.financeDesktop={load:async()=>base,save:async()=>({ok:true}),bankStatus:async()=>bank,
       categoriesStatus:async()=>({categories:[],rules:[]}),backupStatus:async()=>({copies:0,last:null}),
       planOverview:async()=>planning,
       bankBatch:async x=>{window.MF_TEST_TRACK.reviewed++; bank.data.transactions.forEach(t=>{if(x.items.some(a=>a.externalId===t.id))t.reviewed=true});return bank.data},
       planSimulate:async x=>{window.MF_TEST_TRACK.simulations++;return {engine:'planning',principal:x.amount,monthly:10000,total:60000,interest:0,installments:6,firstDueDate:date,
       reserve:50000,baselineMinimum:238750,minimumAfterPurchase:178750,worstDay:date,risk:'estimate',reference:{quality:'unverified'},rows:[{month:date.slice(0,7),withoutPurchase:238750,withPurchase:178750}],warning:'Estimativa fictícia.'}},
       planCreate:async x=>{window.MF_TEST_TRACK.savedPlans++;return {ok:true}}
      };
    }''')
    for rel in ['vendor/react.min.js','vendor/react-dom.min.js','app.js']:
        page.add_script_tag(content=(ROOT/'app'/rel).read_text())
    page.get_by_role('heading',name='Visão geral').wait_for(timeout=15000)
    assert page.locator('.sidebar nav .nav-item').count()==6, 'Precisamos de 6 páginas principais'
    assert page.locator('.side-bottom .nav-item').count()==1, 'Configurações devem ficar no rodapé'
    page.get_by_role('button',name='Movimentações',exact=True).click()
    page.get_by_role('button',name='A revisar (1)').click()
    page.get_by_role('button',name='✓ Revisar').click()
    page.get_by_role('button',name='A revisar (0)').wait_for(timeout=5000)
    assert page.evaluate('MF_TEST_TRACK.reviewed')==1
    assert page.locator('.mf-detail-drawer').count()==0, 'Revisão rápida não deve abrir detalhe'
    page.get_by_role('button',name='Categorias e regras',exact=True).click()
    assert page.locator('.emoji-grid .emoji-choice').count()<=20
    page.get_by_role('button',name='Explorar todos os emojis').click()
    assert page.locator('.emoji-grid .emoji-choice').count()>=60
    page.get_by_role('button',name='Histórico',exact=True).click()
    assert page.get_by_role('button',name='Categorias e regras').count()==1
    page.get_by_role('button',name='Orçamentos',exact=True).click()
    assert page.get_by_text('Fonte dos indicadores:',exact=True).count()==1
    page.get_by_role('button',name='Registros manuais').click()
    page.get_by_role('button',name='Simular compra',exact=True).click()
    page.locator('input[placeholder="Ex.: 1.499,90"]').fill('500,00')
    page.get_by_role('button',name='Analisar compra').click()
    page.get_by_role('button',name='Planejar esta compra').wait_for(timeout=5000)
    page.get_by_role('button',name='Planejar esta compra').click()
    page.locator('.p-plan-modal').wait_for(timeout=5000)
    assert page.locator('.p-plan-modal input').count()>0
    assert page.evaluate('MF_TEST_TRACK.savedPlans')==0, 'Não pode cadastrar sem confirmação no formulário'
    page.keyboard.press('Escape')
    assert page.locator('.p-plan-modal').count()==0
    page.get_by_role('button',name='Adicionar',exact=True).click()
    page.get_by_role('button',name='Nova despesa').click()
    assert page.get_by_role('heading',name='Registrar movimentação').count()==1
    page.keyboard.press('Escape')
    assert page.get_by_role('heading',name='Registrar movimentação').count()==0
    page.get_by_role('button',name='Visão geral',exact=True).click()
    # The selected period must survive navigation into Movimentações and guide the budget month.
    page.locator('.mf-period-trigger').click()
    page.get_by_role('button',name='Mês passado',exact=True).click()
    page.get_by_role('button',name='Movimentações',exact=True).click()
    assert 'Mês passado' in page.locator('.mf-period-trigger').inner_text()
    page.get_by_role('button',name='Orçamentos',exact=True).click()
    expected=page.evaluate("new Date(new Date().getFullYear(),new Date().getMonth()-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})")
    assert expected.lower() in page.locator('.mf-budget-context').inner_text().lower()
    page.get_by_role('button',name='Movimentações',exact=True).click()
    assert page.locator('.mf-tx-section').count()==1
    assert not errors,errors
    shot=Path('/mnt/data/MeuFinanceiro_v0.9.2_preview_ux.png')
    page.screenshot(path=str(shot),full_page=False)
    for width in [1024,1366]:
        page.set_viewport_size({'width':width,'height':900})
        assert not page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2'),f'Overflow horizontal {width}'
    print('PASS: 6 áreas principais, categorias incorporadas, revisão sem abrir painel, fonte de orçamento, simulação→planejamento sem gravar, atalhos, Escape, layout 1024/1366px; captura:',shot)
    browser.close()
