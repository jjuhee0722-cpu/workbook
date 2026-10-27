import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {transform} from '@babel/standalone';
import {loadAppSource} from './source.mjs';
const {source}=await loadAppSource();
const card=source.slice(source.indexOf('function Card('),source.indexOf('function SelectionBar('));
const calendar=source.slice(source.indexOf('function DateView('),source.indexOf('function TagView('));
let state=[],cursor=0,toggled=false,selected=false;
const context={React:{createElement:(type,props,...children)=>({type,props:props||{},children})},
useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],value=>state[i]=typeof value==='function'?value(state[i]):value];},
todayStr:()=> '2026-10-27',pad:n=>String(n).padStart(2,'0'),getDday:()=>null,fmtTs:String,sanitizeMemoHtml:x=>x};
for(const name of ['CatBadge','PriBadge','PhotoGallery','AttachList','TagChip','Empty'])context[name]=function(){};
runInNewContext(transform(card+calendar,{presets:['react']}).code+'\nthis.Card=Card;this.DateView=DateView;',context);
function nodes(tree){return tree&&typeof tree==='object'?[tree,...(tree.children||[]).flat(Infinity).flatMap(nodes)]:[];}
const task={id:'a',title:'제목',body:'긴 메모',bodyHtml:'<b>긴 메모</b>',date:'2026-10-27',category:'task',photos:['photo'],attachments:[]};
const props={entry:task,cats:[{id:'task',color:'#123456'}],selected:false,onSelect:()=>selected=true,onToggle:()=>toggled=true};
function renderCard(){cursor=0;return context.Card(props);}
let tree=renderCard();assert.ok(!nodes(tree).some(n=>n.type===context.PhotoGallery));
const title=nodes(tree).find(n=>n.props['aria-expanded']===false);title.props.onClick();
tree=renderCard();assert.ok(nodes(tree).some(n=>n.props.dangerouslySetInnerHTML?.__html==='<b>긴 메모</b>'));
nodes(tree).find(n=>n.props.type==='checkbox').props.onChange();assert.ok(selected);assert.equal(toggled,false);
nodes(tree).find(n=>n.props['aria-label']==='업무 완료 처리').props.onClick();assert.ok(toggled);
nodes(tree).find(n=>n.props['aria-expanded']===true).props.onClick();assert.ok(!nodes(renderCard()).some(n=>n.type===context.PhotoGallery));
state=[];
function renderCalendar(){cursor=0;return context.DateView({entries:[task],cats:props.cats,selected:new Set(),onEdit(){},onSelect(){}});}
tree=renderCalendar();assert.ok(nodes(tree).some(n=>n.props['aria-label']==='2026-10-27 업무 1건'&&n.props['aria-pressed']));
nodes(tree).find(n=>n.props['aria-label']==='표시할 연월').props.onChange({target:{value:'2026-12'}});
tree=renderCalendar();nodes(tree).find(n=>n.props['aria-label']==='다음 달').props.onClick();
tree=renderCalendar();assert.equal(nodes(tree).find(n=>n.props.type==='month').props.value,'2027-01');
nodes(tree).find(n=>n.children.includes('오늘')).props.onClick();
tree=renderCalendar();nodes(tree).find(n=>n.props['aria-label']==='날짜별 업무 목록 닫기').props.onClick();
tree=renderCalendar();assert.ok(!nodes(tree).some(n=>n.props['aria-label']==='선택한 날짜의 업무'));
nodes(tree).find(n=>n.props['aria-label']==='2026-10-27 업무 1건').props.onClick();
assert.ok(nodes(renderCalendar()).some(n=>n.props['aria-label']==='선택한 날짜의 업무'));
console.log('OK: collapsed memo/media, independent selection/completion, month rollover, today and close/reopen checks passed.');
