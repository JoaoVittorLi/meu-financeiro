from playwright.sync_api import sync_playwright
from pathlib import Path
import json
P=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 page=b.new_page(viewport={'width':1440,'height':940},accept_downloads=True)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content('<html><head><meta charset="UTF-8"></head><body><div id="app"></div></body></html>')
 page.add_style_tag(content=(P/'app/style.css').read_text())
 page.evaluate("""() => {
   const db={};window.__fakeStorage=db;
   Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>db[k]??null,setItem:(k,v)=>{db[k]=String(v);},removeItem:k=>delete db[k]}});
 }""")
 for file in ['vendor/react.min.js','vendor/react-dom.min.js','app.js']:
  page.add_script_tag(content=(P/'app'/file).read_text())
 assert page.get_by_role('heading',name='Visão geral').count()==1
 assert page.locator('.stat').count()==4
 assert page.locator('.bottom-grid>.card').count()==2
 money=page.evaluate("parseMoney('1.234,56')")
 assert money==123456,money
 money=page.evaluate("parseMoney('0,99')")
 assert money==99,money
 payment=page.evaluate("simulate(starter(), {value:'1200',installments:'6',interest:'0'})")
 assert payment['monthly']==20000 and payment['total']==120000 and payment['risk']=='unknown',payment
 # Add a real transaction
 page.get_by_role('button',name='Adicionar lançamento').click()
 page.locator('.modal input[placeholder="Ex.: supermercado"]').fill('Compra de teste')
 page.locator('.modal input[placeholder="0,00"]').fill('125,50')
 page.get_by_role('button',name='Salvar lançamento').click()
 assert page.get_by_text('Compra de teste').count()==1
 assert page.evaluate("JSON.parse(window.__fakeStorage['meu-financeiro-v03-real']).transactions.length")==1
 # Demo data separate, return and check persistence
 page.get_by_role('button',name='Explorar demonstração').click()
 assert page.get_by_text('Você está explorando dados fictícios. Nada aqui altera suas finanças pessoais.').count()==1
 assert page.locator('.donut').count()==1
 assert page.evaluate("JSON.parse(window.__fakeStorage['meu-financeiro-v03-real']).transactions.length")==1
 page.get_by_role('button',name='Voltar aos meus dados').click()
 assert page.get_by_text('Compra de teste').count()==1
 # CSV import: explicit expense type with POSITIVE amount must remain an expense
 page.get_by_role('button',name='Transações',exact=True).click()
 csv='data;descricao;tipo;valor;categoria\n2026-11-06;Importação de teste;expense;45,90;Alimentação\n'
 page.locator('input[accept^=".csv"]').set_input_files({'name':'gastos.csv','mimeType':'text/csv','buffer':csv.encode('utf-8')})
 result=page.evaluate("JSON.parse(window.__fakeStorage['meu-financeiro-v03-real']).transactions")
 assert len(result)==2,result
 assert result[-1]['kind']=='expense' and result[-1]['amount']==4590,result
 # Budget edit
 page.get_by_role('button',name='Orçamentos',exact=True).click()
 page.locator('.budget-item').first.get_by_role('button',name='Editar').click()
 page.locator('.small-modal .form-control').fill('450,00')
 page.get_by_role('button',name='Salvar alteração').click()
 budgets=page.evaluate("JSON.parse(window.__fakeStorage['meu-financeiro-v03-real']).budgets")
 assert budgets['Moradia']==45000,budgets
 # Financial engine: no profile => no false safe verdict
 page.get_by_role('button',name='Assistente de compras',exact=True).click()
 page.locator('input[placeholder="Ex.: 1.499,90"]').fill('2400')
 page.get_by_role('button',name='Analisar compra').click()
 assert page.get_by_text('Dados insuficientes').count()==1
 # demo uses defined profile; test result
 page.get_by_role('button',name='Explorar demonstração').click()
 page.get_by_role('button',name='Assistente de compras',exact=True).click()
 page.locator('input[placeholder="Ex.: 1.499,90"]').fill('2400')
 page.get_by_role('button',name='Analisar compra').click()
 assert page.get_by_text('Parcela',exact=True).count()==1
 assert page.locator('.future-list>div').count()==6
 assert not errors,errors
 print('SUCCESS 16 checks; UI pages and financial engine passed.')
 b.close()
