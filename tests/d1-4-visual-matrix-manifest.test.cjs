'use strict';
// Node 22 regression suite for the JSON/PNG artifact checker. No Electron or financial data.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {verifyVisualMatrix,expectedEntries}=require('../scripts/verify-visual-matrix.cjs');
const PNG_HEADER=Buffer.from('89504e470d0a1a0a','hex');
function fakePng(width,height){
 const buffer=Buffer.alloc(80);
 PNG_HEADER.copy(buffer,0);
 buffer.write('IHDR',12,'ascii');
 buffer.writeUInt32BE(width,16);buffer.writeUInt32BE(height,20);
 return buffer;
}
function fixture(callback){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mf-visual-matrix-contract-'));
 const rows=[];
 try{
  for(const [screenshot,preset] of expectedEntries()){
   rows.push({...preset,viewportWidth:preset.width,viewportHeight:preset.height,
    contentWidth:preset.width-17,scrollWidth:preset.width-17,screenshot});
   fs.writeFileSync(path.join(folder,screenshot),fakePng(preset.width,preset.height));
  }
  const write=()=>fs.writeFileSync(path.join(folder,'visual-matrix.json'),JSON.stringify(rows,null,2)+'\n');
  write();
  return callback({folder,rows,write});
 }finally{fs.rmSync(folder,{recursive:true,force:true})}
}
test('D1.4.3 — 32 PNGs e 32 registros JSON passam com barra de rolagem clássica',()=>fixture(({folder})=>{
 const result=verifyVisualMatrix(folder);
 assert.equal(result.count,32);assert.equal(result.files,32);
}));
test('D1.4.3 — array JSON aninhado (32 imagens, 1 registro) é rejeitado',()=>fixture(({folder,rows})=>{
 fs.writeFileSync(path.join(folder,'visual-matrix.json'),JSON.stringify([rows]));
 assert.throws(()=>verifyVisualMatrix(folder),/32 entradas, encontradas 1/);
}));
test('D1.4.3 — objeto JSON em vez de array é rejeitado',()=>fixture(({folder,rows})=>{
 fs.writeFileSync(path.join(folder,'visual-matrix.json'),JSON.stringify({rows}));
 assert.throws(()=>verifyVisualMatrix(folder),/precisa ser um array JSON/);
}));
test('D1.4.3 — entrada duplicada reprova sem reduzir a contagem',()=>fixture(({folder,rows,write})=>{
 rows[1]={...rows[0]};write();
 assert.throws(()=>verifyVisualMatrix(folder),/duplicada no manifesto/);
}));
test('D1.4.3 — uma linha ausente reprova mesmo com 32 PNGs',()=>fixture(({folder,rows,write})=>{
 rows.pop();write();
 assert.throws(()=>verifyVisualMatrix(folder),/32 entradas, encontradas 31/);
}));
test('D1.4.3 — PNG físico ausente reprova',()=>fixture(({folder,rows})=>{
 fs.rmSync(path.join(folder,rows[0].screenshot));
 assert.throws(()=>verifyVisualMatrix(folder),/32 imagens, encontradas 31/);
}));
test('D1.4.3 — PNG adicional inesperado reprova',()=>fixture(({folder})=>{
 fs.writeFileSync(path.join(folder,'orphan.png'),fakePng(1,1));
 assert.throws(()=>verifyVisualMatrix(folder),/32 imagens, encontradas 33/);
}));
test('D1.4.3 — assinatura PNG inválida reprova',()=>fixture(({folder,rows})=>{
 fs.writeFileSync(path.join(folder,rows[0].screenshot),Buffer.alloc(80));
 assert.throws(()=>verifyVisualMatrix(folder),/Assinatura PNG inválida/);
}));
test('D1.4.3 — PNG com dimensões erradas reprova',()=>fixture(({folder,rows})=>{
 fs.writeFileSync(path.join(folder,rows[0].screenshot),fakePng(100,100));
 assert.throws(()=>verifyVisualMatrix(folder),/Dimensões do PNG divergentes/);
}));
test('D1.4.3 — metadado da página incorreto reprova',()=>fixture(({folder,rows,write})=>{
 rows[0].page='Seção desconhecida';write();
 assert.throws(()=>verifyVisualMatrix(folder),/Metadado page inconsistente/);
}));
test('D1.4.3 — viewport reportado errado reprova',()=>fixture(({folder,rows,write})=>{
 rows[0].viewportWidth=1200;write();
 assert.throws(()=>verifyVisualMatrix(folder),/Largura de viewport divergente/);
}));
test('D1.4.3 — overflow horizontal continua bloqueando o release',()=>fixture(({folder,rows,write})=>{
 rows[0].scrollWidth=rows[0].contentWidth+50;write();
 assert.throws(()=>verifyVisualMatrix(folder),/Overflow horizontal/);
}));
test('D1.4.3 — manifesto malformado reprova',()=>fixture(({folder})=>{
 fs.writeFileSync(path.join(folder,'visual-matrix.json'),'not JSON');
 assert.throws(()=>verifyVisualMatrix(folder),SyntaxError);
}));
test('D1.4.3 — CLI Node retorna sucesso para manifesto completo',()=>fixture(({folder})=>{
 const {spawnSync}=require('node:child_process');
 const script=path.join(__dirname,'../scripts/verify-visual-matrix.cjs');
 const run=spawnSync(process.execPath,[script,folder],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 assert.match(run.stdout,/32 entradas JSON, 32 PNGs/);
}));
test('D1.4.3 — CLI Node retorna falha e impede build com JSON incorreto',()=>fixture(({folder})=>{
 const {spawnSync}=require('node:child_process');
 fs.writeFileSync(path.join(folder,'visual-matrix.json'),'{}');
 const script=path.join(__dirname,'../scripts/verify-visual-matrix.cjs');
 const run=spawnSync(process.execPath,[script,folder],{encoding:'utf8'});
 assert.equal(run.status,1,run.stdout);
 assert.match(run.stderr,/FAIL: matriz visual sintética inválida/);
}));
