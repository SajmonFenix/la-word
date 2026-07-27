import {
  buildSliderWindow,
  reconcileCurrentIndex,
  wrapIndex,
} from './slider-window.js';

export const LAST_CARD_KEY = 'laword_last_card_id';
export const SWIPE_DISTANCE = 70;
export const SWIPE_VELOCITY = 0.45;
export const AXIS_LOCK_DISTANCE = 8;

const PENCIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';

export function createCardSlider({
  elements,
  storage = globalThis.localStorage,
  document = globalThis.document,
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis)
    ?? ((callback) => callback()),
  now = () => globalThis.performance.now(),
  reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
} = {}) {
  let items = [];
  let currentIndex = -1;
  let onEditCard = null;
  let onToggleFavorite = null;
  let phase = 'idle';
  let drag = null;
  let axis = null;
  let animationDelta = 0;
  let animationResolve = null;
  let favoritePending = false;
  let currentCardFlipped = false;

  let listenersBound = false;
  let suppressClick = false;

  function createSlide(entry) {
    const slide = document.createElement('div');
    const card = document.createElement('div');
    const front = document.createElement('div');
    const frontText = document.createElement('span');
    const hint = document.createElement('span');
    const back = document.createElement('div');
    const backText = document.createElement('span');
    const backActions = document.createElement('div');
    const edit = document.createElement('button');

    slide.className = 'splide__slide';
    card.className = 'card';
    front.className = 'card-front';
    frontText.className = 'card-front-text';
    hint.className = 'hint';
    back.className = 'card-back';
    backText.className = 'card-back-text';
    backActions.className = 'card-back-actions';
    edit.className = 'btn-edit';
    edit.type = 'button';
    edit.title = 'Upraviť';
    edit.innerHTML = PENCIL_SVG;
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
    backActions.append(edit);
    back.append(backText, backActions);
    card.append(front, back);
    slide.append(card);
    return slide;
  }

  function syncFavoriteButton() {
    const card = items[currentIndex];
    const isFavorite = Boolean(card?.favorite);
    elements.favoriteButton.classList.toggle(
      'hidden',
      !card || currentCardFlipped
    );
    elements.favoriteButton.disabled = !card
      || phase !== 'idle'
      || favoritePending;
    elements.favoriteButton.textContent = isFavorite ? '★' : '☆';
    elements.favoriteButton.setAttribute('aria-pressed', String(isFavorite));
    elements.favoriteButton.setAttribute(
      'aria-label',
      isFavorite
        ? 'Odstrániť kartu z obľúbených'
        : 'Pridať kartu medzi obľúbené'
    );
  }

  function renderWindow() {
    currentCardFlipped = false;
    const entries = buildSliderWindow(items, currentIndex);
    const centerSlot = Math.max(
      0,
      entries.findIndex((entry) => entry.offset === 0)
    );
    elements.list.style.setProperty('--center-slot', centerSlot);
    elements.list.replaceChildren(...entries.map(createSlide));
    elements.counter.textContent = items.length
      ? `${currentIndex + 1} / ${items.length}`
      : '0 / 0';
    elements.container.classList.toggle('hidden', items.length === 0);
    syncFavoriteButton();
  }

  function init(cards) {
    items = [...cards];
    currentIndex = reconcileCurrentIndex(
      items,
      storage.getItem(LAST_CARD_KEY),
      0
    );
    renderWindow();
    bindEvents();
  }

  function persistCurrentCard() {
    const id = items[currentIndex]?.id;
    if (id) storage.setItem(LAST_CARD_KEY, id);
    else storage.removeItem(LAST_CARD_KEY);
  }

  function commitIndex(index, { persist = true } = {}) {
    currentIndex = wrapIndex(index, items.length);
    renderWindow();
    if (persist) persistCurrentCard();
    return currentIndex;
  }

  function showIndex(index) {
    if (items.length === 0 || index < 0 || index >= items.length) return false;
    commitIndex(index);
    return true;
  }

  function showCard(id) {
    const index = items.findIndex((card) => card.id === id);
    return index === -1 ? false : showIndex(index);
  }

  function setCards(cards, { preferredId } = {}) {
    const previousId = preferredId ?? items[currentIndex]?.id ?? null;
    const previousIndex = currentIndex;
    items = [...cards];
    currentIndex = reconcileCurrentIndex(items, previousId, previousIndex);
    renderWindow();
    persistCurrentCard();
  }

  function resetVisualPosition() {
    elements.list.style.setProperty('--drag-offset', '0px');
    elements.list.style.setProperty('--transition-offset', '0px');
    elements.list.classList.remove('is-dragging', 'is-animating');
  }

  function finishAnimation() {
    if (phase !== 'animating') return;
    const delta = animationDelta;
    const resolve = animationResolve;
    animationDelta = 0;
    animationResolve = null;
    if (delta) commitIndex(currentIndex + delta);
    resetVisualPosition();
    phase = 'idle';
    syncFavoriteButton();
    resolve?.(Boolean(delta));
  }

  function animateBy(delta) {
    if (items.length <= 1) return Promise.resolve(false);
    if (phase === 'animating') {
      finishAnimation();
    }

    phase = 'animating';
    animationDelta = delta;
    elements.list.classList.remove('is-dragging');
    elements.list.classList.add('is-animating');
    syncFavoriteButton();
    for (const slide of elements.list.children) {
      const newOffset = parseInt(slide.dataset.offset, 10) - delta;
      slide.dataset.offset = String(newOffset);
      slide.classList.toggle('is-active', newOffset === 0);
      slide.classList.toggle('is-prev', newOffset === -1);
      slide.classList.toggle('is-next', newOffset === 1);
    }
    elements.list.style.setProperty('--drag-offset', '0px');
    elements.list.style.setProperty(
      '--transition-offset',
      delta > 0 ? 'calc(0px - var(--slide-step))' : 'var(--slide-step)'
    );

    const promise = new Promise((resolve) => {
      animationResolve = resolve;
    });
    if (reducedMotion?.matches) requestFrame(finishAnimation);
    return promise;
  }

  function animateBack() {
    phase = 'animating';
    animationDelta = 0;
    elements.list.classList.remove('is-dragging');
    elements.list.classList.add('is-animating');
    syncFavoriteButton();
    elements.list.style.setProperty('--drag-offset', '0px');
    const promise = new Promise((resolve) => {
      animationResolve = resolve;
    });
    if (reducedMotion?.matches) requestFrame(finishAnimation);
    return promise;
  }

  function cancelInteraction() {
    if (phase === 'destroyed') return;
    drag = null;
    axis = null;
    if (phase !== 'animating') phase = 'idle';
    resetVisualPosition();
    syncFavoriteButton();
  }

  function handlePointer(event) {
    if (event.type === 'pointerdown') {
      suppressClick = false;
      if (phase !== 'idle' || items.length <= 1) return;
      if (event.target.closest?.('button, .star')) return;
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        startedAt: now(),
      };
      axis = null;
      phase = 'dragging';
      syncFavoriteButton();
      try { elements.list.setPointerCapture?.(event.pointerId); } catch {}
      return;
    }

    if (phase !== 'dragging' || !drag) return;
    if (event.type === 'pointercancel' || event.type === 'lostpointercapture') {
      cancelInteraction();
      return;
    }

    if (event.type === 'pointermove') {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      drag.currentX = event.clientX;
      if (!axis && Math.max(Math.abs(dx), Math.abs(dy)) >= AXIS_LOCK_DISTANCE) {
        axis = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
      }
      if (axis === 'vertical') {
        cancelInteraction();
        return;
      }
      if (axis === 'horizontal') {
        event.preventDefault?.();
        if (Math.abs(dx) > AXIS_LOCK_DISTANCE) suppressClick = true;
        elements.list.classList.add('is-dragging');
        elements.list.style.setProperty('--drag-offset', `${dx}px`);
      }
      return;
    }

    if (event.type === 'pointerup') {
      const dx = drag.currentX - drag.startX;
      const elapsed = Math.max(1, now() - drag.startedAt);
      const velocity = Math.abs(dx) / elapsed;
      const wasHorizontal = axis === 'horizontal';
      const shouldMove = wasHorizontal && (
        Math.abs(dx) >= SWIPE_DISTANCE || velocity >= SWIPE_VELOCITY
      );
      drag = null;
      axis = null;
      phase = 'idle';
      if (shouldMove) animateBy(dx < 0 ? 1 : -1);
      else {
        if (wasHorizontal) resetVisualPosition();
        syncFavoriteButton();
      }
    }
  }

  function handleVisibilityChange() {
    if (document.hidden) cancelInteraction();
  }

  function handleClick(event) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (phase !== 'idle') return;
    const slide = event.target.closest?.('.splide__slide');
    const card = event.target.closest?.('.card');
    if (slide?.classList.contains('is-active') && card) {
      card.classList.toggle('flipped');
    }
  }

  async function handleFavoriteClick(event) {
    event.stopPropagation();
    if (phase !== 'idle' || favoritePending) return;
    const card = items[currentIndex];
    if (!card) return;

    favoritePending = true;
    syncFavoriteButton();
    try {
      const updated = await onToggleFavorite?.(
        card.id,
        !Boolean(card.favorite)
      );
      if (!updated) return;
      const index = items.findIndex((item) => item.id === card.id);
      if (index !== -1) {
        items[index] = {
          ...items[index],
          favorite: Boolean(updated.favorite),
        };
      }
    } catch (error) {
      console.error('Nepodarilo sa zmeniť obľúbenú kartu:', error);
    } finally {
      favoritePending = false;
      syncFavoriteButton();
    }
  }

  function bindEvents() {
    if (listenersBound) return;
    listenersBound = true;
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel',
      'lostpointercapture'].forEach((type) => {
      elements.list.addEventListener(type, handlePointer);
    });
    elements.list.addEventListener('click', handleClick);
    elements.list.addEventListener('transitionend', finishAnimation);
    elements.favoriteButton.addEventListener('click', handleFavoriteClick);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  function unbindEvents() {
    if (!listenersBound) return;
    listenersBound = false;
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel',
      'lostpointercapture'].forEach((type) => {
      elements.list.removeEventListener(type, handlePointer);
    });
    elements.list.removeEventListener('click', handleClick);
    elements.list.removeEventListener('transitionend', finishAnimation);
    elements.favoriteButton.removeEventListener('click', handleFavoriteClick);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  async function moveBy(delta) {
    if (items.length <= 1) return false;
    return animateBy(delta);
  }

  return {
    init,
    setCards,
    showCard,
    showIndex,
    next: () => moveBy(1),
    previous: () => moveBy(-1),
    getCurrentCardId: () => items[currentIndex]?.id || null,
    setOnEditCard(callback) {
      onEditCard = callback;
    },
    setOnToggleFavorite(callback) {
      onToggleFavorite = callback;
    },
    destroy() {
      unbindEvents();
      phase = 'destroyed';
      resetVisualPosition();
      elements.list.replaceChildren();
    },
  };
}
