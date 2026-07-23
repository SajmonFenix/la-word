export function findCardIndex(items, query) {
  const normalized = query.toLocaleLowerCase('sk').trim();
  if (!normalized || items.length === 0) return null;

  const index = items.findIndex((card) =>
    card.front.toLocaleLowerCase('sk').includes(normalized) ||
    (card.hint && card.hint.toLocaleLowerCase('sk').includes(normalized)) ||
    card.back.toLocaleLowerCase('sk').includes(normalized)
  );

  return index === -1 ? null : index;
}

export function createSearchController({ elements, cards, ui, setTimer }) {
  function close() {
    elements.headerActions.classList.remove('hidden');
    elements.searchBar.classList.add('hidden');
    elements.feedback.classList.add('hidden');
  }

  return {
    open() {
      elements.headerActions.classList.add('hidden');
      elements.searchBar.classList.remove('hidden');
      elements.input.value = '';
      elements.feedback.classList.add('hidden');
      elements.input.focus();
    },
    close,
    search() {
      const items = cards.getAll();
      const query = elements.input.value;
      if (!query.trim()) {
        elements.feedback.textContent = 'Zadaj hľadaný výraz';
        elements.feedback.classList.remove('hidden');
        return null;
      }
      const index = findCardIndex(items, query);
      if (index === null) {
        elements.feedback.textContent = 'Žiadna karta nevyhovuje hľadaniu';
        elements.feedback.classList.remove('hidden');
        return null;
      }
      ui.showIndex(index);
      elements.feedback.textContent = `Nájdená karta ${index + 1} / ${items.length}`;
      elements.feedback.classList.remove('hidden');
      setTimer(() => elements.feedback.classList.add('hidden'), 2000);
      close();
      return index;
    },
  };
}
