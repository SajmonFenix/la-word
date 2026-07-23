function createClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    toggle(name, force) {
      const enabled = force ?? !values.has(name);
      enabled ? values.add(name) : values.delete(name);
      return enabled;
    },
    contains: (name) => values.has(name),
  };
}

function createStyle() {
  const values = new Map();
  return {
    setProperty: (name, value) => values.set(name, String(value)),
    removeProperty: (name) => values.delete(name),
    getPropertyValue: (name) => values.get(name) || '',
  };
}

function createNode(tagName = 'div') {
  const listeners = new Map();
  return {
    tagName: tagName.toUpperCase(),
    children: [],
    dataset: {},
    style: createStyle(),
    classList: createClassList(),
    textContent: '',
    hidden: false,
    className: '',
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = [...children];
    },
    setAttribute(name, value) {
      this[name] = String(value);
    },
    addEventListener(type, listener) {
      const group = listeners.get(type) || new Set();
      group.add(listener);
      listeners.set(type, group);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      event.currentTarget = this;
      listeners.get(event.type)?.forEach((listener) => listener(event));
    },
    listenerCount() {
      return [...listeners.values()].reduce(
        (sum, group) => sum + group.size,
        0
      );
    },
  };
}

export function makeCards(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${index + 1}`,
    front: `front-${index + 1}`,
    hint: `hint-${index + 1}`,
    back: `back-${index + 1}`,
    color: '#4A90D9',
    createdAt: index + 1,
  }));
}

export function createSliderHarness(initialStorage = {}) {
  const values = new Map(Object.entries(initialStorage));
  const container = createNode();
  const list = createNode();
  const counter = createNode();
  const previousButton = createNode('button');
  const nextButton = createNode('button');
  const document = {
    createElement: (tagName) => createNode(tagName),
  };
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const activeSlide = () => list.children.find(
    (slide) => slide.classList.contains('is-active')
  );
  const activeCard = () => activeSlide()?.children[0];
  const activeFront = () => activeCard()?.children[0];
  const activeBack = () => activeCard()?.children[1];

  return {
    dependencies: {
      elements: { container, list, counter, previousButton, nextButton },
      storage,
      document,
      requestFrame: (callback) => callback(),
      now: () => 0,
    },
    storage,
    list,
    counter,
    activeText: () => activeFront()?.children[0].textContent,
    activeFront,
    activeBack,
    activeFace: activeFront,
  };
}
