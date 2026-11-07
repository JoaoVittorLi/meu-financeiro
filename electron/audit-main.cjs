'use strict';

// Standalone, audit-only Electron entrypoint; deliberately NOT the main app.
// Opens a user-selected backup in read-only mode and never initializes the
// active FinanceDB, Pluggy credentials or network synchronization.
const {app,dialog}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {inspectLocalBackupManifest}=require('./cloud-migration-manifest.cjs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-background-networking');
// Avoid Electron accidentally using the installed finance app's userData.
const isolatedData=path.join(app.getPath('appData'),'MeuFinanceiro-Auditoria-Isolada');
fs.mkdirSync(isolatedData,{recursive:true,mode:0o700});
app.setPath('userData',isolatedData);

async function runAudit(){
  const chosen=await dialog.showOpenDialog({
    title:'Meu Financeiro — escolher sua cópia completa para conferência',
    message:'Selecione somente o backup .sqlite que você já salvou. O banco original não será aberto.',
    properties:['openFile'],filters:[{name:'Cópia completa do Meu Financeiro',extensions:['sqlite']}]
  });
  if(chosen.canceled||!chosen.filePaths?.[0])return;
  let result;
  try{result=inspectLocalBackupManifest(chosen.filePaths[0]);}
  catch(error){
    await dialog.showMessageBox({
      type:'error',title:'Conferência não concluída',
      message:'A cópia selecionada não pôde ser validada.',
      detail:'Nenhum dado foi modificado ou transmitido. Verifique se escolheu um backup completo do Meu Financeiro e guarde a cópia original.\n\n'+String(error?.message||'Formato de backup não reconhecido.'),
      buttons:['Fechar'],noLink:true
    });
    return;
  }
  if(!result.ok){
    const issue=[result.missingTables?.length?'Tabelas ausentes: '+result.missingTables.length:'',
      result.missingColumns?.length?'Colunas ausentes: '+result.missingColumns.length:'',
      result.wrongPrimaryKeys?.length?'Chaves incompatíveis: '+result.wrongPrimaryKeys.length:'',
      result.foreignKeyViolationCount?'Problemas de relação: '+result.foreignKeyViolationCount:''
    ].filter(Boolean).join('; ');
    await dialog.showMessageBox({
      type:'warning',title:'Cópia não aprovada para migração',
      message:'O backup não passou na auditoria de estrutura.',
      detail:(issue||'Não foi possível validar todas as tabelas.')+'\nNenhum dado foi enviado ou modificado. Continue utilizando a versão instalada.',
      buttons:['Fechar'],noLink:true
    });
    return;
  }
  const summary=[
    'Integridade do SQLite: OK',
    'Tabelas verificadas: '+result.tableCount,
    'Registros conferidos: '+result.totalRows,
    'Chaves estrangeiras: sem violações',
    'Hash de verificação: '+result.manifestSha256.slice(0,16)+'…',
    '',
    'Nenhum registro foi enviado à Cloudflare.',
    'A migração real ainda NÃO foi autorizada.'
  ].join('\n');
  const decision=await dialog.showMessageBox({
    type:'info',title:'Meu Financeiro — conferência local aprovada',
    message:'Seu backup passou na auditoria estrutural.',
    detail:summary,
    buttons:['Fechar','Salvar relatório local'],defaultId:0,cancelId:0,noLink:true
  });
  if(decision.response!==1)return;
  const destination=await dialog.showSaveDialog({
    title:'Guardar relatório de conferência no computador',
    defaultPath:'MeuFinanceiro-auditoria-'+new Date().toISOString().slice(0,10)+'.json',
    filters:[{name:'Relatório JSON',extensions:['json']}]
  });
  if(destination.canceled||!destination.filePath)return;
  try{
    // Save *locally only*. Never overwrite an existing file silently.
    fs.writeFileSync(destination.filePath,JSON.stringify(result,null,2)+'\n',
      {encoding:'utf8',flag:'wx',mode:0o600});
    await dialog.showMessageBox({
      type:'info',title:'Relatório guardado',
      message:'O relatório de auditoria foi salvo neste computador.',
      detail:'Não envie o arquivo ao GitHub nem ao chat. Ele contém contagens, somas e hashes; nenhuma transação individual. O backup .sqlite continua intacto.',
      buttons:['Fechar'],noLink:true
    });
  }catch(error){
    await dialog.showMessageBox({
      type:'error',title:'Não foi possível salvar o relatório',
      message:'A auditoria continua válida, mas o arquivo de relatório não foi criado.',
      detail:'Escolha outro nome e execute novamente para salvar. O backup original está intacto.',
      buttons:['Fechar'],noLink:true
    });
  }
}

app.whenReady().then(runAudit).catch(async()=>{
  try{await dialog.showMessageBox({
    type:'error',title:'Auditoria não executada',
    message:'Não foi possível concluir a auditoria. Nenhum dado foi modificado.',
    buttons:['Fechar'],noLink:true
  });}catch{}
}).finally(()=>app.quit());
