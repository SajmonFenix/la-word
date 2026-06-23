const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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

async function test(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

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
