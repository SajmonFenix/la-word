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
  let initialized = false;
  let favoritesActive = false;

  function getSlider() {
    if (!sliderController) {
      sliderController = createCardSlider({
        elements: {
          container: document.getElementById('card-container'),
          list: document.querySelector('#card-container .splide__list'),
          counter: document.getElementById('card-counter'),
          previousButton: document.getElementById('btn-prev'),
          nextButton: document.getElementById('btn-next'),
          favoriteButton: document.getElementById('btn-card-favorite'),
        },
        document,
        storage: localStorage,
      });
    }
    return sliderController;
  }

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

  async function handleToggleFavorite(id, value) {
    const updated = await cardsModel.update(id, { favorite: value });
    if (favoritesActive) api.refresh();
    return updated;
  }

  const api = {
    init() {
      const items = cardsModel.getAll();
      showArrows = localStorage.getItem(STORAGE_KEY_SHOW_ARROWS) !== 'false';
      favoritesActive = false;
      api.toggleArrows(showArrows, { persist: false });
      getSlider().setOnEditCard((card) => onEditCard?.(card));
      getSlider().setOnToggleFavorite(handleToggleFavorite);
      getSlider().init(items);
      initialized = true;
      updateEmptyState(items);
    },

    refresh(options = {}) {
      if (!initialized) return;
      const allCards = cardsModel.getAll();
      const items = favoritesActive ? allCards.filter(c => c.favorite) : allCards;
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

    toggleFavorites() {
      favoritesActive = !favoritesActive;
      api.refresh();
      const btn = document.getElementById('btn-fav');
      if (btn) btn.textContent = favoritesActive ? '★' : '☆';
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
