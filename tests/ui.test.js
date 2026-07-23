import test from 'node:test';
import assert from 'node:assert/strict';

import { createUI } from '../js/ui.js';

function classList() {
  const values = new Set();
  return {
    toggle(name, force) {
      if (force) values.add(name);
      else values.delete(name);
    },
    contains: (name) => values.has(name),
    remove: (name) => values.delete(name),
  };
}

function createHarness() {
  const cards = [
    { id: 'a', front: 'a', back: 'A' },
    { id: 'b', front: 'b', back: 'B' },
    { id: 'c', front: 'c', back: 'C' },
  ];
  const properties = {};
  const slides = cards.map(() => ({ classList: classList() }));
  const list = {
    style: { setProperty: (key, value) => { properties[key] = value; } },
    querySelectorAll: () => slides,
  };
  const counter = { textContent: '' };
  const previous = { classList: classList() };
  const next = { classList: classList() };
  const saved = [];
  const document = {
    querySelector: () => list,
    querySelectorAll: () => [],
    getElementById(id) {
      return {
        'card-counter': counter,
        'btn-prev': previous,
        'btn-next': next,
      }[id];
    },
  };
  const ui = createUI({
    cardsModel: { getAll: () => cards },
    document,
    localStorage: {
      getItem: () => null,
      setItem: (...args) => saved.push(args),
    },
  });
  return { ui, counter, previous, next, properties, saved };
}

test('next and previous navigation wrap around', () => {
  const { ui, counter } = createHarness();

  ui.showIndex(2);
  ui.showNext();
  assert.equal(counter.textContent, '1 / 3');

  ui.showPrev();
  assert.equal(counter.textContent, '3 / 3');
});

test('showIndex updates the visible counter', () => {
  const { ui, counter } = createHarness();

  ui.showIndex(1);

  assert.equal(counter.textContent, '2 / 3');
});

test('69-pixel drag does not navigate and 70-pixel drag does', () => {
  const { ui, counter } = createHarness();
  const target = {
    closest: (selector) => selector.includes('is-active') ? {} : null,
  };
  const currentTarget = { setPointerCapture() {} };

  ui.showIndex(1);
  ui._handlePointer({ type: 'pointerdown', target, currentTarget, pointerId: 1, clientX: 100 });
  ui._handlePointer({ type: 'pointermove', target, currentTarget, clientX: 31 });
  ui._handlePointer({ type: 'pointerup', target, currentTarget, clientX: 31 });
  assert.equal(counter.textContent, '2 / 3');

  ui._handlePointer({ type: 'pointerdown', target, currentTarget, pointerId: 1, clientX: 100 });
  ui._handlePointer({ type: 'pointermove', target, currentTarget, clientX: 30 });
  ui._handlePointer({ type: 'pointerup', target, currentTarget, clientX: 30 });
  assert.equal(counter.textContent, '3 / 3');
});

test('arrow preference persists and updates both buttons', () => {
  const { ui, previous, next, saved } = createHarness();

  ui.toggleArrows(false);

  assert.deepEqual(saved, [['laword_show_arrows', false]]);
  assert.equal(previous.classList.contains('hidden'), true);
  assert.equal(next.classList.contains('hidden'), true);
});
