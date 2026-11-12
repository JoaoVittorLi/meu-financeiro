'use strict';
// Test-only native window bounds, not Chrome viewport/media emulation.
function q1NativeWindow(active,value=process.env.MF_Q1_NATIVE_SIZE){
 if(value==null)return null;
 if(!active)throw Error('QA de janela exige perfil sintético validado.');
 const sizes={'1366x768':{width:1380,height:775},'1920x1080':{width:1934,height:1087}};
 if(!Object.hasOwn(sizes,value))throw Error('Tamanho Q1 inválido.');
 // Windows DWM excludes invisible resize borders from its captured surface.
 // Capture dimensions MUST still be measured from the Computer Use image.
 return {...sizes[value],x:0,y:0};
}
module.exports={q1NativeWindow};
