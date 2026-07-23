# Storage, Backup and PWA Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make card persistence recoverable, export cards with settings in a versioned backward-compatible format, and apply PWA updates only after user confirmation.

**Architecture:** Keep `storage` as the persistence boundary and add small, testable parsing and result-reporting methods rather than restructuring the vanilla application. `cards` remains the in-memory model, while `app.js` converts storage outcomes into Slovak UI feedback. The service worker keeps a new installation waiting until the existing update button sends `SKIP_WAITING`.

**Tech Stack:** Vanilla JavaScript, IndexedDB, localStorage, Service Worker API, Node.js built-in `node:test`-style scripts using `assert` and `vm`.

---

## File map

- `js/storage.js`: card validation, source fallback, mirrored writes, versioned backup parsing/serialization, and settings persistence.
- `js/cards.js`: awaitable model mutations and access to persistence outcomes.
- `js/app.js`: recovery notice, import/export orchestration, and controlled update UI.
- `js/ui.js`: public getter and setter for the arrow preference used by backup import/export.
- `service-worker.js`: waiting-worker lifecycle and cache version.
- `tests/storage.test.js`: storage recovery and backup-format behavior.
- `tests/cards.test.js`: awaited persistence and model rollback behavior.
- `tests/app.test.js`: user-facing copy, backup settings mapping, and update controller behavior.
- `tests/service-worker.test.js`: service-worker lifecycle regression checks.

## Task 1: Reliable local fallback and recovery reporting

**Files:**
- Modify: `tests/storage.test.js`
- Modify: `js/storage.js`

- [ ] **Step 1: Add local-source test helpers and failing recovery tests**

Add a `createLocalStorage(initial)` helper that stores values in a `Map`, exposes
`getItem`, `setItem`, and `snapshot`, then add tests with these exact behaviors:

```js
function createLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    snapshot: () => Object.fromEntries(values),
  };
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

  assert.deepEqual(storage._loadFromLocalStorage(), { cards: [], source: null });
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
```

- [ ] **Step 2: Run the storage tests and verify RED**

Run:

```bash
node tests/storage.test.js
```

Expected: the new tests fail because `_loadFromLocalStorage()` currently returns
an array and stops after malformed primary JSON.

- [ ] **Step 3: Implement independent validation of both local copies**

Replace `_loadFromLocalStorage` and tighten `_syncToLocalStorage`:

```js
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
  } catch (error) {
    console.error('localStorage sync failed:', error);
    return false;
  }
},
```

Update every current caller to use `.cards` from the returned object.

- [ ] **Step 4: Add failing load-order and recovery-outcome tests**

Extend the IndexedDB fixture so `getAll()` can return configured cards. Add:

```js
test('prefers valid IndexedDB cards and reports no recovery', async () => {
  const storage = loadStorageWithIndexedCards([
    { id: 'db', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 },
  ], createLocalStorage());

  const cards = await storage.load();

  assert.equal(cards[0].id, 'db');
  assert.equal(storage.consumeRecoveryNotice(), null);
});

test('migrates a local copy when IndexedDB is empty', async () => {
  const local = createLocalStorage({
    laword_cards: JSON.stringify([
      { id: 'local', front: 'voda', back: 'water', hint: '', color: '#123456', createdAt: 1 },
    ]),
  });
  const storage = loadStorageWithIndexedCards([], local);

  const cards = await storage.load();

  assert.equal(cards[0].id, 'local');
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

  const cards = await storage.load();

  assert.equal(cards[0].id, 'backup');
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

  const cards = await storage.load();

  assert.equal(cards[0].id, 'mirror');
  assert.equal(storage.consumeRecoveryNotice(), 'Karty boli obnovené zo zálohy.');
});
```

The helpers must fire `onsuccess`, `onerror`, and `oncomplete` asynchronously so
the test exercises the real promise flow.

Add these complete helpers above the tests:

```js
function loadStorageWithIndexedCards(indexedCards, localStorage) {
  const store = {
    getAll: () => requestResult(indexedCards),
    clear: () => requestResult(undefined),
    put: () => requestResult(undefined),
  };
  const tx = { objectStore: () => store, oncomplete: null, onerror: null, onabort: null };
  const db = { transaction: () => tx, close: () => {} };
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
```

- [ ] **Step 5: Run the storage tests and verify RED**

Run `node tests/storage.test.js`.

