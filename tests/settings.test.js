import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampFontSize,
  chooseDistinctTarget,
  createSettingsController,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
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

test('settings controller persists font changes and distinct languages', () => {
  const saved = [];
  const rootValues = {};
  const elements = {
    frontValue: { textContent: '' },
    backValue: { textContent: '' },
    frontPreview: { style: { setProperty() {} } },
    backPreview: { style: { setProperty() {} } },
    sourceSelect: { value: 'sk' },
    targetSelect: { value: 'en' },
  };
  const controller = createSettingsController({
    elements,
    storage: {
      loadFontSizes: () => ({ front: 100, back: 100 }),
      saveFontSizes: (...args) => saved.push(['font', ...args]),
      loadTranslationSettings: () => ({ source: 'sk', target: 'en' }),
      saveTranslationSettings: (...args) => saved.push(['lang', ...args]),
    },
    root: { style: { setProperty: (key, value) => { rootValues[key] = value; } } },
  });

  controller.adjustFontSize('front', 1);
  elements.sourceSelect.value = 'en';
  elements.targetSelect.value = 'en';
  controller.changeLanguages();

  assert.equal(elements.frontValue.textContent, '110%');
  assert.equal(rootValues['--font-scale-front'], 1.1);
  assert.deepEqual(saved, [['font', 110, 100], ['lang', 'en', 'sk']]);
});
