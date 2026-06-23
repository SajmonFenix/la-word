const STORAGE_KEY = 'laword_cards';
const BACKUP_KEY = 'laword_cards_backup';
const FONT_SIZE_KEY = 'laword_fontSize';
const TRANSLATION_SETTINGS_KEY = 'laword_translation_settings';
const DB_NAME = 'laword';
const STORE_NAME = 'cards';
const DB_VERSION = 1;
const DEFAULT_CARD_COLOR = '#4A90D9';
const SUPPORTED_TRANSLATION_LANGUAGES = ['sk', 'en', 'de', 'es', 'it'];
const DEFAULT_TRANSLATION_SETTINGS = { source: 'sk', target: 'en' };

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
        const normalized = this._normalizeCards(all);
        this._syncToLocalStorage(normalized);
        return normalized;
      }
      const fallback = this._loadFromLocalStorage();
      if (fallback.length > 0) {
        const normalized = this._normalizeCards(fallback);
        await this.save(normalized);
        return normalized;
      }
      return [];
    } catch {
      return this._loadFromLocalStorage();
    }
  },

  async save(cards) {
    const normalized = this._normalizeCards(cards);
    try {
      await this._writeAllToIndexedDB(normalized);
    } catch (e) {
      console.error('IndexedDB save failed:', e);
    }
    this._syncToLocalStorage(normalized);
  },

  _loadFromLocalStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) return this._normalizeCards(JSON.parse(data));
      const backup = localStorage.getItem(BACKUP_KEY);
      return backup ? this._normalizeCards(JSON.parse(backup)) : [];
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
     const cards = this._normalizeCards(JSON.parse(jsonString));
     await this.save(cards);
     return cards;
   },

   _normalizeCards(value) {
     if (!Array.isArray(value)) throw new Error('Invalid format');

     return value.map((card, index) => {
       if (!card || typeof card !== 'object') {
         throw new Error(`Invalid card at index ${index}`);
       }

       const front = String(card.front || '').trim();
       const back = String(card.back || '').trim();

       if (!front || !back) {
         throw new Error(`Invalid card at index ${index}`);
       }

       const id = String(card.id || this._generateId()).replace(/[^a-z0-9_-]/gi, '');
       const color = /^#[0-9a-f]{6}$/i.test(card.color || '') ? card.color : DEFAULT_CARD_COLOR;
       const createdAt = Number.isFinite(card.createdAt) ? card.createdAt : Date.now();

       return {
         id: id || this._generateId(),
         front,
         hint: String(card.hint || '').trim(),
         back,
         color,
         createdAt
       };
     });
   },

   async _writeAllToIndexedDB(cards) {
     const db = await openDB();
     try {
       const tx = db.transaction(STORE_NAME, 'readwrite');
       const store = tx.objectStore(STORE_NAME);
       const transactionDone = new Promise((resolve, reject) => {
         tx.oncomplete = () => resolve();
         tx.onerror = () => reject(tx.error);
         tx.onabort = () => reject(tx.error);
       });
       await this._request(store.clear());
       for (const card of cards) {
         await this._request(store.put(card));
       }
       await transactionDone;
     } finally {
       db.close();
     }
   },

   _request(request) {
     return new Promise((resolve, reject) => {
       request.onsuccess = () => resolve(request.result);
       request.onerror = () => reject(request.error);
     });
   },

   _generateId() {
     return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
   },

   saveTranslationSettings(source, target) {
     const settings = this._normalizeTranslationSettings({ source, target });
     localStorage.setItem(TRANSLATION_SETTINGS_KEY, JSON.stringify(settings));
   },

   loadTranslationSettings() {
     try {
       const data = localStorage.getItem(TRANSLATION_SETTINGS_KEY);
       return this._normalizeTranslationSettings(data ? JSON.parse(data) : DEFAULT_TRANSLATION_SETTINGS);
     } catch {
       return { ...DEFAULT_TRANSLATION_SETTINGS };
     }
   },

   _normalizeTranslationSettings(settings) {
     const source = settings?.source;
     const target = settings?.target;
     if (
       SUPPORTED_TRANSLATION_LANGUAGES.includes(source) &&
       SUPPORTED_TRANSLATION_LANGUAGES.includes(target) &&
       source !== target
     ) {
       return { source, target };
     }
     return { ...DEFAULT_TRANSLATION_SETTINGS };
   }
};