Expected: FAIL because `consumeRecoveryNotice` and recovery metadata do not yet
exist.

- [ ] **Step 6: Implement load order and a one-shot recovery notice**

Add `_recoveryNotice: null`, `consumeRecoveryNotice()`, and change `load()`:

```js
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

async _readAllFromIndexedDB() {
  const db = await openDB();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    return await this._request(tx.objectStore(STORE_NAME).getAll());
  } finally {
    db.close();
  }
},
```

- [ ] **Step 7: Run all current tests**

Run:

```bash
node tests/storage.test.js
node tests/app.test.js
node tests/css.test.js
```

Expected: all tests print only `ok - ...` lines and exit 0.

- [ ] **Step 8: Commit the recovery layer**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "fix: recover cards from validated local backups"
```

## Task 2: Explicit persistence outcomes and awaitable card mutations

**Files:**
- Create: `tests/cards.test.js`
- Modify: `tests/storage.test.js`
- Modify: `js/storage.js`
- Modify: `js/cards.js`
- Modify: `js/app.js`

- [ ] **Step 1: Add failing tests for independent storage writes**

Add storage tests that force each backend to fail independently:

```js
test('reports degraded success when IndexedDB fails but localStorage succeeds', async () => {
  const local = createLocalStorage();
  const storage = loadStorage({
    indexedDB: { open: () => requestFailure(new Error('db down')) },
    localStorage: local,
  });

  const result = await storage.save([
    { id: 'a', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 },
  ]);

  assert.deepEqual(result, { indexedDB: false, localStorage: true, persisted: true });
});

test('throws when neither storage backend accepts the cards', async () => {
  const storage = loadStorage({
    indexedDB: { open: () => requestFailure(new Error('db down')) },
    localStorage: {
      getItem: () => null,
      setItem: () => { throw new Error('quota'); },
    },
  });

  await assert.rejects(
    storage.save([{ id: 'a', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 }]),
    /Cards could not be persisted/
  );
});
```

- [ ] **Step 2: Run storage tests and verify RED**

Run `node tests/storage.test.js`.

Expected: FAIL because `save()` returns `undefined` and never rejects after total
failure.

- [ ] **Step 3: Return an explicit save result**

Implement:

```js
async save(cards) {
  const normalized = this._normalizeCards(cards);
  let indexedDBSaved = false;
  let localStorageSaved = false;

  try {
    await this._writeAllToIndexedDB(normalized);
    indexedDBSaved = true;
  } catch (error) {
    console.error('IndexedDB save failed:', error);
  }

  localStorageSaved = this._syncToLocalStorage(normalized);

  const result = {
    indexedDB: indexedDBSaved,
    localStorage: localStorageSaved,
    persisted: indexedDBSaved || localStorageSaved,
  };
  if (!result.persisted) throw new Error('Cards could not be persisted');
  return result;
},
```

- [ ] **Step 4: Create failing card-model rollback tests**

Create `tests/cards.test.js` using `vm` to expose `cards`. Provide a fake
`storage` and fake `document.dispatchEvent`. Test:

```js
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('add waits for persistence before publishing the new model', async () => {
  const pending = deferred();
  const { cards, events } = loadCards({ save: () => pending.promise, load: async () => [] });

  const operation = cards.add({ front: 'dom', back: 'house', hint: '', color: '#123456' });
  assert.equal(cards.count(), 1);
  assert.equal(events.length, 0);

  pending.resolve({ persisted: true, indexedDB: true, localStorage: true });
  const card = await operation;

  assert.equal(card.front, 'dom');
  assert.equal(events.length, 1);
});

