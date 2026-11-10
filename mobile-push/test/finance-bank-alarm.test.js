import test from 'node:test';
import assert from 'node:assert/strict';
import {PushHome} from '../src/worker.js';

const env={
  PERSONAL_QUARANTINE_ENABLED:'true',PLUGGY_SERVER_ENABLED:'true',
  PLUGGY_CLIENT_ID:'dummy-client-for-local-test',
  PLUGGY_CLIENT_SECRET:'dummy-server-secret-never-for-live',
  PLUGGY_ITEM_IDS:'dca4acf6-1dbe-4ad9-959b-4f2aa937e11a'
};
function storage(){
 const kv=new Map();let scheduled=null,deleted=false;
 return {kv,
  get:async k=>kv.get(k),put:async(k,v)=>{kv.set(k,v);},
  setAlarm:async n=>{scheduled=n;deleted=false;},
  deleteAlarm:async()=>{deleted=true;scheduled=null;},
  snapshot:()=>({scheduled,deleted})
 };
}
test('Preview Durable Object schedules autonomous 3h bank refresh even when Windows is closed',async()=>{
 const st=storage(),home=new PushHome({storage:st},env);
 const begin=Date.now();
 await home.scheduleNextBankSync(true);
 const next=st.kv.get('bank_next_sync');
 assert.ok(next>=begin+3*60*60*1000&&next<=Date.now()+3*60*60*1000);
 assert.equal(st.snapshot().scheduled,next);
 assert.equal(st.snapshot().deleted,false);
 await home.scheduleAlarm();
 assert.equal(st.snapshot().scheduled,next);
});

test('bank and push notifications share a durable alarm without deleting one another',async()=>{
 const st=storage(),home=new PushHome({storage:st},env);
 await home.scheduleNextBankSync(true);
 const bankAt=st.kv.get('bank_next_sync');
 const pushAt=Date.now()+60000;
 await st.put('events',[{id:'reminder',status:'queued',at:pushAt}]);
 await home.scheduleAlarm();
 assert.equal(st.snapshot().scheduled,pushAt);
 await st.put('events',[]);
 await home.scheduleAlarm();
 assert.equal(st.snapshot().scheduled,bankAt,'removing push events must retain bank refresh');
 await home.scheduleNextBankSync(false);
 const retry=st.kv.get('bank_next_sync');
 assert.ok(retry<bankAt,'failed bank refresh retries earlier');
 assert.equal(st.snapshot().scheduled,retry);
});

test('server polling stays inactive without an explicit Pluggy enable flag',async()=>{
 const st=storage(),home=new PushHome({storage:st},{
  ...env,PLUGGY_SERVER_ENABLED:'false'
 });
 await home.scheduleNextBankSync(true);
 assert.equal(st.kv.has('bank_next_sync'),false);
 await st.put('bank_next_sync',Date.now()+100000);
 await home.scheduleAlarm();
 assert.equal(st.snapshot().scheduled,null);
 assert.equal(st.snapshot().deleted,true);
});
