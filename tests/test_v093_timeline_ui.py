from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    page=browser.new_page(viewport={'width':1450,'height':920})
    errs=[]
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.set_content('<html><head><meta charset="UTF-8"></head><body><div id="app"></div></body></html>')
    page.add_style_tag(content=(ROOT/'app/style.css').read_text())
    page.evaluate('''() => {
      const now=new Date(),year=now.getFullYear(),month=now.getMonth()+1,ym=year+'-'+String(month).padStart(2,'0');
      const days=new Date(year,month,0).getDate();
      const rows=Array.from({length:days},(_,i)=>{const day=i+1,date=ym+'-'+String(day).padStart(2,'0');const closing=200+(day>=10?235000:0);return {date,opening:closing,incoming:0,outgoing:0,closing,items:[],phase:date<ym+'-'+String(now.getDate()).padStart(2,'0')?'estimated_history':'projection'};});
      const planning={items:[],suggestions:[],bankTitles:[],generatedAt:'',timeline:{month:ym,rows,historicalNotice:'Histórico estimado.'},projection:{anchor:200,source:'manual',anchorDate:ym+'-01',asOf:null,rows,minimum:200,negativeDays:[],uncertainIncomeExcluded:0}};
      const bank={config:{configured:false,secure:true,clientId:'',itemIds:[]},data:{accounts:[],transactions:[],items:[],last:null,dailyTotals:[]}};
      window.financeDesktop={load:async()=>null,save:async()=>({ok:true}),bankStatus:async()=>bank,categoriesStatus:async()=>({categories:[],rules:[]}),backupStatus:async()=>({copies:0,last:null}),planOverview:async()=>planning};
    }''')
    for f in ['vendor/react.min.js','vendor/react-dom.min.js','app.js']:
        page.add_script_tag(content=(ROOT/'app'/f).read_text())
    page.get_by_role('button',name='Planejamento',exact=True).click()
    slider=page.get_by_role('slider',name='Dia selecionado no gráfico de saldo',exact=False)
    slider.wait_for(timeout=10000)
    assert page.locator('.p-day-slider').count()==0, 'não pode haver slider externo'
    assert page.locator('.p-chart-drag-handle').count()==1
    assert page.locator('.p-chart-axis-label').filter(has_text='R$ -').count()==0,'sem base negativa artificial'
    max_day=page.evaluate('new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate()')
    slider.focus();page.evaluate("document.querySelector('.p-balance-svg').addEventListener('keydown',(e)=>window.__keylog=e.key)");print('SVG',page.evaluate("document.querySelector('.p-balance-svg').outerHTML.slice(0,620)"));print('FOCUS',page.evaluate('document.activeElement.tagName'),page.evaluate('document.activeElement.getAttribute(\"class\")'));print('BEFORE',slider.get_attribute('aria-valuenow'));slider.press('End');page.wait_for_timeout(100);print('AFTER',slider.get_attribute('aria-valuenow'),'MAX',max_day,'KEYLOG',page.evaluate('window.__keylog'),'ERRORS',errs)
    assert slider.get_attribute('aria-valuenow')==str(max_day)
    slider.press('Home')
    assert slider.get_attribute('aria-valuenow')=='1'
    # Dragging the marker to the last plotted date (pointer capture & responsive SVG mapping)
    pos=page.locator('.p-chart-drag-handle').bounding_box()
    page.mouse.move(pos['x']+pos['width']/2,pos['y']+pos['height']/2)
    page.mouse.down()
    area=page.locator('.p-balance-svg').bounding_box()
    page.mouse.move(area['x']+area['width']*0.93,area['y']+area['height']*.6,steps=10)
    page.mouse.up()
    assert int(slider.get_attribute('aria-valuenow'))>=max_day-3
    assert not errs,errs
    page.screenshot(path='/mnt/data/MeuFinanceiro_v0.9.3_Grafico.png')
    print('PASS: arrastar bolinha, teclado, eixo não-negativo, sem slider externo.')
    browser.close()
