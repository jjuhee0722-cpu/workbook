import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {transform} from '@babel/standalone';

const source=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
const auth=source.slice(source.indexOf('function AuthGate()'),source.indexOf('function App({user})'));
const compiled=transform(auth,{presets:['react']}).code;
let states=[],cursor=0,effectStarted=false,listener,updates=0,request;
const store=new Map();
const context={
  RECOVERY_FROM_URL:false,SS:store,
  storageGet:(s,k)=>s.get(k),storageSet:(s,k,v)=>s.set(k,v),storageRemove:(s,k)=>s.delete(k),
  location:{origin:'https://jjuhee0722-cpu.github.io',pathname:'/workbook/'},
  useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},
  useEffect(fn){if(!effectStarted){effectStarted=true;fn();}},
  React:{createElement:(type,props,...children)=>({type,props:props||{},children})},
  App:()=>null,
  sb:{auth:{
    onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){}}}};},
    async getSession(){return {data:{session:null}};},
    async resetPasswordForEmail(email,options){request={email,options};return {};},
    async updateUser(){updates++;return {};},
  }},
};
runInNewContext(compiled+'\nthis.AuthGate=AuthGate;',context);
function render(){cursor=0;return context.AuthGate();}
function nodes(tree){return tree&&typeof tree==='object'?[tree,...(tree.children||[]).flat(Infinity).flatMap(nodes)]:[];}
function button(tree,label){const n=nodes(tree).find(n=>n.type==='button'&&n.children.includes(label));assert.ok(n,label);return n;}
function input(tree,label,value){const n=nodes(tree).find(n=>n.props['aria-label']===label);assert.ok(n,label);n.props.onChange({target:{value}});}

render();await Promise.resolve();await Promise.resolve();
button(render(),'비밀번호를 잊으셨나요?').props.onClick();
let tree=render();assert.ok(!nodes(tree).some(n=>n.props.type==='password'));
input(tree,'이메일',' user@example.com ');
await button(render(),'재설정 메일 보내기').props.onClick();
assert.equal(request.email,'user@example.com');
assert.equal(request.options.redirectTo,'https://jjuhee0722-cpu.github.io/workbook/');
listener('PASSWORD_RECOVERY',{user:{id:'test-user'}});
tree=render();assert.notEqual(tree.type,context.App);assert.equal(store.get('wb_password_recovery'),'1');
input(tree,'새 비밀번호','example-test-password');input(tree,'새 비밀번호 확인','mismatch');
await button(render(),'새 비밀번호 저장').props.onClick();assert.equal(updates,0);
input(render(),'새 비밀번호 확인','example-test-password');
await button(render(),'새 비밀번호 저장').props.onClick();assert.equal(updates,1);
assert.equal(store.has('wb_password_recovery'),false);assert.equal(render().type,context.App);
listener('PASSWORD_RECOVERY',null);
await button(render(),'새 비밀번호 저장').props.onClick();assert.equal(updates,1);
button(render(),'재설정 메일 다시 요청').props.onClick();button(render(),'재설정 메일 보내기');
console.log('OK: reset email, recovery gate, password confirmation, success and expired link checks passed.');
