import {
  buildSliderWindow,
  reconcileCurrentIndex,
} from './slider-window.js';

export const LAST_CARD_KEY = 'laword_last_card_id';
export const SWIPE_DISTANCE = 70;
export const SWIPE_VELOCITY = 0.45;
export const AXIS_LOCK_DISTANCE = 8;

export function createCardSlider({
  elements,
  storage = globalThis.localStorage,
  document = globalThis.document,
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
    edit.textContent = '✎';
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
    const entries = buildSliderWindow(items, currentIndex);
    elements.list.replaceChildren(...entries.map(createSlide));
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