test('add rolls back the in-memory model when persistence totally fails', async () => {
  const { cards, events } = loadCards({
    save: async () => { throw new Error('Cards could not be persisted'); },
    load: async () => [],
  });

  await assert.rejects(
    cards.add({ front: 'dom', back: 'house', hint: '', color: '#123456' }),
    /Cards could not be persisted/
  );

  assert.equal(cards.count(), 0);
  assert.equal(events.length, 0);
});
```

Add equivalent rollback assertions for `update(id, updates)` and `delete(id)`.

- [ ] **Step 5: Run card tests and verify RED**

Run `node tests/cards.test.js`.

Expected: FAIL because current mutations return synchronously and `_persist()`
does not roll the model back.

- [ ] **Step 6: Make card mutations await persistence and roll back on failure**

Use a snapshot around each mutation:

```js
async _commitMutation(mutate) {
  const previous = this._items.map(card => ({ ...card }));
  const result = mutate();
  try {
    await storage.save(this._items);
    this._notify();
    return result;
  } catch (error) {
    this._items = previous;
    throw error;
  }
},
```

Convert `add`, `update`, and `delete` to `async` methods that call
`_commitMutation`. Preserve their current successful return values.

- [ ] **Step 7: Await mutations in the UI and show a failure toast**

Convert `handleFormSubmit` to `async`, await `cards.add` or `cards.update`, and
wrap the mutation in:

```js
try {
  // awaited add or update
} catch {
  showToast('Kartu sa nepodarilo uložiť.');
  return;
}
```

In `handleDelete`, await `cards.delete(editingId)` and show
`Kartu sa nepodarilo vymazať.` if persistence rejects. Remove redundant
`ui.refresh()` calls because the successful `cards-change` event performs the
refresh.

- [ ] **Step 8: Run the complete unit suite**

Run:

```bash
node tests/storage.test.js
node tests/cards.test.js
node tests/app.test.js
node tests/css.test.js
```

Expected: all tests pass with exit 0.

- [ ] **Step 9: Commit persistence outcomes**

```bash
git add js/storage.js js/cards.js js/app.js tests/storage.test.js tests/cards.test.js
git commit -m "fix: await durable card mutations"
```

## Task 3: Versioned backup serialization and validation

**Files:**
- Modify: `tests/storage.test.js`
- Modify: `js/storage.js`

- [ ] **Step 1: Add failing versioned export tests**

Add:

```js
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

  assert.deepEqual(JSON.parse(json), {
    format: 'la-carta-backup',
    version: 1,
    exportedAt: '2026-07-23T12:00:00.000Z',
    cards: [{ id: 'a', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 }],
    settings: {
      translation: { source: 'sk', target: 'en' },
      fontSizes: { front: 110, back: 90 },
      showArrows: false,
    },
  });
});
```

- [ ] **Step 2: Run storage tests and verify RED**

Run `node tests/storage.test.js`.

Expected: FAIL because `exportData()` still reads only the legacy localStorage
array.

- [ ] **Step 3: Implement backup serialization and strict setting normalizers**

Add constants `BACKUP_FORMAT = 'la-carta-backup'`, `BACKUP_VERSION = 1`,
`FONT_SIZE_MIN = 70`, and `FONT_SIZE_MAX = 150`. Implement:

```js
exportData(cards, settings, now = new Date()) {
  const payload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    cards: this._normalizeCards(cards),
    settings: this._normalizeBackupSettings(settings),
  };
  return JSON.stringify(payload, null, 2);
},

_normalizeBackupSettings(settings) {
  if (!settings || typeof settings !== 'object') throw new Error('Invalid backup settings');
  const translation = this._normalizeTranslationSettingsStrict(settings.translation);
  const fontSizes = this._normalizeFontSizesStrict(settings.fontSizes);
  if (typeof settings.showArrows !== 'boolean') throw new Error('Invalid arrow setting');
  return { translation, fontSizes, showArrows: settings.showArrows };
},
```

The strict translation helper throws instead of falling back. The strict font
helper accepts only integer `front` and `back` values between 70 and 150.

- [ ] **Step 4: Add failing backward-compatible import parser tests**

Add tests for:

```js
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
  assert.deepEqual(parsed.settings.fontSizes, { front: 120, back: 80 });
});

test('parses a legacy card array without changing settings', () => {
  const storage = loadStorage();
  const parsed = storage.parseImportData(JSON.stringify([{ front: 'dom', back: 'house' }]));

  assert.equal(parsed.legacy, true);
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
      settings: { translation: { source: 'sk', target: 'sk' } },
    })),
    /Invalid backup settings/
  );
});
```

Also verify that omitted `settings` produces `settings: null`.

- [ ] **Step 5: Run storage tests and verify RED**

Run `node tests/storage.test.js`.

Expected: FAIL because `parseImportData` does not exist.

- [ ] **Step 6: Implement parse-only import validation**

Implement:

```js
parseImportData(jsonString) {
  const value = JSON.parse(jsonString);
  if (Array.isArray(value)) {
    return { cards: this._normalizeCards(value), settings: null, legacy: true };
  }
  if (!value || value.format !== BACKUP_FORMAT) throw new Error('Invalid backup format');
  if (value.version !== BACKUP_VERSION) throw new Error('Unsupported backup version');
  return {
    cards: this._normalizeCards(value.cards),
    settings: value.settings === undefined ? null : this._normalizeBackupSettings(value.settings),
    legacy: false,
  };
},
```

Keep parsing free of all storage writes.

- [ ] **Step 7: Run all tests**

Run:

```bash
node tests/storage.test.js
node tests/cards.test.js
node tests/app.test.js
node tests/css.test.js
```

Expected: all tests pass.

- [ ] **Step 8: Commit the backup format**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: add versioned backup format"
```

