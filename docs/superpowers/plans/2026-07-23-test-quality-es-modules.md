# Test Quality and ES Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc tests and global browser scripts with a dependency-free `npm test` workflow and small native ES modules while preserving current behavior.

**Architecture:** Build and test feature modules first, then switch the existing data model and browser entrypoint to explicit imports in one controlled integration step. Pure behavior is exported directly; DOM-facing modules are factories that receive elements and services, preventing global state and circular imports.

**Tech Stack:** Vanilla JavaScript ES modules, Node.js `node:test`, IndexedDB, localStorage, Service Worker API, Playwright CLI for final browser verification.

---

## Target file map

- `package.json`: ESM mode and the single `npm test` command.
- `js/storage.js`: exported persistence singleton and backup helpers.
- `js/cards.js`: exported card model importing `storage`.
- `js/ui.js`: exported renderer/navigation object importing `cards`.
- `js/feedback.js`: confirmation dialog and toast controller.
- `js/sheet.js`: bottom-sheet pointer gesture.
- `js/pwa-updates.js`: controlled service-worker registration and activation.
- `js/search.js`: search bar controller.
- `js/translation.js`: MyMemory request and translation feedback.
- `js/settings.js`: settings navigation, fonts, languages, and arrow preference.
- `js/backup.js`: versioned export/import UI flow.
- `js/card-editor.js`: add/edit/delete form and color selection.
- `js/app.js`: thin initialization entrypoint.
- `index.html`: one module entrypoint.
- `service-worker.js`: complete module app-shell cache.
- `tests/*.test.js`: native Node test files organized by production module.

## Task 1: Standardize the test runner

**Files:**
- Create: `package.json`
- Modify: `tests/storage.test.js`
- Modify: `tests/cards.test.js`
- Modify: `tests/app.test.js`
- Modify: `tests/service-worker.test.js`
- Modify: `tests/css.test.js`

- [ ] **Step 1: Add the failing npm test entrypoint**

Create:

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Run the command and verify RED**

Run:

```bash
npm test
```

Expected: FAIL because the existing tests use CommonJS `require()` while the
package now declares ESM.

- [ ] **Step 3: Convert every existing test file to native Node test imports**

Replace the CommonJS headers and custom `test()` functions with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

Use only the imports each file needs. Remove every local function matching:

```js
async function test(name, fn) {
  // custom runner
}
```

Preserve all 39 test bodies and names unchanged.

- [ ] **Step 4: Verify all converted tests**

Run:

```bash
npm test
```

Expected: 39 passing tests, 0 failures, exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json tests
git commit -m "test: standardize on node test runner"
```

## Task 2: Extract feedback, sheet, and PWA update primitives

**Files:**
- Create: `js/feedback.js`
- Create: `js/sheet.js`
- Create: `js/pwa-updates.js`
- Create: `tests/feedback.test.js`
- Create: `tests/sheet.test.js`
- Create: `tests/pwa-updates.test.js`

- [ ] **Step 1: Write failing feedback controller tests**

Test this public contract:

```js
import { createFeedback } from '../js/feedback.js';

test('confirm resolves once and hides the dialog', async () => {
  const elements = createFeedbackElements();
  const feedback = createFeedback(elements, { setTimer: () => 1, clearTimer: () => {} });
  const result = feedback.confirm({
    title: 'Vymazať kartu?',
    message: 'Táto karta sa odstráni natrvalo.',
    confirmText: 'Vymazať',
    cancelText: 'Zrušiť'
  });

  elements.confirmButton.click();

  assert.equal(await result, true);
  assert.equal(elements.overlay.classList.contains('hidden'), true);
});

