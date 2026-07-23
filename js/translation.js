export const TRANSLATE_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20"/><path d="M12 2a15.3 15.3 0 0 0 0 20"/></svg>';
export const TRANSLATION_FAILURE_MESSAGE =
  'Preklad sa nepodaril. Skús to znova alebo ho dopíš ručne.';

export async function requestTranslation(text, languages, fetchFn) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${languages.source}|${languages.target}`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error('Translation unavailable');

  const data = await response.json();
  const translated = data.responseData?.translatedText;
  if (!translated) throw new Error('Translation unavailable');
  return translated;
}

export function createTranslationController({ elements, storage, fetchFn }) {
  function setFeedback(message, type = '') {
    elements.feedback.textContent = message;
    elements.feedback.classList.toggle('hidden', !message);
    elements.feedback.classList.toggle('form-feedback-error', type === 'error');
    elements.feedback.classList.toggle('form-feedback-muted', type === 'muted');
  }

  return {
    async translate() {
      const text = elements.frontInput.value.trim();
      if (!text) {
        elements.frontInput.focus();
        return;
      }
      if (elements.backInput.value.trim()) {
        elements.backInput.value = '';
        return;
      }

      setFeedback('Prekladám...', 'muted');
      elements.button.textContent = '...';
      elements.button.disabled = true;
      try {
        elements.backInput.value = await requestTranslation(
          text,
          storage.loadTranslationSettings(),
          fetchFn
        );
        setFeedback('');
      } catch {
        setFeedback(TRANSLATION_FAILURE_MESSAGE, 'error');
      } finally {
        elements.button.innerHTML = TRANSLATE_ICON;
        elements.button.disabled = false;
      }
    },
    clearFeedback() {
      setFeedback('');
    },
  };
}
