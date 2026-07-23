# Virtualized Card Slider Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the all-cards DOM slider with a five-slot virtualized slider that remains stable with at least 1,000 cards and restores the last displayed card.

**Architecture:** Pure window/index reconciliation lives in `slider-window.js`. `card-slider.js` owns the five DOM slots, confirmed navigation state, persistence of the current card ID, gestures, animation recovery, and teardown. `ui.js` becomes a compatibility facade used by the existing search, editor, settings, and app wiring.

**Tech Stack:** Vanilla ES modules, DOM Pointer Events, CSS transforms, IndexedDB and localStorage, `node:test`, Playwright CLI for browser stress verification.

---

## File map

- Create `js/slider-window.js`: pure wrapped-index, slot-window, and current-card reconciliation helpers.
- Create `js/card-slider.js`: virtual DOM slider, gesture state machine, animation queue, position persistence, and public slider API.
- Modify `js/ui.js`: replace the all-card renderer with a facade around `card-slider`.
- Modify `js/app.js`: pass required slider dependencies and route card changes through one update path.
- Modify `css/style.css`: center a fixed five-slot strip and limit compositing hints to active movement.
- Modify `service-worker.js`: cache the two new production modules and bump the cache version.
- Create `tests/slider-window.test.js`: pure boundary and reconciliation tests.
- Create `tests/card-slider.test.js`: DOM slot, navigation, persistence, gesture, lifecycle, and error-recovery tests.
- Modify `tests/ui.test.js`: verify facade delegation and integration semantics.
- Modify `tests/app.test.js`: verify the entrypoint still loads one module and card changes do not rebuild the app.
- Modify `tests/service-worker.test.js`: verify the complete production app shell.
- Create `tests/slider-stress.test.js`: deterministic 1,000-card and repeated-navigation stress test.

## Task 1: Pure virtual-window mapping

**Files:**
- Create: `js/slider-window.js`
- Create: `tests/slider-window.test.js`

- [ ] **Step 1: Write failing wrapped-index and window tests**

Create `tests/slider-window.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wrapIndex,
  buildSliderWindow,
  reconcileCurrentIndex,
} from '../js/slider-window.js';

const cards = Array.from({ length: 1000 }, (_, index) => ({
  id: `card-${index + 1}`,
}));

test('wrapIndex wraps in both directions', () => {
  assert.equal(wrapIndex(1000, 1000), 0);
  assert.equal(wrapIndex(-1, 1000), 999);
  assert.equal(wrapIndex(12, 0), -1);
});

test('five-slot window wraps around the first card', () => {
  assert.deepEqual(
    buildSliderWindow(cards, 0).map(({ offset, index, card }) => [
      offset,
      index,
      card.id,
    ]),
    [
      [-2, 998, 'card-999'],
      [-1, 999, 'card-1000'],
      [0, 0, 'card-1'],
      [1, 1, 'card-2'],
      [2, 2, 'card-3'],
    ]
  );
});

test('small collections create no duplicate slots', () => {
  assert.deepEqual(
    buildSliderWindow(cards.slice(0, 3), 1).map(({ index }) => index),
    [0, 1, 2]
  );
  assert.deepEqual(buildSliderWindow([], 0), []);
});

test('reconciliation prefers id and falls back to a valid nearby index', () => {
  assert.equal(reconcileCurrentIndex(cards, 'card-900', 2), 899);
  assert.equal(reconcileCurrentIndex(cards.slice(0, 4), 'missing', 7), 3);
  assert.equal(reconcileCurrentIndex([], 'missing', 7), -1);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/slider-window.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/slider-window.js`.

- [ ] **Step 3: Implement the pure mapping helpers**

Create `js/slider-window.js`:

