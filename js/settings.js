export const TRANSLATION_LANGUAGES = ['sk', 'en', 'de', 'es', 'it'];
export const FONT_SIZE_MIN = 70;
export const FONT_SIZE_MAX = 150;
export const FONT_SIZE_STEP = 10;

export function clampFontSize(value) {
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, value));
}

export function chooseDistinctTarget(source, target) {
  return source === target
    ? TRANSLATION_LANGUAGES.find((language) => language !== source)
    : target;
}

export function createSettingsController({ elements, storage, root }) {
  let fontSizes = storage.loadFontSizes();
  let translation = storage.loadTranslationSettings();

  function renderFonts() {
    const frontScale = fontSizes.front / 100;
    const backScale = fontSizes.back / 100;
    elements.frontValue.textContent = `${fontSizes.front}%`;
    elements.backValue.textContent = `${fontSizes.back}%`;
    elements.frontPreview.style.setProperty('--font-scale-front', frontScale);
    elements.backPreview.style.setProperty('--font-scale-back', backScale);
    root.style.setProperty('--font-scale-front', frontScale);
    root.style.setProperty('--font-scale-back', backScale);
  }

  function renderLanguages() {
    elements.sourceSelect.value = translation.source;
    elements.targetSelect.value = translation.target;
  }

  renderFonts();
  renderLanguages();

  return {
    adjustFontSize(type, direction) {
      fontSizes[type] = clampFontSize(
        fontSizes[type] + direction * FONT_SIZE_STEP
      );
      renderFonts();
      storage.saveFontSizes(fontSizes.front, fontSizes.back);
    },
    changeLanguages() {
      const source = elements.sourceSelect.value;
      const target = chooseDistinctTarget(source, elements.targetSelect.value);
      translation = { source, target };
      renderLanguages();
      storage.saveTranslationSettings(source, target);
    },
    refresh() {
      fontSizes = storage.loadFontSizes();
      translation = storage.loadTranslationSettings();
      renderFonts();
      renderLanguages();
    },
  };
}
