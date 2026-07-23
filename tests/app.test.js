const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadApp() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const context = {
    console,
    document: {
      addEventListener: () => {},
    },
    setTimeout: () => {},
  };

  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.__app = {
    shouldStartSheetDrag,
    shouldCloseSheet,
    getTranslationFailureMessage,
    getImportConfirmCopy,
    getDeleteConfirmCopy,
    isServiceWorkerUpdateMessage,
    runCardMutation
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
