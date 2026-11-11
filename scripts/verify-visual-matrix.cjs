'use strict';
// Validate the REAL smoke artifact as JSON with Node, not PowerShell's array pipeline.
// This runs after Electron has exited and uses only Node built-ins.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {SMOKE_VIEWS,SMOKE_PRESETS}=require('./d1-electron-smoke.cjs');

const SLUGS=Object.freeze({
 'Visão geral':'overview','Movimentações':'transactions',
 'Planejamento':'planning','Orçamentos':'budgets',
 'Minhas contas':'accounts','Simular compra':'simulator',
 'Inteligência':'intelligence','Configurações':'settings'
});
const PNG_SIGNATURE=Buffer.from('89504e470d0a1a0a','hex');
function expectedEntries(){
 assert.equal(Object.keys(SLUGS).length,SMOKE_VIEWS.length,'Áreas do smoke e verificador divergentes');
 const expected=new Map();
 for(const preset of SMOKE_PRESETS){
  for(const page of SMOKE_VIEWS){
   const slug=SLUGS[page];
   assert(slug,'Área sem slug de captura: '+page);
   const name=[preset.width+'x'+preset.height,preset.theme,preset.motion,slug].join('-')+'.png';
   assert(!expected.has(name),'Captura prevista duplicada: '+name);
   expected.set(name,{page,width:preset.width,height:preset.height,
    theme:preset.theme,reduced:preset.motion==='reduce'});
  }
 }
 assert.equal(expected.size,32,'A matriz Premium exige 32 combinações');
 return expected;
}
function pngDimensions(filename){
 const fd=fs.openSync(filename,'r');
 try{
  const size=fs.fstatSync(fd).size;
  assert(size>24,'PNG vazio ou truncado: '+path.basename(filename));
  const head=Buffer.alloc(24);
  assert.equal(fs.readSync(fd,head,0,24,0),24,'PNG truncado');
  assert(head.subarray(0,8).equals(PNG_SIGNATURE),'Assinatura PNG inválida: '+path.basename(filename));
  assert.equal(head.toString('ascii',12,16),'IHDR','Cabeçalho PNG IHDR ausente: '+path.basename(filename));
  return {width:head.readUInt32BE(16),height:head.readUInt32BE(20)};
 }finally{fs.closeSync(fd)}
}
function verifyVisualMatrix(directory){
 assert(typeof directory==='string'&&path.isAbsolute(directory),
  'Informe o caminho absoluto da pasta de screenshots sintéticos');
 const manifestPath=path.join(directory,'visual-matrix.json');
 const rows=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 assert(Array.isArray(rows),'O manifesto precisa ser um array JSON, não um objeto');
 const expected=expectedEntries();
 assert.equal(rows.length,expected.size,
  'Manifesto incompleto: esperadas '+expected.size+' entradas, encontradas '+rows.length);
 const images=fs.readdirSync(directory,{withFileTypes:true})
  .filter(entry=>entry.name.toLowerCase().endsWith('.png'));
 assert.equal(images.length,expected.size,
  'Capturas físicas incompletas: esperadas '+expected.size+' imagens, encontradas '+images.length);
 const actualNames=new Set();
 for(const file of images){
  assert(file.isFile()&&!file.isSymbolicLink(),'Captura não é arquivo regular: '+file.name);
  actualNames.add(file.name);
 }
 assert.equal(actualNames.size,expected.size,'Nomes físicos de imagens duplicados');
 const seen=new Set();
 for(const row of rows){
  assert(row&&typeof row==='object'&&!Array.isArray(row),'Registro inválido no manifesto');
  assert(typeof row.screenshot==='string'&&expected.has(row.screenshot),
   'Nome de captura não previsto: '+String(row.screenshot));
  assert(!seen.has(row.screenshot),'Entrada duplicada no manifesto: '+row.screenshot);
  seen.add(row.screenshot);
  const spec=expected.get(row.screenshot);
  for(const key of ['page','width','height','theme','reduced'])
   assert.deepEqual(row[key],spec[key],
    'Metadado '+key+' inconsistente para '+row.screenshot);
  assert(actualNames.has(row.screenshot),'Imagem referenciada não encontrada: '+row.screenshot);
  assert.equal(row.viewportWidth,spec.width,'Largura de viewport divergente: '+row.screenshot);
  assert.equal(row.viewportHeight,spec.height,'Altura de viewport divergente: '+row.screenshot);
  assert(Number.isInteger(row.contentWidth)&&row.contentWidth>0&&
   row.contentWidth<=spec.width+2,'Largura de conteúdo inválida: '+row.screenshot);
  assert(Number.isInteger(row.scrollWidth)&&row.scrollWidth<=row.contentWidth+2,
   'Overflow horizontal no manifesto: '+row.screenshot);
  const dimensions=pngDimensions(path.join(directory,row.screenshot));
  assert.deepEqual(dimensions,{width:spec.width,height:spec.height},
   'Dimensões do PNG divergentes: '+row.screenshot);
 }
 assert.deepEqual(seen,new Set(expected.keys()),'Faltam combinações Premium no manifesto');
 assert.deepEqual(actualNames,seen,'Arquivos PNG e entradas do manifesto divergentes');
 return {count:rows.length,files:images.length,directory};
}
if(require.main===module){
 try{
  const result=verifyVisualMatrix(process.argv[2]);
  console.log('PASS: '+result.count+' entradas JSON, '+result.files+
   ' PNGs, 8 áreas, 4 presets, arquivos e dimensões conferidos.');
 }catch(error){
  console.error('FAIL: matriz visual sintética inválida: '+error.message);
  process.exitCode=1;
 }
}
module.exports={verifyVisualMatrix,expectedEntries};
