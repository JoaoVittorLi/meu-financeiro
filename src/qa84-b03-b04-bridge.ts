// QA-84 B03/B04 — narrow adapter for the already-approved D05 catalog.
// PR #85 owns resolveCategoryVisualIdentity. This file NEVER registers a
// second taxonomy or overrides that global implementation.
type QA84B04Target={categoryId:string;subcategoryId:string|null};
type QA84B03IdentityInput={categoryId?:string|null;subcategoryId?:string|null;categoryName?:string|null};
function qa84B03Visual(input:QA84B03IdentityInput,parents:any[]=D05_APPROVED_PARENTS):any{
 const official=(typeof window!=='undefined'?(window as any).resolveCategoryVisualIdentity:null);
 if(typeof official==='function')
  return official({...input,catalog:parents});
 // Compatibility only until PR #85 is integrated. Both paths consume the
 // same D05-approved source; unknown IDs are never guessed by merchant text.
 const categoryId=typeof input.categoryId==='string'&&input.categoryId?input.categoryId:null;
 const parent=categoryId?parents.find((p:any)=>p.id===categoryId):
  parents.find((p:any)=>p.name===String(input.categoryName||''))||null;
 const child=parent?.subcategories?.find((s:any)=>s.id===input.subcategoryId&&
  (s.parentId===parent.id||s.parentCategoryId===parent.id));
 const fallback=D05_APPROVED_PARENTS.find((p:any)=>p.id==='cat:outros');
 const visual=child||parent||fallback;
 return {categoryId:parent?.id||fallback?.id||'cat:outros',
  subcategoryId:child?.id||null,iconKey:visual?.iconKey||'shapes',
  hue:Number.isInteger(visual?.hue)?visual.hue:215,
  label:child?.name||parent?.name||String(input.categoryName||'Categoria não identificada'),
  parentLabel:parent?.name||String(input.categoryName||'Categoria não identificada'),
  source:child?'sub':parent?'parent':'fallback'};
}
function qa84B04Fold(value:any):string{
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
}
function qa84B04Search(parents:any[],term:string):{parent:any;children:any[]}[]{
 const q=qa84B04Fold(term);
 return parents.map((parent:any)=>{
  const matchesParent=!q||qa84B04Fold(parent.name).includes(q);
  const children=matchesParent?[]:(parent.subcategories||[]).filter((x:any)=>qa84B04Fold(x.name).includes(q));
  return {parent,children};
 }).filter((entry:any)=>!q||qa84B04Fold(entry.parent.name).includes(q)||entry.children.length>0);
}
function qa84B04Geometry(rect:any,viewport:{width:number;height:number}):{left:number;top:number;width:number}{
 const width=Math.max(240,Math.min(730,viewport.width-24));
 const below=viewport.height-(rect?.bottom||0),above=rect?.top||0;
 // Contextual when there is space; otherwise center the overlay safely.
 const top=below>=290?Math.max(12,rect.bottom+7):above>=290?
  Math.max(12,Math.min(viewport.height-290,above-290)):12;
 const left=rect&&rect.left+width<=viewport.width-12?
  Math.max(12,rect.left):Math.max(12,Math.floor((viewport.width-width)/2));
 return {left,top,width};
}
function qa84B04Fingerprint(row:any):string{
 if(!row)return '';
 return JSON.stringify([row.source,row.accountId||'',row.id,row.date,row.amount,
  row.status||'',row.kind||'',row.categoryId||null,row.subcategoryId||null,
  row.category||'']);
}
function qa84B03RequestDrawerPicker(event:any,source:'bank'|'manual',id:string,accountId?:string){
 if(!event?.currentTarget||!id)return;
 event.stopPropagation?.();
 window.dispatchEvent(new CustomEvent('mf2:d05:open-picker',{detail:{
  source,id,accountId:accountId||'',trigger:event.currentTarget
 }}));
}
