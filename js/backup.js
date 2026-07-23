export function collectBackupSettings(storage, ui) {
  return {
    translation: storage.loadTranslationSettings(),
    fontSizes: storage.loadFontSizes(),
    showArrows: ui.getShowArrows(),
  };
}

export function applyBackupSettings(settings, storage, ui) {
  storage.saveTranslationSettings(
    settings.translation.source,
    settings.translation.target
  );
  storage.saveFontSizes(settings.fontSizes.front, settings.fontSizes.back);
  ui.setShowArrows(settings.showArrows);
}

export function getImportErrorMessage(error) {
  if (error?.message === 'Unsupported backup version') {
    return 'Táto verzia zálohy nie je podporovaná.';
  }
  if (error?.message === 'Cards could not be persisted') {
    return 'Import sa nepodarilo uložiť.';
  }
  return 'Vybraný súbor nie je platná záloha.';
}
