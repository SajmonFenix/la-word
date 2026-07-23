import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCloseSheet, shouldStartSheetDrag } from '../js/sheet.js';

test('sheet drag starts only outside interactive controls', () => {
  assert.equal(shouldStartSheetDrag({ closest: () => null }), true);
  assert.equal(shouldStartSheetDrag({ closest: () => ({}) }), false);
});

test('sheet closes at 80 pixels downward', () => {
  assert.equal(shouldCloseSheet(79), false);
  assert.equal(shouldCloseSheet(80), true);
  assert.equal(shouldCloseSheet(-80), false);
});
