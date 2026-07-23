export const COLORS = [
  '#c09f80', '#d8b5a5', '#e6c2a8', '#f0d9b5', '#f5e3c4',
  '#e0d5b9', '#c4b5a6', '#b8a5a5', '#a79c9c', '#938e8c',
  '#b5c6d8', '#c2d4e6', '#d0e2f1', '#e1f0fa', '#f2f9ff',
];

export async function runCardMutation(mutate, failureMessage, notify) {
  try {
    return { ok: true, value: await mutate() };
  } catch {
    notify(failureMessage);
    return { ok: false, value: null };
  }
}

export function getDeleteConfirmCopy() {
  return {
    title: 'Vymazať kartu?',
    message: 'Táto karta sa odstráni natrvalo.',
    confirmText: 'Vymazať',
    cancelText: 'Zrušiť',
  };
}

export function createCardEditor({
  elements,
  cards,
  ui,
  confirm,
  toast,
  translation,
}) {
  let editingId = null;
  let selectedColor = COLORS[0];

  function renderColors(color) {
    selectedColor = COLORS.includes(color) ? color : COLORS[0];
    const options = COLORS.map((value) => {
      const option = elements.colorPicker.ownerDocument.createElement('div');
      option.classList.add('color-option');
      option.classList.toggle('selected', value === selectedColor);
      option.style.background = value;
      option.dataset.color = value;
      option.addEventListener('click', () => {
        selectedColor = value;
        options.forEach((item) => {
          item.classList.toggle('selected', item === option);
        });
      });
      return option;
    });
    elements.colorPicker.replaceChildren(...options);
  }

  function close() {
    elements.overlay.classList.add('hidden');
    editingId = null;
  }

  function open(card = null) {
    editingId = card?.id || null;
    const isEdit = Boolean(editingId);
    elements.title.textContent = isEdit ? 'Upraviť kartu' : 'Nová karta';
    elements.saveButton.textContent = isEdit ? 'Uložiť' : 'Pridať';
    elements.deleteButton.classList.toggle('hidden', !isEdit);
    elements.frontInput.value = card?.front || '';
    elements.hintInput.value = card?.hint || '';
    elements.backInput.value = card?.back || '';
    translation.clearFeedback();
    renderColors(card?.color || COLORS[Math.floor(Math.random() * COLORS.length)]);
    elements.overlay.classList.remove('hidden');
    elements.frontInput.focus();
  }

  async function submit(event) {
    event?.preventDefault();
    const card = {
      front: elements.frontInput.value.trim(),
      hint: elements.hintInput.value.trim(),
      back: elements.backInput.value.trim(),
      color: selectedColor,
    };
    if (!card.front || !card.back) return;

    if (editingId) {
      const result = await runCardMutation(
        () => cards.update(editingId, card),
        'Kartu sa nepodarilo uložiť.',
        toast
      );
      if (result.ok) close();
      return;
    }

    const result = await runCardMutation(
      () => cards.add(card),
      'Kartu sa nepodarilo uložiť.',
      toast
    );
    if (!result.ok) return;
    close();
    ui.showCard(result.value.id);
  }

  async function remove() {
    if (!editingId || !await confirm(getDeleteConfirmCopy())) return;
    const result = await runCardMutation(
      () => cards.delete(editingId),
      'Kartu sa nepodarilo vymazať.',
      toast
    );
    if (result.ok) close();
  }

  return { open, close, submit, remove };
}
