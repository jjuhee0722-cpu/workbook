function PhotoViewer({photos, startIndex, onClose}) {
  const [idx,   setIdx]   = useState(startIndex||0);
  const [scale, setScale] = useState(1);
  const pinchRef = useRef(null);

  useEffect(()=>{ setScale(1); },[idx]);

  const prev = e=>{ e.stopPropagation(); setIdx(i=>(i-1+photos.length)%photos.length); };
  const next = e=>{ e.stopPropagation(); setIdx(i=>(i+1)%photos.length); };

  function download(e) {
    e.stopPropagation();
    const src=photoSrc(photos[idx]);
    if(src.startsWith("data:")){
      const ext=(src.match(/data:image\/(\w+)/)?.[1]||"jpeg").replace("jpeg","jpg");
      const a=document.createElement("a"); a.href=src; a.download="사진_"+(idx+1)+"."+ext;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } else {
      window.open(src,"_blank","noopener");
    }
  }
  function onWheel(e){ e.preventDefault(); setScale(s=>Math.max(0.5,Math.min(5,s*(e.deltaY<0?1.1:0.9)))); }
  function onTouchStart(e){ if(e.touches.length===2) pinchRef.current=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); }
  function onTouchMove(e){
    if(e.touches.length===2&&pinchRef.current){
      e.preventDefault();
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      setScale(s=>Math.max(0.5,Math.min(5,s*(d/pinchRef.current)))); pinchRef.current=d;
    }
  }
  function onTouchEnd(){ pinchRef.current=null; }

  const OB={padding:"9px 16px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",color:"#fff"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:600,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",touchAction:"none"}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,width:"100%",maxWidth:"95vw"}}>
        {/* 이미지 */}
        <div style={{overflow:"hidden",width:"95vw",maxHeight:"70vh",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:10}}
          onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <img src={photoSrc(photos[idx])} alt={"사진 "+(idx+1)}
            style={{maxWidth:"95vw",maxHeight:"70vh",objectFit:"contain",borderRadius:8,display:"block",
              transform:"scale("+scale+")",transformOrigin:"center",transition:"transform 0.05s",userSelect:"none",WebkitUserSelect:"none"}}/>
        </div>
        {/* 네비게이션 */}
        {photos.length>1&&(
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <button onClick={prev} style={{...OB,background:"rgba(255,255,255,0.18)",fontSize:22,padding:"5px 18px"}}>‹</button>
            <span style={{color:"#ccc",fontSize:13}}>{idx+1} / {photos.length}</span>
            <button onClick={next} style={{...OB,background:"rgba(255,255,255,0.18)",fontSize:22,padding:"5px 18px"}}>›</button>
          </div>
        )}
        {/* 줌 컨트롤 + 다운로드 + 닫기 */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
          <button onClick={e=>{e.stopPropagation();setScale(s=>Math.min(5,+(s+0.25).toFixed(2)));}} style={{...OB,background:"rgba(255,255,255,0.2)"}}>＋ 확대</button>
          <button onClick={e=>{e.stopPropagation();setScale(1);}} style={{...OB,background:"rgba(255,255,255,0.1)",fontWeight:400}}>{Math.round(scale*100)}%</button>
          <button onClick={e=>{e.stopPropagation();setScale(s=>Math.max(0.5,+(s-0.25).toFixed(2)));}} style={{...OB,background:"rgba(255,255,255,0.2)"}}>－ 축소</button>
          <button onClick={download} style={{...OB,background:"#27ae60"}}>⬇ 다운로드</button>
          <button onClick={e=>{e.stopPropagation();onClose();}} style={{...OB,background:"rgba(255,255,255,0.15)"}}>✕ 닫기</button>
        </div>
      </div>
    </div>
  );
}

function PhotoGallery({photos, thumbStyle}) {
  const [viewIdx, setViewIdx] = useState(null);
  if(!photos||!photos.length) return null;
  return (
    <>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
        {photos.map((src,i)=>(
          <img key={i} src={photoSrc(src)} alt={"사진"+(i+1)}
            style={{width:72,height:72,objectFit:"cover",borderRadius:6,border:"1px solid #eee",cursor:"zoom-in",display:"block",...thumbStyle}}
            onClick={()=>setViewIdx(i)}/>
        ))}
      </div>
      {viewIdx!==null&&<PhotoViewer photos={photos} startIndex={viewIdx} onClose={()=>setViewIdx(null)}/>}
    </>
  );
}

function AttachList({attachments}) {
  if(!attachments||!attachments.length) return null;
  function download(att){
    const src=attSrc(att); if(!src) return;
    if(src.startsWith("data:")){ const a=document.createElement("a"); a.href=src; a.download=att.name; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
    else { window.open(src,"_blank","noopener"); }
  }
  return (
    <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:4}}>
      {attachments.map((att,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#f5f5f5",borderRadius:7,padding:"6px 10px",border:"1px solid #eee"}}>
          <span style={{fontSize:15,flexShrink:0}}>{attachIcon(att.type)}</span>
          <span style={{flex:1,fontSize:12,color:"#444",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name}</span>
          {att.size&&<span style={{fontSize:11,color:"#aaa",flexShrink:0}}>{fmtSize(att.size)}</span>}
          <button onClick={()=>download(att)} style={{padding:"4px 10px",background:"#2980b9",color:"#fff",border:"none",borderRadius:6,fontSize:11,cursor:"pointer",flexShrink:0}}>⬇</button>
        </div>
      ))}
    </div>
  );
}

const Empty=({text="항목이 없습니다."})=>(<div style={{textAlign:"center",padding:"50px 0",color:"#bbb"}}><div style={{fontSize:40,marginBottom:10}}>📝</div><div style={{fontSize:14}}>{text}</div></div>);

// ══════════════════════════════════════════════════════════
//  비밀번호 변경 모달
// ══════════════════════════════════════════════════════════
