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

function createDocument() {
  const nodes = {
    'btn-prev': { classList: classList() },
    'btn-next': { classList: classList() },
    'btn-fav': { textContent: '☆' },
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
    setOnToggleFavorite: (callback) => calls.push([
      'favoriteCallback',
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
    ['favoriteCallback', 'function'],
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

test('favorite callback returns the card confirmed by persistence', async () => {
  const calls = [];
  const document = createDocument();
  const updated = { id: 'card-1', favorite: true };
  let favoriteCallback;
  const slider = {
    ...createSliderSpy(calls, 'card-1'),
    setOnToggleFavorite(callback) {
      favoriteCallback = callback;
    },
  };
  const ui = createUI({
    cardsModel: {
      getAll: () => [{ id: 'card-1', favorite: false }],
      update: async () => updated,
    },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });
  ui.init();

  const result = await favoriteCallback('card-1', true);

  assert.equal(result, updated);
});
