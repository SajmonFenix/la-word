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
    setPointerCapture() {},
    releasePointerCapture() {},
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

export function createSliderHarness(initialStorage = {}, options = {}) {
  const values = new Map(Object.entries(initialStorage));
  const container = createNode();
  const list = createNode();
  const counter = createNode();
  const previousButton = createNode('button');
  const nextButton = createNode('button');
  const documentNode = createNode('document');
  const document = {
    createElement: (tagName) => createNode(tagName),
    addEventListener: documentNode.addEventListener,
    removeEventListener: documentNode.removeEventListener,
    dispatchEvent: documentNode.dispatchEvent,
    hidden: false,
  };
  let currentTime = 0;
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
  const pointerTarget = {
    closest: (selector) => selector === 'button' ? null : activeCard(),
  };
  const dispatchPointer = (type, x, y = 0) => {
    list.dispatchEvent({
      type,
      pointerId: 1,
      clientX: x,
      clientY: y,
      target: pointerTarget,
      preventDefault() {},
    });
  };

  const harness = {
    dependencies: {
      elements: { container, list, counter, previousButton, nextButton },
      storage,
      document,
      requestFrame: (callback) => callback(),
      now: () => currentTime,
      reducedMotion: { matches: options.reducedMotion ?? true },
    },
    storage,
    list,
    counter,
    activeText: () => activeFront()?.children[0].textContent,
    activeFront,
    activeBack,
    activeFace: activeFront,
    pointerDown(x, y = 0) {
      dispatchPointer('pointerdown', x, y);
    },
    pointerMove(x, y = 0) {
      dispatchPointer('pointermove', x, y);
    },
    pointerUp(x, y = 0) {
      dispatchPointer('pointerup', x, y);
    },
    cancelPointer() {
      dispatchPointer('pointercancel', 0, 0);
    },
    swipe({ from, to, duration }) {
      currentTime = 0;
      dispatchPointer('pointerdown', from, 0);
      currentTime = duration;
      dispatchPointer('pointermove', to, 0);
      dispatchPointer('pointerup', to, 0);
    },
    diagonalSwipe({ dx, dy }) {
      currentTime = 0;
      dispatchPointer('pointerdown', 100, 0);
      currentTime = 100;
      dispatchPointer('pointermove', 100 + dx, dy);
      dispatchPointer('pointerup', 100 + dx, dy);
    },
    hideDocument() {
      document.hidden = true;
      document.dispatchEvent({ type: 'visibilitychange', target: document });
    },
    finishAnimation() {
      list.dispatchEvent({ type: 'transitionend', target: list });
      return Promise.resolve();
    },
    async finishAllAnimations() {
      for (let index = 0; index < 3; index += 1) {
        await harness.finishAnimation();
      }
    },
    listenerCount() {
      return list.listenerCount() + documentNode.listenerCount();
    },
  };
  return harness;
}
