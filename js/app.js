const COLORS = [
   '#c09f80', '#d8b5a5', '#e6c2a8', '#f0d9b5', '#f5e3c4',
   '#e0d5b9', '#c4b5a6', '#b8a5a5', '#a79c9c', '#938e8c',
   '#b5c6d8', '#c2d4e6', '#d0e2f1', '#e1f0fa', '#f2f9ff'
];
const TRANSLATE_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20"/><path d="M12 2a15.3 15.3 0 0 0 0 20"/></svg>';
const TRANSLATION_LANGUAGES = ['sk', 'en', 'de', 'es', 'it'];
const SHEET_DISMISS_THRESHOLD = 80;
const INTERACTIVE_SHEET_SELECTOR = 'input, select, textarea, button, .color-option, label, a';
const UPDATE_MESSAGE_TYPE = 'APP_UPDATE_READY';

let editingId = null;
let _searchActive = false;
let fontSizes = { front: 100, back: 100 };
let translationSettings = { source: 'sk', target: 'en' };
let pendingConfirmResolve = null;
let waitingServiceWorker = null;

// Font size constraints
const FONT_SIZE_MIN = 70;
const FONT_SIZE_MAX = 150;
const FONT_SIZE_STEP = 10;

function openSearch() {
  _searchActive = true;
  document.getElementById('header-actions').classList.add('hidden');
  document.getElementById('search-bar').classList.remove('hidden');
  document.getElementById('search-input').value = '';
  document.getElementById('search-feedback').classList.add('hidden');
  setTimeout(() => document.getElementById('search-input').focus(), 100);
}

function closeSearch() {
  _searchActive = false;
  document.getElementById('header-actions').classList.remove('hidden');
  document.getElementById('search-bar').classList.add('hidden');
  document.getElementById('search-feedback').classList.add('hidden');
}

function handleSearch() {
  const query = document.getElementById('search-input').value;
  const fb = document.getElementById('search-feedback');

  if (!query.trim()) {
    fb.textContent = 'Zadaj hľadaný výraz';
    fb.classList.remove('hidden');
    return;
  }

  const result = ui.search(query);

  if (result === null) {
    fb.textContent = 'Žiadna karta nevyhovuje hľadaniu';
    fb.classList.remove('hidden');
  } else {
    fb.textContent = `Nájdená karta ${result + 1} / ${cards.getAll().length}`;
    fb.classList.remove('hidden');
    setTimeout(() => fb.classList.add('hidden'), 2000);
    closeSearch();
  }
}

async function init() {
   await cards.init();
   ui.onEditCard = (cardData) => openAddModal(cardData);
   ui.init();
   loadFontSizes();
   loadTranslationSettings();
   bindEvents();
   initServiceWorkerUpdates();
}

