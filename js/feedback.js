export function createFeedback(elements, timers = {
  setTimer: globalThis.setTimeout.bind(globalThis),
  clearTimer: globalThis.clearTimeout.bind(globalThis),
}) {
  let pendingResolve = null;
  let toastTimer = null;

  function resolveConfirm(result) {
    elements.overlay.classList.add('hidden');
    if (!pendingResolve) return;
    pendingResolve(result);
    pendingResolve = null;
  }

  elements.cancelButton.addEventListener('click', () => resolveConfirm(false));
  elements.confirmButton.addEventListener('click', () => resolveConfirm(true));
  elements.overlay.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) resolveConfirm(false);
  });

  return {
    confirm(copy) {
      elements.title.textContent = copy.title;
      elements.message.textContent = copy.message;
      elements.confirmButton.textContent = copy.confirmText;
      elements.cancelButton.textContent = copy.cancelText;
      elements.overlay.classList.remove('hidden');
      return new Promise((resolve) => {
        pendingResolve = resolve;
      });
    },

    toast(message) {
      elements.toast.textContent = message;
      elements.toast.classList.remove('hidden');
      timers.clearTimer(toastTimer);
      toastTimer = timers.setTimer(
        () => elements.toast.classList.add('hidden'),
        2600
      );
    },
  };
}
