import test from 'node:test';
import assert from 'node:assert/strict';
import { createUI } from '../js/ui.js';

function classList() {
  const values = new Set();
  return {
    toggle(name, force) {
      force ? values.add(name) : values.delete(name);
    },
    contains: (name) => values.has(name),
  };
}

function button(textContent = '') {
  const attributes = new Map();
  return {
    classList: classList(),
    textContent,
    disabled: false,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: (name) => attributes.get(name) ?? null,
  };
}

function createDocument() {
  const nodes = {
    'btn-prev': { classList: classList() },
    'btn-next': { classList: classList() },
    'btn-favorites-view': button(),
    'btn-card-favorite': button('☆'),
    'card-area': { classList: classList() },
    'empty-state': { classList: classList() },
    'favorites-empty-state': { classList: classList() },
  };
  return { getElementById: (id) => nodes[id], nodes };
}

function createSliderSpy(calls, currentId = 'card-2') {
  return {
    init: (items) => calls.push(['init', items.length]),
    next: async () => calls.push(['next']),
    previous: async () => calls.push(['previous']),
    showIndex: (index) => calls.push(['showIndex', index]),
    showCard: (id) => calls.push(['showCard', id]),
    setCards: (items, options) => calls.push([
      'setCards',
      items.length,
      options,
    ]),
    setOnEditCard: (callback) => calls.push([
      'editCallback',
      typeof callback,
    ]),
    setOnStateChange: (callback) => calls.push([
      'stateCallback',
      typeof callback,
    ]),
    getCurrentCardId: () => currentId,
    destroy: () => calls.push(['destroy']),
  };
}

test('ui initializes one slider and forwards navigation', async () => {
  const calls = [];
  const slider = createSliderSpy(calls);
  const document = createDocument();
  const ui = createUI({
    cardsModel: { getAll: () => [{ id: 'card-1' }, { id: 'card-2' }] },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });

  ui.init();
  await ui.showNext();
  await ui.showPrev();
  ui.showIndex(1);
  ui.showCard('card-2');
  ui.destroy();

  assert.deepEqual(calls, [
    ['editCallback', 'function'],
    ['stateCallback', 'function'],
    ['init', 2],
    ['next'],
    ['previous'],
    ['showIndex', 1],
    ['showCard', 'card-2'],
    ['destroy'],
  ]);
});

test('refresh passes a snapshot and preferred id to the slider', () => {
  const calls = [];
  const slider = createSliderSpy(calls, 'card-2');
  const document = createDocument();
  const ui = createUI({
    cardsModel: { getAll: () => [{ id: 'card-1' }, { id: 'card-2' }] },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });
  ui.init();

  ui.refresh();

  assert.deepEqual(calls.at(-1), [
    'setCards',
    2,
    { preferredId: 'card-2' },
  ]);
});

test('empty state and arrow preference remain managed by the facade', () => {
  const calls = [];
  const document = createDocument();
  const saved = [];
  const ui = createUI({
    cardsModel: { getAll: () => [] },
    slider: createSliderSpy(calls, null),
    localStorage: {
      getItem: () => 'false',
      setItem: (...args) => saved.push(args),
    },
    document,
  });

  ui.init();
  ui.toggleArrows(true);

  assert.equal(
    document.nodes['empty-state'].classList.contains('hidden'),
    false
  );
  assert.equal(document.nodes['card-area'].classList.contains('hidden'), true);
  assert.deepEqual(saved, [['laword_show_arrows', true]]);
});

test('refresh before initialization cannot overwrite restored slider state', () => {
  const calls = [];
  const document = createDocument();
  const ui = createUI({
    cardsModel: { getAll: () => [{ id: 'card-1' }, { id: 'card-92' }] },
    slider: createSliderSpy(calls, null),
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });

  ui.refresh();

  assert.deepEqual(calls, []);
});

