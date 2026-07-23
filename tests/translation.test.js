import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTranslationController,
  requestTranslation,
  TRANSLATE_ICON,
  TRANSLATION_FAILURE_MESSAGE,
} from '../js/translation.js';

test('returns translated text from MyMemory', async () => {
  let requestedUrl = '';
  const fetchFn = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => ({ responseData: { translatedText: 'house' } }),
    };
  };

  const result = await requestTranslation(
    'dom',
    { source: 'sk', target: 'en' },
    fetchFn
  );

  assert.equal(result, 'house');
  assert.match(requestedUrl, /q=dom/);
  assert.match(requestedUrl, /langpair=sk\|en/);
});

test('rejects empty API results and HTTP failures', async () => {
  await assert.rejects(
    requestTranslation(
      'dom',
      { source: 'sk', target: 'en' },
      async () => ({ ok: true, json: async () => ({}) })
    ),
    /Translation unavailable/
  );
  await assert.rejects(
    requestTranslation(
      'dom',
      { source: 'sk', target: 'en' },
      async () => ({ ok: false, json: async () => ({}) })
    ),
    /Translation unavailable/
  );
});

test('keeps the current Slovak failure message', () => {
  assert.equal(
    TRANSLATION_FAILURE_MESSAGE,
    'Preklad sa nepodaril. Skús to znova alebo ho dopíš ručne.'
  );
});

test('translation controller fills the back input and restores its button', async () => {
  const elements = {
    frontInput: { value: 'dom', focus() {} },
    backInput: { value: '' },
    button: { innerHTML: '', textContent: '', disabled: false },
    feedback: {
      textContent: '',
      classList: { add() {}, remove() {}, toggle() {} },
    },
  };
  const controller = createTranslationController({
    elements,
    storage: { loadTranslationSettings: () => ({ source: 'sk', target: 'en' }) },
    fetchFn: async () => ({
      ok: true,
      json: async () => ({ responseData: { translatedText: 'house' } }),
    }),
  });

  await controller.translate();

  assert.equal(elements.backInput.value, 'house');
  assert.equal(elements.button.disabled, false);
  assert.equal(elements.button.innerHTML, TRANSLATE_ICON);
});
