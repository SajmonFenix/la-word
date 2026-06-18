const ui = {
  _currentIndex: 0,
  _isFlipped: false,
  _isAnimating: false,
  _wasDragged: false,
  _arrowsBound: false,

  init() {
    this._currentIndex = 0;
    this._isFlipped = false;
    this.render();
    this._bindCardEvents();
    this._bindSwipe();
    if (!this._arrowsBound) {
      this._bindArrows();
      this._arrowsBound = true;
    }
    this._updateCounter();
  },

  refresh() {
    const all = cards.getAll();
    if (all.length === 0) {
      this._currentIndex = 0;
    } else if (this._currentIndex >= all.length) {
      this._currentIndex = all.length - 1;
    }
    this._isFlipped = false;
    this.render();
    this._updateCounter();
  },

  render() {
    const all = cards.getAll();
    const container = document.getElementById('card-container');
    const emptyState = document.getElementById('empty-state');
    const cardArea = document.getElementById('card-area');
    const card = document.getElementById('card');

    if (all.length === 0) {
      container.classList.add('hidden');
      emptyState.classList.remove('hidden');
      if (cardArea) cardArea.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    if (cardArea) cardArea.classList.remove('hidden');

    if (this._currentIndex >= all.length) {
      this._currentIndex = Math.max(0, all.length - 1);
    }

    const current = all[this._currentIndex];
    document.getElementById('card-front-text').textContent = current.front;
    document.getElementById('card-hint').textContent = current.hint || '';
    document.getElementById('card-hint').style.display = current.hint ? '' : 'none';
    document.getElementById('card-back-text').textContent = current.back;

    const front = card.querySelector('.card-front');
    const back = card.querySelector('.card-back');
    front.style.background = current.color;
    back.style.background = current.color;

    this._isFlipped = false;
    card.classList.remove('flipped');
    card.style.transform = '';
    card.style.opacity = '1';

    this._updateCounter();
  },

  showNext() {
    if (this._isAnimating) return;
    const all = cards.getAll();
    if (all.length === 0) return;
    if (this._currentIndex >= all.length - 1) {
      this._currentIndex = 0;
    } else {
      this._currentIndex++;
    }
    this._isFlipped = false;
    this.render();
  },

  showPrev() {
    if (this._isAnimating) return;
    const all = cards.getAll();
    if (all.length === 0) return;
    if (this._currentIndex <= 0) {
      this._currentIndex = all.length - 1;
    } else {
      this._currentIndex--;
    }
    this._isFlipped = false;
    this.render();
  },

  _bindCardEvents() {
    const card = document.getElementById('card');
    card.addEventListener('click', (e) => {
      if (this._isAnimating) return;
      if (this._wasDragged) {
        this._wasDragged = false;
        return;
      }
      this._isFlipped = !this._isFlipped;
      card.classList.toggle('flipped');
    });
  },

  _bindSwipe() {
    const card = document.getElementById('card');
    let startX = 0;
    let startY = 0;
    let isDragging = false;

    card.addEventListener('touchstart', (e) => {
      if (this._isFlipped) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = false;
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (this._isFlipped) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        isDragging = true;
        card.classList.add('swiping');
        card.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`;
        card.style.opacity = Math.max(0, 1 - Math.abs(dx) / 400);
      }
    }, { passive: true });

    card.addEventListener('touchend', () => {
      if (!isDragging) return;
      this._wasDragged = true;
      card.classList.remove('swiping');
      const match = card.style.transform.match(/translateX\((-?\d+)/);
      const dx = match ? parseInt(match[1]) : 0;
      if (Math.abs(dx) > 100) {
        if (dx < 0) this.showNext();
        else this.showPrev();
      } else {
        card.style.transform = '';
        card.style.opacity = '1';
      }
      isDragging = false;
    }, { passive: true });

    card.addEventListener('mousedown', (e) => {
      if (this._isFlipped) return;
      startX = e.clientX;
      startY = e.clientY;
      isDragging = false;

      const onMove = (e) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          isDragging = true;
          card.classList.add('swiping');
          card.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`;
          card.style.opacity = Math.max(0, 1 - Math.abs(dx) / 400);
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (!isDragging) return;
        this._wasDragged = true;
        card.classList.remove('swiping');
        const match = card.style.transform.match(/translateX\((-?\d+)/);
        const dx = match ? parseInt(match[1]) : 0;
        if (Math.abs(dx) > 100) {
          if (dx < 0) this.showNext();
          else this.showPrev();
        } else {
          card.style.transform = '';
          card.style.opacity = '1';
        }
        isDragging = false;
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  },

  _bindArrows() {
    document.getElementById('btn-prev').addEventListener('click', () => this.showPrev());
    document.getElementById('btn-next').addEventListener('click', () => this.showNext());
  },

  showCard(id) {
    const all = cards.getAll();
    const idx = all.findIndex(c => c.id === id);
    if (idx !== -1) {
      this._currentIndex = idx;
      this.render();
    }
  },

  _updateCounter() {
    const all = cards.getAll();
    const el = document.getElementById('card-counter');
    if (all.length === 0) {
      el.textContent = '0 / 0';
    } else {
      el.textContent = `${this._currentIndex + 1} / ${all.length}`;
    }
  }
};
