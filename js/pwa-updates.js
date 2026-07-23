export const UPDATE_MESSAGE_TYPE = 'APP_UPDATE_READY';

export function isServiceWorkerUpdateMessage(data) {
  return data?.type === UPDATE_MESSAGE_TYPE;
}

export function createServiceWorkerUpdateController(reload, onUpdate) {
  let waitingWorker = null;
  let refreshing = false;

  return {
    setWaiting(worker) {
      waitingWorker = worker;
      if (worker) onUpdate();
    },

    apply() {
      waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
    },

    controllerChanged() {
      if (refreshing) return;
      refreshing = true;
      reload();
    },
  };
}

export function initPwaUpdates({ serviceWorker, reload, showUpdate }) {
  if (!serviceWorker) return { apply() {} };
  const controller = createServiceWorkerUpdateController(reload, showUpdate);

  serviceWorker.addEventListener('message', (event) => {
    if (isServiceWorkerUpdateMessage(event.data)) showUpdate();
  });

  serviceWorker.ready.then((registration) => {
    if (registration.waiting) controller.setWaiting(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && serviceWorker.controller) {
          controller.setWaiting(worker);
        }
      });
    });
  }).catch(() => {});

  serviceWorker.addEventListener(
    'controllerchange',
    () => controller.controllerChanged()
  );

  return controller;
}
