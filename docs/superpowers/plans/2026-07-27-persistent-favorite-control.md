# Persistent Favorite Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-slide favorite stars with one accessible, stable button attached visually to the centered card.

**Architecture:** `index.html` owns one persistent favorite button outside the virtualized `.splide__list`. `card-slider.js` is the single owner of its state, interaction, and synchronization with the confirmed current card; `ui.js` continues to persist changes through the cards model. Existing virtual slide replacement remains unchanged.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node.js built-in test runner, custom DOM test harness, service worker.

---

### Task 1: Add the persistent control contract

**Files:**
- Modify: `index.html:35-40`
- Modify: `js/ui.js:17-29`
- Modify: `tests/support/slider-harness.js:101-157`
- Modify: `tests/card-slider.test.js`

- [ ] **Step 1: Write failing tests for one persistent button**

Add tests that pass a `favoriteButton` through the slider harness and verify
that slides no longer own `.star` elements:

```js
test('favorite control stays mounted while the virtual window is rebuilt', async () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  slider.init([
    ...makeCards(1).map(card => ({ ...card, favorite: false })),
    { ...makeCards(2)[1], favorite: true },
  ]);
  const button = harness.favoriteButton;

  assert.equal(harness.list.querySelector('.star'), null);
  assert.equal(button.textContent, '☆');
  await slider.next();

  assert.equal(harness.favoriteButton, button);
  assert.equal(button.textContent, '★');
  assert.equal(button['aria-pressed'], 'true');
});

test('favorite control is hidden without a current card', () => {
  const harness = createSliderHarness();
  createCardSlider(harness.dependencies).init([]);

  assert.equal(harness.favoriteButton.classList.contains('hidden'), true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/card-slider.test.js`

Expected: FAIL because `favoriteButton` is not part of the harness and slide
creation still produces `.star`.

- [ ] **Step 3: Add the persistent HTML button and element dependency**

Inside `#card-container`, after `.splide__track`, add:

```html
<button
  id="btn-card-favorite"
  class="card-favorite"
  type="button"
  aria-label="Pridať kartu medzi obľúbené"
  aria-pressed="false"
>☆</button>
```

Pass it from `createUI()`:

```js
favoriteButton: document.getElementById('btn-card-favorite'),
```

Extend `createSliderHarness()` with:

```js
const favoriteButton = createNode('button');
```

and include it in both `dependencies.elements` and the public `harness`.

- [ ] **Step 4: Replace per-slide stars with button synchronization**

Remove `.star` creation and its `pointerdown` handler from `createSlide()`.
Add this helper in `card-slider.js`:

```js
function syncFavoriteButton() {
  const card = items[currentIndex];
  const button = elements.favoriteButton;
  const isFavorite = Boolean(card?.favorite);
  button.classList.toggle('hidden', !card);
  button.textContent = isFavorite ? '★' : '☆';
  button.setAttribute('aria-pressed', String(isFavorite));
  button.setAttribute(
    'aria-label',
    isFavorite
      ? 'Odstrániť kartu z obľúbených'
      : 'Pridať kartu medzi obľúbené'
  );
}
```

Call `syncFavoriteButton()` at the end of `renderWindow()`.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- tests/card-slider.test.js`

Expected: all card-slider tests PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html js/ui.js js/card-slider.js tests/card-slider.test.js tests/support/slider-harness.js
git commit -m "refactor: add persistent card favorite control"
```

### Task 2: Make favorite interaction safe and persistent

**Files:**
- Modify: `js/card-slider.js`
- Modify: `js/ui.js:50-54`
- Modify: `tests/card-slider.test.js`
- Modify: `tests/ui.test.js`
- Modify: `tests/support/slider-harness.js`

- [ ] **Step 1: Write failing interaction and failure tests**

Add focused tests for the button behavior:

