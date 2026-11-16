/* RC-ALL-FULL D05 — RFC4180 CSV import parser and full-row preview gate.
 * No automatic commit from pasted/imported file; unknown columns are ignored,
 * malformed quoting, formula-like strings, ambiguous dates and unsafe amounts fail closed. */
type D05CsvRow={index:number;date:string;description:string;kind:'income'|'expense';
 amount:number;category:string;origin:'csv'};
function d05CsvRecords(input:string):string[][]{
 if(typeof input!=='string'||input.length>4_000_000)throw Error('CSV excede limite de 4 MB.');
 const text=input.replace(/^\ufeff/,'');
 const firstLine=text.slice(0,text.indexOf('\n')>=0?text.indexOf('\n'):Math.min(text.length,2000));
 const separator=(firstLine.match(/;/g)||[]).length>=(firstLine.match(/,/g)||[]).length?';':',';
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;continue;}
   if(quoted){quoted=false;closed=true;continue;}
   if(!field&&!closed){quoted=true;continue;}
   throw Error('CSV com aspas inválidas na linha '+(rows.length+1));
  }
  if(!quoted&&(ch===separator||ch==='\n'||ch==='\r')){
   row.push(field);field='';closed=false;
   if(ch!==separator){
    if(ch==='\r'&&text[i+1]==='\n')i++;
    if(row.some(x=>x.trim()))rows.push(row);
    if(rows.length>10001)throw Error('CSV excede 10.000 linhas.');
    row=[];
   }
   continue;
  }
  if(closed&&!/\s/.test(ch))throw Error('CSV com texto após as aspas');
  if(field.length>=1000)throw Error('CSV contém campo acima de 1.000 caracteres.');
  field+=ch;
 }
 if(quoted)throw Error('CSV com campo entre aspas não encerrado.');
 if(field.length||row.length){row.push(field);if(row.some(x=>x.trim()))rows.push(row);}
 if(rows.length<2)throw Error('CSV vazio ou sem lançamentos.');
 if(rows.length>10001)throw Error('CSV excede 10.000 linhas.');
 const cols=rows[0].length;
 if(cols<3||cols>40||rows.some(r=>r.length!==cols))throw Error('CSV possui número irregular de colunas.');
 return rows;
}
function d05CsvSafeText(value:string,max:number,label:string):string{
 const s=String(value||'').trim();
 if(!s||s.length>max||/[\x00-\x08\x0b-\x1f]/.test(s))
  throw Error('CSV: '+label+' inválido');
 if(/^[\s\uFEFF]*[=+@-]/.test(s))throw Error('CSV: '+label+' com possível fórmula de planilha');
 return s;
}
function d05CsvDate(value:string):string{
 let date=value.trim();
 if(/^\d{2}\/\d{2}\/\d{4}$/.test(date)){
  const [d,m,y]=date.split('/');date=y+'-'+m+'-'+d;
 }
 if(!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date))
  throw Error('CSV: data inválida');
 const [y,m,d]=date.split('-').map(Number),v=new Date(Date.UTC(y,m-1,d));
 if(v.toISOString().slice(0,10)!==date)throw Error('CSV: data impossível');
 return date;
}
async function d05CsvDigest(text:string):Promise<string>{
 if(typeof crypto==='undefined'||!crypto.subtle)throw Error('Importação segura exige digest SHA-256 disponível.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function d05CsvTable(input:string):{rows:string[][];headers:string[];find:(...x:string[])=>number}{
 const rows=d05CsvRecords(input);
 const headers=rows.shift()!.map(h=>h.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').trim());
 if(new Set(headers).size!==headers.length)throw Error('CSV com colunas duplicadas.');
 const find=(...aliases:string[])=>headers.findIndex(x=>aliases.includes(x));
 if(find('data','date')<0||find('descricao','historico','description')<0||
    find('valor','amount')<0)throw Error('CSV deve informar data, descrição e valor.');
 return {rows,headers,find};
}
function d05CsvFormulaSafe(value:string):string{
 const text=String(value??'');
 return /^[\s\uFEFF]*[=+@-]/.test(text)?"'"+text:text;
}
