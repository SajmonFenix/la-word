# Bottom Favorites Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move current-card favorite control into a three-button bottom navigation and make `ui.js`, rather than the slider, own all favorite behavior.

**Architecture:** `card-slider.js` emits only `{ currentCardId, busy }` state snapshots and has no favorite DOM or data knowledge. `ui.js` reads the authoritative card from `cards.js`, owns both bottom favorite controls, persists toggles, and reacts to slider state. HTML/CSS supplies one centered three-button cluster while retaining the edge navigation arrows.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node.js built-in test runner, custom DOM harness, service worker.

---

### Task 1: Replace slider favorite ownership with a state callback

**Files:**
- Modify: `js/card-slider.js`
- Modify: `tests/card-slider.test.js`
- Modify: `tests/support/slider-harness.js`

- [ ] **Step 1: Write failing state-contract tests**

Remove tests that directly inspect `harness.favoriteButton` and add:

```js
test('slider reports the confirmed card and busy navigation state', async () => {
  const harness = createSliderHarness({}, { reducedMotion: false });
  const slider = createCardSlider(harness.dependencies);
  const states = [];
  slider.setOnStateChange((state) => states.push(state));
  slider.init(makeCards(2));

  const movement = slider.next();
  assert.deepEqual(states.at(-1), {
    currentCardId: 'card-1',
    busy: true,
  });

  await harness.finishAnimation();
  await movement;
  assert.deepEqual(states.at(-1), {
    currentCardId: 'card-2',
    busy: false,
  });
});

test('cancelled drag restores an idle state for the confirmed card', () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  const states = [];
  slider.setOnStateChange((state) => states.push(state));
  slider.init(makeCards(2));

  harness.pointerDown(100);
  harness.cancelPointer();

  assert.deepEqual(states.at(-1), {
    currentCardId: 'card-1',
    busy: false,
  });
});

test('empty slider reports no current card', () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  const states = [];
  slider.setOnStateChange((state) => states.push(state));

  slider.init([]);

  assert.deepEqual(states.at(-1), {
    currentCardId: null,
    busy: false,
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/card-slider.test.js`

Expected: FAIL because `setOnStateChange` does not exist.

- [ ] **Step 3: Remove favorite elements from the slider harness**

Delete `favoriteButton` creation, dependency injection, public harness
property, and `clickFavorite()` from `tests/support/slider-harness.js`.

- [ ] **Step 4: Implement the slider state contract**

In `card-slider.js`, remove `onToggleFavorite`, `favoritePending`,
`currentCardFlipped`, `syncFavoriteButton()`, `handleFavoriteClick()`,
`setOnToggleFavorite()`, and favorite button event binding.

Add:

```js
let onStateChange = null;

function emitState() {
  onStateChange?.({
    currentCardId: items[currentIndex]?.id || null,
    busy: phase === 'dragging' || phase === 'animating',
  });
}
```

Call `emitState()`:

- at the end of `renderWindow()`,
- immediately after entering `dragging` or `animating`,
- after cancellation returns to `idle`,
- after `finishAnimation()` sets `phase = 'idle'`,
- after a horizontal gesture returns without navigation.

Expose:

```js
setOnStateChange(callback) {
  onStateChange = callback;
}
```

Restore card flipping to:

```js
card.classList.toggle('flipped');
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- tests/card-slider.test.js`

Expected: all slider tests PASS and no test refers to a favorite DOM element.

- [ ] **Step 6: Commit**

```bash
git add js/card-slider.js tests/card-slider.test.js tests/support/slider-harness.js
git commit -m "refactor: expose slider navigation state"
```

### Task 2: Move favorite state and persistence into the UI facade

**Files:**
- Modify: `js/ui.js`
- Modify: `tests/ui.test.js`

- [ ] **Step 1: Extend the UI test document**

Represent the two controls with usable attributes:

```js
function button(textContent = '') {
  const attributes = new Map();
  return {
    classList: classList(),
    textContent,
    disabled: false,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: (name) => attributes.get(name) ?? null,
  };
}
```

Use:

