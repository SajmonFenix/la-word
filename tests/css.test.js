import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

function getRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
}

test('app shell disables browser double tap zoom gesture', () => {
  const appSurfaceRule = getRule('html,\nbody');

  assert.match(appSurfaceRule, /touch-action:\s*manipulation;/);
});