function bindEvents() {
   document.getElementById('btn-add').addEventListener('click', openAddModal);
   document.getElementById('btn-cancel').addEventListener('click', closeModal);
   document.getElementById('modal-overlay').addEventListener('click', (e) => {
     if (e.target === e.currentTarget) closeModal();
   });
   document.getElementById('card-form').addEventListener('submit', handleFormSubmit);
   document.getElementById('btn-delete').addEventListener('click', handleDelete);
   document.getElementById('btn-translate').addEventListener('click', handleTranslate);
   document.getElementById('btn-update-app').addEventListener('click', applyAppUpdate);
   document.getElementById('btn-settings').addEventListener('click', openSettings);
   document.getElementById('btn-settings-close').addEventListener('click', closeSettings);
   document.getElementById('btn-export').addEventListener('click', handleExport);
   document.getElementById('btn-import').addEventListener('click', handleImport);
   document.getElementById('settings-overlay').addEventListener('click', (e) => {
     if (e.target === e.currentTarget) closeSettings();
   });
   document.addEventListener('cards-change', () => {
     ui.refresh();
   });
   document.getElementById('toggle-arrows').addEventListener('change', (e) => {
     ui.toggleArrows(e.target.checked);
   });
   document.getElementById('btn-search').addEventListener('click', openSearch);
   document.getElementById('btn-search-close').addEventListener('click', closeSearch);
   document.getElementById('search-input').addEventListener('keydown', (e) => {
     if (e.key === 'Enter') handleSearch();
     if (e.key === 'Escape') closeSearch();
   });
   document.getElementById('btn-prev').addEventListener('click', () => ui.showPrev());
   document.getElementById('btn-next').addEventListener('click', () => ui.showNext());

   // Font size controls
   document.getElementById('btn-front-minus').addEventListener('click', () => adjustFontSize('front', -1));
   document.getElementById('btn-front-plus').addEventListener('click', () => adjustFontSize('front', 1));
   document.getElementById('btn-back-minus').addEventListener('click', () => adjustFontSize('back', -1));
   document.getElementById('btn-back-plus').addEventListener('click', () => adjustFontSize('back', 1));
   document.getElementById('select-source-lang').addEventListener('change', handleTranslationSettingsChange);
   document.getElementById('select-target-lang').addEventListener('change', handleTranslationSettingsChange);
   document.querySelectorAll('[data-settings-view]').forEach((button) => {
     button.addEventListener('click', () => showSettingsView(button.dataset.settingsView));
   });
   document.querySelectorAll('.settings-back').forEach((button) => {
     button.addEventListener('click', () => showSettingsView('menu'));
   });
   document.getElementById('btn-confirm-cancel').addEventListener('click', () => resolveConfirm(false));
   document.getElementById('btn-confirm-ok').addEventListener('click', () => resolveConfirm(true));
   document.getElementById('confirm-overlay').addEventListener('click', (e) => {
     if (e.target === e.currentTarget) resolveConfirm(false);
   });
   bindDismissibleSheet('modal-overlay', 'modal', closeModal);
   bindDismissibleSheet('settings-overlay', 'settings-modal', closeSettings);
}

function openAddModal(cardData) {
  editingId = cardData?.id || null;
  const isEdit = !!editingId;
  document.getElementById('modal-title').textContent = isEdit ? 'Upraviť kartu' : 'Nová karta';
  document.getElementById('btn-save').textContent = isEdit ? 'Uložiť' : 'Pridať';
  document.getElementById('btn-delete').classList.toggle('hidden', !isEdit);
  document.getElementById('input-front').value = cardData?.front || '';
  document.getElementById('input-hint').value = cardData?.hint || '';
  document.getElementById('input-back').value = cardData?.back || '';
  setTranslationFeedback('');
  renderColorPicker(cardData?.color || COLORS[Math.floor(Math.random() * COLORS.length)]);
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('input-front').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
}

function renderColorPicker(selected) {
  const container = document.getElementById('color-picker');
  container.innerHTML = COLORS.map(c =>
    `<div class="color-option ${c === selected ? 'selected' : ''}"
          style="background: ${c}"
          data-color="${c}"></div>`
  ).join('');

  container.querySelectorAll('.color-option').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}

function getSelectedColor() {
  const selected = document.querySelector('#color-picker .color-option.selected');
  return selected ? selected.dataset.color : COLORS[0];
}

function handleFormSubmit(e) {
  e.preventDefault();
  const front = document.getElementById('input-front').value.trim();
  const hint = document.getElementById('input-hint').value.trim();
  const back = document.getElementById('input-back').value.trim();
  const color = getSelectedColor();

  if (!front || !back) return;

  if (editingId) {
    cards.update(editingId, { front, hint, back, color });
  } else {
    const newCard = cards.add({ front, hint, back, color });
    closeModal();
    ui.refresh();
    ui.showCard(newCard.id);
    return;
  }

  closeModal();
  ui.refresh();
}

async function handleDelete() {
  if (!editingId) return;
  const confirmed = await showConfirm(getDeleteConfirmCopy());
  if (!confirmed) return;
  cards.delete(editingId);
  closeModal();
  ui.refresh();
}

