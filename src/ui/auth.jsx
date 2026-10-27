function PasswordModal({onClose}) {
  const hasPw = !!storageGet(LS, PW_KEY);
  const [cur,   setCur]   = useState('');
  const [next1, setNext1] = useState('');
  const [next2, setNext2] = useState('');
  const [err,   setErr]   = useState('');

  async function save() {
    if(hasPw && !(await verifyPassword(cur,storageGet(LS,PW_KEY)))){setErr('현재 비밀번호가 틀렸습니다.');return;}
    if(!next1){setErr('새 비밀번호를 입력해주세요.');return;}
    if(next1 !== next2){setErr('비밀번호가 일치하지 않습니다.');return;}
    storageSet(LS,PW_KEY,await hashPassword(next1));
    alert('비밀번호가 변경되었습니다.');
    onClose();
  }
  async function removePw() {
    if(!window.confirm('비밀번호를 해제하시겠습니까?'))return;
    if(hasPw && !(await verifyPassword(cur,storageGet(LS,PW_KEY)))){setErr('현재 비밀번호가 틀렸습니다.');return;}
    storageRemove(LS, PW_KEY);
    alert('비밀번호가 해제되었습니다.');
    onClose();
  }
  const IS={width:'100%',padding:'12px 14px',border:'1px solid #ddd',borderRadius:9,fontSize:15,boxSizing:'border-box',marginBottom:10,fontFamily:'inherit'};
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:500,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:'16px 16px 0 0',padding:'24px 20px 36px',width:'100%',maxWidth:480,boxSizing:'border-box'}}>
        <div style={{width:40,height:4,background:'#ddd',borderRadius:2,margin:'0 auto 18px'}}/>
        <div style={{fontWeight:700,fontSize:16,color:'#1a1a2e',marginBottom:18}}>🔑 비밀번호 {hasPw?'변경':'설정'}</div>
        {err&&<div style={{background:'#fdf2f2',border:'1px solid #f5c6c6',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#c0392b'}}>{err}</div>}
        {hasPw&&<><div style={{fontSize:12,color:'#888',marginBottom:4}}>현재 비밀번호</div><input type="password" value={cur} onChange={e=>setCur(e.target.value)} placeholder="현재 비밀번호" style={IS} autoComplete="current-password"/></>}
        <div style={{fontSize:12,color:'#888',marginBottom:4}}>새 비밀번호</div>
        <input type="password" value={next1} onChange={e=>setNext1(e.target.value)} placeholder="새 비밀번호" style={IS} autoComplete="new-password"/>
        <div style={{fontSize:12,color:'#888',marginBottom:4}}>새 비밀번호 확인</div>
        <input type="password" value={next2} onChange={e=>setNext2(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} placeholder="비밀번호 재입력" style={{...IS,marginBottom:16}} autoComplete="new-password"/>
        <button onClick={save} style={{width:'100%',padding:'13px',border:'none',borderRadius:10,background:'#1a1a2e',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',marginBottom:8}}>저장</button>
        {hasPw&&<button onClick={removePw} style={{width:'100%',padding:'11px',border:'1px solid #fcc',borderRadius:10,background:'#fff',color:'#c0392b',fontSize:14,cursor:'pointer',marginBottom:8}}>비밀번호 해제</button>}
        <button onClick={onClose} style={{width:'100%',padding:'11px',border:'1px solid #ddd',borderRadius:10,background:'#fff',color:'#555',fontSize:14,cursor:'pointer'}}>취소</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  잠금 화면
// ══════════════════════════════════════════════════════════
function LockScreen({onUnlock}) {
  const stored = storageGet(LS, PW_KEY);
  const isSetup = !stored;
  const [pw,    setPw]    = useState('');
  const [pw2,   setPw2]   = useState('');
  const [input, setInput] = useState('');
  const [err,   setErr]   = useState('');
  const [mode,  setMode]  = useState(isSetup?'setup':'lock');
  const inputRef = useRef(null);

  useEffect(()=>{ setTimeout(()=>inputRef.current?.focus(),100); },[mode]);

  async function unlock(){
    if(await verifyPassword(input,storageGet(LS,PW_KEY))){
      storageSet(SS, PW_SESSION, '1'); onUnlock();
    } else {
      setErr('비밀번호가 틀렸습니다. 다시 입력해주세요.');
      setInput(''); inputRef.current?.focus();
    }
  }
  async function setup(){
    if(!pw){setErr('비밀번호를 입력해주세요.');return;}
    if(pw!==pw2){setErr('비밀번호가 일치하지 않습니다.');return;}
    storageSet(LS,PW_KEY,await hashPassword(pw));
    storageSet(SS, PW_SESSION, '1'); onUnlock();
  }
  function skip(){ storageSet(SS, PW_SESSION, '1'); onUnlock(); }

  const IS={width:'100%',padding:'14px',border:'2px solid #e0e0e0',borderRadius:10,fontSize:20,textAlign:'center',letterSpacing:8,boxSizing:'border-box',marginBottom:12,fontFamily:'inherit',outline:'none'};
  const IS2={...IS,letterSpacing:2,fontSize:15,textAlign:'left'};
  const BTN={width:'100%',padding:'14px',border:'none',borderRadius:10,background:'#1a1a2e',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',marginBottom:8};

  return (
    <div style={{position:'fixed',inset:0,background:'#1a1a2e',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,zIndex:999}}>
      <div style={{background:'#fff',borderRadius:20,padding:'36px 28px',width:'100%',maxWidth:360,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:48,marginBottom:10}}>🔒</div>
          <div style={{fontSize:22,fontWeight:700,color:'#1a1a2e'}}>업무수첩</div>
          <div style={{fontSize:13,color:'#aaa',marginTop:6}}>{mode==='setup'?'처음 사용하시는군요! 비밀번호를 설정해주세요':'비밀번호를 입력해주세요'}</div>
        </div>
        {err&&<div style={{background:'#fdf2f2',border:'1px solid #f5c6c6',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#c0392b',textAlign:'center'}}>{err}</div>}

        {mode==='lock'&&(
          <>
            <input ref={inputRef} type="password" value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&unlock()} placeholder="••••••" style={IS} autoComplete="current-password"/>
            <button onClick={unlock} style={BTN}>잠금 해제</button>
          </>
        )}
        {mode==='setup'&&(
          <>
            <div style={{fontSize:12,color:'#888',marginBottom:4}}>새 비밀번호</div>
            <input ref={inputRef} type="password" value={pw} onChange={e=>setPw(e.target.value)}
              placeholder="비밀번호 입력" style={IS2} autoComplete="new-password"/>
            <div style={{fontSize:12,color:'#888',marginBottom:4}}>비밀번호 확인</div>
            <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&setup()}
              placeholder="비밀번호 재입력" style={{...IS2,marginBottom:16}} autoComplete="new-password"/>
            <button onClick={setup} style={BTN}>설정 완료</button>
            <button onClick={skip} style={{...BTN,background:'transparent',color:'#aaa',border:'1px solid #e0e0e0',fontWeight:400}}>건너뛰기 (비밀번호 없이 사용)</button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  메인 앱
// ══════════════════════════════════════════════════════════
function AuthGate() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState(()=>RECOVERY_FROM_URL||storageGet(SS,"wb_password_recovery")==="1"?"recovery":"signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(()=>{
    if(!sb){ setReady(true); return; }
    const { data: sub } = sb.auth.onAuthStateChange((event, next)=>{
      if(event==="PASSWORD_RECOVERY"){
        storageSet(SS,"wb_password_recovery","1");
        setMode("recovery");setPassword("");setConfirmPassword("");setMsg("");
      }
      if(event==="SIGNED_OUT")storageRemove(SS,"wb_password_recovery");
      setSession(next);
    });
    sb.auth.getSession().then(({data,error})=>{
      setSession(data?.session || null);
      if(error)setMsg(error.message);
      setReady(true);
    }).catch(e=>{setMsg(e.message);setReady(true);});
    return ()=>sub.subscription.unsubscribe();
  },[]);

  async function submit() {
    if(busy)return;
    if(mode==="reset"){
      if(!email.trim()){setMsg("가입한 이메일을 입력해 주세요.");return;}
      setBusy(true);setMsg("");
      try{
        const {error}=await sb.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+location.pathname});
        if(error)throw error;
        setMsg("재설정 메일을 요청했습니다. 가입한 이메일의 받은편지함과 스팸함을 확인해 주세요.");
      }catch(e){setMsg(e?.message||String(e));}
      finally{setBusy(false);}
      return;
    }
    if(mode==="recovery"){
      if(!session?.user){setMsg("재설정 링크가 만료되었거나 유효하지 않습니다. 메일을 다시 요청해 주세요.");return;}
      if(password.length<6){setMsg("새 비밀번호를 6자리 이상 입력해 주세요.");return;}
      if(password!==confirmPassword){setMsg("새 비밀번호가 일치하지 않습니다.");return;}
      setBusy(true);setMsg("");
      try{
        const {error}=await sb.auth.updateUser({password});
        if(error)throw error;
        storageRemove(SS,"wb_password_recovery");
        setPassword("");setConfirmPassword("");setMode("signin");
        setMsg("비밀번호가 변경되었습니다.");
      }catch(e){setMsg(e?.message||String(e));}
      finally{setBusy(false);}
      return;
    }
    if(!email.trim() || password.length < 6){ setMsg("이메일과 6자리 이상 비밀번호를 입력해 주세요."); return; }
    setBusy(true); setMsg("");
    try{
      const payload = { email:email.trim(), password };
      const res = mode==="signup"
        ? await sb.auth.signUp({ ...payload, options:{ emailRedirectTo:location.origin + location.pathname } })
        : await sb.auth.signInWithPassword(payload);
      if(res.error) throw res.error;
      setMsg(mode==="signup" ? "가입 메일이 발송됐습니다. 메일 확인 후 로그인해 주세요." : "");
    }catch(e){ setMsg(e?.message || String(e)); }
    finally{ setBusy(false); }
  }

  if(!ready) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#888"}}>로그인 상태 확인 중...</div>;
  if(!sb) return <div style={{padding:24,color:"#c0392b"}}>Supabase 연결을 초기화하지 못했습니다.</div>;
  if(session?.user&&mode!=="recovery") return <App user={session.user}/>;

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f2f2ef",padding:20,fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif"}}>
      <div style={{width:"100%",maxWidth:380,background:"#fff",borderRadius:18,padding:24,boxShadow:"0 12px 40px rgba(0,0,0,0.12)"}}>
        <div style={{fontSize:24,fontWeight:800,color:"#1a1a2e",marginBottom:6}}>📋 업무수첩</div>
        <div style={{fontSize:13,color:"#777",lineHeight:1.6,marginBottom:18}}>{mode==="reset"?"가입한 이메일로 비밀번호 재설정 링크를 보내드립니다. 기존 메모는 유지됩니다.":mode==="recovery"?"새 계정 비밀번호를 설정해 주세요.":"이제 업무수첩은 로그인 계정별로 안전하게 동기화됩니다."}</div>
        {mode!=="recovery"&&<input type="email" aria-label="이메일" value={email} onChange={e=>setEmail(e.target.value)} placeholder="이메일" autoComplete="email" onKeyDown={e=>mode==="reset"&&e.key==="Enter"&&submit()}
          style={{width:"100%",padding:"12px",border:"1px solid #ddd",borderRadius:10,marginBottom:10,fontSize:14}}/>}
        {mode!=="reset"&&<input type="password" aria-label={mode==="recovery"?"새 비밀번호":"비밀번호"} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder={mode==="recovery"?"새 비밀번호 (6자리 이상)":"비밀번호"}
          autoComplete={mode==="signup"||mode==="recovery"?"new-password":"current-password"}
          style={{width:"100%",padding:"12px",border:"1px solid #ddd",borderRadius:10,marginBottom:12,fontSize:14}}/>}
        {mode==="recovery"&&<input type="password" aria-label="새 비밀번호 확인" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="새 비밀번호 확인" autoComplete="new-password" style={{width:"100%",padding:12,border:"1px solid #ddd",borderRadius:10,marginBottom:12,fontSize:14}}/>}
        {msg&&<div style={{fontSize:12,color:msg.includes("발송")?"#27ae60":"#c0392b",lineHeight:1.5,marginBottom:10}}>{msg}</div>}
        <button onClick={submit} disabled={busy} style={{width:"100%",padding:"13px",border:"none",borderRadius:10,background:"#1a1a2e",color:"#fff",fontSize:15,fontWeight:800,cursor:busy?"default":"pointer",opacity:busy?0.7:1}}>
          {busy?"처리 중...":mode==="reset"?"재설정 메일 보내기":mode==="recovery"?"새 비밀번호 저장":mode==="signup"?"회원가입":"로그인"}
        </button>
        {(mode==="signin"||mode==="signup")&&<button disabled={busy} onClick={()=>{setMode(m=>m==="signup"?"signin":"signup");setMsg("");}} style={{width:"100%",marginTop:10,padding:"11px",border:"1px solid #ddd",borderRadius:10,background:"#fff",color:"#555",fontSize:13,cursor:"pointer"}}>
          {mode==="signup"?"이미 계정이 있어요":"처음이면 회원가입"}
        </button>}
        {mode!=="recovery"&&<button disabled={busy} onClick={()=>{setMode(mode==="reset"?"signin":"reset");setPassword("");setMsg("");}} style={{width:"100%",marginTop:10,padding:10,border:"none",background:"transparent",color:"#2980b9",cursor:"pointer"}}>{mode==="reset"?"로그인으로 돌아가기":"비밀번호를 잊으셨나요?"}</button>}
        {mode==="recovery"&&!session?.user&&<button onClick={()=>{storageRemove(SS,"wb_password_recovery");setMode("reset");setMsg("");}} style={{width:"100%",marginTop:10,padding:10,border:"1px solid #ddd",borderRadius:8,background:"#fff",cursor:"pointer"}}>재설정 메일 다시 요청</button>}
      </div>
    </div>
  );
}
