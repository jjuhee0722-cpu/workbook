function SaveBtn({list, onForceSave}) {
  const [st, setSt] = useState("idle"); // idle | saving | ok | error
  async function handleSave() {
    if(st==="saving") return;
    setSt("saving");
    try {
      await onForceSave([...list]);
      setSt("ok");
    } catch(e) {
      setSt("error");
    }
    setTimeout(()=>setSt("idle"), 2200);
  }
  const MAP = {
    idle:   {label:"💾 저장",  bg:"#27ae60", disabled:false},
    saving: {label:"저장 중…", bg:"#95a5a6", disabled:true},
    ok:     {label:"✓ 저장됨", bg:"#2ecc71", disabled:true},
    error:  {label:"⚠ 오류",   bg:"#e74c3c", disabled:false},
  };
  const m = MAP[st];
  return (
    <button onClick={handleSave} disabled={m.disabled}
      style={{padding:"10px 13px",background:m.bg,color:"#fff",border:"none",borderRadius:8,
        fontSize:13,fontWeight:700,cursor:m.disabled?"default":"pointer",
        transition:"background 0.2s",whiteSpace:"nowrap",flexShrink:0}}>
      {m.label}
    </button>
  );
}

function ContactTab({contacts,onSave,onForceSave}) {
  const [list,setList]       = useState(contacts);
  const [modal,setModal]     = useState(null);
  const [search,setSearch]   = useState("");
  const [dragIdx,setDragIdx] = useState(null);
  const [overIdx,setOverIdx] = useState(null);
  const cardRefs   = useRef([]);
  const dragIdxRef = useRef(null);
  const overIdxRef = useRef(null);

  useEffect(()=>{ setList(contacts); },[contacts]);

  const blank = ()=>({id:uid(),company:"",title:"",name:"",role:"",phone:"",email:"",memo:"",photos:[]});

  function save(form) {
    const next = modal.contact
      ? list.map(c=>c.id===modal.contact.id?{...form,id:modal.contact.id}:c)
      : [...list,{...form,id:uid()}];
    setList(next); onSave(next); setModal(null);
  }
  function del(id) {
    if(!window.confirm("삭제하시겠습니까?"))return;
    const next=list.filter(c=>c.id!==id); setList(next); onSave(next);
  }

  const filtered = list.filter(c=>{
    if(!search) return true;
    const q=search.toLowerCase();
    return [c.company,c.title,c.name,c.role,c.phone,c.email,c.memo].some(v=>(v||"").toLowerCase().includes(q));
  });

  // ── 드래그 앤 드롭 ──────────────────────────────────
  // listRef: commitDrag 클로저 내에서 항상 최신 list를 읽기 위해 사용
  const listRef = useRef(list);
  useEffect(()=>{ listRef.current = list; }, [list]);

  const lastYRef     = useRef(0);   // 마지막 포인터 Y (자동 스크롤 중 재평가용)
  const scrollSpdRef = useRef(0);   // 자동 스크롤 속도(px/frame)
  const rafRef       = useRef(null);

  const canDrag    = !search;
  const isDragging = dragIdx !== null;

  // 포인터 Y에 해당하는 카드 인덱스. 카드 위가 아니면(간격·목록 밖) 가장 가까운/끝 카드로 보정.
  function getCardAtY(y) {
    const n = filtered.length;
    let firstTop=Infinity, lastBottom=-Infinity, firstIdx=0, lastIdx=0;
    let bestIdx=null, bestDist=Infinity;
    for(let i=0;i<n;i++){
      const el=cardRefs.current[i];
      if(!el) continue;
      const r=el.getBoundingClientRect();
      if(r.top<firstTop){ firstTop=r.top; firstIdx=i; }
      if(r.bottom>lastBottom){ lastBottom=r.bottom; lastIdx=i; }
      if(y>=r.top && y<=r.bottom) return i;        // 카드 안 → 즉시 확정
      const c=(r.top+r.bottom)/2, d=Math.abs(y-c); // 간격일 때 대비, 중심 최근접 후보
      if(d<bestDist){ bestDist=d; bestIdx=i; }
    }
    if(bestIdx===null) return null;
    if(y<firstTop) return firstIdx;                // 목록 위쪽 밖 → 맨 앞
    if(y>lastBottom) return lastIdx;               // 목록 아래쪽 밖 → 맨 뒤
    return bestIdx;                                // 카드 사이 간격 → 최근접 카드
  }
  function beginDrag(i){
    dragIdxRef.current=i; overIdxRef.current=i;
    setDragIdx(i); setOverIdx(i);
  }
  function updateDrag(clientY){
    lastYRef.current=clientY;
    const idx=getCardAtY(clientY);
    if(idx!==null&&idx!==overIdxRef.current){ overIdxRef.current=idx; setOverIdx(idx); }
    // 화면 위/아래 가장자리에 가까우면 자동 스크롤 속도 설정
    const EDGE=90, MAX=18, h=window.innerHeight;
    if(clientY<EDGE)            scrollSpdRef.current = -Math.ceil((EDGE-clientY)/EDGE*MAX);
    else if(clientY>h-EDGE)     scrollSpdRef.current =  Math.ceil((clientY-(h-EDGE))/EDGE*MAX);
    else                        scrollSpdRef.current = 0;
  }
  function commitDrag(){
    const from=dragIdxRef.current, to=overIdxRef.current;
    if(from!==null&&to!==null&&from!==to){
      const arr=[...listRef.current];
      const [item]=arr.splice(from,1);
      arr.splice(to,0,item);
      setList(arr); onSave(arr);
    }
    scrollSpdRef.current=0;
    dragIdxRef.current=null; overIdxRef.current=null;
    setDragIdx(null); setOverIdx(null);
  }

  // 드래그 중에만 document 레벨 이벤트 + 가장자리 자동 스크롤 루프 등록
  // (touchmove에 passive:false 필수 — React 합성 이벤트로는 preventDefault 불가)
  useEffect(()=>{
    if(dragIdx===null) return;
    const onMouseMove =(e)=>updateDrag(e.clientY);
    const onMouseUp   =()=>commitDrag();
    const onTouchMove =(e)=>{ e.preventDefault(); updateDrag(e.touches[0].clientY); };
    const onTouchEnd  =()=>commitDrag();
    document.addEventListener('mousemove',  onMouseMove);
    document.addEventListener('mouseup',    onMouseUp);
    document.addEventListener('touchmove',  onTouchMove,  {passive:false});
    document.addEventListener('touchend',   onTouchEnd);
    document.addEventListener('touchcancel',onTouchEnd);

    let active=true;
    const step=()=>{
      if(!active) return;
      const spd=scrollSpdRef.current;
      if(spd!==0){
        window.scrollBy(0,spd);
        updateDrag(lastYRef.current); // 스크롤 후 포인터 아래 카드 다시 계산
      }
      rafRef.current=requestAnimationFrame(step);
    };
    rafRef.current=requestAnimationFrame(step);

    return ()=>{
      active=false;
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
      scrollSpdRef.current=0;
      document.removeEventListener('mousemove',  onMouseMove);
      document.removeEventListener('mouseup',    onMouseUp);
      document.removeEventListener('touchmove',  onTouchMove);
      document.removeEventListener('touchend',   onTouchEnd);
      document.removeEventListener('touchcancel',onTouchEnd);
    };
  },[dragIdx]);

  return (
    <div style={{paddingBottom:80}}>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <div style={{flex:1,position:"relative"}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#aaa",fontSize:14,pointerEvents:"none"}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="검색..." style={{width:"100%",padding:"10px 10px 10px 34px",border:"1px solid #ddd",borderRadius:8,fontSize:14,boxSizing:"border-box"}}/>
        </div>
        <SaveBtn list={list} onForceSave={onForceSave}/>
        <button onClick={()=>setModal({contact:null})} style={{padding:"10px 16px",background:"#1a1a2e",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
      </div>

      {canDrag&&filtered.length>1&&(
        <div style={{fontSize:11,color:"#bbb",marginBottom:10,textAlign:"center",letterSpacing:0.3}}>
          ☰ 핸들을 드래그해서 순서 변경
        </div>
      )}

      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"50px 0",color:"#bbb"}}>
          <div style={{fontSize:40,marginBottom:10}}>👤</div>
          <div style={{fontSize:14}}>담당자가 없습니다.</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10,userSelect:isDragging?"none":"auto"}}>
          {filtered.map((c,i)=>{
            const isDragItem = dragIdx===i;
            const isOver     = overIdx===i && !isDragItem;
            return (
              <div key={c.id}
                ref={el=>{ cardRefs.current[i]=el; }}
                style={{
                  background: isOver?"#eef7ff": isDragItem?"#f7f7f5":"#fff",
                  border:     isOver?"2px dashed #2980b9": isDragItem?"1px dashed #bbb":"1px solid #ddd",
                  borderLeft: isDragItem?"4px solid #ccc":isOver?"4px solid #2980b9":"4px solid #2980b9",
                  borderRadius:10, padding:"14px 14px",
                  opacity:    isDragItem?0.5:1,
                  transform:  isDragItem?"scale(1.015)":"none",
                  boxShadow:  isDragItem?"0 8px 24px rgba(0,0,0,0.13)":"none",
                  transition: isDragging?"opacity 0.1s,box-shadow 0.1s":"all 0.15s",
                }}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>

                  {/* ── 드래그 핸들 ── */}
                  {canDrag&&(
                    <div
                      onMouseDown={e=>{ e.preventDefault(); beginDrag(i); }}
                      onTouchStart={()=>beginDrag(i)}
                      style={{
                        display:"flex",alignItems:"center",justifyContent:"center",
                        flexShrink:0,width:36,alignSelf:"stretch",
                        cursor:isDragItem?"grabbing":"grab",
                        touchAction:"none",
                        userSelect:"none",WebkitUserSelect:"none",
                        color:isDragItem?"#2980b9":"#ccc",
                        fontSize:20,letterSpacing:-1,
                      }}>☰</div>
                  )}

                  <div style={{flex:1,minWidth:0,pointerEvents:isDragging?"none":"auto"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                      {c.company&&<span style={{fontSize:11,background:"#e8f4fd",color:"#2980b9",padding:"2px 8px",borderRadius:8,fontWeight:700}}>🏢 {c.company}</span>}
                      {c.title&&<span style={{fontSize:11,background:"#f0f0f0",color:"#555",padding:"2px 8px",borderRadius:8}}>{c.title}</span>}
                    </div>
                    <div style={{fontSize:16,fontWeight:700,color:"#1a1a2e",marginBottom:4}}>👤 {c.name||"(이름 없음)"}</div>
                    {c.role&&<div style={{fontSize:13,color:"#555",marginBottom:4}}>💼 {c.role}</div>}
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      {c.phone&&<a href={"tel:"+c.phone} style={{fontSize:13,color:"#2980b9",textDecoration:"none"}}>📞 {c.phone}</a>}
                      {c.email&&<a href={"mailto:"+c.email} style={{fontSize:13,color:"#27ae60",textDecoration:"none"}}>✉️ {c.email}</a>}
                    </div>
                    {c.memo&&<div style={{fontSize:12,color:"#888",marginTop:6,whiteSpace:"pre-wrap"}}>{c.memo}</div>}
                    <PhotoGallery photos={c.photos||(c.photo?[c.photo]:[])} thumbStyle={{width:80,height:80}}/>
                  </div>

                  <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0,pointerEvents:isDragging?"none":"auto"}}>
                    <button onClick={()=>!isDragging&&setModal({contact:c})} style={{padding:"5px 10px",border:"1px solid #ddd",borderRadius:6,background:"#fff",fontSize:11,cursor:"pointer",color:"#444"}}>수정</button>
                    <button onClick={()=>!isDragging&&del(c.id)} style={{padding:"5px 10px",border:"1px solid #fcc",borderRadius:6,background:"#fff",fontSize:11,cursor:"pointer",color:"#c0392b"}}>삭제</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 담당자 입력 모달 */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"16px 16px 0 0",padding:"20px 18px 36px",width:"100%",maxWidth:560,maxHeight:"88vh",overflowY:"auto",boxSizing:"border-box"}}>
            <div style={{width:40,height:4,background:"#ddd",borderRadius:2,margin:"0 auto 16px"}}/>
            <ContactForm initial={modal.contact||blank()} onSubmit={save} onCancel={()=>setModal(null)}/>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactForm({initial,onSubmit,onCancel}) {
  const [form,setForm] = useState({...initial, photos:initial.photos||(initial.photo?[initial.photo]:[])});
  const [uploading,setUploading] = useState(false);
  const photoRef = useRef(null);
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  async function addPhotos(files){ setUploading(true); try{ const arr=await Promise.all(Array.from(files).map(uploadPhoto)); setForm(p=>({...p,photos:[...(p.photos||[]),...arr]})); } catch(e){ alert("사진 업로드 실패: "+(e?.message||e)); } finally{ setUploading(false); } }
  const fields=[
    {key:"company",label:"🏢 회사",   placeholder:"소속 기관 / 회사명"},
    {key:"title",  label:"🪪 직함",   placeholder:"직위 / 직책"},
    {key:"name",   label:"👤 성함 *", placeholder:"담당자 이름"},
    {key:"role",   label:"💼 업무",   placeholder:"담당 업무 내용"},
    {key:"phone",  label:"📞 연락처", placeholder:"010-0000-0000"},
    {key:"email",  label:"✉️ 이메일", placeholder:"example@example.com"},
  ];
  return (
    <div>
      <div style={{fontWeight:700,fontSize:16,color:"#1a1a2e",marginBottom:16}}>{initial.name?"담당자 수정":"담당자 추가"}</div>

      {/* 명함 사진 */}
      <Lbl>📇 명함 사진 (여러 장 가능)</Lbl>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"flex-start"}}>
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


      {fields.map(({key,label,placeholder})=>(
        <div key={key} style={{marginBottom:12}}>
          <Lbl>{label}</Lbl>
          <input value={form[key]||""} onChange={e=>f(key,e.target.value)} placeholder={placeholder}
            style={{width:"100%",padding:"10px",border:"1px solid #ddd",borderRadius:8,fontSize:14,boxSizing:"border-box"}}/>
        </div>
      ))}
      <div style={{marginBottom:20}}>
        <Lbl>📝 메모</Lbl>
        <textarea value={form.memo||""} onChange={e=>f("memo",e.target.value)} placeholder="기타 메모..." rows={3}
          style={{width:"100%",padding:"10px",border:"1px solid #ddd",borderRadius:8,fontSize:14,resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onCancel} style={{flex:1,padding:"13px",border:"1px solid #ddd",borderRadius:10,background:"#fff",fontSize:15,cursor:"pointer",color:"#555"}}>취소</button>
        <button onClick={()=>{if(form.name?.trim())onSubmit(form);else alert("성함을 입력해주세요.");}} style={{flex:2,padding:"13px",border:"none",borderRadius:10,background:"#1a1a2e",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"}}>{initial.name?"수정 완료":"저장"}</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  날짜별 / 태그별 탭
// ══════════════════════════════════════════════════════════
