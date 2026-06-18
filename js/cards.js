function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const cards = {
  _items: [],

  init() {
    this._items = storage.load();
    this._notify();
  },

  getAll() {
    return [...this._items];
  },

  getById(id) {
    return this._items.find(c => c.id === id) || null;
  },

  add({ front, hint, back, color }) {
    const card = {
      id: generateId(),
      front: front.trim(),
      hint: (hint || '').trim(),
      back: back.trim(),
      color: color || '#4A90D9',
      createdAt: Date.now()
    };
    this._items.push(card);
    this._persist();
    return card;
  },

  update(id, updates) {
    const index = this._items.findIndex(c => c.id === id);
    if (index === -1) return null;
    this._items[index] = { ...this._items[index], ...updates };
    this._persist();
    return this._items[index];
  },

  delete(id) {
    const index = this._items.findIndex(c => c.id === id);
    if (index === -1) return false;
    this._items.splice(index, 1);
    this._persist();
    return true;
  },

  count() {
    return this._items.length;
  },

  _persist() {
    storage.save(this._items);
    this._notify();
  },

  _notify() {
    const event = new CustomEvent('cards-change', { detail: this._items });
    document.dispatchEvent(event);
  }
};
