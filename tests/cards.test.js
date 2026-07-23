import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadCards(storage) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'cards.js'), 'utf8');
  const events = [];
  const context = {
    storage,
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    document: {
      dispatchEvent: (event) => events.push(event),
    },
  };

  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.__cards = cards;`, context);
  return { cards: context.__cards, events };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('add waits for persistence before publishing the new model', async () => {
  const pending = deferred();
  const { cards, events } = loadCards({
    save: () => pending.promise,
    load: async () => [],
  });

  const operation = cards.add({ front: 'dom', back: 'house', hint: '', color: '#123456' });
  assert.equal(cards.count(), 1);
  assert.equal(events.length, 0);

  pending.resolve({ persisted: true, indexedDB: true, localStorage: true });
  const card = await operation;

  assert.equal(card.front, 'dom');
  assert.equal(events.length, 1);
});

test('add rolls back the in-memory model when persistence totally fails', async () => {
  const { cards, events } = loadCards({
    save: async () => { throw new Error('Cards could not be persisted'); },
    load: async () => [],
  });

  await assert.rejects(
    cards.add({ front: 'dom', back: 'house', hint: '', color: '#123456' }),
    /Cards could not be persisted/
  );

  assert.equal(cards.count(), 0);
  assert.equal(events.length, 0);
});

test('update restores the original card when persistence fails', async () => {
  const original = {
    id: 'a',
    front: 'dom',
    hint: '',
    back: 'house',
    color: '#123456',
    createdAt: 1,
  };
  let failSave = false;
  const { cards, events } = loadCards({
    load: async () => [original],
    save: async () => {
      if (failSave) throw new Error('Cards could not be persisted');
      return { persisted: true };
    },
  });
  await cards.init();
  events.length = 0;
  failSave = true;

  await assert.rejects(cards.update('a', { front: 'byt' }), /Cards could not be persisted/);

  assert.equal(cards.getById('a').front, 'dom');
  assert.equal(events.length, 0);
});

test('delete restores the removed card when persistence fails', async () => {
  const original = {
    id: 'a',
    front: 'dom',
    hint: '',
    back: 'house',
    color: '#123456',
    createdAt: 1,
  };
  let failSave = false;
  const { cards, events } = loadCards({
    load: async () => [original],
    save: async () => {
      if (failSave) throw new Error('Cards could not be persisted');
      return { persisted: true };
    },
  });
  await cards.init();
  events.length = 0;
  failSave = true;

  await assert.rejects(cards.delete('a'), /Cards could not be persisted/);

  assert.equal(cards.count(), 1);
  assert.equal(cards.getById('a').front, 'dom');
  assert.equal(events.length, 0);
});