test('toast replaces text and schedules hiding', () => {
  const elements = createFeedbackElements();
  let scheduled;
  const feedback = createFeedback(elements, {
    setTimer: (callback) => { scheduled = callback; return 1; },
    clearTimer: () => {}
  });

  feedback.toast('Importovaných kariet: 2.');
  assert.equal(elements.toast.textContent, 'Importovaných kariet: 2.');
  scheduled();
  assert.equal(elements.toast.classList.contains('hidden'), true);
});
```

The test helper creates minimal fake elements with `textContent`, `classList`,
and `addEventListener`; its `click()` dispatches the registered click listener.

- [ ] **Step 2: Run and verify RED**

Run `node --test tests/feedback.test.js`.

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the feedback module**

Create:

```js
export function createFeedback(elements, timers = globalThis) {
  let pendingResolve = null;
  let toastTimer = null;

  function resolveConfirm(result) {
    elements.overlay.classList.add('hidden');
    if (!pendingResolve) return;
    pendingResolve(result);
    pendingResolve = null;
  }

  elements.cancelButton.addEventListener('click', () => resolveConfirm(false));
  elements.confirmButton.addEventListener('click', () => resolveConfirm(true));
  elements.overlay.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) resolveConfirm(false);
  });

  return {
    confirm(copy) {
      elements.title.textContent = copy.title;
      elements.message.textContent = copy.message;
      elements.confirmButton.textContent = copy.confirmText;
      elements.cancelButton.textContent = copy.cancelText;
      elements.overlay.classList.remove('hidden');
      return new Promise((resolve) => { pendingResolve = resolve; });
    },
    toast(message) {
      elements.toast.textContent = message;
      elements.toast.classList.remove('hidden');
      timers.clearTimer(toastTimer);
      toastTimer = timers.setTimer(() => elements.toast.classList.add('hidden'), 2600);
    }
  };
}
```

- [ ] **Step 4: Write failing sheet tests**

Test exported `shouldStartSheetDrag`, `shouldCloseSheet`, and
`bindDismissibleSheet`:

```js
import {
  bindDismissibleSheet,
  shouldCloseSheet,
  shouldStartSheetDrag
} from '../js/sheet.js';

test('sheet starts only outside interactive controls', () => {
  assert.equal(shouldStartSheetDrag({ closest: () => null }), true);
  assert.equal(shouldStartSheetDrag({ closest: () => ({}) }), false);
});

test('sheet closes at 80 pixels downward', () => {
  assert.equal(shouldCloseSheet(79), false);
  assert.equal(shouldCloseSheet(80), true);
  assert.equal(shouldCloseSheet(-80), false);
});
```

- [ ] **Step 5: Implement the sheet module**

Move the existing pointer implementation unchanged and export:

```js
export const SHEET_DISMISS_THRESHOLD = 80;
const INTERACTIVE_SELECTOR = 'input, select, textarea, button, .color-option, label, a';

export function shouldStartSheetDrag(target) {
  return !target.closest(INTERACTIVE_SELECTOR);
}

export function shouldCloseSheet(deltaY) {
  return deltaY >= SHEET_DISMISS_THRESHOLD;
}

export function bindDismissibleSheet(overlay, sheet, close) {
  let startY = 0;
  let currentY = 0;
  let dragging = false;
  const end = () => {
    if (!dragging) return;
    const deltaY = Math.max(0, currentY - startY);
    dragging = false;
    sheet.classList.remove('sheet-dragging');
    sheet.style.transform = '';
    overlay.style.background = '';
    if (shouldCloseSheet(deltaY)) close();
  };
  sheet.addEventListener('pointerdown', (event) => {
    if (!shouldStartSheetDrag(event.target)) return;
    startY = currentY = event.clientY;
    dragging = true;
    sheet.classList.add('sheet-dragging');
    sheet.setPointerCapture(event.pointerId);
  });
  sheet.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    currentY = event.clientY;
    const deltaY = Math.max(0, currentY - startY);
    sheet.style.transform = `translateY(${deltaY}px)`;
    overlay.style.background = `rgba(0,0,0,${Math.max(0.18, 0.4 - deltaY / 500)})`;
  });
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
}
```

The body must preserve pointer capture, downward-only translation, overlay
opacity, cleanup, and the 80-pixel close decision from current `app.js`.

- [ ] **Step 6: Write failing PWA controller tests**

Move the existing controlled-update assertions to:

```js
import {
  createServiceWorkerUpdateController,
  isServiceWorkerUpdateMessage
} from '../js/pwa-updates.js';
```

Also test that `initPwaUpdates({ serviceWorker, reload, showUpdate })`:

- passes an existing `registration.waiting` worker to the controller,
- passes a newly installed worker to the controller,
- ignores a failed `serviceWorker.ready` promise.

- [ ] **Step 7: Implement the PWA module**

Export:

```js
export const UPDATE_MESSAGE_TYPE = 'APP_UPDATE_READY';

