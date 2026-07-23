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
const BACKUP_FORMAT = 'la-carta-backup';
const BACKUP_VERSION = 1;
const BACKUP_FONT_SIZE_MIN = 70;
const BACKUP_FONT_SIZE_MAX = 150;

export function createStorage({
  indexedDB = globalThis.indexedDB,
  localStorage = globalThis.localStorage,
  console = globalThis.console,
  now = () => Date.now(),
} = {}) {

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
  _recoveryNotice: null,

  consumeRecoveryNotice() {
    const notice = this._recoveryNotice;
    this._recoveryNotice = null;
    return notice;
  },

  async load() {
    this._recoveryNotice = null;
    try {
      const indexedCards = this._normalizeCards(await this._readAllFromIndexedDB());
      if (indexedCards.length > 0) {
        this._syncToLocalStorage(indexedCards);
        return indexedCards;
      }

      const local = this._loadFromLocalStorage();
      if (local.cards.length > 0) {
        await this._writeAllToIndexedDB(local.cards);
        return local.cards;
      }
      return [];
    } catch {
      const local = this._loadFromLocalStorage();
      if (local.cards.length > 0) {
        try {
          await this._writeAllToIndexedDB(local.cards);
        } catch {
          // The valid local copy remains usable.
        }
        if (local.source) {
          this._recoveryNotice = 'Karty boli obnovené zo zálohy.';
        }
        return local.cards;
      }
      return [];
    }
  },

  async save(cards) {
    const normalized = this._normalizeCards(cards);
    let indexedDBSaved = false;
    let localStorageSaved = false;

    try {
      await this._writeAllToIndexedDB(normalized);
      indexedDBSaved = true;
    } catch (e) {
      console.error('IndexedDB save failed:', e);
    }

    localStorageSaved = this._syncToLocalStorage(normalized);

    const result = {
      indexedDB: indexedDBSaved,
      localStorage: localStorageSaved,
      persisted: indexedDBSaved || localStorageSaved
    };
    if (!result.persisted) throw new Error('Cards could not be persisted');
    return result;
  },

  _readLocalCards(key) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return null;
      return this._normalizeCards(JSON.parse(value));
    } catch {
      return null;
    }
  },

  _loadFromLocalStorage() {
    const primary = this._readLocalCards(STORAGE_KEY);
    if (primary) return { cards: primary, source: 'primary' };

    const backup = this._readLocalCards(BACKUP_KEY);
    if (backup) return { cards: backup, source: 'backup' };

    return { cards: [], source: null };
  },

  _syncToLocalStorage(cards) {
    try {
      const existing = this._readLocalCards(STORAGE_KEY);
      if (existing) {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(existing));
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
      return true;
    } catch (e) {
      console.error('localStorage sync failed:', e);
      return false;
    }
  },

  exportData(cards, settings, now = new Date()) {
    const payload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      cards: this._normalizeCards(cards),
      settings: this._normalizeBackupSettings(settings)
    };
    return JSON.stringify(payload, null, 2);
  },

   parseImportData(jsonString) {
     const value = JSON.parse(jsonString);
     if (Array.isArray(value)) {
       return {
         cards: this._normalizeCards(value),
         settings: null,
         legacy: true
       };
     }
     if (!value || value.format !== BACKUP_FORMAT) {
       throw new Error('Invalid backup format');
     }
     if (value.version !== BACKUP_VERSION) {
       throw new Error('Unsupported backup version');
     }
     return {
       cards: this._normalizeCards(value.cards),
       settings: value.settings === undefined
         ? null
         : this._normalizeBackupSettings(value.settings),
       legacy: false
     };
   },

   async importData(jsonString, applySettings = () => {}) {
     const parsed = this.parseImportData(jsonString);
     await this.save(parsed.cards);
     if (parsed.settings) applySettings(parsed.settings);
     return parsed;
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
       const createdAt = Number.isFinite(card.createdAt) ? card.createdAt : now();

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

   _normalizeBackupSettings(settings) {
     if (!settings || typeof settings !== 'object') {
       throw new Error('Invalid backup settings');
     }
     const translation = this._normalizeTranslationSettingsStrict(settings.translation);
     const fontSizes = this._normalizeFontSizesStrict(settings.fontSizes);
     if (typeof settings.showArrows !== 'boolean') {
       throw new Error('Invalid backup settings');
     }
     return { translation, fontSizes, showArrows: settings.showArrows };
   },

   _normalizeTranslationSettingsStrict(settings) {
     const source = settings?.source;
     const target = settings?.target;
     if (
       !SUPPORTED_TRANSLATION_LANGUAGES.includes(source) ||
       !SUPPORTED_TRANSLATION_LANGUAGES.includes(target) ||
       source === target
     ) {
       throw new Error('Invalid backup settings');
     }
     return { source, target };
   },

   _normalizeFontSizesStrict(fontSizes) {
     const front = fontSizes?.front;
     const back = fontSizes?.back;
     if (
       !Number.isInteger(front) ||
       !Number.isInteger(back) ||
       front < BACKUP_FONT_SIZE_MIN ||
       front > BACKUP_FONT_SIZE_MAX ||
       back < BACKUP_FONT_SIZE_MIN ||
       back > BACKUP_FONT_SIZE_MAX
     ) {
       throw new Error('Invalid backup settings');
     }
     return { front, back };
   },

   async _readAllFromIndexedDB() {
     const db = await openDB();
     try {
       const tx = db.transaction(STORE_NAME, 'readonly');
       return await this._request(tx.objectStore(STORE_NAME).getAll());
     } finally {
       db.close();
     }
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
     return now().toString(36) + Math.random().toString(36).slice(2, 7);
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

return storage;
}

export const storage = createStorage();
