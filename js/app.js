const COLORS = [
  '#4A90D9', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6',
  '#E91E63', '#00BCD4', '#FF9800', '#795548', '#607D8B'
];

let editingId = null;

function init() {
  cards.init();
  ui.init();
  bindEvents();
}

function bindEvents() {
  document.getElementById('btn-add').addEventListener('click', openAddModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('card-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('btn-translate').addEventListener('click', handleTranslate);
  document.addEventListener('cards-change', () => {
    ui.refresh();
  });
}

function openAddModal(cardData) {
  editingId = cardData?.id || null;
  document.getElementById('modal-title').textContent = editingId ? 'Upraviť kartu' : 'Nová karta';
  document.getElementById('btn-save').textContent = editingId ? 'Uložiť' : 'Pridať';
  document.getElementById('input-front').value = cardData?.front || '';
  document.getElementById('input-hint').value = cardData?.hint || '';
  document.getElementById('input-back').value = cardData?.back || '';
  renderColorPicker(cardData?.color || COLORS[0]);
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

  translateBtn.textContent = '...';
  translateBtn.disabled = true;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(front)}&langpair=sk|en`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.responseData?.translatedText) {
      backInput.value = data.responseData.translatedText;
    }
  } catch {
    // silent fail
  } finally {
    translateBtn.textContent = '🌐';
    translateBtn.disabled = false;
  }
}

function injectEditButton() {
  const observer = new MutationObserver(() => {
    const cardBack = document.querySelector('.card-back');
    if (cardBack && !cardBack.querySelector('.card-back-actions')) {
      const actions = document.createElement('div');
      actions.className = 'card-back-actions';
      actions.innerHTML = `<button id="btn-edit" title="Upraviť">✏️</button>`;
      cardBack.appendChild(actions);

      document.getElementById('btn-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        const all = cards.getAll();
        const current = all[ui._currentIndex];
        if (current) {
          document.getElementById('card').classList.remove('flipped');
          ui._isFlipped = false;
          openAddModal(current);
        }
      });
    }
  });
  observer.observe(document.getElementById('card'), { childList: true, subtree: true });
}

document.addEventListener('DOMContentLoaded', injectEditButton);
document.addEventListener('DOMContentLoaded', init);