export function isServiceWorkerUpdateMessage(data) {
  return data?.type === UPDATE_MESSAGE_TYPE;
}

export function createServiceWorkerUpdateController(reload, onUpdate) {
  let waitingWorker = null;
  let refreshing = false;
  return {
    setWaiting(worker) {
      waitingWorker = worker;
      if (worker) onUpdate();
    },
    apply() {
      waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
    },
    controllerChanged() {
      if (refreshing) return;
      refreshing = true;
      reload();
    }
  };
}

export function initPwaUpdates({ serviceWorker, reload, showUpdate }) {
  if (!serviceWorker) return { apply() {} };
  const controller = createServiceWorkerUpdateController(reload, showUpdate);
  serviceWorker.addEventListener('message', (event) => {
    if (isServiceWorkerUpdateMessage(event.data)) showUpdate();
  });
  serviceWorker.ready.then((registration) => {
    if (registration.waiting) controller.setWaiting(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && serviceWorker.controller) {
          controller.setWaiting(worker);
        }
      });
    });
  }).catch(() => {});
  serviceWorker.addEventListener('controllerchange', () => controller.controllerChanged());
  return controller;
}
```

- [ ] **Step 8: Verify and commit**

Run:

```bash
npm test
```

Expected: all existing and new tests pass.

```bash
git add js/feedback.js js/sheet.js js/pwa-updates.js tests/feedback.test.js tests/sheet.test.js tests/pwa-updates.test.js
git commit -m "refactor: extract UI and PWA primitives"
```

## Task 3: Extract search and translation

**Files:**
- Create: `js/search.js`
- Create: `js/translation.js`
- Create: `tests/search.test.js`
- Create: `tests/translation.test.js`

- [ ] **Step 1: Write failing search tests**

Test:

```js
import { findCardIndex, createSearchController } from '../js/search.js';

test('finds front, hint, and back case-insensitively', () => {
  const cards = [
    { front: 'Dom', hint: 'bývanie', back: 'House' },
    { front: 'Voda', hint: '', back: 'Water' }
  ];
  assert.equal(findCardIndex(cards, 'dom'), 0);
  assert.equal(findCardIndex(cards, 'BÝV'), 0);
  assert.equal(findCardIndex(cards, 'water'), 1);
});

test('empty and missing searches return null', () => {
  assert.equal(findCardIndex([], 'dom'), null);
  assert.equal(findCardIndex([{ front: 'dom', hint: '', back: 'house' }], '  '), null);
  assert.equal(findCardIndex([{ front: 'dom', hint: '', back: 'house' }], 'les'), null);
});
```

Controller tests inject `cards.getAll`, `ui.showIndex`, elements, and timers;
they verify the current Slovak empty, missing, and found messages.

- [ ] **Step 2: Implement search**

Create:

```js
export function findCardIndex(cards, query) {
  const normalized = query.toLocaleLowerCase('sk').trim();
  if (!normalized || cards.length === 0) return null;
  const index = cards.findIndex((card) =>
    card.front.toLocaleLowerCase('sk').includes(normalized) ||
    card.hint?.toLocaleLowerCase('sk').includes(normalized) ||
    card.back.toLocaleLowerCase('sk').includes(normalized)
  );
  return index === -1 ? null : index;
}

export function createSearchController({ elements, cards, ui, setTimer }) {
  // Preserve open, close, Enter, Escape and feedback behavior.
}
```

Add `ui.showIndex(index)` as the public index-based equivalent of the current
internal index assignment, without changing card rendering.

- [ ] **Step 3: Write failing translation tests**

Test:

```js
import { requestTranslation } from '../js/translation.js';

test('returns translated text from MyMemory', async () => {
  const fetch = async () => ({
    ok: true,
    json: async () => ({ responseData: { translatedText: 'house' } })
  });
  assert.equal(await requestTranslation('dom', { source: 'sk', target: 'en' }, fetch), 'house');
});

test('rejects empty API results and network failures', async () => {
  await assert.rejects(
    requestTranslation('dom', { source: 'sk', target: 'en' }, async () => ({ ok: true, json: async () => ({}) })),
    /Translation unavailable/
  );
  await assert.rejects(
    requestTranslation('dom', { source: 'sk', target: 'en' }, async () => { throw new Error('offline'); }),
    /offline/
  );
});
```

- [ ] **Step 4: Implement translation**

Create:

```js
export const TRANSLATE_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20"/><path d="M12 2a15.3 15.3 0 0 0 0 20"/></svg>';
export const TRANSLATION_FAILURE_MESSAGE =
  'Preklad sa nepodaril. Skús to znova alebo ho dopíš ručne.';

