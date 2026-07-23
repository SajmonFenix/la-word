import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchController, findCardIndex } from '../js/search.js';

function element() {
  const classes = new Set(['hidden']);
  return {
    value: '',
    textContent: '',
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    focus() {},
  };
}

test('finds front, hint, and back case-insensitively', () => {
  const items = [
    { front: 'Dom', hint: 'bývanie', back: 'House' },
    { front: 'Voda', hint: '', back: 'Water' },
  ];

  assert.equal(findCardIndex(items, 'dom'), 0);
  assert.equal(findCardIndex(items, 'BÝV'), 0);
  assert.equal(findCardIndex(items, 'water'), 1);
});

test('empty and missing searches return null', () => {
  const items = [{ front: 'dom', hint: '', back: 'house' }];

  assert.equal(findCardIndex([], 'dom'), null);
  assert.equal(findCardIndex(items, '  '), null);
  assert.equal(findCardIndex(items, 'les'), null);
});

test('search controller shows the found card and closes search', () => {
  const elements = {
    headerActions: element(),
    searchBar: element(),
    input: element(),
    feedback: element(),
  };
  const shown = [];
  const controller = createSearchController({
    elements,
    cards: { getAll: () => [{ front: 'dom', hint: '', back: 'house' }] },
    ui: { showIndex: (index) => shown.push(index) },
    setTimer: (callback) => callback(),
  });
  controller.open();
  elements.input.value = 'house';

  controller.search();

  assert.deepEqual(shown, [0]);
  assert.equal(elements.searchBar.classList.contains('hidden'), true);
});
