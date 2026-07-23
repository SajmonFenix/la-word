import { storage } from './storage.js';
import { cards } from './cards.js';
import { ui } from './ui.js';
import { createFeedback } from './feedback.js';
import { bindDismissibleSheet } from './sheet.js';
import { initPwaUpdates } from './pwa-updates.js';
import { createSearchController } from './search.js';
import { createTranslationController } from './translation.js';
import { createSettingsController } from './settings.js';
import { applyBackupSettings, collectBackupSettings, createBackupController } from './backup.js';
import { createCardEditor } from './card-editor.js';

export function getRequiredElement(document, id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element;
}

export async function initApp(document = globalThis.document) {
  const $ = (id) => getRequiredElement(document, id);
  const feedback = createFeedback({
    overlay: $('confirm-overlay'), title: $('confirm-title'), message: $('confirm-message'),
    confirmButton: $('btn-confirm-ok'), cancelButton: $('btn-confirm-cancel'), toast: $('toast'),
  });
  const translation = createTranslationController({
    elements: { frontInput: $('input-front'), backInput: $('input-back'), button: $('btn-translate'), feedback: $('translation-feedback') },
    storage, fetchFn: globalThis.fetch.bind(globalThis),
  });
  const settings = createSettingsController({
    elements: {
      frontValue: $('front-size-value'), backValue: $('back-size-value'),
      frontPreview: $('front-preview'), backPreview: $('back-preview'),
      sourceSelect: $('select-source-lang'), targetSelect: $('select-target-lang'),
    },
    storage, root: document.documentElement,
  });
  const editor = createCardEditor({
    elements: {
      overlay: $('modal-overlay'), title: $('modal-title'), saveButton: $('btn-save'),
      deleteButton: $('btn-delete'), frontInput: $('input-front'), hintInput: $('input-hint'),
      backInput: $('input-back'), colorPicker: $('color-picker'),
    },
    cards, ui, confirm: feedback.confirm, toast: feedback.toast, translation,
  });
  const search = createSearchController({
    elements: {
      headerActions: $('header-actions'), searchBar: $('search-bar'),
      input: $('search-input'), feedback: $('search-feedback'),
    },
    cards, ui, setTimer: globalThis.setTimeout.bind(globalThis),
  });
  const backup = createBackupController({
    storage, cards,
    applySettings: (value) => applyBackupSettings(value, storage, ui),
    refreshSettings: settings.refresh, confirm: feedback.confirm, toast: feedback.toast,
  });
  const showSettingsView = (name) => {
    $('settings-menu').classList.toggle('hidden', name !== 'menu');
    document.querySelectorAll('.settings-detail').forEach((item) => item.classList.add('hidden'));
    if (name !== 'menu') $(`settings-view-${name}`).classList.remove('hidden');
  };
  const closeSettings = () => { $('settings-overlay').classList.add('hidden'); showSettingsView('menu'); };
  const updates = initPwaUpdates({
    serviceWorker: globalThis.navigator?.serviceWorker,
    reload: () => globalThis.location.reload(),
    showUpdate: () => $('update-banner').classList.remove('hidden'),
  });

  $('btn-add').addEventListener('click', () => editor.open());
  $('btn-cancel').addEventListener('click', editor.close);
  $('btn-delete').addEventListener('click', editor.remove);
  $('card-form').addEventListener('submit', editor.submit);
  $('modal-overlay').addEventListener('click', (event) => { if (event.target === event.currentTarget) editor.close(); });
  $('btn-translate').addEventListener('click', translation.translate);
  $('btn-search').addEventListener('click', search.open);
  $('btn-search-close').addEventListener('click', search.close);
  $('search-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') search.search();
    if (event.key === 'Escape') search.close();
  });
  $('btn-prev').addEventListener('click', () => ui.showPrev());
  $('btn-next').addEventListener('click', () => ui.showNext());
  $('toggle-arrows').addEventListener('change', (event) => ui.toggleArrows(event.target.checked));
  [['btn-front-minus', 'front', -1], ['btn-front-plus', 'front', 1], ['btn-back-minus', 'back', -1], ['btn-back-plus', 'back', 1]]
    .forEach(([id, type, direction]) => $(id).addEventListener('click', () => settings.adjustFontSize(type, direction)));
  $('select-source-lang').addEventListener('change', settings.changeLanguages);
  $('select-target-lang').addEventListener('change', settings.changeLanguages);
  $('btn-settings').addEventListener('click', () => {
    $('toggle-arrows').checked = ui.getShowArrows();
    settings.refresh(); showSettingsView('menu'); $('settings-overlay').classList.remove('hidden');
  });
  $('btn-settings-close').addEventListener('click', closeSettings);
  $('settings-overlay').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeSettings(); });
  document.querySelectorAll('[data-settings-view]').forEach((button) => button.addEventListener('click', () => showSettingsView(button.dataset.settingsView)));
  document.querySelectorAll('.settings-back').forEach((button) => button.addEventListener('click', () => showSettingsView('menu')));
  $('btn-export').addEventListener('click', () => {
    const blob = new Blob([storage.exportData(cards.getAll(), collectBackupSettings(storage, ui))], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'la-carta-backup.json'; link.click(); URL.revokeObjectURL(url);
  });
  $('btn-import').addEventListener('click', () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file && await backup.importText(await file.text())) closeSettings();
    };
    input.click();
  });
  $('btn-update-app').addEventListener('click', () => { $('update-banner').classList.add('hidden'); updates.apply(); });
  bindDismissibleSheet($('modal-overlay'), $('modal'), editor.close);
  bindDismissibleSheet($('settings-overlay'), $('settings-modal'), closeSettings);
  await cards.init();
  ui.onEditCard = editor.open;
  ui.init();
  document.addEventListener('cards-change', () => ui.refresh());
  const recovery = storage.consumeRecoveryNotice();
  if (recovery) feedback.toast(recovery);
  globalThis.navigator?.serviceWorker?.register('service-worker.js');
}

globalThis.document?.addEventListener('DOMContentLoaded', () => initApp());