```js
export const SLOT_RADIUS = 2;

export function wrapIndex(index, count) {
  if (count <= 0) return -1;
  return ((index % count) + count) % count;
}

export function reconcileCurrentIndex(cards, preferredId, fallbackIndex = 0) {
  if (cards.length === 0) return -1;
  const preferredIndex = cards.findIndex((card) => card.id === preferredId);
  if (preferredIndex !== -1) return preferredIndex;
  return Math.min(Math.max(fallbackIndex, 0), cards.length - 1);
}

export function buildSliderWindow(cards, currentIndex) {
  if (cards.length === 0) return [];
  if (cards.length <= SLOT_RADIUS * 2 + 1) {
    return cards.map((card, index) => ({
      offset: index - currentIndex,
      index,
      card,
    }));
  }
  return Array.from({ length: SLOT_RADIUS * 2 + 1 }, (_, slot) => {
    const offset = slot - SLOT_RADIUS;
    const index = wrapIndex(currentIndex + offset, cards.length);
    return { offset, index, card: cards[index] };
  });
}
```

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node --test tests/slider-window.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/slider-window.js tests/slider-window.test.js
git diff --cached --check
git commit -m "feat: add virtual slider window mapping"
```

## Task 2: Five-slot DOM renderer

**Files:**
- Create: `js/card-slider.js`
- Create: `tests/card-slider.test.js`
- Create: `tests/support/slider-harness.js`

- [ ] **Step 1: Write failing renderer tests**

Create a small fake document in `tests/card-slider.test.js` whose
`createElement`, `replaceChildren`, `querySelector`, `classList`, `dataset`,
`style`, and event methods record state. Add these assertions:

```js
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

  assert.equal(harness.activeFront().textContent, '<img src=x onerror=alert(1)>');
  assert.equal(harness.activeBack().textContent, '<script>bad()</script>');
  assert.equal(harness.activeFace().style.background, '#123456');
});

