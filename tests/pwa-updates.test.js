import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createServiceWorkerUpdateController,
  initPwaUpdates,
  isServiceWorkerUpdateMessage,
} from '../js/pwa-updates.js';

test('update controller waits for apply and reloads once', () => {
  const messages = [];
  let updates = 0;
  let reloads = 0;
  const controller = createServiceWorkerUpdateController(
    () => { reloads += 1; },
    () => { updates += 1; }
  );

  controller.setWaiting({ postMessage: (message) => messages.push(message) });
  assert.equal(updates, 1);
  assert.equal(messages.length, 0);

  controller.apply();
  assert.deepEqual(messages, [{ type: 'SKIP_WAITING' }]);
  controller.controllerChanged();
  controller.controllerChanged();
  assert.equal(reloads, 1);
});

test('recognizes only the app update message', () => {
  assert.equal(isServiceWorkerUpdateMessage({ type: 'APP_UPDATE_READY' }), true);
  assert.equal(isServiceWorkerUpdateMessage({ type: 'OTHER' }), false);
  assert.equal(isServiceWorkerUpdateMessage(null), false);
});

test('initialization tolerates failed service worker readiness', async () => {
  const listeners = {};
  const serviceWorker = {
    ready: Promise.reject(new Error('registration failed')),
    addEventListener: (type, listener) => { listeners[type] = listener; },
  };

  const controller = initPwaUpdates({
    serviceWorker,
    reload: () => {},
    showUpdate: () => {},
  });

  await Promise.resolve();
  assert.equal(typeof controller.apply, 'function');
  assert.equal(typeof listeners.controllerchange, 'function');
});
