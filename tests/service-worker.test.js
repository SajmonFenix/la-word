import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadServiceWorker() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  const listeners = {};
  let skipWaitingCount = 0;
  const context = {
    URL,
    caches: {
      open: async () => ({ addAll: async () => {} }),
      keys: async () => [],
      delete: async () => true,
      match: async () => null,
    },
    self: {
      registration: { scope: 'https://example.test/' },
      clients: {
        claim: async () => {},
        matchAll: async () => [],
      },
      addEventListener: (type, listener) => {
        listeners[type] = listener;
      },
      skipWaiting: () => {
        skipWaitingCount += 1;
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    listeners,
    skipWaitingCalls: () => skipWaitingCount,
  };
}

test('install precaches the shell without activating the worker', async () => {
  const { listeners, skipWaitingCalls } = loadServiceWorker();
  const pending = [];

  listeners.install({ waitUntil: (promise) => pending.push(promise) });
  await Promise.all(pending);

  assert.equal(skipWaitingCalls(), 0);
});

test('SKIP_WAITING message activates the waiting worker', () => {
  const { listeners, skipWaitingCalls } = loadServiceWorker();

  listeners.message({ data: { type: 'SKIP_WAITING' } });

  assert.equal(skipWaitingCalls(), 1);
});
