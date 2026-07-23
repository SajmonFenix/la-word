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

test('an installed update only shows the banner and does not reload', async () => {
  const reloads = [];
  const updates = [];
  const serviceWorkerListeners = {};
  const registrationListeners = {};
  const workerListeners = {};
  const worker = {
    state: 'installing',
    addEventListener: (type, listener) => {
      workerListeners[type] = listener;
    },
  };
  const registration = {
    waiting: null,
    installing: worker,
    addEventListener: (type, listener) => {
      registrationListeners[type] = listener;
    },
  };
  const serviceWorker = {
    controller: {},
    ready: Promise.resolve(registration),
    addEventListener: (type, listener) => {
      serviceWorkerListeners[type] = listener;
    },
  };

  initPwaUpdates({
    serviceWorker,
    reload: () => reloads.push('reload'),
    showUpdate: () => updates.push('ready'),
  });
  await Promise.resolve();
  registrationListeners.updatefound();
  worker.state = 'installed';
  workerListeners.statechange();

  assert.deepEqual(updates, ['ready']);
  assert.deepEqual(reloads, []);
  assert.equal(typeof serviceWorkerListeners.controllerchange, 'function');
});
