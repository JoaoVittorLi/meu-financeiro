from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    page=browser.new_page(viewport={'width':1510,'height':930})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('<html><head><meta charset="UTF-8"></head><body><div id="app"></div></body></html>')
    page.add_style_tag(content=(ROOT/'app/style.css').read_text())
    page.evaluate('''() => {
      const today=new Date(),year=today.getFullYear(),month=today.getMonth()+1;
      const ym=year+'-'+String(month).padStart(2,'0');
      const days=new Date(year,month,0).getDate();
      const rows=Array.from({length:days},(_,i)=>{
        const day=i+1, date=ym+'-'+String(day).padStart(2,'0');
        const closing=250000+(day>=10?25000:0)-(day>=16?60000:0)+(day>=24?15000:0);
        const previous=250000+((day-1)>=10?25000:0)-((day-1)>=16?60000:0)+((day-1)>=24?15000:0);
        const delta=closing-previous;
        return {date,opening:previous,incoming:Math.max(0,delta),outgoing:Math.max(0,-delta),closing,items:[],phase:date<ym+'-'+String(today.getDate()).padStart(2,'0')?'estimated_history':'projection'};
      });
      const planning={items:[],suggestions:[],bankTitles:[],generatedAt:'',timeline:{month:ym,rows,historicalNotice:'Histórico estimado.'},projection:{anchor:250000,source:'manual',anchorDate:ym+'-01',asOf:null,rows:rows.filter(r=>r.date>=ym+'-'+String(today.getDate()).padStart(2,'0')),minimum:200000,negativeDays:[],uncertainIncomeExcluded:0}};
      const bank={config:{configured:false,secure:true,clientId:'',itemIds:[]},data:{accounts:[],transactions:[],items:[],last:null,dailyTotals:[]}};
      window.financeDesktop={load:async()=>null,save:async()=>({ok:true}),bankStatus:async()=>bank,categoriesStatus:async()=>({categories:[],rules:[]}),backupStatus:async()=>({copies:0,last:null}),planOverview:async()=>planning};
    }''')
    for f in ['vendor/react.min.js','vendor/react-dom.min.js','app.js']:
        page.add_script_tag(content=(ROOT/'app'/f).read_text())
    page.get_by_role('heading',name='Visão geral').wait_for(timeout=15000)
    page.get_by_role('button',name='Planejamento',exact=True).click()
    slider=page.get_by_role('slider',name='Selecionar dia no gráfico')
    slider.wait_for(timeout=10000)
    assert page.locator('.p-balance-svg').count()==1
    assert page.locator('.p-chart-current>strong').count()==1
    slider.focus();slider.press('End')
    last_day=page.evaluate('new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate()')
    page.get_by_text(f'Dia {last_day} de {last_day}',exact=True).wait_for(timeout=5000)
    slider.press('Home')
    page.get_by_text(f'Dia 1 de {last_day}',exact=True).wait_for(timeout=5000)
    slider.press('ArrowRight')
    page.get_by_text(f'Dia 2 de {last_day}',exact=True).wait_for(timeout=5000)
    assert page.locator('.p-chart-active-line').count()==1
    assert not errors,errors
    slider.press('End')
    screenshot=Path('/mnt/data/MeuFinanceiro_v0.9.1_preview_timeline.png')
    page.screenshot(path=str(screenshot),full_page=False)
    print('PASS: gráfico SVG, slider de dia 1 até final do mês, variação e navegação por teclado; screenshot:',screenshot)
    browser.close()