test('zero to four cards never create duplicate interactive slides', () => {
  for (let count = 0; count <= 4; count += 1) {
    const harness = createSliderHarness();
    createCardSlider(harness.dependencies).init(makeCards(count));
    assert.equal(harness.list.children.length, count);
  }
});
```

Create `tests/support/slider-harness.js` as test-only infrastructure. It must
return:

```js
{
  dependencies: {
    elements: { container, list, counter, previousButton, nextButton },
    storage,
    document,
    requestFrame,
    now
  },
  list,
  counter,
  activeText,
  activeFront,
  activeBack,
  activeFace,
  dispatch
}
```

The harness must implement real listener registration/removal and must not use
`innerHTML` parsing; `querySelector` can route known selectors to explicit fake
children.

- [ ] **Step 2: Run the renderer tests and verify RED**

Run:

```bash
node --test tests/card-slider.test.js
```

Expected: FAIL because `createCardSlider` and the harness do not exist.

- [ ] **Step 3: Add the test harness**

Create `tests/support/slider-harness.js` with:

```js
export function makeCards(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${index + 1}`,
    front: `front-${index + 1}`,
    hint: `hint-${index + 1}`,
    back: `back-${index + 1}`,
    color: '#4A90D9',
    createdAt: index + 1,
  }));
}
```

Implement `createSliderHarness()` from these concrete primitives:

```js
function createClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    toggle(name, force) {
      const enabled = force ?? !values.has(name);
      enabled ? values.add(name) : values.delete(name);
      return enabled;
    },
    contains: (name) => values.has(name),
  };
}

function createStyle() {
  const values = new Map();
  return {
    setProperty: (name, value) => values.set(name, String(value)),
    removeProperty: (name) => values.delete(name),
    getPropertyValue: (name) => values.get(name) || '',
  };
}

function createNode(tagName = 'div') {
  const listeners = new Map();
  return {
    tagName: tagName.toUpperCase(),
    children: [],
    dataset: {},
    style: createStyle(),
    classList: createClassList(),
    textContent: '',
    hidden: false,
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = [...children];
    },
    setAttribute(name, value) {
      this[name] = String(value);
    },
    addEventListener(type, listener) {
      const group = listeners.get(type) || new Set();
      group.add(listener);
      listeners.set(type, group);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      event.currentTarget = this;
      listeners.get(event.type)?.forEach((listener) => listener(event));
    },
    listenerCount() {
      return [...listeners.values()].reduce((sum, group) => sum + group.size, 0);
    },
  };
}
```

Build the harness document with `createElement: createNode`, expose the
explicit card descendants when a slide is created, and implement pointer
helpers by dispatching events on `list`. Back storage with a `Map`; implement
`getItem`, `setItem`, and `removeItem`. Queue animation completions in an array
so `finishAnimation()` dispatches one `transitionend` and
`finishAllAnimations()` drains the array. Use an incrementable clock for
gesture velocity. Keep the helper under 260 lines and use it from all later
slider tests.

- [ ] **Step 4: Implement the minimal five-slot renderer**

Create `js/card-slider.js` with these exports and constants:

```js
import {
  buildSliderWindow,
  reconcileCurrentIndex,
  wrapIndex,
} from './slider-window.js';

export const LAST_CARD_KEY = 'laword_last_card_id';
export const SWIPE_DISTANCE = 70;
export const SWIPE_VELOCITY = 0.45;
export const AXIS_LOCK_DISTANCE = 8;

export function createCardSlider({
  elements,
  storage = globalThis.localStorage,
  document = globalThis.document,
  requestFrame = globalThis.requestAnimationFrame.bind(globalThis),
  now = () => performance.now(),
  reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
} = {}) {
  let items = [];
  let currentIndex = -1;
  let onEditCard = null;

  function createSlide(entry) {
    const slide = document.createElement('div');
    const card = document.createElement('div');
    const front = document.createElement('div');
    const frontText = document.createElement('span');
    const hint = document.createElement('span');
    const back = document.createElement('div');
    const backText = document.createElement('span');
    const edit = document.createElement('button');

    slide.className = 'splide__slide';
    card.className = 'card';
    front.className = 'card-front';
    frontText.className = 'card-front-text';
    hint.className = 'hint';
    back.className = 'card-back';
    backText.className = 'card-back-text';
    edit.className = 'btn-edit';
    edit.type = 'button';
    edit.title = 'Upraviť';
    edit.setAttribute('aria-label', 'Upraviť kartu');

    frontText.textContent = entry.card.front;
    hint.textContent = entry.card.hint || '';
    hint.hidden = !entry.card.hint;
    backText.textContent = entry.card.back;
    front.style.background = entry.card.color;
    back.style.background = entry.card.color;
    slide.dataset.index = String(entry.index);
    slide.dataset.offset = String(entry.offset);
    slide.classList.toggle('is-active', entry.offset === 0);
    slide.classList.toggle('is-prev', entry.offset === -1);
    slide.classList.toggle('is-next', entry.offset === 1);

    edit.addEventListener('click', (event) => {
      event.stopPropagation();
      onEditCard?.(entry.card);
    });
    front.append(frontText, hint);
    back.append(backText, edit);
    card.append(front, back);
    slide.append(card);
    return slide;
  }

  function renderWindow() {
    const windowEntries = buildSliderWindow(items, currentIndex);
    elements.list.replaceChildren(...windowEntries.map(createSlide));
    elements.counter.textContent = items.length
      ? `${currentIndex + 1} / ${items.length}`
      : '0 / 0';
    elements.container.classList.toggle('hidden', items.length === 0);
  }

  function init(cards) {
    items = [...cards];
    currentIndex = reconcileCurrentIndex(
      items,
      storage.getItem(LAST_CARD_KEY),
      0
    );
    renderWindow();
  }

  return {
    init,
    getCurrentCardId: () => items[currentIndex]?.id || null,
    setOnEditCard(callback) {
      onEditCard = callback;
    },
    destroy() {
      elements.list.replaceChildren();
    },
  };
}
```

Use DOM construction rather than a card-text HTML template. The existing
pencil SVG may be inserted as a constant only for the fixed application-owned
icon; card data must always use `textContent`.

- [ ] **Step 5: Run focused and full tests**

Run:

```bash
node --test tests/card-slider.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add js/card-slider.js tests/card-slider.test.js tests/support/slider-harness.js
git diff --cached --check
git commit -m "feat: render five-slot virtual card window"
```

## Task 3: Navigation, position persistence, and data reconciliation

**Files:**
- Modify: `js/card-slider.js`
- Modify: `tests/card-slider.test.js`
- Modify: `tests/slider-window.test.js`

- [ ] **Step 1: Write failing navigation and persistence tests**

Add:

```js
test('next and previous wrap and persist the confirmed card id', async () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(1000));

  await slider.previous();
  assert.equal(slider.getCurrentCardId(), 'card-1000');
  assert.equal(harness.storage.getItem('laword_last_card_id'), 'card-1000');
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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/card-slider.test.js
```

Expected: FAIL because navigation, `showCard`, and `setCards` are missing.

- [ ] **Step 3: Implement confirmed navigation**

Add to `card-slider.js`:

```js
function persistCurrentCard() {
  const id = items[currentIndex]?.id;
  if (id) storage.setItem(LAST_CARD_KEY, id);
  else storage.removeItem(LAST_CARD_KEY);
}

function commitIndex(index, { persist = true } = {}) {
  currentIndex = wrapIndex(index, items.length);
  renderWindow();
  if (persist) persistCurrentCard();
  return currentIndex;
}

function showIndex(index) {
  if (items.length === 0 || index < 0 || index >= items.length) return false;
  commitIndex(index);
  return true;
}

function showCard(id) {
  const index = items.findIndex((card) => card.id === id);
  return index === -1 ? false : showIndex(index);
}

function setCards(cards, { preferredId } = {}) {
  const previousId = preferredId ?? items[currentIndex]?.id ?? null;
  const previousIndex = currentIndex;
  items = [...cards];
  currentIndex = reconcileCurrentIndex(items, previousId, previousIndex);
  renderWindow();
  persistCurrentCard();
}

async function moveBy(delta) {
  if (items.length <= 1) return false;
  commitIndex(currentIndex + delta);
  return true;
}
```

Expose `setCards`, `showCard`, `showIndex`, `next: () => moveBy(1)`, and
`previous: () => moveBy(-1)`.

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node --test tests/slider-window.test.js tests/card-slider.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/card-slider.js tests/card-slider.test.js tests/slider-window.test.js
git diff --cached --check
git commit -m "feat: persist virtual slider position"
```

## Task 4: Gesture and animation state machine

**Files:**
- Modify: `js/card-slider.js`
- Modify: `tests/card-slider.test.js`

- [ ] **Step 1: Write failing gesture tests**

Add deterministic tests using the harness clock and event dispatcher:

```js
test('69 pixels returns to the confirmed card and 70 pixels advances', async () => {
  const harness = createSliderHarness();
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
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(10));

  harness.swipe({ from: 100, to: 60, duration: 50 });
  await harness.finishAnimation();

  assert.equal(slider.getCurrentCardId(), 'card-2');
});

