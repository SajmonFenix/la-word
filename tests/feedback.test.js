import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedback } from '../js/feedback.js';

function fakeElement() {
  const listeners = {};
  const classes = new Set(['hidden']);
  return {
    textContent: '',
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    addEventListener: (type, listener) => { listeners[type] = listener; },
    click() {
      listeners.click?.({ target: this, currentTarget: this });
    },
  };
}

function createElements() {
  return {
    overlay: fakeElement(),
    title: fakeElement(),
    message: fakeElement(),
    confirmButton: fakeElement(),
    cancelButton: fakeElement(),
    toast: fakeElement(),
  };
}

test('confirm resolves once and hides the dialog', async () => {
  const elements = createElements();
  const feedback = createFeedback(elements, {
    setTimer: () => 1,
    clearTimer: () => {},
  });
  const result = feedback.confirm({
    title: 'Vymazať kartu?',
    message: 'Táto karta sa odstráni natrvalo.',
    confirmText: 'Vymazať',
    cancelText: 'Zrušiť',
  });

  elements.confirmButton.click();

  assert.equal(await result, true);
  assert.equal(elements.overlay.classList.contains('hidden'), true);
});

test('toast replaces text and schedules hiding', () => {
  const elements = createElements();
  let scheduled;
  const feedback = createFeedback(elements, {
    setTimer: (callback) => { scheduled = callback; return 1; },
    clearTimer: () => {},
  });

  feedback.toast('Importovaných kariet: 2.');
  assert.equal(elements.toast.textContent, 'Importovaných kariet: 2.');
  scheduled();
  assert.equal(elements.toast.classList.contains('hidden'), true);
});
