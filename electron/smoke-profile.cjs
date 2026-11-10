'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
// Test-only profile override. Packaged binaries must never accept this input.
function isolateSmokeProfile(app,{directory=process.env.MF_DESKTOP_SMOKE_DIR,defaultApp=process.defaultApp}={}){
 if(directory==null)return false;
 if(app.isPackaged||defaultApp!==true)throw new Error('Perfil de teste permitido apenas no Electron de desenvolvimento.');
 if(typeof directory!=='string'||!path.isAbsolute(directory))throw new Error('Perfil de teste precisa ser absoluto.');
 const tmp=fs.realpathSync(os.tmpdir()),target=fs.realpathSync(directory);
 const relative=path.relative(tmp,target);
 if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||
    !/^mf-d1-electron-[A-Za-z0-9_-]+$/.test(path.basename(target)))
   throw new Error('Perfil de teste fora da pasta temporária isolada.');
 app.setPath('userData',target);
 return true;
}
module.exports={isolateSmokeProfile};