test('vertical intent and pointercancel never change the confirmed index', async () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(10));

  harness.diagonalSwipe({ dx: 20, dy: 80 });
  harness.cancelPointer();
  await harness.finishAnimation();

  assert.equal(slider.getCurrentCardId(), 'card-1');
  assert.equal(harness.storage.getItem('laword_last_card_id'), null);
});

test('rapid gestures keep at most one queued move', async () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(20));

  const first = slider.next();
  const second = slider.next();
  const third = slider.next();
  await harness.finishAllAnimations();
  await Promise.all([first, second, third]);

  assert.equal(slider.getCurrentCardId(), 'card-3');
});

test('visibility loss restores the confirmed centered state', () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(10));
  harness.pointerDown(100);
  harness.pointerMove(20);

  harness.hideDocument();

  assert.equal(harness.list.style.getPropertyValue('--drag-offset'), '0px');
  assert.equal(slider.getCurrentCardId(), 'card-1');
});
```

- [ ] **Step 2: Run the gesture tests and verify RED**

Run:

```bash
node --test tests/card-slider.test.js
```

Expected: FAIL because pointer handlers and animation completion are missing.

- [ ] **Step 3: Implement the state machine**

Use explicit states:

```js
let phase = 'idle'; // idle | dragging | animating | destroyed
let drag = null;
let queuedDelta = 0;
let animationResolve = null;
```

Implement these rules:

```js
function shouldCommitSwipe(dx, elapsed) {
  const velocity = elapsed > 0 ? Math.abs(dx) / elapsed : 0;
  return Math.abs(dx) >= SWIPE_DISTANCE || velocity >= SWIPE_VELOCITY;
}

function resetVisualPosition() {
  elements.list.style.setProperty('--drag-offset', '0px');
  elements.list.style.setProperty('--transition-offset', '0px');
  elements.list.classList.remove('is-dragging', 'is-animating');
}