## Task 4: Import and export settings through the UI

**Files:**
- Modify: `tests/app.test.js`
- Modify: `tests/storage.test.js`
- Modify: `js/storage.js`
- Modify: `js/ui.js`
- Modify: `js/app.js`

- [ ] **Step 1: Add failing app mapping tests**

Expose and test two pure functions:

```js
test('collects all exportable settings', () => {
  const app = loadApp({
    storage: {
      loadTranslationSettings: () => ({ source: 'sk', target: 'en' }),
      loadFontSizes: () => ({ front: 110, back: 90 }),
    },
    ui: { getShowArrows: () => false },
  });

  assert.deepEqual(app.getBackupSettings(), {
    translation: { source: 'sk', target: 'en' },
    fontSizes: { front: 110, back: 90 },
    showArrows: false,
  });
});

test('maps import errors to specific Slovak messages', () => {
  const app = loadApp();
  assert.equal(app.getImportErrorMessage(new Error('Unsupported backup version')), 'Táto verzia zálohy nie je podporovaná.');
  assert.equal(app.getImportErrorMessage(new Error('Invalid backup format')), 'Vybraný súbor nie je platná záloha.');
  assert.equal(app.getImportErrorMessage(new Error('Cards could not be persisted')), 'Import sa nepodarilo uložiť.');
});
```

Update `loadApp(extraContext)` so injected `storage`, `cards`, and `ui` objects
are available in the VM.

- [ ] **Step 2: Run app tests and verify RED**

Run `node tests/app.test.js`.

Expected: FAIL because the mapping functions do not exist.

- [ ] **Step 3: Add public arrow preference methods and pure app mappings**

In `ui.js` add:

```js
getShowArrows() {
  return this._showArrows;
},

setShowArrows(show) {
  this.toggleArrows(show);
},
```

In `app.js` add:

```js
function getBackupSettings() {
  return {
    translation: storage.loadTranslationSettings(),
    fontSizes: storage.loadFontSizes(),
    showArrows: ui.getShowArrows(),
  };
}

function getImportErrorMessage(error) {
  if (error?.message === 'Unsupported backup version') return 'Táto verzia zálohy nie je podporovaná.';
  if (error?.message === 'Cards could not be persisted') return 'Import sa nepodarilo uložiť.';
  return 'Vybraný súbor nie je platná záloha.';
}
```

- [ ] **Step 4: Add failing atomic-import tests**

Test `storage.importData(json, applySettings)`:

```js
const versionOneJson = JSON.stringify({
  format: 'la-carta-backup',
  version: 1,
  exportedAt: '2026-07-23T12:00:00.000Z',
  cards: [{ id: 'a', front: 'dom', back: 'house', hint: '', color: '#123456', createdAt: 1 }],
  settings: {
    translation: { source: 'sk', target: 'en' },
    fontSizes: { front: 110, back: 90 },
    showArrows: false,
  },
});

test('applies settings only after cards persist', async () => {
  const applied = [];
  const storage = loadStorage();
  storage.save = async () => ({ indexedDB: true, localStorage: true, persisted: true });
  const result = await storage.importData(versionOneJson, (settings) => applied.push(settings));

  assert.equal(result.cards.length, 1);
  assert.equal(applied.length, 1);
});

test('does not apply settings when all card writes fail', async () => {
  const applied = [];
  const storage = loadStorage();
  storage.save = async () => { throw new Error('Cards could not be persisted'); };

  await assert.rejects(storage.importData(versionOneJson, (settings) => applied.push(settings)));
  assert.equal(applied.length, 0);
});
```

- [ ] **Step 5: Run storage tests and verify RED**

Run `node tests/storage.test.js`.

Expected: FAIL because current import does not parse the new format or sequence
settings after persistence.

