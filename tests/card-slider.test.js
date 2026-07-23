import test from 'node:test';
import assert from 'node:assert/strict';
import { createCardSlider } from '../js/card-slider.js';
import { createSliderHarness, makeCards } from './support/slider-harness.js';

test('one thousand cards render only five slide elements', () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);

  slider.init(makeCards(1000));

  assert.equal(harness.list.children.length, 5);
  assert.equal(harness.counter.textContent, '1 / 1000');
  assert.equal(harness.activeText(), 'front-1');
});

test('rendered text uses textContent and colors use normalized card data', () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);

  slider.init([{
    id: 'safe',
    front: '<img src=x onerror=alert(1)>',
    hint: '<b>hint</b>',
    back: '<script>bad()</script>',
    color: '#123456',
  }]);

  assert.equal(
    harness.activeFront().children[0].textContent,
    '<img src=x onerror=alert(1)>'
  );
  assert.equal(
    harness.activeBack().children[0].textContent,
    '<script>bad()</script>'
  );
  assert.equal(harness.activeFace().style.background, '#123456');
});

test('zero to four cards never create duplicate interactive slides', () => {
  for (let count = 0; count <= 4; count += 1) {
    const harness = createSliderHarness();
    createCardSlider(harness.dependencies).init(makeCards(count));
    assert.equal(harness.list.children.length, count);
  }
});