function cancelInteraction() {
  if (phase === 'destroyed') return;
  drag = null;
  queuedDelta = 0;
  phase = 'idle';
  resetVisualPosition();
}
```

On `pointerdown`, capture pointer ID, X/Y and time. On `pointermove`, wait until
one axis crosses `AXIS_LOCK_DISTANCE`; cancel horizontal handling when vertical
distance is larger. For horizontal intent, set `--drag-offset` and
`is-dragging`.

On `pointerup`, calculate distance and velocity. Animate back to zero when the
swipe is rejected. Otherwise animate one slot, then call `commitIndex`, rerender
the five-slot window, reset without transition, and persist only after the
commit.

`moveBy` must return a Promise. During `animating`, store only the latest
non-zero direction in `queuedDelta`. After the first animation, run that one
queued move and discard additional requests.

Listen for `pointercancel`, `lostpointercapture`, and document
`visibilitychange`. Every cancellation restores the confirmed position.

When reduced motion is active, complete navigation on the next animation frame
without waiting for `transitionend`.

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node --test tests/card-slider.test.js
npm test
```

Expected: all tests PASS and no pending Promise warnings.

- [ ] **Step 5: Commit**

```bash
git add js/card-slider.js tests/card-slider.test.js tests/support/slider-harness.js
git diff --cached --check
git commit -m "feat: add resilient virtual slider gestures"
```

## Task 5: Integrate the slider with the application

**Files:**
- Modify: `js/ui.js`
- Modify: `js/app.js`
- Modify: `tests/ui.test.js`
- Modify: `tests/app.test.js`
- Modify: `tests/search.test.js`
- Modify: `tests/card-editor.test.js`
- Modify: `tests/backup.test.js`

- [ ] **Step 1: Write failing UI facade tests**

Replace DOM-heavy navigation assertions in `tests/ui.test.js` with injected
slider assertions:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createUI } from '../js/ui.js';

test('ui initializes one slider and forwards navigation', async () => {
  const calls = [];
  const slider = {
    init: (items) => calls.push(['init', items.length]),
    next: async () => calls.push(['next']),
    previous: async () => calls.push(['previous']),
    showIndex: (index) => calls.push(['showIndex', index]),
    showCard: (id) => calls.push(['showCard', id]),
    setCards: (items, options) => calls.push(['setCards', items.length, options]),
    setOnEditCard: (callback) => calls.push(['editCallback', typeof callback]),
    getCurrentCardId: () => 'card-2',
    destroy: () => calls.push(['destroy']),
  };
  const ui = createUI({
    cardsModel: { getAll: () => [{ id: 'card-1' }, { id: 'card-2' }] },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document: createArrowDocument(),
  });

  ui.init();
  await ui.showNext();
  await ui.showPrev();
  ui.showIndex(1);
  ui.showCard('card-2');
  ui.destroy();

  assert.deepEqual(calls, [
    ['editCallback', 'function'],
    ['init', 2],
    ['next'],
    ['previous'],
    ['showIndex', 1],
    ['showCard', 'card-2'],
    ['destroy'],
  ]);
});

test('refresh passes a snapshot and preferred id to the slider', () => {
  const calls = [];
  const slider = createSliderSpy(calls, 'card-2');
  const ui = createUI({
    cardsModel: { getAll: () => [{ id: 'card-1' }, { id: 'card-2' }] },
    slider,
    localStorage: createStorageFake(),
    document: createArrowDocument(),
  });
  ui.init();
  ui.refresh();

  assert.deepEqual(calls.at(-1), [
    'setCards',
    2,
    { preferredId: 'card-2' },
  ]);
});
```

Update search, editor, and backup tests so they continue to assert public
`ui.showIndex`, `ui.showCard`, and cards-change behavior rather than DOM
implementation.

- [ ] **Step 2: Run integration tests and verify RED**

Run:

```bash
node --test tests/ui.test.js tests/app.test.js tests/search.test.js tests/card-editor.test.js tests/backup.test.js
```

Expected: FAIL because `createUI` does not accept a slider dependency.

- [ ] **Step 3: Replace `ui.js` with a thin facade**

Import the singleton and factory:

```js
import { cards } from './cards.js';
import { createCardSlider } from './card-slider.js';

