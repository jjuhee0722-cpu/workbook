function App({user}) {
  const [entries,    setEntries]    = useState([]);
  const [cats,       setCats]       = useState(DEFAULT_CATS);
  const [contacts,   setContacts]   = useState([]);
  const [tab,        setTab]        = useState("list");  // list|date|tag|contact
  const [calendarVisit,setCalendarVisit]=useState(0);
  const [catFilter,  setCatFilter]  = useState("all");
  const [search,     setSearch]     = useState("");
  const [statusFilter,setStatusFilter]=useState("active");
  const [sortBy,     setSortBy]     = useState("priority");
  const [modal,      setModal]      = useState(null);
  const [showSidebar,setShowSidebar]= useState(false);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [showDiag,   setShowDiag]   = useState(false);
  const [selected,   setSelected]   = useState(new Set()); // 선택된 항목 id
  const [dbReady,    setDbReady]    = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle|syncing|ok|error
  const [unlocked,   setUnlocked]   = useState(()=>!!storageGet(SS, PW_SESSION)||!storageGet(LS, PW_KEY));
  const [showPwModal,setShowPwModal]= useState(false);
  const syncPushTimer  = useRef(null);
  const realtimePullTimer = useRef(null);
  const pullInFlightRef = useRef(false);
  const pendingPullRef = useRef(false);
  const lastPullAtRef = useRef(null);
  const lastPushAtRef = useRef(null);
  const lastRealtimeAtRef = useRef(null);
  const lastErrorRef = useRef("");
  const localDirtyRef  = useRef(false); // 사용자가 로컬에서 변경했을 때만 true → push 발생
  const editRevisionRef=useRef(0);
  function markDirty(){editRevisionRef.current+=1;localDirtyRef.current=true;}

  // ── IndexedDB 초기 로드 ──────────────────────────────
  useEffect(()=>{
    (async()=>{
      try {
        const [ents,savedCats,savedContacts,savedUser]=await Promise.all([
          idbGetAll(STORES.entries),
          idbGetMeta("cats"),
          idbGetAll(STORES.contacts),
          idbGetMeta("user_id"),
        ]);
        if(savedUser && savedUser !== user.id){
          await Promise.all([idbClear(STORES.entries), idbClear(STORES.contacts), idbSetMeta("cats", DEFAULT_CATS)]);
          setEntries([]); setCats(DEFAULT_CATS); setContacts([]);
        } else {
          if(ents.length) setEntries(ents.map(migrateEntry).sort((a,b)=>b.createdAt-a.createdAt));
          if(savedCats)   setCats(savedCats);
          if(savedContacts.length) setContacts(savedContacts.map(migrateContact));
        }
        await idbSetMeta("user_id", user.id);
      } catch(e){ console.error("IDB load error",e); }
      setDbReady(true);
    })();
  },[user.id]);

  // ── 변경 시 IndexedDB 저장 ───────────────────────────
  useEffect(()=>{ if(!dbReady) return; idbReplaceAll(STORES.entries,entries).catch(e=>console.error("IDB entries save",e)); },[entries,dbReady]);
  useEffect(()=>{ if(!dbReady) return; idbSetMeta("cats",cats).catch(e=>console.error("IDB cats save",e)); },[cats,dbReady]);
  useEffect(()=>{ if(!dbReady) return; idbReplaceAll(STORES.contacts,contacts).catch(e=>console.error("IDB contacts save",e)); },[contacts,dbReady]);

  // ── 최신 state를 ref로 유지 (stale closure 방지) ───────
  const dataRef = useRef({ entries, cats, contacts });
  useEffect(()=>{ dataRef.current = { entries, cats, contacts }; });

  // ── Pull + 항목별 병합 함수 (잠금·재시도·오프라인 처리 포함) ──
  const pullAndMerge = useCallback(async () => {
    if(!navigator.onLine){ setSyncStatus("offline"); return false; }
    if(pullInFlightRef.current){
      pendingPullRef.current = true;
      return false;
    }
    pullInFlightRef.current = true;
    try{
      let didSync = false;
      do {
        pendingPullRef.current = false;
        const ok = await withSyncLock(async () => {
          setSyncStatus("syncing");
          try{
            const remote = await withRetry(()=>sbPullRows(user.id));
            if(remote){
              lastPullAtRef.current = Date.now();
              const { entries: curE, cats:curC, contacts: curCon } = dataRef.current;
              const preferLocal=localDirtyRef.current;
              const mergedEntries=mergeRecords(curE,remote.entries||[],migrateEntry,preferLocal)
                .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
              const mergedContacts=mergeRecords(curCon,remote.contacts||[],migrateContact,preferLocal);
              const needsPush=preferLocal
                ||!sameRecords(mergedEntries,remote.entries||[],migrateEntry)
                ||!sameRecords(mergedContacts,remote.contacts||[],migrateContact);

              dataRef.current={
                entries:mergedEntries,
                cats:preferLocal?curC:(remote.cats?.length?remote.cats:curC),
                contacts:mergedContacts,
              };
              setEntries(mergedEntries);
              setContacts(mergedContacts);
              setCats(dataRef.current.cats);
              localDirtyRef.current=needsPush;
            }
            lastErrorRef.current = "";
            setSyncStatus("ok");
            return true;
          }catch(e){
            console.error("Supabase pull",e);
            lastErrorRef.current = e && e.message ? e.message : String(e);
            setSyncStatus(navigator.onLine ? "error" : "offline");
            return false;
          }
        });
        didSync = didSync || ok;
      } while(pendingPullRef.current);
      return didSync;
    } finally {
      pullInFlightRef.current = false;
    }
  },[user.id]);

  // ── Push 실행 (잠금·재시도, 로컬 변경 있을 때만) ──────
  const flushPush = useCallback(async () => {
    if(!localDirtyRef.current) return;
    if(!navigator.onLine){ setSyncStatus("offline"); return; }
    return withSyncLock(async () => {
      if(!localDirtyRef.current) return;
      setSyncStatus("syncing");
      try{
        const remote=await withRetry(()=>sbPullRows(user.id));
        const { entries: e, cats: c, contacts: con } = dataRef.current;
        const revision=editRevisionRef.current;
        const mergedEntries=mergeRecords(e,remote?.entries||[],migrateEntry,true)
          .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
        const mergedContacts=mergeRecords(con,remote?.contacts||[],migrateContact,true);
        const mergedCats=c?.length?c:(remote?.cats||DEFAULT_CATS);
        await withRetry(()=>sbPushRows(user.id,mergedEntries,mergedCats,mergedContacts));
        lastPushAtRef.current = Date.now();
        lastErrorRef.current = "";
        if(revision!==editRevisionRef.current){setSyncStatus("ok");return;}
        dataRef.current={entries:mergedEntries,cats:mergedCats,contacts:mergedContacts};
        setEntries(mergedEntries);
        setContacts(mergedContacts);
        localDirtyRef.current = false;
        setSyncStatus("ok");
      }catch(err){
        console.error("Supabase push",err);
        lastErrorRef.current = err && err.message ? err.message : String(err);
        setSyncStatus(navigator.onLine ? "error" : "offline");
      }
    });
  },[user.id]);

  // ── 앱 시작 시 Pull ──────────────────────────────────
  useEffect(()=>{
    if(!dbReady) return;
    pullAndMerge();
  },[dbReady,pullAndMerge]);

  // ── 탭/창 활성화 시 자동 Pull (기기 전환 대응) ────────
  useEffect(()=>{
    if(!dbReady)return;
    const handle=()=>{ if(!document.hidden) pullAndMerge(); };
    document.addEventListener("visibilitychange", handle);
    window.addEventListener("focus", handle);
    return ()=>{
      document.removeEventListener("visibilitychange", handle);
      window.removeEventListener("focus", handle);
    };
  },[pullAndMerge,dbReady]);

  // ── 온라인/오프라인 전환 처리 ─────────────────────────
  useEffect(()=>{
    const onOnline  = ()=>{ if(localDirtyRef.current) flushPush(); else pullAndMerge(); };
    const onOffline = ()=> setSyncStatus("offline");
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    if(!navigator.onLine) setSyncStatus("offline");
    return ()=>{
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  },[pullAndMerge, flushPush]);

  // ── Supabase 실시간 구독 (자기 메아리는 무시) ────────
  useEffect(()=>{
    if(!dbReady) return;
    if(!sb) return;
    const onChange = ()=>{
      if(Date.now() < _syncMuteUntil) return;
      lastRealtimeAtRef.current = Date.now();
      clearTimeout(realtimePullTimer.current);
      realtimePullTimer.current = setTimeout(()=>{ pullAndMerge(); }, 800);
    };
    const channel = sb.channel("wb_changes_"+user.id)
      .on("postgres_changes",{ event:"*", schema:"public", table:ROW_TABLES.entries, filter:"user_id=eq."+user.id }, onChange)
      .on("postgres_changes",{ event:"*", schema:"public", table:ROW_TABLES.cats, filter:"user_id=eq."+user.id }, onChange)
      .on("postgres_changes",{ event:"*", schema:"public", table:ROW_TABLES.contacts, filter:"user_id=eq."+user.id }, onChange)
      .subscribe();
    return ()=>{
      clearTimeout(realtimePullTimer.current);
      sb.removeChannel(channel);
    };
  },[dbReady, pullAndMerge, user.id]);

  // ── 데이터 변경 시 자동 Push (1.5초 디바운스, 로컬 변경 있을 때만) ──
  useEffect(()=>{
    if(!dbReady) return;
    if(!localDirtyRef.current) return; // ← 원격에서 당겨온 변경은 다시 올리지 않음 (cascade 방지)
    clearTimeout(syncPushTimer.current);
    syncPushTimer.current=setTimeout(()=>{ flushPush(); }, 1500);
    return ()=>clearTimeout(syncPushTimer.current);
  },[entries,cats,contacts,dbReady,flushPush]);

  // ── 항목 CRUD ────────────────────────────────────────
  const openNew  = ()  => setModal({entry:null});
  const openEdit = (e) => setModal({entry:e});
  const closeModal=()  => setModal(null);

  function submitForm(form) {
    markDirty();
    const now=Date.now();
    if(modal.entry) setEntries(p=>p.map(e=>e.id===modal.entry.id?{...form,id:modal.entry.id,createdAt:modal.entry.createdAt,updatedAt:now,deletedAt:0}:e));
    else            setEntries(p=>[{...form,id:uid(),createdAt:now,updatedAt:now,deletedAt:0},...p]);
    closeModal();
  }
  function deleteEntry(id){if(!window.confirm("삭제하시겠습니까?"))return;markDirty();const now=Date.now();setEntries(p=>p.map(e=>e.id===id?{...e,deletedAt:now,updatedAt:now}:e));setSelected(s=>{const n=new Set(s);n.delete(id);return n;});}
  function toggleDone(id){markDirty();setEntries(p=>p.map(e=>e.id===id?{...e,done:!e.done,updatedAt:Date.now()}:e));}

  // ── 선택 ─────────────────────────────────────────────
  function toggleSelect(id){setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});}
  function markDone(val){markDirty();setEntries(p=>p.map(e=>selected.has(e.id)?{...e,done:val,updatedAt:Date.now()}:e));setSelected(new Set());}
  function deleteSelected(){markDirty();const now=Date.now();setEntries(p=>p.map(e=>selected.has(e.id)?{...e,deletedAt:now,updatedAt:now}:e));setSelected(new Set());}

  // ── Supabase 수동 동기화 ─────────────────────────────
  async function manualSync(){
    if(!navigator.onLine){ setSyncStatus("offline"); alert("오프라인 상태입니다. 네트워크 연결 후 다시 시도하세요."); return; }
    try{
      await withSyncLock(async ()=>{
        setSyncStatus("syncing");
        const remote=await withRetry(()=>sbPullRows(user.id));
        const {entries:curE,cats:curC,contacts:curCon}=dataRef.current;
        const revision=editRevisionRef.current;
        const finalEntries=mergeRecords(curE,remote?.entries||[],migrateEntry,true)
          .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
        const finalCats=curC?.length?curC:(remote?.cats||DEFAULT_CATS);
        const finalContacts=mergeRecords(curCon,remote?.contacts||[],migrateContact,true);
        dataRef.current={entries:finalEntries,cats:finalCats,contacts:finalContacts};
        setEntries(finalEntries);
        setCats(finalCats);
        setContacts(finalContacts);
        await withRetry(()=>sbPushRows(user.id,finalEntries,finalCats,finalContacts));
        lastPushAtRef.current=Date.now();
        lastErrorRef.current="";
        localDirtyRef.current=revision!==editRevisionRef.current;
        setSyncStatus("ok");
      });
      alert("동기화 완료!");
    }catch(e){ console.error("manual sync",e); lastErrorRef.current=e&&e.message?e.message:String(e); setSyncStatus(navigator.onLine?"error":"offline"); alert("동기화 오류: "+(e&&e.message?e.message:e)); }
  }

  // ── 분류 저장 ────────────────────────────────────────
  function saveCatsWithMigrate(newCats){
    markDirty();
    const ids=new Set(newCats.map(c=>c.id));const fallback=newCats[0]?.id;
    setEntries(p=>p.map(e=>ids.has(e.category)?e:{...e,category:fallback}));
    setCats(newCats);
  }
  function prepareContactSnapshot(next) {
    const previous=(dataRef.current.contacts||[]).map(migrateContact);
    const previousMap=new Map(previous.map(contact=>[contact.id,contact]));
    const nextIds=new Set(next.map(contact=>contact.id));
    const now=Date.now();
    const stripMeta=contact=>{
      const {updatedAt,deletedAt,order,...value}=contact;
      return value;
    };
    const live=next.map((contact,index)=>{
      const old=previousMap.get(contact.id);
      const changed=!old||old.deletedAt||old.order!==index
        ||JSON.stringify(stripMeta(old))!==JSON.stringify(stripMeta(contact));
      return {...contact,order:index,deletedAt:0,updatedAt:changed?now:recordVersion(old)};
    });
    const tombstones=previous
      .filter(contact=>contact.deletedAt||!nextIds.has(contact.id))
      .map(contact=>contact.deletedAt?contact:{...contact,deletedAt:now,updatedAt:now});
    return [...live,...tombstones];
  }

  // 담당자 저장 — dirty 플래그 + dataRef 즉시 동기화 (stale closure 방지)
  function saveContacts(next){
    const snapshot=prepareContactSnapshot(next);
    markDirty();
    dataRef.current = {...dataRef.current, contacts: snapshot};
    setContacts(snapshot);
  }

  // 담당자 탭 저장 버튼 — 즉시 Supabase push (디바운스 없음)
  async function forceSaveContacts(nextContacts) {
    const snapshot=prepareContactSnapshot(nextContacts);
    markDirty();
    const revision=editRevisionRef.current;
    dataRef.current = {...dataRef.current, contacts: snapshot}; // pull 경쟁 방지
    setContacts(snapshot);
    if(!navigator.onLine){ setSyncStatus("offline"); throw new Error("오프라인 상태입니다."); }
    try {
      await withSyncLock(async ()=>{
        setSyncStatus("syncing");
        const { entries: e, cats: c } = dataRef.current;
        const remote=await withRetry(()=>sbPullRows(user.id));
        const mergedEntries=mergeRecords(e,remote?.entries||[],migrateEntry,true);
        const mergedContacts=mergeRecords(snapshot,remote?.contacts||[],migrateContact,true);
        await withRetry(()=>sbPushRows(user.id, mergedEntries, c, mergedContacts));
        lastPushAtRef.current = Date.now();
        lastErrorRef.current = "";
        if(revision!==editRevisionRef.current){setSyncStatus("ok");return;}
        dataRef.current={entries:mergedEntries,cats:c,contacts:mergedContacts};
        setEntries(mergedEntries);
        setContacts(mergedContacts);
        localDirtyRef.current = false;
        setSyncStatus("ok");
      });
    } catch(err) {
      console.error("forceSave", err);
      lastErrorRef.current = err && err.message ? err.message : String(err);
      setSyncStatus(navigator.onLine ? "error" : "offline");
      throw err; // SaveBtn이 ⚠ 오류 표시할 수 있도록 re-throw
    }
  }

  // ── 필터/정렬 ────────────────────────────────────────
  const liveEntries=entries.filter(isLiveRecord);
  const liveContacts=contacts.filter(isLiveRecord).sort((a,b)=>(a.order??Number.MAX_SAFE_INTEGER)-(b.order??Number.MAX_SAFE_INTEGER));
  const counts={};
  cats.forEach(c=>{counts[c.id]=liveEntries.filter(e=>e.category===c.id&&!e.done).length;});
  const totalActive=liveEntries.filter(e=>!e.done).length;

  const statusLabel={active:"미완료",done:"완료",all:"전체"}[statusFilter];
  const statusEntries=liveEntries.filter(e=>statusFilter==="all"||(statusFilter==="done"?!!e.done:!e.done));
  const filterScope=tab==="list"?liveEntries.filter(e=>catFilter==="all"||e.category===catFilter):liveEntries;
  const statusCounts={active:filterScope.filter(e=>!e.done).length,done:filterScope.filter(e=>e.done).length,all:filterScope.length};
  function changeStatusFilter(value){setStatusFilter(value);setSelected(new Set());}
  const filtered=statusEntries.filter(e=>{
    if(catFilter!=="all"&&e.category!==catFilter) return false;
    if(search){const q=search.toLowerCase();return e.title.toLowerCase().includes(q)||(e.body||"").toLowerCase().includes(q)||(e.tags||[]).some(t=>t.toLowerCase().includes(q));}
    return true;
  }).sort((a,b)=>{
    if(a.done!==b.done) return a.done?1:-1;
    if(!a.done){
      if(sortBy==="date_desc") return b.updatedAt-a.updatedAt;
      if(sortBy==="date_asc")  return a.updatedAt-b.updatedAt;
      // 마감기한 임박 우선 → 마감기한 없으면 뒤로
      const aHas=!!a.deadline, bHas=!!b.deadline;
      if(aHas&&bHas){ const dc=a.deadline.localeCompare(b.deadline); if(dc!==0) return dc; }
      else if(aHas) return -1;
      else if(bHas) return 1;
      // 마감기한 같거나 둘 다 없으면 우선순위(긴급>보통>낮음)
      const pd=["high","mid","low"].indexOf(a.priority)-["high","mid","low"].indexOf(b.priority);
      if(pd!==0) return pd;
      return b.updatedAt-a.updatedAt;
    }
    return b.updatedAt-a.updatedAt;
  });

  const blankForm=()=>({category:catFilter!=="all"?catFilter:(cats[0]?.id||"task"),title:"",body:"",priority:"mid",date:todayStr(),deadline:"",tags:[],photos:[],attachments:[],done:false});
  const selActive = selected.size>0;
  const selBarRef  = useRef(null);
  const diagRows = [
    ["계정", user.email || user.id],
    ["상태", syncStatus],
    ["온라인", navigator.onLine ? "예" : "아니오"],
    ["로컬 변경 대기", localDirtyRef.current ? "있음" : "없음"],
    ["Pull 실행 중", pullInFlightRef.current ? "예" : "아니오"],
    ["예약된 Pull", pendingPullRef.current ? "있음" : "없음"],
    ["마지막 Pull", lastPullAtRef.current ? fmtTs(lastPullAtRef.current) : "기록 없음"],
    ["마지막 Push", lastPushAtRef.current ? fmtTs(lastPushAtRef.current) : "기록 없음"],
    ["마지막 Realtime", lastRealtimeAtRef.current ? fmtTs(lastRealtimeAtRef.current) : "기록 없음"],
    ["항목/분류/담당자", `${entries.length} / ${cats.length} / ${contacts.length}`],
    ["마지막 오류", lastErrorRef.current || "없음"],
  ];

  if(!unlocked) return <LockScreen onUnlock={()=>setUnlocked(true)}/>;
  if(!dbReady) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontSize:15,color:"#888"}}>불러오는 중...</div>;

  return (
    <div style={{fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",minHeight:"100vh",background:"#f2f2ef",WebkitFontSmoothing:"antialiased"}}>

      {/* 헤더 + 선택바 + 탭바 — 하나의 sticky 컨테이너로 묶어 높이 자동 계산 */}
      <div style={{position:"sticky",top:0,zIndex:200}}>
      <header className="app-header" style={{background:"#1a1a2e",color:"#fff",padding:"0 14px",height:54,display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 2px 8px rgba(0,0,0,0.3)"}}>
        <div className="app-header-left" style={{display:"flex",alignItems:"center",gap:8}}>
          <button aria-label="메뉴 열기" onClick={()=>setShowSidebar(s=>!s)} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",padding:"4px 6px",lineHeight:1}}>☰</button>
          <span className="app-title" style={{fontSize:17,fontWeight:700}}>📋 업무수첩</span>
        </div>
        <div className="app-header-actions" style={{display:"flex",alignItems:"center",gap:8}}>
          <span className="header-count" style={{fontSize:11,color:"#aaa"}}>미완료 {totalActive}건</span>
          <button
            className="header-action"
            onClick={()=>setShowDiag(true)}
            title="저장 상태 및 동기화 진단 보기"
            aria-label="저장 상태 및 동기화 진단 보기"
            style={{padding:"7px 10px",background:syncStatus==="error"?"rgba(231,76,60,0.2)":"transparent",
              border:"1px solid "+(syncStatus==="error"?"#e74c3c":"rgba(255,255,255,0.25)"),
              borderRadius:7,fontSize:12,cursor:"pointer",
              color:syncStatus==="error"?"#e74c3c":syncStatus==="syncing"?"#f1c40f":syncStatus==="offline"?"#95a5a6":"#2ecc71",
              display:"flex",alignItems:"center",gap:4}}>
            <span style={{display:"inline-block",animation:syncStatus==="syncing"?"spin 1s linear infinite":"none"}}>
              {syncStatus==="syncing"?"⟳":syncStatus==="ok"?"☁":syncStatus==="error"?"⚠":syncStatus==="offline"?"⚡":"☁"}
            </span>
            <span className="sync-label" style={{fontSize:10}}>{syncStatus==="syncing"?"동기화중":syncStatus==="ok"?"동기화됨":syncStatus==="error"?"오류":syncStatus==="offline"?"오프라인":"동기화"}</span>
          </button>
          {tab!=="contact"&&<button className="header-action" onClick={openNew} style={{padding:"9px 14px",background:"#e74c3c",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ 추가</button>}
        </div>
      </header>

      {/* 선택 액션 바 */}
      {selActive&&(
        <SelectionBar
          selected={selected} entries={liveEntries} cats={cats}
          barRef={selBarRef}
          onClear={()=>setSelected(new Set())}
          onMarkDone={()=>markDone(true)}
          onMarkUndone={()=>markDone(false)}
          onDelete={deleteSelected}
        />
      )}

      {/* 사이드바 */}
      {showSidebar&&(
        <div style={{position:"fixed",inset:0,zIndex:250}} onClick={()=>setShowSidebar(false)}>
          <div role="dialog" aria-label="업무수첩 메뉴" onClick={e=>e.stopPropagation()} style={{position:"absolute",top:0,left:0,width:"min(320px,90vw)",height:"100%",background:"#fff",boxShadow:"4px 0 20px rgba(0,0,0,0.15)",overflowY:"auto",padding:"20px 0 30px",boxSizing:"border-box"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 16px 14px"}}><strong>업무수첩 메뉴</strong><button aria-label="메뉴 닫기" onClick={()=>setShowSidebar(false)} style={{padding:8,border:0,borderRadius:6,background:"#eee",cursor:"pointer"}}>닫기 ✕</button></div>
            <div style={{fontSize:12,color:"#888",padding:"0 16px 14px",overflowWrap:"anywhere"}}>{user.email}</div>
            <div style={{padding:"12px 14px 8px",fontSize:11,color:"#555",fontWeight:700}}>📋 분류로 바로가기</div>
            <div style={{padding:"0 14px 10px",fontSize:11,color:"#aaa",lineHeight:1.5}}>탭을 누르면 해당 분류만 표시됩니다</div>
            {[{id:"all",label:"전체",icon:"◈",color:"#34495e"},...cats].map(cat=>(
              <button key={cat.id} onClick={()=>{setCatFilter(cat.id);setSelected(new Set());setTab("list");setShowSidebar(false);}} style={{width:"100%",textAlign:"left",padding:"11px 16px",border:"none",background:catFilter===cat.id&&tab==="list"?colorToBg(cat.color):"transparent",borderLeft:catFilter===cat.id&&tab==="list"?"3px solid "+cat.color:"3px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontSize:14,color:catFilter===cat.id&&tab==="list"?cat.color:"#444",fontWeight:catFilter===cat.id&&tab==="list"?700:400}}>
                <span>{cat.icon}</span><span style={{flex:1}}>{cat.label}</span>
                {cat.id!=="all"&&counts[cat.id]>0&&<span style={{background:cat.color,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:11,fontWeight:700}}>{counts[cat.id]}</span>}
              </button>
            ))}
            <div style={{margin:"12px 14px 0",borderTop:"1px solid #eee",paddingTop:12,display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={()=>{setShowCatMgr(true);setShowSidebar(false);}} style={{width:"100%",padding:"10px",border:"1px dashed #ccc",borderRadius:8,background:"#fff",fontSize:13,cursor:"pointer",color:"#555",fontWeight:600}}>⚙️ 분류 관리</button>
              <button onClick={()=>{setShowPwModal(true);setShowSidebar(false);}} style={{width:"100%",padding:"10px",border:"1px dashed #ccc",borderRadius:8,background:"#fff",fontSize:13,cursor:"pointer",color:"#555",fontWeight:600}}>
                {storageGet(LS, PW_KEY)?'🔑 비밀번호 변경':'🔒 비밀번호 설정'}
              </button>
              <button onClick={()=>{setShowDiag(true);setShowSidebar(false);}} style={{width:"100%",padding:"10px",border:"1px dashed #b8d8ff",borderRadius:8,background:"#f7fbff",fontSize:13,cursor:"pointer",color:"#2980b9",fontWeight:700}}>🩺 동기화 진단</button>
              <button onClick={()=>{changeStatusFilter("done");setTab("list");setShowSidebar(false);}} style={{padding:10,border:"1px solid #ddd",borderRadius:8,background:"#fff",color:"#16854b",cursor:"pointer"}}>✓ 완료한 업무 보기</button>
              <button onClick={()=>{exportXLSX(liveEntries,cats,liveContacts);setShowSidebar(false);}} style={{padding:10,border:"1px solid #ddd",borderRadius:8,background:"#fff",color:"#16854b",cursor:"pointer"}}>📊 전체 데이터 엑셀 내보내기</button>
              <button onClick={()=>{if(localDirtyRef.current){alert("저장 대기 중인 변경이 있습니다. 동기화를 완료한 뒤 로그아웃해 주세요.");return;}sb.auth.signOut();}} style={{padding:10,border:"1px solid #ddd",borderRadius:8,background:"#fff",color:"#666",cursor:"pointer"}}>로그아웃</button>
            </div>
          </div>
        </div>
      )}

      {/* 현재 탭 타이틀 바 */}
      <div style={{background:"#fff",borderBottom:"1px solid #e0e0da",padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
        {tab==="list" && <>
          <span style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>
            {catFilter==="all" ? "전체 목록" : (cats.find(c=>c.id===catFilter)?.icon+" "+cats.find(c=>c.id===catFilter)?.label)}
          </span>
          {catFilter!=="all" && <button onClick={()=>setCatFilter("all")} style={{fontSize:11,color:"#999",background:"none",border:"none",cursor:"pointer",padding:"2px 6px"}}>✕ 전체보기</button>}
        </>}
        {tab==="date"    && <span style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>📅 날짜별</span>}
        {tab==="tag"     && <span style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>🏷️ 태그별</span>}
        {tab==="contact" && <span style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>👤 담당자</span>}
      </div>
      </div>{/* /sticky container */}

      {/* 콘텐츠 */}
      <div style={{padding:"16px 14px calc(96px + env(safe-area-inset-bottom))",maxWidth:760,margin:"0 auto"}}>
        {(syncStatus==="error"||syncStatus==="offline")&&<div role="status" style={{marginBottom:14,padding:12,border:"1px solid #e8c5b6",borderRadius:10,background:"#fff5ef",color:"#8b4123",fontSize:12,lineHeight:1.6}}>{syncStatus==="offline"?"오프라인입니다. 변경 내용은 이 기기에 보관되며 연결 후 동기화합니다.":"클라우드 동기화를 완료하지 못했습니다. 진단에서 오류를 확인하고 다시 시도해 주세요."}<button onClick={()=>setShowDiag(true)} style={{marginLeft:8,padding:6,border:0,background:"transparent",textDecoration:"underline",color:"inherit",cursor:"pointer"}}>상태 확인</button></div>}
        {["list","date","tag"].includes(tab)&&<div role="group" aria-label="업무 상태 필터" style={{display:"flex",gap:6,marginBottom:14,padding:5,background:"#e6e6e1",borderRadius:12}}>
          {[["active","미완료"],["done","완료"],["all","전체"]].map(([value,label])=><button key={value} aria-pressed={statusFilter===value} onClick={()=>changeStatusFilter(value)} style={{flex:1,padding:"11px 6px",border:"none",borderRadius:9,background:statusFilter===value?"#fff":"transparent",color:statusFilter===value?(value==="done"?"#16854b":"#1a1a2e"):"#777",fontSize:13,fontWeight:700,boxShadow:statusFilter===value?"0 1px 4px #0001":"none",cursor:"pointer"}}>{label} ({statusCounts[value]})</button>)}
        </div>}
        {tab==="list"&&(
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <div style={{flex:1,position:"relative"}}>
              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#aaa",fontSize:14,pointerEvents:"none"}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="검색..." style={{width:"100%",padding:"10px 10px 10px 34px",border:"1px solid #ddd",borderRadius:8,fontSize:14,boxSizing:"border-box"}}/>
            </div>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:"10px 8px",border:"1px solid #ddd",borderRadius:8,fontSize:12,background:"#fff",color:"#555",flexShrink:0}}>
              <option value="priority">마감임박순</option>
              <option value="date_desc">최신순</option>
              <option value="date_asc">오래된순</option>
            </select>
          </div>
        )}

        {tab==="list"&&(filtered.length===0?<Empty text={search?"검색 결과가 없습니다.":`${statusLabel} 업무가 없습니다.`}/>:<div style={{display:"flex",flexDirection:"column",gap:8}}>{filtered.map(e=><Card key={e.id} entry={e} cats={cats} selected={selected.has(e.id)} onSelect={toggleSelect} onEdit={openEdit} onDelete={deleteEntry} onToggle={toggleDone}/>)}</div>)}
        {tab==="date"   &&<DateView key={calendarVisit} entries={statusEntries} statusLabel={statusLabel} cats={cats} selected={selected} onSelect={toggleSelect} onEdit={openEdit} onDelete={deleteEntry} onToggle={toggleDone}/>}
        {tab==="tag"    &&<TagView  entries={statusEntries} cats={cats} selected={selected} onSelect={toggleSelect} onEdit={openEdit} onDelete={deleteEntry} onToggle={toggleDone}/>}
        {tab==="contact"&&<ContactTab contacts={liveContacts} onSave={saveContacts} onForceSave={forceSaveContacts}/>}
      </div>

      {/* 모달들 */}
      {modal&&<EntryModal initial={modal.entry||blankForm()} cats={cats} onSubmit={submitForm} onCancel={closeModal}/>}
      {showCatMgr&&<CatManageModal cats={cats} onSave={saveCatsWithMigrate} onClose={()=>setShowCatMgr(false)}/>}
      {showPwModal&&<PasswordModal onClose={()=>setShowPwModal(false)}/>}
      {showDiag&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowDiag(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"16px 16px 0 0",padding:"20px 18px 34px",width:"100%",maxWidth:560,maxHeight:"88vh",overflowY:"auto",boxSizing:"border-box"}}>
            <div style={{width:40,height:4,background:"#ddd",borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontWeight:800,fontSize:17,color:"#1a1a2e"}}>🩺 동기화 진단</div>
                <div style={{fontSize:12,color:"#888",marginTop:4,lineHeight:1.5}}>먹통처럼 보일 때 원인을 빠르게 확인하는 상태표입니다.</div>
              </div>
              <button onClick={()=>setShowDiag(false)} style={{border:"none",background:"#f2f2f2",borderRadius:8,padding:"8px 10px",cursor:"pointer",fontSize:12,color:"#555"}}>닫기</button>
            </div>
            <div style={{border:"1px solid #eee",borderRadius:12,overflow:"hidden"}}>
              {diagRows.map(([label,value],i)=>(
                <div key={label} style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:8,padding:"10px 12px",background:i%2?"#fff":"#fafafa",borderTop:i?"1px solid #eee":"none",fontSize:12,lineHeight:1.5}}>
                  <div style={{color:"#777",fontWeight:700}}>{label}</div>
                  <div style={{color:label==="마지막 오류"&&value!=="없음"?"#c0392b":"#333",wordBreak:"break-word"}}>{value}</div>
                </div>
              ))}
            </div>
            <button onClick={manualSync} style={{width:"100%",marginTop:14,padding:"12px",border:"none",borderRadius:10,background:"#1a1a2e",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer"}}>지금 동기화 재시도</button>
          </div>
        </div>
      )}

      {/* ── 하단 네비게이션 바 ── */}
      <nav aria-label="주요 화면" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:190,background:"#fff",borderTop:"1px solid #e0e0da",display:"flex",alignItems:"stretch",paddingBottom:"env(safe-area-inset-bottom)",boxShadow:"0 -2px 12px rgba(0,0,0,0.08)"}}>
        {NAV_TABS.map(t=>(
          <button key={t.id} aria-current={tab===t.id?"page":undefined} onClick={()=>{if(t.id==="date")setCalendarVisit(v=>v+1);setSelected(new Set());setTab(t.id);}}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 2px 10px",border:"none",background:"none",cursor:"pointer",
              color:tab===t.id?"#1a1a2e":"#aaa",
              borderTop:tab===t.id?"2.5px solid #1a1a2e":"2.5px solid transparent",
              gap:3,transition:"all 0.15s",position:"relative"}}>
            <span style={{fontSize:20,lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:10,fontWeight:tab===t.id?700:400}}>{t.label}</span>
            {t.id==="list"&&totalActive>0&&(
              <span style={{position:"absolute",top:5,right:"calc(50% - 16px)",background:"#e74c3c",color:"#fff",borderRadius:10,padding:"1px 5px",fontSize:9,fontWeight:700,lineHeight:1.4}}>
                {totalActive}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}


const domRoot = ReactDOM.createRoot(document.getElementById('root'));
domRoot.render(React.createElement(AuthGate));
