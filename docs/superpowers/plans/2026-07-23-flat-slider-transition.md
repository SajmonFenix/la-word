# Flat Card Slider Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the foreground zoom/fade effect so card navigation consists only of a horizontal slide.

**Architecture:** Keep the virtual slider state machine and list translation unchanged. Change only the card presentation rules: neighboring and active cards share the same scale and opacity, while the existing `flipped` class remains responsible for the intentional Y-axis card flip.

**Tech Stack:** Vanilla CSS, Node.js built-in test runner

---

### Task 1: Remove card zoom and fading

**Files:**
- Modify: `tests/css.test.js`
- Modify: `css/style.css:322-359`

- [ ] **Step 1: Write the failing regression test**

Append this test to `tests/css.test.js`:

```js
test('card navigation keeps every slide at a constant scale and opacity', () => {
  const cardRule = getRule('.splide__slide .card');
  const neighborRule = [
    getRule('.splide__slide.is-prev .card'),
    getRule('.splide__slide.is-next .card'),
  ].join('\n');

  assert.doesNotMatch(cardRule, /transition:[^;]*(?:transform|opacity)/);
  assert.doesNotMatch(neighborRule, /scale\s*\(/);
  assert.doesNotMatch(neighborRule, /opacity\s*:/);
});
```

- [ ] **Step 2: Run the regression test and verify RED**

Run:

```bash
node --test tests/css.test.js
```

Expected: FAIL in `card navigation keeps every slide at a constant scale and opacity` because the current CSS contains a transform/opacity transition, `scale(0.85)`, and `opacity: 0.7`.

- [ ] **Step 3: Apply the minimal CSS fix**

In `css/style.css`, change the card rules to:

```css
.splide__slide .card {
  width: 100%;
  height: min(52vh, 460px);
  min-height: 300px;
  cursor: pointer;
  position: relative;
  transform-style: preserve-3d;
}

.splide__slide.is-active {
  pointer-events: auto;
}

.splide__slide .card.flipped {
  transform: rotateY(180deg);
}
```

Delete the `.is-prev`/`.is-next` scale and opacity rule and the redundant active-card transform and opacity rule. In the reduced-motion block, keep only the list:

```css
@media (prefers-reduced-motion: reduce) {
  .splide__list {
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Run the focused and complete test suites**

Run:

```bash
node --test tests/css.test.js
npm test
git diff --check
```

Expected: the focused CSS tests pass, all 84 project tests pass, and `git diff --check` produces no output.

- [ ] **Step 5: Commit the fix**

```bash
git add css/style.css tests/css.test.js
git commit -m "fix: remove card slider zoom effect"
```

### Task 2: Verify the mobile interaction

**Files:**
- No production file changes expected

- [ ] **Step 1: Start the local static server**

Run:

```bash
python3 -m http.server 4175
```

Expected: the project is available at `http://127.0.0.1:4175/`.

- [ ] **Step 2: Exercise navigation in a mobile viewport**

Open the app at an iPhone-sized viewport, seed several cards if the browser
profile is empty, and perform both next and previous swipes.

Expected during the transition:

- the list translates horizontally;
- the incoming and outgoing cards retain the same bounding-box width and height;
- computed opacity remains `1`;
- computed card transform remains `none` except when a card is intentionally flipped;
- no console errors or warnings appear.

- [ ] **Step 3: Re-run final verification**

Run:

```bash
npm test
git diff --check
git status --short
```

Expected: all 84 tests pass, the diff check is clean, and only the intended committed plan/fix state is present.
