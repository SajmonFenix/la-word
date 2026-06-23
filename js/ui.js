const STORAGE_KEY_SHOW_ARROWS = 'laword_show_arrows';

const ui = {
  _currentIndex: 0,
  _swiper: null,
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
      container.innerHTML = '<div class="swiper-wrapper"></div>';
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

    if (this._swiper) {
      this._swiper.destroy(true, true);
      this._swiper = null;
    }

    if (this._clickHandler) {
      container.removeEventListener('click', this._clickHandler);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'swiper-wrapper';

    all.forEach((card, i) => {
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';

      slide.innerHTML = `
        <div class="card">
          <div class="card-inner">
            <div class="card-front" style="background:${card.color}">
              <span class="card-front-text"></span>
              <span class="hint"></span>
            </div>
            <div class="card-back" style="background:${card.color}">
              <span class="card-back-text"></span>
              <div class="card-back-actions">
                <button class="btn-edit" title="Upraviť">✏️</button>
              </div>
            </div>
          </div>
        </div>
      `;

      slide.querySelector('.card-front-text').textContent = card.front;
      const hintEl = slide.querySelector('.hint');
      hintEl.textContent = card.hint || '';
      hintEl.style.display = card.hint ? '' : 'none';
      slide.querySelector('.card-back-text').textContent = card.back;

      wrapper.appendChild(slide);
    });

    container.innerHTML = '';
    container.appendChild(wrapper);

    this._swiper = new Swiper(container, {
      effect: 'coverflow',
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 'auto',
      spaceBetween: 8,
      loop: true,
      loopedSlides: 1,
      initialSlide: this._currentIndex,
      coverflowEffect: {
        rotate: 0,
        stretch: 0,
        depth: 15,
        modifier: 0.5,
        slideShadows: false,
      },
      navigation: {
        prevEl: '#btn-prev',
        nextEl: '#btn-next',
      },
      on: {
        slideChange: () => {
          if (this._swiper) {
            this._currentIndex = this._swiper.realIndex;
            this._updateCounter();
            this._unflipAllCards();
          }
        },
      },
    });

    this._clickHandler = (e) => {
      const btn = e.target.closest('.btn-edit');
      if (btn) {
        e.stopPropagation();
        const slide = btn.closest('.swiper-slide');
        const idx = Array.from(wrapper.children).indexOf(slide);
        if (this.onEditCard) {
          this.onEditCard(all[idx]);
        }
        return;
      }

      const cardEl = e.target.closest('.swiper-slide .card');
      if (cardEl) {
        const slide = cardEl.closest('.swiper-slide');
        if (slide && slide.classList.contains('swiper-slide-active')) {
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
      if (this._swiper) {
        this._swiper.slideToLoop(idx, 0);
      }
    }
  },

  showNext() {
    if (this._swiper) this._swiper.slideNext();
  },

  showPrev() {
    if (this._swiper) this._swiper.slidePrev();
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
    document.querySelectorAll('.swiper-slide .card.flipped').forEach(card => {
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
    if (this._swiper) {
      this._swiper.slideToLoop(idx, 300);
    }
    return idx;
  },
};
