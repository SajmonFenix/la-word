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
    const slotsBefore = Math.min(
      SLOT_RADIUS,
      Math.floor((cards.length - 1) / 2)
    );
    return Array.from({ length: cards.length }, (_, slot) => {
      const offset = slot - slotsBefore;
      const index = wrapIndex(currentIndex + offset, cards.length);
      return { offset, index, card: cards[index] };
    });
  }
  return Array.from({ length: SLOT_RADIUS * 2 + 1 }, (_, slot) => {
    const offset = slot - SLOT_RADIUS;
    const index = wrapIndex(currentIndex + offset, cards.length);
    return { offset, index, card: cards[index] };
  });
}