test('general empty state disappears after the first card is added or imported', () => {
  const calls = [];
  const document = createDocument();
  let items = [];
  const ui = createUI({
    cardsModel: { getAll: () => items },
    slider: createSliderSpy(calls, null),
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });

  ui.init();
  assert.equal(
    document.nodes['empty-state'].classList.contains('hidden'),
    false
  );

  items = [{ id: 'card-1', favorite: false }];
  ui.refresh();

  assert.equal(
    document.nodes['empty-state'].classList.contains('hidden'),
    true
  );
  assert.equal(
    document.nodes['favorites-empty-state'].classList.contains('hidden'),
    true
  );
  assert.equal(
    document.nodes['card-area'].classList.contains('hidden'),
    false
  );

  ui.toggleFavorites();

  assert.equal(
    document.nodes['empty-state'].classList.contains('hidden'),
    true
  );
  assert.equal(
    document.nodes['favorites-empty-state'].classList.contains('hidden'),
    false
  );
  assert.equal(
    document.nodes['card-area'].classList.contains('hidden'),
    true
  );
});

test('slider state selects the authoritative card favorite value', () => {
  const calls = [];
  const document = createDocument();
  let stateCallback;
  const slider = {
    ...createSliderSpy(calls),
    setOnStateChange(callback) {
      stateCallback = callback;
    },
  };
  const items = [
    { id: 'card-1', favorite: false },
    { id: 'card-2', favorite: true },
  ];
  const ui = createUI({
    cardsModel: {
      getAll: () => items,
      getById: (id) => items.find(card => card.id === id) || null,
    },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });
  ui.init();

  stateCallback({ currentCardId: 'card-2', busy: false });

  assert.equal(document.nodes['btn-card-favorite'].textContent, '★');
  assert.equal(
    document.nodes['btn-card-favorite'].getAttribute('aria-pressed'),
    'true'
  );
});

test('current favorite waits for persistence and updates only that card', async () => {
  const calls = [];
  const document = createDocument();
  const items = [{ id: 'card-1', favorite: false }];
  let stateCallback;
  let saved;
  const slider = {
    ...createSliderSpy(calls, 'card-1'),
    setOnStateChange(callback) {
      stateCallback = callback;
    },
  };
  const ui = createUI({
    cardsModel: {
      getAll: () => items,
      getById: (id) => items.find(card => card.id === id) || null,
      async update(id, updates) {
        saved = [id, updates];
        items[0] = { ...items[0], ...updates };
        return items[0];
      },
    },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });
  ui.init();
  stateCallback({ currentCardId: 'card-1', busy: false });

  const result = await ui.toggleCurrentFavorite();

  assert.equal(result, true);
  assert.deepEqual(saved, ['card-1', { favorite: true }]);
  assert.equal(document.nodes['btn-card-favorite'].textContent, '★');
});

test('busy slider disables the current-card favorite button', () => {
  const calls = [];
  const document = createDocument();
  let stateCallback;
  const slider = {
    ...createSliderSpy(calls),
    setOnStateChange(callback) {
      stateCallback = callback;
    },
  };
  const item = { id: 'card-1', favorite: false };
  const ui = createUI({
    cardsModel: {
      getAll: () => [item],
      getById: () => item,
    },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });
  ui.init();

  stateCallback({ currentCardId: 'card-1', busy: true });

  assert.equal(document.nodes['btn-card-favorite'].disabled, true);
});

test('failed favorite persistence keeps the confirmed icon', async () => {
  const calls = [];
  const document = createDocument();
  const item = { id: 'card-1', favorite: false };
  let stateCallback;
  const slider = {
    ...createSliderSpy(calls, 'card-1'),
    setOnStateChange(callback) {
      stateCallback = callback;
    },
  };
  const ui = createUI({
    cardsModel: {
      getAll: () => [item],
      getById: () => item,
      update: async () => { throw new Error('save failed'); },
    },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });
  ui.init();
  stateCallback({ currentCardId: 'card-1', busy: false });
  const originalConsoleError = console.error;
  console.error = () => {};

  let result;
  try {
    result = await ui.toggleCurrentFavorite();
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(result, false);
  assert.equal(document.nodes['btn-card-favorite'].textContent, '☆');
  assert.equal(document.nodes['btn-card-favorite'].disabled, false);
});
