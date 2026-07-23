# Flat Card Slider Transition

## Goal

Card navigation must feel like a direct horizontal move to the neighboring
card. A card must not appear smaller or faded before becoming active, and it
must not zoom into the foreground during navigation.

## Design

- Keep the existing horizontal list translation and gesture handling.
- Render active and neighboring cards at the same scale and opacity.
- Remove the card-level scale and opacity transition used for active-state
  changes.
- Keep the 3D rotation used only when the user intentionally flips a card.
- Preserve the virtual five-slot window, infinite wrapping, persisted current
  card, gesture thresholds, and reduced-motion behavior.

## Verification

- Add a CSS regression test proving that neighboring cards are not scaled or
  faded and that cards do not animate scale or opacity during navigation.
- Run the full automated test suite.
- Verify in a mobile-sized browser that a swipe moves the list horizontally
  while card size and opacity remain constant.

## Out of Scope

- Changing the card-flip animation.
- Changing swipe thresholds, navigation speed, card dimensions, or storage.