```js
test('favorite button toggles only the confirmed current card', async () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  const calls = [];
  slider.setOnToggleFavorite(async (id, value) => {
    calls.push([id, value]);
    return { id, favorite: value };
  });
  slider.init(makeCards(2).map(card => ({ ...card, favorite: false })));

  await harness.clickFavorite();

  assert.deepEqual(calls, [['card-1', true]]);
  assert.equal(harness.favoriteButton.textContent, '★');
  assert.equal(harness.activeFront().parentNode.classList.contains('flipped'), false);
});

test('favorite button keeps its confirmed state when persistence fails', async () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  slider.setOnToggleFavorite(async () => {
    throw new Error('save failed');
  });
  slider.init(makeCards(1).map(card => ({ ...card, favorite: false })));

  await harness.clickFavorite();

  assert.equal(harness.favoriteButton.textContent, '☆');
  assert.equal(harness.favoriteButton['aria-pressed'], 'false');
});
```

Add a manual-animation assertion:

```js
test('favorite button is disabled until navigation confirms the new card', async () => {
  const harness = createSliderHarness({}, { reducedMotion: false });
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(2));

  const movement = slider.next();
  assert.equal(harness.favoriteButton.disabled, true);
  await harness.finishAnimation();
  await movement;
  assert.equal(harness.favoriteButton.disabled, false);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/card-slider.test.js tests/ui.test.js`

Expected: FAIL because the persistent button has no click handling, pending
state, or failure behavior.

- [ ] **Step 3: Implement confirmed favorite toggling**

Add an async click handler that waits for persistence before changing local
slider state:

```js
async function handleFavoriteClick(event) {
  event.stopPropagation();
  if (phase !== 'idle' || elements.favoriteButton.disabled) return;
  const card = items[currentIndex];
  if (!card) return;

  const value = !Boolean(card.favorite);
  favoritePending = true;
  elements.favoriteButton.disabled = true;
  try {
    const updated = await onToggleFavorite?.(card.id, value);
    const index = items.findIndex(item => item.id === card.id);
    if (index !== -1) {
      items[index] = { ...items[index], favorite: updated?.favorite ?? value };
    }
    syncFavoriteButton();
  } catch (error) {
    console.error('Nepodarilo sa zmeniť obľúbenú kartu:', error);
  } finally {
    favoritePending = false;
    syncFavoriteButton();
  }
}
```

Bind/unbind this handler once with the other slider events. Return the updated
card from `ui.js`:

```js
async function handleToggleFavorite(id, value) {
  const updated = await cardsModel.update(id, { favorite: value });
  if (favoritesActive) api.refresh();
  return updated;
}
```

- [ ] **Step 4: Synchronize availability with movement**

Declare:

```js
let favoritePending = false;
let currentCardFlipped = false;
```

Make `syncFavoriteButton()` own both visibility and availability:

```js
button.classList.toggle('hidden', !card || currentCardFlipped);
button.disabled = !card || phase !== 'idle' || favoritePending;
```

