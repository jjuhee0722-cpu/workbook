function DateView({entries,cats,onEdit,selected,onSelect,onDelete,onToggle,statusLabel="미완료"}) {
  const [month,setMonth]=useState(()=>todayStr().slice(0,7));
  const [selectedDate,setSelectedDate]=useState(todayStr());
  const [showDetails,setShowDetails]=useState(true);
  const [year,monthNumber]=month.split("-").map(Number);
  const byDate={};
  entries.filter(e=>e.date).forEach(e=>{(byDate[e.date]||(byDate[e.date]=[])).push(e);});
  const selectedItems=(byDate[selectedDate]||[]).slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  const catById=new Map(cats.map(c=>[c.id,c]));
  const first=new Date(year,monthNumber-1,1).getDay();
  const total=new Date(year,monthNumber,0).getDate();
  const cells=Array.from({length:Math.ceil((first+total)/7)*7},(_,i)=>i>=first&&i<first+total?i-first+1:null);
  const weekLabels=["일","월","화","수","목","금","토"];
  const today=todayStr();
  function changeMonth(value){
    setMonth(value);setSelectedDate(value+"-01");setShowDetails(true);
  }
  function moveMonth(delta){
    const date=new Date(year,monthNumber-1+delta,1);
    changeMonth(date.getFullYear()+"-"+pad(date.getMonth()+1));
  }
  const usedCategories=cats.filter(c=>entries.some(e=>e.category===c.id&&e.date?.startsWith(month+"-")));
  return <section aria-label="월별 업무 달력">
    <div style={{background:"#fff",border:"1px solid #e5e5df",borderRadius:16,padding:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div><div style={{fontSize:24,fontWeight:800,color:"#1a1a2e"}}>{year}년</div><div style={{fontSize:11,color:"#888",marginTop:3}}>작성 날짜 기준 · {statusLabel}</div></div>
        <button onClick={()=>{setMonth(today.slice(0,7));setSelectedDate(today);setShowDetails(true);}} style={{padding:"8px 13px",border:"1px solid #ddd",borderRadius:8,background:"#fff",cursor:"pointer"}}>오늘</button>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:14}}>
        <button aria-label="이전 달" onClick={()=>moveMonth(-1)} style={{padding:"8px 14px",border:0,borderRadius:8,background:"#f4f4f4",cursor:"pointer",fontSize:20}}>‹</button>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700}}>월 이동 <input aria-label="표시할 연월" type="month" value={month} onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value))changeMonth(e.target.value);}} style={{padding:7,border:"1px solid #ddd",borderRadius:7,fontFamily:"inherit",maxWidth:160}}/></label>
        <button aria-label="다음 달" onClick={()=>moveMonth(1)} style={{padding:"8px 14px",border:0,borderRadius:8,background:"#f4f4f4",cursor:"pointer",fontSize:20}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:4}}>
        {weekLabels.map((w,i)=><div key={w} style={{padding:"5px 0",textAlign:"center",fontSize:12,color:i===0?"#c0392b":i===6?"#2980b9":"#888"}}>{w}</div>)}
        {cells.map((day,i)=>{
          if(!day)return <div key={"blank"+i}/>;
          const date=month+"-"+pad(day);
          const active=date===selectedDate;
          const colors=[...new Set((byDate[date]||[]).map(e=>catById.get(e.category)?.color||"#888"))];
          return <button key={date} aria-label={date+" 업무 "+(byDate[date]?.length||0)+"건"} aria-pressed={active} onClick={()=>{setSelectedDate(date);setShowDetails(true);}}
            style={{minHeight:54,padding:"7px 2px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,border:active?"2px solid #1a1a2e":date===today?"2px solid #e74c3c":"2px solid transparent",borderRadius:10,background:active?"#ededf9":"#fafafa",cursor:"pointer",color:i%7===0?"#c0392b":i%7===6?"#2980b9":"#333"}}>
            <span style={{fontSize:14,fontWeight:active||date===today?800:500}}>{day}</span>
            <span style={{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"center"}}>{colors.map(color=><span key={color} style={{width:5,height:5,borderRadius:"50%",background:color}}/>)}</span>
          </button>;
        })}
      </div>
      {usedCategories.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:14,fontSize:11,color:"#777"}}>{usedCategories.map(c=><span key={c.id}><span style={{color:c.color}}>●</span> {c.label}</span>)}</div>}
    </div>
    {showDetails&&<section aria-label="선택한 날짜의 업무" style={{marginTop:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10}}>
        <h3 style={{fontSize:15,color:"#1a1a2e"}}>{selectedDate} · {selectedItems.length}건</h3>
        <button onClick={()=>setShowDetails(false)} aria-label="날짜별 업무 목록 닫기" style={{padding:"8px 12px",border:"1px solid #ddd",borderRadius:8,background:"#fff",cursor:"pointer"}}>닫기 ✕</button>
      </div>
      {selectedItems.length?<div style={{display:"flex",flexDirection:"column",gap:8}}>{selectedItems.map(e=><Card key={e.id} entry={e} cats={cats} selected={selected.has(e.id)} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle}/>)}</div>:<Empty text={"이 날짜에 작성된 "+statusLabel+" 업무가 없습니다."}/>}
    </section>}
  </section>;
}

function TagView({entries,cats,selected,onSelect,onEdit,onDelete,onToggle}) {
  const [activeTag,setActiveTag]=useState(null);
  const tagMap={};
  entries.forEach(e=>(e.tags||[]).forEach(t=>{if(!tagMap[t])tagMap[t]=[];tagMap[t].push(e);}));
  const tags=Object.keys(tagMap).sort();
  if(!tags.length) return <Empty text="태그가 없습니다."/>;
  return (<div><div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:18}}>{tags.map(t=><TagChip key={t} tag={t+" ("+tagMap[t].length+")"} active={activeTag===t} onClick={()=>setActiveTag(activeTag===t?null:t)}/>)}</div>{activeTag&&(<div><div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>{"#"+activeTag+" — "+(tagMap[activeTag]||[]).length+"건"}</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{(tagMap[activeTag]||[]).map(e=><Card key={e.id} entry={e} cats={cats} selected={selected.has(e.id)} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle}/>)}</div></div>)}</div>);
}



// ══════════════════════════════════════════════════════════
//  사진 뷰어 (확대/축소 + 네비게이션 + 다운로드)
// ══════════════════════════════════════════════════════════
