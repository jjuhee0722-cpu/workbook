const SB_URL = "https://qroxbykatxpqvvgaftom.supabase.co";
// Capture recovery intent before the auth client consumes the URL fragment.
const RECOVERY_FROM_URL = new URLSearchParams(location.hash.slice(1)).get("type")==="recovery";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyb3hieWthdHhwcXZ2Z2FmdG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzODI1NjUsImV4cCI6MjA5NDk1ODU2NX0.wGtQyS234I4TJRBycakvPdfXRySQite7w2OQ9TytoGE";
async function fetchWithDeadline(input,options={},timeoutMs=String(input).includes("/storage/v1/object/")?60000:20000) {
  const controller=new AbortController();
  let timedOut=false;
  const cancel=()=>controller.abort();
  if(options.signal?.aborted)cancel();
  options.signal?.addEventListener("abort",cancel,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  try{
    const response=await fetch(input,{...options,signal:controller.signal});
    // Keep the deadline active while the response body is still arriving.
    const body=response.body===null?null:await response.arrayBuffer();
    return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
  }catch(error){
    if(timedOut){const e=new Error("서버 응답 시간이 초과되었습니다. 연결 상태를 확인하고 다시 시도해 주세요.");e.code="SYNC_TIMEOUT";throw e;}
    throw error;
  }finally{
    clearTimeout(timer);options.signal?.removeEventListener("abort",cancel);
  }
}
const sb = (() => {
  try {
    if (!window.supabase || !window.supabase.createClient) return null;
    return window.supabase.createClient(SB_URL, SB_KEY,{global:{fetch:fetchWithDeadline}});
  } catch (e) {
    console.warn("[sync] Supabase 초기화 실패. 로컬 모드로 실행합니다.", e && e.message);
    return null;
  }
})();

// ── 비밀번호 잠금 상수 ──
const PW_KEY     = 'wb_lock_pw';
const PW_SESSION = 'wb_session_ok';
const LS = (() => { try { return window.localStorage; } catch { return null; } })();
const SS = (() => { try { return window.sessionStorage; } catch { return null; } })();

function storageGet(store, key) {
  try { return store && store.getItem(key); }
  catch { return null; }
}
function storageSet(store, key, value) {
  try { store && store.setItem(key, value); return true; }
  catch { return false; }
}
function storageRemove(store, key) {
  try { store && store.removeItem(key); return true; }
  catch { return false; }
}

async function hashPassword(value) {
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return "sha256:"+Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

async function verifyPassword(input, stored) {
  if(!stored) return false;
  if(stored.startsWith("sha256:")) return (await hashPassword(input))===stored;
  if(input!==stored) return false;
  storageSet(LS,PW_KEY,await hashPassword(input));
  return true;
}

// 직렬화 잠금 — pull/push가 동시에 겹쳐 서로 덮어쓰는 경쟁(race) 방지
let _syncChain = Promise.resolve();
function withSyncLock(fn) {
  const run = _syncChain.then(fn, fn);   // 이전 작업의 성공/실패와 무관하게 순차 실행
  _syncChain = run.catch(() => {});      // 한 번 실패해도 체인이 막히지 않도록
  return run;
}

// 일시적 네트워크 오류 자동 재시도 (지수 백오프). 인증/권한 오류는 재시도하지 않음.
async function withRetry(fn, { tries = 3, base = 600 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const code = e && (e.code || e.status);
      if (code === 401 || code === 403 || code === 'PGRST301' || code === 'SYNC_TIMEOUT' || /서버 응답 시간이 초과/.test(e?.message||"")) break;
      if (i < tries - 1) await new Promise(r => setTimeout(r, base * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

const ROW_TABLES = {
  profile: "workbook_profiles",
  entries: "workbook_entries",
  cats: "workbook_categories",
  contacts: "workbook_contacts",
};

// 내가 방금 저장해서 되돌아오는 realtime 이벤트는 잠깐 무시한다.
let _syncMuteUntil = 0;
let _baseline = { entries:new Map(), cats:new Map(), contacts:new Map() };

function syncSetupError(error) {
  const msg = error && (error.message || error.details || String(error));
  if (msg && /workbook_(profiles|entries|categories|contacts)|does not exist|schema cache/i.test(msg)) {
    return new Error("새 동기화 테이블이 아직 준비되지 않았습니다. Supabase SQL 마이그레이션을 먼저 적용해 주세요.");
  }
  return error;
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "["+value.map(stableJson).join(",")+"]";
  return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stableJson(value[k])).join(",")+"}";
}
function cleanPayload(value) {
  if (Array.isArray(value)) return value.map(cleanPayload);
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value).forEach(k => {
      if(value.path&&(k==="url"||k==="data"))return; // signed URLs are transient display data
      const v = value[k];
      if (v !== undefined) out[k] = cleanPayload(v);
    });
    return out;
  }
  return value;
}
function makeBaseline(entries, cats, contacts) {
  const toMap = arr => new Map((arr||[]).map(item => [item.id, stableJson(cleanPayload(item))]));
  return { entries:toMap(entries), cats:toMap(cats), contacts:toMap(contacts) };
}
function rowToPayload(row, migrate) {
  return migrate({ id: row.id, ...(row.payload || {}), updatedAt: Number(row.updated_at || row.payload?.updatedAt || 0), deletedAt: Number(row.deleted_at || row.payload?.deletedAt || 0) });
}
function orderedRows(rows, migrate) {
  return (rows||[]).map(row => rowToPayload(row, migrate));
}

// ══════════════════════════════════════════════════════════
//  상수
// ══════════════════════════════════════════════════════════
const DEFAULT_CATS = [
  { id: "task",    label: "할 일",       icon: "◆", color: "#c0392b" },
  { id: "agenda",  label: "안건",        icon: "▣", color: "#8e44ad" },
  { id: "meeting", label: "회의",        icon: "◉", color: "#16a085" },
  { id: "inquiry", label: "문의사항",    icon: "？", color: "#d35400" },
  { id: "climate", label: "기후부 요청", icon: "✦", color: "#27ae60" },
  { id: "boss",    label: "부장님 요청", icon: "★", color: "#e67e22" },
];

const ICON_OPTIONS  = ["◆","◇","▣","◉","？","✦","★","●","◎","▶","✔","☆","■","▲","◐"];
const COLOR_PRESETS = ["#c0392b","#e74c3c","#d35400","#e67e22","#f1c40f","#27ae60","#16a085","#2980b9","#8e44ad","#7f8c8d","#1a1a2e"];
const colorToBg     = c => c + "18";

const PRIS      = [{ id:"high",label:"긴급",color:"#c0392b"},{id:"mid",label:"보통",color:"#e67e22"},{id:"low",label:"낮음",color:"#7f8c8d"}];
// 하단 네비 탭
const NAV_TABS = [
  {id:"list",    label:"업무",    icon:"📋"},
  {id:"date",    label:"날짜별",  icon:"📅"},
  {id:"tag",     label:"태그별",  icon:"🏷️"},
  {id:"contact", label:"담당자",  icon:"👤"},
];

// ── 유틸 ─────────────────────────────────────────────────
const pad      = n => String(n).padStart(2,"0");
const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtTs    = ts => { const d=new Date(ts); return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const uid      = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);

function fileToB64(file) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsDataURL(file); });
}
function fileToAttachment(file) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=e=>res({name:file.name,type:file.type,size:file.size,data:e.target.result}); r.onerror=rej; r.readAsDataURL(file); });
}
function dataUrlFile(dataUrl, name="legacy-file") {
  const [head, body] = String(dataUrl||"").split(",");
  const mime = (head.match(/data:([^;]+)/)||[])[1] || "application/octet-stream";
  const bin = atob(body || "");
  const bytes = new Uint8Array(bin.length);
  for (let i=0; i<bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type:mime });
}

