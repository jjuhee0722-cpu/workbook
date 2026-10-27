const Lbl = ({children}) => <div style={{fontSize:11,color:"#888",marginBottom:3}}>{children}</div>;

function MobSelect({value,onChange,children,style}) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",padding:"10px 8px",border:"1px solid #ddd",borderRadius:8,fontSize:14,background:"#fff",boxSizing:"border-box",...style}}>
      {children}
    </select>
  );
}

function TagChip({tag,onRemove,onClick,active}) {
  return (
    <span onClick={onClick}
      style={{display:"inline-flex",alignItems:"center",gap:3,background:active?"#1a1a2e":"#ececec",color:active?"#fff":"#555",borderRadius:12,padding:"3px 10px",fontSize:11,cursor:onClick||onRemove?"pointer":"default",fontWeight:active?700:400,userSelect:"none"}}>
      #{tag}
      {onRemove&&<span onClick={e=>{e.stopPropagation();onRemove();}} style={{marginLeft:2,opacity:0.6,lineHeight:1}}>✕</span>}
    </span>
  );
}

function CatBadge({id,cats}) {
  const c=cats.find(x=>x.id===id)||cats[0]||{icon:"◆",label:id,color:"#888"};
  return <span style={{fontSize:10,background:colorToBg(c.color),color:c.color,padding:"2px 8px",borderRadius:10,fontWeight:700,border:"1px solid "+c.color+"33",whiteSpace:"nowrap"}}>{c.icon} {c.label}</span>;
}
function PriBadge({id}) {
  const p=PRIS.find(x=>x.id===id)||PRIS[1];
  return <span style={{fontSize:10,color:p.color,fontWeight:700,whiteSpace:"nowrap"}}>● {p.label}</span>;
}