export async function requestTranslation(text, languages, fetchFn) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${languages.source}|${languages.target}`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error('Translation unavailable');
  const data = await response.json();
  const translated = data.responseData?.translatedText;
  if (!translated) throw new Error('Translation unavailable');
  return translated;
}

export function createTranslationController({ elements, storage, fetchFn }) {
  // Preserve clear-existing-translation, loading state, icon restoration,
  // focus behavior, and Slovak error feedback.
}
```

- [ ] **Step 5: Verify and commit**

Run `npm test`.

Expected: all tests pass.

```bash
git add js/search.js js/translation.js js/ui.js tests/search.test.js tests/translation.test.js
git commit -m "refactor: extract search and translation"
```

## Task 4: Extract settings and backups

**Files:**
- Create: `js/settings.js`
- Create: `js/backup.js`
- Create: `tests/settings.test.js`
- Create: `tests/backup.test.js`

- [ ] **Step 1: Write failing settings tests**

Test pure exports:

```js
import {
  clampFontSize,
  chooseDistinctTarget,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX
} from '../js/settings.js';

test('font sizes stay between 70 and 150', () => {
  assert.equal(clampFontSize(60), FONT_SIZE_MIN);
  assert.equal(clampFontSize(120), 120);
  assert.equal(clampFontSize(160), FONT_SIZE_MAX);
});

test('equal translation languages select the first distinct target', () => {
  assert.equal(chooseDistinctTarget('sk', 'sk'), 'en');
  assert.equal(chooseDistinctTarget('de', 'it'), 'it');
});
```

Controller tests verify view navigation, preview CSS variables, persistence,
and arrow preference through injected `storage` and `ui`.

- [ ] **Step 2: Implement settings**

Export constants and:

```js
export function clampFontSize(value) {
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, value));
}

export function chooseDistinctTarget(source, target) {
  return source === target
    ? TRANSLATION_LANGUAGES.find((language) => language !== source)
    : target;
}

export function createSettingsController({ elements, storage, ui, root }) {
  // Own fontSizes and translationSettings; expose open, close, and refresh.
}
```

- [ ] **Step 3: Write failing backup tests**

Test exported:

```js
import {
  collectBackupSettings,
  getImportErrorMessage,
  applyBackupSettings
} from '../js/backup.js';
```

Preserve the current mappings and add controller tests proving:

- parsing happens before confirmation,
- cancellation performs no write,
- successful import reinitializes cards and refreshes settings,
- rejected import leaves the settings sheet open,
- export downloads `la-carta-backup.json`.

- [ ] **Step 4: Implement backups**

Create:

```js
export function collectBackupSettings(storage, ui) {
  return {
    translation: storage.loadTranslationSettings(),
    fontSizes: storage.loadFontSizes(),
    showArrows: ui.getShowArrows()
  };
}

export function applyBackupSettings(settings, storage, ui) {
  storage.saveTranslationSettings(settings.translation.source, settings.translation.target);
  storage.saveFontSizes(settings.fontSizes.front, settings.fontSizes.back);
  ui.setShowArrows(settings.showArrows);
}

export function getImportErrorMessage(error) {
  if (error?.message === 'Unsupported backup version') return 'Táto verzia zálohy nie je podporovaná.';
  if (error?.message === 'Cards could not be persisted') return 'Import sa nepodarilo uložiť.';
  return 'Vybraný súbor nie je platná záloha.';
}

export function createBackupController({
  exportButton,
  importButton,
  storage,
  cards,
  ui,
  settings,
  confirm,
  toast,
  document,
  URL,
  Blob
}) {
  // Return bind(), exportCards(), and importCards(file). The implementation
  // follows the validated parse -> confirm -> import -> refresh sequence.
}
```

- [ ] **Step 5: Verify and commit**

Run `npm test`, expect all tests to pass.

```bash
git add js/settings.js js/backup.js tests/settings.test.js tests/backup.test.js
git commit -m "refactor: extract settings and backups"
```

## Task 5: Extract card editor

