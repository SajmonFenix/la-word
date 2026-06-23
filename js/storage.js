const STORAGE_KEY = 'laword_cards';
const BACKUP_KEY = 'laword_cards_backup';
const FONT_SIZE_KEY = 'laword_fontSize';
const DB_NAME = 'laword';
const STORE_NAME = 'cards';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const storage = {
  async load() {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const all = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      if (all && all.length > 0) {
        this._syncToLocalStorage(all);
        return all;
      }
      const fallback = this._loadFromLocalStorage();
      if (fallback.length > 0) {
        await this.save(fallback);
      }
      return fallback;
    } catch {
      return this._loadFromLocalStorage();
    }
  },

  async save(cards) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const card of cards) {
        store.put(card);
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (e) {
      console.error('IndexedDB save failed:', e);
    }
    this._syncToLocalStorage(cards);
  },

  _loadFromLocalStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) return JSON.parse(data);
      const backup = localStorage.getItem(BACKUP_KEY);
      return backup ? JSON.parse(backup) : [];
    } catch {
      return [];
    }
  },

  _syncToLocalStorage(cards) {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      localStorage.setItem(BACKUP_KEY, existing || '[]');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch (e) {
      console.error('localStorage sync failed:', e);
    }
  },

  exportData() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data || '[]';
    } catch {
      return '[]';
    }
  },

   async importData(jsonString) {
     const cards = JSON.parse(jsonString);
     if (!Array.isArray(cards)) throw new Error('Invalid format');
     await this.save(cards);
     return cards;
   },

   // Font size management
   saveFontSizes(front, back) {
     try {
       const fontSizes = { front, back };
       localStorage.setItem(FONT_SIZE_KEY, JSON.stringify(fontSizes));
     } catch (e) {
       console.error('Font size save failed:', e);
     }
   },

   loadFontSizes() {
     try {
       const data = localStorage.getItem(FONT_SIZE_KEY);
       if (data) return JSON.parse(data);
       return { front: 100, back: 100 };
     } catch {
       return { front: 100, back: 100 };
     }
   }
};
