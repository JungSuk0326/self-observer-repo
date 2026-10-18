import type { SessionRecord } from "./types";

/**
 * 세션 히스토리 저장소 (G-2) — IndexedDB, 의존성 없음.
 * 로컬 우선 원칙(1): 기록은 이 브라우저에만 남는다.
 *
 * IndexedDB를 못 쓰는 환경(일부 시크릿 모드 등)에선 메모리에만 두고 조용히 넘어간다.
 * 기록 저장 실패가 세션 자체를 망쳐선 안 된다.
 */
const DB_NAME = "focus-guardian";
const DB_VERSION = 1;
const STORE = "sessions";

let dbPromise: Promise<IDBDatabase> | null = null;
const memoryFallback: SessionRecord[] = [];

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB 없음"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("endedAtWall", "endedAtWall");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    dbPromise = null; // 다음 호출에서 재시도
  });
  return dbPromise;
}

export async function saveSession(record: SessionRecord): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("세션 기록 저장 실패 — 이번 방문 동안만 유지", e);
    memoryFallback.push(record);
  }
}

/** 모든 기록, 오래된 것부터 */
export async function loadSessions(): Promise<SessionRecord[]> {
  try {
    const db = await openDb();
    const rows = await new Promise<SessionRecord[]>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).index("endedAtWall").getAll();
      req.onsuccess = () => resolve(req.result as SessionRecord[]);
      req.onerror = () => reject(req.error);
    });
    return [...rows, ...memoryFallback].sort((a, b) => a.endedAtWall - b.endedAtWall);
  } catch {
    return [...memoryFallback];
  }
}
