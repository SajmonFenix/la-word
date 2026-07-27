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
  let sliderState = { currentCardId: null, busy: false };
  let favoritePending = false;

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

  function syncFavoriteControls() {
    const viewButton = document.getElementById('btn-favorites-view');
    viewButton.setAttribute('aria-pressed', String(favoritesActive));
    viewButton.setAttribute(
      'aria-label',
      favoritesActive
        ? 'Zobraziť všetky karty'
        : 'Zobraziť obľúbené karty'
    );

    const button = document.getElementById('btn-card-favorite');
    const card = sliderState.currentCardId
      ? cardsModel.getById(sliderState.currentCardId)
      : null;
    const isFavorite = Boolean(card?.favorite);
    button.classList.toggle('hidden', !card);
    button.disabled = !card || sliderState.busy || favoritePending;
    button.textContent = isFavorite ? '★' : '☆';
    button.setAttribute('aria-pressed', String(isFavorite));
    button.setAttribute(
      'aria-label',
      isFavorite
        ? 'Odstrániť kartu z obľúbených'
        : 'Pridať kartu medzi obľúbené'
    );
  }

  function handleSliderState(state) {
    sliderState = state;
    syncFavoriteControls();
  }

  const api = {
    init() {
      const items = cardsModel.getAll();
      showArrows = localStorage.getItem(STORAGE_KEY_SHOW_ARROWS) !== 'false';
      favoritesActive = false;
      api.toggleArrows(showArrows, { persist: false });
      getSlider().setOnEditCard((card) => onEditCard?.(card));
      getSlider().setOnStateChange(handleSliderState);
      getSlider().init(items);
      initialized = true;
      updateEmptyState(items);
      syncFavoriteControls();
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

    async toggleCurrentFavorite() {
      if (sliderState.busy || favoritePending) return false;
      const card = sliderState.currentCardId
        ? cardsModel.getById(sliderState.currentCardId)
        : null;
      if (!card) return false;

      favoritePending = true;
      syncFavoriteControls();
      try {
        const updated = await cardsModel.update(card.id, {
          favorite: !Boolean(card.favorite),
        });
        if (favoritesActive) api.refresh({ preferredId: card.id });
        return Boolean(updated);
      } catch (error) {
        console.error('Nepodarilo sa zmeniť obľúbenú kartu:', error);
        return false;
      } finally {
        favoritePending = false;
        syncFavoriteControls();
      }
    },

    toggleFavorites() {
      favoritesActive = !favoritesActive;
      api.refresh();
      syncFavoriteControls();
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
