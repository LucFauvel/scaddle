import { Injectable } from '@angular/core';

const DB_NAME     = 'scaddle';
const DB_VERSION  = 1;
const STORE       = 'history';
const MAX_ENTRIES = 100;

export type HistorySource = 'edit' | 'ai' | 'translate' | 'rotate' | 'scale' | 'restore';

export interface HistoryEntry {
  id:      number;
  content: string;
  savedAt: number; // Date.now()
  source:  HistorySource;
}

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly db: Promise<IDBDatabase>;

  constructor() {
    this.db = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  /** Persist a new snapshot and trim the store to MAX_ENTRIES. */
  async save(content: string, source: HistorySource = 'edit'): Promise<void> {
    const db = await this.db;

    await new Promise<void>((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);

      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);

      store.add({ content, savedAt: Date.now(), source } satisfies Omit<HistoryEntry, 'id'>);

      // Trim oldest entries so the store never exceeds MAX_ENTRIES.
      const countReq = store.count();
      countReq.onsuccess = () => {
        const excess = countReq.result - MAX_ENTRIES;
        if (excess <= 0) return;

        let trimmed = 0;
        const cursor = store.openCursor(); // ascending = oldest first
        cursor.onsuccess = () => {
          if (!cursor.result || trimmed >= excess) return;
          cursor.result.delete();
          trimmed++;
          cursor.result.continue();
        };
      };
    });
  }

  /** Return the content of the most recently saved entry, or null if none. */
  async loadLatest(): Promise<string | null> {
    const db = await this.db;

    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).openCursor(null, 'prev'); // descending = newest first

      req.onsuccess = () => resolve(req.result?.value.content ?? null);
      req.onerror   = () => reject(req.error);
    });
  }

  /** Delete every entry in the store. */
  async clear(): Promise<void> {
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
      tx.objectStore(STORE).clear();
    });
  }

  /** Return all entries, most recent first. */
  async getHistory(): Promise<HistoryEntry[]> {
    const db = await this.db;

    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();

      req.onsuccess = () => resolve((req.result as HistoryEntry[]).reverse());
      req.onerror   = () => reject(req.error);
    });
  }
}