export function createUI({
  cardsModel = cards,
  slider = null,
  document = globalThis.document,
  localStorage = globalThis.localStorage,
} = {}) {
  const sliderController = slider || createCardSlider({
    elements: {
      container: document.getElementById('card-container'),
      list: document.querySelector('#card-container .splide__list'),
      counter: document.getElementById('card-counter'),
      previousButton: document.getElementById('btn-prev'),
      nextButton: document.getElementById('btn-next'),
    },
    document,
    storage: localStorage,
  });
  let onEditCard = null;
  let showArrows = true;

  const api = {
    init() {
      showArrows = localStorage.getItem('laword_show_arrows') !== 'false';
      api.toggleArrows(showArrows, { persist: false });
      sliderController.setOnEditCard((card) => onEditCard?.(card));
      sliderController.init(cardsModel.getAll());
    },
    refresh(options = {}) {
      const preferredId = options.preferredId
        ?? sliderController.getCurrentCardId();
      sliderController.setCards(cardsModel.getAll(), { preferredId });
    },
    showCard: (id) => sliderController.showCard(id),
    showIndex: (index) => sliderController.showIndex(index),
    showNext: () => sliderController.next(),
    showPrev: () => sliderController.previous(),
    getCurrentCardId: () => sliderController.getCurrentCardId(),
    getShowArrows: () => showArrows,
    setShowArrows: (show) => api.toggleArrows(show),
    toggleArrows(show, { persist = true } = {}) {
      showArrows = Boolean(show);
      if (persist) localStorage.setItem('laword_show_arrows', showArrows);
      document.getElementById('btn-prev').classList.toggle('hidden', !showArrows);
      document.getElementById('btn-next').classList.toggle('hidden', !showArrows);
    },
    destroy: () => sliderController.destroy(),
  };

  Object.defineProperty(api, 'onEditCard', {
    set(callback) {
      onEditCard = callback;
    },
  });
  return api;
}
```

Preserve any public method still used by the app, but remove the legacy
all-card `render`, `_syncSlides`, `_setDragOffset`, and pointer state.

- [ ] **Step 4: Make app card updates explicit**

In `js/app.js`, replace the unqualified cards-change refresh:

```js
document.addEventListener('cards-change', () => ui.refresh());
```

The editor already calls `ui.showCard(newCard.id)` after a successful add.
Ensure this runs after `cards-change`; the preferred ID then becomes the new
card. For deletion, `ui.refresh()` reconciles the removed ID to a neighbor.
For successful import, call:

```js
ui.refresh({ preferredId: ui.getCurrentCardId() });
```

after `cards.init()` and before closing settings.

- [ ] **Step 5: Run focused and full tests**

Run:

```bash
node --test tests/ui.test.js tests/app.test.js tests/search.test.js tests/card-editor.test.js tests/backup.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add js/ui.js js/app.js tests/ui.test.js tests/app.test.js tests/search.test.js tests/card-editor.test.js tests/backup.test.js
git diff --cached --check
git commit -m "refactor: integrate virtual card slider"
```

## Task 6: Mobile-safe CSS and reduced motion

**Files:**
- Modify: `css/style.css`
- Modify: `tests/css.test.js`

- [ ] **Step 1: Write failing CSS contract tests**

Extend `tests/css.test.js`:

```js
test('virtual slider uses a fixed center and transient compositing hints', () => {
  const css = readCss();
  assert.match(css, /\.splide__list\s*\{[^}]*--center-slot:\s*2/s);
  assert.doesNotMatch(
    css.match(/\.splide__list\s*\{[^}]*\}/s)?.[0] || '',
    /will-change/
  );
  assert.match(css, /\.splide__list\.is-dragging[^}]*will-change:\s*transform/s);
  assert.match(css, /\.splide__list\.is-animating[^}]*will-change:\s*transform/s);
});

test('slider supports reduced motion', () => {
  assert.match(
    readCss(),
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.splide__list/
  );
});
```

- [ ] **Step 2: Run the CSS test and verify RED**

Run:

```bash
node --test tests/css.test.js
```

Expected: FAIL because the fixed virtual center and reduced-motion rules are
missing.

- [ ] **Step 3: Replace the all-card transform rules**

Update the slider CSS:

```css
.splide__list {
  --slide-width: min(66vw, 340px);
  --slide-gap: clamp(22px, 7vw, 42px);
  --slide-step: calc(var(--slide-width) + var(--slide-gap));
  --center-slot: 2;
  --drag-offset: 0px;
  --transition-offset: 0px;
  display: flex;
  gap: var(--slide-gap);
  height: 100%;
  transform: translate3d(
    calc(
      (100vw - var(--slide-width)) / 2
      - (var(--center-slot) * var(--slide-step))
      + var(--drag-offset)
      + var(--transition-offset)
    ),
    0,
    0
  );
}