**Files:**
- Create: `js/card-editor.js`
- Create: `tests/card-editor.test.js`

- [ ] **Step 1: Write failing editor tests**

Test exported pure helpers and controller behavior:

```js
import {
  COLORS,
  getDeleteConfirmCopy,
  runCardMutation
} from '../js/card-editor.js';

test('mutation failures notify without reporting success', async () => {
  const messages = [];
  const result = await runCardMutation(
    async () => { throw new Error('save failed'); },
    'Kartu sa nepodarilo uložiť.',
    (message) => messages.push(message)
  );
  assert.equal(result.ok, false);
  assert.deepEqual(messages, ['Kartu sa nepodarilo uložiť.']);
});
```

Controller tests inject fake form elements, `cards`, `ui`, `confirm`, and
`toast`; verify add, edit, delete, rollback feedback, modal close, color
selection, and `ui.showCard(newCard.id)`.

- [ ] **Step 2: Implement editor**

Move the existing colors and editor flow into:

```js
export const COLORS = [
  '#c09f80', '#d8b5a5', '#e6c2a8', '#f0d9b5', '#f5e3c4',
  '#e0d5b9', '#c4b5a6', '#b8a5a5', '#a79c9c', '#938e8c',
  '#b5c6d8', '#c2d4e6', '#d0e2f1', '#e1f0fa', '#f2f9ff'
];

export async function runCardMutation(mutate, failureMessage, notify) {
  try {
    return { ok: true, value: await mutate() };
  } catch {
    notify(failureMessage);
    return { ok: false, value: null };
  }
}

export function createCardEditor({ elements, cards, ui, confirm, toast, translation }) {
  let editingId = null;
  // Preserve open, close, color rendering, submit, delete and overlay click.
  return { open, close };
}
```

Use `textContent` for card text and keep color values restricted to `COLORS`.

- [ ] **Step 3: Verify and commit**

Run `npm test`, expect all tests to pass.

```bash
git add js/card-editor.js tests/card-editor.test.js
git commit -m "refactor: extract card editor"
```

## Task 6: Convert core modules and assemble the entrypoint

**Files:**
- Modify: `js/storage.js`
- Modify: `js/cards.js`
- Modify: `js/ui.js`
- Modify: `js/app.js`
- Modify: `index.html`
- Modify: `tests/storage.test.js`
- Modify: `tests/cards.test.js`
- Modify: `tests/app.test.js`
- Create: `tests/ui.test.js`

- [ ] **Step 1: Add failing direct-import core tests**

Replace VM source loading with:

```js
import { storage } from '../js/storage.js';
import { cards } from '../js/cards.js';
```

For isolation, export factories as well:

```js
import { createStorage } from '../js/storage.js';
import { createCards } from '../js/cards.js';
import { createUI } from '../js/ui.js';
```

Tests instantiate factories with fake IndexedDB, localStorage, event target,
cards model, and document dependencies. Existing 39 scenarios retain the same
assertions.

- [ ] **Step 2: Run direct-import tests and verify RED**

Run:

```bash
node --test tests/storage.test.js tests/cards.test.js tests/ui.test.js
```

Expected: FAIL because the factories and ESM exports do not exist.

- [ ] **Step 3: Export storage without changing behavior**

Refactor:

```js
export function createStorage({
  indexedDB = globalThis.indexedDB,
  localStorage = globalThis.localStorage,
  console = globalThis.console,
  now = () => Date.now()
} = {}) {
  // Return the current storage API. openDB closes over injected indexedDB.
}

export const storage = createStorage();
```

Replace direct `Date.now()` calls used for normalization with `now()`.

- [ ] **Step 4: Export cards with explicit dependencies**

Refactor:

```js
import { storage } from './storage.js';

export function createCards({
  persistence = storage,
  eventTarget = document,
  createEvent = (type, options) => new CustomEvent(type, options),
  now = () => Date.now(),
  random = () => Math.random()
} = {}) {
  // Return the current cards API with private items in the factory closure.
}

export const cards = createCards();
```

- [ ] **Step 5: Export UI and add focused navigation tests**

Refactor:

```js
import { cards } from './cards.js';

export function createUI({
  cardsModel = cards,
  document = globalThis.document,
  localStorage = globalThis.localStorage
} = {}) {
  // Return the existing UI API with state in the factory closure.
}

export const ui = createUI();
```

