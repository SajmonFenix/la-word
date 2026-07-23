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
