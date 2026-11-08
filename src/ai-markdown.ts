/* Render a small, safe Markdown subset as React elements.
 * Never inject LLM content via innerHTML, script, style, iframe or URL. */
function aiMarkdownInline(text:string):any[]{
 const source=String(text||'');
 const nodes:any[]=[];const pattern=/\*\*(.+?)\*\*/g;
 let index=0,m:RegExpExecArray|null=null;
 while((m=pattern.exec(source))!==null){
   if(m.index>index)nodes.push(source.slice(index,m.index));
   nodes.push(h('strong',{key:'bold-'+m.index},m[1]));
   index=m.index+m[0].length;
 }
 if(index<source.length)nodes.push(source.slice(index));
 return nodes.length?nodes:[''];
}
function aiMarkdownTableCells(line:string){
 return line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());
}
function aiMarkdownNodes(input:string):any[]{
 const lines=String(input||'').slice(0,12000).split(/\r?\n/),out:any[]=[];
 let i=0;
 while(i<lines.length){
   const line=lines[i].trim();
   if(!line){i++;continue;}
   if(line.startsWith('|')&&i+1<lines.length&&/^\|[\s:|-]+\|$/.test(lines[i+1].trim())&&lines[i+1].includes('---')){
     const heads=aiMarkdownTableCells(lines[i]);i+=2;
     const rows:any[]=[];
     while(i<lines.length&&lines[i].trim().startsWith('|')){
       const cols=aiMarkdownTableCells(lines[i++]);
       rows.push(h('tr',{key:'row-'+i},...heads.map((_,j)=>h('td',{key:j},...aiMarkdownInline(cols[j]||'')))));
     }
     out.push(h('div',{className:'mf-ai-table-wrap',key:'table-'+i},
       h('table',{},h('thead',{},h('tr',{},...heads.map((c,j)=>h('th',{key:j},...aiMarkdownInline(c))))),
         h('tbody',{},...rows))));
     continue;
   }
   if(/^#{1,3}\s+/.test(line)){
     out.push(h('h3',{key:'head-'+i},...aiMarkdownInline(line.replace(/^#{1,3}\s+/,''))));i++;continue;
   }
   if(/^(?:[-*]\s+|\d+\.\s+)/.test(line)){
     const ordered=/^\d+\.\s+/.test(line),items:any[]=[];
     while(i<lines.length&&new RegExp(ordered?'^\\d+\\.\\s+':'^[-*]\\s+').test(lines[i].trim())){
       items.push(h('li',{key:'li-'+i},...aiMarkdownInline(lines[i].trim().replace(/^(?:[-*]\s+|\d+\.\s+)/,''))));i++;
     }
     out.push(h(ordered?'ol':'ul',{key:'list-'+i},...items));continue;
   }
   const para:string[]=[line];i++;
   while(i<lines.length&&lines[i].trim()&&!/^(?:#{1,3}\s+|[-*]\s+|\d+\.\s+|\|)/.test(lines[i].trim()))para.push(lines[i++].trim());
   out.push(h('p',{key:'para-'+i},...aiMarkdownInline(para.join(' '))));
 }
 return out;
}