// ══════════════════════════════════════════════════════════
//  항목 카드
// ══════════════════════════════════════════════════════════
function Card({entry,cats,selected,onSelect,onEdit,onDelete,onToggle}) {
  const [expanded,setExpanded]=useState(false);
  const cat  = cats.find(c=>c.id===entry.category)||cats[0]||{color:"#888"};
  const dday = getDday(entry.deadline);
  return (
    <div style={{background:selected?"#eef4ff":entry.done?"#f7f7f5":"#fff",border:"1px solid "+(selected?"#2980b9":entry.done?"#e5e5e0":"#ddd"),borderLeft:"4px solid "+(selected?"#2980b9":entry.done?"#bbb":cat.color),borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"flex-start",gap:10,transition:"background 0.15s"}}>

      {/* 선택 체크박스 */}
      <input type="checkbox" aria-label={`${entry.title} 선택`} checked={selected} onChange={()=>onSelect(entry.id)} style={{marginTop:3,flexShrink:0,width:22,height:22,accentColor:"#2980b9",cursor:"pointer"}}/>

      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:5}}>
          <CatBadge id={entry.category} cats={cats}/>
          {!entry.done&&<PriBadge id={entry.priority}/>}
          {entry.date&&<span style={{fontSize:10,color:"#bbb"}}>{"📅 "+entry.date}</span>}
          {entry.deadline&&!entry.done&&dday&&(
            <span style={{fontSize:10,fontWeight:700,color:dday.color,background:dday.color+"22",padding:"2px 7px",borderRadius:8}}>{"🗓 "+entry.deadline+" ("+dday.label+")"}</span>
          )}
          {entry.done&&<span style={{fontSize:10,color:"#27ae60",fontWeight:700}}>✓ 완료</span>}
        </div>
        <button type="button" aria-expanded={expanded} aria-controls={`task-details-${entry.id}`} onClick={()=>setExpanded(v=>!v)} style={{display:"block",width:"100%",padding:0,border:0,background:"transparent",textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontSize:15,fontWeight:700,lineHeight:1.5,wordBreak:"break-word",color:entry.done?"#888":"#1a1a2e",textDecoration:entry.done?"line-through":"none"}}>{entry.title}<span style={{marginLeft:8,fontSize:11,color:"#777",fontWeight:400}}>{expanded?"▴ 접기":"▾ 펼치기"}</span></button>
        {!expanded&&<div style={{marginTop:6,fontSize:11,color:"#999"}}>{[entry.body||entry.bodyHtml?"메모 있음":"",(entry.photos?.length||entry.photo)?`사진 ${entry.photos?.length||1}장`:"",entry.attachments?.length?`첨부 ${entry.attachments.length}개`:""].filter(Boolean).join(" · ")}</div>}
        {expanded&&<div id={`task-details-${entry.id}`} style={{borderTop:"1px solid #eee",paddingTop:10,marginTop:10}}>
        {entry.bodyHtml?<div style={{fontSize:14,color:entry.done?"#bbb":"#666",marginTop:5,whiteSpace:"pre-wrap",wordBreak:"break-word",lineHeight:1.6}} dangerouslySetInnerHTML={{__html:sanitizeMemoHtml(entry.bodyHtml)}}/>:entry.body&&<div style={{fontSize:13,color:entry.done?"#bbb":"#666",marginTop:5,whiteSpace:"pre-wrap",wordBreak:"break-word",lineHeight:1.6}}>{entry.body}</div>}
        <div style={{opacity:entry.done?0.5:1}}>
          <PhotoGallery photos={entry.photos||(entry.photo?[entry.photo]:[])} />
          <AttachList attachments={entry.attachments||[]}/>
        </div>
        {entry.tags&&entry.tags.length>0&&(
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6,opacity:entry.done?0.5:1}}>
            {entry.tags.map(t=><TagChip key={t} tag={t}/>)}
          </div>
        )}
        <div style={{fontSize:10,color:"#ccc",marginTop:5}}>{fmtTs(entry.updatedAt)}</div>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button onClick={()=>onEdit(entry)} style={{padding:"7px 12px",border:"1px solid #ddd",borderRadius:7,background:"#fff",color:"#444",cursor:"pointer"}}>수정</button>
          <button onClick={()=>onDelete(entry.id)} style={{padding:"7px 12px",border:"1px solid #fcc",borderRadius:7,background:"#fff",color:"#c0392b",cursor:"pointer"}}>삭제</button>
        </div>
        </div>}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
        <button onClick={()=>onToggle(entry.id)} aria-label={entry.done?"미완료로 되돌리기":"업무 완료 처리"} style={{padding:"5px 8px",border:"1px solid #ddd",borderRadius:6,background:"#fff",fontSize:11,cursor:"pointer",color:entry.done?"#888":"#16854b",minWidth:44}}>{entry.done?"↩ 미완료로":"✓ 완료"}</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  선택 액션 바