```js
'btn-favorites-view': button(),
'btn-card-favorite': button('☆'),
```

Update `createSliderSpy()` to record `setOnStateChange(callback)` and remove
`setOnToggleFavorite`.

- [ ] **Step 2: Write failing UI ownership tests**

Add:

```js
test('slider state selects the authoritative card favorite value', () => {
  const calls = [];
  const document = createDocument();
  let stateCallback;
  const slider = {
    ...createSliderSpy(calls),
    setOnStateChange(callback) {
      stateCallback = callback;
    },
  };
  const items = [
    { id: 'card-1', favorite: false },
    { id: 'card-2', favorite: true },
  ];
  const ui = createUI({
    cardsModel: {
      getAll: () => items,
      getById: (id) => items.find(card => card.id === id) || null,
    },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });
  ui.init();

  stateCallback({ currentCardId: 'card-2', busy: false });

  assert.equal(document.nodes['btn-card-favorite'].textContent, '★');
  assert.equal(
    document.nodes['btn-card-favorite'].getAttribute('aria-pressed'),
    'true'
  );
});

test('current favorite waits for persistence and updates only that card', async () => {
  const calls = [];
  const document = createDocument();
  const items = [{ id: 'card-1', favorite: false }];
  let stateCallback;
  let saved;
  const slider = {
    ...createSliderSpy(calls, 'card-1'),
    setOnStateChange(callback) {
      stateCallback = callback;
    },
  };
  const ui = createUI({
    cardsModel: {
      getAll: () => items,
      getById: (id) => items.find(card => card.id === id) || null,
      async update(id, updates) {
        saved = [id, updates];
        items[0] = { ...items[0], ...updates };
        return items[0];
      },
    },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });
  ui.init();
  stateCallback({ currentCardId: 'card-1', busy: false });

  const result = await ui.toggleCurrentFavorite();

  assert.equal(result, true);
  assert.deepEqual(saved, ['card-1', { favorite: true }]);
  assert.equal(document.nodes['btn-card-favorite'].textContent, '★');
});

test('busy slider disables the current-card favorite button', () => {
  const calls = [];
  const document = createDocument();
  let stateCallback;
  const slider = {
    ...createSliderSpy(calls),
    setOnStateChange(callback) {
      stateCallback = callback;
    },
  };
  const item = { id: 'card-1', favorite: false };
  const ui = createUI({
    cardsModel: {
      getAll: () => [item],
      getById: () => item,
    },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });
  ui.init();

  stateCallback({ currentCardId: 'card-1', busy: true });

  assert.equal(document.nodes['btn-card-favorite'].disabled, true);
});
```

Add:

```js
test('failed favorite persistence keeps the confirmed icon', async () => {
  const calls = [];
  const document = createDocument();
  const item = { id: 'card-1', favorite: false };
  let stateCallback;
  const slider = {
    ...createSliderSpy(calls, 'card-1'),
    setOnStateChange(callback) {
      stateCallback = callback;
    },
  };
  const ui = createUI({
    cardsModel: {
      getAll: () => [item],
      getById: () => item,
      update: async () => { throw new Error('save failed'); },
    },
    slider,
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });
  ui.init();
  stateCallback({ currentCardId: 'card-1', busy: false });
  const originalConsoleError = console.error;
  console.error = () => {};

  let result;
  try {
    result = await ui.toggleCurrentFavorite();
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(result, false);
  assert.equal(document.nodes['btn-card-favorite'].textContent, '☆');
  assert.equal(document.nodes['btn-card-favorite'].disabled, false);
});
```

- [ ] **Step 3: Run focused UI tests and verify RED**

Run: `npm test -- tests/ui.test.js`

Expected: FAIL because UI does not own slider state or
`toggleCurrentFavorite()`.

- [ ] **Step 4: Implement favorite state in `ui.js`**

Add state:

```js
let sliderState = { currentCardId: null, busy: false };
let favoritePending = false;
```

Add:

