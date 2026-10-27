import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {transform} from '@babel/standalone';
import {loadAppSource} from './source.mjs';
const {source}=await loadAppSource();
let app=source.slice(source.indexOf('function App({user})'),source.indexOf('const domRoot'));
app=app.replace('useState([])','useState(seedEntries)').replace(/(const \[dbReady,\s*setDbReady\]\s*=\s*useState\()false/,'$1true');
app=app.replace('  const blankForm=', '  testApi.current={flushPush,pullAndMerge,saveCatsWithMigrate,dataRef,localDirtyRef};\n  const blankForm=');
let states=[],refs=[],cursor=0,refCursor=0,dataEffect,pushResolve,pushed;
const context={seedEntries:[{id:'a',title:'A',category:'task',done:false,updatedAt:1},{id:'b',title:'B',category:'task',done:true,updatedAt:1}],testApi:{},
React:{createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment'},
useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},
useRef(initial){const i=refCursor++;return refs[i]||(refs[i]={current:initial});},
useCallback:fn=>fn,
useEffect(fn){if(/dataRef\.current\s*=\s*\{\s*entries/.test(String(fn)))dataEffect=fn;},
DEFAULT_CATS:[{id:'task',label:'원래 분류',color:'#123456'}],SS:null,LS:null,PW_SESSION:'s',PW_KEY:'p',storageGet:()=>null,
isLiveRecord:e=>!e.deletedAt,navigator:{onLine:true},NAV_TABS:[],colorToBg:c=>c+'18',fmtTs:String,
withSyncLock:fn=>fn(),withRetry:fn=>fn(),migrateEntry:e=>e,migrateContact:e=>e,
mergeRecords:local=>local,sameRecords:()=>true,
async sbPullRows(){return {entries:[],contacts:[],cats:context.DEFAULT_CATS};},
sbPushRows(_id,entries){pushed=entries;return new Promise(resolve=>pushResolve=resolve);},
};
for(const name of ['Card','Empty','DateView','TagView','ContactTab','EntryModal','CatManageModal','PasswordModal','LockScreen','SelectionBar'])context[name]=function(){};
runInNewContext(transform(app,{presets:['react']}).code+'\nthis.App=App;',context);
function render(){cursor=0;refCursor=0;const tree=context.App({user:{id:'test',email:'test@example.com'}});dataEffect?.();return tree;}
function nodes(t){return t&&typeof t==='object'?[t,...(t.children||[]).flat(Infinity).flatMap(nodes)]:[];}
let tree=render();const toggle=nodes(tree).find(n=>n.type===context.Card).props.onToggle;toggle('a');render();
const first=context.testApi.current.flushPush();
for(let i=0;i<8&&!pushResolve;i++)await Promise.resolve();
assert.ok(pushResolve);assert.equal(pushed.find(e=>e.id==='a').done,true);
// A new edit arrives while the earlier save is waiting on the server.
tree=render();toggle('b');render();
pushResolve();await first;render();
assert.equal(context.testApi.current.dataRef.current.entries.find(e=>e.id==='b').done,false);
assert.equal(context.testApi.current.localDirtyRef.current,true);
context.testApi.current.saveCatsWithMigrate([{id:'task',label:'변경한 분류',color:'#654321'}]);render();
await context.testApi.current.pullAndMerge();render();
assert.equal(context.testApi.current.dataRef.current.cats[0].label,'변경한 분류');
console.log('OK: edits made during a pending save and dirty local categories survive remote sync.');
