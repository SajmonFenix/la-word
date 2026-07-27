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

test('bottom navigation orders favorites, add, and current favorite controls', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const group = html.match(/<div class="nav-center">([\s\S]*?)<\/div>/)?.[1] || '';

  assert.ok(group.indexOf('id="btn-favorites-view"') !== -1);
  assert.ok(
    group.indexOf('id="btn-add"')
      > group.indexOf('id="btn-favorites-view"')
  );
  assert.ok(
    group.indexOf('id="btn-card-favorite"')
      > group.indexOf('id="btn-add"')
  );
  assert.match(group, /aria-hidden="true"/);
});