```js
function syncFavoriteControls() {
  const viewButton = document.getElementById('btn-favorites-view');
  viewButton.setAttribute('aria-pressed', String(favoritesActive));
  viewButton.setAttribute(
    'aria-label',
    favoritesActive
      ? 'Zobraziť všetky karty'
      : 'Zobraziť obľúbené karty'
  );

  const button = document.getElementById('btn-card-favorite');
  const card = sliderState.currentCardId
    ? cardsModel.getById(sliderState.currentCardId)
    : null;
  const isFavorite = Boolean(card?.favorite);
  button.classList.toggle('hidden', !card);
  button.disabled = !card || sliderState.busy || favoritePending;
  button.textContent = isFavorite ? '★' : '☆';
  button.setAttribute('aria-pressed', String(isFavorite));
  button.setAttribute(
    'aria-label',
    isFavorite
      ? 'Odstrániť kartu z obľúbených'
      : 'Pridať kartu medzi obľúbené'
  );
}

function handleSliderState(state) {
  sliderState = state;
  syncFavoriteControls();
}
```

Register `setOnStateChange(handleSliderState)` before slider initialization and
remove the favorite button from slider `elements`.

Add to the public API:

```js
async toggleCurrentFavorite() {
  if (sliderState.busy || favoritePending) return false;
  const card = sliderState.currentCardId
    ? cardsModel.getById(sliderState.currentCardId)
    : null;
  if (!card) return false;

  favoritePending = true;
  syncFavoriteControls();
  try {
    const updated = await cardsModel.update(card.id, {
      favorite: !Boolean(card.favorite),
    });
    if (favoritesActive) api.refresh({ preferredId: card.id });
    return Boolean(updated);
  } catch (error) {
    console.error('Nepodarilo sa zmeniť obľúbenú kartu:', error);
    return false;
  } finally {
    favoritePending = false;
    syncFavoriteControls();
  }
}
```

Change `toggleFavorites()` so it no longer changes button text and instead
calls `syncFavoriteControls()` after `api.refresh()`.

- [ ] **Step 5: Run slider and UI tests and verify GREEN**

Run: `npm test -- tests/card-slider.test.js tests/ui.test.js`

Expected: all focused tests PASS.

- [ ] **Step 6: Commit**

```bash
git add js/ui.js tests/ui.test.js
git commit -m "refactor: move favorite behavior into ui"
```

### Task 3: Build the three-button bottom navigation

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/style.css`
- Modify: `tests/app.test.js`
- Modify: `tests/css.test.js`

- [ ] **Step 1: Write failing markup and layout tests**

In `tests/app.test.js`, add:

```js
test('bottom navigation orders favorites, add, and current favorite controls', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const group = html.match(/<div class="nav-center">([\s\S]*?)<\/div>/)?.[1] || '';

  assert.ok(group.indexOf('id="btn-favorites-view"') !== -1);
  assert.ok(group.indexOf('id="btn-add"') > group.indexOf('id="btn-favorites-view"'));
  assert.ok(group.indexOf('id="btn-card-favorite"') > group.indexOf('id="btn-add"'));
  assert.match(group, /aria-hidden="true"/);
});
```

Replace the old favorite CSS test with:

```js
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
```

- [ ] **Step 2: Run app and CSS tests and verify RED**

Run: `npm test -- tests/app.test.js tests/css.test.js`

Expected: FAIL because `.nav-center`, `.nav-secondary`, and the renamed filter
button do not exist.

- [ ] **Step 3: Update the bottom navigation markup**

Keep edge arrows as direct `.nav-bottom` children and replace the current
center buttons with:

```html
<div class="nav-center">
  <button
    id="btn-favorites-view"
    class="nav-secondary"
    type="button"
    aria-label="Zobraziť obľúbené karty"
    aria-pressed="false"
  >
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round">
      <line x1="5" y1="7" x2="19" y2="7"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
      <line x1="5" y1="17" x2="19" y2="17"/>
    </svg>
  </button>
  <button id="btn-add" type="button" aria-label="Pridať kartu">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.5" stroke-linecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  </button>
  <button
    id="btn-card-favorite"
    class="nav-secondary hidden"
    type="button"
    aria-label="Pridať kartu medzi obľúbené"
    aria-pressed="false"
  >☆</button>