- [ ] **Step 6: Sequence parsed cards and settings**

Implement:

```js
async importData(jsonString, applySettings = () => {}) {
  const parsed = this.parseImportData(jsonString);
  await this.save(parsed.cards);
  if (parsed.settings) applySettings(parsed.settings);
  return parsed;
},
```

`save()` already rotates the valid current primary copy before replacing it.

- [ ] **Step 7: Connect versioned export and import to the UI**

Change export to:

```js
function handleExport() {
  const json = storage.exportData(cards.getAll(), getBackupSettings());
  // Keep the existing Blob and download flow, using la-carta-backup.json.
}
```

Add:

```js
function applyBackupSettings(settings) {
  storage.saveTranslationSettings(settings.translation.source, settings.translation.target);
  storage.saveFontSizes(settings.fontSizes.front, settings.fontSizes.back);
  ui.setShowArrows(settings.showArrows);
}
```

In import, validate with `storage.parseImportData(text)` before displaying the
confirmation dialog. After confirmation call:

```js
const imported = await storage.importData(text, applyBackupSettings);
await cards.init();
loadFontSizes();
loadTranslationSettings();
closeSettings();
showToast(`Importovaných kariet: ${imported.cards.length}.`);
```

Use `getImportErrorMessage(error)` in the catch block. Do not close settings or
reload the model after a rejected import.

- [ ] **Step 8: Run the complete unit suite**

Run:

```bash
node tests/storage.test.js
node tests/cards.test.js
node tests/app.test.js
node tests/css.test.js
```

Expected: all tests pass.

- [ ] **Step 9: Commit import/export integration**

```bash
git add js/storage.js js/ui.js js/app.js tests/storage.test.js tests/app.test.js
git commit -m "feat: include settings in app backups"
```

## Task 5: Surface automatic recovery in the application

**Files:**
- Modify: `tests/app.test.js`
- Modify: `js/app.js`

- [ ] **Step 1: Add a failing initialization-notice test**

Extract a small helper and test:

```js
test('shows a one-shot recovery notice after cards initialize', () => {
  const shown = [];
  const app = loadApp({
    storage: { consumeRecoveryNotice: () => 'Karty boli obnovené zo zálohy.' },
  });

  app.showStorageRecoveryNotice((message) => shown.push(message));

  assert.deepEqual(shown, ['Karty boli obnovené zo zálohy.']);
});
```

- [ ] **Step 2: Run app tests and verify RED**

Run `node tests/app.test.js`.

Expected: FAIL because `showStorageRecoveryNotice` does not exist.

- [ ] **Step 3: Implement and call the notice helper**

Add:

```js
function showStorageRecoveryNotice(notify = showToast) {
  const message = storage.consumeRecoveryNotice();
  if (message) notify(message);
}
```

Call it in `init()` after `bindEvents()` so the toast element and event
infrastructure are ready.

- [ ] **Step 4: Run all tests**

Run:

```bash
node tests/storage.test.js
node tests/cards.test.js
node tests/app.test.js
node tests/css.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit recovery feedback**

```bash
git add js/app.js tests/app.test.js
git commit -m "feat: notify users after backup recovery"
```

## Task 6: Controlled service-worker updates

**Files:**
- Create: `tests/service-worker.test.js`
- Modify: `tests/app.test.js`
- Modify: `service-worker.js`
- Modify: `js/app.js`

- [ ] **Step 1: Add a failing service-worker install regression test**

Create a VM harness that captures registered listeners and exposes a fake
`caches`. Add:

```js
test('install precaches the shell without activating the worker', async () => {
  const { listeners, skipWaitingCalls } = loadServiceWorker();
  const pending = [];

  listeners.install({ waitUntil: (promise) => pending.push(promise) });
  await Promise.all(pending);

  assert.equal(skipWaitingCalls(), 0);
});