async function handleTranslate() {
  const front = document.getElementById('input-front').value.trim();
  const backInput = document.getElementById('input-back');
  const translateBtn = document.getElementById('btn-translate');

  if (!front) {
    document.getElementById('input-front').focus();
    return;
  }

  if (backInput.value.trim()) {
    backInput.value = '';
    return;
  }

  setTranslationFeedback('Prekladám...', 'muted');
  translateBtn.textContent = '...';
  translateBtn.disabled = true;

  try {
    const { source, target } = storage.loadTranslationSettings();
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(front)}&langpair=${source}|${target}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.responseData?.translatedText) {
      backInput.value = data.responseData.translatedText;
      setTranslationFeedback('');
    } else {
      setTranslationFeedback(getTranslationFailureMessage(), 'error');
    }
  } catch {
    setTranslationFeedback(getTranslationFailureMessage(), 'error');
  } finally {
    translateBtn.innerHTML = TRANSLATE_ICON;
    translateBtn.disabled = false;
  }
}

function openSettings() {
  document.getElementById('toggle-arrows').checked = ui._showArrows;
  translationSettings = storage.loadTranslationSettings();
  updateTranslationSettingsUI();
  showSettingsView('menu');
  document.getElementById('settings-overlay').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.add('hidden');
  showSettingsView('menu');
}

function handleExport() {
  const json = storage.exportData();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'la-word-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const confirmed = await showConfirm(getImportConfirmCopy());
    if (!confirmed) return;
    try {
      const text = await file.text();
      await storage.importData(text);
      await cards.init();
      ui.init();
      closeSettings();
      showToast('Karty boli úspešne importované.');
    } catch {
      showToast('Chyba: neplatný súbor.');
    }
  };
  input.click();
}

function adjustFontSize(type, direction) {
   const newSize = fontSizes[type] + (direction * FONT_SIZE_STEP);
   
   // Constrain to min/max
   fontSizes[type] = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, newSize));
   
   // Update UI
   updateFontSizeUI();
   
   // Save to localStorage
   storage.saveFontSizes(fontSizes.front, fontSizes.back);
}

function updateFontSizeUI() {
   const frontValue = fontSizes.front;
   const backValue = fontSizes.back;

   // Update display values
   document.getElementById('front-size-value').textContent = frontValue + '%';
   document.getElementById('back-size-value').textContent = backValue + '%';

   // Update preview scale
   const frontScale = frontValue / 100;
   const backScale = backValue / 100;

   document.getElementById('front-preview').style.setProperty('--font-scale-front', frontScale);
   document.getElementById('back-preview').style.setProperty('--font-scale-back', backScale);

   // Apply to document root for cards
   document.documentElement.style.setProperty('--font-scale-front', frontScale);
   document.documentElement.style.setProperty('--font-scale-back', backScale);
}

function loadFontSizes() {
   fontSizes = storage.loadFontSizes();
   updateFontSizeUI();
}

function loadTranslationSettings() {
   translationSettings = storage.loadTranslationSettings();
   updateTranslationSettingsUI();
}

function updateTranslationSettingsUI() {
   document.getElementById('select-source-lang').value = translationSettings.source;
   document.getElementById('select-target-lang').value = translationSettings.target;
}

function handleTranslationSettingsChange() {
   const source = document.getElementById('select-source-lang').value;
   let target = document.getElementById('select-target-lang').value;
   if (source === target) {
      target = TRANSLATION_LANGUAGES.find(lang => lang !== source) || 'en';
   }
   storage.saveTranslationSettings(source, target);
   translationSettings = storage.loadTranslationSettings();
   updateTranslationSettingsUI();
}

function showSettingsView(viewName) {
   const menu = document.getElementById('settings-menu');
   const details = document.querySelectorAll('.settings-detail');

   menu.classList.toggle('hidden', viewName !== 'menu');
   details.forEach((detail) => detail.classList.add('hidden'));

   if (viewName !== 'menu') {
      document.getElementById(`settings-view-${viewName}`)?.classList.remove('hidden');
   }
}

function getTranslationFailureMessage() {
   return 'Preklad sa nepodaril. Skús to znova alebo ho dopíš ručne.';
}

function getImportConfirmCopy() {
   return {
      title: 'Importovať karty?',
      message: 'Import nahradí všetky existujúce karty.',
      confirmText: 'Importovať',
      cancelText: 'Zrušiť'
   };
}