.splide__list.is-animating {
  transition: transform 0.32s cubic-bezier(.2, .8, .2, 1);
  will-change: transform;
}

.splide__list.is-dragging {
  transition: none;
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .splide__list,
  .splide__slide .card {
    transition-duration: 0.01ms !important;
  }
}
```

For fewer than five cards, set `--center-slot` from the active slide position
through `card-slider.js` so the active card remains centered. Remove the old
`--current-index` transform and permanent `will-change`.

- [ ] **Step 4: Run CSS and full tests**

Run:

```bash
node --test tests/css.test.js tests/card-slider.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add css/style.css js/card-slider.js tests/css.test.js tests/card-slider.test.js
git diff --cached --check
git commit -m "fix: bound mobile slider compositing"
```

## Task 7: Complete PWA caching and lifecycle regression coverage

**Files:**
- Modify: `service-worker.js`
- Modify: `tests/service-worker.test.js`
- Modify: `tests/pwa-updates.test.js`

- [ ] **Step 1: Write failing app-shell assertions**

Update the expected shell in `tests/service-worker.test.js` to include:

```js
'./js/slider-window.js',
'./js/card-slider.js',
```

Assert the cache name is `la-word-v7`.

Add to `tests/pwa-updates.test.js`:

```js
test('an installed update only shows the banner and does not reload', async () => {
  const reloads = [];
  const updates = [];
  const serviceWorker = createServiceWorkerHarness();

  initPwaUpdates({
    serviceWorker,
    reload: () => reloads.push('reload'),
    showUpdate: () => updates.push('ready'),
  });
  serviceWorker.installWaitingWorker();

  assert.deepEqual(updates, ['ready']);
  assert.deepEqual(reloads, []);
});
```

- [ ] **Step 2: Run PWA tests and verify RED**

Run:

```bash
node --test tests/service-worker.test.js tests/pwa-updates.test.js
```

Expected: FAIL because the new modules are absent from `APP_SHELL` and the
cache is still `la-word-v6`.

- [ ] **Step 3: Update the production app shell**

In `service-worker.js`:

```js
const CACHE = 'la-word-v7';
```

Add both new modules immediately before `ui.js` in `APP_SHELL`. Keep the
controlled `SKIP_WAITING` behavior; do not add automatic `skipWaiting()` or
automatic navigation reload.

- [ ] **Step 4: Run PWA and full tests**

Run:

```bash
node --test tests/service-worker.test.js tests/pwa-updates.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add service-worker.js tests/service-worker.test.js tests/pwa-updates.test.js
git diff --cached --check
git commit -m "fix: cache virtual slider modules"
```

## Task 8: Deterministic 1,000-card stress coverage

**Files:**
- Create: `tests/slider-stress.test.js`
- Modify: `tests/support/slider-harness.js`

- [ ] **Step 1: Write the stress test**

Create `tests/slider-stress.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCardSlider } from '../js/card-slider.js';
import { createSliderHarness, makeCards } from './support/slider-harness.js';

test('one thousand cards survive five hundred wrapped moves with five slots', async () => {
  const harness = createSliderHarness({ reducedMotion: true });
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
  const harness = createSliderHarness({ reducedMotion: true });
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(7));

  for (let move = 0; move < 100; move += 1) await slider.previous();

  const active = harness.list.children.filter(
    (slide) => slide.classList.contains('is-active')
  );
  assert.equal(active.length, 1);
  assert.equal(slider.getCurrentCardId(), 'card-6');
});
```

- [ ] **Step 2: Run the stress test**

Run:

```bash
node --test tests/slider-stress.test.js
```

Expected: PASS in under five seconds with no timeout or unhandled Promise.

- [ ] **Step 3: Run the complete automated gate**

Run:

```bash
npm test
git diff --check
```

Expected: all tests PASS and `git diff --check` prints no output.

- [ ] **Step 4: Commit**

```bash
git add tests/slider-stress.test.js tests/support/slider-harness.js
git diff --cached --check
git commit -m "test: stress virtual slider with one thousand cards"
```

## Task 9: Real-browser online, offline, and stress verification

**Files:**
- Modify only if a verified browser defect requires a test-first fix.

- [ ] **Step 1: Start a local server**

Run:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Expected: project is served at `http://127.0.0.1:4173/`.