Set `favoritePending = true` before awaiting persistence. Call
`syncFavoriteButton()` immediately after `phase` changes in pointer down,
`animateBy()`, `animateBack()`, `cancelInteraction()`, and
`finishAnimation()`. In `finishAnimation()`, set `phase = 'idle'` before the
final synchronization.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- tests/card-slider.test.js tests/ui.test.js`

Expected: all focused tests PASS with no unhandled promise rejection.

- [ ] **Step 6: Commit**

```bash
git add js/card-slider.js js/ui.js tests/card-slider.test.js tests/ui.test.js tests/support/slider-harness.js
git commit -m "fix: keep favorite state stable during navigation"
```

### Task 3: Preserve front-side visibility and visual placement

**Files:**
- Modify: `js/card-slider.js`
- Modify: `css/style.css:256-340,1142-1160`
- Modify: `tests/card-slider.test.js`
- Modify: `tests/css.test.js`

- [ ] **Step 1: Write failing visibility and CSS tests**

Add a behavior test:

```js
test('favorite control hides on the back and returns on the front', () => {
  const harness = createSliderHarness();
  const slider = createCardSlider(harness.dependencies);
  slider.init(makeCards(1));

  harness.clickActiveCard();
  assert.equal(harness.favoriteButton.classList.contains('hidden'), true);
  harness.clickActiveCard();
  assert.equal(harness.favoriteButton.classList.contains('hidden'), false);
});
```

Add this source-level CSS regression test:

```js
test('favorite control is stable outside virtual slides', () => {
  const favoriteRule = getRule('.card-favorite');

  assert.match(favoriteRule, /position:\s*absolute/);
  assert.match(favoriteRule, /z-index:\s*3/);
  assert.doesNotMatch(css, /\.splide__slide\s+\.star\s*\{/);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/card-slider.test.js tests/css.test.js`

Expected: FAIL because flipping does not synchronize external control
visibility and the old CSS selector still exists.

- [ ] **Step 3: Synchronize flip visibility**

Reset `currentCardFlipped = false` in `renderWindow()`. Replace the toggle in
`handleClick()` with:

```js
currentCardFlipped = card.classList.toggle('flipped');
syncFavoriteButton();
```

- [ ] **Step 4: Replace the per-slide star CSS**

Move the card dimensions to inherited custom properties, make `.splide`
positioned, and style the stable button:

```css
.splide {
  --slide-width: min(66vw, 340px);
  --card-width: calc(var(--slide-width) - 20px);
  --card-height: max(300px, min(52vh, 460px));
  position: relative;
}

.card-favorite {
  position: absolute;
  left: calc(50% + (var(--card-width) / 2) - clamp(8px, 2.5vw, 16px));
  top: calc(50% + (var(--card-height) / 2) - clamp(12px, 3vw, 20px));
  transform: translate(-100%, -100%);
  border: 0;
  background: transparent;
  font-size: clamp(16px, 3.5vw, 24px);
  color: white;
  opacity: 0.7;
  cursor: pointer;
  z-index: 3;
  line-height: 1;
  padding: 6px;
  -webkit-tap-highlight-color: transparent;
}

.card-favorite[aria-pressed="true"] {
  opacity: 1;
}

.card-favorite:disabled {
  cursor: default;
}
```

Change the card rule to `height: var(--card-height)` and remove the duplicate
`--slide-width` declaration from `.splide__list`.

Remove `.splide__slide .star` and
`.splide__slide .card.flipped .star`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- tests/card-slider.test.js tests/css.test.js`

Expected: all focused tests PASS.

- [ ] **Step 6: Commit**

```bash
git add js/card-slider.js css/style.css tests/card-slider.test.js tests/css.test.js
git commit -m "style: anchor favorite control to active card"
```

### Task 4: Refresh the offline shell and verify the complete behavior

**Files:**
- Modify: `service-worker.js:1`
- Modify: `tests/service-worker.test.js:84-88`

- [ ] **Step 1: Write the failing cache-version test**

Change the expected cache generation:

```js
assert.match(source, /const CACHE = 'la-word-v15';/);
```

- [ ] **Step 2: Run the service-worker test and verify RED**

Run: `npm test -- tests/service-worker.test.js`

Expected: FAIL because `service-worker.js` still declares `la-word-v14`.

- [ ] **Step 3: Bump the cache generation**

Change the first line of `service-worker.js`:

```js
const CACHE = 'la-word-v15';
```

- [ ] **Step 4: Run the complete automated suite**

Run: `npm test`

Expected: all tests PASS with zero failures, cancellations, skips, or todos.

- [ ] **Step 5: Verify the mobile interaction in a real browser**

Serve the worktree locally, open it at a mobile viewport, seed at least three
cards with different favorite states, and verify:

1. the same `#btn-card-favorite` DOM node remains connected across navigation,
2. `☆/★` changes only after the next card is centered,
3. the button cannot be activated during a pending swipe,
4. flipping hides it and flipping back restores it,
5. unfavoriting inside the favorites filter moves to the next card or shows
   the favorites empty state,
6. the browser console contains no errors or warnings.

- [ ] **Step 6: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
git diff HEAD~3 -- index.html js/ui.js js/card-slider.js css/style.css service-worker.js tests
```

Expected: no whitespace errors and only the planned files changed.

- [ ] **Step 7: Commit**

```bash
git add service-worker.js tests/service-worker.test.js
git commit -m "chore: refresh cache for favorite control fix"
```
