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

test('virtual slider uses a fixed center and transient compositing hints', () => {
  const baseRule = getRule('.splide__list');

  assert.match(baseRule, /--center-slot:\s*2/);
  assert.doesNotMatch(baseRule, /will-change/);
  assert.match(
    getRule('.splide__list.is-dragging'),
    /will-change:\s*transform/
  );
  assert.match(
    getRule('.splide__list.is-animating'),
    /will-change:\s*transform/
  );
});

test('slider supports reduced motion', () => {
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.splide__list/
  );
});

test('card navigation keeps every slide at a constant scale and opacity', () => {
  const cardRule = getRule('.splide__slide .card');
  const neighborRule = [
    getRule('.splide__slide.is-prev .card'),
    getRule('.splide__slide.is-next .card'),
  ].join('\n');

  assert.match(cardRule, /transition:\s*transform\s/);
  assert.doesNotMatch(neighborRule, /scale\s*\(/);
  assert.doesNotMatch(neighborRule, /opacity\s*:/);
});

test('bottom navigation uses a stable three-button center group', () => {
  const centerRule = getRule('.nav-center');
  const addRule = getRule('#btn-add');
  const sideRule = getRule('.nav-secondary');

  assert.match(centerRule, /display:\s*flex/);
  assert.match(centerRule, /left:\s*50%/);
  assert.match(addRule, /clamp\(80px,\s*23vw,\s*104px\)/);
  assert.match(sideRule, /clamp\(48px,\s*14vw,\s*62px\)/);
  assert.doesNotMatch(css, /\.card-favorite\s*\{/);
});
