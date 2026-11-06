from playwright.sync_api import sync_playwright
from pathlib import Path
P=Path(__file__).resolve().parents[1]

def load_page(page, persisted):
    page.set_content('<html><head><meta charset="UTF-8"></head><body><div id="app"></div></body></html>')
    page.add_style_tag(content=(P/'app/style.css').read_text())
    page.evaluate('''(previous) => {
      window.__mockDB=previous;
      window.financeDesktop={
        load: async profile => window.__mockDB[profile] || null,
        save: async (profile,data) => {window.__mockDB[profile]=JSON.parse(JSON.stringify(data));return {ok:true};},
        info: async()=>({engine:'sqlite'}),
        backupSQLite: async()=>({ok:true}),
        openDataFolder: async()=>''
      };
    }''',persisted)
    for filename in ['vendor/react.min.js','vendor/react-dom.min.js','app.js']:
        page.add_script_tag(content=(P/'app'/filename).read_text())
    page.get_by_role('heading',name='Visão geral').wait_for(timeout=10000)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    context=browser.new_context(viewport={'width':1450,'height':900})
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    load_page(page,{})
    assert page.get_by_text('SQLITE LOCAL').count()==1
    page.get_by_role('button',name='Adicionar lançamento').click()
    page.locator('.modal input[placeholder="Ex.: supermercado"]').fill('Conta de teste Electron')
    page.locator('.modal input[placeholder="0,00"]').fill('12,34')
    page.get_by_role('button',name='Salvar lançamento').click()
    page.get_by_text('Conta de teste Electron').wait_for(timeout=3000)
    assert page.evaluate("window.__mockDB.real.transactions[0].amount")==1234
    page.get_by_role('button',name='Explorar demonstração').click()
    page.get_by_text('Você está explorando dados fictícios.',exact=False).wait_for()
    assert page.evaluate("window.__mockDB.real.transactions.length")==1
    page.get_by_role('button',name='Voltar aos meus dados').click()
    page.get_by_text('Conta de teste Electron').wait_for()
    saved=page.evaluate('window.__mockDB')
    newpage=context.new_page();newpage.on('pageerror',lambda e:errors.append(str(e)))
    load_page(newpage,saved)
    newpage.get_by_text('Conta de teste Electron').wait_for()
    newpage.get_by_role('button',name='Configurações',exact=True).click()
    assert newpage.get_by_role('button',name='Salvar cópia do SQLite').count()==1
    assert newpage.get_by_role('button',name='Abrir pasta do banco').count()==1
    assert not errors,errors
    print('SUCCESS: ponte Electron simulada: gravação, isolamento demo, reabertura e controles SQLite.')
    browser.close()