</div>
```

Remove `#btn-card-favorite` from `.splide__track`.

- [ ] **Step 4: Wire the renamed controls**

In `js/app.js`, replace the old filter listener and add the current-card
listener:

```js
$('btn-favorites-view').addEventListener('click', () => ui.toggleFavorites());
$('btn-card-favorite').addEventListener(
  'click',
  () => ui.toggleCurrentFavorite()
);
```

- [ ] **Step 5: Replace the old absolute control styles**

Create `.nav-center` as an absolute centered flex row with a responsive gap.
Give `.nav-secondary` a 48–62 px circular touch target, translucent background,
white foreground, and an active background through
`[aria-pressed="true"]`. Consolidate the duplicate `#btn-add` rules and use:

```css
.nav-center {
  position: absolute;
  left: 50%;
  bottom: max(62px, calc(46px + env(safe-area-inset-bottom)));
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: clamp(12px, 4vw, 20px);
  pointer-events: auto;
}

.nav-secondary {
  width: clamp(48px, 14vw, 62px);
  height: clamp(48px, 14vw, 62px);
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(22px, 6vw, 30px);
  cursor: pointer;
  pointer-events: auto;
}

.nav-secondary[aria-pressed="true"] {
  background: rgba(255, 255, 255, 0.32);
  color: white;
}

#btn-add {
  position: static;
  width: clamp(80px, 23vw, 104px);
  height: clamp(80px, 23vw, 104px);
  transform: none;
}
```

Use these final plus interaction declarations:

```css
#btn-add {
  background: white;
  color: #111827;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.2);
}

#btn-add svg {
  width: 46%;
  height: 46%;
  stroke-width: 2.2;
}

#btn-add:active {
  background: #f6f6f6;
  transform: scale(0.94);
}
```

Remove `#btn-fav` and `.card-favorite` rules.

- [ ] **Step 6: Run focused and complete tests**

Run: `npm test -- tests/app.test.js tests/css.test.js tests/ui.test.js`

Expected: all focused tests PASS.

Run: `npm test`

Expected: all tests PASS with zero failures.

- [ ] **Step 7: Commit**

```bash
git add index.html js/app.js css/style.css tests/app.test.js tests/css.test.js
git commit -m "feat: reorganize bottom favorite controls"
```

### Task 4: Refresh offline assets and verify mobile behavior

**Files:**
- Modify: `service-worker.js`
- Modify: `tests/service-worker.test.js`

- [ ] **Step 1: Write the failing cache-version expectation**

Change:

```js
assert.match(source, /const CACHE = 'la-word-v16';/);
```

- [ ] **Step 2: Run the service-worker test and verify RED**

Run: `npm test -- tests/service-worker.test.js`

Expected: FAIL because the worker still declares `la-word-v15`.

- [ ] **Step 3: Bump the cache generation**

Set:

```js
const CACHE = 'la-word-v16';
```

- [ ] **Step 4: Run fresh automated verification**

Run:

```bash
npm test
git diff --check
git status --short
```

Expected: all tests PASS, no whitespace errors, and only the planned service
worker files remain uncommitted.

- [ ] **Step 5: Verify in a real mobile browser**

At a 390 × 844 viewport, seed three cards with different favorite states and
verify:

1. center order is menu, smaller plus, star,
2. the three controls do not overlap either edge arrow,
3. swiping keeps the right star fixed and disabled until commit,
4. the icon updates only after the new current card is confirmed,
5. the left button toggles favorites and all cards with `aria-pressed`,
6. unfavoriting the final visible favorite shows the favorites empty state,
7. the right star remains available after flipping a card,
8. browser console reports zero errors and warnings.

- [ ] **Step 6: Commit**

```bash
git add service-worker.js tests/service-worker.test.js
git commit -m "chore: refresh cache for bottom navigation"
```

- [ ] **Step 7: Review the final branch**

Run:

```bash
npm test
git diff --check
git status --short --branch
git log --oneline main..HEAD
```

Expected: a clean feature branch with all tests passing.
