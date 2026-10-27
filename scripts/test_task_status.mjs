import {loadAppSource} from './source.mjs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {transform} from '@babel/standalone';
const {source:html}=await loadAppSource();
let app=html.slice(html.indexOf('function App({user})'),html.indexOf('const domRoot'));
// Seed the local cache and skip asynchronous DB loading; exercise actual UI handlers.
app=app.replace('useState([])','useState(seedEntries)').replace(/(const \[dbReady,\s*setDbReady\]\s*=\s*useState\()false/,'$1true');
const selectionBar=html.slice(html.indexOf('function SelectionBar('),html.indexOf('// Store only a small'));
let state=[],cursor=0;
const context={seedEntries:[
  {id:'a',title:'미완료 업무',done:false,category:'task',updatedAt:1},
  {id:'b',title:'완료 업무',done:true,category:'task',updatedAt:2},
  {id:'c',title:'삭제 업무',done:false,deletedAt:1,category:'task'},
],React:{createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment'},
useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],value=>state[i]=typeof value==='function'?value(state[i]):value];},
useEffect(){},useCallback:fn=>fn,useRef:current=>({current}),
DEFAULT_CATS:[{id:'task',label:'할 일',color:'#123456'}],SS:null,LS:null,PW_SESSION:'session',PW_KEY:'pw',storageGet:()=>null,
isLiveRecord:e=>!e.deletedAt,navigator:{onLine:true},NAV_TABS:[],colorToBg:c=>c+'18',fmtTs:String,
};
for(const name of ['Card','Empty','DateView','TagView','PasteTab','ContactTab','EntryModal','CatManageModal','PasswordModal','LockScreen'])context[name]=function(){};
runInNewContext(transform(selectionBar+'\n'+app,{presets:['react']}).code+'\nthis.renderApp=App;this.renderBar=SelectionBar;',context);
function render(){cursor=0;return context.renderApp({user:{id:'test',email:'test@example.com'}});}
function nodes(tree){return tree&&typeof tree==='object'?[tree,...(tree.children||[]).flat(Infinity).flatMap(nodes)]:[];}
function cards(tree){return nodes(tree).filter(n=>n.type===context.Card);}
function filter(tree,label){const n=nodes(tree).find(n=>n.type==='button'&&n.children.join('').startsWith(label+' ('));assert.ok(n,label);n.props.onClick();}
function bar(tree){const n=nodes(tree).find(n=>n.type?.name==='SelectionBar');assert.ok(n);return context.renderBar(n.props);}
let tree=render();assert.equal(cards(tree).length,1);assert.equal(cards(tree)[0].props.entry.id,'a');
cards(tree)[0].props.onSelect('a');
tree=render();let action=nodes(bar(tree)).find(n=>n.type==='button'&&n.children.join('').includes('선택한 업무 완료'));
assert.equal(action.props.disabled,false);action.props.onClick();
tree=render();assert.equal(cards(tree).length,0);
filter(tree,'완료');tree=render();assert.equal(cards(tree).length,2);
cards(tree)[0].props.onSelect(cards(tree)[0].props.entry.id);tree=render();
assert.ok(nodes(bar(tree)).some(n=>n.children.includes('✓ 이미 완료됨')&&n.props.disabled));
action=nodes(bar(tree)).find(n=>n.type==='button'&&n.children.join('').includes('미완료로 되돌리기'));action.props.onClick();
tree=render();assert.equal(cards(tree).length,1);
filter(tree,'전체');tree=render();assert.equal(cards(tree).length,2);
cards(tree)[0].props.onSelect(cards(tree)[0].props.entry.id);tree=render();bar(tree);
filter(tree,'미완료');tree=render();assert.equal(cards(tree).length,1);
assert.ok(!nodes(tree).some(n=>n.type?.name==='SelectionBar'));
console.log('OK: active/completed/all filters, bulk completion, restore, tombstones and selection clearing passed.');
