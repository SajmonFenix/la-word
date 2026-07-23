import test from 'node:test';
import assert from 'node:assert/strict';
import { createCardSlider } from '../js/card-slider.js';
import { createSliderHarness, makeCards } from './support/slider-harness.js';

test('one thousand cards survive five hundred wrapped moves with five slots', async () => {
  const harness = createSliderHarness({}, { reducedMotion: true });
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(1000));
  const listenerCount = harness.listenerCount();

  for (let move = 0; move < 500; move += 1) {
    await slider.next();
    assert.ok(harness.list.children.length <= 5);
  }

  assert.equal(slider.getCurrentCardId(), 'card-501');
  assert.equal(harness.counter.textContent, '501 / 1000');
  assert.equal(harness.listenerCount(), listenerCount);
});

test('repeated wraparound never duplicates the active card', async () => {
  const harness = createSliderHarness({}, { reducedMotion: true });
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(7));

  for (let move = 0; move < 100; move += 1) {
    await slider.previous();
  }

  const active = harness.list.children.filter(
    (slide) => slide.classList.contains('is-active')
  );
  assert.equal(active.length, 1);
  assert.equal(slider.getCurrentCardId(), 'card-6');
});
