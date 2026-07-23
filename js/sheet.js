export const SHEET_DISMISS_THRESHOLD = 80;
const INTERACTIVE_SELECTOR = 'input, select, textarea, button, .color-option, label, a';

export function shouldStartSheetDrag(target) {
  return !target.closest(INTERACTIVE_SELECTOR);
}

export function shouldCloseSheet(deltaY) {
  return deltaY >= SHEET_DISMISS_THRESHOLD;
}

export function bindDismissibleSheet(overlay, sheet, close) {
  let startY = 0;
  let currentY = 0;
  let dragging = false;

  const end = () => {
    if (!dragging) return;
    const deltaY = Math.max(0, currentY - startY);
    dragging = false;
    sheet.classList.remove('sheet-dragging');
    sheet.style.transform = '';
    overlay.style.background = '';
    if (shouldCloseSheet(deltaY)) close();
  };

  sheet.addEventListener('pointerdown', (event) => {
    if (!shouldStartSheetDrag(event.target)) return;
    startY = event.clientY;
    currentY = event.clientY;
    dragging = true;
    sheet.classList.add('sheet-dragging');
    sheet.setPointerCapture(event.pointerId);
  });

  sheet.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    currentY = event.clientY;
    const deltaY = Math.max(0, currentY - startY);
    sheet.style.transform = `translateY(${deltaY}px)`;
    overlay.style.background = `rgba(0,0,0,${Math.max(0.18, 0.4 - deltaY / 500)})`;
  });

  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
}
