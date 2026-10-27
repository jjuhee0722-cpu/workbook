import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {loadAppSource} from './source.mjs';
const {source}=await loadAppSource();
const deadline=source.slice(source.indexOf('async function fetchWithDeadline('),source.indexOf('const sb ='));
const payload=source.slice(source.indexOf('function stableJson('),source.indexOf('function makeBaseline('));
let observedSignal;
const context={AbortController,Response,setTimeout,clearTimeout,
  fetch:async()=>new Response('{"ok":true}',{headers:{'Content-Type':'application/json'}}),
};
runInNewContext(deadline+payload+'\nthis.api={fetchWithDeadline,cleanPayload,stableJson};',context);
const {fetchWithDeadline,cleanPayload,stableJson}=context.api;
assert.equal((await (await fetchWithDeadline('https://test.invalid')).json()).ok,true);
context.fetch=(_input,options)=>new Promise((_resolve,reject)=>{
  observedSignal=options.signal;
  if(options.signal.aborted)reject(new Error('aborted'));
  else options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
});
await assert.rejects(fetchWithDeadline('https://test.invalid',{},5),e=>e.code==='SYNC_TIMEOUT');
assert.equal(observedSignal.aborted,true);
const controller=new AbortController();
const pending=fetchWithDeadline('https://test.invalid',{signal:controller.signal},100);
controller.abort();await assert.rejects(pending,/aborted/);
assert.equal(stableJson(cleanPayload({photos:[{path:'user/photo',url:'old'}]})),stableJson(cleanPayload({photos:[{path:'user/photo',url:'renewed'}]})));
assert.equal(cleanPayload({body:'keep',url:'external'}).url,'external');
console.log('OK: request deadline, cancellation, JSON response and stable Storage payload checks passed.');
