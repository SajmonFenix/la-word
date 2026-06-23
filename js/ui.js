const STORAGE_KEY_SHOW_ARROWS = 'laword_show_arrows';
const SWIPE_THRESHOLD = 70;

const PENCIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';

const ui = {
  _currentIndex: 0,
  _clickHandler: null,
  _pointerHandler: null,
  _dragStartX: 0,
  _dragCurrentX: 0,
  _isDragging: false,
  _didDrag: false,
  onEditCard: null,
  _showArrows: true,

  init() {
    this._currentIndex = 0;
    this._showArrows = localStorage.getItem(STORAGE_KEY_SHOW_ARROWS) !== 'false';
    this._applyArrowsVisibility();
    this.render();
  },

  refresh() {
    const all = cards.getAll();
    if (all.length === 0) {
      this._currentIndex = 0;
    } else if (this._currentIndex >= all.length) {
      this._currentIndex = all.length - 1;
    }
    this.render();
  },

  render() {
    const all = cards.getAll();
    const container = document.getElementById('card-container');
    const emptyState = document.getElementById('empty-state');
    const cardArea = document.getElementById('card-area');

    this._unbindContainerEvents(container);

    if (all.length === 0) {
      container.innerHTML = '<div class="splide__track"><div class="splide__list"></div></div>';
      container.classList.add('hidden');
      emptyState.classList.remove('hidden');
      cardArea.classList.add('hidden');
      this._updateCounter();
      return;
    }

    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    cardArea.classList.remove('hidden');

    const track = document.createElement('div');
    track.className = 'splide__track';

    const list = document.createElement('div');
    list.className = 'splide__list';

    all.forEach((card, index) => {
      const slide = document.createElement('div');
      slide.className = 'splide__slide';
      slide.dataset.index = String(index);

      slide.innerHTML = `
        <div class="card">
          <div class="card-front" style="background:${card.color}">
            <span class="card-front-text"></span>
            <span class="hint"></span>
          </div>
          <div class="card-back" style="background:${card.color}">
            <span class="card-back-text"></span>
            <div class="card-back-actions">
              <button class="btn-edit" title="Upraviť" aria-label="Upraviť kartu">${PENCIL_SVG}</button>
            </div>
          </div>
        </div>
      `;

      slide.querySelector('.card-front-text').textContent = card.front;
      const hintEl = slide.querySelector('.hint');
      hintEl.textContent = card.hint || '';
      hintEl.style.display = card.hint ? '' : 'none';
      slide.querySelector('.card-back-text').textContent = card.back;

      list.appendChild(slide);
    });

    track.appendChild(list);
    container.innerHTML = '';
    container.appendChild(track);

    this._bindContainerEvents(container);
    this._syncSlides();
    this._updateCounter();
  },

  showCard(id) {
    const all = cards.getAll();
    const idx = all.findIndex(c => c.id === id);
    if (idx !== -1) {
      this._currentIndex = idx;
      this._syncSlides();
      this._updateCounter();
    }
  },

  showNext() {
    this._moveBy(1);
  },

  showPrev() {
    this._moveBy(-1);
  },

  toggleArrows(show) {
    this._showArrows = show;
    localStorage.setItem(STORAGE_KEY_SHOW_ARROWS, show);
    this._applyArrowsVisibility();
  },

  search(query) {
    const all = cards.getAll();
    const q = query.toLowerCase().trim();
    if (!q || all.length === 0) return null;

    const idx = all.findIndex(c =>
      c.front.toLowerCase().includes(q) ||
      (c.hint && c.hint.toLowerCase().includes(q)) ||
      c.back.toLowerCase().includes(q)
    );

    if (idx === -1) return null;

    this._currentIndex = idx;
    this._syncSlides();
    this._updateCounter();
    return idx;
  },

  _moveBy(delta) {
    const all = cards.getAll();
    if (all.length === 0) return;
    this._currentIndex = (this._currentIndex + delta + all.length) % all.length;
    this._syncSlides();
    this._updateCounter();
    this._unflipAllCards();
  },

  _bindContainerEvents(container) {
    this._clickHandler = (e) => {
      const btn = e.target.closest('.btn-edit');
      if (btn) {
        e.stopPropagation();
        const slide = btn.closest('.splide__slide');
        const idx = Number(slide.dataset.index);
        const card = cards.getAll()[idx];
        if (card && this.onEditCard) this.onEditCard(card);
        return;
      }

      if (this._didDrag) {
        this._didDrag = false;
        return;
      }

      const cardEl = e.target.closest('.splide__slide .card');
      const slide = cardEl?.closest('.splide__slide');
      if (cardEl && slide?.classList.contains('is-active')) {
        cardEl.classList.toggle('flipped');
      }
    };

    this._pointerHandler = (e) => this._handlePointer(e);

    container.addEventListener('click', this._clickHandler);
    container.addEventListener('pointerdown', this._pointerHandler);
    container.addEventListener('pointermove', this._pointerHandler);
    container.addEventListener('pointerup', this._pointerHandler);
    container.addEventListener('pointercancel', this._pointerHandler);
  },

  _unbindContainerEvents(container) {
    if (this._clickHandler) {
      container.removeEventListener('click', this._clickHandler);
      this._clickHandler = null;
    }

    if (this._pointerHandler) {
      container.removeEventListener('pointerdown', this._pointerHandler);
      container.removeEventListener('pointermove', this._pointerHandler);
      container.removeEventListener('pointerup', this._pointerHandler);
      container.removeEventListener('pointercancel', this._pointerHandler);
      this._pointerHandler = null;
    }
  },

  _handlePointer(e) {
    const all = cards.getAll();
    if (all.length <= 1) return;

    if (e.type === 'pointerdown') {
      const activeCard = e.target.closest('.splide__slide.is-active .card');
      if (!activeCard || e.target.closest('button')) return;
      this._dragStartX = e.clientX;
      this._dragCurrentX = e.clientX;
      this._isDragging = true;
      this._didDrag = false;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (!this._isDragging) return;

    if (e.type === 'pointermove') {
      this._dragCurrentX = e.clientX;
      const dx = this._dragCurrentX - this._dragStartX;
      if (Math.abs(dx) > 8) this._didDrag = true;
      this._setDragOffset(dx);
      return;
    }

    const dx = this._dragCurrentX - this._dragStartX;
    this._isDragging = false;
    this._setDragOffset(0);

    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      dx < 0 ? this.showNext() : this.showPrev();
    }
  },

  _syncSlides() {
    const all = cards.getAll();
    const list = document.querySelector('#card-container .splide__list');
    if (!list || all.length === 0) return;

    list.style.setProperty('--current-index', this._currentIndex);
    list.style.setProperty('--drag-offset', '0px');

    list.querySelectorAll('.splide__slide').forEach((slide, index) => {
      slide.classList.toggle('is-active', index === this._currentIndex);
      slide.classList.toggle('is-prev', index === this._getWrappedIndex(-1));
      slide.classList.toggle('is-next', index === this._getWrappedIndex(1));
    });
  },

  _setDragOffset(dx) {
    const list = document.querySelector('#card-container .splide__list');
    if (list) list.style.setProperty('--drag-offset', `${dx}px`);
  },

  _getWrappedIndex(offset) {
    const all = cards.getAll();
    if (all.length === 0) return -1;
    return (this._currentIndex + offset + all.length) % all.length;
  },

  _updateCounter() {
    const all = cards.getAll();
    const el = document.getElementById('card-counter');
    el.textContent = all.length === 0 ? '0 / 0' : `${this._currentIndex + 1} / ${all.length}`;
  },

  _applyArrowsVisibility() {
    document.getElementById('btn-prev').classList.toggle('hidden', !this._showArrows);
    document.getElementById('btn-next').classList.toggle('hidden', !this._showArrows);
  },

  _unflipAllCards() {
    document.querySelectorAll('.splide__slide .card.flipped').forEach(card => {
      card.classList.remove('flipped');
    });
  },
};
