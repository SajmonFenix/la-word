const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadApp(extraContext = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const context = {
    console,
    document: {
      addEventListener: () => {},
    },
    setTimeout: () => {},
    ...extraContext,
  };

  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.__app = {
    shouldStartSheetDrag,
    shouldCloseSheet,
    getTranslationFailureMessage,
    getImportConfirmCopy,
    getDeleteConfirmCopy,
    isServiceWorkerUpdateMessage,
    runCardMutation,
    getBackupSettings,
    getImportErrorMessage,
    applyBackupSettings,
    showStorageRecoveryNotice,
    createServiceWorkerUpdateController
  };`, context);
  return context.__app;
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

test('sheet drag starts only from non-interactive areas', () => {
  const app = loadApp();

  assert.equal(app.shouldStartSheetDrag({ closest: () => null }), true);
  assert.equal(app.shouldStartSheetDrag({ closest: (selector) => selector.includes('input') ? {} : null }), false);
  assert.equal(app.shouldStartSheetDrag({ closest: (selector) => selector.includes('button') ? {} : null }), false);
});

test('sheet closes only after dragging past threshold', () => {
  const app = loadApp();

  assert.equal(app.shouldCloseSheet(79), false);
  assert.equal(app.shouldCloseSheet(80), true);
  assert.equal(app.shouldCloseSheet(120), true);
  assert.equal(app.shouldCloseSheet(-120), false);
});

test('translation failure copy is explicit and actionable', () => {
  const app = loadApp();

  assert.equal(
    app.getTranslationFailureMessage(),
    'Preklad sa nepodaril. Skús to znova alebo ho dopíš ručne.'
  );
});

test('import confirmation copy describes replacement clearly', () => {
  const app = loadApp();

  assert.equal(JSON.stringify(app.getImportConfirmCopy()), JSON.stringify({
    title: 'Importovať karty?',
    message: 'Import nahradí všetky existujúce karty.',
    confirmText: 'Importovať',
    cancelText: 'Zrušiť'
  }));
});

test('delete confirmation copy is app-native and explicit', () => {
  const app = loadApp();

  assert.equal(JSON.stringify(app.getDeleteConfirmCopy()), JSON.stringify({
    title: 'Vymazať kartu?',
    message: 'Táto karta sa odstráni natrvalo.',
    confirmText: 'Vymazať',
    cancelText: 'Zrušiť'
  }));
});

test('service worker update message is recognized by type', () => {
  const app = loadApp();

  assert.equal(app.isServiceWorkerUpdateMessage({ type: 'APP_UPDATE_READY' }), true);
  assert.equal(app.isServiceWorkerUpdateMessage({ type: 'OTHER' }), false);
  assert.equal(app.isServiceWorkerUpdateMessage(null), false);
});

test('card mutation helper waits for persistence and reports a failure', async () => {
  const app = loadApp();
  const messages = [];
  let finished = false;

  const result = await app.runCardMutation(
    async () => {
      await Promise.resolve();
      finished = true;
      throw new Error('Cards could not be persisted');
    },
    'Kartu sa nepodarilo uložiť.',
    (message) => messages.push(message)
  );

  assert.equal(finished, true);
  assert.equal(result.ok, false);
  assert.deepEqual(messages, ['Kartu sa nepodarilo uložiť.']);
});

test('collects all exportable settings', () => {
  const app = loadApp({
    storage: {
      loadTranslationSettings: () => ({ source: 'sk', target: 'en' }),
      loadFontSizes: () => ({ front: 110, back: 90 }),
    },
    ui: { getShowArrows: () => false },
  });

  assert.equal(JSON.stringify(app.getBackupSettings()), JSON.stringify({
    translation: { source: 'sk', target: 'en' },
    fontSizes: { front: 110, back: 90 },
    showArrows: false,
  }));
});

test('maps import errors to specific Slovak messages', () => {
  const app = loadApp();

  assert.equal(
    app.getImportErrorMessage(new Error('Unsupported backup version')),
    'Táto verzia zálohy nie je podporovaná.'
  );
  assert.equal(
    app.getImportErrorMessage(new Error('Invalid backup format')),
    'Vybraný súbor nie je platná záloha.'
  );
  assert.equal(
    app.getImportErrorMessage(new Error('Cards could not be persisted')),
    'Import sa nepodarilo uložiť.'
  );
});

test('applies all imported settings through their public APIs', () => {
  const calls = [];
  const app = loadApp({
    storage: {
      saveTranslationSettings: (source, target) => calls.push(['translation', source, target]),
      saveFontSizes: (front, back) => calls.push(['font', front, back]),
    },
    ui: {
      setShowArrows: (show) => calls.push(['arrows', show]),
    },
  });

  app.applyBackupSettings({
    translation: { source: 'de', target: 'it' },
    fontSizes: { front: 120, back: 80 },
    showArrows: false,
  });

  assert.equal(JSON.stringify(calls), JSON.stringify([
    ['translation', 'de', 'it'],
    ['font', 120, 80],
    ['arrows', false],
  ]));
});

test('shows a one-shot recovery notice after cards initialize', () => {
  const shown = [];
  const app = loadApp({
    storage: {
      consumeRecoveryNotice: () => 'Karty boli obnovené zo zálohy.',
    },
  });

  app.showStorageRecoveryNotice((message) => shown.push(message));

  assert.deepEqual(shown, ['Karty boli obnovené zo zálohy.']);
});

test('controlled update waits for a click and reloads only once after controller change', () => {
  const messages = [];
  let updates = 0;
  let reloads = 0;
  const worker = {
    postMessage: (message) => messages.push(message),
  };
  const app = loadApp();
  const controller = app.createServiceWorkerUpdateController(
    {},
    () => { reloads += 1; },
    () => { updates += 1; }
  );

  controller.setWaiting(worker);
  assert.equal(updates, 1);
  assert.equal(messages.length, 0);
  assert.equal(reloads, 0);

  controller.apply();
  assert.equal(JSON.stringify(messages), JSON.stringify([{ type: 'SKIP_WAITING' }]));
  assert.equal(reloads, 0);

  controller.controllerChanged();
  controller.controllerChanged();
  assert.equal(reloads, 1);
});

test('storage and app scripts can load together in the browser global scope', () => {
  const storageSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8');
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const context = {
    console,
    document: { addEventListener: () => {} },
    setTimeout: () => {},
  };
  vm.createContext(context);

  assert.doesNotThrow(() => {
    vm.runInContext(`${storageSource}\n${appSource}`, context);
  });
});