- [ ] **Step 2: Open a mobile-sized browser session**

Run:

```bash
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh open http://127.0.0.1:4173
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh resize 393 852
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh snapshot
```

Expected: La Carta loads without console errors.

- [ ] **Step 3: Seed 1,000 cards through the public persistence format**

Use one Playwright `run-code` function to open IndexedDB `laword`, clear
`cards`, insert 1,000 normalized cards, mirror the same JSON to
`laword_cards`, and reload. The card IDs must be `stress-1` through
`stress-1000`; each card must contain `front`, `hint`, `back`, `color`, and
`createdAt`.

After reload, run:

```bash
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh run-code "async (page) => { const state = await page.evaluate(() => ({ slides: document.querySelectorAll('.splide__slide').length, counter: document.getElementById('card-counter').textContent })); if (state.slides > 5 || state.counter !== '1 / 1000') throw new Error(JSON.stringify(state)); }"
```

Expected: no error; `slides <= 5` and counter is `1 / 1000`.

- [ ] **Step 4: Stress navigation and verify constant DOM**

Use the visible Next button from a fresh snapshot for several interactions,
then use:

```bash
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh run-code "async (page) => { await page.evaluate(async () => { for (let i = 0; i < 300; i += 1) { document.getElementById('btn-next').click(); await new Promise((resolve) => setTimeout(resolve, 5)); } await new Promise((resolve) => setTimeout(resolve, 500)); const slides = document.querySelectorAll('.splide__slide').length; if (slides > 5) throw new Error('Too many slides: ' + slides); }); }"
```

If animation locking intentionally coalesces these clicks, the exact counter
may be below 301; it must be valid, the active slide must be unique, and the
page must remain responsive.

- [ ] **Step 5: Verify reload restoration**

Record the current front text and counter, reload, and assert both are
unchanged:

```bash
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh reload
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh snapshot
```

Expected: the last confirmed card is restored.

- [ ] **Step 6: Verify offline startup**

Run:

```bash
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh run-code "async (page) => { await page.context().setOffline(true); }"
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh reload
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh snapshot
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh run-code "async (page) => { await page.context().setOffline(false); }"
```

Expected: the app and last card load offline.

- [ ] **Step 7: Check browser diagnostics**

Run:

```bash
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh console error
bash /Users/tomas/.codex/skills/playwright/scripts/playwright_cli.sh console warning
```

Expected: zero application errors and zero unexpected warnings.

- [ ] **Step 8: Run final automated verification**

Run:

```bash
npm test
git diff --check
git status --short
```

Expected: all tests PASS, diff check is empty, and only intentional files are
modified.

## Task 10: iPhone acceptance and branch completion

**Files:**
- No code changes unless the iPhone test exposes a reproducible defect.

- [ ] **Step 1: Create a safety backup**

On the existing deployed application, export the real 92-card backup before
testing the new version. Confirm that the downloaded JSON opens and contains
92 cards.

- [ ] **Step 2: Deploy or serve the candidate build**

Use the project's normal GitHub Pages workflow only after all automated and
browser tests pass. Do not replace or clear the user's IndexedDB/localStorage.

- [ ] **Step 3: Run the iPhone 14 Pro acceptance sequence**

On the target iPhone:

1. Open the application with the real 92 cards.
2. Swipe rapidly forward for at least two minutes.
3. Swipe rapidly backward for at least two minutes.
4. Alternate directions while flipping cards.
5. Put Safari in the background for 30 seconds and return.
6. Reload the page.
7. Verify that the last confirmed card returns.
8. Close and reopen the standalone PWA or Safari tab.
9. Verify that no spontaneous reload or “A problem repeatedly occurred”
   message appears.

- [ ] **Step 4: Complete the branch only after acceptance**

Run:

```bash
npm test
git diff --check
git status --short
```

Expected: all tests PASS and the worktree is clean.

Then use `superpowers:verification-before-completion` followed by
`superpowers:finishing-a-development-branch`. Present merge, PR, keep, and
discard options; do not push or deploy without the user's selected option.
