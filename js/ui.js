const STORAGE_KEY_SHOW_ARROWS = 'laword_show_arrows';

const PENCIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';

const ui = {
  _currentIndex: 0,
  _splide: null,
  _clickHandler: null,
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

    if (this._currentIndex >= all.length) {
      this._currentIndex = Math.max(0, all.length - 1);
    }

    if (this._splide) {
      this._splide.destroy(true);
      this._splide = null;
    }

    if (this._clickHandler) {
      container.removeEventListener('click', this._clickHandler);
    }

    const track = document.createElement('div');
    track.className = 'splide__track';

    const list = document.createElement('div');
    list.className = 'splide__list';

    all.forEach((card, i) => {
      const slide = document.createElement('div');
      slide.className = 'splide__slide';

      slide.innerHTML = `
        <div class="card">
          <div class="card-front" style="background:${card.color}">
            <span class="card-front-text"></span>
            <span class="hint"></span>
          </div>
          <div class="card-back" style="background:${card.color}">
            <span class="card-back-text"></span>
            <div class="card-back-actions">
              <button class="btn-edit" title="Upraviť">${PENCIL_SVG}</button>
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

    this._splide = new Splide(container, {
      type: 'loop',
      perPage: 1,
      perMove: 1,
      gap: '8px',
      padding: { left: '15vw', right: '15vw' },
      focus: 'center',
      pagination: false,
      arrows: false,
      trimSpace: true,
      speed: 400,
      start: this._currentIndex,
    });

    this._splide.on('mounted move', () => {
      this._currentIndex = this._splide.index;
      this._updateCounter();
      this._unflipAllCards();
    });

    this._splide.mount();

    this._clickHandler = (e) => {
      const btn = e.target.closest('.btn-edit');
      if (btn) {
        e.stopPropagation();
        const slide = btn.closest('.splide__slide');
        const idx = Array.from(list.children).indexOf(slide);
        if (this.onEditCard) {
          this.onEditCard(all[idx]);
        }
        return;
      }

      const cardEl = e.target.closest('.splide__slide .card');
      if (cardEl) {
        const slide = cardEl.closest('.splide__slide');
        if (slide && slide.classList.contains('is-active')) {
          cardEl.classList.toggle('flipped');
        }
      }
    };

    container.addEventListener('click', this._clickHandler);

    this._updateCounter();
  },

  showCard(id) {
    const all = cards.getAll();
    const idx = all.findIndex(c => c.id === id);
    if (idx !== -1) {
      this._currentIndex = idx;
      if (this._splide) {
        this._splide.go(idx);
      }
    }
  },

  showNext() {
    if (this._splide) this._splide.go('>');
  },

  showPrev() {
    if (this._splide) this._splide.go('<');
  },

  _updateCounter() {
    const all = cards.getAll();
    const el = document.getElementById('card-counter');
    if (all.length === 0) {
      el.textContent = '0 / 0';
    } else {
      el.textContent = `${this._currentIndex + 1} / ${all.length}`;
    }
  },

  toggleArrows(show) {
    this._showArrows = show;
    localStorage.setItem(STORAGE_KEY_SHOW_ARROWS, show);
    this._applyArrowsVisibility();
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
    if (this._splide) {
      this._splide.go(idx);
    }
    return idx;
  },
};
