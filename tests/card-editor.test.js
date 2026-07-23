import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLORS,
  createCardEditor,
  getDeleteConfirmCopy,
  runCardMutation,
} from '../js/card-editor.js';

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    toggle(name, force) {
      if (force ?? !values.has(name)) values.add(name);
      else values.delete(name);
    },
    contains: (name) => values.has(name),
  };
}

function createElements() {
  const document = {
    createElement() {
      return {
        classList: classList(),
        dataset: {},
        style: {},
        listeners: {},
        addEventListener(type, listener) {
          this.listeners[type] = listener;
        },
      };
    },
  };
  const colorPicker = {
    ownerDocument: document,
    children: [],
    replaceChildren(...children) {
      this.children = children;
    },
  };

  return {
    overlay: { classList: classList(['hidden']) },
    title: { textContent: '' },
    saveButton: { textContent: '' },
    deleteButton: { classList: classList() },
    frontInput: { value: '', focus() {} },
    hintInput: { value: '' },
    backInput: { value: '' },
    colorPicker,
  };
}

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

test('editor adds a trimmed card, closes, and shows the new card', async () => {
  const elements = createElements();
  const calls = [];
  const editor = createCardEditor({
    elements,
    cards: {
      add: async (card) => {
        calls.push(card);
        return { id: 'new-card', ...card };
      },
    },
    ui: { showCard: (id) => calls.push(['show', id]) },
    confirm: async () => true,
    toast() {},
    translation: { clearFeedback() {} },
  });

  editor.open();
  elements.frontInput.value = '  slovo ';
  elements.hintInput.value = ' pomôcka ';
  elements.backInput.value = ' preklad  ';
  elements.colorPicker.children[3].listeners.click();
  await editor.submit();

  assert.deepEqual(calls, [
    { front: 'slovo', hint: 'pomôcka', back: 'preklad', color: COLORS[3] },
    ['show', 'new-card'],
  ]);
  assert.equal(elements.overlay.classList.contains('hidden'), true);
});

test('editor updates and deletes the current card after confirmation', async () => {
  const elements = createElements();
  const calls = [];
  const editor = createCardEditor({
    elements,
    cards: {
      update: async (...args) => calls.push(['update', ...args]),
      delete: async (id) => calls.push(['delete', id]),
    },
    ui: {},
    confirm: async (copy) => {
      calls.push(['confirm', copy]);
      return true;
    },
    toast() {},
    translation: { clearFeedback() {} },
  });

  editor.open({
    id: 'card-1',
    front: 'one',
    hint: '',
    back: 'jeden',
    color: COLORS[1],
  });
  elements.frontInput.value = 'two';
  await editor.submit();
  editor.open({ id: 'card-1', front: 'two', back: 'dva', color: COLORS[1] });
  await editor.remove();

  assert.deepEqual(calls, [
    ['update', 'card-1', { front: 'two', hint: '', back: 'jeden', color: COLORS[1] }],
    ['confirm', getDeleteConfirmCopy()],
    ['delete', 'card-1'],
  ]);
  assert.equal(elements.overlay.classList.contains('hidden'), true);
});

test('failed save keeps the editor open and reports the error', async () => {
  const elements = createElements();
  const messages = [];
  const editor = createCardEditor({
    elements,
    cards: { add: async () => { throw new Error('storage failed'); } },
    ui: { showCard() { throw new Error('must not run'); } },
    confirm: async () => true,
    toast: (message) => messages.push(message),
    translation: { clearFeedback() {} },
  });

  editor.open();
  elements.frontInput.value = 'word';
  elements.backInput.value = 'slovo';
  await editor.submit();

  assert.equal(elements.overlay.classList.contains('hidden'), false);
  assert.deepEqual(messages, ['Kartu sa nepodarilo uložiť.']);
});

test('editor only accepts colors from the palette', () => {
  const elements = createElements();
  const editor = createCardEditor({
    elements,
    cards: {},
    ui: {},
    confirm: async () => false,
    toast() {},
    translation: { clearFeedback() {} },
  });

  editor.open({ color: '#000000' });

  assert.equal(elements.colorPicker.children[0].classList.contains('selected'), true);
  assert.equal(elements.colorPicker.children.length, COLORS.length);
});
