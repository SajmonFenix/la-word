import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getRequiredElement } from '../js/app.js';

test('required element errors name the missing id', () => {
  assert.throws(
    () => getRequiredElement({ getElementById: () => null }, 'card-form'),
    /Missing required element: #card-form/
  );
});

test('app shell loads one ES module entrypoint', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);

  assert.deepEqual(scripts, ['<script type="module" src="js/app.js">']);
});