// ══════════════════════════════════════════════════════════
function SelectionBar({selected,entries,cats,onClear,onMarkDone,onMarkUndone,onDelete,barRef}) {
  const selEntries  = entries.filter(e=>selected.has(e.id));
  const doneCount   = selEntries.filter(e=>e.done).length;
  const undoneCount = selEntries.length - doneCount;
  const catCounts   = {};
  selEntries.forEach(e=>{ catCounts[e.category]=(catCounts[e.category]||0)+1; });
  const catSummary  = Object.entries(catCounts).map(([id,cnt])=>{ const c=cats.find(x=>x.id===id)||{icon:"◆",label:id,color:"#888"}; return {c,cnt}; });

  return (
    <div ref={barRef} style={{background:"#1a1a2e",color:"#fff",padding:"8px 14px 10px",boxShadow:"0 3px 12px rgba(0,0,0,0.3)"}}>
      {/* 선택 요약 */}
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
        <span style={{fontWeight:700,fontSize:13}}>{selected.size}개 선택됨</span>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {catSummary.map(({c,cnt})=>(
            <span key={c.id||c.label} style={{fontSize:10,background:colorToBg(c.color),color:c.color,padding:"2px 7px",borderRadius:10,fontWeight:700,border:"1px solid "+c.color+"44"}}>
              {c.icon} {c.label} {cnt}
            </span>
          ))}
        </div>
      </div>
      {/* 선택 항목 제목 */}
      <div style={{fontSize:11,color:"#aaa",marginBottom:8,lineHeight:1.6,maxHeight:44,overflowY:"auto"}}>
        {selEntries.map(e=>(
          <span key={e.id} style={{display:"inline-block",background:"rgba(255,255,255,0.1)",borderRadius:5,padding:"1px 7px",margin:"2px 3px 2px 0"}}>
            {e.title.length>18?e.title.slice(0,18)+"…":e.title}
          </span>
        ))}
      </div>
      {/* 액션 */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <button disabled={!undoneCount} onClick={onMarkDone} style={{padding:"8px 12px",border:"none",borderRadius:7,background:undoneCount?"#16854b":"#59625e",color:"#fff",fontSize:12,fontWeight:700,cursor:undoneCount?"pointer":"default"}}>{undoneCount?`✓ 선택한 업무 완료 (${undoneCount})`:"✓ 이미 완료됨"}</button>
        {doneCount>0&&<button onClick={onMarkUndone} style={{padding:"8px 12px",border:"none",borderRadius:7,background:"#e67e22",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>↩ 미완료로 되돌리기 ({doneCount})</button>}
        <button onClick={()=>{if(window.confirm(selected.size+"개를 삭제하시겠습니까?"))onDelete();}} style={{padding:"6px 12px",border:"none",borderRadius:7,background:"#c0392b",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>🗑 삭제({selected.size})</button>
        <button onClick={onClear} style={{padding:"6px 10px",border:"1px solid rgba(255,255,255,0.3)",borderRadius:7,background:"transparent",color:"#ccc",fontSize:12,cursor:"pointer"}}>선택 해제</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  항목 입력 모달
// ══════════════════════════════════════════════════════════
// Store only a small, inert subset of HTML; body stays plain text for search/export.
function sanitizeMemoHtml(html) {
  const source=new DOMParser().parseFromString(String(html||""),"text/html");
  const output=document.createElement("div");
  const allowed=new Set(["B","STRONG","SPAN","DIV","P","BR","FONT"]);
  const blocked=new Set(["SCRIPT","STYLE","IFRAME","OBJECT","SVG","MATH","TEMPLATE"]);
  function copy(node,parent){
    if(node.nodeType===3){parent.appendChild(document.createTextNode(node.textContent));return;}
    if(node.nodeType!==1||blocked.has(node.tagName))return;
    if(!allowed.has(node.tagName)){Array.from(node.childNodes).forEach(n=>copy(n,parent));return;}
    const el=document.createElement(node.tagName==="FONT"?"span":node.tagName.toLowerCase());
    const color=node.style.color||node.getAttribute("color")||"";
    if(/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(color))el.style.color=color;
    const size=node.style.fontSize||({2:"12px",3:"14px",5:"20px"}[node.getAttribute("size")]||"");
    if(["12px","14px","20px"].includes(size))el.style.fontSize=size;
    if(["bold","700"].includes(node.style.fontWeight))el.style.fontWeight="700";
    Array.from(node.childNodes).forEach(n=>copy(n,el));parent.appendChild(el);
  }
  Array.from(source.body.childNodes).forEach(n=>copy(n,output));
  return output.innerHTML;
}

function MemoEditor({initial,onChange}) {
  const editor=useRef(null);
  const selection=useRef(null);
  useEffect(()=>{
    const el=editor.current;
    if(initial.bodyHtml)el.innerHTML=sanitizeMemoHtml(initial.bodyHtml);
    else el.textContent=initial.body||"";
    function remember(){
      const s=window.getSelection();
      if(s?.rangeCount&&el.contains(s.anchorNode)&&el.contains(s.focusNode))selection.current=s.getRangeAt(0).cloneRange();
    }
    document.addEventListener("selectionchange",remember);
    return ()=>document.removeEventListener("selectionchange",remember);
  },[]);
  function emit(){
    const el=editor.current;
    onChange({body:el.innerText,bodyHtml:sanitizeMemoHtml(el.innerHTML)});
  }
  function format(command,value){
    const el=editor.current;el.focus();
    const s=window.getSelection();
    if(selection.current&&el.contains(selection.current.commonAncestorContainer)){
      s.removeAllRanges();s.addRange(selection.current);
    }
    document.execCommand(command,false,value);
    if(s.rangeCount)selection.current=s.getRangeAt(0).cloneRange();
    emit();
  }
  const buttonStyle={padding:"7px 10px",border:"1px solid #ddd",borderRadius:7,background:"#fff",cursor:"pointer",fontSize:13};
  return <div style={{marginBottom:12}}>
    <div role="toolbar" aria-label="메모 서식" style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",padding:8,background:"#f6f6f6",border:"1px solid #ddd",borderRadius:"8px 8px 0 0"}}>
      <button type="button" title="선택한 글씨 굵게" onMouseDown={e=>e.preventDefault()} onClick={()=>format("bold")} style={{...buttonStyle,fontWeight:800}}>굵게 B</button>
      <select aria-label="글씨 크기" defaultValue="" onChange={e=>{format("fontSize",e.target.value);e.target.value="";}} style={buttonStyle}>
        <option value="" disabled>글씨 크기</option><option value="2">작게 (12)</option><option value="3">보통 (14)</option><option value="5">크게 (20)</option>
      </select>
      {[['기본','#666666'],['빨강','#c0392b'],['파랑','#2980b9'],['초록','#16854b'],['보라','#8e44ad']].map(([label,color])=><button key={color} type="button" aria-label={label+" 글씨"} title={label} onMouseDown={e=>e.preventDefault()} onClick={()=>format("foreColor",color)} style={{...buttonStyle,padding:8}}><span style={{display:"block",width:16,height:16,borderRadius:"50%",background:color}}/></button>)}
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>format("removeFormat")} style={buttonStyle}>서식 지우기</button>
    </div>
    <div ref={editor} contentEditable suppressContentEditableWarning role="textbox" aria-label="메모 내용" aria-multiline="true" onInput={emit} onBlur={emit}
      onPaste={e=>{e.preventDefault();document.execCommand("insertText",false,e.clipboardData.getData("text/plain"));emit();}}
      onDrop={e=>e.preventDefault()}
      style={{width:"100%",padding:10,border:"1px solid #ddd",borderTop:0,borderRadius:"0 0 8px 8px",fontSize:14,minHeight:160,lineHeight:1.7,whiteSpace:"pre-wrap",overflowWrap:"anywhere",outlineOffset:2}}/>
    <div style={{fontSize:11,color:"#888",marginTop:5}}>문장을 선택한 뒤 크기·굵기·색상을 지정하세요.</div>
  </div>;
}

function EntryModal({initial,cats,onSubmit,onCancel}) {
  const [form,setForm]         = useState({...initial, photos:initial.photos||(initial.photo?[initial.photo]:[]), attachments:initial.attachments||[]});
  const [tagInput,setTagInput] = useState("");
  const [uploading,setUploading] = useState(false);
  const photoRef = useRef(null);
  const fileRef  = useRef(null);
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const addTag=()=>{const t=tagInput.trim().replace(/^#/,"");if(!t||(form.tags||[]).includes(t)){setTagInput("");return;}f("tags",[...(form.tags||[]),t]);setTagInput("");};
  async function addPhotos(files){ setUploading(true); try{ const arr=await Promise.all(Array.from(files).map(uploadPhoto)); setForm(p=>({...p,photos:[...(p.photos||[]),...arr]})); } catch(e){ alert("사진 업로드 실패: "+(e?.message||e)); } finally{ setUploading(false); } }
  async function addFiles(files){ setUploading(true); try{ const atts=await Promise.all(Array.from(files).map(uploadAttachment)); setForm(p=>({...p,attachments:[...(p.attachments||[]),...atts]})); } catch(e){ alert("첨부 업로드 실패: "+(e?.message||e)); } finally{ setUploading(false); } }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onCancel}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"16px 16px 0 0",padding:"20px 18px 36px",width:"100%",maxWidth:600,maxHeight:"92vh",overflowY:"auto",boxSizing:"border-box"}}>
        <div style={{width:40,height:4,background:"#ddd",borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{fontWeight:700,fontSize:16,color:"#1a1a2e",marginBottom:16}}>{initial.id?"항목 수정":"새 항목 추가"}</div>

        <Lbl>분류</Lbl>
        <MobSelect value={form.category} onChange={v=>f("category",v)} style={{marginBottom:12}}>
          {cats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </MobSelect>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div><Lbl>우선순위</Lbl><MobSelect value={form.priority} onChange={v=>f("priority",v)}>{PRIS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</MobSelect></div>
          <div><Lbl>작성 날짜</Lbl><input type="date" value={form.date} onChange={e=>f("date",e.target.value)} style={{width:"100%",padding:"10px 8px",border:"1px solid #ddd",borderRadius:8,fontSize:14,boxSizing:"border-box"}}/></div>
        </div>

        <Lbl>🗓 마감기한 (선택)</Lbl>
        <input type="date" value={form.deadline||""} onChange={e=>f("deadline",e.target.value)} style={{width:"100%",padding:"10px 8px",border:"1px solid #ddd",borderRadius:8,fontSize:14,boxSizing:"border-box",marginBottom:12}}/>

        <Lbl>제목 *</Lbl>
        <input value={form.title} onChange={e=>f("title",e.target.value)} placeholder="제목을 입력하세요"
          style={{width:"100%",padding:"11px 10px",border:"1px solid #ddd",borderRadius:8,fontSize:15,boxSizing:"border-box",marginBottom:12}}/>

        <Lbl>내용</Lbl>
        <MemoEditor initial={initial} onChange={value=>setForm(p=>({...p,...value}))}/>

        <Lbl>📷 사진 (여러 장 가능)</Lbl>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10,alignItems:"flex-start"}}>
          {(form.photos||[]).map((src,i)=>(
            <div key={i} style={{position:"relative",display:"inline-block",flexShrink:0}}>
              <img src={photoSrc(src)} style={{width:72,height:72,objectFit:"cover",borderRadius:6,border:"1px solid #ddd",display:"block"}}/>
              <button onClick={()=>f("photos",(form.photos||[]).filter((_,j)=>j!==i))}
                style={{position:"absolute",top:-7,right:-7,background:"#e74c3c",color:"#fff",border:"none",borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1}}>✕</button>
            </div>
          ))}
          <button onClick={()=>!uploading&&photoRef.current?.click()}
            style={{width:72,height:72,border:"2px dashed #ccc",borderRadius:6,background:"#fafafa",fontSize:24,cursor:uploading?"default":"pointer",color:"#bbb",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{uploading?<span style={{display:"inline-block",fontSize:18,animation:"spin 1s linear infinite"}}>⟳</span>:"＋"}</button>
        </div>
        <input ref={photoRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{if(e.target.files.length)addPhotos(e.target.files);e.target.value="";}}/>

        <Lbl>📎 파일 첨부 (선택)</Lbl>
        {(form.attachments||[]).length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:8}}>
            {(form.attachments||[]).map((att,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#f5f5f5",borderRadius:7,padding:"6px 10px",border:"1px solid #eee"}}>
                <span style={{fontSize:15,flexShrink:0}}>{attachIcon(att.type)}</span>
                <span style={{flex:1,fontSize:12,color:"#444",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name}</span>
                {att.size&&<span style={{fontSize:11,color:"#aaa",flexShrink:0}}>{fmtSize(att.size)}</span>}
                <button onClick={()=>f("attachments",(form.attachments||[]).filter((_,j)=>j!==i))}
                  style={{background:"none",border:"none",color:"#c0392b",cursor:"pointer",fontSize:16,flexShrink:0,padding:"0 2px"}}>✕</button>
              </div>
            ))}
          </div>
        )}
        <button onClick={()=>!uploading&&fileRef.current?.click()} style={{width:"100%",padding:"10px",border:"2px dashed #ddd",borderRadius:8,background:"#fafafa",fontSize:13,cursor:uploading?"default":"pointer",color:"#888",marginBottom:12}}>{uploading?"⟳ 업로드 중…":"📎 파일 선택 (PDF·엑셀·Word 등)"}</button>
        <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={e=>{if(e.target.files.length)addFiles(e.target.files);e.target.value="";}}/>


        <Lbl>태그</Lbl>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>{(form.tags||[]).map(t=><TagChip key={t} tag={t} onRemove={()=>f("tags",form.tags.filter(x=>x!==t))}/>)}</div>
        <div style={{display:"flex",gap:6,marginBottom:20}}>
          <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag();}}} placeholder="#태그 입력 후 Enter" style={{flex:1,padding:"10px",border:"1px solid #ddd",borderRadius:8,fontSize:14}}/>
          <button onClick={addTag} style={{padding:"10px 14px",border:"1px solid #ddd",borderRadius:8,background:"#fff",fontSize:13,cursor:"pointer"}}>추가</button>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"13px",border:"1px solid #ddd",borderRadius:10,background:"#fff",fontSize:15,cursor:"pointer",color:"#555"}}>취소</button>
          <button onClick={()=>{if(form.title.trim())onSubmit(form);}} style={{flex:2,padding:"13px",border:"none",borderRadius:10,background:"#1a1a2e",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"}}>{initial.id?"수정 완료":"저장"}</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  분류 관리 모달
// ══════════════════════════════════════════════════════════
function CatManageModal({cats,onSave,onClose}) {
  const [list,setList]       = useState(cats.map(c=>({...c})));
  const [editing,setEditing] = useState(null);
  const [newLabel,setNewLabel]= useState("");
  const [newIcon,setNewIcon]  = useState("◆");
  const [newColor,setNewColor]= useState("#2980b9");

  const upd=(id,k,v)=>setList(p=>p.map(c=>c.id===id?{...c,[k]:v}:c));
  const del=(id)=>{ if(list.length<=1){alert("최소 1개 필요");return;} if(!window.confirm("삭제 시 해당 분류 항목은 첫 번째 분류로 이동합니다."))return; setList(p=>p.filter(c=>c.id!==id)); };
  const add=()=>{ if(!newLabel.trim())return; setList(p=>[...p,{id:uid(),label:newLabel.trim(),icon:newIcon,color:newColor}]); setNewLabel("");setNewIcon("◆");setNewColor("#2980b9"); };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"16px 16px 0 0",padding:"20px 18px 36px",width:"100%",maxWidth:560,maxHeight:"88vh",overflowY:"auto",boxSizing:"border-box"}}>
        <div style={{width:40,height:4,background:"#ddd",borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{fontWeight:700,fontSize:16,color:"#1a1a2e",marginBottom:16}}>분류 관리</div>

        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          {list.map(cat=>(
            <div key={cat.id} style={{border:"1px solid #eee",borderRadius:10,padding:"10px 12px",borderLeft:"4px solid "+cat.color,background:colorToBg(cat.color)+"44"}}>
              {editing===cat.id?(
                <div>
                  <div style={{marginBottom:8}}><Lbl>이름</Lbl><input value={cat.label} onChange={e=>upd(cat.id,"label",e.target.value)} style={{width:"100%",padding:"8px 10px",border:"1px solid #ddd",borderRadius:7,fontSize:14,boxSizing:"border-box"}}/></div>
                  <div style={{marginBottom:8}}><Lbl>아이콘</Lbl><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{ICON_OPTIONS.map(ic=><button key={ic} onClick={()=>upd(cat.id,"icon",ic)} style={{width:34,height:34,border:cat.icon===ic?"2px solid "+cat.color:"1px solid #ddd",borderRadius:7,background:cat.icon===ic?colorToBg(cat.color):"#fff",fontSize:16,cursor:"pointer"}}>{ic}</button>)}</div></div>
                  <div style={{marginBottom:10}}><Lbl>색상</Lbl><div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>{COLOR_PRESETS.map(col=><div key={col} onClick={()=>upd(cat.id,"color",col)} style={{width:26,height:26,borderRadius:"50%",background:col,cursor:"pointer",border:cat.color===col?"3px solid #1a1a2e":"2px solid transparent"}}/>)}<input type="color" value={cat.color} onChange={e=>upd(cat.id,"color",e.target.value)} style={{width:26,height:26,border:"none",borderRadius:"50%",cursor:"pointer",padding:0}}/></div></div>
                  <button onClick={()=>setEditing(null)} style={{padding:"7px 16px",border:"none",borderRadius:7,background:"#1a1a2e",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>완료</button>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18}}>{cat.icon}</span>
                  <span style={{flex:1,fontSize:14,fontWeight:600,color:cat.color}}>{cat.label}</span>
                  <button onClick={()=>setEditing(cat.id)} style={{padding:"5px 12px",border:"1px solid #ddd",borderRadius:6,background:"#fff",fontSize:12,cursor:"pointer",color:"#444"}}>수정</button>
                  <button onClick={()=>del(cat.id)} style={{padding:"5px 10px",border:"1px solid #fcc",borderRadius:6,background:"#fff",fontSize:12,cursor:"pointer",color:"#c0392b"}}>삭제</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{border:"1px dashed #ccc",borderRadius:10,padding:"14px"}}>
          <div style={{fontWeight:700,fontSize:13,color:"#555",marginBottom:10}}>+ 새 분류 추가</div>
          <Lbl>이름</Lbl>
          <input value={newLabel} onChange={e=>setNewLabel(e.target.value)} placeholder="분류 이름" style={{width:"100%",padding:"9px 10px",border:"1px solid #ddd",borderRadius:7,fontSize:14,boxSizing:"border-box",marginBottom:10}}/>
          <Lbl>아이콘</Lbl>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>{ICON_OPTIONS.map(ic=><button key={ic} onClick={()=>setNewIcon(ic)} style={{width:32,height:32,border:newIcon===ic?"2px solid #1a1a2e":"1px solid #ddd",borderRadius:7,background:newIcon===ic?"#e8e8f0":"#fff",fontSize:15,cursor:"pointer"}}>{ic}</button>)}</div>
          <Lbl>색상</Lbl>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>{COLOR_PRESETS.map(col=><div key={col} onClick={()=>setNewColor(col)} style={{width:24,height:24,borderRadius:"50%",background:col,cursor:"pointer",border:newColor===col?"3px solid #1a1a2e":"2px solid transparent"}}/>)}<input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)} style={{width:24,height:24,border:"none",borderRadius:"50%",cursor:"pointer",padding:0}}/></div>
          <button onClick={add} disabled={!newLabel.trim()} style={{width:"100%",padding:"11px",border:"none",borderRadius:9,background:newLabel.trim()?"#1a1a2e":"#ccc",color:"#fff",fontSize:14,fontWeight:700,cursor:newLabel.trim()?"pointer":"not-allowed"}}>추가</button>
        </div>

        <div style={{display:"flex",gap:10,marginTop:18}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",border:"1px solid #ddd",borderRadius:10,background:"#fff",fontSize:15,cursor:"pointer",color:"#555"}}>취소</button>
          <button onClick={()=>{onSave(list);onClose();}} style={{flex:2,padding:"13px",border:"none",borderRadius:10,background:"#27ae60",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"}}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  담당자 연락처 탭
// ══════════════════════════════════════════════════════════
// 담당자 탭 전용 저장 버튼 (상태 피드백 포함)
