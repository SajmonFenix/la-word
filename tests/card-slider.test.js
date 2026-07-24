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

test('edit action preserves the application pencil icon', () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);

  slider.init(makeCards(1));

  assert.match(harness.activeBack().querySelector('.btn-edit').innerHTML, /<svg/);
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

test('69 pixels returns to the confirmed card and 70 pixels advances', async () => {
  const harness = createSliderHarness({}, { reducedMotion: false });
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(10));

  harness.swipe({ from: 100, to: 31, duration: 400 });
  await harness.finishAnimation();
  assert.equal(slider.getCurrentCardId(), 'card-1');

  harness.swipe({ from: 100, to: 30, duration: 400 });
  await harness.finishAnimation();
  assert.equal(slider.getCurrentCardId(), 'card-2');
});

test('fast short flick advances by velocity', async () => {
  const harness = createSliderHarness({}, { reducedMotion: false });
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(10));

  harness.swipe({ from: 100, to: 60, duration: 50 });
  await harness.finishAnimation();

  assert.equal(slider.getCurrentCardId(), 'card-2');
});

test('vertical intent and pointercancel never change the confirmed index', async () => {
  const harness = createSliderHarness({}, { reducedMotion: false });
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(10));

  harness.diagonalSwipe({ dx: 20, dy: 80 });
  harness.cancelPointer();
  await harness.finishAnimation();

  assert.equal(slider.getCurrentCardId(), 'card-1');
  assert.equal(harness.storage.getItem('laword_last_card_id'), null);
});

test('rapid gestures process each move immediately', async () => {
  const harness = createSliderHarness({}, { reducedMotion: false });
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(20));

  const first = slider.next();
  const second = slider.next();
  const third = slider.next();
  await harness.finishAllAnimations();
  await Promise.all([first, second, third]);

  assert.equal(slider.getCurrentCardId(), 'card-4');
});

test('visibility loss restores the confirmed centered state', () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(10));
  harness.pointerDown(100);
  harness.pointerMove(20);

  harness.hideDocument();

  assert.equal(
    harness.list.style.getPropertyValue('--drag-offset'),
    '0px'
  );
  assert.equal(slider.getCurrentCardId(), 'card-1');
});

test('active card flips on click and a navigated card starts unflipped', async () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(10));

  harness.clickActiveCard();
  assert.equal(
    harness.activeFront().parentNode.classList.contains('flipped'),
    true
  );

  await slider.next();
  assert.equal(
    harness.activeFront().parentNode.classList.contains('flipped'),
    false
  );
});
