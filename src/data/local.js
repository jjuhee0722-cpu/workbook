const { useState, useEffect, useRef, useCallback } = React;
const XLSX_LIB = window.XLSX;

// ══════════════════════════════════════════════════════════
//  IndexedDB 레이어 — 캐시/쿠키 삭제에도 데이터 보존
// ══════════════════════════════════════════════════════════
const DB_NAME    = "workbook_db";
const DB_VERSION = 1;
const STORES     = { entries: "entries", cats: "cats", contacts: "contacts", meta: "meta" };

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      Object.values(STORES).forEach(name => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function idbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function idbPut(store, obj) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(obj);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

async function idbDelete(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

async function idbClear(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

async function idbReplaceAll(store, items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    objectStore.clear();
    items.forEach(item => objectStore.put(item));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("IndexedDB transaction aborted")); };
  });
}

// meta 단건 (cats 등 배열 통째로 저장)
async function idbGetMeta(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORES.meta, "readonly");
    const req = tx.objectStore(STORES.meta).get(key);
    req.onsuccess = e => resolve(e.target.result?.value ?? null);
    req.onerror   = e => reject(e.target.error);
  });
}
async function idbSetMeta(key, value) {
  await idbPut(STORES.meta, { id: key, value });
}

// ══════════════════════════════════════════════════════════
//  Supabase 동기화 레이어
// ══════════════════════════════════════════════════════════
