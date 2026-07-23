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

test('next and previous wrap and persist the confirmed card id', async () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(1000));

  await slider.previous();
  assert.equal(slider.getCurrentCardId(), 'card-1000');
  assert.equal(
    harness.storage.getItem('laword_last_card_id'),
    'card-1000'
  );
  assert.equal(harness.counter.textContent, '1000 / 1000');

  await slider.next();
  assert.equal(slider.getCurrentCardId(), 'card-1');
});

test('reload restores the last card by id', () => {
  const harness = createSliderHarness({
    laword_last_card_id: 'card-92',
  });
  const slider = createCardSlider(harness.dependencies);

  slider.init(makeCards(1000));

  assert.equal(slider.getCurrentCardId(), 'card-92');
  assert.equal(harness.counter.textContent, '92 / 1000');
});

test('setCards preserves id and deletion selects a valid neighbor', () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  const initial = makeCards(5);
  slider.init(initial);
  slider.showCard('card-5');

  slider.setCards(initial.slice(0, 4));

  assert.equal(slider.getCurrentCardId(), 'card-4');
  assert.equal(harness.counter.textContent, '4 / 4');
});

test('an empty collection clears the saved id', () => {
  const harness = createSliderHarness({
    laword_last_card_id: 'card-2',
  });
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(2));

  slider.setCards([]);

  assert.equal(harness.storage.getItem('laword_last_card_id'), null);
  assert.equal(harness.counter.textContent, '0 / 0');
});
