'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {q1NativeWindow}=require('../electron/q1-native-window.cjs');
test('native QA sizing requires a validated synthetic profile and known preset',()=>{
 assert.equal(q1NativeWindow(false,null),null);
 assert.throws(()=>q1NativeWindow(false,'1366x768'),/sintético/);
 assert.throws(()=>q1NativeWindow(true,'arbitrary'),/inválido/);
 assert.deepEqual(q1NativeWindow(true,'1366x768'),{width:1380,height:775,x:0,y:0});
});
