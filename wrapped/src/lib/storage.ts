import type { Play } from "./types";

/**
 * Everything stays in the visitor's browser (IndexedDB). Nothing is uploaded.
 */
const DB = "encore";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}

export interface Library {
  plays: Play[];
  source: "demo" | "upload";
  files: string[];
  savedAt: number;
}

export async function loadLibrary(): Promise<Library | null> {
  try {
    return (await tx<Library | undefined>("readonly", (s) => s.get("library"))) ?? null;
  } catch {
    return null;
  }
}

export async function saveLibrary(lib: Library): Promise<void> {
  try {
    await tx("readwrite", (s) => s.put(lib, "library"));
  } catch {
    /* private mode etc. — app still works for this session */
  }
}

export async function clearLibrary(): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete("library"));
  } catch {
    /* ignore */
  }
}

/** Small per-viewer preferences + saved custom metrics live in localStorage. */
export function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
