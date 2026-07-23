function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const cards = {
  _items: [],

  async init() {
    this._items = await storage.load();
    this._notify();
  },

  getAll() {
    return [...this._items];
  },

  getById(id) {
    return this._items.find(c => c.id === id) || null;
  },

  async add({ front, hint, back, color }) {
    return this._commitMutation(() => {
      const card = {
        id: generateId(),
        front: front.trim(),
        hint: (hint || '').trim(),
        back: back.trim(),
        color: color || '#4A90D9',
        createdAt: Date.now()
      };
      this._items.push(card);
      return card;
    });
  },

  async update(id, updates) {
    const index = this._items.findIndex(c => c.id === id);
    if (index === -1) return null;
    return this._commitMutation(() => {
      this._items[index] = { ...this._items[index], ...updates };
      return this._items[index];
    });
  },

  async delete(id) {
    const index = this._items.findIndex(c => c.id === id);
    if (index === -1) return false;
    return this._commitMutation(() => {
      this._items.splice(index, 1);
      return true;
    });
  },

  count() {
    return this._items.length;
  },

  async _commitMutation(mutate) {
    const previous = this._items.map(card => ({ ...card }));
    const result = mutate();
    try {
      await storage.save(this._items);
      this._notify();
      return result;
    } catch (error) {
      this._items = previous;
      throw error;
    }
  },

  _notify() {
    const event = new CustomEvent('cards-change', { detail: this._items });
    document.dispatchEvent(event);
  }
};
