import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampFontSize,
  chooseDistinctTarget,
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
