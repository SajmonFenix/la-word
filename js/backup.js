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

export function createBackupController({
  storage,
  cards,
  applySettings,
  refreshSettings,
  confirm,
  toast,
}) {
  return {
    async importText(text) {
      try {
        storage.parseImportData(text);
        const accepted = await confirm({
          title: 'Importovať karty?',
          message: 'Import nahradí všetky existujúce karty.',
          confirmText: 'Importovať',
          cancelText: 'Zrušiť',
        });
        if (!accepted) return false;

        const imported = await storage.importData(text, applySettings);
        await cards.init();
        refreshSettings();
        toast(`Importovaných kariet: ${imported.cards.length}.`);
        return true;
      } catch (error) {
        toast(getImportErrorMessage(error));
        return false;
      }
    },
  };
}
