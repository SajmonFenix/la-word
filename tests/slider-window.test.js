import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wrapIndex,
  buildSliderWindow,
  reconcileCurrentIndex,
} from '../js/slider-window.js';

const cards = Array.from({ length: 1000 }, (_, index) => ({
  id: `card-${index + 1}`,
}));

test('wrapIndex wraps in both directions', () => {
  assert.equal(wrapIndex(1000, 1000), 0);
  assert.equal(wrapIndex(-1, 1000), 999);
  assert.equal(wrapIndex(12, 0), -1);
});

test('five-slot window wraps around the first card', () => {
  assert.deepEqual(
    buildSliderWindow(cards, 0).map(({ offset, index, card }) => [
      offset,
      index,
      card.id,
    ]),
    [
      [-2, 998, 'card-999'],
      [-1, 999, 'card-1000'],
      [0, 0, 'card-1'],
      [1, 1, 'card-2'],
      [2, 2, 'card-3'],
    ]
  );
});

test('small collections create no duplicate slots', () => {
  assert.deepEqual(
    buildSliderWindow(cards.slice(0, 3), 1).map(({ index }) => index),
    [0, 1, 2]
  );
  assert.deepEqual(buildSliderWindow([], 0), []);
});

test('three to five cards keep unique wrapped neighbors around the active card', () => {
  assert.deepEqual(
    buildSliderWindow(cards.slice(0, 3), 0)
      .map(({ offset, index }) => [offset, index]),
    [[-1, 2], [0, 0], [1, 1]]
  );
  assert.deepEqual(
    buildSliderWindow(cards.slice(0, 5), 4)
      .map(({ offset, index }) => [offset, index]),
    [[-2, 2], [-1, 3], [0, 4], [1, 0], [2, 1]]
  );
});

test('reconciliation prefers id and falls back to a valid nearby index', () => {
  assert.equal(reconcileCurrentIndex(cards, 'card-900', 2), 899);
  assert.equal(reconcileCurrentIndex(cards.slice(0, 4), 'missing', 7), 3);
  assert.equal(reconcileCurrentIndex([], 'missing', 7), -1);
});
