# Empty State Visibility Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skryť všeobecnú hlášku prázdnej aplikácie hneď, ako aktuálny zoznam obsahuje kartu, a zachovať samostatný prázdny stav filtra obľúbených.

**Architecture:** Oprava zostane v existujúcej UI fasáde. `updateEmptyState(items)` vypočíta výsledné booleany pre všeobecný prázdny stav, prázdny stav obľúbených a oblasť kariet; každý DOM prvok dostane triedu `hidden` iba raz.

**Tech Stack:** Vanilla JavaScript ES modules, `node:test`, `node:assert/strict`

---

### Task 1: Regresný test a minimálna oprava

**Files:**
- Modify: `tests/ui.test.js`
- Modify: `js/ui.js:35-47`

- [ ] **Step 1: Aktualizovať testovacie double pre súčasné UI rozhranie**

Do `createDocument()` pridať uzly:

```js
'favorites-empty-state': { classList: classList() },
'btn-fav': { textContent: '☆' },
```

Do `createSliderSpy()` pridať:

```js
setOnToggleFavorite: (callback) => calls.push([
  'favoriteCallback',
  typeof callback,
]),
```

V očakávaní inicializácie doplniť volanie:

```js
['favoriteCallback', 'function'],
```

- [ ] **Step 2: Napísať regresný test**

Pridať do `tests/ui.test.js`:

```js
test('general empty state disappears after the first card is added or imported', () => {
  const calls = [];
  const document = createDocument();
  let items = [];
  const ui = createUI({
    cardsModel: { getAll: () => items },
    slider: createSliderSpy(calls, null),
    localStorage: { getItem: () => null, setItem() {} },
    document,
  });

  ui.init();
  assert.equal(
    document.nodes['empty-state'].classList.contains('hidden'),
    false
  );

  items = [{ id: 'card-1', favorite: false }];
  ui.refresh();

  assert.equal(
    document.nodes['empty-state'].classList.contains('hidden'),
    true
  );
  assert.equal(
    document.nodes['favorites-empty-state'].classList.contains('hidden'),
    true
  );
  assert.equal(
    document.nodes['card-area'].classList.contains('hidden'),
    false
  );
});
```

- [ ] **Step 3: Spustiť test a potvrdiť správne zlyhanie**

Run:

```bash
node --test tests/ui.test.js
```

Expected: nový test zlyhá, pretože `empty-state` po `ui.refresh()` nemá triedu `hidden`.

- [ ] **Step 4: Implementovať jednoznačné stavy**

Nahradiť telo `updateEmptyState(items)` v `js/ui.js`:

```js
function updateEmptyState(items) {
  const isEmpty = items.length === 0;
  const showFavoritesEmpty = favoritesActive && isEmpty;
  const showGeneralEmpty = !favoritesActive && isEmpty;

  document.getElementById('empty-state')
    .classList.toggle('hidden', !showGeneralEmpty);
  document.getElementById('card-area')
    .classList.toggle('hidden', isEmpty);

  const favoritesEmpty = document.getElementById('favorites-empty-state');
  if (favoritesEmpty) {
    favoritesEmpty.classList.toggle('hidden', !showFavoritesEmpty);
  }
}
```

- [ ] **Step 5: Overiť cielený test**

Run:

```bash
node --test tests/ui.test.js
```

Expected: všetky testy v `tests/ui.test.js` prejdú.

- [ ] **Step 6: Overiť celý testovací balík a diff**

Run:

```bash
npm test
git diff --check
```

Expected: nový regresný test prejde. Prípadné už existujúce zlyhania mimo `tests/ui.test.js` sa zdokumentujú oddelene.

- [ ] **Step 7: Browserový smoke test**

Spustiť aplikáciu cez lokálny HTTP server, pridať prvú kartu a overiť:

```js
document.getElementById('empty-state').classList.contains('hidden') === true
```

Expected: karta je viditeľná a všeobecná prázdna hláška nie je renderovaná.

- [ ] **Step 8: Commitnúť opravu**

```bash
git add js/ui.js tests/ui.test.js docs/superpowers/plans/2026-07-27-empty-state-visibility-fix.md
git commit -m "fix: hide empty state when cards exist"
```
