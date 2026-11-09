'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/appearance.js'),'utf8');
function fixture(saved,dark=false,blocked=false){
 const listeners={},root={dataset:{},style:{}},values=new Map(saved?[['mf-appearance-v1',saved]]:[]);
 const media={matches:dark,addEventListener:(_,fn)=>listeners.media=fn};
 const context={window:{matchMedia:()=>media},localStorage:{getItem:k=>{if(blocked)throw Error('storage unavailable');return values.get(k);},setItem:(k,v)=>{if(blocked)throw Error('storage unavailable');values.set(k,v);}},document:{documentElement:root,querySelectorAll:()=>[],querySelector:()=>null,addEventListener:()=>{}}};
 vm.runInNewContext(source,context);return {api:context.window.MFAppearance,root,values,media,listeners};
}
test('appearance follows the system until the user chooses an explicit theme, then persists it',()=>{
 const f=fixture(null,true);assert.equal(f.root.dataset.theme,'dark');
 f.api.set('light');assert.equal(f.root.dataset.theme,'light');assert.equal(f.values.get('mf-appearance-v1'),'light');
 f.media.matches=true;f.listeners.media();assert.equal(f.root.dataset.theme,'light');
 f.api.set('system');assert.equal(f.root.dataset.theme,'dark');f.media.matches=false;f.listeners.media();assert.equal(f.root.dataset.theme,'light');
});
test('invalid stored preference and unavailable storage preserve a usable theme',()=>{
 for(const f of [fixture('invalid'),fixture(null,false,true)]){assert.equal(f.root.dataset.theme,'light');f.api.set('dark');assert.equal(f.root.dataset.theme,'dark');f.api.set('invalid');assert.equal(f.root.dataset.theme,'dark');}
});