Add tests for:

- next from last wraps to first,
- previous from first wraps to last,
- `showIndex` updates the counter,
- 69-pixel drag does not move and 70-pixel drag does,
- arrow preference persists and updates both buttons.

- [ ] **Step 6: Replace app.js with the thin entrypoint**

Import all modules:

```js
import { cards } from './cards.js';
import { ui } from './ui.js';
import { createFeedback } from './feedback.js';
import { bindDismissibleSheet } from './sheet.js';
import { initPwaUpdates } from './pwa-updates.js';
import { createSearchController } from './search.js';
import { createTranslationController } from './translation.js';
import { createSettingsController } from './settings.js';
import { createBackupController } from './backup.js';
import { createCardEditor } from './card-editor.js';

export async function initApp(document = globalThis.document) {
  // Query all required elements once, create controllers, connect callbacks,
  // await cards.init(), initialize ui, show recovery toast, and start PWA.
}

document.addEventListener('DOMContentLoaded', () => initApp());
```

Keep the entrypoint under 150 lines. A missing required DOM element must throw
an error naming its ID during initialization.

- [ ] **Step 7: Switch index.html to one module script**

Replace all script tags at the bottom with:

```html
<script type="module" src="js/app.js"></script>
```

- [ ] **Step 8: Verify integration and commit**

Run:

```bash
npm test
```

Expected: every test passes with no global VM loading.

```bash
git add js index.html tests
git commit -m "refactor: migrate app to native ES modules"
```

## Task 7: Complete app-shell caching and browser verification

**Files:**
- Modify: `service-worker.js`
- Modify: `tests/service-worker.test.js`

- [ ] **Step 1: Add a failing complete-cache test**

Expose the service-worker source to the existing harness and assert that
`APP_SHELL` contains exactly:

```js
[
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/cards.js',
  './js/ui.js',
  './js/feedback.js',
  './js/sheet.js',
  './js/pwa-updates.js',
  './js/search.js',
  './js/translation.js',
  './js/settings.js',
  './js/backup.js',
  './js/card-editor.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
]
```

- [ ] **Step 2: Run and verify RED**

Run `node --test tests/service-worker.test.js`.

Expected: FAIL listing the new module paths missing from `APP_SHELL`.

- [ ] **Step 3: Update the app shell**

Add every path above and change:

```js
const CACHE = 'la-word-v6';
```

Preserve controlled activation and current fetch strategies.

- [ ] **Step 4: Run complete automated verification**

Run:

```bash
npm test
git diff --check
```

Expected: all tests pass and `git diff --check` prints nothing.

- [ ] **Step 5: Run browser smoke verification**

Serve the worktree:

```bash
python3 -m http.server 4173
```

Using a fresh Playwright session, verify:

1. page loads with 0 console errors and 0 warnings,
2. add `dom → house` and `voda → water`,
3. reload and confirm counter `1 / 2`,
4. edit one card and delete the other,
5. search by front, hint, and back,
6. change both font sizes and arrow visibility,
7. export and import the versioned backup,
8. simulate failed translation and confirm the Slovak error,
9. reload offline and confirm the remaining card and app shell load,
10. install cache v6 over v5, confirm update banner, click update, and observe
    one reload.

- [ ] **Step 6: Commit**

```bash
git add service-worker.js tests/service-worker.test.js
git commit -m "fix: cache complete ES module app shell"
```

## Task 8: Final quality gate

**Files:**
- Modify only if verification reveals a documented defect.

- [ ] **Step 1: Check architectural acceptance criteria**

Run:

```bash
wc -l js/app.js
rg -n "window\\.|globalThis\\.[A-Za-z_$][A-Za-z0-9_$]*\\s*=" js
rg -n "<script" index.html
```

Expected:

- `js/app.js` is at most 150 lines,
- no assignment creates application state on `window` or `globalThis`,
- `index.html` contains only the single module entrypoint.

- [ ] **Step 2: Run fresh final tests**

Run:

```bash
npm test
git diff --check
git status --short
```

Expected: all tests pass, no whitespace errors, and the worktree is clean after
the final commit.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git diff main...HEAD --stat
git log --oneline main..HEAD
```

Confirm the diff contains only the test-runner migration, module extraction,
entrypoint conversion, test expansion, and service-worker cache update defined
by the approved specification.
