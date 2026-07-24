# Favorites Filter Feature

## Overview
Allow users to mark cards as "favorite" (starred) for quick access. A toggle button filters the deck to show only favorited cards.

## Data Model
```js
{
  // ...existing fields (id, front, hint, back, color, createdAt)
  favorite: false  // boolean, default false
}
```

- `favorite` added to card creation template (default `false`)
- Persisted via existing IndexedDB/ls (`cards` store/key)
- No separate migration needed — `?? false` fallback on read

## Visual Components

### Star icon on card front
- **Position:** absolute, bottom-right of `.card-front`
- **Size:** `clamp(18px, 4vw, 26px)`
- **States:** `☆` (unfavorited) → `★` (favorited)
- **Color:** white with `opacity: 0.7` (unfavorited) / `opacity: 1` (favorited)
- **Interaction:** `pointerdown` → `event.stopPropagation()` prevents slider drag/card flip; toggles `favorite` on the card data
- **Z-index:** above card text, with `padding-bottom`/`padding-right` margin

### Toggle button in nav
- **Position:** below `btn-add` in `#nav-bottom`, with increased gap
- **Size:** `clamp(20px, 4vw, 28px)` — visibly smaller than add button (`clamp(32px, 7vw, 44px)`)
- **States:** `☆` (filter off) / `★` (filter on)
- **Tooltip:** "Obľúbené"
- No text label, icon only

## Filtering Logic

### Filter ON
- `slider.setCards(favoritedCards)` replaces slider contents with only favorited cards
- If current card is favorited → stay on it
- If current card is NOT favorited → jump to first favorited (or empty state)
- Empty state: show message "Zatiaľ si nepridal žiadne obľúbené karty" with a button "Zobraziť všetky karty" that turns filter off

### Filter OFF
- `slider.setCards(allCards)` restores full deck
- Stay on current card position in the full list (by id via `preferredId`)

### Edge Cases
- Unfavoriting the last visible card while filter is on → show empty state
- Navigate to a card, unfavorite it → card disappears, next favorited card shows

## Persistence
- Per-card `favorite` status persists across reloads (via existing storage)
- Filter state does NOT persist — always start with "all cards" on page load

## Implementation

### Files to modify
| File | Change |
|------|--------|
| `js/cards.js` | Add `favorite: false` to createCard default |
| `js/storage.js` | Add `favorite` to store/load normalization |
| `js/card-slider.js` | Add star icon to `.card-front` in `createSlide`, handle pointerdown |
| `js/ui.js` | Add `toggleFavorites` method, connect toggle button |
| `js/app.js` | Wire `btn-fav` click → `ui.toggleFavorites()` |
| `css/style.css` | Styles for star icon, toggle button, empty state text |
| `index.html` | Add `btn-fav` to `#nav-bottom` |

### Star interaction handling
In `card-slider.js`:
1. Add `<span class="star">☆</span>` to `.card-front` in `createSlide`
2. `pointerdown` on `.star` → `stopPropagation()`, toggle `favorite` on card data, update icon
3. `pointerdown` on `.star` returns early from `handlePointer` (existing button check catches `.star` too? No — need to add `.star` to the check, or use `closest('button, .star')`)

### Filtering in ui.js
```js
let favoritesActive = false;

function toggleFavorites() {
  favoritesActive = !favoritesActive;
  const allCards = cardsModel.getAll();
  const cards = favoritesActive ? allCards.filter(c => c.favorite) : allCards;
  const currentId = slider.getCurrentCardId();
  const preferredId = favoritesActive && cards.length > 0
    ? (cards.find(c => c.id === currentId) || cards[0])?.id
    : currentId;
  slider.setCards(cards, { preferredId });
  // Update empty state if filter active and no cards
}
```

## Testing
- `tests/cards.test.js`: verify `favorite: false` default on new card
- `tests/card-slider.test.js`: verify star icon renders in front, pointerdown on star doesn't flip
- `tests/ui.test.js`: verify `toggleFavorites` filter logic and empty state