// ── Supabase Storage 업로드 ───────────────────────────────
// 사진·첨부는 DB에 base64로 넣지 않고 private Storage에 저장하고, DB에는 path만 둔다.
const SB_BUCKET = "workbook";
async function sbUpload(file) {
  if (!sb) throw new Error("Supabase client unavailable");
  const { data: sessionData } = await sb.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error("로그인이 필요합니다.");
  const safe = (file.name||"file").replace(/[^\w.\-]/g,"_").slice(-40);
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2,8)}_${safe}`;
  const { error } = await sb.storage.from(SB_BUCKET).upload(path, file, {
    cacheControl: "31536000", upsert: false, contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data, error: signError } = await sb.storage.from(SB_BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (signError) throw signError;
  return { url: data.signedUrl, path };
}
async function uploadPhoto(file) {
  const asset = await sbUpload(file);
  return { url: asset.url, path: asset.path };
}
async function uploadAttachment(file) {
  const asset = await sbUpload(file);
  return { name:file.name, type:file.type, size:file.size, url:asset.url, path:asset.path };
}
// 첨부/사진 소스 추출 (신규 url 우선, 구버전 base64 호환)
const attSrc = a => a && (a.url || a.data) || "";
const photoSrc = p => (p && typeof p === "object") ? (p.url || p.data || "") : (p || "");

async function createSignedUrls(records) {
  if (!sb) return records;
  const paths = [];
  const visit = value => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      if (value.path && !String(value.url||"").startsWith("data:")) paths.push(value.path);
      Object.values(value).forEach(visit);
    }
  };
  visit(records);
  const unique = [...new Set(paths)];
  if (!unique.length) return records;
  const { data, error } = await sb.storage.from(SB_BUCKET).createSignedUrls(unique, 60 * 60 * 24);
  if (error) { console.warn("[storage] signed url 생성 실패:", error.message); return records; }
  const urlByPath = new Map((data||[]).filter(x=>x.signedUrl).map(x=>[x.path, x.signedUrl]));
  const hydrate = value => {
    if (Array.isArray(value)) return value.map(hydrate);
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).forEach(k => out[k] = hydrate(value[k]));
      if (out.path && urlByPath.has(out.path)) out.url = urlByPath.get(out.path);
      return out;
    }
    return value;
  };
  return hydrate(records);
}

async function migrateEmbeddedAssets(records) {
  const migratePhoto = async photo => {
    if (typeof photo === "string" && photo.startsWith("data:")) {
      const file = dataUrlFile(photo, "legacy-photo.jpg");
      return await uploadPhoto(file);
    }
    return photo;
  };
  const migrateAttachment = async att => {
    if (att?.data && String(att.data).startsWith("data:") && !att.path) {
      const file = dataUrlFile(att.data, att.name || "legacy-attachment");
      const uploaded = await uploadAttachment(file);
      return { ...att, data:undefined, ...uploaded };
    }
    return att;
  };
  const next = [];
  for (const record of records || []) {
    const copy = { ...record };
    if (copy.photos) copy.photos = await Promise.all(copy.photos.map(migratePhoto));
    if (copy.attachments) copy.attachments = await Promise.all(copy.attachments.map(migrateAttachment));
    next.push(copy);
  }
  return next;
}

function fmtSize(b){ return b<1024?b+"B":b<1048576?(b/1024).toFixed(1)+"KB":(b/1048576).toFixed(1)+"MB"; }
function attachIcon(t){
  if(!t) return "📎";
  if(t.includes("pdf")) return "📄";
  if(t.includes("word")||t.includes("document")) return "📝";
  if(t.includes("sheet")||t.includes("excel")||t.includes("spreadsheet")) return "📊";
  if(t.includes("presentation")||t.includes("powerpoint")) return "📑";
  if(t.includes("text")) return "📃";
  if(t.includes("zip")||t.includes("archive")||t.includes("compressed")) return "🗜️";
  return "📎";
}
// 구 버전(photo 단일) → 신 버전(photos 배열) 마이그레이션
const migrateEntry = e=>({
  ...e,
  updatedAt:Number(e.updatedAt||e.createdAt||0),
  deletedAt:Number(e.deletedAt||0),
  photos:e.photos||(e.photo?[e.photo]:[]),
  attachments:e.attachments||[],
});
const migrateContact = c=>({
  ...c,
  updatedAt:Number(c.updatedAt||c.createdAt||0),
  deletedAt:Number(c.deletedAt||0),
  photos:c.photos||(c.photo?[c.photo]:[]),
});
const isLiveRecord = record => !record.deletedAt;
const recordVersion = record => Math.max(Number(record?.updatedAt||0),Number(record?.deletedAt||0));

function mergeRecords(local, remote, migrate, preferLocalOrder=true) {
  const l=(local||[]).map(migrate), r=(remote||[]).map(migrate);
  const lMap=new Map(l.map(item=>[item.id,item]));
  const rMap=new Map(r.map(item=>[item.id,item]));
  const primary=preferLocalOrder?l:r;
  const secondary=preferLocalOrder?r:l;
  const ids=[...primary.map(item=>item.id),...secondary.map(item=>item.id)]
    .filter((id,index,all)=>id&&all.indexOf(id)===index);
  return ids.map(id=>{
    const left=lMap.get(id), right=rMap.get(id);
    if(!left) return right;
    if(!right) return left;
    const lv=recordVersion(left), rv=recordVersion(right);
    if(lv===rv) return preferLocalOrder?left:right;
    return lv>rv?left:right;
  });
}

function sameRecords(a,b,migrate) {
  const normalize=list=>(list||[]).map(migrate).sort((x,y)=>String(x.id).localeCompare(String(y.id)));
  return stableJson(cleanPayload(normalize(a)))===stableJson(cleanPayload(normalize(b)));
}

async function sbPullRows(userId) {
  if (!sb) throw new Error("Supabase client unavailable");
  try {
    const [entryRes, catRes, contactRes, profileRes] = await Promise.all([
      sb.from(ROW_TABLES.entries).select("id,payload,updated_at,deleted_at").eq("user_id", userId),
      sb.from(ROW_TABLES.cats).select("id,payload,sort_order,updated_at").eq("user_id", userId).order("sort_order", { ascending:true }),
      sb.from(ROW_TABLES.contacts).select("id,payload,sort_order,updated_at,deleted_at").eq("user_id", userId).order("sort_order", { ascending:true }),
      sb.from(ROW_TABLES.profile).select("legacy_migrated").eq("user_id", userId).maybeSingle(),
    ]);
    for (const res of [entryRes, catRes, contactRes, profileRes]) if (res.error) throw res.error;

    let entries = orderedRows(entryRes.data, migrateEntry);
    let cats = orderedRows(catRes.data, x=>x);
    let contacts = orderedRows(contactRes.data, migrateContact);
    let migrated = !!profileRes.data?.legacy_migrated;

    if (!migrated && !entries.length && !contacts.length && !cats.length) {
      const legacy = await sb.from("workbook_sync").select("*").eq("id", "main").maybeSingle();
      if (legacy.error && legacy.error.code !== "PGRST116") throw legacy.error;
      if (legacy.data) {
        entries = await migrateEmbeddedAssets((legacy.data.entries||[]).map(migrateEntry));
        contacts = await migrateEmbeddedAssets((legacy.data.contacts||[]).map(migrateContact));
        cats = legacy.data.cats?.length ? legacy.data.cats : DEFAULT_CATS;
        await sbPushRows(userId, entries, cats, contacts, makeBaseline([], [], []), true);
      }
      await sb.from(ROW_TABLES.profile).upsert({
        user_id:userId,
        legacy_migrated:true,
        migrated_at:new Date().toISOString(),
      });
    }

    const hydrated = await createSignedUrls({ entries, contacts });
    entries = hydrated.entries || entries;
    contacts = hydrated.contacts || contacts;
    const result = { entries, cats: cats.length ? cats : DEFAULT_CATS, contacts };
    _baseline = makeBaseline(result.entries, result.cats, result.contacts);
    return result;
  } catch (error) {
    throw syncSetupError(error);
  }
}

function changedRows(list, baselineMap, forceAll=false) {
  return (list||[])
    .map((item,index)=>({ item, index, json:stableJson(cleanPayload(item)) }))
    .filter(row => forceAll || baselineMap.get(row.item.id) !== row.json);
}
function removedIds(baselineMap, list) {
  const live = new Set((list||[]).map(item=>item.id));
  return [...baselineMap.keys()].filter(id => !live.has(id));
}

async function sbPushRows(userId, entries, cats, contacts, baseline=_baseline, forceAll=false) {
  if (!sb) throw new Error("Supabase client unavailable");
  try {
    const entryChanges = changedRows(entries, baseline.entries, forceAll);
    const catChanges = changedRows(cats, baseline.cats, forceAll);
    const contactChanges = changedRows(contacts, baseline.contacts, forceAll);
    const catDeletes = removedIds(baseline.cats, cats);

    const calls = [];
    if (entryChanges.length) calls.push(sb.from(ROW_TABLES.entries).upsert(entryChanges.map(({item})=>({
      user_id:userId, id:item.id, payload:cleanPayload(item),
      updated_at:Number(item.updatedAt||0), deleted_at:Number(item.deletedAt||0),
    }))));
    if (catChanges.length) calls.push(sb.from(ROW_TABLES.cats).upsert(catChanges.map(({item,index})=>({
      user_id:userId, id:item.id, payload:cleanPayload(item),
      sort_order:index, updated_at:Date.now(),
    }))));
    if (contactChanges.length) calls.push(sb.from(ROW_TABLES.contacts).upsert(contactChanges.map(({item,index})=>({
      user_id:userId, id:item.id, payload:cleanPayload(item),
      sort_order:Number(item.order ?? index), updated_at:Number(item.updatedAt||0), deleted_at:Number(item.deletedAt||0),
    }))));
    if (catDeletes.length) calls.push(sb.from(ROW_TABLES.cats).delete().eq("user_id", userId).in("id", catDeletes));
    const results = await Promise.all(calls);
    const failed = results.find(res=>res.error);
    if (failed) throw failed.error;
    _baseline = makeBaseline(entries, cats, contacts);
    _syncMuteUntil = Date.now() + 2500;
    return Date.now();
  } catch (error) {
    throw syncSetupError(error);
  }
}

function getDday(dl) {
  if(!dl) return null;
  const t=new Date(); t.setHours(0,0,0,0);
  const d=new Date(dl); d.setHours(0,0,0,0);
  const diff=Math.round((d-t)/86400000);
  if(diff===0) return {label:"D-Day",color:"#c0392b"};
  if(diff>0)   return {label:"D-"+diff, color:diff<=3?"#e67e22":"#2980b9"};
  return {label:"D+"+Math.abs(diff)+" 초과",color:"#aaa"};
}

// ── 엑셀 ─────────────────────────────────────────────────
function exportXLSX(entries, cats, contacts) {
  const getCat = id => cats.find(c=>c.id===id)||{label:id};
  const getPri = id => PRIS.find(p=>p.id===id)||PRIS[1];
  const wb = XLSX_LIB.utils.book_new();
  // 항목 시트
  const eRows = entries.map(e=>({
    분류:getCat(e.category).label, 우선순위:getPri(e.priority).label,
    날짜:e.date, 마감기한:e.deadline||"", 제목:e.title, 내용:e.body||"",
    태그:(e.tags||[]).join(", "), 완료:e.done?"완료":"미완료",
    등록일시:fmtTs(e.createdAt), 수정일시:fmtTs(e.updatedAt),
  }));
  const ws1 = XLSX_LIB.utils.json_to_sheet(eRows);
  ws1["!cols"]=[14,9,12,12,30,40,20,7,18,18].map(w=>({wch:w}));
  XLSX_LIB.utils.book_append_sheet(wb,ws1,"업무 항목");
  // 담당자 시트
  const cRows = contacts.map(c=>({ 회사:c.company||"", 직함:c.title||"", 성함:c.name||"", 업무:c.role||"", 연락처:c.phone||"", 이메일:c.email||"", 메모:c.memo||"" }));
  const ws2 = XLSX_LIB.utils.json_to_sheet(cRows);
  ws2["!cols"]=[18,14,12,20,16,24,30].map(w=>({wch:w}));
  XLSX_LIB.utils.book_append_sheet(wb,ws2,"담당자");
  XLSX_LIB.writeFile(wb,"업무수첩_"+todayStr()+".xlsx");
}

// ══════════════════════════════════════════════════════════
//  공통 UI 컴포넌트
// ══════════════════════════════════════════════════════════
