import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBackupSettings,
  collectBackupSettings,
  createBackupController,
  getImportErrorMessage,
} from '../js/backup.js';

test('collects cards-related settings from public APIs', () => {
  const settings = collectBackupSettings({
    loadTranslationSettings: () => ({ source: 'sk', target: 'en' }),
    loadFontSizes: () => ({ front: 110, back: 90 }),
  }, {
    getShowArrows: () => false,
  });

  assert.deepEqual(settings, {
    translation: { source: 'sk', target: 'en' },
    fontSizes: { front: 110, back: 90 },
    showArrows: false,
  });
});

test('applies all imported settings through public APIs', () => {
  const calls = [];
  applyBackupSettings({
    translation: { source: 'de', target: 'it' },
    fontSizes: { front: 120, back: 80 },
    showArrows: false,
  }, {
    saveTranslationSettings: (...args) => calls.push(['translation', ...args]),
    saveFontSizes: (...args) => calls.push(['font', ...args]),
  }, {
    setShowArrows: (value) => calls.push(['arrows', value]),
  });

  assert.deepEqual(calls, [
    ['translation', 'de', 'it'],
    ['font', 120, 80],
    ['arrows', false],
  ]);
});

test('maps import failures to current Slovak messages', () => {
  assert.equal(
    getImportErrorMessage(new Error('Unsupported backup version')),
    'Táto verzia zálohy nie je podporovaná.'
  );
  assert.equal(
    getImportErrorMessage(new Error('Cards could not be persisted')),
    'Import sa nepodarilo uložiť.'
  );
  assert.equal(
    getImportErrorMessage(new Error('Invalid backup format')),
    'Vybraný súbor nie je platná záloha.'
  );
});

test('backup import validates before confirmation and refreshes after save', async () => {
  const calls = [];
  const controller = createBackupController({
    storage: {
      parseImportData: () => calls.push('parse'),
      importData: async (_text, apply) => {
        calls.push('import');
        apply({});
        return { cards: [{ front: 'dom' }] };
      },
    },
    cards: { init: async () => calls.push('cards') },
    applySettings: () => calls.push('settings'),
    refreshSettings: () => calls.push('refresh'),
    confirm: async () => { calls.push('confirm'); return true; },
    toast: (message) => calls.push(message),
  });

  await controller.importText('{"cards":[]}');

  assert.deepEqual(calls, [
    'parse', 'confirm', 'import', 'settings', 'cards', 'refresh',
    'Importovaných kariet: 1.',
  ]);
});