function getDeleteConfirmCopy() {
   return {
      title: 'Vymazať kartu?',
      message: 'Táto karta sa odstráni natrvalo.',
      confirmText: 'Vymazať',
      cancelText: 'Zrušiť'
   };
}

function isServiceWorkerUpdateMessage(data) {
   return data?.type === UPDATE_MESSAGE_TYPE;
}

function setTranslationFeedback(message, type = '') {
   const el = document.getElementById('translation-feedback');
   el.textContent = message;
   el.classList.toggle('hidden', !message);
   el.classList.toggle('form-feedback-error', type === 'error');
   el.classList.toggle('form-feedback-muted', type === 'muted');
}

function showConfirm(copy) {
   document.getElementById('confirm-title').textContent = copy.title;
   document.getElementById('confirm-message').textContent = copy.message;
   document.getElementById('btn-confirm-ok').textContent = copy.confirmText;
   document.getElementById('btn-confirm-cancel').textContent = copy.cancelText;
   document.getElementById('confirm-overlay').classList.remove('hidden');

   return new Promise((resolve) => {
      pendingConfirmResolve = resolve;
   });
}

function resolveConfirm(result) {
   document.getElementById('confirm-overlay').classList.add('hidden');
   if (pendingConfirmResolve) {
      pendingConfirmResolve(result);
      pendingConfirmResolve = null;
   }
}

function showToast(message) {
   const toast = document.getElementById('toast');
   toast.textContent = message;
   toast.classList.remove('hidden');
   clearTimeout(showToast._timeout);
   showToast._timeout = setTimeout(() => toast.classList.add('hidden'), 2600);
}

function initServiceWorkerUpdates() {
   if (!('serviceWorker' in navigator)) return;

   navigator.serviceWorker.addEventListener('message', (event) => {
      if (isServiceWorkerUpdateMessage(event.data)) {
         showUpdateBanner();
      }
   });

   navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
         waitingServiceWorker = registration.waiting;
         showUpdateBanner();
      }

      registration.addEventListener('updatefound', () => {
         const worker = registration.installing;
         if (!worker) return;
         worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
               waitingServiceWorker = worker;
               showUpdateBanner();
            }
         });
      });
   });

   let refreshing = false;
   navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
   });
}

function showUpdateBanner() {
   document.getElementById('update-banner').classList.remove('hidden');
}

function applyAppUpdate() {
   document.getElementById('update-banner').classList.add('hidden');
   if (waitingServiceWorker) {
      waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
      return;
   }
   window.location.reload();
}

function shouldStartSheetDrag(target) {
   return !target.closest(INTERACTIVE_SHEET_SELECTOR);
}

function shouldCloseSheet(deltaY) {
   return deltaY >= SHEET_DISMISS_THRESHOLD;
}

function bindDismissibleSheet(overlayId, sheetId, closeFn) {
   const overlay = document.getElementById(overlayId);
   const sheet = document.getElementById(sheetId);
   let startY = 0;
   let currentY = 0;
   let isDragging = false;

   sheet.addEventListener('pointerdown', (e) => {
      if (!shouldStartSheetDrag(e.target)) return;
      startY = e.clientY;
      currentY = e.clientY;
      isDragging = true;
      sheet.classList.add('sheet-dragging');
      sheet.setPointerCapture(e.pointerId);
   });

   sheet.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      currentY = e.clientY;
      const deltaY = Math.max(0, currentY - startY);
      sheet.style.transform = `translateY(${deltaY}px)`;
      overlay.style.background = `rgba(0,0,0,${Math.max(0.18, 0.4 - deltaY / 500)})`;
   });

   const endDrag = () => {
      if (!isDragging) return;
      const deltaY = Math.max(0, currentY - startY);
      isDragging = false;
      sheet.classList.remove('sheet-dragging');
      sheet.style.transform = '';
      overlay.style.background = '';

      if (shouldCloseSheet(deltaY)) {
         closeFn();
      }
   };

   sheet.addEventListener('pointerup', endDrag);
   sheet.addEventListener('pointercancel', endDrag);
}

document.addEventListener('DOMContentLoaded', init);