test('SKIP_WAITING message activates the waiting worker', () => {
  const { listeners, skipWaitingCalls } = loadServiceWorker();

  listeners.message({ data: { type: 'SKIP_WAITING' } });

  assert.equal(skipWaitingCalls(), 1);
});
```

- [ ] **Step 2: Run the service-worker tests and verify RED**

Run `node tests/service-worker.test.js`.

Expected: the install test fails with one `skipWaiting` call.

- [ ] **Step 3: Remove automatic activation and bump the cache**

Change:

```js
const CACHE = 'la-word-v4';
```

Remove only `self.skipWaiting()` from the `install` listener. Keep
`self.skipWaiting()` inside the `SKIP_WAITING` message listener.

- [ ] **Step 4: Add failing controlled-update app tests**

Refactor the update wiring behind:

```js
function createServiceWorkerUpdateController(serviceWorker, reload, onUpdate) {
  let waitingWorker = null;
  let refreshing = false;
  return {
    setWaiting(worker) {
      waitingWorker = worker;
      if (worker) onUpdate();
    },
    apply() {
      if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    },
    controllerChanged() {
      if (refreshing) return;
      refreshing = true;
      reload();
    },
  };
}
```

Test that:

- `setWaiting(worker)` shows the update once,
- `apply()` sends exactly one `SKIP_WAITING` message and does not reload,
- two calls to `controllerChanged()` cause exactly one reload.

- [ ] **Step 5: Run app tests and verify RED**

Run `node tests/app.test.js`.

Expected: FAIL because the controller factory does not exist.

- [ ] **Step 6: Implement and connect the update controller**

Implement the factory exactly as tested. In `initServiceWorkerUpdates()` create
one controller using `navigator.serviceWorker`, `window.location.reload`, and
`showUpdateBanner`. Pass `registration.waiting` and newly installed workers to
`controller.setWaiting(worker)`. Route `controllerchange` to
`controller.controllerChanged()`.

Store the controller in `serviceWorkerUpdateController`. Change
`applyAppUpdate()` to hide the banner and call
`serviceWorkerUpdateController.apply()`. If no waiting worker exists, keep the
banner hidden but do not reload; a new version is not yet ready.

- [ ] **Step 7: Run the complete automated suite**

Run:

```bash
node tests/storage.test.js
node tests/cards.test.js
node tests/app.test.js
node tests/service-worker.test.js
node tests/css.test.js
```

Expected: every test prints `ok - ...` and all commands exit 0.

- [ ] **Step 8: Perform browser verification**

Serve the project:

```bash
python3 -m http.server 4173
```

In a fresh browser profile:

1. create two cards and reload; both remain,
2. export and confirm the JSON has `format`, `version`, `cards`, and `settings`,
3. change font size and arrows, import the export, and confirm both settings
   return,
4. import a legacy card-array JSON and confirm current settings do not change,
5. import malformed JSON and confirm cards remain unchanged,
6. with version `v3` controlling the page, load `v4`, confirm the update banner
   appears without an automatic reload, click `Aktualizovať`, and confirm one
   reload,
7. switch the browser offline and reload; the application shell and saved cards
   remain available.

Expected: all seven checks behave exactly as described and the browser console
contains no uncaught errors.

- [ ] **Step 9: Commit controlled updates**

```bash
git add service-worker.js js/app.js tests/service-worker.test.js tests/app.test.js
git commit -m "fix: apply PWA updates after confirmation"
```

## Task 7: Final regression and documentation consistency

**Files:**
- Modify: `docs/superpowers/specs/2026-06-18-data-persistence-spec.md`

- [ ] **Step 1: Correct the older persistence claim**

Add a final section:

```markdown
## Neskoršie spresnenie

IndexedDB a localStorage chránia pred jednotlivými zlyhaniami zápisu a
umožňujú lokálnu obnovu. Vymazanie dát webu môže odstrániť obe úložiská.
Externou používateľskou zálohou je exportovaný súbor `la-carta-backup.json`;
podrobnosti definuje špecifikácia z 23. 7. 2026.
```

- [ ] **Step 2: Run fresh final verification**

Run:

```bash
node tests/storage.test.js
node tests/cards.test.js
node tests/app.test.js
node tests/service-worker.test.js
node tests/css.test.js
git diff --check
git status --short
```

Expected: all tests exit 0, `git diff --check` has no output, and status lists
only the intended documentation update.

- [ ] **Step 3: Commit the documentation correction**

```bash
git add docs/superpowers/specs/2026-06-18-data-persistence-spec.md
git commit -m "docs: clarify local persistence guarantees"
```

- [ ] **Step 4: Verify the final committed state**

Run:

```bash
node tests/storage.test.js
node tests/cards.test.js
node tests/app.test.js
node tests/service-worker.test.js
node tests/css.test.js
git status --short
```

Expected: all tests exit 0 and `git status --short` prints nothing.
