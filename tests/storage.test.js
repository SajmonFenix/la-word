import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const silentConsole = { ...console, error: () => {} };

function loadStorage(extraContext = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8');
  const context = {
    console,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    indexedDB: {},
    ...extraContext,
  };

  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.__storage = storage;`, context);
  return context.__storage;
}

function createLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    snapshot: () => Object.fromEntries(values),
  };
}

function loadStorageWithIndexedCards(indexedCards, localStorage) {
  const store = {
    getAll: () => requestResult(indexedCards),
    clear: () => requestResult(undefined),
    put: () => requestResult(undefined),
  };
  const tx = {
    objectStore: () => store,
    oncomplete: null,
    onerror: null,
    onabort: null,
  };
  const db = {
    transaction: () => tx,
    close: () => {},
  };
  return loadStorage({
    localStorage,
    indexedDB: {
      open: () => {
        const request = {};
        queueMicrotask(() => {
          request.result = db;
          request.onsuccess();
        });
        return request;
      },
    },
  });

  function requestResult(result) {
    const request = {};
    queueMicrotask(() => {
      request.result = result;
      request.onsuccess();
      if (tx.oncomplete) tx.oncomplete();
    });
    return request;
  }
}

function loadStorageWithIndexedFailure(localStorage) {
  return loadStorage({
    localStorage,
    indexedDB: { open: () => requestFailure(new Error('db down')) },
  });
}

function requestFailure(error) {
  const request = {};
  queueMicrotask(() => {
    request.error = error;
    request.onerror();
  });
  return request;
}

test('uses the backup key when the primary local copy is malformed', () => {
  const local = createLocalStorage({
    laword_cards: '{broken',
    laword_cards_backup: JSON.stringify([
      { id: 'safe', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 },
    ]),
  });
  const storage = loadStorage({ localStorage: local });

  const result = storage._loadFromLocalStorage();

  assert.equal(result.source, 'backup');
  assert.equal(result.cards[0].id, 'safe');
});

test('treats missing local data as an empty new state', () => {
  const storage = loadStorage({ localStorage: createLocalStorage() });

  const result = storage._loadFromLocalStorage();
  assert.equal(result.source, null);
  assert.equal(result.cards.length, 0);
});

test('rotates only a valid primary local copy into backup', () => {
  const local = createLocalStorage({
    laword_cards: JSON.stringify([
      { id: 'old', front: 'stary', back: 'old', hint: '', color: '#123456', createdAt: 1 },
    ]),
  });
  const storage = loadStorage({ localStorage: local });

  storage._syncToLocalStorage([
    { id: 'new', front: 'novy', back: 'new', hint: '', color: '#123456', createdAt: 2 },
  ]);

  const values = local.snapshot();
  assert.equal(JSON.parse(values.laword_cards_backup)[0].id, 'old');
  assert.equal(JSON.parse(values.laword_cards)[0].id, 'new');
});

test('prefers valid IndexedDB cards and reports no recovery', async () => {
  const storage = loadStorageWithIndexedCards([
    { id: 'db', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 },
  ], createLocalStorage());

  const loadedCards = await storage.load();

  assert.equal(loadedCards[0].id, 'db');
  assert.equal(storage.consumeRecoveryNotice(), null);
});

test('migrates a local copy when IndexedDB is empty', async () => {
  const local = createLocalStorage({
    laword_cards: JSON.stringify([
      { id: 'local', front: 'voda', back: 'water', hint: '', color: '#123456', createdAt: 1 },
    ]),
  });
  const storage = loadStorageWithIndexedCards([], local);

  const loadedCards = await storage.load();

  assert.equal(loadedCards[0].id, 'local');
  assert.equal(storage.consumeRecoveryNotice(), null);
});

test('reports recovery when the backup copy is used', async () => {
  const local = createLocalStorage({
    laword_cards: '{broken',
    laword_cards_backup: JSON.stringify([
      { id: 'backup', front: 'les', back: 'forest', hint: '', color: '#123456', createdAt: 1 },
    ]),
  });
  const storage = loadStorageWithIndexedFailure(local);

  const loadedCards = await storage.load();

  assert.equal(loadedCards[0].id, 'backup');
  assert.equal(storage.consumeRecoveryNotice(), 'Karty boli obnovené zo zálohy.');
  assert.equal(storage.consumeRecoveryNotice(), null);
});

test('reports recovery from the primary local mirror after IndexedDB fails', async () => {
  const local = createLocalStorage({
    laword_cards: JSON.stringify([
      { id: 'mirror', front: 'strom', back: 'tree', hint: '', color: '#123456', createdAt: 1 },
    ]),
  });
  const storage = loadStorageWithIndexedFailure(local);

  const loadedCards = await storage.load();

  assert.equal(loadedCards[0].id, 'mirror');
  assert.equal(storage.consumeRecoveryNotice(), 'Karty boli obnovené zo zálohy.');
});

test('reports degraded success when IndexedDB fails but localStorage succeeds', async () => {
  const local = createLocalStorage();
  const storage = loadStorage({
    console: silentConsole,
    indexedDB: { open: () => requestFailure(new Error('db down')) },
    localStorage: local,
  });

  const result = await storage.save([
    { id: 'a', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 },
  ]);

  assert.equal(JSON.stringify(result), JSON.stringify({
    indexedDB: false,
    localStorage: true,
    persisted: true,
  }));
});

test('throws when neither storage backend accepts the cards', async () => {
  const storage = loadStorage({
    console: silentConsole,
    indexedDB: { open: () => requestFailure(new Error('db down')) },
    localStorage: {
      getItem: () => null,
      setItem: () => { throw new Error('quota'); },
    },
  });

  await assert.rejects(
    storage.save([
      { id: 'a', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 },
    ]),
    /Cards could not be persisted/
  );
});

test('exports cards and settings as a versioned backup', () => {
  const storage = loadStorage();
  const json = storage.exportData(
    [{ id: 'a', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 }],
    {
      translation: { source: 'sk', target: 'en' },
      fontSizes: { front: 110, back: 90 },
      showArrows: false,
    },
    new Date('2026-07-23T12:00:00.000Z')
  );

  assert.equal(JSON.stringify(JSON.parse(json)), JSON.stringify({
    format: 'la-carta-backup',
    version: 1,
    exportedAt: '2026-07-23T12:00:00.000Z',
    cards: [{ id: 'a', front: 'dom', hint: '', back: 'house', color: '#123456', createdAt: 1 }],
    settings: {
      translation: { source: 'sk', target: 'en' },
      fontSizes: { front: 110, back: 90 },
      showArrows: false,
    },
  }));
});

test('parses a version 1 backup with normalized cards and settings', () => {
  const storage = loadStorage();
  const parsed = storage.parseImportData(JSON.stringify({
    format: 'la-carta-backup',
    version: 1,
    exportedAt: '2026-07-23T12:00:00.000Z',
    cards: [{ front: ' dom ', back: ' house ' }],
    settings: {
      translation: { source: 'de', target: 'it' },
      fontSizes: { front: 120, back: 80 },
      showArrows: false,
    },
  }));

  assert.equal(parsed.legacy, false);
  assert.equal(parsed.cards[0].front, 'dom');
  assert.equal(JSON.stringify(parsed.settings.fontSizes), JSON.stringify({ front: 120, back: 80 }));
});

test('parses a legacy card array without changing settings', () => {
  const storage = loadStorage();
  const parsed = storage.parseImportData(JSON.stringify([{ front: 'dom', back: 'house' }]));

  assert.equal(parsed.legacy, true);
  assert.equal(parsed.settings, null);
  assert.equal(parsed.cards[0].front, 'dom');
});

test('allows a version 1 backup to omit settings', () => {
  const storage = loadStorage();
  const parsed = storage.parseImportData(JSON.stringify({
    format: 'la-carta-backup',
    version: 1,
    cards: [{ front: 'dom', back: 'house' }],
  }));

  assert.equal(parsed.legacy, false);
  assert.equal(parsed.settings, null);
});

test('rejects unsupported versions and invalid present settings', () => {
  const storage = loadStorage();
  assert.throws(
    () => storage.parseImportData('{"format":"la-carta-backup","version":2,"cards":[]}'),
    /Unsupported backup version/
  );
  assert.throws(
    () => storage.parseImportData(JSON.stringify({
      format: 'la-carta-backup',
      version: 1,
      cards: [],
      settings: {
        translation: { source: 'sk', target: 'sk' },
        fontSizes: { front: 100, back: 100 },
        showArrows: true,
      },
    })),
    /Invalid backup settings/
  );
});

test('applies imported settings only after cards persist', async () => {
  const versionOneJson = JSON.stringify({
    format: 'la-carta-backup',
    version: 1,
    cards: [{ id: 'a', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 }],
    settings: {
      translation: { source: 'sk', target: 'en' },
      fontSizes: { front: 110, back: 90 },
      showArrows: false,
    },
  });
  const applied = [];
  const storage = loadStorage();
  storage.save = async () => ({ indexedDB: true, localStorage: true, persisted: true });

  const result = await storage.importData(versionOneJson, (settings) => applied.push(settings));

  assert.equal(result.cards.length, 1);
  assert.equal(applied.length, 1);
});

test('does not apply imported settings when all card writes fail', async () => {
  const versionOneJson = JSON.stringify({
    format: 'la-carta-backup',
    version: 1,
    cards: [{ id: 'a', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 }],
    settings: {
      translation: { source: 'sk', target: 'en' },
      fontSizes: { front: 110, back: 90 },
      showArrows: false,
    },
  });
  const applied = [];
  const storage = loadStorage();
  storage.save = async () => { throw new Error('Cards could not be persisted'); };

  await assert.rejects(
    storage.importData(versionOneJson, (settings) => applied.push(settings)),
    /Cards could not be persisted/
  );
  assert.equal(applied.length, 0);
});

test('normalizes valid imported cards and rejects malformed entries', () => {
  const storage = loadStorage();
  assert.equal(typeof storage._normalizeCards, 'function');

  const normalized = storage._normalizeCards([
    { id: 'a', front: '  dom ', hint: ' domov ', back: ' house ', color: '#123456', createdAt: 10 },
    { front: ' voda ', back: ' water ' },
  ]);

  assert.equal(JSON.stringify(normalized[0]), JSON.stringify({
    id: 'a',
    front: 'dom',
    hint: 'domov',
    back: 'house',
    color: '#123456',
    createdAt: 10,
  }));
  assert.match(normalized[1].id, /^[a-z0-9]+$/);
  assert.equal(normalized[1].front, 'voda');
  assert.equal(normalized[1].back, 'water');
  assert.equal(normalized[1].hint, '');
  assert.equal(normalized[1].color, '#4A90D9');
  assert.equal(typeof normalized[1].createdAt, 'number');

  assert.throws(() => storage._normalizeCards([{ front: '', back: 'empty' }]), /Invalid card/);
  assert.throws(() => storage._normalizeCards({ front: 'nie pole' }), /Invalid format/);
});

test('replaces IndexedDB contents instead of leaving stale cards behind', async () => {
  const operations = [];
  const store = {
    clear() {
      operations.push('clear');
      return requestResult(undefined);
    },
    put(card) {
      operations.push(`put:${card.id}`);
      return requestResult(undefined);
    },
  };
  const tx = {
    objectStore: () => store,
  };
  const db = {
    transaction: () => tx,
    close() {
      operations.push('close');
    },
  };
  tx.oncomplete = null;
  tx.onerror = null;

  const storage = loadStorage({
    indexedDB: {
      open: () => {
        const request = {};
        queueMicrotask(() => {
          request.result = db;
          request.onsuccess();
        });
        return request;
      },
    },
  });

  await storage._writeAllToIndexedDB([
    { id: 'newer', front: 'novy', hint: '', back: 'new', color: '#4A90D9', createdAt: 1 },
  ]);

  assert.deepEqual(operations.slice(0, 2), ['clear', 'put:newer']);
  assert.equal(operations.at(-1), 'close');

  function requestResult(result) {
    const request = {};
    queueMicrotask(() => {
      request.result = result;
      request.onsuccess();
      if (tx.oncomplete) tx.oncomplete();
    });
    return request;
  }
});

test('loads and saves translation language settings with a safe default', () => {
  const savedValues = new Map();
  const storage = loadStorage({
    localStorage: {
      getItem: (key) => savedValues.get(key) || null,
      setItem: (key, value) => savedValues.set(key, value),
    },
  });

  assert.equal(JSON.stringify(storage.loadTranslationSettings()), JSON.stringify({ source: 'sk', target: 'en' }));

  storage.saveTranslationSettings('de', 'it');
  assert.equal(JSON.stringify(storage.loadTranslationSettings()), JSON.stringify({ source: 'de', target: 'it' }));

  storage.saveTranslationSettings('fr', 'xx');
  assert.equal(JSON.stringify(storage.loadTranslationSettings()), JSON.stringify({ source: 'sk', target: 'en' }));
});
