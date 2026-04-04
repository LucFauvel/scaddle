import { Injectable } from '@angular/core';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  isError?: boolean;
  isPending?: boolean; // transient UI state, never persisted
}

const DB_NAME = 'scaddle-chat';
const STORE   = 'session';

@Injectable({ providedIn: 'root' })
export class ChatStoreService {
  private readonly db: Promise<IDBDatabase>;

  constructor() {
    this.db = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async saveMessages(messages: ChatMessage[]): Promise<void> {
    const persisted = messages.filter(m => !m.isPending);
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
      tx.objectStore(STORE).put({ id: 1, messages: persisted });
    });
  }

  async loadMessages(): Promise<ChatMessage[]> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(1);
      req.onsuccess = () => resolve(req.result?.messages ?? []);
      req.onerror   = () => reject(req.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
      tx.objectStore(STORE).clear();
    });
  }
}
