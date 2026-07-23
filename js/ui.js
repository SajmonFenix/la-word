import { cards } from './cards.js';
import { createCardSlider } from './card-slider.js';

const STORAGE_KEY_SHOW_ARROWS = 'laword_show_arrows';

export function createUI({
  cardsModel = cards,
  slider = null,
  document = globalThis.document,
  localStorage = globalThis.localStorage,
} = {}) {
  let sliderController = slider;
  let onEditCard = null;
  let showArrows = true;

  function getSlider() {
    if (!sliderController) {
      sliderController = createCardSlider({
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
    }
    return sliderController;
  }

  function updateEmptyState(items) {
    document.getElementById('empty-state')
      .classList.toggle('hidden', items.length > 0);
    document.getElementById('card-area')
      .classList.toggle('hidden', items.length === 0);
  }

  const api = {
    init() {
      const items = cardsModel.getAll();
      showArrows = localStorage.getItem(STORAGE_KEY_SHOW_ARROWS) !== 'false';
      api.toggleArrows(showArrows, { persist: false });
      getSlider().setOnEditCard((card) => onEditCard?.(card));
      getSlider().init(items);
      updateEmptyState(items);
    },

    refresh(options = {}) {
      const items = cardsModel.getAll();
      const preferredId = options.preferredId
        ?? getSlider().getCurrentCardId();
      getSlider().setCards(items, { preferredId });
      updateEmptyState(items);
    },

    showCard: (id) => getSlider().showCard(id),
    showIndex: (index) => getSlider().showIndex(index),
    showNext: () => getSlider().next(),
    showPrev: () => getSlider().previous(),
    getCurrentCardId: () => getSlider().getCurrentCardId(),
    getShowArrows: () => showArrows,
    setShowArrows: (show) => api.toggleArrows(show),

    toggleArrows(show, { persist = true } = {}) {
      showArrows = Boolean(show);
      if (persist) {
        localStorage.setItem(STORAGE_KEY_SHOW_ARROWS, showArrows);
      }
      document.getElementById('btn-prev')
        .classList.toggle('hidden', !showArrows);
      document.getElementById('btn-next')
        .classList.toggle('hidden', !showArrows);
    },

    destroy() {
      sliderController?.destroy();
    },
  };

  Object.defineProperty(api, 'onEditCard', {
    set(callback) {
      onEditCard = callback;
    },
  });

  return api;
}

export const ui = createUI();
